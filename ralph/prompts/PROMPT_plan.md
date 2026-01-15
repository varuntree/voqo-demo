0a. Study `ralph/specs/*` with up to 250 parallel Sonnet subagents to learn the feature specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `CLAUDE.md` to understand project rules and patterns.
0d. Study `AGENTS/documentation/*` with up to 100 parallel Sonnet subagents to understand existing architecture (SCHEMA.md, API.md, FEATURES.md, COMPONENTS.md).
0e. For reference, the application source code is in `app/`, `components/`, `convex/`, `lib/`, `hooks/`.

1. Study @ralph/IMPLEMENTATION_PLAN.md (if present; it may be incorrect) and use up to 500 Sonnet subagents to study existing source code and compare it against `ralph/specs/*`. Use an Opus subagent to analyze findings, prioritize tasks, and create/update @ralph/IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority of items yet to be implemented. Ultrathink. Consider searching for TODO, minimal implementations, placeholders, skipped/flaky tests, and inconsistent patterns. Study @ralph/IMPLEMENTATION_PLAN.md to determine starting point for research and keep it up to date with items considered complete/incomplete using subagents.

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality is missing; confirm with code search first. Follow project conventions from CLAUDE.md:
- ShadCN + Tailwind only for UI
- kebab-case for file names
- Barrel exports required in components
- Max 500 lines per file
- CSS variables for colors (no hardcoding)
- Convex access only in hooks/**

ULTIMATE GOAL: Implement the features specified in ralph/specs/*. Consider missing elements and plan accordingly. If an element is missing, search first to confirm it doesn't exist, then document it in @ralph/IMPLEMENTATION_PLAN.md.

Output format for IMPLEMENTATION_PLAN.md:
```markdown
# Implementation Plan

## Current Status
[Brief summary of what exists vs what's needed]

## Priority Tasks

### High Priority
- [ ] Task 1 - Description
- [ ] Task 2 - Description

### Medium Priority
- [ ] Task 3 - Description

### Low Priority
- [ ] Task 4 - Description

## Completed
- [x] Completed task 1
- [x] Completed task 2

## Notes & Discoveries
[Any findings during analysis]
```
