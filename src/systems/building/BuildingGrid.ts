import type { BuildPartDefinition, BuildingSnapshot, PlacedBuildPart } from "./BuildingTypes";

export type BuildingGridOptions = {
  width: number;
  height: number;
  maxZ: number;
};

export type BuildingValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export class BuildingGrid {
  private readonly width: number;
  private readonly height: number;
  private readonly maxZ: number;
  private readonly cells = new Map<string, PlacedBuildPart>();
  private readonly partsById = new Map<string, PlacedBuildPart>();
  private updatedAt = Date.now();

  constructor(options: BuildingGridOptions) {
    this.width = options.width;
    this.height = options.height;
    this.maxZ = options.maxZ;
  }

  getAt(x: number, y: number, z: number): PlacedBuildPart | null {
    return this.cells.get(this.toCellKey(x, y, z)) ?? null;
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

  canPlace(definition: BuildPartDefinition, x: number, y: number, z: number): BuildingValidationResult {
    const coordinateValidation = this.validateCoordinate(x, y, z);

    if (!coordinateValidation.ok) {
      return coordinateValidation;
    }

    if (!definition.allowStackSameCell && this.getAt(x, y, z)) {
      return {
        ok: false,
        reason: "이미 해당 위치에 건설물이 있습니다.",
      };
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
      if (z <= 0) {
        return {
          ok: false,
          reason: "이 부품은 지지대 없이 지면에 바로 배치할 수 없습니다.",
        };
      }

      const below = this.getAt(x, y, z - 1);

      if (!below) {
        return {
          ok: false,
          reason: "아래에 지지하는 건설물이 없습니다.",
        };
      }

      if (definition.allowedOn !== "any" && !definition.allowedOn.includes(below.partId)) {
        return {
          ok: false,
          reason: `이 부품은 ${below.partId} 위에 배치할 수 없습니다.`,
        };
      }
    }

    return { ok: true };
  }

  place(part: PlacedBuildPart): void {
    this.cells.set(this.toCellKey(part.x, part.y, part.z), part);
    this.partsById.set(part.entityId, part);
    this.touch();
  }

  remove(entityId: string): PlacedBuildPart | null {
    const part = this.partsById.get(entityId);

    if (!part) {
      return null;
    }

    this.partsById.delete(entityId);
    this.cells.delete(this.toCellKey(part.x, part.y, part.z));
    this.touch();

    return part;
  }

  hasAnyPartAbove(x: number, y: number, z: number): boolean {
    for (let nextZ = z + 1; nextZ <= this.maxZ; nextZ += 1) {
      if (this.getAt(x, y, nextZ)) {
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
