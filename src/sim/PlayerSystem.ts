import { GAME_CONFIG } from '../config/gameConfig';
import type { Facing, MovementKeys } from '../protocol/messages';
import type { BuildingGrid } from '../systems/building/BuildingGrid';
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

export function createPlayer(id: string): PlayerEntity {
  return {
    id,
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    cellX: 0,
    cellY: 0,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    stamina: PLAYER_MAX_STAMINA,
    maxStamina: PLAYER_MAX_STAMINA,
    facing: 'down',
    lastInputSeq: 0,
    inventory: { wood: 0, stone: 0 },
    input: { up: false, down: false, left: false, right: false },
    nextGatherAt: 0,
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
};

export class PlayerSystem {
  update(world: WorldState, dt: number, options: PlayerSystemUpdateOptions = {}): void {
    for (const player of world.players.values()) {
      this.movePlayer(player, dt, options.buildingGrid);
      this.regenerate(player, dt);
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
