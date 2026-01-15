# Phase 4: API Routes

## What & Why
Implement all 6 API endpoints that handle agency search, demo generation, call context management, and ElevenLabs webhooks. These routes are the backbone connecting the UI, Claude Code skills, and voice agent.

## Prerequisites
- Phase 3 complete (skills created)
- Next.js project running
- Twilio credentials in `.env.local`

## Execution Context
| Action Type | How to Execute |
|-------------|----------------|
| Local code | Write/Edit tools |
| Verification | curl commands, npm build |

---

## IMPLEMENTATION STEPS

### Step 4.1: Create lib/twilio.ts
**Why**: Twilio client for SMS (used in post-call notifications)

**Actions**:
- Create `/Users/varunprasad/code/prjs/voqo-demo/lib/twilio.ts`

**Verify**:
- [x] File exists at lib/twilio.ts
- [x] No TypeScript errors

**Status**: [✓] Complete

---

### Step 4.2: Create lib/claude.ts
**Why**: Placeholder for Claude Code CLI/SDK integration (page generation)

**Actions**:
- Create `/Users/varunprasad/code/prjs/voqo-demo/lib/claude.ts`

**Verify**:
- [x] File exists at lib/claude.ts
- [x] No TypeScript errors

**Status**: [✓] Complete

---

### Step 4.3: Create /api/register-call/route.ts
**Why**: Demo page calls this when user clicks "Call Demo" - stores agency context for personalization webhook

**Actions**:
- Create directory: `app/api/register-call/`
- Create route file

**Verify**:
- [x] curl POST returns `{"success":true,"contextId":"ctx-...","expiresAt":...}`
- [x] File created at data/context/pending-calls.json

**Status**: [✓] Complete

---

### Step 4.4: Create /api/webhook/personalize/route.ts
**Why**: ElevenLabs calls this before each call to inject agency name/location

**Actions**:
- Create directory: `app/api/webhook/personalize/`
- Create route file

**Verify**:
- [x] curl POST returns `{"dynamic_variables":{...}}`
- [x] Uses pending context if available, else default

**Status**: [✓] Complete

---

### Step 4.5: Create /api/webhook/call-complete/route.ts
**Why**: ElevenLabs calls this after call ends - saves transcript and triggers page generation

**Actions**:
- Create directory: `app/api/webhook/call-complete/`
- Create route file

**Verify**:
- [x] Route created and TypeScript compiles
- [x] Webhook handler processes post_call_transcription events

**Status**: [✓] Complete

---

### Step 4.6: Create /api/call-status/route.ts
**Why**: Demo page polls this to check if post-call page is ready

**Actions**:
- Create directory: `app/api/call-status/`
- Create route file

**Verify**:
- [x] curl GET returns `{"hasRecentCall":false}` when no calls
- [x] Returns call info when recent call exists

**Status**: [✓] Complete

---

### Step 4.7: Create /api/search/route.ts
**Why**: Main page calls this to search agencies in a suburb

**Actions**:
- Create directory: `app/api/search/`
- Create route file

**Verify**:
- [x] Route created and TypeScript compiles
- [x] Error handling works

**Status**: [✓] Complete

---

### Step 4.8: Create /api/generate-demo/route.ts
**Why**: Triggers demo page generation for an agency

**Actions**:
- Create directory: `app/api/generate-demo/`
- Create route file

**Verify**:
- [x] Route created and TypeScript compiles
- [x] Returns cached if page exists

**Status**: [✓] Complete

---

### Step 4.9: Test All Routes Locally
**Why**: Verify routes work before next phase

**Actions**:
Run test commands:
```bash
# Start dev server
npm run dev

# Test register-call
curl -X POST http://localhost:3000/api/register-call \
  -H "Content-Type: application/json" \
  -d '{"agencyData":{"id":"test","name":"Test Agency","location":"Sydney","phone":"+61 2 0000 0000"},"timestamp":1234567890}'

# Test personalize webhook
curl -X POST http://localhost:3000/api/webhook/personalize \
  -H "Content-Type: application/json" \
  -d '{"caller_id":"+61400000000","agent_id":"test","called_number":"+61200000000","call_sid":"CA123"}'

# Test call-status
curl "http://localhost:3000/api/call-status?agency=test"
```

**Verify**:
- [x] register-call returns success with contextId
- [x] personalize returns dynamic_variables
- [x] call-status returns JSON

**Status**: [✓] Complete

---

### Step 4.10: Verify Build Succeeds
**Why**: Ensure no TypeScript errors before proceeding

**Actions**:
```bash
npm run build
```

**Verify**:
- [x] `npm run build` completes without errors
- [x] No TypeScript errors

**Status**: [✓] Complete

---

### Step 4.X: Phase Checkpoint
**Why**: Ensure phase is complete before moving on

**Verify**:
- [x] lib/twilio.ts created
- [x] lib/claude.ts created
- [x] All 6 API routes created:
  - [x] /api/register-call
  - [x] /api/webhook/personalize
  - [x] /api/webhook/call-complete
  - [x] /api/call-status
  - [x] /api/search
  - [x] /api/generate-demo
- [x] Routes return valid JSON responses
- [x] File read/write works in /data
- [x] No TypeScript errors
- [x] `npm run build` succeeds

**Status**: [✓] Complete

---

## VALIDATION

1. `curl -X POST localhost:3000/api/register-call` with valid JSON → Returns `{"success":true,...}` ✓
2. `curl -X POST localhost:3000/api/webhook/personalize` → Returns `{"dynamic_variables":{...}}` ✓
3. `curl localhost:3000/api/call-status?agency=test` → Returns JSON with `hasRecentCall` ✓
4. `npm run build` → Completes without errors ✓
5. Files created in `data/context/` when register-call is called ✓
