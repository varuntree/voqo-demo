# 04 - Post-Call Page Builder Skill

## Overview

This skill instructs Claude Code to generate personalized post-call landing pages based on the voice conversation transcript. It extracts caller requirements, searches for matching listings, and creates a tailored property page.

---

## Skill File Location

```
.claude/skills/postcall-page-builder/SKILL.md
```

---

## SKILL.md Content

```markdown
---
name: postcall-page-builder
description: Generate personalized post-call landing pages from voice transcripts
---

# Post-Call Page Builder Skill

You are an expert at creating personalized real estate landing pages. Your task is to analyze a voice call transcript, extract the caller's requirements, find matching properties, and generate a beautiful follow-up page.

## Your Mission

Given a call transcript and agency context, create a personalized page that:
1. Acknowledges the caller by name
2. Summarizes their stated requirements
3. Shows relevant property listings
4. Provides clear next steps

## Input Data

You will receive:

```json
{
  "callId": "call-abc123",
  "transcript": "Agent: Hi! Thanks for calling Ray White Surry Hills...\nCaller: Hi, I'm looking to buy...",
  "extractedData": {
    "caller_name": "Sarah",
    "intent": "buy",
    "preferred_location": "Surry Hills or Darlinghurst",
    "budget_range": "$800k to $1.2M"
  },
  "agencyData": {
    "id": "ray-white-surry-hills",
    "name": "Ray White Surry Hills",
    "location": "Surry Hills, Sydney",
    "branding": {
      "logoUrl": "...",
      "primaryColor": "#ffe512",
      "secondaryColor": "#1a1a1a"
    }
  }
}
```

## Processing Steps

### Step 1: Analyze Transcript

If extractedData is incomplete, parse the transcript to find:

```
LOOK FOR:
- Caller name: "My name is...", "I'm...", "This is..."
- Intent: "looking to buy", "want to sell", "need to rent"
- Location: suburb names, area descriptions
- Budget: dollar amounts, price ranges
- Property type: house, apartment, unit, townhouse
- Bedrooms: "3 bedroom", "2 bed"
- Special requirements: parking, garden, pool, pets
```

### Step 2: Search for Listings

Use web search to find matching properties:

```
SEARCH STRATEGY:

1. Primary search on agency website:
   - Visit agency website listings page
   - Filter by location, price, type if possible
   - Extract top 3-5 matching listings

2. Fallback to property portals:
   - Search: "{{location}} {{type}} for {{intent}} {{budget}}"
   - Check realestate.com.au, domain.com.au
   - Find listings from this agency or area

3. For each listing, extract:
   - Property address
   - Price (or price guide)
   - Bedrooms, bathrooms, parking
   - Image URL (main photo)
   - Listing URL
   - Key features (brief)
```

### Step 3: Generate Page

Create HTML page with caller's requirements and matching listings.

## HTML Template Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{caller_name}}'s Property Search | {{agency_name}}</title>
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
<body class="bg-gray-50 min-h-screen">
    <!-- Page content -->
</body>
</html>
```

## Page Sections

### 1. Header
```html
<header class="bg-white shadow-sm">
    <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <img src="{{logo_url}}" alt="{{agency_name}}" class="h-10 object-contain">
        <span class="text-sm text-gray-500">Prepared just for you</span>
    </div>
</header>
```

### 2. Personalized Greeting
```html
<section class="bg-brand text-white py-12">
    <div class="max-w-4xl mx-auto px-4">
        <h1 class="text-3xl md:text-4xl font-bold mb-4">
            Hi {{caller_name}}! 👋
        </h1>
        <p class="text-xl opacity-90">
            Thanks for calling {{agency_name}}. Here's what we found based on your requirements.
        </p>
    </div>
</section>
```

### 3. Requirements Summary
```html
<section class="py-8 bg-white border-b">
    <div class="max-w-4xl mx-auto px-4">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">Your Search Criteria</h2>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="text-2xl mb-1">🏠</div>
                <div class="text-sm text-gray-500">Looking to</div>
                <div class="font-semibold">{{intent_display}}</div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4">
                <div class="text-2xl mb-1">📍</div>
                <div class="text-sm text-gray-500">Area</div>
                <div class="font-semibold">{{location}}</div>
            </div>

            <div class="bg-gray-50 rounded-lg p-4">
                <div class="text-2xl mb-1">💰</div>
                <div class="text-sm text-gray-500">Budget</div>
                <div class="font-semibold">{{budget}}</div>
            </div>

            {{#if property_type}}
            <div class="bg-gray-50 rounded-lg p-4">
                <div class="text-2xl mb-1">🏗️</div>
                <div class="text-sm text-gray-500">Type</div>
                <div class="font-semibold">{{property_type}}</div>
            </div>
            {{/if}}
        </div>
    </div>
</section>
```

### 4. Matching Listings
```html
<section class="py-12">
    <div class="max-w-4xl mx-auto px-4">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Properties You Might Love</h2>
        <p class="text-gray-600 mb-8">Based on your conversation with us</p>

        <div class="space-y-6">
            {{#each listings}}
            <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition">
                <div class="md:flex">
                    <div class="md:w-1/3">
                        <img src="{{image_url}}" alt="{{address}}" class="w-full h-48 md:h-full object-cover">
                    </div>
                    <div class="p-6 md:w-2/3">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-bold text-lg">{{address}}</h3>
                            <span class="text-brand font-bold">{{price}}</span>
                        </div>

                        <div class="flex gap-4 text-sm text-gray-600 mb-4">
                            <span>🛏️ {{bedrooms}} bed</span>
                            <span>🛁 {{bathrooms}} bath</span>
                            <span>🚗 {{parking}} car</span>
                        </div>

                        <p class="text-gray-600 mb-4">{{description}}</p>

                        <div class="flex gap-3">
                            <a href="{{listing_url}}" target="_blank"
                               class="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                                View Details
                            </a>
                            <a href="{{inspection_url}}"
                               class="border border-brand text-brand px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-light">
                                Book Inspection
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            {{/each}}
        </div>

        {{#if no_exact_matches}}
        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mt-6">
            <h3 class="font-semibold text-yellow-800 mb-2">No exact matches right now</h3>
            <p class="text-yellow-700">
                We've shown you similar properties in the area. New listings come on daily -
                we'll notify you when something perfect pops up!
            </p>
        </div>
        {{/if}}
    </div>
</section>
```

### 5. Next Steps
```html
<section class="py-12 bg-gray-100">
    <div class="max-w-4xl mx-auto px-4">
        <h2 class="text-2xl font-bold text-gray-800 mb-8 text-center">What's Next?</h2>

        <div class="grid md:grid-cols-3 gap-6">
            <div class="bg-white rounded-xl p-6 text-center">
                <div class="text-4xl mb-4">📅</div>
                <h3 class="font-bold mb-2">Book Inspections</h3>
                <p class="text-gray-600 text-sm mb-4">See these properties in person</p>
                <a href="#" class="text-brand font-medium hover:underline">Schedule Now →</a>
            </div>

            <div class="bg-white rounded-xl p-6 text-center">
                <div class="text-4xl mb-4">📧</div>
                <h3 class="font-bold mb-2">Get Alerts</h3>
                <p class="text-gray-600 text-sm mb-4">New listings matching your criteria</p>
                <a href="#" class="text-brand font-medium hover:underline">Set Up Alerts →</a>
            </div>

            <div class="bg-white rounded-xl p-6 text-center">
                <div class="text-4xl mb-4">👤</div>
                <h3 class="font-bold mb-2">Talk to an Agent</h3>
                <p class="text-gray-600 text-sm mb-4">Get personalized advice</p>
                <a href="tel:{{agency_phone}}" class="text-brand font-medium hover:underline">Call {{agency_phone_display}} →</a>
            </div>
        </div>
    </div>
</section>
```

### 6. Footer
```html
<footer class="bg-gray-900 text-gray-400 py-8">
    <div class="max-w-4xl mx-auto px-4 text-center">
        <p class="mb-2">Prepared by <span class="text-white font-medium">{{agency_name}}</span></p>
        <p class="text-sm">Powered by Voqo AI</p>
        <p class="text-xs mt-4 opacity-60">
            Page generated on {{generated_date}} based on your call
        </p>
    </div>
</footer>
```

## Listing Search Guidelines

### When searching for properties:

1. **Start with agency website**
   - Most agencies have listings on their site
   - Use their search/filter if available
   - Maintain brand consistency

2. **Use property portals as backup**
   - realestate.com.au
   - domain.com.au
   - Search by suburb + price + type

3. **Extract listing data**
   ```
   For each listing, get:
   - image_url: Main property photo (high quality)
   - address: Full street address
   - price: Display price or guide
   - bedrooms: Number
   - bathrooms: Number
   - parking: Car spaces
   - description: 1-2 sentence summary
   - listing_url: Link to full listing
   - inspection_url: Booking link if available
   ```

4. **Handle edge cases**
   - No exact matches: Show similar/nearby properties
   - Budget unclear: Show range of prices
   - Vague location: Show broader area

### Quality Standards

- Show 3-5 listings (not overwhelming)
- All images must load (test URLs)
- Prices should match budget range
- Locations should match preference
- Mix of options if possible

## Output

Save generated HTML to: `/public/call/{{call_id}}.html`

Example: `/public/call/call-abc123.html`

Also save call data to: `/data/calls/{{call_id}}.json`

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
    {
      "address": "12/45 Crown Street, Surry Hills",
      "price": "$950,000",
      "url": "https://..."
    }
  ],
  "pageUrl": "/call/call-abc123",
  "generatedAt": "2025-01-15T10:32:00Z"
}
```

## Example Transcript Processing

Input transcript:
```
Agent: Hi! Thanks for calling Ray White Surry Hills. I'm their AI assistant. How can I help you today?

Caller: Hi, yeah I'm looking to buy a place in the area.

Agent: Great! Are you looking at Surry Hills specifically, or are you open to nearby suburbs too?

Caller: Surry Hills or maybe Darlinghurst would be good. Somewhere central.

Agent: Perfect! And what's your budget range if you don't mind me asking?

Caller: Around 800 to 1.2 million I'd say.

Agent: Got it. And can I get your name so we can follow up?

Caller: It's Sarah.

Agent: Thanks Sarah! I'm putting together some tailored information for you right now. You'll see it appear on the page you called from in just a moment. Thanks for calling Ray White Surry Hills!
```

Extracted requirements:
```json
{
  "caller_name": "Sarah",
  "intent": "buy",
  "preferred_location": "Surry Hills or Darlinghurst",
  "budget_range": "$800,000 - $1,200,000",
  "property_type": null,
  "bedrooms": null,
  "special_requirements": "Central location"
}
```

Search query: "Surry Hills Darlinghurst apartments units for sale $800000 $1200000"
```

---

## Invocation

```typescript
// Called from webhook handler after call completes
async function generatePostCallPage(callData: CallWebhookPayload) {
  await invokeClaudeCode({
    prompt: `Use the postcall-page-builder skill to generate a personalized page for this call:

    Call ID: ${callData.callId}

    Transcript:
    ${callData.transcript}

    Extracted Data:
    ${JSON.stringify(callData.extractedVariables, null, 2)}

    Agency Context:
    ${JSON.stringify(callData.agencyData, null, 2)}

    1. Analyze transcript for any missing requirements
    2. Search for matching property listings (use web search)
    3. Generate personalized HTML page
    4. Save to /public/call/${callData.callId}.html
    5. Save call data to /data/calls/${callData.callId}.json`,
    tools: ['WebSearch', 'WebFetch', 'Read', 'Write'],
    skills: ['postcall-page-builder']
  });

  return `/call/${callData.callId}`;
}
```
