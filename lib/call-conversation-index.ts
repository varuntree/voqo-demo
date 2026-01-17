import path from 'path';
import { updateJsonFileWithLock } from '@/lib/fs-json';

const INDEX_FILE = path.join(process.cwd(), 'data', 'calls', 'conversation-index.json');

type ConversationIndex = Record<string, { callId: string; createdAt: string }>;

export async function getOrCreateCallIdForConversation(
  conversationId: string,
  createCallId: () => string
): Promise<{ callId: string; reused: boolean }> {
  const now = new Date().toISOString();

  const result = await updateJsonFileWithLock<ConversationIndex>(INDEX_FILE, (current) => {
    const index = current && typeof current === 'object' ? current : {};
    const existing = index[conversationId];
    if (existing && typeof existing.callId === 'string' && existing.callId.length) {
      return index;
    }

    const callId = createCallId();
    index[conversationId] = { callId, createdAt: now };
    return index;
  });

  const entry = result[conversationId];
  if (!entry) return { callId: createCallId(), reused: false };
  // If the entry was created in this call, createdAt will be "now" (best-effort).
  const reused = entry.createdAt !== now;
  return { callId: entry.callId, reused };
}

