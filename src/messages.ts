export type MovementKeys = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type ClientToServerMessage =
  | { type: 'input'; seq: number; keys: MovementKeys }
  | { type: 'ping'; now: number };

export type ServerToClientMessage =
  | { type: 'welcome'; playerId: string }
  | { type: 'snapshot'; tick: number; players: Array<{ id: string; x: number; y: number }> }
  | { type: 'pong'; now: number };
