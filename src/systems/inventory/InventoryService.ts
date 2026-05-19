import { InventoryStore, type InventoryItemId, type InventoryItemStack, type InventoryMutationResult } from './InventoryStore';

export type InventoryServiceOptions = {
  getStore(ownerId: string): InventoryStore;
};

export class InventoryService {
  private readonly getStore: (ownerId: string) => InventoryStore;

  constructor(options: InventoryServiceOptions) {
    this.getStore = options.getStore;
  }

  getQuantity(ownerId: string, itemId: InventoryItemId): number {
    return this.getStore(ownerId).getQuantity(itemId);
  }

  hasAll(ownerId: string, costs: InventoryItemStack[]): boolean {
    return this.getStore(ownerId).hasAll(costs);
  }

  grant(ownerId: string, itemId: InventoryItemId, quantity: number): InventoryMutationResult {
    return this.getStore(ownerId).add(itemId, quantity);
  }

  grantAll(ownerId: string, stacks: InventoryItemStack[]): InventoryMutationResult {
    const store = this.getStore(ownerId);
    let result: InventoryMutationResult = { ok: true, snapshot: store.toSnapshot() };

    for (const stack of stacks) {
      result = store.add(stack.itemId, stack.quantity);
      if (!result.ok) return result;
    }

    return result;
  }

  consume(ownerId: string, costs: InventoryItemStack[]): InventoryMutationResult {
    return this.getStore(ownerId).consume(costs);
  }
}
