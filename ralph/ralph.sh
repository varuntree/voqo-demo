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
SPEC_DESCRIPTION=""

# -----------------------------------------------------------------------------
# Help
# -----------------------------------------------------------------------------
show_help() {
    cat << EOF
Ralph Autonomous Coding System

USAGE:
    ./ralph.sh <command> [options]

COMMANDS:
    spec "description"      Create feature spec via interactive interview
    plan                    Generate/update implementation plan
    plan-work "scope"       Create scoped plan for work branch
    build                   Build from implementation plan

OPTIONS:
    --cli <claude|codex>    CLI to use (default: claude)
    --model <model>         Codex model (default: gpt-5.2-codex)
    <number>                Max iterations

EXAMPLES:
    ./ralph.sh spec "user authentication"
    ./ralph.sh plan
    ./ralph.sh plan --cli codex
    ./ralph.sh build 20
    ./ralph.sh build --cli codex --model gpt-5.1-codex
    ./ralph.sh plan-work "OAuth integration"

EOF
    exit 0
}

# -----------------------------------------------------------------------------
# Argument Parsing
# -----------------------------------------------------------------------------
parse_args() {
    [[ $# -eq 0 ]] && show_help

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                show_help
                ;;
            spec)
                MODE="spec"
                shift
                if [[ $# -gt 0 && ! "$1" =~ ^-- ]]; then
                    SPEC_DESCRIPTION="$1"
                    shift
                fi
                ;;
            plan)
                MODE="plan"
                shift
                ;;
            plan-work)
                MODE="plan-work"
                shift
                if [[ $# -gt 0 && ! "$1" =~ ^-- ]]; then
                    WORK_SCOPE="$1"
                    shift
                else
                    echo "Error: plan-work requires a scope description"
                    exit 1
                fi
                ;;
            build)
                MODE="build"
                shift
                ;;
            --cli)
                shift
                if [[ $# -gt 0 ]]; then
                    CLI="$1"
                    if [[ "$CLI" != "claude" && "$CLI" != "codex" ]]; then
                        echo "Error: --cli must be 'claude' or 'codex'"
                        exit 1
                    fi
                    shift
                else
                    echo "Error: --cli requires a value"
                    exit 1
                fi
                ;;
            --model)
                shift
                if [[ $# -gt 0 ]]; then
                    MODEL="$1"
                    shift
                else
                    echo "Error: --model requires a value"
                    exit 1
                fi
                ;;
            [0-9]*)
                MAX_ITERATIONS="$1"
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
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
            if [[ "$cli" == "codex" ]]; then
                echo "prompts/PROMPT_plan_codex.md"
            else
                echo "prompts/PROMPT_plan.md"
            fi
            ;;
        plan-work)
            echo "prompts/PROMPT_plan_work.md"
            ;;
        build)
            if [[ "$cli" == "codex" ]]; then
                echo "prompts/PROMPT_build_codex.md"
            else
                echo "prompts/PROMPT_build.md"
            fi
            ;;
    esac
}

# -----------------------------------------------------------------------------
# Run Single Iteration
# -----------------------------------------------------------------------------
run_iteration() {
    local prompt_file="$1"
    local iteration="$2"
    local log_file="$RALPH_DIR/logs/iteration-$(printf '%03d' "$iteration").jsonl"

    mkdir -p "$RALPH_DIR/logs"

    if [[ "$CLI" == "claude" ]]; then
        # Claude Code: stdin input
        if [[ "$MODE" == "plan-work" ]]; then
            WORK_SCOPE="$WORK_SCOPE" envsubst '$WORK_SCOPE' < "$RALPH_DIR/$prompt_file" | \
                claude -p \
                    --dangerously-skip-permissions \
                    --output-format=stream-json \
                    --verbose \
                2>&1 | tee "$log_file"
        else
            cat "$RALPH_DIR/$prompt_file" | \
                claude -p \
                    --dangerously-skip-permissions \
                    --output-format=stream-json \
                    --verbose \
                2>&1 | tee "$log_file"
        fi
    else
        # Codex: prompt as argument
        local prompt_content
        if [[ "$MODE" == "plan-work" ]]; then
            prompt_content=$(WORK_SCOPE="$WORK_SCOPE" envsubst '$WORK_SCOPE' < "$RALPH_DIR/$prompt_file")
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

    # No plan file = not empty (needs creation)
    [[ ! -f "$plan_file" ]] && return 1

    # Check for unchecked items [ ]
    if grep -qE '^\s*[-*]\s+\[[ ]\]' "$plan_file" 2>/dev/null; then
        return 1  # Has unchecked items
    fi

    # Check for bullet points that look like tasks (start with capital letter)
    if grep -qE '^\s*[-*]\s+[A-Z][^[]*$' "$plan_file" 2>/dev/null; then
        return 1  # Has task-like bullets without checkboxes
    fi

    # Check for numbered items
    if grep -qE '^\s*[0-9]+\.\s+' "$plan_file" 2>/dev/null; then
        # Has numbered items - check if any are not marked done
        if ! grep -qE '^\s*[0-9]+\.\s+.*\[x\]' "$plan_file" 2>/dev/null; then
            return 1  # Has numbered items not marked done
        fi
    fi

    return 0  # Plan appears empty/complete
}

# -----------------------------------------------------------------------------
# Spec Creation Mode
# -----------------------------------------------------------------------------
run_spec_mode() {
    if [[ -z "$SPEC_DESCRIPTION" ]]; then
        echo "Error: spec requires a description"
        echo "Usage: ./ralph.sh spec \"feature description\""
        exit 1
    fi

    # Generate filename from description
    local spec_filename
    spec_filename=$(echo "$SPEC_DESCRIPTION" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
    spec_filename="${spec_filename:0:50}"  # Limit length

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Mode:        spec (interactive interview)"
    echo "CLI:         claude (always)"
    echo "Description: $SPEC_DESCRIPTION"
    echo "Output:      ralph/specs/${spec_filename}.md"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    cd "$PROJECT_ROOT"

    # Spec creation always uses Claude Code (interactive, not headless)
    claude "You are helping create a feature specification for the Ralph autonomous coding system.

The user wants to implement: $SPEC_DESCRIPTION

Interview the user using AskUserQuestion to understand:
1. What is the core functionality needed?
2. What are the acceptance criteria?
3. What UI components are involved (if any)?
4. What backend/Convex changes are needed (if any)?
5. What are the edge cases?

After gathering requirements, create a specification file at:
ralph/specs/${spec_filename}.md

Use this format:

# Feature: [Title]

## Summary
[1-3 sentences describing the feature]

## Scope

### In Scope
- [bullet points of what will be built]

### Out of Scope
- [bullet points of what will NOT be built]

## Acceptance Criteria
- [ ] [Specific, testable criterion]
- [ ] [Another criterion]
- [ ] typecheck passes
- [ ] build passes

## Solution Design

### Data Model
[If applicable - Convex schema changes]

### Backend
[Convex functions needed]

### Frontend
[Components and pages needed]

## E2E Test Requirements
[Describe what E2E tests should verify - UI interactions, form submissions, etc.]

## Relevant Files
[List files that will be created or modified]

---

Remember to follow CLAUDE.md rules:
- ShadCN + Tailwind only for UI
- kebab-case for files
- Barrel exports in components
- Max 500 lines per file
- CSS variables for colors
"
}

# -----------------------------------------------------------------------------
# Main Loop
# -----------------------------------------------------------------------------
run_loop() {
    local prompt_file
    prompt_file=$(get_prompt_file "$MODE" "$CLI")

    if [[ ! -f "$RALPH_DIR/$prompt_file" ]]; then
        echo "Error: $prompt_file not found"
        echo "Run from the ralph directory or ensure prompts exist"
        exit 1
    fi

    local current_branch
    current_branch=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "unknown")

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
            echo ""
            echo "Warning: plan-work is intended for work branches, not main/master"
            echo "Consider: git checkout -b ralph/your-feature"
            echo ""
            read -p "Continue anyway? [y/N] " -n 1 -r
            echo
            [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
        fi
    fi

    local iteration=0

    cd "$PROJECT_ROOT"

    echo ""
    echo "Starting Ralph loop... (Ctrl+C to stop)"
    echo ""

    while true; do
        # Check max iterations
        if [[ "$MAX_ITERATIONS" -gt 0 && "$iteration" -ge "$MAX_ITERATIONS" ]]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Reached max iterations: $MAX_ITERATIONS"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            break
        fi

        # Check empty plan (build mode only, after first iteration)
        if [[ "$MODE" == "build" && "$iteration" -gt 0 ]] && is_plan_empty; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "IMPLEMENTATION_PLAN.md appears complete!"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            break
        fi

        iteration=$((iteration + 1))
        echo ""
        echo "======================== ITERATION $iteration ========================"
        echo ""

        # Run iteration
        if ! run_iteration "$prompt_file" "$iteration"; then
            echo ""
            echo "Warning: Iteration $iteration exited with error. Continuing..."
        fi

        echo ""
        echo "======================== ITERATION $iteration COMPLETE ========================"
        echo ""
    done

    # Push on loop exit
    echo ""
    echo "Pushing changes to remote..."
    current_branch=$(git -C "$PROJECT_ROOT" branch --show-current 2>/dev/null || echo "unknown")

    if [[ "$current_branch" != "unknown" ]]; then
        git -C "$PROJECT_ROOT" push origin "$current_branch" 2>/dev/null || {
            echo "Creating remote branch..."
            git -C "$PROJECT_ROOT" push -u origin "$current_branch" 2>/dev/null || {
                echo "Note: Could not push (no remote or not a git repo)"
            }
        }
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Ralph loop completed"
    echo "Iterations: $iteration"
    echo "Logs:       $RALPH_DIR/logs/"
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
