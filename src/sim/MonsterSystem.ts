import { getMonsterDefinition } from '../systems/monster/MonsterDefinitions';
import type { MonsterType } from '../protocol/messages';
import type { BuildingGrid } from '../systems/building/BuildingGrid';
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

type CollisionCircle = {
  x: number;
  y: number;
  radius: number;
};

export type MonsterSystemUpdateOptions = {
  buildingGrid?: BuildingGrid;
  nowMs?: number;
};

const SPAWN_TYPES: MonsterType[] = ['wild_slime', 'sheep'];
const START_AREA_SHEEP_COUNT = 3;

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

  update(world: WorldState, dt: number, options: MonsterSystemUpdateOptions = {}): void {
    const nowMs = options.nowMs ?? Date.now();
    for (const monster of world.monsters.values()) {
      this.updateAi(monster, world, dt, nowMs, options.buildingGrid);
    }
  }

  private updateAi(monster: MonsterEntity, world: WorldState, dt: number, nowMs: number, buildingGrid?: BuildingGrid): void {
    const definition = getMonsterDefinition(monster.type);
    const target = this.findOrKeepTarget(monster, world);

    if (!target) {
      monster.state = 'idle';
      monster.targetPlayerId = null;
      return;
    }

    monster.targetPlayerId = target.id;

    const targetDistance = distance(monster.x, monster.y, target.x, target.y);
    if (targetDistance <= definition.combat.attackRange) {
      monster.state = 'attack';
      this.tryAttack(monster, target, nowMs, world);
      return;
    }

    monster.state = 'chase';

    const direction = normalize(target.x - monster.x, target.y - monster.y);
    const deltaX = direction.x * monster.speed * dt;
    const deltaY = direction.y * monster.speed * dt;

    const nextX = clamp(
      monster.x + deltaX,
      definition.collision.radius,
      WORLD_WIDTH - definition.collision.radius,
    );

    if (this.canOccupy(monster, nextX, monster.y, world, buildingGrid)) {
      monster.x = nextX;
    }

    const nextY = clamp(
      monster.y + deltaY,
      definition.collision.radius,
      WORLD_HEIGHT - definition.collision.radius,
    );

    if (this.canOccupy(monster, monster.x, nextY, world, buildingGrid)) {
      monster.y = nextY;
    }
  }

  private tryAttack(monster: MonsterEntity, target: PlayerEntity, nowMs: number, world: WorldState): void {
    if (target.hp <= 0 || target.respawnAt > 0) return;
    if (nowMs < monster.nextAttackAt) return;

    const definition = getMonsterDefinition(monster.type);
    monster.nextAttackAt = nowMs + definition.combat.attackCooldownMs;

    const damage = definition.combat.attackDamage;
    target.hp = Math.max(0, target.hp - damage);
    world.pushEvent({
      type: 'combat_hit',
      requestId: `monster:${monster.id}:${nowMs}`,
      attackerId: monster.id,
      targetId: target.id,
      targetType: 'player',
      damage,
      hpRemaining: target.hp,
      maxHp: target.maxHp,
      x: target.x,
      y: target.y,
    });
  }

  private canOccupy(monster: MonsterEntity, x: number, y: number, world: WorldState, buildingGrid?: BuildingGrid): boolean {
    const selfCircle = getCollisionCircle(monster.type, x, y);

    if (buildingGrid && !buildingGrid.canOccupyWorldCircle(selfCircle.x, selfCircle.y, selfCircle.radius)) {
      return false;
    }

    for (const player of world.players.values()) {
      if (player.respawnAt > 0) continue;
      if (circlesOverlap(selfCircle.x, selfCircle.y, selfCircle.radius, player.x, player.y, PLAYER_RADIUS)) {
        return false;
      }
    }

    for (const other of world.monsters.values()) {
      if (other.id === monster.id) continue;

      const otherCircle = getCollisionCircle(other.type, other.x, other.y);

      if (
        circlesOverlap(
          selfCircle.x,
          selfCircle.y,
          selfCircle.radius,
          otherCircle.x,
          otherCircle.y,
          otherCircle.radius,
        )
      ) {
        return false;
      }
    }

    return true;
  }

  private findOrKeepTarget(monster: MonsterEntity, world: WorldState): PlayerEntity | null {
    if (monster.targetPlayerId) {
      const current = world.players.get(monster.targetPlayerId);
      if (current && current.hp > 0 && current.respawnAt === 0 && distance(monster.x, monster.y, current.x, current.y) <= monster.loseRange) {
        return current;
      }
    }

    let closest: PlayerEntity | null = null;
    let closestDist = monster.detectRange;

    for (const player of world.players.values()) {
      if (player.hp <= 0 || player.respawnAt > 0) continue;
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
    const definition = getMonsterDefinition(type);

    return {
      id: shortId('mob'),
      type,
      x: clamp(x, definition.collision.radius, WORLD_WIDTH - definition.collision.radius),
      y: clamp(y, definition.collision.radius, WORLD_HEIGHT - definition.collision.radius),
      hp: definition.maxHp,
      maxHp: definition.maxHp,
      state: 'idle',
      targetPlayerId: null,
      speed: definition.moveSpeed,
      detectRange: definition.ai.detectRange,
      loseRange: definition.ai.loseRange,
      nextAttackAt: 0,
    };
  }
}

function getCollisionCircle(type: MonsterType, x: number, y: number): CollisionCircle {
  const collision = getMonsterDefinition(type).collision;

  return {
    x: x + collision.offsetX,
    y: y + collision.offsetY,
    radius: collision.radius,
  };
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
