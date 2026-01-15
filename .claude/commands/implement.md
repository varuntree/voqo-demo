# Silo Implement

Execute implementation plan and E2E tests. Iterate until ALL steps pass.

## Variables
plan_path: $ARGUMENTS

## Instructions

Read the implementation plan at `plan_path`. If not provided, find the most recent `silo-plan-*.md` in `AGENTS/specs/`.

---

## Execution Rules

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

1. READ current plan state
2. FIND next pending step (Status: [ ] Pending)
3. EXECUTE step with single sub-agent
4. VERIFY checklist outcomes
5. UPDATE plan file:
   - Success → Status: [✓] Complete
   - Failure → Status: [✗] Failed
6. IF failed:
   a. Deploy up to 5 investigation agents to find root cause
   b. Determine fix:
      - If maps to existing step → fix and retry that step
      - If complex new issue → add NEW step to plan, execute it
   c. REWRITE plan file with updates
7. CONTINUE to next step

AFTER all implementation steps [✓]:

8. EXECUTE E2E tests (single agent)
9. FOR each test:
   - Pass → mark [✓]
   - Fail → investigate (up to 5 agents), fix, retry
10. IF E2E failure requires implementation change:
    - Update relevant implementation step to [✗]
    - Add new step if needed
    - RESTART loop from step 1

EXIT only when:
- ALL implementation steps = [✓]
- ALL E2E tests = [✓]
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
### Step N+1: <Fix for discovered issue>
**Actions**:
- <fix actions>

**Verifiable Outcome**:
- [ ] <verification>

**Status**: [ ] Pending

**Added because**: <explanation of why this step was needed>
```

3. **E2E test results**:
```md
### Test 1: ...
**Expected Results**:
- [✓] <passed>
- [✗] <failed - reason>
```

---

## Implementation Step Execution

IMPORTANT: For each step or adjacent steps, use a single sub-agent:

```
Task: "Execute implementation step N"

Context:
- Full plan file content
- Current step details
- Previous step outcomes

Instructions:
1. Read the step's Actions
2. Execute each action
3. Verify each checklist item
4. Report: PASS or FAIL with details
```

---

## Bug Investigation

When a step fails, deploy up to 5 parallel agents:

```
Agent 1: "Find root cause in <relevant files>"
Agent 2: "Check if similar pattern exists elsewhere that works"
Agent 3: "Verify schema/API alignment"
Agent 4: "Check for missing dependencies or imports"
Agent 5: "Analyze error logs and stack traces"
```

Synthesize findings, then fix with single implementation agent.

---

## E2E Test Execution

IMPORTATN: For each E2E test, use single sub-agent:

```
Task: "Execute E2E test N"

Context:
- Full plan file content
- Test instructions
- Implementation outcomes

Instructions:
1. Set up preconditions
2. Execute test steps
3. Verify expected results (visual + functional)
4. Report: PASS or FAIL with screenshots/details
```

---

## Completion Criteria

The loop exits ONLY when the plan file shows:

```md
## IMPLEMENTATION STEPS

### Step 1: ...
**Status**: [✓] Complete

### Step 2: ...
**Status**: [✓] Complete

...

### Step N: Final Validation
**Status**: [✓] Complete

---

## E2E TESTING INSTRUCTIONS

### Test 1: ...
**Expected Results**:
- [✓] ...
- [✓] ...

### Test 2: ...
**Expected Results**:
- [✓] ...

...

### Test N: Full Flow Integration
**Expected Results**:
- [✓] ...
```

---

## Report

When complete, output:
1. Path to final plan file
2. Summary: total steps, iterations needed, issues discovered and resolved
