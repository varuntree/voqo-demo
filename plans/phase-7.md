# Phase 7: Integration Testing (Local Only)

## What & Why
Validate the full system flow locally without browser automation or external calls. This phase confirms that the API routes, file storage, and Claude Code-triggered generation work together and produce the expected artifacts.

## Prerequisites
- Phases 1–6 complete
- `.env.local` populated with real values
- Dev server running (`npm run dev`)

## Execution Context
| Action Type | How to Execute |
|-------------|----------------|
| Local code | Write/Edit tools (no code changes expected in this phase) |
| Local testing | Terminal commands (`curl`, `ls`, `cat`, `jq`) |
| Chrome | Not used (per request: no Playwright/visual browser testing) |
| Verification | `npm run build`, file checks under `/data` and `/public` |

---

## IMPLEMENTATION STEPS

### Step 7.1: Test agency search flow (API)
**Why**: Validate the agency-researcher skill is invoked and results are persisted.

**Actions**:
- POST to `/api/search` with a suburb (example: "Surry Hills"):
  ```bash
  curl -s -X POST http://localhost:3000/api/search \
    -H "Content-Type: application/json" \
    -d '{"suburb":"Surry Hills"}' | jq
  ```
- Verify `/data/agencies/surry-hills.json` exists and has an agency array.

**Verify**:
- [ ] API returns a list of agencies with pain scores
- [ ] `/data/agencies/surry-hills.json` created

**Status**: [ ] Pending

---

### Step 7.2: Test demo page generation (API)
**Why**: Confirm demo-page-builder generates branded HTML for an agency.

**Actions**:
- Extract an `agencyId` from `/data/agencies/surry-hills.json`:
  ```bash
  cat data/agencies/surry-hills.json | jq -r '.[0].id'
  ```
- POST to `/api/generate-demo`:
  ```bash
  curl -s -X POST http://localhost:3000/api/generate-demo \
    -H "Content-Type: application/json" \
    -d '{"agencyId":"REPLACE_WITH_ID"}' | jq
  ```
- Verify `/public/demo/REPLACE_WITH_ID.html` exists.

**Verify**:
- [ ] API returns a demo URL
- [ ] Demo HTML file created in `/public/demo/`

**Status**: [ ] Pending

---

### Step 7.3: Test call context registration (API)
**Why**: Ensure call context is stored for personalization.

**Actions**:
- POST to `/api/register-call` with agency data:
  ```bash
  curl -s -X POST http://localhost:3000/api/register-call \
    -H "Content-Type: application/json" \
    -d '{"agencyData":{"id":"REPLACE_WITH_ID","name":"Test Agency","location":"Surry Hills"},"timestamp":1234567890}' | jq
  ```
- Verify `/data/context/pending-calls.json` includes the new context and `expiresAt`.

**Verify**:
- [ ] register-call returns `success: true` and a `contextId`
- [ ] Context entry saved in `/data/context/pending-calls.json`

**Status**: [ ] Pending

---

### Step 7.4: Test personalization webhook (API)
**Why**: Validate agency context matching and dynamic variables injection.

**Actions**:
- POST to `/api/webhook/personalize` with a simulated payload:
  ```bash
  curl -s -X POST http://localhost:3000/api/webhook/personalize \
    -H "Content-Type: application/json" \
    -d '{"caller_id":"+61400000000","agent_id":"test","called_number":"+61200000000","call_sid":"CA123"}' | jq
  ```
- Verify response includes `dynamic_variables.agency_name` and `agency_location` that match the most recent context.

**Verify**:
- [ ] Webhook returns dynamic variables for the latest context
- [ ] No errors in server logs

**Status**: [ ] Pending

---

### Step 7.5: Test post-call page generation (API)
**Why**: Confirm call-complete webhook stores transcript data and triggers post-call page generation.

**Actions**:
- POST a minimal `post_call_transcription` payload to `/api/webhook/call-complete`:
  ```bash
  curl -s -X POST http://localhost:3000/api/webhook/call-complete \
    -H "Content-Type: application/json" \
    -d '{
      "type":"post_call_transcription",
      "event_timestamp":1234567890,
      "data":{
        "agent_id":"test",
        "conversation_id":"conv_test_001",
        "status":"completed",
        "transcript":[
          {"role":"agent","message":"Hi! Thanks for calling Test Agency."},
          {"role":"user","message":"I\u0027m looking to buy in Surry Hills."},
          {"role":"agent","message":"Great. What\u0027s your budget?"},
          {"role":"user","message":"Around $1M."}
        ],
        "metadata":{
          "call_duration_secs":60,
          "cost":0.1,
          "from_number":"+61400000000",
          "to_number":"+61200000000"
        },
        "analysis":{
          "transcript_summary":"Buyer inquiry in Surry Hills",
          "call_successful":true,
          "data_collection_results":{
            "caller_name":"Test User",
            "caller_intent":"buy",
            "preferred_location":"Surry Hills",
            "budget_range":"$1M"
          }
        },
        "conversation_initiation_client_data":{
          "dynamic_variables":{
            "agency_name":"Test Agency",
            "agency_location":"Surry Hills"
          }
        }
      }
    }' | jq
  ```
- Verify `/data/calls/` contains a new call JSON file.
- Wait up to 2 minutes and verify `/public/call/` contains the generated HTML page.

**Verify**:
- [ ] Call JSON saved under `/data/calls/`
- [ ] Post-call HTML generated under `/public/call/`

**Status**: [ ] Pending

---

### Step 7.6: Test full flow (API-only)
**Why**: Validate the complete flow without browser automation by chaining API calls.

**Actions**:
- Run the sequence: `/api/search` → `/api/generate-demo` → `/api/register-call` → `/api/webhook/personalize` → `/api/webhook/call-complete`.
- Confirm `/api/call-status?agency=REPLACE_WITH_ID` returns `hasRecentCall: true` once the post-call page exists.

**Verify**:
- [ ] Full API flow completes without errors
- [ ] `call-status` reflects the generated post-call page

**Status**: [ ] Pending

---

### Step 7.7: Phase Checkpoint
**Why**: Ensure all integration tests pass before deployment.

**Verify** (from IMPLEMENTATION_PLAN.md):
- [ ] Agency search returns real results
- [ ] Demo pages generate with correct branding
- [ ] Voice agent uses correct agency context (validated via webhook response)
- [ ] Post-call pages generate with listings
- [ ] Full flow works: Search → Demo → Call → Post-call page

**Status**: [ ] Pending

---

## VALIDATION

1. `curl /api/search` → Returns agencies and writes `/data/agencies/*.json`
2. `curl /api/generate-demo` → Writes `/public/demo/*.html`
3. `curl /api/register-call` → Adds context to `/data/context/pending-calls.json`
4. `curl /api/webhook/personalize` → Returns dynamic variables from latest context
5. `curl /api/webhook/call-complete` → Writes `/data/calls/*.json` and `/public/call/*.html`
