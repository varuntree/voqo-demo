# Voqo AI Hackathon Project Specification

## Project Codename: **VoqoLeadEngine**

---

## 🎯 Objective

Build a system that impresses Voqo AI by demonstrating:
1. **Automated qualified lead generation** for their sales team
2. **Personalized demo experience** that shows prospects exactly how Voqo would work for THEM

**The Pitch:** "We built you a sales engine. Here are 500 agencies that need you, with personalized demos ready to send."

---

## 📐 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VOQO LEAD ENGINE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐         ┌─────────────────┐                       │
│  │   SYSTEM 1      │         │   SYSTEM 2      │                       │
│  │ Agency Finder   │────────▶│ Demo Generator  │                       │
│  │ + Page Builder  │         │ + Voice Agent   │                       │
│  └─────────────────┘         └─────────────────┘                       │
│         │                            │                                  │
│         ▼                            ▼                                  │
│  ┌─────────────────┐         ┌─────────────────┐                       │
│  │ Claude Agent    │         │ 11 Labs Voice   │                       │
│  │ SDK (Research)  │         │ + Twilio Phone  │                       │
│  └─────────────────┘         └─────────────────┘                       │
│         │                            │                                  │
│         ▼                            ▼                                  │
│  ┌─────────────────┐         ┌─────────────────┐                       │
│  │ Claude Agent    │         │ Claude Agent    │                       │
│  │ SDK (HTML Gen)  │         │ SDK (HTML Gen)  │                       │
│  └─────────────────┘         └─────────────────┘                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔷 SYSTEM 1: Agency Finder + Demo Page Builder

### Purpose
Find and qualify real estate agencies, then generate personalized demo landing pages for each one.

### User Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    MAIN LANDING PAGE                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  🔍 Enter a suburb or region: [Sydney CBD        ] [Search]│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  TOP 10 AGENCIES TO OUTREACH:                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Ray White Surry Hills                                  │  │
│  │    📊 Pain Score: 87/100 | 📞 Listings: 45                │  │
│  │    [Generate Demo Page]                                   │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 2. LJ Hooker Darlinghurst                                 │  │
│  │    📊 Pain Score: 82/100 | 📞 Listings: 38                │  │
│  │    [Generate Demo Page]                                   │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 3. ...                                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Data Model: Agency Profile

```typescript
interface AgencyProfile {
  // Basic Info
  name: string;                    // "Ray White Surry Hills"
  website: string;                 // "https://raywhitesurryhills.com.au"
  location: string;                // "Surry Hills, NSW"
  
  // Branding (scraped)
  logoUrl: string;                 // Logo image URL
  primaryColor: string;            // Hex color from website
  secondaryColor: string;          // Secondary brand color
  
  // Qualification Signals
  teamSize: number;                // Number of agents
  listingCount: number;            // Active listings
  hasPropertyManagement: boolean;  // PM services offered
  hasAfterHoursNumber: boolean;    // Current solution exists?
  hasChatWidget: boolean;          // Alternative capture method?
  
  // Pain Score (calculated)
  painScore: number;               // 0-100 (higher = more pain)
  painReasons: string[];           // ["No after-hours", "High volume"]
  
  // Contact Info
  phone: string;
  email: string;
  principalName?: string;          // Decision maker if found
}
```

### Pain Score Calculation

```
Pain Score = (
  (listingCount > 30 ? 20 : listingCount * 0.67) +
  (hasPropertyManagement ? 25 : 0) +
  (teamSize < 5 && listingCount > 20 ? 20 : 0) +
  (!hasAfterHoursNumber ? 15 : 0) +
  (!hasChatWidget ? 10 : 0) +
  (badReviewScore * 10)  // 0-1 based on "couldn't reach" mentions
)
```

### Generated Demo Page Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  [Agency Logo]              Powered by Voqo AI                   │
│                                                                  │
│  ══════════════════════════════════════════════════════════════ │
│                                                                  │
│  🎙️ "Hi, this is [Agency Name]'s AI assistant.                 │
│      How can I help you today?"                                 │
│                                                                  │
│              [ 📞 Call Demo: +61 XXX XXX XXX ]                  │
│                                                                  │
│  ──────────────────────────────────────────────────────────────│
│                                                                  │
│  WHY [AGENCY NAME] WOULD LOVE VOQO:                             │
│                                                                  │
│  📊 You have [45] active listings generating calls              │
│  👥 Your team of [6] can't answer every call                    │
│  🌙 After-hours enquiries are going to voicemail                │
│                                                                  │
│  ──────────────────────────────────────────────────────────────│
│                                                                  │
│  YOUR POTENTIAL ROI:                                            │
│                                                                  │
│  Est. Missed Calls/Month: ~180                                  │
│  Est. Lost Revenue: $27,000/month                               │
│  Voqo Cost: $199/month                                          │
│  ROI: 135x                                                      │
│                                                                  │
│  ──────────────────────────────────────────────────────────────│
│                                                                  │
│              [ Book a Demo with Voqo ]                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔷 SYSTEM 2: Voice Agent + Post-Call Landing Page

### Purpose
When someone calls the demo number on the generated page, an AI voice agent (simulating Voqo) talks to them, then generates a personalized landing page based on the conversation.

### Voice Agent Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     VOICE CONVERSATION FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CALLER CALLS DEMO NUMBER                                        │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  AI: "Hi! Thanks for calling [Agency Name].         │        │
│  │       I'm their AI assistant. I can help you        │        │
│  │       with property enquiries. What brings          │        │
│  │       you in today?"                                │        │
│  └─────────────────────────────────────────────────────┘        │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  GATHER INTENT (1-2 questions max):                 │        │
│  │  • Are you looking to buy, sell, or rent?           │        │
│  │  • What area/suburb are you interested in?          │        │
│  │  • What's your budget range? (optional)             │        │
│  │  • Can I get your name to follow up?                │        │
│  └─────────────────────────────────────────────────────┘        │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  AI: "Perfect! I'm preparing some information       │        │
│  │       for you right now. I'll text you a link       │        │
│  │       with everything you need. Thanks for          │        │
│  │       calling [Agency Name]!"                       │        │
│  └─────────────────────────────────────────────────────┘        │
│         │                                                        │
│         ▼                                                        │
│  TRIGGER LANDING PAGE GENERATION                                 │
│         │                                                        │
│         ▼                                                        │
│  SEND SMS WITH PAGE LINK                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Voice Agent Configuration (11 Labs)

```typescript
interface VoiceAgentConfig {
  // Agent Identity
  agentName: string;              // "Lisa" (Voqo-style name)
  voiceId: string;                // 11 Labs voice ID (Australian female)

  // Context (injected per-agency via personalization webhook)
  agencyName: string;             // "Ray White Surry Hills"
  agencyLocation: string;         // "Surry Hills, Sydney"

  // NOTE: We do NOT configure dataToCollect in ElevenLabs
  // Claude Code skill extracts ALL data from the raw transcript
  // This provides more flexibility and no information loss

  // Conversation Limits
  maxQuestions: 4;
  maxDurationSeconds: 90;
}
```

### Data Model: Call Transcript

```typescript
interface CallTranscript {
  callId: string;
  timestamp: Date;
  duration: number;
  callerPhone: string;
  
  // Agency Context
  agencyId: string;
  agencyName: string;
  
  // Extracted Data
  callerName?: string;
  intent?: "buy" | "sell" | "rent" | "other";
  preferredLocation?: string;
  budgetRange?: string;
  additionalNotes?: string;
  
  // Raw Transcript
  transcript: string;
}
```

### Post-Call Landing Page Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  [Agency Logo]                                                   │
│                                                                  │
│  Hi [Caller Name]! 👋                                           │
│                                                                  │
│  Thanks for calling [Agency Name]. Here's what we discussed:    │
│                                                                  │
│  ══════════════════════════════════════════════════════════════ │
│                                                                  │
│  YOUR PROPERTY SEARCH:                                          │
│  ─────────────────────                                          │
│  🏠 Looking to: [BUY]                                           │
│  📍 Area: [Surry Hills / Darlinghurst]                          │
│  💰 Budget: [$800k - $1.2M]                                     │
│                                                                  │
│  ──────────────────────────────────────────────────────────────│
│                                                                  │
│  MATCHING LISTINGS:                                             │
│  ─────────────────────                                          │
│  [Property Card 1 - scraped from agency site]                   │
│  [Property Card 2]                                              │
│  [Property Card 3]                                              │
│                                                                  │
│  ──────────────────────────────────────────────────────────────│
│                                                                  │
│  NEXT STEPS:                                                    │
│                                                                  │
│  [ 📅 Book Inspection ]  [ 📧 Request Contract ]                │
│                                                                  │
│  ──────────────────────────────────────────────────────────────│
│                                                                  │
│  Your agent [Agent Name] will follow up within 24 hours.        │
│                                                                  │
│  ─── Powered by Voqo AI ───                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Core Framework
| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | **Next.js 14** | Simple React framework, no backend complexity |
| Hosting | **Digital Ocean Droplet/App Platform** | Simple VPS deployment |
| Styling | **Tailwind CSS** | Rapid UI development |

### AI/Agent Layer
| Component | Technology | Purpose |
|-----------|------------|---------|
| Agent Orchestration | **Claude Agent SDK (Python)** | Research agents, HTML generation |
| HTML Generation | **Claude Agent SDK + Custom Skill** | Beautiful landing page creation |
| Web Scraping | **Claude Agent SDK + Bash** | Extract agency data |

### Voice Layer
| Component | Technology | Purpose |
|-----------|------------|---------|
| Voice AI | **ElevenLabs Conversational AI** | Natural voice conversations |
| Telephony | **Twilio** | Phone number + call routing |
| Integration | **ElevenLabs Native Twilio Integration** | Webhook-based, minimal code |

### Communication
| Component | Technology | Purpose |
|-----------|------------|---------|
| SMS | **Twilio SMS API** | Send landing page links |
| Webhooks | **Next.js API Routes** | Receive call events |

---

## 📁 Project Structure

```
voqo-lead-engine/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Main search interface
│   ├── demo/[agencyId]/page.tsx  # Generated agency demo page
│   ├── caller/[callId]/page.tsx  # Post-call landing page
│   └── api/
│       ├── search/route.ts       # Trigger agency search
│       ├── generate-demo/route.ts # Trigger demo page generation
│       ├── webhook/
│       │   └── elevenlabs/route.ts # Call completion webhook
│       └── sms/route.ts          # Send SMS
│
├── agents/                       # Claude Agent SDK scripts
│   ├── agency_researcher.py      # Find & qualify agencies
│   ├── brand_scraper.py          # Extract branding from websites
│   ├── page_generator.py         # Generate HTML pages
│   └── listing_scraper.py        # Find matching listings
│
├── skills/                       # Claude Agent Skills
│   └── landing-page-designer/
│       └── SKILL.md              # Instructions for beautiful HTML
│
├── lib/
│   ├── elevenlabs.ts             # 11 Labs API wrapper
│   ├── twilio.ts                 # Twilio SMS/call helpers
│   └── types.ts                  # TypeScript interfaces
│
├── generated/                    # Generated HTML pages (static)
│   ├── demo/                     # Agency demo pages
│   └── caller/                   # Post-call pages
│
└── public/
    └── assets/                   # Static assets
```

---

## 🔗 Integration Details

### ElevenLabs + Twilio Setup

**Overview:**
ElevenLabs has a native Twilio integration that handles all the complexity. We just need to:
1. Create an ElevenLabs Conversational AI agent
2. Import our Twilio number into ElevenLabs
3. Assign the agent to handle calls on that number

**Setup Steps:**

```
1. TWILIO SETUP
   ├── Create Twilio account
   ├── Buy Australian phone number (+61)
   ├── Note Account SID and Auth Token
   
2. ELEVENLABS SETUP
   ├── Create ElevenLabs account
   ├── Go to Agents Platform dashboard
   ├── Create new Conversational AI agent
   │   ├── Select voice (Australian female)
   │   ├── Set system prompt (see below)
   │   └── Configure knowledge base (agency context)
   ├── Go to Phone Numbers tab
   ├── Import Twilio number
   │   ├── Enter phone number
   │   ├── Enter Twilio SID
   │   └── Enter Twilio Auth Token
   └── Assign agent to phone number
   
3. WEBHOOK SETUP
   ├── Configure ElevenLabs webhook URL
   │   └── https://our-app.com/api/webhook/elevenlabs
   └── Receive call_completed events
```

**ElevenLabs Agent System Prompt:**

```
You are Lisa, an AI assistant for {{agency_name}}, a real estate agency in {{agency_location}}.

Your goal is to warmly greet callers and gather key information to help them.

ALWAYS:
- Be warm, friendly, and professional
- Use an Australian conversational style
- Keep responses brief (1-2 sentences)
- Ask only essential questions

GATHER THIS INFORMATION:
1. What brings them in today? (buy/sell/rent)
2. What suburb or area are they interested in?
3. Their name for follow-up
4. Optionally: budget range

CLOSING:
After gathering info, say:
"Perfect! I'm preparing some tailored information for you right now. 
I'll text you a link with everything you need. 
Thanks for calling {{agency_name}}!"

DO NOT:
- Pretend to have access to live listings
- Make up property details
- Promise specific callbacks from agents
- Ask more than 4 questions
```

**Webhook Payload (call_completed):**

```typescript
interface ElevenLabsWebhook {
  event: "call_completed";
  call_id: string;
  agent_id: string;
  phone_number: string;
  caller_phone: string;
  duration_seconds: number;
  transcript: string;           // Full conversation transcript
  metadata: {
    agency_id: string;
    agency_name: string;
  };
  // NOTE: We do NOT use ElevenLabs data extraction (variables field)
  // Claude Code skill extracts ALL data directly from the transcript
  // This provides more flexibility, accuracy, and no information loss
}
```

### Claude Agent SDK Usage

**Installation:**
```bash
pip install claude-agent-sdk
```

**Agency Research Agent:**

```python
# agents/agency_researcher.py
import anyio
from claude_agent_sdk import query, ClaudeAgentOptions

async def research_agencies(suburb: str, count: int = 10):
    """
    Research and qualify real estate agencies in a suburb.
    Returns ranked list by pain score.
    """
    
    options = ClaudeAgentOptions(
        system_prompt="""
        You are a real estate agency researcher. Your task is to:
        1. Search for real estate agencies in the specified suburb
        2. Visit their websites and extract key information
        3. Calculate a "pain score" based on their likelihood to need Voqo AI
        4. Return structured JSON with the top agencies
        
        For each agency, extract:
        - Name, website, phone, email
        - Team size (count agents on team page)
        - Listing count (check listings page)
        - Has property management (check services)
        - Has after-hours number (check contact page)
        - Has chat widget (check homepage)
        - Logo URL and brand colors
        
        Pain Score Calculation:
        - High listing volume (30+): +20 points
        - Has property management: +25 points
        - Small team (<5) with high volume: +20 points
        - No after-hours number: +15 points
        - No chat widget: +10 points
        """,
        allowed_tools=["Bash", "Read", "Write", "WebSearch", "WebFetch"],
        max_turns=50
    )
    
    prompt = f"""
    Research the top {count} real estate agencies in {suburb}, Australia.
    
    For each agency:
    1. Find their website
    2. Extract branding (logo, colors)
    3. Count team members and listings
    4. Check for after-hours and chat solutions
    5. Calculate pain score
    
    Output as JSON array sorted by pain score (highest first).
    Save to /output/agencies_{suburb.replace(' ', '_')}.json
    """
    
    result = []
    async for message in query(prompt=prompt, options=options):
        # Process streaming messages
        result.append(message)
    
    return result

if __name__ == "__main__":
    anyio.run(research_agencies, "Surry Hills")
```

**Landing Page Generator Agent:**

```python
# agents/page_generator.py
import anyio
from claude_agent_sdk import query, ClaudeAgentOptions
from pathlib import Path

async def generate_demo_page(agency_data: dict) -> str:
    """
    Generate a beautiful, personalized demo landing page for an agency.
    Uses the landing-page-designer skill.
    """
    
    options = ClaudeAgentOptions(
        system_prompt="""
        You are a landing page designer. You create beautiful, 
        conversion-optimized HTML pages.
        
        Use the landing-page-designer skill in .claude/skills/
        Follow its instructions precisely.
        
        The page must:
        - Use the agency's exact brand colors
        - Include their logo
        - Feel premium and professional
        - Have a clear call-to-action (phone number)
        - Show personalized ROI calculations
        - Be mobile-responsive
        - Use Tailwind CSS via CDN
        """,
        allowed_tools=["Read", "Write", "Bash"],
        max_turns=20,
        setting_sources=["project"]  # Load skills from project
    )
    
    prompt = f"""
    Create a demo landing page for this agency:
    
    {json.dumps(agency_data, indent=2)}
    
    The page should:
    1. Use their logo: {agency_data['logoUrl']}
    2. Use their brand colors: {agency_data['primaryColor']}, {agency_data['secondaryColor']}
    3. Show their pain points and ROI potential
    4. Include a prominent "Call Demo" button with number: +61 XXX XXX XXX
    
    Save the HTML file to: /output/demo/{agency_data['id']}.html
    """
    
    async for message in query(prompt=prompt, options=options):
        pass  # Stream processing
    
    # Return path to generated file
    return f"/output/demo/{agency_data['id']}.html"
```

### Claude Agent Skill: Landing Page Designer

```markdown
# skills/landing-page-designer/SKILL.md

# Landing Page Designer Skill

You are an expert landing page designer specializing in real estate and SaaS demos.

## Design Principles

1. **Visual Hierarchy**: Lead with the value proposition, support with proof points
2. **Brand Consistency**: Match the target agency's exact colors and feel
3. **Mobile First**: All designs must work on mobile
4. **Speed**: Use inline CSS/Tailwind, minimal dependencies
5. **Conversion Focus**: Single clear CTA above the fold

## Technical Requirements

- Use Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Inline all critical CSS
- No external JavaScript dependencies
- Images via URL only (no base64)
- Semantic HTML5

## Page Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{agency_name}} | Voqo AI Demo</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: '{{primary_color}}',
                        'brand-dark': '{{secondary_color}}'
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-gray-50">
    <!-- Header with logo -->
    <!-- Hero with voice demo CTA -->
    <!-- Pain points section -->
    <!-- ROI calculator -->
    <!-- Final CTA -->
    <!-- Footer -->
</body>
</html>
```

## Color Usage

- Primary brand color: Headers, buttons, accents
- Secondary color: Hover states, borders
- Gray-50: Background
- White: Cards
- Gray-900: Body text

## Typography

- Headings: font-bold, tracking-tight
- Body: font-normal, leading-relaxed
- CTAs: font-semibold, uppercase for buttons

## Example Components

### Hero Section
```html
<section class="bg-brand text-white py-16 px-4">
    <div class="max-w-4xl mx-auto text-center">
        <img src="{{logo_url}}" alt="{{agency_name}}" class="h-12 mx-auto mb-8 brightness-0 invert">
        <h1 class="text-4xl font-bold mb-4">Never Miss Another Enquiry</h1>
        <p class="text-xl opacity-90 mb-8">AI-powered call handling for {{agency_name}}</p>
        <a href="tel:{{demo_phone}}" class="inline-block bg-white text-brand px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-100 transition">
            📞 Try Demo: {{demo_phone}}
        </a>
    </div>
</section>
```

### Pain Points Card
```html
<div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
    <div class="text-3xl mb-3">📊</div>
    <h3 class="font-bold text-lg mb-2">{{pain_title}}</h3>
    <p class="text-gray-600">{{pain_description}}</p>
</div>
```

## Always Include

1. Agency logo (inverted if on dark background)
2. Demo phone number (prominent, clickable)
3. At least 3 personalized pain points
4. ROI calculation based on their data
5. "Powered by Voqo AI" footer
6. Mobile-responsive design
```

---

## 🔄 Data Flow

### System 1: Agency Search → Demo Page

```
User enters suburb
        │
        ▼
┌─────────────────────┐
│ Next.js API Route   │
│ /api/search         │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Claude Agent SDK    │
│ agency_researcher.py│
│                     │
│ • Web search        │
│ • Scrape websites   │
│ • Extract branding  │
│ • Calculate scores  │
└─────────────────────┘
        │
        ▼
Return top 10 agencies as JSON
        │
        ▼
Display in UI with [Generate Demo] buttons
        │
        ▼
User clicks [Generate Demo]
        │
        ▼
┌─────────────────────┐
│ Next.js API Route   │
│ /api/generate-demo  │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Claude Agent SDK    │
│ page_generator.py   │
│                     │
│ • Load skill        │
│ • Generate HTML     │
│ • Save to disk      │
└─────────────────────┘
        │
        ▼
Return URL to generated page
        │
        ▼
Redirect user to /demo/[agencyId]
```

### System 2: Call → Post-Call Page

```
User calls demo number
        │
        ▼
┌─────────────────────┐
│ Twilio routes call  │
│ to ElevenLabs       │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ ElevenLabs Agent    │
│ handles conversation│
│                     │
│ • Greets caller     │
│ • Asks questions    │
│ • Extracts data     │
│ • Says goodbye      │
└─────────────────────┘
        │
        ▼
Call ends → Webhook fired
        │
        ▼
┌─────────────────────┐
│ Next.js API Route   │
│ /api/webhook/       │
│   elevenlabs        │
│                     │
│ • Parse transcript  │
│ • Extract variables │
│ • Store call data   │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Claude Agent SDK    │
│ page_generator.py   │
│                     │
│ • Generate page     │
│ • Include caller    │
│   requirements      │
│ • Add listings      │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Twilio SMS API      │
│                     │
│ Send SMS with link: │
│ "Hi [Name], here's  │
│ your info: [URL]"   │
└─────────────────────┘
        │
        ▼
Caller receives SMS → Opens personalized page
```

---

## ⏱️ Implementation Timeline (Hackathon)

### Hour 0-2: Setup
- [ ] Initialize Next.js project
- [ ] Set up Digital Ocean droplet
- [ ] Configure Twilio account + buy number
- [ ] Configure ElevenLabs account + create agent
- [ ] Connect Twilio number to ElevenLabs
- [ ] Test basic call flow

### Hour 2-4: System 1 - Agency Finder
- [ ] Build main search UI
- [ ] Create agency_researcher.py agent
- [ ] Test agency scraping
- [ ] Build agency list display component

### Hour 4-6: System 1 - Demo Page Generator
- [ ] Create landing-page-designer skill
- [ ] Create page_generator.py agent
- [ ] Test HTML generation
- [ ] Build demo page serving route

### Hour 6-8: System 2 - Voice + Post-Call
- [ ] Configure ElevenLabs agent prompt
- [ ] Set up webhook endpoint
- [ ] Create post-call page generator
- [ ] Integrate Twilio SMS
- [ ] Test full call → page → SMS flow

### Hour 8-10: Polish + Demo Prep
- [ ] UI polish
- [ ] Error handling
- [ ] Generate sample pages for demo
- [ ] Prepare demo script
- [ ] Record backup demo video

---

## 🎤 Demo Script

```
"We built Voqo a sales engine.

[SHOW MAIN PAGE]
This finds and qualifies agencies that need Voqo. 
Let me search for Sydney CBD agencies.

[RESULTS APPEAR]
These are ranked by 'pain score' - how badly they need help.
Ray White Surry Hills has 45 listings, no after-hours solution, 
and a small team. Pain score: 87.

[CLICK GENERATE DEMO]
Now watch this. We're generating a personalized demo page
using their actual branding, their colors, their logo.

[DEMO PAGE LOADS]
This is what their sales team can send. 
Their colors. Their ROI calculation. One-click demo.

[CALL THE NUMBER]
But here's the magic. When a prospect calls this number...

[AI PICKS UP]
Hi! Thanks for calling Ray White Surry Hills...

[HAVE CONVERSATION]
I'm looking to buy in Surry Hills, around $1.2M...

[CALL ENDS - SMS ARRIVES]
And 10 seconds later, they get THIS.

[SHOW POST-CALL PAGE]
A personalized landing page with their requirements,
matching listings, and next steps.

This is what Voqo's customers will experience.
And this is what Voqo's sales team can use to close deals.

500 agencies. Personalized demos. One click."
```

---

## 📋 Environment Variables

```bash
# .env.local

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+61...

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...

# App
NEXT_PUBLIC_APP_URL=https://voqo-demo.com
NEXT_PUBLIC_DEMO_PHONE=+61 XXX XXX XXX
```

---

## ⚠️ Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude Agent SDK slow | Demo lag | Pre-generate 10 pages before demo |
| Twilio/11Labs issues | No voice demo | Have recorded call as backup |
| Web scraping blocks | Missing data | Use manual fallback data |
| Rate limits | Generation fails | Batch generate, cache results |

---

## 🏆 Success Criteria

1. **Functional Demo**: Full flow works end-to-end
2. **Visual Impact**: Generated pages look professional
3. **Speed**: Page generation < 60 seconds
4. **Voice Quality**: Natural conversation feel
5. **Wow Factor**: Voqo team says "we want this"

---

## Next Steps

1. **CONFIRM**: Review this spec, flag any changes
2. **SETUP**: Create accounts (Twilio, ElevenLabs)
3. **BUILD**: Start with System 1 (most visual impact)
4. **INTEGRATE**: Add voice after core works
5. **POLISH**: Make it demo-ready

---

*Document Version: 1.0*
*Last Updated: [Current Date]*