import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { getClaudeEnv, getClaudeModel } from '@/lib/claude';
import { getPipelineRuns } from '@/lib/pipeline-registry';
import type { PipelineRunStatus } from '@/lib/pipeline-registry';
import type { Activity, ActivityMessage, AgencyProgress, PipelineState } from '@/lib/types';
import { addToHistory, buildSessionDetailFromPipeline, buildSessionFromPipeline, writeSessionDetail } from '@/lib/history';
import { buildActivityId } from '@/lib/ids';

const PROJECT_ROOT = process.cwd();
const PROGRESS_DIR = path.join(PROJECT_ROOT, 'data', 'progress');
const AGENCIES_DIR = path.join(PROJECT_ROOT, 'data', 'agencies');
const PUBLIC_DEMO_DIR = path.join(PROJECT_ROOT, 'public', 'demo');

export const runtime = 'nodejs';

function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `pipe-${timestamp}-${random}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function activityPath(sessionId: string) {
  return path.join(PROGRESS_DIR, `activity-${sessionId}.json`);
}

function formatToolDetail(toolName: string, toolInput: unknown): string | undefined {
  if (!toolInput || typeof toolInput !== 'object') return undefined;
  const input = toolInput as Record<string, unknown>;

  switch (toolName) {
    case 'WebSearch':
      return typeof input.query === 'string' ? input.query : undefined;
    case 'WebFetch':
      return typeof input.url === 'string' ? input.url : undefined;
    case 'Read':
    case 'Write':
    case 'Edit':
      return typeof input.path === 'string' ? input.path : undefined;
    case 'Glob':
      return typeof input.pattern === 'string' ? input.pattern : undefined;
    case 'Task':
      return typeof input.prompt === 'string' ? input.prompt.slice(0, 140) : undefined;
    case 'Skill':
      return typeof input.name === 'string' ? input.name : undefined;
    default:
      return undefined;
  }
}

async function appendMainActivityMessage(sessionId: string, message: {
  type: 'search' | 'results' | 'fetch' | 'identified' | 'warning' | 'thinking' | 'tool' | 'agent';
  text: string;
  detail?: string;
  source?: string;
  timestamp?: string;
}) {
  const filePath = activityPath(sessionId);
  const timestamp = message.timestamp ?? new Date().toISOString();
  const nextMessage = {
    id: buildActivityId(),
    ...message,
    source: message.source ?? 'Main agent',
    timestamp,
  };

  try {
    const content = await fs.readFile(filePath, 'utf-8').catch(() => null);
    const parsed = content ? (JSON.parse(content) as { messages?: unknown[] }) : null;
    const existingMessages = Array.isArray(parsed?.messages) ? parsed!.messages : [];
    const updated = {
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      sessionId,
      messages: [...existingMessages, nextMessage].slice(-250),
    };
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2));
  } catch {
    // Ignore activity failures
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function readSubagentActivity(agencyIds: string[]): Promise<Record<string, ActivityMessage[]>> {
  const out: Record<string, ActivityMessage[]> = {};
  for (const agencyId of agencyIds) {
    const activityPath = path.join(PROGRESS_DIR, `agency-activity-${agencyId}.json`);
    const parsed = await readJsonFile<{ messages?: ActivityMessage[] } | ActivityMessage[]>(activityPath);
    if (!parsed) continue;
    if (Array.isArray(parsed)) out[agencyId] = parsed;
    else if (Array.isArray(parsed.messages)) out[agencyId] = parsed.messages;
  }
  return out;
}

async function persistSessionToHistory(
  sessionId: string,
  runStatus?: PipelineRunStatus,
  runError?: string
): Promise<void> {
  const pipelinePath = path.join(PROGRESS_DIR, `pipeline-${sessionId}.json`);
  const pipeline = await readJsonFile<PipelineState>(pipelinePath);
  if (!pipeline) return;

  // Best-effort reconciliation if the pipeline file didn't finalize (no SSE client connected).
  if ((pipeline.status === 'searching' || pipeline.status === 'processing') && runStatus) {
    const now = new Date().toISOString();
    if (runStatus === 'completed') {
      pipeline.status = 'complete';
      pipeline.completedAt = pipeline.completedAt || now;
    } else if (runStatus === 'cancelled') {
      pipeline.status = 'cancelled';
      pipeline.completedAt = pipeline.completedAt || now;
      pipeline.error = pipeline.error || 'Cancelled';
    } else if (runStatus === 'error') {
      pipeline.status = 'error';
      pipeline.completedAt = pipeline.completedAt || now;
      pipeline.error = pipeline.error || runError || 'Pipeline failed';
    }

    try {
      await fs.writeFile(pipelinePath, JSON.stringify(pipeline, null, 2));
    } catch {
      // ignore
    }
  }

  const activity = await readJsonFile<Activity>(activityPath(sessionId));

  const agencies: AgencyProgress[] = [];
  for (const agencyId of pipeline.agencyIds || []) {
    const agencyPath = path.join(PROGRESS_DIR, `agency-${agencyId}.json`);
    const parsed = await readJsonFile<AgencyProgress>(agencyPath);
    if (parsed && parsed.sessionId === sessionId) agencies.push(parsed);
  }

  const subagentActivity = await readSubagentActivity(pipeline.agencyIds || []);
  const detail = await buildSessionDetailFromPipeline(pipeline, activity, agencies, subagentActivity);
  await writeSessionDetail(sessionId, detail);

  const indexEntry = await buildSessionFromPipeline(pipeline);
  await addToHistory(indexEntry);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suburb, count = 10 } = body;

    if (!suburb || typeof suburb !== 'string') {
      return NextResponse.json({ error: 'Suburb is required' }, { status: 400 });
    }

    const agencyCount = Math.min(Math.max(1, Number(count)), 25);
    const sessionId = generateSessionId();
    const startedAt = new Date().toISOString();

    // Ensure progress directory exists
    await fs.mkdir(PROGRESS_DIR, { recursive: true });
    await fs.mkdir(AGENCIES_DIR, { recursive: true });
    await fs.mkdir(PUBLIC_DEMO_DIR, { recursive: true });

    // Create initial pipeline state file
    const pipelineState = {
      sessionId,
      suburb,
      requestedCount: agencyCount,
      status: 'searching',
      startedAt,
      completedAt: null,
      todos: [
        { id: 'setup', text: 'Setting up workspace', status: 'complete' },
        { id: 'search', text: `Finding agencies in ${suburb}`, status: 'in_progress' },
        { id: 'spawn', text: `Starting ${agencyCount} parallel agency jobs`, status: 'pending' },
        { id: 'generate', text: 'Generating demo pages', status: 'pending' },
      ],
      agencyIds: [],
    };

    const pipelinePath = path.join(PROGRESS_DIR, `pipeline-${sessionId}.json`);
    await fs.writeFile(pipelinePath, JSON.stringify(pipelineState, null, 2));

    const activityState = {
      sessionId,
      status: 'active',
      agenciesFound: 0,
      agenciesTarget: agencyCount,
      messages: [
        {
          id: buildActivityId(),
          type: 'thinking',
          text: `Preparing workspace for ${suburb}...`,
          source: 'System',
          timestamp: startedAt,
        },
      ],
    };
    await fs.writeFile(activityPath(sessionId), JSON.stringify(activityState, null, 2));

    console.log(`[Pipeline] Created session ${sessionId} for ${suburb} (${agencyCount} agencies)`);

    // Build orchestrator prompt
    const orchestratorPrompt = buildOrchestratorPrompt(sessionId, suburb, agencyCount, startedAt);

    const pipelineQuery = query({
      prompt: orchestratorPrompt,
      options: {
        model: getClaudeModel(),
        allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'WebSearch', 'WebFetch', 'Task', 'Skill'],
        disallowedTools: ['Bash', 'Grep'],
        includePartialMessages: true,
        persistSession: false,
        allowDangerouslySkipPermissions: true,
        cwd: process.cwd(),
        env: getClaudeEnv(),
        settingSources: ['project'],
        permissionMode: 'bypassPermissions',
        extraArgs: { debug: 'api' },
      },
    });

    const runs = getPipelineRuns();
    runs.set(sessionId, {
      sessionId,
      query: pipelineQuery,
      status: 'running',
      startedAt,
    });

    // Drain the query in the background so the pipeline runs even after returning.
    void (async () => {
      const seenToolUse = new Set<string>();
      try {
        for await (const message of pipelineQuery) {
          if (message.type === 'assistant' && message.parent_tool_use_id === null) {
            const content = (message.message as unknown as { content?: unknown }).content;
            if (Array.isArray(content)) {
              for (const block of content as Array<{ type?: string; name?: string; input?: unknown; id?: string }>) {
                if (block?.type !== 'tool_use' || !block.id || !block.name) continue;
                if (seenToolUse.has(block.id)) continue;
                seenToolUse.add(block.id);

                const toolName = block.name;
                const detail = formatToolDetail(toolName, block.input);
                const mappedType =
                  toolName === 'WebSearch'
                    ? 'search'
                    : toolName === 'WebFetch'
                      ? 'fetch'
                      : 'tool';

                await appendMainActivityMessage(sessionId, {
                  type: mappedType,
                  text:
                    toolName === 'WebSearch'
                      ? detail
                        ? `Searching: ${detail}`
                        : 'Searching the web...'
                      : toolName === 'WebFetch'
                        ? detail
                          ? `Fetching: ${detail}`
                          : 'Fetching webpage...'
                        : `Using ${toolName}`,
                  detail,
                });
              }
            }
          }

          if (message.type === 'result') {
            console.log('[Pipeline] Session result:', message.subtype);
          }
        }

        const run = runs.get(sessionId);
        if (run && run.status === 'running') {
          run.status = 'completed';
          run.finishedAt = new Date().toISOString();
        }
      } catch (error) {
        const run = runs.get(sessionId);
        if (run && run.status !== 'cancelled') {
          run.status = 'error';
          run.error = error instanceof Error ? error.message : String(error);
          run.finishedAt = new Date().toISOString();
        }
        console.error('[Pipeline] Background run error:', error);
      } finally {
        // Persist to history even if no SSE client is connected.
        try {
          const run = runs.get(sessionId);
          await persistSessionToHistory(sessionId, run?.status, run?.error);
        } catch (err) {
          console.error('[Pipeline] Failed to persist session to history:', err);
        }

        // Keep completed/cancelled runs around briefly for late cancel requests? For now, delete.
        runs.delete(sessionId);
      }
    })();

    return NextResponse.json({
      success: true,
      sessionId,
      message: `Pipeline started for ${suburb} with ${agencyCount} agencies`,
    });
  } catch (error) {
    console.error('[Pipeline Start] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start pipeline' },
      { status: 500 }
    );
  }
}

function buildOrchestratorPrompt(sessionId: string, suburb: string, count: number, startedAt: string): string {
  return `You are the Agency Pipeline Orchestrator. Your task is to identify and process ${count} real estate agencies in ${suburb}.

CRITICAL: You must write progress updates to files so the UI can display real-time feedback.
CRITICAL: Do not use emojis anywhere (messages, file output, HTML).
CRITICAL: Do not do deep research yourself. Your job is ONLY to identify agencies (name + website) and spawn subagents.

## Session Info
- Session ID: ${sessionId}
- Project Root: ${PROJECT_ROOT}
- Progress Directory: ${PROGRESS_DIR}
- Agencies Directory: ${AGENCIES_DIR}
- Public Demo Directory: ${PUBLIC_DEMO_DIR}

## Step 1: Pipeline Already Initialized
The pipeline file has been created at ${PROGRESS_DIR}/pipeline-${sessionId}.json
Current status: searching

## Activity Streaming
Tool usage and subagent lifecycle events are streamed automatically via hooks.
Do NOT edit any activity stream files manually.

## Step 2: Find Agencies (FAST, incremental)
Use WebSearch to find real estate agencies in ${suburb}. Stop as soon as you have ${count} agencies.
Do NOT use WebFetch for agency websites at this stage.
De-duplicate agencies by website domain and by agencyId slug (skip duplicates).

Search queries to use:
- "${suburb} real estate agents Sydney"
- "${suburb} real estate agencies"
- "best real estate agents ${suburb}"

As you identify each agency (one-by-one), do ALL of the following immediately (do not wait until you have all ${count}):
1) Generate a URL-safe slug/ID (e.g., "ray-white-surry-hills").
2) Update the pipeline file:
   - Append the agencyId to agencyIds (keep order of discovery)
   - Keep todos[1] ("search") as in_progress
3) Create / update the skeleton progress file for that agency at:
   ${PROGRESS_DIR}/agency-{agencyId}.json
   - status: "skeleton"
   - name and website filled in
   - everything else null/0
   - include steps array exactly as provided below

This is what causes agency cards to appear quickly with real names (no blank placeholders).

Once you have exactly ${count} agencies:
1) Update pipeline file:
   - set todo with id "search" to status "complete"
   - set todo with id "spawn" to status "in_progress"
   - status = "processing"
2) Proceed to Step 3.

## Skeleton Progress File Format
Write ${PROGRESS_DIR}/agency-{agencyId}.json with this format:

{
  "agencyId": "agency-slug",
  "sessionId": "${sessionId}",
  "status": "skeleton",
  "updatedAt": "ISO timestamp",
  "name": "Agency Name",
  "website": "https://...",
  "logoUrl": null,
  "primaryColor": null,
  "secondaryColor": null,
  "phone": null,
  "address": null,
  "teamSize": null,
  "listingCount": null,
  "soldCount": null,
  "priceRangeMin": null,
  "priceRangeMax": null,
  "forRentCount": null,
  "painScore": null,
  "htmlProgress": 0,
  "demoUrl": null,
  "steps": [
    { "id": "website", "label": "Found website", "status": "pending" },
    { "id": "details", "label": "Extracted details", "status": "pending" },
    { "id": "generating", "label": "Generating demo page", "status": "pending" },
    { "id": "complete", "label": "Ready", "status": "pending" }
  ]
}

## Step 3: Spawn Subagents (ONE message, N tasks)
Use the Task tool to spawn ${count} parallel subagents. Each subagent processes ONE agency.

IMPORTANT: Spawn all subagents in a SINGLE message with multiple Task tool calls.

For each agency, use:
- subagent_type: "agency-processor"
- description: "Process agency {name}"
- prompt: include agency details AND absolute paths for file operations.

Use the agency-processor skill to:
1. Extract agency details (logo, colors, phone, metrics)
2. Calculate pain score
3. Generate demo HTML page
4. Update progress file at each step

The subagent prompt should be:

"Process the agency {name}.
agencyId: {agencyId}
Session ID: ${sessionId}
Website: {website}
progressFilePath: ${PROGRESS_DIR}/agency-{agencyId}.json
activityFilePath: ${PROGRESS_DIR}/agency-activity-{agencyId}.json
demoHtmlPath: ${PUBLIC_DEMO_DIR}/{agencyId}.html
agencyDataPath: ${AGENCIES_DIR}/{agencyId}.json

Use the agency-processor subagent instructions. Follow these steps:

1. Update progress file to status='extracting'
2. WebFetch the website to extract logo, colors, phone
3. Update progress file with each extracted field
4. WebSearch for team size and listing count if not found
5. Calculate pain score
6. Update progress to status='generating', htmlProgress=10
7. Generate demo HTML page and save to the absolute Demo HTML path above
8. Save agency data to the absolute Agency data path above
9. Update progress to status='complete', htmlProgress=100, demoUrl='/demo/{agencyId}'

Progress file path: ${PROGRESS_DIR}/agency-{agencyId}.json

CRITICAL: Use ONLY the absolute paths listed above for Read/Write/Edit. Update the progress file after EACH step so the UI shows real-time updates."

Immediately after spawning all tasks:
1) Update pipeline file:
   - set todo with id "spawn" to status "complete"
   - set todo with id "generate" to status "in_progress"

## Step 4: Wait and Complete
After all subagents complete:
1) Read the pipeline file
2) Update:
   - set todo with id "generate" to status "complete"
   - status = "complete"
   - completedAt = current ISO timestamp
3) Write back to the file

## Tool Restrictions
- DO NOT use Chrome, Playwright, or any browser automation tools
- Use ONLY: WebSearch, WebFetch, Read, Write, Task, Skill, Glob`;
}
