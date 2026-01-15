# 07 - Data Schemas

## Overview

This document defines all data structures used in the VoqoLeadEngine system. All data is stored as JSON files in the `/data` directory.

---

## Directory Structure

```
/data
├── agencies/                    # Agency data from research
│   ├── surry-hills.json        # Search results for suburb
│   ├── ray-white-surry-hills.json   # Individual agency
│   └── lj-hooker-darlinghurst.json  # Individual agency
│
├── calls/                      # Call transcripts and results
│   ├── call-1705312200-abc123.json
│   └── call-1705312500-def456.json
│
└── context/                    # Temporary call context
    └── pending-calls.json
```

---

## 1. Agency Search Results

**File:** `/data/agencies/{suburb-slug}.json`

**Example:** `/data/agencies/surry-hills.json`

```typescript
interface AgencySearchResults {
  // Search metadata
  suburb: string;                    // "Surry Hills"
  searchedAt: string;                // ISO timestamp
  searchQuery: string;               // Original search query
  totalFound: number;                // Number of agencies found

  // Results array
  agencies: AgencyProfile[];
}
```

**Example:**
```json
{
  "suburb": "Surry Hills",
  "searchedAt": "2025-01-15T10:30:00.000Z",
  "searchQuery": "real estate agencies Surry Hills Sydney",
  "totalFound": 10,
  "agencies": [
    {
      "id": "ray-white-surry-hills",
      "name": "Ray White Surry Hills",
      "...": "..."
    }
  ]
}
```

---

## 2. Agency Profile

**File:** `/data/agencies/{agency-id}.json`

**Example:** `/data/agencies/ray-white-surry-hills.json`

```typescript
interface AgencyProfile {
  // Identifiers
  id: string;                        // URL-safe slug: "ray-white-surry-hills"
  name: string;                      // "Ray White Surry Hills"

  // Contact Information
  website: string;                   // "https://raywhitesurryhills.com.au"
  phone: string;                     // "+61 2 9361 6000"
  email: string | null;              // "surryhills@raywhite.com" or null
  address: string;                   // "123 Crown St, Surry Hills NSW 2010"

  // Branding
  branding: {
    logoUrl: string | null;          // Direct URL to logo image
    primaryColor: string;            // Hex: "#ffe512"
    secondaryColor: string;          // Hex: "#1a1a1a"
    logoBackgroundColor?: string;    // If logo needs background
  };

  // Business Metrics
  metrics: {
    teamSize: number;                // Count of agents
    listingCount: number;            // Active listings
    hasPropertyManagement: boolean;  // Offers PM services
    hasAfterHoursNumber: boolean;    // 24/7 contact available
    hasChatWidget: boolean;          // Live chat on site
    hasOnlineBooking: boolean;       // Can book inspections online
    principalName: string | null;    // Owner/principal name
  };

  // Pain Analysis
  painScore: number;                 // 0-100, higher = more need
  painReasons: string[];             // List of specific pain points

  // Metadata
  researchedAt: string;              // ISO timestamp
  dataQuality: 'complete' | 'partial' | 'minimal';
  notes: string | null;              // Research notes

  // Demo Page Status
  demoPage?: {
    generated: boolean;
    generatedAt: string | null;
    url: string | null;              // "/demo/ray-white-surry-hills"
  };
}
```

**Example:**
```json
{
  "id": "ray-white-surry-hills",
  "name": "Ray White Surry Hills",
  "website": "https://raywhitesurryhills.com.au",
  "phone": "+61 2 9361 6000",
  "email": "surryhills.nsw@raywhite.com",
  "address": "389 Crown Street, Surry Hills NSW 2010",

  "branding": {
    "logoUrl": "https://raywhitesurryhills.com.au/images/logo.png",
    "primaryColor": "#ffe512",
    "secondaryColor": "#1a1a1a"
  },

  "metrics": {
    "teamSize": 8,
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
    "No after-hours contact solution",
    "Property management adds rental enquiries",
    "No chat widget to capture web leads"
  ],

  "researchedAt": "2025-01-15T10:35:00.000Z",
  "dataQuality": "complete",
  "notes": "Major Ray White franchise, principal very active on LinkedIn",

  "demoPage": {
    "generated": true,
    "generatedAt": "2025-01-15T10:40:00.000Z",
    "url": "/demo/ray-white-surry-hills"
  }
}
```

---

## 3. Call Data

**File:** `/data/calls/{call-id}.json`

**Example:** `/data/calls/call-1705312200-abc123.json`

```typescript
interface CallData {
  // Identifiers
  callId: string;                    // "call-1705312200-abc123"
  conversationId: string;            // ElevenLabs conversation ID

  // Timestamps
  timestamp: string;                 // ISO timestamp of call start
  duration: number;                  // Call duration in seconds

  // Caller Info
  callerPhone: string;               // "+61 412 345 678"
  callerName: string | null;         // Extracted name

  // Call Status
  status: 'completed' | 'failed' | 'dropped';

  // Agency Context
  agencyId: string;                  // "ray-white-surry-hills"
  agencyName: string;                // "Ray White Surry Hills"
  agencyData: AgencyProfile | null;  // Full agency data if available

  // Extracted Requirements
  extractedData: {
    caller_name?: string;
    caller_intent?: 'buy' | 'sell' | 'rent' | 'other';
    preferred_location?: string;
    budget_range?: string;
    property_type?: string;
    bedrooms?: string;
    additional_notes?: string;
  };

  // Convenience fields (flattened from extractedData)
  intent: string | null;
  location: string | null;
  budget: string | null;

  // Transcript
  transcript: string;                // Formatted transcript text
  transcriptRaw: Array<{            // Raw transcript array
    role: 'agent' | 'user';
    message: string;
  }>;
  summary: string;                   // AI-generated summary

  // Post-Call Page
  pageStatus: 'pending' | 'generating' | 'completed' | 'failed';
  pageUrl: string | null;            // "/call/call-1705312200-abc123"
  generatedAt: string | null;        // ISO timestamp

  // Listings shown (if page generated)
  listingsShown?: Array<{
    address: string;
    price: string;
    url: string;
  }>;
}
```

**Example:**
```json
{
  "callId": "call-1705312200-abc123",
  "conversationId": "conv_xyz789",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "duration": 87,

  "callerPhone": "+61 412 345 678",
  "callerName": "Sarah",
  "status": "completed",

  "agencyId": "ray-white-surry-hills",
  "agencyName": "Ray White Surry Hills",
  "agencyData": { "...": "full agency object" },

  "extractedData": {
    "caller_name": "Sarah",
    "caller_intent": "buy",
    "preferred_location": "Surry Hills or Darlinghurst",
    "budget_range": "$800,000 - $1,200,000",
    "property_type": null,
    "bedrooms": null
  },

  "intent": "buy",
  "location": "Surry Hills or Darlinghurst",
  "budget": "$800,000 - $1,200,000",

  "transcript": "Agent: Hi! Thanks for calling Ray White Surry Hills...\n\nCaller: Hi, I'm looking to buy...",
  "transcriptRaw": [
    { "role": "agent", "message": "Hi! Thanks for calling Ray White Surry Hills. I'm their AI assistant - how can I help you today?" },
    { "role": "user", "message": "Hi, I'm looking to buy a place in the area." }
  ],
  "summary": "Caller Sarah is looking to buy property in Surry Hills or Darlinghurst area with budget of $800k-$1.2M",

  "pageStatus": "completed",
  "pageUrl": "/call/call-1705312200-abc123",
  "generatedAt": "2025-01-15T10:32:00.000Z",

  "listingsShown": [
    {
      "address": "12/45 Crown Street, Surry Hills",
      "price": "$950,000",
      "url": "https://raywhitesurryhills.com.au/listing/123"
    },
    {
      "address": "8/22 Bourke Street, Darlinghurst",
      "price": "$1,100,000",
      "url": "https://raywhitesurryhills.com.au/listing/456"
    }
  ]
}
```

---

## 4. Pending Calls Context

**File:** `/data/context/pending-calls.json`

**Purpose:** Temporary storage for call context between demo page registration and voice call

```typescript
interface PendingCallsContext {
  [contextId: string]: {
    agencyData: AgencyProfile;       // Agency for this call context
    registeredAt: number;            // Unix timestamp
    expiresAt: number;               // Unix timestamp (registeredAt + 5min)
    status: 'pending' | 'active' | 'completed';

    // Added when call starts
    callerId?: string;               // Caller phone number
    callSid?: string;                // Twilio call SID
    activatedAt?: number;            // When call connected

    // Added when call completes
    callId?: string;                 // Our call ID
    completedAt?: number;            // When call ended
  };
}
```

**Example:**
```json
{
  "ctx-1705312100-x7k9m2": {
    "agencyData": {
      "id": "ray-white-surry-hills",
      "name": "Ray White Surry Hills",
      "location": "Surry Hills, Sydney",
      "phone": "+61 2 9361 6000"
    },
    "registeredAt": 1705312100000,
    "expiresAt": 1705312400000,
    "status": "completed",
    "callerId": "+61412345678",
    "callSid": "CA123456789",
    "activatedAt": 1705312150000,
    "callId": "call-1705312200-abc123",
    "completedAt": 1705312287000
  }
}
```

---

## 5. Embedded Page Data

**Location:** Inside generated HTML files as `<script>` tag

**Purpose:** Pass agency context to demo page JavaScript

```typescript
interface EmbeddedAgencyData {
  id: string;
  name: string;
  location: string;
  phone: string;
  greeting: string;                  // Custom greeting for voice agent
  teamSize: number;
  listingCount: number;
  hasPropertyManagement: boolean;
}
```

**Example (in HTML):**
```html
<script>
const AGENCY_DATA = {
  id: "ray-white-surry-hills",
  name: "Ray White Surry Hills",
  location: "Surry Hills, Sydney",
  phone: "+61 2 9361 6000",
  greeting: "Thanks for calling Ray White Surry Hills",
  teamSize: 8,
  listingCount: 45,
  hasPropertyManagement: true
};
</script>
```

---

## 6. Property Listing (for post-call pages)

```typescript
interface PropertyListing {
  // Identity
  address: string;                   // "12/45 Crown Street, Surry Hills"
  suburb: string;                    // "Surry Hills"

  // Pricing
  price: string;                     // "$950,000" or "Contact Agent"
  priceGuide?: string;               // "$900,000 - $1,000,000"

  // Features
  bedrooms: number;
  bathrooms: number;
  parking: number;
  propertyType: string;              // "Apartment", "House", "Unit"
  landSize?: string;                 // "450 sqm"

  // Media
  imageUrl: string;                  // Main photo URL
  images?: string[];                 // Additional images

  // Description
  headline?: string;                 // "Stunning 2BR with City Views"
  description: string;               // Short description

  // Links
  listingUrl: string;                // Full listing page
  inspectionUrl?: string;            // Booking link
  agentName?: string;                // "John Smith"
  agentPhone?: string;               // "+61 412 345 678"

  // Metadata
  listedDate?: string;               // ISO date
  source: string;                    // "agency_website" or "realestate.com.au"
}
```

**Example:**
```json
{
  "address": "12/45 Crown Street, Surry Hills NSW 2010",
  "suburb": "Surry Hills",
  "price": "$950,000",
  "priceGuide": "$900,000 - $1,000,000",
  "bedrooms": 2,
  "bathrooms": 1,
  "parking": 1,
  "propertyType": "Apartment",
  "imageUrl": "https://images.realestate.com.au/listings/abc123/main.jpg",
  "headline": "Stunning 2BR with City Views",
  "description": "Beautifully renovated apartment in the heart of Surry Hills. Walking distance to cafes, restaurants, and transport.",
  "listingUrl": "https://raywhitesurryhills.com.au/listing/abc123",
  "inspectionUrl": "https://raywhitesurryhills.com.au/book-inspection/abc123",
  "agentName": "John Smith",
  "source": "agency_website"
}
```

---

## Data Validation

### Required Fields

**Agency (minimum viable):**
- `id`, `name`, `website`, `phone`
- `branding.primaryColor`, `branding.secondaryColor`
- `metrics.listingCount`
- `painScore`

**Call (minimum viable):**
- `callId`, `timestamp`, `callerPhone`
- `agencyId`, `agencyName`
- `transcript`
- `pageStatus`

### Data Quality Flags

Use `dataQuality` field on agencies:
- `complete`: All fields populated, verified
- `partial`: Some fields missing (logo, email, etc.)
- `minimal`: Only basic info available

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Suburb search | `{suburb-slug}.json` | `surry-hills.json` |
| Agency | `{agency-slug}.json` | `ray-white-surry-hills.json` |
| Call | `call-{timestamp}-{random}.json` | `call-1705312200-abc123.json` |
| Demo page | `{agency-slug}.html` | `ray-white-surry-hills.html` |
| Post-call page | `{call-id}.html` | `call-1705312200-abc123.html` |

### Slug Generation

```typescript
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')     // Remove special chars
    .replace(/[\s_-]+/g, '-')     // Replace spaces/underscores with dash
    .replace(/^-+|-+$/g, '');     // Trim dashes
}

// Examples:
slugify("Ray White Surry Hills")  // "ray-white-surry-hills"
slugify("LJ Hooker - Darlinghurst")  // "lj-hooker-darlinghurst"
slugify("Surry Hills")  // "surry-hills"
```

---

## Data Lifecycle

### Agency Data
1. Created during suburb search
2. Updated when demo page generated
3. Persists indefinitely (can be refreshed)

### Call Data
1. Created when call completes (webhook)
2. Updated when page generated
3. Retain for 30 days (demo purposes)

### Context Data
1. Created when user clicks "Call Demo"
2. Expires after 5 minutes
3. Cleaned up periodically
