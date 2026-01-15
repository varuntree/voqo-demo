# Phase Implement

Execute the current phase plan and update status tracking.

## Variables
phase: $ARGUMENTS

## Instructions

Execute the phase plan. If no phase specified, find the current phase from plans/.

---

## Execution Setup

### Find Current Phase Plan

1. If `phase` argument provided, use `plans/phase-{phase}.md`
2. Otherwise, find the most recent phase plan in `plans/`
3. If no plan exists, output: "No phase plan found. Run /plan first."

### Read Plan Context

Load these files:
- The phase plan file
- `IMPLEMENTATION_PLAN.md` (for status updates)
- Relevant spec files referenced in the plan

---

## Execution Rules

### Tool Usage by Action Type

| Action Type | Tools to Use |
|-------------|-------------|
| Local code (Write/Edit) | Write, Edit, Read tools |
| Local bash | Bash tool (npm, curl, etc.) |
| Chrome automation | mcp__claude-in-chrome__* tools |
| Verification | Bash (curl, npm), Chrome (screenshots) |

### Sub-agent Constraints

| Activity | Agents Allowed |
|----------|----------------|
| Bug investigation | Up to 5 parallel |
| Implementation | Single agent ONLY |
| Testing | Single agent ONLY |

### Iteration Philosophy

- Do NOT patch issues superficially
- Truly resolve root causes
- Deploy investigation agents (up to 5) to find bugs
- Only move forward when step is genuinely complete

---

## Execution Loop

```
REPEAT until ALL steps = [✓]:

1. READ current plan state from plans/phase-{N}.md
2. FIND next pending step (Status: [ ] Pending)
3. EXECUTE step:
   - For code: Use Write/Edit tools
   - For Chrome: Use mcp__claude-in-chrome__* tools
   - For bash: Use Bash tool
4. VERIFY checklist outcomes
5. UPDATE plan file:
   - Success → Status: [✓] Complete
   - Failure → Status: [✗] Failed
6. IF failed:
   a. Deploy up to 5 investigation agents to find root cause
   b. Determine fix:
      - If simple fix → fix and retry step
      - If complex → add NEW step to plan, execute it
   c. REWRITE plan file with updates
7. UPDATE IMPLEMENTATION_PLAN.md:
   - Mark corresponding [ ] item as [x]
8. GIT COMMIT after significant progress:
   - After each major step OR
   - After phase checkpoint
9. CONTINUE to next step

EXIT when:
- ALL implementation steps = [✓]
- Phase checkpoint verified
```

---

## Chrome Tool Usage (Phases 2, 6, 8)

### Browser Automation Guidelines

**Assume user is logged in** to all services (DigitalOcean, Twilio, ElevenLabs)

**Before any Chrome action:**
```
1. Call mcp__claude-in-chrome__tabs_context_mcp to get tab context
2. Create new tab if needed with mcp__claude-in-chrome__tabs_create_mcp
3. Navigate using mcp__claude-in-chrome__navigate
```

**For form filling:**
```
1. Use mcp__claude-in-chrome__read_page to find form elements
2. Use mcp__claude-in-chrome__form_input to fill values
3. Use mcp__claude-in-chrome__computer for clicks
```

**For value extraction:**
```
1. Use mcp__claude-in-chrome__read_page or find to locate elements
2. Use mcp__claude-in-chrome__javascript_tool to extract values
3. Store extracted values in .env.local or note them
```

**Take screenshots** at key moments for verification:
```
mcp__claude-in-chrome__computer with action: "screenshot"
```

---

## Plan File Updates

When updating the plan file, REWRITE the entire file. Update:

1. **Step statuses**:
```md
**Status**: [✓] Complete   # was successful
**Status**: [✗] Failed     # needs retry
**Status**: [ ] Pending    # not started
```

2. **Add new steps** when complex issues discovered:
```md
### Step N+1: {Fix for discovered issue}
**Why**: <explanation>

**Actions**:
- <fix actions>

**Verify**:
- [ ] <verification>

**Status**: [ ] Pending

**Added because**: <explanation of why this step was needed>
```

---

## IMPLEMENTATION_PLAN.md Updates

After each step completes:

1. Find the corresponding `- [ ]` item in IMPLEMENTATION_PLAN.md
2. Change to `- [x]`
3. Save file

Example:
```md
# Before
- [ ] 3.1 Create agency-researcher skill

# After
- [x] 3.1 Create agency-researcher skill
```

---

## Git Commit Strategy

Commit at these points:

1. **After each major step** (code creation, config change)
2. **After phase checkpoint** (all items verified)

Commit message format:
```
Phase {N}.{step}: {brief description}

- {what was done}
- {files created/modified}
```

Example:
```
Phase 3.1: Create agency-researcher skill

- Created .claude/skills/agency-researcher/SKILL.md
- Full skill content from specs/02-agency-researcher-skill.md
```

---

## AGENTS.md Updates

After discovering patterns or gotchas during implementation:

1. Read current `AGENTS.md`
2. Add to appropriate section:
   - **Key Patterns**: Useful patterns for future phases
   - **Discovered Gotchas**: Things that broke and how to fix
3. Save updates

**Examples of what to add:**
- "Chrome tool requires tabs_context_mcp first"
- "File paths must be absolute for Claude Code"
- "ngrok URL changes on restart - update webhooks"
- "ElevenLabs agent ID format: xxx-xxx-xxx"

**When to update:**
- After resolving any bug or issue
- When discovering a pattern that will help future phases
- After external service setup (credential locations, quirks)

---

## Bug Investigation

When a step fails, deploy up to 5 parallel agents:

```
Agent 1: "Find root cause in <relevant files>"
Agent 2: "Check if similar pattern exists elsewhere that works"
Agent 3: "Verify spec requirements match implementation"
Agent 4: "Check for missing dependencies or imports"
Agent 5: "Analyze error logs and stack traces"
```

Synthesize findings, then fix with single implementation.

---

## Completion Criteria

The phase is complete when the plan file shows:

```md
## IMPLEMENTATION STEPS

### Step {N}.1: ...
**Status**: [✓] Complete

### Step {N}.2: ...
**Status**: [✓] Complete

...

### Step {N}.X: Phase Checkpoint
**Status**: [✓] Complete
```

AND `IMPLEMENTATION_PLAN.md` shows all items for this phase as `[x]`.

---

## Report

When phase complete, output:

1. Phase number completed
2. Total steps executed
3. Any issues encountered and resolved
4. Path to final plan file
5. Git commit hash

Example:
```
Phase 3 complete!
Steps: 5
Issues resolved: 1 (skill file path typo)
Plan: plans/phase-3.md
Commit: abc1234
```
