import path from 'path';
import { isSafeAgencyId } from '@/lib/ids';
import { readJsonFile, updateJsonFileWithLock } from '@/lib/fs-json';

const AGENCY_CALLS_DIR = path.join(process.cwd(), 'data/agency-calls');

export interface AgencyCallEntry {
  callId: string;
  createdAt: string;
  pageUrl?: string | null;
  callerName?: string | null;
  summary?: string | null;
  status?: 'generating' | 'completed' | 'failed';
}

interface AgencyCallsFile {
  agencyId: string;
  calls: AgencyCallEntry[];
}

export async function getAgencyCalls(agencyId: string): Promise<AgencyCallsFile> {
  if (!isSafeAgencyId(agencyId)) return { agencyId, calls: [] };
  const filePath = path.join(AGENCY_CALLS_DIR, `${agencyId}.json`);

  const parsed = await readJsonFile<AgencyCallsFile>(filePath);
  if (!parsed || !Array.isArray(parsed.calls)) return { agencyId, calls: [] };
  return { agencyId, calls: parsed.calls };
}

export async function appendAgencyCall(agencyId: string, entry: AgencyCallEntry): Promise<void> {
  if (!isSafeAgencyId(agencyId)) return;
  const filePath = path.join(AGENCY_CALLS_DIR, `${agencyId}.json`);
  await updateJsonFileWithLock<AgencyCallsFile>(filePath, (current) => {
    const existing = current && typeof current === 'object' && Array.isArray((current as any).calls)
      ? (current as AgencyCallsFile)
      : ({ agencyId, calls: [] } satisfies AgencyCallsFile);
    return { agencyId, calls: [entry, ...existing.calls].slice(0, 200) };
  });
}

export async function updateAgencyCall(
  agencyId: string,
  callId: string,
  updates: Partial<AgencyCallEntry>
): Promise<void> {
  if (!isSafeAgencyId(agencyId)) return;
  const filePath = path.join(AGENCY_CALLS_DIR, `${agencyId}.json`);
  await updateJsonFileWithLock<AgencyCallsFile>(filePath, (current) => {
    const existing = current && typeof current === 'object' && Array.isArray((current as any).calls)
      ? (current as AgencyCallsFile)
      : ({ agencyId, calls: [] } satisfies AgencyCallsFile);
    const idx = existing.calls.findIndex((call) => call.callId === callId);
    const nextCalls = [...existing.calls];
    if (idx === -1) {
      nextCalls.unshift({ callId, createdAt: new Date().toISOString(), ...updates });
    } else {
      nextCalls[idx] = { ...nextCalls[idx], ...updates };
    }
    return { agencyId, calls: nextCalls.slice(0, 200) };
  });
}
