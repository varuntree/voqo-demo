import { NextResponse } from 'next/server';
import { readHistory } from '@/lib/history';

export async function GET() {
  try {
    const history = await readHistory();
    return NextResponse.json(history);
  } catch (error) {
    console.error('[History API] Error:', error);
    return NextResponse.json({ sessions: [] });
  }
}
