CREATE TABLE IF NOT EXISTS player_progression (
  player_id TEXT PRIMARY KEY NOT NULL,
  character_name TEXT NOT NULL DEFAULT 'Dale',
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  exp_to_next_level INTEGER NOT NULL DEFAULT 100,
  max_hp INTEGER NOT NULL DEFAULT 100,
  max_stamina INTEGER NOT NULL DEFAULT 100,
  hp REAL NOT NULL DEFAULT 100,
  stamina REAL NOT NULL DEFAULT 100,
  inventory_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_player_progression_updated_at
  ON player_progression(updated_at);
