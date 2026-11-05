---
name: session-handoff
description: EFB 프로젝트에서 작업을 마치고 다음 세션에 인계할 때 사용. 검증(테스트·타입·빌드)을 실행하고 docs/CURRENT_STATUS.md와 필요한 문서만 갱신한다. 사용자가 "/session-handoff", "마무리", "인계해줘", "세션 정리"라고 하면 실행.
---

# 세션 마무리·인계 절차 (EFB 브리핑 웹앱)

## 1. 검증
- 이번 세션에서 바뀐 파일 목록 확인 (git이 커밋 없이 쓰이는 중일 수 있으니 `git status`와 기억을 함께 사용)
- 실행: `npm test` · `npx tsc -b` · `npm run build` (PATH에 `/opt/homebrew/bin` 필요할 수 있음)
- 파서를 바꿨다면: 샘플 텍스트 재생성 후 `npx vitest run src/features/ofp/parser/samples.test.ts`, `AVIATOR_PARSER_VERSION` 올렸는지 확인
- 화면을 바꿨다면: 375·768·1180·1440px × 주간/야간, 가로 스크롤 0
- 기존 기능 영향 여부 확인. **실행하지 못한 검증은 "미확인"으로 기록**

## 2. 문서 갱신 (해당되는 것만)
- **항상** `docs/CURRENT_STATUS.md`
  - 맨 위 "마지막 갱신" 시각, 1·2·4·5·7절의 바뀐 항목
  - 맨 아래 "세션 인계"에 새 항목을 **맨 위에** 추가: 날짜·제목 / 완료 / 변경 파일 / 테스트 결과 / 해결 못 한 것 / 다음 할 일
  - 인계 기록이 5개를 넘으면 오래된 것은 한 줄 요약으로 줄인다
- 새로 확정된 결정 → `docs/DECISIONS.md` 새 D-번호 (날짜·결정·이유·대안·영향)
- 새 문제·해결 → `docs/KNOWN_ISSUES.md` (해결은 지우지 말고 🟢)
- 요구사항 변경 → `docs/PROJECT_SPEC.md` (상태 표시 ✅/⏳ 포함)
- 파일·모듈·데이터 흐름 변경 → `docs/ARCHITECTURE.md`
- 사용자가 직접 테스트할 절차가 생김 → `LOCAL_TEST.md`
- 해당 없는 문서는 건드리지 않는다

## 3. 사용자에게 보고 (한국어, 짧게)
완료한 것 · 테스트 결과 · 해결 못 한 것 · 다음 세션에서 할 일 · 다음 세션 시작 방법(`/session-start` 또는 README의 시작 프롬프트)
