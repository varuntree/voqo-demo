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
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const STALE_PROCESSING_MS = 20 * 60 * 1000;

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
      await writeFile(processingPath, JSON.stringify(updatedJob, null, 2));

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

      // If the call page is already generated (for example, Claude Code wrote the HTML before the job timed out),
      // finalize the job without re-running Claude Code. This is critical for sending the SMS and preventing
      // infinite retries.
      if (await isPostcallOutputReady(job.callId)) {
        await markCallCompleted(job.callId, callSnapshot);
        await unlink(processingPath);
        continue;
      }

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
      let callId = file.replace(/\.json$/, '');
      let attempts = 1;
      try {
        const contents = await readFile(processingPath, 'utf-8');
        const job = JSON.parse(contents) as Partial<PostcallJob>;
        if (typeof job.callId === 'string') callId = job.callId;
        if (typeof job.attempts === 'number') attempts = job.attempts;
      } catch {
        // ignore
      }

      await appendPostcallError({
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempts,
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
    const data = JSON.parse(await readFile(callFile, 'utf-8')) as Record<string, unknown>;

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
    if (!data.generatedAt) {
      data.generatedAt = new Date().toISOString();
    }

    await writeFile(callFile, JSON.stringify(data, null, 2));

    // Send SMS notification to caller
    const callerPhone = typeof data.callerPhone === 'string' ? data.callerPhone : null;
    const agencyName = typeof data.agencyName === 'string' ? data.agencyName : 'Voqo';
    const smsSentAt = typeof data.smsSentAt === 'string' ? data.smsSentAt : null;

    if (callerPhone && !smsSentAt) {
      try {
        await sendPostcallSMS({
          callerPhone,
          agencyName,
          callId,
        });
        data.smsSentAt = new Date().toISOString();
        await writeFile(callFile, JSON.stringify(data, null, 2));
      } catch {
        // sendPostcallSMS already logs; do not fail the job
      }
    }

    const agencyId = typeof data.agencyId === 'string' ? data.agencyId : null;
    if (agencyId) {
      await updateAgencyCall(agencyId, callId, {
        pageUrl: typeof data.pageUrl === 'string' ? data.pageUrl : null,
        status: 'completed',
        callerName: typeof data.callerName === 'string' ? data.callerName : null,
        summary: typeof data.summary === 'string' ? data.summary : null
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

async function isPostcallOutputReady(callId: string): Promise<boolean> {
  const callFile = path.join(CALLS_DIR, `${callId}.json`);
  const htmlPath = path.join(PUBLIC_CALL_DIR, `${callId}.html`);

  try {
    await access(htmlPath);
  } catch {
    return false;
  }

  try {
    const data = JSON.parse(await readFile(callFile, 'utf-8')) as Record<string, unknown>;
    const pageStatus = typeof data.pageStatus === 'string' ? data.pageStatus : null;
    const pageUrl = typeof data.pageUrl === 'string' ? data.pageUrl : null;
    return pageStatus === 'completed' && Boolean(pageUrl);
  } catch {
    return false;
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
