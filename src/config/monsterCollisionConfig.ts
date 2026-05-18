import type { MonsterType } from '../protocol/messages';

export type MonsterCollisionConfig = {
  radius: number;
  offsetX: number;
  offsetY: number;
};

export const MONSTER_COLLISION_CONFIGS = {
  wild_slime: {
    radius: 18,
    offsetX: 0,
    offsetY: 0,
  },
  sheep: {
    radius: 18,
    offsetX: 0,
    offsetY: -8,
  },
} satisfies Record<MonsterType, MonsterCollisionConfig>;

export function getMonsterCollisionConfig(type: MonsterType): MonsterCollisionConfig {
  return MONSTER_COLLISION_CONFIGS[type] ?? MONSTER_COLLISION_CONFIGS.wild_slime;
}
