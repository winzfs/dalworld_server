import type { QuestDefinition } from './QuestTypes';

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: 'chapter1.awakened_survivor',
    chapter: 'Chapter 1. 잃어버린 캠프',
    title: '깨어난 생존자',
    description: '주변에서 기본 자원을 모아 첫 생존 준비를 시작하세요.',
    nextQuestId: 'chapter1.first_workbench',
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
  {
    id: 'chapter1.first_workbench',
    chapter: 'Chapter 1. 잃어버린 캠프',
    title: '첫 번째 작업대',
    description: '모은 자원으로 작업대를 설치해 제작의 기반을 마련하세요.',
    objectives: [
      {
        id: 'place_workbench',
        type: 'place_build_part',
        partId: 'station_workbench',
        required: 1,
        label: '작업대 1개 설치',
      },
    ],
  },
];

export function getQuestDefinition(id: string): QuestDefinition | null {
  return QUEST_DEFINITIONS.find((quest) => quest.id === id) ?? null;
}
