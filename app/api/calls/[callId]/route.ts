import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import type { Activity } from '@/lib/types';
import { processPostcallJobsOnce } from '@/lib/postcall-queue';
import { normalizeActivityMessage } from '@/lib/server/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CALLS_DIR = path.join(process.cwd(), 'data', 'calls');
const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ callId: string }> }) {
  try {
    void processPostcallJobsOnce();

    const { callId } = await params;
    if (!callId) {
      return NextResponse.json({ error: 'callId required' }, { status: 400 });
    }

    const callPath = path.join(CALLS_DIR, `${callId}.json`);
    const raw = await readFile(callPath, 'utf-8').catch(() => null);
    if (!raw) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    const call = safeJsonParse<Record<string, unknown>>(raw);
    if (!call) {
      return NextResponse.json({ error: 'Invalid call file' }, { status: 500 });
    }

    const activityPath = path.join(PROGRESS_DIR, `activity-postcall-${callId}.json`);
    const activityRaw = await readFile(activityPath, 'utf-8').catch(() => null);
    const postcallActivity = activityRaw ? safeJsonParse<Activity>(activityRaw) : null;
    const normalizedPostcallActivity =
      postcallActivity && Array.isArray(postcallActivity.messages)
        ? {
            ...postcallActivity,
            messages: postcallActivity.messages.map((m) =>
              normalizeActivityMessage(m, `postcall-${callId}`, 'Postcall agent')
            ),
          }
        : postcallActivity;

    return NextResponse.json({
      call,
      postcallActivity: normalizedPostcallActivity,
    });
  } catch (error) {
    console.error('[Call Detail] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
