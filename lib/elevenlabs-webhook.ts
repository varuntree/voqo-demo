import crypto from 'crypto';
import { safeStringEqual } from '@/lib/fs-json';

type VerificationResult =
  | { ok: true; scheme: 'raw' | 'timestamped' | 'base64' }
  | { ok: false; reason: string };

function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function toBufferFromHexOrBase64(input: string): Buffer | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return Buffer.from(trimmed, 'hex');
  // Heuristic: treat as base64 if it contains base64 chars.
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    try {
      const buf = Buffer.from(trimmed, 'base64');
      return buf.length ? buf : null;
    } catch {
      return null;
    }
  }
  return null;
}

function timingSafeEqualBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyElevenLabsWebhookSignature(
  rawPayload: string,
  signatureHeader: string | null,
  secret: string | undefined
): VerificationResult {
  if (!secret || !secret.trim().length) return { ok: false, reason: 'Missing ELEVENLABS_WEBHOOK_SECRET' };
  if (!signatureHeader || !signatureHeader.trim().length) return { ok: false, reason: 'Missing signature header' };

  const header = signatureHeader.trim();

  // Support a Stripe-like scheme: "t=...,v0=..."
  if (header.includes('t=') && header.includes('v0=')) {
    const parts = header.split(',').map((p) => p.trim());
    const t = parts.find((p) => p.startsWith('t='))?.slice(2);
    const v0 = parts.find((p) => p.startsWith('v0='))?.slice(3);
    if (!t || !v0) return { ok: false, reason: 'Invalid signature header format' };

    const expected = hmacHex(secret, `${t}.${rawPayload}`);
    if (!safeStringEqual(expected, v0)) return { ok: false, reason: 'Signature mismatch' };
    return { ok: true, scheme: 'timestamped' };
  }

  // Support a simple "hex hmac(rawPayload)" scheme.
  const expectedHex = hmacHex(secret, rawPayload);
  if (/^[0-9a-f]{64}$/i.test(header)) {
    if (!safeStringEqual(expectedHex, header)) return { ok: false, reason: 'Signature mismatch' };
    return { ok: true, scheme: 'raw' };
  }

  // Support base64-encoded signatures.
  const providedBuf = toBufferFromHexOrBase64(header);
  if (providedBuf) {
    const expectedBuf = crypto.createHmac('sha256', secret).update(rawPayload).digest();
    if (!timingSafeEqualBuffers(expectedBuf, providedBuf)) return { ok: false, reason: 'Signature mismatch' };
    return { ok: true, scheme: 'base64' };
  }

  return { ok: false, reason: 'Unsupported signature format' };
}

