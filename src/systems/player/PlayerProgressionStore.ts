import type { PlayerEntity } from '../../sim/WorldState';
import type { InventoryItemStack } from '../inventory/InventoryStore';
import {
  applyLevelDerivedStats,
  getExpToNextLevel,
  sanitizeCharacterName,
} from './PlayerProgression';

export type StoredPlayerProgression = {
  player_id: string;
  character_name: string;
  level: number;
  exp: number;
  exp_to_next_level: number;
  max_hp: number;
  max_stamina: number;
  hp: number;
  stamina: number;
  inventory_json: string | null;
  created_at: number;
  updated_at: number;
};

export class PlayerProgressionStore {
  constructor(private readonly db: D1Database) {}

  async load(playerId: string): Promise<StoredPlayerProgression | null> {
    return await this.db
      .prepare(
        `SELECT player_id, character_name, level, exp, exp_to_next_level, max_hp, max_stamina, hp, stamina, inventory_json, created_at, updated_at
         FROM player_progression
         WHERE player_id = ?`,
      )
      .bind(playerId)
      .first<StoredPlayerProgression>();
  }

  applyToPlayer(player: PlayerEntity, stored: StoredPlayerProgression | null): void {
    if (!stored) return;

    player.characterName = sanitizeCharacterName(stored.character_name);
    player.level = normalizePositiveInteger(stored.level, 1);
    player.exp = Math.max(0, Math.floor(stored.exp));
    player.expToNextLevel = normalizePositiveInteger(stored.exp_to_next_level, getExpToNextLevel(player.level));
    applyLevelDerivedStats(player);

    player.hp = clampNumber(stored.hp, 0, player.maxHp, player.maxHp);
    player.stamina = clampNumber(stored.stamina, 0, player.maxStamina, player.maxStamina);

    const inventoryItems = parseInventoryItems(stored.inventory_json);
    if (inventoryItems) {
      player.inventoryItems = inventoryItems;
      player.inventory.wood = inventoryItems.find((item) => item.itemId === 'wood')?.quantity ?? 0;
      player.inventory.stone = inventoryItems.find((item) => item.itemId === 'stone')?.quantity ?? 0;
    }
  }

  async save(player: PlayerEntity, nowMs = Date.now()): Promise<void> {
    const existing = await this.load(player.id);
    const createdAt = existing?.created_at ?? nowMs;
    const inventoryJson = JSON.stringify(player.inventoryItems);

    await this.db
      .prepare(
        `INSERT INTO player_progression (
           player_id,
           character_name,
           level,
           exp,
           exp_to_next_level,
           max_hp,
           max_stamina,
           hp,
           stamina,
           inventory_json,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(player_id) DO UPDATE SET
           character_name = excluded.character_name,
           level = excluded.level,
           exp = excluded.exp,
           exp_to_next_level = excluded.exp_to_next_level,
           max_hp = excluded.max_hp,
           max_stamina = excluded.max_stamina,
           hp = excluded.hp,
           stamina = excluded.stamina,
           inventory_json = excluded.inventory_json,
           updated_at = excluded.updated_at`,
      )
      .bind(
        player.id,
        player.characterName,
        player.level,
        player.exp,
        player.expToNextLevel,
        player.maxHp,
        player.maxStamina,
        player.hp,
        player.stamina,
        inventoryJson,
        createdAt,
        nowMs,
      )
      .run();
  }
}

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function parseInventoryItems(raw: string | null): InventoryItemStack[] | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;

    const items: InventoryItemStack[] = [];
    for (const item of parsed) {
      if (!isInventoryItemStack(item)) continue;
      items.push({ itemId: item.itemId, quantity: item.quantity });
    }

    return items;
  } catch {
    return null;
  }
}

function isInventoryItemStack(value: unknown): value is InventoryItemStack {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as { itemId?: unknown; quantity?: unknown };
  return typeof item.itemId === 'string' &&
    typeof item.quantity === 'number' &&
    Number.isFinite(item.quantity) &&
    item.quantity >= 0;
}
