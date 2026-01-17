export function isSafeSessionId(sessionId: string): boolean {
  if (!sessionId) return false;
  if (sessionId.length > 128) return false;
  if (sessionId.includes('/') || sessionId.includes('\\')) return false;
  if (sessionId.includes('..')) return false;
  return /^[a-zA-Z0-9-]{3,128}$/.test(sessionId);
}

export function isSafeAgencyId(agencyId: string): boolean {
  if (!agencyId) return false;
  if (agencyId.length > 128) return false;
  if (agencyId.includes('/') || agencyId.includes('\\')) return false;
  if (agencyId.includes('..')) return false;
  return /^[a-z0-9-]{3,128}$/.test(agencyId);
}

export function isSafeCallId(callId: string): boolean {
  if (!callId) return false;
  if (callId.length > 160) return false;
  if (callId.includes('/') || callId.includes('\\')) return false;
  if (callId.includes('..')) return false;
  return /^[a-zA-Z0-9-]{3,160}$/.test(callId);
}

export function stripHtmlSuffix(input: string): string {
  return input.endsWith('.html') ? input.replace(/\.html$/, '') : input;
}

export function buildActivityId(prefix = 'msg'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
