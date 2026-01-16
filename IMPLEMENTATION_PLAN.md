# VoqoLeadEngine Implementation Plan

**Strategy:** Local development first → Chrome for external services → Deploy to VPS last

**Status Legend:** `[ ]` pending, `[x]` done, `[!]` blocked

---

## Phase 1: Project Setup (Local)

**Goal:** Initialize Next.js project with all required structure locally

**Spec Reference:** `specs/00-architecture.md`, `specs/08-build-sequence.md`

### Steps

- [x] 1.1 **Create Next.js project**
  - Run: `npx create-next-app@latest voqo-app --typescript --tailwind --app --no-eslint`
  - Move contents to project root or create in subdirectory

- [x] 1.2 **Create directory structure**
  ```
  .claude/skills/agency-researcher/
  .claude/skills/demo-page-builder/
  .claude/skills/postcall-page-builder/
  data/agencies/
  data/calls/
  data/context/
  public/demo/
  public/call/
  lib/
  ```

- [x] 1.3 **Install dependencies**
  - `npm install twilio`

- [x] 1.4 **Create placeholder .env.local**
  ```
  TWILIO_ACCOUNT_SID=placeholder
  TWILIO_AUTH_TOKEN=placeholder
  TWILIO_PHONE_NUMBER=placeholder
  ELEVENLABS_API_KEY=placeholder
  ELEVENLABS_AGENT_ID=placeholder
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  NEXT_PUBLIC_DEMO_PHONE=+61 XXX XXX XXX
  ```

- [x] 1.5 **Verify project runs**
  - `npm run dev` works
  - http://localhost:3000 loads

### Checkpoint 1
- [x] Project structure created
- [x] Dependencies installed
- [x] Dev server runs without errors

---

## Phase 2: External Services Setup (Chrome)

**Goal:** Get all credentials from Twilio and ElevenLabs

**Spec Reference:** `specs/01-infrastructure-setup.md`

### Steps

- [x] 2.1 **Twilio: Get Account SID and Auth Token**
  - Navigate to https://console.twilio.com
  - Copy Account SID (ACxxxxxxxx)
  - Copy Auth Token

- [x] 2.2 **Twilio: Get Australian phone number**
  - Check Phone Numbers → Manage → Active Numbers for existing +61 number
  - If none:
    - Check/create regulatory bundle for Australia
    - Purchase Australian local number (~$3/mo)
  - Note number in E.164 format: +61XXXXXXXXX

- [x] 2.3 **ElevenLabs: Get API key**
  - Navigate to https://elevenlabs.io
  - Go to Profile → API Keys
  - Copy API key

- [x] 2.4 **Update .env.local with real credentials**
  ```
  TWILIO_ACCOUNT_SID=ACxxxx (real)
  TWILIO_AUTH_TOKEN=xxxx (real)
  TWILIO_PHONE_NUMBER=+61xxxxxxxxx (real)
  ELEVENLABS_API_KEY=xxxx (real)
  ELEVENLABS_AGENT_ID=pending
  NEXT_PUBLIC_DEMO_PHONE=+61 XXX XXX XXX (formatted)
  ```

### Checkpoint 2
- [x] Twilio Account SID noted
- [x] Twilio Auth Token noted
- [x] Australian phone number acquired
- [x] ElevenLabs API key noted
- [x] .env.local updated with real values

---

## Phase 3: Skills Setup (Local)

**Goal:** Create all 3 Claude Code skills from spec files

**Spec Reference:** `specs/02-agency-researcher-skill.md`, `specs/03-demo-page-skill.md`, `specs/04-postcall-page-skill.md`

### Steps

- [x] 3.1 **Create Agency Researcher skill**
  - File: `.claude/skills/agency-researcher/SKILL.md`
  - Content: Full skill content from `specs/02-agency-researcher-skill.md`
  - Key capabilities:
    - Web search for agencies in suburb
    - Visit agency websites via Chrome
    - Extract: name, logo URL, colors, team size, listing count
    - Calculate pain score (0-100)
    - Save to `/data/agencies/[slug].json`

- [x] 3.2 **Create Demo Page Builder skill**
  - File: `.claude/skills/demo-page-builder/SKILL.md`
  - Content: Full skill content from `specs/03-demo-page-skill.md`
  - Key capabilities:
    - Generate branded HTML landing page
    - Tailwind CSS via CDN
    - Agency logo, colors, pain points
    - ROI calculator section
    - Call Demo button with JS to register call
    - Save to `/public/demo/[agency-id].html`

- [x] 3.3 **Create Post-Call Page Builder skill**
  - File: `.claude/skills/postcall-page-builder/SKILL.md`
  - Content: Full skill content from `specs/04-postcall-page-skill.md`
  - Key capabilities:
    - Parse call transcript for requirements
    - Search for matching property listings
    - Generate personalized HTML page
    - Show listings matching caller criteria
    - Save to `/public/call/[call-id].html`

- [x] 3.4 **Create CLAUDE.md**
  - File: `CLAUDE.md` in project root
  - Content: Project overview, available skills, guidelines
  - Reference: `specs/08-build-sequence.md` Step 3.4

### Checkpoint 3
- [x] agency-researcher/SKILL.md created with full content
- [x] demo-page-builder/SKILL.md created with full content
- [x] postcall-page-builder/SKILL.md created with full content
- [x] CLAUDE.md created in project root

---

## Phase 4: API Routes (Local)

**Goal:** Implement all 6 API routes

**Spec Reference:** `specs/06-webhook-handler.md`

### Steps

- [x] 4.1 **Create lib/twilio.ts**
  - Twilio client initialization
  - `sendSMS(to, message)` helper function
  - Reference: `specs/06-webhook-handler.md`

- [x] 4.2 **Create lib/claude.ts**
  - `invokeClaudeCode(options)` helper
  - Placeholder for Claude Code CLI/SDK integration
  - Reference: `specs/08-build-sequence.md` Step 4.1

- [x] 4.3 **Create /api/search/route.ts**
  - POST endpoint
  - Accepts: `{ suburb: string }`
  - Invokes Claude Code with agency-researcher skill
  - Returns: agency list with pain scores
  - Saves: `/data/agencies/[suburb-slug].json`

- [x] 4.4 **Create /api/generate-demo/route.ts**
  - POST endpoint
  - Accepts: `{ agencyId: string }`
  - Loads agency data from `/data/agencies/[id].json`
  - Invokes Claude Code with demo-page-builder skill
  - Returns: `{ url: "/demo/[agency-id]" }`
  - Saves: `/public/demo/[agency-id].html`

- [x] 4.5 **Create /api/register-call/route.ts**
  - POST endpoint
  - Accepts: `{ agencyData, timestamp }`
  - Generates unique contextId
  - Saves to `/data/context/pending-calls.json`
  - Returns: `{ success, contextId, expiresAt }`
  - TTL: 5 minutes
  - Full implementation in `specs/06-webhook-handler.md`

- [x] 4.6 **Create /api/call-status/route.ts**
  - GET endpoint
  - Query: `?agency=[agency-id]`
  - Reads `/data/calls/` for recent calls
  - Returns: `{ hasRecentCall, callId, status, pageUrl }`
  - Full implementation in `specs/06-webhook-handler.md`

- [x] 4.7 **Create /api/webhook/personalize/route.ts**
  - POST endpoint (called by ElevenLabs)
  - Accepts: `{ caller_id, agent_id, called_number, call_sid }`
  - Finds most recent pending context
  - Returns: `{ dynamic_variables: { agency_name, agency_location, agency_phone } }`
  - Fallback to default agency if no context
  - Full implementation in `specs/06-webhook-handler.md`

- [x] 4.8 **Create /api/webhook/call-complete/route.ts**
  - POST endpoint (called by ElevenLabs)
  - Accepts: Full ElevenLabs post_call_transcription payload
  - Extracts: transcript, caller info, agency context
  - Saves call data to `/data/calls/[call-id].json`
  - Triggers Claude Code for post-call page generation (async)
  - Returns: `{ success, callId, pageGenerationStarted }`
  - Full implementation in `specs/06-webhook-handler.md`

- [x] 4.9 **Test all routes locally**
  ```bash
  # Test register-call
  curl -X POST http://localhost:3000/api/register-call \
    -H "Content-Type: application/json" \
    -d '{"agencyData":{"id":"test","name":"Test Agency"},"timestamp":1234567890}'

  # Test personalize webhook
  curl -X POST http://localhost:3000/api/webhook/personalize \
    -H "Content-Type: application/json" \
    -d '{"caller_id":"+61400000000","agent_id":"test"}'

  # Test call-status
  curl "http://localhost:3000/api/call-status?agency=test"
  ```

### Checkpoint 4
- [x] lib/twilio.ts created
- [x] lib/claude.ts created
- [x] All 6 API routes created
- [x] Routes return valid JSON responses
- [x] File read/write works in /data
- [x] No TypeScript errors
- [x] `npm run build` succeeds

---

## Phase 5: UI Implementation (Local)

**Goal:** Create all UI pages

**Spec Reference:** `specs/03-demo-page-skill.md` (UI patterns), `specs/08-build-sequence.md`

### Steps

- [x] 5.1 **Create main search page (app/page.tsx)**
  - Search input for suburb
  - Submit button
  - Loading state during Claude Code execution
  - Results grid showing agencies:
    - Agency name, logo
    - Pain score badge (color-coded)
    - Listing count, team size
    - [Generate Demo] button
  - Error handling
  - Styling: Tailwind CSS

- [x] 5.2 **Create demo page route (app/demo/[slug]/page.tsx)**
  - Check if `/public/demo/[slug].html` exists
  - If exists: Serve the static HTML (or redirect)
  - If not: Show "generating" or "not found" state
  - Alternative: Use Next.js static file serving

- [x] 5.3 **Create post-call page route (app/call/[id]/page.tsx)**
  - Check if `/public/call/[id].html` exists
  - If exists: Serve the static HTML
  - If not: Show "generating" or "not found" state

- [x] 5.4 **Verify build succeeds**
  - `npm run build` completes without errors
  - `npm run dev` shows all pages

- [x] 5.5 **Test UI locally**
  - Main page loads at /
  - Can type suburb and click search
  - Loading state appears
  - Demo route accessible at /demo/test
  - Call route accessible at /call/test

### Checkpoint 5
- [x] Search page loads and accepts input
- [x] Loading states work
- [x] Demo page route works
- [x] Call page route works
- [x] Build succeeds
- [x] No console errors

---

## Phase 6: ElevenLabs Agent Setup (Chrome)

**Goal:** Create voice agent and configure webhooks

**Spec Reference:** `specs/05-voice-agent-prompt.md`, `specs/01-infrastructure-setup.md`

**Prerequisite:** Local server must be accessible via HTTPS for webhooks

### Steps

- [x] 6.1 **Start ngrok for webhook testing**
  - `ngrok http 3000`
  - Note HTTPS URL (e.g., https://be38bcbf4844.ngrok-free.app)
  - This URL will be used for webhook configuration

- [x] 6.2 **Create ElevenLabs Conversational AI agent (Chrome)**
  - Navigate to ElevenLabs → Conversational AI → Create Agent
  - Configure:
    - **Name:** Voqo Real Estate Demo
    - **First Message:** `Hi! Thanks for calling {{agency_name}}. I'm their AI assistant - how can I help you today?`
    - **System Prompt:** Full content from `specs/05-voice-agent-prompt.md`
    - **Voice:** Kylie - Warm & Friendly (Australian)
    - **LLM:** GPT-4o
    - **Max Duration:** 180 seconds
    - **Turn Timeout:** 10 seconds
    - **Temperature:** 0.7

- [x] 6.3 **Configure Webhooks**
  - **Personalization Webhook:**
    - URL: `https://[ngrok-url]/api/webhook/personalize`
    - Called before each call to inject agency context
  - **Post-Call Webhook:**
    - URL: `https://[ngrok-url]/api/webhook/call-complete`
    - Event: `post_call_transcription` (Transcript toggle ON)
    - Called after call ends with transcript

- [x] 6.4 **Import Twilio number to ElevenLabs**
  - Go to Phone Numbers section
  - Click "Import Number" or "Add Phone Number"
  - Select Twilio as provider
  - Enter:
    - Phone Number: +61483943567
    - Account SID: REDACTED_TWILIO_SID
    - Auth Token: (from .env.local)
  - Assign agent to this number

- [x] 6.5 **Note Agent ID and update .env.local**
  - Copy Agent ID from URL or settings
  - Update: `ELEVENLABS_AGENT_ID=agent_5001kf0882f6fndanzag9eg4xqev`

- [x] 6.6 **Enable Security Overrides (CRITICAL)**
  - Go to Agent Settings → Security tab
  - Enable ALL overrides:
    - ✅ Agent language
    - ✅ First message
    - ✅ System prompt
    - ✅ LLM
    - ✅ Voice
    - ✅ Voice speed
    - ✅ Voice stability
    - ✅ Voice similarity
    - ✅ Text only
  - This allows webhook to override agent config per-call

- [x] 6.7 **Test voice agent**
  - Call the Twilio number from a phone
  - Verify agent answers with agency name (e.g., "Thanks for calling Ray White Surry Hills...")
  - Check ngrok logs for webhook hits
  - Verify personalization webhook is called

### Troubleshooting Notes (Issues Encountered)

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Webhook URL path missing** | ElevenLabs sent to `/` instead of `/api/webhook/personalize` | Add full path in ElevenLabs webhook config |
| **Missing `type` field** | Webhook response rejected | Add `"type": "conversation_initiation_client_data"` to response |
| **Context window too short** | Multiple dial attempts returned default agency | Extended `RECENT_ACTIVE_WINDOW_MS` from 60s to 5 minutes |
| **Sort logic bug** | Wrong context selected | Fixed swapped variables in sort comparison |
| **Override not allowed** | Call failed with "Override for field 'first_message' is not allowed" | Enable overrides in Security tab |

### Checkpoint 6
- [x] ngrok running with HTTPS URL
- [x] ElevenLabs agent created with full system prompt
- [x] Webhooks configured with ngrok URLs (with FULL paths!)
- [x] Twilio number imported and assigned
- [x] Agent ID saved to .env.local
- [x] Security overrides enabled
- [x] Test call works with correct agency context

---

## Phase 7: Integration Testing (Local + Chrome)

**Goal:** Test complete end-to-end flows

**Spec Reference:** `specs/08-build-sequence.md` Phase 7

### Steps

- [ ] 7.1 **Test agency search flow**
  1. Go to http://localhost:3000
  2. Enter "Surry Hills" in search
  3. Click search
  4. Wait for Claude Code to research agencies (1-2 minutes)
  5. Verify agencies appear with pain scores
  6. Check `/data/agencies/surry-hills.json` was created

- [ ] 7.2 **Test demo page generation**
  1. Click [Generate Demo] for an agency
  2. Wait for page generation
  3. Verify redirect to /demo/[agency-id]
  4. Check page displays with correct branding (logo, colors)
  5. Verify `/public/demo/[agency-id].html` exists
  6. Check phone number is clickable

- [ ] 7.3 **Test voice call flow**
  1. On demo page, click "Call Demo" button
  2. Check browser console for register-call API hit
  3. Dial the Twilio number from a phone
  4. Verify agent answers with agency name (e.g., "Thanks for calling Ray White...")
  5. Have conversation:
     - State intent (buying)
     - Give location preference
     - Give name
  6. Wait for call to end
  7. Check ngrok logs for call-complete webhook

- [ ] 7.4 **Test post-call page generation**
  1. After call completes, wait 1-2 minutes
  2. Check `/data/calls/` for new call JSON file
  3. Verify call data includes transcript and extracted info
  4. Wait for post-call page to generate
  5. Check `/public/call/[call-id].html` exists
  6. Verify demo page shows "Page ready" notification
  7. Click to view post-call page
  8. Verify page shows:
     - Caller's name
     - Requirements summary
     - Matching property listings

- [ ] 7.5 **Test full end-to-end**
  1. Fresh search for different suburb (e.g., "Darlinghurst")
  2. Generate demo for top agency
  3. Make call from demo page
  4. Complete voice conversation with full info
  5. See personalized post-call page appear
  6. Verify listings match stated preferences

### Checkpoint 7
- [ ] Agency search returns real results
- [ ] Demo pages generate with correct branding
- [ ] Voice agent uses correct agency context
- [ ] Post-call pages generate with listings
- [ ] Full flow works: Search → Demo → Call → Post-call page

---

## Phase 8: VPS Deployment

**Goal:** Deploy working application to DigitalOcean VPS

**Spec Reference:** `specs/01-infrastructure-setup.md`

### Steps

- [ ] 8.1 **Create DigitalOcean droplet (Chrome)**
  - Navigate to https://cloud.digitalocean.com/droplets
  - Check for existing suitable droplet
  - If none, create:
    - Region: Sydney (syd1)
    - Image: Ubuntu 24.04 LTS
    - Size: Basic $12/mo (2GB RAM)
    - Name: voqo-demo
  - Note IP address

- [ ] 8.2 **Configure firewall**
  - Inbound: TCP 22, 80, 443
  - Apply to droplet

- [ ] 8.3 **Install server dependencies (SSH)**
  ```bash
  apt update && apt upgrade -y
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs nginx certbot python3-certbot-nginx
  npm install -g pm2
  ```

- [ ] 8.4 **Deploy project to VPS**
  - Option A: Git clone + npm install
  - Option B: rsync/scp files
  - Ensure `.env.local` has production values
  - `npm run build`

- [ ] 8.5 **Configure Nginx**
  - Create `/etc/nginx/sites-available/voqo-demo`
  - Proxy pass to localhost:3000
  - Static file serving for /demo/ and /call/
  - Enable site, reload nginx

- [ ] 8.6 **Start with PM2**
  ```bash
  pm2 start npm --name voqo-demo -- start
  pm2 save
  ```

- [ ] 8.7 **Update ElevenLabs webhooks to VPS URL**
  - Change from ngrok URL to http://VPS_IP/api/webhook/personalize
  - Change post-call to http://VPS_IP/api/webhook/call-complete

- [ ] 8.8 **SSL Certificate (optional)**
  - If using custom domain: `certbot --nginx -d domain.com`
  - Update webhook URLs to https://

- [ ] 8.9 **Final verification**
  - Access http://VPS_IP
  - Test full flow on production
  - Make test call
  - Verify all pages generate correctly

### Checkpoint 8
- [ ] VPS running with Node.js, Nginx, PM2
- [ ] Project deployed and built
- [ ] App accessible at http://VPS_IP
- [ ] ElevenLabs webhooks updated to VPS URLs
- [ ] Full flow works on production
- [ ] System stable

---

## Phase 10: SMS Notification (Complete)

**Goal:** Send SMS to caller with personalized page link after generation

**Spec Reference:** `specs/10-sms-notification.md`

### Steps

- [x] 10.1 **Add normalizePhoneNumber() to lib/twilio.ts**
- [x] 10.2 **Add sendPostcallSMS() function in lib/postcall-queue.ts**
- [x] 10.3 **Integrate SMS into markCallCompleted()**
- [x] 10.4 **Verify build succeeds**
- [x] 10.5 **Git commit** (8c88df8)

### Checkpoint 10
- [x] SMS sent after successful page generation
- [x] Message format: "{Agency} found properties for you: {url}"
- [x] Error handling: log only, no retry
- [x] Build passes

---

## Quick Reference

### Key Files to Create

| File | Purpose |
|------|---------|
| `.claude/skills/agency-researcher/SKILL.md` | Agency research skill |
| `.claude/skills/demo-page-builder/SKILL.md` | Demo page generation skill |
| `.claude/skills/postcall-page-builder/SKILL.md` | Post-call page skill |
| `CLAUDE.md` | Project overview for Claude Code |
| `lib/twilio.ts` | Twilio SMS helper |
| `lib/claude.ts` | Claude Code invocation helper |
| `app/api/search/route.ts` | Agency search endpoint |
| `app/api/generate-demo/route.ts` | Demo page generation endpoint |
| `app/api/register-call/route.ts` | Call context registration |
| `app/api/call-status/route.ts` | Poll for page status |
| `app/api/webhook/personalize/route.ts` | ElevenLabs personalization |
| `app/api/webhook/call-complete/route.ts` | Post-call processing |
| `app/page.tsx` | Main search UI |
| `app/demo/[slug]/page.tsx` | Demo page route |
| `app/call/[id]/page.tsx` | Post-call page route |

### Data Flow Summary

```
1. User searches suburb → /api/search
2. Claude Code researches agencies → /data/agencies/[suburb].json
3. User clicks Generate Demo → /api/generate-demo
4. Claude Code generates HTML → /public/demo/[agency].html
5. User clicks Call Demo → /api/register-call
6. Context stored → /data/context/pending-calls.json
7. User dials Twilio number → ElevenLabs agent
8. ElevenLabs calls → /api/webhook/personalize
9. Agent speaks with agency context
10. Call ends → /api/webhook/call-complete
11. Claude Code generates post-call page → /public/call/[call-id].html
12. Demo page polls → /api/call-status
13. User sees "Page ready" → views post-call page
```

### Environment Variables

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+61xxxxxxxxx
ELEVENLABS_API_KEY=xxxxxxxx
ELEVENLABS_AGENT_ID=xxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or VPS URL
NEXT_PUBLIC_DEMO_PHONE=+61 XXX XXX XXX
```

---

## Completion Criteria

The build is complete when:

1. **Search works:** Enter suburb → get real agency list with pain scores
2. **Demo pages work:** Click Generate → branded page with correct logo/colors
3. **Voice works:** Call number → agent speaks with agency context
4. **Post-call works:** After call → personalized page with matching listings
5. **Full flow works:** Search → Demo → Call → Post-call page (all working)
