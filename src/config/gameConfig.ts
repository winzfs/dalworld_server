import type { ItemType, MonsterType, ResourceType } from '../protocol/messages';

export const GAME_CONFIG = {
  world: {
    width: 3000,
    height: 3000,
    tickRate: 20,
    snapshotRate: 20,
  },

  player: {
    radius: 18,
    speed: 220,
    maxHp: 100,
    maxStamina: 100,
    staminaRegenPerSec: 12,
  },

  resource: {
    startingTrees: 60,
    startingStones: 40,
    gatherRange: 80,
    gatherCooldownMs: 400,
    gatherDamage: 25,
    staminaCostPerGather: 8,
    templates: {
      tree: {
        type: 'tree',
        maxHp: 75,
        drop: 'wood',
        dropAmount: 3,
        respawnMs: 25_000,
      },
      stone: {
        type: 'stone',
        maxHp: 100,
        drop: 'stone',
        dropAmount: 2,
        respawnMs: 35_000,
      },
    } satisfies Record<
      ResourceType,
      {
        type: ResourceType;
        maxHp: number;
        drop: ItemType;
        dropAmount: number;
        respawnMs: number;
      }
    >,
  },

  monster: {
    startingMonsters: 8,
    templates: {
      wild_slime: {
        type: 'wild_slime',
        hp: 50,
        speed: 80,
        detectRange: 250,
        loseRange: 450,
      },
      sheep: {
        type: 'sheep',
        hp: 35,
        speed: 65,
        detectRange: 180,
        loseRange: 320,
      },
    } satisfies Record<
      MonsterType,
      {
        type: MonsterType;
        hp: number;
        speed: number;
        detectRange: number;
        loseRange: number;
      }
    >,
  },

  network: {
    rateLimitPerSecond: 120,
  },
} as const;

export type PublicGameConfig = ReturnType<typeof getPublicGameConfig>;

export function getPublicGameConfig() {
  return {
    world: {
      width: GAME_CONFIG.world.width,
      height: GAME_CONFIG.world.height,
      tickRate: GAME_CONFIG.world.tickRate,
    },
    gameplay: {
      playerRadius: GAME_CONFIG.player.radius,
      playerSpeed: GAME_CONFIG.player.speed,
      gatherRange: GAME_CONFIG.resource.gatherRange,
    },
  };
}
