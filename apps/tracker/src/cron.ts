import type { Env } from './env';

const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const CLEANUP_BATCH = 5000;
const CLEANUP_MAX_BATCHES = 20;

export async function handleCron(env: Env): Promise<void> {
  const db = env.DB;

  const state = await db
    .prepare("SELECT last_id FROM cron_state WHERE k = 'aggregator'")
    .first<{ last_id: number }>();
  const lastId = state?.last_id ?? 0;

  const maxRow = await db
    .prepare('SELECT MAX(id) AS max_id FROM events WHERE id > ?')
    .bind(lastId)
    .first<{ max_id: number | null }>();
  const maxId = maxRow?.max_id;

  if (maxId == null) return;

  const aggregate = db
    .prepare(
      `INSERT INTO aggregates (pixel_id, bucket, hits, uniques, bots)
       SELECT
         pixel_id,
         (created / ${HOUR_MS}) * ${HOUR_MS} AS bucket,
         COUNT(*)                AS hits,
         COUNT(DISTINCT ip_hash) AS uniques,
         SUM(is_bot)             AS bots
       FROM events
       WHERE id > ? AND id <= ?
       GROUP BY pixel_id, (created / ${HOUR_MS}) * ${HOUR_MS}
       ON CONFLICT(pixel_id, bucket) DO UPDATE SET
         hits = hits + excluded.hits,
         bots = bots + excluded.bots`,
    )
    .bind(lastId, maxId);

  const recomputeUniques = db
    .prepare(
      `UPDATE aggregates SET uniques = (
         SELECT COUNT(DISTINCT e.ip_hash) FROM events e
          WHERE e.pixel_id = aggregates.pixel_id
            AND e.created >= aggregates.bucket
            AND e.created <  aggregates.bucket + ${HOUR_MS}
       )
       WHERE (pixel_id, bucket) IN (
         SELECT pixel_id, (created / ${HOUR_MS}) * ${HOUR_MS}
           FROM events WHERE id > ? AND id <= ?
       )`,
    )
    .bind(lastId, maxId);

  const advanceCursor = db
    .prepare(
      `INSERT INTO cron_state (k, last_id) VALUES ('aggregator', ?)
       ON CONFLICT(k) DO UPDATE SET last_id = excluded.last_id`,
    )
    .bind(maxId);

  await db.batch([aggregate, recomputeUniques, advanceCursor]);
}

export async function handleRetention(env: Env): Promise<void> {
  if (!env.RETENTION_DAYS) {
    console.error('RETENTION_DAYS configuration error: missing RETENTION_DAYS environment variable');
    return;
  }

  const days = Number(env.RETENTION_DAYS);
  if (!Number.isInteger(days)) {
    console.error('RETENTION_DAYS configuration error: RETENTION_DAYS must be an integer');
    return;
  }

  if (days === -1) {
    // Retention cleanup disabled
    return;
  }

  if (days < 1 || days > 3650) {
    console.error('RETENTION_DAYS configuration error: RETENTION_DAYS must be -1 or between 1 and 3650');
    return;
  }

  const db = env.DB;
  const now = Date.now();
  const cutoff = now - days * DAY_MS;

  const state = await db
    .prepare("SELECT last_id FROM cron_state WHERE k = 'aggregator'")
    .first<{ last_id: number }>();
  const lastId = state?.last_id ?? 0;

  for (let i = 0; i < CLEANUP_MAX_BATCHES; i++) {
    const res = await db
      .prepare(
        `DELETE FROM events WHERE id IN (
           SELECT e.id
             FROM events e
            WHERE e.created < ?
              AND e.id <= ?
            LIMIT ${CLEANUP_BATCH}
         )`,
      )
      .bind(cutoff, lastId)
      .run();

    const deleted = res.meta?.changes ?? 0;
    if (deleted > 0) {
      console.log(`retention: deleted ${deleted} events (batch ${i + 1})`);
    }
    if (deleted < CLEANUP_BATCH) return;
  }

  console.warn(`retention: hit ${CLEANUP_MAX_BATCHES * CLEANUP_BATCH}-row cap, rest next run`);
}
