import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';

const CONTEXT_FILE = path.join(process.cwd(), 'data/context/pending-calls.json');
const CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(60));
  console.log('[REGISTER-CALL] Incoming request at', new Date().toISOString());
  console.log('='.repeat(60));

  try {
    const body = await request.json();
    console.log('[REGISTER-CALL] Request body:', JSON.stringify(body, null, 2));

    // Handle both formats: {agencyData, timestamp} or {agencyId, agencyName, context}
    const agencyData = body.agencyData || {
      id: body.agencyId,
      name: body.agencyName,
      ...body.context?.agency
    };
    const timestamp = body.timestamp || body.context?.timestamp || new Date().toISOString();

    console.log('[REGISTER-CALL] Parsed agencyData:', JSON.stringify(agencyData, null, 2));

    // Generate unique context ID
    const contextId = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Ensure directory exists
    await mkdir(path.dirname(CONTEXT_FILE), { recursive: true });

    // Load existing contexts
    let contexts: Record<string, unknown> = {};
    try {
      const existing = await readFile(CONTEXT_FILE, 'utf-8');
      contexts = JSON.parse(existing);
    } catch {
      // File doesn't exist yet
    }

    // Clean expired contexts
    const now = Date.now();
    for (const key of Object.keys(contexts)) {
      const ctx = contexts[key] as { expiresAt: number };
      if (ctx.expiresAt < now) {
        delete contexts[key];
      }
    }

    // Store new context
    const expiresAt = now + CONTEXT_TTL_MS;
    contexts[contextId] = {
      agencyId: agencyData.id,
      agencyName: agencyData.name,
      agencyData,
      registeredAt: timestamp,
      expiresAt,
      status: 'pending'
    };

    // Save
    await writeFile(CONTEXT_FILE, JSON.stringify(contexts, null, 2));
    console.log('[REGISTER-CALL] Context saved to file');
    console.log('[REGISTER-CALL] Total pending contexts:', Object.keys(contexts).length);

    // Return phone number from environment
    const phoneNumber = process.env.NEXT_PUBLIC_DEMO_PHONE || process.env.TWILIO_PHONE_NUMBER;

    const response = {
      success: true,
      contextId,
      expiresAt,
      phoneNumber
    };

    console.log('[REGISTER-CALL] Response:', JSON.stringify(response, null, 2));
    console.log('[REGISTER-CALL] ✅ Context registered successfully');
    console.log('='.repeat(60) + '\n');

    return NextResponse.json(response);

  } catch (error) {
    console.error('[REGISTER-CALL] ❌ Error:', error);
    console.log('='.repeat(60) + '\n');
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
