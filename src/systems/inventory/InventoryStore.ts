export type InventoryItemId =
  | "wood"
  | "stone"
  | "fiber"
  | "floor_kit"
  | "wall_kit"
  | "roof_kit";

export type InventoryItemStack = {
  itemId: InventoryItemId;
  quantity: number;
};

export type InventorySnapshot = {
  ownerId: string;
  items: InventoryItemStack[];
  updatedAt: number;
};

export type InventoryMutationResult =
  | { ok: true; snapshot: InventorySnapshot }
  | { ok: false; reason: string; snapshot: InventorySnapshot };

export class InventoryStore {
  private readonly ownerId: string;
  private readonly items = new Map<InventoryItemId, number>();
  private updatedAt = Date.now();

  constructor(ownerId: string, initialItems: InventoryItemStack[] = []) {
    this.ownerId = ownerId;

    for (const stack of initialItems) {
      this.add(stack.itemId, stack.quantity);
    }
  }

  getQuantity(itemId: InventoryItemId): number {
    return this.items.get(itemId) ?? 0;
  }

  hasAll(costs: InventoryItemStack[]): boolean {
    for (const cost of costs) {
      if (!Number.isFinite(cost.quantity) || cost.quantity <= 0) {
        return false;
      }

      if (this.getQuantity(cost.itemId) < cost.quantity) {
        return false;
      }
    }

    return true;
  }

  add(itemId: InventoryItemId, quantity: number): InventoryMutationResult {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return {
        ok: false,
        reason: "추가 수량이 올바르지 않습니다.",
        snapshot: this.toSnapshot(),
      };
    }

    this.items.set(itemId, this.getQuantity(itemId) + quantity);
    this.touch();

    return {
      ok: true,
      snapshot: this.toSnapshot(),
    };
  }

  consume(costs: InventoryItemStack[]): InventoryMutationResult {
    if (!this.hasAll(costs)) {
      return {
        ok: false,
        reason: "필요한 재료가 부족합니다.",
        snapshot: this.toSnapshot(),
      };
    }

    for (const cost of costs) {
      const nextQuantity = this.getQuantity(cost.itemId) - cost.quantity;

      if (nextQuantity <= 0) {
        this.items.delete(cost.itemId);
      } else {
        this.items.set(cost.itemId, nextQuantity);
      }
    }

    this.touch();

    return {
      ok: true,
      snapshot: this.toSnapshot(),
    };
  }

  toSnapshot(): InventorySnapshot {
    return {
      ownerId: this.ownerId,
      updatedAt: this.updatedAt,
      items: [...this.items.entries()]
        .filter(([, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }))
        .sort((a, b) => a.itemId.localeCompare(b.itemId)),
    };
  }

  private touch(): void {
    this.updatedAt = Date.now();
  }
}
