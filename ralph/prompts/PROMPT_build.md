0a. Study `ralph/specs/*` with up to 500 parallel Sonnet subagents to learn the feature specifications.
0b. Study @ralph/IMPLEMENTATION_PLAN.md.
0c. Study `CLAUDE.md` to understand project rules and patterns.
0d. Study @ralph/AGENTS.md for validation commands and codebase patterns.
0e. For reference: app/ (pages), components/ (UI), convex/ (backend), lib/ (shared), hooks/ (data adapters).

1. Your task is to implement functionality per the specifications using parallel subagents. Follow @ralph/IMPLEMENTATION_PLAN.md and choose the most important item to address. Before making changes, search the codebase (don't assume not implemented) using Sonnet subagents. You may use up to 500 parallel Sonnet subagents for searches/reads and only 1 Sonnet subagent for build/tests. Use Opus subagents when complex reasoning is needed (debugging, architectural decisions).

2. After implementing functionality or resolving problems, run validation:
   ```bash
   pnpm typecheck && pnpm build && pnpm lint
   ```
   If the task involves UI changes, create an E2E test in AGENTS/e2e/ and run it using Chrome tools (mcp__claude-in-chrome__*) to verify the UI works correctly. Take screenshots as evidence. Ultrathink.

3. When you discover issues, immediately update @ralph/IMPLEMENTATION_PLAN.md with your findings using a subagent. When resolved, update and remove the item.

4. When validation passes and E2E tests (if applicable) pass, update @ralph/IMPLEMENTATION_PLAN.md to mark the task complete, then:
   ```bash
   git add -A
   git commit -m "feat: descriptive message of changes"
   ```

99999. Important: When authoring documentation, capture the why — tests and implementation importance.

999999. Important: Single sources of truth, no migrations/adapters. If tests unrelated to your work fail, resolve them as part of the increment.

9999999. Follow CLAUDE.md rules strictly:
- ShadCN + Tailwind only (no other UI libraries)
- CSS variables for colors (never hardcode like bg-red-100)
- kebab-case for file names (defect-form.tsx)
- Barrel exports required (components/<feature>/index.ts)
- Max 500 lines per file (split if larger)
- Convex access only in hooks/**

99999999. You may add extra logging if required to debug issues.

999999999. Keep @ralph/IMPLEMENTATION_PLAN.md current with learnings using a subagent — future work depends on this to avoid duplicating efforts. Update especially after finishing your turn.

9999999999. When you learn something new about how to run the application, update @ralph/AGENTS.md using a subagent but keep it brief.

99999999999. For any bugs you notice, resolve them or document them in @ralph/IMPLEMENTATION_PLAN.md using a subagent even if it is unrelated to the current piece of work.

999999999999. Implement functionality completely. Placeholders and stubs waste efforts and time redoing the same work.

9999999999999. When @ralph/IMPLEMENTATION_PLAN.md becomes large periodically clean out the items that are completed from the file using a subagent.

99999999999999. If you find inconsistencies in the ralph/specs/* then use an Opus 4.5 subagent with 'ultrathink' requested to update the specs.

999999999999999. IMPORTANT: Keep @ralph/AGENTS.md operational only — status updates and progress notes belong in IMPLEMENTATION_PLAN.md. A bloated AGENTS.md pollutes every future loop's context.

9999999999999999. E2E TESTING: For UI tasks, create E2E test specs in AGENTS/e2e/ and verify using Chrome tools. Task is not complete until E2E verification passes with screenshots.

99999999999999999. After schema changes, run:
```bash
node scripts/generate-schema-manifest.mjs
node scripts/generate-operation-catalog.mjs
```
