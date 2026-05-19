# DalWorld Isometric Building System - Server Design

## 목적

DalWorld의 isometric 건설 시스템은 서버 권한 구조를 기준으로 설계한다. 클라이언트는 건설 요청과 미리보기만 담당하고, 실제 배치 가능 여부와 월드 상태 변경은 서버가 최종 결정한다.

서버는 Cloudflare Workers와 Durable Objects 환경에서 동작해야 하므로 Node.js 전용 API에 의존하지 않고 Web 표준 API 기반으로 구현한다.

## 기본 원칙

1. 서버가 모든 건설 상태의 원본이다.
2. 클라이언트가 보낸 좌표, 부품 ID, 회전값은 신뢰하지 않는다.
3. Durable Object가 방 또는 월드 단위 건설 상태를 관리한다.
4. 건설 배치, 철거, 이동, 회전은 서버 검증을 통과한 경우에만 확정한다.
5. 서버 이벤트를 통해 모든 클라이언트가 같은 월드 상태를 갖도록 한다.
6. 건설 데이터는 이미지 좌표가 아니라 `x, y, z` 그리드 좌표로 저장한다.
7. 추후 AI 이동, 충돌, 자원 소모, 소유권 시스템과 연결 가능해야 한다.

## 서버 책임 범위

서버가 담당하는 것:

- 건설 요청 검증
- 좌표 범위 검증
- 부품 존재 여부 검증
- 회전값 검증
- 중복 배치 검증
- 지지대 검증
- 소유권 검증
- 재료/비용 검증
- 철거 가능 여부 검증
- 확정 이벤트 브로드캐스트
- 접속 시 건설 상태 스냅샷 제공
- 이동/충돌/AI에 필요한 점유 정보 제공

서버가 담당하지 않는 것:

- Pixi 렌더링
- 마우스 hover 표시
- 건설 툴바 UI
- 클라이언트 미리보기 색상

## 권장 폴더 구조

```txt
src/
  building/
    BuildingGrid.ts
    BuildingRules.ts
    BuildingParts.ts
    BuildingProtocol.ts
    BuildingSnapshot.ts
  durable-objects/
    GameRoom.ts
```

기존 서버 구조가 다르면 위 이름을 그대로 강제하지 않는다. 다만 건설 도메인은 독립 모듈로 분리해서 전투, 이동, 인증, 저장 로직과 뒤섞이지 않게 한다.

## 건설 좌표 기준

서버의 모든 건설 데이터는 다음 좌표계를 사용한다.

```txt
x: grid x
y: grid y
z: height layer
rotation: 0 | 1 | 2 | 3
```

서버는 화면 좌표를 저장하지 않는다. 화면 좌표 변환은 클라이언트 책임이다.

## 최소 부품 세트

초기 서버 검증 대상 부품은 다음으로 제한한다.

```txt
floor_1x1
wall_ne
wall_nw
corner
column
stair
roof
door
```

부품 수를 늘리기 전에 다음 기능을 먼저 안정화한다.

```txt
배치 요청 검증
중복 배치 차단
층 쌓기 검증
철거 검증
접속 시 스냅샷 동기화
```

## 부품 정의

서버의 부품 정의에는 최소한 다음 정보가 있어야 한다.

```txt
id
category
size
blocksMovement
requiresSupport
allowedOn
allowStackSameCell
```

클라이언트용 `spriteKey`, `anchor`는 서버 검증에는 필요하지 않다. 다만 클라이언트와 서버의 부품 ID는 반드시 동일해야 한다.

## 요청 프로토콜

클라이언트에서 서버로 보내는 기본 요청:

```txt
BUILD_PLACE_REQUEST
BUILD_REMOVE_REQUEST
BUILD_ROTATE_REQUEST, optional later
BUILD_MOVE_REQUEST, optional later
```

배치 요청 필드:

```txt
requestId
partId
x
y
z
rotation
```

철거 요청 필드:

```txt
requestId
entityId
```

서버는 `requestId`를 그대로 반환하여 클라이언트가 실패 피드백을 연결할 수 있게 한다.

## 서버 이벤트 프로토콜

서버에서 클라이언트로 보내는 기본 이벤트:

```txt
BUILD_PLACED
BUILD_REMOVED
BUILD_REJECTED
BUILD_SNAPSHOT
```

`BUILD_PLACED`는 서버가 확정한 전체 부품 데이터를 포함한다.

```txt
entityId
ownerId
partId
x
y
z
rotation
createdAt
```

`BUILD_REJECTED`는 다음 정보를 포함한다.

```txt
requestId
reason
```

## 검증 순서

배치 요청은 다음 순서로 검증한다.

```txt
1. 메시지 구조 검증
2. requestId 존재 여부 검증
3. partId 존재 여부 검증
4. x, y, z 정수 여부 검증
5. rotation 값 검증
6. 맵 범위 검증
7. 동일 셀 점유 여부 검증
8. 부품별 allowedOn 검증
9. 지지대 검증
10. 소유권/권한 검증
11. 재료/비용 검증
12. 충돌/길막 검증
13. 배치 확정
14. 브로드캐스트
```

초기 구현에서는 1~9번을 먼저 완성하고, 10~12번은 시스템이 준비된 뒤 연결한다.

## 철거 검증

철거는 단순 삭제가 아니다. 다음 조건을 확인해야 한다.

```txt
대상 entityId가 존재하는가?
요청자가 소유자이거나 편집 권한이 있는가?
위에 얹힌 부품이 있는가?
철거하면 공중에 뜨는 부품이 생기는가?
철거 비용/보상이 있는가?
```

초기 구현에서는 위에 다른 부품이 하나라도 있으면 철거를 거절한다.

## 다중 셀 확장 대비

초기에는 1x1 부품만 지원한다. 하지만 구조는 처음부터 다중 셀 부품을 고려한다.

향후 확장 대상:

```txt
floor_2x2
wall_1x2
roof_2x2
bridge_1x3
large_gate_2x1
```

따라서 `BuildingGrid`는 장기적으로 하나의 부품이 여러 셀을 점유할 수 있도록 확장 가능해야 한다.

## 상태 저장

초기에는 Durable Object 메모리 상태로 시작할 수 있다. 이후 영속 저장이 필요하면 다음 순서로 확장한다.

```txt
1. Durable Object memory state
2. Durable Object storage snapshot
3. D1 또는 외부 DB에 월드 단위 저장
```

스냅샷 저장 단위:

```txt
worldId
parts[]
updatedAt
version
```

## 접속 동기화

클라이언트가 방에 접속하면 서버는 현재 건설 상태를 스냅샷으로 내려준다.

```txt
BUILD_SNAPSHOT
```

스냅샷을 받은 클라이언트는 기존 로컬 건설 렌더링을 초기화한 뒤 서버 상태를 기준으로 다시 그린다.

## AI와 충돌 연동

건설 부품 중 `blocksMovement`가 true인 부품은 이동 가능 영역 계산에 반영해야 한다.

초기에는 단순히 해당 좌표를 막힌 칸으로 처리한다. 추후에는 다음처럼 확장한다.

```txt
문: 조건부 통과
계단: z 이동 가능
다리: 특정 방향 통과
난간: 이동은 막지만 투사체는 통과
벽: 이동과 투사체 모두 차단
```

## Cloudflare Workers 주의사항

서버 구현 시 다음을 피한다.

```txt
Node.js fs 사용 금지
Node.js net 사용 금지
setInterval에 의존한 장기 루프 금지
프로세스 전역 상태에 중요한 월드 상태 저장 금지
```

사용 가능한 기준:

```txt
WebSocket
Request
Response
crypto.randomUUID()
DurableObjectState
Durable Object storage
structured JSON messages
```

## 버그 가능성 체크리스트

- 클라이언트가 같은 요청을 여러 번 보내 중복 배치되는 문제
- requestId 중복 처리 미비
- 연결 재접속 시 스냅샷과 이벤트 순서가 꼬이는 문제
- 철거 후 위 부품이 공중에 남는 문제
- 서버와 클라이언트 부품 ID 목록이 불일치하는 문제
- 회전값에 따라 점유 셀이 달라지는 큰 부품 처리 문제
- Durable Object 재시작 후 메모리 상태가 사라지는 문제
- 다중 클라이언트가 같은 좌표에 동시에 배치 요청하는 문제

## 구현 단계

### 1단계

- `BuildingParts` 정의
- `BuildingGrid` 1x1 점유 관리
- `BUILD_PLACE_REQUEST` 처리
- `BUILD_PLACED`, `BUILD_REJECTED` 이벤트 브로드캐스트

### 2단계

- `BUILD_REMOVE_REQUEST` 처리
- 위 부품 존재 시 철거 거절
- 접속 시 `BUILD_SNAPSHOT` 전송

### 3단계

- 자원 비용 검증 연결
- 소유권/권한 검증 연결
- 이동 충돌 맵과 연동

### 4단계

- 다중 셀 부품 지원
- 계단을 통한 z 이동 처리
- 자동 벽/지붕 연결 규칙 추가

## 최종 기준

서버가 확정하지 않은 건설 상태는 존재하지 않는 것으로 취급한다. 모든 클라이언트 렌더링, 이동 충돌, AI 판단은 서버가 확정한 건설 데이터에서 파생되어야 한다.
