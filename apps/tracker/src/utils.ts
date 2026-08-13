export const GIF_1X1 = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
  0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, // 1×1, GCT flag
  0xff, 0xff, 0xff, 0x00, 0x00, 0x00, // colors: white, black
  0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, // graphic control: transparent=0
  0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // image descriptor
  0x02, 0x02, 0x44, 0x01, 0x00, // LZW image data
  0x3b, // trailer
]);

const BOT_UA_RE = new RegExp(
  [
    'bot', 'crawl', 'spider', 'slurp', 'mediapartners', 'adsbot',
    'facebookexternalhit', 'semrush', 'ahrefs', 'bytespider',
    'curl', 'wget', 'python', 'go-http-client', 'java/', 'okhttp',
    'httpclient', 'node-fetch', 'axios', 'libwww', 'scrapy',
    'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
    'pingdom', 'uptime', 'statuscake', 'lighthouse',
  ].join('|'),
  'i',
);

export function detectBot(ua: string | null): boolean {
  return !ua || BOT_UA_RE.test(ua);
}

export async function hashVisitorIP(
  ip: string,
  key: string,
  timestamp: number = Date.now(),
): Promise<string | null> {
  if (!key || key.length < 32) {
    console.error('IP_HASH_KEY configuration error: key must be >= 32 characters');
    return null;
  }

  const dateStr = new Date(timestamp).toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${dateStr}\0${ip}`);
  const keyBuf = new TextEncoder().encode(key);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function normalizeReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const parsed = new URL(referer);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin.slice(0, 500);
    }
    return referer.slice(0, 500);
  } catch {
    return referer.slice(0, 500);
  }
}

const UTM_FIELDS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
] as const;
const UTM_MAX = 200;

export function extractMeta(url: URL): string | null {
  const meta: Partial<Record<typeof UTM_FIELDS[number], string>> = {};
  for (const field of UTM_FIELDS) {
    const val = url.searchParams.get(field);
    if (val) meta[field] = val.slice(0, UTM_MAX);
  }
  return Object.keys(meta).length ? JSON.stringify(meta) : null;
}
