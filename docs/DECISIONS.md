# DECISIONS — 확정된 설계 결정

> 여기 적힌 결정은 **다시 논의하지 않는다.** 바꾸려면 사용자에게 먼저 확인하고, 새 결정을 추가한 뒤 이전 결정에 `대체됨 → D-0xx`를 표시한다.
> 형식: 날짜 / 결정 / 이유 / 검토한 대안 / 영향 범위. 번호는 추가만 한다 (재사용 금지).
> 출처: 2026-11-05 첫 개발 대화 + 원본 명세 `SPEC.md` (§18 결정 기록 포함).

---

## 플랫폼·구조

### D-001 PWA + 정적 호스팅, Apps Script는 저장 API 전용
- **날짜** 2026-11-05 (원본 명세 §3.1)
- **결정** 프론트는 정적 호스팅 PWA, Google Apps Script는 기록 저장용 API로만 쓴다.
- **이유** Apps Script 웹앱은 구글 iframe 샌드박스라 Service Worker를 등록할 수 없어 오프라인 실행이 불가능.
- **대안** Apps Script 웹앱으로 화면까지 제공 → 오프라인 불가로 기각.
- **영향** `vite.config.ts`, `apps-script/Code.gs`, `src/sync/*`

### D-002 오프라인 우선 + 앱이 열려 있을 때만 동기화
- **날짜** 2026-11-05 (원본 명세 §3.1, §7.2)
- **결정** 동기화 시점 = `online` 이벤트, 앱 시작, `visibilitychange`(visible), 온라인 5분 주기.
- **이유** iOS Safari는 Background Sync API를 지원하지 않음.
- **대안** Background Sync → iOS 미지원으로 기각.
- **영향** `src/sync/syncManager.ts`

### D-003 Outbox 패턴 + UUID 멱등성
- **날짜** 2026-11-05
- **결정** 기록 저장 시 `logs`와 `outbox`를 **한 트랜잭션**에 기록. 서버는 `logId`(UUID)가 이미 있으면 `duplicate`로 무시. 실패 시 지수 백오프(30초→최대 30분), 5회 이상 실패하면 `failed`로 표시하되 재시도는 계속.
- **이유** 오프라인·응답 유실·재전송 상황에서도 시트에 정확히 1회만 저장.
- **대안** 저장 즉시 POST만 → 오프라인에서 유실. 서버 측 중복 판정 없이 클라이언트만 → 응답 유실 시 중복.
- **영향** `src/sync/outbox.ts`, `apps-script/Code.gs` (`upsertLog_`), `tools/mock-gas.ts`

### D-004 Apps Script 통신 규격
- **날짜** 2026-11-05
- **결정** `POST`, `Content-Type: text/plain`(CORS preflight 회피), 본문 JSON `{token, op, ...}`. 토큰은 Script Properties `API_TOKEN`에만 저장(`setup()`이 발급). `doGet`은 헬스체크만, 기록 조회는 `POST op=listLogs`. 시트 셀 수식 주입 방지(`= + - @` 앞에 `'`).
- **이유** 토큰이 URL(로그·기록)에 남지 않게. **원본 명세 §3("doGet → 기록 조회")와 의도적으로 다름.**
- **대안** `doGet?token=` 조회 → 토큰 노출로 기각.
- **영향** `apps-script/Code.gs`, `src/sync/gasClient.ts`

### D-005 호스팅 = GitHub Pages, 단 로컬·아이패드 확인 후 업로드 — (2026-11-05 사용자 요청으로 아이패드 확인 전 업로드: KEVIN-IHC/efb-brief, 공개)
- **날짜** 2026-11-05 (원본 명세 미결 #7 해결)
- **결정** GitHub Pages(무료는 **공개 저장소**). `base: './'`라 Cloudflare Pages로도 그대로 배포 가능. 사용자 요청으로 **로컬에서 충분히 테스트하고 아이패드에서 써본 뒤** GitHub에 올린다. 배포 워크플로 `.github/workflows/deploy.yml` 준비됨(아직 미사용).
- **대안** Cloudflare Pages. 비공개 저장소(Pro 필요).
- **영향** `.github/workflows/deploy.yml`, `vite.config.ts`

### D-006 기술 스택
- **날짜** 2026-11-05 (원본 명세 §4 기준)
- **결정** Vite 5 + React 18 + TypeScript + Zustand + idb + vite-plugin-pwa(Workbox) + pdfjs-dist 4(legacy 빌드) + Vitest(fake-indexeddb). **차트는 라이브러리 없이 SVG 직접**(오프라인 용량·테마 일관성). 지도는 Phase 3에서 Leaflet(명세).
- **대안** 명세의 uPlot/Recharts → 그래프 1개라 불필요해 보류.
- **영향** `package.json`, `src/features/inflight/FuelChart.tsx`

### D-007 개발 환경
- **날짜** 2026-11-05
- **결정** Node.js는 Homebrew로 설치(`/opt/homebrew/bin`). Mac 로컬 테스트는 `npm run local`(빌드+미리보기 4173), 개발은 `npm run dev`(5173). 둘 다 내장 Mock GAS(`/mock-gas`, 토큰 `dev-token`, 메모리 저장).
- **영향** `package.json`, `.claude/launch.json`, `tools/mock-gas.ts`

## 화면·디자인

### D-008 반응형 3단 레이아웃
- **날짜** 2026-11-05
- **결정** CSS media query만 사용(JS 화면 감지 금지). `<768px` 아이폰: 하단 탭 `primary` 4개(Dashboard·OFP·Weather·Inflight) + More 시트 / `768–1023px` 아이패드 세로: 하단 전체 탭 / `≥1024px` 아이패드 가로·PC: 왼쪽 사이드바. 새 화면은 360·768·1180·1440px에서 가로 스크롤 0 확인.
- **영향** `src/app/App.tsx`, `src/app/tabs.tsx`, `src/app/styles.css`

### D-009 디자인 토큰, 다크 기본, 44px 터치
- **날짜** 2026-11-05 (원본 명세 §2.2-4)
- **결정** 색·간격·글자 크기는 `styles.css` 맨 위 `:root` 토큰만 사용. 숫자는 `.mono`(고정폭). 터치 최소 44px. 카드는 `.page-grid` 안에서 자동 1~3열.
- **영향** `src/app/styles.css`

### D-010 OFP 화면 = Lido eOFP 기본 틀
- **날짜** 2026-11-05 (사용자 요청 "기본 틀은 Lido 형식, 깔끔하게")
- **결정** OFP 문서 순서: FLIGHT → FUEL → WEIGHTS → ALTERNATES → EDTO·ETP → TURBULENCE(SR) → MEL/CDL → DISPATCH NOTES. 별도 탭: NAV LOG, CRZ WIND, PDF·추출. 대문자 머리줄 블록(`DocSection`), 연료표 계층(RESERVE 하위 들여쓰기, RQD/PLN 굵게, RAMP/FOD 강조).
- **대안** 카드형 요약(이전 Phase 1 화면) → 교체됨.
- **영향** `src/features/ofp/doc/*`, `src/features/ofp/OfpPage.tsx`

### D-011 주간·야간 화면 전환
- **날짜** 2026-11-05 (사용자 요청)
- **결정** 상단 해/달 버튼(주간↔야간) + Settings(주간/야간/자동). 기본 야간. 기기별 선호라 `localStorage('efb.theme')`. 첫 화면 깜빡임 방지로 `index.html` 인라인 스크립트가 `data-theme`을 먼저 적용. 주간 = 종이 OFP처럼 밝은 색, 상태색은 대비 위해 진하게.
- **영향** `src/app/theme.ts`, `index.html`, `src/app/styles.css`(`:root[data-theme="light"]`), `src/app/StatusBar.tsx`, `src/features/settings/SettingsPage.tsx`

### D-012 "OFP 열기" 버튼 위치
- **날짜** 2026-11-05 (사용자 지적: 업로드 버튼이 3단계 안에 숨어 있었음)
- **결정** OFP 탭 맨 위·대시보드·사이드바에 노출. 아이패드는 파일 앱/메일 첨부/AirDrop 저장본을 파일 선택으로 연다.
- **대안** iOS "공유 → 이 앱으로 열기"(Web Share Target) → iOS 홈 화면 웹앱 미지원으로 불가.
- **영향** `src/features/ofp/OfpOpenButton.tsx`

## OFP 파싱

### D-013 OFP 시스템 = Jeppesen Aviator
- **날짜** 2026-11-05 (원본 명세 미결 #2 해결, 사용자 확인)
- **결정** 파서는 Aviator(국내 항공사 CFP 출력) 양식 기준.
- **영향** `src/features/ofp/parser/*`

### D-014 규칙 기반 파서 + 근거 줄 번호 + 실패 노출
- **날짜** 2026-11-05 (원본 명세 §10.1)
- **결정** 원문 → 구간 나누기(`sections.ts`) → 섹션별 추출기(`extractors.ts`, 규칙 `aviator.ts`) → 조립·교차검증(`index.ts`). 모든 값에 원문 줄 번호(`FieldTrace.line`) 기록, 화면에서 `L123` 클릭 시 원문으로 이동. 추출 실패/규칙 없음/구간 없음은 상태로 표시(조용히 누락 금지). 헤더·연료·중량·루트가 모두 추출돼야 `OfpData`로 조립. **파서를 고치면 `AVIATOR_PARSER_VERSION`을 올린다**(저장된 OFP가 앱 시작 시 자동 재파싱). AI는 보조로만.
- **대안** AI(LLM) 기반 추출 → 오프라인 불가·검증 어려움으로 기각.
- **영향** `src/features/ofp/parser/*`, `src/features/flight/activeFlight.ts` (`reparseStale`)

### D-015 Aviator 구간 경계와 함정
- **날짜** 2026-11-05 (샘플 10개 분석)
- **결정** 메인 CFP는 `ROUTE TO ALTN` / `REFILE FLT PLAN` / `END OF JEPPESEN`에서 끊는다. 후반부 메인 CFP **복사본**(2페이지 첫 의미 있는 줄이 다시 나오는 지점)부터는 파싱 제외. 페이지 경계에 걸친 블록(FPL·바람표)은 꼬리말(`Page n`, `Page - n of m`) 제거 후 해석.
- **이유** 전체를 순차 파싱하면 루트가 2배·REFILE 혼입(참고 앱이 겪은 버그).
- **영향** `src/features/ofp/parser/sections.ts`, `lines.ts`, `fpl.ts`

### D-016 단위: 100 LBS → lbs로 환산 저장
- **날짜** 2026-11-05
- **결정** OFP `UNIT 100LBS`의 연료·중량은 ×100 해서 lbs로 저장(`OfpData.unit = 'lbs'`), 화면에 단위 표시. 경고 기준은 kg로 정의하고 lbs면 환산(×2.20462). 데모 OFP는 kg.
- **영향** `src/features/ofp/parser/aviator.ts`, `margins.ts`

### D-017 바람 표기 해석
- **날짜** 2026-11-05 (버그 수정으로 확정)
- **결정** `23077P050` = 풍향 10도 단위 2자리 + 풍속 3자리 + 성분(P/M/공백=0). 성분은 구간 평균이라 지점 풍속보다 클 수 있음(원문 `23008M010`).
- **영향** `aviator.ts` (`ROW_A`, `WS_CELL`)

### D-018 OT(기온) 열은 원문 그대로
- **날짜** 2026-11-05
- **결정** NAV LOG의 OT는 부호 없는 값이라(FL390 `48` = −48°C) 해석하지 않고 원문 그대로 표시(`tempText`).
- **이유** 지상 부근 양수/음수 구분 불가 → 추측 금지.
- **영향** `aviator.ts`, `doc/NavLog.tsx`

### D-019 ETP 임계 연료는 OFP에 명시된 경우만 판정
- **날짜** 2026-11-05
- **결정** EDTO 형식(B787 등, `CFR` 열 있음)만 FOB−CFR 여유 판정. LOLV 형식(A380)은 드리프트다운(LRC/1LE/2LE) 수치만 표시하고 "판정하지 않음" 문구 표시.
- **대안** 드리프트다운 최대 소모량을 임계 연료로 간주 → 규정 근거 없는 추측이라 기각.
- **영향** `aviator.ts` (`parseEtp`, `parseEdtoEtp`), `margins.ts` (`etpMargin` null), `doc/OfpDocument.tsx`

### D-020 ETO = ETD + ACTM
- **날짜** 2026-11-05
- **결정** OFP ETO 칸은 비어 있으므로 ETD + 누적시간(ACTM)으로 계산. OFP의 ETA = ETD + 비행시간과 일치함을 확인(택시 시간 미반영). 헤더의 `std`·`takeoff` 모두 ETD를 사용.
- **영향** `aviator.ts` (`parseRouteLog`), `parser/index.ts` (`assemble`)

### D-021 업로드한 OFP = 현재 비행
- **날짜** 2026-11-05
- **결정** 완전히 추출되면 자동으로 현재 비행으로 설정. 비행 ID = `편명-날짜-출발-도착`(같은 비행 재업로드 시 OFP만 교체, 순항 기록 유지). 불완전하면 원문만 보관하고 현재 비행을 덮어쓰지 않음. 원본 PDF는 저장하지 않고 **추출 텍스트만** IndexedDB에 보관. 현재 비행이 없으면 DEMO 비행(워터마크 표시).
- **영향** `src/features/flight/activeFlight.ts`, `src/features/ofp/OfpOpenButton.tsx`, `RawPdfView.tsx`

## 기능 규칙

### D-022 CRZ WIND 표
- **날짜** 2026-11-05 (참고 앱 기능)
- **결정** OFP "WIND AND TEMPERATURE SUMMARY"를 지점×FL 표로. 계획 FL 칸 테두리, 성분 최대 FL 초록. NAV LOG 바람과 일치 여부를 교차검증 항목으로(샘플 10개 100% 일치).
- **영향** `aviator.ts` (`parseWindSummary`), `doc/CrzWind.tsx`, `parser/index.ts` (`windNav` 검사)

### D-023 난류(SR) 구간 — 임시 기준
- **날짜** 2026-11-05 (사용자: "일단 그대로")
- **결정** SR 5–6 주의, 7 이상 HIGH. 연속 구간 묶기(1지점 공백은 이어 붙임). 근거: 회사 디스패치 노트 표현 "HIGH SR(7-8)". **회사 매뉴얼 기준 확인 필요**(미결).
- **영향** `src/features/ofp/turbulence.ts`, `doc/Turbulence.tsx`, `doc/NavLog.tsx`

### D-024 순항 기록은 추가만(append-only)
- **날짜** 2026-11-05
- **결정** 웨이포인트 기록은 수정하지 않고 새 기록을 추가, 지점(seq)별 **최신이 유효**. 취소는 `void: true` 기록 추가. 시트에는 이력이 모두 남음.
- **이유** 오프라인·멱등 동기화와 충돌 없음, 감사 추적.
- **영향** `src/features/inflight/actuals.ts`, `src/db/schema.ts` (`LogRecord`), `apps-script/Code.gs` (칸 `seq, unit, void`)

### D-025 연료 편차 경고 — 임시 기준 — **착륙 예상 부분은 D-048로 대체**
- **날짜** 2026-11-05
- **결정** 편차 < −2% TRIP → 주의, 예상 착륙 연료 < ALTN+FINAL → 경고, ALTN+FINAL+0.5×FINAL 미만 → 주의. 예상은 두 가지(계획 소모 유지 / 현 추세 — 연료 기록 2개 이상·30분 이상 간격일 때). **회사 매뉴얼 기준 확인 필요**(미결).
- **영향** `src/features/inflight/deviation.ts` (`FUEL_DEV_RULES`)

### D-026 연료 입력 100 단위 축약 허용
- **날짜** 2026-11-05
- **결정** lbs OFP에서 계획값의 1/20 미만 입력(예: `2880`)은 ×100으로 해석하고, 해석 결과를 입력칸 아래에 항상 미리 보여줌.
- **영향** `deviation.ts` (`parseFuelInput`), `inflight/EntrySheet.tsx`

### D-027 점검 알림
- **날짜** 2026-11-05 (원본 명세 §11 "체크 항목"의 첫 버전)
- **결정** 비행 시간대에만: 마지막 연료 기록 후 60분, ETP 20분 전, 다음 지점 수정 ETO +5분 경과. 사용자 정의 점검 목록은 아직 없음.
- **영향** `src/features/inflight/reminders.ts`

## 보안·자료

### D-028 회사 자료 보호
- **날짜** 2026-11-05
- **결정** 회사 OFP·매뉴얼 원본은 `private/`에만(gitignore: `/private`, `*.pdf`). 개발·미리보기 서버는 `/private/`·`*.pdf` 요청을 403 차단(같은 Wi-Fi 기기 접근 방지). 사용자는 샘플 OFP 10개를 Claude가 읽는 것(Anthropic 서버 전송)을 알고 제공함.
- **영향** `.gitignore`, `vite.config.ts` (`blockPrivatePlugin`, `server.fs.deny`)

### D-029 매뉴얼은 GitHub에 올리지 않음
- **날짜** 2026-11-05
- **결정** 매뉴얼은 개인 구글드라이브(Apps Script 백엔드)에 두고 앱이 내려받음. 온라인: AI가 매뉴얼 근거로 답하고 문서·챕터·페이지 출처 표시. 오프라인: 받아둔 범위에서 기기 내 전문 검색.
- **이유** GitHub Pages 무료 = 공개 저장소.
- **영향** Phase 5·6 (미구현)

### D-030 NOTAM 분석은 공식 근거 기반
- **날짜** 2026-11-05 (사용자 요청)
- **결정** ICAO Annex 15, PANS-AIM(Doc 10066), NOTAM 약어(Doc 8400), FAA JO 7930.2 등 공식 문서를 기준으로 분류·해석하고 모든 판단에 근거 문서·조항 표시.
- **영향** Phase 4·6 (미구현)

### D-031 참고 자료의 사용 범위
- **날짜** 2026-11-05
- **결정** ckpt-prep-stack(타인 저장소, 라이선스 없음)은 **코드 복사 금지**, 양식 사실·기능 아이디어만 참고(분석 메모 `private/reference/ckpt-prep-stack-analysis.md`). AeroBrief(AI Studio)는 화면 아이디어만, 처리 방식은 오프라인 우선으로 재구현.
- **영향** 전체

## 개발 방식

### D-032 Phase 단위 개발
- **날짜** 2026-11-05 (원본 명세 §0)
- **결정** Phase 완료 조건 충족 + 사용자 확인 후 다음 Phase. 실제 OFP 샘플 전까지는 더미(ICN→LAX) — 샘플 확보 후 실제 파서(완료).
- **영향** `docs/CURRENT_STATUS.md`

### D-033 세션 인계는 문서로
- **날짜** 2026-11-05
- **결정** 대화 기록이 아니라 `CLAUDE.md` + `docs/*.md`가 프로젝트 기억. 새 세션은 CLAUDE.md → CURRENT_STATUS.md → 필요한 문서·코드만 선택적으로 읽는다. 작업 종료 시 CURRENT_STATUS.md(필요 시 DECISIONS/KNOWN_ISSUES/SPEC/ARCHITECTURE) 갱신. 원본 `SPEC.md`는 보존용으로 동결.
- **영향** `CLAUDE.md`, `docs/*`, `README.md`, `.claude/skills/*`

## 기상·지도 (Phase 3)

### D-034 aviationweather.gov는 중계(프록시) 경유 — 지금은 로컬, 배포 전 Cloudflare Worker
- **날짜** 2026-11-05 (사용자 선택)
- **확인 사실** 2026-11-05 `curl -H "Origin: https://x.github.io"` 실측: aviationweather.gov Data API(`metar`·`taf`·`isigmet`·`airport`)는 응답에 `Access-Control-Allow-Origin`이 **없음** → 브라우저 직접 호출 불가. Open-Meteo·NASA GIBS·CARTO·RainViewer·GitHub raw는 `*` 허용 → 직접 호출 가능.
- **결정** 앱은 METAR·TAF·SIGMET을 **기상 중계 주소**(`<중계>/awc/<metar|taf|isigmet>?…`)로 요청한다. 개발·미리보기 서버(`npm run dev`/`npm run local`)는 Vite 미들웨어가 같은 규격으로 중계(`/wx/awc/*` → `aviationweather.gov/api/data/*`, 허용 목록 경로만). 아이패드·GitHub Pages로 가기 전에 사용자가 Cloudflare 무료 계정을 만들고 같은 규격의 Worker를 설치, Settings에 주소를 넣는다. 중계는 키·토큰을 다루지 않는 단순 GET 전달(허용 경로만).
- **대안** 지금 Cloudflare 가입(사용자 부담 먼저) / Apps Script 중계(느림, D-001 "저장 전용" 변경 필요) / 공개 CORS 프록시(신뢰성·보안 문제) → 기각.
- **영향** `vite.config.ts`(`wxProxyPlugin`), `src/features/weather/*`, Settings, 배포 전 Worker(미구현)

### D-035 배경 지도 = 내장 세계지도 + 온라인일 때 CARTO — **대체됨 → D-039**
- **날짜** 2026-11-05 (사용자 선택)
- **결정** Leaflet 1.9. 해안선·국경은 Natural Earth(퍼블릭 도메인)를 단순화해 앱에 내장 → 오프라인에서도 항상 보임. 온라인이면 CARTO 기본 지도(야간 dark / 주간 light, 출처 표기)를 아래에 깔고, 오프라인용으로 대량 미리 저장하지 않는다(브라우저가 본 조각만 일반 캐시).
- **이유** 지도 조각 대량 저장은 이용약관상 회색지대, 내장 지도는 용량(수백 KB)·약관 걱정 없음.
- **대안** 내장 지도만 / CARTO 조각 루트 회랑 미리 저장(5~15MB) → 기각.
- **영향** `package.json`(leaflet), `public/geo/*`, `src/features/map/*`

### D-036 공항 좌표 = OurAirports(퍼블릭 도메인) 축약본 내장
- **날짜** 2026-11-05
- **결정** OFP에 공항 좌표가 없으므로 OurAirports `airports.csv`(퍼블릭 도메인)에서 ICAO 4글자 대형·중형 공항(약 5,000개)의 좌표·이름만 뽑아 `public/geo/airports.json`으로 내장. 생성 도구 `tools/build-geo.ts`(인터넷 필요, 개발자만 실행).
- **대안** aviationweather.gov `airport` API(중계 필요·오프라인 불가) → 보조로도 쓰지 않음. METAR 응답의 lat/lon은 보조 확인용.
- **영향** `tools/build-geo.ts`, `public/geo/airports.json`

### D-037 Phase 3 첫 구현 범위
- **날짜** 2026-11-05 (사용자 승인)
- **포함** 지도: 루트·웨이포인트·ETP·출발/도착/교체/EDTO 공항(비행 등급 색 VFR/MVFR/IFR/LIFR). 기상: METAR·TAF(원문+간단 해석), 국제 SIGMET 구역(지도+목록), 웨이포인트별 순항고도 바람·기온(Open-Meteo), 위성 적외선(NASA GIBS: Himawari / GOES-West / GOES-East). 신선도 표시, 온라인 자동 갱신, 오프라인 캐시 열람·갱신 버튼 비활성, "비행 준비 완료" 저장 버튼.
- **제외(이후 후보)** 국내 기상청 API(인증키), PIREP, 레이더, GTG 난류(미국 전용), D-ATIS, 4D 슬라이더(Phase 3.5).
- **영향** `docs/PROJECT_SPEC.md` §5.6·5.7

### D-038 기상 저장·갱신 방식
- **날짜** 2026-11-05
- **결정** 기상 응답은 SW 캐시가 아니라 기존 `wxSnapshots` 스토어(키 `[type, station]`)에 받은 시각(`fetchedAt`)과 함께 저장 → **DB 버전 변경 없음**. 위성 조각은 기존 `wxFrames`(키 `[layer, validTime, tile]`)에 Blob으로. 갱신 주기·신선도 색은 PROJECT_SPEC §5.6 표 값(METAR 10분, TAF 30분, SIGMET 15분, 바람 60분, 위성 30분). 갱신은 온라인이면서 앱이 보일 때만, 실패하면 이전 데이터 유지 + 실패 표시(타임아웃 15초).
- **영향** `src/features/weather/*`

### D-039 배경 지도 = 내장 세계지도만 (CARTO 제외)
- **날짜** 2026-11-05 (사용자 선택)
- **확인 사실** 구현 중 실측: CARTO 기본 지도 조각에 "API KEY REQUIRED" 워터마크가 찍혀 나옴 → 계정·키 없이는 사용 불가.
- **결정** 배경은 앱에 내장한 Natural Earth 해안선·국경(`public/geo/land.json`, `borders.json`)만 쓴다. 온라인·오프라인 화면이 같고, 색은 `styles.css` 토큰 `--map-land`·`--map-sea`(주간/야간). 외부 배경 지도 조각은 받지 않는다.
- **대안** OpenStreetMap 기본 지도(가입 불필요, 밝은 색뿐이라 야간 눈부심) / CARTO 가입·키 → 기각.
- **영향** `src/features/map/MapPage.tsx`, `src/app/styles.css`

### D-040 이미 끝난 비행의 상층풍은 현재 시각 예보
- **날짜** 2026-11-05
- **확인 사실** Open-Meteo에 과거 날짜(약 4주 전)를 요청하면 응답이 약 20초(현재 날짜는 약 3초)로 느려 시간 초과가 남.
- **결정** 비행 끝(마지막 ETO)이 하루 넘게 지났거나 출발이 14일 넘게 남았으면 현재 시각 기준 예보를 받고 화면에 "⚠ 현재 시각 예보" 표시. 바람 요청 시간 제한은 40초(다른 기상은 15초).
- **영향** `src/features/weather/api.ts` (`fetchWinds`)

### D-041 기상 중계 주소 기본값 내장 (입력 없이 자동)
- **날짜** 2026-11-05 (사용자 요청: "중계 주소 없어도 자동으로")
- **결정** `src/features/weather/api.ts` `DEFAULT_WX_PROXY` = 사용자 Worker 주소. 순서: Settings 입력값 → Mac 테스트 서버(localhost·사설 IP)면 내장 `/wx` → 그 외(GitHub Pages·아이패드) 기본 Worker. D-034의 "Settings에 주소를 넣는다"를 선택 사항으로 바꿈.
- **이유** 기기마다 주소를 입력하는 번거로움 제거. 주소는 공개 기상 전달용이라 비밀값이 아님(토큰 하드코딩 금지 규칙과 무관). 공개 저장소에 주소가 보이므로 Worker `ALLOWED_ORIGINS`로 이 사이트만 허용 권장.
- **영향** `src/features/weather/api.ts`(`resolveWxProxy`), `SettingsPage.tsx`, Worker 이름·계정이 바뀌면 이 상수를 고쳐 다시 배포

### D-042 연결 없음은 실패로 세지 않음 + 복귀 즉시 재전송 (D-002·D-003 보완)
- **날짜** 2026-11-05 (사용자 아이패드 보고: 비행기 모드 후 복귀해도 failed로 남고 "지금 동기화"를 눌러야 함)
- **원인** 비행기 모드에서 저장·화면 복귀 때마다 전송 시도 → 실패 5회로 `failed` + 백오프(최대 30분). 온라인 복귀 시에도 백오프를 지켜 바로 보내지 않음. iOS는 `navigator.onLine`·`online` 이벤트가 믿을 만하지 않음.
- **결정** ① fetch 자체 실패(TypeError = 서버에 닿지 못함)는 `NetworkError`로 구분: 실패 횟수 증가 없이 `pending` 유지, 30초 뒤 재시도. ② `online` 이벤트·앱 화면 복귀 시 대기시간 무시하고 즉시 전송(force). ③ 점검 주기 5분 → 30초(보낼 항목 없으면 네트워크 요청 없음). 서버 오류(HTTP 오류·토큰 거부·타임아웃)는 기존 백오프·5회 `failed` 그대로.
- **영향** `src/sync/gasClient.ts`, `src/sync/outbox.ts`(`markNetworkWait`, `NETWORK_RETRY_MS`), `src/sync/syncManager.ts`, `src/sync/outbox.test.ts`

## NOTAM (Phase 4)

### D-043 OFP NOTAM 추출·분류 규칙 (숨기지 않고 분류·강조)
- **날짜** 2026-11-10 (사용자 승인 "이대로 진행")
- **확인 사실** 샘플 10개 모두 같은 구조: `NOTAM PACKAGE 1`(출발·도착·교체) / `2`(ETP·EDTO·ERA·REFILE 공항) / `3`(FIR). 공항 머리 `[DEP]RKSI/ …`, OFP 자체 분류 제목 `◼ RUNWAY` 등, NOTAM 머리 줄 `시작 - 종료(UFN·PERM) 위치 번호`, 본문 `D) E) F) G) COMMENT)`. **Q) 줄 없음**. 끝 표시 `END OF (NOTAM) PACKAGE n FOR`. 기존 구간 정규식은 시작 줄(공백 여러 칸)을 못 찾고 끝 줄을 시작으로 잡고 있었음.
- **결정**
  1. 추출: 패키지 → 공항·FIR → 분류 제목 → 항목(번호·위치·유효기간 UTC·필드·원문 줄). 제목 아래 번호 없는 글은 `text` 항목, 공항 머리 아래 줄은 정보 줄 — 패키지 안 어떤 줄도 버리지 않음(페이지 꼬리말만 제외). 누락 점검: 패키지마다 "날짜로 시작하는 머리 줄 수 = 추출 건수" + 끝 표시(교차검증 `notamCount`)
  2. 분류: OFP 분류 제목 → 앱 그룹(활주로·항행시설·공역·접근/출발·유도로/계류장·통신·공항/장애물·기타·회사). 근거로 제목 줄 번호 + 대응 NOTAM Code 주제 그룹(Doc 8400, **앱 해석**이라고 표시)
  3. 강조 칩: E) 본문의 약어(CLSD·U/S·NOT AVBL·ACT 등 Doc 8400 / OTS·UNUSBL FAA JO 7930.2 / 간섭·무인기 등 일반 낱말은 "공식 약어 아님"). COMMENT)(회사 주석)는 칩 근거에서 제외. 활주로·항행시설·공역 그룹 + 강한 칩(폐쇄·사용 불가·공역 활성) = 강조
  4. 관련성: 공항은 ETD~ETA, FIR은 NAV LOG의 FIR 진입 ETO로 통과 시간대(출발 FIR = 이륙~첫 진입, ADIZ 제외, 없으면 ETD~ETA)와 B)~C) 유효기간 겹침 표시. **D) 시간표는 해석하지 않음** → "시간표 있음 — 원문 확인"
  5. **규칙으로 숨기지 않음.** 기종·게이트별 숨김 없음. 화면에는 사용자가 고르는 보기 필터만 있고, 필터로 가려진 건수를 항상 표시
  6. 회사 권고(COAD·COMPANY ADVISORY·TECHNICAL INFORMATION·COMPANY MINIMA)와 COMMENT)는 "회사"로 구분 — 당국 NOTAM 아님 표시
  7. 근거 문서 목록(`src/features/notam/refs.ts`): 확인한 것만 위치 표기, 원문 대조 전인 것(Doc 8400 약어, FAA JO 7930.2, GNSS G 그룹)은 화면에 "원문 대조 필요"
- **대안** 본문 키워드만으로 분류 → OFP가 이미 제목으로 분류해 두었으므로 기각(근거가 더 분명). D) 시간표 해석 → 형식이 다양해 오판 위험, 보류. ETD~ETA 밖 NOTAM 숨김 → 안전 관련이라 기각(표시만)
- **영향** `src/features/ofp/parser/{notam,sections,extractors,index}.ts`(파서 `aviator-1.3`), `src/features/ofp/types.ts`(`OfpData.notams`), `src/features/notam/*`, `src/features/ofp/sourceJump.ts`, `OfpPage.tsx`


## 매뉴얼·MEL (Phase 5)

### D-044 매뉴얼 넣기 = Mac 도구로 쪽 단위 묶음 → 기기 안 저장, 같은 매뉴얼은 개정 교체
- **날짜** 2026-11-10 (사용자: "매뉴얼은 개정되면 언제든 갈아 끼우고, 새 걸 던져주면 변환해서 알아서 업데이트" · 계획 1단계 승인)
- **확인 사실** 사용자가 pymupdf4llm(레이아웃 모드)로 변환한 A380 MEL·CDL·FCOM·FCTM MD 4개 수령(`private/manuals/inbox/`, PDF 원본 함께). 모든 쪽 끝에 쪽 표시(문서 코드 + `P n/m`, CDL은 항목 번호)와 운영사·기종 줄, 발행일·이전 발행일 문구가 있음. MEL 하위 항목마다 수리 등급·장착·필요 수량·플래카드 표, `(o)`/`(m)` 조건, OpsProc 참조. **OFP MEL 번호 끝 글자(A/B)는 하위 항목**(수리 등급 아님)
- **결정**
  1. "AI 학습"이 아니라 **색인 방식**: 매뉴얼을 쪽 단위로 나눠 기기에 저장 → 오프라인 검색·MEL 매칭은 규칙, AI 질의(Phase 6)는 관련 쪽만 보내고 출처 표시
  2. Mac 도구 `npm run manuals`: `private/manuals/inbox`에 PDF나 MD를 넣으면 ① 같은 매뉴얼·같은(이후) 발행일 MD가 없는 PDF만 MD 변환(pymupdf4llm, `private/manuals/md/`) ② 매뉴얼(docId = 기종-종류, 예 `A380-MEL`)마다 가장 최근 발행일만 사용 ③ 묶음 `private/manuals/out/<docId>.efbman.json.gz` (변경 없으면 건너뜀). 전부 `private/`
  3. 묶음 = 문서 정보(종류·기종·발행일·이전 발행일·쪽 수) + 쪽(쪽 표시·머리 제목·정리된 본문·MD 줄 번호) + MEL 하위 항목·CDL 항목(번호·제목·등급·수량·본문·쪽 표시·OpsProc 쪽). 쪽 표시를 못 찾은 부분은 버리지 않고 앞 쪽에 합침
  4. 아이패드로 옮기기: 묶음 파일을 구글드라이브에 두고 **Settings → 매뉴얼 → 가져오기**(파일 앱에서 선택, D-029 유지 — GitHub 금지). 변환된 .md도 바로 가져올 수 있음(기기 안에서 같은 파서로 처리)
  5. 같은 docId를 가져오면 **통째로 교체**(이전 개정 쪽·항목 남지 않음). 더 오래된 발행일은 확인을 받은 뒤에만
  6. IndexedDB v2: 쓰이지 않던 `manualIndex`·`melItems`를 지우고 `manualDocs`·`manualPages`(키 [docId, seq])·`manualItems`(키 [docId, itemNo], 색인 `byItem`)
- **대안** 원본 PDF 그대로 앱에 넣기 → 300MB, 기기 검색·항목 매칭 불가로 기각. Apps Script로 드라이브에서 자동 내려받기 → Apps Script 재배포 필요, 다음 단계에서 검토(지금은 파일 앱 선택). 매뉴얼 전체를 AI가 읽고 변환 → 토큰·보안 부담으로 기각(도구가 Mac 안에서 변환)
- **영향** `src/features/manual/{types,parse,store,ManualCard}.ts(x)`, `src/db/schema.ts`(v2), `tools/manual-convert/{build.ts,pdf2md.py}`, `package.json`(`manuals`), `SettingsPage.tsx`, `styles.css`

### D-045 MEL·CDL 자동 매칭과 매뉴얼 보기·검색 (원문 그대로, 해석 없음)
- **날짜** 2026-11-10 (사용자: "2단계 진행")
- **결정**
  1. **MEL 탭**: 현재 OFP 디스패치 MEL/CDL 번호 → 가져온 매뉴얼 항목. 같은 번호(하위 항목) → 없으면 상위 항목(경고 표시) → 없으면 "못 찾음 — 원본 확인"(숨기지 않음). OFP 기종(A388→A380, B78X→B787)에 맞는 매뉴얼 우선, 다른 기종에서 찾으면 경고
  2. 카드에 매뉴얼 원문 값만: 제목·수리 등급(CAT)·장착/필요 수량·플래카드, 본문에 있는 표시((o)·(m)·Crew Defer·Return To Gate·Contact MCC·Performance·연료 증가 %), 원문 펼치기, 쪽 열기·(o) 절차 쪽 열기. **조건을 요약·판정하지 않음**(디스패치 가능 여부는 정비·운항관리·원본 MEL)
  3. **Manual 탭**: 매뉴얼·쪽 이동(앞뒤·되돌아가기), 쪽 표시·머리 제목·근거 줄(문서·발행일·쪽 표시·MD 줄), 본문 속 `Refer to …`(OpsProc·Item·DSC/PRO/LIM/PER… 쪽 코드·CDL 번호)를 누르면 해당 쪽으로(같은 매뉴얼 → 다른 매뉴얼 순, FCOM↔FCTM 포함). Ident 번호는 링크 아님
  4. **검색**: 기기 안 단순 전문 검색(모든 낱말 AND, "구절", 머리 제목 가산, 관련도순 60개). 항목 번호·쪽 코드를 넣으면 바로 이동. 외부 라이브러리 없음(4개 매뉴얼 검색 약 0.1초)
  5. 변환 규칙 `manual-1.2`: 원문 줄바꿈(<br>)을 `¦`로 보존해 화면에서 줄바꿈, (o) 절차 쪽은 목차(PLP·TOC) 제외. 이전 규칙 묶음은 Settings에 "다시 만들기 권장" 표시
- **대안** MiniSearch 색인 → 매뉴얼이 13MB라 단순 검색으로 충분, 색인 저장·갱신 부담으로 보류. MEL 조건 자동 판정 → 오판 위험, 3단계 얼러트에서 근거와 함께 검토
- **영향** `src/features/manual/{lookup.ts,ManualText.tsx,ManualPage.tsx,MelPage.tsx}`(신규), `parse.ts`, `ManualCard.tsx`, `src/app/{App.tsx,tabs.tsx,styles.css}`, `ofp/doc/OfpDocument.tsx`(MEL 블록 → MEL 탭 링크)

### D-046 얼러트 엔진 — 규칙 파일·근거 필수·임시 기준 표시·확인/이력
- **날짜** 2026-11-10 (사용자: "3단계 얼럿 진행")
- **결정**
  1. 구조(원본 명세 §13.1): 규칙 = 파일 하나(`src/features/alerts/rules/*`), `evaluate(ctx)`는 결과 **여러 개**를 돌려줄 수 있음(명세의 단일 결과에서 확장). 맥락 = OFP·순항 기록·MEL 매칭·매뉴얼 목록·받아 둔 기상
  2. **근거 필수**: 얼러트마다 근거 줄 ≥1 — 매뉴얼 위치(누르면 Manual 탭) / OFP 원문 줄 / **임시 기준(매뉴얼 근거 없음, 노란 글씨)** / 앱 기준 / 자료 원문(SIGMET). 근거가 비면 엔진이 "근거 누락"으로 표시. 규칙이 실패해도 나머지는 실행하고 실패를 안내로 표시
  3. 첫 규칙 9개: 연료 편차·착륙 예상(D-025 임시) · OFP 계획 여유(중량·블록·ETP, margins.ts 임시) · 결빙 관련 MEL × 루트 결빙 SIGMET(경고, 명세 §12.2 예시) · CDL 성능 제한(원문 수치 그대로) · 루트 SIGMET(200NM·시간대 겹침, 앱 기준) · HIGH SR 구간(D-023 임시) · MEL/CDL 매뉴얼 미확인 · 기상 자료 오래됨(앱 신선도 기준, 도착 1시간 뒤엔 판단 안 함) · MEL (o) 절차·Return To Gate 안내
  4. 중복 금지: id = 규칙·상황 키·심각도. 심각도가 오르면 새 얼러트(다시 확인 필요)
  5. 확인·이력: IndexedDB v3 `alerts`(처음 뜬 시각·확인 시각). 확인한 얼러트는 접어서 보이고, 지금은 해당 없는 것은 "이력"으로. 기기 안에만(동기화 안 함)
  6. 화면: 대시보드 맨 위 Alerts 카드(심각도순·확인·모두 확인·근거 버튼 44px)
  7. **판정하지 않는 것**: MEL 조건 충족 여부, 디스패치 가능 여부, 성능 수치 재계산. 원문 문구·수치만 보이고 "원문 확인"
- **보류(근거 필요)**: 도착지 minima 근접·교체공항 planning minima·측풍/배풍 한계 — 회사 FOM 기준과 활주로 자료가 있어야 함. 임시 경고들의 회사 기준(미결 #5)
- **대안** 기존 화면별 경고(Inflight 연료·OFP 여유·난류 색)를 지우고 엔진으로만 → 기존 화면 맥락이 사라져 기각. 같은 함수·기준값을 엔진이 그대로 써서 기준은 한 곳
- **영향** `src/features/alerts/*`(신규), `src/db/schema.ts`(v3), `DashboardPage.tsx`(자리 표시 카드 교체), `manual/lookup.ts`(`loadMelMatches`), `MelPage.tsx`, `styles.css`

### D-047 FOM(+FCRM) = 절 단위로 나눔, marker 목차 json으로 PDF 쪽 번호
- **날짜** 2026-11-10 (사용자: FOM 변환본과 _meta.json 제공, "얘도 추가해")
- **확인 사실** FOM은 다른 변환 도구(marker)로 만들어져 쪽 표시(`… P n/m`)가 없음. 대신 번호 제목(`#### x.y.z 제목`, `Sx.y.z`, `제 N 장`)과 제목 속 `<span id="page-N-…">`(0부터 PDF 쪽). 한 파일에 FOM 뒤로 FCRM이 이어짐(`# Flight Crew Reference Manual`). `_meta.json` = 목차(제목·쪽 번호)·쪽 통계, 그림 jpeg 96개 별도
- **결정**
  1. 쪽 표시가 거의 없고 번호 제목이 많으면 **절 단위**로 나눔: 번호 제목·"제 N 장"마다 한 덩어리(번호 없는 소제목은 안에). 근거 표시 = `FOM x.y.z · p.N`(절 번호 + PDF 쪽). FCRM 부분은 `FCRM x.y.z`로 구분
  2. PDF 쪽 번호: 제목의 span → 없으면 `_meta.json` 목차(같은 제목을 순서대로 맞춤). **json은 있으면 쓰고 없어도 됨** — MD 옆에 `<이름>_meta.json`으로 두면 도구가 자동 사용. 앱으로 옮기는 묶음에는 쪽 번호만 들어감(json 자체는 안 옮김)
  3. 그림(jpeg)은 지금 넣지 않음 — 본문에 "[그림]" 표시
  4. 종류 판정 순서: REFERENCE 줄 → 파일 이름(MEL·CDL·FCOM·FCTM·FOM·QRH) → 본문에서 가장 먼저 나오는 제목. 기종은 REFERENCE·파일 이름·머리 `_A380_` 표기만(본문 언급 무시) → FOM은 `GEN-FOM`. 개정·발행일은 파일 이름의 `R<번호>_<YYYYMMDD>`도 사용(`revision` 칸)
  5. 검색에서 `FOM x.y.z`·`x.y.z` 바로가기, 본문 `[FOM x.y.z]`·`FCRM x.y.z` 참조 링크
- **영향** `src/features/manual/{parse.ts(manual-1.4, splitSections),types.ts(revision·splitMode·pdfPage),lookup.ts,ManualPage.tsx}`, `tools/manual-convert/build.ts`

### D-048 연료 경고 기준을 FOM 근거로 교체 (D-025 대체) + 얼러트 FOM 근거 링크
- **날짜** 2026-11-10 (사용자 승인 "안대로 진행")
- **근거 위치** FOM 연료 관리·연료 점검·이륙 필요 연료·EDTO 연료·난류 정의 절 (절 번호는 코드 `alerts/fomRefs.ts`, 내용 요약은 `private/manuals/NOTES-fom-basis.md`). 편차 %·여유 t·SR 기준 수치는 FOM에 없음
- **결정**
  1. 착륙 예상(목적지, OFP 계획 FINAL RES 기준): < FINAL **경고**(FUEL EMERGENCY, 앱은 목적지 기준만) · < FINAL×130% **경고**(MINIMUM FUEL) · < ALTN+FINAL **주의**(연료 관리). D-025의 "ALTN+FINAL+½FINAL 주의"는 삭제
  2. 편차 TRIP −2% 주의는 **임시 기준 유지**(FOM 수치 없음)
  3. Inflight 화면 표시도 같은 단계(`landingStage`, 라벨 BELOW FINAL RES / MIN FUEL PREP / BELOW ALTN+FINAL / FUEL DEV), FINAL×130% 칸 추가
  4. 값은 그대로, 근거만 FOM: 블록 < 최소 요구 → FOM 이륙 필요 연료(1t 여유 주의는 임시), ETP → FOM EDTO 연료(1.5t 여유 주의는 임시), SR → FOM 난류 정의(5·7 기준은 임시), 중량 2t → 임시 그대로
  5. 얼러트 근거 줄은 FOM 절 코드로 가져온 FOM에서 위치를 찾아 링크(`fomRefs.ts`). FOM이 없으면 "FOM 미보유" 글자만
- **영향** `src/features/inflight/{deviation.ts,InflightPage.tsx,deviation.test.ts}`, `src/features/alerts/{fomRefs.ts(신규),types.ts,useAlerts.ts,AlertsCard.tsx,rules/fuelProjection.ts,rules/planMargins.ts,rules/turbulence.ts,alerts.test.ts}`, `manual/lookup.ts`(`loadCodeRefs`)

### D-049 회사 기준 파일 — 회사 매뉴얼 "수치"는 공개 코드에 넣지 않는다
- **날짜** 2026-11-11 (사용자: 운항관리사식 브리핑 항목 1~5 "다 진행")
- **결정**
  1. 최저치·바람 제한·소방등급·Low Time 조건·저온 보정표 등 회사 기준 수치와 근거 위치(매뉴얼 쪽 코드)는 `private/manuals/company-rules.json`(형식 `efb-company-rules` v1)에만 둔다. 앱은 GitHub Pages에 공개되므로 코드·빌드에 넣지 않는다
  2. `npm run manuals`가 형식을 점검해 `private/manuals/out/company-rules.json`으로 복사 → 구글드라이브 → **Settings → 매뉴얼 → 가져오기**(매뉴얼과 같은 버튼). 기기 IndexedDB `settings`(키 `companyRules`)에 저장, 같은 버튼으로 교체·삭제
  3. 파일이 없으면 판정하지 않고 "회사 기준 파일 없음" 안내 + 기상·활주로·NOTAM 자료만 정리
  4. 근거 코드는 가져온 매뉴얼(FOM·FCOM)의 쪽 코드로 찾아 📖 링크 (예 FOM 절, FCOM LIM 쪽). 테스트는 가짜 수치로, 실제 값 대조는 private 파일이 있을 때만
- **대안** 수치를 코드 상수로 → 공개 저장소·배포판에 회사 매뉴얼 내용이 실림, 기각. 매뉴얼 본문에서 표를 실시간으로 읽기 → 표 변환이 깨져 있어(FOM 이륙·접근 표) 오판 위험, 기각(특수공항 표·공항 제한처럼 깨끗한 것만 D-052)
- **영향** `src/features/brief/rules.ts`, `manual/ManualCard.tsx`, `tools/manual-convert/build.ts`, `private/manuals/company-rules.json`

### D-050 활주로 자료 — OFP 활주로 줄 + OurAirports 진방위
- **날짜** 2026-11-11
- **결정** OFP NOTAM 공항 머리의 "1. RUNWAY : 07L/25R : 12923FT X 150FT"에서 활주로·길이·폭, 공개 자료 `public/geo/runways.json`(OurAirports runways.csv, 퍼블릭 도메인, `tools/build-runways.ts`)에서 진방위. 바람(METAR·TAF 진방위)과 성분 계산. 진방위가 없으면 번호×10(자방위, "≈M 대략") 표시. 폐쇄 NOTAM 활주로는 제외
- **영향** `brief/runways.ts`, `tools/build-runways.ts`, `public/geo/runways.json`(약 250KB, 오프라인 저장)

### D-051 NOTAM 운항 영향 읽기 — 고장 낱말이 같이 있을 때만
- **날짜** 2026-11-11
- **결정** OFP NOTAM 본문에서 공항 폐쇄·활주로 폐쇄·진입등·활주로 등화·중심선등·RVR·ILS 고장(U/S·OTS·CLSD 등 낱말 필수), GNSS 제한, 소방등급 숫자, 활주로 상태(RWYCC 3구간·Braking Action·오염 물질)를 찾는다. IAP 개정 알림은 제외, 비행 시간대 밖 NOTAM은 제외. 항상 OFP 원문 줄을 함께(오판 대비). SNOWTAM 실제 형식은 겨울 OFP로 확인 필요(K-31)
- **영향** `brief/notamImpact.ts`

### D-052 FOM 표는 기기에 가져온 FOM에서 그때그때 읽는다
- **날짜** 2026-11-11
- **결정** 특수공항 목록(ICAO/IATA 표)과 공항별 회사 제한 절은 가져온 FOM 묶음에서 읽는다(회사 기준 파일에는 절 코드만). 개정되면 FOM만 바꿔 넣으면 반영. 공항 제한 절은 제목의 "(IATA/ICAO)" 또는 국내 공항 한글 이름으로 공항을 찾고, 기종 전용 하위 절은 OFP 기종과 같을 때만 보인다
- **영향** `brief/fomTables.ts`

### D-053 개인 운항 조건 설정 (Low Time·수습·부기장 Low Time·엔진 부작동 CAT III)
- **날짜** 2026-11-11 (사용자: "Settings에서 본인이 해당되는지 켜는 방식")
- **결정** Settings → 내 운항 조건 체크 5개, 기기 안에만 저장(키 `crewProfile`). 켜면 해당 FOM 조건을 기상·바람·활주로 상태·특수공항과 비교해 알림. "엔진 부작동 CAT III 가능"은 FCOM에 자동 접근·착륙 승인만 있고 CAT III 문구가 없어 **회사 확인 전에는 꺼 둠** — 꺼져 있으면 교체공항 CAT III 구성 최저치 적용 구간을 "확인 필요" 주의로
- **영향** `brief/profile.ts`, `brief/ProfileCard.tsx`, `settings/SettingsPage.tsx`

### D-054 Briefing 탭 — 운항관리사식 공항별 브리핑·카드 초안·회항 후보, 얼러트 연결
- **날짜** 2026-11-11 (사용자: 목록 1~5 진행)
- **결정**
  1. 공항 역할(출발·목적지·목적지 교체·이륙 교체·3% ERA·EDTO·ETP·ERA 후보)별 시간 창(출발 ETD±1h, 목적지 ETA±1h, 교체 ETA±1h, 3% ERA는 비행 후반 대략)으로 TAF를 자르고(TEMPO·PROB 분리), 창 안 METAR와 함께 판정
  2. 판정: 회사 이륙 최저치 단계, 이륙 교체 필요, 접근 등급, 목적지 미달·Marginal(교체공항 추가), 교체공항 하한, 착륙 거리 계획 기준, 바람 성분 × RWYCC별 바람 제한, 자동착륙 측풍, 오염 시 CAT III 제한, NOTAM 시설 영향(진입등·등화·야간 IMC·ILS·RVR·GNSS·소방등급·폐쇄), 활주로 폭, 특수공항·공항 제한, 뇌우·우박·Windshear·화산재·어는 강수, 저온 보정(CTAC), 3% Contingency 지연 통보, MEL × 항로 요건(ATA 22·23·34), Low Time·수습 조건
  3. 차트 최저치가 회사 하한보다 높을 수 있으므로 회사 **하한 미달만 경고**, 그 위는 참고. 판정마다 근거(📖 매뉴얼·OFP 원문·기상 원문·앱 기준)
  4. 브리핑 카드 초안(합동·Takeoff·Landing·승무원 교대) — 글 복사. 회항 후보 = 지금 위치(계획 + 기록 편차)에서 거리순, 기상·최장 활주로·경고 수·특수공항
  5. 얼러트: 판정 묶음 7개 규칙(`brief-*`)으로 대시보드 Alerts에 같이. 참고(briefOnly)는 Briefing 탭에만
  6. 제빙 예상(기온 5°C 이하 + 강수·안개)은 매뉴얼 수치가 아니라 **앱 기준 참고**로만
- **영향** `src/features/brief/*`(신규), `alerts/rules/briefRules.ts`, `alerts/{types,useAlerts,AlertsCard}.ts(x)`, `app/{App,tabs}.tsx`, `styles.css`

