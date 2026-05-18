import { GAME_CONFIG } from '../config/gameConfig';
import type {
  Facing,
  Inventory,
  MonsterType,
  MovementKeys,
  PlayerSnapshot,
  ResourceType,
  MonsterStateName,
  ServerEvent,
} from '../protocol/messages';

export const WORLD_WIDTH = GAME_CONFIG.world.width;
export const WORLD_HEIGHT = GAME_CONFIG.world.height;
export const TICK_RATE = GAME_CONFIG.world.tickRate;
export const PLAYER_RADIUS = GAME_CONFIG.player.radius;

export type PlayerEntity = {
  id: string;
  x: number;
  y: number;
  cellX: number;
  cellY: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  facing: Facing;
  lastInputSeq: number;
  inventory: Inventory;
  input: MovementKeys;
  /** epoch ms when next gather is allowed */
  nextGatherAt: number;
};

export type ResourceEntity = {
  id: string;
  type: ResourceType;
  x: number;
  y: number;
  cellX: number;
  cellY: number;
  hp: number;
  maxHp: number;
  /** 0 = alive, otherwise epoch ms when it respawns */
  respawnAt: number;
};

export type MonsterEntity = {
  id: string;
  type: MonsterType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: MonsterStateName;
  targetPlayerId: string | null;
  speed: number;
  detectRange: number;
  loseRange: number;
};

export class WorldState {
  readonly players = new Map<string, PlayerEntity>();
  readonly resources = new Map<string, ResourceEntity>();
  readonly monsters = new Map<string, MonsterEntity>();
  readonly events: ServerEvent[] = [];
  tick = 0;
  startedAt = Date.now();

  pushEvent(event: ServerEvent): void {
    this.events.push(event);
  }

  drainEvents(): ServerEvent[] {
    if (this.events.length === 0) return [];
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  toPlayerSnapshots(): PlayerSnapshot[] {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      cellX: p.cellX,
      cellY: p.cellY,
      hp: p.hp,
      maxHp: p.maxHp,
      stamina: p.stamina,
      maxStamina: p.maxStamina,
      facing: p.facing,
      lastInputSeq: p.lastInputSeq,
      inventory: { ...p.inventory },
    }));
  }
}
