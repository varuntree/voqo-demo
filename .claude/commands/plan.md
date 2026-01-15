# Phase Plan

Generate a detailed plan for the next pending phase in VoqoLeadEngine implementation.

## Instructions

Execute phases in strict order. Do NOT skip or parallelize phases.

---

### Phase 1: IDENTIFY NEXT PHASE

**Goal**: Find the next phase that needs planning.

1. Read `IMPLEMENTATION_PLAN.md` from project root
2. Find first phase header (## Phase N) that has unchecked `- [ ]` items
3. Note the phase number and name
4. If ALL phases have all items checked `[x]`, output: "Build complete! All phases done."

**Output**: Phase number (1-8) and phase name

---

### Phase 2: LOAD SPEC CONTEXT

**Goal**: Read relevant specification files for this phase.

Load these based on identified phase:

| Phase | Primary Specs to Read |
|-------|----------------------|
| 1 | `specs/00-architecture.md` (file structure), `specs/08-build-sequence.md` (Phase 2 steps) |
| 2 | `specs/01-infrastructure-setup.md` (Twilio, ElevenLabs credentials) |
| 3 | `specs/02-agency-researcher-skill.md`, `specs/03-demo-page-skill.md`, `specs/04-postcall-page-skill.md` |
| 4 | `specs/06-webhook-handler.md` (all API route implementations) |
| 5 | `specs/03-demo-page-skill.md` (UI patterns), `specs/08-build-sequence.md` (Phase 5) |
| 6 | `specs/05-voice-agent-prompt.md`, `specs/01-infrastructure-setup.md` (ElevenLabs setup) |
| 7 | `specs/08-build-sequence.md` (Phase 7 testing steps) |
| 8 | `specs/01-infrastructure-setup.md` (VPS setup), `specs/08-build-sequence.md` (Phase 8) |

Also read `specs/07-data-schemas.md` if phase involves data handling.

**Synthesize findings**:
- Exact files to create/modify
- Code implementations from specs
- Chrome actions required (if any)
- Verification steps

---

### Phase 3: GENERATE PHASE PLAN

**Goal**: Create detailed execution plan for this phase.

Use extended thinking. Think hard before writing.

Create file at: `plans/phase-{N}.md`

Use this format:

```md
# Phase {N}: {Phase Name}

## What & Why
<2-3 sentences: what this phase accomplishes and why it's needed>

## Prerequisites
- <what must be done before this phase>

## Execution Context
| Action Type | How to Execute |
|-------------|----------------|
| Local code | Write/Edit tools |
| Chrome | mcp__claude-in-chrome__* tools (assume logged in) |
| Verification | npm commands, curl, Chrome screenshots |

---

## IMPLEMENTATION STEPS

### Step {N}.1: {Task Name}
**Why**: <context - why this step>

**Actions**:
- <specific action with exact file paths or Chrome steps>
- <specific action>

**Code** (if applicable):
```typescript
// Exact code to write
```

**Verify**:
- [ ] <how to know it worked>

**Status**: [ ] Pending

---

### Step {N}.2: {Task Name}
...

---

### Step {N}.X: Phase Checkpoint
**Why**: Ensure phase is complete before moving on

**Verify**:
- [ ] <checkpoint item from IMPLEMENTATION_PLAN.md>
- [ ] <checkpoint item>

**Status**: [ ] Pending

---

## VALIDATION

<3-5 focused checks that verify this phase works>

1. <User action> → <Expected result>
2. <User action> → <Expected result>
```

### Special Instructions by Phase Type

**For Chrome phases (2, 6, 8):**
- Include exact navigation URLs
- Include what to look for on each page
- Include what values to copy/note
- Assume user is already logged in

**For Code phases (1, 3, 4, 5):**
- Include exact file paths
- Include full code implementations from specs
- Include TypeScript types
- Include test commands

---

### Phase 4: REVIEW PLAN

Before saving, verify:
- [ ] All steps from IMPLEMENTATION_PLAN.md are covered
- [ ] Code matches spec implementations exactly
- [ ] Chrome steps have clear instructions
- [ ] Verification steps are actionable
- [ ] Phase checkpoint matches IMPLEMENTATION_PLAN.md checkpoint

---

## Report

Return ONLY:
1. The phase number planned
2. Path to created plan file
3. Count of steps in the plan

Example:
```
Phase 3 plan created: plans/phase-3.md
Steps: 5
```
