import { DurableObject } from 'cloudflare:workers';
import type { ClientToServerMessage, ServerToClientMessage, MovementKeys } from './messages';

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  DB: D1Database;
}

type PlayerState = {
  id: string;
  x: number;
  y: number;
  input: MovementKeys;
};

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const PLAYER_SIZE = 36;
const SERVER_SPEED = 220;
const TICK_RATE = 20;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      // 초기 버전은 단일 월드 룸. 이후 shard/worldId/partyId 기준으로 분리 가능.
      const id = env.GAME_ROOM.idFromName('main-world');
      return env.GAME_ROOM.get(id).fetch(request);
    }

    return new Response('dalworld server is running', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};

export class GameRoom extends DurableObject<Env> {
  private sessions = new Map<WebSocket, string>();
  private players = new Map<string, PlayerState>();
  private tick = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const playerId = crypto.randomUUID();
    this.sessions.set(server, playerId);
    this.players.set(playerId, {
      id: playerId,
      x: WORLD_WIDTH / 2 - PLAYER_SIZE / 2,
      y: WORLD_HEIGHT / 2 - PLAYER_SIZE / 2,
      input: { up: false, down: false, left: false, right: false },
    });

    this.send(server, { type: 'welcome', playerId });
    this.ensureLoop();

    server.addEventListener('message', (event) => this.handleMessage(server, event.data));
    server.addEventListener('close', () => this.closeSession(server));
    server.addEventListener('error', () => this.closeSession(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleMessage(socket: WebSocket, raw: string | ArrayBuffer): void {
    if (typeof raw !== 'string') return;

    let message: ClientToServerMessage;
    try {
      message = JSON.parse(raw) as ClientToServerMessage;
    } catch {
      return;
    }

    const playerId = this.sessions.get(socket);
    if (!playerId) return;

    if (message.type === 'ping') {
      this.send(socket, { type: 'pong', now: message.now });
      return;
    }

    if (message.type === 'input') {
      const player = this.players.get(playerId);
      if (!player) return;
      player.input = sanitizeKeys(message.keys);
    }
  }

  private ensureLoop(): void {
    if (this.intervalId !== null) return;

    this.intervalId = setInterval(() => {
      this.update(1 / TICK_RATE);
      this.broadcastSnapshot();

      if (this.sessions.size === 0 && this.intervalId !== null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }, 1000 / TICK_RATE);
  }

  private update(dt: number): void {
    this.tick += 1;

    for (const player of this.players.values()) {
      let dx = 0;
      let dy = 0;

      if (player.input.left) dx -= 1;
      if (player.input.right) dx += 1;
      if (player.input.up) dy -= 1;
      if (player.input.down) dy += 1;

      if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        dx /= length;
        dy /= length;
      }

      player.x = clamp(player.x + dx * SERVER_SPEED * dt, 0, WORLD_WIDTH - PLAYER_SIZE);
      player.y = clamp(player.y + dy * SERVER_SPEED * dt, 0, WORLD_HEIGHT - PLAYER_SIZE);
    }
  }

  private broadcastSnapshot(): void {
    const message: ServerToClientMessage = {
      type: 'snapshot',
      tick: this.tick,
      players: [...this.players.values()].map(({ id, x, y }) => ({ id, x, y })),
    };

    const payload = JSON.stringify(message);
    for (const socket of this.sessions.keys()) {
      try {
        socket.send(payload);
      } catch {
        this.closeSession(socket);
      }
    }
  }

  private send(socket: WebSocket, message: ServerToClientMessage): void {
    socket.send(JSON.stringify(message));
  }

  private closeSession(socket: WebSocket): void {
    const playerId = this.sessions.get(socket);
    this.sessions.delete(socket);

    if (playerId) {
      this.players.delete(playerId);
    }

    try {
      socket.close(1000, 'Session closed');
    } catch {
      // 이미 닫힌 소켓은 무시한다.
    }
  }
}

function sanitizeKeys(keys: MovementKeys): MovementKeys {
  return {
    up: keys.up === true,
    down: keys.down === true,
    left: keys.left === true,
    right: keys.right === true,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
