import { getBuildPartDefinition } from "./BuildingParts";
import type {
  BuildCategory,
  BuildCorner,
  BuildEdge,
  BuildPartDefinition,
  BuildRotation,
  BuildingSnapshot,
  PlacedBuildPart,
} from "./BuildingTypes";
import { rotationToCorner, rotationToEdge } from "./BuildingTypes";

export type BuildingGridOptions = {
  width: number;
  height: number;
  maxZ: number;
};

export type BuildingValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

type CellBuildSlots = {
  tile?: string;
  edges: Partial<Record<BuildEdge, string>>;
  corners: Partial<Record<BuildCorner, string>>;
};

type Point = { x: number; y: number };

const ISO_TILE_WIDTH = 64;
const ISO_TILE_HEIGHT = 32;
const ISO_LAYER_HEIGHT = 32;
const STACKABLE_EDGE_CATEGORIES: BuildCategory[] = ["wall", "door", "window"];
const UPPER_TILE_SUPPORT_CATEGORIES: BuildCategory[] = ["floor", "wall", "door", "window", "support"];

export class BuildingGrid {
  private readonly width: number;
  private readonly height: number;
  private readonly maxZ: number;
  private readonly cells = new Map<string, CellBuildSlots>();
  private readonly partsById = new Map<string, PlacedBuildPart>();
  private updatedAt = Date.now();

  constructor(options: BuildingGridOptions) {
    this.width = options.width;
    this.height = options.height;
    this.maxZ = options.maxZ;
  }

  getAt(x: number, y: number, z: number): PlacedBuildPart | null { return this.getTilePartAt(x, y, z); }

  getTilePartAt(x: number, y: number, z: number): PlacedBuildPart | null {
    const entityId = this.cells.get(this.toCellKey(x, y, z))?.tile;
    return entityId ? this.getById(entityId) : null;
  }

  getById(entityId: string): PlacedBuildPart | null { return this.partsById.get(entityId) ?? null; }

  getAll(): PlacedBuildPart[] {
    return [...this.partsById.values()].sort((a, b) => {
      const byLayer = a.z - b.z;
      if (byLayer !== 0) return byLayer;
      const byDepth = a.x + a.y - (b.x + b.y);
      if (byDepth !== 0) return byDepth;
      return a.entityId.localeCompare(b.entityId);
    });
  }

  canPlace(definition: BuildPartDefinition, x: number, y: number, z: number, rotation = 0): BuildingValidationResult {
    const coordinateValidation = this.validateCoordinate(x, y, z);
    if (!coordinateValidation.ok) return coordinateValidation;

    const slotValidation = this.validateSlotEmpty(definition, x, y, z, rotation);
    if (!slotValidation.ok) return slotValidation;

    if (definition.allowedOn === "ground") {
      if (z === 0) return { ok: true };
      if (definition.category === "floor") return this.validateUpperTileSupport(x, y, z);
      return { ok: false, reason: "이 부품은 지면에만 배치할 수 있습니다." };
    }

    if (definition.requiresSupport) {
      const supportValidation = this.validateSupport(definition, x, y, z, rotation as BuildRotation);
      if (!supportValidation.ok) return supportValidation;
    }

    return { ok: true };
  }

  canMove(entityId: string, x: number, y: number, z: number, rotation: BuildRotation): BuildingValidationResult {
    const current = this.getById(entityId);
    if (!current) return { ok: false, reason: "이동할 건설물을 찾을 수 없습니다." };

    const definition = getBuildPartDefinition(current.partId);
    if (!definition) return { ok: false, reason: "건설물 정의를 찾을 수 없습니다." };

    this.removeFromCellSlots(current);
    const validation = this.canPlace(definition, x, y, z, rotation);
    this.assignPartToCell(current, definition);
    return validation;
  }

  move(entityId: string, x: number, y: number, z: number, rotation: BuildRotation): PlacedBuildPart | null {
    const current = this.getById(entityId);
    if (!current) return null;
    const definition = getBuildPartDefinition(current.partId);
    if (!definition) return null;

    this.removeFromCellSlots(current);
    const updated: PlacedBuildPart = { ...current, x, y, z, rotation };
    this.partsById.set(entityId, updated);
    this.assignPartToCell(updated, definition);
    this.touch();
    return updated;
  }

  canOccupyWorldCircle(worldX: number, worldY: number, radius: number): boolean { return !this.blocksWorldCircle(worldX, worldY, radius); }

  blocksWorldCircle(worldX: number, worldY: number, radius: number): boolean {
    const grid = screenToGridApprox(worldX, worldY, 0);
    for (let y = grid.y - 1; y <= grid.y + 1; y += 1) {
      for (let x = grid.x - 1; x <= grid.x + 1; x += 1) {
        if (this.cellBlocksWorldCircle(x, y, 0, worldX, worldY, radius)) return true;
      }
    }
    return false;
  }

  place(part: PlacedBuildPart, definition?: BuildPartDefinition): void {
    this.assignPartToCell(part, definition ?? getBuildPartDefinition(part.partId) ?? undefined);
    this.partsById.set(part.entityId, part);
    this.touch();
  }

  remove(entityId: string): PlacedBuildPart | null {
    const part = this.partsById.get(entityId);
    if (!part) return null;
    this.partsById.delete(entityId);
    this.removeFromCellSlots(part);
    this.touch();
    return part;
  }

  updatePart(part: PlacedBuildPart): void {
    if (!this.partsById.has(part.entityId)) return;
    const definition = getBuildPartDefinition(part.partId) ?? undefined;
    this.removeFromCellSlots(part);
    this.partsById.set(part.entityId, part);
    this.assignPartToCell(part, definition);
    this.touch();
  }

  hasBlockingPartAbove(part: PlacedBuildPart): boolean {
    const definition = getBuildPartDefinition(part.partId);
    if (!definition) return false;

    const aboveCell = this.cells.get(this.toCellKey(part.x, part.y, part.z + 1));
    if (!aboveCell) return false;

    if (definition.slotKind === "edge") {
      return Boolean(aboveCell.edges[rotationToEdge(part.rotation)]);
    }

    if (definition.slotKind === "corner") {
      return Boolean(aboveCell.corners[rotationToCorner(part.rotation)]);
    }

    return Boolean(aboveCell.tile);
  }

  hasAnyPartAbove(x: number, y: number, z: number): boolean {
    for (let nextZ = z + 1; nextZ <= this.maxZ; nextZ += 1) {
      const cell = this.cells.get(this.toCellKey(x, y, nextZ));
      if (!cell) continue;
      if (cell.tile || Object.keys(cell.edges).length > 0 || Object.keys(cell.corners).length > 0) return true;
    }
    return false;
  }

  toSnapshot(): BuildingSnapshot { return { parts: this.getAll(), updatedAt: this.updatedAt }; }

  private assignPartToCell(part: PlacedBuildPart, definition?: BuildPartDefinition): void {
    if (!definition) return;
    const cell = this.getOrCreateCell(part.x, part.y, part.z);
    if (definition.slotKind === "edge") cell.edges[rotationToEdge(part.rotation)] = part.entityId;
    else if (definition.slotKind === "corner") cell.corners[rotationToCorner(part.rotation)] = part.entityId;
    else cell.tile = part.entityId;
  }

  private cellBlocksWorldCircle(x: number, y: number, z: number, worldX: number, worldY: number, radius: number): boolean {
    const cell = this.cells.get(this.toCellKey(x, y, z));
    if (!cell) return false;
    const parts = [cell.tile, ...Object.values(cell.edges), ...Object.values(cell.corners)]
      .filter((entityId): entityId is string => typeof entityId === "string")
      .map((entityId) => this.partsById.get(entityId))
      .filter((part): part is PlacedBuildPart => Boolean(part));
    return parts.some((part) => this.partBlocksWorldCircle(part, worldX, worldY, radius));
  }

  private partBlocksWorldCircle(part: PlacedBuildPart, worldX: number, worldY: number, radius: number): boolean {
    const definition = getBuildPartDefinition(part.partId);
    if (!definition?.blocksMovement) return false;
    if (definition.category === "door" && part.state?.open === true) return false;
    if (definition.category === "floor" || definition.category === "roof") return false;
    const center = gridToScreen(part.x, part.y, part.z);
    if (definition.slotKind === "edge") return distancePointToSegment(worldX, worldY, getEdgeSegment(center, part.rotation).a, getEdgeSegment(center, part.rotation).b) <= radius + 6;
    if (definition.slotKind === "corner") return distance(worldX, worldY, getCornerPoint(center, part.rotation).x, getCornerPoint(center, part.rotation).y) <= radius + 8;
    return pointInIsoDiamond(worldX, worldY, center, radius);
  }

  private validateSlotEmpty(definition: BuildPartDefinition, x: number, y: number, z: number, rotation: number): BuildingValidationResult {
    const cell = this.cells.get(this.toCellKey(x, y, z));
    if (!cell) return { ok: true };
    if (definition.slotKind === "tile" && cell.tile) return { ok: false, reason: "해당 타일 슬롯에 이미 건설물이 있습니다." };
    if (definition.slotKind === "edge" && cell.edges[rotationToEdge(rotation as BuildRotation)]) return { ok: false, reason: "해당 엣지 슬롯에 이미 건설물이 있습니다." };
    if (definition.slotKind === "corner" && cell.corners[rotationToCorner(rotation as BuildRotation)]) return { ok: false, reason: "해당 코너 슬롯에 이미 건설물이 있습니다." };
    return { ok: true };
  }

  private validateSupport(definition: BuildPartDefinition, x: number, y: number, z: number, rotation: BuildRotation): BuildingValidationResult {
    if (z === 0) {
      const floor = this.getTilePartAt(x, y, 0);
      if (!floor) return { ok: false, reason: "이 부품은 바닥 위에만 배치할 수 있습니다." };
      if (definition.allowedOn !== "any" && !definition.allowedOn.includes(floor.partId)) return { ok: false, reason: `이 부품은 ${floor.partId} 위에 배치할 수 없습니다.` };
      return { ok: true };
    }

    const belowCell = this.cells.get(this.toCellKey(x, y, z - 1));
    if (!belowCell) return { ok: false, reason: "아래에 지지하는 건설물이 없습니다." };

    if (definition.slotKind === "edge" && STACKABLE_EDGE_CATEGORIES.includes(definition.category)) {
      const sameEdgePart = this.getEdgePartFromCell(belowCell, rotation);
      const supportDefinition = sameEdgePart ? getBuildPartDefinition(sameEdgePart.partId) : null;
      if (supportDefinition && STACKABLE_EDGE_CATEGORIES.includes(supportDefinition.category)) return { ok: true };
    }

    const belowParts = [belowCell.tile, ...Object.values(belowCell.edges), ...Object.values(belowCell.corners)]
      .filter((entityId): entityId is string => typeof entityId === "string")
      .map((entityId) => this.partsById.get(entityId))
      .filter((part): part is PlacedBuildPart => Boolean(part));
    if (belowParts.length === 0) return { ok: false, reason: "아래에 지지하는 건설물이 없습니다." };
    if (definition.allowedOn === "any") return { ok: true };
    return belowParts.some((part) => definition.allowedOn.includes(part.partId)) ? { ok: true } : { ok: false, reason: "아래 건설물이 이 부품을 지지할 수 없습니다." };
  }

  private validateUpperTileSupport(x: number, y: number, z: number): BuildingValidationResult {
    if (z <= 0) return { ok: true };
    const belowCell = this.cells.get(this.toCellKey(x, y, z - 1));
    if (!belowCell) return { ok: false, reason: "위층 바닥을 받칠 벽/기둥이 없습니다." };

    const supported = [belowCell.tile, ...Object.values(belowCell.edges), ...Object.values(belowCell.corners)]
      .filter((entityId): entityId is string => typeof entityId === "string")
      .map((entityId) => this.partsById.get(entityId))
      .filter((part): part is PlacedBuildPart => Boolean(part))
      .some((part) => {
        const supportDefinition = getBuildPartDefinition(part.partId);
        return Boolean(supportDefinition && UPPER_TILE_SUPPORT_CATEGORIES.includes(supportDefinition.category));
      });

    return supported ? { ok: true } : { ok: false, reason: "위층 바닥을 받칠 벽/기둥이 없습니다." };
  }

  private getEdgePartFromCell(cell: CellBuildSlots, rotation: BuildRotation): PlacedBuildPart | null {
    const entityId = cell.edges[rotationToEdge(rotation)];
    return entityId ? this.partsById.get(entityId) ?? null : null;
  }

  private getOrCreateCell(x: number, y: number, z: number): CellBuildSlots {
    const key = this.toCellKey(x, y, z);
    let cell = this.cells.get(key);
    if (!cell) { cell = { edges: {}, corners: {} }; this.cells.set(key, cell); }
    return cell;
  }

  private removeFromCellSlots(part: PlacedBuildPart): void {
    for (const [key, cell] of this.cells.entries()) {
      if (cell.tile === part.entityId) delete cell.tile;
      for (const edge of Object.keys(cell.edges) as BuildEdge[]) if (cell.edges[edge] === part.entityId) delete cell.edges[edge];
      for (const corner of Object.keys(cell.corners) as BuildCorner[]) if (cell.corners[corner] === part.entityId) delete cell.corners[corner];
      if (!cell.tile && Object.keys(cell.edges).length === 0 && Object.keys(cell.corners).length === 0) this.cells.delete(key);
    }
  }

  private validateCoordinate(x: number, y: number, z: number): BuildingValidationResult {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return { ok: false, reason: "건설 좌표는 정수여야 합니다." };
    if (x < 0 || y < 0 || z < 0) return { ok: false, reason: "음수 좌표에는 배치할 수 없습니다." };
    if (x >= this.width || y >= this.height || z > this.maxZ) return { ok: false, reason: "건설 좌표가 월드 범위를 벗어났습니다." };
    return { ok: true };
  }

  private toCellKey(x: number, y: number, z: number): string { return `${x}:${y}:${z}`; }
  private touch(): void { this.updatedAt = Date.now(); }
}

function gridToScreen(x: number, y: number, z: number): Point { return { x: (x - y) * (ISO_TILE_WIDTH / 2), y: (x + y) * (ISO_TILE_HEIGHT / 2) - z * ISO_LAYER_HEIGHT }; }
function screenToGridApprox(screenX: number, screenY: number, z = 0): { x: number; y: number; z: number } { const adjustedY = screenY + z * ISO_LAYER_HEIGHT; return { x: Math.floor(adjustedY / ISO_TILE_HEIGHT + screenX / ISO_TILE_WIDTH), y: Math.floor(adjustedY / ISO_TILE_HEIGHT - screenX / ISO_TILE_WIDTH), z }; }
function getEdgeSegment(center: Point, rotation: BuildRotation): { a: Point; b: Point } { const halfW = ISO_TILE_WIDTH / 2; const halfH = ISO_TILE_HEIGHT / 2; const north = { x: center.x, y: center.y - halfH }; const east = { x: center.x + halfW, y: center.y }; const south = { x: center.x, y: center.y + halfH }; const west = { x: center.x - halfW, y: center.y }; switch (rotation) { case 0: return { a: west, b: north }; case 1: return { a: north, b: east }; case 2: return { a: east, b: south }; case 3: return { a: south, b: west }; } }
function getCornerPoint(center: Point, rotation: BuildRotation): Point { const halfW = ISO_TILE_WIDTH / 2; const halfH = ISO_TILE_HEIGHT / 2; switch (rotation) { case 0: return { x: center.x - halfW, y: center.y }; case 1: return { x: center.x, y: center.y - halfH }; case 2: return { x: center.x + halfW, y: center.y }; case 3: return { x: center.x, y: center.y + halfH }; } }
function distancePointToSegment(px: number, py: number, a: Point, b: Point): number { const dx = b.x - a.x; const dy = b.y - a.y; const len = dx * dx + dy * dy; if (len === 0) return distance(px, py, a.x, a.y); const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len)); return distance(px, py, a.x + t * dx, a.y + t * dy); }
function distance(ax: number, ay: number, bx: number, by: number): number { const dx = ax - bx; const dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function pointInIsoDiamond(x: number, y: number, center: Point, padding: number): boolean { return Math.abs(x - center.x) / (ISO_TILE_WIDTH / 2 + padding) + Math.abs(y - center.y) / (ISO_TILE_HEIGHT / 2 + padding) <= 1; }
