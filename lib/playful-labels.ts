// Playful UI labels for tool names and sources
export const TOOL_VERBS: Record<string, string> = {
  WebSearch: 'Hunting',
  WebFetch: 'Snooping',
  Read: 'Peeking',
  Write: 'Scribbling',
  Edit: 'Tinkering',
  Task: 'Delegating',
  Glob: 'Scanning',
  Grep: 'Digging',
  Bash: 'Executing',
  Skill: 'Activating',
};

export const SOURCE_LABELS = {
  mainAgent: 'Captain',
  system: 'System',
} as const;

export const WORKSPACE_LABELS = {
  main: 'Control Room',
  subagent: 'Worker Bee stream',
} as const;

export function getToolVerb(toolName: string): string {
  return TOOL_VERBS[toolName] || toolName;
}
