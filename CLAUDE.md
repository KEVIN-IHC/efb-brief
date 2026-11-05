# EFB 브리핑 웹앱 — Claude Code 지침

조종사 개인용 **오프라인 우선 PWA**: 회사 OFP(Jeppesen Aviator PDF)를 기기 안에서 분석해 Lido식으로 보여주고, 순항 기록을 오프라인 저장 → 온라인 시 Google Apps Script로 동기화. 기상·NOTAM·매뉴얼·얼러트는 단계적으로 추가. **승인된 EFB를 대체하지 않는 보조 도구.**
스택: Vite 5 + React 18 + TypeScript + Zustand + idb(IndexedDB) + vite-plugin-pwa + pdf.js 4 + Vitest. 백엔드 Google Apps Script(저장 전용).

## 세션 시작 (이 순서, 필요한 것만)
1. `docs/CURRENT_STATUS.md` — 지금 상태·다음 작업 (**항상**)
2. 작업 관련 절만: `docs/PROJECT_SPEC.md`(요구사항) · `docs/ARCHITECTURE.md`(파일·흐름) · `docs/DECISIONS.md`(확정 결정) · `docs/KNOWN_ISSUES.md`
3. 관련 소스는 직접 읽는다 (전체 읽기 금지). **문서와 코드가 다르면 코드가 기준** — 사용자에게 차이를 알리고 문서를 고친다
- `SPEC.md`는 원본 명세 보존본(동결). 최신 명세는 `docs/PROJECT_SPEC.md`

## 꼭 지킬 규칙
- 사용자는 한국어, 개발 비전문가 → 설명은 쉬운 한국어. 확인 안 된 것을 완료로 쓰지 않는다
- **오프라인 동작 먼저 설계**, 외부 API는 실패가 기본(타임아웃·재시도·캐시 폴백), 기상엔 신선도(발표 시각·경과) 필수, 얼러트엔 근거(매뉴얼 위치) 필수
- `DECISIONS.md`의 결정은 재논의하지 않는다. 바꿀 땐 사용자 확인 → 새 D-번호 추가
- 임계값(연료·SR·중량)은 **임시값**이다 — 근거 없이 바꾸거나 확정값처럼 쓰지 않는다
- Phase 단위로 진행: 완료 조건 충족 + 사용자 확인 후 다음 Phase
- 커밋·push·배포는 사용자가 요청할 때만

## 보안 (위반 금지)
- 회사 OFP·매뉴얼은 `private/`에만 (gitignore `/private`, `*.pdf`). 커밋·외부 전송 금지. 매뉴얼은 GitHub 금지(구글드라이브)
- 토큰·API 키 하드코딩 금지 (Apps Script Properties / Worker 환경변수 / 앱 Settings → IndexedDB)
- 개발·미리보기 서버의 `/private`·`*.pdf` 403 차단(`vite.config.ts` `blockPrivatePlugin`)을 약하게 하지 않는다
- 참고 저장소 ckpt-prep-stack(라이선스 없음) 코드 복사 금지 — 양식 사실만 (`private/reference/`)

## 코드 수정 시 주의
- 파서를 고치면 `AVIATOR_PARSER_VERSION`(`src/features/ofp/parser/index.ts`)을 올린다 → 저장된 OFP 자동 재파싱
- IndexedDB 스토어 추가 = `DB_VERSION` 올리고 `upgrade`에 단계 추가 (`src/db/schema.ts`)
- 순항 기록은 수정하지 않고 새 기록 추가(최신 유효, 취소=`void`) — 동기화 멱등성 유지
- UI: 색·간격은 `styles.css` `:root` 토큰만(주간 `[data-theme=light]`도 같이), 터치 ≥44px, 숫자 `.mono`, 레이아웃은 CSS media query만(768/1024)
- Apps Script 시트 칸은 맨 뒤에만 추가 (기존 열 위치 호환)

## 검증 (작업마다)
```
npm test          # 59+개, private/samples 있으면 실제 OFP 10개 포함
npx tsc -b
npm run build
```
- 화면 변경 시: 개발 브라우저에서 375·768·1180·1440px × 주간/야간, 가로 스크롤 0
- 파서 변경 시: 샘플 텍스트 재생성 `npx vite-node tools/extract-ofp.ts private/samples/*.pdf` → `npx vitest run src/features/ofp/parser/samples.test.ts`
- 실행: `npm run dev`(:5173) / `npm run local`(빌드+미리보기 :4173). Mock GAS URL `http://localhost:<port>/mock-gas`, 토큰 `dev-token`

## 작업 종료 시 (인계)
1. 위 검증 실행, 변경 파일 확인
2. `docs/CURRENT_STATUS.md` 갱신 — 상태표 + 맨 아래 "세션 인계"(완료·변경 파일·테스트 결과·미해결·다음 작업)
3. 해당될 때만: `DECISIONS.md`(새 결정) · `KNOWN_ISSUES.md`(문제 추가/해결) · `PROJECT_SPEC.md`(요구사항 변경) · `ARCHITECTURE.md`(구조 변경) · `LOCAL_TEST.md`(사용자 테스트 절차)
- `/session-start`, `/session-handoff` 스킬이 이 절차를 안내한다
