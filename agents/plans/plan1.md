# Implementation Plan: Pipeline + Streaming UI + Demo Call Flow (Refactor)

## Goal

Deliver a fast, smooth streaming experience:
- User clicks **Search** → workspace appears immediately (tool stream left, todos right).
- Agency cards appear with names as soon as agencies are identified (no placeholder/empty cards).
- Each agency card streams its own subagent activity (separate from main agent).
- Generating state shows an in-card shimmer preview; completion shows a clear “Open Demo Page”.
- “Cancel All” stops the pipeline quickly and cleans up.
- Demo pages reliably dial the correct demo number and activate agency context before calling.

Constraints:
- No emojis in the UI or any agent-written text.
- Avoid “agents-of-agents”; only orchestrator + N subagents.
- Keep voice-call + post-call flows working end-to-end.

---

## IMPLEMENTATION STEPS

### Step 0: Documentation + Codebase Audit
**Status**: [✓] Complete

**Actions**:
- Read TypeScript Agent SDK docs and local SDK typings (`node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`).
- Review current pipeline files: `lib/claude.ts`, `app/api/pipeline/*`, `app/page.tsx`, `components/*`, `.claude/*`.

**Verifiable Outcome**:
- [✓] Confirm system uses file-based progress + SSE.
- [✓] Identify missing pieces (cancel route, workspace component, per-card streaming).

---

### Step 1: TypeScript Agent SDK Dependency Present
**Status**: [✓] Complete

**Actions**:
- Verify `@anthropic-ai/claude-agent-sdk` installed and importable.

**Verifiable Outcome**:
- [✓] `package.json` includes dependency.
- [✓] `npm ls @anthropic-ai/claude-agent-sdk --depth=0` succeeds.

---

### Step 2: Add Pipeline Session Registry + Cancel Endpoint
**Status**: [✓] Complete

**Actions**:
- Implement a server-side registry that stores the running pipeline Query handle by `sessionId`.
- Refactor `POST /api/pipeline/start` to store the Query handle.
- Add `POST /api/pipeline/cancel` that interrupts the running Query and marks the pipeline as cancelled.

**Verifiable Outcome**:
- [✓] Cancel stops the running pipeline within seconds.
- [✓] Session cleanup removes handle from memory.

---

### Step 3: Make Orchestrator Write Cards Early (Incremental Discovery)
**Status**: [✓] Complete

**Actions**:
- Update orchestrator prompt + initial pipeline JSON so:
  - The agent appends agencies one-by-one (update `pipeline-*.json` each time).
  - It creates `agency-*.json` skeleton files immediately per agency found.
  - It delays subagent spawning until `count` agencies are identified (then spawns all tasks in one message).
  - It does not do deep research; subagents do extraction + generation.

**Verifiable Outcome**:
- [✓] Cards with agency names appear progressively during search.

---

### Step 4: Rewrite SSE Stream to Separate Main vs Subagent Activity (No Poll Loop)
**Status**: [✓] Complete

**Actions**:
- Replace tight polling loop with filesystem watching + throttled reads.
- Emit distinct events:
  - `main_activity_message` (workspace left stream)
  - `subagent_activity_message` (routed to a specific `agencyId`)
  - Keep `todo_update`, `card_update`, `card_remove`, `pipeline_complete`
- Normalize streamed activity IDs (stable) and guard against suspicious placeholder timestamps.

**Verifiable Outcome**:
- [✓] Activity messages stream with minimal latency and no polling hot-loop.
- [✓] Frontend routes subagent activity to the correct card.

---

### Step 5: Redesign Frontend Layout (Workspace + Card Streaming)
**Status**: [✓] Complete

**Actions**:
- Add `components/MainAgentWorkspace.tsx`:
  - Two-column layout (tool stream left, todos right).
  - Sticky behavior while running.
  - “Cancel All” button.
- Update `app/page.tsx` to consume new SSE event types.
- Update `components/AgencyCard.tsx`:
  - Mini todo list (Extract info, Generate page).
  - Expanded per-card subagent stream by default.
  - Shimmer preview while generating; completion overlay with “Open Demo Page”.

**Verifiable Outcome**:
- [✓] Workspace renders immediately on Search.
- [✓] Per-card streaming stays inside each card (not in main feed).
- [✓] No placeholder/empty cards are pre-rendered.

---

### Step 6: Rewrite Agency Processor Agent + Skill (Clarity + Frontend-Design Integration)
**Status**: [✓] Complete

**Actions**:
- Rewrite `.claude/agents/agency-processor.md` for clarity:
  - Strict phases, explicit file writes, no emojis, no spawning further tasks.
  - No browser-side calls to `/api/webhook/*`.
- Rewrite `.claude/skills/agency-processor/SKILL.md`:
  - Clear inputs/outputs, strict schema, step checklist, error handling, minimal tool calls.
  - Explicitly use `frontend-design` skill for HTML aesthetics.
  - Enforce demo call CTA behavior and demo number.

**Verifiable Outcome**:
- [✓] Subagents have a stricter contract (progress + activity + HTML + agency JSON).
- [✓] Demo pages produced by subagents avoid incorrect browser-side webhook calls.

---

### Step 7: Final Validation (Build + Smoke Checks)
**Status**: [✓] Complete

**Actions**:
- Run `npm run build`.
- Run a smoke: start dev server, hit:
  - `POST /api/pipeline/start`
  - `GET /api/pipeline/stream?session=...`
  - `POST /api/pipeline/cancel`

**Verifiable Outcome**:
- [✓] Build succeeds with zero TypeScript errors.
- [✓] Pipeline start/stream/cancel behave correctly.

---

### Step 8: Fix Demo Call Flow (Correct Number + Context Activation)
**Status**: [✓] Complete

**Actions**:
- Enforce a single demo number across the system:
  - Display: `04832945767`
  - Dial: `+614832945767`
- Ensure demo pages register context before dialing (mobile + desktop):
  - `POST /api/register-call` using `sendBeacon` / `fetch(keepalive: true)`
  - Rewrite any `tel:` links to dial the demo number
- Ensure “legacy” demo pages (older generated HTML) still work:
  - Patch `registerForCall()` / “Book Your Demo Call” style CTAs to dial via the call bar.
- Inject demo-call script + minimal agency context into `/demo/[slug]` runtime.

**Verifiable Outcome**:
- [✓] Clicking any call CTA triggers `POST /api/register-call`.
- [✓] Calling uses the correct number and personalization webhook returns the selected agency.

---

### Step 9: Prevent Static HTML Bypass + Remove Hydration Noise
**Status**: [✓] Complete

**Actions**:
- Add a Next.js `proxy.ts` that redirects:
  - `/demo/<slug>.html` → `/demo/<slug>`
  - `/call/<id>.html` → `/call/<id>`
  This prevents bypassing runtime injection via `public/*.html` paths.
- Suppress hydration warnings for raw HTML render wrappers.

**Verifiable Outcome**:
- [✓] Visiting `/demo/*.html` always redirects to `/demo/*`.
- [✓] Demo pages no longer emit hydration mismatch errors in dev overlay.

---

### Step 10: Call Context Smoke Validation
**Status**: [✓] Complete

**Actions**:
- Verify context registration + personalization:
  - `POST /api/register-call` → returns demo phone and context id
  - `POST /api/webhook/personalize` → returns agency variables and custom first message

**Verifiable Outcome**:
- [✓] `agency_name` in personalize response matches the demo page’s agency.
- [✓] `demo_page_url` matches `/demo/<agencyId>`.

---

## VALIDATION CHECKLIST (No Formal E2E)

- [✓] Search shows workspace immediately, cards appear progressively with names (no placeholder cards).
- [✓] Main workspace shows main agent activity only.
- [✓] Each card shows only its own subagent activity; expanded by default.
- [✓] Generating shimmer is smooth; completion shows “Open Demo Page”.
- [✓] Cancel stops the run quickly without breaking the UI.
- [✓] Demo pages dial `04832945767` (E.164 `+614832945767`) and activate context before dialing.

