import type { QuestDefinition } from './QuestTypes';

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: 'chapter1.awakened_survivor',
    chapter: 'Chapter 1. 잃어버린 캠프',
    title: '깨어난 생존자',
    description: '주변에서 기본 자원을 모아 첫 생존 준비를 시작하세요.',
    cinematic: {
      introTitle: '눈을 떠보니 낯선 숲이다',
      introText: '무너진 캠프의 흔적만 남아 있습니다. 손에 잡히는 나무와 돌부터 모아 살아남을 준비를 하세요.',
      cameraCue: 'wake',
    },
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
    cinematic: {
      introTitle: '손으로는 오래 버틸 수 없다',
      introText: '이제 임시 작업대를 세울 차례입니다. 제대로 된 도구와 건설은 이곳에서 시작됩니다.',
      cameraCue: 'build',
    },
    nextQuestId: 'chapter1.first_crafting',
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
  {
    id: 'chapter1.first_crafting',
    chapter: 'Chapter 1. 잃어버린 캠프',
    title: '첫 제작',
    description: '작업대를 기반으로 초반 건설에 필요한 재료를 직접 제작하세요.',
    cinematic: {
      introTitle: '거점의 뼈대를 만들 재료',
      introText: '날것의 자원만으로는 부족합니다. 판자와 석재 블록을 만들어 더 튼튼한 구조물을 준비하세요.',
      cameraCue: 'focus',
    },
    nextQuestId: 'chapter1.small_base',
    objectives: [
      {
        id: 'craft_plank',
        type: 'craft_recipe',
        recipeId: 'craft:plank',
        required: 3,
        label: '목재 판자 3회 제작',
      },
      {
        id: 'craft_stone_block',
        type: 'craft_recipe',
        recipeId: 'craft:stone_block',
        required: 2,
        label: '석재 블록 2회 제작',
      },
    ],
  },
  {
    id: 'chapter1.small_base',
    chapter: 'Chapter 1. 잃어버린 캠프',
    title: '작은 거점',
    description: '바닥과 벽을 세워 비바람을 피할 첫 거점을 만드세요.',
    cinematic: {
      introTitle: '밤이 오기 전에 몸을 숨길 곳',
      introText: '숲은 낮보다 밤에 더 위험합니다. 작은 거점이라도 세워 다음 밤을 준비하세요.',
      cameraCue: 'danger',
    },
    objectives: [
      {
        id: 'place_floor',
        type: 'place_build_part',
        partId: 'floor_1x1',
        required: 4,
        label: '나무 바닥 4개 설치',
      },
      {
        id: 'place_wall',
        type: 'place_build_part',
        partId: 'thin_wall',
        required: 4,
        label: '나무 벽 4개 설치',
      },
    ],
  },
];

export function getQuestDefinition(id: string): QuestDefinition | null {
  return QUEST_DEFINITIONS.find((quest) => quest.id === id) ?? null;
}
