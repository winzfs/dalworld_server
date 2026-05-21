import { GAME_CONFIG } from '../config/gameConfig';
import type { Facing, MovementKeys } from '../protocol/messages';
import type { BuildingGrid } from '../systems/building/BuildingGrid';
import { getExpToNextLevel, getMaxHpForLevel, getMaxStaminaForLevel, sanitizeCharacterName } from '../systems/player/PlayerProgression';
import { createInitialQuestState } from '../systems/quest/QuestService';
import { clamp, normalize } from '../utils/math';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  PLAYER_RADIUS,
  type PlayerEntity,
  type WorldState,
} from './WorldState';

export const PLAYER_SPEED = GAME_CONFIG.player.speed;
export const PLAYER_MAX_HP = GAME_CONFIG.player.maxHp;
export const PLAYER_MAX_STAMINA = GAME_CONFIG.player.maxStamina;
export const STAMINA_REGEN_PER_SEC = GAME_CONFIG.player.staminaRegenPerSec;
export const STARTER_BUILDING_WOOD = 500;
export const STARTER_BUILDING_STONE = 500;

const TEST_STARTER_INVENTORY = [
  { itemId: 'wood', quantity: STARTER_BUILDING_WOOD },
  { itemId: 'stone', quantity: STARTER_BUILDING_STONE },
  { itemId: 'fiber', quantity: 300 },
  { itemId: 'hide', quantity: 120 },
  { itemId: 'ore_copper', quantity: 180 },
  { itemId: 'ore_iron', quantity: 180 },
  { itemId: 'ore_mana', quantity: 80 },
  { itemId: 'coal', quantity: 160 },
  { itemId: 'crystal', quantity: 80 },
  { itemId: 'ancient_core', quantity: 20 },

  { itemId: 'plank', quantity: 220 },
  { itemId: 'stone_block', quantity: 220 },
  { itemId: 'rope', quantity: 120 },
  { itemId: 'cloth', quantity: 120 },
  { itemId: 'copper_ingot', quantity: 100 },
  { itemId: 'iron_ingot', quantity: 100 },
  { itemId: 'steel_ingot', quantity: 60 },
  { itemId: 'mana_thread', quantity: 80 },
  { itemId: 'circuit_board', quantity: 40 },
  { itemId: 'energy_cell', quantity: 30 },
  { itemId: 'floor_kit', quantity: 80 },
  { itemId: 'wall_kit', quantity: 80 },
  { itemId: 'roof_kit', quantity: 80 },

  { itemId: 'workbench', quantity: 1 },
  { itemId: 'campfire', quantity: 1 },
  { itemId: 'stone_forge', quantity: 1 },
  { itemId: 'loom', quantity: 1 },
  { itemId: 'advanced_workbench', quantity: 1 },
  { itemId: 'alchemy_table', quantity: 1 },
  { itemId: 'energy_assembler', quantity: 1 },

  { itemId: 'wood_pickaxe', quantity: 1 },
  { itemId: 'stone_pickaxe', quantity: 1 },
  { itemId: 'iron_pickaxe', quantity: 1 },
  { itemId: 'steel_pickaxe', quantity: 1 },
  { itemId: 'wood_axe', quantity: 1 },
  { itemId: 'stone_axe', quantity: 1 },
  { itemId: 'iron_axe', quantity: 1 },
  { itemId: 'wood_sword', quantity: 1 },
  { itemId: 'stone_spear', quantity: 1 },
  { itemId: 'iron_sword', quantity: 1 },
  { itemId: 'steel_blade', quantity: 1 },
  { itemId: 'basic_bow', quantity: 1 },
  { itemId: 'hunter_bow', quantity: 1 },
  { itemId: 'cloth_armor', quantity: 1 },
  { itemId: 'hide_armor', quantity: 1 },
  { itemId: 'iron_armor', quantity: 1 },
  { itemId: 'explorer_pack', quantity: 1 },
  { itemId: 'glider', quantity: 1 },

  { itemId: 'torch', quantity: 50 },
  { itemId: 'healing_salve', quantity: 50 },
  { itemId: 'stamina_food', quantity: 50 },
  { itemId: 'mana_potion', quantity: 30 },
  { itemId: 'capture_orb_basic', quantity: 50 },
  { itemId: 'capture_orb_refined', quantity: 30 },
  { itemId: 'capture_orb_elite', quantity: 15 },
] as const;

export function createPlayer(id: string, characterName?: string): PlayerEntity {
  const level = 1;
  const maxHp = getMaxHpForLevel(level);
  const maxStamina = getMaxStaminaForLevel(level);

  return {
    id,
    characterName: sanitizeCharacterName(characterName),
    level,
    exp: 0,
    expToNextLevel: getExpToNextLevel(level),
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    cellX: 0,
    cellY: 0,
    hp: maxHp,
    maxHp,
    stamina: maxStamina,
    maxStamina,
    facing: 'down',
    lastInputSeq: 0,
    inventory: { wood: STARTER_BUILDING_WOOD, stone: STARTER_BUILDING_STONE },
    inventoryItems: TEST_STARTER_INVENTORY.map((stack) => ({ ...stack })),
    questState: createInitialQuestState(),
    input: { up: false, down: false, left: false, right: false },
    nextGatherAt: 0,
    nextAttackAt: 0,
    respawnAt: 0,
  };
}

export function applyInput(
  player: PlayerEntity,
  seq: number,
  keys: MovementKeys,
  facing: Facing | undefined,
): void {
  if (seq <= player.lastInputSeq) return;
  player.lastInputSeq = seq;
  if (player.respawnAt > 0) {
    player.input = { up: false, down: false, right: false, left: false };
    return;
  }
  player.input = {
    up: keys.up === true,
    down: keys.down === true,
    left: keys.left === true,
    right: keys.right === true,
  };
  if (facing) player.facing = facing;
}

export type PlayerSystemUpdateOptions = {
  buildingGrid?: BuildingGrid;
  nowMs?: number;
};

export class PlayerSystem {
  update(world: WorldState, dt: number, options: PlayerSystemUpdateOptions = {}): void {
    const nowMs = options.nowMs ?? Date.now();
    for (const player of world.players.values()) {
      this.updateDeathState(player, nowMs);
      if (player.respawnAt > 0) continue;
      this.movePlayer(player, dt, options.buildingGrid);
      this.regenerate(player, dt);
    }
  }

  private updateDeathState(player: PlayerEntity, nowMs: number): void {
    if (player.hp <= 0 && player.respawnAt === 0) {
      player.hp = 0;
      player.input = { up: false, down: false, right: false, left: false };
      player.respawnAt = nowMs + GAME_CONFIG.player.respawnMs;
      return;
    }

    if (player.respawnAt > 0 && nowMs >= player.respawnAt) {
      player.x = WORLD_WIDTH / 2;
      player.y = WORLD_HEIGHT / 2;
      player.cellX = 0;
      player.cellY = 0;
      player.hp = player.maxHp;
      player.stamina = player.maxStamina;
      player.input = { up: false, down: false, right: false, left: false };
      player.nextAttackAt = 0;
      player.nextGatherAt = 0;
      player.respawnAt = 0;
    }
  }

  private movePlayer(player: PlayerEntity, dt: number, buildingGrid?: BuildingGrid): void {
    let dx = 0;
    let dy = 0;
    if (player.input.left) dx -= 1;
    if (player.input.right) dx += 1;
    if (player.input.up) dy -= 1;
    if (player.input.down) dy += 1;

    if (dx === 0 && dy === 0) return;

    const direction = normalize(dx, dy);
    const nextX = clamp(player.x + direction.x * PLAYER_SPEED * dt, PLAYER_RADIUS, WORLD_WIDTH - PLAYER_RADIUS);
    const nextY = clamp(player.y + direction.y * PLAYER_SPEED * dt, PLAYER_RADIUS, WORLD_HEIGHT - PLAYER_RADIUS);

    if (this.canOccupy(nextX, player.y, buildingGrid)) {
      player.x = nextX;
    }

    if (this.canOccupy(player.x, nextY, buildingGrid)) {
      player.y = nextY;
    }

    if (Math.abs(direction.x) > Math.abs(direction.y)) {
      player.facing = direction.x > 0 ? 'right' : 'left';
    } else {
      player.facing = direction.y > 0 ? 'down' : 'up';
    }
  }

  private canOccupy(x: number, y: number, buildingGrid?: BuildingGrid): boolean {
    if (!buildingGrid) {
      return true;
    }

    return buildingGrid.canOccupyWorldCircle(x, y, PLAYER_RADIUS);
  }

  private regenerate(player: PlayerEntity, dt: number): void {
    if (player.stamina < player.maxStamina) {
      player.stamina = Math.min(player.maxStamina, player.stamina + STAMINA_REGEN_PER_SEC * dt);
    }
  }
}
