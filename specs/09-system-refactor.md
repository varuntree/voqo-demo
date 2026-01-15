# 09 - System Refactor & Hardening Specification

## Purpose
This document defines a clean, modular, and robust architecture for VoqoLeadEngine without changing existing functionality. It standardizes data flow, strengthens call-to-agency matching, ensures Claude Code tasks reliably complete, and makes post-call outputs discoverable from demo pages. It assumes all external services are configured correctly and focuses on maintainability and predictable behavior.

## Scope
- Preserve all current features and UI flows.
- Improve reliability, observability, and modularity.
- No VPS deployment scope (handled later).
- No E2E browser automation testing in this phase.

## High-Level Goals
1. **Deterministic call-to-agency matching** during personalization and call-complete processing.
2. **Reliable Claude Code execution** for post-call page generation.
3. **Persistent, append-only call history per agency** visible on demo pages.
4. **Consistent data schemas** and minimal coupling between steps.
5. **Clear logging and failure visibility** without blocking external services.

---

## System Breakdown

### System A: Agency Search & Data
**Purpose:** Discover agencies and save structured results.

**Inputs:** `suburb` (string).

**Outputs:** `/data/agencies/<suburb-slug>.json`.

**Contract:**
- Results must include `agencies[]` with `id`, `name`, `branding`, `metrics`, `address`, and `phone` where available.
- Must include `searchedAt` and `totalFound`.

---

### System B: Demo Page Generation
**Purpose:** Generate branded HTML for a selected agency.

**Inputs:** `agencyId` (string).

**Outputs:** `/public/demo/<agencyId>.html` and any assets referenced by the HTML.

**Contract:**
- HTML uses Tailwind via CDN.
- Contains “Call Demo” button that calls `/api/register-call`.
- Embeds `agencyId` and `agencyName` into a script for later use.
- Adds a “Recent Calls” section that loads call history from `/api/agency-calls?agency=<id>`.

---

### System C: Call Context Registration
**Purpose:** Create an ephemeral context mapping before a phone call.

**Inputs:** `agencyData`, `timestamp`.

**Outputs:** `contextId` (string), stored in `/data/context/pending-calls.json`.

**Contract:**
- Context status lifecycle: `pending → active → completed`.
- Context TTL: 5 minutes (configurable).
- `contextId` is the canonical identifier for the eventual call.

---

### System D: Personalization Webhook
**Purpose:** Inject agency-specific variables before call begins.

**Inputs:** `caller_id`, `call_sid`, `agent_id`, `called_number` (from ElevenLabs).

**Outputs:** `dynamic_variables` to ElevenLabs.

**Required Behavior:**
- Match the most recent valid `pending` context.
- Mark it `active`, store `callerId`, `callSid`, `activatedAt`.
- Return `context_id` in dynamic variables.

**Key Fields Returned:**
- `agency_name`, `agency_location`, `agency_phone`, `demo_page_url`, `context_id`.

---

### System E: Call-Complete Webhook
**Purpose:** Store transcript, enrich call data, and generate post-call page.

**Inputs:** `post_call_transcription` payload.

**Outputs:**
- `/data/calls/<callId>.json`
- `/public/call/<callId>.html`
- `/data/agency-calls/<agencyId>.json` (append call history)

**Required Behavior:**
1. **Resolve context:**
   - Primary: `context_id` from `conversation_initiation_client_data.dynamic_variables.context_id`.
   - Secondary: match on `callSid`, then `callerId`.
   - Tertiary: match `demo_page_url` or agency name in dynamic variables.
2. **Persist call data** with `pageStatus: generating`.
3. **Enqueue Claude Code job** for post-call page generation (do not rely on fire-and-forget in request lifecycle).
4. **Update call record** to `pageStatus: completed` and set `pageUrl` once HTML is generated.
5. **Append callId to agency call history** for demo page display.

---

## Data Schemas

### 1) Agency Search Result
```json
{
  "suburb": "Surry Hills",
  "searchedAt": "2026-01-15T10:30:00Z",
  "totalFound": 7,
  "agencies": [
    {
      "id": "ray-white-surry-hills",
      "name": "Ray White Surry Hills",
      "address": "123 Crown St, Surry Hills",
      "phone": "+61 2 9000 0000",
      "branding": {
        "logoUrl": "https://...",
        "primaryColor": "#FFD200"
      },
      "metrics": {
        "listingCount": 42,
        "teamSize": 12,
        "painScore": 78
      }
    }
  ]
}
```

### 2) Call Context
```json
{
  "contextId": "ctx-<timestamp>-<rand>",
  "agencyId": "ray-white-surry-hills",
  "agencyName": "Ray White Surry Hills",
  "agencyData": { "..." },
  "registeredAt": 1736900000000,
  "expiresAt": 1736900300000,
  "status": "pending",
  "callerId": null,
  "callSid": null,
  "activatedAt": null,
  "callId": null,
  "completedAt": null
}
```

### 3) Call Data
```json
{
  "callId": "call-<timestamp>-<rand>",
  "contextId": "ctx-...",
  "conversationId": "conv_...",
  "timestamp": "2026-01-15T15:46:27.486Z",
  "duration": 60,
  "callerPhone": "+61400000000",
  "status": "completed",
  "agencyId": "ray-white-surry-hills",
  "agencyName": "Ray White Surry Hills",
  "agencyData": { "..." },
  "extractedData": {
    "callerName": "Test User",
    "intent": "buy",
    "location": "Surry Hills",
    "budget": "$1M",
    "propertyType": "apartment",
    "bedrooms": "2",
    "specialRequirements": "..."
  },
  "transcript": "Agent: ...\n\nCaller: ...",
  "transcriptRaw": ["..."],
  "summary": "Buyer inquiry in Surry Hills",
  "pageStatus": "completed",
  "pageUrl": "/call/<callId>",
  "generatedAt": "2026-01-15T15:48:00Z"
}
```

### 4) Agency Call History
```json
{
  "agencyId": "ray-white-surry-hills",
  "calls": [
    {
      "callId": "call-...",
      "createdAt": "2026-01-15T15:46:27.486Z",
      "pageUrl": "/call/call-...",
      "callerName": "Test User",
      "summary": "Buyer inquiry in Surry Hills"
    }
  ]
}
```

---

## API Contracts

### POST /api/search
**Request:** `{ suburb: string }`
**Response:** `{ success, suburb, searchedAt, totalFound, agencies[] }`

### POST /api/generate-demo
**Request:** `{ agencyId: string }`
**Response:** `{ success, url }`

### POST /api/register-call
**Request:** `{ agencyData, timestamp }`
**Response:** `{ success, contextId, expiresAt, phoneNumber }`

### GET /api/call-status?agency=<id>
**Response:** `{ hasRecentCall, callId, status, pageUrl, callerName, generatedAt }`

### GET /api/agency-calls?agency=<id>
**Response:** `{ agencyId, calls[] }`

### POST /api/webhook/personalize
**Response:**
```json
{
  "type": "conversation_initiation_client_data",
  "dynamic_variables": {
    "agency_name": "...",
    "agency_location": "...",
    "agency_phone": "...",
    "demo_page_url": "/demo/<agencyId>",
    "context_id": "ctx-..."
  }
}
```

### POST /api/webhook/call-complete
**Response:** `{ success, callId, pageGenerationStarted }`

---

## Claude Code Execution Strategy

### Problem
Fire-and-forget execution inside a request can be dropped when the request ends or if the runtime freezes background tasks. This causes post-call page generation to not run reliably.

### Required Fix
Introduce a **durable job queue** and **worker-style execution**:

**Queue:**
- Directory-based queue under `/data/jobs/postcall/`.
- Each job is a JSON file `{ callId, prompt, createdAt, attempts }`.

**Worker:**
- A lightweight worker that processes jobs:
  - In dev: triggered by a short interval in the Next.js server (e.g., `setInterval`).
  - In prod: external worker process or cron using `node scripts/process-jobs.ts`.
- Uses `invokeClaudeCode` with retries.
- On success, updates call record and deletes job file.

**Outcome:**
- Post-call generation is resilient, repeatable, and observable.

---

## Demo Page Call History

**Requirement:** Demo page shows all completed call pages for the agency, not just the latest.

**Mechanism:**
- `call-complete` appends entry to `/data/agency-calls/<agencyId>.json`.
- Demo page JS fetches `/api/agency-calls?agency=<id>` and renders a list:
  - Caller name (if present)
  - Summary
  - Link to `/call/<callId>`

---

## Logging & Observability

**Goals:** trace each call end-to-end.

**Required IDs:**
- `contextId`
- `callId`
- `conversationId`

**Log Format:**
```
[PERSONALIZE] ctx=ctx-... status=active agency=... caller=...
[CALL-COMPLETE] ctx=ctx-... call=call-... agency=...
[PAGE-GEN] call=call-... status=started|completed|failed
```

**Error Persistence:**
- Any Claude Code failure should append to `/data/errors/postcall-errors.json`.

---

## Security & Webhook Verification

- Keep HMAC verification in production.
- If `ELEVENLABS_WEBHOOK_SECRET` is missing, log a warning but do not break calls in development.
- For production, require valid signature; otherwise return 401.

---

## Performance

- Cache agency search results for 24 hours.
- Use `readdir` and JSON parse only for required files.
- Avoid scanning all agencies when `agencyId` can map directly to a file or cached index.

---

## Acceptance Criteria

1. **Reliable context matching**: calls always resolve to the correct agency, even with retries.
2. **Post-call generation always runs**: HTML appears within 2 minutes after webhook.
3. **Demo page lists all calls**: multiple call pages are visible under the agency demo page.
4. **Clean logs**: each call has traceable logs with contextId + callId.
5. **No feature regression**: existing flows work unchanged.
