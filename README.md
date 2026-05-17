# dalworld-server

Cloudflare Workers + Durable Objects + D1 SQLite 기반 서버 권위 2D 멀티플레이 생존 게임 서버.

## 기술 스택

- **Cloudflare Workers** — Worker 진입점 + HTTP 라우팅
- **Durable Objects** — 상태 관리, tick 루프, WebSocket 세션 (SQLite 클래스)
- **D1 SQLite** — 향후 영속 플레이어 데이터
- **TypeScript**
- **wrangler v4**

## 아키텍처

```
index.ts
  ├─ GET /health  →  JSON { ok: true }
  └─ GET /ws      →  GameRoom (Durable Object)
                       ├─ WebSocket 세션 관리 (rate limit 포함)
                       ├─ GameSimulation (20Hz tick)
                       │   ├─ PlayerSystem  (이동·스태미나·경계 클램프)
                       │   ├─ ResourceSystem (채집·리스폰·nearest fallback)
                       │   └─ MonsterSystem  (AI·chase/idle)
                       └─ snapshot broadcast 20Hz → 모든 클라이언트
```

## 로컬 실행

```bash
npm install
npm run dev        # wrangler dev --local (포트 8787)
```

## 배포

```bash
npm run deploy     # wrangler deploy
```

## WebSocket endpoint

```
wss://dalworld-server.<account>.workers.dev/ws
```

연결 즉시 `welcome` 메시지 수신 → 이후 `snapshot` 20Hz 수신.

## D1 설정

```bash
wrangler d1 create dalworld-db
wrangler d1 migrations apply dalworld-db --local   # 로컬 테스트
wrangler d1 migrations apply dalworld-db            # 원격
```

## 게임 설정값

| 항목 | 값 |
|------|---------|
| 월드 크기 | 3000×3000 |
| tickRate | 20Hz |
| playerSpeed | 220 |
| monsterSpeed | 80 |
| gatherRange | 80 |
| gatherCooldown | 400ms |
| tree HP / respawn | 75 / 25s |
| stone HP / respawn | 100 / 35s |
| rate limit | 120 msg/s per socket |

## 메시지 프로토콜

`src/protocol/messages.ts` 참조. 클라이언트에도 동일한 파일이 복사되어 있다.

### Client → Server

| 타입 | 설명 |
|------|------|
| `hello` | 연결 인사 (선택) |
| `input` | 이동 키 + 방향 (seq 포함) |
| `gather` | 채집 요청 (resourceId 선택, 없으면 nearest 사용) |
| `ping` | 레이턴시 측정용 |

### Server → Client

| 타입 | 설명 |
|------|------|
| `welcome` | 접속 확인 + playerId + world 설정 |
| `snapshot` | 20Hz world state (players/resources/monsters) |
| `event` | resource_hit / resource_destroyed / item_gained / player_joined / player_left |
| `pong` | ping 응답 |

## 현재 구현 기능

- [x] 서버 권위 플레이어 이동 (WASD·방향키)
- [x] 자원 채집 (거리·쿨타임·스태미나 검증)
- [x] nearest-resource fallback (resourceId 없거나 invalid 시)
- [x] 자원 리스폰 (tree 25s / stone 35s)
- [x] 몬스터 AI (wild_slime chase/idle)
- [x] snapshot broadcast 20Hz
- [x] 메시지 rate limit (120msg/s per socket)
- [x] 이벤트: resource_hit / resource_destroyed / item_gained / player_joined / player_left
- [x] ResourceSnapshot.alive 필드

## 문제 해결

**WebSocket 연결 불가:**
- `wrangler.toml`의 Durable Object binding 확인 (`GAME_ROOM`)
- `wrangler dev` 로컬 실행 후 `GET /health` 접근 확인

**채집이 안 됨:**
- gatherRange(80)보다 가까이 있는지 확인
- stamina가 0인지 확인 (stamina < 8이면 거부)
- 서버 로그에서 gather 결과 확인

## TODO

- [ ] 전투 시스템 (몬스터 근접 공격)
- [ ] 플레이어 데미지 / 사망 / 리스폰
- [ ] 영속 데이터 (D1 저장)
- [ ] 인증 / 세션 토큰
- [ ] 멀티 룸 지원
- [ ] Cloudflare 로그 기반 모니터링
