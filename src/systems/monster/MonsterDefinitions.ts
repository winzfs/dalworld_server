import type { MonsterType } from '../../protocol/messages';
import type { InventoryItemStack } from '../inventory/InventoryStore';

export type MonsterAiDefinition = {
  detectRange: number;
  loseRange: number;
};

export type MonsterCombatDefinition = {
  attackRange: number;
  attackDamage: number;
  attackCooldownMs: number;
};

export type MonsterCollisionDefinition = {
  radius: number;
  offsetX: number;
  offsetY: number;
};

export type MonsterRewardDefinition = InventoryItemStack & {
  /** 0..1. MVP currently uses guaranteed drops, but the schema is ready for chance-based drops. */
  chance: number;
};

export type MonsterDefinition = {
  type: MonsterType;
  maxHp: number;
  moveSpeed: number;
  ai: MonsterAiDefinition;
  combat: MonsterCombatDefinition;
  collision: MonsterCollisionDefinition;
  rewards: MonsterRewardDefinition[];
};

export const MONSTER_DEFINITIONS = {
  wild_slime: {
    type: 'wild_slime',
    maxHp: 50,
    moveSpeed: 80,
    ai: {
      detectRange: 250,
      loseRange: 450,
    },
    combat: {
      attackRange: 42,
      attackDamage: 8,
      attackCooldownMs: 900,
    },
    collision: {
      radius: 18,
      offsetX: 0,
      offsetY: 0,
    },
    rewards: [
      { itemId: 'stone', quantity: 1, chance: 1 },
    ],
  },
  sheep: {
    type: 'sheep',
    maxHp: 35,
    moveSpeed: 65,
    ai: {
      detectRange: 180,
      loseRange: 320,
    },
    combat: {
      attackRange: 34,
      attackDamage: 2,
      attackCooldownMs: 1200,
    },
    collision: {
      radius: 18,
      offsetX: 0,
      offsetY: -8,
    },
    rewards: [
      { itemId: 'fiber', quantity: 1, chance: 1 },
    ],
  },
} satisfies Record<MonsterType, MonsterDefinition>;

export function getMonsterDefinition(type: MonsterType): MonsterDefinition {
  return MONSTER_DEFINITIONS[type] ?? MONSTER_DEFINITIONS.wild_slime;
}

export function getMonsterDefinitions(): Record<MonsterType, MonsterDefinition> {
  return MONSTER_DEFINITIONS;
}
