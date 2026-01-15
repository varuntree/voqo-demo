import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const CONTEXT_FILE = path.join(process.cwd(), 'data/context/pending-calls.json');
const DEFAULT_AGENCY = {
  name: 'Voqo Demo Agency',
  location: 'Sydney',
  phone: '+61 2 0000 0000'
};

interface AgencyData {
  id?: string;
  name: string;
  location?: string;
  address?: string;
  phone: string;
}

interface CallContext {
  agencyData: AgencyData;
  registeredAt: number | string;
  expiresAt: number;
  status: string;
  callerId?: string;
  callSid?: string;
  activatedAt?: number;
}

export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(60));
  console.log('[PERSONALIZE] 🔔 Webhook triggered at', new Date().toISOString());
  console.log('='.repeat(60));

  // Log all headers for debugging
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  console.log('[PERSONALIZE] Headers:', JSON.stringify(headers, null, 2));

  try {
    const body = await request.json();
    console.log('[PERSONALIZE] Full request body:', JSON.stringify(body, null, 2));

    const { caller_id, call_sid, agent_id, called_number } = body;
    console.log('[PERSONALIZE] Parsed fields:');
    console.log('  - caller_id:', caller_id);
    console.log('  - call_sid:', call_sid);
    console.log('  - agent_id:', agent_id);
    console.log('  - called_number:', called_number);

    // Load pending contexts
    console.log('[PERSONALIZE] Loading contexts from:', CONTEXT_FILE);
    let contexts: Record<string, CallContext> = {};
    try {
      const existing = await readFile(CONTEXT_FILE, 'utf-8');
      contexts = JSON.parse(existing);
      console.log('[PERSONALIZE] Loaded contexts:', Object.keys(contexts).length, 'total');
      console.log('[PERSONALIZE] Context keys:', Object.keys(contexts));
    } catch (err) {
      console.log('[PERSONALIZE] No contexts file or error:', err);
    }

    // Find most recent pending context within TTL
    const now = Date.now();
    console.log('[PERSONALIZE] Current time:', now, '(' + new Date(now).toISOString() + ')');
    let matchedContext: CallContext | null = null;
    let matchedId: string | null = null;

    // Log each context's status and expiry
    Object.entries(contexts).forEach(([id, ctx]) => {
      const expiresIn = ctx.expiresAt - now;
      console.log(`[PERSONALIZE] Context ${id}:`);
      console.log(`    status: ${ctx.status}`);
      console.log(`    expiresAt: ${ctx.expiresAt} (${expiresIn > 0 ? 'expires in ' + Math.round(expiresIn/1000) + 's' : 'EXPIRED'})`);
      console.log(`    agencyName: ${ctx.agencyData?.name || 'N/A'}`);
    });

    // First, check for recently activated contexts - handles ElevenLabs calling webhook multiple times
    // Extended to 5 minutes to handle multiple dial attempts before call connects
    const RECENT_ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes - match context TTL
    const recentActiveContexts = Object.entries(contexts)
      .filter(([, ctx]) => {
        if (ctx.status !== 'active') return false;
        if (!ctx.activatedAt) return false;
        return (now - ctx.activatedAt) < RECENT_ACTIVE_WINDOW_MS;
      })
      .sort((a, b) => (b[1].activatedAt || 0) - (a[1].activatedAt || 0));

    if (recentActiveContexts.length > 0) {
      [matchedId, matchedContext] = recentActiveContexts[0];
      console.log('[PERSONALIZE] ✅ Found recently active context:', matchedId);
      console.log('[PERSONALIZE] Matched agency:', matchedContext.agencyData?.name);
      console.log('[PERSONALIZE] Activated', Math.round((now - (matchedContext.activatedAt || 0)) / 1000), 'seconds ago');
    } else {
      // Look for pending contexts
      const pendingContexts = Object.entries(contexts)
        .filter(([, ctx]) => ctx.status === 'pending' && ctx.expiresAt > now)
        .sort((a, b) => {
          // Handle both number timestamps and ISO string dates
          // Sort descending (most recent first)
          const timeA = typeof a[1].registeredAt === 'number' ? a[1].registeredAt : new Date(a[1].registeredAt).getTime();
          const timeB = typeof b[1].registeredAt === 'number' ? b[1].registeredAt : new Date(b[1].registeredAt).getTime();
          return timeB - timeA;
        });

      console.log('[PERSONALIZE] Pending (valid) contexts found:', pendingContexts.length);

      if (pendingContexts.length > 0) {
        [matchedId, matchedContext] = pendingContexts[0];
        console.log('[PERSONALIZE] ✅ Matched pending context:', matchedId);
        console.log('[PERSONALIZE] Matched agency:', matchedContext.agencyData?.name);

        // Mark as active
        contexts[matchedId].status = 'active';
        contexts[matchedId].callerId = caller_id;
        contexts[matchedId].callSid = call_sid;
        contexts[matchedId].activatedAt = now;

        await writeFile(CONTEXT_FILE, JSON.stringify(contexts, null, 2));
        console.log('[PERSONALIZE] Context marked as active');
      } else {
        console.log('[PERSONALIZE] ⚠️ No pending or recent active context found');

        // Fallback: Try any non-expired context with valid agency data
        const anyValidContexts = Object.entries(contexts)
          .filter(([, ctx]) => ctx.expiresAt > now && ctx.agencyData?.name)
          .sort((a, b) => b[1].expiresAt - a[1].expiresAt);

        if (anyValidContexts.length > 0) {
          [matchedId, matchedContext] = anyValidContexts[0];
          console.log('[PERSONALIZE] ✅ Fallback to any valid context:', matchedId);
          console.log('[PERSONALIZE] Matched agency:', matchedContext.agencyData?.name);
        } else {
          console.log('[PERSONALIZE] ❌ No valid contexts at all - using default');
        }
      }
    }

    // Build response
    const agencyData: AgencyData = matchedContext?.agencyData || { ...DEFAULT_AGENCY };
    const agencyLocation = agencyData.location ||
      agencyData.address?.split(',')[0] ||
      'Sydney';

    const response: {
      type: string;
      dynamic_variables: {
        agency_name: string;
        agency_location: string;
        agency_phone: string;
        demo_page_url: string;
        context_id: string;
      };
      conversation_config_override?: {
        agent: {
          first_message: string;
        };
      };
    } = {
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        agency_name: agencyData.name,
        agency_location: agencyLocation,
        agency_phone: agencyData.phone,
        demo_page_url: `/demo/${agencyData.id || 'default'}`,
        context_id: matchedId || 'default'
      }
    };

    // Custom first message if not default
    if (agencyData.name !== DEFAULT_AGENCY.name) {
      response.conversation_config_override = {
        agent: {
          first_message: `Hi! Thanks for calling ${agencyData.name}. I'm their AI assistant - how can I help you today?`
        }
      };
    }

    console.log('[PERSONALIZE] Final response:', JSON.stringify(response, null, 2));
    console.log('[PERSONALIZE] ✅ Webhook completed successfully');
    console.log('='.repeat(60) + '\n');
    return NextResponse.json(response);

  } catch (error) {
    console.error('[PERSONALIZE] ❌ Error:', error);
    console.log('='.repeat(60) + '\n');

    // Return default on error (don't fail the call)
    const errorResponse = {
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        agency_name: DEFAULT_AGENCY.name,
        agency_location: DEFAULT_AGENCY.location,
        agency_phone: DEFAULT_AGENCY.phone,
        demo_page_url: '/demo/default',
        context_id: 'default'
      }
    };
    console.log('[PERSONALIZE] Returning default response:', JSON.stringify(errorResponse, null, 2));
    return NextResponse.json(errorResponse);
  }
}
