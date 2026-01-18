# Implementation Plan: Mobile Responsive Fixes for /product Page

## What & Why
All components on the /product page need mobile optimization. Currently, modals overflow on small screens, header buttons overlap, the workspace grid doesn't stack properly, and agency chips in history cards get cramped. This fixes all responsive issues across both `sm` (640px) and `md` (768px) breakpoints without changing design or functionality.

## Key Decision
Add responsive Tailwind classes to existing components - no structural changes, no new components, no design changes.

## Scope

### In Scope
- SettingsModal: width, padding, footer buttons
- CallDetailModal: width, 2-column grid, header
- MainAgentWorkspace: header buttons, grid columns
- AgencyCard: MiniTodos grid
- HistoryCard: agency chips, header
- TabNavigation: button sizing
- Product page header: button/link spacing

### Out of Scope
- Desktop layout changes
- New features
- Design changes (colors, fonts, spacing philosophy)
- Other pages (/, /demo/*, /call/*, /history/*)

## Current State

| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `components/SettingsModal.tsx` | 106-208 | Settings modal | Modify |
| `components/CallDetailModal.tsx` | 167-282 | Call detail modal | Modify |
| `components/MainAgentWorkspace.tsx` | 117-220 | Main workspace panel | Modify |
| `components/AgencyCard.tsx` | 72-77 | MiniTodos 2-col grid | Modify |
| `components/HistoryCard.tsx` | 65-158 | History card | Modify |
| `components/TabNavigation.tsx` | 9-39 | Tab buttons | Modify |
| `app/product/page.tsx` | 584-626 | Header section | Modify |

### Key Dependencies
- All components are imported in `app/product/page.tsx`
- No cross-component dependencies for responsive changes

## Target State

All components render properly on mobile (320px+), tablet (640px+), and desktop (1024px+). Buttons don't overlap. Modals fit viewport. Grids stack on mobile. Text truncates appropriately.

### Pattern to Follow
- See `components/HistoryCard.tsx:103` for `flex flex-col sm:flex-row` pattern
- See `components/CallDetailModal.tsx:215` for `grid-cols-1 lg:grid-cols-*` pattern
- See `app/product/page.tsx:643` for `flex flex-col sm:flex-row` pattern

## Gotchas

- **Modal padding**: `p-4` on outer container is critical for mobile safe area - don't remove
- **max-h-[90vh]**: Keep this on modals to prevent overflow on short screens
- **min-w-0**: Required on flex children with `truncate` to enable text truncation
- **flex-shrink-0**: Needed on button groups to prevent squishing

---

## IMPLEMENTATION STEPS

### Step 1: Fix SettingsModal mobile layout
**Why**: Footer buttons overlap on mobile, modal too wide on small screens

**Files**:
- `components/SettingsModal.tsx` (lines 106, 183-208)

**Actions**:
- Line 106: Change `max-w-3xl` to `max-w-3xl sm:max-w-3xl` (no change needed, already good) - but add responsive padding
- Line 183: Change footer from `flex items-center justify-between gap-3` to `flex flex-col sm:flex-row items-center justify-between gap-3`
- Line 192: Change button container from `flex items-center gap-3` to `flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end`
- Line 184-190: Make Reset button full-width on mobile with `w-full sm:w-auto`
- Line 108: Add `flex-wrap` to header to handle long titles

**Verify**:
- [ ] Footer buttons stack vertically on mobile, horizontal on tablet+
- [ ] Modal doesn't overflow horizontally on 320px screen
- [ ] All buttons remain clickable

---

### Step 2: Fix CallDetailModal mobile layout
**Why**: 2-column grid doesn't stack, header buttons overlap on mobile

**Files**:
- `components/CallDetailModal.tsx` (lines 176, 177-208, 215)

**Actions**:
- Line 176: Keep `max-w-5xl`, add `max-h-[90vh]` for mobile scroll
- Line 177-208: Header section - change to `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4`
- Line 191: Button container - add `w-full sm:w-auto justify-end` and `flex-wrap`
- Line 215: Grid already has `grid-cols-1 lg:grid-cols-5` - this is correct
- Line 229, 271: Change `max-h-[50vh]` to `max-h-[40vh] sm:max-h-[50vh]` for mobile

**Verify**:
- [ ] Header stacks on mobile (title/status on top, buttons below)
- [ ] Transcript and activity sections stack vertically on mobile
- [ ] Modal scrollable on small screens

---

### Step 3: Fix MainAgentWorkspace header for mobile
**Why**: Header buttons (Calls, Collapse, Cancel) overlap with title/status on mobile

**Files**:
- `components/MainAgentWorkspace.tsx` (lines 119-165)

**Actions**:
- Line 119: Change header to `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4`
- Line 121-128: Title section stays as-is
- Line 121: Change inner flex to `flex flex-wrap items-center gap-2 sm:gap-3`
- Line 134-164: Button section - add `w-full sm:w-auto justify-end` and `flex-wrap`

**Verify**:
- [ ] Header title and buttons stack on mobile
- [ ] Buttons wrap nicely on narrow screens
- [ ] Cancel button remains visible and clickable

---

### Step 4: Fix AgencyCard MiniTodos for mobile
**Why**: 2-column grid can be cramped on very small cards

**Files**:
- `components/AgencyCard.tsx` (lines 72-77)

**Actions**:
- Line 73: Change `grid grid-cols-2 gap-2` to `grid grid-cols-1 sm:grid-cols-2 gap-2`

**Verify**:
- [ ] MiniTodos stack on very narrow screens
- [ ] Still 2-column on tablet+

---

### Step 5: Fix HistoryCard agency chips and header
**Why**: Agency chips with logos can get cramped, header with edit button can overlap

**Files**:
- `components/HistoryCard.tsx` (lines 68, 116, 146)

**Actions**:
- Line 68: Header - already has `flex items-start justify-between gap-3` - add `flex-wrap`
- Line 116: Chips container - already has `flex flex-wrap gap-2` - good
- Line 146: Change chip text max-width from `max-w-[80px]` to `max-w-[60px] sm:max-w-[80px]`

**Verify**:
- [ ] Agency chips don't overflow card
- [ ] Edit button doesn't overlap session name

---

### Step 6: Fix TabNavigation for mobile
**Why**: Tab buttons can be cramped on narrow screens

**Files**:
- `components/TabNavigation.tsx` (lines 10-37)

**Actions**:
- Line 10: Change outer container to add responsive padding: `p-1 sm:p-1.5`
- Lines 14, 27: Change button padding from `px-5 py-2` to `px-3 py-1.5 sm:px-5 sm:py-2`
- Add `text-[10px] sm:text-xs` for smaller text on mobile

**Verify**:
- [ ] Tabs fit on 320px screen
- [ ] Still looks good on desktop

---

### Step 7: Fix Product page header for mobile
**Why**: Settings icon and "New Search" button can overlap with logo/tabs

**Files**:
- `app/product/page.tsx` (lines 584-627)

**Actions**:
- Line 585: Change header padding to `px-3 sm:px-4 py-3 sm:py-4`
- Line 586: Change `flex items-center justify-between` to `flex flex-wrap items-center justify-between gap-2 sm:gap-4`
- Line 592-625: Right section - add `flex-shrink-0`

**Verify**:
- [ ] Header elements don't overlap on narrow screens
- [ ] Settings icon remains accessible
- [ ] "New Search" button visible when active

---

### Step 8: Fix CallsPanel card layout for mobile
**Why**: Call list items may need tighter spacing on mobile

**Files**:
- `components/CallsPanel.tsx` (lines 78-111)

**Actions**:
- Line 82: Change `px-3 py-2.5` to `px-2.5 py-2 sm:px-3 sm:py-2.5`
- Line 88: Ensure `gap-2` handles wrapping properly

**Verify**:
- [ ] Call list items fit without horizontal scroll
- [ ] Status pill doesn't overlap agency name

---

### Step 9: Run build validation
**Why**: Ensure no TypeScript errors from changes

**Actions**:
- Run `npm run build`
- Fix any errors

**Verify**:
- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] No runtime console errors

---

## VALIDATION

1. Open /product on 320px viewport → All components visible, no horizontal scroll, buttons don't overlap
2. Open Settings modal on mobile → Footer buttons stack, modal fits viewport
3. Run a search and check MainAgentWorkspace → Header stacks, Cancel button accessible
4. Check History tab on mobile → History cards readable, agency chips don't overflow
5. Open CallDetailModal from Calls panel → Header stacks, transcript scrollable

---

## E2E TESTING INSTRUCTIONS

### Test 1: SettingsModal Mobile Responsiveness
**Preconditions**:
- Open /product in browser
- Set viewport to 375px wide (iPhone SE)

**Steps**:
1. Click settings gear icon in header
2. Observe modal layout
3. Scroll down to footer buttons
4. Try to click "Reset to Defaults" button
5. Try to click "Cancel" and "Save" buttons

**Expected Results**:
- [ ] Modal fits within viewport with no horizontal scroll
- [ ] Footer buttons stack vertically (Reset on top, Cancel/Save below)
- [ ] All buttons are clickable without overlap
- [ ] Available Variables chips wrap properly
- [ ] Textareas are full-width and usable

---

### Test 2: CallDetailModal Mobile Responsiveness
**Preconditions**:
- Have at least one call in the system
- Open /product, click "Calls" to open panel
- Set viewport to 375px wide

**Steps**:
1. Click on a call in the Calls panel
2. Observe modal header layout
3. Check transcript section
4. Check post-call generation section
5. Try scrolling within sections

**Expected Results**:
- [ ] Modal header shows agency name, status, then buttons below (stacked)
- [ ] Transcript and activity sections stack vertically
- [ ] Both sections have working scroll
- [ ] "Open Page" and "Close" buttons don't overlap
- [ ] Transcript bubbles fit within viewport

---

### Test 3: MainAgentWorkspace Mobile Layout
**Preconditions**:
- Open /product
- Set viewport to 375px wide

**Steps**:
1. Enter "Surry Hills" in search and click Search
2. Observe workspace header during search
3. Check that "Calls", "Collapse", "Cancel" buttons are visible
4. Check the 3-column grid (Activity, Tasks, Calls when open)

**Expected Results**:
- [ ] Header elements stack: title/status on top row, buttons below
- [ ] Buttons wrap if needed, remain clickable
- [ ] Cancel button is not cut off
- [ ] Grid sections stack vertically on mobile
- [ ] Activity stream is scrollable

---

### Test 4: AgencyCard MiniTodos Mobile Layout
**Preconditions**:
- Run a search to generate agency cards
- Set viewport to 320px wide

**Steps**:
1. Observe an agency card while processing
2. Check the MiniTodos section (Extract info / Generate page)
3. Resize to 640px and observe again

**Expected Results**:
- [ ] On 320px: MiniTodos stack vertically (1 column)
- [ ] On 640px+: MiniTodos show side-by-side (2 columns)
- [ ] Icons and labels are readable in both layouts

---

### Test 5: HistoryCard Mobile Layout
**Preconditions**:
- Have search history with multiple sessions
- Open /product, click History tab
- Set viewport to 375px wide

**Steps**:
1. Observe history cards
2. Check agency chip area
3. Try clicking edit (pencil) icon on session name
4. Check "View run →" link position

**Expected Results**:
- [ ] Session name doesn't overlap with status badge
- [ ] Edit icon is accessible and clickable
- [ ] Agency chips wrap properly, logos visible
- [ ] Chip text truncates at appropriate width
- [ ] Stats and "View run" link stack on mobile

---

### Test 6: TabNavigation Mobile Layout
**Preconditions**:
- Open /product
- Set viewport to 320px wide

**Steps**:
1. Observe the "New Search" and "History" tabs in header
2. Click between tabs
3. Resize to 768px and observe

**Expected Results**:
- [ ] Both tabs fit within header on 320px screen
- [ ] Tab text is readable (smaller on mobile)
- [ ] Active state styling works correctly
- [ ] Tabs don't push other header elements off screen

---

### Test 7: Product Page Header Mobile Layout
**Preconditions**:
- Open /product
- Set viewport to 320px wide
- Run a search so "New Search" link appears

**Steps**:
1. Observe header layout
2. Check logo, tabs, settings icon positions
3. Check "New Search" link visibility
4. Resize through breakpoints (320px → 768px → 1024px)

**Expected Results**:
- [ ] Logo and tabs on left don't overlap with settings icon on right
- [ ] Header wraps appropriately on very narrow screens
- [ ] Settings icon remains clickable
- [ ] "New Search" link visible and doesn't overlap

---

### Test 8: CallsPanel Mobile Layout
**Preconditions**:
- Have at least 2-3 calls in the system
- Open /product, enable Calls panel
- Set viewport to 375px wide

**Steps**:
1. Observe call list items
2. Check agency name and status pill positions
3. Check timestamp and duration text
4. Check summary text truncation

**Expected Results**:
- [ ] Call items don't overflow horizontally
- [ ] Status pill doesn't overlap agency name
- [ ] Timestamp readable
- [ ] "Open page" text visible when applicable
- [ ] Summary truncates properly (line-clamp works)

---

### Test 9: Full Flow Integration on Mobile
**Preconditions**:
- Fresh browser session
- Set viewport to 375px wide

**Steps**:
1. Navigate to /product
2. Enter "Bondi" and search for 3 agencies
3. Wait for pipeline to complete
4. Click Settings icon, verify modal, close it
5. Click on a completed agency card's "Open Demo" button
6. Go back to /product
7. Click History tab
8. Click "View run →" on a history card
9. Go back to /product, open Calls panel if calls exist

**Expected Results**:
- [ ] Entire flow works without horizontal scrolling
- [ ] All modals usable on mobile
- [ ] All buttons/links clickable
- [ ] Text readable throughout
- [ ] No visual overlaps or cut-off elements
