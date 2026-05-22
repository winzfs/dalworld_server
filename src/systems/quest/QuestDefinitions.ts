import { CHAPTER_1_QUEST_DEFINITIONS } from './content/Chapter1QuestDefinitions';
import type { QuestDefinition } from './QuestTypes';
import { validateQuestDefinitions } from './QuestDefinitionValidator';

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  ...CHAPTER_1_QUEST_DEFINITIONS,
];

validateQuestDefinitions(QUEST_DEFINITIONS);

const QUEST_DEFINITION_BY_ID = new Map<string, QuestDefinition>(QUEST_DEFINITIONS.map((quest) => [quest.id, quest]));

export function getQuestDefinition(id: string): QuestDefinition | null {
  return QUEST_DEFINITION_BY_ID.get(id) ?? null;
}
