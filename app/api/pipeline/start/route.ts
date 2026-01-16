import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { invokeClaudeCodeAsync } from '@/lib/claude';

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');

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
      activity: {
        status: 'active',
        agenciesFound: 0,
        agenciesTarget: agencyCount,
        messages: [],
      },
    };

    const pipelinePath = path.join(PROGRESS_DIR, `pipeline-${sessionId}.json`);
    await fs.writeFile(pipelinePath, JSON.stringify(pipelineState, null, 2));

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
- Progress Directory: ${PROGRESS_DIR}
- Working Directory: ${process.cwd()}

## Step 1: Pipeline Already Initialized
The pipeline file has been created at ${PROGRESS_DIR}/pipeline-${sessionId}.json
Current status: searching

## CRITICAL: Activity Reporting

You MUST report your activity to the pipeline file so users see real-time progress.
The UI shows an activity panel that streams your tool usage.

### Activity Message Format
Read the pipeline file, add to activity.messages array, then write back:

{
  "id": "msg-{timestamp}",
  "type": "search|results|fetch|identified|warning|thinking",
  "text": "Human-readable message",
  "detail": "Optional detail line",
  "timestamp": "ISO timestamp"
}

### When to Report Activity

1. BEFORE WebSearch:
   Add message: { "type": "search", "text": "Searching for real estate agencies in ${suburb}..." }

2. AFTER WebSearch:
   Add message: { "type": "results", "text": "Found X search results" }

3. BEFORE checking each agency website:
   Add message: { "type": "fetch", "text": "Checking {agency name} website..." }

4. AFTER confirming an agency:
   Add message: { "type": "identified", "text": "Identified: {agency name}", "detail": "{website url}" }
   Update: activity.agenciesFound = current count

5. If searching for more agencies:
   Add message: { "type": "thinking", "text": "Looking for more agencies to reach ${count}..." }

6. If skipping an invalid result:
   Add message: { "type": "warning", "text": "Skipping: {reason}" }

### Activity Update Example

After each action, read the pipeline file, update like this:
\`\`\`json
{
  "activity": {
    "status": "active",
    "agenciesFound": 3,
    "agenciesTarget": ${count},
    "messages": [
      { "id": "msg-1234", "type": "search", "text": "Searching for real estate agencies in ${suburb}...", "timestamp": "..." },
      { "id": "msg-1235", "type": "results", "text": "Found 12 search results", "timestamp": "..." },
      { "id": "msg-1236", "type": "fetch", "text": "Checking Ray White ${suburb} website...", "timestamp": "..." },
      { "id": "msg-1237", "type": "identified", "text": "Identified: Ray White ${suburb}", "detail": "raywhite.com.au", "timestamp": "..." }
    ]
  }
}
\`\`\`

## Step 2: Search for Agencies
Use WebSearch to find real estate agencies in ${suburb}. Find at least ${count} agencies.

REPORT ACTIVITY: Before and after each search!

Search queries to use:
- "${suburb} real estate agents Sydney"
- "${suburb} real estate agencies"
- "best real estate agents ${suburb}"

For each agency found:
- REPORT: "fetch" message before checking website
- REPORT: "identified" message after confirming
- Update activity.agenciesFound count

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
   - activity.status = "complete"
   - activity.agenciesFound = ${count}
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
  "teamSize": null,
  "listingCount": null,
  "painScore": null,
  "htmlProgress": 0,
  "demoUrl": null
}

## Step 4: Spawn Subagents
Use the Task tool to spawn ${count} parallel subagents. Each subagent processes ONE agency.

IMPORTANT: Spawn all subagents in a SINGLE message with multiple Task tool calls.

For each agency, use:
- subagent_type: "general-purpose"
- prompt: Process agency {agencyId}. Session: ${sessionId}. Website: {url}. Name: {name}.

Use the agency-processor skill to:
1. Extract agency details (logo, colors, phone, metrics)
2. Calculate pain score
3. Generate demo HTML page
4. Update progress file at each step

The subagent prompt should be:

"Process the agency {name} (ID: {agencyId}).
Session ID: ${sessionId}
Website: {website}

Use the agency-processor skill. Follow these steps:

1. Update progress file to status='extracting'
2. WebFetch the website to extract logo, colors, phone
3. Update progress file with each extracted field
4. WebSearch for team size and listing count if not found
5. Calculate pain score
6. Update progress to status='generating', htmlProgress=10
7. Generate demo HTML page and save to /public/demo/{agencyId}.html
8. Save agency data to /data/agencies/{agencyId}.json
9. Update progress to status='complete', htmlProgress=100, demoUrl='/demo/{agencyId}'

Progress file path: ${PROGRESS_DIR}/agency-{agencyId}.json

CRITICAL: Update the progress file after EACH step so the UI shows real-time updates."

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
- Use ONLY: WebSearch, WebFetch, Read, Write, Task, Glob`;
}
