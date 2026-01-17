# Implementation Plan: Pipeline Persistence + Rich History UI

## What & Why
The pipeline runs server-side, but the frontend can lose in-progress state on browser reload because the active `sessionId` and UI state are client-only. History was also limited to a lightweight index and did not let users replay a full “run” (main-agent activity + agency cards + per-card subagent activity).

This plan delivers:
1) **Reload-safe pipeline rehydration** (resume UI mid-run).
2) **Durable History session replay** (a full run view that matches the end-of-generation screen).

## Key Decision
Use **ephemeral progress files** in `data/progress/*` for live streaming + **durable session snapshots** in `data/history/sessions/{sessionId}.json` for History replay, and persist history updates **from the background pipeline runner** (not only from SSE).

---

## IMPLEMENTATION STEPS

### Step 1: Durable session detail storage
**Status**: [✓] Complete

**Actions**:
- Add a durable “session detail” JSON format that includes pipeline + agencies + activity (main + per-agency).
- Implement `readSessionDetail` / `writeSessionDetail` helpers to store to `data/history/sessions/{sessionId}.json`.

**Verifiable Outcome**:
- [✓] A completed session can be reconstructed without relying on SSE clients.

---

### Step 2: Save history without SSE
**Status**: [✓] Complete

**Actions**:
- Persist History index + session detail snapshot from the background pipeline runner (`/api/pipeline/start`) even if no SSE client connects.
- Persist snapshot on `/api/pipeline/cancel`.

**Verifiable Outcome**:
- [✓] A run appears in History even if the browser is closed mid-run.

---

### Step 3: Pipeline snapshot API for reload rehydration
**Status**: [✓] Complete

**Actions**:
- Implement `GET /api/pipeline/state?session=...` to return a single “rehydration snapshot”:
  - `pipeline`, `agencies`, `mainActivity`, `subagentActivity`.

**Verifiable Outcome**:
- [✓] Frontend can reconstruct UI state from a single API call.

---

### Step 4: Frontend reload rehydration via localStorage
**Status**: [✓] Complete

**Actions**:
- Persist active `sessionId` to `localStorage` while pipeline is running.
- On page load, if an active session exists, fetch `/api/pipeline/state` and rehydrate UI.
- Add message dedupe (by id + content key) to prevent repeated SSE events after reconnect.

**Verifiable Outcome**:
- [✓] Mid-run reload restores cards/todos/status and the pipeline continues.

---

### Step 5: History “View run” + session replay page
**Status**: [✓] Complete

**Actions**:
- Add `app/history/[sessionId]/page.tsx` and replay UI that renders:
  - main activity panel
  - agency grid
  - per-agency subagent activity
- Add “View run” link from History list items.

**Verifiable Outcome**:
- [✓] Clicking a History entry replays the full run.

---

### Step 6: Build + E2E validation (minimal count=2)
**Status**: [✓] Complete

**Actions**:
- Run `npm run build`.
- Run minimal E2E smoke: one mid-run reload rehydrate + one History replay.

**Verifiable Outcome**:
- [✓] Build passes; E2E passes with evidence screenshots.

---

### Step 7: Commit + deploy to VPS
**Status**: [✓] Complete

**Actions**:
- Commit to `main`, push to `origin/main`.
- Deploy to VPS and restart the app process.

**Verifiable Outcome**:
- [✓] Remote app serves the updated UI and APIs.

---

### Step 8: Improve mid-run reload (show activity immediately)
**Status**: [✓] Complete

**Actions**:
- Rehydrate main + per-agency activity streams from `/api/pipeline/state` even while `status` is `searching` / `processing`.
- Ensure activity message normalization matches SSE (stable ids) so reconnect does not duplicate.
- Seed dedupe caches from the snapshot so SSE replay does not push older messages into the visible window.

**Verifiable Outcome**:
- [✓] Reload mid-run shows activity instantly and does not duplicate once SSE attaches.

---

## E2E TESTING INSTRUCTIONS (Minimal)

### Test 1: Mid-run reload persistence
**Expected Results**:
- [✓] Refresh during run preserves cards/todos and keeps progressing.

### Test 2: History replay
**Expected Results**:
- [✓] History list shows completed run; “View run” replays full activity + cards.

### Test 3: Mid-run reload shows activity immediately
**Expected Results**:
- [✓] After refresh, main activity + subagent activity render immediately (no blank panel) and do not duplicate after SSE reconnects.
