import type { BuildPartId } from '../../building/BuildingTypes';
import type { PlayerQuestState } from '../QuestTypes';
import { advanceMatchingObjectives } from './QuestObjectiveProgress';

export function grantPlaceBuildPartObjective(
  state: PlayerQuestState,
  partId: BuildPartId,
  amount: number,
): boolean {
  return advanceMatchingObjectives(
    state,
    amount,
    ({ objective }) => objective.type === 'place_build_part' && objective.partId === partId,
  );
}
