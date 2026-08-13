import type { Env } from './env';
import { GIF_1X1, detectBot, hashVisitorIP, normalizeReferer, extractMeta } from './utils';

const ANTI_CACHE = {
  'Content-Type': 'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export function handlePixel(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  pixelId: string,
): Response {
  const url = new URL(request.url);
  const now = Date.now();

  const ua = request.headers.get('User-Agent')?.slice(0, 500) ?? null;
  const referer = normalizeReferer(request.headers.get('Referer'));
  const lang = request.headers.get('Accept-Language')?.split(',')[0]?.split(';')[0]?.trim().slice(0, 35) ?? null;
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const country = request.cf?.country ?? null;
  const city = request.cf?.city ?? null;
  const region = request.cf?.region ?? null;
  const asn = request.cf?.asn != null ? `AS${request.cf.asn}` : null;
  const asOrg = request.cf?.asOrganization ?? null;
  const isBotVal = detectBot(ua) ? 1 : 0;
  const meta = extractMeta(url);

  ctx.waitUntil((async () => {
    if (!ip) return;

    const ipHash = await hashVisitorIP(ip, env.IP_HASH_KEY, now);
    if (!ipHash) {
      // Configuration error already logged in hashVisitorIP
      return;
    }

    let lookupResult: {
      pixel_id: string;
      pixel_active: number;
      pixel_deleted_at: number | null;
      domain_id: number | null;
    } | null = null;
    let lookupFailed = false;

    try {
      lookupResult = await env.DB.prepare(
        `SELECT p.id AS pixel_id, p.active AS pixel_active, p.deleted_at AS pixel_deleted_at, d.id AS domain_id
         FROM pixels p
         LEFT JOIN domains d ON d.hostname = ? AND d.active = 1
         WHERE p.id = ?`
      )
        .bind(url.hostname, pixelId)
        .first();
    } catch (e) {
      lookupFailed = true;
      console.error('D1 pixel lookup failed:', e);
    }

    if (!lookupFailed) {
      if (!lookupResult || lookupResult.pixel_active !== 1 || lookupResult.pixel_deleted_at !== null) {
        return;
      }
    }

    const domainId = lookupResult?.domain_id ?? null;

    await env.DB.prepare(
      `INSERT INTO events (pixel_id, created, ip_hash, ua, referer, country, city, region, asn, as_org, lang, is_bot, domain_id, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        pixelId,
        now,
        ipHash,
        ua,
        referer,
        country,
        city,
        region,
        asn,
        asOrg,
        lang,
        isBotVal,
        domainId,
        meta,
      )
      .run()
      .catch(e => console.error('event write failed:', e));
  })());

  return new Response(GIF_1X1, { headers: ANTI_CACHE });
}
