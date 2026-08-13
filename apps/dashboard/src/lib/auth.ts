const SESSION_EXPIRY_MS = 7 * 24 * 3600 * 1000;

async function sha256(text: string): Promise<Uint8Array> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(digest);
}

async function hmacHex(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function safeCompareBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

export async function passwordMatches(candidate: string, expected: string): Promise<boolean> {
  const candidateHash = await sha256(candidate);
  const expectedHash = await sha256(expected);
  return safeCompareBytes(candidateHash, expectedHash);
}

export async function createSession(secret: string, now: number = Date.now()): Promise<string> {
  const expires = now + SESSION_EXPIRY_MS;
  const payload = `v1.${expires}`;
  const sig = await hmacHex(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifySession(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token || !secret || secret.length < 32) return false;

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;

  const expires = Number(parts[1]);
  if (!Number.isInteger(expires) || expires <= 0) return false;

  const payload = `v1.${expires}`;
  const sigHex = parts[2];
  const expectedSigHex = await hmacHex(payload, secret);

  let sigBytes: Uint8Array;
  let expectedBytes: Uint8Array;
  try {
    sigBytes = hexToBytes(sigHex);
    expectedBytes = hexToBytes(expectedSigHex);
  } catch {
    return false;
  }

  if (!safeCompareBytes(sigBytes, expectedBytes)) return false;

  if (now > expires) return false;
  if (expires > now + SESSION_EXPIRY_MS + 60000) return false;

  return true;
}

export async function createCsrfToken(sessionToken: string, secret: string): Promise<string> {
  const payload = `csrf:${sessionToken}`;
  return hmacHex(payload, secret);
}

export async function verifyCsrfToken(
  token: string,
  sessionToken: string,
  secret: string,
): Promise<boolean> {
  if (!token || !sessionToken || !secret) return false;
  const expected = await createCsrfToken(sessionToken, secret);
  const tokenBytes = new TextEncoder().encode(token);
  const expectedBytes = new TextEncoder().encode(expected);
  return safeCompareBytes(tokenBytes, expectedBytes);
}

const SHORT_ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

export function genShortId(): string {
  let out = '';
  while (out.length < 10) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const b of bytes) {
      if (b < 248 && out.length < 10) out += SHORT_ID_ALPHABET[b % 31];
    }
  }
  return out;
}
