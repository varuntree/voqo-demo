# VoqoLeadEngine — Full Codebase Review & Analysis (report10)

Date: 2026-01-17  
Repo root: `/Users/varunprasad/code/prjs/voqo-demo`

## 0) Scope, constraints, and methodology

- Constraint honored: no code changes; this deliverable is a report only.
- Inputs reviewed:
  - Complete tracked file list (`git ls-files`).
  - All documents under `specs/`:
    - `specs/SPEC-ARCHITECTURE.md`
    - `specs/SPEC-DATA-API.md`
    - `specs/SPEC-PIPELINE.md`
    - `specs/SPEC-VOICE-AGENT.md`
    - `specs/DEPLOYMENT.md`
    - `specs/silo-plan-voice-agent-settings.md`
  - All runtime systems implemented in:
    - `app/` (App Router pages + API routes)
    - `lib/` (Claude/Twilio/queues/history/helpers/types)
    - `components/` (UI)
    - `public/voqo-demo-call.js` (demo call activation runtime)
    - `.claude/skills/*` and `.claude/agents/*` (Claude Code skills + subagent contract)

The report is organized as:
1) Full file tree map  
2) Architecture map (systems, modules, connections)  
3) System-by-system analysis (what each subsystem does and how it interacts)  
4) Edge cases & failure points (including security and reliability risks)  
5) Simplification recommendations (quick wins → deeper redesign options)

---

## 1) Complete tracked file tree (`git ls-files`)

```
.claude/agents/agency-processor.md
.claude/commands/build.md
.claude/commands/plan.md
.claude/commands/prime.md
.claude/skills/agency-processor/SKILL.md
.claude/skills/frontend-design/SKILL.md
.claude/skills/postcall-page-builder/SKILL.md
.gitignore
AGENTS.md
CLAUDE.md
README.md
agents/plans/plan1.md
agents/plans/silo-plan-pipeline-persistence-and-history.md
app/api/agency-calls/route.ts
app/api/call-status/route.ts
app/api/calls/[callId]/route.ts
app/api/calls/route.ts
app/api/calls/stream-detail/route.ts
app/api/calls/stream/route.ts
app/api/generate-demo/route.ts
app/api/history/[sessionId]/route.ts
app/api/history/route.ts
app/api/pipeline/cancel/route.ts
app/api/pipeline/start/route.ts
app/api/pipeline/state/route.ts
app/api/pipeline/stream/route.ts
app/api/register-call/route.ts
app/api/search/route.ts
app/api/webhook/call-complete/route.ts
app/api/webhook/personalize/route.ts
app/call/[id]/not-found.tsx
app/call/[id]/page.tsx
app/demo/[slug]/not-found.tsx
app/demo/[slug]/page.tsx
app/favicon.ico
app/globals.css
app/history/[sessionId]/page.tsx
app/layout.tsx
app/page.tsx
components/ActivityMessage.tsx
components/AgencyCard.tsx
components/AgentActivityPanel.tsx
components/CallDetailModal.tsx
components/CallsPanel.tsx
components/HistoryCard.tsx
components/HistoryList.tsx
components/HistorySessionReplay.tsx
components/MainAgentWorkspace.tsx
components/MockPreview.tsx
components/SettingsModal.tsx
components/ShimmerPreview.tsx
components/StepList.tsx
components/TabNavigation.tsx
components/TodoPanel.tsx
data/history/.gitkeep
data/progress/.gitkeep
lib/agency-calls.ts
lib/claude.ts
lib/history.ts
lib/ids.ts
lib/phone.ts
lib/pipeline-registry.ts
lib/postcall-queue.ts
lib/progress-cleanup.ts
lib/server/activity.ts
lib/sms-queue.ts
lib/twilio.ts
lib/types.ts
next.config.ts
package-lock.json
package.json
plans/.gitkeep
plans/phase-1.md
plans/phase-10.md
plans/phase-12.1.md
plans/phase-12.2.md
plans/phase-12.md
plans/phase-2.md
plans/phase-3.md
plans/phase-4.md
plans/phase-5.md
plans/phase-6.md
plans/phase-7.md
plans/phase-8.md
postcss.config.mjs
proxy.ts
public/file.svg
public/globe.svg
public/next.svg
public/vercel.svg
public/voqo-demo-call.js
public/window.svg
spec.md
specs/DEPLOYMENT.md
specs/SPEC-ARCHITECTURE.md
specs/SPEC-DATA-API.md
specs/SPEC-PIPELINE.md
specs/SPEC-VOICE-AGENT.md
specs/silo-plan-voice-agent-settings.md
tsconfig.json
```

---

## 2) Architecture map (systems, modules, and connections)

### 2.1 High-level system diagram (as-implemented)

```
Browser (Next.js UI)
  |
  | 1) Start pipeline search
  |    POST /api/pipeline/start
  |    GET  /api/pipeline/stream  (SSE)
  v
Next.js App Router (Node runtime)
  |
  |-- Pipeline Orchestrator (Claude Agent SDK query, background drain)
  |     - writes progress JSON into /data/progress/*
  |     - spawns N subagents via Task tool (agency-processor)
  |
  |-- File-based State (shared by all subsystems)
  |     /data/progress/*         (pipeline + activity streams)
  |     /data/agencies/*         (durable agency records)
  |     /data/history/*          (session history index + snapshots)
  |     /data/context/*          (pending call contexts)
  |     /data/calls/*            (call records with transcript + status)
  |     /data/jobs/postcall/*    (durable postcall jobs)
  |     /data/jobs/sms/*         (durable SMS jobs)
  |     /data/errors/*           (postcall + SMS error logs)
  |
  |-- Generated HTML artifacts
  |     /public/demo/*.html      (demo landing pages per agency)
  |     /public/call/*.html      (post-call pages per call)
  |
  |-- Voice demo flow
        /demo/[slug] serves the HTML, injects /voqo-demo-call.js config
        /voqo-demo-call.js calls POST /api/register-call then dials tel:
        ElevenLabs webhooks:
          POST /api/webhook/personalize
          POST /api/webhook/call-complete
        postcall worker:
          processes /data/jobs/postcall/*.json by invoking Claude Code skill
        SMS worker:
          processes /data/jobs/sms/*.json by calling Twilio API
```

### 2.2 System boundaries and responsibilities (by directory)

#### `app/` — Next.js runtime entrypoints

- `app/page.tsx` — Main UI: start pipeline, stream progress, show agency cards, calls panel, history tab.
- `app/demo/[slug]/page.tsx` — Serves pre-generated demo HTML and injects demo-call script configuration.
- `app/call/[id]/page.tsx` — Serves pre-generated post-call HTML.
- `app/api/*` — All backend behavior: pipeline lifecycle, SSE, call context registration, webhooks, job processors “nudges”, history APIs, call list/detail APIs.

#### `lib/` — Non-React runtime modules (shared backend logic)

- Claude Code integration: `lib/claude.ts`
- Pipeline run registry (in-memory): `lib/pipeline-registry.ts`
- Storage helpers: `lib/history.ts`, `lib/agency-calls.ts`
- Workers/queues: `lib/postcall-queue.ts`, `lib/sms-queue.ts`
- External API wrapper: `lib/twilio.ts`
- Shared types and constants: `lib/types.ts`

#### `components/` — UI widgets

- “Workspace” (activity/todos/calls): `components/MainAgentWorkspace.tsx`, `components/CallsPanel.tsx`, `components/CallDetailModal.tsx`
- Cards + progress rendering: `components/AgencyCard.tsx`, `components/StepList.tsx`, `components/ShimmerPreview.tsx`
- History: `components/HistoryList.tsx`, `components/HistoryCard.tsx`, `components/HistorySessionReplay.tsx`
- Voice agent settings: `components/SettingsModal.tsx` → stored in `localStorage` and used by `public/voqo-demo-call.js`

#### `.claude/skills/` — Agent “code” (instructions)

- `agency-processor` — Defines how each agency subagent writes progress/activity + generates demo HTML.
- `postcall-page-builder` — Defines how post-call pages are generated from transcripts and how call JSON must be updated.
- `frontend-design` — Aesthetic guidance used by the HTML generators.

### 2.3 Primary data flows (end-to-end)

#### Flow A: Agency search → demo pages (pipeline)

1) User uses UI (`app/page.tsx`) to submit suburb + count.
2) `POST /api/pipeline/start` (`app/api/pipeline/start/route.ts`)
   - Creates `/data/progress/pipeline-{sessionId}.json` and `/data/progress/activity-{sessionId}.json`.
   - Starts a Claude Agent SDK `query()` and drains it in the background.
   - Prompt instructs Claude to:
     - WebSearch agencies (fast), append `agencyIds` into pipeline file.
     - Create per-agency skeleton progress files (`/data/progress/agency-{agencyId}.json`).
     - Spawn N parallel subagents (Task tool) to do full extraction + demo HTML generation.
3) UI opens `GET /api/pipeline/stream?session={sessionId}` (SSE)
   - Watches `/data/progress` via `fs.watch`, emitting:
     - `todo_update` from pipeline file
     - `card_update` from per-agency progress files
     - `main_activity_message` from activity file
     - `subagent_activity_message` from `agency-activity-*` files
     - `pipeline_complete` once terminal
4) Subagents generate:
   - Agency JSON: `/data/agencies/{agencyId}.json`
   - Demo HTML: `/public/demo/{agencyId}.html` (served by `/demo/{agencyId}`)

#### Flow B: Demo call activation → personalization webhook

1) User opens `/demo/{slug}`.
2) `app/demo/[slug]/page.tsx` reads:
   - `/public/demo/{slug}.html` (must exist)
   - `/data/agencies/{slug}.json` (best-effort; optional)
3) It injects a config script:
   - `window.__VOQO_DEMO_PHONE__`
   - `window.__VOQO_AGENCY__`
   - `window.__VOQO_SESSION_ID__` (if `?session=...`)
   - and loads `/voqo-demo-call.js`.
4) `/public/voqo-demo-call.js`:
   - builds a call bar UI
   - on “Call now”:
     - reads `localStorage['voqo:voiceAgentSettings']` if present
     - `POST /api/register-call` (sendBeacon or fetch keepalive)
     - redirects to `tel:+614832945767` (server-enforced number)
5) ElevenLabs calls `POST /api/webhook/personalize`:
   - loads `/data/context/pending-calls.json`
   - selects most recent active/pending context
   - returns dynamic vars and optionally `conversation_config_override` derived from stored settings

#### Flow C: Call complete webhook → post-call page + SMS

1) ElevenLabs calls `POST /api/webhook/call-complete`:
   - parses webhook, matches context, builds call record
   - writes `/data/calls/{callId}.json` with transcript + initial status `pageStatus='generating'`
   - appends to `/data/agency-calls/{agencyId}.json` (if agencyId known)
   - enqueues a postcall job `/data/jobs/postcall/{callId}.json`
   - starts background workers via `ensurePostcallWorker()` and `ensureSmsWorker()`
2) Postcall worker (`lib/postcall-queue.ts`) runs every 5s:
   - renames job `.json` → `.processing` (attempted lock)
   - invokes Claude Code with `postcall-page-builder` prompt
   - expects Claude to:
     - write `/public/call/{callId}.html`
     - update `/data/calls/{callId}.json` to `pageStatus='completed'`, set `pageUrl`, etc.
   - once output is ready, it:
     - sets call record to `completed`, sets `generatedAt`
     - enqueues SMS job `/data/jobs/sms/{callId}.json`
     - updates agency-calls entry to completed
3) SMS worker (`lib/sms-queue.ts`) runs every 5s:
   - locks job via `.processing` rename
   - verifies call page is completed and callerPhone exists
   - sends SMS via Twilio (`lib/twilio.ts`)
   - writes back `callData.sms` status and dedupes by job file creation (`wx`) + `sms.status==='sent'`

---

## 3) System-by-system analysis (implementation review)

This section is “system-first”: each subsystem is described with its primary files, the key logic, and how it connects to other subsystems.

### 3.1 Frontend UI (pipeline, history, calls, settings)

Primary files:
- `app/page.tsx` — Overall UI state machine.
- `components/MainAgentWorkspace.tsx` — Renders status + task list + activity stream + calls panel.
- `components/AgencyCard.tsx` — Renders per-agency progress, demo link, and per-agency subagent activity.
- `components/HistoryList.tsx`, `components/HistoryCard.tsx`, `components/HistorySessionReplay.tsx` — Browse and replay completed sessions.
- `components/SettingsModal.tsx` — Edits voice agent prompt + first message and stores in `localStorage`.

Key behaviors:
- UI persists active pipeline session ID in `localStorage['voqo:activePipelineSessionId']` and can rehydrate via `GET /api/pipeline/state`.
- Pipeline progress streaming uses SSE (`/api/pipeline/stream`) and dedupes messages by:
  - message `id`
  - a computed “content key” `(type|text|detail|source|timestamp)`
- Calls panel streams call list via SSE (`/api/calls/stream`) and fetches snapshots via `/api/calls`.
- Call detail modal uses `/api/calls/{callId}` + `/api/calls/stream-detail`.

Notable implementation details:
- `app/layout.tsx` still has default Next.js metadata (“Create Next App”), which is harmless for runtime but mismatched to product identity.
- The UI’s “New Search” resets a large amount of state and forcibly closes both SSE EventSources to prevent memory leaks.

### 3.2 Demo page serving + demo call activation

Primary files:
- `app/demo/[slug]/page.tsx`
- `public/voqo-demo-call.js`
- `app/api/register-call/route.ts`
- `lib/phone.ts` (enforces the single demo number)

Key behaviors:
- Demo HTML is served via `dangerouslySetInnerHTML` and then receives injected JS that adds:
  - a fixed call bar
  - tel-link interception
  - legacy global functions `window.registerDemoCall` and `window.registerForCall`
- `register-call` writes/updates `/data/context/pending-calls.json`, cleans expired contexts (by `expiresAt`), and stores optional `settings`.

Call context invariants:
- TTL is 5 minutes (`CONTEXT_TTL_MS` in `app/api/register-call/route.ts`).
- Context IDs are randomly generated: `ctx-{Date.now()}-{rand}`.
- The API supports both `sendBeacon` and fetch keepalive patterns.

### 3.3 Pipeline orchestration (Claude Agent SDK) and progress files

Primary files:
- `app/api/pipeline/start/route.ts`
- `app/api/pipeline/stream/route.ts`
- `app/api/pipeline/state/route.ts`
- `app/api/pipeline/cancel/route.ts`
- `lib/pipeline-registry.ts`
- `.claude/skills/agency-processor/SKILL.md`
- `.claude/agents/agency-processor.md`

Data model:
- Pipeline state file: `/data/progress/pipeline-{sessionId}.json`
- Main activity file: `/data/progress/activity-{sessionId}.json`
- Per-agency progress: `/data/progress/agency-{agencyId}.json`
- Per-agency activity: `/data/progress/agency-activity-{agencyId}.json`

Key behaviors:
- `pipeline/start`:
  - creates initial pipeline state and activity state
  - launches an Agent SDK `query()` and drains it in the background (async IIFE)
  - tracks the live run in an in-memory registry (`globalThis.__voqoPipelineRuns`)
  - maps tool_use blocks to main activity messages (limited to “tool_use” blocks in assistant messages)
  - persists a final snapshot to history even if no SSE client connected
- `pipeline/cancel`:
  - calls `run.query.interrupt()` if the run is still registered
  - writes a `cancelled` terminal state into progress files
  - persists cancellation snapshot to history
- `pipeline/stream`:
  - uses `fs.watch(PROGRESS_DIR)` + debounced refresh
  - normalizes/dedupes activity messages with `lib/server/activity.ts`
  - reconciles some completion conditions by checking if demo HTML exists (`maybeReconcileAgency`)
  - forcibly marks pipeline complete if all agencies are done but the pipeline isn’t terminal

### 3.4 History persistence and replay

Primary files:
- `lib/history.ts`
- `app/api/history/route.ts`
- `app/api/history/[sessionId]/route.ts`
- `app/history/[sessionId]/page.tsx`

Data model:
- Index: `/data/history/sessions.json` (keeps up to 50 sessions)
- Details: `/data/history/sessions/{sessionId}.json` (durable snapshots for completed/cancelled/error)

Key behaviors:
- “History index” is updated by:
  - SSE pipeline completion (`pipeline/stream`), and
  - background completion persistence in `pipeline/start`.
  - This is intentionally redundant so history exists even if no SSE client watched the run.
- “Session detail” is recomputed on-demand if not found, then persisted for terminal sessions.

### 3.5 Webhooks: personalization + call complete

Primary files:
- `app/api/webhook/personalize/route.ts`
- `app/api/webhook/call-complete/route.ts`

Personalize webhook:
- Reads pending contexts and picks (in order):
  - recently active contexts within 5 minutes
  - pending contexts sorted by `registeredAt`
  - fallback to any valid unexpired context
  - fallback default agency
- If a context is matched as pending, it is marked `active` and the webhook writes back to the shared JSON.
- If a matched context includes settings, it returns `conversation_config_override.agent.prompt` and `first_message` after substituting `{{variables}}`.

Call complete webhook:
- Attempts signature verification, but current logic effectively allows many insecure states (see failure analysis).
- Builds transcript text and a `callData` JSON file.
- Matches context by (in order):
  - `dynamic_variables.context_id`
  - callSid
  - callerId (phone) among active contexts
  - most recent pending context
- Enqueues the durable postcall job and starts workers.

### 3.6 Postcall job queue + worker

Primary files:
- `lib/postcall-queue.ts`
- `.claude/skills/postcall-page-builder/SKILL.md`

Data model:
- Job files: `/data/jobs/postcall/{callId}.json`
- Lock: `/data/jobs/postcall/{callId}.processing`
- Errors: `/data/errors/postcall-errors.json`

Key behaviors:
- Reclaims stale `.processing` jobs older than 20 minutes.
- Uses a 5-minute timeout wrapper around `invokeClaudeCode(...)`.
- Before retrying, it checks if the expected output already exists and call JSON is marked completed.
- When it marks a call completed, it queues the SMS job and updates agency-call index.

### 3.7 SMS job queue + worker (Twilio)

Primary files:
- `lib/sms-queue.ts`
- `lib/twilio.ts`

Data model:
- Job files: `/data/jobs/sms/{callId}.json`
- Errors: `/data/errors/sms-errors.json`
- Call record SMS status: `callData.sms.{status,sentAt,messageSid,to,error}`

Key behaviors:
- Enqueue is idempotent (`writeFile(..., { flag: 'wx' })`).
- Sending is gated on:
  - `pageStatus === 'completed'`
  - `pageUrl` exists
  - `callerPhone` exists
- Uses `NEXT_PUBLIC_APP_URL` as the base URL for the SMS link (defaults to `http://localhost:3000`).

### 3.8 Call browsing APIs + UI

Primary files:
- `app/api/calls/route.ts` — call list snapshot (reads recent JSON).
- `app/api/calls/stream/route.ts` — SSE list updates (fs.watch).
- `app/api/calls/[callId]/route.ts` — call detail and activity snapshot.
- `app/api/calls/stream-detail/route.ts` — SSE detail (call updates + postcall activity).
- `components/CallsPanel.tsx`, `components/CallDetailModal.tsx`

Key behavior:
- “Workers are nudged” in read paths: calls APIs call `processPostcallJobsOnce()` / `processSmsJobsOnce()` to keep work moving when the UI is open.

---

## 4) Edge cases and failure points (where and how it can break)

This section is intentionally exhaustive and “failure-oriented”.

### 4.1 Security-critical failures (highest severity)

1) **Webhook signature verification is effectively bypassed**
   - File: `app/api/webhook/call-complete/route.ts`
   - `verifyWebhookSignature()` returns `true` in dev (OK for local), but also returns `true` in production if:
     - `ELEVENLABS_WEBHOOK_SECRET` is missing, or
     - the signature header is missing.
   - Impact:
     - Anyone can POST fake call-complete payloads to your public endpoint, causing arbitrary call record creation and triggering expensive background Claude runs + SMS logic.

2) **Path traversal risk via query-derived file paths**
   - Files:
     - `app/api/calls/stream-detail/route.ts` — `callId` comes from query string.
     - `app/api/agency-calls/route.ts` — `agencyId` comes from query string.
     - `lib/agency-calls.ts` — uses `agencyId` to build file path for reads/writes.
   - Pattern:
     - `path.join(DIR, \`\${userInput}.json\`)` where `userInput` can contain `../` if it comes from a query parameter (not a Next route segment).
   - Impact:
     - Reads/writes outside the intended data directories may be possible depending on how the runtime decodes and normalizes inputs.
     - Combined with weak webhook verification, an attacker can cause writes to unexpected locations.

3) **No authentication on cost-amplifying endpoints**
   - Files:
     - `app/api/pipeline/start/route.ts`
     - `app/api/webhook/*`
   - Impact:
     - Any internet user can trigger expensive Claude agent runs and file churn.
     - Can also produce unbounded disk usage (progress files, calls, jobs, error logs).

4) **Serving LLM-generated HTML with `dangerouslySetInnerHTML`**
   - Files:
     - `app/demo/[slug]/page.tsx`
     - `app/call/[id]/page.tsx`
   - Impact:
     - If generated HTML includes scripts or unsafe markup, it will execute in the browser under your origin.
     - This is a deliberate design choice for a demo, but it means the “HTML generator” is part of your trusted codebase.

### 4.2 Filesystem concurrency and data corruption risks

1) **Non-atomic writes to shared JSON files**
   - Many subsystems do: read → mutate → `writeFile(JSON.stringify(...))`.
   - If two writers run concurrently, last write wins and intermediate changes can be lost.
   - Highest-risk files:
     - `/data/context/pending-calls.json` (written by `register-call` and `personalize` and `call-complete`)
     - `/data/history/sessions.json` (written from multiple endpoints)
     - `/data/agency-calls/{agencyId}.json` (written from webhook + worker)
     - `/data/progress/pipeline-{sessionId}.json` (written by orchestrator and reconciler)

2) **Partial file reads during concurrent writes**
   - SSE routes read JSON files while agents are writing them.
   - A partially-written JSON file will fail parsing and be treated as “missing” until next update, causing UI flicker or missed updates.

3) **`fs.watch` semantics**
   - `fs.watch` is not guaranteed to emit every change and can coalesce events.
   - Watchers can miss updates under load or high churn (many agencies writing frequently).
   - The implementation mitigates this partially via debounced “refresh all” behavior when filename is missing, but missed file-specific events are still possible.

### 4.3 Next.js runtime / deployment mismatch risks

1) **Background work assumptions**
   - `pipeline/start` drains Claude query in an async “background” task after returning a response.
   - `postcall-queue` and `sms-queue` rely on `setInterval()` workers.
   - This works as intended on a single long-lived Node server process (`npm run start` on a VPS).
   - It does **not** map cleanly to serverless runtimes where the process is frozen after response.

2) **Development mode hot reload duplication**
   - In `next dev`, module reload can re-run module top-level code and can lead to:
     - multiple intervals if the module is reloaded (guards are per-module-instance).
   - Symptoms:
     - repeated job processing, repeated logs, unexpected attempt increments.

### 4.4 Pipeline/agent correctness failures

1) **Pipeline completion depends on the LLM writing correct files**
   - Orchestrator prompt asks Claude to:
     - incrementally append agency IDs
     - write skeleton progress files
     - set pipeline status and todos
   - If Claude deviates (schema mismatch, missing keys, wrong status strings), UI behavior degrades.

2) **Cancellation is best-effort**
   - `pipeline/cancel` interrupts the orchestrator query, but subagent tasks may already be running.
   - Possible outcomes:
     - Pipeline marked cancelled while subagents keep writing progress and generating demo HTML.
     - SSE reconciler may later mark pipeline complete if all agencies finish, conflicting with user intent.

3) **Tool-usage streaming assumptions**
   - `pipeline/start` parses tool_use blocks from assistant messages.
   - If the SDK’s message format changes or tool_use blocks are emitted differently, main activity may go silent even while work continues.

### 4.5 Voice demo context matching failures

1) **Wrong agency matched during personalization**
   - Matching strategy is “most recent pending or recently active”.
   - If multiple people click “Call now” around the same time, context can be swapped.
   - If the same caller makes multiple attempts, a recently active context is reused (intended), but if the caller dials after TTL, it may match another agency’s pending context.

2) **Context file growth / stale entries**
   - Only `register-call` cleans expired contexts.
   - If you stop receiving registrations but keep receiving webhooks, stale contexts can persist and affect fallback selection (some code paths filter by `expiresAt`, but stale entries still remain in the file).

### 4.6 SMS delivery failures

1) **Missing Twilio env vars**
   - `lib/twilio.ts` uses non-null assertions for env vars, but at runtime they can be undefined.
   - Outcome: SMS sending fails repeatedly, leading to many retries and error logs.

2) **Incorrect base URL in SMS**
   - `lib/sms-queue.ts` defaults `NEXT_PUBLIC_APP_URL` to `http://localhost:3000`.
   - In production, if `NEXT_PUBLIC_APP_URL` is not set correctly, recipients receive invalid links.

3) **Phone number normalization**
   - `normalizePhoneNumber()` aggressively prepends `+` and assumes AU if leading `0`.
   - International callers or unexpected formats may be mangled.

### 4.7 Demo HTML access and “bypass” issues

1) **`proxy.ts` is not wired as middleware**
   - `proxy.ts` exports a function and a `config.matcher`, but Next only loads middleware from `middleware.ts` (or `src/middleware.ts`).
   - As a result, direct access to `/demo/{slug}.html` can bypass `/demo/[slug]` and therefore bypass injection of `/voqo-demo-call.js`.
   - Symptoms:
     - call bar not shown, tel interceptors not installed, context not registered before dialing.

---

## 5) Simplification recommendations (and better approaches)

The current implementation intentionally optimizes for “single VPS, file-based storage, Claude-friendly”. The suggestions below aim to reduce fragility without changing the core concept.

### 5.1 High-leverage simplifications (low effort, high impact)

1) Centralize input validation for all query/body parameters
   - Today: many endpoints hand-roll `safeJsonParse` and do minimal validation.
   - Simplify: one small validator module (even without adding dependencies) to:
     - validate IDs (sessionId already has `isSafeSessionId`)
     - constrain `callId`, `agencyId` (including disallowing path separators / traversal)

2) Centralize file IO helpers (atomic write + safe read)
   - Today: repeated `readFile`/`JSON.parse` patterns across routes and workers.
   - Simplify: one helper:
     - `readJson(path) → null | object`
     - `writeJsonAtomic(path, obj)` (write temp + rename)
   - This reduces data corruption and “partial JSON” windows.

3) Remove duplicated logic for tool/activity mapping
   - There are two distinct tool-message mappers:
     - `lib/claude.ts` (hooks-based)
     - `app/api/pipeline/start/route.ts` (manual parsing of tool_use blocks)
   - Simplify: pick one pattern and reuse it everywhere (prefer hooks when possible).

4) Reduce the “worker nudging” scattering
   - Calls APIs trigger job processing every request.
   - Simplify: a single “worker heartbeat” endpoint or a single place where it happens (or run a separate worker process).

### 5.2 Reliability upgrades that keep the same architecture

1) Split workers into a separate long-lived process
   - Keep Next.js API for webhooks and UI.
   - Run a separate Node script/process under PM2 for:
     - postcall job processing
     - SMS job processing
   - Benefits:
     - eliminates dependence on API traffic to keep jobs moving
     - avoids `next dev` HMR interval duplication pitfalls

2) Replace `fs.watch` with polling on a short interval (for SSE only)
   - In high-churn environments, polling every 250–500ms for small JSON deltas is often more reliable than watch.
   - It simplifies the watcher complexity and removes missed-event hazards.

3) Use a lightweight embedded DB for metadata only (optional)
   - Keep HTML in `/public/*` and large transcript payloads in JSON if desired.
   - Put “indexes” into SQLite:
     - calls list, agency-calls list, sessions index
   - Benefits:
     - removes concurrent-writer corruption on the most contended files
     - makes queries and pagination trivial

### 5.3 Security hardening (even for a demo)

If this is exposed to the public internet, the security items below materially reduce risk without changing product behavior.

1) Enforce webhook signatures in production
   - “Missing signature” should be a 401 in prod, not an allow.

2) Add a shared secret / basic auth for cost-amplifying endpoints
   - At minimum:
     - `POST /api/pipeline/start` should require a secret header/token.
   - For webhooks, signature is the correct auth mechanism.

3) Strictly validate `agencyId` and `callId` everywhere they become file paths
   - Especially query params (`/api/calls/stream-detail`, `/api/agency-calls`).

4) Treat LLM-generated HTML as untrusted content
   - If you keep `dangerouslySetInnerHTML`, consider:
     - restricting scripts via CSP (hard on a demo but possible)
     - sanitizing output, or
     - rendering in an iframe sandbox (strong isolation, more work)

---

## 6) Spec alignment notes (where implementation diverges or is incomplete)

1) Webhook security in spec vs code
   - Spec (`specs/SPEC-DATA-API.md`) says: in production require valid signature or return 401.
   - Code currently allows missing secret/signature in production.

2) Demo `.html` bypass prevention exists as `proxy.ts` but is not active
   - Spec and comments suggest redirecting `.html` access to the App Router route.
   - Without actual middleware wiring, this protection does not run.

3) Legacy endpoints remain
   - `/api/search` and `/api/generate-demo` exist (and use Claude directly).
   - The main UI uses the pipeline system (`/api/pipeline/*`) instead.
   - This increases surface area and maintenance cost.

---

## 7) File-by-file “what it is” map (compressed)

This is a complete inventory at a useful granularity (not a restatement of the file tree).

### 7.1 Runtime entrypoints

- `app/page.tsx` — UI state + SSE wiring + calls/history/settings modals.
- `app/demo/[slug]/page.tsx` — Reads demo HTML + injects demo call config + script.
- `app/call/[id]/page.tsx` — Reads postcall HTML and renders it.
- `app/api/pipeline/start/route.ts` — Starts orchestration and writes initial progress.
- `app/api/pipeline/stream/route.ts` — SSE for progress + activity + cards.
- `app/api/pipeline/state/route.ts` — Snapshot fetch for reload rehydration.
- `app/api/pipeline/cancel/route.ts` — Best-effort run interruption + marks cancelled.
- `app/api/register-call/route.ts` — Stores pending call context and returns demo number.
- `app/api/webhook/personalize/route.ts` — Maps pending context into ElevenLabs variables / overrides.
- `app/api/webhook/call-complete/route.ts` — Records call + enqueues postcall job + starts workers.
- `app/api/calls/*` — Call list + detail + streaming.
- `app/api/history/*` — History list + detail + rename.
- `app/api/agency-calls/route.ts` — Per-agency call history.
- `app/api/call-status/route.ts` — Legacy polling for “results ready”.
- `app/api/search/route.ts` + `app/api/generate-demo/route.ts` — Legacy Claude-driven flows.

### 7.2 Core libraries

- `lib/claude.ts` — Claude Agent SDK wrapper + hooks-based activity logging.
- `lib/pipeline-registry.ts` — Global in-memory map for active runs.
- `lib/history.ts` — History index + session detail persistence.
- `lib/postcall-queue.ts` — Durable postcall job processor + call completion marker.
- `lib/sms-queue.ts` — Durable SMS job processor (idempotent enqueue).
- `lib/twilio.ts` — Twilio client + SMS send.
- `lib/agency-calls.ts` — Per-agency call index storage.
- `lib/phone.ts` — Enforces single demo number.
- `lib/ids.ts` — Session ID validation + message ID builder.
- `lib/types.ts` — Shared app + pipeline + settings types/constants.
- `lib/server/activity.ts` — Stable activity IDs + message normalization (dedupe-friendly).
- `lib/progress-cleanup.ts` — Progress cleanup utilities (currently unused by runtime).

### 7.3 Demo runtime script

- `public/voqo-demo-call.js` — Injected call bar + tel interceptors + legacy CTA shims; calls `/api/register-call`.

---

## 8) “Better/simpler” reference architectures (optional directions)

If the goal becomes “demo but robust”, the cleanest step-function improvements are:

1) **Next.js UI + API + separate worker process** (recommended)
   - Keep current file-based storage.
   - Worker loops live outside Next to avoid request lifecycle coupling.
   - Minimal conceptual change, large reliability gain.

2) **SQLite for indexes + files for payloads**
   - Keep: generated HTML, large transcripts, raw artifacts as files.
   - Move: sessions index, agency-calls index, calls list to SQLite tables.
   - Eliminates: multi-writer JSON corruption, expensive directory scans, fragile sorting.

3) **Queue + DB “standard backend”**
   - PostgreSQL + a job queue (BullMQ/Redis) is the conventional approach.
   - Strongest correctness, but violates the “single VPS, minimal backend” principle more than the above options.

