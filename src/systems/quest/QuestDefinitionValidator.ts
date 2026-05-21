import type { QuestDefinition, QuestObjectiveDefinition } from './QuestTypes';

export function validateQuestDefinitions(quests: QuestDefinition[]): void {
  const questIds = new Set<string>();

  for (const quest of quests) {
    assertNonEmptyString(quest.id, 'quest.id');
    assertNonEmptyString(quest.chapter, `${quest.id}.chapter`);
    assertNonEmptyString(quest.title, `${quest.id}.title`);
    assertNonEmptyString(quest.description, `${quest.id}.description`);

    if (questIds.has(quest.id)) {
      throw new Error(`[QuestDefinitions] Duplicate quest id: ${quest.id}`);
    }
    questIds.add(quest.id);

    if (!Array.isArray(quest.objectives) || quest.objectives.length === 0) {
      throw new Error(`[QuestDefinitions] Quest must have at least one objective: ${quest.id}`);
    }

    const objectiveIds = new Set<string>();
    for (const objective of quest.objectives) {
      validateObjective(quest.id, objective, objectiveIds);
    }
  }

  for (const quest of quests) {
    if (quest.nextQuestId && !questIds.has(quest.nextQuestId)) {
      throw new Error(`[QuestDefinitions] ${quest.id} references missing nextQuestId: ${quest.nextQuestId}`);
    }
  }
}

function validateObjective(
  questId: string,
  objective: QuestObjectiveDefinition,
  objectiveIds: Set<string>,
): void {
  assertNonEmptyString(objective.id, `${questId}.objective.id`);
  assertNonEmptyString(objective.label, `${questId}.${objective.id}.label`);

  if (objectiveIds.has(objective.id)) {
    throw new Error(`[QuestDefinitions] Duplicate objective id in ${questId}: ${objective.id}`);
  }
  objectiveIds.add(objective.id);

  if (!Number.isFinite(objective.required) || objective.required <= 0) {
    throw new Error(`[QuestDefinitions] Objective required must be positive: ${questId}.${objective.id}`);
  }

  switch (objective.type) {
    case 'collect_item':
      assertNonEmptyString(objective.itemId, `${questId}.${objective.id}.itemId`);
      return;
    case 'place_build_part':
      assertNonEmptyString(objective.partId, `${questId}.${objective.id}.partId`);
      return;
    case 'craft_recipe':
      assertNonEmptyString(objective.recipeId, `${questId}.${objective.id}.recipeId`);
      return;
    default: {
      const exhaustive: never = objective.type;
      throw new Error(`[QuestDefinitions] Unsupported objective type: ${String(exhaustive)}`);
    }
  }
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`[QuestDefinitions] ${fieldName} must be a non-empty string.`);
  }
}
