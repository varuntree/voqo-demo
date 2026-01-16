import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { invokeClaudeCodeAsync } from '@/lib/claude';

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

    // Create initial pipeline state file
    const pipelineState = {
      sessionId,
      suburb,
      requestedCount: agencyCount,
      status: 'searching',
      startedAt,
      completedAt: null,
      todos: [
        { id: 't1', text: `Searching for agencies in ${suburb}`, status: 'in_progress' },
        { id: 't2', text: `Processing ${agencyCount} agencies in parallel`, status: 'pending' },
        { id: 't3', text: 'Generating demo pages', status: 'pending' },
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
          id: `msg-${Date.now()}`,
          type: 'thinking',
          text: `Starting search in ${suburb}...`,
          source: 'System',
          timestamp: startedAt,
        },
      ],
    };
    const activityPath = path.join(PROGRESS_DIR, `activity-${sessionId}.json`);
    await fs.writeFile(activityPath, JSON.stringify(activityState, null, 2));

    console.log(`[Pipeline] Created session ${sessionId} for ${suburb} (${agencyCount} agencies)`);

    // Build orchestrator prompt
    const orchestratorPrompt = buildOrchestratorPrompt(sessionId, suburb, agencyCount, startedAt);

    // Invoke Claude Code asynchronously (fire-and-forget)
    invokeClaudeCodeAsync({
      prompt: orchestratorPrompt,
      workingDir: process.cwd(),
      activitySessionId: sessionId,
    });

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
  return `You are the Agency Pipeline Orchestrator. Your task is to find and process ${count} real estate agencies in ${suburb}.

CRITICAL: You must write progress updates to files so the UI can display real-time feedback.

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

## Step 2: Search for Agencies
Use WebSearch to find real estate agencies in ${suburb}. Find at least ${count} agencies.

Search queries to use:
- "${suburb} real estate agents Sydney"
- "${suburb} real estate agencies"
- "best real estate agents ${suburb}"

For each agency found:
Extract:
- Name (official business name)
- Website URL
- Generate a URL-safe slug/ID (e.g., "ray-white-surry-hills")

After finding all ${count} agencies, update the pipeline file:
1. Read ${PROGRESS_DIR}/pipeline-${sessionId}.json
2. Update:
   - todos[0].status = "complete"
   - todos[1].status = "in_progress"
   - agencyIds = [list of agency slugs]
   - status = "processing"
3. Write back to the file

## Step 3: Create Skeleton Progress Files
For each agency found, write ${PROGRESS_DIR}/agency-{agencyId}.json with this format:

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

## Step 4: Spawn Subagents
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

"Process the agency {name} (ID: {agencyId}).
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

## Step 5: Wait and Complete
After all subagents complete:
1. Read the pipeline file
2. Update:
   - todos[1].status = "complete"
   - todos[2].status = "complete"
   - status = "complete"
   - completedAt = current ISO timestamp
3. Write back to the file

## Tool Restrictions
- DO NOT use Chrome, Playwright, or any browser automation tools
- Use ONLY: WebSearch, WebFetch, Read, Write, Task, Skill, Glob`;
}
