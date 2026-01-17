import { readFile, writeFile, mkdir, readdir, rename, unlink, access, stat } from 'fs/promises';
import path from 'path';
import { invokeClaudeCode } from '@/lib/claude';
import { updateAgencyCall } from '@/lib/agency-calls';
import { sendSMS, normalizePhoneNumber } from '@/lib/twilio';

const JOBS_DIR = path.join(process.cwd(), 'data/jobs/postcall');
const CALLS_DIR = path.join(process.cwd(), 'data/calls');
const PUBLIC_CALL_DIR = path.join(process.cwd(), 'public/call');
const ERROR_FILE = path.join(process.cwd(), 'data/errors/postcall-errors.json');

const MAX_ATTEMPTS = 3;
const INTERVAL_MS = 5000;
const PROCESSING_TIMEOUT_MS = 90_000;
const STALE_PROCESSING_MS = 10 * 60 * 1000;

interface PostcallJob {
  callId: string;
  prompt: string;
  createdAt: string;
  attempts: number;
}

interface ErrorEntry {
  callId: string;
  error: string;
  attempts: number;
  timestamp: string;
}

let workerStarted = false;

interface SendPostcallSMSParams {
  callerPhone: string;
  agencyName: string;
  callId: string;
}

async function sendPostcallSMS({
  callerPhone,
  agencyName,
  callId,
}: SendPostcallSMSParams): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const pageUrl = `${baseUrl}/call/${callId}`;
  const message = `${agencyName} found properties for you: ${pageUrl}`;

  try {
    const normalizedPhone = normalizePhoneNumber(callerPhone);
    await sendSMS(normalizedPhone, message);
    console.log(`[SMS] Sent to ${normalizedPhone} for call ${callId}`);
  } catch (error) {
    console.error(`[SMS] Failed for call ${callId}:`, error);
    // Log error but don't throw - page generation succeeded
  }
}

export async function enqueuePostcallJob(callId: string, prompt: string): Promise<void> {
  await mkdir(JOBS_DIR, { recursive: true });
  const job: PostcallJob = {
    callId,
    prompt,
    createdAt: new Date().toISOString(),
    attempts: 0
  };
  const jobPath = path.join(JOBS_DIR, `${callId}.json`);
  await writeFile(jobPath, JSON.stringify(job, null, 2));
}

export function ensurePostcallWorker(): void {
  if (workerStarted) return;
  workerStarted = true;

  // Use a single interval per process
  setInterval(() => {
    void processPostcallJobsOnce();
  }, INTERVAL_MS);
}

export async function processPostcallJobsOnce(): Promise<void> {
  let files: string[] = [];
  try {
    files = await readdir(JOBS_DIR);
  } catch {
    return;
  }

  await recoverStaleProcessingJobs(files);

  const jobFiles = files.filter(file => file.endsWith('.json'));
  for (const file of jobFiles) {
    const jobPath = path.join(JOBS_DIR, file);
    const processingPath = jobPath.replace(/\.json$/, '.processing');

    try {
      await rename(jobPath, processingPath);
    } catch {
      continue;
    }

    try {
      const contents = await readFile(processingPath, 'utf-8');
      const job = JSON.parse(contents) as PostcallJob;

      const updatedJob = { ...job, attempts: job.attempts + 1 };

      if (updatedJob.attempts > MAX_ATTEMPTS) {
        await appendPostcallError({
          callId: job.callId,
          error: 'Exceeded max attempts',
          attempts: updatedJob.attempts,
          timestamp: new Date().toISOString()
        });
        await markCallFailed(job.callId);
        await unlink(processingPath);
        continue;
      }

      const callSnapshot = await readCallSnapshot(job.callId);

      await runWithTimeout(
        invokeClaudeCode({
          prompt: job.prompt,
          workingDir: process.cwd(),
          activitySessionId: `postcall-${job.callId}`,
          activitySourceLabel: 'Postcall agent',
        }),
        PROCESSING_TIMEOUT_MS
      );

      const htmlPath = path.join(PUBLIC_CALL_DIR, `${job.callId}.html`);
      try {
        await access(htmlPath);
      } catch {
        await appendPostcallError({
          callId: job.callId,
          error: 'Post-call HTML not generated',
          attempts: updatedJob.attempts,
          timestamp: new Date().toISOString()
        });
        await writeFile(processingPath, JSON.stringify(updatedJob, null, 2));
        await rename(processingPath, jobPath);
        continue;
      }

      await markCallCompleted(job.callId, callSnapshot);
      await unlink(processingPath);
    } catch (error) {
      await appendPostcallError({
        callId: file.replace(/\.json$/, ''),
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts: 1,
        timestamp: new Date().toISOString()
      });

      try {
        await rename(processingPath, jobPath);
      } catch {
        // Ignore rename failures
      }
    }
  }
}

async function recoverStaleProcessingJobs(files: string[]): Promise<void> {
  const processingFiles = files.filter(file => file.endsWith('.processing'));
  const now = Date.now();

  for (const file of processingFiles) {
    const processingPath = path.join(JOBS_DIR, file);
    try {
      const fileStat = await stat(processingPath);
      if ((now - fileStat.mtimeMs) > STALE_PROCESSING_MS) {
        const jobPath = processingPath.replace(/\.processing$/, '.json');
        await rename(processingPath, jobPath);
      }
    } catch {
      // Ignore stale recovery failures
    }
  }
}

function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Post-call generation timed out'));
    }, timeoutMs);

    promise
      .then(result => resolve(result))
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

async function markCallCompleted(
  callId: string,
  fallback?: {
    callerPhone?: string | null;
    agencyName?: string | null;
    agencyId?: string | null;
  }
): Promise<void> {
  const callFile = path.join(CALLS_DIR, `${callId}.json`);
  try {
    const data = JSON.parse(await readFile(callFile, 'utf-8')) as {
      agencyId?: string;
      agencyName?: string;
      callerPhone?: string;
      pageStatus?: string;
      pageUrl?: string | null;
      generatedAt?: string | null;
      callerName?: string | null;
      summary?: string | null;
    };

    if (!data.callerPhone && fallback?.callerPhone) {
      data.callerPhone = fallback.callerPhone;
    }
    if (!data.agencyName && fallback?.agencyName) {
      data.agencyName = fallback.agencyName;
    }
    if (!data.agencyId && fallback?.agencyId) {
      data.agencyId = fallback.agencyId;
    }

    data.pageStatus = 'completed';
    data.pageUrl = `/call/${callId}`;
    data.generatedAt = new Date().toISOString();

    await writeFile(callFile, JSON.stringify(data, null, 2));

    // Send SMS notification to caller
    if (data.callerPhone) {
      await sendPostcallSMS({
        callerPhone: data.callerPhone,
        agencyName: data.agencyName || 'Voqo',
        callId,
      });
    }

    if (data.agencyId) {
      await updateAgencyCall(data.agencyId, callId, {
        pageUrl: data.pageUrl,
        status: 'completed',
        callerName: data.callerName || null,
        summary: data.summary || null
      });
    }
  } catch (error) {
    await appendPostcallError({
      callId,
      error: error instanceof Error ? error.message : 'Failed to update call status',
      attempts: 0,
      timestamp: new Date().toISOString()
    });
  }
}

async function readCallSnapshot(callId: string): Promise<{
  callerPhone?: string | null;
  agencyName?: string | null;
  agencyId?: string | null;
} | undefined> {
  const callFile = path.join(CALLS_DIR, `${callId}.json`);
  try {
    const data = JSON.parse(await readFile(callFile, 'utf-8')) as {
      callerPhone?: string | null;
      agencyName?: string | null;
      agencyId?: string | null;
    };
    return {
      callerPhone: data.callerPhone ?? null,
      agencyName: data.agencyName ?? null,
      agencyId: data.agencyId ?? null
    };
  } catch {
    return undefined;
  }
}

async function markCallFailed(callId: string): Promise<void> {
  const callFile = path.join(CALLS_DIR, `${callId}.json`);
  try {
    const data = JSON.parse(await readFile(callFile, 'utf-8')) as {
      agencyId?: string;
      pageStatus?: string;
      pageUrl?: string | null;
      generatedAt?: string | null;
    };

    data.pageStatus = 'failed';
    data.pageUrl = null;
    data.generatedAt = new Date().toISOString();

    await writeFile(callFile, JSON.stringify(data, null, 2));

    if (data.agencyId) {
      await updateAgencyCall(data.agencyId, callId, {
        status: 'failed'
      });
    }
  } catch {
    // Ignore failures on error path
  }
}

async function appendPostcallError(entry: ErrorEntry): Promise<void> {
  const errorDir = path.dirname(ERROR_FILE);
  await mkdir(errorDir, { recursive: true });

  let existing: ErrorEntry[] = [];
  try {
    const contents = await readFile(ERROR_FILE, 'utf-8');
    existing = JSON.parse(contents) as ErrorEntry[];
  } catch {
    // No existing file
  }

  existing.unshift(entry);
  await writeFile(ERROR_FILE, JSON.stringify(existing, null, 2));
}
