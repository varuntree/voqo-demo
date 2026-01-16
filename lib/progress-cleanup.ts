import { promises as fs } from 'fs';
import path from 'path';

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Clean up stale progress files older than 24 hours.
 * Called lazily when reading files or on server startup.
 */
export async function cleanupProgressFiles(): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  try {
    await fs.mkdir(PROGRESS_DIR, { recursive: true });
    const files = await fs.readdir(PROGRESS_DIR);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(PROGRESS_DIR, file);

      try {
        const stat = await fs.stat(filePath);

        if (now - stat.mtimeMs > MAX_AGE_MS) {
          await fs.unlink(filePath);
          console.log(`[Cleanup] Deleted stale progress file: ${file}`);
          deleted++;
        }
      } catch (err) {
        console.error(`[Cleanup] Error processing ${file}:`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('[Cleanup] Error reading progress directory:', err);
    errors++;
  }

  return { deleted, errors };
}

/**
 * Check if a file is stale (older than maxAge).
 * Returns true if file should be ignored/deleted.
 */
export async function isStaleFile(filePath: string, maxAgeMs: number = MAX_AGE_MS): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return Date.now() - stat.mtimeMs > maxAgeMs;
  } catch {
    return true; // File doesn't exist or can't be read
  }
}

/**
 * Read a progress file with lazy cleanup.
 * Returns null if file is stale or doesn't exist.
 */
export async function readProgressFile<T>(fileName: string): Promise<T | null> {
  const filePath = path.join(PROGRESS_DIR, fileName);

  try {
    // Check if stale first
    if (await isStaleFile(filePath)) {
      // Try to delete stale file
      try {
        await fs.unlink(filePath);
        console.log(`[Cleanup] Deleted stale file on read: ${fileName}`);
      } catch {
        // Ignore deletion errors
      }
      return null;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write a progress file.
 */
export async function writeProgressFile(fileName: string, data: object): Promise<void> {
  await fs.mkdir(PROGRESS_DIR, { recursive: true });
  const filePath = path.join(PROGRESS_DIR, fileName);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Delete a progress file.
 */
export async function deleteProgressFile(fileName: string): Promise<void> {
  const filePath = path.join(PROGRESS_DIR, fileName);
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * List all progress files for a session.
 */
export async function listSessionFiles(sessionId: string): Promise<string[]> {
  try {
    await fs.mkdir(PROGRESS_DIR, { recursive: true });
    const files = await fs.readdir(PROGRESS_DIR);

    const sessionFiles: string[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      // Pipeline file
      if (file === `pipeline-${sessionId}.json`) {
        sessionFiles.push(file);
        continue;
      }

      // Agency files - need to read to check sessionId
      if (file.startsWith('agency-')) {
        const filePath = path.join(PROGRESS_DIR, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          if (data.sessionId === sessionId) {
            sessionFiles.push(file);
          }
        } catch {
          // Ignore read errors
        }
      }
    }

    return sessionFiles;
  } catch {
    return [];
  }
}

/**
 * Clean up all files for a specific session.
 */
export async function cleanupSession(sessionId: string): Promise<number> {
  const files = await listSessionFiles(sessionId);
  let deleted = 0;

  for (const file of files) {
    try {
      await deleteProgressFile(file);
      deleted++;
    } catch {
      // Ignore errors
    }
  }

  return deleted;
}
