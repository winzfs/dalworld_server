import { GAME_CONFIG } from '../config/gameConfig';
import type {
  Facing,
  Inventory,
  ItemType,
  MonsterType,
  MovementKeys,
  PlayerSnapshot,
  ResourceType,
  MonsterStateName,
  ServerEvent,
} from '../protocol/messages';
import type { InventoryItemStack } from '../systems/inventory/InventoryStore';
import { createInitialQuestState, QuestService } from '../systems/quest/QuestService';
import type { PlayerQuestState } from '../systems/quest/QuestTypes';
import type { WorldMapMonsterSpecOverrides, WorldMapSourceRect } from '../worldMap/types';

export const WORLD_WIDTH = GAME_CONFIG.world.width;
export const WORLD_HEIGHT = GAME_CONFIG.world.height;
export const TICK_RATE = GAME_CONFIG.world.tickRate;
export const PLAYER_RADIUS = GAME_CONFIG.player.radius;

export type PlayerEntity = {
  id: string;
  characterName: string;
  level: number;
  exp: number;
  expToNextLevel: number;
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
  /** Legacy resource snapshot used by current HUD/client snapshots. Keep synced with inventoryItems. */
  inventory: Inventory;
  /** Generic inventory stacks used by crafting/building/item systems. */
  inventoryItems: InventoryItemStack[];
  questState: PlayerQuestState;
  input: MovementKeys;
  /** epoch ms when next gather is allowed */
  nextGatherAt: number;
  /** epoch ms when next player attack is allowed */
  nextAttackAt: number;
  /** epoch ms when respawn is allowed. 0 means alive. */
  respawnAt: number;
};

export type ResourceEntity = {
  id: string;
  type: ResourceType;
  /** Center x used for gather targeting and UI anchoring. */
  x: number;
  /** Center y used for gather targeting and UI anchoring. */
  y: number;
  cellX: number;
  cellY: number;
  assetUrl?: string;
  assetScale?: number;
  displayWidth?: number;
  displayHeight?: number;
  sourceRect?: WorldMapSourceRect;
  hp: number;
  maxHp: number;
  drop: ItemType;
  dropAmount: number;
  respawnMs: number;
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
  facing: Facing;
  targetPlayerId: string | null;
  speed: number;
  detectRange: number;
  loseRange: number;
  attackRange: number;
  attackDamage: number;
  attackCooldownMs: number;
  nextAttackAt: number;
  /** Increments only when the server actually applies an attack. */
  attackSeq: number;
  spawnRegionId?: string;
  spawnRuleId?: string;
};

export type MonsterSpawnRegionEntity = {
  id: string;
  cellX: number;
  cellY: number;
  monsterType: MonsterType;
  centerX: number;
  centerY: number;
  radius: number;
  maxAlive: number;
  respawnMs: number;
  spawnsPerMinute: number;
  nextSpawnAt: number;
  spec?: WorldMapMonsterSpecOverrides;
};

export type MonsterSpawnRuleEntity = {
  id: string;
  monsterType: MonsterType;
  scope: 'world' | 'region';
  maxAlive: number;
  spawnsPerMinute: number;
  nextSpawnAt: number;
  spec?: WorldMapMonsterSpecOverrides;
};

export class WorldState {
  readonly players = new Map<string, PlayerEntity>();
  readonly resources = new Map<string, ResourceEntity>();
  readonly monsters = new Map<string, MonsterEntity>();
  readonly monsterSpawnRegions = new Map<string, MonsterSpawnRegionEntity>();
  readonly monsterSpawnRules = new Map<string, MonsterSpawnRuleEntity>();
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
    const quests = new QuestService();
    return [...this.players.values()].map((p) => ({
      id: p.id,
      characterName: p.characterName,
      level: p.level,
      exp: p.exp,
      expToNextLevel: p.expToNextLevel,
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
      inventoryItems: p.inventoryItems.map((item) => ({ ...item })),
      questState: quests.toSnapshot(p.questState ?? createInitialQuestState()),
      alive: p.respawnAt === 0,
      respawnAt: p.respawnAt,
    }));
  }
}