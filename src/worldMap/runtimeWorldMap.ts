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
  return cell.placements.filter(isBlockingPlacement);
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
    if (circleOverlapsPlacement(x, y, radius, placement)) return false;
  }

  return true;
}

export function getCollisionPlacements(map: GameWorldMap | null | undefined): WorldMapPlacement[] {
  if (!map) return [];

  const placements: WorldMapPlacement[] = [];

  for (const cell of map.cells) {
    for (const placement of cell.placements) {
      if (!isBlockingPlacement(placement)) continue;
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
    if (circleOverlapsPlacement(x, y, radius, placement)) return false;
  }

  return true;
}

function isBlockingPlacement(placement: WorldMapPlacement): boolean {
  if (placement.layer === 'collision') return true;
  if (placement.gameplay?.kind === 'resource' && placement.gameplay.blocksMovement !== false) return true;
  return false;
}

function circleOverlapsPlacement(x: number, y: number, radius: number, placement: WorldMapPlacement): boolean {
  const scale = Number.isFinite(placement.scale) ? Math.max(0.1, placement.scale) : 1;
  const width = (placement.displayWidth ?? placement.sourceRect?.width ?? 32) * scale;
  const height = (placement.displayHeight ?? placement.sourceRect?.height ?? 32) * scale;

  return (
    x + radius > placement.x &&
    x - radius < placement.x + width &&
    y + radius > placement.y &&
    y - radius < placement.y + height
  );
}
