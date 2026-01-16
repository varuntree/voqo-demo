import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { PipelineState, AgencyProgress, ActivityMessage } from '@/lib/types';
import { addToHistory, buildSessionFromPipeline } from '@/lib/history';

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');
const POLL_INTERVAL_MS = 500;
const HEARTBEAT_INTERVAL_MS = 15000;
const MAX_STALE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session');

  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const lastSeen = new Map<string, string>();
      let isComplete = false;
      let heartbeatTimer: NodeJS.Timeout;
      let historySaved = false;

      // Send heartbeat to keep connection alive
      const sendHeartbeat = () => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          // Controller might be closed
        }
      };

      // Send an SSE event
      const sendEvent = (data: object) => {
        try {
          const payload = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Controller might be closed
        }
      };

      const sendActivityMessages = (
        key: string,
        messages: ActivityMessage[],
        found: number,
        target: number,
        sourceFallback: string
      ) => {
        const previous = lastActivityCount.get(key) ?? 0;
        const safePrevious = previous > messages.length ? 0 : previous;
        const newMessages = messages.slice(safePrevious);

        for (const message of newMessages) {
          const normalized: ActivityMessage = {
            ...message,
            source: message.source ?? sourceFallback,
          };
          sendEvent({
            type: 'activity_message',
            message: normalized,
            found,
            target,
          });
        }

        lastActivityCount.set(key, messages.length);
      };

      // Check for and cleanup stale files
      const cleanupStaleFiles = async () => {
        try {
          const files = await fs.readdir(PROGRESS_DIR);
          const now = Date.now();

          for (const file of files) {
            const filePath = path.join(PROGRESS_DIR, file);
            const stat = await fs.stat(filePath);
            if (now - stat.mtimeMs > MAX_STALE_AGE_MS) {
              await fs.unlink(filePath);
              console.log(`[SSE Cleanup] Deleted stale file: ${file}`);
            }
          }
        } catch {
          // Ignore cleanup errors
        }
      };

      // Save to history when pipeline completes
      const saveToHistory = async (pipelineData: PipelineState) => {
        if (historySaved) return;
        historySaved = true;

        try {
          const session = await buildSessionFromPipeline(pipelineData);
          await addToHistory(session);
          console.log(`[SSE] Saved session ${sessionId} to history`);
        } catch (error) {
          console.error('[SSE] Failed to save to history:', error);
        }
      };

      // Track activity message count per source
      const lastActivityCount = new Map<string, number>();
      let activityCompleteNotified = false;

      // Poll for changes
      const pollForChanges = async () => {
        try {
          const sessionAgencyIds = new Set<string>();
          const processedAgencyIds = new Set<string>();
          const agencyActivityFiles: string[] = [];
          let targetCount = 0;

          // Read pipeline file
          const pipelinePath = path.join(PROGRESS_DIR, `pipeline-${sessionId}.json`);
          let pipelineData: PipelineState | null = null;

          try {
            const content = await fs.readFile(pipelinePath, 'utf-8');
            pipelineData = JSON.parse(content) as PipelineState;
            targetCount = pipelineData.requestedCount ?? targetCount;

            const hash = JSON.stringify(pipelineData.todos) + pipelineData.status;
            const lastHash = lastSeen.get('pipeline');

            if (hash !== lastHash) {
              lastSeen.set('pipeline', hash);
              sendEvent({
                type: 'todo_update',
                sessionId,
                todos: pipelineData.todos,
                status: pipelineData.status,
              });
            }

            // Check if pipeline is complete
            if (pipelineData.status === 'complete' || pipelineData.status === 'error') {
              isComplete = true;
            }

            if (pipelineData.agencyIds?.length) {
              for (const agencyId of pipelineData.agencyIds) {
                sessionAgencyIds.add(agencyId);
              }
            }
          } catch {
            // Pipeline file might not exist yet
          }

          const pipelineAgencyIds = new Set(pipelineData?.agencyIds || []);
          const pipelineStartedAtMs = pipelineData?.startedAt
            ? Date.parse(pipelineData.startedAt)
            : null;

          // Read agency files for this session
          if (pipelineData?.agencyIds?.length) {
            for (const agencyId of pipelineData.agencyIds) {
              const agencyPath = path.join(PROGRESS_DIR, `agency-${agencyId}.json`);

              try {
                const content = await fs.readFile(agencyPath, 'utf-8');
                const agencyData: AgencyProgress = JSON.parse(content);

                // Only process if it belongs to this session
                if (agencyData.sessionId !== sessionId) continue;
                processedAgencyIds.add(agencyId);
                sessionAgencyIds.add(agencyId);

                const hash = JSON.stringify(agencyData);
                const lastHash = lastSeen.get(agencyId);

                if (hash !== lastHash) {
                  lastSeen.set(agencyId, hash);

                  if (agencyData.status === 'error') {
                    sendEvent({
                      type: 'card_remove',
                      agencyId,
                      reason: agencyData.error || 'Unknown error',
                    });
                  } else {
                    sendEvent({
                      type: 'card_update',
                      agencyId,
                      data: agencyData,
                    });
                  }
                }
              } catch {
                // Agency file might not exist yet
              }
            }
          }

          // Also scan for any agency files matching this session
          // (in case agencyIds list isn't populated yet)
          try {
            const files = await fs.readdir(PROGRESS_DIR);
            for (const file of files) {
              if (file === `activity-${sessionId}.json`) {
                continue;
              }

              if (file.startsWith('agency-activity-') && file.endsWith('.json')) {
                if (pipelineAgencyIds.size === 0) {
                  continue;
                }
                const slug = file.replace(/^agency-activity-/, '').replace(/\.json$/, '');
                if (!pipelineAgencyIds.has(slug)) {
                  continue;
                }
                agencyActivityFiles.push(path.join(PROGRESS_DIR, file));
                continue;
              }

              if (!file.startsWith('agency-') || !file.endsWith('.json')) continue;

              const agencyPath = path.join(PROGRESS_DIR, file);
              const content = await fs.readFile(agencyPath, 'utf-8');
              const agencyData: AgencyProgress = JSON.parse(content);

              if (agencyData.sessionId !== sessionId) continue;

              const agencyId = agencyData.agencyId;
              if (processedAgencyIds.has(agencyId)) continue;
              processedAgencyIds.add(agencyId);
              sessionAgencyIds.add(agencyId);
              const hash = JSON.stringify(agencyData);
              const lastHash = lastSeen.get(agencyId);

              if (hash !== lastHash) {
                lastSeen.set(agencyId, hash);

                if (agencyData.status === 'error') {
                  sendEvent({
                    type: 'card_remove',
                    agencyId,
                    reason: agencyData.error || 'Unknown error',
                  });
                } else {
                  sendEvent({
                    type: 'card_update',
                    agencyId,
                    data: agencyData,
                  });
                }
              }
            }
          } catch {
            // Ignore directory read errors
          }

          const foundCount = sessionAgencyIds.size;
          const resolvedTarget = targetCount || pipelineData?.requestedCount || foundCount;
          let streamTarget = resolvedTarget;

          // Main activity stream
          try {
            const activityPath = path.join(PROGRESS_DIR, `activity-${sessionId}.json`);
            const content = await fs.readFile(activityPath, 'utf-8');
            const activityData = JSON.parse(content) as {
              status?: 'active' | 'complete';
              messages?: ActivityMessage[];
              agenciesTarget?: number;
            };
            const messages = Array.isArray(activityData.messages) ? activityData.messages : [];
            const activityTarget = resolvedTarget || activityData.agenciesTarget || foundCount;
            streamTarget = activityTarget;
            sendActivityMessages('activity-main', messages, foundCount, activityTarget, 'Main agent');

            if (activityData.status === 'complete' && !activityCompleteNotified) {
              activityCompleteNotified = true;
              sendEvent({
                type: 'activity_complete',
                sessionId,
                found: foundCount,
                target: activityTarget,
              });
            }
          } catch {
            // Activity file might not exist yet
          }

          // Subagent activity streams
          for (const activityFile of agencyActivityFiles) {
            try {
              const content = await fs.readFile(activityFile, 'utf-8');
              const parsed = JSON.parse(content) as unknown;

              let activitySessionId: string | undefined;
              let agencyId: string | undefined;
              let agencyName: string | undefined;
              let messages: ActivityMessage[] = [];

              if (Array.isArray(parsed)) {
                messages = parsed as ActivityMessage[];
              } else if (parsed && typeof parsed === 'object') {
                const data = parsed as {
                  sessionId?: string;
                  agencyId?: string;
                  agencyName?: string;
                  messages?: ActivityMessage[];
                };
                activitySessionId = data.sessionId;
                agencyId = data.agencyId;
                agencyName = data.agencyName;
                if (Array.isArray(data.messages)) {
                  messages = data.messages;
                }
              }

              const effectiveMessages = pipelineStartedAtMs
                ? messages.filter((message) => {
                    const ts = Date.parse(message.timestamp);
                    return Number.isFinite(ts) && ts >= pipelineStartedAtMs;
                  })
                : messages;

              if (activitySessionId && activitySessionId !== sessionId && effectiveMessages.length === 0) {
                continue;
              }

              const fallbackAgencyId = path
                .basename(activityFile)
                .replace(/^agency-activity-/, '')
                .replace(/\.json$/, '');

              const label = agencyName
                ? `Subagent: ${agencyName}`
                : agencyId
                  ? `Subagent: ${agencyId}`
                  : fallbackAgencyId
                    ? `Subagent: ${fallbackAgencyId}`
                    : 'Subagent';

              sendActivityMessages(activityFile, effectiveMessages, foundCount, streamTarget, label);
            } catch {
              // Ignore activity file errors
            }
          }

          // Send complete event if pipeline is done
          if (isComplete && pipelineData) {
            // Count successes and failures
            let successCount = 0;
            let failedCount = 0;

            for (const agencyId of pipelineData.agencyIds || []) {
              const agencyPath = path.join(PROGRESS_DIR, `agency-${agencyId}.json`);
              try {
                const content = await fs.readFile(agencyPath, 'utf-8');
                const agencyData: AgencyProgress = JSON.parse(content);
                if (agencyData.status === 'complete') successCount++;
                else if (agencyData.status === 'error') failedCount++;
              } catch {
                failedCount++;
              }
            }

            // Save to history before sending complete event
            await saveToHistory(pipelineData);

            if (!activityCompleteNotified) {
              activityCompleteNotified = true;
              sendEvent({
                type: 'activity_complete',
                sessionId,
                found: pipelineData.agencyIds?.length || 0,
                target: pipelineData.requestedCount || 0,
              });
            }

            sendEvent({
              type: 'pipeline_complete',
              sessionId,
              totalAgencies: pipelineData.agencyIds?.length || 0,
              successCount,
              failedCount,
              status: pipelineData.status,
              error: pipelineData.error,
            });

            // Clean up
            clearInterval(heartbeatTimer);
            controller.close();
            return;
          }
        } catch (error) {
          console.error('[SSE] Poll error:', error);
        }

        // Schedule next poll if not complete
        if (!isComplete) {
          setTimeout(pollForChanges, POLL_INTERVAL_MS);
        }
      };

      // Initial cleanup
      await cleanupStaleFiles();

      // Start heartbeat
      heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

      // Initial flush to open the stream
      sendHeartbeat();

      // Start polling
      pollForChanges();

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatTimer);
        isComplete = true;
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
