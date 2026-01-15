# 06 - Webhook Handlers

## Overview

This document specifies the webhook endpoints that handle communication between ElevenLabs, Twilio, and our Next.js application.

---

## Webhook Endpoints Summary

| Endpoint | Purpose | Called By |
|----------|---------|-----------|
| `/api/webhook/personalize` | Inject agency context before call | ElevenLabs |
| `/api/webhook/call-complete` | Process completed call, trigger page generation | ElevenLabs |
| `/api/register-call` | Store call context from demo page | Demo Page JS |
| `/api/call-status` | Poll for generated page status | Demo Page JS |

---

## 1. Register Call Endpoint

**Purpose:** Store agency context before user dials

**URL:** `POST /api/register-call`

**Called by:** Demo page JavaScript when user clicks "Call Demo"

### Request

```typescript
interface RegisterCallRequest {
  agencyData: {
    id: string;
    name: string;
    location: string;
    phone: string;
    greeting: string;
    teamSize: number;
    listingCount: number;
    hasPropertyManagement: boolean;
  };
  timestamp: number;
  sessionId?: string; // Optional browser session ID
}
```

### Response

```typescript
interface RegisterCallResponse {
  success: boolean;
  contextId: string; // Unique ID for this call context
  expiresAt: number; // Timestamp when context expires
}
```

### Implementation

```typescript
// app/api/register-call/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';

const CONTEXT_FILE = '/data/context/pending-calls.json';
const CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agencyData, timestamp } = body;

    // Generate unique context ID
    const contextId = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Load existing contexts
    let contexts: Record<string, any> = {};
    try {
      const existing = await readFile(CONTEXT_FILE, 'utf-8');
      contexts = JSON.parse(existing);
    } catch (e) {
      // File doesn't exist yet, start fresh
    }

    // Clean expired contexts
    const now = Date.now();
    for (const key of Object.keys(contexts)) {
      if (contexts[key].expiresAt < now) {
        delete contexts[key];
      }
    }

    // Store new context
    const expiresAt = now + CONTEXT_TTL_MS;
    contexts[contextId] = {
      agencyData,
      registeredAt: timestamp,
      expiresAt,
      status: 'pending' // pending -> active -> completed
    };

    // Save
    await writeFile(CONTEXT_FILE, JSON.stringify(contexts, null, 2));

    return NextResponse.json({
      success: true,
      contextId,
      expiresAt
    });

  } catch (error) {
    console.error('Register call error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
```

---

## 2. Personalization Webhook

**Purpose:** Provide agency context to ElevenLabs before call starts

**URL:** `POST /api/webhook/personalize`

**Called by:** ElevenLabs when a call is initiated

### Request (from ElevenLabs)

```typescript
interface PersonalizationRequest {
  caller_id: string;      // Caller's phone number
  agent_id: string;       // ElevenLabs agent ID
  called_number: string;  // Twilio number called
  call_sid: string;       // Twilio call SID
}
```

### Response (to ElevenLabs)

```typescript
interface PersonalizationResponse {
  dynamic_variables: {
    agency_name: string;
    agency_location: string;
    agency_phone: string;
    demo_page_url: string;
  };
  conversation_config_override?: {
    agent?: {
      first_message?: string;
    };
  };
}
```

### Implementation

```typescript
// app/api/webhook/personalize/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';

const CONTEXT_FILE = '/data/context/pending-calls.json';
const DEFAULT_AGENCY = {
  name: 'Voqo Demo Agency',
  location: 'Sydney',
  phone: '+61 2 0000 0000'
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caller_id, call_sid } = body;

    console.log(`Personalization request for caller: ${caller_id}, call: ${call_sid}`);

    // Load pending contexts
    let contexts: Record<string, any> = {};
    try {
      const existing = await readFile(CONTEXT_FILE, 'utf-8');
      contexts = JSON.parse(existing);
    } catch (e) {
      // No contexts file
    }

    // Find most recent pending context (within TTL)
    // Strategy: Use most recently registered context that's still pending
    const now = Date.now();
    let matchedContext = null;
    let matchedId = null;

    const pendingContexts = Object.entries(contexts)
      .filter(([_, ctx]) => ctx.status === 'pending' && ctx.expiresAt > now)
      .sort((a, b) => b[1].registeredAt - a[1].registeredAt);

    if (pendingContexts.length > 0) {
      [matchedId, matchedContext] = pendingContexts[0];

      // Mark as active
      contexts[matchedId].status = 'active';
      contexts[matchedId].callerId = caller_id;
      contexts[matchedId].callSid = call_sid;
      contexts[matchedId].activatedAt = now;

      await writeFile(CONTEXT_FILE, JSON.stringify(contexts, null, 2));
    }

    // Build response
    const agencyData = matchedContext?.agencyData || DEFAULT_AGENCY;

    const response: PersonalizationResponse = {
      dynamic_variables: {
        agency_name: agencyData.name,
        agency_location: agencyData.location || agencyData.address?.split(',')[0] || 'Sydney',
        agency_phone: agencyData.phone,
        demo_page_url: `/demo/${agencyData.id}`
      }
    };

    // Optionally customize first message
    if (agencyData.name !== DEFAULT_AGENCY.name) {
      response.conversation_config_override = {
        agent: {
          first_message: `Hi! Thanks for calling ${agencyData.name}. I'm their AI assistant - how can I help you today?`
        }
      };
    }

    console.log(`Returning context for agency: ${agencyData.name}`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Personalization webhook error:', error);

    // Return default context on error (don't fail the call)
    return NextResponse.json({
      dynamic_variables: {
        agency_name: DEFAULT_AGENCY.name,
        agency_location: DEFAULT_AGENCY.location,
        agency_phone: DEFAULT_AGENCY.phone,
        demo_page_url: '/demo/default'
      }
    });
  }
}
```

---

## 3. Call Complete Webhook

**Purpose:** Process completed call, trigger post-call page generation

**URL:** `POST /api/webhook/call-complete`

**Called by:** ElevenLabs after call ends

### Request (from ElevenLabs)

```typescript
interface CallCompleteWebhook {
  type: 'post_call_transcription';
  event_timestamp: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status: 'completed' | 'failed' | 'dropped';
    transcript: Array<{
      role: 'agent' | 'user';
      message: string;
    }>;
    metadata: {
      call_duration_secs: number;
      cost: number;
      from_number: string;  // Caller phone
      to_number: string;    // Twilio number
    };
    analysis: {
      transcript_summary: string;
      call_successful: boolean;
      data_collection_results: {
        caller_name?: string;
        caller_intent?: string;
        preferred_location?: string;
        budget_range?: string;
        property_type?: string;
        additional_notes?: string;
      };
    };
    conversation_initiation_client_data?: {
      dynamic_variables: {
        agency_name: string;
        agency_location: string;
      };
    };
  };
}
```

### Response

```typescript
interface CallCompleteResponse {
  success: boolean;
  callId: string;
  pageGenerationStarted: boolean;
}
```

### Implementation

```typescript
// app/api/webhook/call-complete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const CONTEXT_FILE = '/data/context/pending-calls.json';
const CALLS_DIR = '/data/calls';

export async function POST(request: NextRequest) {
  try {
    const body: CallCompleteWebhook = await request.json();

    console.log('Call complete webhook received:', body.type);

    if (body.type !== 'post_call_transcription') {
      return NextResponse.json({ success: true, message: 'Event type ignored' });
    }

    const { data } = body;
    const callerId = data.metadata.from_number;

    // Generate call ID
    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Find matching context by caller ID
    let contexts: Record<string, any> = {};
    let matchedContext = null;
    let matchedId = null;

    try {
      const existing = await readFile(CONTEXT_FILE, 'utf-8');
      contexts = JSON.parse(existing);

      // Find context with matching caller ID
      for (const [id, ctx] of Object.entries(contexts)) {
        if (ctx.callerId === callerId && ctx.status === 'active') {
          matchedContext = ctx;
          matchedId = id;
          break;
        }
      }
    } catch (e) {
      // No contexts file
    }

    // Build transcript string
    const transcriptText = data.transcript
      .map(t => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`)
      .join('\n\n');

    // Prepare call data
    const callData = {
      callId,
      conversationId: data.conversation_id,
      timestamp: new Date().toISOString(),
      duration: data.metadata.call_duration_secs,
      callerPhone: callerId,
      status: data.status,

      // Agency context
      agencyId: matchedContext?.agencyData?.id || 'unknown',
      agencyName: matchedContext?.agencyData?.name ||
                  data.conversation_initiation_client_data?.dynamic_variables?.agency_name ||
                  'Unknown Agency',
      agencyData: matchedContext?.agencyData || null,

      // Extracted data
      extractedData: data.analysis.data_collection_results,
      callerName: data.analysis.data_collection_results?.caller_name || null,
      intent: data.analysis.data_collection_results?.caller_intent || null,
      location: data.analysis.data_collection_results?.preferred_location || null,
      budget: data.analysis.data_collection_results?.budget_range || null,

      // Transcript
      transcript: transcriptText,
      transcriptRaw: data.transcript,
      summary: data.analysis.transcript_summary,

      // Page generation status
      pageStatus: 'generating',
      pageUrl: null,
      generatedAt: null
    };

    // Ensure calls directory exists
    await mkdir(CALLS_DIR, { recursive: true });

    // Save call data
    const callFilePath = path.join(CALLS_DIR, `${callId}.json`);
    await writeFile(callFilePath, JSON.stringify(callData, null, 2));

    // Update context status
    if (matchedId) {
      contexts[matchedId].status = 'completed';
      contexts[matchedId].callId = callId;
      contexts[matchedId].completedAt = Date.now();
      await writeFile(CONTEXT_FILE, JSON.stringify(contexts, null, 2));
    }

    // Trigger page generation (async, don't wait)
    triggerPageGeneration(callId, callData);

    return NextResponse.json({
      success: true,
      callId,
      pageGenerationStarted: true
    });

  } catch (error) {
    console.error('Call complete webhook error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

async function triggerPageGeneration(callId: string, callData: any) {
  try {
    console.log(`Triggering page generation for call: ${callId}`);

    // Build prompt for Claude Code
    const prompt = `
Use the postcall-page-builder skill to generate a personalized page for this completed call.

Call ID: ${callId}

Transcript:
${callData.transcript}

Extracted Data:
- Caller Name: ${callData.callerName || 'Unknown'}
- Intent: ${callData.intent || 'Unknown'}
- Location: ${callData.location || 'Not specified'}
- Budget: ${callData.budget || 'Not specified'}

Agency Context:
- Agency: ${callData.agencyName}
- Agency ID: ${callData.agencyId}
${callData.agencyData ? JSON.stringify(callData.agencyData, null, 2) : ''}

Instructions:
1. Analyze the transcript for any additional requirements
2. Search for matching property listings based on caller requirements
3. Generate a personalized HTML page using the postcall-page-builder skill
4. Save the HTML to: /public/call/${callId}.html
5. Update /data/calls/${callId}.json with pageStatus: "completed" and pageUrl: "/call/${callId}"
`;

    // Invoke Claude Code
    // This could be via:
    // - Subprocess: claude-code --print --dangerously-skip-permissions -p "prompt"
    // - SDK: @anthropic-ai/claude-agent-sdk
    // - API endpoint that triggers Claude Code

    // Example subprocess approach:
    const command = `cd /var/www/voqo-demo && claude-code --print --dangerously-skip-permissions -p "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

    // Run in background
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Page generation error for ${callId}:`, error);
        // Update status to failed
        updateCallStatus(callId, 'failed', null);
      } else {
        console.log(`Page generation completed for ${callId}`);
        updateCallStatus(callId, 'completed', `/call/${callId}`);
      }
    });

  } catch (error) {
    console.error('Page generation trigger error:', error);
  }
}

async function updateCallStatus(callId: string, status: string, pageUrl: string | null) {
  try {
    const callFilePath = path.join(CALLS_DIR, `${callId}.json`);
    const callData = JSON.parse(await readFile(callFilePath, 'utf-8'));

    callData.pageStatus = status;
    callData.pageUrl = pageUrl;
    callData.generatedAt = new Date().toISOString();

    await writeFile(callFilePath, JSON.stringify(callData, null, 2));
  } catch (error) {
    console.error('Update call status error:', error);
  }
}
```

---

## 4. Call Status Endpoint

**Purpose:** Allow demo page to poll for generated page status

**URL:** `GET /api/call-status`

**Called by:** Demo page JavaScript (polling)

### Request

```
GET /api/call-status?agency=ray-white-surry-hills
```

### Response

```typescript
interface CallStatusResponse {
  hasRecentCall: boolean;
  callId?: string;
  status?: 'generating' | 'completed' | 'failed';
  pageUrl?: string;
  callerName?: string;
  generatedAt?: string;
}
```

### Implementation

```typescript
// app/api/call-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';

const CALLS_DIR = '/data/calls';

export async function GET(request: NextRequest) {
  try {
    const agencyId = request.nextUrl.searchParams.get('agency');

    if (!agencyId) {
      return NextResponse.json({ hasRecentCall: false });
    }

    // Find recent calls for this agency
    const files = await readdir(CALLS_DIR);
    const callFiles = files.filter(f => f.endsWith('.json'));

    // Check recent calls (last 10 minutes)
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    let recentCall = null;

    for (const file of callFiles.reverse()) { // Most recent first
      const callData = JSON.parse(
        await readFile(path.join(CALLS_DIR, file), 'utf-8')
      );

      const callTime = new Date(callData.timestamp).getTime();

      if (callData.agencyId === agencyId && callTime > tenMinutesAgo) {
        recentCall = callData;
        break;
      }
    }

    if (!recentCall) {
      return NextResponse.json({ hasRecentCall: false });
    }

    return NextResponse.json({
      hasRecentCall: true,
      callId: recentCall.callId,
      status: recentCall.pageStatus,
      pageUrl: recentCall.pageUrl,
      callerName: recentCall.callerName,
      generatedAt: recentCall.generatedAt
    });

  } catch (error) {
    console.error('Call status error:', error);
    return NextResponse.json({ hasRecentCall: false });
  }
}
```

---

## Webhook Security

### ElevenLabs Signature Verification

ElevenLabs signs webhooks with HMAC SHA256.

```typescript
import crypto from 'crypto';

function verifyElevenLabsSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In webhook handler:
const signature = request.headers.get('elevenlabs-signature');
const rawBody = await request.text();

if (!verifyElevenLabsSignature(rawBody, signature, process.env.WEBHOOK_SECRET)) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

---

## Error Handling

### Webhook Failures

If webhook processing fails:
1. Log detailed error
2. Return 200 OK anyway (prevent retries flooding)
3. Store error for debugging
4. Use fallback/default behavior

### Page Generation Failures

If Claude Code fails to generate page:
1. Update call status to 'failed'
2. Log the error
3. Demo page shows fallback message
4. Optionally trigger retry

---

## Testing Webhooks

### Local Development

Use ngrok to expose local server:

```bash
ngrok http 3000
```

Update ElevenLabs webhook URLs to ngrok URL.

### Webhook Testing Checklist

- [ ] Personalization webhook returns valid JSON
- [ ] Default agency used when no context found
- [ ] Call complete webhook saves call data
- [ ] Page generation triggered after call
- [ ] Call status returns recent call info
- [ ] Signature verification works
- [ ] Error handling doesn't crash server
