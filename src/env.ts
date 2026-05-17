import type { GameRoom } from './rooms/GameRoom';

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  DB: D1Database;
}

// Re-export so consumers can `import type { Env } from './env'` without leaking the room module.
export type { GameRoom };
