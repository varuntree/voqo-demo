import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { HistoryFile } from '@/lib/types';

const HISTORY_FILE = path.join(process.cwd(), 'data', 'history', 'sessions.json');

async function readHistory(): Promise<HistoryFile> {
  try {
    const content = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(content) as HistoryFile;
  } catch {
    return { sessions: [] };
  }
}

async function writeHistory(history: HistoryFile): Promise<void> {
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
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

    return NextResponse.json({
      success: true,
      session: history.sessions[sessionIndex],
    });
  } catch (error) {
    console.error('[History Rename API] Error:', error);
    return NextResponse.json({ error: 'Failed to rename session' }, { status: 500 });
  }
}
