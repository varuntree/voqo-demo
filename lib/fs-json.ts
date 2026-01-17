import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

type LockOptions = {
  timeoutMs?: number;
  staleMs?: number;
  retryDelayMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFileAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.writeFile(tmpPath, JSON.stringify(value, null, 2));
  await fs.rename(tmpPath, filePath);
}

export async function withFileLock<T>(
  targetPath: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  const lockPath = `${targetPath}.lock`;
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  const timeoutMs = options.timeoutMs ?? 2500;
  const staleMs = options.staleMs ?? 5000;
  const retryDelayMs = options.retryDelayMs ?? 25;
  const startedAt = Date.now();

  // Best-effort: if a lock file exists but is stale, remove it.
  while (true) {
    try {
      const handle = await fs.open(lockPath, 'wx');
      try {
        await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`);
      } catch {
        // ignore
      } finally {
        await handle.close().catch(() => null);
      }

      try {
        return await fn();
      } finally {
        await fs.unlink(lockPath).catch(() => null);
      }
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;

      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > staleMs) {
          await fs.unlink(lockPath).catch(() => null);
        }
      } catch {
        // ignore
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out waiting for lock: ${path.basename(lockPath)}`);
      }
      await sleep(retryDelayMs);
    }
  }
}

export async function updateJsonFileWithLock<T>(
  filePath: string,
  updater: (current: T | null) => T,
  options: LockOptions = {}
): Promise<T> {
  return withFileLock(filePath, async () => {
    const current = await readJsonFile<T>(filePath);
    const next = updater(current);
    await writeJsonFileAtomic(filePath, next);
    return next;
  }, options);
}

export function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function safeStringEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqualStrings(a, b);
  } catch {
    return a === b;
  }
}
