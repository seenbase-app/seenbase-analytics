export interface PixelRow {
  id: string;
  name: string;
  created: number;
  active: number;
  deleted_at: number | null;
}

export interface DomainRow {
  id: number;
  hostname: string;
  active: number;
  created: number;
}

export interface EventRow {
  id: number;
  pixel_id: string;
  created: number;
  ip_hash: string | null;
  ua: string | null;
  referer: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  asn: string | null;
  as_org: string | null;
  lang: string | null;
  is_bot: number;
  domain_id: number | null;
  meta: string | null;
}

export interface AggregateRow {
  pixel_id: string;
  bucket: number;
  hits: number;
  uniques: number;
  bots: number;
}

export interface CronStateRow {
  k: string;
  last_id: number;
}
