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
const COLLISION_EPSILON = 0.0001;

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

    this.resolvePlayerMonsterCollisions(world);
    this.resolveMonsterMonsterCollisions(world);
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
    monster.x = clamp(monster.x + direction.x * monster.speed * dt, MONSTER_COLLISION_RADIUS, WORLD_WIDTH - MONSTER_COLLISION_RADIUS);
    monster.y = clamp(monster.y + direction.y * monster.speed * dt, MONSTER_COLLISION_RADIUS, WORLD_HEIGHT - MONSTER_COLLISION_RADIUS);
  }

  private resolvePlayerMonsterCollisions(world: WorldState): void {
    const minDistance = PLAYER_RADIUS + MONSTER_COLLISION_RADIUS;

    for (const player of world.players.values()) {
      for (const monster of world.monsters.values()) {
        const deltaX = monster.x - player.x;
        const deltaY = monster.y - player.y;
        const dist = Math.hypot(deltaX, deltaY);

        if (dist >= minDistance) continue;

        const overlap = minDistance - dist;
        const normal = getCollisionNormal(deltaX, deltaY, dist, monster.id);

        monster.x = clamp(
          monster.x + normal.x * overlap,
          MONSTER_COLLISION_RADIUS,
          WORLD_WIDTH - MONSTER_COLLISION_RADIUS,
        );
        monster.y = clamp(
          monster.y + normal.y * overlap,
          MONSTER_COLLISION_RADIUS,
          WORLD_HEIGHT - MONSTER_COLLISION_RADIUS,
        );
      }
    }
  }

  private resolveMonsterMonsterCollisions(world: WorldState): void {
    const monsters = [...world.monsters.values()];
    const minDistance = MONSTER_COLLISION_RADIUS * 2;

    for (let i = 0; i < monsters.length; i++) {
      const a = monsters[i];

      for (let j = i + 1; j < monsters.length; j++) {
        const b = monsters[j];
        const deltaX = b.x - a.x;
        const deltaY = b.y - a.y;
        const dist = Math.hypot(deltaX, deltaY);

        if (dist >= minDistance) continue;

        const overlap = minDistance - dist;
        const normal = getCollisionNormal(deltaX, deltaY, dist, `${a.id}:${b.id}`);
        const halfOverlap = overlap / 2;

        a.x = clamp(
          a.x - normal.x * halfOverlap,
          MONSTER_COLLISION_RADIUS,
          WORLD_WIDTH - MONSTER_COLLISION_RADIUS,
        );
        a.y = clamp(
          a.y - normal.y * halfOverlap,
          MONSTER_COLLISION_RADIUS,
          WORLD_HEIGHT - MONSTER_COLLISION_RADIUS,
        );
        b.x = clamp(
          b.x + normal.x * halfOverlap,
          MONSTER_COLLISION_RADIUS,
          WORLD_WIDTH - MONSTER_COLLISION_RADIUS,
        );
        b.y = clamp(
          b.y + normal.y * halfOverlap,
          MONSTER_COLLISION_RADIUS,
          WORLD_HEIGHT - MONSTER_COLLISION_RADIUS,
        );
      }
    }
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

function getCollisionNormal(
  deltaX: number,
  deltaY: number,
  distanceValue: number,
  stableSeed: string,
): { x: number; y: number } {
  if (distanceValue > COLLISION_EPSILON) {
    return { x: deltaX / distanceValue, y: deltaY / distanceValue };
  }

  const angle = hashToUnit(stableSeed) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function hashToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}
