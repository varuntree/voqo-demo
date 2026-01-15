import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

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
  await mkdir(AGENCY_CALLS_DIR, { recursive: true });
  const filePath = path.join(AGENCY_CALLS_DIR, `${agencyId}.json`);

  try {
    const contents = await readFile(filePath, 'utf-8');
    return JSON.parse(contents) as AgencyCallsFile;
  } catch {
    return { agencyId, calls: [] };
  }
}

export async function appendAgencyCall(agencyId: string, entry: AgencyCallEntry): Promise<void> {
  const existing = await getAgencyCalls(agencyId);
  existing.calls.unshift(entry);
  await writeAgencyCalls(existing);
}

export async function updateAgencyCall(
  agencyId: string,
  callId: string,
  updates: Partial<AgencyCallEntry>
): Promise<void> {
  const existing = await getAgencyCalls(agencyId);
  const index = existing.calls.findIndex(call => call.callId === callId);
  if (index === -1) {
    existing.calls.unshift({ callId, createdAt: new Date().toISOString(), ...updates });
  } else {
    existing.calls[index] = { ...existing.calls[index], ...updates };
  }
  await writeAgencyCalls(existing);
}

async function writeAgencyCalls(data: AgencyCallsFile): Promise<void> {
  await mkdir(AGENCY_CALLS_DIR, { recursive: true });
  const filePath = path.join(AGENCY_CALLS_DIR, `${data.agencyId}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2));
}
