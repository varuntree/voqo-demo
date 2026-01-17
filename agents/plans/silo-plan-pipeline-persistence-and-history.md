# Implementation Plan: Pipeline Persistence + Rich History UI

## What & Why
The pipeline runs server-side, but the frontend can lose in-progress state on browser reload because the active `sessionId` and UI state are client-only. History is also limited to a lightweight index and does not let users replay a full “run” (main-agent activity + agency cards + subagent activity).

This implementation adds:
1) **Reload-safe pipeline rehydration** (resume the exact UI state mid-run).
2) **Durable History session replay** (a full run view that matches the end-of-generation screen).

## Key Decision
Use **ephemeral progress files** in `data/progress/*` for live streaming + **durable session snapshots** in `data/history/sessions/{sessionId}.json` for History replay, and persist history updates **from the background pipeline runner** (not only from SSE).

---

## IMPLEMENTATION STEPS

### Step 1: Durable session detail storage
**Status**: [✓] Complete

### Step 2: Save history without SSE
**Status**: [✓] Complete

### Step 3: Pipeline snapshot API for reload rehydration
**Status**: [✓] Complete

### Step 4: Frontend reload rehydration via localStorage
**Status**: [✓] Complete

### Step 5: History “View run” + session replay page
**Status**: [✓] Complete

### Step 6: Build + E2E validation (minimal count=2)
**Status**: [✓] Complete

### Step 7: Commit + deploy to VPS
**Status**: [✓] Complete
