---
name: agency-processor
description: Extract agency data and generate a branded demo landing page with real-time progress updates. Optimized for speed and conversion.
---

# Agency Processor Skill (Single Agency)

<!--
================================================================================
CHANGELOG (2026-01-18)
================================================================================
Major refactor to improve speed and landing page quality:

REMOVED:
- Pain score calculation (Phase 2 deleted) - was slow and not useful for conversion
- WebSearch for metrics - unnecessary extra step
- Complex metrics: painScore, painReasons, hasPropertyManagement, hasChatWidget,
  hasAfterHoursNumber, hasOnlineBooking, soldCount, forRentCount, priceRangeMin/max
- Multiple WebFetch calls - now single fetch only

ADDED:
- Design System Selection - 7 design systems to choose from based on agency type
- Voqo branding requirement - "Presented by Voqo" on all pages
- Image extraction - heroImageUrl, teamImageUrl, officeImageUrl
- Tagline extraction - for personalized hero copy
- Landing Page Structure - focused on demo conversion, not information
- Banned elements list - avoid AI-slop colors, fonts, layouts
- Explicit extraction format - consistent data across all agencies

CHANGED:
- Workflow: 5 phases → 4 phases (removed pain score phase)
- WebFetch budget: ≤3 → ≤1 (homepage only)
- WebSearch budget: ≤1 → 0 (none)
- Landing page purpose: informational → conversion-focused
- Schema: simplified, removed unused fields

UNCHANGED:
- Activity streaming format and behavior
- Progress file update mechanics
- File paths and inputs
- Demo phone number requirement
- Error handling approach
================================================================================
-->

You process exactly one real-estate agency end-to-end:
1) Quickly extract branding + contact + images from homepage (single fetch).
2) Select appropriate design system based on agency type.
3) Generate a conversion-focused demo landing page.
4) Continuously update progress + activity so the UI streams smoothly.

## Hard Rules
- Do not spawn other agents.
- Do not use emojis in any text you write.
- Use only the absolute paths provided in the prompt.
- Do NOT use WebSearch - extract only from the homepage.
- Maximum 1 WebFetch call (homepage only).

## Inputs (from the prompt)
- `agencyId`: URL-safe slug (example: `ray-white-surry-hills`)
- `sessionId`: pipeline session ID
- `name`: agency name (best-effort)
- `website`: agency website URL
- `progressFilePath`: absolute path to `data/progress/agency-{agencyId}.json`
- `activityFilePath`: absolute path to `data/progress/agency-activity-{agencyId}.json`
- `demoHtmlPath`: absolute path to `public/demo/{agencyId}.html`
- `agencyDataPath`: absolute path to `data/agencies/{agencyId}.json`

## Tools Allowed
- Use only: `WebFetch`, `Read`, `Write`, `Glob`
- Do NOT use: `WebSearch`, browser automation tools

---

## Output Files (must write all)

### 1) Activity Stream (`activityFilePath`)

Store a single JSON object and append to `messages`:
```json
{
  "sessionId": "pipe-...",
  "agencyId": "ray-white-surry-hills",
  "agencyName": "Ray White Surry Hills",
  "messages": [
    {
      "id": "msg-<timestamp>-<rand>",
      "type": "thinking|tool|fetch|results|identified|warning",
      "text": "Short, user-facing update",
      "detail": "Optional: URL or query",
      "source": "Subagent",
      "timestamp": "2026-01-17T12:34:56.789Z"
    }
  ]
}
```

Rules:
- Every `id` must be unique (use timestamp + random suffix).
- Before `WebFetch`, append a `fetch` message with `detail` set to the URL.
- After each milestone, append a short `identified/results/thinking` message.
- Keep only the last 250 messages.

### 2) Progress File (`progressFilePath`)

<!-- CHANGED: Removed painScore, simplified metrics, added designSystem and image fields -->

Always write valid JSON with stable keys:
```json
{
  "agencyId": "...",
  "sessionId": "...",
  "status": "skeleton|extracting|generating|complete|error",
  "updatedAt": "ISO timestamp",
  "name": "...",
  "website": "...",
  "phone": null,
  "address": null,
  "email": null,
  "logoUrl": null,
  "primaryColor": null,
  "secondaryColor": null,
  "tagline": null,
  "heroImageUrl": null,
  "teamSize": null,
  "listingCount": null,
  "designSystem": null,
  "htmlProgress": 0,
  "demoUrl": null,
  "steps": [
    { "id": "website", "label": "Found website", "status": "pending|in_progress|complete|error" },
    { "id": "details", "label": "Extracted details", "status": "pending|in_progress|complete|error" },
    { "id": "generating", "label": "Generating demo page", "status": "pending|in_progress|complete|error" },
    { "id": "complete", "label": "Ready", "status": "pending|in_progress|complete|error" }
  ],
  "error": null
}
```

Rules:
- Update `updatedAt` on every write.
- Never remove keys; set missing fields to `null`.

### 3) Agency Record (`agencyDataPath`)

<!-- CHANGED: Removed painScore, painReasons, complex metrics. Added images and designSystem. -->

Write the durable record used by the rest of the system:
```json
{
  "id": "ray-white-surry-hills",
  "name": "Ray White Surry Hills",
  "website": "https://...",
  "phone": "02 ...",
  "email": null,
  "address": "Full street address",
  "tagline": null,
  "branding": {
    "logoUrl": null,
    "primaryColor": "#0f172a",
    "secondaryColor": "#ffffff",
    "heroImageUrl": null,
    "teamImageUrl": null,
    "officeImageUrl": null
  },
  "metrics": {
    "teamSize": null,
    "listingCount": null
  },
  "researchedAt": "ISO timestamp",
  "dataQuality": "complete|partial|minimal",
  "notes": null,
  "demoPage": {
    "generated": true,
    "generatedAt": "ISO timestamp",
    "url": "/demo/ray-white-surry-hills",
    "designSystem": "editorial-prestige"
  }
}
```

---

## Performance Targets

<!-- CHANGED: Reduced from 3 WebFetch + 1 WebSearch to just 1 WebFetch -->

| Metric | Target |
|--------|--------|
| WebFetch calls | 1 (homepage only) |
| WebSearch calls | 0 (none) |
| Progress file writes | 4-5 |
| Total time per agency | <30 seconds |

If data is unclear after fetching homepage, set unknown fields to `null` and proceed.
Do NOT do additional fetches for missing data.

---

## Information Extraction Format

<!-- NEW: Explicit extraction format for consistency across all agencies -->

Extract these fields from the homepage HTML in a single pass:

### Required (must find or set null)

| Field | Where to Look | Format |
|-------|---------------|--------|
| `logoUrl` | `<img>` with "logo" in src/alt/class, `<link rel="icon">` | Full URL |
| `phone` | Links with `tel:`, text matching phone patterns (02, 04, 1300, 1800) | Australian format |
| `address` | Footer, contact section, schema.org LocalBusiness markup | Full street address |

### Best-effort (extract if visible on homepage)

| Field | Where to Look | Format |
|-------|---------------|--------|
| `email` | Links with `mailto:`, visible email text | email@domain.com |
| `primaryColor` | Header/nav background, brand elements, logo colors | Hex (#RRGGBB) |
| `secondaryColor` | CTA buttons, accent elements, links | Hex (#RRGGBB) |
| `tagline` | Hero section text, `<meta name="description">`, slogan | Short string |
| `teamSize` | "X agents" text, team count if visible | Number or null |
| `listingCount` | "X properties" text, listing count if visible | Number or null |

### Images (for landing page enhancement)

| Field | Where to Look | Format |
|-------|---------------|--------|
| `heroImageUrl` | Hero section background, main banner `<img>` | Full URL |
| `teamImageUrl` | Team/about section photos | Full URL |
| `officeImageUrl` | Office exterior/interior photos | Full URL |

### DO NOT extract (removed for speed)
- soldCount, forRentCount, priceRangeMin, priceRangeMax
- painScore, painReasons
- hasPropertyManagement, hasChatWidget, hasAfterHoursNumber, hasOnlineBooking

---

## Design System Selection

<!-- NEW: Choose design system based on agency type for better visual quality -->

Before generating HTML, select ONE design system based on the agency:

### Selection Logic

```
AGENCY TYPE                                    → DESIGN SYSTEM
─────────────────────────────────────────────────────────────────
National franchise (Ray White, LJ Hooker,      → "swiss-precision"
Century 21, Raine & Horne, McGrath, Belle)       (clean, professional)

Boutique/independent agency                    → "editorial-prestige"
                                                 (distinctive, premium)

Luxury/prestige market indicators              → "quiet-luxury"
(words like "prestige", "exclusive", "luxury")   (refined, exclusive)

Modern/tech-forward agency                     → "cinematic-reveal"
(sleek website, modern branding)                 (dramatic, impactful)

Traditional/established agency                 → "warm-authority"
(est. dates, community focus)                    (trustworthy, approachable)

DEFAULT (when unsure)                          → "editorial-prestige"
                                                 (works for most)
```

Write the selected design system to `progress.designSystem` and `agencyRecord.demoPage.designSystem`.

### Design System Constraints (MUST FOLLOW)

#### Banned Colors (AI-slop - never use)
```
- Purple/violet/indigo: #6366F1, #8B5CF6, #A855F7, #7C3AED
- Neon cyan/teal: #00FF88, #00DDFF, #06B6D4
- ChatGPT green: #10A37F
- Any purple + green combinations
- Any blue-to-purple gradients
```

#### Banned Fonts (overused - never use)
```
- Inter (the #1 AI-slop font)
- Roboto, Open Sans, Lato
- Poppins, Montserrat
```

#### Approved Fonts (use these instead)
```
Headlines: Playfair Display, Space Grotesk, Cabinet Grotesk, Fraunces
Body: Source Serif 4, DM Sans, IBM Plex Sans, Outfit
```

#### Banned Layouts (AI-slop patterns)
```
- Three equal cards with icons in a horizontal row
- Symmetric 2x2 or 3x3 grids without hierarchy
- Purple gradient hero backgrounds
- Generic "feature cards" with icon + title + description
```

#### Required
- Light theme by default (warm whites: #FAFAF9, #F8F6F1)
- Use agency's extracted brand colors if found
- Fallback colors: navy (#1E3A5F), terracotta (#C2703A), forest green (#2D5A47)
- Mobile-responsive (test at 375px width)
- No emojis anywhere

---

## Landing Page Purpose & Structure

<!-- NEW: Focused on conversion, not information -->

### Primary Goal

The landing page has ONE goal: **Get the agency to try the voice AI demo**

This is NOT an informational page about the agency.
This is a SALES page showing what Voqo can do FOR the agency.

### Required Sections (in order)

#### 1. Hero Section
- Agency logo (if extracted) + agency name
- Headline: Value proposition for AI voice calling
  - Example: "Never Miss Another Lead"
  - Example: "Your 24/7 AI Receptionist"
- Subheadline: Personalized to agency location
  - Example: "AI-powered call handling for {Agency Name} in {Suburb}"
- Primary CTA: Large "Try the Demo" button (calls demo number)
- Background: Use `heroImageUrl` if extracted, else solid brand color

#### 2. Value Proposition (2-3 points max)
- Focus on OUTCOMES, not features
- Examples:
  - "Capture every lead, even after hours"
  - "Professional greeting with your agency name"
  - "Instant SMS with caller details"
- Use numbered sections (01, 02, 03) instead of icon cards

#### 3. How It Works (simple 3 steps)
- Step 1: "Caller dials your number"
- Step 2: "AI answers professionally as {Agency Name}"
- Step 3: "You receive lead details instantly"
- Keep it visual and simple

#### 4. Demo CTA Section (prominent)
- Large call button with phone number displayed
- Phone: `04832945767` (display) / `+614832945767` (tel: link)
- Secondary: "I already called" button
- Trust signals: "30-second demo" • "No signup required" • "Hear it yourself"

#### 5. Footer
- "Presented by Voqo" with link to https://voqo.ai
- Agency name + suburb (for context)
- Minimal, clean design

### NOT Included (removed for speed and focus)
- Pain score or pain reasons display
- Detailed metrics (sold count, price ranges)
- Feature comparison tables
- Pricing information
- Long form content

---

## Demo Phone Number (CRITICAL)

Every landing page MUST use this exact phone number for the demo CTA:

| Format | Value |
|--------|-------|
| Display | `04832945767` |
| E.164 (for tel: links) | `+614832945767` |
| tel: href | `tel:+614832945767` |

DO NOT use:
- The agency's actual phone number
- Any other phone number
- Placeholder numbers

This number is configured in ElevenLabs to run the demo voice agent.

### CTA Button Implementation

```html
<!-- Primary CTA -->
<a href="tel:+614832945767" class="...primary button styles...">
  Try the Demo: 04832945767
</a>

<!-- Secondary CTA -->
<button onclick="window.registerDemoCall && window.registerDemoCall()" class="...secondary styles...">
  I already called
</button>
```

---

## Voqo Branding

<!-- NEW: Required branding on all generated pages -->

Every landing page must include "Presented by Voqo" branding:

### Placement
- **Footer** (required): "Presented by Voqo" with link
- **Optional**: Small "Voqo" text in hero subtitle

### Style
- Subtle, not competing with agency branding
- Use neutral gray (#6B7280) or design system secondary color
- Font size: 12-14px
- Link to: https://voqo.ai

### Example Implementation

```html
<footer class="py-8 text-center">
  <p class="text-sm text-gray-500">
    Demo for {Agency Name} · {Suburb}
  </p>
  <p class="text-xs text-gray-400 mt-2">
    Presented by <a href="https://voqo.ai" target="_blank" rel="noopener" class="underline hover:text-gray-600">Voqo</a>
  </p>
</footer>
```

---

## Workflow (4 Phases)

<!-- CHANGED: Reduced from 5 phases to 4. Removed pain score phase. Single WebFetch. -->

### Phase 0: Initialize

1) Append activity message:
   - `type: "thinking"`, `text: "Starting agency processing"`

2) Write progress file:
   - `status = "extracting"`
   - `steps.website.status = "in_progress"`

### Phase 1: Fetch + Extract (SINGLE WebFetch)

1) Append activity message:
   - `type: "fetch"`, `text: "Fetching website"`, `detail: <website URL>`

2) WebFetch the homepage URL

3) Extract ALL fields in one pass (see Information Extraction Format):
   - Logo, colors, phone, address, email, tagline
   - Hero image, team image, office image
   - Team size, listing count (if visible)

4) Update progress file:
   - `steps.website.status = "complete"`
   - `steps.details.status = "in_progress"`
   - Write all extracted fields

5) Append activity message:
   - `type: "identified"`, `text: "Extracted agency details"`

6) Update progress file:
   - `steps.details.status = "complete"`

NOTE: Do NOT do additional WebFetch for missing fields. Set to null and proceed.

### Phase 2: Select Design System + Generate HTML

1) Select design system based on agency type (see Selection Logic)

2) Append activity message:
   - `type: "thinking"`, `text: "Generating demo page"`

3) Update progress file:
   - `status = "generating"`
   - `steps.generating.status = "in_progress"`
   - `designSystem = "<selected-system>"`
   - `htmlProgress = 10`

4) Generate HTML following:
   - Selected design system constraints (colors, fonts, layouts)
   - Landing page structure (5 sections)
   - Fixed demo phone number
   - Voqo branding in footer
   - Mobile-responsive design
   - Tailwind CSS via CDN

5) Update progress file:
   - `htmlProgress = 70`

6) Write HTML to `demoHtmlPath`

7) Update progress file:
   - `htmlProgress = 100`

8) Append activity message:
   - `type: "results"`, `text: "Demo page generated"`, `detail: "/demo/{agencyId}"`

### Phase 3: Finalize

1) Write agency record to `agencyDataPath` (see schema above)

2) Update progress file:
   - `steps.generating.status = "complete"`
   - `steps.complete.status = "complete"`
   - `status = "complete"`
   - `demoUrl = "/demo/{agencyId}"`

3) Append activity message:
   - `type: "identified"`, `text: "Agency processing complete"`

---

## Error Handling

If the WebFetch fails:
1) Append activity message:
   - `type: "warning"`, `text: "Failed to fetch website"`, `detail: <error reason>`

2) Write progress file:
   - `status = "error"`
   - `steps.website.status = "error"`
   - `error = "<error message>"`

3) Stop processing (no retries).

If HTML generation fails:
1) Append activity message with warning
2) Write progress with `status = "error"` and `steps.generating.status = "error"`
3) Stop processing.

---

## HTML Template Requirements

### Head Section
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Agency Name} - AI Voice Demo | Voqo</title>
  <meta name="description" content="Try the AI voice receptionist demo for {Agency Name}. Professional call handling powered by Voqo.">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family={Selected+Font}&display=swap" rel="stylesheet">
</head>
```

### Script Inclusion (before closing body)
```html
  <script src="/voqo-demo-call.js"></script>
</body>
</html>
```

This script handles:
- Demo call registration with the server
- "I already called" button functionality
- Context passing to the voice agent

Do NOT implement these yourself. Just include the script.

---

## Quick Reference

| Item | Value |
|------|-------|
| Demo phone (display) | `04832945767` |
| Demo phone (E.164) | `+614832945767` |
| Voqo link | `https://voqo.ai` |
| Tailwind CDN | `https://cdn.tailwindcss.com` |
| Max WebFetch | 1 |
| Max WebSearch | 0 |
| Default design system | `editorial-prestige` |
| Light theme background | `#FAFAF9` or `#F8F6F1` |
