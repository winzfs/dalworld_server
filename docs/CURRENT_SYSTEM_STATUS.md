# DalWorld Server Current System Status

Last updated: 2026-05-21

이 문서는 현재 서버 구현 상태를 빠르게 파악하기 위한 기준 문서다.
AI 작업자는 기능 추가나 수정 전에 이 문서를 확인하고, 실제 코드와 차이가 있으면 문서를 함께 갱신한다.

## 1. 프로젝트 개요

DalWorld 서버는 Cloudflare Workers + Durable Objects + TypeScript 기반의 2D 멀티플레이 생존/건설 게임 서버다.

서버는 다음을 담당한다.

- WebSocket 접속
- 룸 상태 관리
- 서버 tick
- 게임 판정
- 월드 상태 확정
- snapshot/event broadcast
- 맵 저장/조회
- 건설 상태 저장

## 2. 구현 완료 또는 연결됨

현재 코드에 연결된 주요 기능은 다음과 같다.

- Cloudflare Worker fetch entry
- `GET /health`
- `GET /ws`
- Durable Object `GameRoom`
- WebSocket 세션 관리
- playerId 생성 및 세션 매핑
- rate limit
- 서버 tick loop
- snapshot broadcast
- event broadcast
- player_joined/player_left 이벤트
- 플레이어 이동 입력 처리
- 서버 위치 검증
- 월드맵 충돌 검증
- 건설물 충돌 검증
- 자원 채집 처리
- 자원 리스폰
- 몬스터 idle/chase/attack AI
- 몬스터별 서버 권위 스펙 정의: `src/systems/monster/MonsterDefinitions.ts`
- 몬스터별 HP/이동속도/감지범위/추적해제범위/공격력/공격속도/공격범위/충돌/드롭 보상
- 플레이어 기본 공격 요청 처리
- 몬스터 피격/사망/보상 지급
- 몬스터 공격에 의한 플레이어 데미지
- 플레이어 사망/리스폰
- 제작 요청 처리
- 인벤토리 snapshot 처리
- 건설 배치 요청 처리
- 건설 수정 요청 처리
- 건설 철거 요청 처리
- 문 열림/닫힘 요청 처리
- 건설 이벤트 broadcast
- 건설 snapshot 저장
- 접속 시 건설 snapshot 전송
- 월드맵 GET/PUT
- 월드맵 cell 저장
- 월드맵 manifest 저장
- compact cell format 확장
- 낮/밤 토글

## 3. 부분 구현 또는 검증 필요

다음 기능은 연결되어 있으나 추가 검증이 필요하다.

- 전투 타입체크/빌드 검증
- 전투 밸런스 검증
- 몬스터 리스폰/스폰 테이블 확장
- Durable Object 재시작 후 건설 상태 복구
- 대형 월드맵 로드 성능
- 건설물 저장 실패 시 복구 전략
- 건설물 충돌과 몬스터 AI 연동 정확도
- 문 열림/닫힘과 이동 충돌 연동
- 제작 재료 검증의 확장성
- 인벤토리 영속화
- 소유권/권한 검증
- 다중 룸 구조
- 메시지 버전 호환성

## 4. 미구현 또는 향후 구현

- 장비 시스템
- 스킬/상태이상 시스템
- 몬스터 드롭 확률/희귀 보상 고도화
- 계정/인증
- D1 기반 플레이어 영속 데이터
- 멀티 룸
- 파티/길드/소유권 시스템
- 서버 로그 기반 모니터링
- 운영용 어드민 명령

## 5. 주요 진입 파일

- `src/index.ts`
- `src/rooms/GameRoom.ts`
- `src/protocol/messages.ts`

## 6. 주요 시스템 위치

- Worker routing: `src/index.ts`
- Durable Object room: `src/rooms/GameRoom.ts`
- simulation: `src/sim/*`
- player system: `src/sim/PlayerSystem.ts`
- monster system: `src/sim/MonsterSystem.ts`
- monster definitions: `src/systems/monster/MonsterDefinitions.ts`
- combat system: `src/systems/combat/CombatService.ts`
- world state: `src/sim/WorldState.ts`
- building system: `src/systems/building/*`
- inventory system: `src/systems/inventory/*`
- crafting system: `src/systems/crafting/*`
- world map: `src/worldMap/*`
- game config: `src/config/gameConfig.ts`

## 7. 현재 구조상 주의점

### GameRoom 책임 증가

`GameRoom.ts`는 현재 WebSocket, 메시지 라우팅, 맵 저장, 건설 저장, 제작 처리, 낮/밤 토글, 전투 요청 처리, tick loop를 모두 연결한다.
새 기능을 추가할 때는 가능한 한 별도 서비스로 분리한다.

### 몬스터 서버 권위 스펙

몬스터의 게임 판정용 스펙은 `src/systems/monster/MonsterDefinitions.ts`에서 관리한다.
HP, 이동속도, AI 거리, 공격력, 공격속도, 공격범위, 충돌, 드롭 보상은 이 파일을 기준으로 한다.
클라이언트의 `assets/monsters.ts`는 스프라이트/애니메이션/fallback 색상 같은 표현 전용 데이터만 관리한다.

### 서버 권위 유지

모든 중요한 게임 판정은 서버에서 확정한다.
클라이언트 요청은 검증 없이 상태에 반영하지 않는다.

### Cloudflare Workers 호환성

서버 코드는 Web 표준 API 기준으로 작성한다.
Node.js 전용 API를 사용하지 않는다.

### 프로토콜 동기화

`src/protocol/messages.ts`는 클라이언트 저장소와 맞아야 한다.
프로토콜 변경 시 양쪽 저장소를 같이 수정한다.

## 8. 다음 우선순위 제안

1. 타입체크/빌드 오류 수정
2. GameRoom 책임 분리
3. 전투 밸런스 조정
4. 몬스터 스폰/리스폰 테이블 설계
5. 제작/인벤토리 영속화 설계
6. D1 기반 플레이어 저장 구조 설계
7. 멀티 룸 구조 설계

## 9. 작업 체크리스트

- [ ] 현재 기능 상태를 확인했는가?
- [ ] 기존 기능을 덮어쓰지 않았는가?
- [ ] 서버 권위 구조를 지켰는가?
- [ ] Cloudflare Workers 호환성을 지켰는가?
- [ ] 프로토콜 변경 시 클라이언트 저장소도 수정했는가?
- [ ] 새 기능을 적절한 모듈에 배치했는가?
- [ ] 문서를 최신화했는가?
