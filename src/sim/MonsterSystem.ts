import type { MonsterType } from '../protocol/messages';
import { shortId } from '../utils/ids';
import { distance, normalize, randomRange } from '../utils/math';
import {
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

const TEMPLATES: Record<MonsterType, MonsterTemplate> = {
  wild_slime: {
    type: 'wild_slime',
    hp: 50,
    speed: 80,
    detectRange: 250,
    loseRange: 450,
  },
};

export class MonsterSystem {
  seed(world: WorldState, count: number): void {
    for (let i = 0; i < count; i++) {
      const monster = this.spawn('wild_slime');
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
    monster.x = clamp(monster.x + direction.x * monster.speed * dt, 0, WORLD_WIDTH);
    monster.y = clamp(monster.y + direction.y * monster.speed * dt, 0, WORLD_HEIGHT);
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
    const template = TEMPLATES[type];
    return {
      id: shortId('mob'),
      type,
      x: randomRange(200, WORLD_WIDTH - 200),
      y: randomRange(200, WORLD_HEIGHT - 200),
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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
