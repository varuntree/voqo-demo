import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';
import { getDemoPhone } from '@/lib/phone';

const CONTEXT_FILE = path.join(process.cwd(), 'data/context/pending-calls.json');
const CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  console.log('[REGISTER-CALL] Incoming request at', new Date().toISOString());

  try {
    const rawBody = await request.text();
    const body = (() => {
      try {
        return JSON.parse(rawBody) as any;
      } catch {
        return null;
      }
    })();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    // Handle both formats: {agencyData, timestamp} or {agencyId, agencyName, context}
    const agencyData = body.agencyData || {
      id: body.agencyId,
      name: body.agencyName,
      ...body.context?.agency
    };
    const timestamp = body.timestamp || body.context?.timestamp || Date.now();
    const registeredAt =
      typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime() || Date.now();

    if (!agencyData?.id || !agencyData?.name) {
      return NextResponse.json(
        { success: false, error: 'agencyData.id and agencyData.name are required' },
        { status: 400 }
      );
    }

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
      registeredAt,
      expiresAt,
      status: 'pending'
    };

    // Save
    await writeFile(CONTEXT_FILE, JSON.stringify(contexts, null, 2));
    const demoPhone = getDemoPhone();

    const response = {
      success: true,
      contextId,
      expiresAt,
      phoneNumber: demoPhone.tel,
      displayPhoneNumber: demoPhone.display
    };

    console.log('[REGISTER-CALL] Context registered:', contextId, 'agency:', agencyData.name);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[REGISTER-CALL] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
