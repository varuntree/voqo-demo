import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { processPostcallJobsOnce } from '@/lib/postcall-queue';
import { ensureSmsWorker, processSmsJobsOnce } from '@/lib/sms-queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CALLS_DIR = path.join(process.cwd(), 'data', 'calls');

type CallListItem = {
  callId: string;
  timestamp: string;
  agencyId: string;
  agencyName: string;
  pageStatus: 'generating' | 'completed' | 'failed' | string;
  pageUrl: string | null;
  duration?: number | null;
  callerPhone?: string | null;
  callerName?: string | null;
  summary?: string | null;
};

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function asIsoString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? value : null;
}

function toListItem(raw: unknown): CallListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const callId = typeof obj.callId === 'string' ? obj.callId : null;
  const timestamp = asIsoString(obj.timestamp) ?? null;
  const agencyId = typeof obj.agencyId === 'string' ? obj.agencyId : null;
  const agencyName = typeof obj.agencyName === 'string' ? obj.agencyName : null;

  if (!callId || !timestamp || !agencyId || !agencyName) return null;

  return {
    callId,
    timestamp,
    agencyId,
    agencyName,
    pageStatus: (typeof obj.pageStatus === 'string' ? obj.pageStatus : 'generating') as any,
    pageUrl: typeof obj.pageUrl === 'string' ? obj.pageUrl : null,
    duration: typeof obj.duration === 'number' ? obj.duration : null,
    callerPhone: typeof obj.callerPhone === 'string' ? obj.callerPhone : null,
    callerName: typeof obj.callerName === 'string' ? obj.callerName : null,
    summary: typeof obj.summary === 'string' ? obj.summary : null,
  };
}

export async function GET(_request: NextRequest) {
  try {
    // Best-effort: keep postcall worker moving when clients are watching calls.
    void processPostcallJobsOnce();
    void processSmsJobsOnce();
    ensureSmsWorker();

    let files: string[] = [];
    try {
      files = await readdir(CALLS_DIR);
    } catch {
      return NextResponse.json({ calls: [] });
    }

    const callFiles = files.filter((f) => f.endsWith('.json'));
    const items: CallListItem[] = [];

    // callId includes milliseconds, so a lexical sort is usually good enough.
    for (const file of callFiles.sort().reverse().slice(0, 100)) {
      try {
        const raw = await readFile(path.join(CALLS_DIR, file), 'utf-8');
        const parsed = safeJsonParse<unknown>(raw);
        const item = toListItem(parsed);
        if (item) items.push(item);
      } catch {
        // ignore individual corrupt files
      }
    }

    items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

    return NextResponse.json({ calls: items.slice(0, 50) });
  } catch (error) {
    console.error('[Calls] Error:', error);
    return NextResponse.json({ calls: [] }, { status: 500 });
  }
}
