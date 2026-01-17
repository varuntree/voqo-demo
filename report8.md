# Full Codebase Review & Analysis (Report 8)

Scope constraints (per request):
- No code changes were made.
- Only this report file was created.

Repo root: `/Users/varunprasad/code/prjs/voqo-demo`

---

## 0) Executive Summary

This repo implements a single-host (VPS) Next.js App Router application that:
- Runs an agency-search + parallel subagent pipeline (Claude Agent SDK) and streams progress via SSE.
- Serves generated static HTML demo pages at `/demo/[slug]` and generated post-call pages at `/call/[id]`.
- Uses a “register context before dialing” mechanism so ElevenLabs personalization can map a single phone number to the right agency.
- Receives ElevenLabs webhooks (personalize + post-call transcript), writes call artifacts to `/data`, triggers a durable file-based job queue for post-call page generation, and sends an SMS with the generated page link via Twilio.

Primary architectural strengths:
- Very small footprint: file-based persistence, no DB, no queue infra, no auth.
- Operationally simple: a single Next.js process can run everything end-to-end (SSE + workers + webhooks).
- Clear separation: “pipeline progress data” and “generated HTML” are explicit artifacts on disk, which makes debugging straightforward.

Primary risks / failure hotspots:
- File-based concurrency (read-modify-write) without locking for shared JSON files (notably `data/context/pending-calls.json`).
- Long-lived timers (`setInterval`) and `fs.watch` inside Next.js runtime (works on a single VPS process, but fragile under dev HMR, multi-process, or serverless/edge deployment).
- Webhook security is inconsistent with the spec (personalize has no signature verification; call-complete verification is permissive in production if missing secret/signature).
- Some endpoints are robust against corrupt JSON files; others are not (notably `app/api/call-status/route.ts`).
- The system’s correctness depends on subtle “time adjacency” (the most recent pending context is chosen) and can misattribute calls during concurrency.

---

## 1) Complete File Inventory (from `git ls-files`)

> This is the authoritative file tree used for the review.

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

Notes:
- Runtime artifacts (`/data/**`, `/public/demo/**`, `/public/call/**`) are correctly ignored via `.gitignore`, with `.gitkeep` placeholders committed.
- `README.md` is the default Next.js scaffold, and `spec.md` is a broader hackathon spec; the “canonical” system specs are in `specs/`.

---

## 2) High-Level Architecture Map (System View)

### 2.1 Main Subsystems

1) **Web UI (Next.js App Router)**
- `app/page.tsx`: main “Lead Engine” workspace (search, SSE progress, calls panel, settings modal, history).
- `app/demo/[slug]/page.tsx`: serves generated demo HTML + injects call activation script/config.
- `app/call/[id]/page.tsx`: serves generated post-call HTML.
- `app/history/[sessionId]/page.tsx` + `components/HistorySessionReplay.tsx`: replay a pipeline run snapshot.

2) **Pipeline Orchestration (Claude Agent SDK)**
- Start pipeline: `POST /api/pipeline/start` (`app/api/pipeline/start/route.ts`)
- Stream pipeline: `GET /api/pipeline/stream?session=...` (`app/api/pipeline/stream/route.ts`) via SSE using `fs.watch`.
- Load pipeline snapshot: `GET /api/pipeline/state?session=...` (`app/api/pipeline/state/route.ts`)
- Cancel pipeline: `POST /api/pipeline/cancel` (`app/api/pipeline/cancel/route.ts`) via in-memory run registry.

3) **Voice Demo Call Context + ElevenLabs Webhooks**
- Register context (client → server): `POST /api/register-call` (`app/api/register-call/route.ts`) writes `data/context/pending-calls.json`.
- Personalize webhook (ElevenLabs → server): `POST /api/webhook/personalize` (`app/api/webhook/personalize/route.ts`) selects a context and returns `dynamic_variables` (and optional overrides).
- Call-complete webhook (ElevenLabs → server): `POST /api/webhook/call-complete` (`app/api/webhook/call-complete/route.ts`) writes `data/calls/{callId}.json`, updates context status, enqueues post-call job.

4) **Post-call Generation Worker (durable file queue)**
- Job enqueue: `lib/postcall-queue.ts` writes `data/jobs/postcall/{callId}.json`.
- Worker loop: `ensurePostcallWorker()` runs `setInterval` and processes `.json → .processing → done` state transitions.
- Claude run: `invokeClaudeCode(...)` with activity hooks writes `data/progress/activity-postcall-{callId}.json`.
- Output: `public/call/{callId}.html` + updates `data/calls/{callId}.json`.

5) **SMS Worker (durable file queue)**
- Job enqueue: `lib/sms-queue.ts` writes `data/jobs/sms/{callId}.json` (idempotent).
- Worker loop: `ensureSmsWorker()` runs `setInterval`.
- Send SMS: `lib/twilio.ts` (`Twilio(...)` client) sends text with call page URL.
- State: updates `data/calls/{callId}.json` under `sms` fields; logs to `data/errors/sms-errors.json` on failures.

6) **History Persistence**
- Index: `data/history/sessions.json` maintained via `lib/history.ts`.
- Detail snapshots: `data/history/sessions/{sessionId}.json` written for terminal runs (or on cancel).
- UI: `HistoryList`, `HistorySessionReplay`, and APIs in `app/api/history/*`.

---

## 3) Architecture Map (Request & Data Flows)

### 3.1 Agency Pipeline Flow (search → parallel jobs → demos)

Client:
- `app/page.tsx`
  - `POST /api/pipeline/start` with `{ suburb, count }`.
  - Opens SSE: `GET /api/pipeline/stream?session=...`
  - Optionally rehydrates from `localStorage` by calling `GET /api/pipeline/state?session=...`

Server:
- `app/api/pipeline/start/route.ts`
  - Creates initial progress files:
    - `data/progress/pipeline-{sessionId}.json`
    - `data/progress/activity-{sessionId}.json`
  - Runs Claude Agent SDK query (the “orchestrator”) in a background async task.
  - Stores a handle for cancellation in `globalThis.__voqoPipelineRuns` via `lib/pipeline-registry.ts`.
  - On completion/error/cancel, persists session to history (best-effort).

- Claude orchestrator (prompt is generated in `buildOrchestratorPrompt(...)`):
  - Identifies agencies quickly with WebSearch (no deep WebFetch at this stage).
  - Writes skeleton agency progress files `data/progress/agency-{agencyId}.json`.
  - Spawns parallel subagents (Task tool) using the `agency-processor` skill.

- Subagents (Claude, out-of-process relative to this repo’s code but driven by skill docs):
  - Update progress and activity:
    - `data/progress/agency-{agencyId}.json`
    - `data/progress/agency-activity-{agencyId}.json`
  - Write durable agency record:
    - `data/agencies/{agencyId}.json`
  - Write demo HTML:
    - `public/demo/{agencyId}.html`

Streaming:
- `app/api/pipeline/stream/route.ts`
  - Uses `fs.watch(data/progress)` to detect changes.
  - Emits SSE events for:
    - pipeline/todos updates
    - agency card updates/removals
    - main activity deltas
    - subagent activity deltas
  - Has reconciliation: if pipeline stuck in `processing` but all agencies finished, it finalizes pipeline + saves history.

### 3.2 Demo Page → Register-call → Personalization (context injection)

Demo page serving:
- `app/demo/[slug]/page.tsx`
  - Reads `public/demo/{slug}.html`
  - Reads `data/agencies/{slug}.json` best-effort
  - Injects:
    - `window.__VOQO_DEMO_PHONE__` (from `lib/phone.ts`)
    - `window.__VOQO_AGENCY__` (minimal agency info)
    - optional `window.__VOQO_SESSION_ID__` (from `?session=...`)
    - `<script src="/voqo-demo-call.js" defer></script>`

Client-side call activation:
- `public/voqo-demo-call.js`
  - Renders a fixed “call bar” UI.
  - Intercepts `tel:` links so the dialed number is always the demo number.
  - Before dialing, calls `POST /api/register-call` using `sendBeacon` (preferred) or `fetch({ keepalive: true })`.
  - Includes optional settings from `localStorage` (`voqo:voiceAgentSettings`).

Register call context:
- `app/api/register-call/route.ts`
  - Writes/updates `data/context/pending-calls.json`:
    - cleans expired contexts
    - adds new entry keyed by `contextId`
    - stores `agencyData`, optional `settings`, optional `sessionId`

ElevenLabs personalization webhook:
- `app/api/webhook/personalize/route.ts`
  - Loads `data/context/pending-calls.json`
  - Selects the “most recent active” (within 5 minutes) OR “most recent pending” context.
  - Marks a pending context as `active` and stores `callerId`, `callSid`, `activatedAt`.
  - Returns:
    - `dynamic_variables` including `context_id` (the matched context key)
    - optional `conversation_config_override`:
      - if stored `settings` exist: overrides prompt + first message after substituting variables
      - else: overrides first message with an agency-name greeting (legacy)

### 3.3 Call completion → Post-call generation → SMS

ElevenLabs call-complete webhook:
- `app/api/webhook/call-complete/route.ts`
  - Verifies signature in production with a permissive fallback if secret/signature missing.
  - Builds `callId`, matches context with priority:
    1) `context_id` from dynamic variables
    2) `callSid`
    3) `callerId` (phone), status `active`
    4) most recent pending
  - Writes `data/calls/{callId}.json` with transcript + metadata and `pageStatus="generating"`.
  - Marks matched context as `completed` and records `callId`.
  - Appends agency call history: `data/agency-calls/{agencyId}.json`.
  - Enqueues postcall job: `data/jobs/postcall/{callId}.json`.
  - Starts postcall + sms workers (via `ensurePostcallWorker()` and `ensureSmsWorker()`).

Postcall worker:
- `lib/postcall-queue.ts`
  - Polls `data/jobs/postcall/` every 5s.
  - Claims job via rename to `.processing`.
  - Runs Claude Code with `activitySessionId=postcall-{callId}`:
    - activity hooks append messages to `data/progress/activity-postcall-{callId}.json`
  - Validates output exists (`public/call/{callId}.html`), then:
    - updates `data/calls/{callId}.json` (`pageStatus`, `pageUrl`, `generatedAt`, extracted data, listings)
    - updates agency call entry in `data/agency-calls/{agencyId}.json`
    - enqueues SMS job

SMS worker:
- `lib/sms-queue.ts`
  - Polls `data/jobs/sms/` every 5s.
  - Claims via rename to `.processing`.
  - Checks call JSON prerequisites:
    - `pageStatus === 'completed'`
    - `pageUrl` present
    - `callerPhone` present
  - Sends SMS via Twilio with a full URL (base from `NEXT_PUBLIC_APP_URL`, fallback `http://localhost:3000`).
  - Updates `data/calls/{callId}.json` under `sms` and logs errors.

---

## 4) Module Map (Code-Level Dependencies)

### 4.1 API Routes → Libraries → Filesystem

Pipeline:
- `app/api/pipeline/start/route.ts`
  - uses: `@anthropic-ai/claude-agent-sdk` `query(...)`
  - uses: `lib/claude.ts` (env/model helpers only)
  - uses: `lib/pipeline-registry.ts` (in-memory run handle)
  - uses: `lib/history.ts` (persist run)
  - uses: `lib/types.ts`, `lib/ids.ts`
  - writes: `data/progress/pipeline-*.json`, `data/progress/activity-*.json`

- `app/api/pipeline/stream/route.ts`
  - uses: `fs.watch`, `lib/types.ts`, `lib/history.ts`, `lib/ids.ts`, `lib/server/activity.ts`
  - reads/writes: `data/progress/*.json`, checks `public/demo/{agencyId}.html`

- `app/api/pipeline/state/route.ts`
  - reads: `data/progress/pipeline-*.json`, `data/progress/activity-*.json`, `data/progress/agency-*.json`, `data/progress/agency-activity-*.json`
  - uses: `lib/server/activity.ts` for stable IDs

- `app/api/pipeline/cancel/route.ts`
  - uses: `lib/pipeline-registry.ts` to interrupt query
  - writes: pipeline/activity files and persists history

Calls / Postcall:
- `app/api/webhook/call-complete/route.ts`
  - uses: `lib/postcall-queue.ts`, `lib/sms-queue.ts`, `lib/agency-calls.ts`
  - reads/writes: `data/context/pending-calls.json`, `data/calls/{callId}.json`
  - enqueues: `data/jobs/postcall/{callId}.json`

- `app/api/webhook/personalize/route.ts`
  - reads/writes: `data/context/pending-calls.json`
  - returns: ElevenLabs personalization response

- `app/api/calls/*`
  - reads: `data/calls/*.json`
  - reads: `data/progress/activity-postcall-{callId}.json` (detail endpoints)
  - calls “keep workers moving”: `processPostcallJobsOnce`, `processSmsJobsOnce`, `ensureSmsWorker`

- `app/api/call-status/route.ts`
  - reads: `data/calls/*.json`
  - calls: `processPostcallJobsOnce()` best-effort

- `app/api/agency-calls/route.ts` + `lib/agency-calls.ts`
  - reads/writes: `data/agency-calls/{agencyId}.json`

History:
- `app/api/history/*` + `lib/history.ts`
  - reads/writes: `data/history/sessions.json` and `data/history/sessions/{sessionId}.json`

Legacy endpoints:
- `app/api/search/route.ts` and `app/api/generate-demo/route.ts`
  - invoke Claude Code via `lib/claude.ts` `invokeClaudeCode(...)`
  - are logically superseded by the pipeline flow in specs; they remain in-tree.

### 4.2 UI Components → API Routes

`app/page.tsx`:
- calls:
  - `POST /api/pipeline/start`
  - `GET /api/pipeline/stream` (SSE)
  - `GET /api/pipeline/state` (rehydration)
  - `POST /api/pipeline/cancel`
  - `GET /api/history`
  - `PATCH /api/history/{sessionId}`
  - `GET /api/calls?session=...`
  - `GET /api/calls/stream?session=...` (SSE)

`components/CallDetailModal.tsx`:
- calls:
  - `GET /api/calls/{callId}`
  - `GET /api/calls/stream-detail?callId=...` (SSE)

`app/demo/[slug]/page.tsx` + `public/voqo-demo-call.js`:
- calls:
  - `POST /api/register-call`
  - optionally `GET /api/call-status?agency=...` (legacy results CTA)

---

## 5) System-by-System Analysis (Line-by-line, Organized by Subsystem)

This section is “line-by-line” in the sense of reviewing each file’s responsibilities, assumptions, and failure modes. It is grouped to stay readable.

### 5.1 Pipeline Orchestration & Streaming

Files:
- `app/api/pipeline/start/route.ts`
- `app/api/pipeline/stream/route.ts`
- `app/api/pipeline/state/route.ts`
- `app/api/pipeline/cancel/route.ts`
- `lib/pipeline-registry.ts`
- `lib/history.ts`
- `lib/types.ts`
- `lib/ids.ts`
- `lib/server/activity.ts`

`app/api/pipeline/start/route.ts` review:
- Creates directories `data/progress`, `data/agencies`, `public/demo` on each run (safe).
- Writes:
  - `pipeline-{sessionId}.json` with initial todos and status `searching`.
  - `activity-{sessionId}.json` with one initial message and tracking fields.
- Starts Claude Agent SDK query (orchestrator) and stores a handle for cancellation in a global map.
- Drains the query asynchronously (background) and tries to map tool use blocks into main activity messages (tool ids de-duplicated via `seenToolUse`).
- On completion/error/cancel, calls `persistSessionToHistory(...)` which:
  - loads pipeline + activity + agency progress + subagent activity
  - writes a durable session detail snapshot
  - writes/updates history index entry

Key assumptions:
- The Next.js runtime is long-lived and allows background async work after response returns.
- A single process handles both start and cancel (so the in-memory run handle is reachable).
- Claude Agent SDK “Task” calls create parallel subagents that reliably write the specified files.

Notable implementation details:
- Activity: `appendMainActivityMessage(...)` is best-effort and ignores failures. This prevents pipeline failure due to logging issues but can reduce UI visibility during failures.
- The orchestrator prompt explicitly instructs “Do NOT edit any activity stream files manually”, but this route does write main activity messages based on tool usage anyway. That’s not necessarily wrong, but it’s a conceptual mismatch worth noting.
- `slugify(...)` exists but is not used in this file (minor dead code).

`app/api/pipeline/stream/route.ts` review:
- Uses `fs.watch(PROGRESS_DIR)` to push SSE events.
- Maintains hashes per file to avoid emitting unchanged payloads.
- Has reconciliation logic:
  - if pipeline says `processing` but all agencies have terminal statuses, it finalizes pipeline state as `complete` and emits `pipeline_complete`.
  - it also attempts to reconcile agency completion if the HTML exists but progress didn’t mark it done (`maybeReconcileAgency(...)`).
- Saves history index entry when terminal; detail is written in other code paths (cancel/start finally) and sometimes also in SSE.

Key assumptions and risks:
- `fs.watch` semantics vary across platforms/filesystems; missing events or duplicate events are possible. The code’s debouncing and “refresh snapshot” approach mitigates but doesn’t eliminate this.
- The watch is per SSE client. Multiple clients means multiple watchers. For a demo this is fine; at scale it becomes a resource risk.
- Cleanup: `cleanupStaleFiles()` deletes any file older than 24h in `data/progress` without filtering extensions; it can delete `.processing` artifacts if such files ever live in progress dir (currently they don’t; job queues are in `data/jobs/...`).

`app/api/pipeline/state/route.ts` review:
- Loads pipeline + agencies + main activity + subagent activity for a session.
- Uses `normalizeActivityMessage(...)` to produce stable message IDs and sanitize timestamps.
- Good: strict sessionId validation with `isSafeSessionId(...)`.

`app/api/pipeline/cancel/route.ts` review:
- Attempts to interrupt the active Claude query via in-memory handle. Regardless of interrupt success, it:
  - sets pipeline status to `cancelled`
  - appends a “Pipeline cancelled by user” main activity message
  - writes a history detail snapshot for replay
- Good: makes the filesystem a source of truth for the client, even if interrupt fails.

`lib/pipeline-registry.ts` review:
- Stores query handles in `globalThis.__voqoPipelineRuns`.
- Works in a single-process runtime; breaks under multi-process deployments.

`lib/history.ts` review:
- Maintains `data/history/sessions.json` (max 50).
- Writes detail snapshots under `data/history/sessions/{sessionId}.json`.
- Derives history session stats by reading agency progress files from `data/progress`.
- Normalizes `demoUrl` by removing `.html` suffix if present.

### 5.2 Demo Page Serving & Call Activation

Files:
- `app/demo/[slug]/page.tsx`
- `public/voqo-demo-call.js`
- `lib/phone.ts`
- `app/api/register-call/route.ts`

`app/demo/[slug]/page.tsx` review:
- Reads the generated demo HTML file from `public/demo/{slug}.html`.
- Reads `data/agencies/{slug}.json` for agency context (best-effort), and normalizes fields.
- Injects config + the call activation script:
  - `window.__VOQO_DEMO_PHONE__`
  - `window.__VOQO_AGENCY__`
  - optional `window.__VOQO_SESSION_ID__` from `?session=...`
  - `<script src="/voqo-demo-call.js" defer></script>`
- Strips `.html` suffix from the route param if present so `/demo/foo.html` works.

Key assumptions:
- Generated HTML is safe to serve via `dangerouslySetInnerHTML` (this is a demo; it is inherently “trust your generator”).
- The injected script must run for correct context registration; the design relies on routing through this Next route.

`public/voqo-demo-call.js` review:
- Adds an always-on call bar and patches “legacy CTAs” within generated HTML:
  - Intercepts any existing `tel:` links so they dial the demo number.
  - Registers call context before dialing using `sendBeacon` or `fetch(keepalive)`.
  - Optionally includes voice-agent settings from localStorage.
  - Implements `window.registerDemoCall()` (polls `/api/call-status`) for “I already called” CTA patterns.
  - Implements `window.registerForCall()` to redirect old handlers to the new “call now” behavior.
- It avoids walking the entire DOM by limiting patch candidates (`h1,h2,h3,p,span,div` capped at 250).

Key assumptions and risks:
- The script assumes same-origin access to `/api/register-call`.
- It assumes the demo page can store/read localStorage (blocked in some privacy modes or if embedded).
- It assumes dialing via `window.location.href='tel:...'` is acceptable UX across devices (it is typical, but desktop behavior is inconsistent).

`lib/phone.ts` review:
- Enforces a single demo number (`04832945767` / `+614832945767`) unless the environment provides the exact same value.
- This reduces “wrong demo number” drift and keeps generated pages consistent.

`app/api/register-call/route.ts` review:
- Reads raw body as text to support sendBeacon.
- Accepts two shapes:
  - `{ agencyData, timestamp, settings?, sessionId? }`
  - or legacy fields `{ agencyId, agencyName, context: ... }`
- Generates `contextId` and writes to `data/context/pending-calls.json`.
- Cleans expired contexts on every write.

Key risks:
- Concurrency: multiple register requests in short succession can overwrite each other due to read-modify-write with no lock.
- Data growth: completed contexts are never pruned unless they expire; in practice they will be pruned if `expiresAt` is past, but completed contexts appear to share the same TTL window as pending.

### 5.3 ElevenLabs Webhooks (Personalize & Call Complete)

Files:
- `app/api/webhook/personalize/route.ts`
- `app/api/webhook/call-complete/route.ts`

`app/api/webhook/personalize/route.ts` review:
- Extremely verbose logging (headers, full body, per-context logs).
- Context selection:
  - prefers most recent `active` within 5 minutes (retry friendliness)
  - else prefers most recent `pending` within TTL
  - else falls back to “any valid unexpired context”
  - else uses a default agency
- Marks pending context as `active` and stores `callerId`, `callSid`, `activatedAt`.
- Returns `dynamic_variables` with `context_id` set to the matched context key.
- If context included custom `settings`, substitutes variables and returns `conversation_config_override.agent.prompt.prompt` and `.first_message`.

Key assumptions and risks:
- The mapping depends on “time adjacency”: the newest context is assumed to correspond to the call. Under concurrent users, misattribution is plausible.
- No signature verification is implemented here, despite the system specs describing HMAC verification.
- Logging likely includes PII (caller phone). This is acceptable for a dev demo but risky in production logs.

`app/api/webhook/call-complete/route.ts` review:
- Verifies signature only if `NODE_ENV === 'production'`, but still **allows** requests if secret or signature is missing (permissive).
- Matches context using multiple strategies and writes:
  - `data/calls/{callId}.json` (call record, transcript, `pageStatus: generating`)
  - updates `data/context/pending-calls.json` for matched context to `completed`
  - appends agency call history (`data/agency-calls/{agencyId}.json`)
  - enqueues postcall job (`data/jobs/postcall/{callId}.json`)
- Starts workers:
  - `ensurePostcallWorker()`
  - `ensureSmsWorker()`

Key assumptions and risks:
- If Twilio env vars are missing, importing Twilio client (via sms-queue) may crash at runtime (depends on when modules are imported).
- Signature verification may not match ElevenLabs’ actual signing format. The code comments “TODO” and the spec example differ (spec shows HMAC over payload; code signs `timestamp.payload`).
- If signature fails in production, the system returns 401 and no post-call artifacts are generated.

### 5.4 Post-call Worker (Queue + Activity + Call State)

Files:
- `lib/postcall-queue.ts`
- `lib/claude.ts`
- `lib/server/activity.ts`
- `lib/agency-calls.ts`

`lib/postcall-queue.ts` review:
- Implements a durable filesystem queue:
  - job `.json` = pending
  - `.processing` = in progress
  - deletion = complete
- Handles stale processing jobs by renaming back to `.json`.
- Attempts up to 3 times; on exceeded attempts:
  - logs to `data/errors/postcall-errors.json`
  - marks call `pageStatus: failed`
  - updates agency-call entry to `failed`
- After a run, it validates output (`public/call/{callId}.html` exists).
- “Already generated” fast path: if HTML exists and call JSON already indicates completed, it finalizes without rerunning Claude to prevent infinite retries.

Risks:
- Worker lifecycle is `setInterval` + module-scoped `workerStarted`. In dev hot reload or if code is loaded in multiple runtimes, multiple intervals can start.
- The queue design is correct for single-machine reliability, but it is sensitive to partial writes/corrupt JSON.

`lib/claude.ts` review:
- Wraps Claude Agent SDK query execution with hooks that log activity messages to `data/progress/activity-{sessionId}.json`.
- Also supports `invokeClaudeCode(...)` which consumes the query stream and returns a result string, but the system’s actual output is mostly “files written by Claude” rather than the returned text.
- Hook pipeline writes:
  - Session start/end
  - PreToolUse and PostToolUse (with message mapping)
  - PostToolUseFailure (warning)

Key mismatch:
- There are two different “activity logging” mechanisms in this codebase:
  - pipeline/start’s bespoke tool-use parsing + `appendMainActivityMessage(...)`
  - lib/claude.ts’s hook-based activity logging
  This duplication is a simplification opportunity.

### 5.5 SMS Worker (Queue + Twilio)

Files:
- `lib/sms-queue.ts`
- `lib/twilio.ts`

`lib/twilio.ts` review:
- Creates Twilio client at import time using non-null assertions:
  - `process.env.TWILIO_ACCOUNT_SID!`
  - `process.env.TWILIO_AUTH_TOKEN!`
  - `process.env.TWILIO_PHONE_NUMBER!`
- If these are missing, the module can throw at runtime on import, potentially taking down any API route that imports sms queue (directly or indirectly).

`lib/sms-queue.ts` review:
- Durable `.json → .processing` queue similar to postcall.
- Retries up to 5 attempts.
- Can keep jobs pending until prerequisites are ready.
- Updates call JSON `sms` fields and logs errors in `data/errors/sms-errors.json`.

Key behavioral quirk:
- On any exception during send flow, it writes `sms.status = 'failed'` but then renames `.processing` back to `.json`, meaning it will retry again later anyway (until attempts exceeded). This is not “wrong”, but it makes “failed” ambiguous (failed permanently vs failed on the last attempt).

### 5.6 Calls APIs & UI Streaming

Files:
- `app/api/calls/route.ts`
- `app/api/calls/stream/route.ts`
- `app/api/calls/[callId]/route.ts`
- `app/api/calls/stream-detail/route.ts`
- `components/CallsPanel.tsx`
- `components/CallDetailModal.tsx`

Calls list endpoints:
- `GET /api/calls`: reads up to 100 call files, filters to a session if provided, returns 50 newest.
- `GET /api/calls/stream`: SSE watcher on `data/calls/`, emits `calls_update` when list hash changes.
- Both endpoints “tick” the workers (`processPostcallJobsOnce`, `processSmsJobsOnce`, `ensureSmsWorker`) so monitoring the UI keeps the pipeline moving.

Call detail endpoints:
- `GET /api/calls/{callId}`: reads call JSON + postcall activity file.
- `GET /api/calls/stream-detail`: watches both calls dir and progress dir for call-specific updates (SSE).

UI:
- Calls panel is only connected while open; call detail modal always streams while shown.
- Deduping uses both message IDs and “content keys” to handle unstable IDs across sources.

### 5.7 History (Index + Detail Replay)

Files:
- `app/api/history/route.ts`
- `app/api/history/[sessionId]/route.ts`
- `components/HistoryList.tsx`, `components/HistoryCard.tsx`, `components/HistorySessionReplay.tsx`

Behavior:
- Index endpoint reads `data/history/sessions.json`.
- Detail endpoint returns a stored session detail snapshot if present; otherwise reconstructs from progress files and persists only for terminal runs.
- UI supports rename via PATCH, and attempts to keep detail snapshot’s session name in sync.

### 5.8 Legacy Search/Generate Endpoints

Files:
- `app/api/search/route.ts`
- `app/api/generate-demo/route.ts`

These endpoints invoke Claude “skills” to produce cached agency search results and demo HTML generation. They appear superseded by the pipeline in `SPEC-PIPELINE.md` but remain available.

Risk:
- The “demo-page-builder” and “agency-researcher” skills are referenced in prompts but not present in `.claude/skills/` (in this repo’s file list). If those skills aren’t available in the Claude runtime configuration, these endpoints will fail.

---

## 6) Edge Cases, Failure Points, and Where Systems Can Fail

This section enumerates failure modes and edge cases, grouped by subsystem. Severity is relative to demo correctness.

### 6.1 Filesystem Concurrency & Atomicity (High severity)

Shared JSON files are updated via read-modify-write without locking:
- `data/context/pending-calls.json` (register-call, personalize, call-complete)
- `data/history/sessions.json` (history writes)
- `data/agency-calls/{agencyId}.json` (append/update)
- `data/calls/{callId}.json` (postcall worker, sms worker)

Failure modes:
- Lost updates when two requests write the file concurrently.
- Partial writes can produce invalid JSON (power loss, process crash mid-write), cascading into downstream failures.

Symptoms:
- Wrong agency mapped to a call (context overwritten).
- Missing call entries in history or agency-calls.
- Endpoints returning 500 because JSON.parse fails.

### 6.2 Context Matching Correctness (High severity for demo quality)

Personalize webhook chooses:
- “most recent active” within 5 minutes OR “most recent pending”.

Edge cases:
- Two people click “Call now” at similar times on different demo pages:
  - the second register-call can become “most recent pending”, causing the first caller’s personalization to use the wrong agency.
- ElevenLabs calling personalize multiple times:
  - code prefers recent active to mitigate, but still only one active context is selected.
- Caller retries after TTL expiry:
  - context may have been cleaned; caller gets default agency.

Call-complete matching is more robust (tries `context_id`, `callSid`, `callerId`), but if the personalize webhook misattributed, the wrong `context_id` is baked into `dynamic_variables` and becomes the primary match.

### 6.3 Worker Lifecycle & Next.js Runtime Assumptions (Medium–High)

Workers are started by calling `ensurePostcallWorker()` / `ensureSmsWorker()` within request handlers.

Edge cases:
- Dev HMR/module reload can start multiple intervals, processing queues in parallel and increasing race likelihood.
- If deployed in a serverless style (not the intended VPS design), intervals and background tasks will not reliably run.
- If PM2 is configured with multiple instances (cluster mode), each instance may process the same queues, potentially sending duplicate SMS unless idempotency is perfect.

### 6.4 Webhook Security & Verification Drift (High in production, Medium in demo)

Spec expectation:
- HMAC verification on webhook requests.

Implementation:
- `personalize` webhook: no signature check.
- `call-complete` webhook:
  - verifies only in `NODE_ENV=production`, but allows requests if secret/signature missing (still in production).
  - signature algorithm may not match ElevenLabs’ actual scheme.

Failure modes:
- Unauthorized calls can create call records and trigger Claude work + SMS spam (if public).
- Valid ElevenLabs requests may be rejected if verification is wrong.

### 6.5 Error Handling Differences Across Endpoints (Medium)

Robust endpoints:
- `/api/calls` tolerates corrupt call JSON files per-file (`safeJsonParse`).

Fragile endpoint:
- `/api/call-status` reads each call file and parses without per-file try/catch. One corrupt JSON file can cause the endpoint to fail and return “no recent call” for all agencies due to the outer catch.

### 6.6 Twilio Env Hard Dependency at Import Time (Medium–High)

`lib/twilio.ts` creates a Twilio client immediately with `!` env assertions.

Failure mode:
- Missing env vars can crash routes that import sms worker or call list endpoints that call `ensureSmsWorker()`.

### 6.7 fs.watch / SSE Reliability (Medium)

Edge cases:
- Some filesystems coalesce events; some drop events under load.
- Multiple SSE clients create multiple watchers and more load.
- Hashing `JSON.stringify(...)` to detect changes can become expensive if payloads grow (especially calls list).

### 6.8 Data Retention & Cleanup (Low–Medium)

Progress cleanup:
- `pipeline/stream` cleans progress dir >24h old on each SSE connection.
- `lib/progress-cleanup.ts` exists but is not clearly used in current flows (potential duplication).

Calls retention:
- Specs mention 30 days; current code does not enforce call retention. This can lead to unbounded `data/calls/` growth on a long-running VPS.

Contexts retention:
- Expired contexts are pruned on register-call writes. Completed contexts rely on expiration; there is no explicit “prune completed contexts older than X”.

---

## 7) Simplification Opportunities (Concrete Recommendations)

These are “no new features” suggestions intended to reduce complexity, remove duplication, and improve reliability. They are grouped by return-on-effort.

### 7.1 High ROI / Low complexity

1) Unify activity logging
- Today:
  - `app/api/pipeline/start/route.ts` parses tool_use blocks manually.
  - `lib/claude.ts` already has robust hook-based activity writing.
- Simplify:
  - Use one mechanism everywhere (prefer hooks). This removes duplicated `formatToolDetail(...)` and divergent message schemas.

2) Normalize JSON read/write utilities
- Many files implement their own `safeJsonParse` and file read logic.
- Simplify:
  - Create a single `lib/fs-json.ts` with:
    - `readJson(path)`, `writeJsonAtomic(path, obj)`, `tryReadJson(...)`
  - Apply consistently so corrupt files don’t kill endpoints.

3) Reduce webhook logging noise / isolate debug mode
- Personalize and call-complete log full bodies and all headers by default.
- Simplify:
  - Gate verbose logs behind an env flag (e.g. `DEBUG_WEBHOOKS=1`) and log only ids in normal mode.

### 7.2 High ROI / Medium complexity

4) Add atomic writes + lock strategy for shared JSON files
- Minimal approach (still file-based):
  - write to `file.tmp`, then `rename` to target (atomic on most POSIX filesystems).
  - for read-modify-write, use a simple advisory lock file (`.lock`) or a queueing mechanism per resource.
- Biggest correctness gain is on `data/context/pending-calls.json`.

5) Make workers single-owner
- Today, workers are opportunistically started from request handlers.
- Simplify:
  - Start them once from a single known place (e.g. a dedicated “bootstrap” API route hit by health checks, or a custom server entrypoint in a VPS).
  - Alternatively, run them as separate `node` processes under PM2; this avoids Next module reload issues.

6) Webhook verification consistency
- Implement the same signature strategy for both webhooks, aligned with ElevenLabs docs and with `SPEC-DATA-API.md`.
- Enforce “no secret in production => reject” to match the spec and reduce abuse risk.

### 7.3 Medium ROI / Medium complexity

7) Replace `fs.watch` SSE with polling + incremental diff
- `fs.watch` is efficient but fragile.
- A simple polling loop (every 250–500ms) that reads small JSON files can be more portable and predictable for a demo. It also avoids per-client watchers.

8) Remove or clearly mark legacy endpoints
- `/api/search` and `/api/generate-demo` depend on skills that are not in the repo. If they are not used, they add confusion.
- If they must stay, explicitly document “legacy / may not work without external skills”.

### 7.4 “Better/simpler approaches” (architectural alternatives)

9) Use SQLite instead of scattered JSON files (still single-VPS)
- Keeps the “no external infra” property while solving:
  - concurrency
  - atomicity
  - indexing
  - retention
- A single SQLite DB can store:
  - contexts
  - calls
  - agency call history
  - pipeline sessions and details
  - message streams (append-only tables)

10) Use a proper queue (still single-VPS)
- If you want to stay local:
  - `bullmq` + Redis (adds service) OR
  - `pg-boss` + Postgres (adds DB) OR
  - keep filesystem queue but isolate worker in a dedicated process with strict idempotency and file locks

---

## 8) “Where Systems Can Fail” (End-to-End Scenarios)

### Scenario A: User clicks Call on demo page, but personalization uses wrong agency
Root causes:
- Two simultaneous register-call requests; newest pending wins.
- No caller_id-based matching in personalize selection.
Impact:
- Voice agent greets with wrong agency name, undermining demo.

### Scenario B: Call-complete webhook rejected in production
Root causes:
- Signature verification mismatch with ElevenLabs signing scheme.
- Missing header (`x-elevenlabs-signature` vs `elevenlabs-signature`) or missing secret.
Impact:
- No `data/calls/{callId}.json` created, no postcall page, no SMS.

### Scenario C: SMS never sent even though page exists
Root causes:
- `callerPhone` missing/invalid in call JSON.
- `NEXT_PUBLIC_APP_URL` not set in production; message link points to localhost.
- Worker intervals not running (process restarted, no worker triggered).
Impact:
- Demo loses the “follow-up text message” moment.

### Scenario D: `/api/call-status` starts returning false for everything
Root causes:
- One corrupt JSON call file causes an exception inside the loop.
Impact:
- Legacy “I already called” CTA never resolves.

### Scenario E: Duplicate processing or multiple SMS attempts
Root causes:
- Multiple Node processes running workers concurrently.
- Intervals started multiple times due to module reload.
Impact:
- Duplicate SMS (mostly prevented by idempotency + status checks, but not guaranteed under races).

---

## 9) Spec Alignment Notes (Implementation vs `specs/`)

Aligned:
- File-based storage model (`/data` JSON, `/public` HTML).
- Pipeline progress file schemas (mostly).
- SSE streaming patterns and UI concepts.
- Voice agent settings via localStorage → register-call → personalize override chain (see `specs/silo-plan-voice-agent-settings.md`).

Drift / gaps:
- Webhook security: spec describes strict HMAC verification; implementation is partial and permissive.
- Data lifecycle: spec describes retention; code does not enforce call retention.
- Context matching strategy in spec includes prioritized matching (context_id/callSid/callerId/most recent). Implementation:
  - call-complete: mostly matches spec
  - personalize: mostly “most recent” logic; it does not use an incoming context_id to select, because ElevenLabs initiation payload here doesn’t include it.

---

## 10) Appendix: Environment Variables Observed in Code/Specs

From `specs/SPEC-ARCHITECTURE.md` and code usage:

Twilio:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

ElevenLabs:
- `ELEVENLABS_API_KEY` (mentioned in specs; not directly used in repo code)
- `ELEVENLABS_AGENT_ID` (mentioned in specs; not directly used in repo code)
- `ELEVENLABS_WEBHOOK_SECRET` / `ELEVENLABS_WEBHOOK_SECRET` (used in call-complete)

App URLs / phone:
- `NEXT_PUBLIC_APP_URL` (used for SMS link base)
- `NEXT_PUBLIC_DEMO_PHONE` (used but enforced to required demo number)
- `DEMO_DIAL_NUMBER` (alternate demo number env, but must match required)

Claude:
- `CLAUDE_MODEL` (defaults to `sonnet`)

---

## 11) Final Notes

- This repo is intentionally optimized for a single VPS, single-process demo. The major reliability and security concerns are mostly “production hardening” concerns; however, the context misattribution risk can impact even a demo if multiple people test concurrently.
- The most valuable simplification is to reduce duplicated activity/progress code paths and make all JSON updates atomic + concurrency-safe (even if you keep filesystem persistence).

