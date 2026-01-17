import { NextRequest, NextResponse } from 'next/server';
import { readFile, mkdir } from 'fs/promises';
import path from 'path';
import { updateAgencyCall } from '@/lib/agency-calls';
import { enqueuePostcallJob, ensurePostcallWorker } from '@/lib/postcall-queue';
import { ensureSmsWorker } from '@/lib/sms-queue';
import { safeJsonParse, updateJsonFileWithLock } from '@/lib/fs-json';
import { verifyElevenLabsWebhookSignature } from '@/lib/elevenlabs-webhook';
import { getOrCreateCallIdForConversation } from '@/lib/call-conversation-index';

const CONTEXT_FILE = path.join(process.cwd(), 'data/context/pending-calls.json');
const CALLS_DIR = path.join(process.cwd(), 'data/calls');
const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET;
const DEBUG_WEBHOOKS = process.env.DEBUG_WEBHOOKS === '1';

export const runtime = 'nodejs';

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

interface PendingCallContext {
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
  ensurePostcallWorker();
  ensureSmsWorker();

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-elevenlabs-signature') || request.headers.get('elevenlabs-signature');

    if (process.env.NODE_ENV === 'production') {
      const verification = verifyElevenLabsWebhookSignature(rawBody, signature, WEBHOOK_SECRET);
      if (!verification.ok) {
        console.error('[CALL-COMPLETE] Signature verification failed:', verification.reason);
        const status = verification.reason.includes('Missing ELEVENLABS_WEBHOOK_SECRET') ? 500 : 401;
        return NextResponse.json({ error: 'Signature verification failed' }, { status });
      }
    }

    const body = safeJsonParse<CallCompleteWebhook>(rawBody);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (DEBUG_WEBHOOKS) {
      console.log('[CALL-COMPLETE] Webhook triggered at', new Date().toISOString());
      console.log('[CALL-COMPLETE] Event type:', body.type);
    }

    if (body.type !== 'post_call_transcription') {
      if (DEBUG_WEBHOOKS) console.log('[CALL-COMPLETE] Ignoring event type:', body.type);
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

    // Generate or reuse call ID (idempotency across webhook retries).
    const callIdResult = await getOrCreateCallIdForConversation(data.conversation_id, () => {
      return `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }).catch(() => null);
    const callId = callIdResult?.callId || `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Find matching context
    let matchedContext: PendingCallContext | null = null;
    let matchedId: string | null = null;
    const now = Date.now();

    await updateJsonFileWithLock<Record<string, PendingCallContext>>(CONTEXT_FILE, (current) => {
      const contexts: Record<string, PendingCallContext> =
        current && typeof current === 'object' ? { ...(current as Record<string, PendingCallContext>) } : {};

      // Prune expired contexts
      for (const key of Object.keys(contexts)) {
        const ctx = contexts[key];
        if (ctx && typeof ctx.expiresAt === 'number' && ctx.expiresAt < now) {
          delete contexts[key];
        }
      }

      if (contextId && contexts[contextId]) {
        matchedId = contextId;
        matchedContext = contexts[contextId];
      } else {
        const byCallSid = Object.entries(contexts).find(([, ctx]) => ctx.callSid === callSid);
        if (byCallSid) {
          [matchedId, matchedContext] = byCallSid;
        } else {
          const byCaller = Object.entries(contexts).find(([, ctx]) => ctx.callerId === callerId && ctx.status === 'active');
          if (byCaller) {
            [matchedId, matchedContext] = byCaller;
          } else {
            const recentPending = Object.entries(contexts)
              .filter(([, ctx]) => ctx.status === 'pending')
              .sort((a, b) => {
                const timeA = typeof a[1].registeredAt === 'number' ? a[1].registeredAt : new Date(a[1].registeredAt || 0).getTime();
                const timeB = typeof b[1].registeredAt === 'number' ? b[1].registeredAt : new Date(b[1].registeredAt || 0).getTime();
                return timeB - timeA;
              });
            if (recentPending.length > 0) {
              [matchedId, matchedContext] = recentPending[0];
            }
          }
        }
      }

      if (matchedId && contexts[matchedId]) {
        contexts[matchedId].status = 'completed';
        contexts[matchedId].callId = callId;
        contexts[matchedId].completedAt = now;
        contexts[matchedId].callSid = contexts[matchedId].callSid || callSid;
        contexts[matchedId].callerId = contexts[matchedId].callerId || callerId || undefined;
      }

      return contexts;
    }).catch(() => undefined);

    // Build transcript string
    const transcriptText = data.transcript
      .map(t => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`)
      .join('\n\n');

    // Prepare call data
    // NOTE: We do NOT use data.analysis.data_collection_results
    // Claude Code skill extracts ALL data directly from the raw transcript
    const matched = matchedContext as unknown as PendingCallContext | null;

    const agencyIdFromContext = matched?.agencyData?.id || matched?.agencyId;
    const agencyNameFromContext = matched?.agencyData?.name || matched?.agencyName;
    const agencyIdFromDemo = dynamicVars?.demo_page_url?.replace('/demo/', '');

    const callData = {
      callId,
      contextId: matchedId || contextId || null,
      sessionId: matched?.sessionId || null,
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
      agencyData: matched?.agencyData || null,

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
    await updateJsonFileWithLock<Record<string, unknown>>(callFilePath, (current) => {
      if (!current || typeof current !== 'object') return callData as unknown as Record<string, unknown>;
      const existing = current as Record<string, unknown>;

      // Prefer existing values for fields that may have been updated by workers.
      return {
        ...callData,
        ...existing,
        pageStatus: (existing.pageStatus ?? callData.pageStatus) as unknown,
        pageUrl: (existing.pageUrl ?? callData.pageUrl) as unknown,
        generatedAt: (existing.generatedAt ?? callData.generatedAt) as unknown,
        extractedData: (existing.extractedData ?? callData.extractedData) as unknown,
        listingsShown: (existing.listingsShown ?? (callData as any).listingsShown) as unknown,
        sms: (existing.sms ?? (callData as any).sms) as unknown,
        smsSentAt: (existing.smsSentAt ?? (callData as any).smsSentAt) as unknown,
      } as Record<string, unknown>;
    });

    if (callData.agencyId !== 'unknown') {
      await updateAgencyCall(callData.agencyId, callId, {
        createdAt: callData.timestamp,
        status: 'generating',
        summary: callData.summary || null
      });
    }

    // Trigger page generation via durable queue
    if (DEBUG_WEBHOOKS) console.log('[CALL-COMPLETE] Enqueuing page generation for:', callId);
    await enqueuePostcallJob(callId, buildPostcallPrompt(callId, callData));

    const response = {
      success: true,
      callId,
      pageGenerationStarted: true
    };
    return NextResponse.json(response);

  } catch (error) {
    console.error('[CALL-COMPLETE] Error:', error);
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
