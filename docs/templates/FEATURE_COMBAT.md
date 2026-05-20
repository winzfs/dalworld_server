# Feature Template: Combat

전투 기능을 추가할 때 사용하는 체크리스트다.
서버는 공격 가능 여부, 쿨타임, 명중, 피해, 상태이상, 사망, 보상을 최종 판정한다.

## 1. 목적

- 전투 기능명:
- 공격 주체:
- 대상:
- 입력/트리거:
- 기대 결과:

## 2. Server 작업

- [ ] CombatService 또는 도메인 서비스 위치 결정
- [ ] GameRoom은 메시지 라우팅만 담당
- [ ] 공격 요청 메시지 구조 검증
- [ ] 공격 거리 검증
- [ ] 공격 쿨타임 검증
- [ ] 대상 존재/상태 검증
- [ ] 명중 판정
- [ ] 피해량 계산
- [ ] 상태이상 적용 필요 여부 확인
- [ ] 사망 처리
- [ ] 보상 지급 필요 여부 확인
- [ ] 실패 응답/event 정책 정의

## 3. Snapshot / Events

- [ ] 공격 시작 event 필요 여부
- [ ] 피해 event 필요 여부
- [ ] 사망 event 필요 여부
- [ ] 리스폰 event 필요 여부
- [ ] player/monster snapshot 필드 추가 필요 여부
- [ ] broadcast 순서 확인

## 4. Storage / D1

- [ ] HP/상태이상 영속화 필요 여부 확인
- [ ] 장비/스탯 저장 영향 확인
- [ ] D1 migration 필요 여부 확인

## 5. Client 연동 확인

- [ ] client 공격 입력은 요청만 전송
- [ ] client 이펙트는 서버 event 기준 표시
- [ ] client HP 변화는 서버 snapshot/event 기준 반영
- [ ] client가 명중/피해/사망/보상을 확정하지 않음

## 6. Protocol

- [ ] request message 추가/수정
- [ ] server event 추가/수정
- [ ] optional 확장 우선
- [ ] client/server protocol 동기화
- [ ] `npm run check:protocol` 통과

## 7. 검증

- [ ] `npm run check`
- [ ] 사거리 안/밖 케이스
- [ ] 쿨타임 중 요청 케이스
- [ ] 대상 없음/죽은 대상 케이스
- [ ] 사망/보상 케이스
- [ ] 기존 이동/채집/건설/몬스터 AI 회귀 확인
- [ ] 관련 문서 갱신
