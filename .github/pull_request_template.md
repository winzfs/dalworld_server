## 변경 내용

-

## 관련 문서 확인

- [ ] `README.md`
- [ ] `docs/AI_WORKFLOW.md`
- [ ] `docs/CURRENT_SYSTEM_STATUS.md`
- [ ] `docs/ARCHITECTURE_GUIDE.md`
- [ ] 관련 도메인 문서

## 서버 권위 구조 확인

- [ ] 모든 중요한 게임 판정은 서버에서 최종 확정한다.
- [ ] 클라이언트 요청 값은 검증 없이 상태에 반영하지 않는다.
- [ ] 실패 케이스는 rejected 이벤트 또는 안전한 응답을 보낸다.

## Cloudflare Workers 호환성

- [ ] Node.js 전용 API를 사용하지 않았다.
- [ ] Web 표준 API / Durable Object storage 기준으로 작성했다.
- [ ] 중요한 월드 상태를 프로세스 전역 상태에 의존하지 않는다.

## 프로토콜 변경

- [ ] 프로토콜 변경 없음
- [ ] 프로토콜 변경 있음: `dalworld_client/src/protocol/messages.ts`도 함께 수정했다.
- [ ] 새 필드는 가능한 optional로 추가했다.

## 검증

- [ ] `npm run check` 통과
- [ ] storage 변경 시 version/호환성을 고려했다.
- [ ] 기존 기능을 임의로 삭제하거나 약화하지 않았다.
- [ ] 관련 문서를 갱신했다.
