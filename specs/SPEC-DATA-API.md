# Data Schemas & API Specification

## Directory Structure

```
/data
├── agencies/                    # Durable agency records (one per agency)
│   └── {agency-id}.json
│
├── calls/                       # Call transcripts and results
│   └── call-{timestamp}-{rand}.json
│
├── context/                     # Temporary call context
│   └── pending-calls.json
│
├── agency-calls/                # Call history indexed by agency
│   └── {agency-id}.json
│
├── progress/                    # Real-time pipeline progress
│   ├── pipeline-{sessionId}.json
│   ├── activity-{sessionId}.json           # Main agent activity stream
│   ├── activity-postcall-{callId}.json     # Post-call page generation activity stream
│   ├── agency-{agencyId}.json
│   └── agency-activity-{agencyId}.json     # Per-card subagent activity stream
│
├── history/                     # Search session history
│   └── sessions.json
│   └── sessions/                # Durable per-session snapshots
│       └── {sessionId}.json
│
├── jobs/postcall/               # Background job queue
│   └── {callId}.json
│
├── jobs/sms/                    # SMS notification queue (durable, idempotent)
│   └── {callId}.json
│
└── errors/                      # Error tracking
    └── postcall-errors.json
    └── sms-errors.json
```

Note: `/data` and generated HTML under `/public/demo` and `/public/call` are runtime artifacts and should not be committed to git. Deploys must preserve these directories on the VPS.

---

## 1. Agency Profile

**File:** `/data/agencies/{agency-id}.json`

```typescript
interface AgencyProfile {
  id: string;                        // URL-safe slug
  name: string;

  // Contact
  website: string;
  phone: string;
  email: string | null;
  address: string;

  // Branding
  branding: {
    logoUrl: string | null;
    primaryColor: string;            // Hex
    secondaryColor: string;
    logoBackgroundColor?: string;
  };

  // Metrics
  metrics: {
    teamSize: number;
    listingCount: number;
    soldCount: number | null;
    forRentCount: number | null;
    priceRangeMin: string | null;    // "$600,000"
    priceRangeMax: string | null;
    hasPropertyManagement: boolean;
    hasAfterHoursNumber: boolean;
    hasChatWidget: boolean;
    hasOnlineBooking: boolean;
    principalName: string | null;
  };

  // Qualification
  painScore: number;                 // 0-100
  painReasons: string[];

  // Metadata
  researchedAt: string;
  dataQuality: 'complete' | 'partial' | 'minimal';
  notes: string | null;

  // Demo Page
  demoPage?: {
    generated: boolean;
    generatedAt: string | null;
    url: string | null;
  };
}
```

---

## 2. Call Data

**File:** `/data/calls/{callId}.json`

```typescript
interface CallData {
  callId: string;                    // "call-{timestamp}-{rand}"
  contextId: string;                 // Links to pending context
  conversationId: string;            // ElevenLabs conversation ID

  timestamp: string;
  duration: number;                  // seconds

  callerPhone: string;
  callerName: string | null;
  status: 'completed' | 'failed' | 'dropped';

  // Agency Context
  agencyId: string;
  agencyName: string;
  agencyData: AgencyProfile | null;

  // Extracted from transcript (by Claude Code)
  extractedData: {
    caller_name?: string;
    caller_intent?: 'buy' | 'sell' | 'rent' | 'other';
    preferred_location?: string;
    budget_range?: string;
    property_type?: string;
    bedrooms?: string;
    additional_notes?: string;
  };

  // Convenience fields
  intent: string | null;
  location: string | null;
  budget: string | null;

  // Transcript
  transcript: string;
  transcriptRaw: Array<{
    role: 'agent' | 'user';
    message: string;
  }>;
  summary: string;

  // Post-Call Page
  pageStatus: 'pending' | 'generating' | 'completed' | 'failed';
  pageUrl: string | null;
  generatedAt: string | null;

  // SMS Delivery (optional; written by sms worker)
  sms?: {
    status: 'pending' | 'sent' | 'failed';
    sentAt?: string;
    messageSid?: string;
    to?: string;
    error?: string;
  };

  // Listings shown
  listingsShown?: Array<{
    address: string;
    price: string;
    url: string;
  }>;
}
```

---

## 3. Pending Call Context

**File:** `/data/context/pending-calls.json`

```typescript
interface VoiceAgentSettings {
  systemPrompt: string;              // Custom system prompt with {{variable}} placeholders
  firstMessage: string;              // Custom first message with {{variable}} placeholders
}

interface PendingCallsContext {
  [contextId: string]: {
    agencyData: AgencyProfile;
    registeredAt: number;            // Unix timestamp
    expiresAt: number;               // registeredAt + 5min
    status: 'pending' | 'active' | 'completed';

    // Optional voice agent customization
    settings?: VoiceAgentSettings;

    // Added when call starts
    callerId?: string;
    callSid?: string;
    activatedAt?: number;

    // Added when call completes
    callId?: string;
    completedAt?: number;
  };
}
```

---

## 4. Agency Call History

**File:** `/data/agency-calls/{agency-id}.json`

```typescript
interface AgencyCallEntry {
  callId: string;
  createdAt: string;
  pageUrl: string | null;
  callerName: string | null;
  summary: string | null;
  status: 'generating' | 'completed' | 'failed';
}

interface AgencyCallsFile {
  agencyId: string;
  calls: AgencyCallEntry[];          // Newest first
}
```

---

## 5. Post-Call Job Queue

**File:** `/data/jobs/postcall/{callId}.json`

```typescript
interface PostcallJob {
  callId: string;
  prompt: string;
  createdAt: string;
  attempts: number;                  // Max 3
}
```

**Job States:**
- `.json` file exists: Pending
- `.processing` file exists: In progress
- File deleted: Completed

**Worker Configuration:**
- `MAX_ATTEMPTS`: 3
- `PROCESSING_TIMEOUT_MS`: 90 seconds
- `POLLING_INTERVAL_MS`: 5 seconds
- `STALE_THRESHOLD_MS`: 10 minutes

---

## 6. Error Log

**File:** `/data/errors/postcall-errors.json`

```typescript
interface ErrorEntry {
  callId: string;
  error: string;
  attempts: number;
  timestamp: string;
}

type ErrorLog = ErrorEntry[];
```

---

## 7. Search History

**File:** `/data/history/sessions.json`

```typescript
interface SearchSession {
  sessionId: string;
  name: string;                      // User-editable
  suburb: string;
  requestedCount: number;
  actualCount: number;
  successCount: number;
  createdAt: string;
  completedAt: string | null;
  status: 'running' | 'complete' | 'partial' | 'failed';

  agencies: Array<{
    id: string;
    name: string;
    logoUrl: string | null;
    demoUrl: string | null;
  }>;
}

interface HistoryFile {
  sessions: SearchSession[];         // Max 50, newest first
}
```

---

## API Endpoints

### POST /api/pipeline/start

Start agency search + generation pipeline.

**Request:**
```typescript
{ suburb: string; count: number; }  // count: 1-25
```

**Response:**
```typescript
{ success: boolean; sessionId: string; }
```

---

### GET /api/pipeline/stream

SSE endpoint for real-time progress.

**Query:** `?session={sessionId}`

**Events:**
```typescript
// Todo update
{ type: 'todo_update'; todos: Array<{id, text, status}>; }

// Main agent activity (workspace stream)
{ type: 'main_activity_message'; message: ActivityMessage; found: number; target: number; }

// Subagent activity (per-card stream)
{ type: 'subagent_activity_message'; agencyId: string; message: ActivityMessage; }

// Card update
{ type: 'card_update'; agencyId: string; data: AgencyProgress; }

// Card removed (error)
{ type: 'card_remove'; agencyId: string; reason: string; }

// Pipeline complete
{
  type: 'pipeline_complete';
  sessionId: string;
  totalAgencies: number;
  successCount: number;
  failedCount: number;
  status: 'complete' | 'error' | 'cancelled';
  error?: string;
}
```

---

### POST /api/register-call

Store agency context before user dials.

Notes:
- Demo pages should call this immediately before `tel:` navigation.
- The server supports payloads sent via `navigator.sendBeacon` (raw JSON body) and `fetch(..., { keepalive: true })`.
- The demo phone number is enforced by the server and returned in the response (do not hardcode agency phone numbers in `tel:` links for the demo call).

**Request:**
```typescript
{
  agencyData: { id, name, location, phone, ... };
  timestamp: number;
  sessionId?: string;               // Optional pipeline session attribution (validated)
  settings?: VoiceAgentSettings;     // Optional voice agent customization
}
```

**Response:**
```typescript
{
  success: boolean;
  contextId: string;
  expiresAt: number;
  phoneNumber: string;         // E.164, example: "+614832945767"
  displayPhoneNumber: string;  // Example: "04832945767"
}
```

---

### GET /api/call-status

Poll for generated page status.

**Query:** `?agency={agencyId}`

**Response:**
```typescript
{
  hasRecentCall: boolean;
  callId?: string;
  status?: 'generating' | 'completed' | 'failed';
  pageUrl?: string;
  callerName?: string;
  generatedAt?: string;
}
```

---

### GET /api/agency-calls

Get call history for an agency.

**Query:** `?agency={agencyId}`

**Response:**
```typescript
{ agencyId: string; calls: AgencyCallEntry[]; }
```

---

### GET /api/history

Fetch search session history.

**Response:**
```typescript
{ sessions: SearchSession[]; }
```

---

### PATCH /api/history/{sessionId}

Rename a session.

**Request:**
```typescript
{ name: string; }
```

---

### GET /api/calls

Fetch recent calls (newest first).

**Response:**
```typescript
{
  calls: Array<{
    callId: string;
    timestamp: string;
    agencyId: string;
    agencyName: string;
    pageStatus: 'pending' | 'generating' | 'completed' | 'failed';
    pageUrl: string | null;
    duration?: number | null;
    callerName?: string | null;
    summary?: string | null;
  }>;
}
```

---

### GET /api/calls/stream

SSE endpoint for streaming call list updates.

**Events:**
```typescript
{ type: 'calls_update'; calls: CallListItem[]; }
```

---

### GET /api/calls/{callId}

Fetch a call detail record and post-call generation activity (if present).

**Response:**
```typescript
{
  call: CallData;
  postcallActivity: null | {
    status: 'active' | 'complete';
    messages: ActivityMessage[];
  };
}
```

---

### GET /api/calls/stream-detail

SSE endpoint for a single call.

**Query:** `?callId={callId}`

**Events:**
```typescript
{ type: 'call_update'; call: CallData; }
{ type: 'postcall_activity_message'; callId: string; message: ActivityMessage; }
{ type: 'postcall_activity_status'; callId: string; status: 'active' | 'complete'; }
```

---

## Webhook Endpoints

### POST /api/webhook/personalize

ElevenLabs calls before each conversation.

**Request (from ElevenLabs):**
```typescript
{
  caller_id: string;
  agent_id: string;
  called_number: string;
  call_sid: string;
}
```

**Response:**
```typescript
{
  type: 'conversation_initiation_client_data';
  dynamic_variables: {
    agency_name: string;
    agency_location: string;
    agency_phone: string;
    demo_page_url: string;
    context_id: string;
    caller_name: string; // Present for templating; may be empty if unknown
  };
  conversation_config_override?: {
    agent?: {
      prompt?: { prompt: string };
      first_message?: string;
    };
  };
}
```

**Context Matching (ordered):**
1. Recently active context matching this `call_sid` (retry-safe)
2. Recently active context matching this `caller_id`
3. Most recent active context (5-min window)
4. Most recent pending context (within TTL; marked active)
5. Fallback to any valid unexpired context, else default

---

### POST /api/webhook/call-complete

ElevenLabs calls after conversation ends.

**Request (from ElevenLabs):**
```typescript
{
  type: 'post_call_transcription';
  event_timestamp: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status: 'completed' | 'failed' | 'dropped';
    transcript: Array<{ role: 'agent' | 'user'; message: string; }>;
    metadata: {
      call_duration_secs: number;
      from_number: string;
      to_number: string;
    };
    analysis: {
      transcript_summary: string;
      call_successful: boolean;
    };
    conversation_initiation_client_data?: {
      dynamic_variables: {
        agency_name: string;
        context_id: string;
        demo_page_url: string;
      };
    };
  };
}
```

**Response:**
```typescript
{ success: boolean; callId: string; pageGenerationStarted: boolean; }
```

**Context Matching (ordered):**
1. `context_id` from dynamic_variables
2. `callSid` match
3. `callerId` phone number match
4. Recent pending context fallback

---

## SMS Notification

Sent after successful post-call page generation.

**Trigger:** Call JSON indicates a completed page (`pageStatus="completed"` and `pageUrl` is set).

**Message Format:**
```
{agencyName} found properties for you: {pageUrl}
```

**Example:**
```
Ray White Surry Hills found properties for you: https://theagentic.engineer/call/call-1768493009666-fe33yd
```

**Implementation:**
- SMS is handled by a dedicated worker that processes `/data/jobs/sms/{callId}.json`.
- The worker is idempotent and will not send twice for the same `callId` (writes `callData.sms.status="sent"`).

**Error Handling:**
- SMS failure: retry up to N attempts, then set `callData.sms.status="failed"` and log to `/data/errors/sms-errors.json`.
- Missing prerequisites (no `callerPhone`, page not ready): keep job pending and retry later.

---

## Webhook Security

**HMAC-SHA256 Verification:**
```typescript
// Headers (accept either):
// - elevenlabs-signature
// - x-elevenlabs-signature
//
// Production behavior:
// - If ELEVENLABS_WEBHOOK_SECRET is missing: return 500 (misconfiguration)
// - If signature header is missing/invalid: return 401
//
// Signature formats supported:
// - Raw HMAC-SHA256(payload) hex
// - Stripe-like "t=<ts>,v0=<hmacHex(ts.payload)>"
// - Base64 HMAC-SHA256(payload)
```

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Suburb search | `{suburb-slug}.json` | `surry-hills.json` |
| Agency | `{agency-slug}.json` | `ray-white-surry-hills.json` |
| Call | `call-{timestamp}-{random}.json` | `call-1705312200-abc123.json` |
| Demo page | `{agency-slug}.html` | `ray-white-surry-hills.html` |
| Post-call page | `{call-id}.html` | `call-1705312200-abc123.html` |
| Pipeline progress | `pipeline-{sessionId}.json` | `pipeline-pipe-1705312200-x7k9m.json` |
| Agency progress | `agency-{agencyId}.json` | `agency-ray-white-surry-hills.json` |

**Slug Generation:**
```typescript
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

---

## Data Lifecycle

| Data Type | Created | Updated | Retention |
|-----------|---------|---------|-----------|
| Agency | Suburb search | Demo generation | Indefinite |
| Call | Webhook | Page generation | 30 days |
| Context | Register call | Call complete | 5 min TTL + cleanup |
| Progress | Pipeline start | Real-time | 24 hours |
| History | Pipeline complete | Rename | 50 sessions max |
| Jobs | Enqueue | Processing | Deleted on success |
