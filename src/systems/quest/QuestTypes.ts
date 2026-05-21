import type { BuildPartId } from '../building/BuildingTypes';

export type QuestId = 'chapter1.awakened_survivor' | 'chapter1.first_workbench';

export type QuestObjectiveType = 'collect_item' | 'place_build_part';

export type QuestObjectiveDefinition = {
  id: string;
  type: QuestObjectiveType;
  itemId?: string;
  partId?: BuildPartId;
  required: number;
  label: string;
};

export type QuestDefinition = {
  id: QuestId;
  chapter: string;
  title: string;
  description: string;
  objectives: QuestObjectiveDefinition[];
  nextQuestId?: QuestId;
};

export type QuestObjectiveProgress = {
  current: number;
  required: number;
  completed: boolean;
};

export type ActiveQuestSnapshot = {
  id: QuestId;
  title: string;
  description: string;
  completed: boolean;
  objectives: Array<QuestObjectiveDefinition & QuestObjectiveProgress>;
};

export type PlayerQuestState = {
  activeQuestIds: QuestId[];
  completedQuestIds: QuestId[];
  objectiveProgress: Record<string, number>;
};

export type QuestStateSnapshot = {
  active: ActiveQuestSnapshot[];
  completedQuestIds: QuestId[];
};
