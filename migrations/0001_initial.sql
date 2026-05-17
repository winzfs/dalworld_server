CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
