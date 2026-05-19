import type { BuildPartDefinition, BuildPartId } from "./BuildingTypes";

const FLOOR_SUPPORTS: BuildPartId[] = [
  "floor_1x1",
  "stone_floor_1x1",
  "deck_floor_1x1",
  "wood_round_floor",
  "stone_round_floor",
];
const STAIR_SUPPORTS: BuildPartId[] = [...FLOOR_SUPPORTS, "wood_stairs", "stone_stairs"];
const WALL_SUPPORTS: BuildPartId[] = [
  "thin_wall",
  "stone_wall",
  "half_wall",
  "railing",
  "fence",
  "wood_round_wall",
  "stone_round_wall",
  "pillar",
  "stone_pillar",
  "short_post",
  "door",
  "stone_door",
  "window",
  "wide_window",
];

const WOOD_1 = [{ itemId: "wood", quantity: 1 }] as const;
const WOOD_2 = [{ itemId: "wood", quantity: 2 }] as const;
const WOOD_3 = [{ itemId: "wood", quantity: 3 }] as const;
const STONE_1 = [{ itemId: "stone", quantity: 1 }] as const;
const STONE_2 = [{ itemId: "stone", quantity: 2 }] as const;
const STONE_3 = [{ itemId: "stone", quantity: 3 }] as const;
const STONE_4 = [{ itemId: "stone", quantity: 4 }] as const;

export const BUILD_PARTS: Record<BuildPartId, BuildPartDefinition> = {
  floor_1x1: part("floor_1x1", "floor", "tile", false, false, "ground", [...WOOD_1], [...WOOD_1]),
  stone_floor_1x1: part("stone_floor_1x1", "floor", "tile", false, false, "ground", [...STONE_2], [...STONE_1]),
  deck_floor_1x1: part("deck_floor_1x1", "floor", "tile", false, false, "ground", [...WOOD_2], [...WOOD_1]),
  wood_stairs: part("wood_stairs", "floor", "edge", false, true, STAIR_SUPPORTS, [...WOOD_3], [...WOOD_1]),
  stone_stairs: part("stone_stairs", "floor", "edge", false, true, STAIR_SUPPORTS, [...STONE_4], [...STONE_2]),
  wood_round_floor: part("wood_round_floor", "floor", "tile", false, false, "ground", [...WOOD_2], [...WOOD_1]),
  stone_round_floor: part("stone_round_floor", "floor", "tile", false, false, "ground", [...STONE_3], [...STONE_1]),

  thin_wall: part("thin_wall", "wall", "edge", true, true, FLOOR_SUPPORTS, [...WOOD_2], [...WOOD_1]),
  stone_wall: part("stone_wall", "wall", "edge", true, true, FLOOR_SUPPORTS, [...STONE_3], [...STONE_1]),
  half_wall: part("half_wall", "wall", "edge", true, true, FLOOR_SUPPORTS, [...WOOD_1], [...WOOD_1]),
  railing: part("railing", "wall", "edge", true, true, FLOOR_SUPPORTS, [...WOOD_1], [...WOOD_1]),
  fence: part("fence", "wall", "edge", true, true, FLOOR_SUPPORTS, [...WOOD_1], [...WOOD_1]),
  wood_round_wall: part("wood_round_wall", "wall", "edge", true, true, ["wood_round_floor", "stone_round_floor"], [...WOOD_2], [...WOOD_1]),
  stone_round_wall: part("stone_round_wall", "wall", "edge", true, true, ["wood_round_floor", "stone_round_floor"], [...STONE_3], [...STONE_1]),

  roof_1x1: part(
    "roof_1x1",
    "roof",
    "tile",
    true,
    true,
    WALL_SUPPORTS,
    [
      { itemId: "wood", quantity: 2 },
      { itemId: "stone", quantity: 1 },
    ],
    [...WOOD_1],
  ),
  flat_roof_1x1: part("flat_roof_1x1", "roof", "tile", true, true, WALL_SUPPORTS, [...WOOD_2], [...WOOD_1]),
  thatch_roof_1x1: part("thatch_roof_1x1", "roof", "tile", true, true, WALL_SUPPORTS, [...WOOD_1], [...WOOD_1]),

  pillar: part("pillar", "support", "corner", true, true, [...FLOOR_SUPPORTS, "pillar", "stone_pillar", "short_post"], [...WOOD_2], [...WOOD_1]),
  stone_pillar: part("stone_pillar", "support", "corner", true, true, [...FLOOR_SUPPORTS, "pillar", "stone_pillar", "short_post"], [...STONE_2], [...STONE_1]),
  short_post: part("short_post", "support", "corner", true, true, FLOOR_SUPPORTS, [...WOOD_1], [...WOOD_1]),

  door: part("door", "door", "edge", true, true, FLOOR_SUPPORTS, [...WOOD_2], [...WOOD_1]),
  stone_door: part(
    "stone_door",
    "door",
    "edge",
    true,
    true,
    FLOOR_SUPPORTS,
    [
      { itemId: "wood", quantity: 1 },
      { itemId: "stone", quantity: 2 },
    ],
    [...STONE_1],
  ),

  window: part(
    "window",
    "window",
    "edge",
    true,
    true,
    FLOOR_SUPPORTS,
    [
      { itemId: "wood", quantity: 1 },
      { itemId: "stone", quantity: 1 },
    ],
    [...WOOD_1],
  ),
  wide_window: part(
    "wide_window",
    "window",
    "edge",
    true,
    true,
    FLOOR_SUPPORTS,
    [
      { itemId: "wood", quantity: 2 },
      { itemId: "stone", quantity: 1 },
    ],
    [...WOOD_1],
  ),
};

export function getBuildPartDefinition(partId: BuildPartId): BuildPartDefinition | null {
  return BUILD_PARTS[partId] ?? null;
}

export function isBuildPartId(value: unknown): value is BuildPartId {
  return typeof value === "string" && value in BUILD_PARTS;
}

function part(
  id: BuildPartId,
  category: BuildPartDefinition["category"],
  slotKind: BuildPartDefinition["slotKind"],
  blocksMovement: boolean,
  requiresSupport: boolean,
  allowedOn: BuildPartDefinition["allowedOn"],
  placementCost: BuildPartDefinition["placementCost"],
  refundOnRemove: BuildPartDefinition["refundOnRemove"],
): BuildPartDefinition {
  return {
    id,
    category,
    slotKind,
    size: { w: 1, d: 1, h: 1 },
    blocksMovement,
    requiresSupport,
    allowedOn,
    placementCost,
    refundOnRemove,
  };
}
