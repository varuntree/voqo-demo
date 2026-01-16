import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  HookCallbackMatcher,
  HookEvent,
  HookInput
} from '@anthropic-ai/claude-agent-sdk';
import { promises as fs } from 'fs';
import path from 'path';
import type { Activity, ActivityMessage } from '@/lib/types';

export interface ClaudeCodeOptions {
  prompt: string;
  tools?: string[];
  skills?: string[];
  workingDir?: string;
  activitySessionId?: string;
}

const PROGRESS_DIR = path.join(process.cwd(), 'data', 'progress');

const logClaudeStderr = (data: string) => {
  if (!data) return;
  console.error('[Claude Code STDERR]', data.trim());
};

function buildClaudeEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  const homeDir = env.HOME;
  if (homeDir) {
    const localBin = path.join(homeDir, '.local', 'bin');
    if (env.PATH) {
      if (!env.PATH.split(':').includes(localBin)) {
        env.PATH = `${env.PATH}:${localBin}`;
      }
    } else {
      env.PATH = localBin;
    }
  }
  return env;
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

function mapToolMessage(toolName: string, toolInput: unknown): ActivityMessage {
  const detail = formatToolDetail(toolName, toolInput);
  const base: ActivityMessage = {
    id: buildActivityId(),
    type: 'tool',
    text: `Using ${toolName}`,
    detail,
    source: 'Main agent',
    timestamp: new Date().toISOString(),
  };

  if (toolName === 'WebSearch') {
    return {
      ...base,
      type: 'search',
      text: detail ? `Searching: ${detail}` : 'Searching the web...',
    };
  }

  if (toolName === 'WebFetch') {
    return {
      ...base,
      type: 'fetch',
      text: detail ? `Fetching: ${detail}` : 'Fetching webpage...',
    };
  }

  return base;
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

    next.messages = [...next.messages, { ...message, source: message.source ?? 'Main agent' }].slice(-200);

    await fs.writeFile(filePath, JSON.stringify(next, null, 2));
  } catch {
    // Ignore activity write failures
  }
}

function buildActivityHooks(sessionId: string): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
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
            const message = mapToolMessage(input.tool_name, input.tool_input);
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
              source: 'Main agent',
              timestamp: new Date().toISOString(),
            });
            return { continue: true };
          }
        ]
      }
    ],
    SubagentStart: [
      {
        hooks: [
          async (input: HookInput) => {
            if (input.hook_event_name !== 'SubagentStart') return { continue: true };
            await appendActivity(sessionId, {
              id: buildActivityId(),
              type: 'agent',
              text: `Subagent started (${input.agent_type})`,
              detail: input.agent_id,
              source: 'System',
              timestamp: new Date().toISOString(),
            });
            return { continue: true };
          }
        ]
      }
    ],
    SubagentStop: [
      {
        hooks: [
          async (input: HookInput) => {
            if (input.hook_event_name !== 'SubagentStop') return { continue: true };
            await appendActivity(sessionId, {
              id: buildActivityId(),
              type: 'agent',
              text: 'Subagent finished',
              detail: input.agent_id,
              source: 'System',
              timestamp: new Date().toISOString(),
            });
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
  const { prompt, workingDir, activitySessionId } = options;

  console.log('[Claude Code] Invoking with prompt:', prompt.substring(0, 100) + '...');

  let result = '';

  try {
    for await (const message of query({
      prompt,
      options: {
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Task', 'Skill'],
        allowDangerouslySkipPermissions: true,
        cwd: workingDir || process.cwd(),
        env: buildClaudeEnv(),
        settingSources: ['project'],
        stderr: logClaudeStderr,
        hooks: activitySessionId ? buildActivityHooks(activitySessionId) : undefined,
      }
    })) {
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
  const { prompt, workingDir, activitySessionId } = options;

  console.log('[Claude Code Async] Starting background task');

  // Run in background without waiting
  (async () => {
    try {
      for await (const message of query({
      prompt,
      options: {
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Task', 'Skill'],
        allowDangerouslySkipPermissions: true,
        cwd: workingDir || process.cwd(),
        env: buildClaudeEnv(),
        settingSources: ['project'],
        stderr: logClaudeStderr,
        hooks: activitySessionId ? buildActivityHooks(activitySessionId) : undefined,
      }
    })) {
        if ('result' in message) {
          console.log('[Claude Code Async] Completed with result');
        }
      }
    } catch (error) {
      console.error('[Claude Code Async] Error:', error);
    }
  })();
}
