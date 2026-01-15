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

Combined validation command:
```bash
pnpm typecheck && pnpm build && pnpm lint
```

## Post-Schema Changes

After modifying `convex/schema.ts`:
```bash
node scripts/generate-schema-manifest.mjs
node scripts/generate-operation-catalog.mjs
```

## E2E Testing

- **Claude Code:** Use Chrome tools (`mcp__claude-in-chrome__*`)
- **Codex:** Use Playwright MCP
- **Test specs location:** `AGENTS/e2e/`
- Always take screenshots as evidence

## Codebase Patterns

- **Files:** kebab-case (`defect-form.tsx`)
- **Types:** PascalCase (`DefectStatus`)
- **Functions:** camelCase (`createDefect`)
- **Constants:** SCREAMING_SNAKE (`DEFECT_STATUSES`)
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

## Key Directories

```
app/           # Next.js pages (thin composition)
components/    # React components (props-first)
convex/        # Backend (schema, functions, domains)
lib/           # Shared code (types, constants, utils)
hooks/         # Data adapters (ONLY place for api.* imports)
```

## Documentation References

- `CLAUDE.md` — Mandatory project rules
- `AGENTS/documentation/SCHEMA.md` — Database tables
- `AGENTS/documentation/API.md` — Backend functions
- `AGENTS/documentation/FEATURES.md` — Routes & features
- `AGENTS/documentation/COMPONENTS.md` — UI inventory
