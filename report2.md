# VoqoLeadEngine — Full Codebase Review & Analysis (report2)

Repo: `voqo-demo`  
Commit reviewed: `201ba945fc9620cdef73c3e44656f569276ef278`  
Build check: `npm run build` succeeded locally (Next.js 16.1.2)

This report is **analysis-only**. No runtime behavior has been changed.

---

## 0) Complete tracked file tree (from `git ls-files`)

```text
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

## 1) Architecture map (systems, modules, and connections)

### 1.1 High-level component diagram (runtime)

```text
Browser (Next.js UI)
  ├─ / (app/page.tsx) — starts pipeline, listens to SSE, shows cards + calls + history
  │    ├─ POST /api/pipeline/start  ────────────────┐
  │    ├─ GET  /api/pipeline/stream (SSE)           │
  │    ├─ GET  /api/pipeline/state                  │
  │    ├─ POST /api/pipeline/cancel                 │
  │    ├─ GET  /api/history                         │
  │    ├─ PATCH /api/history/:sessionId             │
  │    ├─ GET  /api/calls?session=...               │
  │    ├─ GET  /api/calls/stream?session=... (SSE)  │
  │    └─ GET  /api/calls/stream-detail?callId=...  │
  │
  ├─ /demo/:slug (app/demo/[slug]/page.tsx)
  │    ├─ Reads generated HTML from /public/demo/:slug.html
  │    └─ Injects config + /public/voqo-demo-call.js
  │           └─ POST /api/register-call → writes pending call context
  │
  └─ /call/:id (app/call/[id]/page.tsx)
       └─ Reads generated HTML from /public/call/:id.html

Next.js API (Node runtime; file-system backed)
  ├─ Pipeline orchestration:
  │    ├─ /api/pipeline/start  → starts Claude Agent SDK query; persists progress files
  │    ├─ /api/pipeline/stream → SSE; watches /data/progress; emits deltas
  │    ├─ /api/pipeline/state  → snapshot from /data/progress
  │    └─ /api/pipeline/cancel → interrupts in-memory run; persists cancellation
  │
  ├─ Voice demo (ElevenLabs webhooks):
  │    ├─ /api/register-call            → /data/context/pending-calls.json
  │    ├─ /api/webhook/personalize      → matches pending context; returns dynamic vars + overrides
  │    └─ /api/webhook/call-complete    → writes /data/calls/:callId.json; enqueues postcall job
  │
  ├─ Post-call background processing:
  │    ├─ /data/jobs/postcall/*.json    → durable job queue
  │    ├─ lib/postcall-queue.ts         → interval worker; invokes Claude; writes /public/call/*.html
  │    └─ lib/sms-queue.ts              → interval worker; sends SMS via Twilio
  │
  ├─ Call browsing:
  │    ├─ /api/calls                    → lists /data/calls/*.json
  │    ├─ /api/calls/:callId            → reads call JSON + postcall activity stream
  │    ├─ /api/calls/stream (SSE)       → watches /data/calls
  │    └─ /api/calls/stream-detail (SSE)→ watches /data/calls + /data/progress
  │
  └─ History:
       ├─ /data/history/sessions.json   → index (max 50)
       ├─ /data/history/sessions/*.json → durable per-session snapshots
       └─ /api/history/* routes         → list, rename, compute/persist detail snapshots

External services
  ├─ Anthropic Claude (via @anthropic-ai/claude-agent-sdk)
  ├─ ElevenLabs Conversational AI (webhooks into Next.js)
  └─ Twilio (SMS API; demo phone number; caller-side dialing)
```

### 1.2 Data plane map (file storage contracts)

Primary storage is file-based JSON + generated HTML:

- Agency outputs:
  - `/data/agencies/{agencyId}.json` (durable agency profile)
  - `/public/demo/{agencyId}.html` (generated demo landing page)
- Pipeline progress + activity:
  - `/data/progress/pipeline-{sessionId}.json`
  - `/data/progress/activity-{sessionId}.json` (main agent)
  - `/data/progress/agency-{agencyId}.json` (per-card progress)
  - `/data/progress/agency-activity-{agencyId}.json` (per-card subagent stream)
- Voice call context + call outputs:
  - `/data/context/pending-calls.json` (context map, 5 min TTL)
  - `/data/calls/{callId}.json` (call transcript + generation status)
  - `/public/call/{callId}.html` (generated post-call page)
- Durable queues:
  - `/data/jobs/postcall/{callId}.json` or `.processing`
  - `/data/jobs/sms/{callId}.json` or `.processing`
- Indexes / logs:
  - `/data/agency-calls/{agencyId}.json` (call history per agency)
  - `/data/history/sessions.json` + `/data/history/sessions/{sessionId}.json`
  - `/data/errors/postcall-errors.json`, `/data/errors/sms-errors.json`

Specs define these schemas in `specs/SPEC-DATA-API.md`.

---

## 2) System-by-system analysis (what exists, how it works, where it can break)

### 2.1 Pipeline: agency discovery + parallel subagent processing

**Entry point:** `app/api/pipeline/start/route.ts`  
**Streaming:** `app/api/pipeline/stream/route.ts`  
**Snapshot:** `app/api/pipeline/state/route.ts`  
**Cancel:** `app/api/pipeline/cancel/route.ts`  
**In-memory run registry:** `lib/pipeline-registry.ts`  
**History persistence:** `lib/history.ts`

**How it works**

1. UI submits suburb + count from `app/page.tsx` to `POST /api/pipeline/start`.
2. `/api/pipeline/start`:
   - Creates `sessionId` and writes initial:
     - `data/progress/pipeline-{sessionId}.json`
     - `data/progress/activity-{sessionId}.json`
   - Starts a streaming Claude Agent SDK query (`@anthropic-ai/claude-agent-sdk`) and stores it in a process-global map (`getPipelineRuns()`).
   - Drains the query asynchronously (“fire in background”) and:
     - Logs tool-use as activity messages (best-effort).
     - On finish/error/cancel, persists a durable history snapshot (index + detail) via `persistSessionToHistory(...)`.
3. `/api/pipeline/stream` opens an SSE stream that:
   - Watches `data/progress/` (fs.watch + debounce) and emits:
     - `todo_update`, `card_update`, `card_remove`, `main_activity_message`, `subagent_activity_message`, `pipeline_complete`.
   - Attempts reconciliation if it detects the HTML exists but the progress file didn’t finalize (helpful when subagents finish but progress didn’t update).
4. UI listens via `EventSource` (`app/page.tsx`) and updates:
   - Todo list, cards map, main activity stream, per-card subagent streams.
5. `/api/pipeline/cancel` attempts to interrupt the in-memory run (`run.query.interrupt()`), then forces progress/history into a cancelled terminal state for replay.

**Notable robustness decisions**

- Progress file “truth” is the filesystem; SSE is derived from file changes, not from in-memory state.
- Background runner persists history even if no client is connected to SSE.
- SSE layer tries to reconcile missing “complete” state using presence of generated demo HTML.

**Failure points / edge cases**

- **Process restart loses cancellation ability**: `/api/pipeline/cancel` only interrupts runs that exist in the current process memory; after a restart, the run cannot be interrupted (only files can be marked cancelled).
- **fs.watch semantics**: under heavy write volume, `fs.watch` can drop events; code mitigates via periodic-ish refresh triggers, but missed events can still cause UI lag until the next change.
- **Race: reconcile vs subagent writes**: `/api/pipeline/stream` may rewrite an agency progress file to “complete” if it sees HTML exists; if a subagent is concurrently writing, this can cause last-write-wins stomping.
- **Hashing via JSON.stringify**: the SSE diff mechanism hashes JSON stringifications; if key order changes or timestamps differ, clients may receive more updates than necessary.
- **Inconsistent “found” counting**:
  - The system uses `pipeline.agencyIds.length` and/or activity counters; drift can occur if pipeline file is partially written or corrupted.
- **Unauthenticated**:
  - Anyone can start pipelines; this is a deliberate demo choice but is an operational risk (rate limits, cost, DOS).

---

### 2.2 Demo page serving + call activation injection

**Demo route:** `app/demo/[slug]/page.tsx`  
**Injected script:** `public/voqo-demo-call.js`  
**Phone enforcement:** `lib/phone.ts`  
**(Request-level redirect to avoid direct .html)**: `proxy.ts` (see “Proxy/Middleware” notes below)

**How it works**

1. Subagents generate static HTML to `/public/demo/{agencyId}.html`.
2. `GET /demo/{slug}`:
   - Reads that HTML from disk.
   - Reads `/data/agencies/{slug}.json` (best-effort) to supply `window.__VOQO_AGENCY__`.
   - Injects config:
     - `window.__VOQO_DEMO_PHONE__` from `getDemoPhone()`
     - `window.__VOQO_SESSION_ID__` if `?session=` query param is present and passes `isSafeSessionId`
   - Injects `<script src="/voqo-demo-call.js" defer></script>`.
3. `public/voqo-demo-call.js`:
   - Renders a bottom “call bar” UI.
   - On “Call now”, POSTs to `/api/register-call` using `sendBeacon` (preferred) or `fetch(keepalive)`, then navigates to `tel:...`.
   - Intercepts existing `tel:` links to enforce the demo number and to register context best-effort.
   - Provides compatibility globals `window.registerForCall()` and `window.registerDemoCall()` for older generated demo pages.

**Failure points / edge cases**

- **Direct access to `/demo/{slug}.html` bypasses injection** unless middleware/redirect is applied.
  - If a browser serves the static file directly, the call bar and context registration do not exist unless the generated HTML includes equivalent logic.
- **Session attribution is opportunistic**:
  - The session ID is only present if the user entered via `/demo/{slug}?session={sessionId}` (UI does this when linking from cards/history). If shared without the `session` query param, calls won’t be attributed to a pipeline session.
- **Param validation gap for `slug`**:
  - `app/demo/[slug]/page.tsx` does not validate `slug` to a safe pattern before building a file path. Dynamic route segments are typically safe, but encoded edge cases can still matter (see Security section).

---

### 2.3 Register call context (pre-dial)

**Endpoint:** `app/api/register-call/route.ts`  
**Storage:** `data/context/pending-calls.json` (map keyed by `contextId`)  
**TTL:** 5 minutes

**How it works**

- Accepts raw JSON via `request.text()` (supporting `sendBeacon`).
- Normalizes payload variants into `agencyData`.
- Writes/updates `pending-calls.json`:
  - Prunes expired contexts on each write.
  - Stores optional `settings` (voice agent overrides).
  - Stores optional `sessionId` (validated by `isSafeSessionId`).
- Responds with:
  - `contextId`, `expiresAt`, enforced demo phone numbers (`tel`, `display`).

**Failure points / edge cases**

- **Read-modify-write races**:
  - Concurrent `register-call` requests can overwrite each other’s cleanup or additions because updates are not atomic/locked.
- **Settings trust boundary**:
  - Voice agent prompt overrides are accepted and persisted without validation beyond JSON parsing (expected for a demo, but notable).

---

### 2.4 ElevenLabs personalization webhook (context matching + overrides)

**Endpoint:** `app/api/webhook/personalize/route.ts`  
**Input:** `caller_id`, `call_sid`, etc.  
**Output:** `dynamic_variables` and optional `conversation_config_override`

**How it works**

- Loads `pending-calls.json`.
- Matching algorithm (in code, as implemented):
  1. Prefer “recently active” contexts (status `active` with `activatedAt` within 5 minutes).
  2. Else choose most-recent `pending` context that is not expired.
  3. Else fallback to “any valid context” not expired.
  4. Else default agency variables.
- When matching a `pending` context, it marks it `active` and stores `callerId`, `callSid`, `activatedAt`.
- If the matched context has stored `settings`, it returns:
  - `conversation_config_override.agent.prompt.prompt` (after variable substitution)
  - `conversation_config_override.agent.first_message` (after substitution)
  - Otherwise it may only override first message (legacy behavior).

**Failure points / edge cases**

- **Multi-caller collision risk**:
  - If multiple users click “Call” around the same time, “most recent pending” can associate the wrong agency with the call.
  - The “recent active” fallback does not currently confirm `callSid`/`callerId` match when selecting among active contexts.
- **No webhook signature verification**:
  - The endpoint logs headers/body but does not authenticate the caller.
- **PII logging**:
  - Caller IDs, call SIDs, and context details are logged verbosely.

---

### 2.5 ElevenLabs call-complete webhook (call record + enqueue post-call page)

**Endpoint:** `app/api/webhook/call-complete/route.ts`  
**Writes:** `data/calls/{callId}.json`, updates `pending-calls.json`, updates `data/agency-calls/{agencyId}.json`  
**Enqueues:** `data/jobs/postcall/{callId}.json` via `lib/postcall-queue.ts`

**How it works**

1. Reads raw body (`request.text()`) to enable signature verification.
2. Verifies signature via `verifyWebhookSignature(...)` (see Security notes; current policy is permissive).
3. Derives:
   - `callerId` and `callSid` from multiple possible fields.
   - `contextId` from dynamic variables if present.
4. Matches a stored context in `pending-calls.json` by:
   1. `context_id`
   2. `callSid`
   3. `callerId` (only active)
   4. fallback to most recent pending
5. Writes `data/calls/{callId}.json` with:
   - transcript, summary, agency context, `pageStatus="generating"`.
6. Updates matched context to `completed` and records `callId`.
7. Appends an agency call entry (if `agencyId` not unknown).
8. Enqueues durable postcall job with a prompt that references absolute file paths for output.
9. Ensures postcall worker and SMS worker intervals are started in-process (`ensurePostcallWorker()`, `ensureSmsWorker()`).

**Failure points / edge cases**

- **Signature verification mismatch with spec**:
  - The spec describes a different signature scheme/header than the code currently enforces.
  - The code permits missing signature/secret in production in some cases (see Security).
- **Context matching can still mismatch**:
  - If a call-complete arrives without reliable dynamic variables, the fallbacks can associate the wrong agency if pending contexts are crowded.
- **Duplicate webhooks / retries**:
  - If ElevenLabs retries call-complete, multiple `callId`s can be created for the same conversation unless upstream idempotency is enforced externally.

---

### 2.6 Post-call page generation worker (durable file queue)

**Worker/queue:** `lib/postcall-queue.ts`  
**Claude execution:** `lib/claude.ts` (`invokeClaudeCode` with activity hooks)  
**Output:** `/public/call/{callId}.html`, update `/data/calls/{callId}.json`  
**Side effects:** enqueue SMS job and update agency call status

**How it works**

- Jobs are files in `/data/jobs/postcall/`:
  - pending: `{callId}.json`
  - in-progress: `{callId}.processing` (obtained by atomic-ish rename)
- `ensurePostcallWorker()` starts a single `setInterval` loop per process.
- `processPostcallJobsOnce()`:
  - Recovers stale `.processing` files back to `.json` if older than threshold.
  - Renames a job to `.processing` to claim it.
  - Increments attempts; if exceeded, logs error + marks call failed + deletes job.
  - If output HTML already exists and call JSON already indicates completion, finalizes without re-running Claude (important to prevent infinite retries).
  - Runs Claude with a timeout.
  - Validates HTML exists; then marks call completed and enqueues SMS.

**Failure points / edge cases**

- **Multiple Next processes**:
  - If the app runs with multiple node processes, multiple workers will run; rename locking reduces duplicate work, but increases contention.
- **Timeout vs partial output**:
  - Claude may produce HTML after the timeout; the “already generated” check partially mitigates this on later runs.
- **Non-atomic writes to call JSON**:
  - Call JSON updates can race with the SMS worker updates or other reads.

---

### 2.7 SMS worker (durable file queue; Twilio integration)

**Worker/queue:** `lib/sms-queue.ts`  
**Twilio:** `lib/twilio.ts`

**How it works**

- Jobs are files in `/data/jobs/sms/` claimed by rename to `.processing`.
- Preconditions to send:
  - call JSON has `pageStatus="completed"`, `pageUrl`, and `callerPhone`.
- SMS body:
  - `"{agencyName} found properties for you: {fullUrl}"`
  - Base URL from `NEXT_PUBLIC_APP_URL` or defaults to `http://localhost:3000`.
- Deduping:
  - `enqueueSmsJob` uses `writeFile(..., { flag: 'wx' })` so a job won’t be re-enqueued if it already exists.
  - Worker skips if call JSON already indicates `sms.status === "sent"` (or legacy `smsSentAt` exists).

**Failure points / edge cases**

- **Hard dependency on env vars at import time**:
  - `lib/twilio.ts` constructs a Twilio client using `process.env.*!` immediately; missing env vars can crash the server on module import.
- **Wrong URL in SMS if `NEXT_PUBLIC_APP_URL` missing/incorrect**:
  - Defaults to localhost; in production this becomes a silent failure mode for the user experience.
- **Phone normalization assumptions**:
  - `normalizePhoneNumber` assumes AU conventions for numbers starting with `0` and may produce incorrect E.164 for unusual formats.

---

### 2.8 Calls browsing + streaming (UI support)

**List:** `app/api/calls/route.ts` + `components/CallsPanel.tsx`  
**List streaming:** `app/api/calls/stream/route.ts`  
**Detail:** `app/api/calls/[callId]/route.ts` + `components/CallDetailModal.tsx`  
**Detail streaming:** `app/api/calls/stream-detail/route.ts`

**How it works**

- Calls are read from `/data/calls/*.json` and filtered by optional `session` query.
- Streaming endpoints watch the filesystem and emit deltas over SSE.
- Multiple endpoints opportunistically call `processPostcallJobsOnce()` / `processSmsJobsOnce()` to “keep the system moving” when a UI is open.

**Failure points / edge cases**

- **Backpressure + watcher scaling**:
  - Each connected SSE client creates watchers and timers; many clients can exhaust file descriptors or CPU.
- **Corrupt call files**:
  - Some endpoints are resilient (`safeJsonParse`), others can be disrupted by a single corrupt file (see `/api/call-status`).

---

### 2.9 History (index + session replay)

**Index:** `lib/history.ts` + `app/api/history/route.ts` + `components/HistoryList.tsx`  
**Session detail:** `app/api/history/[sessionId]/route.ts` + `components/HistorySessionReplay.tsx`

**How it works**

- `data/history/sessions.json` stores the most recent 50 session entries (renamable).
- `data/history/sessions/{sessionId}.json` stores durable snapshots (pipeline + progress + activity + subagent activity).
- Session replay UI loads the snapshot and renders:
  - `MainAgentWorkspace` + agency cards with subagent streams.

**Failure points / edge cases**

- **Partial runs**:
  - A pipeline that never reaches a terminal status can leave incomplete state; code tries to reconcile this when persisting.
- **Disk retention**:
  - Specs mention various retention policies (24h progress, 30d calls) but code currently implements only some (progress cleanup in SSE; jobs error logs bounded; history bounded to 50).

---

### 2.10 Proxy/Middleware behavior (redirect `.html` access)

**File:** `proxy.ts`

Intent: prevent bypassing `/demo/[slug]` and `/call/[id]` routes by directly requesting static `.html` files in `/public`.

Key notes:

- Next build output reported: “`ƒ Proxy (Middleware)`”, implying Next recognizes `proxy.ts` as middleware in this project’s configuration.
- If this file were *not* treated as middleware, direct access to `/demo/*.html` would likely bypass the injection logic in `app/demo/[slug]/page.tsx`.

Operationally, this is a “must verify in production” item:
- Confirm that `GET /demo/{slug}.html` results in a redirect to `/demo/{slug}` (and similarly for `/call/{id}.html`).

---

## 3) File-by-file module map (every file and its role)

This is a “what it is + who uses it” map. Files that are plans/docs/assets are called out as such.

### 3.1 Root

- `package.json`: runtime deps (Next 16, React 19, Twilio, Claude Agent SDK); scripts `dev/build/start`.
- `package-lock.json`: dependency lock (not runtime logic; large).
- `next.config.ts`: empty config placeholder.
- `tsconfig.json`: strict TS, Next plugin, path alias `@/*`.
- `postcss.config.mjs`: Tailwind v4 PostCSS plugin config.
- `.gitignore`: excludes `data/**`, `public/demo/**`, `public/call/**`, `.env*`.
- `README.md`: default create-next-app README (not project-specific).
- `AGENTS.md`: operational/runbook instructions for this repo.
- `CLAUDE.md`: brief instructions for Claude Code skills usage.
- `spec.md`: high-level hackathon specification (historical; partially diverged from current implementation).
- `proxy.ts`: middleware-like redirect logic for `.html` access.

### 3.2 `app/` (Next.js App Router)

- `app/layout.tsx`: root layout (Geist fonts; metadata still default “Create Next App”).
- `app/globals.css`: Tailwind v4 import + basic CSS variables.
- `app/page.tsx`:
  - Main UI: start/cancel pipeline, listen to SSE, cards grid, calls panel, history tab, settings modal.
  - Maintains dedupe caches for SSE activity messages to mitigate reconnect duplicates.
- `app/history/[sessionId]/page.tsx`: server component wrapper for replay UI.
- `app/demo/[slug]/page.tsx`:
  - Reads generated demo HTML and injects call bar config/script.
  - Attempts to read agency JSON to enrich config.
- `app/demo/[slug]/not-found.tsx`: friendly “demo not generated yet”.
- `app/call/[id]/page.tsx`: reads generated call HTML (post-call page).
- `app/call/[id]/not-found.tsx`: “page not ready yet” refresh prompt.

### 3.3 `app/api/` (API routes)

Pipeline:
- `app/api/pipeline/start/route.ts`: creates session, launches Claude orchestrator (Agent SDK query), tracks in-memory run, persists history.
- `app/api/pipeline/stream/route.ts`: SSE streaming of pipeline progress/activity/subagent activity.
- `app/api/pipeline/state/route.ts`: snapshot endpoint used to rehydrate UI after refresh.
- `app/api/pipeline/cancel/route.ts`: interrupts in-memory run and persists cancellation.

Calls:
- `app/api/calls/route.ts`: list calls (optionally filtered by session), opportunistically advances workers.
- `app/api/calls/stream/route.ts`: SSE call list streaming (fs.watch on `/data/calls`).
- `app/api/calls/stream-detail/route.ts`: SSE per-call updates + postcall activity streaming.
- `app/api/calls/[callId]/route.ts`: read call JSON + postcall activity JSON.
- `app/api/call-status/route.ts`: legacy poll for “most recent call for agency” (used by `voqo-demo-call.js` for “I already called” CTA).
- `app/api/agency-calls/route.ts`: agency call history index (`/data/agency-calls/{agencyId}.json`).

History:
- `app/api/history/route.ts`: list history sessions (index).
- `app/api/history/[sessionId]/route.ts`: GET detail snapshot; PATCH rename session.

Legacy / deprecated paths (still present):
- `app/api/search/route.ts`: Claude-driven “search agencies in suburb” with 24h caching.
- `app/api/generate-demo/route.ts`: Claude-driven “generate demo page” for an agency.

Voice webhooks:
- `app/api/register-call/route.ts`: writes pending call context (5-min TTL) and returns enforced demo phone number.
- `app/api/webhook/personalize/route.ts`: chooses call context and returns dynamic variables and optional conversation overrides.
- `app/api/webhook/call-complete/route.ts`: stores call transcript and enqueues postcall job; attempts webhook signature verification.

### 3.4 `components/` (UI)

Active (used in current UI):
- `components/MainAgentWorkspace.tsx`: combined workspace panel (activity + todos + optional calls panel).
- `components/CallsPanel.tsx`: calls list in workspace.
- `components/CallDetailModal.tsx`: call transcript + postcall generation activity, with SSE detail stream.
- `components/AgencyCard.tsx`: agency progress card + subagent activity expand/collapse.
- `components/HistoryList.tsx`: list of sessions.
- `components/HistoryCard.tsx`: session card + rename + agency chips.
- `components/HistorySessionReplay.tsx`: replay view for a past session.
- `components/SettingsModal.tsx`: voice agent prompt overrides stored in localStorage.
- `components/ActivityMessage.tsx`: message rendering with icons/colors.
- `components/StepList.tsx`: checklist rendering.
- `components/TabNavigation.tsx`: search/history tabs.
- `components/ShimmerPreview.tsx`: visual “generated page preview” placeholder.

Present but appears unused by runtime pages (only referenced by plans/specs):
- `components/AgentActivityPanel.tsx`
- `components/TodoPanel.tsx`
- `components/MockPreview.tsx`

### 3.5 `lib/` (server utilities)

- `lib/types.ts`: shared TS interfaces + default voice agent settings and available variables.
- `lib/ids.ts`: safe session id validation and activity id builder.
- `lib/server/activity.ts`: stable activity id + normalization for deduping/repairing timestamps.
- `lib/claude.ts`:
  - Wraps Agent SDK query creation and execution.
  - Provides hooks to append activity messages during tool use.
- `lib/pipeline-registry.ts`: global map of in-process pipeline runs for cancellation/inspection.
- `lib/history.ts`: history index + detail snapshots built from progress files.
- `lib/agency-calls.ts`: call history per agency (simple JSON file).
- `lib/postcall-queue.ts`: durable job queue + worker loop for postcall page generation.
- `lib/sms-queue.ts`: durable job queue + worker loop for SMS delivery.
- `lib/twilio.ts`: Twilio client and phone normalization.
- `lib/phone.ts`: demo phone number enforcement (ensures a single number is used).
- `lib/progress-cleanup.ts`: general progress cleanup utilities (currently not imported by runtime code).

### 3.6 `.claude/` (Claude Code skills, commands, agent docs)

Runtime impact: these files define how Claude-generated artifacts (HTML/JSON) look and how progress/activity files are written.

- `.claude/skills/agency-processor/SKILL.md`: subagent contract for extracting agency data + generating demo HTML; explicitly disallows emojis and forbids webhooks from browser.
- `.claude/skills/postcall-page-builder/SKILL.md`: postcall page generation contract; requires updating call JSON.
- `.claude/skills/frontend-design/SKILL.md`: aesthetic guidance for generated pages.
- `.claude/agents/agency-processor.md`: high-level agent wrapper around the skill.
- `.claude/commands/*`: internal instructions for planning/build workflows (docs).

### 3.7 `specs/`, `plans/`, `agents/plans/` (docs)

- `specs/*.md`: authoritative specs for architecture/data/pipeline/voice/deployment.
- `plans/phase-*.md` and `agents/plans/*.md`: implementation planning artifacts (not runtime code).

### 3.8 `public/` and `data/` placeholders

- `public/voqo-demo-call.js`: critical runtime script injected into demo pages.
- `public/*.svg`: static assets (Next default icons).
- `data/**/.gitkeep`: placeholders to keep empty dirs in git.

---

## 4) Edge cases and failure points (exhaustive list by category)

### 4.1 Correctness / data integrity

- Concurrent writes can clobber:
  - `data/context/pending-calls.json` (written by register-call + personalize + call-complete).
  - `data/calls/{callId}.json` (written by call-complete + postcall worker + sms worker).
  - Any “read-modify-write JSON file” pattern without locking can lose fields.
- Corrupt JSON files:
  - `/api/calls` and some endpoints are tolerant; `/api/call-status` can be derailed by a single corrupt call file because it does not isolate JSON.parse per file with a try/catch inside the loop.
- Partial outputs:
  - Claude can write HTML but fail to update progress or call JSON; reconciliation exists in some paths, but not uniformly.

### 4.2 Context matching correctness (voice demo)

- “Most recent pending context” selection can mismatch agency when:
  - Two users initiate calls in short succession.
  - ElevenLabs calls personalize multiple times before the call connects.
- In personalize webhook:
  - Active-context selection does not validate that `call_sid`/`caller_id` corresponds to the active context selected; it picks the most recently active one.
- In call-complete webhook:
  - If no dynamic variables are present or they’re missing `context_id`, fallbacks may pick the wrong pending context.
- Idempotency:
  - Duplicate call-complete webhooks can create multiple call records and multiple postcall jobs for the same underlying conversation.

### 4.3 SSE / streaming robustness

- `fs.watch` platform differences:
  - Renames, atomic writes, and high-frequency updates can lead to missing or coalesced events.
- Memory / resource consumption:
  - Each SSE client allocates watchers + timers and keeps them for the lifetime of the connection.
- Deduping:
  - UI dedupes messages by `id` and a “content key”; server normalizes messages with stable IDs in some endpoints, but not all sources are normalized at write-time.

### 4.4 Security / abuse (demo mode risks)

- No authentication:
  - Any external party can start pipelines, hit webhooks, and read call/history endpoints.
- Parameter/path validation gaps:
  - Several endpoints use user-supplied identifiers to build file paths (callId, agencyId, slug) without validating against a strict allowlist pattern.
  - Even if Next’s router usually prevents `/` in dynamic segments, encoded edge cases and future routing changes can matter; treating these as trusted is risky.
- Webhook authentication:
  - Personalize webhook has no signature verification.
  - Call-complete signature verification is permissive and may not match the real ElevenLabs scheme.
- XSS / script execution surface:
  - `dangerouslySetInnerHTML` renders generated HTML (by design). If generated HTML ever becomes attacker-controlled, this becomes a full client-side compromise.

### 4.5 Privacy / compliance

- Webhook handlers log full bodies and headers:
  - Transcript + caller IDs could appear in logs.
- Data retention:
  - Specs mention call retention (e.g., 30 days), but code does not currently implement call retention cleanup.

### 4.6 Operational / deployment

- Reliance on local disk:
  - Deploys must preserve `/data` and generated HTML under `/public/demo` and `/public/call`.
  - If deployed onto ephemeral storage, the system will “forget” agencies, calls, and history.
- Twilio env vars required:
  - `lib/twilio.ts` expects env vars at import time; missing vars may crash the process.
- `NEXT_PUBLIC_APP_URL`:
  - If missing in production, SMS links default to localhost.
- Worker model:
  - Workers are in-process timers in a Next server; if the server is paused/restarted, jobs stall until a request arrives that starts workers (or until webhook triggers it).

---

## 5) Where the system can fail end-to-end (flow-based failure analysis)

### Flow A: Pipeline search → demo pages

1. `POST /api/pipeline/start` succeeds but background run crashes:
   - UI may remain “searching/processing” until SSE detects terminal state or times out.
2. Orchestrator fails to write skeleton progress files:
   - UI sees no cards; appears stuck.
3. Subagents generate HTML but fail to mark progress “complete”:
   - UI may show generating forever; SSE tries to reconcile if it detects HTML exists.
4. User opens `/demo/{slug}.html` directly (static):
   - Call bar isn’t injected; register-call never happens; personalization mismatches later.

### Flow B: Demo page → call context → personalize

1. User taps call; register-call fails to send before tel navigation:
   - No pending context; personalization falls back to default or wrong agency.
2. Multiple users call concurrently:
   - Context matching picks “most recent pending/active”, mixing agencies.

### Flow C: Call complete → postcall generation → call page + SMS

1. Call-complete arrives but signature verification rejects (or vice versa accepts spoofed):
   - Either lost calls or security exposure.
2. Call JSON written, but postcall job fails repeatedly:
   - Call page remains missing; UI shows generating/failed; SMS may never send.
3. Postcall HTML generated, but call JSON not updated:
   - `/call/{id}` works, but UI and SMS preconditions may not trigger correctly.
4. SMS worker sends but `NEXT_PUBLIC_APP_URL` is wrong:
   - User receives broken link.

---

## 6) Simplification opportunities (reduce surface area + reduce failure modes)

These are recommendations only (no changes were made).

### 6.1 Consolidate or remove “legacy” pathways

- Keep *either* the “pipeline” system (`/api/pipeline/*`) *or* the earlier “search + generate-demo” endpoints (`/api/search`, `/api/generate-demo`) as the primary path.
- If pipeline is canonical, the legacy endpoints add:
  - duplicate Claude invocation patterns,
  - additional caching formats in `/data/agencies`,
  - more routes to secure/maintain.

### 6.2 Standardize identifier validation everywhere

- `isSafeSessionId` exists and is used well for `sessionId`, but similar allowlist validation should be consistently applied to:
  - `callId`
  - `agencyId`
  - `slug`
- This reduces security risk and reduces “mystery file reads/writes” from unexpected inputs.

### 6.3 Reduce JSON read-modify-write races

If file-based storage remains:
- Use atomic write patterns:
  - write to `file.tmp` then `rename` to final file
- Use advisory locks for hot files:
  - especially `pending-calls.json` and call JSON files
- Prefer append-only logs for activity streams (JSONL) rather than rewriting arrays.

### 6.4 Clarify and centralize webhook signature verification

- One small module for ElevenLabs signature verification (single source of truth).
- Enforce strict verification in production and explicit bypass only in development.

### 6.5 Make background workers explicit

- Current design starts worker loops opportunistically (webhook or UI calls) in-process.
- Simplify operational behavior by running a separate worker process (same repo) that:
  - continuously drains `/data/jobs/postcall` and `/data/jobs/sms`
  - writes results to disk
  - leaves the Next server focused on requests + SSE

### 6.6 Remove unused UI components (or wire them in)

- `components/AgentActivityPanel.tsx`, `components/TodoPanel.tsx`, `components/MockPreview.tsx` appear unused by the current main UI.
- Removing unused components reduces maintenance surface and cognitive load (or explicitly reintroduce them if desired).

### 6.7 Reduce duplication in Claude “tool activity” logging

- There are two similar “tool detail mapping” systems:
  - one in `app/api/pipeline/start/route.ts`
  - one in `lib/claude.ts` hooks
- Consolidating this reduces subtle divergence in message types/content.

---

## 7) Better/simpler approaches (architectural alternatives)

### Option 1: Keep the file-based architecture, but add minimal “correctness primitives”

- Add strict ID validation for any identifier used in file paths.
- Make all JSON writes atomic (tmp + rename).
- Add lightweight locking for shared JSON maps (pending contexts).
- Convert “activity” to append-only (JSONL) to avoid array rewrite races.
- Add retention jobs for calls/history/progress (single daily cleanup).

This preserves the “single VPS, no DB” ethos while removing the most common corruption/mismatch failure modes.

### Option 2: Replace hot JSON files with SQLite (still single VPS, still simple)

- Move these to SQLite:
  - pending call contexts
  - calls
  - history index
  - agency call index
  - job queues (postcall + sms)
- Keep HTML as files in `/public/demo` and `/public/call`.

You retain “Claude-friendly” debugging (SQLite browser/CLI), get atomicity/concurrency, and simplify many edge cases.

### Option 3: Split Next server vs worker

- Keep Next for UI, API, SSE.
- Run a separate Node worker service/process:
  - processes postcall jobs and sms jobs continuously
  - updates call JSON and writes HTML

This is usually the cleanest operational simplification for background work.

---

## 8) Spec alignment notes (where docs and code diverge or need verification)

- Webhook signature scheme:
  - `specs/SPEC-DATA-API.md` describes one verification shape/header; `app/api/webhook/call-complete/route.ts` implements another and is permissive. This should be reconciled.
- “Proxy / redirect” behavior:
  - Specs mention blocking direct `.html` access; the project has `proxy.ts` and the build output suggests it’s active as middleware, but it should be verified in the deployed environment.
- Retention policies:
  - Specs describe retention windows (calls, progress). Code currently cleans some progress files (in SSE) but does not implement call retention cleanup.

---

## 9) Quick verification checklist (manual)

- `GET /demo/{slug}.html` redirects to `/demo/{slug}` (confirm on deployed site).
- Make two rapid `POST /api/register-call` from different devices; ensure personalize doesn’t mismatch agencies (currently likely to mismatch).
- Temporarily disable `NEXT_PUBLIC_APP_URL` in prod env to confirm SMS behavior (should be prevented/alerted; currently defaults to localhost).
- Confirm ElevenLabs signature header name + signing method; align code + spec and enforce in production.

