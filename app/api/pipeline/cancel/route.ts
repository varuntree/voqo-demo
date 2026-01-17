import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { Activity, ActivityMessage, AgencyProgress, PipelineState } from '@/lib/types';
import { getPipelineRuns } from '@/lib/pipeline-registry';
import { addToHistory, buildSessionDetailFromPipeline, buildSessionFromPipeline, writeSessionDetail } from '@/lib/history';
import { buildActivityId, isSafeSessionId } from '@/lib/ids';

export const runtime = 'nodejs';

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');

async function readSubagentActivity(agencyIds: string[]): Promise<Record<string, ActivityMessage[]>> {
  const out: Record<string, ActivityMessage[]> = {};
  for (const agencyId of agencyIds) {
    try {
      const activityPath = path.join(PROGRESS_DIR, `agency-activity-${agencyId}.json`);
      const content = await fs.readFile(activityPath, 'utf-8');
      const parsed = JSON.parse(content) as { messages?: ActivityMessage[] } | ActivityMessage[];
      if (Array.isArray(parsed)) {
        out[agencyId] = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.messages)) {
        out[agencyId] = parsed.messages;
      }
    } catch {
      // ignore
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const sessionId = body?.sessionId;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }
    if (!isSafeSessionId(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const runs = getPipelineRuns();
    const run = runs.get(sessionId);

    if (run) {
      run.status = 'cancelled';
      run.cancelledAt = new Date().toISOString();
      try {
        await run.query.interrupt();
      } catch (error) {
        // Even if interrupt fails, still proceed with marking cancelled in files.
        run.error = error instanceof Error ? error.message : String(error);
      }
    }

    // Persist cancellation state for clients that rely on the progress files.
    const pipelinePath = path.join(PROGRESS_DIR, `pipeline-${sessionId}.json`);
    let nextPipeline: PipelineState | null = null;
    try {
      const content = await fs.readFile(pipelinePath, 'utf-8');
      const pipeline = JSON.parse(content) as PipelineState;

      const now = new Date().toISOString();
      nextPipeline = {
        ...pipeline,
        status: 'cancelled',
        completedAt: now,
        error: 'Cancelled',
        todos: (pipeline.todos || []).map((todo) => ({
          ...todo,
          status: todo.status === 'pending' ? 'pending' : 'complete',
        })),
      };

      await fs.writeFile(pipelinePath, JSON.stringify(nextPipeline, null, 2));
    } catch {
      // If progress file missing, ignore.
    }

    // Update main activity file so the UI and history replay show the cancel.
    let activity: Activity | null = null;
    try {
      const activityPath = path.join(PROGRESS_DIR, `activity-${sessionId}.json`);
      const content = await fs.readFile(activityPath, 'utf-8');
      activity = JSON.parse(content) as Activity;
      activity.status = 'complete';
      const cancelMessage: ActivityMessage = {
        id: buildActivityId(),
        type: 'warning',
        text: 'Pipeline cancelled by user',
        source: 'System',
        timestamp: new Date().toISOString(),
      };
      activity.messages = [
        ...(activity.messages || []),
        cancelMessage,
      ].slice(-250);
      await fs.writeFile(activityPath, JSON.stringify(activity, null, 2));
    } catch {
      // ignore
    }

    // Save to durable history even if no SSE client is connected.
    try {
      if (nextPipeline) {
        const agencies: AgencyProgress[] = [];
        for (const agencyId of nextPipeline.agencyIds || []) {
          try {
            const agencyPath = path.join(PROGRESS_DIR, `agency-${agencyId}.json`);
            const content = await fs.readFile(agencyPath, 'utf-8');
            const parsed = JSON.parse(content) as AgencyProgress;
            if (parsed.sessionId === sessionId) agencies.push(parsed);
          } catch {
            // ignore
          }
        }

        const subagentActivity = await readSubagentActivity(nextPipeline.agencyIds || []);
        const detail = await buildSessionDetailFromPipeline(nextPipeline, activity, agencies, subagentActivity);
        await writeSessionDetail(sessionId, detail);

        const indexEntry = await buildSessionFromPipeline(nextPipeline);
        await addToHistory(indexEntry);
      }
    } catch (err) {
      console.error('[Pipeline Cancel] Failed to save to history:', err);
    }

    return NextResponse.json({ success: true, sessionId });
  } catch (error) {
    console.error('[Pipeline Cancel] Error:', error);
    return NextResponse.json({ error: 'Failed to cancel pipeline' }, { status: 500 });
  }
}
