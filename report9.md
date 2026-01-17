# VoqoLeadEngine (voqo-demo) — Full Codebase Review & Analysis

Date: 2026-01-17  
Repo: `/Users/varunprasad/code/prjs/voqo-demo`

This report is based on:
- `git ls-files` (complete tracked file tree)
- Full reads of `specs/` documents: `SPEC-ARCHITECTURE.md`, `SPEC-DATA-API.md`, `SPEC-PIPELINE.md`, `SPEC-VOICE-AGENT.md`, `DEPLOYMENT.md`
- Line-by-line review of tracked runtime code in `app/`, `lib/`, `components/`, `public/`, plus relevant `.claude/*` assets and config files.

No code was modified as part of this review; only this report was created.

---

## 1) Complete File Tree (from `git ls-files`)

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

### 2.1 High-Level Runtime Topology

All runtime logic lives inside a single Next.js (App Router) process and local filesystem state:

```
Browser UI (app/page.tsx, components/*)
  |  POST /api/pipeline/start
  |  GET  /api/pipeline/stream (SSE)
  |  GET  /api/pipeline/state (rehydrate)
  |  POST /api/pipeline/cancel
  |  GET  /api/history + PATCH /api/history/:sessionId
  |  GET  /api/calls + SSE /api/calls/stream + SSE /api/calls/stream-detail
  v
Next.js Node runtime (app/api/*, lib/*)
  |  invokes Claude Agent SDK to run subagents (agency-processor skill)
  |  reads/writes JSON files under /data/*
  |  reads/writes generated HTML under /public/demo and /public/call
  |  runs background workers (interval loops) for postcall + SMS
  v
Filesystem
  - data/progress/*  (pipeline + activity streams)
  - data/agencies/*  (durable agency records)
  - data/context/pending-calls.json (short-lived call context map)
  - data/calls/*     (call transcript + status record)
  - data/jobs/postcall/* + data/jobs/sms/* (durable queues)
  - data/history/*   (history index + optional per-session snapshots)
  - data/agency-calls/* (per-agency call index)
  - public/demo/*    (generated agency demo HTML)
  - public/call/*    (generated post-call HTML)
```

External services:
- ElevenLabs calls webhooks:
  - `POST /api/webhook/personalize` (before call)
  - `POST /api/webhook/call-complete` (after call ends)
- Twilio sends SMS (server-side; triggered by SMS worker)
- Claude Code (via `@anthropic-ai/claude-agent-sdk`) generates agency demo pages + post-call pages.

### 2.2 Primary Systems and Their File/Module Owners

#### System A — Agency Search + Demo Generation Pipeline (Specs: `specs/SPEC-PIPELINE.md`)
Core implementation:
- Entry: `app/api/pipeline/start/route.ts`
- Runtime orchestration: `@anthropic-ai/claude-agent-sdk` query loop
- Progress files:
  - `data/progress/pipeline-{sessionId}.json`
  - `data/progress/activity-{sessionId}.json`
  - `data/progress/agency-{agencyId}.json`
  - `data/progress/agency-activity-{agencyId}.json`
- SSE streaming: `app/api/pipeline/stream/route.ts`
- Rehydrate snapshot: `app/api/pipeline/state/route.ts`
- Cancel: `app/api/pipeline/cancel/route.ts`
- Durable history index + snapshots: `lib/history.ts` and `app/api/history/*`
- Skills used by Claude:
  - `.claude/skills/agency-processor/SKILL.md`
  - `.claude/skills/frontend-design/SKILL.md`

Outputs:
- Agency durable record: `data/agencies/{agencyId}.json` (written by skill)
- Demo HTML: `public/demo/{agencyId}.html` (written by skill)
- UI route serving demo: `app/demo/[slug]/page.tsx`

#### System B — Demo Call Context + Voice Agent Personalization (Specs: `specs/SPEC-VOICE-AGENT.md`)
Core implementation:
- Client-side call activation bar + tel interceptors: `public/voqo-demo-call.js`
- Demo HTML server-side injection wrapper: `app/demo/[slug]/page.tsx`
- Context registration: `app/api/register-call/route.ts` → writes `data/context/pending-calls.json`
- Personalization webhook: `app/api/webhook/personalize/route.ts` (matches pending context and returns `dynamic_variables` and optional override)

#### System C — Call Completion → Post-call Page Generation + SMS
Core implementation:
- Call complete webhook: `app/api/webhook/call-complete/route.ts`
  - Writes a new call record to `data/calls/{callId}.json`
  - Updates `data/context/pending-calls.json` (context status → completed)
  - Updates per-agency index via `lib/agency-calls.ts`
  - Enqueues postcall job: `lib/postcall-queue.ts` → `data/jobs/postcall/{callId}.json`
- Postcall worker: `lib/postcall-queue.ts`
  - Runs `invokeClaudeCode()` with `.claude/skills/postcall-page-builder/SKILL.md`
  - Produces: `public/call/{callId}.html`
  - Updates: `data/calls/{callId}.json` (pageStatus/pageUrl/etc; plus whatever the skill adds)
  - Enqueues SMS job: `lib/sms-queue.ts` → `data/jobs/sms/{callId}.json`
- SMS worker: `lib/sms-queue.ts` + `lib/twilio.ts`
  - Reads call record until pageStatus=completed and callerPhone exists
  - Sends SMS via Twilio
  - Writes SMS status back into call record

UI surfaces for calls:
- Calls list: `app/api/calls/route.ts` + `app/api/calls/stream/route.ts`
- Call detail modal: `app/api/calls/[callId]/route.ts` + `app/api/calls/stream-detail/route.ts`
- Postcall page server route: `app/call/[id]/page.tsx`

---

## 3) Module-by-Module Map (Files → Responsibilities → Connections)

### 3.1 Root / Configuration
- `package.json`: Next.js 16.1.2 + React 19; depends on `@anthropic-ai/claude-agent-sdk` and `twilio`.
- `next.config.ts`: empty/default config.
- `postcss.config.mjs` + `app/globals.css`: Tailwind v4 setup via `@tailwindcss/postcss`.
- `tsconfig.json`: strict TypeScript; path alias `@/*`.
- `.gitignore`: ignores `/data/**` (except `.gitkeep`) and `/public/demo/**` + `/public/call/**`.
- `proxy.ts`: exports a `proxy()` and `config.matcher` intended for Next middleware-like redirects, but it is not named/placed as Next middleware and is not imported anywhere in this repo.

### 3.2 Next.js App Router Pages
- `app/page.tsx`: main UI (search + pipeline streaming + history tab + call panel + settings modal).
  - Calls `POST /api/pipeline/start`
  - Consumes SSE `GET /api/pipeline/stream?session=...`
  - Rehydrates via `GET /api/pipeline/state?session=...`
  - Cancels via `POST /api/pipeline/cancel`
  - Loads history via `GET /api/history` and renames via `PATCH /api/history/:sessionId`
  - Streams call list via `GET /api/calls/stream?session=...` and boot fetch `GET /api/calls?session=...`
  - Displays call details via `components/CallDetailModal` (which uses call detail endpoints)
- `app/demo/[slug]/page.tsx`: reads `public/demo/{slug}.html`, injects runtime config + loads `public/voqo-demo-call.js`.
  - Also attempts to read `data/agencies/{slug}.json` to inject minimal agency data.
  - Accepts optional `?session=...` and injects a sanitized sessionId into `window.__VOQO_SESSION_ID__`.
- `app/call/[id]/page.tsx`: reads `public/call/{id}.html` and serves it.
- Not found pages:
  - `app/demo/[slug]/not-found.tsx`: “Demo Not Found”.
  - `app/call/[id]/not-found.tsx`: “Page Not Ready” (assumes eventual generation).
- `app/history/[sessionId]/page.tsx`: renders `components/HistorySessionReplay` which calls `GET /api/history/:sessionId`.

### 3.3 Client-Side Call Activation
- `public/voqo-demo-call.js`:
  - Builds a persistent “Call now” bar overlay on demo pages.
  - Registers call context via `POST /api/register-call` (prefers `navigator.sendBeacon`).
  - Dials the demo phone via `tel:` navigation using `phoneNumber` returned by `/api/register-call`.
  - Intercepts existing `tel:` links in generated HTML to register context before dialing.
  - Provides legacy compatibility:
    - `window.registerDemoCall()` polls `GET /api/call-status?agency=...` to jump to results.
    - `window.registerForCall()` triggers dialing.

### 3.4 API Routes (Endpoints)

#### Pipeline
- `POST /api/pipeline/start` (`app/api/pipeline/start/route.ts`)
  - Creates pipeline + activity JSON scaffolding under `data/progress/`.
  - Runs a Claude Agent SDK query (orchestrator prompt).
  - Stores in-memory run handle in global map (`lib/pipeline-registry.ts`) for cancellation.
  - Background loop persists the completed run into history even without SSE clients.
- `GET /api/pipeline/stream?session=...` (`app/api/pipeline/stream/route.ts`)
  - SSE; uses `fs.watch(data/progress)` and debounced refresh.
  - Streams:
    - `todo_update`
    - `main_activity_message` and `subagent_activity_message`
    - `card_update` or `card_remove`
    - terminal `pipeline_complete`
  - Performs best-effort reconciliation of agency completion by checking existence of `public/demo/{agencyId}.html`.
- `GET /api/pipeline/state?session=...` (`app/api/pipeline/state/route.ts`)
  - Snapshot endpoint for reload/rehydration.
  - Normalizes activity messages via `lib/server/activity.ts` for stable IDs/timestamps.
- `POST /api/pipeline/cancel` (`app/api/pipeline/cancel/route.ts`)
  - Interrupts the running query if still present.
  - Writes pipeline state as cancelled, adds cancel activity message, persists history detail.

#### History
- `GET /api/history` (`app/api/history/route.ts`): returns `data/history/sessions.json` (or empty list).
- `GET /api/history/:sessionId` (`app/api/history/[sessionId]/route.ts`)
  - Returns a durable snapshot if already written under `data/history/sessions/:sessionId.json`;
  - Otherwise computes from `data/progress/*` and may persist if terminal.
- `PATCH /api/history/:sessionId` (`app/api/history/[sessionId]/route.ts`): renames a session in the history index; also attempts to update the detail snapshot.

#### Calls / Postcall Monitoring
- `GET /api/calls` (`app/api/calls/route.ts`)
  - Reads latest `data/calls/*.json` (up to 100) and returns up to 50.
  - Side-effect: best-effort kicks postcall + sms processing once (and ensures SMS worker).
- `GET /api/calls/stream` (`app/api/calls/stream/route.ts`)
  - SSE; watches `data/calls/` and emits `calls_update` deltas.
  - Side-effect: also kicks postcall + sms processing.
- `GET /api/calls/:callId` (`app/api/calls/[callId]/route.ts`)
  - Reads `data/calls/{callId}.json` plus `data/progress/activity-postcall-{callId}.json` (if present).
  - Side-effect: kicks postcall + sms processing.
- `GET /api/calls/stream-detail?callId=...` (`app/api/calls/stream-detail/route.ts`)
  - SSE for a single call record and postcall agent activity.
  - Watches `data/calls/` and `data/progress/` for call + activity changes.
  - Side-effect: kicks postcall + sms processing.

#### Demo Call Context + Webhooks
- `POST /api/register-call` (`app/api/register-call/route.ts`)
  - Accepts JSON (supports sendBeacon’s `request.text()` parsing).
  - Stores a new `contextId` entry in `data/context/pending-calls.json`, TTL=5 minutes.
  - Returns enforced demo phone: from `lib/phone.ts` (`+614832945767` / `04832945767`).
- `POST /api/webhook/personalize` (`app/api/webhook/personalize/route.ts`)
  - Reads `data/context/pending-calls.json`.
  - Chooses either:
    - “recent active” context (activated within 5 minutes), else
    - most recent pending (by registeredAt), else
    - any non-expired context, else default agency.
  - Marks a newly-matched pending context as `active`, stores `callerId`, `callSid`, `activatedAt`.
  - Responds with ElevenLabs `conversation_initiation_client_data` containing `dynamic_variables` and optional `conversation_config_override`.
- `POST /api/webhook/call-complete` (`app/api/webhook/call-complete/route.ts`)
  - Parses raw body, attempts to verify signature (but has “skip in dev” and also “allow if missing secret/signature” behavior).
  - Creates a new call record `data/calls/{callId}.json`.
  - Updates matching context to `completed`.
  - Appends entry to per-agency call index (`data/agency-calls/{agencyId}.json`).
  - Enqueues postcall job (`data/jobs/postcall/{callId}.json`), starts workers.

#### Supporting / Legacy / Thin Wrappers
- `GET /api/call-status?agency=...` (`app/api/call-status/route.ts`): scans recent calls for the agency and returns most recent within 10 minutes.
- `GET /api/agency-calls?agency=...` (`app/api/agency-calls/route.ts`): returns per-agency call list from `data/agency-calls/{agencyId}.json`.
- `POST /api/search` (`app/api/search/route.ts`): “legacy search”; invokes `agency-researcher` skill (not present in `.claude/skills/` in this repo).
- `POST /api/generate-demo` (`app/api/generate-demo/route.ts`): “legacy generate demo”; invokes `demo-page-builder` skill (not present in `.claude/skills/` in this repo).

### 3.5 Core Libraries (`lib/*`)
- `lib/types.ts`: shared runtime types + voice agent defaults (including `DEFAULT_VOICE_AGENT_SETTINGS` and `AVAILABLE_VARIABLES`).
- `lib/claude.ts`: wrapper around `@anthropic-ai/claude-agent-sdk` query with:
  - PATH/env normalization for Claude Code CLI
  - optional activity hooks writing to `data/progress/activity-{sessionId}.json`
- `lib/pipeline-registry.ts`: global in-memory registry for active pipeline queries (cancel support).
- `lib/history.ts`: history index + optional durable session detail snapshots.
- `lib/postcall-queue.ts`: file-based postcall job queue + worker with retries + timeout + stale recovery; updates call + agency-calls and enqueues SMS jobs.
- `lib/sms-queue.ts`: durable SMS queue; retries; idempotent job creation; writes SMS status to call record; sends via Twilio.
- `lib/twilio.ts`: Twilio client wrapper; `sendSMS` + `normalizePhoneNumber`.
- `lib/agency-calls.ts`: reads/writes per-agency call index.
- `lib/ids.ts`: `isSafeSessionId()` + `buildActivityId()` helper.
- `lib/phone.ts`: enforces a single demo phone number in both E.164 and display form.
- `lib/server/activity.ts`: stable activity IDs + timestamp normalization.
- `lib/progress-cleanup.ts`: generic stale progress cleanup utilities (not referenced by current pipeline SSE implementation).

### 3.6 UI Components (`components/*`)
Actively used:
- `components/MainAgentWorkspace.tsx`: combined activity/todos layout + calls panel slot.
- `components/AgencyCard.tsx`: agency progress card; expanded subagent activity.
- `components/CallsPanel.tsx`: calls list in workspace.
- `components/CallDetailModal.tsx`: transcript + postcall activity stream modal.
- `components/HistoryList.tsx`, `components/HistoryCard.tsx`, `components/HistorySessionReplay.tsx`: history UI.
- `components/SettingsModal.tsx`: voice agent settings stored in localStorage.
- `components/ActivityMessage.tsx`, `components/StepList.tsx`, `components/ShimmerPreview.tsx`, `components/TabNavigation.tsx`: UI primitives.

Present but currently unused (no imports found in runtime UI):
- `components/AgentActivityPanel.tsx`
- `components/TodoPanel.tsx`
- `components/MockPreview.tsx`

---

## 4) System-by-System Analysis (Behavior, Assumptions, and Failure Surfaces)

### 4.1 Pipeline System (Agency Search → N Subagents → Demo HTML)

**Happy path**
1. `app/page.tsx` sends `POST /api/pipeline/start` with `{ suburb, count }`.
2. `app/api/pipeline/start/route.ts` creates pipeline state + activity file, then runs orchestrator query.
3. Orchestrator:
   - Uses WebSearch to identify agencies,
   - Updates `pipeline-{sessionId}.json` with `agencyIds`,
   - Writes `agency-{agencyId}.json` skeleton files,
   - Spawns N subagents (Task tool) using `.claude/skills/agency-processor/SKILL.md`.
4. Each subagent writes:
   - `data/agencies/{agencyId}.json`,
   - `public/demo/{agencyId}.html`,
   - progress and activity updates in `data/progress/*`.
5. `GET /api/pipeline/stream` streams changes to UI via fs.watch.
6. Completion triggers history persistence:
   - In SSE route (best-effort index entry),
   - In start route background finalizer (index + durable detail snapshot).

**Key assumptions**
- Long-running Claude Agent SDK queries can run in-process after the HTTP response returns.
- `fs.watch` is sufficiently reliable on the deployment environment (single VPS).
- The Next.js runtime is not deployed as a serverless environment (where fs.watch and long-running tasks are fragile).

**Observed risks / edge cases**
- Orchestrator prompt text claims “Tool usage … streamed automatically via hooks” but the pipeline query in `app/api/pipeline/start/route.ts` does not attach hooks; instead it parses tool_use blocks from streamed messages. If message formats differ, main activity can be incomplete or noisy.
- Multiple history persistence code paths exist (SSE + start finalizer + cancel route), increasing risk of inconsistent session data.
- The pipeline SSE endpoint deletes stale files (>24h) on connect (`cleanupStaleFiles()`), which is safe in principle but is a side-effect that can surprise debugging and can delete partially-relevant “replay” data if file mtimes drift.

### 4.2 Demo Page Serving + Call Context Registration

**Happy path**
1. Demo HTML exists at `public/demo/{slug}.html`.
2. User visits `/demo/{slug}` (served by `app/demo/[slug]/page.tsx`).
3. Server reads the HTML file and injects:
   - `window.__VOQO_DEMO_PHONE__` (from `lib/phone.ts`)
   - `window.__VOQO_AGENCY__` (from `data/agencies/{slug}.json` if present)
   - optional `window.__VOQO_SESSION_ID__` (from `?session=...`, sanitized by `isSafeSessionId`)
   - script tag for `/voqo-demo-call.js`
4. `public/voqo-demo-call.js` shows call bar and on click:
   - sends `POST /api/register-call` with agencyData (and optional voice agent settings from localStorage),
   - receives enforced demo number,
   - navigates to `tel:+614832945767`.

**Key assumptions**
- Users always call the single demo number, never the agency’s real number.
- The call activation request reaches the server before the tel: navigation (hence sendBeacon + keepalive).
- `data/context/pending-calls.json` is writable and not concurrently corrupted.

**Observed risks / edge cases**
- `app/api/register-call/route.ts` trusts `timestamp` from client payload when setting `registeredAt`, but `expiresAt` is computed from server “now”. A malicious or buggy client can send an extreme future `timestamp`, causing context matching to prefer that context (sorting by registeredAt) and potentially hijack subsequent calls within the TTL window (no auth).
- `data/context/pending-calls.json` cleanup happens in `/api/register-call` only. If contexts expire and no further register-call happens, the file can retain stale entries indefinitely; `/api/webhook/personalize` does not prune.

### 4.3 ElevenLabs Personalization Webhook

**Happy path**
1. ElevenLabs calls `POST /api/webhook/personalize` with `{ caller_id, call_sid, agent_id, called_number }`.
2. Server loads `data/context/pending-calls.json`.
3. It chooses:
   - the most recent “active” context activated within 5 minutes (retry handling), else
   - the newest “pending” unexpired context (by registeredAt).
4. It marks matched pending context as `active` and stores `callerId`, `callSid`, `activatedAt`.
5. Responds with:
   - dynamic variables: agency_name/location/phone/demo_page_url/context_id
   - optional override prompt/first_message if settings exist.

**Observed risks / edge cases**
- No webhook signature verification exists in `app/api/webhook/personalize/route.ts` despite specs calling out HMAC verification. This endpoint is unauthenticated and can:
  - mark contexts as active,
  - leak agency names/phones and context IDs in its response,
  - be spammed (log amplification).
- Matching strategy is “most recent context wins” unless the context is already active. If multiple people register call contexts close together, the wrong agency can be attached to a call.
- This route logs full headers and full body and enumerates all context keys to console. That is useful for debugging but is high-risk in production logs.

### 4.4 Call Complete Webhook → Call Record → Postcall Queue

**Happy path**
1. ElevenLabs calls `POST /api/webhook/call-complete` with `type: post_call_transcription`.
2. Server verifies signature (in production only) and then:
   - creates `callId` and writes `data/calls/{callId}.json`,
   - matches a context (context_id, callSid, callerId, recent pending),
   - updates `data/context/pending-calls.json`,
   - appends agency call index entry (`data/agency-calls/{agencyId}.json`),
   - enqueues postcall job (`data/jobs/postcall/{callId}.json`),
   - ensures postcall + SMS workers are running.

**Observed risks / edge cases**
- Signature verification behavior is not “fail closed”:
  - dev mode skips verification (expected),
  - but production also allows missing secret or missing signature (“skipping verification”) which defeats the purpose of webhook security.
- The signature algorithm in code is “timestamp.payload” while the specs describe a simpler payload HMAC; mismatches here can cause silent acceptance/rejection inconsistencies.
- `status` recorded in the call file is taken from `data.status` (string), but downstream logic relies mostly on `pageStatus` and presence of HTML/pageUrl; no clear handling for `failed/dropped` calls beyond storing the status string.

### 4.5 Postcall Worker (Job Queue Semantics)

**Happy path**
1. `lib/postcall-queue.ts` picks up `{callId}.json` jobs under `data/jobs/postcall/`.
2. It atomically renames job to `.processing` (lock).
3. Runs `invokeClaudeCode()` with `activitySessionId = postcall-{callId}` so that:
   - tool usage activity is written to `data/progress/activity-postcall-{callId}.json`.
4. Expects `public/call/{callId}.html` to exist, then:
   - sets call record `pageStatus=completed`, `pageUrl=/call/{callId}`, `generatedAt=...`,
   - enqueues SMS job,
   - updates agency-calls record with pageUrl/status.

**Observed risks / edge cases**
- `PUBLIC_CALL_DIR` (`public/call`) is not created by the worker before checking/writing; if the directory does not exist on a fresh deploy, the postcall skill may fail to write HTML and the worker will loop retries.
- `runWithTimeout()` rejects after 5 minutes, but does not cancel the underlying Claude Code invocation. The worker retries, but it also checks `isPostcallOutputReady()` to finalize if the HTML appears later (good mitigation).
- Worker lifecycle is per-process with `setInterval`. In dev hot-reload or multi-process deployments, multiple intervals can be created, increasing load (locks mitigate double-processing but not CPU churn).

### 4.6 SMS Worker

**Happy path**
1. `enqueueSmsJob(callId)` creates `data/jobs/sms/{callId}.json` using `flag: 'wx'` for idempotency.
2. `processSmsJobsOnce()` locks by renaming to `.processing`, reads call record until:
   - `pageStatus === 'completed'`,
   - `pageUrl` exists,
   - `callerPhone` exists.
3. Sends SMS via Twilio, then writes `call.sms.status="sent"` and `smsSentAt`.

**Observed risks / edge cases**
- `lib/twilio.ts` constructs a Twilio client at module import time using `process.env.TWILIO_*` with non-null assertions. Missing env vars can break the server process (or cause confusing runtime failures).
- `buildBaseUrl()` uses `NEXT_PUBLIC_APP_URL` or defaults to `http://localhost:3000`. If production env is misconfigured, SMS links can be wrong.

---

## 5) Edge Cases & Failure Points (Exhaustive Checklist)

This section lists concrete ways the current implementation can fail or behave unexpectedly.

### 5.1 Security & Abuse
- Unauthenticated endpoints everywhere (explicitly “demo”), but in practice:
  - `/api/webhook/personalize` has no signature verification and returns agency data to any caller.
  - `/api/webhook/call-complete` verification is not fail-closed (production allows missing secret/signature).
- **Remote-triggered agent execution with broad filesystem permissions**:
  - `POST /api/pipeline/start` runs `@anthropic-ai/claude-agent-sdk` with `permissionMode: 'bypassPermissions'` and tools that include filesystem write/edit (and the orchestrator can spawn subagents that write files).
  - Because the endpoint is unauthenticated, anyone who can hit it can trigger model-driven file operations and web access. Even if prompts attempt to constrain behavior, this is a large attack surface for prompt-injection and “agent jailbreak” style failures (exfiltration, destructive writes, resource exhaustion).
- Log leakage:
  - `/api/webhook/personalize` logs all headers and full request body and enumerates all contexts.
  - `/api/webhook/call-complete` logs full request body (includes transcript, numbers).
- **Path traversal via unsanitized query parameters returning JSON**:
  - `/api/agency-calls?agency=...` passes `agencyId` directly into `path.join(..., \`\${agencyId}.json\`)` inside `lib/agency-calls.ts` and returns parsed JSON. A caller can traverse into other JSON files (example: `agency=../history/sessions` would read `data/history/sessions.json`).
  - `/api/calls/stream-detail?callId=...` uses the query `callId` directly in `path.join(CALLS_DIR, \`\${callId}.json\`)` and will return parsed JSON if it exists. Query parameters can contain `/` and `..`, enabling traversal to other JSON files on disk.
  - These are “read” vulnerabilities; they won’t exfiltrate non-JSON, but many files on disk *are* JSON.
- Script-injection edge in demo wrapper:
  - `app/demo/[slug]/page.tsx` injects `window.__VOQO_AGENCY__=...` inside an inline `<script>` using `JSON.stringify(...)`. If any injected string values contain `</script>` (possible from model-generated agency JSON), this can break out of the script tag and cause unintended HTML/script injection.

### 5.2 Concurrency & File Corruption
- Multiple concurrent writes to:
  - `data/context/pending-calls.json` (`/api/register-call`, `/api/webhook/personalize`, `/api/webhook/call-complete`)
  - `data/agency-calls/{agencyId}.json` (`call-complete`, postcall worker)
  - `data/calls/{callId}.json` (call-complete, postcall worker, sms worker)
- Current write pattern is “read whole JSON → mutate → write whole JSON” without file locks; under concurrent requests, last write wins and intermediate updates can be lost.
- JSON corruption risk on partial writes or process termination mid-write (rare but possible).
- Webhook idempotency gaps:
  - `app/api/webhook/call-complete/route.ts` generates a fresh `callId` for each received event. If ElevenLabs retries the same webhook (or a caller replays it), the system can create multiple call records and enqueue multiple postcall jobs for the same underlying conversation.

### 5.3 Worker Lifecycle, Multi-Process, and Restart Semantics
- Workers are in-process `setInterval()` loops guarded by module-scoped `workerStarted` booleans:
  - works in single long-lived process,
  - can duplicate in dev hot reload or if running multiple Next.js processes.
- “Kick the worker” behavior exists in multiple request handlers (calls endpoints) to keep the system progressing even if intervals aren’t running. This increases coupling between “read endpoints” and “background processing.”

### 5.4 File/Directory Existence and Fresh Deploys
- `public/call/` directory is not guaranteed to exist before postcall generation. If missing, generation fails until created.
- Deployment docs recommend rsync excluding `data/` and generated HTML dirs; that implies production deploys must preserve these folders, but fresh deploys need explicit bootstrapping (mkdir) beyond `.gitkeep` tracked in repo.

### 5.5 Data Model Drift vs Specs
Notable mismatches between specs and code:
- Webhook signature verification:
  - `specs/SPEC-DATA-API.md` describes `elevenlabs-signature` verification (payload HMAC).
  - `app/api/webhook/call-complete/route.ts` uses “timestamp.payload” signing and allows missing secret/signature in prod.
  - `app/api/webhook/personalize/route.ts` does no verification.
- Postcall worker config differs from spec values (timeouts/retry windows).
- Retention policies (e.g., “30 days for calls”) are described in specs but not implemented in code.

### 5.6 SSE + fs.watch Reliability
- `fs.watch` can drop events under load; the implementation mitigates with:
  - initial snapshot refresh,
  - debounced refreshAll when filename is missing,
  - periodic heartbeat.
- Still, long-lived SSE connections + file watchers can become resource-heavy with many clients (each client creates watchers).

### 5.7 UI/UX Edge Cases
- Default voice agent prompt contains `{{caller_name}}` which is **not** included in `AVAILABLE_VARIABLES`; Settings modal will warn about unknown variables even for defaults. (Whether `{{caller_name}}` is intended as a literal placeholder for the LLM or a true ElevenLabs substitution variable is unclear, but the UI treats it as “unknown”.)
- `/call/[id]/page.tsx` reads `public/call/{id}.html`. If users copy/paste URLs ending in `.html`, this route will attempt to read `{id}.html.html` and fail. (Specs and other code paths appear to intend `/call/{callId}` without `.html`.)

---

## 6) Where Systems Can Fail (Practical Failure Modes)

### Pipeline
- Claude orchestration fails (auth, model name, CLI missing, PATH issues) → pipeline stalls in `searching/processing`.
- Orchestrator does not write progress files as expected → UI sees no cards.
- Subagent writes HTML but progress file not updated → SSE reconciliation tries to fix, but only for demo HTML existence.
- `fs.watch` doesn’t emit reliably → UI lags or misses updates; state endpoint rehydrate can recover partially.

### Demo Call / Context
- sendBeacon blocked / not supported → context registration may not arrive before tel: navigation.
- Multiple pending contexts within TTL → wrong agency matched (race / “most recent wins”).
- `pending-calls.json` write collision → lost context entries; personalization falls back to default.

### Webhooks
- Signature mismatch (if enforced) → call-complete rejected.
- Missing secret/signature allowed in prod → spoofed call-complete requests create fake calls and enqueue jobs (spam/cost).
- Personalize endpoint spam → log amplification + context activation tampering.

### Postcall
- `public/call/` missing → HTML can’t be written; worker retries until max attempts then marks failed.
- Claude run times out (but continues) → worker retries; can lead to repeated Claude invocations (cost).
- Skill fails to update call JSON → call still marked completed by worker, but “extractedData/listingsShown” may be missing.

### SMS
- Missing Twilio env vars → SMS worker fails; may crash at import time or fail at send time.
- Caller phone missing/unparseable → SMS job retries until max attempts then fails.
- `NEXT_PUBLIC_APP_URL` wrong → SMS links point to localhost or wrong domain.

---

## 7) Simplification Recommendations (High-Value, Low-Conceptual-Cost)

These are recommendations only (no code changes performed).

### 7.1 Remove or quarantine legacy/unused surfaces
- Unused UI components: `components/AgentActivityPanel.tsx`, `components/TodoPanel.tsx`, `components/MockPreview.tsx`.
- Legacy API routes that reference missing skills:
  - `app/api/search/route.ts` (agency-researcher skill not present)
  - `app/api/generate-demo/route.ts` (demo-page-builder skill not present)
- `proxy.ts` appears to be dead code (not a Next middleware file and not imported). Either wire it correctly as middleware or remove it to reduce confusion.

### 7.2 Centralize input validation + path safety
- Introduce a single “safe file key” validator for:
  - agency IDs (query params)
  - call IDs (query params)
  - session IDs (already present: `isSafeSessionId`)
- Route handlers repeatedly implement `safeJsonParse`, ISO parsing, etc.; consolidate to one utility module to reduce drift.

### 7.3 Reduce duplicated “background processing triggers”
- Currently, multiple read endpoints call `processPostcallJobsOnce()` / `processSmsJobsOnce()` and/or ensure workers.
- Consider a single strategy:
  - either a dedicated worker loop only,
  - or “opportunistic processing” only,
  - but not both everywhere.

### 7.4 Make directory creation explicit and consistent
- Ensure required directories exist at startup or within each worker:
  - `public/call/` in particular.
- Consolidate dir bootstrap into one function to prevent subtle environment differences.

### 7.5 Reconcile specs vs implementation (reduce “two sources of truth”)
- Align webhook signature verification behavior (fail-closed in prod) with documented spec.
- Align postcall worker timeouts/retry windows with `specs/SPEC-DATA-API.md` or update the spec to reflect code reality.
- Align call URL expectations (`/call/{id}` vs `.html` suffix) consistently.

---

## 8) Better / Simpler Approaches (If You Want to Reduce Fragility)

### Option 1: Keep file storage, but formalize it
- Create a tiny “storage layer” module:
  - atomic write (write temp + rename),
  - per-file locks (advisory, even in-process),
  - schema validation (runtime) for public-facing endpoints.
- This preserves the “Claude-friendly filesystem” approach but removes the most common corruption/race issues.

### Option 2: Replace ad-hoc JSON indices with SQLite (still single VPS)
- Replace:
  - `pending-calls.json`,
  - per-agency call index files,
  - history index,
  - maybe calls list scanning,
  with a single SQLite DB (one file).
- Benefits:
  - atomic updates, concurrency safety, simple queries, easier retention cleanup.
- Tradeoff:
  - Claude Code can still write HTML, but you’d likely want the app (not the model) to write DB updates.

### Option 3: Separate worker process (still on the same VPS)
- Run postcall + sms workers as a separate Node/PM2 process rather than intervals inside request handlers.
- Benefits:
  - stable execution, fewer coupling points, clearer operational model.
- Tradeoff:
  - slightly more deployment complexity (still small on a single VPS).

---

## 9) Appendix — Key Inconsistencies to Track

- Webhook security:
  - `app/api/webhook/personalize/route.ts` has no signature verification.
  - `app/api/webhook/call-complete/route.ts` does not fail closed when secret/signature missing.
- Path safety:
  - `/api/agency-calls` and `/api/calls/stream-detail` accept unsanitized identifiers that become file paths.
- Voice agent settings:
  - Default prompt includes `{{caller_name}}`, but Settings UI warns because it’s not in `AVAILABLE_VARIABLES`.
- `proxy.ts` appears unused; clarify whether it’s meant to be Next middleware.
