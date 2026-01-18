# Implementation Plan: Empty State Onboarding Content

## What & Why
Add informative onboarding content to the /product page when idle (before search). Currently shows only a heading, search bar, and slider - too empty. New content explains how the tool works (3 steps), shows example discoveries, and provides a subtle search hint. Content fades out when search starts and reappears on reset.

## Key Decision
Add content inline below the search form in the existing hero section. Use a single `showOnboarding` derived boolean (`pipelineStatus === 'idle'`) to control visibility with CSS fade transition.

## Scope

### In Scope
- 3-step "How it works" section below search form
- Example metrics/discoveries preview (sample agency card-like elements)
- Subtle hint text suggesting a suburb to try
- Fade-out animation when search starts
- Fade-in animation when user clicks "New Search"

### Out of Scope
- Complex animations (collapse, parallax)
- Backend changes
- New API endpoints
- Persistent state/localStorage
- A/B testing different content

## Current State

| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `app/product/page.tsx` | 632-679 | Hero section with search form | Modify |
| `app/product/page.tsx` | 831-848 | Global styles (fadeIn animation) | Modify |

### Key Dependencies
- `pipelineStatus` state (line 32) - used to determine idle state
- `handleReset()` function (line 501) - already resets to idle state
- Existing fadeIn animation defined in global styles (lines 831-848)

## Target State

When `pipelineStatus === 'idle'`:
- Hero section shows search form (unchanged)
- Below form: 3-step "How it works" with icons
- Below steps: Example discovery preview (fake agency metrics)
- At bottom: Hint text "Try searching Surry Hills..."

When search starts (`pipelineStatus !== 'idle'`):
- Onboarding content fades out (opacity 0, transition 300ms)
- After transition, content unmounts or stays hidden

When "New Search" clicked:
- `handleReset()` sets `pipelineStatus` back to `'idle'`
- Onboarding content fades back in

### Pattern to Follow
- See `app/product/page.tsx:831-848` for existing fadeIn animation
- See `components/AgencyCard.tsx:183-186` for fade/transition pattern: `transition-all duration-500 opacity-${visible ? 100 : 0}`
- See `components/MainAgentWorkspace.tsx:168` for conditional visibility with CSS classes

## Gotchas

- **Don't unmount immediately**: Use opacity transition before unmounting, otherwise no fade effect
- **Mobile responsiveness**: Steps should stack vertically on mobile, grid on desktop
- **Content height**: Adding content below form shifts MainAgentWorkspace down - acceptable since it only shows when idle
- **Hint suburb**: Use "Surry Hills" as it's the most commonly tested suburb in the codebase

---

## IMPLEMENTATION STEPS

### Step 1: Add CSS Fade-Out Animation
**Why**: Need a fade-out animation class to complement existing fade-in.

**Files**:
- `app/product/page.tsx` (lines 831-848): Add fadeOut keyframes and class

**Actions**:
- Add `@keyframes fadeOut` animation (reverse of fadeIn)
- Add `.animate-fadeOut` class
- Add `.onboarding-transition` class with `transition: opacity 300ms ease-out`

**Verify**:
- [ ] CSS compiles without errors
- [ ] fadeOut animation defined in global styles

**Status**: [ ] Pending

---

### Step 2: Create Onboarding Content Section
**Why**: Main content addition - the 3-step explainer and example discoveries.

**Files**:
- `app/product/page.tsx` (after line 675, before `{error && ...}`): Add onboarding content

**Actions**:
- Add conditional wrapper: `{pipelineStatus === 'idle' && (`
- Add 3-step "How it works" section:
  - Step 1: "Enter a suburb" with search icon
  - Step 2: "AI finds agencies" with robot/search icon
  - Step 3: "Get branded demos" with document icon
- Add example metrics preview (styled like mini agency cards):
  - Sample agency name, metrics (team size, listings, price range)
  - Styled subtle with stone-200 border, no interaction
- Add hint text: "Try searching Surry Hills, Bondi, or Paddington"
- Apply fade transition classes

**Verify**:
- [ ] Content renders when pipelineStatus is idle
- [ ] Content hidden when pipelineStatus is not idle
- [ ] 3 steps display with icons
- [ ] Example metrics visible

**Status**: [ ] Pending

---

### Step 3: Add Fade Transition Logic
**Why**: Content should fade out smoothly when search starts, not disappear instantly.

**Files**:
- `app/product/page.tsx` (line 32): No change needed to state
- `app/product/page.tsx` (onboarding section): Apply transition classes

**Actions**:
- Wrap onboarding content with transition div:
  ```tsx
  <div className={`transition-opacity duration-300 ${pipelineStatus === 'idle' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
  ```
- Use `pointer-events-none` when faded out to prevent interaction
- Consider keeping content mounted but invisible during transition

**Verify**:
- [ ] Content fades out over 300ms when search starts
- [ ] Content fades in when reset to idle
- [ ] No layout jump during transition

**Status**: [ ] Pending

---

### Step 4: Style Steps Section
**Why**: Visual consistency with existing UI patterns.

**Files**:
- `app/product/page.tsx` (onboarding section): Apply Tailwind classes

**Actions**:
- Use grid layout: `grid grid-cols-1 md:grid-cols-3 gap-6`
- Each step card: `flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-stone-200`
- Icon container: `w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4`
- Icon color: `text-[#00C853]`
- Step title: `text-lg font-semibold text-stone-900 mb-2`
- Step description: `text-sm text-stone-500`

**Verify**:
- [ ] Steps align in 3-column grid on desktop
- [ ] Steps stack on mobile
- [ ] Visual style matches existing components

**Status**: [ ] Pending

---

### Step 5: Style Example Discoveries Section
**Why**: Show users what kind of data they'll get.

**Files**:
- `app/product/page.tsx` (onboarding section): Add example metrics

**Actions**:
- Add section below steps with subtle header: "What you'll discover"
- Create 2-3 example metric badges (not interactive):
  - "8 agents" with people icon
  - "45 listings" with home icon
  - "$600K - $2.1M" with price tag icon
- Style as pills: `inline-flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-full text-sm text-stone-600`
- Container: `flex flex-wrap justify-center gap-3 mt-4`

**Verify**:
- [ ] Example metrics render as pill badges
- [ ] Centered layout with wrapping
- [ ] Subtle styling (doesn't compete with search form)

**Status**: [ ] Pending

---

### Step 6: Add Hint Text
**Why**: Subtle prompt to help users get started.

**Files**:
- `app/product/page.tsx` (onboarding section): Add hint below examples

**Actions**:
- Add hint text at bottom: "Try searching Surry Hills, Bondi, or Paddington"
- Style: `text-sm text-stone-400 mt-6 font-mono`
- Optional: Make suburb names clickable to auto-fill search input

**Verify**:
- [ ] Hint text displays at bottom of onboarding section
- [ ] Text is subtle and doesn't distract

**Status**: [ ] Pending

---

### Step 7: Test Fade Transition Flow
**Why**: Ensure smooth UX when transitioning between states.

**Files**:
- None (manual testing)

**Actions**:
- Load page fresh → onboarding visible
- Enter suburb, click Search → onboarding fades out
- Wait for pipeline to complete (or cancel)
- Click "New Search" → onboarding fades back in

**Verify**:
- [ ] Fade out is smooth (no flicker)
- [ ] Fade in is smooth
- [ ] No layout shift during transition
- [ ] Content fully hidden during search

**Status**: [ ] Pending

---

### Step 8: Mobile Responsiveness Check
**Why**: Ensure content works on all screen sizes.

**Files**:
- None (manual testing)

**Actions**:
- Test on mobile viewport (375px width)
- Verify steps stack vertically
- Verify example metrics wrap properly
- Verify text is readable

**Verify**:
- [ ] Steps stack in single column on mobile
- [ ] No horizontal overflow
- [ ] Text sizes appropriate for mobile

**Status**: [ ] Pending

---

### Step 9: Final Validation
**Why**: Ensure nothing is broken

**Actions**:
- Run `npm run build`
- Check for TypeScript errors
- Visual check of idle state
- Visual check of searching state

**Verify**:
- [ ] Build succeeds
- [ ] Zero TypeScript errors
- [ ] Onboarding displays correctly on idle
- [ ] Onboarding hidden during/after search

**Status**: [ ] Pending

---

## VALIDATION

1. Load /product page fresh → See onboarding content below search form
2. Enter "Surry Hills" and click Search → Onboarding fades out smoothly
3. Wait for search to complete → Onboarding stays hidden
4. Click "New Search" → Onboarding fades back in
5. On mobile → Steps stack vertically, content readable

---

## E2E TESTING INSTRUCTIONS

### Test 1: Initial Page Load
**Preconditions**:
- App running at localhost:3000
- No active pipeline session in localStorage

**Steps**:
1. Navigate to /product page
2. Observe the hero section

**Expected Results**:
- [ ] Search form visible with input and button
- [ ] Agency count slider visible
- [ ] "How it works" 3-step section visible below form
- [ ] Each step has an icon, title, and description
- [ ] Example metrics pills visible (e.g., "8 agents", "45 listings")
- [ ] Hint text visible: "Try searching Surry Hills, Bondi, or Paddington"

---

### Test 2: Onboarding Visibility on Idle
**Preconditions**:
- Page loaded in idle state

**Steps**:
1. Inspect the onboarding section
2. Check opacity and visibility

**Expected Results**:
- [ ] Onboarding content has `opacity: 1`
- [ ] Content is fully visible
- [ ] No pointer-events-none class applied

---

### Test 3: Fade Out on Search Start
**Preconditions**:
- Page in idle state with onboarding visible

**Steps**:
1. Enter "Surry Hills" in search input
2. Click Search button
3. Observe onboarding section

**Expected Results**:
- [ ] Onboarding content fades out (not instant disappear)
- [ ] Transition takes approximately 300ms
- [ ] No layout jump when content hides
- [ ] MainAgentWorkspace appears as search starts

---

### Test 4: Onboarding Hidden During Search
**Preconditions**:
- Search in progress

**Steps**:
1. While pipeline is running, check onboarding area
2. Attempt to interact with where onboarding was

**Expected Results**:
- [ ] Onboarding content not visible
- [ ] Onboarding has `opacity: 0` or is unmounted
- [ ] Clicking area does nothing (pointer-events-none or unmounted)

---

### Test 5: Onboarding Hidden After Completion
**Preconditions**:
- Pipeline completed or errored

**Steps**:
1. Wait for pipeline to complete
2. Check if onboarding reappears

**Expected Results**:
- [ ] Onboarding stays hidden
- [ ] Only reappears when user explicitly clicks "New Search"

---

### Test 6: Fade In on Reset
**Preconditions**:
- Pipeline completed, agency cards visible

**Steps**:
1. Click "New Search" button in header
2. Observe page state

**Expected Results**:
- [ ] Agency cards disappear
- [ ] MainAgentWorkspace disappears
- [ ] Onboarding content fades in smoothly
- [ ] Transition takes approximately 300ms
- [ ] Search input is cleared or retains value (either acceptable)

---

### Test 7: 3-Step Icons and Layout
**Preconditions**:
- Page in idle state

**Steps**:
1. Inspect the 3-step "How it works" section
2. Check icon visibility and colors

**Expected Results**:
- [ ] Step 1 icon: Search/magnifier icon in emerald circle
- [ ] Step 2 icon: Robot or AI icon in emerald circle
- [ ] Step 3 icon: Document or demo icon in emerald circle
- [ ] All icons use `text-[#00C853]` color
- [ ] Steps arranged in 3-column grid on desktop

---

### Test 8: Example Metrics Pills
**Preconditions**:
- Page in idle state

**Steps**:
1. Locate the "What you'll discover" section
2. Inspect the metric pills

**Expected Results**:
- [ ] Pills show example data: "8 agents", "45 listings", "$600K - $2.1M"
- [ ] Pills have subtle bg-stone-50 background
- [ ] Pills have small icons matching the metric type
- [ ] Pills are not interactive (no hover effects)

---

### Test 9: Hint Text Visibility
**Preconditions**:
- Page in idle state

**Steps**:
1. Scroll to bottom of onboarding section
2. Find hint text

**Expected Results**:
- [ ] Text reads: "Try searching Surry Hills, Bondi, or Paddington"
- [ ] Text styled in stone-400 color (subtle)
- [ ] Text uses font-mono
- [ ] Text doesn't compete visually with search button

---

### Test 10: Mobile Layout - Steps
**Preconditions**:
- Browser DevTools open, mobile viewport (375px)

**Steps**:
1. Load /product page on mobile viewport
2. Check 3-step section layout

**Expected Results**:
- [ ] Steps stack vertically (1 column)
- [ ] Each step centered
- [ ] Adequate spacing between steps
- [ ] Icons and text readable on mobile

---

### Test 11: Mobile Layout - Overall
**Preconditions**:
- Mobile viewport

**Steps**:
1. Scroll through entire onboarding section
2. Check for overflow issues

**Expected Results**:
- [ ] No horizontal scrollbar
- [ ] All text fits within viewport
- [ ] Example metrics pills wrap nicely
- [ ] Hint text doesn't overflow

---

### Test 12: Transition Smoothness
**Preconditions**:
- Page in idle state

**Steps**:
1. Open DevTools Performance tab
2. Start recording
3. Click Search to trigger fade out
4. Stop recording and analyze

**Expected Results**:
- [ ] No jank during transition
- [ ] Frame rate stays above 30fps
- [ ] No layout recalculations during fade

---

### Test 13: Rapid State Changes
**Preconditions**:
- Page in idle state

**Steps**:
1. Click Search (starts fade out)
2. Immediately click "New Search" (or cancel if possible)
3. Repeat several times rapidly

**Expected Results**:
- [ ] No visual glitches
- [ ] No console errors
- [ ] State remains consistent
- [ ] UI doesn't get stuck in intermediate state

---

### Test 14: Tab Switch and Return
**Preconditions**:
- Page in idle state

**Steps**:
1. Verify onboarding visible on Search tab
2. Click History tab
3. Click back to Search tab

**Expected Results**:
- [ ] Onboarding still visible after returning to Search tab
- [ ] No double-rendering or flicker

---

### Test 15: Full Flow Integration
**Preconditions**:
- Fresh page load

**Steps**:
1. Load /product page → verify onboarding visible
2. Enter "Bondi" and search → verify onboarding fades out
3. Wait for results (or cancel after a few seconds)
4. Click "New Search" → verify onboarding fades in
5. Enter "Paddington" and search → verify onboarding fades out again
6. Click History tab → verify Search tab content updates
7. Return to Search tab → verify state preserved

**Expected Results**:
- [ ] Complete flow works without errors
- [ ] All transitions smooth
- [ ] State management correct throughout
- [ ] Console has no errors
