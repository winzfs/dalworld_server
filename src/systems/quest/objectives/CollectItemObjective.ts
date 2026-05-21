import type { PlayerQuestState } from '../QuestTypes';
import { advanceMatchingObjectives } from './QuestObjectiveProgress';

export function grantCollectItemObjective(
  state: PlayerQuestState,
  itemId: string,
  amount: number,
): boolean {
  return advanceMatchingObjectives(
    state,
    amount,
    ({ objective }) => objective.type === 'collect_item' && objective.itemId === itemId,
  );
}
