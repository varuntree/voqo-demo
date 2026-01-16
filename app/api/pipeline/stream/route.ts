import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { PipelineState, AgencyProgress } from '@/lib/types';
import { addToHistory, buildSessionFromPipeline } from '@/lib/history';

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');
const POLL_INTERVAL_MS = 500;
const HEARTBEAT_INTERVAL_MS = 15000;
const MAX_STALE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

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

      // Track activity message count
      let lastActivityCount = 0;
      let activityCompleteNotified = false;

      // Poll for changes
      const pollForChanges = async () => {
        try {
          // Read pipeline file
          const pipelinePath = path.join(PROGRESS_DIR, `pipeline-${sessionId}.json`);
          let pipelineData: PipelineState | null = null;

          try {
            const content = await fs.readFile(pipelinePath, 'utf-8');
            pipelineData = JSON.parse(content) as PipelineState;

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

            // Check for new activity messages
            if (pipelineData.activity?.messages) {
              const newMessages = pipelineData.activity.messages.slice(lastActivityCount);
              for (const message of newMessages) {
                sendEvent({
                  type: 'activity_message',
                  message,
                  found: pipelineData.activity.agenciesFound,
                  target: pipelineData.activity.agenciesTarget,
                });
              }
              lastActivityCount = pipelineData.activity.messages.length;

              // Check if activity search is complete
              if (pipelineData.activity.status === 'complete' && !activityCompleteNotified) {
                activityCompleteNotified = true;
                sendEvent({
                  type: 'activity_complete',
                  sessionId,
                  found: pipelineData.activity.agenciesFound,
                  target: pipelineData.activity.agenciesTarget,
                });
              }
            }

            // Check if pipeline is complete
            if (pipelineData.status === 'complete' || pipelineData.status === 'error') {
              isComplete = true;
            }
          } catch {
            // Pipeline file might not exist yet
          }

          // Read agency files for this session
          if (pipelineData?.agencyIds?.length) {
            for (const agencyId of pipelineData.agencyIds) {
              const agencyPath = path.join(PROGRESS_DIR, `agency-${agencyId}.json`);

              try {
                const content = await fs.readFile(agencyPath, 'utf-8');
                const agencyData: AgencyProgress = JSON.parse(content);

                // Only process if it belongs to this session
                if (agencyData.sessionId !== sessionId) continue;

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
              if (!file.startsWith('agency-') || !file.endsWith('.json')) continue;

              const agencyPath = path.join(PROGRESS_DIR, file);
              const content = await fs.readFile(agencyPath, 'utf-8');
              const agencyData: AgencyProgress = JSON.parse(content);

              if (agencyData.sessionId !== sessionId) continue;

              const agencyId = agencyData.agencyId;
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
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
