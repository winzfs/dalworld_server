# Feature Template: Protocol Change

프로토콜을 변경할 때 사용하는 체크리스트다.
서버와 클라이언트 메시지는 반드시 호환되어야 하며, 가능한 optional 필드로 확장한다.

## 1. 변경 목적

- 변경 이유:
- 관련 기능:
- 기존 메시지로 처리할 수 없는 이유:

## 2. 변경 범위

- [ ] server `src/protocol/messages.ts`
- [ ] client `src/protocol/messages.ts`
- [ ] server 메시지 처리 코드
- [ ] client 메시지 송신 코드
- [ ] server snapshot/event broadcast 코드
- [ ] client event/snapshot 처리 코드
- [ ] 관련 문서

## 3. 서버 검증 원칙

- [ ] 클라이언트 입력값을 신뢰하지 않는다
- [ ] 메시지 구조 검증
- [ ] requestId 필요 여부 확인
- [ ] 좌표/ID/수량/rotation 등 범위 검증
- [ ] 실패 케이스 응답/event 정의
- [ ] broadcast 순서 확인

## 4. 호환성 원칙

- [ ] 기존 메시지 의미를 바꾸지 않는다
- [ ] 새 필드는 가능한 optional로 추가한다
- [ ] 기존 저장 데이터와 충돌하지 않는다
- [ ] 알 수 없는 필드/누락 필드 fallback을 고려한다

## 5. Storage 영향

- [ ] Durable Object storage 저장 포맷 영향 확인
- [ ] D1 schema 영향 확인
- [ ] version/migration 필요 여부 확인

## 6. 검증

- [ ] `npm run check:protocol`
- [ ] server `npm run check`
- [ ] client `npm run check`
- [ ] 정상 요청 케이스 확인
- [ ] 잘못된 요청 실패 케이스 확인
- [ ] 관련 문서 갱신
