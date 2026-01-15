# Ralph System Specification for prjconstruciton

## Overview

Ralph is an autonomous coding loop that executes software development tasks without human intervention. This specification defines a custom Ralph implementation for the **prjconstruciton** project, supporting both **Claude Code** and **OpenAI Codex** CLIs.

**Core Philosophy:**
- Fresh context each iteration (garbage collection)
- One task per loop = 100% "smart zone" context utilization
- Backpressure via tests/builds drives quality
- Plan is disposable — regenerate when wrong
- Trust the loop — eventual consistency through iteration

---

## 1. Directory Structure

```
prjconstruciton/
└── ralph/
    ├── ralph.sh                    # Main entry script
    ├── AGENTS.md                   # Build/validation commands (~60 lines max)
    ├── IMPLEMENTATION_PLAN.md      # Generated task list (managed by Ralph)
    │
    ├── prompts/
    │   ├── PROMPT_plan.md          # Claude Code planning
    │   ├── PROMPT_build.md         # Claude Code building
    │   ├── PROMPT_plan_codex.md    # Codex planning (no subagents)
    │   ├── PROMPT_build_codex.md   # Codex building (no subagents)
    │   └── PROMPT_plan_work.md     # Scoped planning (work branches)
    │
    ├── specs/                      # Feature specifications
    │   └── *.md                    # One spec per feature/topic
    │
    ├── logs/                       # Iteration logs
    │   └── iteration-*.jsonl       # JSON Lines output per iteration
    │
    └── README.md                   # Usage documentation
```

---

## 2. CLI Configuration

### 2.1 Claude Code

**Invocation:**
```bash
cat PROMPT.md | claude -p \
    --dangerously-skip-permissions \
    --output-format=stream-json \
    --verbose
```

**Key Flags:**
| Flag | Purpose |
|------|---------|
| `-p` | Headless mode (non-interactive, reads from stdin) |
| `--dangerously-skip-permissions` | Bypass ALL permission checks (YOLO mode) |
| `--output-format=stream-json` | Streaming JSON for logging |
| `--verbose` | Required for stream-json output |

**Notes:**
- NO `--model` flag (use default as Ralph recommends)
- Subagents available via Task tool
- Chrome tools available for E2E (`mcp__claude-in-chrome__*`)

### 2.2 OpenAI Codex

**Invocation:**
```bash
codex exec "$(cat PROMPT.md)" \
    --yolo \
    --model "${MODEL:-gpt-5.2-codex}" \
    --json
```

**Key Flags:**
| Flag | Purpose |
|------|---------|
| `exec` | Non-interactive mode |
| `--yolo` | Bypass approvals and sandbox (alias for `--dangerously-bypass-approvals-and-sandbox`) |
| `--model` | Model selection (configurable, default: `gpt-5.2-codex`) |
| `--json` | JSON Lines output for logging |

**Notes:**
- Prompt passed as argument, NOT stdin
- NO subagents — single main agent only
- Playwright MCP for E2E (already configured)

### 2.3 CLI Differences Summary

| Aspect | Claude Code | Codex |
|--------|-------------|-------|
| Prompt input | stdin (`cat \| claude`) | argument (`codex exec "$(cat)"`) |
| YOLO flag | `--dangerously-skip-permissions` | `--yolo` |
| Model | None (default) | `--model gpt-5.2-codex` (configurable) |
| Output | `--output-format=stream-json` | `--json` |
| Subagents | Yes (Task tool, up to 500 Sonnet) | No |
| E2E tool | Chrome tools (`mcp__claude-in-chrome__*`) | Playwright MCP |
| Extended thinking | "Ultrathink" | Not available |

---

## 3. Main Loop Script (`ralph.sh`)

### 3.1 Usage

```bash
# Spec creation (interactive interview)
./ralph.sh spec "feature description"

# Planning mode
./ralph.sh plan                         # Claude Code, unlimited
./ralph.sh plan --cli codex             # Codex
./ralph.sh plan 5                       # Max 5 iterations

# Building mode
./ralph.sh build                        # Claude Code, unlimited
./ralph.sh build 20                     # Max 20 iterations
./ralph.sh build --cli codex            # Codex
./ralph.sh build 20 --cli codex --model gpt-5.1-codex  # Custom model

# Scoped planning (work branches)
./ralph.sh plan-work "user auth with OAuth"
```

### 3.2 Script Specification

```bash
#!/bin/bash
set -euo pipefail

# =============================================================================
# Ralph Autonomous Coding Loop
# Supports: Claude Code, OpenAI Codex
# =============================================================================

RALPH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$RALPH_DIR")"

# Defaults
CLI="claude"
MODE="build"
MAX_ITERATIONS=0
MODEL="gpt-5.2-codex"
WORK_SCOPE=""

# -----------------------------------------------------------------------------
# Argument Parsing
# -----------------------------------------------------------------------------
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            spec)
                MODE="spec"
                shift
                SPEC_DESCRIPTION="${1:-}"
                shift || true
                ;;
            plan)
                MODE="plan"
                shift
                ;;
            plan-work)
                MODE="plan-work"
                shift
                WORK_SCOPE="${1:-}"
                [[ -z "$WORK_SCOPE" ]] && { echo "Error: plan-work requires description"; exit 1; }
                shift
                ;;
            build)
                MODE="build"
                shift
                ;;
            --cli)
                shift
                CLI="${1:-claude}"
                [[ "$CLI" != "claude" && "$CLI" != "codex" ]] && { echo "Error: --cli must be 'claude' or 'codex'"; exit 1; }
                shift
                ;;
            --model)
                shift
                MODEL="${1:-gpt-5.2-codex}"
                shift
                ;;
            [0-9]*)
                MAX_ITERATIONS="$1"
                shift
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# -----------------------------------------------------------------------------
# Prompt File Selection
# -----------------------------------------------------------------------------
get_prompt_file() {
    local mode="$1"
    local cli="$2"

    case "$mode" in
        plan)
            [[ "$cli" == "codex" ]] && echo "prompts/PROMPT_plan_codex.md" || echo "prompts/PROMPT_plan.md"
            ;;
        plan-work)
            echo "prompts/PROMPT_plan_work.md"
            ;;
        build)
            [[ "$cli" == "codex" ]] && echo "prompts/PROMPT_build_codex.md" || echo "prompts/PROMPT_build.md"
            ;;
    esac
}

# -----------------------------------------------------------------------------
# Run Single Iteration
# -----------------------------------------------------------------------------
run_iteration() {
    local prompt_file="$1"
    local iteration="$2"
    local log_file="$RALPH_DIR/logs/iteration-$(printf '%03d' $iteration).jsonl"

    mkdir -p "$RALPH_DIR/logs"

    if [[ "$CLI" == "claude" ]]; then
        cat "$RALPH_DIR/$prompt_file" | claude -p \
            --dangerously-skip-permissions \
            --output-format=stream-json \
            --verbose \
            2>&1 | tee "$log_file"
    else
        # Codex: prompt as argument
        local prompt_content
        if [[ "$MODE" == "plan-work" ]]; then
            prompt_content=$(WORK_SCOPE="$WORK_SCOPE" envsubst < "$RALPH_DIR/$prompt_file")
        else
            prompt_content=$(cat "$RALPH_DIR/$prompt_file")
        fi

        codex exec "$prompt_content" \
            --yolo \
            --model "$MODEL" \
            --json \
            2>&1 | tee "$log_file"
    fi
}

# -----------------------------------------------------------------------------
# Check Empty Plan
# -----------------------------------------------------------------------------
is_plan_empty() {
    local plan_file="$RALPH_DIR/IMPLEMENTATION_PLAN.md"

    [[ ! -f "$plan_file" ]] && return 1

    # Check if all tasks are marked complete or file has no pending items
    # Simple heuristic: no unchecked boxes [ ] and no bullet points without [x]
    if grep -qE '^\s*[-*]\s+\[[ ]\]' "$plan_file" 2>/dev/null; then
        return 1  # Has unchecked items
    fi

    if grep -qE '^\s*[-*]\s+[^[]*$' "$plan_file" 2>/dev/null; then
        # Has bullet points without checkbox - check if they look like tasks
        local task_count=$(grep -cE '^\s*[-*]\s+[A-Z]' "$plan_file" 2>/dev/null || echo "0")
        [[ "$task_count" -gt 0 ]] && return 1
    fi

    return 0  # Plan appears empty/complete
}

# -----------------------------------------------------------------------------
# Spec Creation Mode
# -----------------------------------------------------------------------------
run_spec_mode() {
    [[ -z "$SPEC_DESCRIPTION" ]] && { echo "Error: spec requires description"; exit 1; }

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Mode:        spec (interactive interview)"
    echo "CLI:         claude (always)"
    echo "Description: $SPEC_DESCRIPTION"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Spec creation always uses Claude Code (interactive, not headless)
    cd "$PROJECT_ROOT"
    claude "You are helping create a feature specification for the Ralph autonomous coding system.

The user wants to implement: $SPEC_DESCRIPTION

Interview the user using AskUserQuestion to understand:
1. What is the core functionality needed?
2. What are the acceptance criteria?
3. What UI components are involved (if any)?
4. What backend changes are needed (if any)?
5. What are the edge cases?

After gathering requirements, create a specification file at:
ralph/specs/$(echo "$SPEC_DESCRIPTION" | tr ' ' '-' | tr '[:upper:]' '[:lower:]').md

Use this format:
# Feature: [Title]

## Summary
[1-3 sentences]

## Scope
### In Scope
- [bullet points]

### Out of Scope
- [bullet points]

## Acceptance Criteria
- [ ] [Specific, testable criterion]
- [ ] [Another criterion]

## Solution Design
### Data Model
[If applicable]

### Backend
[Changes needed]

### Frontend
[Components needed]

## E2E Test Requirements
[Describe what E2E tests should verify]

## Relevant Files
- [file paths that will be modified]
"
}

# -----------------------------------------------------------------------------
# Main Loop
# -----------------------------------------------------------------------------
run_loop() {
    local prompt_file
    prompt_file=$(get_prompt_file "$MODE" "$CLI")

    [[ ! -f "$RALPH_DIR/$prompt_file" ]] && { echo "Error: $prompt_file not found"; exit 1; }

    local current_branch
    current_branch=$(git -C "$PROJECT_ROOT" branch --show-current)

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Mode:   $MODE"
    echo "CLI:    $CLI"
    echo "Prompt: $prompt_file"
    echo "Branch: $current_branch"
    [[ "$CLI" == "codex" ]] && echo "Model:  $MODEL"
    [[ "$MAX_ITERATIONS" -gt 0 ]] && echo "Max:    $MAX_ITERATIONS iterations"
    [[ -n "$WORK_SCOPE" ]] && echo "Scope:  $WORK_SCOPE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Validate branch for plan-work
    if [[ "$MODE" == "plan-work" ]]; then
        if [[ "$current_branch" == "main" || "$current_branch" == "master" ]]; then
            echo "Error: plan-work should run on a work branch, not main/master"
            echo "Create a work branch first: git checkout -b ralph/your-work"
            exit 1
        fi
    fi

    local iteration=0

    cd "$PROJECT_ROOT"

    while true; do
        # Check max iterations
        if [[ "$MAX_ITERATIONS" -gt 0 && "$iteration" -ge "$MAX_ITERATIONS" ]]; then
            echo "Reached max iterations: $MAX_ITERATIONS"
            break
        fi

        # Check empty plan (build mode only)
        if [[ "$MODE" == "build" && "$iteration" -gt 0 ]] && is_plan_empty; then
            echo "IMPLEMENTATION_PLAN.md appears complete. Stopping loop."
            break
        fi

        iteration=$((iteration + 1))
        echo -e "\n======================== ITERATION $iteration ========================\n"

        # Run iteration
        run_iteration "$prompt_file" "$iteration"

        echo -e "\n======================== ITERATION $iteration COMPLETE ========================\n"
    done

    # Push on loop exit
    echo "Pushing changes..."
    current_branch=$(git -C "$PROJECT_ROOT" branch --show-current)
    git -C "$PROJECT_ROOT" push origin "$current_branch" 2>/dev/null || {
        echo "Creating remote branch..."
        git -C "$PROJECT_ROOT" push -u origin "$current_branch"
    }

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Ralph loop completed"
    echo "Iterations: $iteration"
    echo "Logs: $RALPH_DIR/logs/"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# -----------------------------------------------------------------------------
# Entry Point
# -----------------------------------------------------------------------------
main() {
    parse_args "$@"

    if [[ "$MODE" == "spec" ]]; then
        run_spec_mode
    else
        run_loop
    fi
}

main "$@"
```

---

## 4. Prompt Specifications

### 4.1 PROMPT_plan.md (Claude Code)

```markdown
0a. Study `ralph/specs/*` with up to 250 parallel Sonnet subagents to learn the feature specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `CLAUDE.md` to understand project rules and patterns.
0d. Study `AGENTS/documentation/*` with up to 100 parallel Sonnet subagents to understand existing architecture.
0e. For reference, the application source code is in `app/`, `components/`, `convex/`, `lib/`, `hooks/`.

1. Study @ralph/IMPLEMENTATION_PLAN.md (if present; it may be incorrect) and use up to 500 Sonnet subagents to study existing source code and compare it against `ralph/specs/*`. Use an Opus subagent to analyze findings, prioritize tasks, and create/update @ralph/IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority of items yet to be implemented. Ultrathink. Consider searching for TODO, minimal implementations, placeholders, skipped/flaky tests, and inconsistent patterns. Study @ralph/IMPLEMENTATION_PLAN.md to determine starting point for research and keep it up to date with items considered complete/incomplete using subagents.

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality is missing; confirm with code search first. Follow project conventions from CLAUDE.md (ShadCN+Tailwind, kebab-case files, barrel exports, 500-line max).

ULTIMATE GOAL: Implement the features specified in ralph/specs/*. Consider missing elements and plan accordingly. If an element is missing, search first to confirm it doesn't exist, then document it in @ralph/IMPLEMENTATION_PLAN.md.
```

### 4.2 PROMPT_build.md (Claude Code)

```markdown
0a. Study `ralph/specs/*` with up to 500 parallel Sonnet subagents to learn the feature specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md.
0c. Study `CLAUDE.md` to understand project rules and patterns.
0d. For reference: app/ (pages), components/ (UI), convex/ (backend), lib/ (shared), hooks/ (data adapters).

1. Your task is to implement functionality per the specifications using parallel subagents. Follow @ralph/IMPLEMENTATION_PLAN.md and choose the most important item to address. Before making changes, search the codebase (don't assume not implemented) using Sonnet subagents. You may use up to 500 parallel Sonnet subagents for searches/reads and only 1 Sonnet subagent for build/tests. Use Opus subagents when complex reasoning is needed (debugging, architectural decisions).

2. After implementing functionality or resolving problems, run validation: `pnpm typecheck && pnpm build && pnpm lint`. If the task involves UI changes, create an E2E test in AGENTS/e2e/ and run it using Chrome tools (mcp__claude-in-chrome__*) to verify the UI works correctly. Take screenshots as evidence. Ultrathink.

3. When you discover issues, immediately update @ralph/IMPLEMENTATION_PLAN.md with your findings using a subagent. When resolved, update and remove the item.

4. When validation passes and E2E tests (if applicable) pass, update @ralph/IMPLEMENTATION_PLAN.md, then `git add -A` then `git commit` with a descriptive message.

99999. Important: When authoring documentation, capture the why — tests and implementation importance.
999999. Important: Single sources of truth, no migrations/adapters. If tests unrelated to your work fail, resolve them as part of the increment.
9999999. Follow CLAUDE.md rules: ShadCN+Tailwind only, CSS variables for colors, kebab-case files, barrel exports, max 500 lines per file.
99999999. You may add extra logging if required to debug issues.
999999999. Keep @ralph/IMPLEMENTATION_PLAN.md current with learnings using a subagent — future work depends on this to avoid duplicating efforts. Update especially after finishing your turn.
9999999999. When you learn something new about how to run the application, update @ralph/AGENTS.md using a subagent but keep it brief.
99999999999. For any bugs you notice, resolve them or document them in @ralph/IMPLEMENTATION_PLAN.md using a subagent even if it is unrelated to the current piece of work.
999999999999. Implement functionality completely. Placeholders and stubs waste efforts and time redoing the same work.
9999999999999. When @ralph/IMPLEMENTATION_PLAN.md becomes large periodically clean out the items that are completed from the file using a subagent.
99999999999999. If you find inconsistencies in the ralph/specs/* then use an Opus 4.5 subagent with 'ultrathink' requested to update the specs.
999999999999999. IMPORTANT: Keep @ralph/AGENTS.md operational only — status updates and progress notes belong in IMPLEMENTATION_PLAN.md. A bloated AGENTS.md pollutes every future loop's context.
9999999999999999. E2E TESTING: For UI tasks, create E2E test specs in AGENTS/e2e/ and verify using Chrome tools. Task is not complete until E2E verification passes.
```

### 4.3 PROMPT_plan_codex.md (Codex - No Subagents)

```markdown
0a. Study `ralph/specs/*` to learn the feature specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `CLAUDE.md` to understand project rules and patterns.
0d. Study `AGENTS/documentation/*` to understand existing architecture.
0e. For reference, the application source code is in `app/`, `components/`, `convex/`, `lib/`, `hooks/`.

1. Study @ralph/IMPLEMENTATION_PLAN.md (if present; it may be incorrect) and study existing source code and compare it against `ralph/specs/*`. Analyze findings, prioritize tasks, and create/update @ralph/IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority of items yet to be implemented. Consider searching for TODO, minimal implementations, placeholders, skipped/flaky tests, and inconsistent patterns. Keep it up to date with items considered complete/incomplete.

IMPORTANT: Plan only. Do NOT implement anything. Do NOT assume functionality is missing; confirm with code search first. Follow project conventions from CLAUDE.md (ShadCN+Tailwind, kebab-case files, barrel exports, 500-line max).

ULTIMATE GOAL: Implement the features specified in ralph/specs/*. Consider missing elements and plan accordingly. If an element is missing, search first to confirm it doesn't exist, then document it in @ralph/IMPLEMENTATION_PLAN.md.
```

### 4.4 PROMPT_build_codex.md (Codex - No Subagents)

```markdown
0a. Study `ralph/specs/*` to learn the feature specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md.
0c. Study `CLAUDE.md` to understand project rules and patterns.
0d. For reference: app/ (pages), components/ (UI), convex/ (backend), lib/ (shared), hooks/ (data adapters).

1. Your task is to implement functionality per the specifications. Follow @ralph/IMPLEMENTATION_PLAN.md and choose the most important item to address. Before making changes, search the codebase (don't assume not implemented).

2. After implementing functionality or resolving problems, run validation: `pnpm typecheck && pnpm build && pnpm lint`. If the task involves UI changes, create an E2E test in AGENTS/e2e/ and run it using Playwright MCP to verify the UI works correctly. Take screenshots as evidence.

3. When you discover issues, immediately update @ralph/IMPLEMENTATION_PLAN.md with your findings. When resolved, update and remove the item.

4. When validation passes and E2E tests (if applicable) pass, update @ralph/IMPLEMENTATION_PLAN.md, then `git add -A` then `git commit` with a descriptive message.

99999. Important: When authoring documentation, capture the why — tests and implementation importance.
999999. Important: Single sources of truth, no migrations/adapters. If tests unrelated to your work fail, resolve them as part of the increment.
9999999. Follow CLAUDE.md rules: ShadCN+Tailwind only, CSS variables for colors, kebab-case files, barrel exports, max 500 lines per file.
99999999. You may add extra logging if required to debug issues.
999999999. Keep @ralph/IMPLEMENTATION_PLAN.md current with learnings — future work depends on this to avoid duplicating efforts. Update especially after finishing your turn.
9999999999. When you learn something new about how to run the application, update @ralph/AGENTS.md but keep it brief.
99999999999. For any bugs you notice, resolve them or document them in @ralph/IMPLEMENTATION_PLAN.md even if unrelated to the current piece of work.
999999999999. Implement functionality completely. Placeholders and stubs waste efforts and time redoing the same work.
9999999999999. When @ralph/IMPLEMENTATION_PLAN.md becomes large periodically clean out the completed items.
99999999999999. If you find inconsistencies in the ralph/specs/* then update the specs.
999999999999999. IMPORTANT: Keep @ralph/AGENTS.md operational only — status updates and progress notes belong in IMPLEMENTATION_PLAN.md.
9999999999999999. E2E TESTING: For UI tasks, create E2E test specs in AGENTS/e2e/ and verify using Playwright MCP. Task is not complete until E2E verification passes.
```

### 4.5 PROMPT_plan_work.md (Scoped Planning)

```markdown
0a. Study `ralph/specs/*` to learn the feature specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `CLAUDE.md` to understand project rules and patterns.
0d. Study `AGENTS/documentation/*` to understand existing architecture.
0e. For reference, the application source code is in `app/`, `components/`, `convex/`, `lib/`, `hooks/`.

1. You are creating a SCOPED implementation plan for work: "${WORK_SCOPE}". Study @ralph/IMPLEMENTATION_PLAN.md (if present; it may be incorrect) and study existing source code and compare it against `ralph/specs/*`. Analyze findings, prioritize tasks, and create/update @ralph/IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority of items yet to be implemented. Consider searching for TODO, minimal implementations, placeholders, and inconsistent patterns.

IMPORTANT: This is SCOPED PLANNING for "${WORK_SCOPE}" only. Create a plan containing ONLY tasks directly related to this work scope. Be conservative — if uncertain whether a task belongs to this work, exclude it. The plan can be regenerated if too narrow. Plan only. Do NOT implement anything. Do NOT assume functionality is missing; confirm with code search first.

ULTIMATE GOAL: We want to achieve the scoped work "${WORK_SCOPE}". Consider missing elements related to this work and plan accordingly.
```

---

## 5. AGENTS.md Specification

```markdown
## Build & Run

```bash
pnpm dev              # Start dev server (Next.js + Convex cloud)
pnpm dev:cloud        # Dev with cloud Convex (for webhooks)
```

## Validation

Run these after implementing to get immediate feedback:

```bash
pnpm typecheck        # TypeScript validation
pnpm build            # Next.js production build
pnpm lint             # ESLint
npx convex dev --once # Sync Convex schema (after schema changes)
```

## Post-Schema Changes

After modifying `convex/schema.ts`:
```bash
node scripts/generate-schema-manifest.mjs
node scripts/generate-operation-catalog.mjs
```

## E2E Testing

- Claude Code: Use Chrome tools (`mcp__claude-in-chrome__*`)
- Codex: Use Playwright MCP
- Test specs location: `AGENTS/e2e/`
- Always take screenshots as evidence

## Codebase Patterns

- **Files:** kebab-case (`defect-form.tsx`)
- **Types:** PascalCase (`DefectStatus`)
- **Functions:** camelCase (`createDefect`)
- **UI:** ShadCN + Tailwind only, CSS variables for colors
- **Imports:** Barrel exports from `@/components/<feature>`
- **Max file size:** 500 lines
- **Convex access:** Only in `hooks/**`

## New Feature Checklist

1. Schema: `convex/schema.ts` — table + indexes
2. Backend: `convex/<feature>.ts` — queries/mutations
3. Constants: `lib/constants.ts` — statuses with cssVar
4. Components: `components/<feature>/` with `index.ts`
5. Page: `app/(platform)/projects/[id]/<feature>/page.tsx`
6. Navigation: Add to `PROJECT_NAV_ITEMS`
7. Docs: Update `AGENTS/documentation/FEATURES.md`
```

---

## 6. E2E Testing Integration

### 6.1 When to Run E2E Tests

The agent should assess each task and run E2E tests when:
- Task creates or modifies UI components
- Task affects user-facing functionality
- Task changes routes or navigation
- Task modifies forms or user interactions

### 6.2 E2E Test Structure

Create test specs in `AGENTS/e2e/` following this pattern:

```markdown
# E2E Test: [Feature Name]

## User Story
As a [user type], I want [action], so that [benefit]

## Prerequisites
- Project exists with ID
- User is authenticated (mock)

## Test Steps
1. Navigate to [URL]
2. Take screenshot (initial state)
3. Verify [element] is visible
4. Click [button/link]
5. Fill form with [data]
6. Submit and verify [result]
7. Take screenshot (final state)

## Success Criteria
- [ ] [Dashboard/list] renders correctly
- [ ] [Form] accepts input
- [ ] [Action] completes successfully
- [ ] Screenshots captured at key points
```

### 6.3 Tool Usage

**Claude Code:**
```
Use mcp__claude-in-chrome__* tools:
- tabs_context_mcp: Get browser context
- navigate: Go to URL
- read_page: Get page elements
- find: Find elements by description
- computer: Click, type, screenshot
- form_input: Fill form fields
```

**Codex:**
```
Use Playwright MCP:
- Navigate to URLs
- Take screenshots
- Click elements
- Fill forms
- Assert element visibility
```

---

## 7. Git Workflow

### 7.1 Branch Strategy

- **Main branch:** `main` or `master`
- **Work branches:** `ralph/feature-name`
- **Scoped planning:** Use `plan-work` mode on work branches

### 7.2 Commit Behavior

- One task = one commit
- Descriptive commit messages
- Accumulate locally during loop
- Push on loop exit only

### 7.3 Workflow Example

```bash
# 1. Create work branch
git checkout -b ralph/user-authentication

# 2. Create spec
./ralph.sh spec "user authentication with OAuth"

# 3. Run scoped planning
./ralph.sh plan-work "user authentication with OAuth"

# 4. Review plan
cat ralph/IMPLEMENTATION_PLAN.md

# 5. Run build loop
./ralph.sh build 20

# 6. Create PR (after loop completes)
gh pr create --base main --head ralph/user-authentication --fill
```

---

## 8. Error Handling

### 8.1 Philosophy: Trust the Loop

Ralph uses **Option A: Trust the loop** for error handling:
- Incomplete tasks remain in `IMPLEMENTATION_PLAN.md`
- Next iteration picks up where previous left off
- Eventual consistency through iteration
- No special error recovery logic

### 8.2 Escape Hatches

- **Ctrl+C:** Stop loop immediately
- **Max iterations:** `./ralph.sh build 20` stops after 20 iterations
- **Empty plan detection:** Loop stops when plan appears complete
- **Git reset:** `git reset --hard` reverts uncommitted changes
- **Plan regeneration:** Delete `IMPLEMENTATION_PLAN.md` and run planning mode

---

## 9. Logging

### 9.1 Output Destinations

1. **CLI output:** Real-time streaming to terminal
2. **Log files:** `ralph/logs/iteration-XXX.jsonl`

### 9.2 Log Format

JSON Lines format for parseability:
```json
{"type":"system","subtype":"init",...}
{"type":"assistant","message":{...},...}
{"type":"result","subtype":"success",...}
```

### 9.3 Log Retention

- One file per iteration
- Numbered sequentially (001, 002, etc.)
- Manual cleanup as needed

---

## 10. Implementation Tasks

### Phase 1: Core System

1. [ ] Create `ralph/` directory structure
2. [ ] Create `ralph.sh` script with argument parsing
3. [ ] Create `AGENTS.md` with project-specific commands
4. [ ] Create `prompts/PROMPT_plan.md` (Claude Code)
5. [ ] Create `prompts/PROMPT_build.md` (Claude Code)
6. [ ] Create `prompts/PROMPT_plan_codex.md` (Codex)
7. [ ] Create `prompts/PROMPT_build_codex.md` (Codex)
8. [ ] Create `prompts/PROMPT_plan_work.md` (Scoped planning)

### Phase 2: Loop Logic

9. [ ] Implement CLI switching logic (claude vs codex)
10. [ ] Implement iteration loop with max-iterations
11. [ ] Implement empty plan detection
12. [ ] Implement logging to files
13. [ ] Implement git push on loop exit

### Phase 3: Spec Creation

14. [ ] Implement `spec` mode with interactive interview
15. [ ] Create spec template structure
16. [ ] Test spec creation flow

### Phase 4: E2E Integration

17. [ ] Verify Chrome tools work with Claude Code
18. [ ] Verify Playwright MCP works with Codex
19. [ ] Create sample E2E test template
20. [ ] Test E2E flow end-to-end

### Phase 5: Documentation

21. [ ] Create `ralph/README.md` with usage instructions
22. [ ] Document CLI flags and options
23. [ ] Add troubleshooting section
24. [ ] Create example workflows

---

## 11. Testing the System

### 11.1 Smoke Test

```bash
# Test spec creation
./ralph.sh spec "test feature"

# Test planning (Claude Code)
./ralph.sh plan 1

# Test planning (Codex)
./ralph.sh plan 1 --cli codex

# Test build (Claude Code)
./ralph.sh build 1

# Test build (Codex)
./ralph.sh build 1 --cli codex
```

### 11.2 Integration Test

1. Create a simple spec (e.g., "add status badge component")
2. Run planning mode
3. Verify `IMPLEMENTATION_PLAN.md` is created
4. Run build mode for 5 iterations
5. Verify commits are created
6. Verify E2E test is created and runs
7. Verify logs are created

---

## Appendix A: Key Differences Summary

| Aspect | Claude Code | Codex |
|--------|-------------|-------|
| Subagents | Up to 500 parallel Sonnet | None |
| Extended thinking | "Ultrathink" | Not available |
| E2E tool | Chrome tools | Playwright MCP |
| Prompt input | stdin | argument |
| Model flag | None (omit) | Required |
| YOLO flag | `--dangerously-skip-permissions` | `--yolo` |
| Output format | `--output-format=stream-json --verbose` | `--json` |

---

## Appendix B: Guardrail Priority Levels

The "9s system" — more 9s = higher priority:

| Level | 9s Count | Purpose |
|-------|----------|---------|
| 99999 | 5 | Documentation — capture the why |
| 999999 | 6 | Single source of truth |
| 9999999 | 7 | Git tagging on success |
| 99999999 | 8 | Debug logging allowed |
| 999999999 | 9 | Keep IMPLEMENTATION_PLAN.md current |
| 9999999999 | 10 | Update AGENTS.md with learnings |
| 99999999999 | 11 | Document bugs even if unrelated |
| 999999999999 | 12 | No placeholders/stubs |
| 9999999999999 | 13 | Clean completed items from plan |
| 99999999999999 | 14 | Fix spec inconsistencies |
| 999999999999999 | 15 | AGENTS.md operational only (CRITICAL) |
| 9999999999999999 | 16 | E2E testing required for UI tasks |
