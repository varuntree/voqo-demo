# Phase 12: Parallel Agency Pipeline with Real-Time Streaming UI

**Spec Reference:** `specs/12-parallel-agency-pipeline.md`

**Goal:** Implement parallel agency processing with real-time SSE streaming to show progress in the UI.

---

## IMPLEMENTATION STEPS

### Step 12.1: Create Progress Directory
**Why**: Pipeline needs a place to store progress files for SSE streaming.

**Actions**:
- Create `/data/progress/` directory

**Verify**:
- [x] Directory exists

**Status**: [✓] Complete

---

### Step 12.2: Create Agency Processor Skill
**Why**: Combined skill that replaces agency-researcher + demo-page-builder with progress updates.

**Actions**:
- Create `.claude/skills/agency-processor/SKILL.md`
- Include progress file update instructions
- Include demo page generation

**Verify**:
- [x] Skill file exists
- [x] Has progress update instructions
- [x] Has demo generation instructions

**Status**: [✓] Complete

---

### Step 12.3: Create Pipeline Start Endpoint
**Why**: API endpoint to initiate the pipeline and return sessionId.

**Actions**:
- Create `/app/api/pipeline/start/route.ts`
- Generate unique sessionId
- Create initial pipeline state file
- Invoke Claude Code orchestrator async

**Verify**:
- [x] Endpoint created
- [x] Returns sessionId
- [x] Creates pipeline state file

**Status**: [✓] Complete

---

### Step 12.4: Create Pipeline Stream SSE Endpoint
**Why**: SSE endpoint to stream progress updates to frontend.

**Actions**:
- Create `/app/api/pipeline/stream/route.ts`
- Poll progress files every 500ms
- Push todo_update, card_update, pipeline_complete events
- Include heartbeat every 15s

**Verify**:
- [x] Endpoint created
- [x] Returns SSE stream
- [x] Polls progress files

**Status**: [✓] Complete

---

### Step 12.5: Create Progress Cleanup Utility
**Why**: Clean up stale progress files older than 24 hours.

**Actions**:
- Create `/lib/progress-cleanup.ts`
- Implement lazy cleanup on file read
- Utility functions for read/write/delete

**Verify**:
- [x] File created
- [x] Has cleanup functions

**Status**: [✓] Complete

---

### Step 12.6: Create TodoPanel Component
**Why**: UI component to display agent task progress.

**Actions**:
- Create `/components/TodoPanel.tsx`
- Show pending/in_progress/complete states
- Collapsible design
- Pipeline status badge

**Verify**:
- [x] Component created
- [x] Shows all todo states

**Status**: [✓] Complete

---

### Step 12.7: Create AgencyCard Component
**Why**: UI component to display agency progress with animations.

**Actions**:
- Create `/components/AgencyCard.tsx`
- Skeleton, extracting, generating, complete states
- Progressive data reveal
- Brand color border

**Verify**:
- [x] Component created
- [x] All states render correctly

**Status**: [✓] Complete

---

### Step 12.8: Create MockPreview Component
**Why**: Visual preview during page generation.

**Actions**:
- Create `/components/MockPreview.tsx`
- Progressive section reveal based on htmlProgress
- Use agency primaryColor

**Verify**:
- [x] Component created
- [x] Progress-based reveal works

**Status**: [✓] Complete

---

### Step 12.9: Update Main Page
**Why**: New search UI with slider and streaming integration.

**Actions**:
- Update `/app/page.tsx`
- Add agency count slider (1-25)
- Add SSE connection hook
- Render TodoPanel and AgencyCard grid
- Show completion stats

**Verify**:
- [x] Slider works
- [x] SSE connects
- [x] Cards render progressively

**Status**: [✓] Complete

---

### Step 12.10: Test Build
**Why**: Ensure no TypeScript errors.

**Actions**:
- Run `npm run build`
- Fix any errors

**Verify**:
- [x] Build succeeds without errors

**Status**: [✓] Complete

---

## Phase Checkpoint

- [x] Pipeline starts and creates progress files
- [x] SSE endpoint streams events
- [x] Frontend connects and receives updates
- [x] TodoPanel shows task progress
- [x] AgencyCard shows progressive data
- [x] Build passes

**Status**: [✓] Complete

---

## Files Created

| File | Purpose |
|------|---------|
| `.claude/skills/agency-processor/SKILL.md` | Combined extraction + generation skill |
| `app/api/pipeline/start/route.ts` | Pipeline start endpoint |
| `app/api/pipeline/stream/route.ts` | SSE streaming endpoint |
| `lib/progress-cleanup.ts` | Progress file cleanup utility |
| `components/TodoPanel.tsx` | Todo panel component |
| `components/AgencyCard.tsx` | Agency card component |
| `components/MockPreview.tsx` | Mock preview component |

## Files Modified

| File | Changes |
|------|---------|
| `app/page.tsx` | New streaming UI with slider |

## Notes

- Old skills (agency-researcher, demo-page-builder) NOT deleted - they may still be used by other flows
- Pipeline uses `invokeClaudeCodeAsync` for non-blocking execution
- SSE polls files every 500ms with 15s heartbeat
- Progress files auto-cleanup after 24 hours
