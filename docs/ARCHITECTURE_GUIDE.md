# DalWorld Server Architecture Guide

Last updated: 2026-05-21

이 문서는 DalWorld 서버의 전체 구조를 설명한다.
AI 작업자는 새 기능을 추가하기 전에 이 문서를 기준으로 어느 계층을 수정해야 하는지 판단한다.

## 1. 서버 역할

서버는 실제 게임 판정과 월드 상태 확정을 담당한다.

서버가 담당하는 것:

- WebSocket 접속
- 플레이어 세션 관리
- 서버 tick
- 이동 검증
- 자원 채집 검증
- 인벤토리 변경
- 제작 검증
- 건설 검증
- 몬스터 AI
- 전투 판정
- 월드맵 저장/조회
- 맵 에디터 탭별 저장 데이터 반영
- snapshot/event broadcast
- Durable Object storage 저장

서버가 담당하지 않는 것:

- Pixi 렌더링
- 클라이언트 UI
- 건설 고스트 표시
- 마우스 hover 표시
- 클라이언트 카메라

## 2. 전체 데이터 흐름

```txt
Client WebSocket message
  -> Worker /ws route
  -> GameRoom Durable Object
  -> message validation
  -> domain service
  -> world state mutation
  -> snapshot/event
  -> all clients
```

월드맵 저장 흐름:

```txt
Client map editor Tiles tab
  -> /maps/default/cell
  -> /maps/default/manifest
  -> GameRoom Durable Object storage
  -> runtime map reload

Client map editor Monsters tab
  -> /maps/default/monsters
  -> GameRoom Durable Object storage
  -> runtime map reload

Client map editor Items tab
  -> /maps/default/items
  -> GameRoom Durable Object storage
  -> runtime map reload
```

## 3. 주요 계층

### 3.1 Worker entry

- `src/index.ts`

HTTP 라우팅을 담당한다.
`/ws`, `/health`, `/maps/default` 계열 요청을 Durable Object로 연결한다.

### 3.2 Durable Object room

- `src/rooms/GameRoom.ts`

룸 조립자다.
WebSocket 세션, 메시지 라우팅, tick loop, snapshot/event 전송, storage 연결을 담당한다.
도메인 로직이 과도하게 들어가지 않도록 주의한다.

### 3.3 Simulation

- `src/sim/*`

플레이어, 자원, 몬스터 등 런타임 월드 상태와 tick 기반 시뮬레이션을 담당한다.

### 3.4 Building

- `src/systems/building/*`

건설 부품 정의, 건설 그리드, 배치/수정/철거 검증, 건설 snapshot을 담당한다.

### 3.5 Inventory and crafting

- `src/systems/inventory/*`
- `src/systems/crafting/*`

아이템 수량, 인벤토리 snapshot, 제작 검증을 담당한다.
월드맵 Items 탭에서 저장된 `itemOverrides`는 `src/systems/inventory/RuntimeItemOverrides.ts`를 통해 필요한 서버 판정에 안전하게 조회한다.

### 3.6 World map

- `src/worldMap/*`

월드맵 타입, 런타임 충돌, cell 기반 맵 데이터를 담당한다.

### 3.7 Protocol

- `src/protocol/messages.ts`

클라이언트와 호환되어야 하는 메시지 타입을 정의한다.

## 4. GameRoom 분리 기준

새 기능을 추가할 때 다음 기준에 해당하면 `GameRoom.ts`에 직접 구현하지 말고 별도 모듈로 분리한다.

- 검증 단계가 3개 이상이다.
- 독립적인 상태를 가진다.
- storage 저장/복구가 필요하다.
- 클라이언트에 별도 이벤트를 보낸다.
- 테스트 가능한 순수 로직이 있다.
- 향후 확장 가능성이 크다.

권장 분리 예시:

- `CombatService`
- `PlayerDeathService`
- `WorldMapStorageService`
- `BuildingPersistenceService`
- `SessionManager`
- `MessageDispatcher`

## 5. 서버 권위 원칙

클라이언트 요청은 의도일 뿐이다.
서버는 모든 요청을 검증한 뒤 상태를 바꾼다.

예시:

```txt
BUILD_PLACE_REQUEST
  -> partId 검증
  -> 좌표 검증
  -> 회전 검증
  -> 점유 검증
  -> 지지대 검증
  -> 비용 검증
  -> 배치 확정
  -> BUILD_PLACED broadcast
```

실패한 요청은 상태를 바꾸지 않고 rejected 이벤트를 보낸다.

## 6. Tick과 snapshot

서버는 주기적으로 simulation step을 실행하고 snapshot을 브로드캐스트한다.

주의:

- tick 로직과 도메인 판정을 분리한다.
- snapshot에는 클라이언트 렌더링에 필요한 상태만 포함한다.
- 이벤트는 상태 변화의 의미를 전달한다.
- snapshot과 event 순서가 꼬이지 않게 한다.

## 7. Storage 원칙

현재 사용하는 저장 개념:

- 월드맵 manifest 저장: `world:default-map:manifest`
- 월드맵 cell 저장: `world:default-map:cell:<gridX>:<gridY>`
- 월드맵 몬스터 설정 저장: `world:default-map:monsters`
- 월드맵 아이템 override 저장: `world:default-map:items`
- 건설 snapshot 저장

저장 구조 변경 시 고려할 것:

- key 이름
- version
- 기존 데이터 호환성
- 복구 방식
- 저장 실패 처리
- 대형 데이터 chunking

### 맵 에디터 탭별 저장 원칙

맵 에디터 데이터는 실패 범위를 줄이기 위해 탭별로 저장한다.

```txt
Tiles 저장
  -> 셀 payload는 /maps/default/cell로 분리 저장
  -> name/tileSize/cellSize/cells 목차는 /maps/default/manifest로 저장

Monsters 저장
  -> monsterSpawnRules 배열만 /maps/default/monsters로 저장

Items 저장
  -> itemOverrides 배열만 /maps/default/items로 저장
```

`GET /maps/default`는 위 저장소를 조합해 완성된 `GameWorldMap`을 반환한다.
각 저장 요청은 완료 후 `loadWorldMapFromStorage()`와 `setWorldMap()`을 호출해 Durable Object 런타임의 자원/몬스터 시드와 item override 기반 판정에 즉시 반영한다.

## 8. 월드맵 원칙

월드맵은 대형 맵 확장을 고려해 셀 기반으로 관리한다.

피해야 할 것:

- 대형 맵을 단일 JSON으로만 의존
- 셀 좌표 검증 없이 저장
- compact format 호환성 무시
- 몬스터/아이템 설정을 매번 대형 맵 payload에 함께 묶어 저장

## 9. 건설 시스템 원칙

건설물은 서버가 확정한 것만 실제 월드 상태다.

서버가 담당할 것:

- 배치 가능 여부
- 수정 가능 여부
- 철거 가능 여부
- 문 상태
- 점유 정보
- 충돌 정보
- 저장/복구

클라이언트는 미리보기와 요청만 담당한다.

## 10. 전투 시스템 추가 위치

전투 시스템을 추가할 때 권장 구조:

```txt
src/systems/combat/
  CombatService.ts
  CombatTypes.ts
  CombatRules.ts
```

GameRoom은 메시지를 받아 CombatService에 위임하고, 결과 이벤트만 전송한다.

서버가 판정해야 하는 것:

- 공격 거리
- 공격 쿨타임
- 명중 여부
- 피해량
- 상태이상
- 사망
- 보상

## 11. 프로토콜 변경 원칙

프로토콜을 바꾸면 다음을 같이 수정한다.

- server `src/protocol/messages.ts`
- client `src/protocol/messages.ts`
- server 처리 코드
- client 송신 코드
- client 이벤트 처리 코드
- 관련 문서

가능하면 optional 필드로 확장한다.
기존 메시지 의미를 바꿀 때는 이유를 문서화한다.

## 12. 작업 체크리스트

- [ ] 수정 위치가 올바른 계층인가?
- [ ] GameRoom에 불필요한 책임을 추가하지 않았는가?
- [ ] 서버 권위 구조를 유지했는가?
- [ ] Cloudflare Workers 호환성을 유지했는가?
- [ ] storage 변경 시 호환성을 고려했는가?
- [ ] 프로토콜 변경 시 클라이언트도 수정했는가?
- [ ] 실패 케이스 응답이 있는가?
- [ ] 문서를 갱신했는가?
