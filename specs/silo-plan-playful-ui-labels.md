# Implementation Plan: Playful UI Labels for Tools & Workspaces

## What & Why
Replace technical Claude SDK tool names (Read, Write, Task, etc.) with playful, intuitive labels in the UI. Users see "Hunting..." instead of "Using WebSearch", making the agent activity feel more engaging and human-friendly. No backend logic changes - purely display text transformations.

## Key Decision
Create a centralized mapping object in a single file that translates tool names → playful verbs, used by both `lib/claude.ts` and `app/api/pipeline/start/route.ts`.

## Scope

### In Scope
- Rename "Engine Workspace" → "Control Room"
- Rename "Subagent stream" → "Worker Bee stream"
- Rename "Main agent" source label → "Captain"
- Map tool names to playful verbs in activity messages:
  - WebSearch → "Hunting"
  - WebFetch → "Snooping"
  - Read → "Peeking"
  - Write → "Scribbling"
  - Edit → "Tinkering"
  - Task → "Delegating"
  - Glob → "Scanning"
  - Grep → "Digging"
  - Bash → "Executing"
  - Skill → "Activating"

### Out of Scope
- Changing actual tool functionality
- Modifying search/pipeline logic
- Backend API changes
- Type definitions (ActivityMessage types stay the same)

## Current State

| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `components/MainAgentWorkspace.tsx` | 121 | "Engine Workspace" header | Modify |
| `components/AgencyCard.tsx` | 325 | "Subagent stream" label | Modify |
| `lib/claude.ts` | 70, 146-174 | "Main agent" label + tool message mapping | Modify |
| `app/api/pipeline/start/route.ts` | 72 | "Main agent" source in appendMainActivityMessage | Modify |

### Key Dependencies
- `components/ActivityMessage.tsx` renders `message.source` - no change needed (just displays whatever string is passed)
- `lib/types.ts` defines `ActivityMessage.source` as `string` - no change needed

## Target State

Activity messages will show:
- Source label: `CAPTAIN` instead of `MAIN AGENT`
- Tool messages: `Hunting: real estate agencies surry hills` instead of `Searching: real estate agencies surry hills`
- Workspace header: "Control Room" with same styling
- Subagent header: "Worker Bee stream"

### Pattern to Follow
- See `lib/claude.ts:146-174` for existing `mapToolMessage()` pattern - we'll add verb lookup
- See `components/MainAgentWorkspace.tsx:121` for header text pattern

## Gotchas

- **Two places define tool mapping**: Both `lib/claude.ts` and `app/api/pipeline/start/route.ts` have `formatToolDetail()` - need to update message text in both
- **Source label used in multiple places**: "Main agent" appears as default in both files - must update both
- **Case sensitivity**: Source labels display as uppercase via CSS (`uppercase tracking-wide`) - no need to uppercase in code

---

## IMPLEMENTATION STEPS

### Step 1: Create Playful Labels Mapping
**Why**: Centralize all label mappings in one place for consistency and easy future changes.

**Files**:
- `lib/playful-labels.ts` (NEW): Create new file with mapping constants

**Actions**:
- Create `lib/playful-labels.ts` with:
```typescript
// Playful UI labels for tool names and sources
export const TOOL_VERBS: Record<string, string> = {
  WebSearch: 'Hunting',
  WebFetch: 'Snooping',
  Read: 'Peeking',
  Write: 'Scribbling',
  Edit: 'Tinkering',
  Task: 'Delegating',
  Glob: 'Scanning',
  Grep: 'Digging',
  Bash: 'Executing',
  Skill: 'Activating',
};

export const SOURCE_LABELS = {
  mainAgent: 'Captain',
  system: 'System',
} as const;

export const WORKSPACE_LABELS = {
  main: 'Control Room',
  subagent: 'Worker Bee stream',
} as const;

export function getToolVerb(toolName: string): string {
  return TOOL_VERBS[toolName] || toolName;
}
```

**Verify**:
- [ ] File created at `lib/playful-labels.ts`
- [ ] TypeScript compiles without errors

---

### Step 2: Update lib/claude.ts Tool Messages
**Why**: Main agent activity uses this file's `mapToolMessage()` function.

**Files**:
- `lib/claude.ts` (lines 146-174): Update `mapToolMessage()` to use playful verbs

**Actions**:
- Import `getToolVerb` and `SOURCE_LABELS` from `lib/playful-labels.ts`
- In `mapToolMessage()`:
  - Change line 151 from `text: \`Using ${toolName}\`` to `text: \`${getToolVerb(toolName)}...\``
  - Change line 161 from `Searching: ${detail}` to `${getToolVerb('WebSearch')}: ${detail}`
  - Change line 169 from `Fetching: ${detail}` to `${getToolVerb('WebFetch')}: ${detail}`
- Update `buildBaseOptions()` line 70: Change `activitySourceLabel ?? 'Main agent'` to `activitySourceLabel ?? SOURCE_LABELS.mainAgent`

**Verify**:
- [ ] `mapToolMessage('WebSearch', {query: 'test'}, 'Captain')` returns text containing "Hunting"
- [ ] Default source label is "Captain"

---

### Step 3: Update pipeline/start/route.ts Tool Messages
**Why**: Pipeline orchestrator has its own message building that needs same playful verbs.

**Files**:
- `app/api/pipeline/start/route.ts` (lines 60-89): Update `appendMainActivityMessage` default source

**Actions**:
- Import `SOURCE_LABELS` from `@/lib/playful-labels`
- Line 72: Change `source: message.source ?? 'Main agent'` to `source: message.source ?? SOURCE_LABELS.mainAgent`

**Verify**:
- [ ] Pipeline activity messages show "CAPTAIN" as source label

---

### Step 4: Update MainAgentWorkspace Header
**Why**: "Engine Workspace" is the main header users see.

**Files**:
- `components/MainAgentWorkspace.tsx` (line 121): Update header text

**Actions**:
- Import `WORKSPACE_LABELS` from `@/lib/playful-labels`
- Line 121: Change `Engine Workspace` to `{WORKSPACE_LABELS.main}` (resolves to "Control Room")

**Verify**:
- [ ] Workspace header displays "Control Room"

---

### Step 5: Update AgencyCard Subagent Label
**Why**: Subagent activity section shows "Subagent stream" header.

**Files**:
- `components/AgencyCard.tsx` (line 325): Update subagent label

**Actions**:
- Import `WORKSPACE_LABELS` from `@/lib/playful-labels`
- Line 325: Change `Subagent stream` to `{WORKSPACE_LABELS.subagent}` (resolves to "Worker Bee stream")

**Verify**:
- [ ] Expanded agency card shows "Worker Bee stream" label

---

### Step 6: Final Validation
**Why**: Ensure nothing is broken

**Actions**:
- Run `npm run build`
- Start dev server `npm run dev`
- Trigger a pipeline search and observe activity messages

**Verify**:
- [ ] Build succeeds
- [ ] Zero TypeScript errors
- [ ] Activity messages show playful verbs (Hunting, Snooping, etc.)
- [ ] Source labels show "CAPTAIN"
- [ ] Headers show "Control Room" and "Worker Bee stream"

---

## VALIDATION

1. Start a new search → Activity stream shows "CAPTAIN" as source label and "Hunting: {query}" for searches
2. Observe agency card expanded → Shows "Worker Bee stream" instead of "Subagent stream"
3. Workspace header → Displays "Control Room" instead of "Engine Workspace"
4. WebFetch activity → Shows "Snooping: {url}" instead of "Fetching: {url}"
5. Generic tool use → Shows "Peeking..." / "Scribbling..." / etc. instead of "Using Read" / "Using Write"

---

## E2E TESTING INSTRUCTIONS

### Test 1: Playful Labels Module Exists
**Preconditions**:
- Fresh checkout or after implementation

**Steps**:
1. Open terminal in project root
2. Run `cat lib/playful-labels.ts`
3. Run `npx tsc --noEmit`

**Expected Results**:
- [ ] File exists at `lib/playful-labels.ts`
- [ ] Contains `TOOL_VERBS` with all 10 mappings (WebSearch→Hunting, WebFetch→Snooping, Read→Peeking, Write→Scribbling, Edit→Tinkering, Task→Delegating, Glob→Scanning, Grep→Digging, Bash→Executing, Skill→Activating)
- [ ] Contains `SOURCE_LABELS.mainAgent = 'Captain'`
- [ ] Contains `WORKSPACE_LABELS.main = 'Control Room'`
- [ ] Contains `WORKSPACE_LABELS.subagent = 'Worker Bee stream'`
- [ ] TypeScript compiles with zero errors

---

### Test 2: Control Room Header Display
**Preconditions**:
- Dev server running (`npm run dev`)
- Browser at localhost:3000

**Steps**:
1. Navigate to main page
2. Locate the main workspace/activity panel header

**Expected Results**:
- [ ] Header text displays "Control Room" (NOT "Engine Workspace")
- [ ] Styling unchanged (same font size, color, spacing)

---

### Test 3: Worker Bee Stream Label
**Preconditions**:
- Dev server running
- At least one agency in search results

**Steps**:
1. Run a suburb search (e.g., "Surry Hills")
2. Wait for agencies to appear
3. Click on an agency card to expand it
4. Locate the subagent activity section

**Expected Results**:
- [ ] Subagent header displays "Worker Bee stream" (NOT "Subagent stream")
- [ ] Label appears in the expanded agency card section
- [ ] Styling unchanged

---

### Test 4: Captain Source Label in Activity Stream
**Preconditions**:
- Dev server running
- Activity stream visible

**Steps**:
1. Clear any existing activity (refresh page)
2. Trigger a new pipeline search
3. Observe activity messages as they appear

**Expected Results**:
- [ ] Source label badge shows "CAPTAIN" (uppercase via CSS)
- [ ] NOT "MAIN AGENT"
- [ ] All main agent messages use Captain label

---

### Test 5: Hunting Tool Verb (WebSearch)
**Preconditions**:
- Dev server running

**Steps**:
1. Start a new search (e.g., "Bondi")
2. Watch activity stream for WebSearch tool use

**Expected Results**:
- [ ] Activity shows "Hunting: <query>" format
- [ ] NOT "Searching: <query>"
- [ ] Query text still displays correctly after colon

---

### Test 6: Snooping Tool Verb (WebFetch)
**Preconditions**:
- Dev server running
- Pipeline triggers WebFetch (happens when loading agency URLs)

**Steps**:
1. Start search that finds agencies with websites
2. Watch activity as URLs are fetched

**Expected Results**:
- [ ] Activity shows "Snooping: <url>" format
- [ ] NOT "Fetching: <url>"
- [ ] URL truncation still works if implemented

---

### Test 7: Generic Tool Verbs (Read/Write/Edit/etc.)
**Preconditions**:
- Dev server running
- Pipeline uses file operations

**Steps**:
1. Run full search pipeline
2. Watch for Read/Write/Edit tool usage in activity

**Expected Results**:
- [ ] Read tool shows "Peeking..." (NOT "Using Read")
- [ ] Write tool shows "Scribbling..." (NOT "Using Write")
- [ ] Edit tool shows "Tinkering..." (NOT "Using Edit")
- [ ] Glob tool shows "Scanning..." (NOT "Using Glob")
- [ ] Grep tool shows "Digging..." (NOT "Using Grep")
- [ ] Bash tool shows "Executing..." (NOT "Using Bash")

---

### Test 8: Task/Skill Tool Verbs
**Preconditions**:
- Dev server running
- Pipeline triggers Task or Skill tools

**Steps**:
1. Run pipeline that spawns subagents or uses skills
2. Watch activity stream

**Expected Results**:
- [ ] Task tool shows "Delegating..." (NOT "Using Task")
- [ ] Skill tool shows "Activating..." (NOT "Using Skill")

---

### Test 9: Fallback for Unknown Tools
**Preconditions**:
- Dev server running
- Some tool not in mapping gets used

**Steps**:
1. If possible, trigger a tool not in TOOL_VERBS mapping
2. Observe activity message

**Expected Results**:
- [ ] Unknown tool shows original name (graceful fallback)
- [ ] No crash or error
- [ ] Message format still valid

---

### Test 10: Empty Activity State
**Preconditions**:
- Dev server running
- Fresh page load with no activity

**Steps**:
1. Refresh page
2. Observe workspace before any search

**Expected Results**:
- [ ] "Control Room" header still visible
- [ ] Empty state message (if any) unchanged
- [ ] No layout shift or broken styling

---

### Test 11: Error State Handling
**Preconditions**:
- Dev server running
- Simulated error condition (e.g., network offline)

**Steps**:
1. Disconnect network or cause API error
2. Trigger search
3. Observe error messages in activity

**Expected Results**:
- [ ] Error messages still display correctly
- [ ] Source label "CAPTAIN" or "SYSTEM" as appropriate
- [ ] No crash due to missing label

---

### Test 12: Multiple Agency Cards Expanded
**Preconditions**:
- Dev server running
- Multiple agencies in results

**Steps**:
1. Run search with multiple results
2. Expand 2+ agency cards simultaneously
3. Observe subagent labels on each

**Expected Results**:
- [ ] All expanded cards show "Worker Bee stream"
- [ ] Labels independent per card
- [ ] Collapsing/expanding doesn't break label

---

### Test 13: Full Flow Integration
**Preconditions**:
- Dev server running
- Clean state (no prior searches)

**Steps**:
1. Load page fresh
2. Verify "Control Room" header
3. Enter suburb "Surry Hills" and search
4. Watch activity stream - verify "CAPTAIN" labels
5. Verify "Hunting: real estate agencies surry hills" appears
6. Wait for agencies to load
7. Expand first agency card
8. Verify "Worker Bee stream" label
9. Watch subagent activity messages
10. Collapse card, expand another
11. Verify consistent labeling

**Expected Results**:
- [ ] All playful labels appear throughout full flow
- [ ] No technical names leak through (Main agent, Engine Workspace, Subagent stream, Searching, Fetching, Using X)
- [ ] Activity messages still functional and readable
- [ ] Pipeline completes successfully

---

### Test 14: Build Verification
**Preconditions**:
- All changes committed

**Steps**:
1. Run `npm run build`
2. Check for errors/warnings

**Expected Results**:
- [ ] Build succeeds with exit code 0
- [ ] No TypeScript errors
- [ ] No warnings about unused imports or variables
- [ ] Production bundle created

---

### Test 15: Mobile Responsiveness
**Preconditions**:
- Dev server running
- Chrome DevTools open

**Steps**:
1. Open DevTools → Toggle device toolbar
2. Select mobile viewport (iPhone 12 or similar)
3. Run through Test 13 flow on mobile

**Expected Results**:
- [ ] "Control Room" header fits mobile width
- [ ] "Worker Bee stream" doesn't overflow card
- [ ] Activity messages readable on mobile
- [ ] No horizontal scroll caused by new labels
