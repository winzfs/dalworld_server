import { BUILD_PARTS } from './BuildingParts';
import type { BuildPartId } from './BuildingTypes';
import {
  createBuildPartItemDefinition,
  createBuildPartItemId,
  type InventoryItemId,
  type ItemDefinition,
} from '../inventory/ItemDefinitions';

export type BuildPartInventoryEntry = {
  itemId: InventoryItemId;
  buildPartId: BuildPartId;
  definition: ItemDefinition;
};

export const BUILD_PART_ITEM_ENTRIES: BuildPartInventoryEntry[] = Object.values(BUILD_PARTS).map((part) => ({
  itemId: createBuildPartItemId(part.id),
  buildPartId: part.id,
  definition: createBuildPartItemDefinition({
    buildPartId: part.id,
    label: part.id,
    description: `Server-side build part item for ${part.id}`,
    icon: '▣',
  }),
}));

export const BUILD_PART_ITEM_DEFINITIONS: Record<string, ItemDefinition> = Object.fromEntries(
  BUILD_PART_ITEM_ENTRIES.map((entry) => [entry.itemId, entry.definition]),
);

export function getBuildPartIdFromItemId(itemId: string): BuildPartId | null {
  return BUILD_PART_ITEM_ENTRIES.find((entry) => entry.itemId === itemId)?.buildPartId ?? null;
}
