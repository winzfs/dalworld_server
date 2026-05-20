# Feature Template: Building Part

새 건설 부품을 추가할 때 사용하는 체크리스트다.
서버는 부품 ID, 좌표, 회전, 점유, 충돌, 비용, 소유권, 지지대 조건을 검증하고 최종 배치를 확정한다.

## 1. 목적

- 부품명:
- partId:
- 용도:
- 허용 위치:
- 플레이어 상호작용:

## 2. Server 작업

- [ ] building part definition 추가
- [ ] partId 검증
- [ ] 좌표 정수 여부 검증
- [ ] rotation 검증
- [ ] 맵 범위 검증
- [ ] 동일 셀/동일 edge 점유 검증
- [ ] 충돌/길막 검증
- [ ] allowedOn 검증
- [ ] 지지대 조건 필요 여부 확인
- [ ] 비용/재료 검증
- [ ] 소유권/권한 검증 필요 여부 확인
- [ ] 성공 시 BUILD_* event broadcast
- [ ] 실패 시 BUILD_REJECTED 전송

## 3. Storage

- [ ] 건설 snapshot 저장 포맷 영향 확인
- [ ] version 변경 필요 여부 확인
- [ ] 기존 저장 데이터와 호환성 확인
- [ ] Durable Object 재시작 후 복구 확인

## 4. Client 연동 확인

- [ ] client building part definition에도 같은 `partId` 추가
- [ ] client asset/ghost 표시 확인
- [ ] client/server rotation 의미 일치
- [ ] client가 서버 응답 전 실제 월드 상태로 확정하지 않음

## 5. Protocol / Shared Data

- [ ] 새 메시지 타입 필요 여부 확인
- [ ] 기존 메시지 optional 필드로 확장 가능한지 확인
- [ ] client/server `src/protocol/messages.ts` 호환 확인
- [ ] `npm run check:protocol` 통과

## 6. 검증

- [ ] `npm run check`
- [ ] 배치 성공 케이스
- [ ] 재료 부족 케이스
- [ ] 충돌/점유 실패 케이스
- [ ] 범위 밖 좌표 실패 케이스
- [ ] 잘못된 rotation 실패 케이스
- [ ] Durable Object 재시작 복구 확인
- [ ] 관련 문서 갱신
