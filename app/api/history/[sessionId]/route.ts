import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { Activity, AgencyProgress, HistorySessionDetail, PipelineState, ActivityMessage } from '@/lib/types';
import {
  buildSessionDetailFromPipeline,
  readHistory,
  writeHistory,
  readSessionDetail,
  writeSessionDetail,
} from '@/lib/history';

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');

export const runtime = 'nodejs';

async function readPipeline(sessionId: string): Promise<PipelineState | null> {
  try {
    const pipelinePath = path.join(PROGRESS_DIR, `pipeline-${sessionId}.json`);
    const content = await fs.readFile(pipelinePath, 'utf-8');
    return JSON.parse(content) as PipelineState;
  } catch {
    return null;
  }
}

async function readActivity(sessionId: string): Promise<Activity | null> {
  try {
    const activityPath = path.join(PROGRESS_DIR, `activity-${sessionId}.json`);
    const content = await fs.readFile(activityPath, 'utf-8');
    return JSON.parse(content) as Activity;
  } catch {
    return null;
  }
}

async function readAgencies(sessionId: string, agencyIds: string[]): Promise<AgencyProgress[]> {
  const agencies: AgencyProgress[] = [];
  for (const agencyId of agencyIds) {
    try {
      const agencyPath = path.join(PROGRESS_DIR, `agency-${agencyId}.json`);
      const content = await fs.readFile(agencyPath, 'utf-8');
      const parsed = JSON.parse(content) as AgencyProgress;
      if (parsed.sessionId === sessionId) agencies.push(parsed);
    } catch {
      // ignore
    }
  }
  return agencies;
}

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const detail = await readSessionDetail(sessionId);
    if (detail) {
      return NextResponse.json(detail);
    }

    const pipeline = await readPipeline(sessionId);
    if (!pipeline) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const agencies = await readAgencies(sessionId, pipeline.agencyIds || []);
    const activity = await readActivity(sessionId);
    const subagentActivity = await readSubagentActivity(pipeline.agencyIds || []);

    const computed = await buildSessionDetailFromPipeline(pipeline, activity, agencies, subagentActivity);

    // Only persist durable snapshots for completed/cancelled/error sessions.
    if (pipeline.status === 'complete' || pipeline.status === 'error' || pipeline.status === 'cancelled') {
      await writeSessionDetail(sessionId, computed);
    }

    return NextResponse.json(computed);
  } catch (error) {
    console.error('[History Session GET] Error:', error);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const history = await readHistory();
    const sessionIndex = history.sessions.findIndex((s) => s.sessionId === sessionId);

    if (sessionIndex === -1) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    history.sessions[sessionIndex].name = name.trim();
    await writeHistory(history);

    // Keep detail snapshot (if present) in sync with rename.
    try {
      const detail = await readSessionDetail(sessionId);
      if (detail) {
        const next: HistorySessionDetail = {
          ...detail,
          session: { ...detail.session, name: name.trim() },
        };
        await writeSessionDetail(sessionId, next);
      }
    } catch {
      // ignore detail update errors
    }

    return NextResponse.json({
      success: true,
      session: history.sessions[sessionIndex],
    });
  } catch (error) {
    console.error('[History Rename API] Error:', error);
    return NextResponse.json({ error: 'Failed to rename session' }, { status: 500 });
  }
}

