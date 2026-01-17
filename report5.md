# VoqoLeadEngine — Full Codebase Review & Analysis (Report 5)

Date: 2026-01-17  
Repo: `/Users/varunprasad/code/prjs/voqo-demo`

This report is **read-only analysis**. No code changes were made; only this report file was created.

---

## 1) Complete Tracked File Tree (`git ls-files`)

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

## 2) Architecture Map (End-to-End)

### 2.1 High-level runtime architecture

**Core principle:** single VPS, **Next.js App Router** provides UI + API routes; everything persists to **filesystem JSON + HTML**.

```
User Browser
  ├─ GET /                       (main UI)
  ├─ POST /api/pipeline/start    (spawn Claude Code orchestrator)
  ├─ GET /api/pipeline/stream    (SSE stream from /data/progress)
  ├─ GET /demo/:slug             (serves generated HTML + injects call script)
  └─ (Call) tel:+614832945767 → Twilio → ElevenLabs

ElevenLabs (Conversational AI)
  ├─ POST /api/webhook/personalize   (inject agency + settings into conversation)
  └─ POST /api/webhook/call-complete (transcript → enqueue postcall job)

Background (in-process “worker loops” + best-effort triggers)
  ├─ /data/jobs/postcall/*.json      (job queue; Claude Code generates /public/call/*.html)
  └─ /data/jobs/sms/*.json           (SMS queue; Twilio sends link)

Persistence (filesystem)
  ├─ /data/progress/*                (ephemeral; SSE watches via fs.watch)
  ├─ /data/history/*                 (durable session index + snapshots)
  ├─ /data/calls/*                   (durable call records)
  ├─ /data/context/pending-calls.json (ephemeral mapping: demo-page-click → incoming call)
  ├─ /data/agencies/*                (durable agency records)
  ├─ /data/agency-calls/*            (durable per-agency call index)
  └─ /public/demo/*, /public/call/*  (generated HTML pages)
```

### 2.2 “Systems” and their owning files

#### A) Main UI (search + live pipeline + calls panel + settings)
- `app/page.tsx` (client; SSE + state; persists active session to `localStorage`)
- Workspace + UI components:
  - `components/MainAgentWorkspace.tsx`
  - `components/AgencyCard.tsx`, `components/ShimmerPreview.tsx`, `components/StepList.tsx`
  - `components/CallsPanel.tsx`, `components/CallDetailModal.tsx`
  - `components/HistoryList.tsx`, `components/HistoryCard.tsx`
  - `components/SettingsModal.tsx`
  - `components/ActivityMessage.tsx`
- Types and defaults:
  - `lib/types.ts` (Pipeline/Activity/History/VoiceAgentSettings + defaults)

#### B) Pipeline orchestrator (Claude Code) + progress files
- Start pipeline:
  - `app/api/pipeline/start/route.ts`
  - `lib/pipeline-registry.ts` (in-memory map of active runs to allow cancel)
  - `lib/claude.ts` (Claude SDK wrapper; **not used** by pipeline start, but used elsewhere)
- Live streaming:
  - `app/api/pipeline/stream/route.ts` (SSE; fs.watch on `data/progress`)
  - `app/api/pipeline/state/route.ts` (rehydration snapshot)
  - `app/api/pipeline/cancel/route.ts` (interrupt active run + mark files)
- Cleanup helpers:
  - `lib/progress-cleanup.ts` (exists but pipeline stream has its own cleanup path too)

#### C) Generated demo pages (HTML) + “Call Demo” activation
- Generated HTML files live at: `/public/demo/{agencyId}.html`
- Served through Next route (injects config + script):
  - `app/demo/[slug]/page.tsx`
  - `public/voqo-demo-call.js` (client script injected into demo HTML; registers call context then dials)
- Not found:
  - `app/demo/[slug]/not-found.tsx`

#### D) Context binding (demo page → incoming call)
- Register click:
  - `app/api/register-call/route.ts` (writes/updates `/data/context/pending-calls.json`)
- Context usage:
  - `app/api/webhook/personalize/route.ts`
  - `app/api/webhook/call-complete/route.ts`

#### E) Post-call generation pipeline (transcript → personalized page + SMS)
- Webhook ingestion:
  - `app/api/webhook/call-complete/route.ts` (writes `/data/calls/{callId}.json`, enqueues postcall job)
- Durable postcall queue + worker:
  - `lib/postcall-queue.ts` (file-queue via rename `*.json ↔ *.processing`)
- Durable SMS queue + worker:
  - `lib/sms-queue.ts` (file-queue; Twilio send; writes back `call.sms`)
  - `lib/twilio.ts` (Twilio client + normalize)

#### F) Calls UI surface (call list + detail + streaming)
- List and SSE stream:
  - `app/api/calls/route.ts`
  - `app/api/calls/stream/route.ts`
- Detail and SSE stream:
  - `app/api/calls/[callId]/route.ts`
  - `app/api/calls/stream-detail/route.ts`
- Page serving:
  - `app/call/[id]/page.tsx`
  - `app/call/[id]/not-found.tsx`

#### G) History (session index + replay)
- History index + detail snapshots:
  - `lib/history.ts`
  - `app/api/history/route.ts`
  - `app/api/history/[sessionId]/route.ts`
- Replay UI:
  - `app/history/[sessionId]/page.tsx`
  - `components/HistorySessionReplay.tsx`

#### H) Legacy/transition codepaths (still in tree)
- `app/api/search/route.ts` (older “suburb search” cache file; refers to `agency-researcher` skill which is not tracked here)
- `app/api/generate-demo/route.ts` (older “generate one demo page” path; refers to `demo-page-builder` skill which is not tracked here)
- `components/AgentActivityPanel.tsx`, `components/TodoPanel.tsx`, `components/MockPreview.tsx` (present; current UI primarily uses `MainAgentWorkspace` and `ShimmerPreview`)
- `proxy.ts` (redirect middleware-style code, but **not wired as Next.js middleware by filename**)

### 2.3 External service connections (exact touchpoints)

**ElevenLabs → App**
- `POST /api/webhook/personalize`  
  - Reads: `/data/context/pending-calls.json`  
  - Writes: `/data/context/pending-calls.json` (marks a context `active` and stores `callerId`/`callSid`/`activatedAt`)
- `POST /api/webhook/call-complete`  
  - Reads: `/data/context/pending-calls.json`  
  - Writes: `/data/calls/{callId}.json`, `/data/context/pending-calls.json`  
  - Enqueues: `/data/jobs/postcall/{callId}.json`

**App → Claude Code**
- Pipeline start uses `@anthropic-ai/claude-agent-sdk` directly:
  - `app/api/pipeline/start/route.ts` → `query(...)` (orchestrator prompt)
- Postcall generation uses `invokeClaudeCode`:
  - `lib/postcall-queue.ts` → `invokeClaudeCode(...)`
- Legacy endpoints also use `invokeClaudeCode`:
  - `app/api/search/route.ts`, `app/api/generate-demo/route.ts`

**App → Twilio**
- SMS worker:
  - `lib/sms-queue.ts` → `sendSMS()` in `lib/twilio.ts`

---

## 3) System-by-System Analysis (Line-by-line, by subsystem)

This section walks each subsystem “as implemented” and flags behavior, assumptions, and risks.

### 3.1 Pipeline: start → progress files → SSE → UI

**Start (`app/api/pipeline/start/route.ts`)**
- Validates `suburb` type; clamps `count` to `1..25`.
- Creates:
  - `/data/progress/pipeline-{sessionId}.json` (initial state + todos)
  - `/data/progress/activity-{sessionId}.json` (Activity object, initial message)
- Spawns a Claude Agent SDK `query()` with a long orchestrator prompt.
- Stores the running query in `globalThis.__voqoPipelineRuns` (via `lib/pipeline-registry.ts`) so `/api/pipeline/cancel` can call `query.interrupt()`.
- Runs the Claude query “in the background” (async IIFE) and *also* tries to infer tool usage by parsing `tool_use` blocks from assistant messages, then appends those into the main activity file.
- At completion/failure, calls `persistSessionToHistory()` which:
  - Reads pipeline + activity + agency progress files + agency activity files
  - Writes a durable detail snapshot to `/data/history/sessions/{sessionId}.json`
  - Updates `/data/history/sessions.json` index

**Progress streaming (`app/api/pipeline/stream/route.ts`)**
- SSE endpoint (`text/event-stream`) using `fs.watch(PROGRESS_DIR)` and debounced refresh.
- Tracks last hashes per file and only emits changes.
- Emits:
  - `todo_update` when pipeline state changes
  - `card_update` for `agency-{agencyId}.json`
  - `subagent_activity_message` for new messages in `agency-activity-{agencyId}.json`
  - `main_activity_message` for new messages in `activity-{sessionId}.json`
  - `pipeline_complete` once pipeline becomes terminal or is “reconciled” as terminal
- “Reconciliation” logic:
  - If pipeline status is `processing` and all tracked agency statuses are `complete|error`, it force-writes pipeline to `complete` and emits `pipeline_complete`.
  - It can also “reconcile” an agency into `complete` if the HTML exists in `/public/demo/{agencyId}.html` but the progress file didn’t mark complete yet.
- Performs best-effort deletion of stale progress files older than 24h.

**Rehydration (`app/api/pipeline/state/route.ts` + `app/page.tsx`)**
- `app/page.tsx` stores active sessionId in `localStorage` (`voqo:activePipelineSessionId`) and, on load, calls `/api/pipeline/state?session=...`.
- Snapshot response includes pipeline state, all agencies, main activity, per-agency activity.
- UI seeds message dedupe caches (by `id` and a “content key” of message fields), then attaches SSE stream to continue.

**Primary failure points**
- Reliance on `fs.watch` and in-process background async draining of Claude query: works on a long-lived VPS Node process; is fragile on serverless runtimes.
- The “manual tool-use parsing” in pipeline start is heuristic and may not match actual SDK message shapes across SDK versions.
- Several similar JSON read/normalize functions exist across files (risk of subtle divergence).

### 3.2 Demo pages: server-side HTML + injected call logic

**Serving (`app/demo/[slug]/page.tsx`)**
- Reads `/public/demo/{slug}.html` and returns it via `dangerouslySetInnerHTML`.
- Reads agency JSON from `/data/agencies/{slug}.json` if available and creates a “minimal agency object” for the call script.
- Injects:
  - `window.__VOQO_DEMO_PHONE__` (from `lib/phone.ts`)
  - `window.__VOQO_AGENCY__` (minimal agency object)
  - `window.__VOQO_SESSION_ID__` (optional `?session=...`, validated by `lib/ids.ts`)
  - `<script src="/voqo-demo-call.js" defer></script>`
- Injection prefers `</head>` then `</body>` then appends at end.

**Client behavior (`public/voqo-demo-call.js`)**
- Renders a fixed bottom call bar (“Call now” / “Copy number”).
- On “Call now”:
  - Builds payload including `agencyData`, `timestamp`, optional `sessionId`.
  - Adds `settings` from `localStorage` key `voqo:voiceAgentSettings` (if present).
  - Sends to `/api/register-call` via `sendBeacon` if possible, else `fetch(..., keepalive:true)`.
  - Navigates to `tel:` using server-returned `phoneNumber` if present, else fallback.
- Intercepts existing `a[href^="tel:"]` in generated HTML:
  - Rewrites `href` to the demo number.
  - Adds a click listener that fires `register-call` (best-effort; not awaited).
- Patches legacy CTAs:
  - Defines `window.registerForCall()` to trigger dial.
  - Defines `window.registerDemoCall()` to poll `/api/call-status?agency=...` and redirect once a page is ready.

**Primary failure points**
- `dangerouslySetInnerHTML` means any generated HTML is fully trusted. If generation is compromised, this is a complete XSS surface.
- The injected script assumes modern browser APIs (`replaceAll`, `sendBeacon`, etc.), and “tel:” navigation is platform-dependent (desktop UX can fail).

### 3.3 Call pages: serving post-call HTML

- `app/call/[id]/page.tsx` reads `/public/call/{callId}.html` and serves it via `dangerouslySetInnerHTML`.
- `app/call/[id]/not-found.tsx` is a client “Page Not Ready” view.
- **Important:** There is no server-side injection for post-call pages; they are served as generated.

### 3.4 Context binding: `/api/register-call` → `/api/webhook/personalize`

**Register (`app/api/register-call/route.ts`)**
- Accepts raw request body via `request.text()` then `JSON.parse`.
- Writes/updates `/data/context/pending-calls.json`:
  - Generates a new `contextId`
  - Cleans expired contexts (based on `expiresAt`)
  - Stores `agencyData`, optional `settings`, optional `sessionId`
  - TTL fixed at 5 minutes
- Returns enforced demo phone number from `lib/phone.ts`.

**Personalize webhook (`app/api/webhook/personalize/route.ts`)**
- Reads `/data/context/pending-calls.json`.
- Matching logic:
  1) Prefer contexts already marked `active` with recent `activatedAt` (within 5 minutes).
  2) Else pick most recent `pending` not expired, mark it `active`, and store `callerId`, `callSid`, `activatedAt`.
  3) Else fallback to “any valid context” not expired.
  4) Else fallback to default agency.
- Returns ElevenLabs “conversation initiation client data” response with:
  - `dynamic_variables` including `agency_*`, `demo_page_url`, `context_id`.
  - Optional `conversation_config_override`:
    - If the context has `settings`, it substitutes variables into `systemPrompt` and `firstMessage`.
    - Else may override only `first_message` for non-default agencies.

**Primary failure points**
- `register-call` stores `settings` without validating shape; `personalize` assumes strings and may throw if malformed.
- Concurrent reads/writes to a single JSON file without locking can cause lost updates or file corruption under parallel traffic.
- `personalize` contains extensive logging of headers and request body (PII exposure risk; also log volume risk).

### 3.5 Call completion → postcall job queue → page generation → SMS

**Call-complete webhook (`app/api/webhook/call-complete/route.ts`)**
- Verifies webhook signature via `verifyWebhookSignature()`:
  - Skips entirely when `NODE_ENV !== 'production'`.
  - In production: if secret is missing or signature missing, it logs a warning and still allows the request (**effectively unauthenticated**).
  - Assumes signature format `t=...,v0=...` and HMAC over `timestamp.payload`. This may not match ElevenLabs’ actual scheme (the code comments indicate this is still in flux).
- Generates new `callId` and writes `/data/calls/{callId}.json` including transcript and metadata.
- Context matching strategy:
  1) If `dynamic_variables.context_id` matches, use it.
  2) Else match `callSid` (from dynamic vars or conversation ID).
  3) Else match by `callerId` where context status is `active`.
  4) Else match most recent pending not expired.
- Updates matched context to `completed` and stores the `callId`.
- Appends to per-agency call index (`lib/agency-calls.ts`) with `status: generating`.
- Enqueues postcall job file (`lib/postcall-queue.ts`).
- Starts postcall + sms workers (`ensurePostcallWorker`, `ensureSmsWorker`) to process queues in-process.

**Postcall worker (`lib/postcall-queue.ts`)**
- Durable file-queue:
  - Pending jobs: `/data/jobs/postcall/{callId}.json`
  - In-progress lock: rename to `.processing`
- On processing:
  - Increments attempts; fails permanently if attempts > 3.
  - If output HTML already exists and call JSON says completed, finalizes without re-running Claude (prevents infinite retries).
  - Invokes Claude Code with `activitySessionId: postcall-{callId}` so activity is streamed to `/data/progress/activity-postcall-{callId}.json` by `lib/claude.ts` hooks.
  - Requires `/public/call/{callId}.html` to exist after run; otherwise re-queues.
  - On success: updates call JSON to `completed`, sets `pageUrl`, sets `generatedAt`, updates agency call index, enqueues SMS job.
- Stale recovery: `.processing` files older than 20 minutes are renamed back to `.json`.
- Timeout: wraps Claude invocation with 5 minute timeout (`PROCESSING_TIMEOUT_MS`).

**SMS worker (`lib/sms-queue.ts`)**
- Durable file-queue:
  - Pending jobs: `/data/jobs/sms/{callId}.json` (created idempotently with `flag:'wx'`)
  - In-progress lock: rename to `.processing`
- Reads call JSON; only sends if `pageStatus === 'completed'` and `pageUrl` and `callerPhone` exist.
- Sends Twilio SMS: `{agencyName} found properties for you: {absoluteUrlToPage}`.
- Marks `call.sms.status` to `sent|pending|failed` and writes back to the call JSON.
- Stale recovery: `.processing` older than 20 minutes.

**Primary failure points**
- Twilio client initialization is eager (module-level `Twilio(process.env...)`); missing env vars can crash any request that imports SMS code.
- The “worker model” relies on a long-lived process with `setInterval()`; serverless runtimes will be unreliable without additional triggers.
- Call-complete and personalize webhooks log full bodies, including transcripts and phone numbers (privacy + security).

### 3.6 History system (index + durable replay)

**Index (`lib/history.ts`, `/api/history`)**
- Reads/writes `/data/history/sessions.json` as `HistoryFile`.
- Keeps max 50 sessions.
- Normalizes demo URLs by stripping `.html` if present.

**Detail snapshots (`/api/history/[sessionId]`)**
- Serves durable detail file if it exists at `/data/history/sessions/{sessionId}.json`.
- Otherwise computes detail from progress files (pipeline + agencies + activity + subagent activity).
- Persists detail only for terminal states.
- Supports rename via `PATCH`, updating both index and detail snapshot.

**Replay UI (`components/HistorySessionReplay.tsx`)**
- Loads `/api/history/{sessionId}` and reuses `MainAgentWorkspace` + agency cards.

**Primary failure points**
- Progress files are ephemeral and may be cleaned after 24h; replay depends on durable snapshot to preserve detail.
- If snapshot creation fails (disk issues, JSON corruption), the replay path may partially degrade or 404.

### 3.7 “Proxy” / middleware intent

- `proxy.ts` implements a redirect from `/demo/*.html` → `/demo/*` and `/call/*.html` → `/call/*`, and exports a `matcher`.
- However, Next.js middleware must be named `middleware.ts` (or placed correctly) to execute automatically; `proxy.ts` is not referenced elsewhere.
- In practice, `/demo/:slug` already accepts `slug` values like `foo.html` and strips `.html`, so this bypass may be partially mitigated — but static file precedence vs route precedence should be treated as uncertain without an explicit middleware.

---

## 4) Edge Cases, Failure Points, and “Where It Can Fail”

This section enumerates failures by category and pinpoints the affected files/flows.

### 4.1 File-based persistence risks (JSON + HTML)

**Single-file contention**
- `/data/context/pending-calls.json` is a single shared JSON file with concurrent read/modify/write cycles:
  - Writers: `app/api/register-call/route.ts`, `app/api/webhook/personalize/route.ts`, `app/api/webhook/call-complete/route.ts`
  - Failure modes:
    - Lost updates when two writes overlap (last write wins).
    - Partial writes / truncated file on process crash → JSON parse failures.
    - Unbounded growth if cleanup is incomplete (register-call cleans; personalize/call-complete do not).

**Directory assumptions**
- Many routes assume directories exist; most do `mkdir(..., {recursive:true})`, but not everywhere.
- `app/api/call-status/route.ts` reads call files and parses JSON without a try/catch per-file; one corrupt JSON can throw the whole request.

**Generated HTML trust**
- `app/demo/[slug]/page.tsx` and `app/call/[id]/page.tsx` trust HTML as-is (`dangerouslySetInnerHTML`).
- Any compromise in the generation pipeline (prompt injection, malicious fetched content, compromised model output) becomes a full client-side compromise.

### 4.2 Concurrency + multi-process behavior (VPS vs serverless)

**In-process workers**
- `lib/postcall-queue.ts` and `lib/sms-queue.ts` use `setInterval()` loops to process jobs.
- On a single long-running Node process (PM2 on VPS): workable.
- On multi-process or clustered PM2:
  - Multiple workers can race, but file rename locking reduces duplicate processing.
  - However, each process adds polling overhead, and stale recovery windows can oscillate if clocks drift.

**`fs.watch` reliability**
- SSE endpoints depend on `fs.watch`:
  - `app/api/pipeline/stream/route.ts`
  - `app/api/calls/stream/route.ts`
  - `app/api/calls/stream-detail/route.ts`
- `fs.watch` can miss events under load or on some filesystems; code mitigates by doing periodic refresh (heartbeat) and “refresh on directory event”.

### 4.3 Data validation / schema drift

**Settings schema assumptions**
- `SettingsModal` writes `{systemPrompt, firstMessage}` to `localStorage`.
- `public/voqo-demo-call.js` sends that object as `settings`.
- `app/api/register-call` stores it verbatim into context.
- `app/api/webhook/personalize` assumes both are strings and calls `.replace(...)` on them.
- Edge case: localStorage is corrupted or user manually edits; webhook can throw and return fallback defaults (masking the bug but losing personalization).

**ID validation inconsistency**
- `lib/ids.ts` validates `sessionId` but not `agencyId` nor `callId`.
- `app/demo/[slug]/page.tsx` and other routes read files from disk based on URL params:
  - It uses the param directly as part of a filename; `slug` is not validated against path traversal patterns (it does `.endsWith('.html')` strip only).
  - Next’s router likely prevents `/` in params, but “defense in depth” is not present in code.

**Spec mismatch**
- `specs/SPEC-DATA-API.md` describes signature verification as HMAC over payload; current code uses timestamp + payload and also allows missing secret in production.
- `specs/SPEC-DATA-API.md` describes certain worker timeouts/thresholds that differ from `lib/postcall-queue.ts`:
  - Spec mentions 90 seconds and stale threshold 10 minutes; code uses 5 minutes timeout and 20 minutes stale processing.

### 4.4 External integrations and their brittle points

**Claude Code availability**
- `lib/claude.ts` relies on `@anthropic-ai/claude-agent-sdk` and expects a working Claude Code environment.
- `getClaudeEnv()` mutates PATH to include `~/.local/bin` and `/home/voqo/.local/bin`.
- Failure modes:
  - CLI missing or not authenticated under the runtime user.
  - Tool permissions changed by SDK versions.
  - Long-running jobs hitting timeouts in `postcall-queue`.

**Twilio initialization**
- `lib/twilio.ts` creates a Twilio client at module import time using `process.env.TWILIO_*` non-null assertions.
- Any request path that imports `lib/sms-queue.ts` can crash the server if env vars are missing.

**ElevenLabs webhook security**
- `personalize` has no signature verification at all.
- `call-complete` verification is effectively permissive in production if secret missing or signature missing.
- Failure modes:
  - Anyone can POST fake transcripts and trigger page generation + SMS sends.
  - Denial-of-wallet: forced Claude runs and SMS sends.

### 4.5 UX/operational edge cases

**Multiple users / multiple agencies simultaneously**
- Matching uses “most recent pending context” if there’s no direct match; this can misattribute callers to the wrong agency if multiple demos are being clicked close together.
- The 5-minute “recent active” selection can also pin a context to repeated webhook calls, potentially starving newer contexts.

**Desktop calling**
- “tel:” navigation often fails on desktop; the UI re-enables after 2 seconds but context may remain pending/active and later match incorrectly.

**Log volume and PII**
- Webhook handlers log full payloads (including transcripts and phone numbers). This is risky operationally (disk fill, privacy).

---

## 5) Simplification Recommendations (No new features; design-level)

These are recommendations for reducing complexity and failure surface while keeping the same product behavior.

### 5.1 Consolidate file I/O and JSON safety
- Create a single “storage layer” module for:
  - atomic write (write temp file + rename),
  - safe JSON parse,
  - schema validation (even lightweight),
  - consistent path construction.
- This would replace repeated `safeJsonParse`, `readJson`, and ad-hoc file handling across:
  - `app/api/pipeline/*`, `app/api/calls/*`, `app/api/webhook/*`, `lib/*`.

### 5.2 Make webhooks consistently verifiable
- Unify webhook verification behavior and remove “allow if secret missing in production”.
- Share a single verification helper between `personalize` and `call-complete`.

### 5.3 Reduce duplication between pipeline start and `lib/claude.ts`
- Pipeline start currently uses `query()` directly and separately infers tool usage; elsewhere, `invokeClaudeCode()` is used with hooks to write activity.
- Picking one approach (preferably the `lib/claude.ts` hook-driven approach) would:
  - reduce drift in message formats,
  - centralize env/tool config,
  - simplify activity streaming logic.

### 5.4 Replace “worker loops in API routes” with a single worker process
- Today, job processing is triggered by:
  - long-lived intervals started by webhook handlers,
  - plus “best effort” calls in `/api/calls` and SSE routes.
- A single dedicated worker process (separate PM2 process) that only runs the queues would:
  - eliminate reliance on user traffic to progress jobs,
  - reduce repeated directory scans per request,
  - simplify the API route responsibilities.

### 5.5 Clarify and prune legacy paths
- If the new pipeline is the primary path:
  - consider removing or quarantining the legacy endpoints (`/api/search`, `/api/generate-demo`) and unused components to reduce maintenance surface.
- If they must remain:
  - document them clearly as legacy and ensure skills they reference exist and are versioned.

### 5.6 Resolve the “proxy.ts” ambiguity
- Either wire it properly as middleware or delete it and rely on the app routes that already accept `.html` slugs.
- The current state is confusing and makes it easy to assume protections exist that may not actually run.

---

## 6) Better/Simpler Alternative Architectures (Tradeoff options)

### Option A: Keep file storage, but make writes atomic and structured
- Use atomic JSON write patterns everywhere and validate shapes on read.
- Keep the current “single VPS, no DB” goal intact.
- Biggest win per effort: reliability under concurrency and corruption.

### Option B: SQLite for contexts + calls + history (still single VPS)
- Store:
  - pending contexts,
  - call records,
  - job queues,
  - history index,
  - activity streams (optional).
- Benefits:
  - transactions prevent lost updates,
  - indexing and querying become reliable,
  - simpler retention policies.

### Option C: Split “web app” and “worker”
- Web: Next.js UI + API that only enqueues jobs and serves files.
- Worker: a Node process that:
  - runs Claude tasks,
  - sends SMS,
  - updates files/db.
- Benefits:
  - clearer operational model,
  - avoids fragile “background loops inside request handlers”.

### Option D: Remove server-side HTML serving and use data-driven rendering
- Instead of serving raw generated HTML, store structured JSON and render with React templates.
- Benefits:
  - reduces XSS/HTML trust surface,
  - makes UI consistent and testable.
- Tradeoff:
  - reduces “Claude writes full HTML” simplicity; needs more template engineering.

---

## 7) Appendix: Route and Data Contracts (Implemented)

### Pages
- `/` → `app/page.tsx`
- `/demo/[slug]` → `app/demo/[slug]/page.tsx` (reads `/public/demo/{slug}.html`, injects `/public/voqo-demo-call.js`)
- `/call/[id]` → `app/call/[id]/page.tsx` (reads `/public/call/{id}.html`)
- `/history/[sessionId]` → `app/history/[sessionId]/page.tsx` (replay UI)

### API (selected)
- `POST /api/pipeline/start` → start orchestrator; writes `/data/progress/*`; persists to history.
- `GET /api/pipeline/stream?session=...` → SSE for progress files.
- `GET /api/pipeline/state?session=...` → rehydration snapshot.
- `POST /api/pipeline/cancel` → interrupt query + mark cancelled in files + persist snapshot.

- `POST /api/register-call` → write/cleanup `/data/context/pending-calls.json`; return enforced demo phone.
- `POST /api/webhook/personalize` → select context; mark active; return dynamic vars and overrides.
- `POST /api/webhook/call-complete` → verify signature (partial), write `/data/calls/{callId}.json`, enqueue `/data/jobs/postcall/{callId}.json`.

- `GET /api/calls?session=...` → list calls (also ticks postcall+sms jobs best-effort).
- `GET /api/calls/stream?session=...` → SSE call list updates.
- `GET /api/calls/[callId]` → call detail + postcall activity.
- `GET /api/calls/stream-detail?callId=...` → SSE call detail + activity.

- `GET /api/history` → session index.
- `GET/PATCH /api/history/[sessionId]` → session replay detail / rename.

---

## 8) Key “Most Likely to Break” Checklist

If something fails in production, these are the highest-leverage suspects:
1) Webhook authenticity (missing/incorrect secret; signature format mismatch).
2) Twilio env vars missing → server crash on import paths that touch SMS.
3) JSON file corruption/races for `pending-calls.json`.
4) `fs.watch` missing events → UI streams appear stuck (should recover via refresh; verify behavior).
5) Claude Code not available/authenticated under the runtime user → pipelines stall/time out.

