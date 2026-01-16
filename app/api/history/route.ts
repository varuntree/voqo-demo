import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const history = await readHistory();
    return NextResponse.json(history);
  } catch (error) {
    console.error('[History API] Error:', error);
    return NextResponse.json({ sessions: [] });
  }
}
