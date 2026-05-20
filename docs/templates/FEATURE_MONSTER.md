# Feature Template: Monster

새 몬스터를 추가할 때 사용하는 체크리스트다.
서버는 몬스터 spawn, AI, 공격, 피해, 사망, 보상, snapshot/event를 최종 판정한다.

## 1. 목적

- monsterId:
- 역할:
- 등장 위치/조건:
- 기본 행동:
- 전투 여부:

## 2. Server 작업

- [ ] `MonsterType` 추가
- [ ] spawn 규칙 추가
- [ ] idle/chase/attack 상태 규칙 정의
- [ ] target selection 서버 판정
- [ ] 이동 가능/충돌 검증
- [ ] 공격 거리 검증
- [ ] 공격 쿨타임 검증
- [ ] 피해량 계산
- [ ] 사망 처리
- [ ] 보상 지급 필요 여부 확인
- [ ] snapshot broadcast 필드 확인

## 3. Storage / Persistence

- [ ] 몬스터 상태 영속화 필요 여부 확인
- [ ] respawn 상태 저장 필요 여부 확인
- [ ] version/migration 필요 여부 확인

## 4. Client 연동 확인

- [ ] client `MonsterType` 추가
- [ ] client asset/renderer 추가
- [ ] 클라이언트가 AI/피해/사망/보상을 확정하지 않음
- [ ] 필요한 event/snapshot 필드가 충분한지 확인

## 5. Protocol / Events

- [ ] 새 monster type 일치
- [ ] 새 state 값 필요 여부 확인
- [ ] attack/damage/death event 필요 여부 확인
- [ ] optional 확장 우선
- [ ] `npm run check:protocol` 통과

## 6. 검증

- [ ] `npm run check`
- [ ] spawn 확인
- [ ] idle/chase/attack 전환 확인
- [ ] 벽/건설물 충돌 확인
- [ ] 플레이어 거리별 공격 성공/실패 확인
- [ ] 사망/보상 처리 확인
- [ ] 기존 몬스터 회귀 확인
- [ ] 관련 문서 갱신
