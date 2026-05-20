# dalworld-server

Cloudflare Workers + Durable Objects + D1 SQLite 기반 서버 권위 2D 멀티플레이 생존/건설 게임 서버.

서버는 실제 게임 판정과 월드 상태 확정을 담당한다. 클라이언트가 보낸 입력과 요청은 의도로만 취급하고, 서버가 검증한 뒤 상태를 변경한다.

## 작업 전 필수 문서

AI 또는 개발자는 코드 수정 전에 아래 문서를 먼저 확인한다.

| 문서 | 목적 |
|------|------|
| [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md) | 서버 작업 규칙, Cloudflare Workers 호환성, 작업 전/후 체크리스트 |
| [`docs/CURRENT_SYSTEM_STATUS.md`](docs/CURRENT_SYSTEM_STATUS.md) | 현재 구현/부분 구현/미구현 상태 |
| [`docs/ARCHITECTURE_GUIDE.md`](docs/ARCHITECTURE_GUIDE.md) | 서버 구조, GameRoom 분리 기준, 저장/프로토콜 원칙 |
| [`docs/isometric-building-system.md`](docs/isometric-building-system.md) | 아이소메트릭 건설 시스템 서버 설계 |

문서와 실제 코드가 다르면 현재 코드를 확인하고, 필요한 경우 문서를 함께 갱신한다.

## 핵심 원칙

- 서버가 모든 중요한 게임 판정을 최종 확정한다.
- 클라이언트 좌표, 아이템 수량, 건설 요청, 회전값은 검증 없이 신뢰하지 않는다.
- Cloudflare Workers 환경에서 동작 가능한 Web 표준 API 기반으로 작성한다.
- Node.js 전용 API에 의존하지 않는다.
- 프로토콜 변경 시 `dalworld_client`의 `src/protocol/messages.ts`도 함께 맞춘다.
- 새 기능을 `GameRoom.ts`에 계속 몰아넣지 말고 도메인별 서비스로 분리한다.

## 기술 스택

- **Cloudflare Workers** — Worker 진입점 + HTTP 라우팅
- **Durable Objects** — 상태 관리, tick 루프, WebSocket 세션
- **Durable Object storage** — 월드맵/건설 상태 저장
- **D1 SQLite** — 향후 영속 플레이어 데이터
- **TypeScript**
- **wrangler v4**

## 로컬 실행

```bash
npm install
npm run dev        # wrangler dev --local 또는 wrangler dev 구성에 따름
```

## 배포

```bash
npm run deploy     # wrangler deploy
```

## 주요 엔드포인트

| 경로 | 설명 |
|------|------|
| `GET /health` | 서버 상태 확인 |
| `GET /ws` | WebSocket 접속 |
| `GET /maps/default` | 기본 월드맵 조회 |
| `PUT /maps/default` | 기본 월드맵 저장 |
| `PUT /maps/default/cell` | 셀 단위 월드맵 저장 |
| `PUT /maps/default/manifest` | 월드맵 매니페스트 저장 |

## WebSocket endpoint

```txt
wss://dalworld-server.<account>.workers.dev/ws
```

연결 즉시 `welcome` 메시지와 `BUILD_SNAPSHOT`을 수신하고, 이후 서버 snapshot/event를 수신한다.

## D1 설정

D1은 향후 영속 플레이어 데이터 용도로 사용한다.

```bash
wrangler d1 create dalworld-db
wrangler d1 migrations apply dalworld-db --local
wrangler d1 migrations apply dalworld-db
```

## 현재 구현 상태

현재 구현 상태는 README에 중복 관리하지 않는다.
아래 문서를 기준으로 확인한다.

- [`docs/CURRENT_SYSTEM_STATUS.md`](docs/CURRENT_SYSTEM_STATUS.md)

## 주요 구조

```txt
src/
├─ index.ts
├─ rooms/
│  └─ GameRoom.ts
├─ protocol/
│  └─ messages.ts
├─ sim/
├─ systems/
│  ├─ building/
│  ├─ crafting/
│  └─ inventory/
├─ worldMap/
├─ config/
└─ utils/
```

상세 구조는 [`docs/ARCHITECTURE_GUIDE.md`](docs/ARCHITECTURE_GUIDE.md)를 기준으로 확인한다.

## 메시지 프로토콜

프로토콜 타입은 `src/protocol/messages.ts`를 기준으로 한다.
클라이언트 저장소에도 동일한 의미의 타입이 있어야 한다.

프로토콜 변경 시 반드시 확인한다.

- server `src/protocol/messages.ts`
- client `src/protocol/messages.ts`
- server 메시지 처리 코드
- client 메시지 송신 코드
- client 이벤트 처리 코드
- 관련 문서

## 문제 해결

**WebSocket 연결 불가:**

- `wrangler.toml`의 Durable Object binding 확인 (`GAME_ROOM`)
- 로컬 실행 후 `GET /health` 접근 확인
- 클라이언트의 `VITE_DALWORLD_WS_URL` 확인

**채집이 안 됨:**

- gatherRange보다 가까이 있는지 확인
- stamina가 충분한지 확인
- 서버의 gather 처리 로그와 snapshot을 확인

**건설이 반영되지 않음:**

- 서버가 `BUILD_REJECTED`를 보내는지 확인
- `BUILD_SNAPSHOT`이 접속 시 전송되는지 확인
- 건설 snapshot이 Durable Object storage에 저장되는지 확인

## 기능 추가 시 체크리스트

- [ ] `docs/AI_WORKFLOW.md`를 확인했는가?
- [ ] `docs/CURRENT_SYSTEM_STATUS.md`를 확인했는가?
- [ ] `docs/ARCHITECTURE_GUIDE.md`를 확인했는가?
- [ ] 서버 권위 구조를 지켰는가?
- [ ] Cloudflare Workers 호환성을 지켰는가?
- [ ] 프로토콜 변경 시 클라이언트 저장소도 수정했는가?
- [ ] 기존 기능을 임의로 삭제하지 않았는가?
- [ ] 관련 문서를 갱신했는가?
