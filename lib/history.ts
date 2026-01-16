import { promises as fs } from 'fs';
import path from 'path';
import { HistoryFile, SearchSession, AgencyProgress, PipelineState } from './types';

const HISTORY_FILE = path.join(process.cwd(), 'data', 'history', 'sessions.json');
const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');
const MAX_SESSIONS = 50;

export async function readHistory(): Promise<HistoryFile> {
  try {
    await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
    const content = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(content) as HistoryFile;
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
    history.sessions[existingIndex] = session;
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
          demoUrl: agencyData.demoUrl,
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
  const completedAt = pipelineState.completedAt || new Date().toISOString();

  // Determine status
  let status: SearchSession['status'] = 'complete';
  if (pipelineState.status === 'error') {
    status = agencies.length > 0 ? 'partial' : 'failed';
  } else if (successCount < agencies.length) {
    status = 'partial';
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
