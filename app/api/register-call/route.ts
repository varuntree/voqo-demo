import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';

const CONTEXT_FILE = path.join(process.cwd(), 'data/context/pending-calls.json');
const CONTEXT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agencyData, timestamp } = body;

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
      agencyData,
      registeredAt: timestamp,
      expiresAt,
      status: 'pending'
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
