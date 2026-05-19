import { InventoryStore } from "../inventory/InventoryStore";
import { getBuildPartDefinition, isBuildPartId } from "./BuildingParts";
import { BuildingGrid } from "./BuildingGrid";
import type {
  BuildDoorToggleRequest,
  BuildPlaceRequest,
  BuildRemoveRequest,
  BuildingServerEvent,
  PlacedBuildPart,
} from "./BuildingTypes";

export type BuildingServiceOptions = {
  grid: BuildingGrid;
  getInventory(ownerId: string): InventoryStore;
  createEntityId(): string;
  now(): number;
};

export type BuildingCommandResult = {
  events: BuildingServerEvent[];
};

export class BuildingService {
  private readonly grid: BuildingGrid;
  private readonly getInventory: (ownerId: string) => InventoryStore;
  private readonly createEntityId: () => string;
  private readonly now: () => number;

  constructor(options: BuildingServiceOptions) {
    this.grid = options.grid;
    this.getInventory = options.getInventory;
    this.createEntityId = options.createEntityId;
    this.now = options.now;
  }

  createInitialSyncEvents(ownerId: string): BuildingServerEvent[] {
    const inventory = this.getInventory(ownerId).toSnapshot();

    return [
      {
        type: "BUILD_SNAPSHOT",
        snapshot: this.grid.toSnapshot(),
      },
      {
        type: "INVENTORY_SNAPSHOT",
        ownerId: inventory.ownerId,
        items: inventory.items,
        updatedAt: inventory.updatedAt,
      },
    ];
  }

  place(ownerId: string, request: unknown): BuildingCommandResult {
    const parsed = this.parsePlaceRequest(request);

    if (!parsed.ok) {
      return this.reject(parsed.requestId, parsed.reason);
    }

    const definition = getBuildPartDefinition(parsed.request.partId);

    if (!definition) {
      return this.reject(parsed.request.requestId, "존재하지 않는 건설 부품입니다.");
    }

    const placementValidation = this.grid.canPlace(
      definition,
      parsed.request.x,
      parsed.request.y,
      parsed.request.z,
      parsed.request.rotation,
    );

    if (!placementValidation.ok) {
      return this.reject(parsed.request.requestId, placementValidation.reason);
    }

    const inventory = this.getInventory(ownerId);
    const consumeResult = inventory.consume(definition.placementCost);

    if (!consumeResult.ok) {
      return {
        events: [
          {
            type: "BUILD_REJECTED",
            requestId: parsed.request.requestId,
            reason: consumeResult.reason,
          },
          {
            type: "INVENTORY_SNAPSHOT",
            ownerId: consumeResult.snapshot.ownerId,
            items: consumeResult.snapshot.items,
            updatedAt: consumeResult.snapshot.updatedAt,
          },
        ],
      };
    }

    const part: PlacedBuildPart = {
      entityId: this.createEntityId(),
      ownerId,
      partId: parsed.request.partId,
      x: parsed.request.x,
      y: parsed.request.y,
      z: parsed.request.z,
      rotation: parsed.request.rotation,
      state: parsed.request.partId === "door" ? { open: false } : undefined,
      createdAt: this.now(),
    };

    this.grid.place(part, definition);

    return {
      events: [
        {
          type: "BUILD_PLACED",
          part,
        },
        {
          type: "INVENTORY_SNAPSHOT",
          ownerId: consumeResult.snapshot.ownerId,
          items: consumeResult.snapshot.items,
          updatedAt: consumeResult.snapshot.updatedAt,
        },
      ],
    };
  }

  remove(ownerId: string, request: unknown): BuildingCommandResult {
    const parsed = this.parseRemoveRequest(request);

    if (!parsed.ok) {
      return this.reject(parsed.requestId, parsed.reason);
    }

    const target = this.grid.getById(parsed.request.entityId);

    if (!target) {
      return this.reject(parsed.request.requestId, "철거할 건설물을 찾을 수 없습니다.");
    }

    if (target.ownerId !== ownerId) {
      return this.reject(parsed.request.requestId, "다른 플레이어의 건설물은 철거할 수 없습니다.");
    }

    if (this.grid.hasAnyPartAbove(target.x, target.y, target.z)) {
      return this.reject(parsed.request.requestId, "위에 다른 건설물이 있어 먼저 제거해야 합니다.");
    }

    const definition = getBuildPartDefinition(target.partId);

    if (!definition) {
      return this.reject(parsed.request.requestId, "건설물 정의를 찾을 수 없습니다.");
    }

    this.grid.remove(target.entityId);

    const inventory = this.getInventory(ownerId);
    for (const refund of definition.refundOnRemove) {
      inventory.add(refund.itemId, refund.quantity);
    }

    const inventorySnapshot = inventory.toSnapshot();

    return {
      events: [
        {
          type: "BUILD_REMOVED",
          entityId: target.entityId,
        },
        {
          type: "INVENTORY_SNAPSHOT",
          ownerId: inventorySnapshot.ownerId,
          items: inventorySnapshot.items,
          updatedAt: inventorySnapshot.updatedAt,
        },
      ],
    };
  }

  toggleDoor(ownerId: string, request: unknown): BuildingCommandResult {
    const parsed = this.parseDoorToggleRequest(request);

    if (!parsed.ok) {
      return this.reject(parsed.requestId, parsed.reason);
    }

    const target = this.grid.getById(parsed.request.entityId);

    if (!target) {
      return this.reject(parsed.request.requestId, "문을 찾을 수 없습니다.");
    }

    if (target.partId !== "door") {
      return this.reject(parsed.request.requestId, "문만 열고 닫을 수 있습니다.");
    }

    if (target.ownerId !== ownerId) {
      return this.reject(parsed.request.requestId, "다른 플레이어의 문은 조작할 수 없습니다.");
    }

    const open = !Boolean(target.state?.open);
    const updated: PlacedBuildPart = {
      ...target,
      state: { ...target.state, open },
    };

    this.grid.updatePart(updated);

    return {
      events: [
        {
          type: "BUILD_DOOR_UPDATED",
          entityId: updated.entityId,
          open,
        },
      ],
    };
  }

  private parsePlaceRequest(request: unknown):
    | { ok: true; request: BuildPlaceRequest }
    | { ok: false; requestId: string; reason: string } {
    if (!this.isRecord(request)) {
      return { ok: false, requestId: "unknown", reason: "건설 요청 형식이 올바르지 않습니다." };
    }

    const requestId = typeof request.requestId === "string" ? request.requestId : "unknown";

    if (request.type !== "BUILD_PLACE_REQUEST") {
      return { ok: false, requestId, reason: "건설 배치 요청 타입이 올바르지 않습니다." };
    }

    if (typeof request.requestId !== "string" || request.requestId.length === 0) {
      return { ok: false, requestId, reason: "requestId가 필요합니다." };
    }

    if (!isBuildPartId(request.partId)) {
      return { ok: false, requestId, reason: "알 수 없는 건설 부품입니다." };
    }

    if (!Number.isInteger(request.x) || !Number.isInteger(request.y) || !Number.isInteger(request.z)) {
      return { ok: false, requestId, reason: "건설 좌표는 정수여야 합니다." };
    }

    if (![0, 1, 2, 3].includes(Number(request.rotation))) {
      return { ok: false, requestId, reason: "회전값이 올바르지 않습니다." };
    }

    return {
      ok: true,
      request: {
        type: "BUILD_PLACE_REQUEST",
        requestId: request.requestId,
        partId: request.partId,
        x: request.x,
        y: request.y,
        z: request.z,
        rotation: request.rotation as 0 | 1 | 2 | 3,
      },
    };
  }

  private parseRemoveRequest(request: unknown):
    | { ok: true; request: BuildRemoveRequest }
    | { ok: false; requestId: string; reason: string } {
    if (!this.isRecord(request)) {
      return { ok: false, requestId: "unknown", reason: "철거 요청 형식이 올바르지 않습니다." };
    }

    const requestId = typeof request.requestId === "string" ? request.requestId : "unknown";

    if (request.type !== "BUILD_REMOVE_REQUEST") {
      return { ok: false, requestId, reason: "철거 요청 타입이 올바르지 않습니다." };
    }

    if (typeof request.requestId !== "string" || request.requestId.length === 0) {
      return { ok: false, requestId, reason: "requestId가 필요합니다." };
    }

    if (typeof request.entityId !== "string" || request.entityId.length === 0) {
      return { ok: false, requestId, reason: "철거할 entityId가 필요합니다." };
    }

    return {
      ok: true,
      request: {
        type: "BUILD_REMOVE_REQUEST",
        requestId: request.requestId,
        entityId: request.entityId,
      },
    };
  }

  private parseDoorToggleRequest(request: unknown):
    | { ok: true; request: BuildDoorToggleRequest }
    | { ok: false; requestId: string; reason: string } {
    if (!this.isRecord(request)) {
      return { ok: false, requestId: "unknown", reason: "문 조작 요청 형식이 올바르지 않습니다." };
    }

    const requestId = typeof request.requestId === "string" ? request.requestId : "unknown";

    if (request.type !== "BUILD_DOOR_TOGGLE_REQUEST") {
      return { ok: false, requestId, reason: "문 조작 요청 타입이 올바르지 않습니다." };
    }

    if (typeof request.requestId !== "string" || request.requestId.length === 0) {
      return { ok: false, requestId, reason: "requestId가 필요합니다." };
    }

    if (typeof request.entityId !== "string" || request.entityId.length === 0) {
      return { ok: false, requestId, reason: "조작할 문 entityId가 필요합니다." };
    }

    return {
      ok: true,
      request: {
        type: "BUILD_DOOR_TOGGLE_REQUEST",
        requestId: request.requestId,
        entityId: request.entityId,
      },
    };
  }

  private reject(requestId: string, reason: string): BuildingCommandResult {
    return {
      events: [
        {
          type: "BUILD_REJECTED",
          requestId,
          reason,
        },
      ],
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
