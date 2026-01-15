# Phase 3: Skills Setup

## What & Why
Create Claude Code skills for agency research, demo page generation, and post-call page generation. Skills use natural language descriptions (no hardcoded HTML) to enable creative, polished designs.

## Prerequisites
- Phase 1 & 2 complete: Project structure exists, dev server runs
- `.claude/skills/` directories created

## Execution Context
| Action Type | How to Execute |
|-------------|----------------|
| Local code | Write tool to create SKILL.md files |
| Verification | `ls` to confirm files, `npm run build` to ensure no conflicts |

---

## IMPLEMENTATION STEPS

### Step 3.1: Create Agency Researcher Skill
**Why**: Enables Claude to autonomously research real estate agencies in a suburb using web search and browser.

**Actions**:
- Create file: `.claude/skills/agency-researcher/SKILL.md`

**Code**:
```markdown
---
name: agency-researcher
description: Find and qualify real estate agencies in a given suburb
---

# Agency Researcher Skill

You are an expert real estate industry researcher. Find, analyze, and qualify real estate agencies in Australian suburbs.

## Mission

Given a suburb name, find top real estate agencies and gather comprehensive data for each. This data powers personalized demo pages.

## Research Process

### Step 1: Initial Search

Search for agencies using queries like:
- "[suburb] real estate agents"
- "[suburb] real estate agencies"
- "best real estate agents [suburb] Sydney"

Use WebSearch. Aim for 8-12 agencies initially.

### Step 2: For Each Agency, Gather Data

Visit each agency website via Chrome browser tools. Extract:

**Basic Info**
- Agency Name (official business name)
- Website URL
- Phone Number (header, footer, contact page)
- Email (general enquiry)
- Address (physical office)

**Branding (CRITICAL)**
- Logo URL: Direct image URL (.png/.svg/.jpg), publicly accessible
- Primary Brand Color: Main color (hex code from header/buttons/headings)
- Secondary Color: Accent color (hex code from hover states/borders)

**Team & Size**
- Team Size: Count agents on "Our Team" page
- Principal/Owner Name: Look for "Principal", "Director", "Owner"

**Listing Activity**
- Active Listings Count: From properties/listings page
- Has Property Management: Check services for PM/Rentals/Landlords (boolean)

**Pain Indicators**
- Has After-Hours Number: Check for "after hours", "24/7" (boolean)
- Has Chat Widget: Look for Intercom/Drift/LiveChat bubble (boolean)
- Has Online Booking: Inspection booking on listing pages (boolean)

**Reviews (optional)**
- Search "[Agency Name] reviews"
- Note any "couldn't reach", "didn't answer" mentions

### Step 3: Calculate Pain Score (0-100)

```
Base: 0

+20 if 30+ listings
+15 if 20-29 listings
+10 if 10-19 listings

+25 if has Property Management

+20 if <5 agents AND 20+ listings
+15 if <3 agents AND 10+ listings

+15 if no after-hours number
+10 if no chat widget
+5 if no online booking
+10 if bad review signals
```

### Step 4: Generate Pain Reasons

Create specific pain points list:
- "45 active listings generating high call volume"
- "Team of only 4 agents managing 30+ properties"
- "No after-hours contact solution"

### Step 5: Output Format

Save to `/data/agencies/[suburb-slug].json`:

```json
{
  "suburb": "Surry Hills",
  "searchedAt": "2025-01-15T10:30:00Z",
  "agencies": [
    {
      "id": "ray-white-surry-hills",
      "name": "Ray White Surry Hills",
      "website": "https://raywhitesurryhills.com.au",
      "phone": "+61 2 9361 6000",
      "email": "surryhills.nsw@raywhite.com",
      "address": "123 Crown Street, Surry Hills NSW 2010",
      "branding": {
        "logoUrl": "https://raywhitesurryhills.com.au/logo.png",
        "primaryColor": "#ffe512",
        "secondaryColor": "#1a1a1a"
      },
      "metrics": {
        "teamSize": 6,
        "listingCount": 45,
        "hasPropertyManagement": true,
        "hasAfterHoursNumber": false,
        "hasChatWidget": false,
        "hasOnlineBooking": true,
        "principalName": "John Smith"
      },
      "painScore": 87,
      "painReasons": [
        "45 active listings generating high call volume",
        "No after-hours contact solution"
      ],
      "notes": "Major franchise"
    }
  ]
}
```

Also save individual files: `/data/agencies/[agency-id].json`

## Quality Guidelines

- Logo URL must be direct image URL, publicly accessible
- Use hex values for colors, not color names
- Phone numbers: +61 or 02/03/07/08 format
- Use null for missing data, not empty string
- Don't make up data
```

**Verify**:
- [x] File exists at `.claude/skills/agency-researcher/SKILL.md`
- [x] Contains YAML frontmatter with name/description

**Status**: [✓] Complete

---

### Step 3.2: Create Demo Page Builder Skill
**Why**: Enables Claude to generate branded landing pages from agency data with full creative freedom.

**Actions**:
- Create file: `.claude/skills/demo-page-builder/SKILL.md`

**Code**:
```markdown
---
name: demo-page-builder
description: Generate branded demo landing pages for real estate agencies
---

# Demo Page Builder Skill

You are an expert landing page designer. Create stunning, conversion-focused demo pages showcasing Voqo AI voice agent capabilities.

## Design Philosophy

- **Brand Authenticity**: Page feels like it belongs to the agency
- **Professional Polish**: Premium look that impresses decision-makers
- **Clear Value Prop**: Immediately show why they need Voqo
- **Single CTA Focus**: One action - call the demo number
- **Mobile First**: Perfect on phones (agents browse mobile)
- **Modern & Clean**: Smooth animations, elegant transitions, contemporary design patterns

## Technical Requirements

- Single HTML file, fully self-contained
- Tailwind CSS via CDN
- Minimal JavaScript (call registration + polling only)
- No external dependencies beyond CDN

## Page Design Requirements

Create a beautiful, modern landing page with these sections. Design freely - use your creativity for layout, animations, and visual hierarchy. Make it feel premium.

### 1. Header
- Agency logo + "× Voqo AI" co-branding
- Sticky navigation
- Prominent "Call Demo" button
- Clean, minimal design

### 2. Hero Section
- Bold headline: convey "Never miss another enquiry"
- Subheadline personalized with agency name
- Large, eye-catching CTA button with phone icon
- Use agency brand colors as gradient or solid background
- Consider subtle animations (fade-in, gentle pulse on CTA)

### 3. Pain Points Section
- Title: "Why [Agency Name] Needs This"
- 3 cards highlighting specific pain points from agency data
- Generate cards dynamically based on:
  - High listing count → call volume pain
  - No after-hours → missed evening/weekend calls
  - Has PM → rental enquiry overload
  - Small team + many listings → understaffed
  - No chat → web lead capture gap
- Use icons, clean typography, subtle hover effects

### 4. ROI Calculator Section
- Side-by-side comparison: "The Problem" vs "The Solution"
- Calculate and display:
  - Active listings (from data)
  - Est. calls/month (listings × 8)
  - Est. missed calls (calls × 0.35)
  - Lost revenue/month (missed × $150)
  - Voqo cost ($199/mo)
  - Revenue saved
  - ROI multiplier
- Visual contrast between red (problem) and green (solution)
- Make the ROI number prominent and satisfying

### 5. How It Works Section
- 3 steps with numbered indicators:
  1. Caller dials number → AI answers when busy/after hours
  2. AI handles conversation → understands property needs
  3. Instant follow-up → personalized recommendations sent
- Consider timeline or connected step design
- Keep explanations concise

### 6. Final CTA Section
- Compelling headline: "Experience It Yourself"
- Large call button with phone number
- Agency brand colors
- Create urgency without being pushy

### 7. Footer
- "Demo powered by Voqo AI"
- "AI Voice Agents for Real Estate"
- Minimal, professional

### 8. Required JavaScript Functionality

Embed this functionality (implement cleanly):

```javascript
// Agency data object with: id, name, location, phone, teamSize, listingCount, hasPropertyManagement

// registerCall() function:
// - POST to /api/register-call with agencyData + timestamp
// - On success, start pollForResults()

// pollForResults() function:
// - Poll /api/call-status?agency={id} every 3 seconds
// - When status=completed && pageUrl exists, show result notification
// - Stop after 5 minutes

// showCallResult(data) function:
// - Display success notification with link to pageUrl
// - Smooth scroll to notification
```

### Results Container
- Hidden initially
- When call completes, show elegant success notification
- Link to personalized post-call page
- Smooth animation on appearance

## Data Mapping

Use agency data to populate:
- agency.name → agency name throughout
- agency.id → for API calls
- agency.address → extract suburb/city for location
- agency.phone → agency contact
- agency.branding.logoUrl → header logo
- agency.branding.primaryColor → brand color theming
- agency.branding.secondaryColor → gradients, accents
- agency.metrics.listingCount → ROI calculations
- agency.metrics.teamSize → pain cards if relevant
- agency.metrics.hasPropertyManagement → pain cards
- agency.metrics.hasAfterHoursNumber → pain cards
- agency.metrics.hasChatWidget → pain cards
- agency.painReasons → pain card content

Demo phone number comes from environment: NEXT_PUBLIC_DEMO_PHONE

## Output

Save to: `/public/demo/[agency-id].html`

## Quality Checklist

- Logo loads correctly
- Colors are visible, not clashing
- Phone number clickable (tel: link)
- Pain points relevant to this agency
- ROI numbers calculated correctly
- Fully responsive
- No JavaScript errors
- Animations smooth, not distracting
- Agency data embedded in script
```

**Verify**:
- [x] File exists at `.claude/skills/demo-page-builder/SKILL.md`
- [x] Contains YAML frontmatter with name/description

**Status**: [✓] Complete

---

### Step 3.3: Create Post-Call Page Builder Skill
**Why**: Enables Claude to generate personalized post-call pages from voice transcripts with creative design freedom.

**Actions**:
- Create file: `.claude/skills/postcall-page-builder/SKILL.md`

**Code**:
```markdown
---
name: postcall-page-builder
description: Generate personalized post-call landing pages from voice transcripts
---

# Post-Call Page Builder Skill

You are an expert at creating personalized real estate landing pages. Analyze call transcripts, extract requirements, find matching properties, generate beautiful follow-up pages.

## Mission

Given transcript + agency context, create personalized page that:
1. Acknowledges caller by name
2. Summarizes their requirements
3. Shows relevant property listings
4. Provides clear next steps

## Input Data

You receive:
```json
{
  "callId": "call-abc123",
  "transcript": "Agent: Hi! Thanks for calling...",
  "extractedData": {
    "caller_name": "Sarah",
    "intent": "buy",
    "preferred_location": "Surry Hills or Darlinghurst",
    "budget_range": "$800k to $1.2M"
  },
  "agencyData": {
    "id": "ray-white-surry-hills",
    "name": "Ray White Surry Hills",
    "branding": { "logoUrl": "...", "primaryColor": "#ffe512", "secondaryColor": "#1a1a1a" }
  }
}
```

## Processing Steps

### Step 1: Analyze Transcript

If extractedData incomplete, parse transcript for:
- Caller name: "My name is...", "I'm...", "This is..."
- Intent: "looking to buy", "want to sell", "need to rent"
- Location: suburb names, area descriptions
- Budget: dollar amounts, price ranges
- Property type: house, apartment, unit, townhouse
- Bedrooms: "3 bedroom", "2 bed"
- Special requirements: parking, garden, pool, pets

### Step 2: Search for Listings

Use web search to find matching properties:

1. Primary: Agency website listings page
2. Fallback: realestate.com.au, domain.com.au
3. Search: "[location] [type] for [intent] [budget]"

For each listing extract:
- Property address
- Price/guide
- Bedrooms, bathrooms, parking
- Image URL (main photo)
- Listing URL
- Key features (brief)

### Step 3: Generate Page

Create beautiful, personalized HTML page.

## Technical Requirements

- Single HTML file, self-contained
- Tailwind CSS via CDN
- No external dependencies
- Mobile-first responsive

## Page Design Requirements

Design a warm, personalized experience. Be creative with layout and animations. Make it feel like a premium, thoughtful follow-up.

### 1. Header
- Agency logo
- "Prepared just for you" or similar personal touch
- Clean, minimal

### 2. Personalized Greeting
- Warm welcome using caller's name
- Thank them for calling agency
- Brief intro: "Here's what we found based on your requirements"
- Use agency brand colors
- Make it feel personal, not robotic

### 3. Requirements Summary
- Visual display of their search criteria
- Cards/badges showing:
  - Intent (Buy/Sell/Rent)
  - Location preference
  - Budget range
  - Property type (if mentioned)
  - Bedrooms (if mentioned)
- Use icons for visual appeal
- Clean grid or flex layout

### 4. Matching Listings
- Title: "Properties You Might Love"
- Subtitle: "Based on your conversation with us"
- 3-5 property cards, each showing:
  - Property image (prominent)
  - Address
  - Price
  - Bed/bath/car counts
  - Brief description
  - "View Details" button (links to listing)
  - "Book Inspection" button (if available)
- Modern card design with hover effects
- Consider image zoom on hover, subtle shadows

If no exact matches:
- Show similar/nearby properties
- Include friendly notice: "No exact matches right now, but here are similar options. We'll notify you when something perfect comes up!"

### 5. Next Steps Section
- 3 action cards:
  1. Book Inspections - see properties in person
  2. Get Alerts - new listings matching criteria
  3. Talk to Agent - personalized advice (agency phone)
- Clear CTAs
- Icons for each action

### 6. Footer
- "Prepared by [Agency Name]"
- "Powered by Voqo AI"
- Generation timestamp
- Professional, minimal

## Data Mapping

- caller_name → greeting, page title
- intent → requirements display, "Buy"/"Sell"/"Rent"
- preferred_location → requirements display
- budget_range → requirements display
- agencyData.name → throughout
- agencyData.branding.* → colors, logo
- agencyData.phone → contact CTA

## Output Files

1. HTML page: `/public/call/[call-id].html`

2. Call data JSON: `/data/calls/[call-id].json`
```json
{
  "callId": "call-abc123",
  "timestamp": "2025-01-15T10:30:00Z",
  "agencyId": "ray-white-surry-hills",
  "callerName": "Sarah",
  "requirements": {
    "intent": "buy",
    "location": "Surry Hills or Darlinghurst",
    "budget": "$800k-$1.2M",
    "propertyType": null,
    "bedrooms": null
  },
  "listingsShown": [
    { "address": "12/45 Crown Street", "price": "$950,000", "url": "..." }
  ],
  "pageUrl": "/call/call-abc123",
  "generatedAt": "2025-01-15T10:32:00Z"
}
```

## Quality Standards

- Show 3-5 listings (not overwhelming)
- All images must load
- Prices match budget range
- Locations match preference
- Fully responsive
- Smooth animations
- Personal, warm tone throughout
```

**Verify**:
- [x] File exists at `.claude/skills/postcall-page-builder/SKILL.md`
- [x] Contains YAML frontmatter with name/description

**Status**: [✓] Complete

---

### Step 3.4: Create CLAUDE.md
**Why**: Project overview for Claude Code to understand available skills and structure.

**Actions**:
- Create file: `CLAUDE.md` in project root

**Code**:
```markdown
# VoqoLeadEngine

Lead generation demo for Voqo AI.

## Available Skills

- **agency-researcher**: Find and qualify real estate agencies in a suburb
- **demo-page-builder**: Generate branded demo landing pages (creative design)
- **postcall-page-builder**: Generate personalized post-call pages from transcripts

## Project Structure

- `/data/agencies/` - Agency JSON data
- `/data/calls/` - Call transcripts and results
- `/data/context/` - Pending call context
- `/public/demo/` - Generated demo HTML pages
- `/public/call/` - Generated post-call HTML pages

## Guidelines

- Use Tailwind CSS via CDN in all generated HTML
- Save data as JSON files
- Use web search for real-time data
- Generate static HTML files
- Design pages creatively - no rigid templates
- Prioritize mobile responsiveness
- Use smooth, subtle animations
```

**Verify**:
- [x] File exists at `CLAUDE.md` in project root

**Status**: [✓] Complete

---

### Step 3.5: Phase Checkpoint
**Why**: Ensure phase is complete before moving on

**Verify**:
- [x] `.claude/skills/agency-researcher/SKILL.md` created
- [x] `.claude/skills/demo-page-builder/SKILL.md` created
- [x] `.claude/skills/postcall-page-builder/SKILL.md` created
- [x] `CLAUDE.md` created in project root
- [x] `npm run build` still succeeds

**Status**: [✓] Complete

---

## VALIDATION

1. `ls -la .claude/skills/*/` shows 3 SKILL.md files
2. Each SKILL.md has YAML frontmatter with `name:` and `description:`
3. `CLAUDE.md` exists in project root
4. `npm run build` passes
5. No hardcoded HTML templates in skills - all design requirements are descriptive
