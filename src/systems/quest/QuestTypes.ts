export type QuestId = 'chapter1.awakened_survivor';

export type QuestObjectiveType = 'collect_item';

export type QuestObjectiveDefinition = {
  id: string;
  type: QuestObjectiveType;
  itemId: string;
  required: number;
  label: string;
};

export type QuestDefinition = {
  id: QuestId;
  chapter: string;
  title: string;
  description: string;
  objectives: QuestObjectiveDefinition[];
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
