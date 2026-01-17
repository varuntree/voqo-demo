# VoqoLeadEngine — Full Codebase Review & Analysis (report1)

Date: 2026-01-17  
Repo: `/Users/varunprasad/code/prjs/voqo-demo`  
Git commit reviewed: `201ba945fc9620cdef73c3e44656f569276ef278`  

CRITICAL CONSTRAINT (from request): This report is analysis-only. No code changes were made while producing it.

---

## 0) What I Did (Traceability)

1. Enumerated the full tracked file tree via `git ls-files`.
2. Read all required spec files in `specs/`:
   - `specs/SPEC-ARCHITECTURE.md`
   - `specs/SPEC-DATA-API.md`
   - `specs/SPEC-PIPELINE.md`
   - `specs/SPEC-VOICE-AGENT.md`
   - `specs/DEPLOYMENT.md`
3. Reviewed the full implementation across `app/`, `lib/`, `components/`, `public/`, and `.claude/`.
4. Mapped modules, files, responsibilities, and connections.
5. Enumerated edge cases, failure points, and simplification opportunities.

---

## 1) Complete Tracked File Tree (from `git ls-files`)

```text
.gitignore
AGENTS.md
CLAUDE.md
README.md
next.config.ts
package-lock.json
package.json
postcss.config.mjs
proxy.ts
spec.md
tsconfig.json
.claude/
  agents/
    agency-processor.md
  commands/
    build.md
    plan.md
    prime.md
  skills/
    agency-processor/
      SKILL.md
    frontend-design/
      SKILL.md
    postcall-page-builder/
      SKILL.md
agents/
  plans/
    plan1.md
    silo-plan-pipeline-persistence-and-history.md
app/
  favicon.ico
  globals.css
  layout.tsx
  page.tsx
  api/
    agency-calls/
      route.ts
    call-status/
      route.ts
    calls/
      route.ts
      [callId]/
        route.ts
      stream/
        route.ts
      stream-detail/
        route.ts
    generate-demo/
      route.ts
    history/
      route.ts
      [sessionId]/
        route.ts
    pipeline/
      cancel/
        route.ts
      start/
        route.ts
      state/
        route.ts
      stream/
        route.ts
    register-call/
      route.ts
    search/
      route.ts
    webhook/
      call-complete/
        route.ts
      personalize/
        route.ts
  call/
    [id]/
      not-found.tsx
      page.tsx
  demo/
    [slug]/
      not-found.tsx
      page.tsx
  history/
    [sessionId]/
      page.tsx
components/
  ActivityMessage.tsx
  AgencyCard.tsx
  AgentActivityPanel.tsx
  CallDetailModal.tsx
  CallsPanel.tsx
  HistoryCard.tsx
  HistoryList.tsx
  HistorySessionReplay.tsx
  MainAgentWorkspace.tsx
  MockPreview.tsx
  SettingsModal.tsx
  ShimmerPreview.tsx
  StepList.tsx
  TabNavigation.tsx
  TodoPanel.tsx
data/
  history/
    .gitkeep
  progress/
    .gitkeep
lib/
  agency-calls.ts
  claude.ts
  history.ts
  ids.ts
  phone.ts
  pipeline-registry.ts
  postcall-queue.ts
  progress-cleanup.ts
  sms-queue.ts
  twilio.ts
  types.ts
  server/
    activity.ts
plans/
  .gitkeep
  phase-1.md
  phase-10.md
  phase-12.1.md
  phase-12.2.md
  phase-12.md
  phase-2.md
  phase-3.md
  phase-4.md
  phase-5.md
  phase-6.md
  phase-7.md
  phase-8.md
public/
  file.svg
  globe.svg
  next.svg
  vercel.svg
  voqo-demo-call.js
  window.svg
specs/
  DEPLOYMENT.md
  SPEC-ARCHITECTURE.md
  SPEC-DATA-API.md
  SPEC-PIPELINE.md
  SPEC-VOICE-AGENT.md
  silo-plan-voice-agent-settings.md
```

---

## 2) Architecture Map (End-to-End)

### 2.1 Core principle
This system is a **single Next.js app** that serves UI + API routes, backed by **file-based storage** in `data/` and generated static HTML in `public/`. “AI work” is executed via the **Claude Agent SDK / Claude Code**, and the live voice agent is hosted in **ElevenLabs** with telephony via **Twilio**.

### 2.2 High-level component diagram

```text
Browser (Next.js UI)
  |
  | 1) Search + start pipeline
  v
POST /api/pipeline/start  -------------------> Claude Agent SDK query() (orchestrator)
  |                                              |
  | writes progress JSON files                    | spawns Task subagents
  v                                              v
data/progress/pipeline-{sessionId}.json     Subagents: .claude/skills/agency-processor
data/progress/activity-{sessionId}.json       |
data/progress/agency-{agencyId}.json          | writes
data/progress/agency-activity-{agencyId}.json v
                                             public/demo/{agencyId}.html
                                             data/agencies/{agencyId}.json
  ^
  | 2) Stream progress (SSE)
  |
GET /api/pipeline/stream?session={sessionId}
  | (fs.watch data/progress/*, emit SSE deltas)
  v
UI renders workspace + cards + per-card activity

---------------------------------------------------------------------------
Demo call flow

Browser loads /demo/{slug}
  |
  | reads public/demo/{slug}.html, injects /public/voqo-demo-call.js
  v
Callbar click -> POST /api/register-call  (sendBeacon/keepalive)
  |
  | writes/updates data/context/pending-calls.json (TTL)
  v
User dials Twilio number -> ElevenLabs agent
  |
  | (pre-call)
  v
POST /api/webhook/personalize  (ElevenLabs)
  |
  | reads pending-calls.json; returns dynamic variables (+ overrides)
  v
Voice conversation happens in ElevenLabs
  |
  | (post-call)
  v
POST /api/webhook/call-complete (ElevenLabs)
  |
  | writes data/calls/{callId}.json + data/agency-calls/{agencyId}.json
  | enqueues job: data/jobs/postcall/{callId}.json
  v
Postcall worker (file queue):
  - invokes Claude Code to write public/call/{callId}.html
  - updates data/calls/{callId}.json (pageStatus/pageUrl/extractedData)
  - enqueues SMS job: data/jobs/sms/{callId}.json
  v
SMS worker -> Twilio -> SMS with link /call/{callId}

UI: Calls panel streams call updates via SSE:
GET /api/calls/stream?session={sessionId}
GET /api/calls/stream-detail?callId={callId}
```

### 2.3 Deployment shape (as specified)
`specs/DEPLOYMENT.md` describes a DigitalOcean VPS running:
- Node 20, PM2, Nginx, Certbot
- Next.js app served behind Nginx
- Data persistence requirement: deploys must preserve `data/` and generated HTML under `public/demo` and `public/call`.

---

## 3) Runtime Storage Model (What Exists vs What’s Tracked)

### 3.1 Git tracking vs runtime output
- Tracked:
  - `data/history/.gitkeep`, `data/progress/.gitkeep` only.
  - Generated HTML dirs are intentionally not tracked.
- Ignored by `.gitignore`:
  - `data/**` (except `.gitkeep`)
  - `public/demo/**`
  - `public/call/**`

### 3.2 Effective storage conventions (from specs + code)
The “DB” is the filesystem:
- Pipeline:
  - `data/progress/pipeline-{sessionId}.json`
  - `data/progress/activity-{sessionId}.json`
  - `data/progress/agency-{agencyId}.json`
  - `data/progress/agency-activity-{agencyId}.json`
- Call context:
  - `data/context/pending-calls.json` (TTL-based)
- Calls:
  - `data/calls/{callId}.json`
  - `data/progress/activity-postcall-{callId}.json` (postcall Claude hooks)
- History:
  - `data/history/sessions.json`
  - `data/history/sessions/{sessionId}.json`
- Jobs:
  - `data/jobs/postcall/{callId}.json` and `.processing`
  - `data/jobs/sms/{callId}.json` and `.processing`
- Generated HTML:
  - `public/demo/{agencyId}.html`
  - `public/call/{callId}.html`

---

## 4) System-by-System Analysis (Implementation-Faithful)

This section maps each subsystem to: entrypoints, files, data flow, and notable behaviors.

### 4.1 System: Agency pipeline (search + subagents + demo HTML generation)

**Primary entrypoint:** `app/api/pipeline/start/route.ts`  
**Supporting:** `.claude/skills/agency-processor/SKILL.md`, `.claude/agents/agency-processor.md`, `lib/pipeline-registry.ts`, `lib/history.ts`

**What it does**
- Receives `{ suburb, count }`.
- Initializes `pipeline-{sessionId}.json` and `activity-{sessionId}.json`.
- Builds a strict orchestrator prompt instructing Claude to:
  - WebSearch agencies (fast, no WebFetch at orchestrator stage)
  - Write skeleton `agency-{agencyId}.json` incrementally
  - Spawn N parallel Task subagents (type `agency-processor`)
  - Update pipeline todos and final status
- Starts an Agent SDK `query()` and drains it in a background async loop so the pipeline continues after the HTTP response returns.
- Stores the Query handle in an in-memory registry keyed by `sessionId` (`lib/pipeline-registry.ts`) to enable cancellation.
- Persists the run to history at completion (or error/cancel) via `persistSessionToHistory`.

**Notable behaviors / coupling**
- Tool-stream UI messages are derived from “tool_use” blocks in assistant messages (manual extraction) rather than Agent SDK hooks.
- The orchestrator prompt explicitly forbids emojis and deep research.
- The subagents are expected to do extraction + generation and write their own progress and activity streams.

**Where it can fail**
- If Claude Code / Agent SDK cannot run in the server environment, the pipeline will create initial files then stall.
- If subagents fail to follow the file write contracts, UI cards may remain stale or never reach complete.
- Since it’s unauthenticated, the endpoint can be triggered by anyone (cost/abuse risk).

### 4.2 System: Pipeline streaming (SSE over filesystem progress)

**Entrypoint:** `app/api/pipeline/stream/route.ts`

**What it does**
- Accepts `?session=...`, validates with `isSafeSessionId`.
- Creates an SSE `ReadableStream`.
- Uses `fs.watch(PROGRESS_DIR)` to react to changes in:
  - `pipeline-{sessionId}.json` (todos/status/agencyIds)
  - `activity-{sessionId}.json` (main stream)
  - `agency-{agencyId}.json` (card content/status)
  - `agency-activity-{agencyId}.json` (per-card stream)
- Debounces reads, computes JSON-string hashes to avoid re-emitting identical payloads.
- Emits event objects like:
  - `todo_update`, `card_update`, `card_remove`, `main_activity_message`, `subagent_activity_message`, `pipeline_complete`
- Reconciles state:
  - If an agency HTML exists but the progress file isn’t complete, it “reconciles” by writing `status=complete`, `demoUrl=/demo/{id}`, `htmlProgress=100`.
  - If all agencies are complete/error but pipeline status is still processing, it writes pipeline status to complete and emits completion.
- Writes history entry on terminal completion (`addToHistory`).

**Notable behaviors / coupling**
- This SSE endpoint is a “truth reconciler”: it can mutate progress files (reconciliation).
- It assumes local filesystem semantics and `fs.watch` reliability.
- It uses stable message IDs (`lib/server/activity.ts`) to dedupe/avoid duplicate delivery during reconnects.

**Where it can fail**
- `fs.watch` can miss events under load; fallback behaviors exist but are best-effort.
- If progress files are large/corrupt, JSON.parse can fail, silently dropping updates.
- If deployed behind a proxy without SSE-friendly settings (buffering/timeouts), clients may appear stuck.

### 4.3 System: Pipeline cancellation

**Entrypoint:** `app/api/pipeline/cancel/route.ts`

**What it does**
- Accepts `{ sessionId }`.
- If a running query exists in `getPipelineRuns()`, calls `query.interrupt()` and marks run as cancelled.
- Writes cancellation into:
  - `data/progress/pipeline-{sessionId}.json` (status cancelled, completedAt set, todos adjusted)
  - `data/progress/activity-{sessionId}.json` (adds a warning message)
- Saves a durable history snapshot (`data/history/sessions/{sessionId}.json`) and updates the history index (`data/history/sessions.json`).

**Where it can fail**
- If interrupt fails, the query may continue running while files claim cancelled.
- If pipeline files don’t exist (early failure), cancel becomes a no-op for persistence.

### 4.4 System: Pipeline state snapshot + history persistence

**Entrypoints:**  
- `app/api/pipeline/state/route.ts` (rehydration snapshot)  
- `app/api/history/route.ts` (history index)  
- `app/api/history/[sessionId]/route.ts` (session detail + rename)  
- `lib/history.ts` (read/write helpers, building session summaries)

**What it does**
- State snapshot:
  - Loads pipeline file, associated agency progress, main activity, and per-agency activity.
  - Normalizes activity message IDs and suspicious timestamps (see `lib/server/activity.ts`).
  - Returns a single JSON payload to rehydrate the UI after reload.
- History:
  - Index: `data/history/sessions.json` max 50 entries (kept newest-first).
  - Detail: `data/history/sessions/{sessionId}.json` stores a replay snapshot.
  - Rename: PATCH updates both index entry and detail snapshot name.

**Where it can fail**
- Index/detail writes are not atomic with locking; concurrent writes can cause lost updates or corrupt JSON.
- Session summaries are built by reading per-agency progress files; if those are missing/corrupt, summary accuracy degrades.

### 4.5 System: Demo page serving + runtime injection (callbar)

**Entrypoints:**  
- `app/demo/[slug]/page.tsx`  
- `public/voqo-demo-call.js`  
- `proxy.ts` (redirect `.html` to dynamic routes)

**What it does**
- `app/demo/[slug]/page.tsx` reads `public/demo/{slug}.html`.
- It optionally reads `data/agencies/{slug}.json` to produce a minimal agency object for call context.
- It injects:
  - a config `<script>` setting `window.__VOQO_DEMO_PHONE__`, `window.__VOQO_AGENCY__`, and optional `window.__VOQO_SESSION_ID__`
  - `<script src="/voqo-demo-call.js" defer></script>`
- `public/voqo-demo-call.js`:
  - Renders a fixed “Call bar” overlay.
  - On “Call now”:
    - reads localStorage voice settings (`voqo:voiceAgentSettings`)
    - sends `POST /api/register-call` via `sendBeacon` (preferred) or `fetch(... keepalive: true)`
    - then navigates to `tel:` using the enforced demo number returned by the server.
  - Also patches legacy pages:
    - rewrites `tel:` anchors to demo number
    - installs `window.registerForCall()` to dial
    - installs `window.registerDemoCall()` to poll `/api/call-status?agency=...` and navigate to generated `/call/{id}`
    - patches some legacy number strings in DOM
- `proxy.ts`:
  - Redirects `/demo/*.html` to `/demo/*` and `/call/*.html` to `/call/*` so dynamic injection can’t be bypassed.

**Where it can fail**
- If the demo HTML is malformed (no `</head>`/`</body>`), injection falls back to append-at-end; usually fine but not guaranteed.
- If the callbar script is blocked by CSP (not currently set), call activation fails.
- Desktop “tel:” navigation may not dial; code re-enables button after a delay, but the demo experience may appear inconsistent.

### 4.6 System: Register call context (pre-call)

**Entrypoint:** `app/api/register-call/route.ts`

**What it does**
- Accepts JSON via raw text parse (to support sendBeacon).
- Supports multiple payload shapes; normalizes to `agencyData + timestamp`, and optionally `settings` and `sessionId`.
- Reads `data/context/pending-calls.json` (if present), deletes expired contexts, inserts a new context record:
  - `status: "pending"`
  - `expiresAt = now + 5 min`
- Returns `{ contextId, expiresAt, phoneNumber, displayPhoneNumber }` using `lib/phone.ts` enforcement.

**Where it can fail**
- Concurrency: multiple writes can race (read-modify-write without lock).
- Partial/corrupt JSON in `pending-calls.json` causes a reset to `{}` (implicit data loss).

### 4.7 System: ElevenLabs personalization webhook (pre-call)

**Entrypoint:** `app/api/webhook/personalize/route.ts`

**What it does**
- Loads `data/context/pending-calls.json`.
- Matching strategy implemented:
  1) prefer “recent active” contexts (status active, activated within 5 minutes)
  2) else choose the most recent pending, non-expired context
  3) else fallback to any non-expired context with agency data
  4) else fallback to DEFAULT_AGENCY
- If it matches a pending context, it marks it active and stores `callerId`, `callSid`, `activatedAt`.
- Responds with ElevenLabs expected payload:
  - `type: conversation_initiation_client_data`
  - `dynamic_variables` containing agency and context fields
  - optional `conversation_config_override`:
    - if context has `settings`, substitutes variables in the templates and returns custom prompt + first_message
    - else returns a legacy first_message override for non-default agencies

**Key mismatches vs spec**
- The specs mention signature verification; this route performs **no webhook signature validation**.
- The specs list matching priorities: context_id, callSid, callerId, then fallback. This route does not match by context_id and does not use callSid/callerId to select the context (it primarily uses “most recent pending” / “recent active”).

**Where it can fail**
- If multiple demos are opened and calls initiated close together, “most recent pending” can mis-associate the wrong agency to the caller.
- If `pending-calls.json` is corrupted, all context matching collapses to default.
- Extremely verbose logging may leak PII into logs and can degrade server performance under load.

### 4.8 System: ElevenLabs call complete webhook (post-call)

**Entrypoint:** `app/api/webhook/call-complete/route.ts`

**What it does**
- Starts/ensures background workers: `ensurePostcallWorker()` and `ensureSmsWorker()`.
- Reads raw body for signature verification.
- Signature verification implementation:
  - In non-production (`NODE_ENV !== 'production'`), verification is skipped (returns true).
  - In production:
    - if secret or signature missing, it still “skips verification” by returning true.
    - otherwise computes HMAC-SHA256 over `timestamp.payload` and compares with timingSafeEqual.
- It only processes events where `type === 'post_call_transcription'`.
- Finds a matching pending context using:
  1) context_id if present
  2) callSid match
  3) callerId match (active only)
  4) most recent pending (including not-expired)
- Writes call record `data/calls/{callId}.json` with transcript, summary, and `pageStatus: generating`.
- Updates context to `completed` if matched.
- Appends agency call history (`data/agency-calls/{agencyId}.json`) as “generating”.
- Enqueues postcall job `data/jobs/postcall/{callId}.json` with a prompt instructing Claude to:
  - parse transcript
  - find listings
  - write `public/call/{callId}.html`
  - update call JSON with extracted data + page completion fields

**Key mismatches vs spec**
- The spec calls for signature validation in production and 401 on failure; the code currently allows production webhooks through even if secret/signature is missing.
- Logging prints full headers and body (PII risk).

**Where it can fail**
- If webhook is retried or duplicated, multiple call records may be created (new callId each time) and multiple postcall jobs may be enqueued.
- If context matching is wrong, call records and follow-up pages/SMS can be associated with the wrong agency.
- If Claude job fails or times out, call remains “generating” until retries exhausted.

### 4.9 System: Post-call job queue + worker

**Entrypoint library:** `lib/postcall-queue.ts`  
**Triggered by:** `ensurePostcallWorker()` (webhook + some APIs), plus ad-hoc `processPostcallJobsOnce()` in call-related endpoints.

**What it does**
- Queue files: `data/jobs/postcall/{callId}.json` -> atomically renamed to `.processing` when picked up.
- Runs every 5 seconds in an interval when worker is started.
- For each job:
  - increments attempts
  - if attempts exceed 3: logs error, marks call failed, deletes job
  - if output already exists (`public/call/{callId}.html` and call JSON says completed): finalizes without rerunning (idempotency optimization)
  - otherwise runs `invokeClaudeCode(...)` with a 5-minute timeout, using activity hooks that write to `data/progress/activity-postcall-{callId}.json`
  - checks output HTML exists; if missing, re-queues the job
  - on success: marks call JSON as completed and enqueues SMS job

**Where it can fail**
- Multiple Next.js server processes (or multiple instances) can each run the interval worker, leading to concurrency amplification. The rename-lock reduces but does not remove cross-process duplication risks (especially if different disks/containers).
- If the filesystem is slow or permissions are wrong, rename/unlink can fail, leaving jobs stuck in `.processing`.
- Claude may generate the HTML but not update call JSON; worker tries to reconcile, but requires call JSON to reflect completion for `isPostcallOutputReady`.

### 4.10 System: SMS queue + worker (Twilio)

**Entrypoint library:** `lib/sms-queue.ts`  
**Twilio:** `lib/twilio.ts`

**What it does**
- `enqueueSmsJob(callId)` writes `data/jobs/sms/{callId}.json` with `flag: 'wx'` to dedupe.
- Worker every 5 seconds:
  - claims jobs by rename -> `.processing`
  - reads call JSON; only sends SMS when `pageStatus === 'completed'` and `pageUrl` and `callerPhone` exist
  - builds `fullUrl` using `NEXT_PUBLIC_APP_URL` fallback `http://localhost:3000`
  - calls `sendSMS(normalizePhoneNumber(to), message)`
  - writes call JSON `sms` fields (and legacy `smsSentAt`)
  - retry up to 5 attempts; then logs and marks failed

**Where it can fail**
- If Twilio env vars are missing/invalid, SMS send will fail (or potentially throw at client init).
- Phone normalization is best-effort; non-AU inputs might normalize incorrectly to `+<digits>` and be rejected.
- If `NEXT_PUBLIC_APP_URL` is misconfigured, SMS links can point to localhost or incorrect domains.

### 4.11 System: Calls APIs + calls streaming + call detail modal

**Entrypoints:**  
- `app/api/calls/route.ts` (list)  
- `app/api/calls/stream/route.ts` (SSE list)  
- `app/api/calls/[callId]/route.ts` (detail + postcall activity)  
- `app/api/calls/stream-detail/route.ts` (SSE detail)  
- `components/CallsPanel.tsx`, `components/CallDetailModal.tsx`

**What it does**
- Lists and streams calls by reading `data/calls/*.json` (newest-first), with optional session filtering.
- Ensures best-effort progress by triggering `processPostcallJobsOnce()` and `processSmsJobsOnce()` on read paths.
- Detail endpoints also read `data/progress/activity-postcall-{callId}.json` and normalize activity IDs.
- UI:
  - Calls panel is toggled from the workspace.
  - Selecting a call opens modal with transcript and streaming postcall activity.

**Where it can fail**
- Large number of call JSON files increases filesystem scan overhead (list endpoints read up to 100 files).
- Corrupt call files are ignored in list endpoints but can break `call-status` which parses without per-file try/catch.

---

## 5) Annotated File-by-File Map (Every Tracked File)

This is the “every file, every module” map for the tracked repository contents.

### Root
- `.gitignore`: Excludes runtime data (`data/**`) and generated HTML (`public/demo/**`, `public/call/**`), plus typical Node/Next artifacts.
- `AGENTS.md`: Operational runbook (build/run/validation commands, structure, gotchas).
- `CLAUDE.md`: Project overview and creative guidelines for generated HTML.
- `README.md`: Default create-next-app content (not project-specific).
- `next.config.ts`: Minimal Next config placeholder.
- `package.json`: Next 16 + React 19 + Twilio + Anthropic Agent SDK dependency.
- `package-lock.json`: Dependency lockfile.
- `postcss.config.mjs`: Tailwind v4 postcss plugin config.
- `proxy.ts`: Next middleware-like proxy that redirects `.html` under `/demo` and `/call` to the dynamic routes to prevent bypassing runtime injection.
- `spec.md`: Large overarching “hackathon spec” + implementation notes (superset of `specs/*`).
- `tsconfig.json`: TS config, strict true, Next plugin enabled.

### `.claude/`
- `.claude/agents/agency-processor.md`: Subagent contract: write progress + activity + HTML + agency JSON; no emojis; use skills.
- `.claude/commands/build.md`: “Silo Implement” command instructions (internal workflow doc).
- `.claude/commands/plan.md`: “Silo Plan” command instructions (internal workflow doc).
- `.claude/commands/prime.md`: Quick primer command (minimal).
- `.claude/skills/agency-processor/SKILL.md`: Detailed subagent workflow + schemas + constraints for agency extraction + demo page generation.
- `.claude/skills/postcall-page-builder/SKILL.md`: Postcall page generation instructions and how to update call JSON.
- `.claude/skills/frontend-design/SKILL.md`: Aesthetic design guidance for generating high-quality frontend code.

### `agents/`
- `agents/plans/plan1.md`: Implementation plan for pipeline/streaming UI/demo call flow; documents refactor steps.
- `agents/plans/silo-plan-pipeline-persistence-and-history.md`: Implementation plan for pipeline persistence/history replay.

### `app/` (Next.js App Router)
- `app/layout.tsx`: Root layout (still default metadata).
- `app/globals.css`: Tailwind v4 import + basic variables.
- `app/page.tsx`: Main UI: search, SSE wiring, card list, workspace, settings modal, calls panel, history tab, rehydration behavior.
- `app/favicon.ico`: Standard icon asset.

#### `app/demo/[slug]/`
- `app/demo/[slug]/page.tsx`: Reads generated demo HTML and injects callbar config + script; infers minimal agency info.
- `app/demo/[slug]/not-found.tsx`: Not-found UI for missing demos.

#### `app/call/[id]/`
- `app/call/[id]/page.tsx`: Serves generated postcall HTML.
- `app/call/[id]/not-found.tsx`: “Page not ready” UI.

#### `app/history/[sessionId]/`
- `app/history/[sessionId]/page.tsx`: Renders `HistorySessionReplay` for a single session.

#### API routes (`app/api/*/route.ts`)
- `app/api/pipeline/start/route.ts`: Starts orchestrator and background run; writes initial progress; stores query handle; persists to history at end.
- `app/api/pipeline/stream/route.ts`: SSE progress streaming + reconciliation; writes completion when all agencies done.
- `app/api/pipeline/state/route.ts`: Snapshot API for reload rehydration (pipeline + agencies + activity).
- `app/api/pipeline/cancel/route.ts`: Cancels a running pipeline and persists state/history.
- `app/api/history/route.ts`: History index fetch.
- `app/api/history/[sessionId]/route.ts`: Session replay fetch and session rename.
- `app/api/register-call/route.ts`: Writes pending call context for demo page; returns enforced demo number.
- `app/api/webhook/personalize/route.ts`: ElevenLabs personalization; matches pending context; returns dynamic vars/overrides.
- `app/api/webhook/call-complete/route.ts`: ElevenLabs post-call; stores call record; enqueues postcall job; updates agency call history; best-effort signature verification.
- `app/api/calls/route.ts`: Recent calls list (filtered by session) + best-effort worker progress.
- `app/api/calls/stream/route.ts`: SSE for calls list.
- `app/api/calls/[callId]/route.ts`: Call detail + postcall activity.
- `app/api/calls/stream-detail/route.ts`: SSE for call detail + postcall activity.
- `app/api/call-status/route.ts`: Legacy polling for “recent call results” by agency; also ticks postcall processing.
- `app/api/agency-calls/route.ts`: Fetch call history per agency (used by generated demo pages).
- `app/api/search/route.ts`: Legacy “search agencies” endpoint that invokes Claude and writes cached results into `data/agencies/{suburbSlug}.json`.
- `app/api/generate-demo/route.ts`: Legacy “generate demo page” endpoint that invokes Claude and writes `public/demo/{agencyId}.html`.

### `components/` (UI)
- `components/MainAgentWorkspace.tsx`: Workspace UI: activity stream, todos, calls panel toggle, cancel.
- `components/AgencyCard.tsx`: Agency card UI: step list, shimmer preview, open demo link, expandable subagent stream.
- `components/CallsPanel.tsx`: Calls list UI for workspace.
- `components/CallDetailModal.tsx`: Call detail modal with transcript and live postcall activity.
- `components/SettingsModal.tsx`: Voice agent settings editor stored in localStorage with variable validation.
- `components/HistoryList.tsx`: History list wrapper.
- `components/HistoryCard.tsx`: History entry with rename and agency chips; links to replay page.
- `components/HistorySessionReplay.tsx`: Replay UI for a session detail snapshot.
- `components/ActivityMessage.tsx`: Activity message render (icon + color mapping).
- `components/AgentActivityPanel.tsx`: Older/alternate activity panel component (still present).
- `components/TodoPanel.tsx`: Older/alternate todo panel component (still present).
- `components/TabNavigation.tsx`: Tab toggle.
- `components/StepList.tsx`: Step checklist.
- `components/MockPreview.tsx`: Older preview component (not currently used by `AgencyCard` which uses `ShimmerPreview`).
- `components/ShimmerPreview.tsx`: Preview with shimmer + progress bar.

### `data/`
- `data/history/.gitkeep`: Keeps history dir in git.
- `data/progress/.gitkeep`: Keeps progress dir in git.

### `lib/`
- `lib/types.ts`: Shared types for pipeline + history + voice settings; includes default voice prompt and allowed variables list.
- `lib/ids.ts`: SessionId validation + activity ID generator.
- `lib/phone.ts`: Enforces a single demo number; normalizes display/E.164.
- `lib/claude.ts`: Wrapper around Agent SDK query() with environment setup + hooks that write activity streams.
- `lib/pipeline-registry.ts`: In-memory registry of running pipeline queries for cancel.
- `lib/progress-cleanup.ts`: Helpers to lazily delete stale progress files.
- `lib/history.ts`: History index/detail read/write; builds sessions from progress files.
- `lib/agency-calls.ts`: Reads/writes per-agency call list.
- `lib/postcall-queue.ts`: Durable postcall job queue and worker; invokes Claude for postcall HTML; updates call JSON; queues SMS.
- `lib/sms-queue.ts`: Durable SMS job queue and worker; sends via Twilio.
- `lib/twilio.ts`: Twilio client + `sendSMS` + phone normalization.
- `lib/server/activity.ts`: Stable activity IDs and timestamp normalization for streaming/dedupe.

### `plans/`
- `plans/*.md`: Historical implementation-phase docs (process documentation, not runtime).
- `plans/.gitkeep`: Keeps directory.

### `public/`
- `public/voqo-demo-call.js`: Demo callbar injection script + legacy CTA patcher + register-call integration.
- `public/*.svg`, `public/vercel.svg`, etc.: Static assets from scaffold.

### `specs/`
- `specs/SPEC-ARCHITECTURE.md`: Reference architecture and flows.
- `specs/SPEC-DATA-API.md`: Schemas + endpoints reference.
- `specs/SPEC-PIPELINE.md`: Streaming pipeline UI specification.
- `specs/SPEC-VOICE-AGENT.md`: Voice agent config + prompt + settings UX.
- `specs/DEPLOYMENT.md`: VPS deployment reference.
- `specs/silo-plan-voice-agent-settings.md`: Plan doc for voice agent settings UX.

---

## 6) Edge Cases & Failure Points (Exhaustive List)

This section focuses on “what could go wrong,” including silent failure modes, data corruption, mis-association, and operational hazards.

### 6.1 File storage edge cases (system-wide)

1) **Concurrent write races (read-modify-write JSON)**
- Affects: `pending-calls.json`, `sessions.json`, agency call history, progress files.
- Symptom: lost updates, malformed JSON, inconsistent view between SSE and snapshot APIs.

2) **Partial writes / corrupted JSON**
- A single truncated write can cause future reads to fail and fall back to empty/default states.
- Several readers treat parse failures as “ignore” or “return empty,” masking errors.

3) **Non-atomic multi-file invariants**
- Example invariant: “call page exists” + “call JSON says completed” + “SMS job exists”.
- These are written in separate steps; crashes between steps cause stuck states (e.g., HTML exists but call JSON still generating).

4) **File permissions & deployment mistakes**
- Specs require preserving runtime dirs; a deploy that wipes `data/` or `public/demo`/`public/call` breaks history, demo pages, and postcall pages.

### 6.2 Pipeline + SSE edge cases

1) **`fs.watch` reliability**
- Missed events -> UI doesn’t update.
- There is partial mitigation (initial snapshot + periodic events triggered by other file changes), but no full polling fallback.

2) **SSE behind proxies**
- If Nginx buffers, clients receive bursts or no updates.
- If timeouts are low, long runs disconnect repeatedly.

3) **Orchestrator/subagent contract drift**
- If the orchestrator prompt changes, subagent output schemas must stay aligned with:
  - `normalizeAgencyProgress` in `app/api/pipeline/stream/route.ts`
  - `lib/types.ts` shape expectations

4) **No authentication**
- Anyone can trigger expensive pipelines and web searches, potentially DOSing the server or burning API budget.

5) **Session lifecycle mismatches**
- Pipeline run registry is in-memory. If the server restarts, cancel can’t interrupt an already-running external process, and the registry loses state.

### 6.3 Demo call context edge cases

1) **Context mis-association (multi-user / near-simultaneous calls)**
- Personalize chooses “most recent pending” and “recent active”; with two different agencies in flight, the later registration can steal the next call.

2) **Mobile vs desktop call behavior**
- Desktop may not trigger `tel:` and may not generate a real call; users may think it “worked” but no webhook arrives.

3) **sendBeacon limitations**
- sendBeacon can silently fail due to payload size limits or browser policies; fallback fetch exists but is still best-effort.

4) **Context TTL mismatch with real user behavior**
- TTL 5 minutes assumes the call starts quickly. Longer delays mean personalization falls back to default agency.

### 6.4 Webhook security + correctness edge cases

1) **Missing/weak webhook signature enforcement**
- `call-complete` skips verification in dev and effectively allows missing secret/signature in production.
- `personalize` does not verify at all.
- Impact: anyone can send forged webhooks, generating call records, triggering Claude runs, and potentially sending SMS.

2) **Webhook retries leading to duplication**
- If ElevenLabs retries (network hiccup), new `callId` is created each time.
- Postcall jobs and agency call history entries can duplicate.

3) **PII leakage via logs**
- Both webhook handlers log full headers and bodies, including caller phone numbers and transcript contents.

### 6.5 Postcall generation edge cases

1) **Claude Code execution failures**
- Not installed, not in PATH, auth missing, or tool invocation errors -> jobs repeatedly retry then fail.

2) **Timeout tuning**
- Worker timeout is 5 minutes; if Claude consistently takes longer, jobs churn and may never complete.

3) **Idempotency gaps**
- Worker checks for HTML + call JSON completion before rerun; if HTML exists but call JSON wasn’t updated (common partial failure), it reruns.
- Call-complete webhook always generates a new callId; no dedupe by conversation_id.

### 6.6 SMS edge cases

1) **Env var misuse**
- `NEXT_PUBLIC_APP_URL` used server-side for SMS link building; if set to a staging URL or missing, SMS links are wrong.

2) **Twilio client initialization**
- Twilio client is created at module import with non-null assertions; missing env may cause runtime errors (depending on Twilio SDK behavior).

3) **International numbers**
- Normalization is AU-oriented; non-AU numbers may be transformed to an invalid E.164.

### 6.7 UI/UX edge cases

1) **Large activity streams**
- Several places cap messages, but without careful dedupe the memory sets can grow (there are guards).
- History replay fetch may be heavy if session snapshots include large arrays.

2) **Inconsistent component usage**
- Both `MainAgentWorkspace` and older `AgentActivityPanel`/`TodoPanel` exist; possible drift/confusion.

---

## 7) “Where Systems Can Fail” — Failure Matrix

This is a fast lookup table: subsystem → failure trigger → observable symptom → current behavior.

| Subsystem | Trigger | Symptom | Current behavior |
|---|---|---|---|
| Pipeline start | Claude SDK/Claude Code not runnable | Cards never progress; only initial state exists | No explicit recovery; background loop errors; may persist error |
| Pipeline stream | `fs.watch` misses events | UI appears frozen or laggy | Best-effort snapshot + debounced refresh; no full polling fallback |
| Pipeline cancel | Registry lost (restart) | Cancel API “succeeds” but pipeline continues | Cancel marks files; cannot interrupt external process |
| Register-call | Concurrent writes | Context overwritten / lost | No locking; last write wins |
| Personalize webhook | Two pending contexts close together | Wrong agency voice personalization | Most recent pending / recent active strategy; no callerId-based selection pre-activation |
| Call-complete webhook | Missing signature/secret | Forged calls/jobs/SMS possible | Allowed in prod (current logic) |
| Postcall worker | Claude timeout | Call stuck “generating”; job requeues | Retries up to 3, logs errors |
| SMS worker | `NEXT_PUBLIC_APP_URL` mis-set | SMS link points to wrong host | Uses env or localhost fallback |
| Call-status (legacy) | Any corrupt call JSON file | Endpoint throws; returns no recent call | No per-file parse guard |
| History | Concurrent writes to sessions.json | Lost renames / invalid JSON | No lock; failures fall back to empty history |

---

## 8) Simplification Opportunities (Prioritized, Non-Feature Recommendations)

These are recommendations only. They do not require adding new user-facing features; most are refactors or hardening.

### 8.1 High-impact simplifications (biggest ROI)

1) **Centralize JSON file IO + atomic writes**
- Problem: Many modules duplicate JSON parsing, error handling, and read-modify-write patterns.
- Recommendation: Create a single `lib/fs-json.ts` utility that:
  - reads JSON with safe parse
  - writes via atomic temp file + rename
  - optionally offers a simple lock (advisory lock file) for hot paths like `pending-calls.json`
- Impact: prevents corruption and reduces repetitive code.

2) **Unify “context matching” logic in one library**
- Problem: Personalize and call-complete each implement their own matching and update logic; they can drift.
- Recommendation: Extract `matchContext()` into a shared module and reuse from both routes.
- Impact: reduces mis-association bugs and makes behavior spec-aligned.

3) **Make webhook security consistent**
- Problem: signature checks are inconsistent and weak in production.
- Recommendation: One verifier utility with explicit environment behavior, and uniform header handling (`elevenlabs-signature` vs `x-elevenlabs-signature`).
- Impact: closes a major abuse surface; simplifies code in both webhook routes.

### 8.2 Operational simplifications

4) **Reduce “worker progress by incidental API hits”**
- Problem: multiple endpoints call `processPostcallJobsOnce()` and `processSmsJobsOnce()` to keep jobs moving.
- Recommendation: prefer a single worker loop per process (or a separate process) rather than “tick on reads.”
- Impact: less surprising coupling; fewer side effects from read-only endpoints.

5) **Add explicit retention/cleanup for calls and contexts**
- Problem: progress cleanup exists; contexts are only cleaned when registering; calls have no cleanup.
- Recommendation: unify cleanup policies and run them on a predictable cadence.
- Impact: prevents disk growth and improves performance.

### 8.3 Codebase simplifications (maintainability)

6) **Remove or consolidate duplicate UI components**
- Problem: `AgentActivityPanel` and `TodoPanel` appear to be older variants, while `MainAgentWorkspace` is the new core.
- Recommendation: either delete unused components or clearly separate “legacy” vs “current”.
- Impact: reduces drift and confusion.

7) **Consolidate repeated helpers**
- `safeJsonParse` exists in multiple files (`calls`, `stream`, etc.).
- `normalizeDemoUrl` exists in multiple places.
- Recommendation: move to shared helpers.

8) **Trim debug logging**
- Webhook routes print full payloads; personalize prints every context entry and headers.
- Recommendation: gate behind an env flag and redact sensitive fields.
- Impact: reduces noise, PII exposure, and CPU overhead.

---

## 9) “Better / Simpler” Alternative Approaches (Design Options)

These are architectural alternatives you could adopt later (tradeoffs included).

### Option A: Keep filesystem, but use SQLite for hot-path state
**What changes**
- Keep generated HTML and large blobs as files, but store:
  - pending contexts
  - calls index + metadata
  - history index/detail pointers
  - job queue states
in SQLite.

**Pros**
- Atomic updates; no JSON corruption races; easier querying/filtering.

**Cons**
- Adds a DB dependency; needs migration/backups.

### Option B: Split Next.js app and workers
**What changes**
- Run Next.js only for UI/API.
- Run separate Node worker process(es) for:
  - postcall queue
  - sms queue
  - optional pipeline orchestration

**Pros**
- Clean separation; fewer side effects in read-only endpoints; easier tuning.

**Cons**
- More moving parts (PM2 configs, logs, restarts).

### Option C: Replace `fs.watch` with periodic polling + ETag-style cursors
**What changes**
- Instead of filesystem watchers, poll progress files every N ms and return deltas from an offset/sequence.

**Pros**
- More portable and predictable than watchers.

**Cons**
- Higher baseline IO; slightly higher latency unless tuned.

### Option D: Add minimal auth / rate limits (even in demo)
**What changes**
- Protect “expensive” routes (`/api/pipeline/start`, `/api/search`, `/api/generate-demo`) with a shared secret or basic auth.

**Pros**
- Prevents abuse and runaway costs.

**Cons**
- Adds a small operational hurdle for demos.

---

## 10) Summary of the Biggest Risks (Top 10)

1) Webhook security is currently weak/inconsistent (forgery risk).
2) Context matching in personalize can mis-associate agencies under concurrency.
3) File-based JSON updates are not atomic and can corrupt under concurrent writes.
4) Unauthenticated expensive endpoints can be abused to run Claude tasks.
5) Worker loops may multiply across processes/instances.
6) Logging contains PII and full transcripts (privacy and performance risk).
7) `fs.watch` + SSE reliability depends heavily on deployment proxy configuration.
8) Twilio env var absence can break runtime (depending on library behavior).
9) Retry/idempotency gaps around call-complete duplicates can spam jobs and history.
10) Deployment mistakes that wipe `data/` or generated `public/*` break core flows.

---

## 11) Appendix: Specs vs Implementation Notes (Key Deltas)

This highlights the most meaningful divergences observed (not exhaustive).

- Signature verification:
  - Spec implies HMAC verification is required; implementation allows bypass in dev and effectively allows missing secret/signature in prod for call-complete; personalize has no check.
- Personalize matching:
  - Spec’s “context_id → callSid → callerId → fallback” is only fully applied in call-complete; personalize is “recent active → most recent pending → any valid → default”.
- Postcall worker timeouts/stale thresholds:
  - Specs mention different defaults; implementation currently uses 5-minute processing timeout and 20-minute stale processing recovery.

