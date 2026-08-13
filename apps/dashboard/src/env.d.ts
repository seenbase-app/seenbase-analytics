import type { DbEnv } from '@seenbase-analytics/db';

export interface DashboardEnv extends DbEnv {
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  TRACKER_BASE_URL?: string;
}

declare global {
  namespace App {
    interface Locals {
      csrfToken: string;
    }
  }
}

interface ImportMetaEnv {
  readonly ADMIN_PASSWORD?: string;
  readonly SESSION_SECRET?: string;
  readonly TRACKER_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
