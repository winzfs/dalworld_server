import type { BuildPartDefinition, BuildPartId } from './BuildingTypes';

type Row = [BuildPartId, BuildPartDefinition['category'], BuildPartDefinition['slotKind'], boolean, boolean, BuildPartDefinition['allowedOn'], BuildPartDefinition['placementCost'], BuildPartDefinition['refundOnRemove']];

const FLOOR_SUPPORTS: BuildPartId[] = ['floor_1x1', 'stone_floor_1x1', 'deck_floor_1x1', 'wood_half_floor', 'stone_half_floor', 'wood_stair_landing', 'stone_stair_landing', 'wood_round_floor', 'stone_round_floor'];
const STAIR_SUPPORTS: BuildPartId[] = [...FLOOR_SUPPORTS, 'wood_stairs', 'stone_stairs', 'wood_corner_stairs', 'stone_corner_stairs'];
const WALL_SUPPORTS: BuildPartId[] = ['thin_wall', 'wood_wall_sprite_test', 'stone_wall', 'half_wall', 'railing', 'fence', 'wood_wall_corner', 'stone_wall_corner', 'wood_wall_end', 'stone_wall_end', 'wood_gable_wall', 'stone_gable_wall', 'wood_round_wall', 'stone_round_wall', 'wood_beam_horizontal', 'stone_beam_horizontal', 'wood_diagonal_support', 'stone_diagonal_support', 'pillar', 'stone_pillar', 'short_post', 'door', 'stone_door', 'window', 'wide_window'];

const W1 = [{ itemId: 'wood', quantity: 1 }];
const W2 = [{ itemId: 'wood', quantity: 2 }];
const W3 = [{ itemId: 'wood', quantity: 3 }];
const W4 = [{ itemId: 'wood', quantity: 4 }];
const S1 = [{ itemId: 'stone', quantity: 1 }];
const S2 = [{ itemId: 'stone', quantity: 2 }];
const S3 = [{ itemId: 'stone', quantity: 3 }];
const S4 = [{ itemId: 'stone', quantity: 4 }];
const S5 = [{ itemId: 'stone', quantity: 5 }];
const STATION_WORKBENCH = [{ itemId: 'workbench', quantity: 1 }];

const rows: Row[] = [
  ['floor_1x1', 'floor', 'tile', false, false, 'ground', W1, W1],
  ['stone_floor_1x1', 'floor', 'tile', false, false, 'ground', S2, S1],
  ['deck_floor_1x1', 'floor', 'tile', false, false, 'ground', W2, W1],
  ['wood_half_floor', 'floor', 'tile', false, false, 'ground', W1, W1],
  ['stone_half_floor', 'floor', 'tile', false, false, 'ground', S1, S1],
  ['wood_stair_landing', 'floor', 'tile', false, true, FLOOR_SUPPORTS, W2, W1],
  ['stone_stair_landing', 'floor', 'tile', false, true, FLOOR_SUPPORTS, S2, S1],
  ['wood_stairs', 'floor', 'edge', false, true, STAIR_SUPPORTS, W3, W1],
  ['stone_stairs', 'floor', 'edge', false, true, STAIR_SUPPORTS, S4, S2],
  ['wood_corner_stairs', 'floor', 'corner', false, true, STAIR_SUPPORTS, W4, W2],
  ['stone_corner_stairs', 'floor', 'corner', false, true, STAIR_SUPPORTS, S5, S2],
  ['wood_round_floor', 'floor', 'tile', false, false, 'ground', W2, W1],
  ['stone_round_floor', 'floor', 'tile', false, false, 'ground', S3, S1],
  ['thin_wall', 'wall', 'edge', true, true, FLOOR_SUPPORTS, W2, W1],
  ['wood_wall_sprite_test', 'wall', 'edge', true, true, FLOOR_SUPPORTS, W2, W1],
  ['stone_wall', 'wall', 'edge', true, true, FLOOR_SUPPORTS, S3, S1],
  ['half_wall', 'wall', 'edge', true, true, FLOOR_SUPPORTS, W1, W1],
  ['railing', 'wall', 'edge', true, true, FLOOR_SUPPORTS, W1, W1],
  ['fence', 'wall', 'edge', true, true, FLOOR_SUPPORTS, W1, W1],
  ['wood_wall_corner', 'wall', 'corner', true, true, FLOOR_SUPPORTS, W2, W1],
  ['stone_wall_corner', 'wall', 'corner', true, true, FLOOR_SUPPORTS, S3, S1],
  ['wood_wall_end', 'wall', 'edge', true, true, FLOOR_SUPPORTS, W1, W1],
  ['stone_wall_end', 'wall', 'edge', true, true, FLOOR_SUPPORTS, S2, S1],
  ['wood_gable_wall', 'wall', 'edge', true, true, FLOOR_SUPPORTS, W2, W1],
  ['stone_gable_wall', 'wall', 'edge', true, true, FLOOR_SUPPORTS, S3, S1],
  ['wood_round_wall', 'wall', 'edge', true, true, FLOOR_SUPPORTS, W2, W1],
  ['stone_round_wall', 'wall', 'edge', true, true, FLOOR_SUPPORTS, S3, S1],
  ['wood_beam_horizontal', 'support', 'edge', true, true, WALL_SUPPORTS, W2, W1],
  ['stone_beam_horizontal', 'support', 'edge', true, true, WALL_SUPPORTS, S3, S1],
  ['wood_diagonal_support', 'support', 'edge', true, true, WALL_SUPPORTS, W1, W1],
  ['stone_diagonal_support', 'support', 'edge', true, true, WALL_SUPPORTS, S2, S1],
  ['roof_1x1', 'roof', 'tile', true, true, WALL_SUPPORTS, [{ itemId: 'wood', quantity: 2 }, { itemId: 'stone', quantity: 1 }], W1],
  ['flat_roof_1x1', 'roof', 'tile', true, true, WALL_SUPPORTS, W2, W1],
  ['thatch_roof_1x1', 'roof', 'tile', true, true, WALL_SUPPORTS, W1, W1],
  ['wood_roof_slope', 'roof', 'tile', true, true, WALL_SUPPORTS, W3, W1],
  ['stone_roof_slope', 'roof', 'tile', true, true, WALL_SUPPORTS, S4, S2],
  ['thatch_roof_slope', 'roof', 'tile', true, true, WALL_SUPPORTS, W2, W1],
  ['wood_roof_corner', 'roof', 'corner', true, true, WALL_SUPPORTS, W3, W1],
  ['stone_roof_corner', 'roof', 'corner', true, true, WALL_SUPPORTS, S4, S2],
  ['thatch_roof_corner', 'roof', 'corner', true, true, WALL_SUPPORTS, W2, W1],
  ['wood_roof_ridge', 'roof', 'edge', true, true, WALL_SUPPORTS, W1, W1],
  ['stone_roof_ridge', 'roof', 'edge', true, true, WALL_SUPPORTS, S2, S1],
  ['thatch_roof_ridge', 'roof', 'edge', true, true, WALL_SUPPORTS, W1, W1],
  ['wood_eave', 'roof', 'edge', true, true, WALL_SUPPORTS, W1, W1],
  ['stone_eave', 'roof', 'edge', true, true, WALL_SUPPORTS, S2, S1],
  ['thatch_eave', 'roof', 'edge', true, true, WALL_SUPPORTS, W1, W1],
  ['pillar', 'support', 'corner', true, true, [...FLOOR_SUPPORTS, 'pillar', 'stone_pillar', 'short_post'], W2, W1],
  ['stone_pillar', 'support', 'corner', true, true, [...FLOOR_SUPPORTS, 'pillar', 'stone_pillar', 'short_post'], S2, S1],
  ['short_post', 'support', 'corner', true, true, FLOOR_SUPPORTS, W1, W1],
  ['door', 'door', 'edge', true, true, FLOOR_SUPPORTS, W2, W1],
  ['stone_door', 'door', 'edge', true, true, FLOOR_SUPPORTS, [{ itemId: 'wood', quantity: 1 }, { itemId: 'stone', quantity: 2 }], S1],
  ['window', 'window', 'edge', true, true, FLOOR_SUPPORTS, [{ itemId: 'wood', quantity: 1 }, { itemId: 'stone', quantity: 1 }], W1],
  ['wide_window', 'window', 'edge', true, true, FLOOR_SUPPORTS, [{ itemId: 'wood', quantity: 2 }, { itemId: 'stone', quantity: 1 }], W1],
  ['station_workbench', 'station', 'tile', true, false, 'ground', STATION_WORKBENCH, STATION_WORKBENCH],
];

export const BUILD_PARTS: Record<BuildPartId, BuildPartDefinition> = Object.fromEntries(rows.map((row) => [row[0], part(...row)])) as Record<BuildPartId, BuildPartDefinition>;

export function getBuildPartDefinition(partId: BuildPartId): BuildPartDefinition | null {
  return BUILD_PARTS[partId] ?? null;
}

export function isBuildPartId(value: unknown): value is BuildPartId {
  return typeof value === 'string' && value in BUILD_PARTS;
}

function part(...row: Row): BuildPartDefinition {
  const [id, category, slotKind, blocksMovement, requiresSupport, allowedOn, placementCost, refundOnRemove] = row;
  return {
    id,
    category,
    slotKind,
    size: { w: 1, d: 1, h: 1 },
    blocksMovement,
    requiresSupport,
    allowedOn,
    placementCost: placementCost.map((item) => ({ ...item })),
    refundOnRemove: refundOnRemove.map((item) => ({ ...item })),
  };
}
