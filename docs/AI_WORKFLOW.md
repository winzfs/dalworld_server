# DalWorld Server Workflow Guide

Last updated: 2026-05-20

이 문서는 DalWorld 서버 저장소에서 작업할 때 먼저 확인해야 하는 기준 문서다.
서버는 Cloudflare Workers와 Durable Objects 기반의 서버 권위형 게임 서버다.

## 1. 작업 전 확인 순서

1. `README.md`
2. `docs/AI_WORKFLOW.md`
3. `docs/CURRENT_SYSTEM_STATUS.md`
4. `docs/ARCHITECTURE_GUIDE.md`
5. 관련 도메인 문서
6. 실제 코드

문서와 코드가 다르면 현재 코드를 확인하고, 필요한 경우 문서를 함께 갱신한다.

## 2. 핵심 원칙

서버가 실제 게임 상태를 최종 결정한다.

서버가 담당하는 것:

- 플레이어 이동 검증
- 월드 경계와 충돌 검증
- 자원 채집 판정
- 아이템 획득과 인벤토리 변경
- 제작 판정
- 건설 배치, 수정, 철거 판정
- 문 열림/닫힘 상태
- 몬스터 AI
- 전투 피해
- 사망과 리스폰
- 소유권과 권한

클라이언트에서 온 값은 그대로 믿지 않는다.
좌표, 아이템 수량, 건설 부품 ID, 회전값, 플레이어 위치는 서버에서 검증한다.

## 3. Cloudflare Workers 호환성

서버 코드는 Cloudflare Workers와 Durable Objects 환경에서 동작해야 한다.

사용 기준:

- WebSocket
- Request / Response
- crypto.randomUUID()
- Durable Object storage
- JSON message
- Web 표준 API

피해야 할 것:

- Node.js 전용 파일 시스템 API
- Node.js 전용 네트워크 API
- 로컬 파일 시스템 의존
- 중요한 월드 상태를 프로세스 전역 상태에 저장하는 방식
- Cloudflare Workers에서 지원하지 않는 런타임 API

## 4. 현재 서버 책임

현재 서버는 다음 기능을 가진다.

- `GET /health`
- `GET /ws`
- Durable Object `GameRoom`
- WebSocket 세션 관리
- 메시지 rate limit
- 서버 tick loop
- snapshot broadcast
- 플레이어 이동 검증
- 월드맵 충돌 검증
- 건설물 충돌 검증
- 자원 채집 검증
- 자원 리스폰
- 몬스터 idle/chase AI
- 제작 요청 처리
- 인벤토리 snapshot 처리
- 건설 배치, 수정, 철거, 문 토글 처리
- 건설물 저장
- 접속 시 건설 snapshot 동기화
- 월드맵 저장/조회 API
- 셀 기반 월드맵 저장
- 낮/밤 상태 토글

## 5. 코드 수정 규칙

1. 기존 기능을 임의로 삭제하지 않는다.
2. `GameRoom.ts`에 모든 기능을 계속 추가하지 않는다.
3. 도메인별 서비스로 분리한다.
4. 클라이언트 메시지는 항상 검증한다.
5. 요청 실패 시 거절 이벤트나 안전한 응답을 보낸다.
6. 프로토콜 변경 시 클라이언트 저장소도 같이 수정한다.
7. 저장 데이터는 버전과 호환성을 고려한다.
8. 맵, 건설, 인벤토리, 전투, AI 로직을 한 파일에 섞지 않는다.

## 6. Durable Object 규칙

`GameRoom`은 룸 조립자 역할을 한다.

`GameRoom`이 담당해도 되는 것:

- WebSocket 연결/해제
- 메시지 라우팅
- tick loop 조립
- snapshot/event 전송
- storage와 도메인 서비스 연결

별도 모듈로 분리할 것:

- 건설 검증
- 인벤토리 검증
- 제작 검증
- 전투 판정
- 몬스터 AI 상세 로직
- 월드맵 저장 포맷 변환
- 충돌 계산
- 권한/소유권 검증

## 7. 건설 시스템 규칙

건설은 서버 권위 구조다.

서버가 검증해야 하는 것:

- 메시지 구조
- requestId
- partId
- 좌표 정수 여부
- rotation 값
- 맵 범위
- 동일 셀 점유 여부
- 부품별 allowedOn
- 지지대 조건
- 소유권과 권한
- 재료와 비용
- 충돌과 길막

성공 시 이벤트:

- `BUILD_PLACED`
- `BUILD_UPDATED`
- `BUILD_REMOVED`
- `BUILD_DOOR_UPDATED`

실패 시 이벤트:

- `BUILD_REJECTED`

실패한 요청은 실제 월드 상태를 바꾸면 안 된다.

## 8. 월드맵 규칙

월드맵은 대형 맵 확장을 고려해 셀 기반 구조를 유지한다.

현재 개념:

- 전체 맵 fallback
- manifest
- cell chunk
- compact cell format

주의 사항:

- 대형 맵을 한 번에 모두 저장/로드하는 구조로 되돌리지 않는다.
- 셀 좌표를 검증한다.
- 기존 저장 포맷과 호환성을 고려한다.

## 9. 프로토콜 규칙

서버 `src/protocol/messages.ts`는 클라이언트와 호환되어야 한다.

프로토콜 변경 시 확인할 것:

- server `src/protocol/messages.ts`
- client `src/protocol/messages.ts`
- server 메시지 처리 코드
- client 메시지 송신 코드
- client 이벤트 처리 코드
- 관련 문서

새 필드는 가능한 optional로 추가한다.
기존 메시지 타입의 의미를 바꿀 때는 문서에 변경 이유를 남긴다.

## 10. 저장 구조 규칙

Storage 또는 D1 구조를 바꿀 때 확인할 것:

- 저장 key 이름
- 데이터 version
- 기존 데이터와의 호환성
- 로컬/원격 환경 동작 여부
- 저장 실패 시 영향
- snapshot 복구 방식

중요한 월드 상태를 메모리에만 두지 않는다.
단, 초기 기능은 문서에 명시한 경우에만 메모리 상태로 시작할 수 있다.

## 11. 전투 시스템 추가 규칙

전투는 서버에서 판정한다.

서버가 담당할 것:

- 공격 가능 거리
- 공격 쿨타임
- 명중 판정
- 피해량 계산
- 상태이상 적용
- 사망 처리
- 리스폰 처리
- 보상 지급

클라이언트는 공격 입력, 이펙트, UI, 서버 이벤트 반영만 담당한다.

## 12. 작업 후 체크리스트

- [ ] 서버 권위 원칙을 지켰는가?
- [ ] 클라이언트 값을 무검증으로 믿지 않았는가?
- [ ] Cloudflare Workers 호환 API만 사용했는가?
- [ ] 기존 기능을 삭제하거나 약화하지 않았는가?
- [ ] `GameRoom.ts`에 불필요하게 책임을 더하지 않았는가?
- [ ] 실패 케이스에 대한 응답이 있는가?
- [ ] 프로토콜 변경 시 클라이언트 저장소도 같이 수정했는가?
- [ ] 저장 구조 변경 시 호환성을 고려했는가?
- [ ] 타입 검사를 통과할 수 있는 구조인가?
- [ ] 관련 문서를 최신화했는가?

## 13. 작업 순서

1. 관련 문서 확인
2. 관련 코드 위치 파악
3. 현재 구조 요약
4. 변경 범위 확정
5. 서버 권위 원칙 검토
6. Cloudflare Workers 호환성 검토
7. 최소 변경으로 구현
8. 타입/런타임 오류 가능성 검토
9. 문서 업데이트

임시방편으로 처리하지 않는다. 전체 구조에서 원인을 찾아 해결한다.
