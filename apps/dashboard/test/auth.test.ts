import { describe, it, expect } from 'vitest';
import {
  passwordMatches,
  createSession,
  verifySession,
  createCsrfToken,
  verifyCsrfToken,
  genShortId,
} from '../src/lib/auth';

const VALID_SECRET = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

describe('Dashboard Auth Unit Tests', () => {
  describe('passwordMatches', () => {
    it('returns true for matching passwords', async () => {
      const match = await passwordMatches('secure_password_123', 'secure_password_123');
      expect(match).toBe(true);
    });

    it('returns false for mismatched passwords', async () => {
      const match = await passwordMatches('wrong_password', 'secure_password_123');
      expect(match).toBe(false);
    });
  });

  describe('createSession & verifySession', () => {
    it('creates and verifies a valid session token', async () => {
      const now = Date.now();
      const token = await createSession(VALID_SECRET, now);
      expect(token).toMatch(/^v1\.\d+\.[a-f0-9]{64}$/);

      const isValid = await verifySession(token, VALID_SECRET, now);
      expect(isValid).toBe(true);
    });

    it('rejects tampered signature in session token', async () => {
      const now = Date.now();
      const token = await createSession(VALID_SECRET, now);
      const tampered = token.slice(0, -4) + '0000';
      const isValid = await verifySession(tampered, VALID_SECRET, now);
      expect(isValid).toBe(false);
    });

    it('rejects expired session token', async () => {
      const start = Date.now();
      const token = await createSession(VALID_SECRET, start);
      const futureNow = start + 8 * 24 * 3600 * 1000;
      const isValid = await verifySession(token, VALID_SECRET, futureNow);
      expect(isValid).toBe(false);
    });

    it('rejects session token with expiry more than 7 days in future', async () => {
      const now = Date.now();
      const farFutureExpiry = now + 10 * 24 * 3600 * 1000;
      const fakeToken = `v1.${farFutureExpiry}.0000000000000000000000000000000000000000000000000000000000000000`;
      const isValid = await verifySession(fakeToken, VALID_SECRET, now);
      expect(isValid).toBe(false);
    });

    it('fails closed when SESSION_SECRET is shorter than 32 characters', async () => {
      const now = Date.now();
      const shortSecret = 'short_secret';
      const token = await createSession(VALID_SECRET, now);
      const isValid = await verifySession(token, shortSecret, now);
      expect(isValid).toBe(false);
    });
  });

  describe('createCsrfToken & verifyCsrfToken', () => {
    it('creates and verifies a valid CSRF token', async () => {
      const sessionToken = await createSession(VALID_SECRET);
      const csrfToken = await createCsrfToken(sessionToken, VALID_SECRET);
      expect(csrfToken).toHaveLength(64);

      const isValid = await verifyCsrfToken(csrfToken, sessionToken, VALID_SECRET);
      expect(isValid).toBe(true);
    });

    it('rejects CSRF token verified against a different session token', async () => {
      const session1 = await createSession(VALID_SECRET, 1000000000000);
      const session2 = await createSession(VALID_SECRET, 2000000000000);
      const csrfToken = await createCsrfToken(session1, VALID_SECRET);

      const isValid = await verifyCsrfToken(csrfToken, session2, VALID_SECRET);
      expect(isValid).toBe(false);
    });
  });

  describe('genShortId', () => {
    it('generates a 10-character ambiguity-free pixel ID', () => {
      const id = genShortId();
      expect(id).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/);
    });
  });
});
