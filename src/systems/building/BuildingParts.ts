import type { BuildPartDefinition, BuildPartId } from "./BuildingTypes";

export const BUILD_PARTS: Record<BuildPartId, BuildPartDefinition> = {
  floor_1x1: {
    id: "floor_1x1",
    category: "floor",
    slotKind: "tile",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: false,
    requiresSupport: false,
    allowedOn: "ground",
    placementCost: [{ itemId: "wood", quantity: 1 }],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  thin_wall: {
    id: "thin_wall",
    category: "wall",
    slotKind: "edge",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: true,
    requiresSupport: true,
    allowedOn: ["floor_1x1"],
    placementCost: [{ itemId: "wood", quantity: 2 }],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  roof_1x1: {
    id: "roof_1x1",
    category: "roof",
    slotKind: "tile",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: true,
    requiresSupport: true,
    allowedOn: ["thin_wall", "pillar", "door", "window"],
    placementCost: [
      { itemId: "wood", quantity: 2 },
      { itemId: "stone", quantity: 1 },
    ],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  pillar: {
    id: "pillar",
    category: "support",
    slotKind: "corner",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: true,
    requiresSupport: true,
    allowedOn: ["floor_1x1", "pillar"],
    placementCost: [{ itemId: "wood", quantity: 2 }],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  door: {
    id: "door",
    category: "door",
    slotKind: "edge",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: true,
    requiresSupport: true,
    allowedOn: ["floor_1x1"],
    placementCost: [{ itemId: "wood", quantity: 2 }],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  window: {
    id: "window",
    category: "window",
    slotKind: "edge",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: true,
    requiresSupport: true,
    allowedOn: ["floor_1x1"],
    placementCost: [
      { itemId: "wood", quantity: 1 },
      { itemId: "stone", quantity: 1 },
    ],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },
};

export function getBuildPartDefinition(partId: BuildPartId): BuildPartDefinition | null {
  return BUILD_PARTS[partId] ?? null;
}

export function isBuildPartId(value: unknown): value is BuildPartId {
  return typeof value === "string" && value in BUILD_PARTS;
}
