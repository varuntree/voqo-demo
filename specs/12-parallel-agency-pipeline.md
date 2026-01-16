# 12 - Parallel Agency Pipeline with Real-Time Streaming UI

## Overview

This specification describes a complete overhaul of the agency search and demo generation flow. Instead of sequential operations with static loaders, we implement a parallel pipeline with real-time streaming feedback using the Claude Agent SDK.

**Key Innovation:** User selects N agencies (1-25), and N subagents run in parallel - each extracting agency details AND generating its demo page simultaneously. The UI streams progress in real-time, showing cards animate from skeleton → extracting → generating → complete.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND                                          │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         AGENT TODO PANEL (Collapsible)                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │ ☑ Searching for agencies in Surry Hills                                 │   │ │
│  │  │ ◐ Processing 25 agencies in parallel                                    │   │ │
│  │  │ ☐ Generating demo pages                                                 │   │ │
│  │  └─────────────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            AGENCY CARDS GRID                                    │ │
│  │                                                                                 │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │ │
│  │  │ ██████████  │ │ ▓▓▓▓▓▓▓▓    │ │ ░░░░░░░░    │ │ ░░░░░░░░    │              │ │
│  │  │  Complete   │ │  Generating │ │  Extracting │ │  Skeleton   │  ...         │ │
│  │  │ [View Demo] │ │ ┌────────┐  │ │             │ │             │              │ │
│  │  │             │ │ │Preview │  │ │  Logo...    │ │  Agency N   │              │ │
│  │  │             │ │ └────────┘  │ │  Colors...  │ │  (pulsing)  │              │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘              │ │
│  │                                                                                 │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│         ▲                                                                            │
│         │ SSE (Server-Sent Events)                                                   │
│         │                                                                            │
└─────────┼────────────────────────────────────────────────────────────────────────────┘
          │
┌─────────┼────────────────────────────────────────────────────────────────────────────┐
│         │                         BACKEND (Next.js)                                   │
│         │                                                                             │
│  ┌──────▼─────────────────────────────────────────────────────────────────────────┐  │
│  │                    GET /api/pipeline/stream (SSE Endpoint)                      │  │
│  │                                                                                 │  │
│  │   • Reads /data/progress/*.json every 500ms                                     │  │
│  │   • Pushes changes to connected clients                                         │  │
│  │   • Event types: todo_update, card_update, pipeline_complete                    │  │
│  └─────────────────────────────────────────────────────────────────────────────────┘  │
│                              ▲                                                        │
│                              │ reads                                                  │
│  ┌───────────────────────────┴─────────────────────────────────────────────────────┐  │
│  │                        /data/progress/                                           │  │
│  │                                                                                  │  │
│  │   pipeline-{session-id}.json          (Main pipeline state + todos)              │  │
│  │   agency-{agency-id}.json             (Per-agency progress)                      │  │
│  │   agency-{agency-id}.json             ...                                        │  │
│  │   agency-{agency-id}.json             (N files for N agencies)                   │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                              ▲                                                        │
│                              │ writes                                                 │
│  ┌───────────────────────────┴─────────────────────────────────────────────────────┐  │
│  │                         CLAUDE CODE ORCHESTRATION                                │  │
│  │                                                                                  │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │  │
│  │  │                        MAIN ORCHESTRATOR AGENT                           │    │  │
│  │  │                                                                          │    │  │
│  │  │  1. Search for agencies in suburb                                        │    │  │
│  │  │  2. Identify N agency names + URLs                                       │    │  │
│  │  │  3. Write initial progress files (skeleton state)                        │    │  │
│  │  │  4. Spawn N subagents via Task tool                                      │    │  │
│  │  │  5. Wait for all to complete                                             │    │  │
│  │  │  6. Write pipeline complete                                              │    │  │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │  │
│  │                              │                                                   │  │
│  │            ┌─────────────────┼─────────────────┐                                │  │
│  │            │                 │                 │                                 │  │
│  │            ▼                 ▼                 ▼                                 │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                    │  │
│  │  │   SUBAGENT 1    │ │   SUBAGENT 2    │ │   SUBAGENT N    │                    │  │
│  │  │                 │ │                 │ │                 │                    │  │
│  │  │ • Extract data  │ │ • Extract data  │ │ • Extract data  │  (Parallel)        │  │
│  │  │ • Write progress│ │ • Write progress│ │ • Write progress│                    │  │
│  │  │ • Generate HTML │ │ • Generate HTML │ │ • Generate HTML │                    │  │
│  │  │ • Write progress│ │ • Write progress│ │ • Write progress│                    │  │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘                    │  │
│  │                                                                                  │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Sequence

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE DATA FLOW                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

    USER                    FRONTEND                 BACKEND                 CLAUDE CODE
     │                         │                        │                         │
     │  1. Enter "Surry Hills" │                        │                         │
     │     Select: 15 agencies │                        │                         │
     │     Click [Search]      │                        │                         │
     │ ───────────────────────►│                        │                         │
     │                         │                        │                         │
     │                         │  2. POST /api/pipeline/start                     │
     │                         │     { suburb, count }  │                         │
     │                         │ ──────────────────────►│                         │
     │                         │                        │                         │
     │                         │                        │  3. Generate sessionId   │
     │                         │                        │     Create pipeline.json │
     │                         │                        │     Invoke Claude Code   │
     │                         │                        │ ───────────────────────►│
     │                         │                        │                         │
     │                         │  4. Response: { sessionId }                      │
     │                         │◄──────────────────────│                         │
     │                         │                        │                         │
     │                         │  5. Connect SSE        │                         │
     │                         │     /api/pipeline/stream?session={id}            │
     │                         │ ──────────────────────►│                         │
     │                         │                        │                         │
     │                         │                        │         6. MAIN AGENT   │
     │                         │                        │         ┌───────────────┤
     │                         │                        │         │ WebSearch     │
     │                         │                        │         │ Find agencies │
     │                         │                        │         └───────────────┤
     │                         │                        │                         │
     │                         │                        │         7. Write todos  │
     │                         │                        │◄────────────────────────│
     │                         │                        │  pipeline-{id}.json     │
     │                         │  8. SSE: todo_update   │  { todos: [...] }       │
     │                         │◄──────────────────────│                         │
     │                         │                        │                         │
     │  9. Todo panel updates  │                        │         10. Found 15    │
     │◄────────────────────────│                        │         agency names    │
     │                         │                        │                         │
     │                         │                        │         11. Write       │
     │                         │                        │◄────────────────────────│
     │                         │                        │  15x agency-{id}.json   │
     │                         │                        │  status: "skeleton"     │
     │                         │  12. SSE: card_update  │                         │
     │                         │      (x15 skeleton)    │                         │
     │                         │◄──────────────────────│                         │
     │                         │                        │                         │
     │  13. 15 skeleton cards  │                        │         14. Spawn 15    │
     │      appear (pulsing)   │                        │         Task subagents  │
     │◄────────────────────────│                        │ ───────────────────────►│
     │                         │                        │                         │
     │                         │                        │    ┌────────────────────┤
     │                         │                        │    │  SUBAGENT 1        │
     │                         │                        │    │  WebFetch agency   │
     │                         │                        │    │  Extract logo      │
     │                         │                        │    │  Write progress    │
     │                         │                        │◄───┤  status: extracting│
     │                         │                        │    └────────────────────┤
     │                         │  15. SSE: card_update  │                         │
     │                         │      agency-1: logo    │                         │
     │                         │◄──────────────────────│                         │
     │                         │                        │                         │
     │  16. Card 1 shows logo  │                        │    ┌────────────────────┤
     │      animates in        │                        │    │  Extract colors    │
     │◄────────────────────────│                        │    │  Write progress    │
     │                         │                        │◄───┤  colors: {...}     │
     │                         │                        │    └────────────────────┤
     │                         │  17. SSE: card_update  │                         │
     │                         │      agency-1: colors  │                         │
     │                         │◄──────────────────────│                         │
     │                         │                        │                         │
     │  18. Card 1 border      │                        │                         │
     │      gets brand color   │                        │    (PARALLEL: All 15    │
     │◄────────────────────────│                        │     subagents running)  │
     │                         │                        │                         │
     │         ...             │         ...            │         ...             │
     │                         │                        │                         │
     │                         │                        │    ┌────────────────────┤
     │                         │                        │    │  SUBAGENT 1        │
     │                         │                        │    │  details complete  │
     │                         │                        │    │  status: generating│
     │                         │                        │◄───┤  Write HTML...     │
     │                         │                        │    └────────────────────┤
     │                         │  19. SSE: card_update  │                         │
     │                         │      agency-1: preview │                         │
     │                         │◄──────────────────────│                         │
     │                         │                        │                         │
     │  20. Card 1 shows       │                        │    ┌────────────────────┤
     │      mock preview       │                        │    │  HTML complete     │
     │◄────────────────────────│                        │    │  status: complete  │
     │                         │                        │◄───┤  demoUrl: /demo/.. │
     │                         │                        │    └────────────────────┤
     │                         │  21. SSE: card_update  │                         │
     │                         │      agency-1: complete│                         │
     │                         │◄──────────────────────│                         │
     │                         │                        │                         │
     │  22. Card 1 shows       │                        │                         │
     │      [View Demo] button │                        │                         │
     │◄────────────────────────│                        │         ...             │
     │                         │                        │                         │
     │         ...             │         ...            │    (All subagents       │
     │  (Cards update async)   │  (SSE events stream)   │     complete)           │
     │                         │                        │                         │
     │                         │                        │         23. Main agent  │
     │                         │                        │◄────────────────────────│
     │                         │                        │  pipeline complete      │
     │                         │  24. SSE: pipeline_complete                      │
     │                         │◄──────────────────────│                         │
     │                         │                        │                         │
     │  25. All todos checked  │                        │                         │
     │      "Complete" state   │                        │                         │
     │◄────────────────────────│                        │                         │
     │                         │                        │                         │
```

---

## File Structures

### 1. Pipeline State File

**Location:** `/data/progress/pipeline-{sessionId}.json`

```typescript
interface PipelineState {
  sessionId: string;
  suburb: string;
  requestedCount: number;
  status: 'searching' | 'processing' | 'complete' | 'error';
  startedAt: string;           // ISO timestamp
  completedAt: string | null;

  // Todo items from agent (live updated)
  todos: Array<{
    id: string;
    text: string;
    status: 'pending' | 'in_progress' | 'complete';
  }>;

  // List of agency IDs being processed
  agencyIds: string[];

  // Error info if failed
  error?: string;
}
```

**Example:**
```json
{
  "sessionId": "pipe-1705312200-x7k9m",
  "suburb": "Surry Hills",
  "requestedCount": 15,
  "status": "processing",
  "startedAt": "2025-01-15T10:30:00.000Z",
  "completedAt": null,
  "todos": [
    { "id": "t1", "text": "Searching for agencies in Surry Hills", "status": "complete" },
    { "id": "t2", "text": "Processing 15 agencies in parallel", "status": "in_progress" },
    { "id": "t3", "text": "Generating demo pages", "status": "pending" }
  ],
  "agencyIds": ["ray-white-surry-hills", "lj-hooker-surry-hills", "..."]
}
```

---

### 2. Agency Progress File

**Location:** `/data/progress/agency-{agencyId}.json`

```typescript
interface AgencyProgress {
  agencyId: string;
  sessionId: string;           // Links to pipeline
  status: 'skeleton' | 'extracting' | 'generating' | 'complete' | 'error';
  updatedAt: string;           // ISO timestamp

  // Progressive data (populated as extracted)
  name: string | null;
  website: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;

  // Metrics (populated during extraction)
  phone: string | null;
  teamSize: number | null;
  listingCount: number | null;
  painScore: number | null;

  // HTML generation progress (0-100)
  htmlProgress: number;

  // Final output
  demoUrl: string | null;      // "/demo/{agencyId}" when complete

  // Error info if failed
  error?: string;
}
```

**Example - Skeleton State:**
```json
{
  "agencyId": "ray-white-surry-hills",
  "sessionId": "pipe-1705312200-x7k9m",
  "status": "skeleton",
  "updatedAt": "2025-01-15T10:30:05.000Z",
  "name": "Ray White Surry Hills",
  "website": "https://raywhitesurryhills.com.au",
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
```

**Example - Extracting State:**
```json
{
  "agencyId": "ray-white-surry-hills",
  "sessionId": "pipe-1705312200-x7k9m",
  "status": "extracting",
  "updatedAt": "2025-01-15T10:30:15.000Z",
  "name": "Ray White Surry Hills",
  "website": "https://raywhitesurryhills.com.au",
  "logoUrl": "https://raywhitesurryhills.com.au/logo.png",
  "primaryColor": "#ffe512",
  "secondaryColor": null,
  "phone": "+61 2 9361 6000",
  "teamSize": null,
  "listingCount": null,
  "painScore": null,
  "htmlProgress": 0,
  "demoUrl": null
}
```

**Example - Generating State:**
```json
{
  "agencyId": "ray-white-surry-hills",
  "sessionId": "pipe-1705312200-x7k9m",
  "status": "generating",
  "updatedAt": "2025-01-15T10:30:45.000Z",
  "name": "Ray White Surry Hills",
  "website": "https://raywhitesurryhills.com.au",
  "logoUrl": "https://raywhitesurryhills.com.au/logo.png",
  "primaryColor": "#ffe512",
  "secondaryColor": "#1a1a1a",
  "phone": "+61 2 9361 6000",
  "teamSize": 8,
  "listingCount": 45,
  "painScore": 87,
  "htmlProgress": 60,
  "demoUrl": null
}
```

**Example - Complete State:**
```json
{
  "agencyId": "ray-white-surry-hills",
  "sessionId": "pipe-1705312200-x7k9m",
  "status": "complete",
  "updatedAt": "2025-01-15T10:31:00.000Z",
  "name": "Ray White Surry Hills",
  "website": "https://raywhitesurryhills.com.au",
  "logoUrl": "https://raywhitesurryhills.com.au/logo.png",
  "primaryColor": "#ffe512",
  "secondaryColor": "#1a1a1a",
  "phone": "+61 2 9361 6000",
  "teamSize": 8,
  "listingCount": 45,
  "painScore": 87,
  "htmlProgress": 100,
  "demoUrl": "/demo/ray-white-surry-hills"
}
```

---

## API Endpoints

### POST /api/pipeline/start

**Purpose:** Initiate a new agency search + generation pipeline

**Request:**
```typescript
interface PipelineStartRequest {
  suburb: string;
  count: number;    // 1-25
}
```

**Response:**
```typescript
interface PipelineStartResponse {
  success: boolean;
  sessionId: string;
  message: string;
}
```

**Implementation:**
1. Generate unique sessionId
2. Create initial pipeline state file
3. Invoke Claude Code with orchestrator prompt (async, non-blocking)
4. Return sessionId immediately

---

### GET /api/pipeline/stream

**Purpose:** SSE endpoint for real-time progress updates

**Query Parameters:**
- `session`: Pipeline session ID

**SSE Event Types:**

```typescript
// Todo list update
interface TodoUpdateEvent {
  type: 'todo_update';
  sessionId: string;
  todos: Array<{
    id: string;
    text: string;
    status: 'pending' | 'in_progress' | 'complete';
  }>;
}

// Agency card update
interface CardUpdateEvent {
  type: 'card_update';
  agencyId: string;
  data: AgencyProgress;
}

// Card removed (error case)
interface CardRemoveEvent {
  type: 'card_remove';
  agencyId: string;
  reason: string;
}

// Pipeline complete
interface PipelineCompleteEvent {
  type: 'pipeline_complete';
  sessionId: string;
  totalAgencies: number;
  successCount: number;
  failedCount: number;
}
```

**Implementation:**
- Poll `/data/progress/` every 500ms
- Track last-seen state per file
- Push only changed data
- Implement heartbeat (`:keepalive` every 15s)

---

## Claude Code Integration

### Main Orchestrator Prompt

The orchestrator is invoked via `invokeClaudeCodeAsync` with this prompt structure:

```
You are the Agency Pipeline Orchestrator. Your task is to find and process {count} real estate agencies in {suburb}.

CRITICAL: You must write progress updates to files so the UI can display real-time feedback.

## Session Info
- Session ID: {sessionId}
- Progress Directory: /data/progress/

## Step 1: Initialize Pipeline
Write to /data/progress/pipeline-{sessionId}.json:
{
  "sessionId": "{sessionId}",
  "suburb": "{suburb}",
  "requestedCount": {count},
  "status": "searching",
  "startedAt": "{timestamp}",
  "completedAt": null,
  "todos": [
    { "id": "t1", "text": "Searching for agencies in {suburb}", "status": "in_progress" },
    { "id": "t2", "text": "Processing {count} agencies in parallel", "status": "pending" },
    { "id": "t3", "text": "Generating demo pages", "status": "pending" }
  ],
  "agencyIds": []
}

## Step 2: Search for Agencies
Use WebSearch to find real estate agencies in {suburb}. Find at least {count} agencies.

After finding agencies, update pipeline file:
- Set todos[0].status = "complete"
- Set todos[1].status = "in_progress"
- Set agencyIds = [list of agency slugs]
- Set status = "processing"

## Step 3: Create Skeleton Progress Files
For each agency found, write /data/progress/agency-{agencyId}.json with status "skeleton".
Include: agencyId, sessionId, name, website (from search results).

## Step 4: Spawn Subagents
Use the Task tool to spawn {count} parallel subagents. Each subagent processes ONE agency.

IMPORTANT: Spawn all subagents in a SINGLE message with multiple Task tool calls.

For each agency, spawn with:
- subagent_type: "agency-processor"
- prompt: "Process agency {agencyId}. Session: {sessionId}. Website: {url}. Use the agency-processor skill."

## Step 5: Wait and Complete
After all subagents complete:
- Update todos[1].status = "complete"
- Update todos[2].status = "complete"
- Set pipeline status = "complete"
- Set completedAt = current timestamp

## Tool Restrictions
- DO NOT use Chrome, Playwright, or any browser automation tools
- Use ONLY: WebSearch, WebFetch, Read, Write, Task, Glob
```

---

### Subagent Skill: agency-processor

**Location:** `.claude/skills/agency-processor/SKILL.md`

This is a NEW combined skill that replaces `agency-researcher` and `demo-page-builder`.

```markdown
---
name: agency-processor
description: Extract agency data and generate demo page with real-time progress updates
---

# Agency Processor Skill

You process a single real estate agency: extract details and generate its demo page.

## CRITICAL: Progress Updates

You MUST write progress updates to /data/progress/agency-{agencyId}.json at each milestone.
The UI displays these updates in real-time. Users see your progress as it happens.

## Input
You receive:
- agencyId: URL-safe slug
- sessionId: Pipeline session ID
- website: Agency website URL

## Process

### Phase 1: Extract Data

#### 1.1 Fetch Homepage
Use WebFetch to get the agency homepage.
Update progress: status = "extracting"

#### 1.2 Extract Logo
Look for logo in:
- <img> tags with "logo" in src/alt/class
- og:image meta tag
- favicon as fallback

Update progress: logoUrl = "{url}"

#### 1.3 Extract Colors
Analyze the page content for brand colors:
- Look for CSS color patterns in style attributes
- Common header/button colors
- If WebFetch returns HTML, parse inline styles

Update progress: primaryColor = "#xxx", secondaryColor = "#xxx"

#### 1.4 Extract Contact Info
Find:
- Phone number (Australian format: +61 or 02/03/07/08)
- Address

Update progress: phone = "...", address = "..."

#### 1.5 Extract Metrics
Use WebFetch on team/about pages:
- Count team members
- Find listing counts

Use WebSearch if needed:
- "{agency name} listings"
- "{agency name} team"

Update progress: teamSize = N, listingCount = N

#### 1.6 Calculate Pain Score
Apply scoring formula:
- 30+ listings: +20
- Has PM: +25
- <5 agents + 20+ listings: +20
- No after-hours: +15
- No chat widget: +10

Update progress: painScore = N, status = "generating"

### Phase 2: Generate Demo Page

#### 2.1 Start Generation
Update progress: htmlProgress = 10

#### 2.2 Build HTML
Generate complete HTML file with:
- Tailwind CSS via CDN
- Agency branding (logo, colors)
- Pain points section
- ROI calculator
- Call demo button
- Embedded agency data

Update progress: htmlProgress = 50

#### 2.3 Write HTML File
Save to: /public/demo/{agencyId}.html

Update progress: htmlProgress = 100, status = "complete", demoUrl = "/demo/{agencyId}"

### Phase 3: Save Agency Data

Write complete agency data to: /data/agencies/{agencyId}.json
(This is separate from progress file - it's the permanent record)

## Progress File Format

Always write valid JSON to /data/progress/agency-{agencyId}.json:

```json
{
  "agencyId": "...",
  "sessionId": "...",
  "status": "extracting|generating|complete|error",
  "updatedAt": "ISO timestamp",
  "name": "...",
  "website": "...",
  "logoUrl": "..." or null,
  "primaryColor": "..." or null,
  "secondaryColor": "..." or null,
  "phone": "..." or null,
  "teamSize": N or null,
  "listingCount": N or null,
  "painScore": N or null,
  "htmlProgress": 0-100,
  "demoUrl": "..." or null,
  "error": "..." (only if status = "error")
}
```

## Error Handling

If extraction fails:
1. Set status = "error"
2. Set error = "reason"
3. The UI will remove this card

Do NOT retry - move on. The main agent handles retries if needed.

## Tool Restrictions

- DO NOT use Chrome, Playwright, or any browser automation tools
- Use ONLY: WebSearch, WebFetch, Read, Write, Glob
```

---

## Frontend Implementation

### UI Components

#### 1. Search Form

```tsx
interface SearchFormProps {
  onSubmit: (suburb: string, count: number) => void;
}

// Components:
// - Text input for suburb
// - Slider for count (1-25, default 10)
// - Search button
// - Disabled state during processing
```

#### 2. Todo Panel

```tsx
interface TodoPanelProps {
  todos: Array<{
    id: string;
    text: string;
    status: 'pending' | 'in_progress' | 'complete';
  }>;
  collapsed: boolean;
  onToggle: () => void;
}

// Visual states:
// - pending: ☐ gray text
// - in_progress: ◐ spinning, blue text
// - complete: ☑ green text
// - Collapsible with smooth animation
// - Header shows "Agent Tasks" with count
```

#### 3. Agency Card

```tsx
interface AgencyCardProps {
  data: AgencyProgress;
}

// States:
// 1. Skeleton: Pulsing placeholder, shows name only
// 2. Extracting: Logo appears, colors fill border, details animate in
// 3. Generating: Shows mock preview (abstract blocks)
// 4. Complete: Full card with [View Demo] button
// 5. Removing: Fade out animation (error case)
```

#### 4. Mock Preview

```
┌─────────────────────────────┐
│  ████████ Header ████████   │  ← Uses primaryColor
├─────────────────────────────┤
│                             │
│  ░░░░░░░░░░░░░░░░░░░░░░░░  │  ← Hero section (gradient)
│  ░░░░░░░ Hero ░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░  │
│                             │
├─────────────────────────────┤
│  ▒▒▒  ▒▒▒  ▒▒▒              │  ← Pain cards (3 blocks)
├─────────────────────────────┤
│  ████████ CTA ████████████  │  ← CTA section (primaryColor)
└─────────────────────────────┘

Blocks fill in progressively based on htmlProgress:
- 0-20%: Header only
- 20-40%: + Hero
- 40-60%: + Pain cards
- 60-80%: + CTA
- 80-100%: Complete
```

---

### SSE Client Implementation

```typescript
function usePipelineStream(sessionId: string) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [cards, setCards] = useState<Map<string, AgencyProgress>>(new Map());
  const [status, setStatus] = useState<'running' | 'complete' | 'error'>('running');

  useEffect(() => {
    const eventSource = new EventSource(`/api/pipeline/stream?session=${sessionId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'todo_update':
          setTodos(data.todos);
          break;

        case 'card_update':
          setCards(prev => {
            const next = new Map(prev);
            next.set(data.agencyId, data.data);
            return next;
          });
          break;

        case 'card_remove':
          setCards(prev => {
            const next = new Map(prev);
            next.delete(data.agencyId);
            return next;
          });
          break;

        case 'pipeline_complete':
          setStatus('complete');
          eventSource.close();
          break;
      }
    };

    eventSource.onerror = () => {
      setStatus('error');
    };

    return () => eventSource.close();
  }, [sessionId]);

  return { todos, cards, status };
}
```

---

## Background Processes

### 1. SSE Progress Poller

**Location:** Inline in `/api/pipeline/stream/route.ts`

**Behavior:**
- Reads `/data/progress/*.json` every 500ms
- Tracks last-modified timestamps
- Only pushes changed files
- Sends heartbeat every 15 seconds

**Lifecycle:**
- Starts when client connects
- Runs until pipeline complete or client disconnects
- Cleans up on disconnect

---

### 2. Progress Cleanup Job

**Location:** `/lib/progress-cleanup.ts`

**Schedule:** Runs every 24 hours

**Implementation:**
```typescript
async function cleanupProgressFiles() {
  const progressDir = '/data/progress';
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  const files = await fs.readdir(progressDir);
  const now = Date.now();

  for (const file of files) {
    const filePath = path.join(progressDir, file);
    const stat = await fs.stat(filePath);

    if (now - stat.mtimeMs > maxAge) {
      await fs.unlink(filePath);
      console.log(`[Cleanup] Deleted stale progress file: ${file}`);
    }
  }
}
```

**Trigger Options:**
1. **Cron job:** External cron calls cleanup endpoint
2. **On startup:** Run cleanup when server starts
3. **Lazy cleanup:** Check file age when reading, delete if stale

**Recommended:** Option 3 (lazy cleanup) - simplest, no external dependencies.

---

## Card Animation Specifications

### Skeleton State
```css
/* Pulsing animation */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.skeleton {
  animation: pulse 2s ease-in-out infinite;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
}
```

### Data Appearing
```css
/* Line-by-line reveal */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.data-field {
  animation: slideIn 0.3s ease-out forwards;
}
```

### Card State Transitions
- Skeleton → Extracting: Pulse stops, logo fades in
- Extracting → Generating: Card slightly expands, preview appears
- Generating → Complete: Button fades in, success indicator

---

## Error Handling

### Subagent Failure
1. Subagent sets `status: "error"` in progress file
2. SSE pushes `card_remove` event
3. Frontend animates card out (fade + slide)
4. Main agent continues with remaining agencies

### Pipeline Failure
1. Main agent sets `status: "error"` in pipeline file
2. SSE pushes `pipeline_complete` with error flag
3. Frontend shows error state with retry option

### Network/SSE Disconnection
1. Frontend detects `onerror` event
2. Attempts reconnect with exponential backoff
3. On reconnect, fetches current state from progress files

---

## Migration Notes

### Files to Delete (Old Skills)
- `.claude/skills/agency-researcher/SKILL.md` - Replaced by agency-processor
- `.claude/skills/demo-page-builder/SKILL.md` - Replaced by agency-processor

### Files to Create
- `.claude/skills/agency-processor/SKILL.md` - New combined skill
- `/app/api/pipeline/start/route.ts` - Pipeline start endpoint
- `/app/api/pipeline/stream/route.ts` - SSE endpoint
- `/lib/progress-cleanup.ts` - Cleanup utility
- `/components/TodoPanel.tsx` - Todo panel component
- `/components/AgencyCard.tsx` - Card component
- `/components/MockPreview.tsx` - Preview component

### Files to Modify
- `/app/page.tsx` - New search form with slider + streaming UI
- `/lib/claude.ts` - May need streaming support (TBD based on implementation)

---

## Testing Checklist

- [ ] Pipeline starts and creates progress files
- [ ] SSE connection established and receives events
- [ ] Todo panel updates in real-time
- [ ] Skeleton cards appear after search
- [ ] Cards update progressively as data arrives
- [ ] Mock preview shows during generation
- [ ] Complete state shows View Demo button
- [ ] Error cards are removed smoothly
- [ ] Pipeline completes and SSE closes
- [ ] Cleanup removes old progress files
- [ ] Works with 1 agency
- [ ] Works with 25 agencies
- [ ] Handles partial failures gracefully
