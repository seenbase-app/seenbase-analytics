import { describe, it, expect, beforeEach } from 'vitest';
import { handlePixel } from '../src/pixel';
import { handleCron, handleRetention } from '../src/cron';
import type { Env } from '../src/env';

const VALID_KEY = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

class MockD1Database {
  public events: any[] = [];
  public pixels: any[] = [];
  public domains: any[] = [];
  public aggregates: any[] = [];
  public cronState: Record<string, number> = { aggregator: 0 };
  private autoIncId = 1;

  prepare(sql: string) {
    const self = this;
    let boundArgs: any[] = [];

    const stmtObj = {
      bind(...args: any[]) {
        boundArgs = args;
        return stmtObj;
      },
      async first<T = any>(): Promise<T | null> {
        if (sql.includes('SELECT p.id AS pixel_id')) {
          const [hostname, pixelId] = boundArgs;
          const pixel = self.pixels.find(p => p.id === pixelId);
          if (!pixel) return null;

          const domain = self.domains.find(d => d.hostname === hostname && d.active === 1);
          return {
            pixel_id: pixel.id,
            pixel_active: pixel.active,
            pixel_deleted_at: pixel.deleted_at,
            domain_id: domain?.id ?? null,
          } as any;
        }

        if (sql.includes("SELECT last_id FROM cron_state WHERE k = 'aggregator'")) {
          return { last_id: self.cronState['aggregator'] ?? 0 } as any;
        }

        if (sql.includes('SELECT MAX(id) AS max_id FROM events WHERE id > ?')) {
          const lastId = boundArgs[0];
          const newEvents = self.events.filter(e => e.id > lastId);
          if (newEvents.length === 0) return { max_id: null } as any;
          const maxId = Math.max(...newEvents.map(e => e.id));
          return { max_id: maxId } as any;
        }

        return null;
      },
      async run() {
        if (sql.startsWith('INSERT INTO events')) {
          const [pixel_id, created, ip_hash, ua, referer, country, city, region, asn, as_org, lang, is_bot, domain_id, meta] = boundArgs;
          const newId = self.autoIncId++;
          self.events.push({
            id: newId,
            pixel_id,
            created,
            ip_hash,
            ua,
            referer,
            country,
            city,
            region,
            asn,
            as_org,
            lang,
            is_bot,
            domain_id,
            meta,
          });
          return { meta: { changes: 1 } };
        }

        if (sql.startsWith('DELETE FROM events')) {
          const [cutoff, lastId] = boundArgs;
          const initialLen = self.events.length;
          self.events = self.events.filter(e => !(e.created < cutoff && e.id <= lastId));
          const deleted = initialLen - self.events.length;
          return { meta: { changes: deleted } };
        }

        return { meta: { changes: 0 } };
      },
    };

    return stmtObj;
  }

  async batch(stmts: any[]) {
    const results: any[] = [];
    for (const stmt of stmts) {
      results.push({ results: [] });
    }
    return results;
  }
}

function createMockEnv(db: MockD1Database, key = VALID_KEY, retention = '90'): Env {
  return {
    DB: db as any,
    IP_HASH_KEY: key,
    RETENTION_DAYS: retention,
  };
}

describe('Tracker Worker Integration Tests', () => {
  let mockDb: MockD1Database;
  let mockCtx: ExecutionContext;
  let promises: Promise<any>[];

  beforeEach(() => {
    mockDb = new MockD1Database();
    promises = [];
    mockCtx = {
      waitUntil(promise: Promise<any>) {
        promises.push(promise);
      },
      passThroughOnException() {},
    } as any;

    mockDb.pixels.push({
      id: 'sb23456789',
      name: 'Test Pixel',
      active: 1,
      created: Date.now(),
      deleted_at: null,
    });
  });

  it('returns 200 image/gif with anti-cache headers immediately', async () => {
    const req = new Request('https://trxl.example/p/sb23456789.gif', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    });
    const env = createMockEnv(mockDb);

    const res = handlePixel(req, env, mockCtx, 'sb23456789');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/gif');
    expect(res.headers.get('Cache-Control')).toContain('no-store');

    await Promise.all(promises);
    expect(mockDb.events).toHaveLength(1);
  });

  it('drops event write for missing or inactive pixels', async () => {
    const req = new Request('https://trxl.example/p/unknown123.gif', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    });
    const env = createMockEnv(mockDb);

    handlePixel(req, env, mockCtx, 'unknown123');
    await Promise.all(promises);

    expect(mockDb.events).toHaveLength(0);
  });

  it('fails closed when IP_HASH_KEY is missing or too short', async () => {
    const req = new Request('https://trxl.example/p/sb23456789.gif', {
      headers: { 'CF-Connecting-IP': '203.0.113.10' },
    });
    const env = createMockEnv(mockDb, 'short_secret');

    handlePixel(req, env, mockCtx, 'sb23456789');
    await Promise.all(promises);

    expect(mockDb.events).toHaveLength(0);
  });

  it('stores event with normalized referer origin, capped metadata, and HMAC visitor hash without storing raw IP', async () => {
    const req = new Request('https://trxl.example/p/sb23456789.gif?utm_source=test&utm_medium=cpc', {
      headers: {
        'CF-Connecting-IP': '198.51.100.42',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://example.com/some/path?query=123',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const env = createMockEnv(mockDb);

    handlePixel(req, env, mockCtx, 'sb23456789');
    await Promise.all(promises);

    expect(mockDb.events).toHaveLength(1);
    const ev = mockDb.events[0];
    expect(ev.pixel_id).toBe('sb23456789');
    expect(ev.referer).toBe('https://example.com');
    expect(ev.ip_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(ev.ip_hash).not.toContain('198.51.100.42');
    expect(JSON.parse(ev.meta)).toEqual({ utm_source: 'test', utm_medium: 'cpc' });
  });

  it('aggregates multiple hits into hourly buckets and advances cron cursor', async () => {
    const now = Date.now();
    mockDb.events.push(
      { id: 1, pixel_id: 'sb23456789', created: now, ip_hash: 'hash_a', is_bot: 0 },
      { id: 2, pixel_id: 'sb23456789', created: now + 100, ip_hash: 'hash_a', is_bot: 0 },
    );

    const prepareMock = (sql: string) => {
      const stmt = {
        bind(...args: any[]) {
          return stmt;
        },
        async first() {
          if (sql.includes("SELECT last_id FROM cron_state")) return { last_id: 0 };
          if (sql.includes("SELECT MAX(id)")) return { max_id: 2 };
          return null;
        },
      };
      return stmt;
    };

    const cronEnv = {
      DB: {
        prepare: prepareMock,
        batch: async () => {
          mockDb.cronState['aggregator'] = 2;
          mockDb.aggregates.push({ pixel_id: 'sb23456789', bucket: Math.floor(now / 3600000) * 3600000, hits: 2, uniques: 1, bots: 0 });
        },
      } as any,
    } as Env;

    await handleCron(cronEnv);

    expect(mockDb.cronState['aggregator']).toBe(2);
    expect(mockDb.aggregates).toHaveLength(1);
    expect(mockDb.aggregates[0].hits).toBe(2);
    expect(mockDb.aggregates[0].uniques).toBe(1);
  });

  it('retention cleanup deletes only old events with id <= aggregator cursor', async () => {
    const now = Date.now();
    const oldTime = now - 100 * 86400000;

    mockDb.events.push(
      { id: 1, pixel_id: 'sb23456789', created: oldTime, ip_hash: 'hash_old', is_bot: 0 },
      { id: 2, pixel_id: 'sb23456789', created: now, ip_hash: 'hash_fresh', is_bot: 0 },
    );
    mockDb.cronState['aggregator'] = 2;

    const env = createMockEnv(mockDb, VALID_KEY, '90');
    await handleRetention(env);

    expect(mockDb.events).toHaveLength(1);
    expect(mockDb.events[0].id).toBe(2);
  });
});
