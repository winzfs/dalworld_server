import { getMonsterDefinition } from '../systems/monster/MonsterDefinitions';
import type { MonsterType } from '../protocol/messages';
import type { BuildingGrid } from '../systems/building/BuildingGrid';
import { shortId } from '../utils/ids';
import { clamp, distance, normalize, randomRange } from '../utils/math';
import type { GameWorldMap, WorldMapMonsterSpecOverrides, WorldMapPlacement } from '../worldMap/types';
import { canCircleOccupyWorldMap } from '../worldMap/runtimeWorldMap';
import {
  PLAYER_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type MonsterEntity,
  type MonsterSpawnRegionEntity,
  type MonsterSpawnRuleEntity,
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
const SPAWN_POSITION_ATTEMPTS = 24;

export class MonsterSystem {
  private worldMap: GameWorldMap | null = null;

  seed(world: WorldState, count: number): void {
    if (world.monsters.size > 0 || world.monsterSpawnRegions.size > 0 || world.monsterSpawnRules.size > 0) return;

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

  seedFromWorldMap(world: WorldState, map: GameWorldMap | null | undefined): void {
    this.worldMap = map ?? null;
    if (!map) return;

    const regions: MonsterSpawnRegionEntity[] = [];
    const rules: MonsterSpawnRuleEntity[] = [];

    for (const cell of map.cells) {
      for (const placement of cell.placements) {
        const region = this.createSpawnRegionFromPlacement(cell.gridX, cell.gridY, placement);
        if (region) regions.push(region);
      }
    }

    for (const rule of map.monsterSpawnRules ?? []) {
      if (!rule.enabled) continue;
      if (rule.scope !== 'world') continue;
      rules.push({
        id: rule.id,
        monsterType: rule.monsterType,
        scope: rule.scope,
        maxAlive: Math.max(0, Math.min(500, Math.floor(normalizePositiveNumber(rule.maxAlive, 0)))),
        spawnsPerHour: Math.max(1, normalizePositiveNumber(rule.spawnsPerHour, 60)),
        nextSpawnAt: Date.now(),
        spec: rule.spec ? { ...rule.spec } : undefined,
      });
    }

    if (regions.length === 0 && rules.length === 0) return;

    const nowMs = Date.now();
    world.monsters.clear();
    world.monsterSpawnRegions.clear();
    world.monsterSpawnRules.clear();

    for (const region of regions) {
      region.nextSpawnAt = nowMs + spawnIntervalMs(region.spawnsPerHour);
      world.monsterSpawnRegions.set(region.id, region);
      for (let i = 0; i < region.maxAlive; i += 1) {
        const monster = this.trySpawnFromRegion(world, region, i);
        if (monster) world.monsters.set(monster.id, monster);
      }
    }

    for (const rule of rules) {
      rule.nextSpawnAt = nowMs + spawnIntervalMs(rule.spawnsPerHour);
      world.monsterSpawnRules.set(rule.id, rule);
      const initialCount = Math.min(rule.maxAlive, Math.ceil(rule.spawnsPerHour / 12));
      for (let i = 0; i < initialCount; i += 1) {
        const monster = this.trySpawnFromWorldRule(world, rule, nowMs + i);
        if (monster) world.monsters.set(monster.id, monster);
      }
    }
  }

  update(world: WorldState, dt: number, options: MonsterSystemUpdateOptions = {}): void {
    const nowMs = options.nowMs ?? Date.now();
    this.updateSpawnRegions(world, nowMs, options.buildingGrid);
    this.updateGlobalSpawnRules(world, nowMs, options.buildingGrid);

    for (const monster of world.monsters.values()) {
      this.updateAi(monster, world, dt, nowMs, options.buildingGrid);
    }
  }

  private updateSpawnRegions(world: WorldState, nowMs: number, buildingGrid?: BuildingGrid): void {
    if (world.monsterSpawnRegions.size === 0) return;

    for (const region of world.monsterSpawnRegions.values()) {
      const aliveCount = countRegionMonsters(world, region.id);
      if (aliveCount >= region.maxAlive) continue;
      if (nowMs < region.nextSpawnAt) continue;

      const monster = this.trySpawnFromRegion(world, region, nowMs, buildingGrid);
      if (monster) world.monsters.set(monster.id, monster);
      region.nextSpawnAt = nowMs + spawnIntervalMs(region.spawnsPerHour);
    }
  }

  private updateGlobalSpawnRules(world: WorldState, nowMs: number, buildingGrid?: BuildingGrid): void {
    if (world.monsterSpawnRules.size === 0) return;

    for (const rule of world.monsterSpawnRules.values()) {
      const aliveCount = countRuleMonsters(world, rule.id);
      if (aliveCount >= rule.maxAlive) continue;
      if (nowMs < rule.nextSpawnAt) continue;

      const monster = this.trySpawnFromWorldRule(world, rule, nowMs, buildingGrid);
      if (monster) world.monsters.set(monster.id, monster);
      rule.nextSpawnAt = nowMs + spawnIntervalMs(rule.spawnsPerHour);
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
    if (targetDistance <= monster.attackRange) {
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

    monster.nextAttackAt = nowMs + monster.attackCooldownMs;

    const damage = monster.attackDamage;
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

    if (!this.canSpawnAt(monster.type, selfCircle.x, selfCircle.y, world, buildingGrid)) {
      return false;
    }

    return true;
  }

  private canSpawnAt(type: MonsterType, x: number, y: number, world: WorldState, buildingGrid?: BuildingGrid): boolean {
    const selfCircle = getCollisionCircle(type, x, y);

    if (!canCircleOccupyWorldMap(this.worldMap, selfCircle.x, selfCircle.y, selfCircle.radius)) {
      return false;
    }

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
      const otherCircle = getCollisionCircle(other.type, other.x, other.y);
      if (circlesOverlap(selfCircle.x, selfCircle.y, selfCircle.radius, otherCircle.x, otherCircle.y, otherCircle.radius)) {
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

  private createSpawnRegionFromPlacement(cellX: number, cellY: number, placement: WorldMapPlacement): MonsterSpawnRegionEntity | null {
    if (placement.gameplay?.kind !== 'monsterSpawn') return null;

    const spawnRadius = normalizePositiveNumber(placement.gameplay.spawnRadius, 160);
    const maxAlive = Math.max(1, Math.min(50, Math.floor(normalizePositiveNumber(placement.gameplay.maxAlive, 1))));
    const respawnMs = Math.max(1_000, Math.floor(normalizePositiveNumber(placement.gameplay.respawnMs, 30_000)));
    const spawnsPerHour = normalizePositiveNumber(placement.gameplay.spawnsPerHour, 3_600_000 / respawnMs);
    const scale = normalizePositiveNumber(placement.scale, 1);
    const displayWidth = normalizePositiveNumber(placement.displayWidth ?? placement.sourceRect?.width, 32);
    const displayHeight = normalizePositiveNumber(placement.displayHeight ?? placement.sourceRect?.height, 32);

    return {
      id: `map-spawn:${cellX}:${cellY}:${placement.id}`,
      cellX,
      cellY,
      monsterType: placement.gameplay.monsterType,
      centerX: placement.x + cellX * (this.worldMap?.cellSize ?? WORLD_WIDTH) + (displayWidth * scale) / 2,
      centerY: placement.y + cellY * (this.worldMap?.cellSize ?? WORLD_HEIGHT) + (displayHeight * scale) / 2,
      radius: spawnRadius,
      maxAlive,
      respawnMs,
      spawnsPerHour,
      nextSpawnAt: 0,
      spec: placement.gameplay.spec ? { ...placement.gameplay.spec } : undefined,
    };
  }

  private trySpawnFromRegion(
    world: WorldState,
    region: MonsterSpawnRegionEntity,
    seed: number,
    buildingGrid?: BuildingGrid,
  ): MonsterEntity | null {
    for (let attempt = 0; attempt < SPAWN_POSITION_ATTEMPTS; attempt += 1) {
      const angle = ((seed + attempt * 37) % 360) * (Math.PI / 180);
      const radius = region.radius * (0.2 + (((seed + attempt * 17) % 100) / 100) * 0.75);
      const x = region.centerX + Math.cos(angle) * radius;
      const y = region.centerY + Math.sin(angle) * radius;
      if (!this.canSpawnAt(region.monsterType, x, y, world, buildingGrid)) continue;
      return this.spawnAt(region.monsterType, x, y, `map-monster:${region.id}:${seed}:${attempt}`, region.spec, region.id);
    }
    return null;
  }

  private trySpawnFromWorldRule(
    world: WorldState,
    rule: MonsterSpawnRuleEntity,
    seed: number,
    buildingGrid?: BuildingGrid,
  ): MonsterEntity | null {
    const cellSize = this.worldMap?.cellSize ?? WORLD_WIDTH;
    const cells = this.worldMap?.cells.length ? this.worldMap.cells : [{ gridX: 0, gridY: 0, placements: [] }];

    for (let attempt = 0; attempt < SPAWN_POSITION_ATTEMPTS; attempt += 1) {
      const cell = cells[(Math.abs(Math.floor(seed + attempt)) % cells.length)];
      const x = cell.gridX * cellSize + randomRange(64, Math.max(65, cellSize - 64));
      const y = cell.gridY * cellSize + randomRange(64, Math.max(65, cellSize - 64));
      if (!this.canSpawnAt(rule.monsterType, x, y, world, buildingGrid)) continue;
      return this.spawnAt(rule.monsterType, x, y, `map-rule-monster:${rule.id}:${seed}:${attempt}`, rule.spec, undefined, rule.id);
    }

    return null;
  }

  private spawn(type: MonsterType): MonsterEntity {
    return this.spawnAt(
      type,
      randomRange(200, WORLD_WIDTH - 200),
      randomRange(200, WORLD_HEIGHT - 200),
    );
  }

  private spawnAt(
    type: MonsterType,
    x: number,
    y: number,
    id = shortId('mob'),
    spec?: WorldMapMonsterSpecOverrides,
    spawnRegionId?: string,
    spawnRuleId?: string,
  ): MonsterEntity {
    const definition = getMonsterDefinition(type);
    const maxHp = normalizePositiveNumber(spec?.maxHp, definition.maxHp);
    const moveSpeed = normalizePositiveNumber(spec?.moveSpeed, definition.moveSpeed);
    const detectRange = normalizePositiveNumber(spec?.detectRange, definition.ai.detectRange);
    const loseRange = normalizePositiveNumber(spec?.loseRange, definition.ai.loseRange);
    const attackRange = normalizePositiveNumber(spec?.attackRange, definition.combat.attackRange);
    const attackDamage = normalizePositiveNumber(spec?.attackDamage, definition.combat.attackDamage);
    const attackCooldownMs = normalizePositiveNumber(spec?.attackCooldownMs, definition.combat.attackCooldownMs);

    return {
      id,
      type,
      x: clamp(x, definition.collision.radius, WORLD_WIDTH - definition.collision.radius),
      y: clamp(y, definition.collision.radius, WORLD_HEIGHT - definition.collision.radius),
      hp: maxHp,
      maxHp,
      state: 'idle',
      targetPlayerId: null,
      speed: moveSpeed,
      detectRange,
      loseRange,
      attackRange,
      attackDamage,
      attackCooldownMs,
      nextAttackAt: 0,
      spawnRegionId,
      spawnRuleId,
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

function countRegionMonsters(world: WorldState, regionId: string): number {
  let count = 0;
  for (const monster of world.monsters.values()) {
    if (monster.spawnRegionId === regionId) count += 1;
  }
  return count;
}

function countRuleMonsters(world: WorldState, ruleId: string): number {
  let count = 0;
  for (const monster of world.monsters.values()) {
    if (monster.spawnRuleId === ruleId) count += 1;
  }
  return count;
}

function spawnIntervalMs(spawnsPerHour: number): number {
  return Math.max(1_000, Math.floor(3_600_000 / Math.max(1, spawnsPerHour)));
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

function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;
}