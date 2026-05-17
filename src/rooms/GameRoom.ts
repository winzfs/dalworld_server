import { DurableObject } from 'cloudflare:workers';
import { GAME_CONFIG, getPublicGameConfig } from '../config/gameConfig';
import type { Env } from '../env';
import type {
  ClientToServerMessage,
  ServerEvent,
  ServerToClientMessage,
} from '../protocol/messages';
import { GameSimulation } from '../sim/GameSimulation';
import { applyInput, createPlayer } from '../sim/PlayerSystem';

const SNAPSHOT_RATE = GAME_CONFIG.world.snapshotRate;
const RATE_LIMIT_PER_SECOND = GAME_CONFIG.network.rateLimitPerSecond;

type RateLimitEntry = { count: number; resetAt: number };

export class GameRoom extends DurableObject<Env> {
  private readonly simulation = new GameSimulation();
  private readonly sessions = new Map<WebSocket, string>();
  private readonly rateLimits = new Map<WebSocket, RateLimitEntry>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastStepAt = Date.now();

  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const playerId = crypto.randomUUID();
    this.sessions.set(server, playerId);
    this.simulation.world.players.set(playerId, createPlayer(playerId));

    const now = Date.now();
    const publicConfig = getPublicGameConfig();
    this.send(server, {
      type: 'welcome',
      playerId,
      world: publicConfig.world,
      gameplay: publicConfig.gameplay,
      serverTime: now,
    });

    this.simulation.world.pushEvent({ type: 'player_joined', playerId });
    this.ensureLoop();

    server.addEventListener('message', (event) => this.handleMessage(server, event.data));
    server.addEventListener('close', () => this.closeSession(server));
    server.addEventListener('error', () => this.closeSession(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleMessage(socket: WebSocket, raw: string | ArrayBuffer): void {
    if (typeof raw !== 'string') return;
    if (!this.checkRateLimit(socket)) return;

    let message: ClientToServerMessage;
    try {
      message = JSON.parse(raw) as ClientToServerMessage;
    } catch {
      return;
    }

    const playerId = this.sessions.get(socket);
    if (!playerId) return;
    const player = this.simulation.world.players.get(playerId);
    if (!player) return;

    switch (message.type) {
      case 'ping':
        this.send(socket, { type: 'pong', now: message.now });
        return;
      case 'hello':
        return;
      case 'input':
        applyInput(player, message.seq, message.keys, message.facing);
        return;
      case 'gather': {
        const result = this.simulation.resources.gather(
          this.simulation.world,
          player,
          message.resourceId,
          Date.now(),
        );
        if (result.ok) {
          player.lastInputSeq = Math.max(player.lastInputSeq, message.seq);
        }
        return;
      }
    }
  }

  private checkRateLimit(socket: WebSocket): boolean {
    const now = Date.now();
    let entry = this.rateLimits.get(socket);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + 1000 };
      this.rateLimits.set(socket, entry);
    }
    entry.count += 1;
    return entry.count <= RATE_LIMIT_PER_SECOND;
  }

  private ensureLoop(): void {
    if (this.intervalId !== null) return;
    this.lastStepAt = Date.now();

    this.intervalId = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.25, (now - this.lastStepAt) / 1000);
      this.lastStepAt = now;

      this.simulation.step(dt, now);
      this.broadcastSnapshot(now);
      this.flushEvents(now);

      if (this.sessions.size === 0 && this.intervalId !== null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }, 1000 / SNAPSHOT_RATE);
  }

  private broadcastSnapshot(nowMs: number): void {
    const snapshot = this.simulation.buildSnapshot(nowMs);
    const payload = JSON.stringify(snapshot);
    for (const socket of this.sessions.keys()) {
      try {
        socket.send(payload);
      } catch {
        this.closeSession(socket);
      }
    }
  }

  private flushEvents(nowMs: number): void {
    const events = this.simulation.world.drainEvents();
    if (events.length === 0) return;

    for (const event of events) {
      const message: ServerToClientMessage = { type: 'event', serverTime: nowMs, event };
      const payload = JSON.stringify(message);
      for (const socket of this.sessions.keys()) {
        try {
          socket.send(payload);
        } catch {
          this.closeSession(socket);
        }
      }
    }
  }

  private send(socket: WebSocket, message: ServerToClientMessage): void {
    socket.send(JSON.stringify(message));
  }

  private closeSession(socket: WebSocket): void {
    const playerId = this.sessions.get(socket);
    this.sessions.delete(socket);
    this.rateLimits.delete(socket);

    if (playerId) {
      this.simulation.world.players.delete(playerId);
      this.simulation.world.pushEvent({ type: 'player_left', playerId });
    }

    try {
      socket.close(1000, 'Session closed');
    } catch {
      // socket already closed
    }
  }
}

export type { ServerEvent };
