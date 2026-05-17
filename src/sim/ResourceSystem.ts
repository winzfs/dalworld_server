import type { ItemType, ResourceType } from '../protocol/messages';
import { shortId } from '../utils/ids';
import { distance, randomRange } from '../utils/math';
import { WORLD_HEIGHT, WORLD_WIDTH, type PlayerEntity, type ResourceEntity, type WorldState } from './WorldState';

export const GATHER_RANGE = 60;
export const GATHER_COOLDOWN_MS = 400;
export const GATHER_DAMAGE = 25;
export const STAMINA_COST_PER_GATHER = 8;

type ResourceTemplate = {
  type: ResourceType;
  maxHp: number;
  drop: ItemType;
  dropAmount: number;
  respawnMs: number;
};

const TEMPLATES: Record<ResourceType, ResourceTemplate> = {
  tree: { type: 'tree', maxHp: 75, drop: 'wood', dropAmount: 3, respawnMs: 25_000 },
  stone: { type: 'stone', maxHp: 100, drop: 'stone', dropAmount: 2, respawnMs: 35_000 },
};

export type GatherResult =
  | { ok: true; destroyed: boolean; resource: ResourceEntity }
  | {
      ok: false;
      reason: 'cooldown' | 'out_of_range' | 'unavailable' | 'no_stamina';
    };

export class ResourceSystem {
  /** Seed the world with starting resource nodes. */
  seed(world: WorldState, treeCount: number, stoneCount: number): void {
    for (let i = 0; i < treeCount; i++) {
      const node = this.spawn('tree');
      world.resources.set(node.id, node);
    }
    for (let i = 0; i < stoneCount; i++) {
      const node = this.spawn('stone');
      world.resources.set(node.id, node);
    }
  }

  update(world: WorldState, nowMs: number): void {
    for (const resource of world.resources.values()) {
      if (resource.respawnAt !== 0 && nowMs >= resource.respawnAt) {
        const template = TEMPLATES[resource.type];
        resource.hp = template.maxHp;
        resource.respawnAt = 0;
        const pos = randomPosition();
        resource.x = pos.x;
        resource.y = pos.y;
      }
    }
  }

  gather(world: WorldState, player: PlayerEntity, resourceId: string, nowMs: number): GatherResult {
    if (nowMs < player.nextGatherAt) {
      return { ok: false, reason: 'cooldown' };
    }
    if (player.stamina < STAMINA_COST_PER_GATHER) {
      return { ok: false, reason: 'no_stamina' };
    }

    const resource = world.resources.get(resourceId);
    if (!resource || resource.respawnAt !== 0 || resource.hp <= 0) {
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
      world.pushEvent({ type: 'resource_destroyed', resourceId: resource.id, resourceType: resource.type });
      world.pushEvent({
        type: 'item_gained',
        playerId: player.id,
        item: template.drop,
        amount: template.dropAmount,
      });
      return { ok: true, destroyed: true, resource };
    }

    return { ok: true, destroyed: false, resource };
  }

  private spawn(type: ResourceType): ResourceEntity {
    const template = TEMPLATES[type];
    const pos = randomPosition();
    return {
      id: shortId(type),
      type,
      x: pos.x,
      y: pos.y,
      hp: template.maxHp,
      maxHp: template.maxHp,
      respawnAt: 0,
    };
  }
}

function randomPosition(): { x: number; y: number } {
  const margin = 100;
  return {
    x: randomRange(margin, WORLD_WIDTH - margin),
    y: randomRange(margin, WORLD_HEIGHT - margin),
  };
}
