# dalworld_server

Cloudflare Workers + Durable Objects + D1 기반 dalworld 서버입니다.

## 목표

- Cloudflare Workers 배포
- Durable Objects 기반 월드 룸 관리
- WebSocket 실시간 동기화
- 모든 이동 검증과 최종 좌표 확정은 서버에서 처리하는 Server-Authoritative 구조
- D1 SQLite로 계정, 캐릭터, 월드 저장 데이터 확장 예정

## 실행

```bash
npm install
npm run dev
```

기본 Worker 주소는 로컬에서 `http://localhost:8787`입니다.

## WebSocket

```txt
/ws
```

초기 버전은 `main-world` 단일 Durable Object 룸으로 연결됩니다.

## 주요 파일

```txt
src/
├─ index.ts       # Worker fetch 라우팅 + Durable Object GameRoom
└─ messages.ts    # 서버/클라이언트 메시지 타입

migrations/
└─ 0001_initial.sql
```

## D1 설정

먼저 Cloudflare에서 D1 DB를 생성한 뒤 `wrangler.toml`의 `database_id`를 실제 ID로 교체해야 합니다.

```bash
npx wrangler d1 create dalworld-db
```

이후 출력된 `database_id`를 `wrangler.toml`에 반영합니다.
