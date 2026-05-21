import { getQuestDefinition } from '../QuestDefinitions';
import type { PlayerQuestState, QuestId, QuestObjectiveDefinition } from '../QuestTypes';

export type ObjectiveVisitContext = {
  questId: QuestId;
  objective: QuestObjectiveDefinition;
};

export function advanceMatchingObjectives(
  state: PlayerQuestState,
  amount: number,
  matches: (context: ObjectiveVisitContext) => boolean,
): boolean {
  if (amount <= 0) return false;

  let changed = false;

  for (const questId of state.activeQuestIds) {
    const quest = getQuestDefinition(questId);
    if (!quest) continue;

    for (const objective of quest.objectives) {
      if (!matches({ questId: quest.id, objective })) continue;
      if (advanceObjective(state, quest.id, objective.id, objective.required, amount)) {
        changed = true;
      }
    }
  }

  return changed;
}

export function isQuestComplete(state: PlayerQuestState, questId: QuestId): boolean {
  const quest = getQuestDefinition(questId);
  if (!quest) return false;

  return quest.objectives.every((objective) => {
    const current = state.objectiveProgress[getObjectiveKey(quest.id, objective.id)] ?? 0;
    return current >= objective.required;
  });
}

export function getObjectiveProgress(state: PlayerQuestState, questId: QuestId, objectiveId: string): number {
  return state.objectiveProgress[getObjectiveKey(questId, objectiveId)] ?? 0;
}

export function getObjectiveKey(questId: string, objectiveId: string): string {
  return `${questId}:${objectiveId}`;
}

function advanceObjective(
  state: PlayerQuestState,
  questId: QuestId,
  objectiveId: string,
  required: number,
  amount: number,
): boolean {
  const key = getObjectiveKey(questId, objectiveId);
  const previous = state.objectiveProgress[key] ?? 0;
  const next = Math.min(required, previous + amount);
  if (next === previous) return false;
  state.objectiveProgress[key] = next;
  return true;
}
