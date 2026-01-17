# VoqoLeadEngine — Consolidated Issues & Resolutions (all.md)

Date: 2026-01-17  
Repo: `voqo-demo`  
Sources: `report1.md` … `report10.md`

This document consolidates the issues called out across the 10 reports and tracks the fixes applied in this repo.

---

## 1) Security & Abuse Prevention

### 1.1 Webhook verification is missing/inconsistent
- **Issue:** `/api/webhook/personalize` has no signature verification; `/api/webhook/call-complete` verification is permissive and can allow requests in production when secret/signature are missing.
- **Impact:** Spoofed webhooks can create calls, enqueue Claude jobs, and trigger SMS attempts (abuse/cost + data integrity).
- **Resolution:** Centralize ElevenLabs signature verification and enforce in production; accept common header variants.
- **Status:** Resolved (`lib/elevenlabs-webhook.ts`, `app/api/webhook/*`)

### 1.2 Path traversal risk for query-derived file paths
- **Issue:** Query parameters (`callId`, `agencyId`) are used to build filesystem paths without strict validation.
- **Impact:** Potential reads/writes outside intended `data/*` directories (confidentiality + integrity risk).
- **Resolution:** Add strict “safe id” validators and reject unsafe input at the boundary.
- **Status:** Resolved for all query-derived IDs (`lib/ids.ts`, `app/api/*`)

### 1.3 Serving LLM-generated HTML under origin
- **Issue:** `/demo/[slug]` and `/call/[id]` render generated HTML via `dangerouslySetInnerHTML`.
- **Impact:** If the HTML contains scripts, it executes on the site origin (intentional for demo; high trust boundary).
- **Resolution:** Documented risk retained (demo constraint). Mitigate operationally via preventing `.html` bypass, caching controls, and stricter generation prompts.
- **Status:** Deferred (by design)

---

## 2) Correctness (Voice Context Matching, Idempotency)

### 2.1 “Most recent pending wins” can mis-associate calls
- **Issue:** Personalization chooses the most recent pending/active context; under concurrency it can map the wrong agency.
- **Impact:** Wrong agency name/prompt during the demo call.
- **Resolution:** Keep best-effort heuristic (demo constraint) but reduce corruption via atomic/locked context writes; prefer stable identifiers when present.
- **Status:** Partially resolved (locked updates + improved active matching by `call_sid`/`caller_id`)

### 2.2 Call-complete retries create duplicate call records/jobs
- **Issue:** `call-complete` always generates a fresh `callId`; webhook retries can produce duplicates.
- **Impact:** Duplicate calls, duplicate postcall pages, duplicate SMS attempts (depending on gating).
- **Resolution:** Add idempotency keyed by `conversation_id` to reuse the same `callId`.
- **Status:** Resolved (`lib/call-conversation-index.ts`, `app/api/webhook/call-complete/route.ts`)

---

## 3) Reliability (Filesystem Concurrency, Atomicity)

### 3.1 Shared JSON blobs updated without locking
- **Issue:** Hot files (`data/context/pending-calls.json`, `data/history/sessions.json`, `data/agency-calls/*.json`) are updated via read-modify-write without locks or atomic writes.
- **Impact:** Lost updates, partial JSON, downstream parse failures, wrong context.
- **Resolution:** Introduce atomic JSON writes + lightweight file locks for shared files; use consistently.
- **Status:** Resolved for hot-path files (new `lib/fs-json.ts` helpers + adoption in `register-call`, webhooks, history, agency calls)

### 3.2 Non-atomic call JSON updates can race between workers
- **Issue:** Postcall and SMS workers both read/modify/write `data/calls/{callId}.json`.
- **Impact:** Lost fields (e.g., SMS status overwriting postcall extraction updates).
- **Resolution:** Atomic writes + per-call locks for call JSON updates.
- **Status:** Resolved (per-call locked updates in `lib/postcall-queue.ts` + `lib/sms-queue.ts`)

---

## 4) Runtime Stability (Env Vars, Workers)

### 4.1 Twilio client created at import time
- **Issue:** `lib/twilio.ts` initializes Twilio using non-null env assertions at module import.
- **Impact:** Missing env vars can crash unrelated endpoints that import SMS code.
- **Resolution:** Lazy-initialize Twilio client; treat missing env as a handled runtime error (SMS disabled).
- **Status:** Resolved (`lib/twilio.ts`)

### 4.2 Durable queues are not idempotent on enqueue
- **Issue:** Postcall enqueue overwrites jobs; call-complete retries can “reset attempts” or cause churn.
- **Impact:** Unpredictable retries and wasted work.
- **Resolution:** Make enqueue operations idempotent (`writeFile` with `wx`) and safe under duplicates.
- **Status:** Resolved (`lib/postcall-queue.ts`)

---

## 5) DX / Ops (Logging, Caching, Middleware)

### 5.1 Webhook logging is too verbose and includes PII
- **Issue:** Webhook handlers log full request bodies and headers (transcripts, phone numbers).
- **Impact:** Privacy risk + log spam + disk usage.
- **Resolution:** Gate verbose webhook logs behind an env flag; log only minimal identifiers by default.
- **Status:** Resolved (set `DEBUG_WEBHOOKS=1` to enable verbose logs)

### 5.2 Demo/call pages can be served stale
- **Issue:** File-backed pages do not explicitly opt out of caching.
- **Impact:** Recently-generated HTML may not appear immediately.
- **Resolution:** Force dynamic rendering/no revalidate for these routes.
- **Status:** Resolved (`app/demo/[slug]/page.tsx`, `app/call/[id]/page.tsx`)

### 5.3 `.html` direct access can bypass injection
- **Issue:** Without active middleware, `public/demo/*.html` can be served directly.
- **Impact:** Call bar injection is bypassed; context isn’t registered.
- **Resolution:** Add real Next.js `middleware.ts` to redirect `/demo/*.html` and `/call/*.html` → canonical routes.
- **Status:** Resolved via `proxy.ts` (Next.js 16 “Proxy” entry)

---

## 6) Cleanup & Simplification

### 6.1 Unused modules increase maintenance surface
- **Issue:** Several components/libs appear unused (`AgentActivityPanel`, `TodoPanel`, `MockPreview`, `lib/progress-cleanup.ts`, and `proxy.ts` as middleware helper).
- **Impact:** Cognitive load and drift.
- **Resolution:** Remove unused files (or wire them correctly if intended).
- **Status:** Resolved (removed unused components/libs; `proxy.ts` retained + active)

### 6.2 Legacy endpoints likely unused by current UI
- **Issue:** `/api/search` and `/api/generate-demo` may reference skills not present in-repo.
- **Impact:** Confusing surface area and potential runtime failures if hit.
- **Resolution:** Document as legacy and optionally restrict/remove (keep behavior stable unless explicitly requested).
- **Status:** Deferred (to avoid breaking unknown usage)

---

## 7) Validation Checklist

When all “Pending” items above are resolved:
- `npm run build`
- Run server and validate:
  - `curl localhost:3000/api/register-call` (expected 405/400 depending on method; use POST in tests)
  - `curl localhost:3000/api/webhook/personalize` (POST; expects auth/signature behavior)
