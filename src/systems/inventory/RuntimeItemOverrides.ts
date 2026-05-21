import type { GameWorldMap, WorldMapItemOverride } from '../../worldMap/types';

export function getWorldItemOverride(map: GameWorldMap | null | undefined, itemId: string | undefined): WorldMapItemOverride | undefined {
  if (!map || !itemId) return undefined;
  return map.itemOverrides?.find((override) => override.id === itemId);
}

export function getWorldItemNumberField(
  map: GameWorldMap | null | undefined,
  itemId: string | undefined,
  fieldKey: string,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number {
  const value = getWorldItemOverride(map, itemId)?.fields?.[fieldKey];
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;

  const min = options.min ?? Number.NEGATIVE_INFINITY;
  const max = options.max ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, value));
}

export function getFastestCraftSpeedMultiplierForPlayerInventory(
  map: GameWorldMap | null | undefined,
  itemIds: readonly string[],
): number {
  let best = 1;

  for (const itemId of itemIds) {
    const multiplier = getWorldItemNumberField(map, itemId, 'craftSpeedMultiplier', 1, { min: 0.1, max: 10 });
    if (multiplier > best) best = multiplier;
  }

  return best;
}
