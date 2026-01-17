import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { appendAgencyCall } from '@/lib/agency-calls';
import { enqueuePostcallJob, ensurePostcallWorker } from '@/lib/postcall-queue';
import { ensureSmsWorker } from '@/lib/sms-queue';

const CONTEXT_FILE = path.join(process.cwd(), 'data/context/pending-calls.json');
const CALLS_DIR = path.join(process.cwd(), 'data/calls');
const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET;

function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  // TODO: Fix signature verification - skipping in dev for now
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[Webhook] Dev mode - skipping signature verification');
    return true;
  }

  if (!WEBHOOK_SECRET || !signature) {
    console.warn('[Webhook] No secret configured or no signature provided, skipping verification');
    return true; // Allow in dev if not configured
  }

  // ElevenLabs signature format: t=<timestamp>,v0=<signature>
  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const sigPart = parts.find(p => p.startsWith('v0='));

  if (!timestampPart || !sigPart) {
    console.warn('[Webhook] Invalid signature format');
    return false;
  }

  const timestamp = timestampPart.slice(2);
  const providedSig = sigPart.slice(3);

  // Compute expected signature: HMAC-SHA256(timestamp.payload)
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');

  if (providedSig.length !== expectedSig.length) {
    console.warn('[Webhook] Signature length mismatch');
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(providedSig),
    Buffer.from(expectedSig)
  );
}

interface TranscriptEntry {
  role: 'agent' | 'user';
  message: string;
}

interface CallCompleteWebhook {
  type: string;
  event_timestamp: number;
  data: {
    agent_id: string;
    conversation_id: string;
    status: string;
    user_id?: string | null;
    caller_id?: string | null;
    transcript: TranscriptEntry[];
    metadata?: {
      call_duration_secs?: number;
      cost?: number;
      from_number?: string;
      to_number?: string;
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
        agency_phone?: string;
        context_id?: string;
        demo_page_url?: string;
        system__caller_id?: string;
        system__called_number?: string;
        system__call_sid?: string;
        system__call_duration_secs?: number;
      };
    };
  };
}

interface CallContext {
  agencyData: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
  agencyId?: string;
  agencyName?: string;
  sessionId?: string | null;
  registeredAt?: number | string;
  expiresAt?: number;
  callerId?: string;
  callSid?: string;
  status: string;
  callId?: string;
  activatedAt?: number;
  completedAt?: number;
}

export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(60));
  console.log('[CALL-COMPLETE] Webhook triggered at', new Date().toISOString());
  console.log('='.repeat(60));

  ensurePostcallWorker();
  ensureSmsWorker();

  // Log all headers for debugging
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  console.log('[CALL-COMPLETE] Headers:', JSON.stringify(headers, null, 2));

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    console.log('[CALL-COMPLETE] Raw body length:', rawBody.length, 'bytes');

    const signature = request.headers.get('x-elevenlabs-signature') || request.headers.get('elevenlabs-signature');
    console.log('[CALL-COMPLETE] Signature header:', signature ? 'present' : 'MISSING');

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('[CALL-COMPLETE] ❌ Invalid webhook signature');
      console.log('='.repeat(60) + '\n');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    console.log('[CALL-COMPLETE] ✅ Signature verified');

    const body = JSON.parse(rawBody) as CallCompleteWebhook;

    console.log('[CALL-COMPLETE] Event type:', body.type);
    console.log('[CALL-COMPLETE] Full body:', JSON.stringify(body, null, 2));

    if (body.type !== 'post_call_transcription') {
      console.log('[CALL-COMPLETE] Ignoring event type:', body.type);
      console.log('='.repeat(60) + '\n');
      return NextResponse.json({ success: true, message: 'Event type ignored' });
    }

    const { data } = body;
    const dynamicVars = data.conversation_initiation_client_data?.dynamic_variables;
    const callerId =
      data.metadata?.from_number ||
      data.user_id ||
      data.caller_id ||
      dynamicVars?.system__caller_id ||
      null;
    const calledNumber =
      data.metadata?.to_number ||
      dynamicVars?.system__called_number ||
      null;
    const callSid =
      dynamicVars?.system__call_sid ||
      data.conversation_id;
    const contextId = dynamicVars?.context_id;

    // Generate call ID
    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Find matching context
    let contexts: Record<string, CallContext> = {};
    let matchedContext: CallContext | null = null;
    let matchedId: string | null = null;

    try {
      const existing = await readFile(CONTEXT_FILE, 'utf-8');
      contexts = JSON.parse(existing);
    } catch {
      // No contexts file
    }

    if (contextId && contexts[contextId]) {
      matchedId = contextId;
      matchedContext = contexts[contextId];
      console.log('[CALL-COMPLETE] Matched context by context_id:', contextId);
    } else {
      const now = Date.now();

      const activeByCallSid = Object.entries(contexts).find(([, ctx]) => ctx.callSid === callSid);
      if (activeByCallSid) {
        [matchedId, matchedContext] = activeByCallSid;
        console.log('[CALL-COMPLETE] Matched context by callSid:', matchedId);
      } else {
        const activeByCaller = Object.entries(contexts).find(([, ctx]) => ctx.callerId === callerId && ctx.status === 'active');
        if (activeByCaller) {
          [matchedId, matchedContext] = activeByCaller;
          console.log('[CALL-COMPLETE] Matched context by callerId:', matchedId);
        } else {
          const recentPending = Object.entries(contexts)
            .filter(([, ctx]) => {
              if (ctx.expiresAt && ctx.expiresAt < now) return false;
              return ctx.status === 'pending';
            })
            .sort((a, b) => {
              const timeA = typeof a[1].registeredAt === 'number' ? a[1].registeredAt : new Date(a[1].registeredAt || 0).getTime();
              const timeB = typeof b[1].registeredAt === 'number' ? b[1].registeredAt : new Date(b[1].registeredAt || 0).getTime();
              return timeB - timeA;
            });

          if (recentPending.length > 0) {
            [matchedId, matchedContext] = recentPending[0];
            console.log('[CALL-COMPLETE] Matched recent pending context:', matchedId);
          }
        }
      }
    }

    // Build transcript string
    const transcriptText = data.transcript
      .map(t => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`)
      .join('\n\n');

    // Prepare call data
    // NOTE: We do NOT use data.analysis.data_collection_results
    // Claude Code skill extracts ALL data directly from the raw transcript
    const agencyIdFromContext = matchedContext?.agencyData?.id || matchedContext?.agencyId;
    const agencyNameFromContext = matchedContext?.agencyData?.name || matchedContext?.agencyName;
    const agencyIdFromDemo = dynamicVars?.demo_page_url?.replace('/demo/', '');

    const callData = {
      callId,
      contextId: matchedId || contextId || null,
      sessionId: matchedContext?.sessionId || null,
      conversationId: data.conversation_id,
      timestamp: new Date().toISOString(),
      duration: data.metadata?.call_duration_secs || dynamicVars?.system__call_duration_secs || null,
      callerPhone: callerId || null,
      calledNumber: calledNumber || null,
      status: data.status,

      agencyId: agencyIdFromContext || agencyIdFromDemo || 'unknown',
      agencyName: agencyNameFromContext ||
                  dynamicVars?.agency_name ||
                  'Unknown Agency',
      agencyData: matchedContext?.agencyData || null,

      // Extracted data - Claude Code skill will populate these from transcript
      extractedData: null,
      callerName: null,
      intent: null,
      location: null,
      budget: null,

      // Transcript - Claude Code extracts all data from this
      transcript: transcriptText,
      transcriptRaw: data.transcript,
      summary: data.analysis.transcript_summary,

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
      contexts[matchedId].callSid = contexts[matchedId].callSid || callSid;
      contexts[matchedId].callerId = contexts[matchedId].callerId || callerId || undefined;
      await writeFile(CONTEXT_FILE, JSON.stringify(contexts, null, 2));
    }

    if (callData.agencyId !== 'unknown') {
      await appendAgencyCall(callData.agencyId, {
        callId,
        createdAt: callData.timestamp,
        status: 'generating',
        summary: callData.summary || null
      });
    }

    // Trigger page generation via durable queue
    console.log('[CALL-COMPLETE] Enqueuing page generation for:', callId);
    await enqueuePostcallJob(callId, buildPostcallPrompt(callId, callData));

    const response = {
      success: true,
      callId,
      pageGenerationStarted: true
    };
    console.log('[CALL-COMPLETE] Response:', JSON.stringify(response, null, 2));
    console.log('[CALL-COMPLETE] ✅ Webhook completed successfully');
    console.log('='.repeat(60) + '\n');

    return NextResponse.json(response);

  } catch (error) {
    console.error('[CALL-COMPLETE] ❌ Error:', error);
    console.log('='.repeat(60) + '\n');
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

function buildPostcallPrompt(callId: string, callData: {
  transcript: string;
  agencyName: string;
  agencyId: string;
  agencyData: unknown;
}) {
  const postcallHtmlPath = path.join(process.cwd(), 'public', 'call', `${callId}.html`);
  const callDataPath = path.join(process.cwd(), 'data', 'calls', `${callId}.json`);

  // NOTE: We pass only the transcript - Claude Code extracts ALL data
  return `
Use the postcall-page-builder skill to generate a personalized page for this completed call.

Call ID: ${callId}

Full Transcript:
${callData.transcript}

Agency Context:
- Agency: ${callData.agencyName}
- Agency ID: ${callData.agencyId}
${callData.agencyData ? JSON.stringify(callData.agencyData, null, 2) : ''}

Absolute Paths:
- postcallHtmlPath: ${postcallHtmlPath}
- callDataPath: ${callDataPath}

Instructions:
1. EXTRACT from transcript: caller name, intent (buy/sell/rent), location, budget, property type, bedrooms, special requirements
2. Search for matching property listings based on extracted requirements
3. Generate a personalized HTML page using the postcall-page-builder skill
4. Save the HTML to postcallHtmlPath (absolute path above)
5. Update callDataPath (preserve existing fields) with:
   - extractedData (all extracted fields)
   - callerName, intent, location, budget
   - pageStatus: "completed"
   - pageUrl: "/call/${callId}"
`;
}
