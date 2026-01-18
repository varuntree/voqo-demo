import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  Options,
  Query,
  HookCallbackMatcher,
  HookEvent,
  HookInput
} from '@anthropic-ai/claude-agent-sdk';
import { promises as fs } from 'fs';
import path from 'path';
import type { Activity, ActivityMessage } from '@/lib/types';
import { getToolVerb, SOURCE_LABELS } from '@/lib/playful-labels';

export interface ClaudeCodeOptions {
  prompt: string;
  tools?: string[];
  skills?: string[];
  workingDir?: string;
  activitySessionId?: string;
  activitySourceLabel?: string;
}

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');

const MAX_PROCESS_LISTENERS = Number(process.env.NODE_MAX_LISTENERS || '50');
const MAX_LISTENERS_FLAG = '__voqoMaxListenersConfigured';
(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  if (g[MAX_LISTENERS_FLAG]) return;
  g[MAX_LISTENERS_FLAG] = true;

  try {
    if (Number.isFinite(MAX_PROCESS_LISTENERS) && MAX_PROCESS_LISTENERS > 0) {
      const current = typeof process.getMaxListeners === 'function' ? process.getMaxListeners() : 10;
      if (current < MAX_PROCESS_LISTENERS && typeof process.setMaxListeners === 'function') {
        process.setMaxListeners(MAX_PROCESS_LISTENERS);
      }
    }
  } catch {
    // ignore
  }
})();

const logClaudeStderr = (data: string) => {
  if (!data) return;
  console.error('[Claude Code STDERR]', data.trim());
};

function buildClaudeEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  const pathEntries = new Set<string>((env.PATH || '').split(':').filter(Boolean));
  const homeDir = env.HOME;
  if (homeDir) {
    pathEntries.add(path.join(homeDir, '.local', 'bin'));
  }
  pathEntries.add('/home/voqo/.local/bin');
  env.PATH = Array.from(pathEntries).join(':');
  return env;
}

export function getClaudeEnv(): Record<string, string | undefined> {
  return buildClaudeEnv();
}

export function getClaudeModel(): string {
  return process.env.CLAUDE_MODEL || 'sonnet';
}

function buildBaseOptions(options: ClaudeCodeOptions): Options {
  const { workingDir, activitySessionId } = options;
  const activitySourceLabel = options.activitySourceLabel ?? SOURCE_LABELS.mainAgent;

  return {
    model: getClaudeModel(),
    allowedTools: options.tools ?? [
      'Read',
      'Write',
      'Edit',
      'Bash',
      'Glob',
      'Grep',
      'WebSearch',
      'WebFetch',
      'Task',
      'Skill',
    ],
    allowDangerouslySkipPermissions: true,
    cwd: workingDir || process.cwd(),
    env: getClaudeEnv(),
    settingSources: ['project'],
    stderr: logClaudeStderr,
    permissionMode: 'bypassPermissions',
    extraArgs: { debug: 'api' },
    hooks: activitySessionId ? buildActivityHooks(activitySessionId, activitySourceLabel) : undefined,
  };
}

export function createClaudeQuery(options: ClaudeCodeOptions): Query {
  return query({
    prompt: options.prompt,
    options: buildBaseOptions(options),
  });
}

function pipelinePath(sessionId: string) {
  return path.join(PROGRESS_DIR, `pipeline-${sessionId}.json`);
}

function activityPath(sessionId: string) {
  return path.join(PROGRESS_DIR, `activity-${sessionId}.json`);
}

function buildActivityId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatToolDetail(toolName: string, toolInput: unknown): string | undefined {
  if (!toolInput || typeof toolInput !== 'object') return undefined;
  const input = toolInput as Record<string, unknown>;

  switch (toolName) {
    case 'WebSearch':
      return typeof input.query === 'string' ? input.query : undefined;
    case 'WebFetch':
      return typeof input.url === 'string' ? input.url : undefined;
    case 'Read':
    case 'Write':
    case 'Edit':
      return typeof input.path === 'string' ? input.path : undefined;
    case 'Bash':
      return typeof input.command === 'string' ? input.command : undefined;
    case 'Glob':
      return typeof input.pattern === 'string' ? input.pattern : undefined;
    case 'Grep':
      return typeof input.pattern === 'string' ? input.pattern : undefined;
    case 'Task':
      return typeof input.prompt === 'string'
        ? input.prompt.slice(0, 140)
        : undefined;
    case 'Skill':
      return typeof input.name === 'string' ? input.name : undefined;
    default:
      return undefined;
  }
}

function mapToolMessage(toolName: string, toolInput: unknown, sourceLabel: string): ActivityMessage {
  const detail = formatToolDetail(toolName, toolInput);
  const base: ActivityMessage = {
    id: buildActivityId(),
    type: 'tool',
    text: `${getToolVerb(toolName)}...`,
    detail,
    source: sourceLabel,
    timestamp: new Date().toISOString(),
  };

  if (toolName === 'WebSearch') {
    return {
      ...base,
      type: 'search',
      text: detail ? `${getToolVerb('WebSearch')}: ${detail}` : 'Hunting the web...',
    };
  }

  if (toolName === 'WebFetch') {
    return {
      ...base,
      type: 'fetch',
      text: detail ? `${getToolVerb('WebFetch')}: ${detail}` : 'Snooping around...',
    };
  }

  return base;
}

function mapToolResult(toolName: string, toolResponse: unknown, sourceLabel: string): ActivityMessage | null {
  if (!toolResponse) return null;
  const base: ActivityMessage = {
    id: buildActivityId(),
    type: 'results',
    text: `Received ${toolName} results`,
    source: sourceLabel,
    timestamp: new Date().toISOString(),
  };

  if (toolName === 'WebSearch') {
    let count: number | null = null;
    if (Array.isArray(toolResponse)) {
      count = toolResponse.length;
    } else if (typeof toolResponse === 'object' && toolResponse !== null) {
      const maybeResults = (toolResponse as { results?: unknown }).results;
      if (Array.isArray(maybeResults)) {
        count = maybeResults.length;
      }
    }
    return {
      ...base,
      text: count !== null ? `Found ${count} search results` : 'Search completed',
    };
  }

  if (toolName === 'WebFetch') {
    return {
      ...base,
      type: 'fetch',
      text: 'Fetched webpage content',
    };
  }

  return null;
}
async function appendActivity(sessionId: string, message: ActivityMessage, status?: 'active' | 'complete') {
  try {
    const filePath = activityPath(sessionId);
    let activity: Activity | null = null;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      activity = JSON.parse(content) as Activity;
    } catch {
      activity = null;
    }

    let agenciesTarget = activity?.agenciesTarget ?? 0;
    let agenciesFound = activity?.agenciesFound ?? 0;

    try {
      const pipelineContent = await fs.readFile(pipelinePath(sessionId), 'utf-8');
      const pipeline = JSON.parse(pipelineContent) as { requestedCount?: number; agencyIds?: string[] };
      agenciesTarget = pipeline.requestedCount ?? agenciesTarget;
      if (pipeline.agencyIds && pipeline.agencyIds.length > 0) {
        agenciesFound = pipeline.agencyIds.length;
      }
    } catch {
      // Ignore pipeline read errors
    }

    const next: Activity = activity ?? {
      status: 'active',
      agenciesFound,
      agenciesTarget,
      messages: [],
    };

    if (message.type === 'identified') {
      const incremented = next.agenciesFound + 1;
      next.agenciesFound = Math.min(incremented, next.agenciesTarget || incremented);
    } else {
      next.agenciesFound = agenciesFound;
    }
    next.agenciesTarget = agenciesTarget;
    if (status) {
      next.status = status;
    }

    next.messages = [...next.messages, { ...message, source: message.source ?? SOURCE_LABELS.mainAgent }].slice(-200);

    await fs.writeFile(filePath, JSON.stringify(next, null, 2));
  } catch {
    // Ignore activity write failures
  }
}

function buildActivityHooks(sessionId: string, sourceLabel: string): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  return {
    SessionStart: [
      {
        hooks: [
          async (input: HookInput) => {
            if (input.hook_event_name !== 'SessionStart') return { continue: true };
            await appendActivity(sessionId, {
              id: buildActivityId(),
              type: 'thinking',
              text: 'Session started',
              source: 'System',
              timestamp: new Date().toISOString(),
            });
            return { continue: true };
          }
        ]
      }
    ],
    PreToolUse: [
      {
        hooks: [
          async (input: HookInput) => {
            if (input.hook_event_name !== 'PreToolUse') return { continue: true };
            const message = mapToolMessage(input.tool_name, input.tool_input, sourceLabel);
            await appendActivity(sessionId, message);
            return { continue: true };
          }
        ]
      }
    ],
    PostToolUseFailure: [
      {
        hooks: [
          async (input: HookInput) => {
            if (input.hook_event_name !== 'PostToolUseFailure') return { continue: true };
            await appendActivity(sessionId, {
              id: buildActivityId(),
              type: 'warning',
              text: `Tool failed: ${input.tool_name}`,
              detail: typeof input.error === 'string' ? input.error : undefined,
              source: sourceLabel,
              timestamp: new Date().toISOString(),
            });
            return { continue: true };
          }
        ]
      }
    ],
    PostToolUse: [
      {
        hooks: [
          async (input: HookInput) => {
            if (input.hook_event_name !== 'PostToolUse') return { continue: true };
            const message = mapToolResult(input.tool_name, input.tool_response, sourceLabel);
            if (message) {
              await appendActivity(sessionId, message);
            }
            return { continue: true };
          }
        ]
      }
    ],
    SessionEnd: [
      {
        hooks: [
          async (input: HookInput) => {
            if (input.hook_event_name !== 'SessionEnd') return { continue: true };
            await appendActivity(sessionId, {
              id: buildActivityId(),
              type: 'thinking',
              text: 'Session complete',
              source: 'System',
              timestamp: new Date().toISOString(),
            }, 'complete');
            return { continue: true };
          }
        ]
      }
    ],
  };
}

export async function invokeClaudeCode(options: ClaudeCodeOptions): Promise<string> {
  const { prompt } = options;

  console.log('[Claude Code] Invoking with prompt:', prompt.substring(0, 100) + '...');

  let result = '';

  try {
    for await (const message of createClaudeQuery(options)) {
      // Log message types for debugging
      if ('type' in message) {
        console.log('[Claude Code] Message type:', message.type);
      }

      // Capture assistant text responses
      if ('type' in message && message.type === 'assistant' && 'content' in message) {
        const content = message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              result += block.text + '\n';
            }
          }
        }
      }

      // Capture final result
      if ('result' in message) {
        console.log('[Claude Code] Got result');
        result = String(message.result);
      }
    }

    console.log('[Claude Code] Completed, result length:', result.length);
    return result;
  } catch (error) {
    console.error('[Claude Code] Error:', error);
    throw error;
  }
}

// Fire-and-forget version for background tasks
export function invokeClaudeCodeAsync(options: ClaudeCodeOptions): void {
  const { prompt } = options;

  console.log('[Claude Code Async] Starting background task');

  // Run in background without waiting
  (async () => {
    try {
      for await (const message of createClaudeQuery(options)) {
        if ('result' in message) {
          console.log('[Claude Code Async] Completed with result');
        }
      }
    } catch (error) {
      console.error('[Claude Code Async] Error:', error);
    }
  })();
}
