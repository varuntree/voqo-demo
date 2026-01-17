import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import { watch as fsWatch } from 'fs';
import path from 'path';
import type { Activity, ActivityMessage } from '@/lib/types';
import { processPostcallJobsOnce } from '@/lib/postcall-queue';
import { normalizeActivityMessage, stableActivityMessageId } from '@/lib/server/activity';
import { ensureSmsWorker, processSmsJobsOnce } from '@/lib/sms-queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CALLS_DIR = path.join(process.cwd(), 'data', 'calls');
const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');
const HEARTBEAT_INTERVAL_MS = 15000;

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get('callId');
  if (!callId) {
    return new Response('callId required', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let callsWatcher: ReturnType<typeof fsWatch> | null = null;
      let progressWatcher: ReturnType<typeof fsWatch> | null = null;
      let heartbeatTimer: NodeJS.Timeout | null = null;
      const debouncers = new Map<string, NodeJS.Timeout>();
      let lastCallHash = '';
      let lastActivityLastId: string | null = null;

      const callPath = path.join(CALLS_DIR, `${callId}.json`);
      const activityPath = path.join(PROGRESS_DIR, `activity-postcall-${callId}.json`);

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

      const schedule = (key: string, fn: () => void | Promise<void>, delayMs = 40) => {
        const existing = debouncers.get(key);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          debouncers.delete(key);
          void fn();
        }, delayMs);
        debouncers.set(key, timer);
      };

      const emitCall = async () => {
        void processPostcallJobsOnce();
        void processSmsJobsOnce();
        ensureSmsWorker();
        const raw = await fs.readFile(callPath, 'utf-8').catch(() => null);
        if (!raw) return;
        const parsed = safeJsonParse<Record<string, unknown>>(raw);
        if (!parsed) return;
        const hash = JSON.stringify({
          pageStatus: parsed.pageStatus,
          pageUrl: parsed.pageUrl,
          generatedAt: parsed.generatedAt,
          summary: parsed.summary,
          callerName: parsed.callerName,
        });
        if (hash === lastCallHash) return;
        lastCallHash = hash;
        sendEvent({ type: 'call_update', call: parsed });
      };

      const emitNewActivity = async () => {
        const raw = await fs.readFile(activityPath, 'utf-8').catch(() => null);
        if (!raw) return;
        const parsed = safeJsonParse<Activity>(raw);
        if (!parsed || !Array.isArray(parsed.messages)) return;

        const messages = parsed.messages;
        const prefix = `postcall-${callId}`;
        const normalizedIds = messages.map((m) => stableActivityMessageId(prefix, m));
        let startIndex = 0;

        if (lastActivityLastId) {
          const idx = normalizedIds.lastIndexOf(lastActivityLastId);
          startIndex = idx >= 0 ? idx + 1 : Math.max(0, messages.length - 50);
        }

        for (let i = startIndex; i < messages.length; i += 1) {
          const message = normalizeActivityMessage(messages[i], prefix, 'Postcall agent');
          sendEvent({ type: 'postcall_activity_message', callId, message });
        }

        lastActivityLastId = normalizedIds[normalizedIds.length - 1] ?? lastActivityLastId;
        sendEvent({ type: 'postcall_activity_status', callId, status: parsed.status });
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        for (const timer of debouncers.values()) clearTimeout(timer);
        debouncers.clear();
        try {
          callsWatcher?.close();
          progressWatcher?.close();
        } catch {
          // ignore
        }
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      await fs.mkdir(CALLS_DIR, { recursive: true }).catch(() => undefined);
      await fs.mkdir(PROGRESS_DIR, { recursive: true }).catch(() => undefined);

      heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
      sendHeartbeat();

      // Initial snapshot.
      await emitCall();
      await emitNewActivity();

      callsWatcher = fsWatch(CALLS_DIR, (_eventType, filename) => {
        if (closed) return;
        if (!filename) return;
        if (filename.toString() === `${callId}.json`) {
          schedule('call', emitCall);
        }
      });

      progressWatcher = fsWatch(PROGRESS_DIR, (_eventType, filename) => {
        if (closed) return;
        if (!filename) return;
        if (filename.toString() === `activity-postcall-${callId}.json`) {
          schedule('activity', emitNewActivity);
        }
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
