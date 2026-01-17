import crypto from 'crypto';
import type { ActivityMessage } from '@/lib/types';

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ts = Date.parse(value);
  return Number.isFinite(ts);
}

function stableFallbackId(prefix: string, message: ActivityMessage): string {
  const payload = [
    message.type,
    message.text,
    message.detail ?? '',
    message.source ?? '',
    message.timestamp ?? '',
  ].join('|');

  const digest = crypto.createHash('sha1').update(payload).digest('hex').slice(0, 10);
  return `${prefix}:h-${digest}`;
}

export function stableActivityMessageId(prefix: string, message: ActivityMessage): string {
  if (typeof message.id === 'string' && message.id.trim().length > 0) {
    return `${prefix}:${message.id}`;
  }
  return stableFallbackId(prefix, message);
}

export function normalizeActivityMessage(
  message: ActivityMessage,
  prefix: string,
  fallbackSource: string
): ActivityMessage {
  const hasSuspiciousMidnightTimestamp =
    typeof message.timestamp === 'string' && message.timestamp.endsWith('T00:00:00.000Z');

  return {
    ...message,
    id: stableActivityMessageId(prefix, message),
    timestamp:
      isValidIsoTimestamp(message.timestamp) && !hasSuspiciousMidnightTimestamp
        ? message.timestamp
        : new Date().toISOString(),
    source: message.source ?? fallbackSource,
  };
}

