import type { Query } from '@anthropic-ai/claude-agent-sdk';

export type PipelineRunStatus = 'running' | 'cancelled' | 'completed' | 'error';

export interface PipelineRun {
  sessionId: string;
  query: Query;
  status: PipelineRunStatus;
  startedAt: string;
  cancelledAt?: string;
  finishedAt?: string;
  error?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __voqoPipelineRuns: Map<string, PipelineRun> | undefined;
}

export function getPipelineRuns(): Map<string, PipelineRun> {
  if (!globalThis.__voqoPipelineRuns) {
    globalThis.__voqoPipelineRuns = new Map();
  }
  return globalThis.__voqoPipelineRuns;
}

