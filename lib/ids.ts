export function isSafeSessionId(sessionId: string): boolean {
  if (!sessionId) return false;
  if (sessionId.length > 128) return false;
  if (sessionId.includes('/') || sessionId.includes('\\')) return false;
  if (sessionId.includes('..')) return false;
  return /^[a-zA-Z0-9-]{3,128}$/.test(sessionId);
}

export function buildActivityId(prefix = 'msg'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

