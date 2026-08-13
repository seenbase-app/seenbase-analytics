-- Seed file for local preview data (idempotent)

INSERT OR IGNORE INTO pixels (id, name, created, active, deleted_at)
VALUES (
  'sb23456789',
  'Demo Pixel',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000 - 86400000,
  1,
  NULL
);

INSERT OR IGNORE INTO domains (id, hostname, active, created)
VALUES (
  1,
  '127.0.0.1',
  1,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000 - 86400000
);

-- Insert synthetic events
INSERT OR IGNORE INTO events (
  id, pixel_id, created, ip_hash, ua, referer, country, city, region, asn, as_org, lang, is_bot, domain_id, meta
) VALUES 
(
  1,
  'sb23456789',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000 - 3600000,
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'https://example.com',
  'US',
  'San Francisco',
  'CA',
  'AS13335',
  'Cloudflare, Inc.',
  'en-US',
  0,
  1,
  '{"utm_source":"github","utm_medium":"cpc","utm_campaign":"launch"}'
),
(
  2,
  'sb23456789',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000 - 1800000,
  '88d4266ec4e47335d57b47cc468ee601972edd9702f45dd926a146fd00808075',
  'Googlebot/2.1 (+http://www.google.com/bot.html)',
  'https://google.com',
  'US',
  'Mountain View',
  'CA',
  'AS15169',
  'Google LLC',
  'en',
  1,
  1,
  '{}'
);

-- Insert hourly aggregate snapshot
INSERT OR IGNORE INTO aggregates (pixel_id, bucket, hits, uniques, bots)
VALUES (
  'sb23456789',
  ((CAST(strftime('%s', 'now') AS INTEGER) * 1000) / 3600000) * 3600000 - 3600000,
  2,
  1,
  1
);
