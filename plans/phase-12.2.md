# Phase 12.2: Pre-Card Agent Streaming

**Spec Reference:** `specs/12.2-pre-card-agent-streaming.md`

**Goal:** Add agent activity streaming between search start and card display.

---

## IMPLEMENTATION STEPS

### Step 12.2.1: Update Types
**Why**: Add ActivityMessage and Activity interfaces to lib/types.ts.

**Actions**:
- Add ActivityMessage interface
- Add Activity interface to PipelineState
- Export types

**Verify**:
- [x] ActivityMessage interface defined
- [x] Activity interface with status, messages, agenciesFound, agenciesTarget
- [x] PipelineState includes activity field

**Status**: [✓] Complete

---

### Step 12.2.2: Update Pipeline Start Route
**Why**: Initialize activity in pipeline state.

**Actions**:
- Update `/app/api/pipeline/start/route.ts`
- Add activity object to initial pipeline state
- Set activity.status = 'active', agenciesTarget = count

**Verify**:
- [x] Pipeline state includes activity field
- [x] Activity properly initialized

**Status**: [✓] Complete

---

### Step 12.2.3: Update Orchestrator Prompt
**Why**: Main agent needs to report activity to pipeline file.

**Actions**:
- Update buildOrchestratorPrompt in start/route.ts
- Add activity reporting instructions
- Document message types and format

**Verify**:
- [x] Prompt includes activity reporting section
- [x] Example messages documented

**Status**: [✓] Complete

---

### Step 12.2.4: Create ActivityMessage Component
**Why**: Display individual activity message with icon.

**Actions**:
- Create `/components/ActivityMessage.tsx`
- Icon mapping for each type
- Main text + optional detail line
- Fade-in animation

**Verify**:
- [x] Component renders all message types
- [x] Icons display correctly
- [x] Animation works

**Status**: [✓] Complete

---

### Step 12.2.5: Create AgentActivityPanel Component
**Why**: Container for activity messages with collapse/expand.

**Actions**:
- Create `/components/AgentActivityPanel.tsx`
- Active/collapsed/expanded states
- Auto-scroll to bottom
- Progress counter
- Streaming indicator

**Verify**:
- [x] Panel shows messages
- [x] Collapse/expand works
- [x] Progress counter updates

**Status**: [✓] Complete

---

### Step 12.2.6: Update SSE Stream Route
**Why**: Detect and send activity events.

**Actions**:
- Update `/app/api/pipeline/stream/route.ts`
- Track last seen activity message count
- Send activity_message events
- Send activity_complete when done

**Verify**:
- [x] Activity messages streamed
- [x] activity_complete sent when search done

**Status**: [✓] Complete

---

### Step 12.2.7: Update Main Page
**Why**: Add activity panel to UI.

**Actions**:
- Update `/app/page.tsx`
- Add activity state (messages, found, target, panelStatus)
- Handle activity SSE events
- Render AgentActivityPanel between TodoPanel and cards
- Auto-collapse when search complete

**Verify**:
- [x] Activity panel appears during search
- [x] Messages stream in
- [x] Panel collapses when cards appear
- [x] Can expand collapsed panel

**Status**: [✓] Complete

---

### Step 12.2.8: Test Build
**Why**: Ensure no TypeScript errors.

**Actions**:
- Run `npm run build`
- Fix any errors

**Verify**:
- [x] Build succeeds

**Status**: [✓] Complete

---

## Phase Checkpoint

- [x] Activity panel appears when search starts
- [x] Messages stream in real-time
- [x] Icons match message types
- [x] Progress counter updates
- [x] Panel collapses when agencies found
- [x] Cards appear after collapse
- [x] Can expand collapsed panel
- [x] Build passes

**Status**: [✓] Complete

---

## Files Created

| File | Purpose |
|------|---------|
| `components/ActivityMessage.tsx` | Individual message display |
| `components/AgentActivityPanel.tsx` | Activity panel container |

## Files Modified

| File | Changes |
|------|---------|
| `lib/types.ts` | Add ActivityMessage, Activity types |
| `app/api/pipeline/start/route.ts` | Initialize activity, update prompt |
| `app/api/pipeline/stream/route.ts` | Stream activity events |
| `app/page.tsx` | Add activity panel to UI |
