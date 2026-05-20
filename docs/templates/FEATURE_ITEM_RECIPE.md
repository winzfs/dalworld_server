# Feature Template: Item / Recipe

아이템 또는 제작 레시피를 추가할 때 사용하는 체크리스트다.
서버는 재료 검증, 인벤토리 변경, 제작 결과 지급, 실패 응답을 최종 처리한다.

## 1. 목적

- itemId / recipeId:
- 용도:
- 획득 방법:
- 제작 가능 여부:
- 밸런스 의도:

## 2. Server 작업

- [ ] item definition 추가
- [ ] recipe definition 추가
- [ ] 재료 검증
- [ ] 인벤토리 공간/수량 검증
- [ ] 결과 지급
- [ ] 실패 시 안전한 응답/event
- [ ] 중복 요청/requestId 처리 필요 여부 확인
- [ ] rate limit 영향 확인

## 3. Storage / D1

- [ ] 인벤토리 영속화 영향 확인
- [ ] D1 저장 필요 여부 확인
- [ ] migration 필요 여부 확인
- [ ] 기존 저장 데이터 호환성 확인

## 4. Client 연동 확인

- [ ] client item id 일치
- [ ] client recipe id 일치
- [ ] client UI 표시명/아이콘/설명 추가
- [ ] client가 재료 차감/결과 지급을 확정하지 않음
- [ ] 서버 inventory snapshot 수신 후 UI 반영

## 5. Protocol / Shared Data

- [ ] item id / recipe id client/server 일치
- [ ] 새 snapshot/event 필요 여부 확인
- [ ] optional 확장 우선
- [ ] `npm run check:protocol` 통과

## 6. 검증

- [ ] `npm run check`
- [ ] 재료 충분 케이스
- [ ] 재료 부족 케이스
- [ ] 잘못된 recipeId 케이스
- [ ] 중복 요청 케이스 필요 여부 확인
- [ ] inventory snapshot 확인
- [ ] 기존 제작/인벤토리 회귀 확인
- [ ] 관련 문서 갱신
