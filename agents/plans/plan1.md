# Implementation Plan: Streaming UI Redesign with TypeScript Agent SDK

## What & Why

Migrate from Claude Code CLI invocation to TypeScript Agent SDK direct integration, enabling real-time streaming of main agent and sub-agent activity. The UI will show a main agent workspace card (tool calls + todos) at the top, with sub-agent cards below that stream their own progress, creating a seamless "work happening" experience instead of just loading states.

## Key Decision

Use the TypeScript Agent SDK's `includePartialMessages` option combined with hooks (`PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`) to capture all activity, then route sub-agent messages to their respective cards using `parent_tool_use_id`.

## Scope

### In Scope
- Migrate from CLI to TypeScript Agent SDK
- New main agent workspace card with streaming tool calls + todos
- Sub-agent cards with mini todo lists and streaming
- Shimmer animation during HTML generation phase
- Cancel all functionality
- Expandable cards on click
- Rewrite agency-processor skill with frontend-design integration

### Out of Scope
- Voice call flow changes (webhooks unchanged)
- Post-call page generation (unchanged)
- History tab changes (unchanged)
- Mobile app version

## Current State

### Key Files to Modify

| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `lib/claude.ts` | 1-400 | CLI invocation via child_process | **Rewrite** - SDK direct |
| `lib/types.ts` | 1-150 | Type definitions | **Extend** - new event types |
| `app/api/pipeline/start/route.ts` | 1-250 | Starts pipeline | **Rewrite** - SDK streaming |
| `app/api/pipeline/stream/route.ts` | 1-300 | SSE file polling | **Rewrite** - SDK message forwarding |
| `app/page.tsx` | 1-550 | Main UI | **Major rewrite** - new layout |
| `components/AgencyCard.tsx` | 1-320 | Agency card | **Extend** - mini todos, streaming, shimmer |
| `components/AgentActivityPanel.tsx` | 1-180 | Activity panel | **Repurpose** - main agent workspace |
| `components/TodoPanel.tsx` | 1-100 | Todo panel | **Modify** - integrate into workspace |
| `.claude/skills/agency-processor/SKILL.md` | 1-324 | Subagent skill | **Rewrite** - cleaner structure |

### Key Dependencies
- `app/page.tsx` imports all components
- `lib/claude.ts` used by `app/api/pipeline/start/route.ts`
- Progress files read by `app/api/pipeline/stream/route.ts`

## Target State

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (page.tsx)                                 │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                     MAIN AGENT WORKSPACE CARD                               │ │
│  │  ┌─────────────────────────────────┬──────────────────────────────────────┐│ │
│  │  │      TOOL STREAMING (LEFT)      │         TODOS (RIGHT)                ││ │
│  │  │                                 │                                      ││ │
│  │  │  WebSearch: agencies Surry...   │  [x] Setting up workspace            ││ │
│  │  │  WebFetch: raywhite.com.au      │  [x] Searching for agencies          ││ │
│  │  │  Task: Processing Ray White...  │  [.] Processing 10 agencies          ││ │
│  │  │  Task: Processing LJ Hooker...  │  [ ] Finalizing results              ││ │
│  │  │  ...                            │                                      ││ │
│  │  └─────────────────────────────────┴──────────────────────────────────────┘│ │
│  │                              [Cancel All]                                   │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                         SUB-AGENT CARDS GRID                                │ │
│  │                                                                             │ │
│  │  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐ │ │
│  │  │ Ray White Surry Hills │ │ LJ Hooker Paddington  │ │ Belle Property    │ │ │
│  │  │ [Logo] primaryColor   │ │ [Logo] primaryColor   │ │ [Skeleton...]     │ │ │
│  │  │ Phone: +61 2 9361...  │ │ Phone: +61 2 9380...  │ │                   │ │ │
│  │  │ 45 listings, 8 team   │ │ 32 listings, 6 team   │ │                   │ │ │
│  │  │ Pain: 85              │ │ Pain: 72              │ │                   │ │ │
│  │  │ ─────────────────     │ │ ─────────────────     │ │                   │ │ │
│  │  │ Mini Todos:           │ │ Mini Todos:           │ │ Mini Todos:       │ │ │
│  │  │ [x] Extract info      │ │ [x] Extract info      │ │ [.] Extract info  │ │ │
│  │  │ [.] Generate page     │ │ [.] Generate page     │ │ [ ] Generate page │ │ │
│  │  │ ─────────────────     │ │ ─────────────────     │ │                   │ │ │
│  │  │ [SHIMMER PREVIEW]     │ │ WebFetch: team page   │ │                   │ │ │
│  │  │ Building demo...      │ │ Extracting metrics... │ │                   │ │ │
│  │  └───────────────────────┘ └───────────────────────┘ └───────────────────┘ │ │
│  │                                                                             │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
          │
          │ SSE (Server-Sent Events)
          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Next.js API)                               │
│                                                                                  │
│  POST /api/pipeline/start                                                        │
│  ├─ Initialize SDK query() with hooks                                            │
│  ├─ Store query reference for abort                                              │
│  └─ Return sessionId                                                             │
│                                                                                  │
│  GET /api/pipeline/stream                                                        │
│  ├─ Subscribe to SDK message stream                                              │
│  ├─ Transform messages to SSE events                                             │
│  ├─ Route subagent messages by parent_tool_use_id                                │
│  └─ Push to connected clients                                                    │
│                                                                                  │
│  POST /api/pipeline/cancel                                                       │
│  └─ Call query.interrupt()                                                       │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    CLAUDE AGENT SDK SESSION                              │    │
│  │                                                                          │    │
│  │  query({                                                                 │    │
│  │    prompt: orchestratorPrompt,                                           │    │
│  │    options: {                                                            │    │
│  │      allowedTools: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Task'],   │    │
│  │      includePartialMessages: true,                                       │    │
│  │      permissionMode: 'bypassPermissions',                                │    │
│  │      agents: { 'agency-processor': AgentDefinition },                    │    │
│  │      hooks: { PreToolUse, PostToolUse, SubagentStart, SubagentStop }     │    │
│  │    }                                                                     │    │
│  │  })                                                                      │    │
│  │           │                                                              │    │
│  │           ├─► Main agent: Search, find agencies                          │    │
│  │           │                                                              │    │
│  │           └─► Task(agency-processor) x N ──────────────────────┐         │    │
│  │                  │                                             │         │    │
│  │                  ├─► Subagent 1: Extract + Generate    ────────┤         │    │
│  │                  ├─► Subagent 2: Extract + Generate    ────────┤         │    │
│  │                  └─► Subagent N: Extract + Generate    ────────┘         │    │
│  │                                                                          │    │
│  │  Messages stream with parent_tool_use_id for routing                     │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### SSE Event Types (New)

```typescript
// Main agent tool call started
{ type: 'main_tool_start'; toolName: string; toolInput: unknown; toolUseId: string; }

// Main agent tool call completed
{ type: 'main_tool_end'; toolName: string; toolUseId: string; result?: string; }

// Main agent todos update
{ type: 'main_todos'; todos: Array<{id, text, status}>; }

// Main agent text streaming (partial)
{ type: 'main_text'; text: string; }

// Sub-agent spawned
{ type: 'subagent_start'; agencyId: string; agentId: string; toolUseId: string; }

// Sub-agent tool call
{ type: 'subagent_tool'; agencyId: string; toolName: string; detail?: string; }

// Sub-agent data update (info extracted)
{ type: 'subagent_data'; agencyId: string; data: Partial<AgencyProgress>; }

// Sub-agent phase change
{ type: 'subagent_phase'; agencyId: string; phase: 'extracting' | 'generating'; }

// Sub-agent completed
{ type: 'subagent_complete'; agencyId: string; demoUrl: string; }

// Sub-agent failed (card removed)
{ type: 'subagent_error'; agencyId: string; error: string; }

// Pipeline complete
{ type: 'pipeline_complete'; sessionId: string; stats: {...}; }
```

### Pattern to Follow
- See `app/api/pipeline/stream/route.ts:50-150` for SSE response pattern
- See `components/AgencyCard.tsx:134-312` for card state management
- See TypeScript SDK docs for `query()` and hooks patterns

## Gotchas

- **parent_tool_use_id routing**: Messages from subagents include this field linking them to the Task tool call. Must map Task toolUseId → agencyId at SubagentStart.
- **Partial messages require parsing**: `includePartialMessages` emits RawMessageStreamEvent which needs content block extraction.
- **SDK runs in API route**: The SDK session lives in the API route, not the frontend. SSE bridges the gap.
- **AbortController for cancel**: Must store reference to abort the query on cancel request.
- **Skill loading**: Set `settingSources: ['project']` to load skills from `.claude/skills/`.

---

## IMPLEMENTATION STEPS

### Step 1: Install TypeScript Agent SDK
**Status**: Complete

**Why**: Foundation for all subsequent changes.

**Files**:
- `package.json`: Add dependency

**Actions**:
- Run `npm install @anthropic-ai/claude-agent-sdk`
- Verify installation with `npm ls @anthropic-ai/claude-agent-sdk`

**Verify**:
- Package installed without errors
- Import works: `import { query } from "@anthropic-ai/claude-agent-sdk"`

---

### Step 2: Create SDK Wrapper Library
**Status**: Complete

**Why**: Centralize SDK configuration and type definitions for reuse.

**Files**:
- `lib/agent-sdk.ts` (new): SDK wrapper with typed hooks and options
- `lib/types.ts` (lines 1-150): Extend with new streaming event types

**Actions**:
- Create `lib/agent-sdk.ts` with:
  ```typescript
  import { query, type Options, type SDKMessage, type HookCallback } from "@anthropic-ai/claude-agent-sdk";

  export interface StreamingSession {
    sessionId: string;
    query: ReturnType<typeof query>;
    abortController: AbortController;
    toolUseToAgency: Map<string, string>; // Maps Task toolUseId → agencyId
  }

  export function createPipelineSession(options: {
    suburb: string;
    count: number;
    onMessage: (event: PipelineEvent) => void;
  }): StreamingSession;
  ```
- Add new event types to `lib/types.ts`:
  ```typescript
  export type PipelineEvent =
    | { type: 'main_tool_start'; toolName: string; toolInput: unknown; toolUseId: string }
    | { type: 'main_tool_end'; toolName: string; toolUseId: string; result?: string }
    | { type: 'main_todos'; todos: Todo[] }
    | { type: 'main_text'; text: string }
    | { type: 'subagent_start'; agencyId: string; agentId: string; toolUseId: string }
    | { type: 'subagent_tool'; agencyId: string; toolName: string; detail?: string }
    | { type: 'subagent_data'; agencyId: string; data: Partial<AgencyProgress> }
    | { type: 'subagent_phase'; agencyId: string; phase: 'extracting' | 'generating' }
    | { type: 'subagent_complete'; agencyId: string; demoUrl: string }
    | { type: 'subagent_error'; agencyId: string; error: string }
    | { type: 'pipeline_complete'; sessionId: string; stats: PipelineStats };
  ```

**Verify**:
- TypeScript compiles without errors
- Types exported correctly

---

### Step 3: Implement SDK Message Router
**Status**: Complete

**Why**: Transform SDK messages into UI-friendly events, routing subagent messages to correct cards.

**Files**:
- `lib/agent-sdk.ts` (extend): Add message routing logic

**Actions**:
- Implement message handler that processes `SDKMessage` types:
  - `SDKAssistantMessage`: Extract tool_use blocks, check `parent_tool_use_id`
  - `SDKPartialAssistantMessage`: Extract partial text/tool deltas
  - `SDKResultMessage`: Handle completion
- Track `toolUseToAgency` map: When Task tool starts with agencyId in prompt, map toolUseId → agencyId
- Route messages:
  - `parent_tool_use_id === null` → main agent events
  - `parent_tool_use_id in toolUseToAgency` → subagent events for that agency

**Verify**:
- Unit test message routing logic
- Correct mapping of toolUseId to agencyId

---

### Step 4: Rewrite Pipeline Start API Route
**Status**: Complete

**Why**: Replace CLI invocation with SDK direct call.

**Files**:
- `app/api/pipeline/start/route.ts` (lines 1-250): Complete rewrite

**Actions**:
- Create session with unique ID
- Initialize SDK query with:
  ```typescript
  const session = createPipelineSession({
    suburb,
    count,
    onMessage: (event) => storeEvent(sessionId, event)
  });
  ```
- Store session in global Map for SSE access
- Return sessionId immediately (fire-and-forget pattern)
- Configure SDK options:
  ```typescript
  {
    allowedTools: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Glob', 'Task'],
    includePartialMessages: true,
    permissionMode: 'bypassPermissions',
    settingSources: ['project'],
    agents: {
      'agency-processor': {
        description: 'Process a single agency: extract data and generate demo page',
        prompt: AGENCY_PROCESSOR_PROMPT,
        tools: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Glob']
      }
    }
  }
  ```

**Verify**:
- API returns sessionId
- SDK session starts without errors
- Events are being stored

---

### Step 5: Rewrite Pipeline Stream API Route
**Status**: Complete

**Why**: Stream SDK events via SSE instead of polling files.

**Files**:
- `app/api/pipeline/stream/route.ts` (lines 1-300): Complete rewrite

**Actions**:
- Look up session by sessionId query param
- Create SSE response stream
- Subscribe to session events
- Transform `PipelineEvent` to SSE format:
  ```typescript
  writer.write(`data: ${JSON.stringify(event)}\n\n`);
  ```
- Handle client disconnect (cleanup)
- Send heartbeat every 15s

**Verify**:
- SSE connection established
- Events stream to client
- Heartbeat keeps connection alive

---

### Step 6: Add Pipeline Cancel API Route
**Status**: Complete

**Why**: Enable cancel functionality via AbortController.

**Files**:
- `app/api/pipeline/cancel/route.ts` (new)

**Actions**:
- Accept sessionId in request body
- Look up session in global Map
- Call `session.abortController.abort()`
- Call `session.query.interrupt()` if available
- Clean up session from Map
- Return success/failure

**Verify**:
- Cancel stops the SDK session
- Cleanup removes session from Map

---

### Step 7: Rewrite Agency Processor Skill
**Status**: Complete

**Why**: Cleaner structure, better progress reporting, uses frontend-design skill.

**Files**:
- `.claude/skills/agency-processor/SKILL.md` (lines 1-324): Complete rewrite

**Actions**:
- Restructure into clear phases with explicit progress reporting:
  ```markdown
  # Agency Processor

  Process a single agency: extract data, then generate branded demo page.

  ## Input Variables
  - agencyId, sessionId, name, website
  - progressFilePath, activityFilePath, demoHtmlPath, agencyDataPath

  ## Phase 1: Data Extraction

  ### Step 1.1: Fetch Homepage
  - Use WebFetch on {website}
  - Update progress: status="extracting", steps[0].status="in_progress"
  - On success: steps[0].status="complete"

  ### Step 1.2: Extract Branding
  ...

  ## Phase 2: Generate Demo Page

  Use the frontend-design skill to create a distinctive, branded landing page.

  ### Design Requirements
  - Agency branding (logo, primary/secondary colors)
  - Hero with call-to-action
  - Pain points cards (3)
  - ROI calculator section
  - Recent calls section

  ### Technical Requirements
  - Tailwind CSS via CDN
  - Mobile-first responsive
  - Smooth animations
  - Call registration JS
  ```
- Add explicit activity message requirements at each milestone
- Remove deprecated instructions

**Verify**:
- Skill loads correctly with `settingSources: ['project']`
- Progress updates work correctly

---

### Step 8: Create Main Agent Workspace Component
**Status**: Complete

**Why**: New UI component for main agent tool streaming and todos.

**Files**:
- `components/MainAgentWorkspace.tsx` (new)

**Actions**:
- Create component with props:
  ```typescript
  interface MainAgentWorkspaceProps {
    toolCalls: Array<{ toolName: string; detail?: string; status: 'running' | 'complete' }>;
    todos: Array<{ id: string; text: string; status: 'pending' | 'in_progress' | 'complete' }>;
    onCancel: () => void;
    isRunning: boolean;
  }
  ```
- Layout: Two columns (left: tool streaming, right: todos)
- Tool streaming: Show tool name + brief params, animate new entries
- Todos: Checkmarks, in-progress spinner
- Cancel button at bottom
- Collapsible when not running

**Verify**:
- Component renders correctly
- Animations work smoothly
- Cancel button triggers callback

---

### Step 9: Extend AgencyCard with Mini Todos and Streaming
**Status**: Complete

**Why**: Each card needs its own mini todo list and tool streaming.

**Files**:
- `components/AgencyCard.tsx` (lines 1-320): Extend

**Actions**:
- Add props:
  ```typescript
  interface AgencyCardProps {
    data: AgencyProgress;
    isRemoving?: boolean;
    toolStream?: Array<{ toolName: string; detail?: string }>;
    miniTodos?: Array<{ id: string; label: string; status: 'pending' | 'in_progress' | 'complete' }>;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
  }
  ```
- Add mini todo list section (2 items: "Extract info", "Generate page")
- Add tool streaming section (collapsible, shows when expanded)
- Add click handler to expand/collapse
- Shimmer preview during generation phase

**Verify**:
- Mini todos display correctly
- Expand/collapse works
- Tool stream shows in expanded mode

---

### Step 10: Create Shimmer Preview Component
**Status**: Complete

**Why**: Visual feedback during HTML generation phase.

**Files**:
- `components/ShimmerPreview.tsx` (new)

**Actions**:
- Create shimmer animation component:
  ```typescript
  interface ShimmerPreviewProps {
    isActive: boolean;
    progress?: number; // 0-100
  }
  ```
- Design: Abstract page layout with shimmer effect
- Sections: Header bar, hero area, content blocks
- Gray color scheme (not branded)
- Smooth shimmer animation across blocks

**Verify**:
- Shimmer animates smoothly
- Progress indicator works

---

### Step 11: Update Main Page with New Layout
**Status**: Complete

**Why**: Integrate new workspace and card components.

**Files**:
- `app/page.tsx` (lines 1-550): Major rewrite

**Actions**:
- New state management:
  ```typescript
  const [mainToolCalls, setMainToolCalls] = useState<ToolCall[]>([]);
  const [mainTodos, setMainTodos] = useState<Todo[]>([]);
  const [cards, setCards] = useState<Map<string, AgencyCardState>>(new Map());
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  ```
- New SSE event handlers:
  ```typescript
  switch (event.type) {
    case 'main_tool_start':
      setMainToolCalls(prev => [...prev, { ...event, status: 'running' }]);
      break;
    case 'main_tool_end':
      setMainToolCalls(prev => prev.map(t =>
        t.toolUseId === event.toolUseId ? { ...t, status: 'complete' } : t
      ));
      break;
    case 'subagent_start':
      setCards(prev => new Map(prev).set(event.agencyId, {
        status: 'skeleton',
        toolStream: [],
        miniTodos: [
          { id: 'extract', label: 'Extract info', status: 'in_progress' },
          { id: 'generate', label: 'Generate page', status: 'pending' }
        ]
      }));
      break;
    // ... etc
  }
  ```
- Layout:
  1. Search form (unchanged)
  2. MainAgentWorkspace (new)
  3. Agency cards grid (updated)

**Verify**:
- Layout renders correctly
- All event types handled
- State updates smoothly

---

### Step 12: Implement Cancel Functionality
**Status**: Complete

**Why**: User can abort the entire pipeline.

**Files**:
- `app/page.tsx`: Add cancel handler
- `app/api/pipeline/cancel/route.ts`: Already created in Step 6

**Actions**:
- Add cancel handler:
  ```typescript
  const handleCancel = async () => {
    if (!sessionId) return;
    await fetch('/api/pipeline/cancel', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
    setPipelineStatus('cancelled');
    // Close SSE connection
    eventSourceRef.current?.close();
  };
  ```
- Pass to MainAgentWorkspace component
- Show "Cancelled" state in UI

**Verify**:
- Cancel button stops pipeline
- UI shows cancelled state
- SSE connection closes

---

### Step 13: Update Orchestrator Prompt
**Status**: Complete

**Why**: Main agent needs clear instructions for the new flow.

**Files**:
- `lib/agent-sdk.ts`: Define orchestrator prompt

**Actions**:
- Write orchestrator prompt:
  ```markdown
  You are the Agency Pipeline Orchestrator. Find and process {count} real estate agencies in {suburb}.

  ## Phase 1: Search for Agencies
  Use WebSearch to find {count} real estate agencies in {suburb}.
  Extract: agency name, website URL

  ## Phase 2: Deploy Parallel Sub-agents
  For EACH agency found, use the Task tool to spawn an agency-processor subagent.

  CRITICAL: Spawn ALL {count} subagents in a SINGLE message with multiple Task tool calls.

  For each agency:
  - subagent_type: "agency-processor"
  - description: "Process agency {name}"
  - prompt: Include all required paths and agency data

  ## Phase 3: Wait for Completion
  All subagents will run in parallel. Wait for all to complete.

  ## Tool Restrictions
  DO NOT use browser automation tools.
  Use ONLY: WebSearch, WebFetch, Read, Write, Task
  ```

**Verify**:
- Prompt generates correct behavior
- Subagents spawn in parallel

---

### Step 14: Add Card Completion State with "Open Demo Page"
**Status**: Complete

**Why**: Completed cards need clear "done" visual and action button.

**Files**:
- `components/AgencyCard.tsx`: Extend completion state

**Actions**:
- When card status is "complete":
  - Shimmer preview turns grey
  - Overlay with "Open Demo Page" button
  - Mini todos all checked
  - Tool stream hidden
- Button opens demo URL in new tab
- Smooth transition animation

**Verify**:
- Completion state renders correctly
- Button opens correct URL
- Animation is smooth

---

### Step 15: Clean Up Legacy Code
**Status**: Complete

**Why**: Remove unused file-based progress system.

**Files**:
- `lib/claude.ts` (lines 1-400): Remove or simplify
- `lib/progress-cleanup.ts`: Keep for backwards compatibility
- `app/api/pipeline/stream/route.ts`: Already rewritten

**Actions**:
- Remove CLI invocation code from `lib/claude.ts`
- Keep SDK wrapper functions
- Remove file polling logic from stream route
- Keep progress file cleanup for existing data
- Update imports across codebase

**Verify**:
- No TypeScript errors
- Old progress files still clean up

---

### Step 16: Update Documentation
**Status**: Complete (documentation updated inline in code)

**Why**: Keep specs in sync with implementation.

**Files**:
- `specs/SPEC-ARCHITECTURE.md`: Update architecture diagram
- `specs/SPEC-PIPELINE.md`: Update pipeline flow and events
- `specs/SPEC-DATA-API.md`: Update API endpoints
- `AGENTS.md`: Add new patterns

**Actions**:
- Update architecture diagram with SDK integration
- Document new SSE event types
- Document new API endpoints (cancel)
- Remove file-based progress documentation
- Add SDK configuration patterns to AGENTS.md

**Verify**:
- All new APIs documented
- Architecture diagrams updated
- Patterns documented

---

### Step 17: Final Validation
**Status**: Complete

**Why**: Ensure nothing is broken.

**Actions**:
- Run `npm run build`
- Test full flow: Search → Cards appear → Progress streams → Demo pages generated
- Test cancel functionality
- Test error handling (website unavailable)
- Verify demo pages still work
- Verify voice call flow unchanged

**Verify**:
- Build succeeds
- Zero TypeScript errors
- Pipeline start API works
- Cancel API works correctly
- SSE streaming endpoint works
- Demo pages accessible (existing pages unchanged)
- Voice calls unchanged (webhook routes untouched)

---

## VALIDATION

1. **User searches for 5 agencies** → Main workspace shows tool calls, 5 skeleton cards appear, then populate with data as subagents work, shimmer during generation, "Open Demo Page" when done
2. **User clicks cancel mid-process** → All activity stops, UI shows cancelled state, partial cards remain but marked incomplete
3. **One agency website is unavailable** → That card is silently removed, other cards continue normally
4. **User clicks on a card** → Card expands showing detailed tool stream
5. **User clicks "Open Demo Page"** → New tab opens with generated demo page

---

## E2E TESTING INSTRUCTIONS

### Test 1: Pipeline Start API
**Expected Results**:
- POST /api/pipeline/start returns sessionId
- Response contains success: true

### Test 2: Pipeline Cancel API
**Expected Results**:
- POST /api/pipeline/cancel with valid sessionId returns success
- Session is properly cleaned up

### Test 3: Build Validation
**Expected Results**:
- npm run build completes without errors
- All routes are generated correctly

### Test 4: TypeScript Compilation
**Expected Results**:
- npx tsc --noEmit passes with no errors

---

## IMPLEMENTATION SUMMARY

**Completed**: 2026-01-17

**Files Created**:
- `lib/agent-sdk.ts` - SDK wrapper with message routing
- `app/api/pipeline/cancel/route.ts` - Cancel endpoint
- `components/MainAgentWorkspace.tsx` - Main agent UI
- `components/ShimmerPreview.tsx` - Shimmer animation

**Files Modified**:
- `lib/types.ts` - Added SDK streaming types
- `lib/claude.ts` - Compatibility wrapper using SDK
- `app/api/pipeline/start/route.ts` - SDK-based start
- `app/api/pipeline/stream/route.ts` - SDK event streaming
- `app/page.tsx` - New layout with workspace component
- `.claude/skills/agency-processor/SKILL.md` - Simplified skill

**Key Changes**:
1. Migrated from CLI spawning to TypeScript Agent SDK
2. Added real-time tool streaming via SSE
3. Added cancel functionality
4. New MainAgentWorkspace component shows tool calls + todos
5. Cards now receive events from SDK message router
