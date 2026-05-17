# dalworld_server

Cloudflare Workers + Durable Objects + D1 기반 dalworld 게임 서버입니다.
모든 핵심 게임 로직(이동, 충돌, 자원 채집, 몬스터 AI, 아이템 획득)은 서버 권위(Server-Authoritative)
로 처리합니다.

## 기술 스택

- Cloudflare Workers (TypeScript, Web 표준 API)
- Durable Objects (`GameRoom`, SQLite-backed)
- D1 SQLite (영구 저장 데이터)
- WebSocket 기반 실시간 통신

## 폴더 구조

```txt
src/
├─ index.ts                # Worker fetch 라우팅
├─ env.ts                  # Env 인터페이스
├─ protocol/
│  └─ messages.ts          # Client/Server 메시지 타입
├─ rooms/
│  └─ GameRoom.ts          # Durable Object, WebSocket 세션 관리
├─ sim/
│  ├─ GameSimulation.ts    # 서버 시뮬레이션 루프
│  ├─ WorldState.ts        # 플레이어/자원/몬스터 상태
│  ├─ PlayerSystem.ts      # 이동/스태미나
│  ├─ ResourceSystem.ts    # 자원 노드 + 채집
│  └─ MonsterSystem.ts     # 몬스터 스폰/AI
└─ utils/
   ├─ ids.ts
   └─ math.ts

migrations/
└─ 0001_initial.sql        # players, player_inventory, world_snapshots
```

## WebSocket

- 엔드포인트: `/ws`
- 룸: 단일 `main-world` Durable Object (확장 가능)
- 프로토콜: JSON 메시지 (`protocol/messages.ts`)

주요 클라이언트 → 서버 메시지:

- `hello`
- `input` (서버 권위 이동 입력)
- `gather` (자원 채집 요청, 거리/쿨다운 검증)
- `ping`

주요 서버 → 클라이언트 메시지:

- `welcome` (playerId + world info)
- `snapshot` (players + resources + monsters, 20Hz)
- `event` (`player_joined`, `player_left`, `resource_destroyed`, `item_gained`)
- `pong`

## 로컬 실행

```bash
npm install
npm run dev
```

서버는 기본적으로 `http://localhost:8787`에서 동작합니다. WebSocket은
`ws://localhost:8787/ws` 입니다. 클라이언트의 Vite proxy가 이 주소로 전달합니다.

## D1

`dalworld-db` D1 데이터베이스가 이미 생성되어 있고 `wrangler.toml`에 등록되어 있습니다.

- `database_name`: `dalworld-db`
- `database_id`: `c8a982fe-cd6e-4a89-b169-6d5e58bc8b41`
- 리전: APAC

다른 계정/환경에서 새로 만들어야 한다면:

```bash
npx wrangler d1 create dalworld-db
```

생성된 `database_id`를 `wrangler.toml`에 반영합니다.

### 마이그레이션 실행

```bash
# 로컬 (.wrangler/state) SQLite
npm run db:migrate:local

# 원격 Cloudflare D1
npm run db:migrate:remote
```

## Cloudflare 배포

```bash
npx wrangler deploy
```

배포되면 기본 URL은 다음과 같습니다.

```txt
https://dalworld-server.<your-subdomain>.workers.dev
```

WebSocket URL:

```txt
wss://dalworld-server.<your-subdomain>.workers.dev/ws
```

## 현재 구현된 기능

- 서버 권위 이동 (입력 시퀀스 처리, 월드 경계 클램프)
- 스태미나 회복 / 채집 시 스태미나 소모
- 자원 노드 (`tree`, `stone`) 스폰 + 채집 + HP 감소 + 자동 리스폰
- 인벤토리 (wood / stone) 서버 측 적재
- 몬스터(`wild_slime`) 스폰 + idle / chase AI + 시야 범위
- 20Hz 스냅샷 브로드캐스트 + 이벤트 메시지
- D1 마이그레이션 (players, player_inventory, world_snapshots)

## TODO

- 플레이어 인증/세션을 D1에 연결
- 자원/몬스터 시드 데이터 D1 영구화
- 전투(공격 입력 → 데미지) 시스템
- 룸 샤딩 (worldId / partyId)
- snapshot delta 압축
