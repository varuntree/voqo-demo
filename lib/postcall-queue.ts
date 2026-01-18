import { readFile, writeFile, mkdir, readdir, rename, unlink, access, stat } from 'fs/promises';
import path from 'path';
import { invokeClaudeCode } from '@/lib/claude';
import { updateAgencyCall } from '@/lib/agency-calls';
import { enqueueSmsJob, ensureSmsWorker } from '@/lib/sms-queue';
import { readJsonFile, updateJsonFileWithLock } from '@/lib/fs-json';

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

const WORKER_FLAG = '__voqoPostcallWorkerStarted';
const WORKER_RUNNING_FLAG = '__voqoPostcallWorkerRunning';

// NOTE: SMS sending is handled by lib/sms-queue.ts as a durable, idempotent job.

export async function enqueuePostcallJob(callId: string, prompt: string): Promise<void> {
  await mkdir(JOBS_DIR, { recursive: true });
  const job: PostcallJob = {
    callId,
    prompt,
    createdAt: new Date().toISOString(),
    attempts: 0
  };
  const jobPath = path.join(JOBS_DIR, `${callId}.json`);
  try {
    await writeFile(jobPath, JSON.stringify(job, null, 2), { flag: 'wx' });
  } catch {
    // Already enqueued (idempotent).
  }
}

export function ensurePostcallWorker(): void {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g[WORKER_FLAG]) return;
  g[WORKER_FLAG] = true;
  // Ensure SMS worker is available whenever the postcall worker runs.
  ensureSmsWorker();

  // Run in a single loop (avoid overlapping runs if one tick takes > INTERVAL_MS).
  const loop = async () => {
    if (g[WORKER_RUNNING_FLAG]) {
      setTimeout(loop, INTERVAL_MS);
      return;
    }

    g[WORKER_RUNNING_FLAG] = true;
    try {
      await processPostcallJobsOnce();
    } catch {
      // ignore
    } finally {
      g[WORKER_RUNNING_FLAG] = false;
      setTimeout(loop, INTERVAL_MS);
    }
  };

  void loop();
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
        await mkdir(PUBLIC_CALL_DIR, { recursive: true });
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
    const updated = await updateJsonFileWithLock<Record<string, unknown>>(callFile, (current) => {
      const data = current && typeof current === 'object' ? { ...(current as Record<string, unknown>) } : {};

      if (!data.callerPhone && fallback?.callerPhone) data.callerPhone = fallback.callerPhone;
      if (!data.agencyName && fallback?.agencyName) data.agencyName = fallback.agencyName;
      if (!data.agencyId && fallback?.agencyId) data.agencyId = fallback.agencyId;

      data.pageStatus = 'completed';
      data.pageUrl = `/call/${callId}`;
      if (!data.generatedAt) data.generatedAt = new Date().toISOString();
      return data;
    });

    // Queue SMS notification (durable + idempotent).
    // The SMS worker will only send once pageStatus/pageUrl are ready and will dedupe by callId.
    void enqueueSmsJob(callId);

    const agencyId = typeof updated.agencyId === 'string' ? (updated.agencyId as string) : null;
    if (agencyId) {
      await updateAgencyCall(agencyId, callId, {
        pageUrl: typeof updated.pageUrl === 'string' ? (updated.pageUrl as string) : null,
        status: 'completed',
        callerName: typeof updated.callerName === 'string' ? (updated.callerName as string) : null,
        summary: typeof updated.summary === 'string' ? (updated.summary as string) : null
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

  const data = await readJsonFile<Record<string, unknown>>(callFile);
  if (!data) return false;
  const pageStatus = typeof data.pageStatus === 'string' ? data.pageStatus : null;
  const pageUrl = typeof data.pageUrl === 'string' ? data.pageUrl : null;
  return pageStatus === 'completed' && Boolean(pageUrl);
}

async function readCallSnapshot(callId: string): Promise<{
  callerPhone?: string | null;
  agencyName?: string | null;
  agencyId?: string | null;
} | undefined> {
  const callFile = path.join(CALLS_DIR, `${callId}.json`);
  const data = await readJsonFile<{
    callerPhone?: string | null;
    agencyName?: string | null;
    agencyId?: string | null;
  }>(callFile);
  if (!data) return undefined;
  return {
    callerPhone: data.callerPhone ?? null,
    agencyName: data.agencyName ?? null,
    agencyId: data.agencyId ?? null
  };
}

async function markCallFailed(callId: string): Promise<void> {
  const callFile = path.join(CALLS_DIR, `${callId}.json`);
  try {
    const updated = await updateJsonFileWithLock<Record<string, unknown>>(callFile, (current) => {
      const data = current && typeof current === 'object' ? { ...(current as Record<string, unknown>) } : {};
      data.pageStatus = 'failed';
      data.pageUrl = null;
      data.generatedAt = new Date().toISOString();
      return data;
    });

    const agencyId = typeof updated.agencyId === 'string' ? (updated.agencyId as string) : null;
    if (agencyId) {
      await updateAgencyCall(agencyId, callId, {
        status: 'failed'
      });
    }
  } catch {
    // Ignore failures on error path
  }
}

async function appendPostcallError(entry: ErrorEntry): Promise<void> {
  await mkdir(path.dirname(ERROR_FILE), { recursive: true });
  await updateJsonFileWithLock<ErrorEntry[]>(ERROR_FILE, (current) => {
    const existing = Array.isArray(current) ? current : [];
    return [entry, ...existing].slice(0, 200);
  });
}
