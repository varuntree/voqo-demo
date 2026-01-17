import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { processPostcallJobsOnce } from '@/lib/postcall-queue';
import { isSafeAgencyId } from '@/lib/ids';
import { safeJsonParse } from '@/lib/fs-json';

const CALLS_DIR = path.join(process.cwd(), 'data/calls');

interface CallData {
  callId: string;
  timestamp: string;
  agencyId: string;
  pageStatus: string;
  pageUrl: string | null;
  callerName: string | null;
  generatedAt: string | null;
}

export async function GET(request: NextRequest) {
  try {
    void processPostcallJobsOnce();
    const agencyId = request.nextUrl.searchParams.get('agency');

    if (!agencyId) {
      return NextResponse.json({ hasRecentCall: false });
    }
    if (!isSafeAgencyId(agencyId)) {
      return NextResponse.json({ error: 'Invalid agency id', hasRecentCall: false }, { status: 400 });
    }

    // Find recent calls for this agency
    let files: string[];
    try {
      files = await readdir(CALLS_DIR);
    } catch {
      return NextResponse.json({ hasRecentCall: false });
    }

    const callFiles = files.filter(f => f.endsWith('.json'));

    // Check recent calls (last 10 minutes)
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    let recentCall: CallData | null = null;

    // Sort by filename (contains timestamp) descending
    for (const file of callFiles.sort().reverse()) {
      const raw = await readFile(path.join(CALLS_DIR, file), 'utf-8').catch(() => null);
      if (!raw) continue;
      const callData = safeJsonParse<CallData>(raw);
      if (!callData) continue;

      const callTime = new Date(callData.timestamp).getTime();

      if (callData.agencyId === agencyId && callTime > tenMinutesAgo) {
        recentCall = callData;
        break;
      }
    }

    if (!recentCall) {
      return NextResponse.json({ hasRecentCall: false });
    }

    return NextResponse.json({
      hasRecentCall: true,
      callId: recentCall.callId,
      status: recentCall.pageStatus,
      pageUrl: recentCall.pageUrl,
      callerName: recentCall.callerName,
      generatedAt: recentCall.generatedAt
    });

  } catch (error) {
    console.error('[Call Status] Error:', error);
    return NextResponse.json({ hasRecentCall: false });
  }
}
