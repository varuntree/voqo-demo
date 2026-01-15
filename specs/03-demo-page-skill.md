# 03 - Demo Page Builder Skill

## Overview

This skill instructs Claude Code to generate beautiful, branded demo landing pages for each agency. These pages showcase what a Voqo-powered experience would look like for that specific agency.

---

## Skill File Location

```
.claude/skills/demo-page-builder/SKILL.md
```

---

## SKILL.md Content

```markdown
---
name: demo-page-builder
description: Generate branded demo landing pages for real estate agencies
---

# Demo Page Builder Skill

You are an expert landing page designer specializing in SaaS demos and real estate. Your task is to create stunning, conversion-focused demo pages that showcase Voqo AI's voice agent capabilities.

## Design Philosophy

1. **Brand Authenticity**: The page should feel like it belongs to the agency
2. **Professional Polish**: Premium look that impresses decision-makers
3. **Clear Value Prop**: Immediately show why they need Voqo
4. **Single CTA Focus**: One clear action - call the demo number
5. **Mobile First**: Must work perfectly on phones (agents browse on mobile)

## Technical Requirements

### Framework
- Single HTML file, fully self-contained
- Tailwind CSS via CDN for styling
- Minimal JavaScript (only for call registration)
- No external dependencies beyond CDN

### HTML Template Structure

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
                        'brand-dark': '{{secondary_color}}',
                        'brand-light': '{{primary_color}}20'
                    }
                }
            }
        }
    </script>
    <style>
        /* Custom styles if needed */
        .gradient-brand {
            background: linear-gradient(135deg, {{primary_color}} 0%, {{secondary_color}} 100%);
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Content sections -->
</body>
</html>
```

## Page Sections

### 1. Header
```html
<header class="bg-white shadow-sm sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <img src="{{logo_url}}" alt="{{agency_name}}" class="h-10 object-contain">
            <span class="text-gray-400 text-sm">× Voqo AI</span>
        </div>
        <a href="tel:{{demo_phone}}" class="bg-brand text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition">
            Call Demo
        </a>
    </div>
</header>
```

### 2. Hero Section
```html
<section class="gradient-brand text-white py-16 md:py-24">
    <div class="max-w-4xl mx-auto px-4 text-center">
        <h1 class="text-3xl md:text-5xl font-bold mb-6">
            Never Miss Another Enquiry
        </h1>
        <p class="text-xl md:text-2xl opacity-90 mb-8">
            See how AI-powered call handling would work for {{agency_name}}
        </p>
        <a href="tel:{{demo_phone}}"
           onclick="registerCall()"
           class="inline-flex items-center gap-3 bg-white text-brand px-8 py-4 rounded-full font-bold text-lg hover:shadow-lg transition transform hover:scale-105">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
            Try Demo: {{demo_phone_display}}
        </a>
        <p class="mt-4 text-sm opacity-75">
            Call now to experience the AI assistant
        </p>
    </div>
</section>
```

### 3. Pain Points Section
```html
<section class="py-16 bg-white">
    <div class="max-w-6xl mx-auto px-4">
        <h2 class="text-2xl md:text-3xl font-bold text-center mb-4">
            Why {{agency_name}} Needs This
        </h2>
        <p class="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Based on our analysis of your business
        </p>

        <div class="grid md:grid-cols-3 gap-6">
            {{#each pain_cards}}
            <div class="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <div class="text-4xl mb-4">{{icon}}</div>
                <h3 class="font-bold text-lg mb-2">{{title}}</h3>
                <p class="text-gray-600">{{description}}</p>
            </div>
            {{/each}}
        </div>
    </div>
</section>
```

### 4. ROI Calculator Section
```html
<section class="py-16 bg-brand-light">
    <div class="max-w-4xl mx-auto px-4">
        <h2 class="text-2xl md:text-3xl font-bold text-center mb-12">
            Your Potential ROI
        </h2>

        <div class="bg-white rounded-2xl shadow-lg p-8">
            <div class="grid md:grid-cols-2 gap-8">
                <div>
                    <h3 class="font-semibold text-gray-500 uppercase text-sm mb-4">The Problem</h3>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600">Active Listings</span>
                            <span class="font-bold text-xl">{{listing_count}}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600">Est. Calls/Month</span>
                            <span class="font-bold text-xl">{{estimated_calls}}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600">Est. Missed Calls</span>
                            <span class="font-bold text-xl text-red-500">{{missed_calls}}</span>
                        </div>
                        <div class="flex justify-between items-center border-t pt-4">
                            <span class="text-gray-600">Lost Revenue/Month</span>
                            <span class="font-bold text-xl text-red-500">${{lost_revenue}}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 class="font-semibold text-gray-500 uppercase text-sm mb-4">The Solution</h3>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600">Voqo Cost</span>
                            <span class="font-bold text-xl">$199/mo</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600">Calls Captured</span>
                            <span class="font-bold text-xl text-green-500">100%</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-600">Revenue Saved</span>
                            <span class="font-bold text-xl text-green-500">${{saved_revenue}}</span>
                        </div>
                        <div class="flex justify-between items-center border-t pt-4 bg-green-50 -mx-4 px-4 py-2 rounded-lg">
                            <span class="text-gray-800 font-medium">ROI</span>
                            <span class="font-bold text-2xl text-green-600">{{roi}}x</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
```

### 5. How It Works Section
```html
<section class="py-16 bg-white">
    <div class="max-w-4xl mx-auto px-4">
        <h2 class="text-2xl md:text-3xl font-bold text-center mb-12">
            How It Works
        </h2>

        <div class="space-y-8">
            <div class="flex gap-4 items-start">
                <div class="bg-brand text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                <div>
                    <h3 class="font-bold text-lg">Caller Dials Your Number</h3>
                    <p class="text-gray-600">When you're busy or after hours, Voqo AI answers immediately</p>
                </div>
            </div>

            <div class="flex gap-4 items-start">
                <div class="bg-brand text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                <div>
                    <h3 class="font-bold text-lg">AI Handles the Conversation</h3>
                    <p class="text-gray-600">Natural conversation to understand their property needs</p>
                </div>
            </div>

            <div class="flex gap-4 items-start">
                <div class="bg-brand text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
                <div>
                    <h3 class="font-bold text-lg">Instant Follow-Up</h3>
                    <p class="text-gray-600">Caller receives personalized property recommendations immediately</p>
                </div>
            </div>
        </div>
    </div>
</section>
```

### 6. CTA Section
```html
<section class="py-16 gradient-brand text-white">
    <div class="max-w-4xl mx-auto px-4 text-center">
        <h2 class="text-2xl md:text-3xl font-bold mb-6">
            Experience It Yourself
        </h2>
        <p class="text-xl opacity-90 mb-8">
            Call now and see how your callers would be handled
        </p>
        <a href="tel:{{demo_phone}}"
           onclick="registerCall()"
           class="inline-flex items-center gap-3 bg-white text-brand px-8 py-4 rounded-full font-bold text-lg hover:shadow-lg transition">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
            Call: {{demo_phone_display}}
        </a>
    </div>
</section>
```

### 7. Footer
```html
<footer class="bg-gray-900 text-gray-400 py-8">
    <div class="max-w-6xl mx-auto px-4 text-center">
        <p class="mb-2">Demo powered by <span class="text-white font-medium">Voqo AI</span></p>
        <p class="text-sm">AI Voice Agents for Real Estate</p>
    </div>
</footer>
```

### 8. Embedded Data + Scripts
```html
<script>
// Embedded agency data for call context
const AGENCY_DATA = {
    id: "{{agency_id}}",
    name: "{{agency_name}}",
    location: "{{agency_location}}",
    phone: "{{agency_phone}}",
    greeting: "Thanks for calling {{agency_name}}",
    // Additional context for voice agent
    teamSize: {{team_size}},
    listingCount: {{listing_count}},
    hasPropertyManagement: {{has_pm}}
};

// Generated call history container
let callHistory = [];

// Register call context before dialing
async function registerCall() {
    try {
        const response = await fetch('/api/register-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agencyData: AGENCY_DATA,
                timestamp: Date.now()
            })
        });

        if (response.ok) {
            // Start polling for call completion
            pollForResults();
        }
    } catch (err) {
        console.error('Failed to register call:', err);
    }
}

// Poll for generated post-call page
function pollForResults() {
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/call-status?agency=${AGENCY_DATA.id}`);
            const data = await response.json();

            if (data.status === 'completed' && data.pageUrl) {
                clearInterval(pollInterval);
                showCallResult(data);
            }
        } catch (err) {
            // Continue polling
        }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
}

// Display call result on page
function showCallResult(data) {
    const resultsDiv = document.getElementById('call-results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-xl p-6 mt-8">
                <h3 class="font-bold text-green-800 mb-2">✅ Your personalized page is ready!</h3>
                <p class="text-green-700 mb-4">Based on your call, we've created a custom property page.</p>
                <a href="${data.pageUrl}" class="inline-block bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700">
                    View Your Page →
                </a>
            </div>
        `;
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
    }
}
</script>

<!-- Results container -->
<div id="call-results" class="max-w-4xl mx-auto px-4 pb-8"></div>
```

## Data Mapping

When generating a page, map agency data to template variables:

| Template Variable | Source |
|------------------|--------|
| `{{agency_name}}` | agency.name |
| `{{agency_id}}` | agency.id |
| `{{agency_location}}` | agency.address (city/suburb only) |
| `{{agency_phone}}` | agency.phone |
| `{{logo_url}}` | agency.branding.logoUrl |
| `{{primary_color}}` | agency.branding.primaryColor |
| `{{secondary_color}}` | agency.branding.secondaryColor |
| `{{demo_phone}}` | +61XXXXXXXXX (from env) |
| `{{demo_phone_display}}` | +61 XXX XXX XXX (formatted) |
| `{{listing_count}}` | agency.metrics.listingCount |
| `{{team_size}}` | agency.metrics.teamSize |
| `{{has_pm}}` | agency.metrics.hasPropertyManagement |

### ROI Calculations

```javascript
// Calculate ROI metrics
const listingCount = agency.metrics.listingCount;
const estimatedCalls = listingCount * 8; // ~8 calls per listing per month
const missedCallRate = 0.35; // Industry average 35% missed
const missedCalls = Math.round(estimatedCalls * missedCallRate);
const revenuePerLead = 150; // Conservative estimate
const lostRevenue = missedCalls * revenuePerLead;
const savedRevenue = lostRevenue;
const voqoCost = 199;
const roi = Math.round(savedRevenue / voqoCost);
```

### Pain Cards Generation

Generate 3 pain cards based on agency data:

```javascript
const painCards = [];

if (agency.metrics.listingCount > 20) {
    painCards.push({
        icon: "📞",
        title: `${agency.metrics.listingCount} Active Listings`,
        description: "High listing volume means constant enquiry calls. Missing even one could cost thousands."
    });
}

if (!agency.metrics.hasAfterHoursNumber) {
    painCards.push({
        icon: "🌙",
        title: "No After-Hours Coverage",
        description: "Enquiries don't stop at 5pm. Evening and weekend callers are going to voicemail."
    });
}

if (agency.metrics.hasPropertyManagement) {
    painCards.push({
        icon: "🏠",
        title: "Property Management Load",
        description: "Tenant calls, maintenance requests, and landlord queries add to your call volume."
    });
}

if (agency.metrics.teamSize < 5 && agency.metrics.listingCount > 15) {
    painCards.push({
        icon: "👥",
        title: "Lean Team, High Demand",
        description: `${agency.metrics.teamSize} agents managing ${agency.metrics.listingCount} properties. Someone's always on a call.`
    });
}

if (!agency.metrics.hasChatWidget) {
    painCards.push({
        icon: "💬",
        title: "No Web Chat Capture",
        description: "Website visitors who can't chat will call - or go to your competitor."
    });
}

// Use top 3
painCards.slice(0, 3);
```

## Output

Save generated HTML to: `/public/demo/{{agency_id}}.html`

Example: `/public/demo/ray-white-surry-hills.html`

The page will be served at: `https://voqo-demo.example.com/demo/ray-white-surry-hills`

## Quality Checklist

Before saving, verify:
- [ ] Logo loads correctly (test URL in browser)
- [ ] Colors are visible and not clashing
- [ ] Phone number is correct and clickable
- [ ] Pain points are relevant to this agency
- [ ] ROI numbers are reasonable
- [ ] Mobile responsive (check viewport)
- [ ] No JavaScript errors
- [ ] Agency data embedded in script tag
```

---

## Invocation

```typescript
// API route pseudocode
async function generateDemoPage(agencyId: string) {
  // Load agency data
  const agencyData = await readFile(`/data/agencies/${agencyId}.json`);

  // Invoke Claude Code with skill
  await invokeClaudeCode({
    prompt: `Use the demo-page-builder skill to generate a landing page for this agency:

    ${JSON.stringify(agencyData, null, 2)}

    Save the HTML file to /public/demo/${agencyId}.html`,
    tools: ['Read', 'Write'],
    skills: ['demo-page-builder']
  });

  return `/demo/${agencyId}`;
}
```
