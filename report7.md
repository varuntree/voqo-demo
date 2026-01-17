# VoqoLeadEngine — Full Codebase Review & Analysis (report7)

Repo: `voqo-demo`  
Revision reviewed: `201ba945fc9620cdef73c3e44656f569276ef278`  
Date: 2026-01-17  

CRITICAL NOTE (scope): This is a read-only analysis report. No code changes were made. The system is described “as implemented” in this revision, with explicit callouts where docs/specs and code differ.

---

## 1) Architecture Map (Complete)

### 1.1 High-level architecture

The system is a single Next.js App Router application that:
- Runs a Claude “pipeline” to discover agencies and spawn per-agency Claude subagents.
- Streams progress to the browser via SSE by watching file-based progress JSON.
- Serves generated HTML pages from disk (stored under `public/`) but routed through Next.js pages to inject runtime JS needed for call context registration.
- Accepts ElevenLabs webhooks (personalization + post-call) and kicks off a background post-call page generation job and an SMS notification job.
- Stores all runtime state as JSON on disk under `data/` (no DB).

External services:
- **Anthropic / Claude Agent SDK**: agency discovery + page generation orchestration.
- **ElevenLabs Conversational AI**: voice agent + webhooks.
- **Twilio**: phone number + outbound SMS.

### 1.2 Tracked file tree (`git ls-files`)

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

### 1.3 Runtime directories (not tracked)

The system relies on these runtime directories and files being present/persisted across deployments:
- `data/agencies/` — durable agency records written by subagents.
- `data/progress/` — ephemeral progress + activity streams (SSE watches this).
- `data/context/pending-calls.json` — short-lived “call context” mapping (5-minute TTL).
- `data/calls/` — durable call records created by webhook.
- `data/jobs/postcall/` — durable post-call job queue.
- `data/jobs/sms/` — durable SMS job queue.
- `data/history/sessions.json` and `data/history/sessions/` — durable history index + per-session snapshots.
- `public/demo/` — generated demo HTML pages.
- `public/call/` — generated post-call HTML pages.

Docs that define this contract:
- `specs/SPEC-ARCHITECTURE.md`
- `specs/SPEC-DATA-API.md`
- `specs/SPEC-PIPELINE.md`
- `specs/DEPLOYMENT.md`

---

## 2) Module/Connection Map (Every subsystem + connections)

### 2.1 Next.js pages (App Router)

**Home / main UI**
- `app/page.tsx`
  - Client page: starts pipeline, connects SSE, renders cards, history, calls panel, settings modal.
  - Calls APIs:
    - `POST /api/pipeline/start`
    - `GET /api/pipeline/stream?session=...` (SSE)
    - `POST /api/pipeline/cancel`
    - `GET /api/pipeline/state?session=...` (rehydration)
    - `GET /api/history`
    - `PATCH /api/history/[sessionId]`
    - `GET /api/calls?session=...`
    - `GET /api/calls/stream?session=...` (SSE)

**Demo page renderer (HTML + runtime injection)**
- `app/demo/[slug]/page.tsx`
  - Server component: reads `public/demo/{slug}.html` and injects:
    - `window.__VOQO_DEMO_PHONE__` (from `lib/phone.ts`)
    - `window.__VOQO_AGENCY__` (from `data/agencies/{slug}.json` if present; fallback `{id: slug}`)
    - optional `window.__VOQO_SESSION_ID__` from `?session=...` query param (validated via `lib/ids.ts`)
    - `<script src="/voqo-demo-call.js" defer></script>`

**Post-call page renderer (HTML)**
- `app/call/[id]/page.tsx`
  - Server component: reads `public/call/{id}.html` and renders it as raw HTML.

**History run replay**
- `app/history/[sessionId]/page.tsx` → `components/HistorySessionReplay.tsx`
  - Reads from `GET /api/history/{sessionId}` (durable snapshot; fallback build-from-progress).

### 2.2 Public JS injected into demo HTML

- `public/voqo-demo-call.js`
  - Displays a fixed “Call now” callbar UI on demo pages.
  - On “Call now”:
    1) Calls `POST /api/register-call` (prefers `navigator.sendBeacon`, fallback `fetch(..., keepalive: true)`).
    2) Uses response `phoneNumber` to navigate `tel:+614832945767` (or configured).
  - Patches legacy generated pages by:
    - Rewriting `a[href^="tel:"]` to the demo number and registering context on click.
    - Defining global handlers `window.registerDemoCall` and `window.registerForCall`.
    - Replacing known hardcoded phone number text in some elements.
    - Polling `GET /api/call-status?agency=...` for up to 60s for “I already called” flows.
  - Pulls optional voice-agent settings from localStorage key `voqo:voiceAgentSettings` and passes them to `/api/register-call`.

### 2.3 API routes (backend surface area)

#### Pipeline (agency discovery + parallel processing)
- `app/api/pipeline/start/route.ts`
  - Writes initial `data/progress/pipeline-{sessionId}.json`
  - Writes initial `data/progress/activity-{sessionId}.json`
  - Starts an Anthropic Agent SDK `query(...)` in a background async loop.
  - Stores active run handle in `lib/pipeline-registry.ts` for cancellation.
  - Persists a durable history snapshot at end: uses `lib/history.ts`.

- `app/api/pipeline/stream/route.ts` (SSE)
  - Watches `data/progress/` via `fs.watch`.
  - Emits deltas as SSE events:
    - `todo_update`
    - `card_update`
    - `card_remove`
    - `main_activity_message`
    - `subagent_activity_message`
    - `pipeline_complete`
  - Normalizes message IDs and timestamps via `lib/server/activity.ts`.
  - Reconciles “complete” states if HTML exists but progress JSON didn’t finalize.

- `app/api/pipeline/state/route.ts`
  - Returns a snapshot: `{ pipeline, agencies, mainActivity, subagentActivity }`
  - Used by frontend to rehydrate after reload.

- `app/api/pipeline/cancel/route.ts`
  - Calls `query.interrupt()` for an active pipeline run and updates progress files to `cancelled`.
  - Saves a durable history snapshot for cancellation.

#### History (durable snapshots)
- `app/api/history/route.ts` → reads `data/history/sessions.json` via `lib/history.ts`.
- `app/api/history/[sessionId]/route.ts`
  - `GET` returns `data/history/sessions/{sessionId}.json` if present; else rebuilds from `data/progress/*`.
  - `PATCH` renames a session in `data/history/sessions.json` and updates `data/history/sessions/{sessionId}.json` if present.

#### Calls (list + detail + SSE)
- `app/api/calls/route.ts`
  - Lists recent calls from `data/calls/*.json`, optionally filtered by `session=...`.
  - “Best-effort” runs workers (`processPostcallJobsOnce`, `processSmsJobsOnce`) to keep background pipelines moving.

- `app/api/calls/stream/route.ts` (SSE)
  - Watches `data/calls/` and pushes `calls_update` events.

- `app/api/calls/[callId]/route.ts`
  - Reads `data/calls/{callId}.json` plus post-call activity `data/progress/activity-postcall-{callId}.json`.

- `app/api/calls/stream-detail/route.ts` (SSE)
  - Watches `data/calls/{callId}.json` and `data/progress/activity-postcall-{callId}.json`.
  - Streams:
    - `call_update`
    - `postcall_activity_message`
    - `postcall_activity_status`

#### Demo call context + webhooks
- `app/api/register-call/route.ts`
  - Accepts demo page payload and writes `data/context/pending-calls.json`.
  - TTL cleanup runs opportunistically on write.
  - Returns enforced demo phone number from `lib/phone.ts`.

- `app/api/webhook/personalize/route.ts`
  - ElevenLabs “conversation initiation client data” webhook.
  - Matches a pending/active context from `data/context/pending-calls.json`.
  - Returns `dynamic_variables` and optional `conversation_config_override` (custom prompt + first message), substituting variables.

- `app/api/webhook/call-complete/route.ts`
  - ElevenLabs post-call webhook.
  - Attempts signature verification (see security section; currently permissive).
  - Creates a call record `data/calls/{callId}.json`.
  - Updates agency call index `data/agency-calls/{agencyId}.json`.
  - Enqueues post-call job `data/jobs/postcall/{callId}.json` via `lib/postcall-queue.ts`.
  - Ensures post-call worker + SMS worker are running.

#### Auxiliary endpoints
- `app/api/call-status/route.ts` — polls for most recent call for an agency within 10 minutes.
- `app/api/agency-calls/route.ts` — returns `data/agency-calls/{agencyId}.json`.
- `app/api/search/route.ts` and `app/api/generate-demo/route.ts` — legacy “single-shot” Claude routes (not used by current main UI flow).

### 2.4 `lib/` modules (core implementation)

- `lib/claude.ts`
  - Wraps `@anthropic-ai/claude-agent-sdk` query invocation.
  - Provides activity hooks writing to `data/progress/activity-{sessionId}.json` based on tool events.
  - Used by post-call generation (`lib/postcall-queue.ts`) and legacy endpoints.

- `lib/pipeline-registry.ts`
  - Stores active pipeline runs in memory using `globalThis.__voqoPipelineRuns`.
  - Enables cancellation.

- `lib/history.ts`
  - Manages:
    - `data/history/sessions.json` (index; max 50 sessions)
    - `data/history/sessions/{sessionId}.json` (durable snapshot/replay)

- `lib/postcall-queue.ts`
  - File-based durable job queue in `data/jobs/postcall/`.
  - Processes jobs by renaming `.json` → `.processing`.
  - Calls Claude (`invokeClaudeCode`) with an activity session of `postcall-{callId}` so activity logs land in `activity-postcall-{callId}.json`.
  - Marks call completed and enqueues SMS job on success.

- `lib/sms-queue.ts`
  - File-based durable job queue in `data/jobs/sms/`.
  - Reads call file, checks prerequisites, sends SMS via Twilio (`lib/twilio.ts`), marks idempotent status in call JSON.

- `lib/twilio.ts`
  - Instantiates Twilio client at module load using env vars (see failure points).

- `lib/phone.ts`
  - Enforces a single demo phone number (hard-coded canonical) unless env matches exactly.

- `lib/server/activity.ts`
  - Normalizes activity message IDs and timestamps for SSE dedupe/stability.

- `lib/ids.ts`
  - Validation for `sessionId`-like strings and helper `buildActivityId`.

- `lib/types.ts`
  - Shared TS interfaces for progress, history, voice settings.
  - Also embeds the default voice agent system prompt + first message.

- `lib/progress-cleanup.ts`
  - Implements progress cleanup and helper read/write for progress files.
  - Not referenced by runtime code in this revision (dead code).

### 2.5 Claude skills/agents (subagent contracts)

- `.claude/skills/agency-processor/SKILL.md`
- `.claude/agents/agency-processor.md`
  - Define the per-agency “subagent” contract: write progress + activity JSON and generated HTML.
- `.claude/skills/postcall-page-builder/SKILL.md`
  - Defines post-call page generation expectations (update call JSON + write HTML).
- `.claude/skills/frontend-design/SKILL.md`
  - Aesthetic/design guidance for generated pages.

---

## 3) System-by-System Analysis (Line-by-line behavior & contracts)

### 3.1 Pipeline system (agency discovery → per-agency subagents → HTML)

**Primary files**
- `app/api/pipeline/start/route.ts`
- `app/api/pipeline/stream/route.ts`
- `app/api/pipeline/state/route.ts`
- `app/api/pipeline/cancel/route.ts`
- `lib/pipeline-registry.ts`
- `lib/history.ts`

**What actually happens**
1) `POST /api/pipeline/start`
   - Creates `sessionId = pipe-{timestamp}-{rand}`.
   - Writes:
     - `data/progress/pipeline-{sessionId}.json` (pipeline state + todos + agencyIds)
     - `data/progress/activity-{sessionId}.json` (main activity stream seed)
   - Starts a Claude Agent SDK `query(...)` with a very prescriptive orchestrator prompt builder (`buildOrchestratorPrompt`).
   - Stores the query handle in `globalThis.__voqoPipelineRuns` for cancellation.
   - Drains the query in a background async task so the pipeline continues after returning HTTP response.
   - Attempts to map tool usage to the main activity file by parsing `tool_use` blocks from assistant messages.
   - On completion/error/cancel, persists a durable history snapshot via `lib/history.ts` (even if SSE client never connects).

2) Claude “orchestrator” (prompt-defined)
   - Is instructed to:
     - Use `WebSearch` to identify agencies, one-by-one, and write skeleton progress JSON files quickly.
     - After collecting N agencies: spawn N parallel subagents (`Task`) of type `agency-processor`.
     - Update pipeline todos and mark completion.
   - Practical reality: correctness depends on the LLM adhering to the prompt contract and writing valid JSON into the expected file paths.

3) Subagents (`agency-processor` skill)
   - Write:
     - `data/progress/agency-{agencyId}.json` (progress card)
     - `data/progress/agency-activity-{agencyId}.json` (subagent activity stream)
     - `data/agencies/{agencyId}.json` (durable agency record)
     - `public/demo/{agencyId}.html` (demo page HTML)

4) `GET /api/pipeline/stream?session=...` (SSE)
   - Watches `data/progress/` and emits events for:
     - Pipeline todos / state
     - Agency cards and per-agency activity messages
     - Main activity messages
   - Maintains dedupe state by stable message IDs computed with `stableActivityMessageId(...)`.
   - Attempts reconciliation: if `public/demo/{agencyId}.html` exists but agency progress is not `complete`, it rewrites the agency progress JSON to `complete`.

5) Cancellation
   - `POST /api/pipeline/cancel` attempts `query.interrupt()`.
   - Updates pipeline + activity JSON and persists history snapshot.

**Key dependencies / coupling**
- Pipeline correctness is coupled to:
  - Claude adherence to prompt + skill contract.
  - The local filesystem being writable and persistent.
  - The Node process being long-lived (background tasks + setInterval).

### 3.2 Streaming UI (SSE consumers + dedupe)

**Primary files**
- `app/page.tsx`
- `components/MainAgentWorkspace.tsx`
- `components/AgencyCard.tsx`
- `app/api/pipeline/stream/route.ts`
- `lib/server/activity.ts`

**What actually happens**
- Main UI starts SSE connection during `searching`/`processing`.
- It dedupes messages by both:
  - `id`
  - `messageKey(type|text|detail|source|timestamp)`
- It maintains per-agency subagent activity maps.
- It supports reload rehydration using:
  - `localStorage` key `voqo:activePipelineSessionId`
  - `GET /api/pipeline/state?session=...`

**Notable implementation details**
- Dedupe is important because SSE can replay after reconnect and file watchers can re-emit after write bursts.
- The UI sorts agency cards by `status` ordering.
- The UI uses `AgencyCard` expandable subagent stream per card.

### 3.3 Demo page serving + runtime call context injection

**Primary files**
- `app/demo/[slug]/page.tsx`
- `public/voqo-demo-call.js`
- `lib/phone.ts`

**What actually happens**
- Generated HTML is stored under `public/demo/{slug}.html`.
- The Next route reads this file and injects a config script + the callbar script (`/voqo-demo-call.js`).
- The callbar script:
  - Registers call context (`POST /api/register-call`) with minimal agency metadata and optional `sessionId`.
  - Dials the enforced demo number.
  - Patches legacy CTAs and tel: links to ensure context registration happens before dialing.

### 3.4 Call context store (`pending-calls.json`)

**Primary files**
- `app/api/register-call/route.ts`
- `app/api/webhook/personalize/route.ts`

**What actually happens**
- `/api/register-call` appends a new context object keyed by `contextId = ctx-{timestamp}-{rand}` to `data/context/pending-calls.json`.
- It runs TTL cleanup opportunistically by deleting contexts whose `expiresAt < now`.
- `/api/webhook/personalize`:
  - Picks a context by:
    1) Most recent “active” context within 5 minutes (for repeated webhook calls)
    2) Else most recent “pending” context by `registeredAt`
    3) Else “any valid” unexpired context
    4) Else default agency fallback
  - Marks a matched pending context as `active` and writes `callerId`, `callSid`, `activatedAt`.
  - Returns `dynamic_variables` plus optionally overrides the ElevenLabs conversation prompt/first message using stored `settings`.

**Important nuance**
- This matching strategy is deliberately heuristic. It will mis-attribute calls if multiple people trigger demo calls around the same time (see failure points).

### 3.5 Post-call webhook → job queue → generated post-call page → SMS

**Primary files**
- `app/api/webhook/call-complete/route.ts`
- `lib/postcall-queue.ts`
- `lib/sms-queue.ts`
- `app/call/[id]/page.tsx`
- `app/api/calls/*`

**What actually happens**
1) ElevenLabs calls `/api/webhook/call-complete`.
2) The handler:
   - (Attempts) signature verification (currently permissive; see security section).
   - Matches call context (context_id → callSid → callerId → recent pending fallback).
   - Writes `data/calls/{callId}.json` with transcript + initial page status.
   - Appends an agency call index entry in `data/agency-calls/{agencyId}.json`.
   - Enqueues a post-call job `data/jobs/postcall/{callId}.json`.
   - Starts post-call and SMS workers (in-process intervals).
3) Post-call worker (`lib/postcall-queue.ts`)
   - Moves `.json` → `.processing` as a lock.
   - Calls Claude to generate:
     - `public/call/{callId}.html`
     - Updates `data/calls/{callId}.json` fields (extractedData, pageUrl, pageStatus, etc.) per skill contract.
   - On success: sets page status in call JSON, enqueues SMS job.
4) SMS worker (`lib/sms-queue.ts`)
   - Reads call JSON; if `pageStatus === "completed"` and `pageUrl` and `callerPhone` exist, sends SMS via Twilio and writes `call.sms = {status,...}`.
5) Caller opens link: `/call/{callId}` which renders the generated HTML.

---

## 4) Edge Cases, Failure Points, and “Where systems can fail”

This section is intentionally exhaustive and includes both correctness failures and security failures.

### 4.1 Critical security issues (high confidence)

1) **Path traversal / arbitrary file read risk (multiple endpoints)**
   - `app/demo/[slug]/page.tsx` and `app/call/[id]/page.tsx` build file paths from unvalidated URL params using `path.join(..., \`\${param}.html\`)`.
   - `app/api/calls/[callId]/route.ts` and `app/api/calls/stream-detail/route.ts` similarly use unvalidated `callId`.
   - If Next routing allows `..` segments or encoded traversal payloads to reach these handlers, an attacker could read arbitrary files from the server filesystem (including `.env.local`, private keys, etc.) and have them served back as HTML/JSON.
   - There is an `isSafeSessionId` helper in `lib/ids.ts` but it is not applied to these params.

2) **Webhook signature verification is inconsistent with the spec and permissive**
   - Spec (`specs/SPEC-DATA-API.md`) describes `elevenlabs-signature` HMAC-SHA256 over the payload.
   - `app/api/webhook/call-complete/route.ts`:
     - Uses a timestamped format `t=...,v0=...` and HMAC over `timestamp.payload`.
     - In production, it returns “true” if secret or signature is missing, which effectively disables verification.
   - `app/api/webhook/personalize/route.ts` does not verify signatures at all.
   - Net effect: anyone who can reach these endpoints can forge webhook requests (PII in logs, arbitrary job enqueueing, file growth, SMS abuse if Twilio is configured).

3) **No authentication / authorization on any endpoints**
   - This is called out in `specs/SPEC-ARCHITECTURE.md` as “demo purposes only”.
   - Practical risk: public internet exposure means anyone can:
     - start pipelines (`/api/pipeline/start`)
     - stream data (`/api/pipeline/stream`)
     - read calls (`/api/calls`, `/api/calls/{callId}`)
     - create contexts (`/api/register-call`)
     - hit webhooks

4) **Highly sensitive logging (PII + possibly secrets)**
   - `app/api/webhook/personalize/route.ts` and `app/api/webhook/call-complete/route.ts` log:
     - all headers
     - full request bodies
     - transcripts and caller identifiers
   - In production logs, this is a data retention and privacy risk and can also leak credentials if any auth-like headers are present.

### 4.2 Correctness and reliability failure points (high confidence)

1) **Concurrent JSON writes without locking (lost updates / corruption)**
   - Multiple routes and background loops read-modify-write the same JSON files:
     - `data/context/pending-calls.json` (register + personalize + call-complete)
     - `data/history/sessions.json` (pipeline completion + cancel + rename)
     - `data/agency-calls/{agencyId}.json` (append + update)
   - Without atomic writes (temp + rename) and without file locks, simultaneous writes can:
     - overwrite each other (lost entries)
     - create partial JSON (process crash mid-write)
   - Many readers are “best effort” and will silently ignore invalid JSON, which can hide corruption until critical.

2) **Heuristic context matching can mis-associate calls**
   - Personalization picks “most recent pending/active context”.
   - Call-complete falls back to “recent pending context”.
   - If two demo pages are clicked close in time, the wrong agency can be injected into the call. This is especially likely with:
     - multiple users concurrently
     - repeated dial attempts
     - webhook retries/out-of-order delivery

3) **Long-running work assumes a long-lived Node process**
   - Pipeline orchestration runs in a background async loop after responding.
   - Workers use `setInterval` in-process to process job queues.
   - This architecture will fail or be unreliable in serverless runtimes (where the process may freeze/terminate after responding).
   - Deployment docs (`specs/DEPLOYMENT.md`) imply a VPS + PM2, which matches the assumption.

4) **Twilio client is instantiated at module import and may crash if env is missing**
   - `lib/twilio.ts` uses `process.env.TWILIO_ACCOUNT_SID!` and `process.env.TWILIO_AUTH_TOKEN!` at import time.
   - Any import of `lib/sms-queue.ts` (which imports `lib/twilio.ts`) can crash the server if env vars aren’t set, even if SMS features aren’t actively used.
   - Calls endpoints “ensure” the SMS worker, increasing the likelihood of hitting this early.

5) **Several endpoints parse many JSON files without per-file guards**
   - Example: `app/api/call-status/route.ts` reads and `JSON.parse(...)` each file in a loop without isolating per-file parse errors.
   - A single corrupt call JSON file can throw and cause the route to fail early (outer catch), returning “no recent call”.

6) **Demo/call pages may be subject to caching behaviors**
   - `app/demo/[slug]/page.tsx` and `app/call/[id]/page.tsx` read from disk and should reflect new HTML immediately.
   - They do not explicitly set `export const dynamic = 'force-dynamic'` or `revalidate = 0`.
   - Depending on Next.js caching semantics, there is a risk of stale content being served after file updates.

7) **SSE + filesystem watchers can miss events or behave differently across OS/filesystems**
   - `fs.watch` is known to be lossy in some cases (burst writes, network filesystems).
   - The implementation includes debouncing and periodic heartbeat, but if a write is missed, UI may stall until another write occurs.

8) **`proxy.ts` is not wired as Next.js middleware**
   - `proxy.ts` exports `proxy(...)` + `config.matcher`, but Next.js expects middleware as `middleware.ts` (or equivalent supported entry).
   - `rg` shows no imports/usages of `proxy.ts`.
   - If the intention was to redirect `/demo/*.html` and `/call/*.html`, this file does not appear to be active.
   - Note: the demo route itself strips `.html` from the slug, so the redirect may be redundant if the route wins over `public/` static serving.

9) **Dead code / unused modules increase maintenance surface**
   - `lib/progress-cleanup.ts` appears unused (no references).
   - `components/AgentActivityPanel.tsx`, `components/TodoPanel.tsx`, `components/MockPreview.tsx` appear unused (no imports in app/components).
   - Legacy endpoints exist but current UI does not use them (`/api/search`, `/api/generate-demo`).

### 4.3 Edge cases by subsystem (quick checklist)

**Pipeline**
- Orchestrator or subagents write invalid JSON → SSE silently stops updating.
- Orchestrator discovers fewer than requested agencies → unclear completion semantics.
- Subagents generate HTML but never update progress JSON → SSE reconciliation may “force complete” based only on HTML existence.
- Cancellation after pipeline finishes → run handle missing; cancellation still mutates files best-effort.

**Progress/History**
- History index max 50 → silently truncates old sessions; replay may be missing if detail files remain but index dropped.
- Rename race with background history persistence → lost rename or overwritten session name.

**Demo call flow**
- `sendBeacon` unsupported → fallback `fetch keepalive` may still be cancelled by immediate `tel:` navigation on some browsers.
- Desktop browser can’t dial `tel:` → callbar re-enables after 2 seconds but user might assume it “worked”.
- Legacy page patching may miss some CTAs; DOM patching only samples first 250 nodes for phone text replacement.

**Webhooks**
- ElevenLabs retries/out-of-order deliveries → context matching may select wrong context; call-complete may reference contexts already marked completed.
- Missing/invalid signature headers → currently allowed in several cases.

**Postcall worker**
- Claude fails to generate HTML but partially updates call JSON → job retries until max attempts.
- Worker intervals depend on process liveness and route hits (“best effort” triggers from calls endpoints).

**SMS worker**
- Missing prerequisites (callerPhone/pageUrl) → job remains pending and retries.
- Twilio transient errors → job marks failed but also renames back to `.json`, risking repeated failure/duplication patterns depending on error path.

---

## 5) Simplification Opportunities (reduce moving parts without adding features)

These are structural simplifications that reduce failure surface and maintenance cost.

### 5.1 Consolidate duplicated activity/event handling

Current duplication:
- `lib/claude.ts` has proper hooks (PreToolUse/PostToolUse/SessionStart/End) writing activity files.
- `app/api/pipeline/start/route.ts` separately parses `tool_use` blocks from assistant messages to log activity.

Simplify by choosing one mechanism:
- Either attach hooks to the orchestrator query too, or standardize on one “activity writer” abstraction in `lib/`.

### 5.2 Consolidate file path constants and IO helpers

Path construction repeats across routes:
- `data/progress`, `data/calls`, `data/context`, `public/demo`, `public/call`, etc.

Simplify by centralizing:
- A single `lib/paths.ts` (or equivalent) containing canonical paths.
- A single “safeJsonRead / safeJsonWrite (atomic)” module.

### 5.3 Reduce unused/deprecated surfaces

Likely removable/archivable (pending confirmation):
- Legacy APIs: `app/api/search/route.ts`, `app/api/generate-demo/route.ts`.
- Unused components: `components/AgentActivityPanel.tsx`, `components/TodoPanel.tsx`, `components/MockPreview.tsx`.
- Unused lib: `lib/progress-cleanup.ts`.
- Outdated root `README.md` (still create-next-app boilerplate).

Even if you keep them, marking them clearly as legacy reduces confusion.

### 5.4 Make workers explicit (or isolate as a single worker loop)

Right now, “workers” run via `setInterval` inside the Next server process and are also “nudged” by API calls.

Simpler/cleaner options:
- A dedicated worker process (separate Node entry) that only processes `data/jobs/*`.
- Or: a single in-process worker loop that handles both queues, rather than two separate loops triggered from multiple places.

### 5.5 Make context matching deterministic

The biggest correctness issue is heuristic “most recent context” matching.

If staying file-based:
- Prefer requiring a stable `context_id` to be present (and fail closed), or keep a stricter mapping keyed by caller/session/callSid with explicit state transitions.

---

## 6) Better/Simpler Approaches (design alternatives)

These are “if you were redoing it” approaches; they are not required for the current demo to function.

### 6.1 If you keep file-based storage

Minimum changes that dramatically improve robustness:
- Atomic writes: write to `*.tmp` then `rename()` to target (avoid partial JSON).
- Lightweight locks (or “append-only logs” for activity streams):
  - Activity streams could be NDJSON append-only rather than rewriting JSON arrays.
- Strict param validation for any file-backed route params (`slug`, `callId`) to eliminate traversal risk.
- Strict webhook signature verification and rate limiting.

### 6.2 If you move to a DB/queue (production hardening)

Replace:
- `pending-calls.json` → a table with TTL + unique constraints.
- `data/jobs/*` → a real queue (BullMQ/Redis or Postgres queue).
- `data/progress/*` → a table or in-memory pubsub with persistence.

Benefits:
- Eliminates race conditions and corruption.
- Enables deterministic call→context correlation.
- Allows safe scaling beyond a single node if needed.

---

## 7) Spec/Docs vs Implementation Notes (drift)

1) `spec.md` is a historical hackathon spec; it contains old paths and emoji-laden examples and does not fully match current implementation.
2) `specs/*` documents the current architecture well, but there are mismatches:
   - Webhook signature verification described in `specs/SPEC-DATA-API.md` is not implemented as specified.
   - A “proxy”/redirect mechanism is documented, but `proxy.ts` does not appear to be active middleware.

---

## 8) Quick Risk Prioritization (what matters most)

If you only fix a few things (without changing product features), the highest impact items are:
1) Validate all params that feed file reads (`slug`, `id`, `callId`), and ensure requests cannot escape the intended directories.
2) Implement strict webhook signature verification (and do not accept missing secret/signature in production).
3) Remove/limit sensitive logging (headers/bodies/transcripts) in production.
4) Make JSON writes atomic to prevent corruption and lost updates.
5) Decide whether this must run only on a long-lived VPS process; if yes, document it as a hard constraint.

---

## Appendix A: Specs reviewed

- `specs/SPEC-ARCHITECTURE.md`
- `specs/SPEC-DATA-API.md`
- `specs/SPEC-PIPELINE.md`
- `specs/SPEC-VOICE-AGENT.md`
- `specs/DEPLOYMENT.md`

