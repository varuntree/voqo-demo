import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import type { VoiceAgentSettings } from '@/lib/types';
import { safeJsonParse, safeStringEqual, updateJsonFileWithLock } from '@/lib/fs-json';
import { verifyElevenLabsWebhookSignature } from '@/lib/elevenlabs-webhook';

const CONTEXT_FILE = path.join(process.cwd(), 'data/context/pending-calls.json');
const DEFAULT_AGENCY = {
  name: 'Voqo Demo Agency',
  location: 'Sydney',
  phone: '+61 2 0000 0000'
};
const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET;
const WEBHOOK_TOKEN = process.env.ELEVENLABS_WEBHOOK_TOKEN;
const REQUIRE_WEBHOOK_SIGNATURE = process.env.ELEVENLABS_REQUIRE_WEBHOOK_SIGNATURE === '1';
const DEBUG_WEBHOOKS = process.env.DEBUG_WEBHOOKS === '1';

export const runtime = 'nodejs';

interface AgencyData {
  id?: string;
  name: string;
  location?: string;
  address?: string;
  phone: string;
}

interface PendingCallContext {
  agencyData: AgencyData;
  registeredAt: number | string;
  expiresAt: number;
  status: string;
  callerId?: string;
  callSid?: string;
  activatedAt?: number;
  settings?: VoiceAgentSettings;
}

// Substitute variables in template strings
function substituteVariables(
  template: string,
  vars: {
    agency_name: string;
    agency_location: string;
    agency_phone: string;
    demo_page_url: string;
    context_id: string;
    caller_name?: string;
  }
): string {
  return template
    .replace(/\{\{agency_name\}\}/g, vars.agency_name)
    .replace(/\{\{agency_location\}\}/g, vars.agency_location)
    .replace(/\{\{agency_phone\}\}/g, vars.agency_phone)
    .replace(/\{\{demo_page_url\}\}/g, vars.demo_page_url)
    .replace(/\{\{context_id\}\}/g, vars.context_id)
    .replace(/\{\{caller_name\}\}/g, vars.caller_name ?? '');
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-elevenlabs-signature') || request.headers.get('elevenlabs-signature');

    // Optional: shared-token verification (works even if ElevenLabs doesn't send a signature header).
    if (WEBHOOK_TOKEN) {
      const tokenFromQuery = request.nextUrl.searchParams.get('token');
      const tokenFromHeader = request.headers.get('x-voqo-webhook-token');
      const provided = tokenFromQuery || tokenFromHeader;
      if (!provided || !safeStringEqual(provided, WEBHOOK_TOKEN)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Signature verification:
    // - Enforce only when ELEVENLABS_REQUIRE_WEBHOOK_SIGNATURE=1, OR when a signature is present (best-effort).
    // - This avoids breaking phone calls if ElevenLabs does not include a signature header for this webhook.
    const shouldVerifySignature = REQUIRE_WEBHOOK_SIGNATURE || !!signature;
    if (shouldVerifySignature) {
      const verification = verifyElevenLabsWebhookSignature(rawBody, signature, WEBHOOK_SECRET);
      if (!verification.ok) {
        console.error('[PERSONALIZE] Signature verification failed:', verification.reason);
        const status = verification.reason.includes('Missing ELEVENLABS_WEBHOOK_SECRET') ? 500 : 401;
        return NextResponse.json({ error: 'Signature verification failed' }, { status });
      }
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('[PERSONALIZE] Missing signature header; accepting unsigned webhook (set ELEVENLABS_REQUIRE_WEBHOOK_SIGNATURE=1 to enforce).');
    }

    const body = safeJsonParse<any>(rawBody);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (DEBUG_WEBHOOKS) {
      console.log('[PERSONALIZE] Webhook triggered at', new Date().toISOString());
      console.log('[PERSONALIZE] Body:', JSON.stringify(body, null, 2));
    }

    const { caller_id, call_sid, agent_id, called_number } = body;
    if (DEBUG_WEBHOOKS) {
      console.log('[PERSONALIZE] Parsed fields:', { caller_id, call_sid, agent_id, called_number });
    }

    const now = Date.now();
    let matchedContext: PendingCallContext | null = null;
    let matchedId: string | null = null;

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

      const RECENT_ACTIVE_WINDOW_MS = 5 * 60 * 1000; // match TTL window
      const allEntries = Object.entries(contexts);

      const activeCandidates = allEntries
        .filter(([, ctx]) => ctx.status === 'active' && typeof ctx.activatedAt === 'number' && (now - ctx.activatedAt) < RECENT_ACTIVE_WINDOW_MS)
        .sort((a, b) => (b[1].activatedAt || 0) - (a[1].activatedAt || 0));

      // Prefer an active context that matches this call, if available.
      const activeByCallSid = typeof call_sid === 'string'
        ? activeCandidates.find(([, ctx]) => ctx.callSid === call_sid)
        : undefined;
      const activeByCallerId = typeof caller_id === 'string'
        ? activeCandidates.find(([, ctx]) => ctx.callerId === caller_id)
        : undefined;

      const chosenActive = activeByCallSid || activeByCallerId || activeCandidates[0];
      if (chosenActive) {
        [matchedId, matchedContext] = chosenActive;
        return contexts;
      }

      const pendingCandidates = allEntries
        .filter(([, ctx]) => ctx.status === 'pending' && typeof ctx.expiresAt === 'number' && ctx.expiresAt > now)
        .sort((a, b) => {
          const timeA = typeof a[1].registeredAt === 'number' ? a[1].registeredAt : new Date(a[1].registeredAt).getTime();
          const timeB = typeof b[1].registeredAt === 'number' ? b[1].registeredAt : new Date(b[1].registeredAt).getTime();
          return timeB - timeA;
        });

      if (pendingCandidates.length > 0) {
        [matchedId, matchedContext] = pendingCandidates[0];
        const ctx = contexts[matchedId];
        if (ctx) {
          ctx.status = 'active';
          if (typeof caller_id === 'string') ctx.callerId = caller_id;
          if (typeof call_sid === 'string') ctx.callSid = call_sid;
          ctx.activatedAt = now;
        }
        return contexts;
      }

      const anyValid = allEntries
        .filter(([, ctx]) => typeof ctx.expiresAt === 'number' && ctx.expiresAt > now && ctx.agencyData?.name)
        .sort((a, b) => b[1].expiresAt - a[1].expiresAt);

      if (anyValid.length > 0) {
        [matchedId, matchedContext] = anyValid[0];
      }
      return contexts;
    }).catch((error) => {
      if (DEBUG_WEBHOOKS) console.error('[PERSONALIZE] Context update failed:', error);
    });

    const matched = matchedContext as unknown as PendingCallContext | null;

    // Build response
    const agencyData: AgencyData = matched?.agencyData || { ...DEFAULT_AGENCY };
    const agencyLocation = agencyData.location ||
      agencyData.address?.split(',')[0] ||
      'Sydney';

    const dynamicVars = {
      agency_name: agencyData.name,
      agency_location: agencyLocation,
      agency_phone: agencyData.phone,
      demo_page_url: `/demo/${agencyData.id || 'default'}`,
      context_id: matchedId || 'default',
      caller_name: '',
    };

    const response: {
      type: string;
      dynamic_variables: typeof dynamicVars;
      conversation_config_override?: {
        agent: {
          prompt?: { prompt: string };
          first_message?: string;
        };
      };
    } = {
      type: 'conversation_initiation_client_data',
      dynamic_variables: dynamicVars
    };

    // Apply custom settings if provided, otherwise use default first message
    const settings = matched?.settings;
    if (settings) {
      if (DEBUG_WEBHOOKS) console.log('[PERSONALIZE] Applying custom voice agent settings');
      response.conversation_config_override = {
        agent: {
          prompt: { prompt: substituteVariables(settings.systemPrompt, dynamicVars) },
          first_message: substituteVariables(settings.firstMessage, dynamicVars)
        }
      };
    } else if (agencyData.name !== DEFAULT_AGENCY.name) {
      // Fallback: custom first message only (legacy behavior)
      response.conversation_config_override = {
        agent: {
          first_message: `Hi! Thanks for calling ${agencyData.name}. I'm their AI assistant - how can I help you today?`
        }
      };
    }

    if (DEBUG_WEBHOOKS) console.log('[PERSONALIZE] Response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);

  } catch (error) {
    console.error('[PERSONALIZE] Error:', error);

    // Return default on error (don't fail the call)
    const errorResponse = {
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        agency_name: DEFAULT_AGENCY.name,
        agency_location: DEFAULT_AGENCY.location,
        agency_phone: DEFAULT_AGENCY.phone,
        demo_page_url: '/demo/default',
        context_id: 'default',
        caller_name: '',
      }
    };
    return NextResponse.json(errorResponse);
  }
}
