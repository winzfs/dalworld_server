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

export function canCircleOccupyWorldMap(
  map: GameWorldMap | null | undefined,
  x: number,
  y: number,
  radius: number,
): boolean {
  if (!map) return true;

  const minCellX = Math.floor((x - radius) / map.cellSize);
  const maxCellX = Math.floor((x + radius) / map.cellSize);
  const minCellY = Math.floor((y - radius) / map.cellSize);
  const maxCellY = Math.floor((y + radius) / map.cellSize);

  for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      const cell = getCell(map, cellX, cellY);
      if (!cell) continue;

      const offsetX = cell.gridX * map.cellSize;
      const offsetY = cell.gridY * map.cellSize;
      for (const placement of cell.placements) {
        if (!isBlockingPlacement(placement)) continue;
        if (circleOverlapsPlacement(x, y, radius, placement, offsetX, offsetY)) return false;
      }
    }
  }

  return true;
}

function isBlockingPlacement(placement: WorldMapPlacement): boolean {
  if (placement.layer === 'collision') return true;
  if (placement.gameplay?.kind === 'resource' && placement.gameplay.blocksMovement !== false) return true;
  return false;
}

function circleOverlapsPlacement(
  x: number,
  y: number,
  radius: number,
  placement: WorldMapPlacement,
  offsetX = 0,
  offsetY = 0,
): boolean {
  const scale = Number.isFinite(placement.scale) ? Math.max(0.1, placement.scale) : 1;
  const width = (placement.displayWidth ?? placement.sourceRect?.width ?? 32) * scale;
  const height = (placement.displayHeight ?? placement.sourceRect?.height ?? 32) * scale;
  const px = placement.x + offsetX;
  const py = placement.y + offsetY;

  return (
    x + radius > px &&
    x - radius < px + width &&
    y + radius > py &&
    y - radius < py + height
  );
}
