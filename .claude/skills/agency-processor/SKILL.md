---
name: agency-processor
description: Extract agency data and generate demo page with real-time progress updates
---

# Agency Processor Skill

You process a single real estate agency: extract details and generate its demo page.

## CRITICAL: Progress Updates

You MUST write progress updates to /data/progress/agency-{agencyId}.json at each milestone.
The UI displays these updates in real-time. Users see your progress as it happens.

## Input

You receive:
- agencyId: URL-safe slug
- sessionId: Pipeline session ID
- website: Agency website URL
- name: Agency name (from initial search)

## Process

### Phase 1: Extract Data

#### 1.1 Fetch Homepage
Use WebFetch to get the agency homepage.
Update progress: status = "extracting"

#### 1.2 Extract Logo
Look for logo in:
- <img> tags with "logo" in src/alt/class
- og:image meta tag
- favicon as fallback

Update progress: logoUrl = "{url}"

#### 1.3 Extract Colors
Analyze the page content for brand colors:
- Look for CSS color patterns in style attributes
- Common header/button colors
- If WebFetch returns HTML, parse inline styles
- Look for brand color in meta tags or CSS variables

Common Australian real estate brand colors:
- Ray White: #ffe512 (yellow)
- LJ Hooker: #e4002b (red)
- McGrath: #e31937 (red)
- Raine & Horne: #002b5c (navy blue)
- Century 21: #846b36 (gold)
- PRD: #c8102e (red)
- Belle Property: #1a1a1a (black)

Update progress: primaryColor = "#xxx", secondaryColor = "#xxx"

#### 1.4 Extract Contact Info
Find:
- Phone number (Australian format: +61 or 02/03/07/08)
- Address

Update progress: phone = "...", address = "..."

#### 1.5 Extract Metrics
Use WebFetch on team/about pages:
- Count team members
- Find listing counts

Use WebSearch if needed:
- "{agency name} listings"
- "{agency name} team"

Update progress: teamSize = N, listingCount = N

#### 1.6 Calculate Pain Score
Apply scoring formula:
- 30+ listings: +20
- 20-29 listings: +15
- 10-19 listings: +10
- Has Property Management: +25
- <5 agents + 20+ listings: +20
- <3 agents + 10+ listings: +15
- No after-hours number: +15
- No chat widget: +10
- No online booking: +5

Update progress: painScore = N, status = "generating"

### Phase 2: Generate Demo Page

#### 2.1 Start Generation
Update progress: htmlProgress = 10

#### 2.2 Build HTML
Generate complete HTML file with:
- Tailwind CSS via CDN
- Agency branding (logo, colors)
- Pain points section based on calculated pain reasons
- ROI calculator with real numbers
- Call demo button with phone number from env
- Embedded agency data for JS functionality

Use the demo-page-builder skill guidelines for design:
- Modern, clean, mobile-first design
- Smooth animations
- Clear CTA focus
- Agency brand colors throughout

Update progress: htmlProgress = 50

#### 2.3 Write HTML File
Save to: /public/demo/{agencyId}.html

The HTML must include:
1. Header with agency logo + Voqo co-branding
2. Hero section with CTA
3. Pain points cards (3 cards based on agency data)
4. ROI calculator section
5. How it works section
6. Final CTA section
7. Recent calls section (fetches from /api/agency-calls)
8. JavaScript for call registration and polling

Update progress: htmlProgress = 100, status = "complete", demoUrl = "/demo/{agencyId}"

### Phase 3: Save Agency Data

Write complete agency data to: /data/agencies/{agencyId}.json
(This is separate from progress file - it's the permanent record)

Format:
```json
{
  "id": "agency-slug",
  "name": "Agency Name",
  "website": "https://...",
  "phone": "+61...",
  "address": "...",
  "branding": {
    "logoUrl": "...",
    "primaryColor": "#...",
    "secondaryColor": "#..."
  },
  "metrics": {
    "teamSize": 5,
    "listingCount": 30,
    "hasPropertyManagement": true,
    "hasAfterHoursNumber": false,
    "hasChatWidget": false,
    "painScore": 75
  },
  "painReasons": [
    "30 active listings generating high call volume",
    "No after-hours contact solution"
  ],
  "extractedAt": "ISO timestamp"
}
```

## Progress File Format

Always write valid JSON to /data/progress/agency-{agencyId}.json:

```json
{
  "agencyId": "...",
  "sessionId": "...",
  "status": "extracting|generating|complete|error",
  "updatedAt": "ISO timestamp",
  "name": "...",
  "website": "...",
  "logoUrl": "..." or null,
  "primaryColor": "..." or null,
  "secondaryColor": "..." or null,
  "phone": "..." or null,
  "teamSize": N or null,
  "listingCount": N or null,
  "painScore": N or null,
  "htmlProgress": 0-100,
  "demoUrl": "..." or null,
  "error": "..." (only if status = "error")
}
```

## Error Handling

If extraction fails:
1. Set status = "error"
2. Set error = "reason"
3. The UI will remove this card

Do NOT retry - move on. The main agent handles retries if needed.

## Tool Restrictions

- DO NOT use Chrome, Playwright, or any browser automation tools
- Use ONLY: WebSearch, WebFetch, Read, Write, Glob

## Demo Phone Number

Use environment variable NEXT_PUBLIC_DEMO_PHONE for the call demo button.
If not available, use the placeholder: +61 XXX XXX XXX
