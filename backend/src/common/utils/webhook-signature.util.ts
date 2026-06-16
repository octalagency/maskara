import { createHmac, timingSafeEqual } from 'crypto';

export function hmacSha256(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export function verifyHmacSha256(
  payload: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const expected = hmacSha256(payload, secret);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return signature === expected || signature === `sha256=${expected}`;
  }
}

export function verifySharedSecret(
  headerValue: string | undefined,
  secret: string,
): boolean {
  if (!headerValue || !secret) return false;
  try {
    const a = Buffer.from(headerValue);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return headerValue === secret;
  }
}
