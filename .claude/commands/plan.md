# Silo Plan

Create a comprehensive implementation plan through interview, exploration, and E2E test generation.

## Variables
task: $ARGUMENTS

## Instructions

Execute phases in strict order. Do NOT skip or parallelize phases.

---

### Phase 1: INTERVIEW

**Goal**: Understand requirements deeply before any exploration.

Use `AskUserQuestion` to gather:

1. **Core functionality**: What exactly should this do?
2. **Acceptance criteria**: How do we know it's done?
3. **UI components**: What does the user see/interact with?
4. **Backend changes**: What data/APIs are needed?
5. **Edge cases**: What could go wrong?
6. **Integration points**: What existing features does this touch?

Keep interviewing until you have ZERO ambiguity. State assumptions explicitly and get confirmation.

**Output**: Internal understanding (no file yet)

---

### Phase 2: EXPLORE

**Goal**: Exhaustive codebase understanding based on interview context.

Deploy **parallel sonnet agents** to explore. Cover ALL:

```
Agent batch 1 - Data & Storage:
- "Find all JSON schemas in data/ directory"
- "Find file read/write patterns in lib/"
- "Find data validation patterns in API routes"

Agent batch 2 - API & Backend:
- "Find all API routes in app/api/"
- "Find webhook patterns in app/api/webhook/"
- "Find Claude Code invocation patterns in lib/"

Agent batch 3 - UI & Components:
- "Find all components in components/"
- "Find page patterns in app/"
- "Find form patterns and state management"
- "Find card/list/panel patterns"

Agent batch 4 - Patterns & Conventions:
- "Find SSE streaming patterns"
- "Find Tailwind CSS patterns"
- "Find progress/status tracking patterns"
- "Find error handling patterns"

Agent batch 5 - Skills & Agents:
- "Find skill definitions in .claude/skills/"
- "Find agent patterns in .claude/agents/"
- "Find Task tool usage patterns"

Agent batch 6 - Testing & Validation:
- "Find E2E test patterns"
- "Find validation command patterns"
- "Find webhook testing patterns"
```

Deploy as many agents as needed. No limits during exploration.

After agents return, read these files:
- `CLAUDE.md` - Project standards (MANDATORY)
- `AGENTS.md` - Working knowledge
- `specs/SPEC-ARCHITECTURE.md` - System architecture
- `specs/SPEC-DATA-API.md` - Data schemas & API reference
- `specs/SPEC-PIPELINE.md` - Pipeline & streaming UI

**Synthesize findings**:
- Patterns that MUST be followed
- Existing code to reuse/extend
- Conventions this codebase enforces
- Anti-patterns to avoid

---

### Phase 3: IMPLEMENTATION_PLAN

**Goal**: Create step-by-step plan with verifiable outcomes.

Use extended thinking. Think hard before writing.

**Philosophy**:
- Simple = well-architected, follows patterns, maintainable
- Simple ≠ small, incomplete, half-baked
- Every decision follows patterns from Phase 2
- No assumptions - everything grounded in exploration

Create file at: `specs/silo-plan-{descriptive-name}.md`

Use this format:

```md
# Implementation Plan: <feature name>

## What & Why
<2-3 sentences: what we're changing, why we're changing it, what the end state looks like>
<This gives the implementer enough context to understand the task without reading interview transcripts>

## Key Decision
<1 sentence: the core design choice that shapes the implementation>
<Prevents implementer from second-guessing or going a different direction>

## Scope

### In Scope
- <bullet list>

### Out of Scope
- <bullet list>

## Current State

<What exists today - specific file paths, line numbers, what each piece does>
<Implementer needs this to find things and understand what they're touching>

| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| `path/to/file.ts` | 1-100 | <what it does> | Delete/Modify |

### Key Dependencies
<Things that reference this code - so implementer doesn't miss cleanup>
- `other/file.ts` references X at line Y

## Target State

<Brief description of what it looks like after>

### Pattern to Follow
<Reference to existing code that demonstrates the pattern>
- See `path/to/example.ts:lines` for <pattern name>

## Gotchas

<Non-obvious things that will break if missed>
- <thing>: <why it matters>
- <thing>: <why it matters>

---

## IMPLEMENTATION STEPS

### Step 1: <Task Name>
**Why**: <context - why this step, what it accomplishes>

**Files**:
- `path/to/file.ts` (lines N-M): <what to do>

**Actions**:
- <specific action>
- <specific action>

**Verify**:
- [ ] <how to know it worked>

---

### Step 2: <Task Name>
**Why**: <context>

**Files**:
- `path/to/file.ts` (lines N-M): <what to do>

**Actions**:
- <specific action>

**Verify**:
- [ ] <checklist item>

---

<continue for all steps>

---

### Step N-1: Update Documentation
**Why**: Keep specs in sync with implementation

**Files**:
- `specs/SPEC-*.md` files affected by this change

**Actions**:
- Update relevant spec files to reflect new/changed functionality
- Add new data schemas to `specs/SPEC-DATA-API.md` if applicable
- Update architecture diagrams in `specs/SPEC-ARCHITECTURE.md` if applicable
- Update API endpoints in `specs/SPEC-DATA-API.md` if applicable
- Update `AGENTS.md` with new patterns/gotchas discovered

**Verify**:
- [ ] All new APIs documented
- [ ] All new data schemas documented
- [ ] Architecture changes reflected in specs

---

### Step N: Final Validation
**Why**: Ensure nothing is broken

**Actions**:
- Run `npm run build`
- Test affected API routes with curl
- Verify file storage works in /data/

**Verify**:
- [ ] Build succeeds
- [ ] Zero TypeScript errors
- [ ] API routes return valid responses

---

## VALIDATION

<3-5 focused end-to-end checks that verify the implementation works>

1. <User action> → <Expected result>
2. <User action> → <Expected result>
3. <User action> → <Expected result>



## E2E TESTING INSTRUCTIONS

<Opus agent will fill this section>

```

---

### Phase 4: E2E TEST GENERATION

**Goal**: Generate comprehensive E2E testing instructions.

Deploy a single **Opus sub-agent** with this context:
- The complete implementation plan from Phase 3
- The interview findings from Phase 1
- The exploration findings from Phase 2

The Opus agent must:
1. Analyze each implementation step
2. Generate corresponding E2E test instructions
3. Cover both visual and functional aspects
4. Include real-world usage scenarios

Append to the same plan file under `## E2E TESTING INSTRUCTIONS`:

```md
## E2E TESTING INSTRUCTIONS

### Test 1: <corresponds to Step 1>
**Preconditions**:
- <setup required>

**Steps**:
1. <action>
2. <action>

**Expected Results**:
- [ ] <visual verification>
- [ ] <functional verification>

---

### Test 2: <corresponds to Step 2>
...

---

### Test N: Full Flow Integration
**Steps**:
1. <end-to-end user journey>

**Expected Results**:
- [ ] <complete flow works>
```


---

## Report

Return ONLY the path to the created plan file. Nothing else.
