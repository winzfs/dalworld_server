import type {
  BuildCorner,
  BuildEdge,
  BuildPartDefinition,
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

  getAt(x: number, y: number, z: number): PlacedBuildPart | null {
    return this.getTilePartAt(x, y, z);
  }

  getTilePartAt(x: number, y: number, z: number): PlacedBuildPart | null {
    const entityId = this.cells.get(this.toCellKey(x, y, z))?.tile;
    return entityId ? this.getById(entityId) : null;
  }

  getById(entityId: string): PlacedBuildPart | null {
    return this.partsById.get(entityId) ?? null;
  }

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

    if (!coordinateValidation.ok) {
      return coordinateValidation;
    }

    const slotValidation = this.validateSlotEmpty(definition, x, y, z, rotation);
    if (!slotValidation.ok) {
      return slotValidation;
    }

    if (definition.allowedOn === "ground") {
      if (z !== 0) {
        return {
          ok: false,
          reason: "이 부품은 지면에만 배치할 수 있습니다.",
        };
      }

      return { ok: true };
    }

    if (definition.requiresSupport) {
      const supportValidation = this.validateSupport(definition, x, y, z);
      if (!supportValidation.ok) {
        return supportValidation;
      }
    }

    return { ok: true };
  }

  place(part: PlacedBuildPart, definition?: BuildPartDefinition): void {
    const cell = this.getOrCreateCell(part.x, part.y, part.z);

    if (definition?.slotKind === "edge") {
      cell.edges[rotationToEdge(part.rotation)] = part.entityId;
    } else if (definition?.slotKind === "corner") {
      cell.corners[rotationToCorner(part.rotation)] = part.entityId;
    } else {
      cell.tile = part.entityId;
    }

    this.partsById.set(part.entityId, part);
    this.touch();
  }

  remove(entityId: string): PlacedBuildPart | null {
    const part = this.partsById.get(entityId);

    if (!part) {
      return null;
    }

    this.partsById.delete(entityId);
    this.removeFromCellSlots(part);
    this.touch();

    return part;
  }

  updatePart(part: PlacedBuildPart): void {
    if (!this.partsById.has(part.entityId)) {
      return;
    }

    this.partsById.set(part.entityId, part);
    this.touch();
  }

  hasAnyPartAbove(x: number, y: number, z: number): boolean {
    for (let nextZ = z + 1; nextZ <= this.maxZ; nextZ += 1) {
      const cell = this.cells.get(this.toCellKey(x, y, nextZ));
      if (!cell) continue;
      if (cell.tile || Object.keys(cell.edges).length > 0 || Object.keys(cell.corners).length > 0) {
        return true;
      }
    }

    return false;
  }

  toSnapshot(): BuildingSnapshot {
    return {
      parts: this.getAll(),
      updatedAt: this.updatedAt,
    };
  }

  private validateSlotEmpty(
    definition: BuildPartDefinition,
    x: number,
    y: number,
    z: number,
    rotation: number,
  ): BuildingValidationResult {
    const cell = this.cells.get(this.toCellKey(x, y, z));

    if (!cell) {
      return { ok: true };
    }

    if (definition.slotKind === "tile" && cell.tile) {
      return { ok: false, reason: "해당 타일 슬롯에 이미 건설물이 있습니다." };
    }

    if (definition.slotKind === "edge") {
      const edge = rotationToEdge(rotation as 0 | 1 | 2 | 3);
      if (cell.edges[edge]) {
        return { ok: false, reason: `해당 ${edge} 엣지 슬롯에 이미 건설물이 있습니다.` };
      }
    }

    if (definition.slotKind === "corner") {
      const corner = rotationToCorner(rotation as 0 | 1 | 2 | 3);
      if (cell.corners[corner]) {
        return { ok: false, reason: `해당 ${corner} 코너 슬롯에 이미 건설물이 있습니다.` };
      }
    }

    return { ok: true };
  }

  private validateSupport(
    definition: BuildPartDefinition,
    x: number,
    y: number,
    z: number,
  ): BuildingValidationResult {
    if (z === 0) {
      const floor = this.getTilePartAt(x, y, 0);
      if (!floor) {
        return { ok: false, reason: "이 부품은 바닥 위에만 배치할 수 있습니다." };
      }

      if (definition.allowedOn !== "any" && !definition.allowedOn.includes(floor.partId)) {
        return { ok: false, reason: `이 부품은 ${floor.partId} 위에 배치할 수 없습니다.` };
      }

      return { ok: true };
    }

    const belowCell = this.cells.get(this.toCellKey(x, y, z - 1));
    if (!belowCell) {
      return { ok: false, reason: "아래에 지지하는 건설물이 없습니다." };
    }

    const belowParts = [
      belowCell.tile,
      ...Object.values(belowCell.edges),
      ...Object.values(belowCell.corners),
    ]
      .filter((entityId): entityId is string => typeof entityId === "string")
      .map((entityId) => this.partsById.get(entityId))
      .filter((part): part is PlacedBuildPart => Boolean(part));

    if (belowParts.length === 0) {
      return { ok: false, reason: "아래에 지지하는 건설물이 없습니다." };
    }

    if (definition.allowedOn === "any") {
      return { ok: true };
    }

    const supported = belowParts.some((part) => definition.allowedOn.includes(part.partId));
    if (!supported) {
      return { ok: false, reason: "아래 건설물이 이 부품을 지지할 수 없습니다." };
    }

    return { ok: true };
  }

  private getOrCreateCell(x: number, y: number, z: number): CellBuildSlots {
    const key = this.toCellKey(x, y, z);
    let cell = this.cells.get(key);

    if (!cell) {
      cell = { edges: {}, corners: {} };
      this.cells.set(key, cell);
    }

    return cell;
  }

  private removeFromCellSlots(part: PlacedBuildPart): void {
    for (const [key, cell] of this.cells.entries()) {
      if (cell.tile === part.entityId) {
        delete cell.tile;
      }

      for (const edge of Object.keys(cell.edges) as BuildEdge[]) {
        if (cell.edges[edge] === part.entityId) {
          delete cell.edges[edge];
        }
      }

      for (const corner of Object.keys(cell.corners) as BuildCorner[]) {
        if (cell.corners[corner] === part.entityId) {
          delete cell.corners[corner];
        }
      }

      if (!cell.tile && Object.keys(cell.edges).length === 0 && Object.keys(cell.corners).length === 0) {
        this.cells.delete(key);
      }
    }
  }

  private validateCoordinate(x: number, y: number, z: number): BuildingValidationResult {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
      return {
        ok: false,
        reason: "건설 좌표는 정수여야 합니다.",
      };
    }

    if (x < 0 || y < 0 || z < 0) {
      return {
        ok: false,
        reason: "음수 좌표에는 배치할 수 없습니다.",
      };
    }

    if (x >= this.width || y >= this.height || z > this.maxZ) {
      return {
        ok: false,
        reason: "건설 좌표가 월드 범위를 벗어났습니다.",
      };
    }

    return { ok: true };
  }

  private toCellKey(x: number, y: number, z: number): string {
    return `${x}:${y}:${z}`;
  }

  private touch(): void {
    this.updatedAt = Date.now();
  }
}
