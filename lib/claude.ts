import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ClaudeCodeOptions {
  prompt: string;
  tools?: string[];
  skills?: string[];
  workingDir?: string;
}

export async function invokeClaudeCode(options: ClaudeCodeOptions): Promise<string> {
  const { prompt, workingDir = process.cwd() } = options;

  // Escape prompt for shell
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');

  // Build command - uses claude CLI with --print for non-interactive
  const command = `cd "${workingDir}" && claude --print --dangerously-skip-permissions -p "${escapedPrompt}"`;

  console.log('[Claude Code] Invoking with prompt:', prompt.substring(0, 100) + '...');

  try {
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
    if (stderr) console.error('[Claude Code] stderr:', stderr);
    return stdout;
  } catch (error) {
    console.error('[Claude Code] Error:', error);
    throw error;
  }
}

// Fire-and-forget version for background tasks
export function invokeClaudeCodeAsync(options: ClaudeCodeOptions): void {
  const { prompt, workingDir = process.cwd() } = options;
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const command = `cd "${workingDir}" && claude --print --dangerously-skip-permissions -p "${escapedPrompt}"`;

  console.log('[Claude Code Async] Starting background task');

  exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      console.error('[Claude Code Async] Error:', error);
    } else {
      console.log('[Claude Code Async] Completed');
    }
  });
}
