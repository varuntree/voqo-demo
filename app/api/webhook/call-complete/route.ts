import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { invokeClaudeCodeAsync } from '@/lib/claude';

const CONTEXT_FILE = path.join(process.cwd(), 'data/context/pending-calls.json');
const CALLS_DIR = path.join(process.cwd(), 'data/calls');

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
    status: 'completed' | 'failed' | 'dropped';
    transcript: TranscriptEntry[];
    metadata: {
      call_duration_secs: number;
      cost: number;
      from_number: string;
      to_number: string;
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

interface CallContext {
  agencyData: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
  callerId?: string;
  status: string;
  callId?: string;
  completedAt?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CallCompleteWebhook;

    console.log('[Call Complete] Webhook received:', body.type);

    if (body.type !== 'post_call_transcription') {
      return NextResponse.json({ success: true, message: 'Event type ignored' });
    }

    const { data } = body;
    const callerId = data.metadata.from_number;

    // Generate call ID
    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Find matching context
    let contexts: Record<string, CallContext> = {};
    let matchedContext: CallContext | null = null;
    let matchedId: string | null = null;

    try {
      const existing = await readFile(CONTEXT_FILE, 'utf-8');
      contexts = JSON.parse(existing);

      for (const [id, ctx] of Object.entries(contexts)) {
        if (ctx.callerId === callerId && ctx.status === 'active') {
          matchedContext = ctx;
          matchedId = id;
          break;
        }
      }
    } catch {
      // No contexts file
    }

    // Build transcript string
    const transcriptText = data.transcript
      .map(t => `${t.role === 'agent' ? 'Agent' : 'Caller'}: ${t.message}`)
      .join('\n\n');

    // Prepare call data
    // NOTE: We do NOT use data.analysis.data_collection_results
    // Claude Code skill extracts ALL data directly from the raw transcript
    const callData = {
      callId,
      conversationId: data.conversation_id,
      timestamp: new Date().toISOString(),
      duration: data.metadata.call_duration_secs,
      callerPhone: callerId,
      status: data.status,

      agencyId: matchedContext?.agencyData?.id || 'unknown',
      agencyName: matchedContext?.agencyData?.name ||
                  data.conversation_initiation_client_data?.dynamic_variables?.agency_name ||
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
      await writeFile(CONTEXT_FILE, JSON.stringify(contexts, null, 2));
    }

    // Trigger page generation async
    triggerPageGeneration(callId, callData);

    return NextResponse.json({
      success: true,
      callId,
      pageGenerationStarted: true
    });

  } catch (error) {
    console.error('[Call Complete] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

function triggerPageGeneration(callId: string, callData: {
  transcript: string;
  agencyName: string;
  agencyId: string;
  agencyData: unknown;
}) {
  console.log(`[Page Gen] Triggering for call: ${callId}`);

  // NOTE: We pass only the transcript - Claude Code extracts ALL data
  const prompt = `
Use the postcall-page-builder skill to generate a personalized page for this completed call.

Call ID: ${callId}

Full Transcript:
${callData.transcript}

Agency Context:
- Agency: ${callData.agencyName}
- Agency ID: ${callData.agencyId}
${callData.agencyData ? JSON.stringify(callData.agencyData, null, 2) : ''}

Instructions:
1. EXTRACT from transcript: caller name, intent (buy/sell/rent), location, budget, property type, bedrooms, special requirements
2. Search for matching property listings based on extracted requirements
3. Generate a personalized HTML page using the postcall-page-builder skill
4. Save the HTML to: public/call/${callId}.html
5. Update data/calls/${callId}.json with:
   - extractedData (all extracted fields)
   - callerName, intent, location, budget
   - pageStatus: "completed"
   - pageUrl: "/call/${callId}"
`;

  invokeClaudeCodeAsync({ prompt, workingDir: process.cwd() });
}
