import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import { watch as fsWatch } from 'fs';
import path from 'path';
import type { PipelineState, AgencyProgress, ActivityMessage } from '@/lib/types';
import { addToHistory, buildSessionFromPipeline } from '@/lib/history';
import { DEFAULT_STEPS } from '@/lib/types';
import { isSafeSessionId } from '@/lib/ids';

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');
const PUBLIC_DEMO_DIR = path.join(process.cwd(), 'public', 'demo');
const HEARTBEAT_INTERVAL_MS = 15000;
const MAX_STALE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonObject = Record<string, unknown>;

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

async function cleanupStaleFiles(): Promise<void> {
  try {
    const files = await fs.readdir(PROGRESS_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(PROGRESS_DIR, file);
      const stat = await fs.stat(filePath);
      if (now - stat.mtimeMs > MAX_STALE_AGE_MS) {
        await fs.unlink(filePath);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

function computeHash(value: unknown): string {
  return JSON.stringify(value);
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ts = Date.parse(value);
  return Number.isFinite(ts);
}

function normalizeActivityMessage(
  message: ActivityMessage,
  stableId: string,
  fallbackSource: string
): ActivityMessage {
  const hasSuspiciousMidnightTimestamp =
    typeof message.timestamp === 'string' && message.timestamp.endsWith('T00:00:00.000Z');
  return {
    ...message,
    id: typeof message.id === 'string' && message.id.length > 0 ? `${stableId}:${message.id}` : stableId,
    timestamp:
      isValidIsoTimestamp(message.timestamp) && !hasSuspiciousMidnightTimestamp
        ? message.timestamp
        : new Date().toISOString(),
    source: message.source ?? fallbackSource,
  };
}

function normalizeAgencyProgress(raw: unknown, agencyId: string, sessionId: string): AgencyProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<AgencyProgress> & Record<string, unknown>;

  const status = (obj.status as AgencyProgress['status']) || 'skeleton';
  const updatedAt = typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString();

  return {
    agencyId,
    sessionId,
    status,
    updatedAt,
    name: (obj.name as string | null) ?? null,
    website: (obj.website as string | null) ?? null,
    phone: (obj.phone as string | null) ?? null,
    address: (obj.address as string | null) ?? null,
    logoUrl: (obj.logoUrl as string | null) ?? null,
    primaryColor: (obj.primaryColor as string | null) ?? null,
    secondaryColor: (obj.secondaryColor as string | null) ?? null,
    teamSize: (obj.teamSize as number | null) ?? null,
    listingCount: (obj.listingCount as number | null) ?? null,
    painScore: (obj.painScore as number | null) ?? null,
    soldCount: (obj.soldCount as number | null) ?? null,
    priceRangeMin: (obj.priceRangeMin as string | null) ?? null,
    priceRangeMax: (obj.priceRangeMax as string | null) ?? null,
    forRentCount: (obj.forRentCount as number | null) ?? null,
    htmlProgress: typeof obj.htmlProgress === 'number' ? obj.htmlProgress : 0,
    demoUrl: (obj.demoUrl as string | null) ?? null,
    steps: Array.isArray(obj.steps) ? (obj.steps as AgencyProgress['steps']) : DEFAULT_STEPS,
    error: typeof obj.error === 'string' ? obj.error : undefined,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session');

  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }
  if (!isSafeSessionId(sessionId)) {
    return new Response('Invalid session ID', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let heartbeatTimer: NodeJS.Timeout | null = null;
      const debouncers = new Map<string, NodeJS.Timeout>();
      let watcher: ReturnType<typeof fsWatch> | null = null;

      const lastSeenHashes = new Map<string, string>();
      const agencyStatuses = new Map<string, AgencyProgress['status']>();
      const knownAgencyIds = new Set<string>();
      const lastMainActivityCount = { value: 0 };
      const lastSubagentActivityCount = new Map<string, number>();
      let lastKnownTarget = 0;
      let historySaved = false;

      const pipelinePath = path.join(PROGRESS_DIR, `pipeline-${sessionId}.json`);
      const mainActivityPath = path.join(PROGRESS_DIR, `activity-${sessionId}.json`);

      const sendRaw = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // ignore
        }
      };

      const sendHeartbeat = () => sendRaw(': keepalive\n\n');

      const sendEvent = (data: object) => {
        sendRaw(`data: ${JSON.stringify(data)}\n\n`);
      };

      const schedule = (key: string, fn: () => void | Promise<void>, delayMs = 30) => {
        const existing = debouncers.get(key);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          debouncers.delete(key);
          void fn();
        }, delayMs);
        debouncers.set(key, timer);
      };

      const saveToHistory = async (pipelineData: PipelineState) => {
        if (historySaved) return;
        historySaved = true;
        try {
          const session = await buildSessionFromPipeline(pipelineData);
          await addToHistory(session);
        } catch (error) {
          console.error('[SSE] Failed to save to history:', error);
        }
      };

      const refreshPipeline = async () => {
        const content = await fs.readFile(pipelinePath, 'utf-8').catch(() => null);
        if (!content) return;
        const pipeline = safeJsonParse<PipelineState>(content);
        if (!pipeline) return;

        lastKnownTarget = pipeline.requestedCount ?? lastKnownTarget;

        const hash = computeHash({ status: pipeline.status, todos: pipeline.todos, agencyIds: pipeline.agencyIds });
        const lastHash = lastSeenHashes.get('pipeline');
        if (hash !== lastHash) {
          lastSeenHashes.set('pipeline', hash);
          sendEvent({
            type: 'todo_update',
            sessionId,
            todos: pipeline.todos,
            status: pipeline.status,
          });
        }

        const agencyIds = Array.isArray(pipeline.agencyIds) ? pipeline.agencyIds : [];
        for (const agencyId of agencyIds) {
          if (knownAgencyIds.has(agencyId)) continue;
          knownAgencyIds.add(agencyId);
          schedule(`agency:${agencyId}`, () => refreshAgency(agencyId), 0);
          schedule(`agencyActivity:${agencyId}`, () => refreshSubagentActivity(agencyId), 0);
        }

        await checkCompletion(pipeline);
      };

      const maybeReconcileAgency = async (agencyPath: string, agencyData: AgencyProgress) => {
        if (agencyData.status === 'complete' || agencyData.status === 'error') return agencyData;
        if (agencyData.demoUrl) return agencyData;
        if (!agencyData.agencyId) return agencyData;

        const demoPath = path.join(PUBLIC_DEMO_DIR, `${agencyData.agencyId}.html`);
        try {
          await fs.access(demoPath);
        } catch {
          return agencyData;
        }

        const updatedAt = new Date().toISOString();
        const completedSteps = (agencyData.steps || []).map((step) => ({
          ...step,
          status: 'complete' as const,
        }));

        const reconciled: AgencyProgress = {
          ...agencyData,
          status: 'complete',
          htmlProgress: 100,
          demoUrl: `/demo/${agencyData.agencyId}`,
          updatedAt,
          steps: completedSteps.length ? completedSteps : agencyData.steps,
        };

        await fs.writeFile(agencyPath, JSON.stringify(reconciled, null, 2));
        return reconciled;
      };

      const refreshAgency = async (agencyId: string) => {
        const agencyPath = path.join(PROGRESS_DIR, `agency-${agencyId}.json`);
        const content = await fs.readFile(agencyPath, 'utf-8').catch(() => null);
        if (!content) return;
        const parsed = safeJsonParse<unknown>(content);
        if (!parsed) return;
        const normalized = normalizeAgencyProgress(parsed, agencyId, sessionId);
        if (!normalized) return;
        if (normalized.sessionId !== sessionId) return;

        const agencyData = await maybeReconcileAgency(agencyPath, normalized);
        agencyStatuses.set(agencyId, agencyData.status);

        const hash = computeHash(agencyData);
        const lastHash = lastSeenHashes.get(`agency:${agencyId}`);
        if (hash === lastHash) return;
        lastSeenHashes.set(`agency:${agencyId}`, hash);

        if (agencyData.status === 'error') {
          sendEvent({
            type: 'card_remove',
            agencyId,
            reason: agencyData.error || 'Unknown error',
          });
          return;
        }

        sendEvent({
          type: 'card_update',
          agencyId,
          data: agencyData,
        });
      };

      const emitNewMessages = (
        messages: ActivityMessage[],
        startIndex: number,
        fallbackSource: string,
        stablePrefix: string,
        eventBuilder: (message: ActivityMessage) => JsonObject
      ) => {
        const safeStart = Math.max(0, Math.min(startIndex, messages.length));
        const newMessages = messages.slice(safeStart);
        for (let i = 0; i < newMessages.length; i += 1) {
          const message = newMessages[i];
          sendEvent(
            eventBuilder(
              normalizeActivityMessage(message, `${stablePrefix}-${safeStart + i}`, fallbackSource)
            )
          );
        }
        return messages.length;
      };

      const refreshMainActivity = async () => {
        const content = await fs.readFile(mainActivityPath, 'utf-8').catch(() => null);
        if (!content) return;
        const parsed = safeJsonParse<{ messages?: ActivityMessage[]; agenciesTarget?: number }>(content);
        if (!parsed) return;

        const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
        const nextCount = emitNewMessages(messages, lastMainActivityCount.value, 'Main agent', 'main', (message) => ({
          type: 'main_activity_message',
          message,
          found: knownAgencyIds.size,
          target: parsed.agenciesTarget ?? lastKnownTarget ?? knownAgencyIds.size,
        }));

        lastMainActivityCount.value = nextCount;
      };

      const refreshSubagentActivity = async (agencyId: string) => {
        const activityPath = path.join(PROGRESS_DIR, `agency-activity-${agencyId}.json`);
        const content = await fs.readFile(activityPath, 'utf-8').catch(() => null);
        if (!content) return;

        const parsed = safeJsonParse<unknown>(content);
        if (!parsed) return;

        let messages: ActivityMessage[] = [];
        if (Array.isArray(parsed)) {
          messages = parsed as ActivityMessage[];
        } else if (parsed && typeof parsed === 'object') {
          const obj = parsed as { messages?: unknown };
          if (Array.isArray(obj.messages)) {
            messages = obj.messages as ActivityMessage[];
          }
        }

        const prevCount = lastSubagentActivityCount.get(agencyId) ?? 0;
        const nextCount = emitNewMessages(messages, prevCount, 'Subagent', `sub-${agencyId}`, (message) => ({
          type: 'subagent_activity_message',
          agencyId,
          message,
        }));
        lastSubagentActivityCount.set(agencyId, nextCount);
      };

      const checkCompletion = async (pipelineData?: PipelineState) => {
        const pipeline = pipelineData ?? (await fs.readFile(pipelinePath, 'utf-8').then(safeJsonParse<PipelineState>).catch(() => null));
        if (!pipeline) return;

        const isTerminal = pipeline.status === 'complete' || pipeline.status === 'error' || pipeline.status === 'cancelled';

        // Reconcile pipeline completion if all agency files ended but pipeline didn't.
        if (!isTerminal && pipeline.status === 'processing' && Array.isArray(pipeline.agencyIds) && pipeline.agencyIds.length) {
          const allDone = pipeline.agencyIds.every((agencyId) => {
            const status = agencyStatuses.get(agencyId);
            return status === 'complete' || status === 'error';
          });

          if (allDone) {
            const updated: PipelineState = {
              ...pipeline,
              status: 'complete',
              completedAt: new Date().toISOString(),
              todos: (pipeline.todos || []).map((todo) => ({ ...todo, status: 'complete' })),
            };
            await fs.writeFile(pipelinePath, JSON.stringify(updated, null, 2));
            sendEvent({
              type: 'todo_update',
              sessionId,
              todos: updated.todos,
              status: updated.status,
            });
            await saveToHistory(updated);
            sendEvent({
              type: 'pipeline_complete',
              sessionId,
              totalAgencies: updated.agencyIds?.length || 0,
              successCount: updated.agencyIds?.filter((id) => agencyStatuses.get(id) === 'complete').length || 0,
              failedCount: updated.agencyIds?.filter((id) => agencyStatuses.get(id) === 'error').length || 0,
              status: updated.status,
              error: updated.error,
            });
            close();
          }
        }

        if (isTerminal) {
          await saveToHistory(pipeline);
          sendEvent({
            type: 'pipeline_complete',
            sessionId,
            totalAgencies: pipeline.agencyIds?.length || 0,
            successCount: pipeline.agencyIds?.filter((id) => agencyStatuses.get(id) === 'complete').length || 0,
            failedCount: pipeline.agencyIds?.filter((id) => agencyStatuses.get(id) === 'error').length || 0,
            status: pipeline.status,
            error: pipeline.error,
          });
          close();
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        for (const timer of debouncers.values()) clearTimeout(timer);
        debouncers.clear();
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

      await fs.mkdir(PROGRESS_DIR, { recursive: true }).catch(() => undefined);
      await cleanupStaleFiles();

      heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
      sendHeartbeat();

      // Initial snapshot
      await refreshPipeline();
      await refreshMainActivity();

      // Watch the directory for changes and react immediately.
      watcher = fsWatch(PROGRESS_DIR, (eventType, filename) => {
        if (closed) return;
        if (!filename) {
          schedule('refreshAll', async () => {
            await refreshPipeline();
            await refreshMainActivity();
            for (const agencyId of knownAgencyIds) {
              schedule(`agency:${agencyId}`, () => refreshAgency(agencyId), 0);
              schedule(`agencyActivity:${agencyId}`, () => refreshSubagentActivity(agencyId), 0);
            }
          });
          return;
        }

        const name = filename.toString();
        if (name === `pipeline-${sessionId}.json`) {
          schedule('pipeline', refreshPipeline);
          return;
        }
        if (name === `activity-${sessionId}.json`) {
          schedule('mainActivity', refreshMainActivity);
          return;
        }
        if (name.startsWith('agency-activity-') && name.endsWith('.json')) {
          const agencyId = name.replace(/^agency-activity-/, '').replace(/\.json$/, '');
          if (knownAgencyIds.has(agencyId)) {
            schedule(`agencyActivity:${agencyId}`, () => refreshSubagentActivity(agencyId));
          }
          return;
        }
        if (name.startsWith('agency-') && name.endsWith('.json')) {
          // Includes both agency-{id}.json and potentially other variants; only react for known IDs.
          const agencyId = name.replace(/^agency-/, '').replace(/\.json$/, '');
          schedule('pipeline', refreshPipeline, 0);
          if (knownAgencyIds.has(agencyId)) {
            schedule(`agency:${agencyId}`, () => refreshAgency(agencyId), 0);
          }
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
