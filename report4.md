# Report 4 — Full Codebase Review and Analysis

Date: 2026-01-17  
Repo: `voqo-demo` (`/Users/varunprasad/code/prjs/voqo-demo`)

## Scope and Constraints

- Per request: no feature additions and no modifications to existing code. This report is the only artifact produced.
- Review inputs used:
  - `git ls-files` for the complete tracked file tree
  - Full read of `specs/` documents:
    - `specs/SPEC-ARCHITECTURE.md`
    - `specs/SPEC-DATA-API.md`
    - `specs/SPEC-PIPELINE.md`
    - `specs/SPEC-VOICE-AGENT.md`
    - `specs/DEPLOYMENT.md`
  - Line-by-line review of all tracked runtime code in `app/`, `components/`, `lib/`, `public/`, plus `.claude/` skills/agents.
- Build verification run: `npm run build` succeeded (Next.js 16.1.2), confirming the repo currently compiles.

## 1) Tracked File Tree (from `git ls-files`)

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

### Local-only artifacts (not part of `git ls-files`, but present on disk)

These are runtime/dev artifacts seen locally and are not authoritative for architecture, but they can impact behavior:

- `.env`, `.env.local`: contain secrets/config; should not be committed.
- `.next/`, `node_modules/`: build artifacts and dependencies.
- `pnpm-lock.yaml`: present locally but excluded by `.gitignore` and not tracked.

## 2) Architecture Map (End-to-End)

This project is a single-node Next.js 16 app that:

1) Runs a “find agencies + generate demo pages” pipeline via Claude Agent SDK, streaming progress to the UI via SSE backed by filesystem JSON files.
2) Runs a “voice call + post-call page + SMS” pipeline via ElevenLabs webhooks + a durable filesystem job queue + Twilio SMS.
3) Uses the local filesystem as the durable datastore (JSON + generated HTML under `/public`).

### 2.1 Core runtime directories and what writes them

- `data/` (durable runtime storage; JSON)
  - `data/progress/`: pipeline progress + activity streams (written by Claude agent runs and server hooks)
  - `data/history/`: history index + optional per-session durable snapshots
  - `data/context/pending-calls.json`: temporary call contexts for voice personalization
  - `data/calls/`: call records, updated through post-call generation and SMS sending
  - `data/agency-calls/`: per-agency call index for generated pages
  - `data/jobs/postcall/`: durable postcall job queue
  - `data/jobs/sms/`: durable SMS job queue (idempotent per callId)
  - `data/errors/`: error logs for postcall and sms workers
- `public/` (generated static assets; HTML)
  - `public/demo/*.html`: generated demo landing pages per agency
  - `public/call/*.html`: generated post-call landing pages per call
  - `public/voqo-demo-call.js`: the runtime client script that ensures call context is registered before dialing

### 2.2 High-level component diagram

```
Browser UI (app/page.tsx)
  ├─ POST /api/pipeline/start  ───────────────┐
  │                                           │
  ├─ GET  /api/pipeline/stream (SSE) <────────┤  watches data/progress/*
  │                                           │
  ├─ GET  /api/history                        │  reads data/history/sessions.json
  │                                           │
  ├─ GET  /api/calls + /api/calls/stream      │  reads data/calls/*.json and nudges workers
  │                                           │
  └─ GET  /api/calls/[callId] + stream-detail │  reads data/calls/{callId}.json and
                                               │  data/progress/activity-postcall-{callId}.json
                                               │
Claude Agent SDK (server-side)
  ├─ Pipeline orchestrator (app/api/pipeline/start)
  │    ├─ writes data/progress/pipeline-{sessionId}.json
  │    ├─ writes data/progress/activity-{sessionId}.json (main activity)
  │    └─ spawns subagents (Skill: agency-processor) that write:
  │         - data/progress/agency-{agencyId}.json
  │         - data/progress/agency-activity-{agencyId}.json
  │         - data/agencies/{agencyId}.json
  │         - public/demo/{agencyId}.html
  │
  └─ Postcall worker (lib/postcall-queue.ts) (Skill: postcall-page-builder)
       ├─ reads data/jobs/postcall/{callId}.json
       ├─ reads data/calls/{callId}.json
       ├─ writes public/call/{callId}.html
       ├─ updates data/calls/{callId}.json (pageStatus/pageUrl + extracted data)
       └─ enqueues SMS job data/jobs/sms/{callId}.json

External services
  - ElevenLabs voice agent:
      - POST /api/webhook/personalize (pre-call; needs context matching)
      - POST /api/webhook/call-complete (post-call transcript; enqueues postcall job)
  - Twilio:
      - SMS sending from lib/sms-queue.ts
```

### 2.3 Web flows (UI → pipeline → generated pages)

#### A) Agency pipeline: search suburb → demo pages

1. User enters `suburb` + `count` in `app/page.tsx`
2. UI POSTs `app/api/pipeline/start/route.ts`
3. Server initializes:
   - `data/progress/pipeline-{sessionId}.json` (pipeline status + todos + agencyIds)
   - `data/progress/activity-{sessionId}.json` (main activity messages)
4. Server starts a Claude Agent SDK `query(...)` “orchestrator prompt”:
   - Orchestrator finds agency names + websites via WebSearch
   - Orchestrator writes per-agency skeleton progress files
   - Orchestrator uses Task tool to spawn subagents (Skill: `agency-processor`)
5. Subagents fetch and generate:
   - `data/progress/agency-{agencyId}.json` (status/steps/progress)
   - `data/progress/agency-activity-{agencyId}.json` (subagent activity stream)
   - `data/agencies/{agencyId}.json` (durable agency record)
   - `public/demo/{agencyId}.html` (demo landing page HTML)
6. UI connects to `app/api/pipeline/stream/route.ts` (SSE), which:
   - `fs.watch`es `data/progress/`
   - emits events (`todo_update`, `card_update`, `subagent_activity_message`, `pipeline_complete`)
7. When complete/cancel/error:
   - history entry is written (see `lib/history.ts`)
   - optional durable session detail snapshot is written by `app/api/pipeline/start` (run completion) and `app/api/history/[sessionId]` (on-demand)

#### B) Demo page serving: `/demo/[slug]` injects call script

- Generated HTML is stored in `public/demo/{slug}.html`.
- The Next route `app/demo/[slug]/page.tsx` reads that file and injects:
  - `window.__VOQO_DEMO_PHONE__` from `lib/phone.ts` (demo number is enforced)
  - `window.__VOQO_AGENCY__` from `data/agencies/{slug}.json` (best-effort)
  - `window.__VOQO_SESSION_ID__` from `?session=...` if present and safe
  - `<script src="/voqo-demo-call.js" defer></script>`
- `public/voqo-demo-call.js`:
  - renders a “call bar”
  - intercepts `tel:` links
  - calls `/api/register-call` (sendBeacon/keepalive) to store call context
  - navigates to `tel:+614832945767` (or server-returned phoneNumber)
  - provides legacy globals: `window.registerDemoCall` (polls `/api/call-status`) and `window.registerForCall`

#### C) Voice pipeline: register-call → personalize webhook → call-complete → postcall job → SMS

1. Browser calls `/api/register-call` (`app/api/register-call/route.ts`):
   - writes/updates `data/context/pending-calls.json` with a new `contextId` and TTL (5 minutes)
   - stores optional voice agent settings from localStorage (`voqo:voiceAgentSettings`)
2. User dials the demo number; Twilio routes to ElevenLabs.
3. ElevenLabs calls `/api/webhook/personalize` (`app/api/webhook/personalize/route.ts`):
   - loads `pending-calls.json`
   - selects a context (prefers recent `active`, else most recent `pending`, else fallback)
   - marks a pending context as `active` and writes back
   - responds with `dynamic_variables` and optional `conversation_config_override` (prompt/first_message)
4. ElevenLabs calls `/api/webhook/call-complete` (`app/api/webhook/call-complete/route.ts`):
   - attempts signature verification (but with important caveats; see risk section)
   - creates a new `callId`
   - matches the call to a context via `context_id` / callSid / callerId / recent pending fallback
   - writes `data/calls/{callId}.json` with transcript + status and `pageStatus="generating"`
   - updates `pending-calls.json` to mark the matched context completed
   - appends an entry into `data/agency-calls/{agencyId}.json`
   - enqueues `data/jobs/postcall/{callId}.json`
   - starts postcall + sms workers in-process
5. Postcall worker (`lib/postcall-queue.ts`):
   - renames job file to `.processing` to lock
   - invokes Claude Code (Skill: `postcall-page-builder`) with `activitySessionId = postcall-{callId}`
   - expects `public/call/{callId}.html` to be created
   - marks call `pageStatus="completed"`, `pageUrl="/call/{callId}"`, and enqueues SMS job
6. SMS worker (`lib/sms-queue.ts`):
   - waits until call indicates page is completed and callerPhone is known
   - sends SMS via Twilio and writes sms status back into `data/calls/{callId}.json`

## 3) File-by-File Architecture Map (What each file does and what it connects to)

This section is intentionally exhaustive. “Connections” lists the key modules, routes, files, and external systems touched.

### 3.1 Root / meta

- `AGENTS.md`: operational guidance (run/build/validate, gotchas, structure).
- `CLAUDE.md`: guidance for Claude Code “skills” and generated HTML conventions.
- `README.md`: default Next.js README (not specific to the project).
- `package.json` / `package-lock.json`: dependencies and scripts.
  - Key deps: `next@16.1.2`, `@anthropic-ai/claude-agent-sdk`, `twilio`, `react@19`.
- `next.config.ts`: minimal Next config (default).
- `postcss.config.mjs` / `tsconfig.json`: build config.
- `.gitignore`: explicitly excludes `data/**`, generated `public/demo/**` and `public/call/**`, env files, etc.
- `proxy.ts`: middleware-like proxy/redirect that blocks direct access to `/demo/*.html` and `/call/*.html` by redirecting to `/demo/[slug]` and `/call/[id]`.
  - Connections: Next middleware runtime, generated HTML routing, call script injection safety.

### 3.2 App routes (pages)

- `app/layout.tsx`: root layout + Geist fonts + global CSS.
- `app/page.tsx`: main UI (search + history + calls panel).
  - Connections:
    - POST `/api/pipeline/start`
    - GET `/api/pipeline/state` (rehydration after reload)
    - SSE `/api/pipeline/stream`
    - GET `/api/history`
    - PATCH `/api/history/[sessionId]`
    - GET `/api/calls` and SSE `/api/calls/stream`
    - Opens `CallDetailModal` (calls detail + postcall activity streaming)
- `app/demo/[slug]/page.tsx`: reads `public/demo/{slug}.html`, injects config + `/voqo-demo-call.js`.
  - Reads `data/agencies/{slug}.json` best-effort for minimal context.
  - Validates optional `?session=` via `lib/ids.isSafeSessionId`.
- `app/call/[id]/page.tsx`: reads `public/call/{id}.html` and serves it.
- `app/history/[sessionId]/page.tsx`: mounts `components/HistorySessionReplay`.
- `app/*/not-found.tsx`: not-found UI for demo/call pages.

### 3.3 App API routes

Pipeline (agency search + generation):

- `app/api/pipeline/start/route.ts`
  - Creates initial files:
    - `data/progress/pipeline-{sessionId}.json`
    - `data/progress/activity-{sessionId}.json`
  - Starts Claude Agent SDK query (orchestrator prompt).
  - Tracks running query in `lib/pipeline-registry.ts` (global map) for cancellation.
  - Background-drains query stream and:
    - appends “tool usage” messages to activity
    - persists a session snapshot to history via `lib/history.ts`
- `app/api/pipeline/stream/route.ts`
  - SSE endpoint: watches `data/progress/` using `fs.watch`.
  - Emits:
    - `todo_update` based on `pipeline-{sessionId}.json`
    - `card_update` based on `agency-{agencyId}.json`
    - `subagent_activity_message` based on `agency-activity-{agencyId}.json`
    - `main_activity_message` based on `activity-{sessionId}.json`
    - `pipeline_complete` when pipeline status becomes terminal (or all agencies are done)
  - “Reconciliation” behavior:
    - Marks an agency complete if its HTML exists but `demoUrl` is missing.
    - Marks pipeline complete if all agencies show terminal statuses but pipeline file does not.
  - Saves basic history entry via `lib/history.addToHistory`.
- `app/api/pipeline/state/route.ts`
  - Reads a snapshot of pipeline state for UI rehydration:
    - `pipeline-{sessionId}.json`
    - agency progress files for `pipeline.agencyIds`
    - main activity file
    - subagent activity files
  - Normalizes activity messages via `lib/server/activity.ts`.
- `app/api/pipeline/cancel/route.ts`
  - Cancels an active pipeline:
    - interrupts Claude Agent SDK query via `run.query.interrupt()`
    - updates `pipeline-{sessionId}.json` + `activity-{sessionId}.json`
    - persists session snapshot into history (`lib/history.ts`)

History:

- `app/api/history/route.ts`: returns `data/history/sessions.json` via `lib/history.readHistory`.
- `app/api/history/[sessionId]/route.ts`
  - GET: returns durable `data/history/sessions/{sessionId}.json` if present; else computes it from `data/progress/*`.
  - PATCH: renames history session in index file and updates session detail snapshot if it exists.

Calls:

- `app/api/calls/route.ts`
  - Returns recent calls from `data/calls/*.json`, optionally filtered by `?session=...`.
  - Side effect: “best-effort worker nudging” by calling:
    - `processPostcallJobsOnce()` (postcall worker)
    - `processSmsJobsOnce()` and `ensureSmsWorker()` (sms worker)
- `app/api/calls/stream/route.ts`
  - SSE endpoint that watches `data/calls/` and emits `calls_update` lists.
  - Side effect: same worker nudging as `/api/calls`.
- `app/api/calls/[callId]/route.ts`
  - Returns:
    - the call JSON from `data/calls/{callId}.json`
    - the postcall activity stream from `data/progress/activity-postcall-{callId}.json` (if present)
  - Side effect: worker nudging.
- `app/api/calls/stream-detail/route.ts`
  - SSE endpoint for a single call:
    - watches `data/calls/` for `{callId}.json` changes
    - watches `data/progress/` for `activity-postcall-{callId}.json` changes
  - Emits:
    - `call_update`
    - `postcall_activity_message`
    - `postcall_activity_status`
  - Side effect: worker nudging + SMS worker enable.

Agency call index and “recent call” polling:

- `app/api/agency-calls/route.ts`: reads `data/agency-calls/{agencyId}.json` via `lib/agency-calls.ts`.
- `app/api/call-status/route.ts`
  - Used by `public/voqo-demo-call.js` legacy “I already called” behavior.
  - Scans `data/calls/*.json` to find a recent call for `agency={agencyId}` within 10 minutes.
  - Side effect: calls `processPostcallJobsOnce()`.

Legacy generation endpoints (still present, may be unused by the primary UI):

- `app/api/search/route.ts`
  - Invokes Claude Code “agency-researcher” skill (not present in tracked `.claude/skills/`).
  - Caches suburb results under `data/agencies/{suburb-slug}.json`.
- `app/api/generate-demo/route.ts`
  - Looks up agency data in `data/agencies/*.json`.
  - Invokes Claude Code “demo-page-builder” skill (not present in tracked `.claude/skills/`).
  - Generates `public/demo/{agencyId}.html` if absent.

Voice webhooks:

- `app/api/register-call/route.ts`
  - Accepts either `{agencyData, timestamp, settings?}` or legacy-shaped bodies.
  - Writes to `data/context/pending-calls.json` with a TTL and a new contextId.
  - Responds with enforced demo phone number from `lib/phone.ts`.
- `app/api/webhook/personalize/route.ts`
  - Reads `pending-calls.json`, selects a context, marks it `active`, writes back.
  - Responds with `dynamic_variables` and optional `conversation_config_override`.
  - Note: currently does not verify webhook signatures and logs request headers/body verbosely.
- `app/api/webhook/call-complete/route.ts`
  - Verifies webhook signature with important exceptions (see risk section).
  - Creates call JSON file, updates context, appends per-agency call index entry, enqueues postcall job.
  - Starts in-process postcall and sms workers.

### 3.4 Library modules

- `lib/types.ts`: shared types and constants (pipeline types, voice settings defaults, available variables).
- `lib/ids.ts`: sessionId safety validation + activity id generator.
- `lib/phone.ts`: enforces a single demo phone number regardless of env unless exact match.
- `lib/pipeline-registry.ts`: stores in-memory map of active pipeline sessions to cancel/inspect (global singleton).
- `lib/history.ts`: history index (`data/history/sessions.json`) + durable session detail snapshots (`data/history/sessions/{sessionId}.json`).
- `lib/server/activity.ts`: normalizes and stabilizes activity message IDs (dedupe-friendly) and timestamps.
- `lib/claude.ts`: general wrapper around Claude Agent SDK with optional hooks to append activity into `data/progress/activity-{sessionId}.json`.
- `lib/agency-calls.ts`: reads/writes `data/agency-calls/{agencyId}.json`.
- `lib/postcall-queue.ts`: durable postcall job processing, invokes Claude Code, updates call data and per-agency call index, enqueues SMS jobs.
- `lib/sms-queue.ts`: durable SMS job processing, sends Twilio SMS after postcall completion, updates call JSON with delivery status.
- `lib/twilio.ts`: Twilio client + phone normalization; currently initializes the client at module import time.
- `lib/progress-cleanup.ts`: stale progress file cleanup helpers (largely parallel to cleanup logic in `/api/pipeline/stream`).

### 3.5 UI components

- `components/MainAgentWorkspace.tsx`: unified “workspace” panel (main activity + todos + optional calls list).
- `components/AgencyCard.tsx`: renders per-agency pipeline card with steps, preview, and subagent activity stream.
- `components/CallsPanel.tsx`: renders list of calls and their status.
- `components/CallDetailModal.tsx`: shows transcript + live postcall generation activity (streams via SSE).
- `components/HistoryList.tsx`, `components/HistoryCard.tsx`: history list, renaming, navigation to replay.
- `components/HistorySessionReplay.tsx`: replays a completed session by fetching `/api/history/{sessionId}` and rendering the same workspace + cards.
- `components/SettingsModal.tsx`: edits and validates voice agent settings in localStorage.
- `components/ActivityMessage.tsx`, `components/StepList.tsx`, `components/TodoPanel.tsx`, `components/TabNavigation.tsx`: UI helpers.
- `components/MockPreview.tsx`, `components/ShimmerPreview.tsx`: card preview placeholders/animations.

### 3.6 Claude “skills” and agent specs (`.claude/`)

- `.claude/skills/agency-processor/SKILL.md`: defines the subagent’s strict contract for:
  - progress file schema
  - activity file schema
  - durable agency JSON schema
  - demo HTML requirements (must rely on runtime call bar script; must not call webhook routes from browser)
- `.claude/skills/postcall-page-builder/SKILL.md`: defines post-call transcript extraction + listing search + HTML generation + call JSON update requirements.
- `.claude/skills/frontend-design/SKILL.md`: design-direction guidance for demo page aesthetics.
- `.claude/agents/agency-processor.md`: agent role wrapper referencing the above skills.
- `.claude/commands/*.md`: internal Claude-Code workflows for planning/implementing (not part of runtime).

### 3.7 Specs (`specs/`) and how they map to code

The primary specs in `specs/` map to these runtime surfaces:

- `specs/SPEC-ARCHITECTURE.md`: matches the “single VPS + file-based storage + static HTML” architecture that is implemented.
- `specs/SPEC-PIPELINE.md`: matches the pipeline files + SSE streaming approach.
- `specs/SPEC-DATA-API.md`: mostly matches the file layouts and API shapes, with notable mismatches (see section 6).
- `specs/SPEC-VOICE-AGENT.md`: matches the intent of voice settings and variable injection; the current implementation partly diverges (see section 6).
- `specs/DEPLOYMENT.md`: documents the intended deployment environment (DigitalOcean + PM2 + Nginx).

## 4) System-by-System Analysis (Line-by-Line Behavioral Review)

This section is organized by “systems” that match the specs and the actual runtime boundaries.

### System A — Agency pipeline (Search + parallel generation)

**Primary files**

- `app/page.tsx` (UI client state machine)
- `app/api/pipeline/start/route.ts` (launches orchestrator + creates initial files)
- `app/api/pipeline/stream/route.ts` (SSE watcher + reconciliation)
- `app/api/pipeline/state/route.ts` (rehydration snapshot)
- `app/api/pipeline/cancel/route.ts` (interrupts run + persists cancel state)
- `lib/pipeline-registry.ts` (in-memory run registry)
- `lib/history.ts` (history persistence)
- `lib/server/activity.ts` (activity dedupe + timestamp normalization)
- `.claude/skills/agency-processor/SKILL.md` (subagent contract)

**Runtime contract**

- The pipeline is file-driven. The UI is “eventually consistent” with `data/progress/*`.
- The orchestrator is expected to:
  - incrementally append `agencyIds` to `pipeline-{sessionId}.json`
  - write skeleton `agency-{agencyId}.json` as soon as each agency is found
  - spawn N subagents that update those files

**Key connections**

- `/api/pipeline/start` creates the canonical sessionId and bootstraps progress files.
- `/api/pipeline/stream` is responsible for “UI streaming,” not for actually running Claude. It watches the filesystem.
- `lib/history.addToHistory` can be called from multiple places; history can be updated multiple times for the same sessionId.

**Important behavioral details**

- UI rehydration:
  - `app/page.tsx` persists `voqo:activePipelineSessionId` and uses `/api/pipeline/state` on reload.
  - Activity dedupe uses both message IDs and a content-based key to reduce duplicates on reconnection.
- SSE streaming:
  - Uses `fs.watch` (platform-dependent semantics; see failure section).
  - Emits incremental new messages using a “last seen ID” strategy and stable IDs computed via `lib/server/activity.ts`.
- Reconciliation:
  - `maybeReconcileAgency` in `/api/pipeline/stream` marks an agency complete if `public/demo/{agencyId}.html` exists even if progress says otherwise.
  - `checkCompletion` can force pipeline completion if all agency statuses are terminal but pipeline is stuck at `processing`.

### System B — Demo pages + call activation (client-side glue)

**Primary files**

- `app/demo/[slug]/page.tsx`
- `public/voqo-demo-call.js`
- `app/api/register-call/route.ts`
- `lib/phone.ts`

**Runtime contract**

- A generated demo page should be usable even if its embedded HTML has “legacy” behaviors, because `voqo-demo-call.js` patches:
  - phone number text replacements
  - `tel:` links
  - global functions like `registerDemoCall` and `registerForCall`
- Call context registration must survive immediate navigation to `tel:`:
  - `sendBeacon` is preferred (fire-and-forget)
  - `fetch(..., { keepalive: true })` is fallback
- Server enforces a single demo phone number (to avoid agency pages dialing real agency phones).

**Important behavioral details**

- `app/demo/[slug]/page.tsx`:
  - reads HTML from `public/demo/{slug}.html`
  - tries to load agency JSON from `data/agencies/{slug}.json`; falls back to `{id: slug}`
  - injects script configuration into `<head>` if possible
- `voqo-demo-call.js`:
  - creates a fixed call bar UI at the bottom of the page
  - ensures dialing always uses the enforced demo number
  - optionally includes `sessionId` in the register-call payload so calls can be filtered by pipeline session

### System C — Voice personalization webhook (context selection)

**Primary files**

- `app/api/webhook/personalize/route.ts`
- `app/api/register-call/route.ts`
- `lib/types.ts` (VoiceAgentSettings shape)
- `components/SettingsModal.tsx` (local settings authoring)

**Runtime contract**

- The personalization webhook should return:
  - `dynamic_variables` containing the agency context (name, location, phone, demo_page_url, context_id)
  - `conversation_config_override` if a custom prompt/first message is desired
- Context matching is “best effort” and uses a TTL:
  - If a recently `active` context exists, prefer it (handles multiple webhook invocations per dial attempt).
  - Else, choose the most recent `pending` context that has not expired.
  - Else, fallback to any valid non-expired context; else default agency.

**Important behavioral details**

- The implementation logs request headers and body verbosely, and logs all context keys and their metadata.
- The code does not currently validate webhook authenticity for personalize (no HMAC check).
- When a `pending` context is selected, it is immediately marked `active` and augmented with `callerId`, `callSid`, and `activatedAt`.

### System D — Call complete webhook (call record + postcall job enqueue)

**Primary files**

- `app/api/webhook/call-complete/route.ts`
- `lib/postcall-queue.ts`
- `lib/agency-calls.ts`

**Runtime contract**

- On valid post-call events (`type=post_call_transcription`), the system:
  - creates a call JSON file in `data/calls/`
  - updates context file to mark completion (if matched)
  - appends an agency call entry
  - enqueues a postcall job
  - starts background workers in-process

**Important behavioral details**

- Signature verification exists but has important “allow” behaviors:
  - In non-production, it always returns true.
  - In production, if secret is missing OR signature header missing, it currently allows by returning true (see failure/security section).
- Context matching order:
  1. `context_id` from dynamic variables
  2. `callSid` match
  3. `callerId` match on active contexts
  4. most recent pending context (not strictly TTL bounded in all branches)
- The call file is initially written with `pageStatus="generating"` and empty extracted fields; the postcall worker is expected to update the record.

### System E — Post-call worker (HTML generation and call JSON mutation)

**Primary files**

- `lib/postcall-queue.ts`
- `.claude/skills/postcall-page-builder/SKILL.md`
- `lib/claude.ts` (Claude Agent SDK wrapper + activity hooks)

**Runtime contract**

- Job queue semantics are filesystem-based:
  - `{callId}.json` = pending job
  - `{callId}.processing` = locked/in-progress job
  - deleted = completed job
- Worker scheduling:
  - `ensurePostcallWorker()` starts a `setInterval` loop (5s).
  - Additionally, several API routes “nudge” `processPostcallJobsOnce()` opportunistically.
- On success:
  - expects `public/call/{callId}.html` to exist
  - marks call as completed and enqueues SMS job
- On failure:
  - retries up to 3 attempts, records into `data/errors/postcall-errors.json`, marks call failed after exceeding attempts.

**Important behavioral details**

- There is a timeout wrapper around the Claude invocation (5 minutes).
- There is a “short-circuit” path: if output HTML exists and the call JSON already shows completion, the job is finalized without re-running Claude.

### System F — SMS worker (Twilio integration)

**Primary files**

- `lib/sms-queue.ts`
- `lib/twilio.ts`
- `specs/SPEC-DATA-API.md` (SMS job semantics)

**Runtime contract**

- SMS jobs are idempotent per `callId`:
  - `enqueueSmsJob` uses `writeFile(..., { flag: 'wx' })` so duplicates do not enqueue.
- Worker sends SMS only when:
  - call JSON shows `pageStatus="completed"`
  - call JSON has `pageUrl`
  - call JSON has `callerPhone`
- Updates call JSON with:
  - `sms.status`, `sms.sentAt`, `sms.messageSid`, `sms.to` (plus legacy `smsSentAt`)

**Important behavioral detail**

- Twilio client is instantiated at module import time (`lib/twilio.ts`), using non-null env assertions. If Twilio env vars are missing, importing the module can crash the process or route handler (see failure section).

## 5) Edge Cases, Failure Points, and “Where Systems Can Fail”

This section consolidates all critical risks found in the codebase, grouped by category.

### 5.1 File-based storage: atomicity, corruption, and race conditions

**Risk: partial writes → JSON parse failures**

- Many code paths read JSON that may be concurrently written by another process/agent:
  - `pending-calls.json`
  - `pipeline-*.json`, `activity-*.json`, `agency-*.json`, `agency-activity-*.json`
  - `calls/*.json`
- If any writer does a non-atomic write and the reader reads mid-write, JSON parsing can fail.
  - Many routes tolerate this by returning null/ignoring; some do not.

**Risk: lost updates (read-modify-write races)**

- `app/api/register-call/route.ts` performs:
  - read contexts → prune → write contexts
  - with no lock or atomic merge
  - two simultaneous registrations can overwrite each other, losing one contextId.
- `app/api/webhook/personalize/route.ts` reads and writes the same file to mark a context active; concurrent invocations can clobber state.
- `app/api/webhook/call-complete/route.ts` reads and writes the same file to mark completion; same risks.

**Risk: file growth / retention gaps**

- `pending-calls.json` is pruned only when `/api/register-call` is hit; if traffic is mostly webhooks, old contexts may accumulate.
- Error logs (`postcall-errors.json`, `sms-errors.json`) can grow without a hard cap (SMS caps to 200 entries; postcall does not cap).

### 5.2 SSE + `fs.watch`: delivery and correctness risks

**Risk: `fs.watch` is lossy and platform-dependent**

- On some platforms/filesystems, `fs.watch`:
  - coalesces events
  - drops events under load
  - emits `filename=null`
- The pipeline stream handler partially compensates by calling “refresh all” when filename is missing, but under high churn this can still lead to delayed or missed UI updates.

**Risk: hash-based change detection is O(size) and can be expensive**

- Several SSE emitters compute hashes by `JSON.stringify(...)` of large objects.
  - This is simple and correct for low volume, but can be CPU-heavy under heavy file churn.

### 5.3 Worker model: `setInterval` inside Next server process

**Risk: multiple workers per machine**

- In a PM2 cluster or multiple Node processes, each process will call `ensurePostcallWorker()` / `ensureSmsWorker()` and run its own interval loops.
  - The rename-to-`.processing` lock pattern prevents double-processing a job, but increases contention and overhead.

**Risk: worker liveness depends on process lifetime**

- The system relies on a long-running Node server (as per the VPS design).
  - If the process restarts, jobs remain on disk and should be picked up later (good).
  - If the app were ever deployed to a serverless environment, interval loops would be unreliable (spec assumes VPS, so this is aligned but worth noting explicitly).

**Risk: opportunistic worker “nudging” from API routes**

- `/api/calls`, `/api/calls/stream`, `/api/calls/[callId]`, `/api/calls/stream-detail` all attempt to progress queues by invoking `processPostcallJobsOnce()` and/or `processSmsJobsOnce()`.
  - Under high UI polling / SSE reconnects, this can multiply load and interleave with interval-based runs.

### 5.4 Webhook security, idempotency, and data integrity

**Risk: personalization webhook has no signature validation**

- `app/api/webhook/personalize/route.ts` does not validate authenticity.
  - Any actor who can reach the endpoint can request dynamic variables and potentially influence `pending-calls.json` state (mark contexts active).
  - This increases the risk of wrong context attribution and potential data leaks in logs.

**Risk: call-complete signature verification allows in production if misconfigured**

- In `app/api/webhook/call-complete/route.ts`, signature verification is effectively bypassed if:
  - `ELEVENLABS_WEBHOOK_SECRET` is unset, or
  - the signature header is missing
- This is explicitly contrary to the stricter intent described in `specs/SPEC-DATA-API.md` (which implies requiring a valid signature in production).

**Risk: webhook retries are not idempotent**

- Call complete creates a new `callId` for every request; if ElevenLabs retries the same event:
  - you can end up with duplicate call records, duplicate postcall jobs, and potentially duplicate SMS sends (SMS job is deduped per callId, but not per conversation).
- The system currently lacks a stable idempotency key such as `conversation_id` + `event_timestamp`.

**Risk: context mismatch and “wrong agency” attribution**

- The matching strategy is best-effort and can misattribute in real-world race conditions:
  - multiple users click “Call now” within the TTL window
  - personalization webhook invoked multiple times for different attempts
  - call complete can fall back to “most recent pending context,” which can be wrong in parallel usage

### 5.5 Environment variable and dependency failure modes

**High severity: Twilio client is created at import time**

- `lib/twilio.ts` uses:
  - `Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)`
  - `from: process.env.TWILIO_PHONE_NUMBER!`
- If any of those are missing at runtime, importing any route that imports `lib/sms-queue.ts` can crash.
  - Several frequently-hit routes import `sms-queue.ts` directly (calls list and call detail routes), so “UI read-only” surfaces can fail when SMS config is absent.

**Medium severity: mixed phone normalization and enforced number**

- The demo dial number is intentionally enforced (`lib/phone.ts`), but other areas still rely on caller/agency phone fields that may be missing or malformed.
- SMS sending depends on normalizing `callerPhone`. If `callerPhone` is missing, jobs remain pending until max attempts or manual intervention.

### 5.6 Client security / HTML injection risks

**Risk: serving generated HTML via `dangerouslySetInnerHTML`**

- `app/demo/[slug]/page.tsx` and `app/call/[id]/page.tsx` serve raw HTML.
  - If any generation step includes untrusted HTML/JS (intentionally or via prompt injection), it will execute in the user’s browser.
  - This is acceptable in a controlled demo context but is a clear security boundary.

**Risk: external resource loading**

- Generated pages may include third-party images and assets; `AgencyCard` also uses Google’s favicon service for fallback logos.
  - This can leak browsing metadata to third parties and can introduce mixed-content/caching issues depending on deployment.

### 5.7 UX and correctness edge cases

- Settings modal variable whitelist:
  - `components/SettingsModal.tsx` flags variables not in `AVAILABLE_VARIABLES`.
  - `lib/types.ts` default system prompt includes `{{caller_name}}` in the closing line, but `{{caller_name}}` is not listed in `AVAILABLE_VARIABLES`. This means the default settings can be reported as containing an “unknown variable,” even without user edits.
- Calls list filtering:
  - Calls can be filtered by `sessionId` if it was stored during `/api/register-call`. If omitted, calls appear without session association and may not show in a session-filtered calls panel.
- `app/api/call-status/route.ts` parses call files without per-file error isolation; a single corrupt call file can break the scan and cause false “no recent call” results.

## 6) Spec ↔ Implementation Mismatches (Notable)

These are “drift” points where the specs and the current code behavior do not fully align.

### 6.1 Webhook security strictness

- Spec intent (`specs/SPEC-DATA-API.md`): in production, require valid signature or return 401.
- Implementation:
  - personalize webhook: no verification at all
  - call-complete webhook: allows if secret or signature is missing (even in production)

### 6.2 Job worker configuration values

- Spec examples mention shorter timeouts / different thresholds (e.g., postcall `PROCESSING_TIMEOUT_MS` 90s, stale threshold 10 minutes).
- Implementation uses:
  - postcall timeout: 5 minutes
  - stale processing recovery: 20 minutes

### 6.3 Voice settings variables

- Spec suggests available dynamic variables: agency_name, agency_location, agency_phone, demo_page_url, context_id.
- Implementation:
  - supports those for substitution, but also surfaces `{{caller_name}}` in default prompt text even though it cannot be substituted via `dynamic_variables`.

### 6.4 Legacy endpoints referenced by specs vs tracked skills

- `app/api/search` references “agency-researcher” skill; `app/api/generate-demo` references “demo-page-builder” skill.
- These skills are not present under tracked `.claude/skills/` in this repo, suggesting either:
  - they exist outside this repo in the user’s Claude environment, or
  - these routes are legacy/unmaintained.

## 7) Simplification Opportunities (High Leverage, Minimal Conceptual Cost)

These recommendations focus on reducing complexity, drift, and operational risk while preserving the “single VPS + file-based” philosophy.

### 7.1 Consolidate context matching into a single module

Today, context matching logic is duplicated with subtle differences:

- `app/api/webhook/personalize/route.ts`
- `app/api/webhook/call-complete/route.ts`
- `app/api/register-call/route.ts` (cleanup behavior)

Recommendation:

- Create a single “context store” API (even if still file-backed) that provides:
  - `addPendingContext(...)`
  - `markActive(contextId, callerId, callSid)`
  - `markCompleted(contextId, callId)`
  - `findBestContext({ contextId?, callerId?, callSid?, now })`
  - consistent TTL cleanup and retention rules

Benefits: fewer mismatches, fewer attribution bugs, easier testing.

### 7.2 Make file writes atomic (temp + rename) for shared JSON files

For shared JSON files (`pending-calls.json`, history, call JSON, etc.), atomic writes reduce parse failures and lost updates.

Recommendation:

- Write to `file.tmp` then `rename(file.tmp, file)` (atomic on most filesystems).
- For read-modify-write, consider simple lock files or per-context files to reduce contention.

### 7.3 Decouple background workers from API traffic

Current state:

- Workers are both interval-driven and request-driven (“nudged” on calls endpoints).

Recommendation:

- Prefer one durable worker loop per responsibility (postcall, sms), started explicitly on server boot, not from request handlers.
- Alternatively, run `node worker-postcall.js` and `node worker-sms.js` as separate PM2 processes to make behavior explicit.

Benefits: more predictable load, fewer accidental concurrent runs, clearer ops.

### 7.4 Remove duplicate activity systems (hooks vs manual parsing)

Current state:

- Pipeline orchestrator uses manual parsing of tool_use blocks to create activity updates.
- Postcall uses Claude SDK hooks from `lib/claude.ts`.

Recommendation:

- Standardize on one mechanism for activity:
  - either all hooks, or all explicit writes
- Make the activity file schema consistent (some places store `{messages: [...]}`, others store raw arrays).

### 7.5 Normalize “legacy” and “current” endpoints

Current state:

- There are two generations of pipeline: modern `pipeline/*` and legacy `search` + `generate-demo`.

Recommendation:

- If legacy routes are unused, document them as deprecated and (optionally) remove them later.
- If they are used, align their behavior with the modern pipeline (same schemas, same storage layout, same activity streaming).

### 7.6 Tighten and unify safety validation

Current state:

- `isSafeSessionId` exists; no analogous `isSafeAgencyId` or `isSafeCallId`.
- Several file paths are built from route params and/or stored IDs.

Recommendation:

- Implement consistent safe-ID checks for all identifiers used in filesystem paths.
- Centralize in `lib/ids.ts`.

## 8) Better / Simpler Approaches (If You’re Willing to Change Architecture Later)

These are intentionally “bigger moves” than section 7; they are optional and depend on whether the demo evolves into a production system.

### 8.1 Replace shared JSON blobs with per-entity files

Instead of a single `pending-calls.json` map, store:

- `data/context/pending/{contextId}.json`
- `data/context/active/{contextId}.json`
- `data/context/completed/{contextId}.json`

Benefits:

- reduces lock contention
- avoids lost updates
- makes TTL cleanup and debugging simpler (delete files by mtime)

### 8.2 Use SQLite for state that requires transactions

If correctness becomes critical (multi-user, concurrent calls), SQLite provides:

- atomic transactions
- simple indexing (e.g., by callerId, callSid, conversationId)
- reliable dedupe/idempotency handling

### 8.3 Use a dedicated queue abstraction

If job volume grows, a file-based queue can be replaced with:

- Redis-backed queue (BullMQ) or similar
- still keeps a simple operational model on a single VPS

## 9) Quick “Critical Risk” Checklist

If you only address a few things, these have the highest impact:

1. Twilio env missing can break unrelated routes due to import-time client creation (`lib/twilio.ts`).
2. Webhook signature validation is effectively optional in production for call-complete; personalize has none.
3. `pending-calls.json` read-modify-write can lose contexts under concurrency, causing wrong agency matching.
4. Webhook retry idempotency is not implemented (duplicate calls/pages possible).
5. Serving generated HTML with `dangerouslySetInnerHTML` is a large trust boundary; acceptable for demo, risky for production.

## Appendix A — Build Output Summary

`npm run build` succeeded and enumerated these routes:

- App routes: `/`, `/demo/[slug]`, `/call/[id]`, `/history/[sessionId]`
- API routes:
  - `/api/pipeline/start`, `/api/pipeline/stream`, `/api/pipeline/state`, `/api/pipeline/cancel`
  - `/api/history`, `/api/history/[sessionId]`
  - `/api/calls`, `/api/calls/stream`, `/api/calls/[callId]`, `/api/calls/stream-detail`
  - `/api/register-call`
  - `/api/webhook/personalize`, `/api/webhook/call-complete`
  - `/api/agency-calls`, `/api/call-status`
  - `/api/search`, `/api/generate-demo`
  - Middleware: “Proxy” (from `proxy.ts`)

## Appendix B — Complete Per-File Role Map (All Tracked Files)

This appendix maps every tracked file to its primary purpose and the main runtime connection points.

### Root

- `.gitignore`: excludes runtime artifacts (notably `data/**`, `public/demo/**`, `public/call/**`, env files).
- `AGENTS.md`: human/agent operational notes (commands, gotchas, structure).
- `CLAUDE.md`: Claude Code generation guidelines (HTML expectations, styling choices).
- `README.md`: default Next.js scaffold README (not specific to the product).
- `next.config.ts`: Next.js config (currently minimal).
- `package.json`: scripts + dependencies.
- `package-lock.json`: dependency lockfile.
- `postcss.config.mjs`: Tailwind v4 PostCSS config.
- `proxy.ts`: middleware redirect to prevent direct `.html` access and force `/demo/[slug]` and `/call/[id]` routes.
- `spec.md`: large hackathon spec (historical/umbrella spec; partially overlaps with `specs/*`).
- `tsconfig.json`: TypeScript compiler options.

### `.claude/`

- `.claude/agents/agency-processor.md`: subagent wrapper that points at `agency-processor` + `frontend-design` skills and enforces constraints.
- `.claude/commands/build.md`: internal “silo implement” workflow for executing a plan + E2E verification.
- `.claude/commands/plan.md`: internal planning workflow template (interview → explore → plan → E2E steps).
- `.claude/commands/prime.md`: minimal priming notes for Claude Code in this repo.
- `.claude/skills/agency-processor/SKILL.md`: contract for agency extraction + progress/activity file writes + demo HTML generation.
- `.claude/skills/frontend-design/SKILL.md`: design quality guidelines for generated HTML/UI aesthetics.
- `.claude/skills/postcall-page-builder/SKILL.md`: contract for transcript parsing + listing search + postcall HTML generation + call JSON update.

### `agents/`

- `agents/plans/plan1.md`: planning artifact (non-runtime).
- `agents/plans/silo-plan-pipeline-persistence-and-history.md`: planning artifact (non-runtime; describes pipeline persistence/history direction).

### `app/` (Next.js App Router)

- `app/layout.tsx`: root layout wrapper, font setup, global CSS import.
- `app/page.tsx`: main UI (search tab, history tab, SSE connections, calls panel, settings modal).
- `app/globals.css`: global styling (Tailwind / base styles for app shell).
- `app/favicon.ico`: site icon.

#### Demo page routes

- `app/demo/[slug]/page.tsx`: serves generated demo HTML with injected call-bar config and `public/voqo-demo-call.js`.
- `app/demo/[slug]/not-found.tsx`: not-found UI for missing demo HTML.

#### Call page routes

- `app/call/[id]/page.tsx`: serves generated post-call HTML from `public/call/{id}.html`.
- `app/call/[id]/not-found.tsx`: not-found UI for missing call HTML.

#### History routes

- `app/history/[sessionId]/page.tsx`: mounts `components/HistorySessionReplay` (client fetch of session detail).

### `app/api/` (server routes)

#### Pipeline

- `app/api/pipeline/start/route.ts`: creates pipeline files, runs Claude Agent SDK orchestrator, persists history on completion.
- `app/api/pipeline/stream/route.ts`: SSE for pipeline progress + activity streams; watches `data/progress/`.
- `app/api/pipeline/state/route.ts`: snapshot endpoint for UI rehydration (pipeline + agencies + activities).
- `app/api/pipeline/cancel/route.ts`: cancels pipeline query, updates state files, persists history snapshot.

#### History

- `app/api/history/route.ts`: returns history index (`data/history/sessions.json`).
- `app/api/history/[sessionId]/route.ts`: returns per-session detail snapshot, or computes it from progress files; supports rename.

#### Calls

- `app/api/calls/route.ts`: returns recent calls from `data/calls/*.json`; nudges postcall + sms processing.
- `app/api/calls/stream/route.ts`: SSE stream for call list; watches `data/calls/`; nudges workers.
- `app/api/calls/[callId]/route.ts`: returns a call record plus postcall activity stream (if present); nudges workers.
- `app/api/calls/stream-detail/route.ts`: SSE for single call detail + postcall activity; watches `data/calls/` and `data/progress/`.

#### Demo-call context + webhooks

- `app/api/register-call/route.ts`: registers a pending call context in `data/context/pending-calls.json` with TTL; returns enforced demo number.
- `app/api/webhook/personalize/route.ts`: selects and marks call context active; returns dynamic variables and optional conversation override.
- `app/api/webhook/call-complete/route.ts`: validates (partially) webhook signature, writes call record, enqueues postcall job, updates context, starts workers.

#### Per-agency call index and recent-call polling

- `app/api/agency-calls/route.ts`: returns `data/agency-calls/{agencyId}.json`.
- `app/api/call-status/route.ts`: polls `data/calls/*.json` for a recent call for an agency (used by demo page legacy “I already called” UX).

#### Legacy endpoints (may be unused by primary UI)

- `app/api/search/route.ts`: legacy suburb search caching (invokes Claude Code “agency-researcher” skill).
- `app/api/generate-demo/route.ts`: legacy demo generation (invokes Claude Code “demo-page-builder” skill).

### `components/` (React client UI)

- `components/ActivityMessage.tsx`: renders a single activity message row with icon + color coding.
- `components/AgentActivityPanel.tsx`: legacy-style activity panel UI (not the main workspace panel).
- `components/MainAgentWorkspace.tsx`: primary “workspace” panel (activity stream + tasks + optional calls list).
- `components/TodoPanel.tsx`: collapsible todo/task UI (older implementation; workspace includes its own todo renderer).
- `components/AgencyCard.tsx`: agency card UI (steps + preview + subagent activity stream).
- `components/StepList.tsx`: renders step status list for a card.
- `components/MockPreview.tsx`: older preview component (not used by current `AgencyCard` preview).
- `components/ShimmerPreview.tsx`: current preview component used by `AgencyCard`.
- `components/CallsPanel.tsx`: calls list UI inside workspace.
- `components/CallDetailModal.tsx`: call detail modal (transcript + streaming postcall activity).
- `components/TabNavigation.tsx`: “New Search / History” header tab toggle.
- `components/HistoryList.tsx`: history sessions list UI.
- `components/HistoryCard.tsx`: single history session card + rename + navigation.
- `components/HistorySessionReplay.tsx`: renders a completed session replay from `/api/history/[sessionId]`.
- `components/SettingsModal.tsx`: edits voice agent settings in localStorage and warns about unknown template variables.

### `data/` (tracked placeholders only)

- `data/history/.gitkeep`: keeps directory in git.
- `data/progress/.gitkeep`: keeps directory in git.

### `lib/` (server/shared logic)

- `lib/types.ts`: shared schema/types + default voice agent settings + template variables list.
- `lib/ids.ts`: session id safety validation + activity id generator.
- `lib/phone.ts`: enforced demo dial number selection and formatting.
- `lib/pipeline-registry.ts`: global singleton map of active pipeline runs (for cancellation).
- `lib/history.ts`: history index + per-session detail snapshot read/write + derived session computation from progress files.
- `lib/server/activity.ts`: activity message normalization and stable ID generation.
- `lib/claude.ts`: Claude Agent SDK wrappers + activity hooks into `data/progress/activity-{sessionId}.json`.
- `lib/agency-calls.ts`: per-agency call index read/write/update.
- `lib/postcall-queue.ts`: durable postcall job queue + Claude invocation + call JSON updates + SMS enqueue.
- `lib/sms-queue.ts`: durable SMS job queue + Twilio send + call JSON sms status updates.
- `lib/twilio.ts`: Twilio client and phone normalization utilities.
- `lib/progress-cleanup.ts`: cleanup helpers for stale progress files (not the primary mechanism used by SSE, but available).

### `plans/` (non-runtime planning artifacts)

- `plans/.gitkeep`: keeps directory in git.
- `plans/phase-1.md`: phase plan artifact.
- `plans/phase-2.md`: phase plan artifact.
- `plans/phase-3.md`: phase plan artifact.
- `plans/phase-4.md`: phase plan artifact.
- `plans/phase-5.md`: phase plan artifact.
- `plans/phase-6.md`: phase plan artifact.
- `plans/phase-7.md`: phase plan artifact.
- `plans/phase-8.md`: phase plan artifact.
- `plans/phase-10.md`: phase plan artifact.
- `plans/phase-12.md`: phase plan artifact.
- `plans/phase-12.1.md`: phase plan artifact.
- `plans/phase-12.2.md`: phase plan artifact.

### `public/` (static assets)

- `public/voqo-demo-call.js`: critical runtime script injected into demo pages to register context + initiate demo calls + patch legacy CTAs.
- `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`: default Next scaffold assets (non-critical to app logic).

### `specs/` (system specifications)

- `specs/SPEC-ARCHITECTURE.md`: authoritative system architecture spec (single VPS + file-based storage).
- `specs/SPEC-DATA-API.md`: authoritative data schemas and API endpoints spec.
- `specs/SPEC-PIPELINE.md`: pipeline behavior + streaming UI spec.
- `specs/SPEC-VOICE-AGENT.md`: voice agent prompt and webhook expectations spec.
- `specs/DEPLOYMENT.md`: deployment reference for the VPS and operational steps.
- `specs/silo-plan-voice-agent-settings.md`: planning/spec artifact focused on voice agent settings (informational; not runtime code).
