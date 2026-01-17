# Pipeline & Streaming UI Specification

## Overview

User selects N agencies (1-25), and N subagents run in parallel - each extracting agency details AND generating its demo page simultaneously. The UI streams progress in real-time via SSE.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND                                          │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │  Location: [Surry Hills        ]  Agencies: [====●====] 15  [Search]           │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         AGENT ACTIVITY PANEL                                    │ │
│  │  🔍 Searching for real estate agencies in Surry Hills...                        │ │
│  │  📄 Found 12 search results                                                     │ │
│  │  🌐 Checking Ray White Surry Hills website...                                   │ │
│  │  ✓ Identified: Ray White Surry Hills                                            │ │
│  │  Found 8 of 15 agencies...                                                       │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         TODO PANEL (Collapsible)                                │ │
│  │  ☑ Searching for agencies in Surry Hills                                        │ │
│  │  ◐ Processing 15 agencies in parallel                                           │ │
│  │  ☐ Generating demo pages                                                        │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            AGENCY CARDS GRID                                    │ │
│  │                                                                                 │ │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                   │ │
│  │  │ Ray White       │ │ LJ Hooker       │ │ Belle Property  │                   │ │
│  │  │ ████████████    │ │ ▓▓▓▓▓▓▓▓        │ │ ░░░░░░░░        │                   │ │
│  │  │ ✓ Found website │ │ ✓ Found website │ │ ✓ Found website │                   │ │
│  │  │ ✓ Got details   │ │ ✓ Got details   │ │ ● Getting info  │                   │ │
│  │  │ ✓ Generated     │ │ ● Generating... │ │ ○ Generate page │                   │ │
│  │  │ [View Demo]     │ │ [Preview]       │ │                 │                   │ │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘                   │ │
│  │                                                                                 │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         HISTORY TAB                                             │ │
│  │  Surry Hills - Jan 17, 2:30pm          15 agencies • 12 demos    [✏️]          │ │
│  │  [Ray White] [LJ Hooker] [Belle] [+9 more]                                      │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
          │
          │ SSE (Server-Sent Events)
          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND                                           │
│                                                                                      │
│  GET /api/pipeline/stream                                                            │
│  • Reads /data/progress/*.json every 500ms                                          │
│  • Pushes changes to connected clients                                               │
│                                                                                      │
│  CLAUDE CODE ORCHESTRATION                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  MAIN ORCHESTRATOR                                                           │    │
│  │  1. Search for agencies                                                      │    │
│  │  2. Write activity + skeleton progress files                                 │    │
│  │  3. Spawn N parallel subagents                                               │    │
│  │  4. Wait for completion                                                      │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│            │                                                                         │
│            ├──────────────────────┬──────────────────────┐                          │
│            ▼                      ▼                      ▼                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                 │
│  │   SUBAGENT 1    │    │   SUBAGENT 2    │    │   SUBAGENT N    │   (Parallel)    │
│  │   agency-proc   │    │   agency-proc   │    │   agency-proc   │                 │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘                 │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline State File

**Location:** `/data/progress/pipeline-{sessionId}.json`

```typescript
interface PipelineState {
  sessionId: string;
  suburb: string;
  requestedCount: number;
  status: 'searching' | 'processing' | 'complete' | 'error';
  startedAt: string;
  completedAt: string | null;

  todos: Array<{
    id: string;
    text: string;
    status: 'pending' | 'in_progress' | 'complete';
  }>;

  agencyIds: string[];

  // Activity tracking (pre-card phase)
  activity: {
    status: 'active' | 'complete';
    agenciesFound: number;
    agenciesTarget: number;
    messages: ActivityMessage[];
  };

  error?: string;
}

interface ActivityMessage {
  id: string;
  type: 'search' | 'results' | 'fetch' | 'identified' | 'warning' | 'thinking';
  text: string;
  detail?: string;
  timestamp: string;
}
```

---

## Agency Progress File

**Location:** `/data/progress/agency-{agencyId}.json`

```typescript
interface AgencyProgress {
  agencyId: string;
  sessionId: string;
  status: 'skeleton' | 'extracting' | 'generating' | 'complete' | 'error';
  updatedAt: string;

  // Basic Info
  name: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;

  // Branding
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;

  // Metrics
  teamSize: number | null;
  listingCount: number | null;
  painScore: number | null;
  soldCount: number | null;
  priceRangeMin: string | null;
  priceRangeMax: string | null;
  forRentCount: number | null;

  // Generation
  htmlProgress: number;              // 0-100
  demoUrl: string | null;

  // Step Tracking
  steps: Array<{
    id: 'website' | 'details' | 'generating' | 'complete';
    label: string;
    status: 'pending' | 'in_progress' | 'complete' | 'error';
  }>;

  error?: string;
}
```

**Default Steps:**
```json
[
  { "id": "website", "label": "Found website", "status": "pending" },
  { "id": "details", "label": "Extracted details", "status": "pending" },
  { "id": "generating", "label": "Generating demo page", "status": "pending" },
  { "id": "complete", "label": "Ready", "status": "pending" }
]
```

---

## SSE Event Types

### Activity Events (Pre-Card Phase)

```typescript
// Activity panel started
{ type: 'activity_start'; sessionId: string; target: number; }

// New activity message
{ type: 'activity_message'; message: ActivityMessage; found: number; target: number; }

// Activity complete, show cards
{ type: 'activity_complete'; sessionId: string; agencies: Array<{id, name, website}>; }
```

### Card Events

```typescript
// Todo list update
{ type: 'todo_update'; sessionId: string; todos: Array<{id, text, status}>; }

// Agency card update
{ type: 'card_update'; agencyId: string; data: AgencyProgress; }

// Card removed (error)
{ type: 'card_remove'; agencyId: string; reason: string; }

// Pipeline complete
{ type: 'pipeline_complete'; sessionId: string; totalAgencies: number; successCount: number; failedCount: number; }
```

---

## Activity Message Types

| Icon | Type | When | Example |
|------|------|------|---------|
| 🔍 | search | Agent uses WebSearch | "Searching for real estate agencies in Surry Hills..." |
| 📄 | results | Search returns | "Found 12 search results" |
| 🌐 | fetch | Agent uses WebFetch | "Checking Ray White Surry Hills website..." |
| ✓ | identified | Agency confirmed | "Identified: Ray White Surry Hills" |
| ⚠️ | warning | Non-critical issue | "Skipping: Site unavailable" |
| 💭 | thinking | Agent reasoning | "Looking for more agencies to reach 15..." |

---

## Card States

### 1. Skeleton
- Pulsing placeholder
- Shows name only
- All steps pending

### 2. Extracting
- Logo appears, colors fill border
- Steps update progressively
- Data fields animate in

### 3. Generating
- Shows mock preview (abstract blocks)
- htmlProgress updates 0-100
- Steps[2] in_progress

### 4. Complete
- Full card with all data
- [View Demo] button
- All steps complete

### 5. Error
- Card fades out
- Removed from grid
- `card_remove` event sent

---

## Card Display Fields

```
┌─────────────────────────────────────┐
│  [Logo]   Ray White Surry Hills     │
│           ─────────────────────     │
│                                     │
│  📍 Surry Hills, Sydney             │  Location
│  💰 $600K - $2.1M                   │  Price range
│  🏠 45 for sale • 12 sold           │  Listing stats
│  🏢 28 rentals                      │  PM load (if > 0)
│  👥 8 agents                        │  Team size
│  🎯 Pain Score: 87                  │  Qualification
│                                     │
│  ✓ Found website                    │  Steps
│  ✓ Extracted details                │
│  ● Generating demo page...          │
│  ○ Ready                            │
│                                     │
│  [View Demo]                        │  CTA
└─────────────────────────────────────┘
```

---

## Orchestrator Prompt

```markdown
You are the Agency Pipeline Orchestrator. Find and process {count} real estate agencies in {suburb}.

CRITICAL: Write progress updates to files so the UI displays real-time feedback.

## Session Info
- Session ID: {sessionId}
- Progress Directory: /data/progress/

## Step 1: Initialize Pipeline
Write to /data/progress/pipeline-{sessionId}.json with:
- status: "searching"
- todos (3 items)
- activity.status: "active"

## Step 2: Search for Agencies
Use WebSearch. Report activity messages:
- Before search: type "search"
- After results: type "results"
- Before each fetch: type "fetch"
- After agency confirmed: type "identified"

Update activity.agenciesFound as you go.

## Step 3: Create Skeleton Progress Files
For each agency, write /data/progress/agency-{agencyId}.json with status "skeleton".

## Step 4: Spawn Subagents
Use Task tool to spawn {count} parallel subagents.
IMPORTANT: Spawn ALL in a SINGLE message with multiple Task calls.

For each agency:
- subagent_type: "agency-processor"
- prompt: "Process agency {agencyId}. Session: {sessionId}. Website: {url}."

## Step 5: Complete
After all subagents finish:
- Update all todos to "complete"
- Set pipeline status = "complete"

## Tool Restrictions
DO NOT use Chrome, Playwright, or browser automation.
Use ONLY: WebSearch, WebFetch, Read, Write, Task, Glob
```

---

## Subagent Skill: agency-processor

**Location:** `.claude/skills/agency-processor/SKILL.md`

The subagent must:
1. WebFetch agency website
2. Extract: logo, colors, contact, metrics
3. Update progress file at each milestone
4. Update step statuses
5. Generate branded HTML
6. Save to /public/demo/{agencyId}.html
7. Set status "complete", demoUrl

**Progress Update Points:**
- After fetching website: steps[0] complete, steps[1] in_progress
- After extracting details: steps[1] complete, steps[2] in_progress
- After HTML generation: steps[2] complete, steps[3] complete, status "complete"

---

## Search History

**Location:** `/data/history/sessions.json`

```typescript
interface SearchSession {
  sessionId: string;
  name: string;                      // Auto: "{Suburb} - {Month} {Day}, {Time}"
  suburb: string;
  requestedCount: number;
  actualCount: number;
  successCount: number;
  createdAt: string;
  completedAt: string | null;
  status: 'running' | 'complete' | 'partial' | 'failed';

  agencies: Array<{
    id: string;
    name: string;
    logoUrl: string | null;
    demoUrl: string | null;
  }>;
}
```

**Retention:** 50 sessions max, delete oldest when exceeded.

**History Tab Features:**
- Session cards with agency chips
- Click chip → navigate to demo
- Edit icon → rename session
- Expand → full agency grid

---

## UI Phase Transitions

| Phase | Activity Panel | Cards Grid |
|-------|---------------|------------|
| Search starting | Active, empty | Hidden |
| Searching | Active, messages streaming | Hidden |
| All agencies found | Collapses | Appears with animation |
| Processing | Collapsed (expandable) | Visible, updating |
| Complete | Collapsed | Complete |

---

## Animation Specs

**Message Appear:**
```css
@keyframes messageAppear {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Panel Collapse:**
```css
@keyframes collapsePanel {
  from { max-height: 400px; }
  to { max-height: 48px; }
}
```

**Cards Appear:**
```css
@keyframes cardsAppear {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Skeleton Pulse:**
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

**Data Slide In:**
```css
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## Error Handling

### Subagent Failure
1. Subagent sets status: "error"
2. SSE pushes card_remove
3. Card animates out
4. Main agent continues with others

### Pipeline Failure
1. Main agent sets status: "error"
2. SSE pushes pipeline_complete with error flag
3. Frontend shows error with retry option

### SSE Disconnection
1. Frontend detects onerror
2. Exponential backoff reconnect
3. Fetch current state from progress files

---

## Progress Cleanup

**Trigger:** Lazy cleanup when reading files

**Policy:** Delete files older than 24 hours

```typescript
async function cleanupProgressFiles() {
  const maxAge = 24 * 60 * 60 * 1000;
  const files = await fs.readdir('/data/progress');
  const now = Date.now();

  for (const file of files) {
    const stat = await fs.stat(file);
    if (now - stat.mtimeMs > maxAge) {
      await fs.unlink(file);
    }
  }
}
```

---

## Frontend Components

### SearchForm
- Text input for suburb
- Slider for count (1-25, default 10)
- Search button
- Disabled during processing

### AgentActivityPanel
- Auto-scroll to bottom
- Max height with scroll
- Animated streaming indicator (●●●)
- Collapse/expand toggle
- Progress counter

### TodoPanel
- Collapsible
- Visual states: pending (☐), in_progress (◐), complete (☑)
- Smooth animation

### AgencyCard
- Skeleton → Extracting → Generating → Complete states
- Step checklist
- Mock preview during generation
- [View Demo] button when complete

### HistoryList
- Session cards
- Agency chips (first 5 + "+N more")
- Click to navigate
- Edit to rename
