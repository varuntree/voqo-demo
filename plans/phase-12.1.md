# Phase 12.1: Streaming UI, History, and Enhanced Agency Data

**Spec Reference:** `specs/12.1-streaming-history-enhancements.md`

**Goal:** Add card step streaming, search history tab, and enhanced agency metrics.

---

## IMPLEMENTATION STEPS

### Step 12.1.1: Create History Directory
**Why**: Store search history sessions.

**Actions**:
- Create `/data/history/` directory
- Create `sessions.json` with empty sessions array

**Verify**:
- [x] Directory exists
- [x] sessions.json exists

**Status**: [✓] Complete

---

### Step 12.1.2: Create Shared Types
**Why**: Define AgencyProgress, SearchSession, CardStep types.

**Actions**:
- Create `/lib/types.ts`
- Add AgencyProgress with new fields (soldCount, priceRange, forRentCount, steps)
- Add SearchSession, HistoryFile, CardStep types
- Export DEFAULT_STEPS

**Verify**:
- [x] Types defined correctly
- [x] Includes new fields

**Status**: [✓] Complete

---

### Step 12.1.3: Update Agency Processor Skill
**Why**: Add step reporting and enhanced data extraction.

**Actions**:
- Update `.claude/skills/agency-processor/SKILL.md`
- Add step reporting instructions
- Add enhanced data extraction (sold, price range, rentals)

**Verify**:
- [x] Step reporting documented
- [x] Enhanced extraction documented

**Status**: [✓] Complete

---

### Step 12.1.4: Create StepList Component
**Why**: Display step checklist on cards.

**Actions**:
- Create `/components/StepList.tsx`
- Show pending/in_progress/complete/error states
- Appropriate icons and colors

**Verify**:
- [x] Component renders all states

**Status**: [✓] Complete

---

### Step 12.1.5: Update AgencyCard Component
**Why**: Add steps display and enhanced metrics.

**Actions**:
- Update `/components/AgencyCard.tsx`
- Import from lib/types
- Add StepList rendering
- Show enhanced metrics (price range, sold, rentals)

**Verify**:
- [x] Steps display in all states
- [x] Enhanced metrics show when available

**Status**: [✓] Complete

---

### Step 12.1.6: Create TabNavigation Component
**Why**: Switch between Search and History tabs.

**Actions**:
- Create `/components/TabNavigation.tsx`
- Two tabs: New Search, History
- Active state styling

**Verify**:
- [x] Component created
- [x] Tab switching works

**Status**: [✓] Complete

---

### Step 12.1.7: Create HistoryCard Component
**Why**: Display individual history entry.

**Actions**:
- Create `/components/HistoryCard.tsx`
- Show session name (editable)
- Show stats and agency chips
- Click chip to view demo

**Verify**:
- [x] Component renders correctly
- [x] Rename functionality

**Status**: [✓] Complete

---

### Step 12.1.8: Create HistoryList Component
**Why**: Display list of history sessions.

**Actions**:
- Create `/components/HistoryList.tsx`
- Map sessions to HistoryCard
- Empty state when no sessions
- Loading state

**Verify**:
- [x] List renders
- [x] Empty state works

**Status**: [✓] Complete

---

### Step 12.1.9: Create History API Endpoints
**Why**: Fetch and update history.

**Actions**:
- Create `/app/api/history/route.ts` (GET)
- Create `/app/api/history/[sessionId]/route.ts` (PATCH for rename)

**Verify**:
- [x] GET returns sessions
- [x] PATCH renames session

**Status**: [✓] Complete

---

### Step 12.1.10: Create History Helper
**Why**: Build and save sessions from pipeline.

**Actions**:
- Create `/lib/history.ts`
- addToHistory, buildSessionFromPipeline, formatSessionName
- Max 50 sessions cleanup

**Verify**:
- [x] Helper functions work

**Status**: [✓] Complete

---

### Step 12.1.11: Update Pipeline Stream
**Why**: Save history when pipeline completes.

**Actions**:
- Update `/app/api/pipeline/stream/route.ts`
- Import from lib/types and lib/history
- Call saveToHistory on completion

**Verify**:
- [x] History saved on complete

**Status**: [✓] Complete

---

### Step 12.1.12: Update Main Page
**Why**: Add tab navigation and history.

**Actions**:
- Update `/app/page.tsx`
- Add TabNavigation
- Add history state and loading
- Render HistoryList on history tab
- Handle agency clicks and renames

**Verify**:
- [x] Tabs switch correctly
- [x] History loads and displays

**Status**: [✓] Complete

---

### Step 12.1.13: Test Build
**Why**: Ensure no TypeScript errors.

**Actions**:
- Run `npm run build`
- Fix any errors

**Verify**:
- [x] Build succeeds

**Status**: [✓] Complete

---

## Phase Checkpoint

- [x] Card steps display in real-time
- [x] Enhanced metrics show when available
- [x] Tab navigation works
- [x] History loads past sessions
- [x] History cards show agency chips
- [x] Session rename works
- [x] Build passes

**Status**: [✓] Complete

---

## Files Created

| File | Purpose |
|------|---------|
| `lib/types.ts` | Shared TypeScript types |
| `lib/history.ts` | History helper functions |
| `components/StepList.tsx` | Step checklist component |
| `components/TabNavigation.tsx` | Tab navigation component |
| `components/HistoryCard.tsx` | History card component |
| `components/HistoryList.tsx` | History list component |
| `app/api/history/route.ts` | GET history API |
| `app/api/history/[sessionId]/route.ts` | PATCH rename API |
| `data/history/sessions.json` | History storage |

## Files Modified

| File | Changes |
|------|---------|
| `.claude/skills/agency-processor/SKILL.md` | Step reporting + enhanced extraction |
| `components/AgencyCard.tsx` | Steps + enhanced metrics display |
| `app/api/pipeline/stream/route.ts` | Save history on complete |
| `app/page.tsx` | Tab navigation + history tab |
