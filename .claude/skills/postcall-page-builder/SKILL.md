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
