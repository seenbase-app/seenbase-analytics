import type { DbEnv } from '@seenbase-analytics/db';

export interface Env extends DbEnv {
  IP_HASH_KEY: string;
  RETENTION_DAYS?: string;
}
