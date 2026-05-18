import type { GameWorldMap, WorldMapCell, WorldMapPlacement } from './types';

export function getCell(
  map: GameWorldMap | null | undefined,
  cellX: number,
  cellY: number,
): WorldMapCell | null {
  if (!map) return null;
  return map.cells.find((cell) => cell.gridX === cellX && cell.gridY === cellY) ?? null;
}

export function getCellCollisionPlacements(
  map: GameWorldMap | null | undefined,
  cellX: number,
  cellY: number,
): WorldMapPlacement[] {
  const cell = getCell(map, cellX, cellY);
  if (!cell) return [];
  return cell.placements.filter((placement) => placement.layer === 'collision');
}

export function canCircleOccupyCell(
  map: GameWorldMap | null | undefined,
  cellX: number,
  cellY: number,
  x: number,
  y: number,
  radius: number,
): boolean {
  for (const placement of getCellCollisionPlacements(map, cellX, cellY)) {
    const scale = Number.isFinite(placement.scale) ? Math.max(0.1, placement.scale) : 1;
    const width = (placement.sourceRect?.width ?? 32) * scale;
    const height = (placement.sourceRect?.height ?? 32) * scale;

    if (
      x + radius > placement.x &&
      x - radius < placement.x + width &&
      y + radius > placement.y &&
      y - radius < placement.y + height
    ) {
      return false;
    }
  }

  return true;
}

export function getCollisionPlacements(map: GameWorldMap | null | undefined): WorldMapPlacement[] {
  if (!map) return [];

  const placements: WorldMapPlacement[] = [];

  for (const cell of map.cells) {
    for (const placement of cell.placements) {
      if (placement.layer !== 'collision') continue;
      placements.push({
        ...placement,
        x: placement.x + cell.gridX * map.cellSize,
        y: placement.y + cell.gridY * map.cellSize,
      });
    }
  }

  return placements;
}

export function canCircleOccupyWorldMap(
  map: GameWorldMap | null | undefined,
  x: number,
  y: number,
  radius: number,
): boolean {
  for (const placement of getCollisionPlacements(map)) {
    const scale = Number.isFinite(placement.scale) ? Math.max(0.1, placement.scale) : 1;
    const width = (placement.sourceRect?.width ?? 32) * scale;
    const height = (placement.sourceRect?.height ?? 32) * scale;

    if (
      x + radius > placement.x &&
      x - radius < placement.x + width &&
      y + radius > placement.y &&
      y - radius < placement.y + height
    ) {
      return false;
    }
  }

  return true;
}
