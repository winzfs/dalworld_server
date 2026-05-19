import type { InventoryService } from '../inventory/InventoryService';
import { getCraftingRecipe } from './CraftingRecipes';
import type { CraftingRecipeDefinition } from './CraftingTypes';

export type CraftingResult =
  | { ok: true; recipe: CraftingRecipeDefinition }
  | { ok: false; reason: string };

export type CraftingServiceOptions = {
  inventory: InventoryService;
};

export class CraftingService {
  private readonly inventory: InventoryService;

  constructor(options: CraftingServiceOptions) {
    this.inventory = options.inventory;
  }

  craft(ownerId: string, recipeId: string): CraftingResult {
    const recipe = getCraftingRecipe(recipeId);
    if (!recipe) return { ok: false, reason: '존재하지 않는 제작 레시피입니다.' };

    const consume = this.inventory.consume(ownerId, recipe.inputs);
    if (!consume.ok) return { ok: false, reason: consume.reason };

    const grant = this.inventory.grantAll(ownerId, recipe.outputs);
    if (!grant.ok) return { ok: false, reason: grant.reason };

    return { ok: true, recipe };
  }
}
