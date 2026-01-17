# System Architecture

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
│  │  │  • Agency Research (web search, scraping)                        │   │ │
│  │  │  • Demo Page Generation (skill-based HTML creation)              │   │ │
│  │  │  • Post-Call Page Generation (transcript analysis + listings)    │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         FILE STORAGE                                    │ │
│  │                                                                         │ │
│  │  /data                                                                  │ │
│  │  ├── agencies/              # Agency JSON data                          │ │
│  │  ├── calls/                 # Call transcripts + context                │ │
│  │  ├── context/               # Temp caller→agency mapping                │ │
│  │  ├── agency-calls/          # Call history indexed by agency            │ │
│  │  ├── progress/              # Real-time pipeline progress               │ │
│  │  ├── history/               # Search session history                    │ │
│  │  ├── jobs/postcall/         # Background job queue                      │ │
│  │  └── errors/                # Error tracking                            │ │
│  │                                                                         │ │
│  │  /public                                                                │ │
│  │  ├── demo/                  # Generated demo HTML pages                 │ │
│  │  └── call/                  # Generated post-call HTML pages            │ │
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
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Agency Search → Demo Page

```
1. USER ENTERS SUBURB + COUNT
   └─► "Surry Hills", 15 agencies

2. POST /api/pipeline/start
   └─► Creates session, invokes Claude Code orchestrator

3. ORCHESTRATOR AGENT
   ├─► WebSearch for agencies
   ├─► Creates skeleton progress files
   └─► Spawns N parallel subagents

4. PARALLEL SUBAGENTS (x N)
   ├─► WebFetch agency website
   ├─► Extract: logo, colors, contact, metrics
   ├─► Write progress updates (UI streams in real-time)
   ├─► Generate branded HTML
   └─► Save to /public/demo/{slug}.html

5. SSE STREAMING TO UI
   └─► Cards animate: skeleton → extracting → generating → complete

6. USER CLICKS [View Demo]
   └─► Opens /demo/{agency-slug}
```

---

## Data Flow: Voice Call → Post-Call Page

```
1. USER ON DEMO PAGE CLICKS "Call Demo"
   └─► POST /api/register-call with agency data

2. SERVER STORES CONTEXT
   └─► /data/context/pending-calls.json

3. USER DIALS TWILIO NUMBER
   └─► Twilio routes to ElevenLabs

4. ELEVENLABS PERSONALIZATION WEBHOOK
   ├─► Hits /api/webhook/personalize
   ├─► Server looks up agency context
   └─► Returns: { dynamic_variables: { agency_name, location, ... } }

5. VOICE AGENT CONVERSATION
   ├─► "Hi, thanks for calling [Agency Name]..."
   └─► Collects: intent, location, budget, name

6. CALL ENDS → POST-CALL WEBHOOK
   └─► ElevenLabs hits /api/webhook/call-complete

7. SERVER ENQUEUES JOB
   └─► /data/jobs/postcall/{callId}.json

8. WORKER PROCESSES JOB
   ├─► Claude Code extracts requirements from transcript
   ├─► Searches for matching listings
   ├─► Generates personalized HTML
   └─► Saves to /public/call/{callId}.html

9. SMS NOTIFICATION
   └─► "{Agency} found properties for you: {url}"
```

---

## Context Matching Strategy

**Problem:** Single Twilio number, single ElevenLabs agent. How does agent know which agency?

**Solution:** Multi-strategy matching with 5-minute TTL:
1. Primary: `context_id` from dynamic_variables
2. Secondary: `callSid` match
3. Tertiary: `callerId` phone number match
4. Fallback: Most recent pending context

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14 (App Router) | UI + API routes |
| Hosting | DigitalOcean Droplet | Single VPS |
| Styling | Tailwind CSS | Fast UI development |
| AI Execution | Claude Code (Claude Max) | All agent tasks |
| Voice AI | ElevenLabs Conversational AI | Phone call handling |
| Telephony | Twilio | Phone number + SMS |
| Storage | File system (JSON + HTML) | Simple, Claude-friendly |

---

## File Structure

```
voqo-demo/
├── app/
│   ├── page.tsx                    # Main search UI with streaming
│   ├── demo/[slug]/page.tsx        # Serves demo HTML
│   ├── call/[id]/page.tsx          # Serves post-call HTML
│   └── api/
│       ├── pipeline/
│       │   ├── start/route.ts      # Start agency search
│       │   └── stream/route.ts     # SSE progress streaming
│       ├── search/route.ts         # Legacy search (deprecated)
│       ├── generate-demo/route.ts  # Legacy generation (deprecated)
│       ├── register-call/route.ts  # Store call context
│       ├── call-status/route.ts    # Poll for page status
│       ├── agency-calls/route.ts   # Call history per agency
│       ├── history/route.ts        # Search session history
│       └── webhook/
│           ├── personalize/route.ts
│           └── call-complete/route.ts
│
├── .claude/skills/
│   ├── agency-processor/SKILL.md   # Extract + generate (combined)
│   └── postcall-page-builder/SKILL.md
│
├── data/                           # Runtime data
├── public/                         # Generated HTML
├── lib/                            # Utilities
│   ├── twilio.ts
│   ├── claude.ts
│   ├── postcall-queue.ts
│   └── agency-calls.ts
│
└── specs/                          # This documentation
```

---

## Key Design Decisions

1. **File-based storage over database**
   - Claude Code works exceptionally well with file system
   - JSON files are human-readable and debuggable
   - Can migrate to SQLite later if needed

2. **Static HTML generation**
   - Claude Code generates complete HTML files
   - Served directly from /public
   - Fast loading, cacheable

3. **Single VPS architecture**
   - Everything on one machine
   - Simple deployment and debugging
   - Cost-effective

4. **Single phone number + context injection**
   - One Twilio number for all agencies
   - Context passed via personalization webhook
   - Scales by context, not by numbers

5. **Parallel subagent processing**
   - N agencies processed simultaneously
   - Real-time progress streaming via SSE
   - Graceful handling of individual failures

---

## Environment Variables

```bash
# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+61...

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...
ELEVENLABS_WEBHOOK_SECRET=...

# App
NEXT_PUBLIC_APP_URL=https://theagentic.engineer
NEXT_PUBLIC_DEMO_PHONE=+61 483 943 567
```

---

## Security Notes

- No authentication (demo purposes only)
- Environment variables for API keys
- Webhook signature validation (HMAC-SHA256)
- VPS firewall: only 80, 443, 22 open
