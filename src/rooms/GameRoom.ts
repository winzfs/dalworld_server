import { DurableObject } from 'cloudflare:workers';
import { GAME_CONFIG, getPublicGameConfig } from '../config/gameConfig';
import type { Env } from '../env';
import type {
  ClientToServerMessage,
  ServerEvent,
  ServerToClientMessage,
} from '../protocol/messages';
import { PROTOCOL_VERSION } from '../protocol/version';
import { GameSimulation } from '../sim/GameSimulation';
import { applyInput, createPlayer } from '../sim/PlayerSystem';
import { PLAYER_RADIUS, WORLD_HEIGHT, WORLD_WIDTH, type PlayerEntity } from '../sim/WorldState';
import { BuildingGrid } from '../systems/building/BuildingGrid';
import { BuildingService } from '../systems/building/BuildingService';
import { CraftingService } from '../systems/crafting/CraftingService';
import { InventoryService } from '../systems/inventory/InventoryService';
import { InventoryStore, type InventorySnapshot } from '../systems/inventory/InventoryStore';
import { clamp } from '../utils/math';
import { canCircleOccupyCell } from '../worldMap/runtimeWorldMap';
import type { GameWorldMap } from '../worldMap/types';

const SNAPSHOT_RATE = GAME_CONFIG.world.snapshotRate;
const RATE_LIMIT_PER_SECOND = GAME_CONFIG.network.rateLimitPerSecond;
const MAP_STORAGE_KEY = 'world:default-map';
const BUILDING_GRID_WIDTH = 256;
const BUILDING_GRID_HEIGHT = 256;
const BUILDING_GRID_MAX_Z = 8;

type RateLimitEntry = { count: number; resetAt: number };

export class GameRoom extends DurableObject<Env> {
  private readonly simulation = new GameSimulation();
  private readonly sessions = new Map<WebSocket, string>();
  private readonly rateLimits = new Map<WebSocket, RateLimitEntry>();
  private readonly buildingGrid = new BuildingGrid({
    width: BUILDING_GRID_WIDTH,
    height: BUILDING_GRID_HEIGHT,
    maxZ: BUILDING_GRID_MAX_Z,
  });
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastStepAt = Date.now();
  private worldMap: GameWorldMap | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/maps/default') {
      if (request.method === 'GET') {
        const map = await this.ctx.storage.get<GameWorldMap>(MAP_STORAGE_KEY);
        this.setWorldMap(map ?? null);
        return Response.json(map ?? null);
      }

      if (request.method === 'PUT') {
        const map = await request.json<GameWorldMap>();
        await this.ctx.storage.put(MAP_STORAGE_KEY, map);
        this.setWorldMap(map);
        return Response.json({ ok: true });
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const playerId = getStablePlayerId(url);
    this.sessions.set(server, playerId);
    this.simulation.world.players.set(playerId, createPlayer(playerId));

    const now = Date.now();
    const publicConfig = getPublicGameConfig();

    if (!this.worldMap) {
      this.setWorldMap((await this.ctx.storage.get<GameWorldMap>(MAP_STORAGE_KEY)) ?? null);
    }

    this.send(server, {
      type: 'welcome',
      protocolVersion: PROTOCOL_VERSION,
      playerId,
      world: publicConfig.world,
      gameplay: publicConfig.gameplay,
      map: this.worldMap,
      serverTime: now,
    });

    this.send(server, {
      type: 'BUILD_SNAPSHOT',
      snapshot: this.buildingGrid.toSnapshot(),
    });

    this.simulation.world.pushEvent({ type: 'player_joined', playerId });
    this.ensureLoop();

    server.addEventListener('message', (event) => this.handleMessage(server, event.data));
    server.addEventListener('close', () => this.closeSession(server));
    server.addEventListener('error', () => this.closeSession(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  private setWorldMap(map: GameWorldMap | null): void {
    this.worldMap = map;
    this.simulation.resources.seedFromWorldMap(this.simulation.world, map);
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
      case 'BUILD_PLACE_REQUEST':
      case 'BUILD_UPDATE_REQUEST':
      case 'BUILD_REMOVE_REQUEST':
      case 'BUILD_DOOR_TOGGLE_REQUEST':
        this.handleBuildingMessage(socket, playerId, message);
        return;
      case 'CRAFT_REQUEST':
        this.handleCraftingMessage(socket, playerId, message.requestId, message.recipeId);
        return;
      case 'input': {
        applyInput(player, message.seq, message.keys, message.facing);

        if (Number.isFinite(message.cellX)) {
          player.cellX = Math.trunc(message.cellX ?? player.cellX);
        }
        if (Number.isFinite(message.cellY)) {
          player.cellY = Math.trunc(message.cellY ?? player.cellY);
        }

        if (Number.isFinite(message.clientX) && Number.isFinite(message.clientY)) {
          const cellSize = this.worldMap?.cellSize ?? WORLD_WIDTH;
          const nextX = clamp(message.clientX ?? player.x, 0, cellSize);
          const nextY = clamp(message.clientY ?? player.y, 0, cellSize);

          if (
            canCircleOccupyCell(this.worldMap, player.cellX, player.cellY, nextX, nextY, PLAYER_RADIUS) &&
            this.buildingGrid.canOccupyWorldCircle(nextX, nextY, PLAYER_RADIUS)
          ) {
            player.x = nextX;
            player.y = nextY;
          }

          player.input = { up: false, down: false, right: false, left: false };
        }

        return;
      }
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

  private handleBuildingMessage(
    socket: WebSocket,
    playerId: string,
    message: ClientToServerMessage,
  ): void {
    const player = this.simulation.world.players.get(playerId);
    if (!player) return;

    const store = this.createInventoryStore(playerId, player);
    const service = new BuildingService({
      grid: this.buildingGrid,
      getInventory: () => store,
      createEntityId: () => crypto.randomUUID(),
      now: () => Date.now(),
    });

    const result = message.type === 'BUILD_PLACE_REQUEST'
      ? service.place(playerId, message)
      : message.type === 'BUILD_UPDATE_REQUEST'
        ? service.update(playerId, message)
        : message.type === 'BUILD_REMOVE_REQUEST'
          ? service.remove(playerId, message)
          : service.toggleDoor(playerId, message);

    for (const event of result.events) {
      if (event.type === 'INVENTORY_SNAPSHOT') {
        this.applyInventorySnapshot(player, event);
      }

      if (event.type === 'BUILD_REJECTED' || event.type === 'INVENTORY_SNAPSHOT') {
        this.send(socket, event);
      } else {
        this.broadcast(event);
      }
    }
  }

  private handleCraftingMessage(
    socket: WebSocket,
    playerId: string,
    requestId: string,
    recipeId: string,
  ): void {
    const player = this.simulation.world.players.get(playerId);
    if (!player) return;

    const store = this.createInventoryStore(playerId, player);
    const inventory = new InventoryService({ getStore: () => store });
    const crafting = new CraftingService({ inventory });
    const result = crafting.craft(playerId, recipeId);

    if (!result.ok) {
      this.send(socket, { type: 'CRAFT_REJECTED', requestId, reason: result.reason });
      return;
    }

    const snapshot = store.toSnapshot();
    this.applyInventorySnapshot(player, snapshot);
    this.send(socket, {
      type: 'CRAFT_COMPLETED',
      requestId,
      recipeId: result.recipe.id,
      inventory: snapshot,
    });
  }

  private createInventoryStore(playerId: string, player: PlayerEntity): InventoryStore {
    return new InventoryStore(playerId, player.inventoryItems);
  }

  private applyInventorySnapshot(player: PlayerEntity, snapshot: InventorySnapshot): void {
    player.inventoryItems = snapshot.items;
    player.inventory.wood = snapshot.items.find((item) => item.itemId === 'wood')?.quantity ?? 0;
    player.inventory.stone = snapshot.items.find((item) => item.itemId === 'stone')?.quantity ?? 0;
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

      this.simulation.step(dt, now, { buildingGrid: this.buildingGrid });
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

  private broadcast(message: ServerToClientMessage): void {
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

function getStablePlayerId(url: URL): string {
  const clientId = url.searchParams.get('clientId');
  if (clientId && /^client_[0-9a-fA-F-]{36}$/.test(clientId)) return clientId;
  return `session_${crypto.randomUUID()}`;
}

export type { ServerEvent };
