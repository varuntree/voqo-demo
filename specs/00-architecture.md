# 00 - System Architecture

## Overview

VoqoLeadEngine is a lead generation + demo system for Voqo AI. It finds real estate agencies, generates personalized demo pages, and provides a live voice AI demo that creates post-call landing pages.

**Key Principle:** Everything runs on a single DigitalOcean VPS. Claude Code executes all tasks autonomously - scraping, page generation, API setup. No complex backend. File-based storage. Static HTML serving.

---

## System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DIGITALOCEAN VPS                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        NEXT.JS APPLICATION                              │ │
│  │                                                                         │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │ │
│  │  │ Main UI     │  │ Demo Pages  │  │ Post-Call   │  │ API Routes   │  │ │
│  │  │ /           │  │ /demo/[id]  │  │ /call/[id]  │  │ /api/*       │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘  │ │
│  │         │                │                │                │           │ │
│  │         └────────────────┴────────────────┴────────────────┘           │ │
│  │                                   │                                     │ │
│  │                                   ▼                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │                    CLAUDE CODE (Agent SDK)                       │   │ │
│  │  │                                                                  │   │ │
│  │  │  • Agency Research (web search, scraping via Chrome)             │   │ │
│  │  │  • Demo Page Generation (skill-based HTML creation)              │   │ │
│  │  │  • Post-Call Page Generation (transcript analysis + listings)    │   │ │
│  │  │  • Real-time listing search                                      │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         FILE STORAGE                                    │ │
│  │                                                                         │ │
│  │  /data                                                                  │ │
│  │  ├── agencies/                  # Agency JSON data packs                │ │
│  │  │   ├── surry-hills.json       # Suburb search results                 │ │
│  │  │   └── ...                                                           │ │
│  │  ├── calls/                     # Call transcripts + context            │ │
│  │  │   ├── call-abc123.json                                              │ │
│  │  │   └── ...                                                           │ │
│  │  ├── context/                   # Temp caller→agency mapping            │ │
│  │  │   └── pending-calls.json                                            │ │
│  │  ├── agency-calls/              # Call history indexed by agency        │ │
│  │  │   └── ray-white-surry-hills.json                                    │ │
│  │  ├── jobs/                      # Background job queue                  │ │
│  │  │   └── postcall/              # Post-call page generation jobs        │ │
│  │  └── errors/                    # Error tracking                        │ │
│  │      └── postcall-errors.json                                          │ │
│  │                                                                         │ │
│  │  /public                                                                │ │
│  │  ├── demo/                      # Generated demo HTML pages             │ │
│  │  │   ├── ray-white-surry-hills.html                                    │ │
│  │  │   └── ...                                                           │ │
│  │  └── call/                      # Generated post-call HTML pages        │ │
│  │      ├── call-abc123.html                                              │ │
│  │      └── ...                                                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                    │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │    TWILIO       │    │   ELEVENLABS    │    │   ANTHROPIC     │         │
│  │                 │    │                 │    │   (Claude Max)  │         │
│  │  • Phone Number │◄──►│  • Voice Agent  │    │                 │         │
│  │  • SMS API      │    │  • Webhooks     │    │  • Claude Code  │         │
│  │                 │    │                 │    │    execution    │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: System 1 (Agency Search → Demo Page)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. USER ENTERS SUBURB                                                   │
│     └─► "Surry Hills"                                                    │
│                                                                          │
│  2. NEXT.JS API ROUTE /api/search                                        │
│     └─► Invokes Claude Code with agency-researcher skill                 │
│                                                                          │
│  3. CLAUDE CODE EXECUTES                                                 │
│     ├─► Web search: "real estate agencies Surry Hills Sydney"            │
│     ├─► Visit each agency website (Chrome tools)                         │
│     ├─► Extract: name, logo, colors, team size, listings, contact        │
│     ├─► Calculate pain score                                             │
│     └─► Save to /data/agencies/[slug].json                               │
│                                                                          │
│  4. RETURN AGENCY LIST TO UI                                             │
│     └─► Display ranked by pain score with [Generate Demo] buttons        │
│                                                                          │
│  5. USER CLICKS [Generate Demo]                                          │
│     └─► API route /api/generate-demo                                     │
│                                                                          │
│  6. CLAUDE CODE EXECUTES                                                 │
│     ├─► Load agency data from /data/agencies/[slug].json                 │
│     ├─► Use demo-page-builder skill                                      │
│     ├─► Generate branded HTML with:                                      │
│     │   ├─► Agency logo, colors                                          │
│     │   ├─► Pain points, ROI calculations                                │
│     │   ├─► Call Demo button (shared Twilio number)                      │
│     │   └─► Embedded agency data pack in <script> tag                    │
│     └─► Save to /public/demo/[slug].html                                 │
│                                                                          │
│  7. REDIRECT USER TO DEMO PAGE                                           │
│     └─► /demo/ray-white-surry-hills                                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: System 2 (Voice Call → Post-Call Page)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  1. USER ON DEMO PAGE CLICKS "Call Demo"                                 │
│     └─► Demo page JS calls /api/register-call with agency data           │
│                                                                          │
│  2. SERVER STORES CONTEXT                                                │
│     └─► /data/context/pending-calls.json                                 │
│         { "caller_phone_or_session": { agency_data } }                   │
│                                                                          │
│  3. USER DIALS TWILIO NUMBER                                             │
│     └─► Twilio routes to ElevenLabs (native integration)                 │
│                                                                          │
│  4. ELEVENLABS PERSONALIZATION WEBHOOK                                   │
│     ├─► Hits /api/webhook/personalize with caller_id                     │
│     ├─► Server looks up agency context                                   │
│     └─► Returns: { dynamic_variables: { agency_name, location, ... } }   │
│                                                                          │
│  5. VOICE AGENT CONVERSATION                                             │
│     ├─► "Hi, thanks for calling [Agency Name]..."                        │
│     ├─► Collects: intent (buy/sell/rent), location, budget, name         │
│     └─► "I'll prepare some info for you..."                              │
│                                                                          │
│  6. CALL ENDS → POST-CALL WEBHOOK                                        │
│     └─► ElevenLabs hits /api/webhook/call-complete                       │
│         Payload: transcript, caller_id, extracted variables              │
│                                                                          │
│  7. SERVER INVOKES CLAUDE CODE                                           │
│     ├─► Send transcript + agency context                                 │
│     ├─► Claude Code uses postcall-page-builder skill:                    │
│     │   ├─► Extract caller requirements from transcript                  │
│     │   ├─► Web search for matching listings                             │
│     │   ├─► Generate personalized HTML page                              │
│     │   └─► Save to /public/call/[call-id].html                          │
│     └─► Save call data to /data/calls/[call-id].json                     │
│                                                                          │
│  8. UPDATE DEMO PAGE (via polling)                                       │
│     └─► Demo page polls /api/call-status                                 │
│     └─► Show "Page ready!" with link to /call/[call-id]                  │
│                                                                          │
│  9. SEND SMS (IMPLEMENTED)                                               │
│     └─► Twilio SMS sent to caller with personalized page link            │
│     └─► Format: "{Agency} found properties for you: {url}"               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Context Injection Flow (Detail)

**Problem:** Single Twilio number, single ElevenLabs agent. How does agent know which agency context to use?

**Solution:** Pre-register call context before user dials.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Demo Page     │     │   Our Server    │     │   ElevenLabs    │
│   (Browser)     │     │   (Next.js)     │     │   Agent         │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. User clicks        │                       │
         │    "Call Demo"        │                       │
         │                       │                       │
         │ 2. POST /api/register-call                    │
         │    { agency_data,     │                       │
         │      session_id }     │                       │
         │──────────────────────►│                       │
         │                       │                       │
         │                       │ 3. Store in           │
         │                       │    pending-calls.json │
         │                       │    keyed by session   │
         │                       │                       │
         │ 4. Response: OK       │                       │
         │◄──────────────────────│                       │
         │                       │                       │
         │ 5. Show phone number  │                       │
         │    User dials         │                       │
         │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►│
         │                       │                       │
         │                       │ 6. Personalization    │
         │                       │    webhook            │
         │                       │◄──────────────────────│
         │                       │    { caller_id }      │
         │                       │                       │
         │                       │ 7. Lookup context     │
         │                       │    Return agency data │
         │                       │──────────────────────►│
         │                       │                       │
         │                       │                       │ 8. Agent speaks
         │                       │                       │    with context
         │                       │                       │
```

**Matching caller to context:**
- Option A: Use caller's phone number as key (if available before call)
- Option B: Use session_id stored in browser, passed via URL param to call
- Option C: Time-window matching (last registered context within X seconds)

**Implemented:** Multi-strategy matching with 5-minute TTL:
1. Primary: `context_id` from dynamic_variables (returned by personalization webhook)
2. Secondary: `callSid` match from webhook payload
3. Tertiary: `callerId` phone number match
4. Fallback: Most recent pending context within TTL window

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | Next.js 14 (App Router) | UI + API routes |
| **Hosting** | DigitalOcean Droplet | Single VPS for everything |
| **Styling** | Tailwind CSS | Fast UI development |
| **AI Execution** | Claude Code (via Claude Max subscription) | All agent tasks |
| **Voice AI** | ElevenLabs Conversational AI | Phone call handling |
| **Telephony** | Twilio | Phone number + SMS |
| **Storage** | File system (JSON + HTML) | Simple, fast, Claude-friendly |
| **Web Server** | Next.js built-in / nginx | Serve static + dynamic |

---

## File Structure

```
voqo-demo/
├── app/                              # Next.js App Router
│   ├── page.tsx                      # Main search UI
│   ├── demo/
│   │   └── [slug]/
│   │       └── page.tsx              # Serves /public/demo/[slug].html
│   ├── call/
│   │   └── [id]/
│   │       └── page.tsx              # Serves /public/call/[id].html
│   └── api/
│       ├── search/
│       │   └── route.ts              # Invoke Claude Code for agency search
│       ├── generate-demo/
│       │   └── route.ts              # Invoke Claude Code for demo page
│       ├── register-call/
│       │   └── route.ts              # Store call context before dial
│       ├── call-status/
│       │   └── route.ts              # Poll for post-call page status
│       ├── agency-calls/
│       │   └── route.ts              # Get call history for an agency
│       └── webhook/
│           ├── personalize/
│           │   └── route.ts          # ElevenLabs personalization webhook
│           └── call-complete/
│               └── route.ts          # ElevenLabs post-call webhook
│
├── .claude/
│   └── skills/
│       ├── agency-researcher/
│       │   └── SKILL.md              # Skill: find & qualify agencies
│       ├── demo-page-builder/
│       │   └── SKILL.md              # Skill: generate demo landing pages
│       └── postcall-page-builder/
│           └── SKILL.md              # Skill: generate post-call pages
│
├── data/                             # Runtime data storage
│   ├── agencies/                     # Agency JSON files
│   ├── calls/                        # Call transcript/result JSON
│   └── context/                      # Pending call context
│
├── public/                           # Static file serving
│   ├── demo/                         # Generated demo HTML pages
│   └── call/                         # Generated post-call HTML pages
│
├── lib/
│   ├── twilio.ts                     # Twilio SMS + phone normalization
│   ├── claude.ts                     # Claude Code invocation helper
│   ├── postcall-queue.ts             # Durable job queue for page generation
│   └── agency-calls.ts               # Agency call history tracking
│
└── specs/                            # This documentation
```

---

## Key Design Decisions

1. **File-based storage over database**
   - Claude Code works exceptionally well with file system
   - No database setup complexity
   - JSON files are human-readable and debuggable
   - Can migrate to SQLite later if needed

2. **Static HTML generation**
   - Claude Code generates complete HTML files
   - Served directly from /public
   - No server-side rendering complexity
   - Fast loading, cacheable

3. **Single VPS architecture**
   - Everything on one machine
   - Claude Code, Next.js, file storage co-located
   - Simple deployment and debugging
   - Cost-effective

4. **Single phone number + context injection**
   - One Twilio number for all agencies
   - Context passed via personalization webhook
   - Simpler setup, lower cost
   - Scales by context, not by numbers

5. **Claude Code for all AI tasks**
   - Uses Claude Max subscription (no API costs)
   - Browser automation for real web scraping
   - Skill-based HTML generation
   - Consistent quality through detailed prompts

---

## Environment Variables

```bash
# .env.local

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+61...

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...
ELEVENLABS_WEBHOOK_SECRET=...  # For webhook signature verification

# App
NEXT_PUBLIC_APP_URL=https://voqo-demo.example.com
NEXT_PUBLIC_DEMO_PHONE=+61 XXX XXX XXX

# Claude (uses system Claude Max, no key needed)
```

---

## Security Notes

- No authentication (demo purposes only)
- Environment variables for API keys
- Webhook signature validation for ElevenLabs (HMAC-SHA256)
- No sensitive data stored
- VPS firewall: only 80, 443, 22 open

---

## Post-Call Job Queue System

**Purpose:** Ensure reliable post-call page generation with retries and error tracking.

**Location:** `/lib/postcall-queue.ts`

**Job Lifecycle:**
```
1. Call completes → enqueuePostcallJob()
2. Job saved to /data/jobs/postcall/{callId}.json
3. Worker picks up job (5-second polling interval)
4. Job file renamed to .processing during execution
5. Success: HTML generated, SMS sent, job deleted
6. Failure: Retry up to 3 times, then log to /data/errors/
```

**Configuration:**
- `MAX_ATTEMPTS`: 3 retries
- `PROCESSING_TIMEOUT_MS`: 90 seconds
- `POLLING_INTERVAL_MS`: 5 seconds
- `STALE_THRESHOLD_MS`: 10 minutes (for recovery)

**Features:**
- Durable file-based queue (survives restarts)
- Stale job recovery
- SMS notification on completion
- Agency call history updates
- Centralized error logging

---

## Agency Call History

**Purpose:** Track calls per agency for dashboard display.

**Location:** `/lib/agency-calls.ts`, `/data/agency-calls/`

**API Endpoint:** `GET /api/agency-calls?agency={agencyId}`

**Data Structure:**
```typescript
interface AgencyCallEntry {
  callId: string;
  createdAt: string;
  pageUrl: string | null;
  callerName: string | null;
  summary: string | null;
  status: 'pending' | 'completed' | 'failed';
}
```

**Usage:** Demo pages fetch recent calls to display "Recent Calls" section
