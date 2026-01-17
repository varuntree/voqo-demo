# Report 6 — Full Codebase Review and Analysis (VoqoLeadEngine)

## Scope and Method

This report is based on:
- `git ls-files` (complete tracked file tree)
- Full read of all required specs:
  - `specs/SPEC-ARCHITECTURE.md`
  - `specs/SPEC-DATA-API.md`
  - `specs/SPEC-PIPELINE.md`
  - `specs/SPEC-VOICE-AGENT.md`
  - `specs/DEPLOYMENT.md`
- Line-by-line review of all tracked application code (`app/`, `components/`, `lib/`, `public/voqo-demo-call.js`, `proxy.ts`, configs)
- Build validation: `npm run build` succeeded locally (Next.js 16.1.2).

Constraints honored:
- No functional changes were made to the codebase. This report is the only deliverable.

---

## Tracked File Tree (from `git ls-files`)

```text
├── .claude
│   ├── agents
│   │   └── agency-processor.md
│   ├── commands
│   │   ├── build.md
│   │   ├── plan.md
│   │   └── prime.md
│   └── skills
│       ├── agency-processor
│       │   └── SKILL.md
│       ├── frontend-design
│       │   └── SKILL.md
│       └── postcall-page-builder
│           └── SKILL.md
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── agents
│   └── plans
│       ├── plan1.md
│       └── silo-plan-pipeline-persistence-and-history.md
├── app
│   ├── api
│   │   ├── agency-calls
│   │   │   └── route.ts
│   │   ├── call-status
│   │   │   └── route.ts
│   │   ├── calls
│   │   │   ├── [callId]
│   │   │   │   └── route.ts
│   │   │   ├── route.ts
│   │   │   ├── stream
│   │   │   │   └── route.ts
│   │   │   └── stream-detail
│   │   │       └── route.ts
│   │   ├── generate-demo
│   │   │   └── route.ts
│   │   ├── history
│   │   │   ├── [sessionId]
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   ├── pipeline
│   │   │   ├── cancel
│   │   │   │   └── route.ts
│   │   │   ├── start
│   │   │   │   └── route.ts
│   │   │   ├── state
│   │   │   │   └── route.ts
│   │   │   └── stream
│   │   │       └── route.ts
│   │   ├── register-call
│   │   │   └── route.ts
│   │   ├── search
│   │   │   └── route.ts
│   │   └── webhook
│   │       ├── call-complete
│   │       │   └── route.ts
│   │       └── personalize
│   │           └── route.ts
│   ├── call
│   │   └── [id]
│   │       ├── not-found.tsx
│   │       └── page.tsx
│   ├── demo
│   │   └── [slug]
│   │       ├── not-found.tsx
│   │       └── page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── history
│   │   └── [sessionId]
│   │       └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components
│   ├── ActivityMessage.tsx
│   ├── AgencyCard.tsx
│   ├── AgentActivityPanel.tsx
│   ├── CallDetailModal.tsx
│   ├── CallsPanel.tsx
│   ├── HistoryCard.tsx
│   ├── HistoryList.tsx
│   ├── HistorySessionReplay.tsx
│   ├── MainAgentWorkspace.tsx
│   ├── MockPreview.tsx
│   ├── SettingsModal.tsx
│   ├── ShimmerPreview.tsx
│   ├── StepList.tsx
│   ├── TabNavigation.tsx
│   └── TodoPanel.tsx
├── data
│   ├── history
│   │   └── .gitkeep
│   └── progress
│       └── .gitkeep
├── lib
│   ├── agency-calls.ts
│   ├── claude.ts
│   ├── history.ts
│   ├── ids.ts
│   ├── phone.ts
│   ├── pipeline-registry.ts
│   ├── postcall-queue.ts
│   ├── progress-cleanup.ts
│   ├── server
│   │   └── activity.ts
│   ├── sms-queue.ts
│   ├── twilio.ts
│   └── types.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── plans
│   ├── .gitkeep
│   ├── phase-1.md
│   ├── phase-10.md
│   ├── phase-12.1.md
│   ├── phase-12.2.md
│   ├── phase-12.md
│   ├── phase-2.md
│   ├── phase-3.md
│   ├── phase-4.md
│   ├── phase-5.md
│   ├── phase-6.md
│   ├── phase-7.md
│   └── phase-8.md
├── postcss.config.mjs
├── proxy.ts
├── public
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   ├── voqo-demo-call.js
│   └── window.svg
├── spec.md
├── specs
│   ├── DEPLOYMENT.md
│   ├── SPEC-ARCHITECTURE.md
│   ├── SPEC-DATA-API.md
│   ├── SPEC-PIPELINE.md
│   ├── SPEC-VOICE-AGENT.md
│   └── silo-plan-voice-agent-settings.md
└── tsconfig.json
```

Notes:
- Runtime artifacts are intentionally not tracked (per `.gitignore`): `/data/**`, `/public/demo/**`, `/public/call/**`, `.env*`, `.next/`, etc.
- This means “production state” is largely filesystem state outside git (a deliberate design choice per specs).

---

## Architecture Map

### High-level System Diagram

```text
                               ┌────────────────────────────────────┐
                               │         Browser (User UI)           │
                               │  `app/page.tsx` + `components/*`    │
                               └───────────────┬────────────────────┘
                                               │
                                               │ HTTP + SSE
                                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           Next.js App Router (Node)                        │
│                                                                           │
│  UI Pages:                                                                │
│  - `/`                    -> `app/page.tsx`                               │
│  - `/demo/[slug]`         -> `app/demo/[slug]/page.tsx` (injects script) │
│  - `/call/[id]`           -> `app/call/[id]/page.tsx` (serves HTML)       │
│  - `/history/[sessionId]` -> `app/history/[sessionId]/page.tsx`           │
│                                                                           │
│  API Routes:                                                              │
│  - Pipeline: `/api/pipeline/*`                                            │
│  - Calls:    `/api/calls*`, `/api/call-status`, `/api/agency-calls`       │
│  - History:  `/api/history*`                                              │
│  - Webhooks: `/api/webhook/personalize`, `/api/webhook/call-complete`     │
│                                                                           │
│  Background in-process workers (interval loops):                          │
│  - Postcall job worker -> `lib/postcall-queue.ts`                         │
│  - SMS job worker      -> `lib/sms-queue.ts`                              │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                                │ filesystem (JSON + HTML)
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              Local File Storage                            │
│                                                                           │
│  Progress streaming state (SSE watches these):                             │
│  - `data/progress/pipeline-<sessionId>.json`                               │
│  - `data/progress/activity-<sessionId>.json`                               │
│  - `data/progress/agency-<agencyId>.json`                                 │
│  - `data/progress/agency-activity-<agencyId>.json`                        │
│  - `data/progress/activity-postcall-<callId>.json`                        │
│                                                                           │
│  Durable records:                                                         │
│  - `data/agencies/<agencyId>.json`                                        │
│  - `data/calls/<callId>.json`                                             │
│  - `data/agency-calls/<agencyId>.json`                                    │
│  - `data/history/sessions.json`                                           │
│  - `data/history/sessions/<sessionId>.json`                               │
│                                                                           │
│  Durable queues:                                                          │
│  - `data/jobs/postcall/<callId>.json` + `.processing`                      │
│  - `data/jobs/sms/<callId>.json` + `.processing`                           │
│                                                                           │
│  Generated HTML (served via Next routes):                                  │
│  - `public/demo/<agencyId>.html`                                          │
│  - `public/call/<callId>.html`                                            │
└───────────────────────────────────────────────────────────────────────────┘
                                │
                                │ external APIs / webhooks
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                               External Services                             │
│                                                                           │
│  - Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)                     │
│    - Pipeline orchestrator: `app/api/pipeline/start/route.ts`              │
│    - Postcall generator: `lib/postcall-queue.ts` (via `lib/claude.ts`)     │
│                                                                           │
│  - ElevenLabs Conversational AI                                            │
│    - Personalization webhook -> `/api/webhook/personalize`                 │
│    - Call complete webhook    -> `/api/webhook/call-complete`              │
│                                                                           │
│  - Twilio                                                                 │
│    - SMS sending -> `lib/twilio.ts` (called by `lib/sms-queue.ts`)         │
└───────────────────────────────────────────────────────────────────────────┘
```

### Module-to-Module Connectivity (Key Edges)

Pipeline (agency discovery + demo generation):
- UI `app/page.tsx` -> `POST /api/pipeline/start` -> writes `data/progress/*` and starts Claude query
- UI `app/page.tsx` -> `GET /api/pipeline/stream?session=...` -> streams file deltas via `fs.watch`
- Claude orchestrator -> writes `data/progress/pipeline-*.json` and `data/progress/agency-*.json`
- Orchestrator -> `Task` spawns subagents instructed by `.claude/skills/agency-processor/SKILL.md`
- Subagents -> write:
  - `data/agencies/<agencyId>.json`
  - `data/progress/agency-<agencyId>.json`
  - `data/progress/agency-activity-<agencyId>.json`
  - `public/demo/<agencyId>.html`
- Server finalizes history snapshots:
  - `lib/history.ts` writes `data/history/sessions.json`
  - `lib/history.ts` writes `data/history/sessions/<sessionId>.json`

Demo call activation:
- Demo page `app/demo/[slug]/page.tsx` reads `public/demo/<slug>.html` and injects:
  - `window.__VOQO_DEMO_PHONE__` from `lib/phone.ts`
  - `window.__VOQO_AGENCY__` inferred from `data/agencies/<slug>.json`
  - `window.__VOQO_SESSION_ID__` from query param `?session=...`
  - `<script src="/voqo-demo-call.js">`
- Browser `public/voqo-demo-call.js` -> `POST /api/register-call` before navigating to `tel:`

Voice webhooks + post-call generation:
- `POST /api/webhook/personalize` -> matches `data/context/pending-calls.json` context -> returns ElevenLabs variables/overrides
- `POST /api/webhook/call-complete` -> writes `data/calls/<callId>.json` -> enqueues `data/jobs/postcall/<callId>.json`
- `lib/postcall-queue.ts` worker -> runs Claude -> expects:
  - `public/call/<callId>.html` created
  - `data/calls/<callId>.json` updated (extracted fields + status)
  - then enqueues `data/jobs/sms/<callId>.json`
- `lib/sms-queue.ts` worker -> Twilio SMS -> updates call JSON SMS status

Calls UX in main UI:
- UI `app/page.tsx` calls panel -> `GET /api/calls?session=...` and `GET /api/calls/stream?session=...` (SSE)
- Call detail modal -> `GET /api/calls/<callId>` + `GET /api/calls/stream-detail?callId=...` (SSE)

---

## System-by-System Analysis

### 1) Frontend UI (Search, Streaming, Calls, History)

Primary files:
- `app/page.tsx` (main app UX)
- `components/MainAgentWorkspace.tsx` (activity + tasks + calls panel container)
- `components/AgencyCard.tsx` (render agency progress cards)
- `components/CallsPanel.tsx`, `components/CallDetailModal.tsx` (call list + detail + postcall activity)
- `components/HistoryList.tsx`, `components/HistoryCard.tsx`, `components/HistorySessionReplay.tsx` (history view + replay)
- `components/SettingsModal.tsx` (voice agent prompt customization persisted to localStorage)

Key behaviors:
- Pipeline SSE is only connected while `pipelineStatus` is `searching` or `processing`.
- Calls SSE is only connected while the calls panel is open (reduces server load).
- Deduping of streamed messages:
  - Uses both message ID and a computed “message content key” to avoid duplicates after reconnects.
  - Caps dedupe set sizes to avoid unbounded memory growth in the browser.

Notable mismatches / redundancies:
- `components/AgentActivityPanel.tsx` and `components/TodoPanel.tsx` exist but are not referenced by the current main UI (`app/page.tsx` uses `MainAgentWorkspace`).
- `components/MockPreview.tsx` exists but is not referenced (current cards use `components/ShimmerPreview.tsx`).

Primary UX failure modes:
- SSE is best-effort; on `EventSource.onerror` the UI mostly logs and continues with stale UI. There is no reconnection/backoff strategy for pipeline SSE in `app/page.tsx` (only logs “SSE connection error”).
- Rehydrate logic depends on `localStorage` key `voqo:activePipelineSessionId` and `/api/pipeline/state`. If the server has restarted and progress files are missing/cleaned, rehydration fails and the UI clears the stored key.

---

### 2) Pipeline Orchestration + Progress Streaming (Agency Search → Demo Pages)

Primary files:
- `app/api/pipeline/start/route.ts`
- `app/api/pipeline/stream/route.ts`
- `app/api/pipeline/state/route.ts`
- `app/api/pipeline/cancel/route.ts`
- `lib/pipeline-registry.ts`
- `.claude/skills/agency-processor/SKILL.md` and `.claude/agents/agency-processor.md`

How it actually works (as implemented):
1. `POST /api/pipeline/start`
   - Creates `sessionId` like `pipe-<ms>-<rand>`.
   - Writes initial `pipeline-<sessionId>.json` and `activity-<sessionId>.json`.
   - Starts a Claude Agent SDK `query()` generator and stores it in an in-memory map (`globalThis.__voqoPipelineRuns`).
   - Background-drains the generator to keep it running after the HTTP response returns.
   - Interprets tool_use blocks from root assistant messages to append “tool/search/fetch” messages to the main activity file (best-effort).
   - After completion/failure, persists history snapshots via `lib/history.ts`.

2. Claude “orchestrator” behavior (prompt in `app/api/pipeline/start/route.ts`)
   - Finds agencies using `WebSearch`.
   - Writes per-agency skeleton progress files into `data/progress/agency-<agencyId>.json`.
   - Spawns N `Task` subagents (“agency-processor”) in a single message, each responsible for extraction + HTML generation.
   - Finalizes the pipeline file when all tasks are complete.

3. `GET /api/pipeline/stream?session=...` (SSE)
   - Uses `fs.watch(data/progress)` and sends events:
     - `todo_update`, `main_activity_message`, `subagent_activity_message`, `card_update`, `card_remove`, `pipeline_complete`
   - Normalizes agency progress and can “reconcile” a stuck agency state if the HTML exists but the progress file didn’t finalize.
   - Performs stale progress cleanup (deletes files older than 24 hours) on connect.

4. `POST /api/pipeline/cancel`
   - If an in-memory run exists, calls `run.query.interrupt()` and marks it `cancelled`.
   - Writes `pipeline-<sessionId>.json` state to cancelled (best effort if file exists).
   - Appends an activity warning to `activity-<sessionId>.json`.
   - Writes history detail snapshot (so history replay works even if cancelled).

Key design tradeoffs:
- The “run registry” for cancelling (`lib/pipeline-registry.ts`) is process-local. If the server process restarts, cancel requests cannot interrupt already-running Claude work (and the map is empty).
- Pipeline correctness depends on external agent compliance (the orchestrator and agency subagents must follow file-write contracts precisely).

Spec drift (implementation vs specs):
- `specs/SPEC-DATA-API.md` documents postcall worker timeouts and thresholds that do not match current `lib/postcall-queue.ts` constants (example: `PROCESSING_TIMEOUT_MS` is 90s in spec, but 5 minutes in code; stale thresholds differ too).
- `lib/progress-cleanup.ts` contains a more elaborate cleanup API but is not referenced by the running pipeline code (cleanup is re-implemented in `app/api/pipeline/stream/route.ts`).

---

### 3) Demo Page Serving + Call Activation

Primary files:
- `app/demo/[slug]/page.tsx`
- `public/voqo-demo-call.js`
- `app/api/register-call/route.ts`
- `lib/phone.ts`

How it works:
- The generated demo page is a static HTML file at `public/demo/<slug>.html`.
- The Next route `app/demo/[slug]/page.tsx` reads this HTML and injects:
  - The enforced demo phone number (`lib/phone.ts` -> `getDemoPhone()`).
  - Minimal agency context (best-effort read from `data/agencies/<slug>.json`).
  - Optional `sessionId` from query param `?session=...`.
  - The client script `public/voqo-demo-call.js`.
- `public/voqo-demo-call.js` renders a fixed “call bar”, patches `tel:` links, and on click:
  - Reads settings from localStorage (`voqo:voiceAgentSettings`).
  - Calls `/api/register-call` using `sendBeacon` or `fetch(keepalive: true)`.
  - Navigates to `tel:+614832945767` (or response override).

Where it can fail:
- Mobile: `sendBeacon` should work for immediate `tel:` navigation, but behavior varies by browser. Fallback uses `fetch` with `keepalive`, also best-effort.
- Desktop: `tel:` navigation may do nothing; script re-enables button after 2 seconds.
- If the generated HTML already contains its own call CTAs, the script tries to patch “legacy” handlers; this is heuristic and DOM-dependent.

---

### 4) Webhooks (ElevenLabs)

Primary files:
- `app/api/webhook/personalize/route.ts`
- `app/api/webhook/call-complete/route.ts`
- `specs/SPEC-DATA-API.md` (expected contracts)

`POST /api/webhook/personalize`
- Reads `data/context/pending-calls.json` and attempts to match:
  1) Recently active contexts (status `active`, within 5 minutes)
  2) Most recent pending, unexpired context
  3) Any unexpired context
  4) Default fallback agency
- Marks a matched pending context as `active` and stores `callerId`, `callSid`, `activatedAt`.
- Returns `dynamic_variables` and optionally `conversation_config_override`:
  - Full prompt + first message if settings exist
  - Otherwise, first-message-only override for non-default agency

`POST /api/webhook/call-complete`
- Attempts signature verification:
  - Skips in non-production.
  - In production, verification may still be bypassed if `ELEVENLABS_WEBHOOK_SECRET` is unset or the signature header is missing (current behavior is “warn and allow”).
- Matches context by:
  1) `context_id` (dynamic variables)
  2) `callSid`
  3) `callerId` with `status === 'active'`
  4) Most recent pending context
- Writes a new call file `data/calls/<callId>.json`.
- Updates matched context to `completed` with `callId`.
- Appends an agency call entry (`data/agency-calls/<agencyId>.json`) with status `generating`.
- Enqueues postcall job via `lib/postcall-queue.ts` and ensures workers are running.

Operational concerns:
- Both webhook handlers log extensive request details (headers + full payloads). This is useful for debugging but can create:
  - Significant log volume
  - PII retention in logs (caller phone, transcript)

---

### 5) Post-call Page Generation Pipeline (Durable Queue + Worker)

Primary files:
- `lib/postcall-queue.ts`
- `lib/claude.ts` (Claude invocation + hooks writing activity streams)
- `app/api/calls/*` (serving calls + streaming updates)

How it works:
- Call-complete enqueues a job file `data/jobs/postcall/<callId>.json`.
- `ensurePostcallWorker()` starts a process-level interval loop calling `processPostcallJobsOnce()`.
- The worker:
  - Atomically claims jobs using rename `*.json` -> `*.processing`.
  - Runs Claude Code (via `invokeClaudeCode`) with hooks that append activity messages to `data/progress/activity-postcall-<callId>.json`.
  - Expects Claude to write `public/call/<callId>.html` and update `data/calls/<callId>.json`.
  - Marks call completed (`pageStatus`, `pageUrl`, `generatedAt`) and enqueues the SMS job.
  - Retries on failure up to `MAX_ATTEMPTS`.
- “Already generated output” fast-path:
  - If `public/call/<callId>.html` exists and call JSON already has `pageStatus="completed"` and `pageUrl`, the worker finalizes without re-running Claude.

Where it can fail:
- If Claude produces HTML but does not correctly update call JSON fields, SMS may be delayed (or job loops until max attempts depending on which path is hit).
- `runWithTimeout()` rejects after timeout but does not actually cancel the underlying Claude query (risk: overlapping compute, orphaned work, resource drain).
- Interval workers are process-local; multiple server processes (PM2 cluster) can lead to multiple concurrent workers. File-based claiming helps, but you can still get:
  - More filesystem churn and log noise
  - More frequent directory scans

---

### 6) SMS Worker (Durable, Idempotent)

Primary files:
- `lib/sms-queue.ts`
- `lib/twilio.ts`

How it works:
- SMS job file: `data/jobs/sms/<callId>.json` (created with `flag: 'wx'` to dedupe enqueues).
- Worker loop claims jobs via rename to `*.processing`.
- Before sending, it checks the call file for prerequisites:
  - `pageStatus === 'completed'`
  - `pageUrl` exists
  - `callerPhone` exists
- On send:
  - Formats link using `NEXT_PUBLIC_APP_URL` (fallback `http://localhost:3000`).
  - Uses Twilio client to send, writes SMS status into `data/calls/<callId>.json`.
- On failure:
  - Marks call SMS status `failed`
  - Logs into `data/errors/sms-errors.json`
  - Attempts to rename job back to `.json` (effectively retryable, but note the status is already set to failed).

High-risk operational failure:
- `lib/twilio.ts` constructs a Twilio client at import time using `process.env.TWILIO_ACCOUNT_SID!` and `process.env.TWILIO_AUTH_TOKEN!`.
  - If env vars are missing/misconfigured, the module can throw early, breaking any import chain that reaches it (including webhook handling and SMS worker setup).

---

### 7) History and Replay (Durable Snapshots)

Primary files:
- `lib/history.ts`
- `app/api/history/route.ts`
- `app/api/history/[sessionId]/route.ts`
- `components/HistorySessionReplay.tsx`

How it works:
- Index file: `data/history/sessions.json` (max 50 sessions).
- Detail snapshots: `data/history/sessions/<sessionId>.json`.
- `addToHistory()` upserts by `sessionId` (preserves user-edited name).
- Detail snapshots are written:
  - On pipeline completion in `app/api/pipeline/start/route.ts` background finalizer
  - On cancel in `app/api/pipeline/cancel/route.ts`
  - Lazily in `app/api/history/[sessionId]/route.ts` only for terminal pipeline states
- Replay UI:
  - Fetches `/api/history/<sessionId>` and renders `MainAgentWorkspace` + agency cards with stored activity/subagent streams.

Where it can fail:
- If progress files are deleted (stale cleanup) before a session’s detail snapshot is persisted, history replay may degrade (though terminal snapshots are supposed to be saved).
- The system does not implement retention cleanup for calls and history beyond MAX_SESSIONS for session index. Specs mention call retention (“30 days”), but there is no call cleanup job in code.

---

### 8) Proxy / Middleware Redirection for `.html` Bypass

Primary file:
- `proxy.ts`

Purpose:
- Prevent direct access to `public/demo/*.html` and `public/call/*.html` so that:
  - Demo pages are served via `/demo/[slug]` (script injection happens there).
  - Call pages are served via `/call/[id]`.
- Redirects:
  - `/demo/<slug>.html` -> `/demo/<slug>`
  - `/call/<id>.html`  -> `/call/<id>`

Observation:
- Next.js (as built here) treats `proxy.ts` as a middleware/proxy module (the build output lists `Proxy (Middleware)` and the compiled server bundle expects an exported `proxy` function).

---

### 9) Legacy / Unused Endpoints and Docs

Likely legacy endpoints (not referenced by the current UI scripts):
- `app/api/search/route.ts` and `app/api/generate-demo/route.ts`

Legacy components (currently unused):
- `components/AgentActivityPanel.tsx`
- `components/TodoPanel.tsx`
- `components/MockPreview.tsx`

Potentially stale or conflicting design docs:
- `spec.md` appears to be an older hackathon spec and includes emoji-heavy mockups and references to older architecture (e.g., “Next.js 14”, Python agent SDK).
- The canonical current specs are in `specs/`.

---

## Edge Cases, Failure Points, and “Where Systems Can Fail”

### A) Filesystem State + Concurrency (Most Critical)

1) Lost updates from concurrent writes
- Multiple requests can read-modify-write the same JSON file without locking:
  - `data/context/pending-calls.json` (register-call, personalize, call-complete)
  - `data/agency-calls/<agencyId>.json` (call-complete, postcall completion)
  - `data/calls/<callId>.json` (call-complete, postcall worker, sms worker)
  - `data/history/sessions.json` (pipeline completion, cancel, replay persistence)
- Failure mode: last writer wins; intermediate writes are lost; files can become inconsistent.

2) Non-atomic JSON writes
- Most writes use `writeFile(path, JSON.stringify(...))` directly.
- Failure mode: process crash mid-write can leave truncated JSON; consumers then fail parsing and may silently drop data.

3) Directory expectations
- Many paths are created lazily (`mkdir({recursive:true})`) in some code paths but not all.
- Failure mode: in fresh deployments, missing dirs can break reads until a write path runs.

### B) Identifier Validation / Path Traversal Risk (Security + Data Leakage)

Several endpoints accept identifiers and use them directly in filesystem paths without validation (notably *not* using `isSafeSessionId` or similar):
- `GET /api/agency-calls?agency=<agencyId>` -> `lib/agency-calls.ts` uses `${agencyId}.json`
- `GET /api/calls/stream-detail?callId=<callId>` -> uses `${callId}.json` and activity file paths
- `GET /api/calls/<callId>` -> uses `${callId}.json`

Because these interpolate user-controlled strings into `path.join(..., `${id}.json`)`, an attacker can attempt `../` segments to read other `.json` files under `data/` (example pattern: `../history/sessions` would target `data/history/sessions.json`).

Even if this is “demo-only”, it is the highest-impact issue in terms of unintended data disclosure.

### C) Webhook Authenticity / Abuse

1) Personalize webhook currently has no signature verification.
- Spec calls out signature validation; implementation does not.
- Failure mode: anyone can hit `/api/webhook/personalize` and potentially:
  - cause contexts to be marked active
  - pollute logs
  - induce confusing behavior in live calls

2) Call-complete webhook verification can be bypassed in production
- If `ELEVENLABS_WEBHOOK_SECRET` is missing or signature header missing, current code logs a warning and allows.
- Failure mode: unauthenticated actor can post transcripts and create call/jobs on your server.

### D) Process Lifecycle / Deployment Mode

1) In-memory pipeline registry is non-durable
- `lib/pipeline-registry.ts` uses a global map per process for cancellability.
- Failure mode: restart => cannot cancel; status reconciliation relies on file state only.

2) Interval-based workers in Next.js runtime
- `ensurePostcallWorker()` and `ensureSmsWorker()` start `setInterval` loops.
- In a multi-process deployment (e.g. PM2 cluster) you may have N workers scanning the same dirs.
- File rename claiming avoids double-processing, but can increase I/O and complexity.

3) Timeout does not cancel Claude work
- `runWithTimeout()` rejects but does not interrupt the underlying Claude query.
- Failure mode: overlapping long-running jobs, CPU/memory pressure, “ghost” activity logs.

### E) SSE / `fs.watch` Reliability

`fs.watch` has platform-specific behavior (coalesced events, missed events under load).
- Pipeline and calls SSE endpoints do not have a periodic resync loop (they rely on file events + initial snapshot).
- Failure mode: client misses updates until reconnect or manual refresh; pipeline completion may not be detected promptly.

### F) External Dependencies / Credentials

1) Twilio client constructed at module import (`lib/twilio.ts`)
- Missing env vars can crash routes that import SMS functionality (including webhook handlers).

2) Claude Agent SDK execution environment
- Pipeline and postcall depend on Claude tooling being available and authorized.
- Failure mode: Claude query hangs/errors; partial files written; UI stuck in “processing”.

### G) Data Validation / Schema Drift

- Several endpoints parse JSON into `any` or `Record<string, unknown>` and proceed with minimal structural validation.
- Failure mode: if agent-generated files deviate from schema, UI may behave unpredictably (NaNs, missing fields, odd sorting).

### H) Logging / PII Handling

- Webhook handlers log full payloads and headers.
- Failure mode: transcripts and phone numbers land in logs (potential compliance/retention concerns).

---

## Simplification Recommendations

The goal here is “simpler” in two senses:
1) Fewer moving parts / fewer duplicated implementations
2) Smaller failure surface (fewer ways to corrupt or lose state)

### 1) Low-risk, high-leverage simplifications (minimal architectural change)

1) Centralize file I/O patterns
- Create a single “durable JSON write” helper (temp file + rename) and use it everywhere for shared JSON files.
- Create a single “safe JSON read” helper with consistent fallback behavior and logging.

2) Introduce identifier sanitizers for file-backed endpoints
- Reuse `lib/ids.ts`-style validation for `agencyId` and `callId` (or define `isSafeAgencyId`, `isSafeCallId`).
- Refuse requests with unsafe IDs *before* hitting filesystem.

3) Unify “progress cleanup”
- `lib/progress-cleanup.ts` exists but is unused; cleanup logic is duplicated inside `app/api/pipeline/stream/route.ts`.
- Pick one mechanism and remove/ignore the other to reduce conceptual load (even if you keep both, document which is canonical).

4) Reduce duplication between `app/api/pipeline/start/route.ts` activity capture and `lib/claude.ts` hooks
- Right now there are two separate “activity streaming” implementations.
- Consider standardizing on hooks for all Claude-driven work (or standardizing on “manual tool_use parsing”), not both.

5) Remove or explicitly mark legacy code paths
- `app/api/search/route.ts` and `app/api/generate-demo/route.ts` are not referenced by the current UI.
- Either remove them or clearly mark them as legacy/maintenance-only to reduce mental overhead.

### 2) Medium refactors (still file-based, but more robust)

1) Replace shared “single JSON map” files with per-record files
- Example: `data/context/pending-calls.json` becomes `data/context/<contextId>.json`.
- Benefits: fewer write conflicts; easier cleanup; simpler concurrent updates.

2) Add a lightweight “index” layer
- Keep per-record files, plus a small index file that is append-only (log) or rebuilt on boot.

3) Make workers “single leader”
- In a multi-process environment, choose a single worker process (via PM2 config) to run intervals.
- Alternatively, use a lock file (PID + timestamp) to elect one worker.

### 3) “Better/simpler approach” alternatives (bigger change)

1) SQLite instead of JSON files
- Keep the “single VPS” story but dramatically reduce:
  - concurrency problems
  - atomicity issues
  - path traversal risk
- You can still store generated HTML in `public/` but keep all metadata in SQLite tables.

2) Proper job queue (even local)
- Replace directory-scanned job files with a single durable queue:
  - SQLite-based queue
  - Redis (if acceptable)
- Improves visibility, retry semantics, and cancellation.

3) Serverless-friendly variant (if you ever migrate)
- File writes to `public/` and `data/` assume a writable filesystem.
- A serverless version would likely store:
  - HTML in object storage (S3-compatible)
  - JSON state in DB (Supabase/Postgres)
  - Job processing in a worker runtime

---

## Appendix A — File-by-File Notes (Purpose + Key Risks)

This is a “what it is / what can go wrong” index, focused on connections and failure surface.

### Root / Config
- `package.json`: Next 16 + React 19 + Claude Agent SDK + Twilio; no lint/test scripts beyond build.
- `next.config.ts`: empty config; behavior is mostly default.
- `postcss.config.mjs`, `app/globals.css`: Tailwind v4 setup.
- `proxy.ts`: middleware-like redirect to force `/demo/[slug]` + `/call/[id]` paths (prevents `.html` bypass).

### Specs (canonical design docs)
- `specs/SPEC-ARCHITECTURE.md`: single-VPS, file-based storage, static HTML generation, context matching strategy.
- `specs/SPEC-DATA-API.md`: schema contracts; some drift from current runtime constants.
- `specs/SPEC-PIPELINE.md`: SSE + orchestrator/subagent design.
- `specs/SPEC-VOICE-AGENT.md`: voice agent behavior and variable set; matches `lib/types.ts` defaults.
- `specs/DEPLOYMENT.md`: DO + nginx + PM2 deployment reference.

### UI Pages
- `app/page.tsx`: “engine” UI; SSE wiring; history tab; calls panel; settings modal wiring.
- `app/demo/[slug]/page.tsx`: reads static HTML and injects config + `voqo-demo-call.js`; best-effort agency data lookup.
- `app/call/[id]/page.tsx`: serves `public/call/<id>.html` raw.
- `app/history/[sessionId]/page.tsx`: renders replay component.
- `app/*/not-found.tsx`: user-friendly not found and “page not ready” UX.

### Pipeline API
- `app/api/pipeline/start/route.ts`: creates progress files; starts Claude query; registers in-memory run; persists to history on completion.
- `app/api/pipeline/stream/route.ts`: SSE over `data/progress`; `fs.watch`; reconciles agency completion; terminal event.
- `app/api/pipeline/state/route.ts`: snapshot endpoint for rehydrate/replay; normalizes activity messages.
- `app/api/pipeline/cancel/route.ts`: interrupts in-memory run when possible; marks files; persists history detail.

### Calls + Postcall API
- `app/api/calls/route.ts`: list calls (filters by session); opportunistically ticks postcall + sms workers.
- `app/api/calls/stream/route.ts`: SSE over calls dir; opportunistically ticks workers.
- `app/api/calls/[callId]/route.ts`: call detail + postcall activity snapshot; opportunistically ticks workers.
- `app/api/calls/stream-detail/route.ts`: SSE for a single call + postcall activity stream.
- `app/api/call-status/route.ts`: legacy polling (“did we get a page yet?”) for demo pages.
- `app/api/agency-calls/route.ts`: returns per-agency call history (file-backed).

### Call Context + Webhooks
- `app/api/register-call/route.ts`: stores pending call context with TTL in `data/context/pending-calls.json`.
- `app/api/webhook/personalize/route.ts`: matches pending context and returns dynamic variables + optional prompt overrides.
- `app/api/webhook/call-complete/route.ts`: persists call record, matches context, enqueues postcall job, starts workers.

### Workers / Libraries
- `lib/postcall-queue.ts`: file-based durable job queue with retries, stale recovery, timeout wrapper; triggers SMS job.
- `lib/sms-queue.ts`: idempotent SMS queue; waits for call to be ready; sends via Twilio; writes SMS state.
- `lib/twilio.ts`: Twilio client at import; `sendSMS`.
- `lib/claude.ts`: standardized Claude invocation + activity hooks writing to `data/progress/activity-*.json`.
- `lib/history.ts`: history index + session detail snapshot persistence.
- `lib/agency-calls.ts`: per-agency call list file.
- `lib/phone.ts`: enforces a single demo phone number (env is accepted only if it matches).
- `lib/ids.ts`: `isSafeSessionId` + activity ID generator.
- `lib/server/activity.ts`: stable ID + normalization for activity messages (dedupe/replay friendliness).
- `lib/progress-cleanup.ts`: unused helper set (currently duplicated by other code).

### Claude skill docs (agent compliance layer)
- `.claude/skills/agency-processor/SKILL.md`: strict schema + progress/activity update requirements; “no emojis”; absolute-path enforcement.
- `.claude/skills/postcall-page-builder/SKILL.md`: transcript extraction + listing search + HTML gen + call JSON update contract.
- `.claude/agents/agency-processor.md`: wrapper instructions pointing to skills.

---

## Final Notes (Most Important Findings)

If you only act on three things, they should be:
1) Add strict ID validation for any endpoint that turns user input into a filesystem path (prevents `.json` path traversal reads).
2) Require webhook authentication in production (and consider adding auth to destructive/demo-cost endpoints).
3) Make shared JSON writes atomic and conflict-resistant (avoid losing context/call/history data under concurrency).

