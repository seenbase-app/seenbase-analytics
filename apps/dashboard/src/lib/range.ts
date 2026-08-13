export type RangeKey = '24h' | '7d' | '30d' | 'custom';
export type PresetRangeKey = Exclude<RangeKey, 'custom'>;

const SPAN_MS: Record<PresetRangeKey, number> = {
  '24h': 24 * 3600 * 1000,
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
};

export const RANGE_LABEL: Record<RangeKey, string> = {
  '24h': 'last 24h',
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  'custom': 'custom range',
};

export const RANGE_KEYS: PresetRangeKey[] = ['24h', '7d', '30d'];

export function parseRange(v: string | null): RangeKey {
  if (v === '24h' || v === '30d' || v === 'custom') return v;
  return '7d';
}

export interface RangeWindow {
  span: number;
  start: number;
  end: number;
  prevStart: number;
  prevEnd: number;
}

export function parseUtcDayStart(dateStr: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day);
}

export function parseUtcDayExclusiveEnd(dateStr: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day + 1);
}

export function rangeWindow(
  key: RangeKey,
  now: number = Date.now(),
  customFromStr?: string | null,
  customToStr?: string | null,
): RangeWindow {
  if (key === 'custom') {
    const fParsed = customFromStr ? parseUtcDayStart(customFromStr) : null;
    const tParsed = customToStr ? parseUtcDayExclusiveEnd(customToStr) : null;

    const start = fParsed ?? now - SPAN_MS['7d'];
    const end = tParsed ?? now;
    const span = Math.max(0, end - start);
    return {
      span,
      start,
      end,
      prevStart: start - span,
      prevEnd: start,
    };
  }

  const span = SPAN_MS[key as PresetRangeKey];
  const end = now;
  const start = now - span;
  return {
    span,
    start,
    end,
    prevStart: start - span,
    prevEnd: start,
  };
}

export interface Delta {
  text: string;
  dir: 'up' | 'down' | 'neutral';
}

export function pctDelta(curr: number, prev: number): Delta {
  if (prev === 0) {
    return curr > 0 ? { text: 'new', dir: 'up' } : { text: '—', dir: 'neutral' };
  }
  const d = ((curr - prev) / prev) * 100;
  if (Math.abs(d) < 0.05) return { text: '0%', dir: 'neutral' };
  const arrow = d > 0 ? '↑' : '↓';
  return { text: `${arrow} ${Math.abs(d).toFixed(1)}%`, dir: d > 0 ? 'up' : 'down' };
}
