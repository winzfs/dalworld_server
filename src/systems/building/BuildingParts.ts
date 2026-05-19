import type { BuildPartDefinition, BuildPartId } from "./BuildingTypes";

export const BUILD_PARTS: Record<BuildPartId, BuildPartDefinition> = {
  floor_1x1: {
    id: "floor_1x1",
    category: "floor",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: false,
    requiresSupport: false,
    allowedOn: "ground",
    allowStackSameCell: false,
    placementCost: [{ itemId: "wood", quantity: 1 }],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  wall_ne: {
    id: "wall_ne",
    category: "wall",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: true,
    requiresSupport: true,
    allowedOn: ["floor_1x1"],
    allowStackSameCell: false,
    placementCost: [{ itemId: "wood", quantity: 2 }],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  wall_nw: {
    id: "wall_nw",
    category: "wall",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: true,
    requiresSupport: true,
    allowedOn: ["floor_1x1"],
    allowStackSameCell: false,
    placementCost: [{ itemId: "wood", quantity: 2 }],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  corner: {
    id: "corner",
    category: "wall",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: true,
    requiresSupport: true,
    allowedOn: ["floor_1x1"],
    allowStackSameCell: false,
    placementCost: [{ itemId: "wood", quantity: 2 }],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  column: {
    id: "column",
    category: "support",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: true,
    requiresSupport: true,
    allowedOn: ["floor_1x1", "column"],
    allowStackSameCell: false,
    placementCost: [{ itemId: "wood", quantity: 2 }],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  stair: {
    id: "stair",
    category: "stair",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: false,
    requiresSupport: true,
    allowedOn: ["floor_1x1"],
    allowStackSameCell: false,
    placementCost: [
      { itemId: "wood", quantity: 2 },
      { itemId: "stone", quantity: 1 },
    ],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  roof: {
    id: "roof",
    category: "roof",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: true,
    requiresSupport: true,
    allowedOn: ["wall_ne", "wall_nw", "corner", "column"],
    allowStackSameCell: false,
    placementCost: [
      { itemId: "wood", quantity: 2 },
      { itemId: "fiber", quantity: 1 },
    ],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },

  door: {
    id: "door",
    category: "door",
    size: { w: 1, d: 1, h: 1 },
    blocksMovement: false,
    requiresSupport: true,
    allowedOn: ["floor_1x1"],
    allowStackSameCell: false,
    placementCost: [{ itemId: "wood", quantity: 2 }],
    refundOnRemove: [{ itemId: "wood", quantity: 1 }],
  },
};

export function getBuildPartDefinition(partId: BuildPartId): BuildPartDefinition | null {
  return BUILD_PARTS[partId] ?? null;
}

export function isBuildPartId(value: unknown): value is BuildPartId {
  return typeof value === "string" && value in BUILD_PARTS;
}
