import { GAME_CONFIG } from '../config/gameConfig';
import type { MonsterType } from '../protocol/messages';
import { shortId } from '../utils/ids';
import { clamp, distance, normalize, randomRange } from '../utils/math';
import {
  PLAYER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type MonsterEntity,
  type PlayerEntity,
  type WorldState,
} from './WorldState';

type MonsterTemplate = {
  type: MonsterType;
  hp: number;
  speed: number;
  detectRange: number;
  loseRange: number;
};

const TEMPLATES: Record<MonsterType, MonsterTemplate> = GAME_CONFIG.monster.templates;
const SPAWN_TYPES: MonsterType[] = ['wild_slime', 'sheep'];
const START_AREA_SHEEP_COUNT = 3;
const MONSTER_COLLISION_RADIUS = 40;

export class MonsterSystem {
  seed(world: WorldState, count: number): void {
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;

    for (let i = 0; i < Math.min(START_AREA_SHEEP_COUNT, count); i++) {
      const monster = this.spawnAt('sheep', centerX + 120 + i * 88, centerY + 80 + i * 48);
      world.monsters.set(monster.id, monster);
    }

    for (let i = START_AREA_SHEEP_COUNT; i < count; i++) {
      const type = SPAWN_TYPES[i % SPAWN_TYPES.length];
      const monster = this.spawn(type);
      world.monsters.set(monster.id, monster);
    }
  }

  update(world: WorldState, dt: number): void {
    for (const monster of world.monsters.values()) {
      this.updateAi(monster, world, dt);
    }
  }

  private updateAi(monster: MonsterEntity, world: WorldState, dt: number): void {
    const target = this.findOrKeepTarget(monster, world);

    if (!target) {
      monster.state = 'idle';
      monster.targetPlayerId = null;
      return;
    }

    monster.targetPlayerId = target.id;
    monster.state = 'chase';

    const direction = normalize(target.x - monster.x, target.y - monster.y);
    const nextX = clamp(
      monster.x + direction.x * monster.speed * dt,
      MONSTER_COLLISION_RADIUS,
      WORLD_WIDTH - MONSTER_COLLISION_RADIUS,
    );
    const nextY = clamp(
      monster.y + direction.y * monster.speed * dt,
      MONSTER_COLLISION_RADIUS,
      WORLD_HEIGHT - MONSTER_COLLISION_RADIUS,
    );

    if (this.canMoveTo(monster, nextX, nextY, world)) {
      monster.x = nextX;
      monster.y = nextY;
    }
  }

  private canMoveTo(monster: MonsterEntity, nextX: number, nextY: number, world: WorldState): boolean {
    for (const player of world.players.values()) {
      if (circlesOverlap(nextX, nextY, MONSTER_COLLISION_RADIUS, player.x, player.y, PLAYER_RADIUS)) {
        return false;
      }
    }

    for (const other of world.monsters.values()) {
      if (other.id === monster.id) continue;

      if (circlesOverlap(
        nextX,
        nextY,
        MONSTER_COLLISION_RADIUS,
        other.x,
        other.y,
        MONSTER_COLLISION_RADIUS,
      )) {
        return false;
      }
    }

    return true;
  }

  private findOrKeepTarget(monster: MonsterEntity, world: WorldState): PlayerEntity | null {
    if (monster.targetPlayerId) {
      const current = world.players.get(monster.targetPlayerId);
      if (current && distance(monster.x, monster.y, current.x, current.y) <= monster.loseRange) {
        return current;
      }
    }

    let closest: PlayerEntity | null = null;
    let closestDist = monster.detectRange;
    for (const player of world.players.values()) {
      const d = distance(monster.x, monster.y, player.x, player.y);
      if (d <= closestDist) {
        closest = player;
        closestDist = d;
      }
    }
    return closest;
  }

  private spawn(type: MonsterType): MonsterEntity {
    return this.spawnAt(
      type,
      randomRange(200, WORLD_WIDTH - 200),
      randomRange(200, WORLD_HEIGHT - 200),
    );
  }

  private spawnAt(type: MonsterType, x: number, y: number): MonsterEntity {
    const template = TEMPLATES[type];
    return {
      id: shortId('mob'),
      type,
      x: clamp(x, MONSTER_COLLISION_RADIUS, WORLD_WIDTH - MONSTER_COLLISION_RADIUS),
      y: clamp(y, MONSTER_COLLISION_RADIUS, WORLD_HEIGHT - MONSTER_COLLISION_RADIUS),
      hp: template.hp,
      maxHp: template.hp,
      state: 'idle',
      targetPlayerId: null,
      speed: template.speed,
      detectRange: template.detectRange,
      loseRange: template.loseRange,
    };
  }
}

function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const minDistance = ar + br;
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < minDistance * minDistance;
}
