# Ralph Autonomous Coding System

Ralph is an autonomous AI coding loop that implements features without human intervention. It supports both **Claude Code** and **OpenAI Codex** CLIs.

## Quick Start

```bash
# 1. Create a feature spec (interactive interview)
./ralph.sh spec "user authentication with OAuth"

# 2. Generate implementation plan
./ralph.sh plan

# 3. Build autonomously (max 20 iterations)
./ralph.sh build 20
```

## Commands

### Spec Creation
```bash
./ralph.sh spec "description"           # Interactive interview to create spec
```
Uses Claude Code always. Creates spec file in `ralph/specs/`.

### Planning Mode
```bash
./ralph.sh plan                         # Claude Code, unlimited
./ralph.sh plan 5                       # Max 5 iterations
./ralph.sh plan --cli codex             # Use Codex instead
```
Performs gap analysis (specs vs code) and generates `IMPLEMENTATION_PLAN.md`.

### Build Mode
```bash
./ralph.sh build                        # Claude Code, unlimited
./ralph.sh build 20                     # Max 20 iterations
./ralph.sh build --cli codex            # Use Codex
./ralph.sh build 20 --cli codex --model gpt-5.1-codex  # Custom model
```
Picks tasks from plan, implements, validates, commits. Repeats until done.

### Scoped Planning (Work Branches)
```bash
git checkout -b ralph/feature-name
./ralph.sh plan-work "specific work scope"
./ralph.sh build 20
```
Creates plan scoped to specific work only.

## CLI Options

| Option | Description |
|--------|-------------|
| `--cli claude` | Use Claude Code (default) |
| `--cli codex` | Use OpenAI Codex |
| `--model MODEL` | Codex model (default: `gpt-5.2-codex`) |
| `N` (number) | Max iterations |

## Directory Structure

```
ralph/
├── ralph.sh                # Main script
├── AGENTS.md               # Build/validation commands
├── IMPLEMENTATION_PLAN.md  # Task list (auto-generated)
├── prompts/                # Prompt templates
│   ├── PROMPT_plan.md      # Claude Code planning
│   ├── PROMPT_build.md     # Claude Code building
│   ├── PROMPT_plan_codex.md    # Codex planning
│   ├── PROMPT_build_codex.md   # Codex building
│   └── PROMPT_plan_work.md     # Scoped planning
├── specs/                  # Feature specifications
└── logs/                   # Iteration logs
```

## How It Works

### The Loop
```
┌─────────────────────────────────────────┐
│ 1. Read PROMPT + AGENTS.md + specs/*    │
│ 2. Read IMPLEMENTATION_PLAN.md          │
│ 3. Pick most important task             │
│ 4. Search codebase (don't assume)       │
│ 5. Implement task                       │
│ 6. Run validation (typecheck, build)    │
│ 7. Run E2E tests (if UI task)           │
│ 8. Update plan, commit                  │
│ 9. Exit → Fresh context → Next task     │
└─────────────────────────────────────────┘
```

### Key Principles

1. **Fresh context each iteration** — Garbage collection prevents context pollution
2. **One task per loop** — 100% "smart zone" context utilization
3. **Don't assume not implemented** — Always search before implementing
4. **Backpressure via tests** — Validation failures force fixes
5. **Plan is disposable** — Regenerate when wrong

## E2E Testing

Ralph creates E2E tests for UI tasks:
- **Claude Code:** Uses Chrome tools (`mcp__claude-in-chrome__*`)
- **Codex:** Uses Playwright MCP

Tests are created in `AGENTS/e2e/` and must pass before task completion.

## Validation Commands

```bash
pnpm typecheck        # TypeScript
pnpm build            # Next.js build
pnpm lint             # ESLint
npx convex dev --once # Convex schema sync
```

## Git Workflow

1. Commits accumulate locally during loop
2. Push happens on loop exit
3. Use work branches: `ralph/feature-name`
4. Create PR after loop completes

## Stopping the Loop

- **Ctrl+C:** Immediate stop
- **Max iterations:** `./ralph.sh build 20`
- **Empty plan:** Auto-stops when all tasks complete

## Troubleshooting

### Plan is wrong
```bash
rm ralph/IMPLEMENTATION_PLAN.md
./ralph.sh plan
```

### Ralph going in circles
1. Stop with Ctrl+C
2. Review `ralph/logs/` for patterns
3. Add guardrails to prompts
4. Regenerate plan

### Revert changes
```bash
git reset --hard HEAD
```

## See Also

- `SPECIFICATION.md` — Full technical specification
- `AGENTS.md` — Project-specific build commands
- `CLAUDE.md` — Project coding standards
