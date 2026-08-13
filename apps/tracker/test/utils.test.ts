import { describe, it, expect } from 'vitest';
import { detectBot, hashVisitorIP, normalizeReferer, extractMeta } from '../src/utils';

const VALID_KEY = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

describe('Tracker Utils Unit Tests', () => {
  describe('detectBot', () => {
    it('detects bot user agents', () => {
      expect(detectBot(null)).toBe(true);
      expect(detectBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
      expect(detectBot('curl/7.68.0')).toBe(true);
      expect(detectBot('HeadlessChrome/120.0.0.0')).toBe(true);
    });

    it('identifies real human browsers as non-bot', () => {
      expect(detectBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBe(false);
    });
  });

  describe('hashVisitorIP', () => {
    it('computes a day-scoped pseudonymous HMAC-SHA-256 visitor hash', async () => {
      const ip = '203.0.113.195';
      const ts = Date.UTC(2026, 7, 13, 10, 0, 0); // 2026-08-13
      const hash1 = await hashVisitorIP(ip, VALID_KEY, ts);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);

      const tsSameDay = Date.UTC(2026, 7, 13, 18, 30, 0); // Same UTC day
      const hash2 = await hashVisitorIP(ip, VALID_KEY, tsSameDay);
      expect(hash2).toBe(hash1);
    });

    it('changes visitor hash on the next UTC day for the same IP', async () => {
      const ip = '203.0.113.195';
      const day1 = Date.UTC(2026, 7, 13, 23, 59, 0);
      const day2 = Date.UTC(2026, 7, 14, 0, 1, 0);

      const hash1 = await hashVisitorIP(ip, VALID_KEY, day1);
      const hash2 = await hashVisitorIP(ip, VALID_KEY, day2);

      expect(hash1).not.toBe(hash2);
    });

    it('returns null and logs error if IP_HASH_KEY is missing or shorter than 32 chars', async () => {
      const hash = await hashVisitorIP('127.0.0.1', 'short_key', Date.now());
      expect(hash).toBeNull();
    });
  });

  describe('normalizeReferer', () => {
    it('normalizes HTTP and HTTPS referrers to their origin only', () => {
      expect(normalizeReferer('https://example.com/blog/article?utm=1#top')).toBe('https://example.com');
      expect(normalizeReferer('http://sub.domain.org:8080/path/to/page')).toBe('http://sub.domain.org:8080');
    });

    it('handles null or non-standard referrers', () => {
      expect(normalizeReferer(null)).toBeNull();
      expect(normalizeReferer('about:blank')).toBe('about:blank');
    });
  });

  describe('extractMeta', () => {
    it('extracts and caps standard UTM parameters', () => {
      const longVal = 'a'.repeat(250);
      const url = new URL(`https://pixel.domain/p/sb23456789.gif?utm_source=${longVal}&utm_medium=cpc&custom_ignored=123`);

      const metaStr = extractMeta(url);
      expect(metaStr).not.toBeNull();
      const meta = JSON.parse(metaStr!);

      expect(meta.utm_source).toBe('a'.repeat(200));
      expect(meta.utm_medium).toBe('cpc');
      expect(meta.custom_ignored).toBeUndefined();
    });
  });
});
