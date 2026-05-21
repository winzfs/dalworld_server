import type { BuildPartId } from '../building/BuildingTypes';
import type { CraftingRecipeId } from '../crafting/CraftingTypes';
import { QUEST_DEFINITIONS, getQuestDefinition } from './QuestDefinitions';
import type { PlayerQuestState, QuestId, QuestStateSnapshot } from './QuestTypes';

const INITIAL_QUEST_ID: QuestId = 'chapter1.awakened_survivor';

export function createInitialQuestState(): PlayerQuestState {
  return {
    activeQuestIds: [INITIAL_QUEST_ID],
    completedQuestIds: [],
    objectiveProgress: {},
  };
}

export function normalizeQuestState(raw: unknown): PlayerQuestState {
  if (!isQuestState(raw)) return createInitialQuestState();

  const activeQuestIds = raw.activeQuestIds.filter(isKnownQuestId);
  const completedQuestIds = raw.completedQuestIds.filter(isKnownQuestId);
  const objectiveProgress: Record<string, number> = {};

  for (const [key, value] of Object.entries(raw.objectiveProgress)) {
    if (typeof key !== 'string') continue;
    if (!Number.isFinite(value)) continue;
    objectiveProgress[key] = Math.max(0, Math.floor(value));
  }

  if (activeQuestIds.length === 0 && !completedQuestIds.includes(INITIAL_QUEST_ID)) {
    activeQuestIds.push(INITIAL_QUEST_ID);
  }

  return { activeQuestIds, completedQuestIds, objectiveProgress };
}

export function parseQuestStateJson(raw: string | null): PlayerQuestState {
  if (!raw) return createInitialQuestState();
  try {
    return normalizeQuestState(JSON.parse(raw) as unknown);
  } catch {
    return createInitialQuestState();
  }
}

export function serializeQuestState(state: PlayerQuestState): string {
  return JSON.stringify(normalizeQuestState(state));
}

export class QuestService {
  grantCollectedItem(state: PlayerQuestState, itemId: string, amount: number): boolean {
    if (amount <= 0) return false;
    let changed = false;

    for (const questId of state.activeQuestIds) {
      const quest = getQuestDefinition(questId);
      if (!quest) continue;

      for (const objective of quest.objectives) {
        if (objective.type !== 'collect_item' || objective.itemId !== itemId) continue;
        if (this.advanceObjective(state, quest.id, objective.id, objective.required, amount)) {
          changed = true;
        }
      }
    }

    if (changed) this.completeFinishedQuests(state);
    return changed;
  }

  grantPlacedBuildPart(state: PlayerQuestState, partId: BuildPartId, amount = 1): boolean {
    if (amount <= 0) return false;
    let changed = false;

    for (const questId of state.activeQuestIds) {
      const quest = getQuestDefinition(questId);
      if (!quest) continue;

      for (const objective of quest.objectives) {
        if (objective.type !== 'place_build_part' || objective.partId !== partId) continue;
        if (this.advanceObjective(state, quest.id, objective.id, objective.required, amount)) {
          changed = true;
        }
      }
    }

    if (changed) this.completeFinishedQuests(state);
    return changed;
  }

  grantCraftedRecipe(state: PlayerQuestState, recipeId: CraftingRecipeId, amount = 1): boolean {
    if (amount <= 0) return false;
    let changed = false;

    for (const questId of state.activeQuestIds) {
      const quest = getQuestDefinition(questId);
      if (!quest) continue;

      for (const objective of quest.objectives) {
        if (objective.type !== 'craft_recipe' || objective.recipeId !== recipeId) continue;
        if (this.advanceObjective(state, quest.id, objective.id, objective.required, amount)) {
          changed = true;
        }
      }
    }

    if (changed) this.completeFinishedQuests(state);
    return changed;
  }

  toSnapshot(state: PlayerQuestState): QuestStateSnapshot {
    const normalized = normalizeQuestState(state);
    return {
      completedQuestIds: [...normalized.completedQuestIds],
      active: normalized.activeQuestIds
        .map((questId) => getQuestDefinition(questId))
        .filter((quest): quest is NonNullable<typeof quest> => quest !== null)
        .map((quest) => {
          const objectives = quest.objectives.map((objective) => {
            const current = Math.min(objective.required, normalized.objectiveProgress[getObjectiveKey(quest.id, objective.id)] ?? 0);
            return {
              ...objective,
              current,
              required: objective.required,
              completed: current >= objective.required,
            };
          });
          return {
            id: quest.id,
            title: quest.title,
            description: quest.description,
            completed: objectives.every((objective) => objective.completed),
            objectives,
          };
        }),
    };
  }

  private advanceObjective(
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

  private completeFinishedQuests(state: PlayerQuestState): void {
    for (const questId of [...state.activeQuestIds]) {
      const quest = getQuestDefinition(questId);
      if (!quest) continue;
      const done = quest.objectives.every((objective) => {
        const current = state.objectiveProgress[getObjectiveKey(quest.id, objective.id)] ?? 0;
        return current >= objective.required;
      });
      if (!done) continue;
      state.activeQuestIds = state.activeQuestIds.filter((id) => id !== questId);
      if (!state.completedQuestIds.includes(questId)) state.completedQuestIds.push(questId);
      if (quest.nextQuestId && !state.completedQuestIds.includes(quest.nextQuestId) && !state.activeQuestIds.includes(quest.nextQuestId)) {
        state.activeQuestIds.push(quest.nextQuestId);
      }
    }
  }
}

function getObjectiveKey(questId: string, objectiveId: string): string {
  return `${questId}:${objectiveId}`;
}

function isKnownQuestId(value: string): value is QuestId {
  return QUEST_DEFINITIONS.some((quest) => quest.id === value);
}

function isQuestState(value: unknown): value is PlayerQuestState {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<PlayerQuestState>;
  return Array.isArray(state.activeQuestIds) &&
    Array.isArray(state.completedQuestIds) &&
    typeof state.objectiveProgress === 'object' &&
    state.objectiveProgress !== null;
}
