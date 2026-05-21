import { GAME_CONFIG } from '../config/gameConfig';
import type { ItemType, ResourceType } from '../protocol/messages';
import { getWorldItemNumberField } from '../systems/inventory/RuntimeItemOverrides';
import { shortId } from '../utils/ids';
import { randomRange } from '../utils/math';
import type { GameWorldMap, WorldMapPlacement } from '../worldMap/types';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type PlayerEntity,
  type ResourceEntity,
  type WorldState,
} from './WorldState';

export const GATHER_RANGE = GAME_CONFIG.resource.gatherRange;
export const GATHER_COOLDOWN_MS = GAME_CONFIG.resource.gatherCooldownMs;
export const GATHER_DAMAGE = GAME_CONFIG.resource.gatherDamage;
export const STAMINA_COST_PER_GATHER = GAME_CONFIG.resource.staminaCostPerGather;

type ResourceTemplate = {
  type: ResourceType;
  maxHp: number;
  drop: ItemType;
  dropAmount: number;
  respawnMs: number;
};

type InteractionArea = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const TEMPLATES: Record<ResourceType, ResourceTemplate> = GAME_CONFIG.resource.templates;

export type GatherResult =
  | { ok: true; destroyed: boolean; resource: ResourceEntity }
  | { ok: false; reason: 'cooldown' | 'out_of_range' | 'unavailable' | 'no_stamina' };

export class ResourceSystem {
  seed(world: WorldState, treeCount: number, stoneCount: number): void {
    if (world.resources.size > 0) return;

    for (let i = 0; i < treeCount; i++) {
      const node = this.spawnRandom('tree', i);
      world.resources.set(node.id, node);
    }
    for (let i = 0; i < stoneCount; i++) {
      const node = this.spawnRandom('stone', i);
      world.resources.set(node.id, node);
    }
  }

  seedFromWorldMap(world: WorldState, map: GameWorldMap | null | undefined): void {
    if (!map) return;

    world.resources.clear();

    for (const cell of map.cells) {
      for (const placement of cell.placements) {
        const resource = this.createFromPlacement(cell.gridX, cell.gridY, placement, map);
        if (resource) {
          world.resources.set(resource.id, resource);
        }
      }
    }
  }

  update(world: WorldState, nowMs: number): void {
    for (const resource of world.resources.values()) {
      if (resource.respawnAt !== 0 && nowMs >= resource.respawnAt) {
        resource.hp = resource.maxHp;
        resource.respawnAt = 0;
      }
    }
  }

  gather(
    world: WorldState,
    player: PlayerEntity,
    resourceId: string | undefined,
    nowMs: number,
  ): GatherResult {
    if (nowMs < player.nextGatherAt) {
      return { ok: false, reason: 'cooldown' };
    }
    if (player.stamina < STAMINA_COST_PER_GATHER) {
      return { ok: false, reason: 'no_stamina' };
    }

    let resource: ResourceEntity | undefined;
    if (resourceId) {
      const candidate = world.resources.get(resourceId);
      if (candidate && isGatherableInCurrentCell(candidate, player) && canInteractWithResource(player, candidate)) {
        resource = candidate;
      }
    }

    if (!resource) {
      resource = findNearestInteractableResource(world, player);
    }

    if (!resource) {
      return { ok: false, reason: 'unavailable' };
    }

    if (!canInteractWithResource(player, resource)) {
      return { ok: false, reason: 'out_of_range' };
    }

    player.nextGatherAt = nowMs + GATHER_COOLDOWN_MS;
    player.stamina = Math.max(0, player.stamina - STAMINA_COST_PER_GATHER);
    resource.hp = Math.max(0, resource.hp - GATHER_DAMAGE);

    if (resource.hp <= 0) {
      resource.respawnAt = nowMs + resource.respawnMs;
      player.inventory[resource.drop] += resource.dropAmount;
      world.pushEvent({
        type: 'resource_destroyed',
        resourceId: resource.id,
        resourceType: resource.type,
      });
      world.pushEvent({
        type: 'item_gained',
        playerId: player.id,
        item: resource.drop,
        amount: resource.dropAmount,
      });
      return { ok: true, destroyed: true, resource };
    }

    world.pushEvent({
      type: 'resource_hit',
      resourceId: resource.id,
      resourceType: resource.type,
      hpRemaining: resource.hp,
    });
    return { ok: true, destroyed: false, resource };
  }

  private createFromPlacement(cellX: number, cellY: number, placement: WorldMapPlacement, map: GameWorldMap): ResourceEntity | null {
    const type = getPlacementResourceType(placement);
    if (!type) return null;

    const template = TEMPLATES[type];
    if (!template) return null;

    const drop = template.drop;
    const maxHp = Math.floor(getWorldItemNumberField(
      map,
      drop,
      'nodeHp',
      normalizePositiveNumber(placement.gameplay?.maxHp, template.maxHp),
      { min: 1, max: 99_999 },
    ));
    const dropAmount = Math.floor(getWorldItemNumberField(map, drop, 'gatherYield', template.dropAmount, { min: 1, max: 999 }));
    const respawnMs = Math.floor(getWorldItemNumberField(
      map,
      drop,
      'respawnMs',
      normalizePositiveNumber(placement.gameplay?.respawnMs, template.respawnMs),
      { min: 1_000, max: 3_600_000 },
    ));
    const scale = normalizePositiveNumber(placement.scale, 1);
    const displayWidth = normalizePositiveNumber(placement.displayWidth ?? placement.sourceRect?.width, 32);
    const displayHeight = normalizePositiveNumber(placement.displayHeight ?? placement.sourceRect?.height, 32);
    const scaledWidth = displayWidth * scale;
    const scaledHeight = displayHeight * scale;
    const interactionPoint = getResourceInteractionPoint(type, placement.x, placement.y, scaledWidth, scaledHeight);

    return {
      id: `map-resource:${cellX}:${cellY}:${placement.id}`,
      type,
      cellX,
      cellY,
      assetUrl: placement.assetUrl,
      assetScale: scale,
      displayWidth,
      displayHeight,
      sourceRect: placement.sourceRect ? { ...placement.sourceRect } : undefined,
      x: interactionPoint.x,
      y: interactionPoint.y,
      hp: maxHp,
      maxHp,
      drop,
      dropAmount,
      respawnMs,
      respawnAt: 0,
    };
  }

  private spawnRandom(type: ResourceType, index: number): ResourceEntity {
    const template = TEMPLATES[type];
    const pos = randomPosition();
    return {
      id: `${shortId(type)}-${index}`,
      type,
      cellX: 0,
      cellY: 0,
      x: pos.x,
      y: pos.y,
      hp: template.maxHp,
      maxHp: template.maxHp,
      drop: template.drop,
      dropAmount: template.dropAmount,
      respawnMs: template.respawnMs,
      respawnAt: 0,
    };
  }
}

function isGatherableInCurrentCell(resource: ResourceEntity, player: PlayerEntity): boolean {
  return (
    resource.cellX === player.cellX &&
    resource.cellY === player.cellY &&
    resource.respawnAt === 0 &&
    resource.hp > 0
  );
}

function findNearestInteractableResource(world: WorldState, player: PlayerEntity): ResourceEntity | undefined {
  let nearest: ResourceEntity | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const resource of world.resources.values()) {
    if (!isGatherableInCurrentCell(resource, player)) continue;

    const distanceToArea = getDistanceToInteractionArea(player, resource);
    const allowedRange = getGatherRangeForResource(resource.type);
    if (distanceToArea > allowedRange) continue;

    const score = distanceToArea / allowedRange;
    if (score < bestScore) {
      bestScore = score;
      nearest = resource;
    }
  }

  return nearest;
}

function canInteractWithResource(player: PlayerEntity, resource: ResourceEntity): boolean {
  return getDistanceToInteractionArea(player, resource) <= getGatherRangeForResource(resource.type);
}

function getDistanceToInteractionArea(player: PlayerEntity, resource: ResourceEntity): number {
  const area = getResourceInteractionArea(resource);
  const closestX = clamp(player.x, area.left, area.right);
  const closestY = clamp(player.y, area.top, area.bottom);
  return Math.hypot(player.x - closestX, player.y - closestY);
}

function getResourceInteractionArea(resource: ResourceEntity): InteractionArea {
  const scale = normalizePositiveNumber(resource.assetScale, 1);
  const width = normalizePositiveNumber(resource.displayWidth ?? resource.sourceRect?.width, 32) * scale;
  const height = normalizePositiveNumber(resource.displayHeight ?? resource.sourceRect?.height, 32) * scale;

  if (resource.type === 'tree') {
    const trunkWidth = clamp(width * 0.42, 28, 96);
    const trunkHeight = clamp(height * 0.42, 36, 128);
    return {
      left: resource.x - trunkWidth / 2,
      right: resource.x + trunkWidth / 2,
      top: resource.y - trunkHeight * 0.78,
      bottom: resource.y + trunkHeight * 0.24,
    };
  }

  const radiusX = clamp(width * 0.5, 20, 80);
  const radiusY = clamp(height * 0.5, 20, 80);
  return {
    left: resource.x - radiusX,
    right: resource.x + radiusX,
    top: resource.y - radiusY,
    bottom: resource.y + radiusY,
  };
}

function getResourceInteractionPoint(
  type: ResourceType,
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (type === 'tree') {
    return {
      x: x + width * 0.5,
      y: y + height * 0.82,
    };
  }

  return {
    x: x + width * 0.5,
    y: y + height * 0.5,
  };
}

function getGatherRangeForResource(type: ResourceType): number {
  return type === 'tree' ? GATHER_RANGE + 28 : GATHER_RANGE;
}

function getPlacementResourceType(placement: WorldMapPlacement): ResourceType | null {
  if (placement.gameplay?.kind === 'resource') {
    return placement.gameplay.resourceType;
  }

  if (placement.layer === 'collision') return null;

  const filename = getFilename(placement.assetUrl).toLowerCase();
  if (filename.startsWith('rock')) return 'stone';
  if (filename.startsWith('stone')) return 'stone';
  if (filename.startsWith('tree')) return 'tree';
  return null;
}

function getFilename(url: string): string {
  const cleanUrl = url.split('?')[0]?.split('#')[0] ?? url;
  return cleanUrl.split('/').pop() ?? '';
}

function randomPosition(): { x: number; y: number } {
  const margin = 100;
  return {
    x: randomRange(margin, WORLD_WIDTH - margin),
    y: randomRange(margin, WORLD_HEIGHT - margin),
  };
}

function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
