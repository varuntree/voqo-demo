import { promises as fs } from 'fs';
import path from 'path';
import type {
  Activity,
  ActivityMessage,
  AgencyProgress,
  HistoryFile,
  HistorySessionDetail,
  PipelineState,
  SearchSession,
} from './types';

const HISTORY_FILE = path.join(process.cwd(), 'data', 'history', 'sessions.json');
const HISTORY_SESSIONS_DIR = path.join(process.cwd(), 'data', 'history', 'sessions');
const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');
const MAX_SESSIONS = 50;

function normalizeDemoUrl(demoUrl: string | null): string | null {
  if (!demoUrl) return null;
  if (demoUrl.startsWith('/demo/') && demoUrl.endsWith('.html')) {
    return demoUrl.replace(/\.html$/, '');
  }
  return demoUrl;
}

function normalizeHistory(history: HistoryFile): HistoryFile {
  return {
    sessions: history.sessions.map((session) => ({
      ...session,
      agencies: session.agencies.map((agency) => ({
        ...agency,
        demoUrl: normalizeDemoUrl(agency.demoUrl),
      })),
    })),
  };
}

export async function readHistory(): Promise<HistoryFile> {
  try {
    await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
    const content = await fs.readFile(HISTORY_FILE, 'utf-8');
    return normalizeHistory(JSON.parse(content) as HistoryFile);
  } catch {
    return { sessions: [] };
  }
}

export async function writeHistory(history: HistoryFile): Promise<void> {
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

export async function addToHistory(session: SearchSession): Promise<void> {
  const history = await readHistory();

  // Check if session already exists (update it)
  const existingIndex = history.sessions.findIndex(s => s.sessionId === session.sessionId);
  if (existingIndex >= 0) {
    const existingName = history.sessions[existingIndex].name;
    history.sessions[existingIndex] = {
      ...session,
      name: existingName || session.name,
    };
  } else {
    // Add to front
    history.sessions.unshift(session);
  }

  // Keep only last MAX_SESSIONS
  if (history.sessions.length > MAX_SESSIONS) {
    history.sessions = history.sessions.slice(0, MAX_SESSIONS);
  }

  await writeHistory(history);
}

function sessionDetailPath(sessionId: string): string {
  return path.join(HISTORY_SESSIONS_DIR, `${sessionId}.json`);
}

export async function readSessionDetail(sessionId: string): Promise<HistorySessionDetail | null> {
  try {
    const content = await fs.readFile(sessionDetailPath(sessionId), 'utf-8');
    return JSON.parse(content) as HistorySessionDetail;
  } catch {
    return null;
  }
}

export async function writeSessionDetail(sessionId: string, detail: HistorySessionDetail): Promise<void> {
  await fs.mkdir(HISTORY_SESSIONS_DIR, { recursive: true });
  await fs.writeFile(sessionDetailPath(sessionId), JSON.stringify(detail, null, 2));
}

export async function buildSessionDetailFromPipeline(
  pipelineState: PipelineState,
  activity: Activity | null,
  agencies: AgencyProgress[],
  subagentActivity?: Record<string, ActivityMessage[]>
): Promise<HistorySessionDetail> {
  const session = await buildSessionFromPipeline(pipelineState);

  return {
    version: 1,
    session,
    pipeline: pipelineState,
    activity,
    agencies,
    subagentActivity,
    savedAt: new Date().toISOString(),
  };
}

export function formatSessionName(suburb: string, date: Date): string {
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const time = date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase();

  return `${suburb} - ${month} ${day}, ${time}`;
}

export async function buildSessionFromPipeline(
  pipelineState: PipelineState
): Promise<SearchSession> {
  const agencies: SearchSession['agencies'] = [];
  let successCount = 0;

  // Read all agency progress files for this session
  for (const agencyId of pipelineState.agencyIds) {
    try {
      const agencyPath = path.join(PROGRESS_DIR, `agency-${agencyId}.json`);
      const content = await fs.readFile(agencyPath, 'utf-8');
      const agencyData = JSON.parse(content) as AgencyProgress;

      if (agencyData.sessionId === pipelineState.sessionId) {
        agencies.push({
          id: agencyData.agencyId,
          name: agencyData.name || agencyId,
          logoUrl: agencyData.logoUrl,
          demoUrl: normalizeDemoUrl(agencyData.demoUrl),
        });

        if (agencyData.status === 'complete') {
          successCount++;
        }
      }
    } catch {
      // Agency file might not exist or be readable
    }
  }

  const createdAt = pipelineState.startedAt;

  const isRunning = pipelineState.status === 'searching' || pipelineState.status === 'processing';
  const completedAt = isRunning ? null : (pipelineState.completedAt || new Date().toISOString());

  // Determine status
  let status: SearchSession['status'];
  if (isRunning) {
    status = 'running';
  } else if (pipelineState.status === 'error' || pipelineState.status === 'cancelled') {
    status = agencies.length > 0 ? 'partial' : 'failed';
  } else if (successCount < agencies.length) {
    status = 'partial';
  } else {
    status = 'complete';
  }

  return {
    sessionId: pipelineState.sessionId,
    name: formatSessionName(pipelineState.suburb, new Date(createdAt)),
    suburb: pipelineState.suburb,
    requestedCount: pipelineState.requestedCount,
    actualCount: agencies.length,
    successCount,
    createdAt,
    completedAt,
    status,
    agencies,
  };
}
