import type { BuildPartId } from '../building/BuildingTypes';
import type { CraftingRecipeId } from '../crafting/CraftingTypes';
import { QUEST_DEFINITIONS, getQuestDefinition } from './QuestDefinitions';
import { grantCollectItemObjective } from './objectives/CollectItemObjective';
import { grantCraftRecipeObjective } from './objectives/CraftRecipeObjective';
import { grantPlaceBuildPartObjective } from './objectives/PlaceBuildPartObjective';
import { getObjectiveProgress, isQuestComplete } from './objectives/QuestObjectiveProgress';
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
    const changed = grantCollectItemObjective(state, itemId, amount);
    if (changed) this.completeFinishedQuests(state);
    return changed;
  }

  grantPlacedBuildPart(state: PlayerQuestState, partId: BuildPartId, amount = 1): boolean {
    const changed = grantPlaceBuildPartObjective(state, partId, amount);
    if (changed) this.completeFinishedQuests(state);
    return changed;
  }

  grantCraftedRecipe(state: PlayerQuestState, recipeId: CraftingRecipeId, amount = 1): boolean {
    const changed = grantCraftRecipeObjective(state, recipeId, amount);
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
            const current = Math.min(objective.required, getObjectiveProgress(normalized, quest.id, objective.id));
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
            cinematic: quest.cinematic,
            completed: objectives.every((objective) => objective.completed),
            objectives,
          };
        }),
    };
  }

  private completeFinishedQuests(state: PlayerQuestState): void {
    for (const questId of [...state.activeQuestIds]) {
      const quest = getQuestDefinition(questId);
      if (!quest || !isQuestComplete(state, questId)) continue;

      state.activeQuestIds = state.activeQuestIds.filter((id) => id !== questId);
      if (!state.completedQuestIds.includes(questId)) state.completedQuestIds.push(questId);
      if (quest.nextQuestId && !state.completedQuestIds.includes(quest.nextQuestId) && !state.activeQuestIds.includes(quest.nextQuestId)) {
        state.activeQuestIds.push(quest.nextQuestId);
      }
    }
  }
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
