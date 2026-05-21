import type { QuestDefinition } from './QuestTypes';

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: 'chapter1.awakened_survivor',
    chapter: 'Chapter 1. 잃어버린 캠프',
    title: '깨어난 생존자',
    description: '주변에서 기본 자원을 모아 첫 생존 준비를 시작하세요.',
    objectives: [
      {
        id: 'collect_wood',
        type: 'collect_item',
        itemId: 'wood',
        required: 5,
        label: '나무 5개 수집',
      },
      {
        id: 'collect_stone',
        type: 'collect_item',
        itemId: 'stone',
        required: 3,
        label: '돌 3개 수집',
      },
    ],
  },
];

export function getQuestDefinition(id: string): QuestDefinition | null {
  return QUEST_DEFINITIONS.find((quest) => quest.id === id) ?? null;
}
