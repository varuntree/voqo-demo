import { query } from '@anthropic-ai/claude-agent-sdk';

export interface ClaudeCodeOptions {
  prompt: string;
  tools?: string[];
  skills?: string[];
  workingDir?: string;
}

export async function invokeClaudeCode(options: ClaudeCodeOptions): Promise<string> {
  const { prompt, workingDir } = options;

  console.log('[Claude Code] Invoking with prompt:', prompt.substring(0, 100) + '...');

  let result = '';

  try {
    for await (const message of query({
      prompt,
      options: {
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Task', 'Skill'],
        allowDangerouslySkipPermissions: true,
        cwd: workingDir || process.cwd(),
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
  const { prompt, workingDir } = options;

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
