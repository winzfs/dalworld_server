import { GAME_CONFIG } from '../config/gameConfig';
import type { ItemType, ResourceType } from '../protocol/messages';
import { shortId } from '../utils/ids';
import { distance, randomRange } from '../utils/math';
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
        const resource = this.createFromPlacement(cell.gridX, cell.gridY, placement);
        if (resource) {
          world.resources.set(resource.id, resource);
        }
      }
    }
  }

  update(world: WorldState, nowMs: number): void {
    for (const resource of world.resources.values()) {
      if (resource.respawnAt !== 0 && nowMs >= resource.respawnAt) {
        const template = TEMPLATES[resource.type];
        resource.hp = template.maxHp;
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
      if (
        candidate &&
        candidate.cellX === player.cellX &&
        candidate.cellY === player.cellY &&
        candidate.respawnAt === 0 &&
        candidate.hp > 0
      ) {
        resource = candidate;
      }
    }
    if (!resource) {
      let nearestDist = GATHER_RANGE;
      for (const r of world.resources.values()) {
        if (r.cellX !== player.cellX || r.cellY !== player.cellY) continue;
        if (r.respawnAt !== 0 || r.hp <= 0) continue;
        const d = distance(player.x, player.y, r.x, r.y);
        if (d < nearestDist) {
          nearestDist = d;
          resource = r;
        }
      }
    }

    if (!resource) {
      return { ok: false, reason: 'unavailable' };
    }

    if (distance(player.x, player.y, resource.x, resource.y) > GATHER_RANGE) {
      return { ok: false, reason: 'out_of_range' };
    }

    player.nextGatherAt = nowMs + GATHER_COOLDOWN_MS;
    player.stamina = Math.max(0, player.stamina - STAMINA_COST_PER_GATHER);
    resource.hp = Math.max(0, resource.hp - GATHER_DAMAGE);

    if (resource.hp <= 0) {
      const template = TEMPLATES[resource.type];
      resource.respawnAt = nowMs + template.respawnMs;
      player.inventory[template.drop] += template.dropAmount;
      world.pushEvent({
        type: 'resource_destroyed',
        resourceId: resource.id,
        resourceType: resource.type,
      });
      world.pushEvent({
        type: 'item_gained',
        playerId: player.id,
        item: template.drop,
        amount: template.dropAmount,
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

  private createFromPlacement(cellX: number, cellY: number, placement: WorldMapPlacement): ResourceEntity | null {
    const type = getPlacementResourceType(placement);
    if (!type) return null;

    const template = TEMPLATES[type];
    if (!template) return null;

    const maxHp = normalizePositiveNumber(placement.gameplay?.maxHp, template.maxHp);

    return {
      id: `map-resource:${cellX}:${cellY}:${placement.id}`,
      type,
      cellX,
      cellY,
      assetUrl: placement.assetUrl,
      x: placement.x,
      y: placement.y,
      hp: maxHp,
      maxHp,
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
      respawnAt: 0,
    };
  }
}

function getPlacementResourceType(placement: WorldMapPlacement): ResourceType | null {
  if (placement.gameplay?.kind === 'resource') {
    return placement.gameplay.resourceType;
  }

  if (placement.layer === 'collision') return null;

  const filename = getFilename(placement.assetUrl).toLowerCase();
  if (filename.startsWith('rock')) return 'stone';
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
