import { describe, it, expect } from 'vitest';
import { rangeWindow, parseUtcDayStart, parseUtcDayExclusiveEnd } from '../src/lib/range';

describe('Range Window Utility Tests', () => {
  it('computes correct preset bounds ending at now', () => {
    const fixedNow = Date.UTC(2026, 7, 13, 12, 0, 0); // 2026-08-13 12:00:00 UTC
    const win7d = rangeWindow('7d', fixedNow);

    expect(win7d.end).toBe(fixedNow);
    expect(win7d.start).toBe(fixedNow - 7 * 24 * 3600 * 1000);
    expect(win7d.prevEnd).toBe(win7d.start);
    expect(win7d.prevStart).toBe(win7d.start - 7 * 24 * 3600 * 1000);
  });

  it('parses custom calendar dates with UTC day start and exclusive next-day end', () => {
    const fromStr = '2026-08-10';
    const toStr = '2026-08-12';

    const startUtc = parseUtcDayStart(fromStr);
    const endUtc = parseUtcDayExclusiveEnd(toStr);

    expect(startUtc).toBe(Date.UTC(2026, 7, 10, 0, 0, 0));
    expect(endUtc).toBe(Date.UTC(2026, 7, 13, 0, 0, 0)); // Day after 2026-08-12

    const win = rangeWindow('custom', Date.now(), fromStr, toStr);
    expect(win.start).toBe(Date.UTC(2026, 7, 10, 0, 0, 0));
    expect(win.end).toBe(Date.UTC(2026, 7, 13, 0, 0, 0));
    expect(win.span).toBe(3 * 24 * 3600 * 1000);
    expect(win.prevStart).toBe(win.start - win.span);
    expect(win.prevEnd).toBe(win.start);
  });
});
