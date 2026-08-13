-- Initial migration for SeenBase Analytics

CREATE TABLE pixels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  deleted_at INTEGER
);

CREATE TABLE domains (
  id INTEGER PRIMARY KEY,
  hostname TEXT UNIQUE NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created INTEGER NOT NULL
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  pixel_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  ip_hash TEXT,
  ua TEXT,
  referer TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  asn TEXT,
  as_org TEXT,
  lang TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0 CHECK(is_bot IN (0,1)),
  domain_id INTEGER REFERENCES domains(id),
  meta TEXT
);

CREATE INDEX idx_events_drill ON events(pixel_id, id DESC);
CREATE INDEX idx_events_cursor ON events(id);
CREATE INDEX idx_events_agg ON events(pixel_id, created);

CREATE TABLE aggregates (
  pixel_id TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  uniques INTEGER NOT NULL DEFAULT 0,
  bots INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(pixel_id, bucket)
);

CREATE TABLE cron_state (
  k TEXT PRIMARY KEY,
  last_id INTEGER NOT NULL DEFAULT 0
);

INSERT INTO cron_state (k, last_id) VALUES ('aggregator', 0);
