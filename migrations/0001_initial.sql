-- dalworld initial schema.
-- 실시간 월드 상태는 Durable Object 메모리를 우선 사용하고,
-- D1은 계정/캐릭터/영구 저장 데이터에 사용한다.

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hp INTEGER NOT NULL DEFAULT 100,
  max_hp INTEGER NOT NULL DEFAULT 100,
  stamina INTEGER NOT NULL DEFAULT 100,
  max_stamina INTEGER NOT NULL DEFAULT 100,
  last_x REAL NOT NULL DEFAULT 1500,
  last_y REAL NOT NULL DEFAULT 1500,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS players_updated_at_idx ON players (updated_at);

CREATE TABLE IF NOT EXISTS player_inventory (
  player_id TEXT NOT NULL,
  item TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (player_id, item),
  FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS world_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  world_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS world_snapshots_world_idx
  ON world_snapshots (world_id, created_at DESC);
