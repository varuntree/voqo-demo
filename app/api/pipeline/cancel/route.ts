import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { PipelineState } from '@/lib/types';
import { getPipelineRuns } from '@/lib/pipeline-registry';

export const runtime = 'nodejs';

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const sessionId = body?.sessionId;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
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
    try {
      const content = await fs.readFile(pipelinePath, 'utf-8');
      const pipeline = JSON.parse(content) as PipelineState;

      const now = new Date().toISOString();
      const next: PipelineState = {
        ...pipeline,
        status: 'cancelled',
        completedAt: now,
        error: 'Cancelled',
        todos: (pipeline.todos || []).map((todo) => ({
          ...todo,
          status: todo.status === 'pending' ? 'pending' : 'complete',
        })),
      };

      await fs.writeFile(pipelinePath, JSON.stringify(next, null, 2));
    } catch {
      // If progress file missing, ignore.
    }

    return NextResponse.json({ success: true, sessionId });
  } catch (error) {
    console.error('[Pipeline Cancel] Error:', error);
    return NextResponse.json({ error: 'Failed to cancel pipeline' }, { status: 500 });
  }
}

