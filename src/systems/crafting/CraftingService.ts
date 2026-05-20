import { isInventoryItemId } from '../inventory/ItemDefinitions';
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

    const validation = this.validateRecipe(recipe);
    if (!validation.ok) return validation;

    if (recipe.requiredStation && !this.inventory.hasAll(ownerId, [{ itemId: recipe.requiredStation, quantity: 1 }])) {
      return { ok: false, reason: `필요한 제작도구가 없습니다: ${recipe.requiredStation}` };
    }

    if (!this.inventory.hasAll(ownerId, recipe.inputs)) {
      return { ok: false, reason: '필요한 재료가 부족합니다.' };
    }

    const consume = this.inventory.consume(ownerId, recipe.inputs);
    if (!consume.ok) return { ok: false, reason: consume.reason };

    const grant = this.inventory.grantAll(ownerId, recipe.outputs);
    if (!grant.ok) return { ok: false, reason: grant.reason };

    return { ok: true, recipe };
  }

  private validateRecipe(recipe: CraftingRecipeDefinition): { ok: true } | { ok: false; reason: string } {
    if (recipe.inputs.length === 0) return { ok: false, reason: '제작 입력 재료가 없습니다.' };
    if (recipe.outputs.length === 0) return { ok: false, reason: '제작 결과물이 없습니다.' };

    if (recipe.requiredStation && !isInventoryItemId(recipe.requiredStation)) {
      return { ok: false, reason: '제작 레시피에 알 수 없는 제작도구가 포함되어 있습니다.' };
    }

    for (const stack of [...recipe.inputs, ...recipe.outputs]) {
      if (!isInventoryItemId(stack.itemId)) return { ok: false, reason: '제작 레시피에 알 수 없는 아이템이 포함되어 있습니다.' };
      if (!Number.isInteger(stack.quantity) || stack.quantity <= 0) return { ok: false, reason: '제작 레시피 수량이 올바르지 않습니다.' };
    }

    return { ok: true };
  }
}
