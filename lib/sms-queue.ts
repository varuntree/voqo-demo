import { readFile, writeFile, mkdir, readdir, rename, unlink, stat } from 'fs/promises';
import path from 'path';
import { sendSMS, normalizePhoneNumber } from '@/lib/twilio';

const SMS_JOBS_DIR = path.join(process.cwd(), 'data/jobs/sms');
const CALLS_DIR = path.join(process.cwd(), 'data/calls');
const SMS_ERROR_FILE = path.join(process.cwd(), 'data/errors/sms-errors.json');

const MAX_ATTEMPTS = 5;
const INTERVAL_MS = 5000;
const STALE_PROCESSING_MS = 20 * 60 * 1000;

interface SmsJob {
  callId: string;
  createdAt: string;
  attempts: number;
}

interface SmsErrorEntry {
  callId: string;
  error: string;
  attempts: number;
  timestamp: string;
}

let workerStarted = false;

function buildBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  const base = envUrl && envUrl.trim().length ? envUrl.trim() : 'http://localhost:3000';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

async function appendSmsError(entry: SmsErrorEntry): Promise<void> {
  await mkdir(path.dirname(SMS_ERROR_FILE), { recursive: true });
  let existing: SmsErrorEntry[] = [];
  try {
    existing = JSON.parse(await readFile(SMS_ERROR_FILE, 'utf-8')) as SmsErrorEntry[];
  } catch {
    existing = [];
  }
  existing.unshift(entry);
  await writeFile(SMS_ERROR_FILE, JSON.stringify(existing.slice(0, 200), null, 2));
}

async function recoverStaleProcessingJobs(files: string[]): Promise<void> {
  const processingFiles = files.filter((file) => file.endsWith('.processing'));
  const now = Date.now();

  for (const file of processingFiles) {
    const processingPath = path.join(SMS_JOBS_DIR, file);
    try {
      const fileStat = await stat(processingPath);
      if (now - fileStat.mtimeMs > STALE_PROCESSING_MS) {
        const jobPath = processingPath.replace(/\.processing$/, '.json');
        await rename(processingPath, jobPath);
      }
    } catch {
      // ignore
    }
  }
}

export async function enqueueSmsJob(callId: string): Promise<void> {
  await mkdir(SMS_JOBS_DIR, { recursive: true });
  const jobPath = path.join(SMS_JOBS_DIR, `${callId}.json`);
  const job: SmsJob = { callId, createdAt: new Date().toISOString(), attempts: 0 };
  try {
    await writeFile(jobPath, JSON.stringify(job, null, 2), { flag: 'wx' });
  } catch {
    // already enqueued (idempotent)
  }
}

export function ensureSmsWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  setInterval(() => void processSmsJobsOnce(), INTERVAL_MS);
}

async function readCall(callId: string): Promise<Record<string, unknown> | null> {
  const callFile = path.join(CALLS_DIR, `${callId}.json`);
  try {
    const raw = await readFile(callFile, 'utf-8');
    return safeJsonParse<Record<string, unknown>>(raw);
  } catch {
    return null;
  }
}

async function writeCall(callId: string, data: Record<string, unknown>): Promise<void> {
  const callFile = path.join(CALLS_DIR, `${callId}.json`);
  await writeFile(callFile, JSON.stringify(data, null, 2));
}

function smsState(data: Record<string, unknown>): { status: string | null; sentAt: string | null } {
  const sms = data.sms;
  if (sms && typeof sms === 'object') {
    const obj = sms as Record<string, unknown>;
    return {
      status: typeof obj.status === 'string' ? obj.status : null,
      sentAt: typeof obj.sentAt === 'string' ? obj.sentAt : null,
    };
  }
  // Legacy compatibility.
  const legacy = typeof data.smsSentAt === 'string' ? data.smsSentAt : null;
  return { status: legacy ? 'sent' : null, sentAt: legacy };
}

async function markSms(
  callId: string,
  updates: Partial<{ status: string; sentAt: string; messageSid: string; error: string; to: string }>
): Promise<void> {
  const data = await readCall(callId);
  if (!data) return;
  const existing = data.sms && typeof data.sms === 'object' ? (data.sms as Record<string, unknown>) : {};
  data.sms = { ...existing, ...updates };
  if (updates.status === 'sent' && updates.sentAt) {
    data.smsSentAt = updates.sentAt;
  }
  await writeCall(callId, data);
}

function canSendSms(data: Record<string, unknown>): {
  ok: boolean;
  callerPhone?: string;
  agencyName?: string;
  pageUrl?: string;
} {
  const pageStatus = typeof data.pageStatus === 'string' ? data.pageStatus : null;
  const pageUrl = typeof data.pageUrl === 'string' ? data.pageUrl : null;
  const callerPhone = typeof data.callerPhone === 'string' ? data.callerPhone : null;
  const agencyName = typeof data.agencyName === 'string' ? data.agencyName : 'Voqo';

  if (pageStatus !== 'completed' || !pageUrl || !callerPhone) return { ok: false };
  return { ok: true, callerPhone, agencyName, pageUrl };
}

export async function processSmsJobsOnce(): Promise<void> {
  let files: string[] = [];
  try {
    files = await readdir(SMS_JOBS_DIR);
  } catch {
    return;
  }

  await recoverStaleProcessingJobs(files);

  const jobFiles = files.filter((file) => file.endsWith('.json'));
  for (const file of jobFiles) {
    const jobPath = path.join(SMS_JOBS_DIR, file);
    const processingPath = jobPath.replace(/\.json$/, '.processing');

    try {
      await rename(jobPath, processingPath);
    } catch {
      continue;
    }

    let callId = file.replace(/\.json$/, '');
    try {
      const jobRaw = await readFile(processingPath, 'utf-8');
      const job = safeJsonParse<SmsJob>(jobRaw);
      if (job?.callId) callId = job.callId;

      const updatedJob: SmsJob = {
        callId,
        createdAt: job?.createdAt || new Date().toISOString(),
        attempts: (job?.attempts ?? 0) + 1,
      };
      await writeFile(processingPath, JSON.stringify(updatedJob, null, 2));

      if (updatedJob.attempts > MAX_ATTEMPTS) {
        await appendSmsError({
          callId,
          error: 'Exceeded max attempts',
          attempts: updatedJob.attempts,
          timestamp: new Date().toISOString(),
        });
        await markSms(callId, { status: 'failed', error: 'Exceeded max attempts' });
        await unlink(processingPath);
        continue;
      }

      const call = await readCall(callId);
      if (!call) {
        await appendSmsError({
          callId,
          error: 'Call not found',
          attempts: updatedJob.attempts,
          timestamp: new Date().toISOString(),
        });
        await unlink(processingPath);
        continue;
      }

      const { status: existingStatus } = smsState(call);
      if (existingStatus === 'sent') {
        await unlink(processingPath);
        continue;
      }

      const pre = canSendSms(call);
      if (!pre.ok) {
        // Not ready yet; retry later.
        await markSms(callId, { status: 'pending' });
        await rename(processingPath, jobPath);
        continue;
      }

      const baseUrl = buildBaseUrl();
      const fullUrl = pre.pageUrl!.startsWith('http') ? pre.pageUrl! : `${baseUrl}${pre.pageUrl}`;
      const message = `${pre.agencyName} found properties for you: ${fullUrl}`;
      const normalizedTo = normalizePhoneNumber(pre.callerPhone!);

      const result = await sendSMS(normalizedTo, message);
      const sentAt = new Date().toISOString();

      await markSms(callId, {
        status: 'sent',
        sentAt,
        ...(typeof (result as any)?.sid === 'string' ? { messageSid: (result as any).sid } : {}),
        to: normalizedTo,
      });

      console.log(`[SMS] Sent to ${normalizedTo} for call ${callId}`);
      await unlink(processingPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      let attempts = 1;
      try {
        const jobRaw = await readFile(processingPath, 'utf-8');
        const job = safeJsonParse<SmsJob>(jobRaw);
        if (typeof job?.attempts === 'number') attempts = job.attempts;
      } catch {
        // ignore
      }
      await appendSmsError({
        callId,
        error: message,
        attempts,
        timestamp: new Date().toISOString(),
      });
      await markSms(callId, { status: 'failed', error: message });
      try {
        await rename(processingPath, jobPath);
      } catch {
        // ignore
      }
    }
  }
}

export async function ensureSmsJobsDir(): Promise<void> {
  await mkdir(SMS_JOBS_DIR, { recursive: true });
  await mkdir(CALLS_DIR, { recursive: true });
  // best-effort error dir
  await mkdir(path.dirname(SMS_ERROR_FILE), { recursive: true }).catch(() => undefined);
}
