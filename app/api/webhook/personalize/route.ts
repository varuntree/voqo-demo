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
  registeredAt: number;
  expiresAt: number;
  status: string;
  callerId?: string;
  callSid?: string;
  activatedAt?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caller_id, call_sid } = body;

    console.log(`[Personalize] Request for caller: ${caller_id}, call: ${call_sid}`);

    // Load pending contexts
    let contexts: Record<string, CallContext> = {};
    try {
      const existing = await readFile(CONTEXT_FILE, 'utf-8');
      contexts = JSON.parse(existing);
    } catch {
      // No contexts file
    }

    // Find most recent pending context within TTL
    const now = Date.now();
    let matchedContext: CallContext | null = null;
    let matchedId: string | null = null;

    const pendingContexts = Object.entries(contexts)
      .filter(([, ctx]) => ctx.status === 'pending' && ctx.expiresAt > now)
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
    const agencyData: AgencyData = matchedContext?.agencyData || { ...DEFAULT_AGENCY };
    const agencyLocation = agencyData.location ||
      agencyData.address?.split(',')[0] ||
      'Sydney';

    const response: {
      dynamic_variables: {
        agency_name: string;
        agency_location: string;
        agency_phone: string;
        demo_page_url: string;
      };
      conversation_config_override?: {
        agent: {
          first_message: string;
        };
      };
    } = {
      dynamic_variables: {
        agency_name: agencyData.name,
        agency_location: agencyLocation,
        agency_phone: agencyData.phone,
        demo_page_url: `/demo/${agencyData.id || 'default'}`
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

    console.log(`[Personalize] Returning context for: ${agencyData.name}`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('[Personalize] Error:', error);

    // Return default on error (don't fail the call)
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
