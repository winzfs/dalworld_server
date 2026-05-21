import { CHAPTER_1_QUEST_DEFINITIONS } from './content/Chapter1QuestDefinitions';
import type { QuestDefinition } from './QuestTypes';

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  ...CHAPTER_1_QUEST_DEFINITIONS,
];

const QUEST_DEFINITION_BY_ID = new Map(QUEST_DEFINITIONS.map((quest) => [quest.id, quest]));

export function getQuestDefinition(id: string): QuestDefinition | null {
  return QUEST_DEFINITION_BY_ID.get(id) ?? null;
}
