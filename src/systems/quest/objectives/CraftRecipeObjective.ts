import type { CraftingRecipeId } from '../../crafting/CraftingTypes';
import type { PlayerQuestState } from '../QuestTypes';
import { advanceMatchingObjectives } from './QuestObjectiveProgress';

export function grantCraftRecipeObjective(
  state: PlayerQuestState,
  recipeId: CraftingRecipeId,
  amount: number,
): boolean {
  return advanceMatchingObjectives(
    state,
    amount,
    ({ objective }) => objective.type === 'craft_recipe' && objective.recipeId === recipeId,
  );
}
