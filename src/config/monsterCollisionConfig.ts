import type { MonsterType } from '../protocol/messages';
import { getMonsterDefinition, type MonsterCollisionDefinition } from '../systems/monster/MonsterDefinitions';

export type MonsterCollisionConfig = MonsterCollisionDefinition;

/**
 * Compatibility wrapper for older systems. New code should prefer getMonsterDefinition(type).collision.
 */
export function getMonsterCollisionConfig(type: MonsterType): MonsterCollisionConfig {
  return getMonsterDefinition(type).collision;
}
