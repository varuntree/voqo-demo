import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { Activity, ActivityMessage, AgencyProgress, PipelineState } from '@/lib/types';

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function readAgencies(sessionId: string, agencyIds: string[]): Promise<AgencyProgress[]> {
  const agencies: AgencyProgress[] = [];
  for (const agencyId of agencyIds) {
    const agencyPath = path.join(PROGRESS_DIR, `agency-${agencyId}.json`);
    const parsed = await readJson<AgencyProgress>(agencyPath);
    if (parsed && parsed.sessionId === sessionId) agencies.push(parsed);
  }
  return agencies;
}

async function readSubagentActivity(agencyIds: string[]): Promise<Record<string, ActivityMessage[]>> {
  const out: Record<string, ActivityMessage[]> = {};
  for (const agencyId of agencyIds) {
    const activityPath = path.join(PROGRESS_DIR, `agency-activity-${agencyId}.json`);
    const parsed = await readJson<{ messages?: ActivityMessage[] } | ActivityMessage[]>(activityPath);
    if (!parsed) continue;
    if (Array.isArray(parsed)) out[agencyId] = parsed;
    else if (Array.isArray(parsed.messages)) out[agencyId] = parsed.messages;
  }
  return out;
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ts = Date.parse(value);
  return Number.isFinite(ts);
}

function normalizeMessages(
  messages: ActivityMessage[],
  stablePrefix: string,
  fallbackSource: string
): ActivityMessage[] {
  return messages.map((message, index) => {
    const stableId = `${stablePrefix}-${index}`;
    const hasSuspiciousMidnightTimestamp =
      typeof message.timestamp === 'string' && message.timestamp.endsWith('T00:00:00.000Z');
    return {
      ...message,
      id:
        typeof message.id === 'string' && message.id.length > 0
          ? `${stableId}:${message.id}`
          : stableId,
      source: message.source ?? fallbackSource,
      timestamp:
        isValidIsoTimestamp(message.timestamp) && !hasSuspiciousMidnightTimestamp
          ? message.timestamp
          : new Date().toISOString(),
    };
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  const pipelinePath = path.join(PROGRESS_DIR, `pipeline-${sessionId}.json`);
  const pipeline = await readJson<PipelineState>(pipelinePath);
  if (!pipeline) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const agencies = await readAgencies(sessionId, pipeline.agencyIds || []);
  const mainActivityRaw = await readJson<Activity>(path.join(PROGRESS_DIR, `activity-${sessionId}.json`));
  const subagentActivityRaw = await readSubagentActivity(pipeline.agencyIds || []);

  const mainActivity: Activity | null = mainActivityRaw
    ? {
        ...mainActivityRaw,
        messages: normalizeMessages(mainActivityRaw.messages || [], 'main', 'Main agent'),
      }
    : null;

  const subagentActivity: Record<string, ActivityMessage[]> = {};
  for (const [agencyId, messages] of Object.entries(subagentActivityRaw)) {
    subagentActivity[agencyId] = normalizeMessages(messages || [], `sub-${agencyId}`, 'Subagent');
  }

  return NextResponse.json({
    success: true,
    sessionId,
    pipeline,
    agencies,
    mainActivity,
    subagentActivity,
  });
}
