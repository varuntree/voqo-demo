import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import { watch as fsWatch } from 'fs';
import path from 'path';
import { processPostcallJobsOnce } from '@/lib/postcall-queue';
import { ensureSmsWorker, processSmsJobsOnce } from '@/lib/sms-queue';
import { isSafeSessionId } from '@/lib/ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CALLS_DIR = path.join(process.cwd(), 'data', 'calls');
const HEARTBEAT_INTERVAL_MS = 15000;

type CallListItem = {
  callId: string;
  timestamp: string;
  sessionId?: string | null;
  agencyId: string;
  agencyName: string;
  pageStatus: string;
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

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ts = Date.parse(value);
  return Number.isFinite(ts);
}

function toListItem(raw: unknown): CallListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const callId = typeof obj.callId === 'string' ? obj.callId : null;
  const timestamp = isValidIsoTimestamp(obj.timestamp) ? (obj.timestamp as string) : null;
  const sessionId =
    typeof obj.sessionId === 'string' && isSafeSessionId(obj.sessionId) ? (obj.sessionId as string) : null;
  const agencyId = typeof obj.agencyId === 'string' ? obj.agencyId : null;
  const agencyName = typeof obj.agencyName === 'string' ? obj.agencyName : null;
  if (!callId || !timestamp || !agencyId || !agencyName) return null;
  return {
    callId,
    timestamp,
    sessionId,
    agencyId,
    agencyName,
    pageStatus: typeof obj.pageStatus === 'string' ? obj.pageStatus : 'generating',
    pageUrl: typeof obj.pageUrl === 'string' ? obj.pageUrl : null,
    duration: typeof obj.duration === 'number' ? obj.duration : null,
    callerPhone: typeof obj.callerPhone === 'string' ? obj.callerPhone : null,
    callerName: typeof obj.callerName === 'string' ? obj.callerName : null,
    summary: typeof obj.summary === 'string' ? obj.summary : null,
  };
}

async function readCalls(sessionId?: string | null): Promise<CallListItem[]> {
  void processPostcallJobsOnce();
  void processSmsJobsOnce();
  ensureSmsWorker();

  let files: string[] = [];
  try {
    files = await fs.readdir(CALLS_DIR);
  } catch {
    return [];
  }

  const callFiles = files.filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 100);
  const items: CallListItem[] = [];

  for (const file of callFiles) {
    try {
      const raw = await fs.readFile(path.join(CALLS_DIR, file), 'utf-8');
      const parsed = safeJsonParse<unknown>(raw);
      const item = toListItem(parsed);
      if (item) {
        if (sessionId && item.sessionId !== sessionId) continue;
        items.push(item);
      }
    } catch {
      // ignore
    }
  }

  items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return items.slice(0, 50);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const session = searchParams.get('session');
  const sessionId = session && isSafeSessionId(session) ? session : null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let watcher: ReturnType<typeof fsWatch> | null = null;
      let heartbeatTimer: NodeJS.Timeout | null = null;
      let debounceTimer: NodeJS.Timeout | null = null;
      let lastHash = '';

      const sendRaw = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // ignore
        }
      };

      const sendHeartbeat = () => sendRaw(': keepalive\n\n');
      const sendEvent = (data: object) => sendRaw(`data: ${JSON.stringify(data)}\n\n`);

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (debounceTimer) clearTimeout(debounceTimer);
        try {
          watcher?.close();
        } catch {
          // ignore
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      const emitCalls = async () => {
        const calls = await readCalls(sessionId);
        const hash = JSON.stringify(calls);
        if (hash === lastHash) return;
        lastHash = hash;
        sendEvent({ type: 'calls_update', calls });
      };

      heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
      sendHeartbeat();
      await emitCalls();

      await fs.mkdir(CALLS_DIR, { recursive: true }).catch(() => undefined);
      watcher = fsWatch(CALLS_DIR, () => {
        if (closed) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void emitCalls();
        }, 80);
      });

      request.signal.addEventListener('abort', close);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
