0a. Study `ralph/specs/*` to learn the feature specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `CLAUDE.md` to understand project rules and patterns.
0d. Study `AGENTS/documentation/*` to understand existing architecture (SCHEMA.md, API.md, FEATURES.md, COMPONENTS.md).
0e. For reference, the application source code is in `app/`, `components/`, `convex/`, `lib/`, `hooks/`.

1. You are creating a SCOPED implementation plan for work: "${WORK_SCOPE}".

Study @ralph/IMPLEMENTATION_PLAN.md (if present; it may be incorrect) and study existing source code and compare it against `ralph/specs/*`. Analyze findings, prioritize tasks, and create/update @ralph/IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority of items yet to be implemented. Consider searching for TODO, minimal implementations, placeholders, and inconsistent patterns.

IMPORTANT: This is SCOPED PLANNING for "${WORK_SCOPE}" only.
- Create a plan containing ONLY tasks directly related to this work scope
- Be conservative — if uncertain whether a task belongs to this work, exclude it
- The plan can be regenerated if too narrow
- Plan only. Do NOT implement anything
- Do NOT assume functionality is missing; confirm with code search first

Follow project conventions from CLAUDE.md:
- ShadCN + Tailwind only for UI
- kebab-case for file names
- Barrel exports required in components
- Max 500 lines per file
- CSS variables for colors (no hardcoding)
- Convex access only in hooks/**

ULTIMATE GOAL: We want to achieve the scoped work "${WORK_SCOPE}". Consider missing elements related to this work and plan accordingly.

Output format for IMPLEMENTATION_PLAN.md:
```markdown
# Implementation Plan: ${WORK_SCOPE}

## Scope
This plan covers ONLY: ${WORK_SCOPE}

## Current Status
[Brief summary of what exists vs what's needed for this scope]

## Priority Tasks

### High Priority
- [ ] Task 1 - Description
- [ ] Task 2 - Description

### Medium Priority
- [ ] Task 3 - Description

### Low Priority
- [ ] Task 4 - Description

## Out of Scope (for future work)
- Task that doesn't belong to current scope
- Another unrelated task

## Completed
- [x] Completed task 1

## Notes & Discoveries
[Any findings during analysis]
```
