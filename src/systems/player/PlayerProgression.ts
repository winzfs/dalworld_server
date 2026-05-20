import { GAME_CONFIG } from '../../config/gameConfig';
import type { MonsterType } from '../../protocol/messages';
import type { PlayerEntity } from '../../sim/WorldState';

export type PlayerExperienceGrantResult = {
  amount: number;
  previousLevel: number;
  leveledUp: boolean;
};

const DEFAULT_CHARACTER_NAME = 'Dale';
const MAX_CHARACTER_NAME_LENGTH = 18;

export function sanitizeCharacterName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CHARACTER_NAME;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return DEFAULT_CHARACTER_NAME;
  return trimmed.slice(0, MAX_CHARACTER_NAME_LENGTH);
}

export function setPlayerCharacterName(player: PlayerEntity, value: unknown): void {
  player.characterName = sanitizeCharacterName(value);
}

export function getExpRewardForMonster(monsterType: MonsterType): number {
  return GAME_CONFIG.player.progression.monsterExp[monsterType] ?? 0;
}

export function grantPlayerExperience(player: PlayerEntity, rawAmount: number): PlayerExperienceGrantResult {
  const amount = Math.max(0, Math.floor(rawAmount));
  const previousLevel = player.level;
  if (amount <= 0 || player.level >= GAME_CONFIG.player.progression.maxLevel) {
    return { amount: 0, previousLevel, leveledUp: false };
  }

  player.exp += amount;

  while (
    player.level < GAME_CONFIG.player.progression.maxLevel &&
    player.expToNextLevel > 0 &&
    player.exp >= player.expToNextLevel
  ) {
    player.exp -= player.expToNextLevel;
    player.level += 1;
    applyLevelDerivedStats(player);
  }

  player.expToNextLevel = getExpToNextLevel(player.level);
  if (player.level >= GAME_CONFIG.player.progression.maxLevel) {
    player.exp = 0;
  }

  return {
    amount,
    previousLevel,
    leveledUp: player.level > previousLevel,
  };
}

export function applyLevelDerivedStats(player: PlayerEntity): void {
  const previousMaxHp = player.maxHp;
  const previousMaxStamina = player.maxStamina;
  const nextMaxHp = getMaxHpForLevel(player.level);
  const nextMaxStamina = getMaxStaminaForLevel(player.level);

  player.maxHp = nextMaxHp;
  player.maxStamina = nextMaxStamina;
  player.hp = Math.min(nextMaxHp, player.hp + Math.max(0, nextMaxHp - previousMaxHp));
  player.stamina = Math.min(nextMaxStamina, player.stamina + Math.max(0, nextMaxStamina - previousMaxStamina));
}

export function getMaxHpForLevel(level: number): number {
  const safeLevel = normalizeLevel(level);
  return GAME_CONFIG.player.maxHp + (safeLevel - 1) * GAME_CONFIG.player.progression.maxHpPerLevel;
}

export function getMaxStaminaForLevel(level: number): number {
  const safeLevel = normalizeLevel(level);
  return GAME_CONFIG.player.maxStamina + (safeLevel - 1) * GAME_CONFIG.player.progression.maxStaminaPerLevel;
}

export function getExpToNextLevel(level: number): number {
  const safeLevel = normalizeLevel(level);
  if (safeLevel >= GAME_CONFIG.player.progression.maxLevel) return 0;
  return GAME_CONFIG.player.progression.baseExpToNextLevel +
    (safeLevel - 1) * GAME_CONFIG.player.progression.expToNextLevelGrowth;
}

function normalizeLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(GAME_CONFIG.player.progression.maxLevel, Math.max(1, Math.floor(level)));
}
