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


## FIR·통신 (2026-11-12)

### D-055 FIR 통신 카드 — OFP FIR 순서 + 기기 안 개인 통신표
- **날짜** 2026-11-12 (사용자: 추가 기능 목록 1번 "저장하고 1번 시작")
- **결정**
  1. FIR 순서·진입 지점·진입 시각은 **OFP 기준**: NAV LOG "/ XXXX FIR … 이름" 줄(지점 ETO) + NOTAM PACKAGE 3 "FIR:" 목록(출발 FIR·이름 보충). ADIZ 제외, 같은 FIR 연속은 하나, 재진입(예: KZAK→PGZU→KZAK)은 따로. 목록에 있는데 NAV LOG 진입 지점이 없으면 숨기지 않고 "원문 확인" 표시
  2. 진입 시각: 통과 기록이 있으면 실제 ATA, 없으면 시간 편차 반영 수정 ETO. 지금·다음 FIR = 진입 기록이 있거나 시각이 지났는가
  3. 통신 정보(CPDLC 로그온·HF·VHF·위치보고·SATCOM·메모·출처)는 **무료 API가 없고** Jeppesen·회사 자료는 저작권이 있으므로 사용자가 직접 입력하는 **개인 표**, IndexedDB `settings.firComm`에만 저장(D-049와 같은 이유). JSON 내보내기·가져오기(형식 `efb-fir-comm` v1)로 백업. "출처" 칸을 둬 근거를 남긴다
  4. 화면: Briefing 탭 = 전체 FIR + 편집 + 내보내기/가져오기, Inflight = 지금·다음 FIR(펼치기 가능). 점검 알림: 다음 FIR 진입 **10분 전**(앱 기준, 매뉴얼 수치 아님) "주파수·CPDLC 로그온 확인"
- **대안** FIR 경계 공개 자료(VATSpy 등)로 진입 시각 계산 → 비공식·근사, OFP가 더 정확해 기각(경계 지도는 목록 5번에서 "참고용"으로). 통신표를 코드에 내장 → 저작권·공개 저장소, 기각
- **영향** `src/features/fir/*`(신규), `inflight/{InflightPage.tsx,reminders.ts}`, `brief/BriefPage.tsx`, `mock/demoOfp.ts`(데모에 FIR 진입 표시, `demo-4`), `app/styles.css`

## 운항 도구·자료 신뢰 (2026-11-12, 사용자: "합친 목록 다 진행")

### D-056 Ops 탭 — 상황 카드 + 사건 기록·PA·연락처·타이머·보고서 초안
- **날짜** 2026-11-12
- **결정**
  1. 상황 카드(비정상·보안·정상운항 참고)는 **회사 매뉴얼 원문을 그대로 연다**(앱이 절차를 요약·해석하지 않음). 카드 목록·제목·사건 버튼·양식 칸·타이머 표시 시점·FOM 절 코드는 회사 기준 파일의 선택 항목 `ops`에만(D-049 방식, Mac `private/manuals/build-ops.py`가 FOM 묶음 머리로 절 제목을 채움). 앱은 형식과 화면만
  2. 사건 기록 = 순항 메모(`kind: memo`)에 "⏱ HHMMZ 이름 — 내용" → 기존 동기화·시트 칸 그대로. 수정·삭제 없음(정정 기록). 개인정보 입력 금지 안내
  3. 정보 양식(예: 도착 의료 지원 요청)은 **메모리에만**(저장·동기화 안 함, 승객 개인정보) → 글 복사
  4. 타이머(예: Tarmac Delay)는 기기 안 저장, 표시 시점은 회사 파일 값만(FOM에 있는 30분 PA). 국가별 Tarmac 시간 기준은 FOM에 없고 다른 회사 문서(미보유) → 앱에 넣지 않고 "앱에 없음" 표시
  5. PA 문안·연락처는 사용자가 넣는 개인 자료(기기 안). 문안의 `{FLT}` 등 빈칸을 OFP·기상 값으로 채우고, 못 채우면 `[이름?]`로 남김. FOM에 기장 방송 예문이 없어 기본 문안은 넣지 않음
  6. 보고서 초안 = 사건 기록 + 사건 시각 계획 위치 + 비행 정보 → 글 복사. **보고 종류·기한은 앱이 판정하지 않음**(매뉴얼 원문 링크만)
- **영향** `src/features/ops/*`(신규), `brief/rules.ts`(`ops` 형식), `app/{tabs,App}.tsx`, `inflight/InflightPage.tsx`(진행 중 타이머)

### D-057 자료 신뢰 표시 — 출처·공식 여부·시각·AIRAC
- **날짜** 2026-11-12 (사용자 질문: "모든 자료가 최신이라 비행 때 믿을 만한가")
- **결정** 새 화면의 모든 자료 옆에 출처와 성격을 붙인다: OFP·가져온 매뉴얼(개정판) = 공식 / AWC METAR·TAF·SIGMET·PIREP·NOAA SWPC = 공식 기상(발표·받은 시각) / Open-Meteo = 모델 예보(참고) / VATSpy FIR 경계·GDACS = 비공식(참고) / 통신표·PA·연락처 = 개인 입력(입력일·출처·AIRAC). 개인 통신표는 입력 후 AIRAC 주기가 바뀌면 "다시 확인" 경고 (`src/lib/airac.ts`, 기준 2401 = 2024-01-25)
- **원칙** 앱 자료는 어떤 것도 비행 판단의 단독 근거가 아니다(승인된 EFB·OFP·NOTAM·ATC·회사 매뉴얼 원본이 기준)

### D-058 버티컬 뷰 (항로 단면)
- **날짜** 2026-11-12
- **결정** Weather 탭. 가로 = 누적 거리, 세로 = FL. OFP 계획 고도(CLB/DSC 줄은 이어 그림)·MSA·SR·ETP·FIR 진입 + Open-Meteo 기압면 9개(850~150hPa)로 고도별 앞/뒷바람(진로 기준)·ISA 편차 + 0°C 고도(`freezing_level_height`) + 지점 ETO가 유효시간에 걸리는 SIGMET의 하한·상한(없으면 점선) + 지금 위치(계획+기록 편차). 기압면을 6개→9개로 늘려 받음(예전 캐시는 "다시 받기" 안내). WAFS 공식 난류·착빙·CB 격자는 WIFS 승인 계정이 필요해 넣지 않음
- **영향** `src/features/vertical/*`(신규), `weather/{api,decode,types,WeatherPage}.ts(x)`

### D-059 FIR 경계 지도 = VATSpy 공개 자료 내장 (비공식·참고)
- **날짜** 2026-11-12
- **결정** `tools/build-firs.ts`가 VATSpy Data Project(VATSIM, **CC BY-SA 4.0**, 저장소 라이선스 확인)에서 4글자 FIR만 단순화해 `public/geo/firs.json`(약 240KB, 오프라인 저장)으로. 가끔 다시 실행해 갱신. 지도에 점선, 항로 FIR은 굵게 + OFP 이름. **진입 시각은 OFP 기준**, 경계선은 "비공식, 실제 경계와 다를 수 있음" 표시와 출처·라이선스 표기
- **대안** ICAO GIS 정식 파일 유료(약 $4,000), ICAO 지도 서버 대량 받기는 약관 불명 → 기각
- **영향** `tools/build-firs.ts`, `public/geo/firs.json`, `map/MapPage.tsx`

### D-060 기상 확장 — PIREP·G-AIRMET(AWC 중계)·우주기상(NOAA SWPC)·열대저기압(GDACS)
- **날짜** 2026-11-12
- **결정** Weather 탭 카드 + 지도 레이어. PIREP는 루트 bbox(날짜변경선이면 둘)·최근 3시간·난류/착빙만, 루트 150NM 안 목록. G-AIRMET은 미국 상공을 지날 때만(0시간 다각형). SWPC·GDACS는 CORS 허용이라 직접. NHC는 CORS 없음·지역 한정이라 제외, GDACS는 항공 공식 아님 표시. 실패하면 이전 자료 유지 + 10분 동안 재시도 안 함. **Worker 허용 경로에 pirep·gairmet 추가 → 사용자가 Cloudflare에 새 코드 배포해야 배포판에서 동작**
- **영향** `weather/{extra.ts,ExtraCard.tsx,route.ts}`, `worker/wx-proxy.js`, `map/MapPage.tsx`

### D-061 OFP 열기 버튼은 맨 위 상태 줄에 하나만
- **날짜** 2026-11-16 (사용자 요청: "OFP 버튼을 맨 윗줄에 하나만")
- **결정** "OFP 열기"는 모든 화면 맨 위 상태 줄(ONLINE·SYNC 옆)에만 둔다. 사이드바·Dashboard·OFP·PDF·추출·NOTAM·MEL·Inflight의 버튼은 없애고 "맨 위 OFP 열기" 안내 글로 바꿈. 아이폰 폭(<480px)에서는 "OFP"로 줄여 표시. 여는 중·실패 문구는 상태 줄 아래 한 줄(성공은 OFP 화면으로 이동)
- **영향** `app/{StatusBar,App}.tsx`, `ofp/OfpOpenButton.tsx`(`compact`, `OfpImportLine`), 위 화면들

### D-062 매뉴얼 링크는 그 자리에서 보기 (탭 이동 없음)
- **날짜** 2026-11-16 (사용자 요청: MEL 보고 돌아오기 불편, "누르면 그 자리에서", Ops 규정도 열고 닫기)
- **결정**
  1. MEL 카드의 항목·(o) 절차·상위 항목 버튼과 Ops 상황 카드의 📖 근거는 **카드 안에서 펼치기/접기**(`ManualInline`: 항목만/쪽 전체, 앞뒤 쪽, "Refer to" 이동·되돌리기, 닫기)
  2. 그 밖의 📖 링크(얼러트·Briefing·Ops 양식/타이머)는 **화면 위 창**(`ManualPopup`). 바깥·닫기·Esc로 닫으면 보던 화면·스크롤 그대로
  3. 큰 화면이 필요하면 "Manual 탭에서 크게 보기"(예전 동작 `openManualTab`)
- **영향** `manual/{ManualInline.tsx(신규),lookup.ts,MelPage.tsx}`, `alerts/AlertsCard.tsx`(`BasisRow` `onManual`), `ops/OpsPage.tsx`, `app/App.tsx`

### D-063 기상 시간대별 보기 + 플랜 뷰
- **날짜** 2026-11-16 (사용자 요청: 시간대별 기상, 지금 기준 몇 시간 전/후, vertical·plan view)
- **결정**
  1. Open-Meteo 바람·기온·0°C 고도를 **시간대별로 저장**(`WindsData.times` + 지점별 `series`). 받는 범위: 비행이 24시간 안이면 지금 −3h ~ 마지막 ETO(또는 지금) +3h, 더 먼 비행은 첫 ETO −3h부터, 최대 48시간. 지난 비행·범위 밖은 지금 −6h ~ +12h. 예전 캐시는 "다시 받기" 안내
  2. 시각 선택(버티컬·플랜 뷰 공통): **지점 통과 시각**(지점마다 ETO+기록 편차의 예보, 기본) ↔ **시각 고정**(슬라이더·▶ 재생·지금). 항상 "지금 ±Nh"와 UTC 표시, 지난 시각은 "관측 아닌 모델 값" 표시. 시각 고정이면 버티컬 뷰에 그 시각 예상 위치 선
  3. **플랜 뷰**(Weather 탭): 위에서 본 항로(오프라인 Natural Earth 육지) — 계획 FL 또는 FL290·330·370·410에서 앞/뒷바람·ISA 편차·난류 지수·기온을 항로 색으로, 바람 화살표, 그 시각 유효 SIGMET, PIREP 난류
- **대안** 항로 좌우 격자(면 전체)는 받는 양이 3배 → 이번엔 항로 선만
- **영향** `weather/{api,types}.ts`(`windsWindow`), `vertical/{wxTime,useWxPick,TimeBar,PlanView}.ts(x)`(신규), `vertical/{profile.ts,VerticalView.tsx}`, `weather/WeatherPage.tsx`

### D-064 난류 지수·기온 변화 (모델 계산, 참고) · EDR
- **날짜** 2026-11-16 (사용자 요청: EDR·난류 자료·기온 변화)
- **결정**
  1. **공식 EDR(WAFS 난류) 격자는 무료로 못 씀**(WIFS 승인 필요, K-38). 대신 기압면 값으로 앱이 **난류 지수**를 계산: 이웃 기압면 사이 수직 풍속 차(VWS, kt/1000ft)와 리처드슨 수(Ri). **앱 임시 기준**(일반 기상 경험치, 회사 기준 아님): VWS ≥ 4/6/9 또는 Ri < 1/0.5/0.25 → 약/중/강. 기압면 간격이 넓어 실제 시어보다 작게 나옴 — 화면에 "공식 EDR 아님" 표시
  2. **기온 경도**(거리 방향 °C/100NM)와 **기온 변화 3h**(선택 시각 − 3시간 전) 칸
  3. **EDR 값**은 PIREP/AIREP 원문에 `EDR 0.xx`가 있을 때만 표시(지어내지 않음). 버티컬 뷰(항로 100NM 안)·플랜 뷰에 난류 PIREP 삼각형
- **영향** `vertical/{wxTime.ts,profile.ts,VerticalView.tsx,PlanView.tsx}`

### D-065 Map 탭 = 지도 + 시간 재생 + 항로 기상 모음 (공항 METAR·TAF만 Weather)
- **날짜** 2026-11-16 (사용자 요청: 맵 기상 재생·움직이기, 버티컬 뷰 밑에, "ATIS·TAF 빼곤 기상은 다 여기 탭으로")
- **결정**
  1. Map 지도 위에 시각 막대 하나(D-063 시각 선택 공유): 목록 = **지난 위성 영상 −3h~−30분(30분 간격, 관측)** + 지금 + **Open-Meteo 예보 시각(모델)**. ▶ 재생(1.2초 간격, 끝나면 처음부터)
  2. 시각에 따라: 위성 = 30분 넘게 지난 시각이면 NASA GIBS 그 시각 영상(GIBS가 직전 영상으로 맞춤), 지금·미래면 최신(위성은 미래가 없음 — 화면에 표시) / 바람 화살표 = 그 시각(또는 지점 통과 시각) 예보 / SIGMET·G-AIRMET = 그 시각에 유효한 것 / ✈ = 그 시각 예상 위치(계획+기록 편차)
  3. 지난 시각 위성 조각은 IndexedDB wxFrames에 시각별 저장, 12시간 지나면 지움(최신은 기존대로 30분)
  4. 지도 아래: 버티컬 뷰 → 플랜 뷰 → SIGMET 목록 → 항로 바람 표 → 기상 추가(우주기상·PIREP·열대저기압). **Weather 탭은 갱신·비행 준비·공항 METAR·TAF만** (ATIS는 앱에 없음)
- **영향** `map/{MapPage.tsx,satellite.ts}`, `vertical/{TimeBar,useWxPick,VerticalView}.tsx`, `weather/WeatherPage.tsx`

### D-066 Manual 탭 "돌아가기"
- **날짜** 2026-11-16 (사용자 요청: 크게 보기로 Manual 탭에 간 뒤 원래 화면으로 돌아가는 버튼)
- **결정** "Manual 탭에서 크게 보기"로 오면 Manual 탭 맨 위에 "← (원래 탭)(으)로 돌아가기" 버튼. 누르면 원래 탭·스크롤 위치로, 창(📖)에서 왔으면 그 창을 다시 열고, MEL·Ops에서 펼쳐 둔 매뉴얼은 펼친 그대로(펼침 상태를 메모리에 보관 — 앱을 다시 열면 초기화). 다른 탭으로 직접 옮겨 가면 돌아가기 정보는 버림
- **영향** `manual/{lookup.ts,ManualPage.tsx,ManualInline.tsx,MelPage.tsx}`, `ops/OpsPage.tsx`

### D-067 항로·OFP 번호 일치 확인 + 난류 구간 이륙 후 누적 시간
- **날짜** 2026-11-16 (사용자 요청: "flight plan route가 여러 군데 있는데 다 같은지, OFP no.도 전부 같은지 확인 → FLIGHT에 표시", "흔들리는 구간을 이륙 후 누적 시간으로", 난류 표 잘림)
- **결정**
  1. 파서가 OFP 원문 전체(복사본 포함)에서 **항로**가 나오는 곳 = CFP 요약 항로(2ND-$ 다음) · OFP FPL · **제출된 ATS FPL 사본**(기준) · NAV LOG 지점 순서, **OFP 번호** = CFP PLAN · 디스패치 릴리스 PLAN # · DATAPLAN REQUEST NO.(앞 0 무시)를 모두 찾아 비교 → `OfpData.routeCheck`
  2. 같은 것으로 보는 표기 차이: `..` ↔ DCT, `WPT/N0480F340` 속도·고도 변경점, 같은 항로 위 중간 지점(A123 WPTAA A123), N07E142 ↔ 07N142E, 출발·도착 SID·STAR(회사 안내: 제출 FPL과 다를 수 있음). 출발·도착이 다른 FPL(다른 구간)은 비교에서 뺌
  3. 화면: OFP → FLIGHT 카드 ROUTE 아래 "✓ 이 OFP의 ROUTE n곳 모두 같음 · ✓ OFP NO. nnnn n곳 같음", 펼치면 곳마다 결과·원문 줄(L…) 이동. 다르면 빨간 ⚠와 처음 다른 지점. 앱 확인일 뿐 원본 OFP·ATC 허가가 기준
  4. 난류(SR) 구간: 표 → 두 줄 목록(좁은 카드에서 안 잘림), **T/O +h:mm ~ +h:mm (구간 길이)** = NAV LOG 계획 누적 시간. Dashboard·Briefing 카드 문구에도 이륙 후 시간
- **영향** `ofp/parser/{routeCheck.ts(신규),index.ts}`(AVIATOR_PARSER_VERSION 1.4 → 저장된 OFP 자동 재파싱), `ofp/types.ts`, `ofp/doc/{OfpDocument,Turbulence}.tsx`, `ofp/OfpPage.tsx`, `dashboard/DashboardPage.tsx`, `brief/cards.ts`

### D-068 AGTOW 계산 표시
- **날짜** 2026-11-16 (사용자: "agtow 구하는거 보여줘", 이어서 "설명은 필요 없고 뭐+뭐=얼마, 그중 가장 낮은 게 AGTOW만 표시")
- **결정** OFP → WEIGHTS 아래에 MTOW · RWY · TCAP · MZFW + TOF · MLDW + TIF 값을 나열하고 가장 낮은 줄을 AGTOW로 강조. TOF = TOW − ZFW, TIF = TOW − LDW. 식은 샘플 10개 모두 OFP의 AGTOW·ACL(= AGTOW − SOW − TOF)과 일치함을 확인(자동 테스트). OFP에 AGTOW가 없으면(데모 등) 표시하지 않음, OFP 값과 다르면 ⚠
- **영향** `ofp/agtow.ts`(신규)·`agtow.test.ts`, `ofp/doc/OfpDocument.tsx`

### D-069 난류 SR 구간을 지도·버티컬 뷰에 + 누르면 지도에서 보기
- **날짜** 2026-11-16 (사용자: "두 번째 것(난류 SR) 기상에 표시, 누르면 보이게")
- **결정** Map 레이어 "난류 SR"(기본 켬): OFP NAV LOG SR 구간을 굵은 선(주의 주황·HIGH 빨강) + "SR8 +1:57" 꼬리표, 누르면 구간·시각·이륙 후 시간. 버티컬 뷰 "SR 구간 (OFP)": 계획 고도 ±1,000 ft 띠. OFP 카드와 Map 아래 Turbulence 목록에서 구간을 누르면 Map에서 그 구간으로 이동·확대. SR 기준은 기존 임시값 그대로
- **영향** `ofp/turbulence.ts`(`useTurbFocus`), `ofp/doc/Turbulence.tsx`, `map/MapPage.tsx`, `vertical/VerticalView.tsx`

### D-070 우주기상 카드 정리 · 설명 · FOM 근거 · 자동 갱신
- **날짜** 2026-11-16 (사용자: 카드 잘림, 설명, "FOM·FCRM에 있으면 찾아서 MEL처럼", 위 기상 갱신에 묶고 카드 갱신 버튼 제거)
- **결정**
  1. 칸 6개(R·S·G·오늘 확률 R1–2 / R3+ / S1+)를 자동 줄바꿈 격자로 — 잘림 없음. 항로 최고 위도와 영향 안내(78° 이상 Polar, 60° 이상 고위도)
  2. "등급 뜻" 펼치기: NOAA 등급표 요약(R = 낮 쪽 HF, S = 극지 HF·방사선, G = 고위도 HF·GNSS)
  3. 회사 근거: FOM에서 찾은 절 3곳(Polar 운항 일반·참고사항, HF 통신 — 세부는 미보유 별도 매뉴얼로 넘김, 절 번호는 private 메모). FCRM에는 해당 내용 없음. 절 코드는 회사 기준 파일 `refs.spaceWeather`에만(build-ops.py), 카드에서 📖 펼치기/접기(MEL·Ops와 같은 `RefList`)
  4. 카드의 "지금 갱신" 버튼 제거 → 맨 위 ⟳ 기상·Weather "지금 갱신"·1분 주기 자동 점검이 우주기상·PIREP·열대저기압까지 함께 받음
- **영향** `weather/{ExtraCard.tsx,store.ts}`, `manual/RefList.tsx`(신규, Ops에서 옮김), `brief/rules.ts`(`refs.spaceWeather?`), private `build-ops.py`·`company-rules.json`

### D-071 맨 위 줄: OFP 열기 · ⟳ 기상 · ⤓ 저장 · OUTBOX 같은 모양
- **날짜** 2026-11-16 (사용자: "OFP 열기 옆에 기상 갱신·저장 버튼, OUTBOX도 균일하게")
- **결정** ⟳ 기상 = 기상 전부 지금 받기(METAR·TAF·SIGMET·바람 + 우주기상·PIREP·열대저기압), ⤓ 저장 = Weather "비행 준비 완료"와 같은 오프라인 저장(기상 + 루트 위성), OUTBOX = 같은 버튼 모양(대기 건수, 실패 시 빨강, 누르면 Settings). 진행·결과는 상태 줄 아래 한 줄(6초). 1023px 이하는 아이콘만, 479px 이하는 ONLINE 글자·DEMO 표시 숨김
- **영향** `app/StatusBar.tsx`, `weather/{actions.ts(신규),ui.tsx}`, `ofp/OfpOpenButton.tsx`(`OfpImportLine`)

### D-072 NAV LOG MSA 100 이상 강조
- **날짜** 2026-11-16 (사용자 요청)
- **결정** MSA 값 100(=10,000 ft) 이상 칸을 주황 굵게(배경 옅은 주황). 기준 100은 사용자 지정. MSA 열은 기존대로 1280px 이상에서만 보임
- **영향** `ofp/doc/NavLog.tsx`, `styles.css`

### D-073 그 자리 창 + "크게 보기" + 돌아가기 (앱 공통) · OFP 카드 정리
- **날짜** 2026-11-16 (사용자: EDTO 깨짐·전체 점검, AGTOW 열 맞춤, 총 승객 수, PAX·CARGO는 LDW 밑·좌석 등급은 맨 위, 난류는 누르면 MEL처럼 창 + 새 창에서 보기 + 뒤로가기, OFP MEL/CDL도 같게)
- **결정**
  1. 돌아가기 공통화: `app/returnTo.ts`(`goWithReturn`·`goBack`) — "크게 보기"로 다른 탭에 가면 그 탭 맨 위에 "← (원래 탭)(으)로 돌아가기", 누르면 같은 스크롤 + 창에서 왔으면 창 다시 열기. 다른 탭으로 직접 가면 기억 버림. Manual(D-066)도 이것으로 옮김
  2. 난류 SR: OFP에서 구간을 누르면 **창**(확대 플랜 뷰 = 오프라인 육지 + 구간 강조 + 지점별 FL·ETO·이륙 후 시간·SR) → "Map에서 크게 보기" → Map 탭 그 구간 + 돌아가기. Map 아래 목록은 지도 바로 이동(기존)
  3. OFP MEL/CDL 줄: 누르면 가져온 매뉴얼 항목을 **창**으로(MEL 탭과 같은 매칭), "Manual 탭에서 크게 보기" + 돌아가기. 매뉴얼에 없으면 누를 수 없음
  4. WEIGHTS: 맨 위 좌석 등급(OFP 예약 표기 그대로 앞/뒤) + **TOTAL PAX**(앞 숫자 합 / 뒤 숫자 합), LDW 아래 "PAX · CARGO · 기타 = PAYLOAD"(무게), AGTOW는 항목·계산·값 3열 표
  5. 좁은 카드 깨짐: OFP 카드 표 머리글 줄바꿈 허용·칸 여백 축소, ETP·ALTERNATES 표는 넘치면 표 안에서만 가로 스크롤. 전 탭 375·768·1180·1440 × 주간/야간 점검
  6. 플랜 뷰 SIGMET 다각형을 통째로 옮기도록 수정(날짜변경선 근처 가로 띠 버그)
- **영향** `app/{returnTo.ts(신규),App.tsx}`, `manual/{lookup.ts,ManualPage.tsx}`, `ofp/doc/{TurbPopup.tsx(신규),OfpDocument.tsx,Turbulence.tsx}`, `ofp/turbulence.ts`, `vertical/PlanView.tsx`, `styles.css`

### D-074 NAV LOG 표시 정리 · AGTOW 모양
- **날짜** 2026-11-16 (사용자: "TOC·TOD·ETP 색 빼고 앞에 표시만, 난기류를 줄 전체 색으로, MSA 고도별 진하기", AGTOW 더 깔끔하게)
- **결정** TOC ▲ · TOD ▼ · ETP ◆ 를 이름 앞에만(줄 색 없음). 난류 SR 구간 지점은 줄 전체 옅은 색(주의 주황·HIGH 빨강) + 왼쪽 선. MSA 칸 배경을 고도에 비례해 진하게(2,000 ft 미만 없음 → 20,000 ft 이상 최대, D-072의 100 이상 주황 대신; 100 이상은 굵은 글씨 유지). AGTOW는 왼쪽 항목(아래 작은 계산식) · 오른쪽 값 두 줄 모양
- **영향** `ofp/doc/{NavLog,OfpDocument}.tsx`, `styles.css`

### D-075 NAV LOG: 줄 색 없이 숫자만
- **날짜** 2026-11-16 (사용자: "MSA는 100부터만, SR은 표에 색 빼고 앞에만, 숫자는 색 변경·볼드")
- **결정** 난류 SR 구간 줄 색 제거 → 지점 이름 칸 왼쪽 색 선만 + SR 숫자를 등급 색(주의 주황·HIGH 빨강)·굵게. MSA는 100(10,000 ft) 이상만 숫자를 굵게 + 높을수록 진한 주황 글자(100 → 반, 200 이상 최대), 칸 배경 없음 (D-074의 MSA 배경·SR 줄 색 대체)
- **영향** `ofp/doc/NavLog.tsx`, `styles.css`

### D-076 매뉴얼 쪽 사진 묶음 (그림·표 보완)
- **날짜** 2026-11-16 (사용자: "매뉴얼 변환 다시 하자" — 그림·표를 보기 좋게, 토큰 아끼며, 아이패드에 두고 보기)
- **결정**
  1. 글은 지금처럼 MD 묶음. Mac `npm run manuals -- --images`가 inbox의 원본 PDF로 **그림·그려진 표가 있는 쪽만** JPEG(110dpi·품질 60)으로 만들어 매뉴얼별 사진 묶음 `<docId>-img.efbimg`(40 MB 넘으면 `-1`, `-2` … 부분 파일)을 `private/manuals/out/`에 낸다. 변환은 Mac 안에서만(토큰 0)
  2. 쪽 연결: 글 묶음 쪽의 쪽 표시(ref) 글자를 PDF 쪽에서 차례로 찾음(FOM처럼 pdfPage가 있으면 그대로). 고르는 기준: 큰 그림(60×60pt 초과) 또는 선 80개 초과(그림·표), MEL은 그림만(표가 많아 전부 걸리므로)
  3. 아이패드: Settings → 매뉴얼 → 가져오기에서 `.efbimg`도 받음(글 묶음 먼저). IndexedDB v4 `manualImages`·`manualImgIndex`. 글 개정과 사진 개정이 다르면 쓰지 않고 표시. 매뉴얼 삭제 시 사진도 삭제
  4. 매뉴얼 화면(Manual 탭·창·MEL 펼치기): 그 쪽에 사진이 있으면 "🖼 원본 쪽 사진" 버튼 → 펼쳐 보기, 누르면 새 창에서 크게
  5. FOM은 원본 PDF가 inbox에 없어 사진 없음(넣으면 만들어짐) → 2026-11-17 원본 PDF 받아 생성, 아이패드 가져오기·표시 확인
- **영향** `tools/manual-convert/{pdf2img.py(신규),build.ts}`, `db/schema.ts`(v4), `manual/{store.ts,ManualCard.tsx,PageImages.tsx(신규),ManualInline.tsx,ManualPage.tsx}`

### D-077 Manual 탭: 목차 · 쪽 번호로 이동 · 한국어 띄어쓰기 검색
- **날짜** 2026-11-17 (사용자: "원하는 페이지 쳐넣거나 바로 갈 수 있게", "목차 보기 없나?", "검색이 잘 되는지 모르겠네")
- **결정**
  1. 목차: 묶음에 따로 목차가 없으므로 앱이 쪽 정보로 만든다(묶음 다시 만들 필요 없음). 절 단위(FOM·FCRM) = 장별로 묶고 절 번호 깊이로 들여쓰기. 쪽 단위(Airbus) = 같은 쪽 코드가 이어진 구간 하나가 항목(쪽 수 표시), 코드 앞부분(DSC-21, MI-24, CDL은 장 번호)으로 묶고, 항목 제목들이 같이 쓰는 앞부분을 묶음 이름으로 올림. 맨 위 줄 "목차" 버튼 → 지금 위치의 묶음이 펼쳐지고 지금 항목 강조, 누르면 그 쪽으로 이동하고 닫힘
  2. 쪽 이동: "순번/전체" 숫자를 누르면 입력 칸. 숫자 = 앱 순번(…/전체와 같은 번호), `p34` = 원본 PDF 쪽(FOM처럼 알 때), 그 밖은 기존 검색 바로가기 규칙(쪽 코드 DSC-21-20, 절 번호 1.2.3, MEL 번호)
  3. 검색: 한국어 낱말은 띄어쓰기만 달라도 찾음(공백 빼고 다시 비교, 점수 낮게). 영어는 그대로(낱말 경계가 섞이지 않게)
- **확인** 실제 묶음 5개로 목차·검색 미리 봄(Mac 안, 결과는 출력만): 매뉴얼 5개 모두 빈 제목 없이 목차가 만들어짐. 붙여 쓴 한국어 검색어도 찾음
- **영향** `manual/lookup.ts`(`buildToc`, `searchPages`), `manual/ManualPage.tsx`, `app/styles.css`, 테스트 3개

### D-078 OFP 탭 FMS 대조 · RVSM 체크 · Ops 정상 절차 체크리스트
- **날짜** 2026-11-18 (사용자: "비행기에 직접 입력한 거랑 OFP 값 차이 적는 란", "coordination·gate no", "rvsm check", "FCOM normal procedure·FOM 바탕 체크박스, Ops에 정상/비정상 탭", 개인 약어 BALT DEBTN HWP. 선택: OFP 탭 맨 위 · 단계적 · 기본 목록 BALT DEBTN HWP + FMS CHK + HAA)
- **결정**
  1. OFP 탭 맨 위 "FMS 대조": RAMP FUEL·FOB(OFP 기준 = BLOCK) · TRIP TIME(OFP TRIP 줄 시간, 없으면 비행 시간) · TOTAL DIST(마지막 지점 누적 거리) ↔ 입력값, 차이 = 입력 − OFP. GATE NO · COORD(게이트 좌표) 글 칸. RVSM: QNH 한 칸(100 넘으면 hPa, 아니면 inHg로 보고 둘 다 표시), 고도계 L·STBY·R과 서로 차이
  2. 허용치 판정은 하지 않음(근거 없는 임계값 금지) — 차이 숫자만, 0이면 초록·아니면 주황 글자
  3. Ops 탭을 "정상 절차 | 비정상·상황" 두 탭으로. 기존 내용(사건 기록·상황 카드·PA·연락처·보고서)은 "비정상·상황", 진행 중 타이머는 두 탭 모두
  4. 정상 절차: 개인 체크리스트(기본 FMS CHK · BALT · DEBTN · HWP, 화면에서 항목 추가·빼기·기본으로), 체크 시각 기록, 비행마다 따로. HAA 칸(HDG·ALT·AIR SPEED·REQUIRED FUEL). 기기에 있는 FCOM의 정상 절차(PRO-NOR-SOP) 목차를 그 자리 창으로 열기(D-077 목차 재사용, 원문 그대로)
  5. 저장: IndexedDB settings 키(`fmsCheck:<비행>`, `opsChecks:<비행>`, `opsHaa:<비행>`, `opsChecklist`) — 기기 안, 시트 동기화 안 함(순항 기록 아님). 입력은 0.4초 뒤 저장
  6. 다음 단계(미정): FCOM SOP·FOM에서 단계별 체크 항목을 Mac에서 뽑아 회사 기준 파일(비공개)에 넣기 — 회사 매뉴얼 내용이라 공개 코드에 넣지 않음
- **영향** `checks/checks.ts`(신규), `ofp/doc/FmsCheck.tsx`(신규), `ops/Checklist.tsx`(신규), `ops/OpsPage.tsx`, `ops/store.ts`(`useDraft`, 키 도구 공개), `ofp/doc/OfpDocument.tsx`, `app/styles.css`

### D-079 FMS 입력을 OFP 원래 카드 안으로 · SYSTEMS 카드 · FCOM RVSM 허용 차이 (D-078 1·2·4번 일부 대체)
- **날짜** 2026-11-18 (사용자가 시안 여러 번 확인: "앱 원래 포맷 유지", "입력칸 위아래가 넘 커", "3자리·소수점(klbs)·6자리 다 되게", "rvsm 편차 limitation fcom 보고 넣어", "하이드롤릭은 노말 체크", "eng oil limitation 링크 MEL처럼", "QNH 1013 = hPa, 범위 찾아봐". 시안 `private/design/2026-11-18-ofp-fms-entry-mockup-v2.html`)
- **결정**
  1. OFP 탭 맨 위 별도 "FMS 대조" 표는 없앰. FUEL·FLIGHT 카드는 원래 포맷 그대로 + 오른쪽 얇은 FMS 열. 입력 칸은 테두리 없이 표 숫자와 같은 글씨·줄 높이, 차이는 같은 줄 왼쪽 작은 글씨(0 = ✓ 초록, 그 밖 주황). Enter = 다음 칸
  2. FUEL: TRIP 줄 = 시간, RAMP OUT 줄 = FOB, FOD 줄 = FOD. 연료 칸은 `290`·`290.2`(천 단위) · `290200` 모두 290,200 (소수점이 있거나 1000 미만이면 ×1000). RESERVE 입력 없음. 아래 줄에 2ND BEST FL·TRIP·시간 + 계획 대비 차이 (Jeppesen `2ND-$ FL 연료(100LBS) 시간`)
  3. FLIGHT: 회색 줄에 SPEED SKD(CLB·CRZ CI·DSC)·APMS/P %. FMS 표 DIST(OFP 비교) · MAX FL(OFP 비교) · OPT FL · EO FL(`FL` 자동) · GATE(대문자) · COORD(N/S·E/W 버튼 + 숫자 → `37°27.1'`·`126°27.0'`, 분 소수 첫째 자리)
  4. RVSM: QNH 단위는 FCOM 기압 설정 범위(745–1100 hPa / 22.00–32.48 inHg)로 판별 — `745~1100` hPa, `2200~3248` ÷100 inHg, 소수점 있으면 inHg, 그 밖 "범위 밖". 1050 hPa(31.00 inHg) 초과면 ">1050 SUPP"(FCOM 보충 절차 있음). 고도계 CAPT·STBY·F/O, STBY·F/O는 CAPT 대비 차이를 **FCOM PRO-SPO-RVSM "Maximum differences between altitude indications" 지상 값(F/O 20 · STBY 30 ft)**과 비교해 ✓/⚠ — 근거가 FCOM이라 D-078 2번(판정 안 함)을 이 부분만 바꿈. 표 전체(지상~FL410)와 지상 조건(공항 표고 차 < 75 ft)을 원문대로 아래에 표시
  5. 새 카드 SYSTEMS · PRE-FLIGHT: ENG OIL 1~4 (qt, `185`→18.5) + "📖 LIMIT"(기기에 있는 FCOM LIM-ENG OIL QUANTITY 쪽을 MEL처럼 그 자리 창으로), HYD GREEN·YELLOW = NORMAL 체크(체크 시각), OXY CREW·CABIN (psi). 오일·산소 최소량 자동 판정은 안 함
  6. Ops 탭 "FCOM 정상 절차 원문" 칸은 뺌. Ops 체크리스트 모양은 다음 시안에서
  7. 저장은 D-078 그대로 `fmsCheck:<비행>`(필드 이름은 바뀜 — D-078 코드는 배포 전이라 옛 값 옮기기 없음). 세 카드가 한 값을 같이 씀
- **영향** `checks/checks.ts`(`parseKilo`·`parseQnh`·`parseFl`·`fmtCoord`·`parseOil`·`altChecks`·`RVSM_MAX_DIFF`), `ofp/doc/Fms.tsx`(신규, `FmsCheck.tsx` 삭제), `ofp/doc/OfpDocument.tsx`, `ofp/parser/aviator.ts`·`index.ts`(`aviator-1.5`)·`types.ts`(`speedPlan`·`secondBest`), `ops/Checklist.tsx`, `app/styles.css`(`--hyd-green`·`--hyd-yellow` 토큰)

### D-080 SYSTEMS 카드 새 모양 · 오일 최소량 계산 · RVSM 기준표 · 열 고정 (D-079 일부 대체)
- **날짜** 2026-11-19 (사용자가 시안 확인: "WEIGHTS·SYSTEMS 자리 바꿔", "가운데 글자 움직여 정신없음 → 고정", SYSTEMS 칸 묶음 3개 합치기, "오일은 비행시간 보고 산정, OFP RAMP OUT 시간 기준", "주황 표시 해", "FT가 피트로 읽혀", "제목 누르면 limitation 연결, 없으면 FCOM 찾아봐", RVSM R2 + "PFD끼리 / PFD↔ISIS", "75 ft 확인". 시안 `private/design/2026-11-19-final-systems-rvsm-mockup.html`)
- **결정**
  1. 카드 순서: FLIGHT → FUEL → WEIGHTS → SYSTEMS → ALTERNATES …
  2. FMS 칸이 있는 표는 열 너비 고정(`table-layout: fixed`) — 입력·"범위 밖"이 생겨도 가운데 열이 움직이지 않음
  3. SYSTEMS: ENG OIL 4칸(칸 묶음) + MIN OIL 표(FCOM LIM-ENG 규칙에 **OFP RAMP OUT 시간** 넣어 계산, 소수 첫째 자리 올림, 이 비행에 맞는 규칙만 표시) · HYD GREEN/YELLOW NORMAL 체크 버튼 · OXY CREW/CABIN 2칸. 오일 입력이 최소량 두 값(OAT<0 / OAT≥0) 중 **큰 값보다 적으면 주황** — FCOM 근거라 D-079 5번 "판정 안 함"을 오일만 바꿈(OAT는 아직 모름 → 보수적으로 큰 값)
  4. 비행 시간 표시는 "FT" 대신 **FLT**(피트와 혼동 방지)
  5. SYSTEMS 칸 제목을 누르면 기기에 있는 FCOM 쪽을 그 자리 창으로: ENG OIL → `LIM-ENG` OIL QUANTITY, OXY → `LIM-OXY` MINIMUM FLIGHT CREW OXYGEN PRESSURE, HYD → FCOM LIM에 유압 양 쪽이 없어 `PRO-NOR-SOP` "RESERVOIR FLUID LEVEL … CHECK WITHIN NORMAL RANGE"(HYD SD 화면 정상 범위)
  6. RVSM: QNH · **ELEV(공항 표고, 직접 입력)** · CAPT PFD(vs ELEV) · F/O PFD(vs CAPT) · STBY ISIS(vs CAPT). ✓/⚠ = GND 기준. 아래 기준표 — 행 GND(QNH)·CRZ(약 1시간마다)·FL300+(M.85), 열 PFD↔표고(각 PFD vs ELEV)·PFD↔PFD(기장 vs 부기장)·PFD↔ISIS: GND 75 FOM / 20 FCOM / 30 FCOM, CRZ PFD↔PFD 200 FOM, FL300+ 150 / 320 FCOM(FL410 ISIS 360). 근거 FOM 10.4.1.3 b)·d), FCOM PRO-SPO-RVSM. FCOM 큰 표는 뺌
- **영향** `checks/checks.ts`(`minOil`·`RVSM_LIMITS`·`altChecks` ELEV, `ofpRefs.flightMin`, `FmsEntry.elev`; `RVSM_MAX_DIFF` 삭제), `ofp/doc/Fms.tsx`, `ofp/doc/OfpDocument.tsx`, `app/styles.css`


### D-081 FMS·RVSM 카드 분리 · FMS 입력용 앱 키보드
- **날짜** 2026-11-19 (사용자: "위에랑 분리하고 2개로 나눠서 FUEL 카드 포맷처럼", "요약 배지 필요 없음, MAX FL OFP 값 없어도 됨, 기존 내용 그대로 잘라서 떼어내기만". 키보드: 다른 EFB 앱 사진처럼 "가로세로일 때 이 키보드로 + 다음칸·이전칸 버튼", 시안 C 선택, "숫자 좀 더 줄여도 돼". 시안 `private/design/2026-11-19-fms-rvsm-split-mockup.html`·`2026-11-19-keyboard-mockup.html`)
- **결정**
  1. FLIGHT 카드 아래 FMS 표·RVSM 표를 따로 된 카드 **FMS**, **RVSM · ALTIMETERS**로 분리(FLIGHT 바로 다음). 내용·입력은 그대로, 머리줄 배지 없음. MAX FL의 OFP 값·차이 표시 뺌(D-079 일부 대체)
  2. iOS 시스템 키보드 배치는 웹앱이 바꿀 수 없음 → **앱이 직접 그린 키보드**. 화면 폭 768px 이상(아이패드 가로·세로)에서만, FMS 입력 칸(FMS·RVSM·FUEL·SYSTEMS)에만. 아이폰 폭은 지금처럼 iOS 키보드
  3. 배치 = 시안 C: 위 막대(‹ 이전 · 다음 › · 칸 이름 · OFP 값 · 완료) + 왼쪽 QWERTY(⌫, 다음 ↵, . / :, -, space, 칸 비우기) + 오른쪽 작은 숫자판(1-2-3 위, . 0 ⌫). 숫자판 폭 = 전체의 약 1/4
  4. 블루투스 키보드·Enter=다음 칸은 그대로. 순항 기록 입력 창도 같은 키보드 → D-082
- **영향** `ofp/doc/{Fms.tsx,FmsKeyboard.tsx(신규),OfpDocument.tsx}`, `app/styles.css`(`--kb-*` 토큰, `.kb*`)

### D-082 순항 기록 입력 창에도 앱 키보드
- **날짜** 2026-11-19 (사용자: "순항에도 쓰기")
- **결정** D-081 키보드를 앱 전체 하나(`app/AppKeyboard.tsx`, `App.tsx`에 둠)로 옮기고 순항 통과 기록 창(ATA·FUEL)에도 연결. 위 막대 힌트 = ATA는 ETO(수정값), FUEL은 PLAN 잔량. 이전/다음은 창 안 칸끼리만. 키보드가 열려 있으면 본문·창 아래에 키보드 높이(`--kb-h`)만큼 여백(`.kb-open`) → 창이 위로 올라가 가리지 않음. 입력 칸이 사라지면(창 닫힘·탭 이동) 키보드도 닫힘
- **영향** `app/{AppKeyboard.tsx(ofp/doc/FmsKeyboard.tsx에서 옮김),App.tsx,styles.css}`, `inflight/EntrySheet.tsx`, `ofp/doc/{Fms.tsx,OfpDocument.tsx}`

### D-083 합동 브리핑 (체크리스트 + 원고, 편집·저장) · OFP 계획 방식 표시
- **날짜** 2026-11-19 (사용자: 시안 A 체크리스트형 + C의 서비스·"포함할 문단" 칩 + B 원고 출력. "원고 preset 내가 수정할 수 있게, 저장되게", "녹색 부분은 변경 가능", "체크리스트에서 추가·삭제·수정·순서 변경". 앞서 "OFP에 3% contingency인지 EDTO인지 refile인지 표기". 시안 `private/design/2026-11-19-joint-brief-mockup.html`)
- **결정**
  1. Ops 탭 첫 화면 "합동 브리핑": 왼쪽 체크리스트(a 모든 비행 / b 첫 비행·교체, 말했음 체크, 칩으로 고르기, 칸에 쓰기, 포함할 문단 칩, 첫 비행·교체 ↔ 이어서), 오른쪽 원고(그대로 읽는 문장, 초록 점선 = OFP 자동, 칩 = 눌러서 바꿈, 복사). 아이패드 가로(≥1024) 두 칸, 그 아래 위아래
  2. 원고 틀 문법: `{편명}` OFP 자동 · `[가|나]` 고르기 · `<음어>` 직접 쓰기. 자동 값: 편명·출발·도착·기종·등록부호·비행시간·출발/도착시각·순항고도·계획방식·승객(예약)·화물·객실결함(MEL 25·33·35·38·44장)·MEL·난류(OFP SR 구간별 시각·경과 + Light/Moderate/Severe 고르기)
  3. 항목 목록 우선순위: 사용자가 고친 목록(기기 `jointItems`) → 회사 기준 파일 `jointBrief.items` preset(비공개, `private/manuals/build-joint.py`로 생성 — FOM 6.1.2.3 a)·b), 12.2.10, 12.2.19, 12.2.16~17, 2.3.4, 2.2.7·S2.2.1, 2.2.8.1·S2.5, S2.3.1, 8.2.13, 6.1.5, 14.7.3 기반 14문단) → 코드의 기본 틀(제목·OFP 값만, 공개 저장소라 회사 문장 없음). 편집: 위/아래(같은 묶음 안), 수정(제목·FOM 위치·묶음·원고, 자동 값·선택지·입력 칸 끼워 넣기 버튼), 지우기, 추가, 되돌리기
  4. 비행마다 기기 안 저장(`joint:<flightId>`: 체크·고른 값·쓴 값·난류 정도·뺀 문단·첫 비행 여부). 직접 쓴 값은 다음 비행 기본값(`jointLast`). 동기화 안 함
  5. OFP 계획 방식: 파서 `aviator-1.6` — 연료 줄 `N PCT CONT` → contPct, 2쪽 머리 `ATTN CAPT. … REFILE EDTO`, `REFILE:` 공항, `3% CONT ERA` 교체공항 → `header.plan`. FLIGHT 카드 머리 배지(3% = 주황, REFILE·EDTO = 주황, 5% = 청록)
- **영향** `joint/{template.ts,JointBrief.tsx,joint.test.ts}`(신규), `ops/OpsPage.tsx`, `brief/rules.ts`(`jointBrief`), `ofp/{types.ts,parser/aviator.ts,parser/index.ts,doc/OfpDocument.tsx}`, `mock/demoOfp.ts`(demo-5: 계획 방식·승객·화물), `app/styles.css`

### D-084 매시간 System Check (순항 화면)
- **날짜** 2026-11-19 (사용자: 손으로 "1700z 31000/30090/31020 17.4/17.4/17.4/17.4 8.6/5800 455+2445=3000 1767/1828" — 시각·고도계·엔진 오일·여압(ΔP/캐빈 고도)·FU+FOB=합계 순서로 적음. "SD 페이지 다 점검하지만 저걸 주로 씀", "FCOM normal procedure cruise SD 페이지 체크 다 만들어도 좋음", "MEL처럼 reference 연결")
- **결정**
  1. Inflight 화면에 "Hourly check" 카드: 칸 순서 = 손글씨 순서 (TIME Z · CAPT/STBY/F/O · ENG 1~4 오일 · ΔP/CAB ALT · FU/FOB) + SD 페이지 체크 8개(FCOM PRO-NOR-SOP-150: ENG·BLEED·ELEC·HYD·F/CTL·FUEL·DOOR + ECAM MEMO) + 메모 → "기록". 아이패드는 앱 키보드(D-081)
  2. 자동 계산: 고도계 차이(FL300 이상 FCOM PFD 150·ISIS 320, 아래 FOM 순항 200, 200 초과 = Loss of Redundancy — 기존 RVSM 표 D-080), 오일 앞 기록 대비 변화, FU+FOB 합계와 출발 FOB 차이(FMS 칸 FOB → 없으면 OFP RAMP OUT). 오일·여압·연료는 숫자만(판정 기준 없음)
  3. 연료는 손글씨처럼 100 단위(2445 = 244,500), 10,000 이상을 쓰면 원래 단위로 보고 100으로 나눔
  4. 다음 점검 = 마지막 기록 + 60분(머리줄, 지나면 주황)
  5. 근거 📖(MEL처럼 그 자리 창): 고도계 FOM 10.4.1.3, 오일·SD·연료 FCOM PRO-NOR-SOP-150, 여압 FCOM LIM-AIR
  6. 기록은 기기 안(비행마다 `hourly:<flightId>`), 동기화 안 함. 표 + "손글씨 줄로 복사"
- **영향** `hourly/{hourly.ts,HourlyCheck.tsx,hourly.test.ts}`(신규), `inflight/InflightPage.tsx`, `app/styles.css`

### D-085 합동 브리핑 기상 문장 · 매시간 기록 칸 다시 만듦 · 앱 키보드 빠른 입력 (D-081·D-083·D-084 보완)
- **날짜** 2026-11-19 (사용자: 아이패드 사진 — "원고 B처럼 출력하라 했잖아", "키보드 빠르게 누르면 사라진다", "기록 칸 딱 넣을 수 있게, 수정 가능, 입력시간 자동이되 수정 가능, 수정·삭제·추가·순서 변경 자유롭게", "1767/1828 = CKPT·CABIN OXY PR", "조인트 브리핑에 목적지 ETA ±1시간 기상, 못 내리면 어디로 다이버트, ERA 공항과 예상 시간대 날씨")
- **결정**
  1. 앱 키보드: 키를 손가락이 닿는 순간(pointerdown) 처리하고 키보드 안의 mousedown·touchend 기본 동작을 막음(iOS에서 click·초점 이동이 안 생김). 키를 누른 뒤 0.6초 안에 입력 칸 초점이 빠지면(다른 칸을 누른 게 아니면) 같은 칸으로 되돌림. 이전/다음·완료는 그대로 옮기거나 닫음
  2. 합동 브리핑 코드 기본 틀(회사 기준 파일 없을 때)도 B안처럼 이어 읽는 문장 — 인사·비행 개요·보안등급·음어·기상·교체/ERA·서비스·승객·화물·객실 결함 (회사 절차·신호 문장은 여전히 비공개 preset에만)
  3. 원고 자동 값 추가 `{목적지기상}`(목적지 ETA ±1h 예보, TAF 발표 시각) · `{교체공항}`("목적지에 내리지 못하면 ○○로 회항" + 교체 ETA ±1h 예보) · `{ERA}`(3% ERA·EDTO·ERA 공항과 각 시간창 예보) — Briefing 판정(buildBrief)의 공항별 시간창·TAF를 그대로 씀. 새 문단 "교체공항 · ERA"(기본 틀·회사 preset 둘 다)
  4. 매시간 기록 칸: 손글씨 한 줄처럼 묶음(TIME · ALT C/S/F · OIL 1/2/3/4 · ΔP/CAB · FU+FOB=합계 · OXY CKPT/CABIN). TIME은 지금 시각이 칸에 들어가 있고 고칠 수 있음. 칸을 누르면 전체 선택(덮어쓰기). 기록 줄을 누르면 위 칸으로 불러와 "수정 저장/취소", 줄마다 ↑↓·✕. SD 페이지 "모두" 버튼. 산소 압력 칸 추가(📖 FCOM LIM-OXY, 판정 없음)
- **영향** `app/AppKeyboard.tsx`, `joint/{template.ts,JointBrief.tsx,joint.test.ts}`, `hourly/{hourly.ts,HourlyCheck.tsx,hourly.test.ts}`, `app/styles.css` · 비공개 `private/manuals/{build-joint.py,company-rules.json}`(15문단)

### D-086 아이패드 앱 키보드 = 초점 없는 "지금 칸" · 오일/ΔP 자동 소수점 · 원고 도시 이름·현지 시각 (D-081·D-085 보완)
- **날짜** 2026-11-19 (사용자: "아이패드 사파리에서 빠르게 여러 번 터치하면 키보드 사라짐, 윈도우 크롬은 됨", "엔진오일 174 → 17.4, ΔP 86 → 8.6, 단위 FCOM 보고", "원고가 B안처럼 표기 안 됨", 로드시트 C에 OFP 값 같이 + A처럼 기입·원본 비교)
- **결정**
  1. 아이패드(≥768px)에서는 입력 칸에 초점을 주지 않음(`readOnly`, `inputMode="none"`). 칸을 누르면(pointerdown) 앱이 "지금 칸"으로 기억(`.kb-on` 표시), 키보드는 [완료]·키보드와 입력 칸 밖 누르기·입력 칸이 사라질 때만 닫힘. 키보드가 입력 중 글자를 직접 들고 있어(buf) 화면이 다시 그려지기 전에 다음 키가 와도 잃지 않음. 값이 있는 칸을 누르면 첫 키는 덮어씀(MCDU처럼). 블루투스 키보드는 화면 전체 keydown(숫자·글자·Backspace·Enter/Tab·Esc). 아이폰은 iOS 키보드 그대로. 공통 속성 `kbProps(appKb, {label,set,raw?})`
  2. 매시간 점검 오일 1~4·ΔP: 점 없이 쓰면 칸에서 나올 때·기록할 때 마지막 자리를 소수로(Preflight 오일 칸 `parseOil`과 같은 규칙). 단위 FCOM 기준 표시: 고도계 FT · 오일 QT · ΔP PSI · CAB ALT FT · 산소 PSI
  3. 합동 브리핑: `{출발도시}`·`{도착도시}`(공개 공항 → 한국어 도시 이름 표, 없으면 ICAO) · `{도착시각}` = "2019Z(현지 05:19)" — 파서 `aviator-1.7`이 OFP "HRS UTC+0900"(도착지 현지 시각 차이) 읽음. 기본 틀·회사 preset 인사 문장이 도시 이름 사용. 기기에 저장된 목록이 예전 기본 틀 문장뿐이면(고친 문장 없음) 무시하고 새 틀·preset 사용
  4. 로드시트(NEXT-ITEMS 9): C 확인 창에 OFP 값도 같이, 확인하면 WEIGHTS 카드 L/S 열(A)에 — 실제 사진 받으면 구현
- **영향** `app/{AppKeyboard.tsx,styles.css}`, `ofp/doc/Fms.tsx`, `inflight/EntrySheet.tsx`, `hourly/{hourly.ts,HourlyCheck.tsx,hourly.test.ts}`, `joint/{template.ts,JointBrief.tsx,cities.ts(신규),joint.test.ts}`, `ofp/{types.ts,parser/aviator.ts,parser/index.ts}` · 비공개 build-joint.py·company-rules.json

### D-087 합동 브리핑 = FOM 6.1.2.3 b) 9개 항목 전부 (D-083·D-085 보완)
- **날짜** 2026-11-19 (사용자: "싯벨트 사인 운영, sterile cockpit 룰 등 joint briefing에 필요한 게 빠진 것 같다. FOM 제대로 살펴본 거 맞아? 다시 들여다보고 만들어봐")
- **원인** 회사 preset(비공개 파일)에는 Sterile·좌석벨트가 있었지만, 회사 기준 파일을 다시 가져오기 전의 앱(배포판 기본 틀)은 b) 문단이 "객실 결함" 1개뿐. preset에도 FOM b)의 "안전 고려사항"·"PIC와 객실승무원 간 협조사항"·"장비 결함 정보 교환"이 따로 없었음
- **결정**
  1. 코드 기본 틀(공개)도 FOM 6.1.2.3 b) 항목 이름대로 문단을 둠: Cockpit Entry · Sterile Cockpit · 안전 고려사항 · Seat Belt Sign 운영 · Turbulence/비정상 PA · 비상 절차 · PIC-객실 협조 · 객실일지/장비 결함 정보 교환. 문장은 일반 표현(신호 횟수·버튼 이름 등 회사 세부는 preset에만). preset 없을 때 주황 안내
  2. 회사 preset 18문단(`private/manuals/build-joint.py`): 위 b) 항목 + Two-Crew Rule · PA Quiet Hours, 보안 문단에 12.2.11(사무장 보안점검 완료 보고 후 탑승), 출입 문단에 12.2.17.3(청정구역 확인·커튼·이름 문의·미통보 Emergency Access는 LOCK), 좌석벨트 문단에 2.2.7 ON 조건 + S2.2.1, 비상 문단에 12.2.29~30(비상벨·청정구역), 협조 문단에 2.2.8·S2.2.2(다자 통화)·FCRM 5.1.5
  3. 새 자동 값 `{안전요점}` = EDTO · 3% CONT · MEL/CDL 번호 · OFP 난류 구간 수
  4. 고친 목록을 쓰는 중에 기준(preset·기본 틀)에 새 문단이 생기면 "기준 원고에 새 문단 n개 … [넣기]". D-086 기본 틀을 그대로 저장한 목록은 새 틀로
- **영향** `joint/{template.ts,JointBrief.tsx,joint.test.ts}` · 비공개 `private/manuals/{build-joint.py,company-rules.json}`

### D-088 OFP 카드 순서·합치기 · OPS PLAN 칸 · 매시간 연료/오일 요약 · 새 배포 자동 받기
- **날짜** 2026-11-19 (사용자 아이패드 사진: "EDTO 자리에 EDTO·REFILE·3% 적기(380은 4발기라 EDTO 아님)", "FLIGHT와 ALTERNATE 합치기", "순서 FUEL·WEIGHT·RVSM과 SYSTEM PREFLIGHT·마지막 FMS", "RVSM과 SYSTEM PREFLIGHT 합치기", "상자 높이 비슷하게", "Hourly ΔP 86 → 8.6 안 됨", "램프 연료 대비 차이·오일 최초 대비 사용량 잘 보이게", "아이패드는 새로 고침해도 옛날 합동 브리핑")
- **결정**
  1. FLIGHT 칸 EDTO → **OPS PLAN**: OFP에 있는 것만 `EDTO 180 · REFILE · 5% CONT` 순(3% CONT·REFILE·EDTO면 주황). EDTO는 OFP에 EDTO 표시가 있을 때만(샘플은 B78X만, A388은 없음)
  2. FLIGHT 카드 안에 ALTERNATES 표(구분 머리줄). 순서: FLIGHT(+ALTN) → FUEL · WEIGHTS → RVSM·SYSTEMS PRE-FLIGHT(한 카드, ≥1024px 좌우 두 칸, 아래는 위아래) → FMS → EDTO·ETP → TURBULENCE → MEL → NOTES
  3. OFP 문서 격자는 같은 줄 카드 높이를 맞춤(`align-items: stretch`)
  4. 매시간 점검 요약 상자: ALT 차이 · **FUEL vs RAMP**(FU+FOB − 출발 연료, FMS FOB 칸 → 없으면 OFP RAMP OUT, 마이너스 주황) · **OIL 사용**(출발 전 SYSTEMS 오일 칸 → 없으면 첫 기록 대비, 앞 기록 대비는 작게). 기록 줄 아래도 RAMP 차이·오일 사용량
  5. 새 배포 받기: `virtual:pwa-register` — 앱을 열 때·다시 볼 때·30분마다 새 버전 확인, 설치되면 자동 다시 불러옴. (ΔP 소수점·합동 브리핑 새 원고는 D-086 배포에 이미 있었고, 아이패드가 예전 서비스 워커 캐시를 쓰고 있었음 — 배포 사이트 코드로 확인)
- **영향** `main.tsx`, `ofp/doc/{OfpDocument.tsx,Fms.tsx}`, `hourly/{hourly.ts,HourlyCheck.tsx,hourly.test.ts}`, `joint/joint.test.ts`, `app/styles.css`

### D-089 앱 키보드 ± 키 (계획 값 기준)
- **날짜** 2026-11-19 (사용자: "키보드에 + − 버튼, 계획 숫자 기준으로 바뀌게. 빈칸에서도, +10 −10도. 계획 값 없으면 0 기준, 숫자 직접 입력도 가능" → 시안 `private/design/2026-11-19-keyboard-step-mockup.html` 중 **C에서 = PLAN 뺀 것**)
- **결정**
  1. 숫자판 4열: 오른쪽 세로 열 위에서 +10 · +1 · −1 · −10. 키보드 높이 그대로. ± 없는 칸(LAT·LON·GATE·QNH)은 흐리게
  2. 기준값 = 칸에 쓴 값 → 없으면 계획 값 → 없으면 0. 막대에 "± 기준 350 · PLAN/칸 값/0". ±를 누른 뒤 숫자를 치면 새로 씀
  3. 칸별 계획 값: FMS DIST = OFP 거리 · MAX FL = OFP 순항고도 · OPT FL = MAX FL 칸 · TRIP TIME = OFP 시간(1분) · FOB/FOD = OFP 연료(천 단위, 한 번 0.1 = 100) · CAPT PFD = ELEV 칸 · F/O·STBY = CAPT 칸 · 오일 2~4 = 1번 칸 · CABIN 산소 = CREW 칸. 매시간 점검 = 앞 기록(첫 기록 오일 = 출발 전 SYSTEMS 칸, F/O·STBY = CAPT, 오일 2~4 = 1번). 순항 기록 ATA = ETO(HHMM, 자정 넘김), FUEL = 계획 잔량(한 번 100)
  4. 소수 칸(오일·ΔP)은 한 번 0.1, 열 번 1.0 — 키 글자가 +0.1 / +1로 바뀜 (사용자 미답 → 이렇게 정함)
- **영향** `app/{kbStep.ts,kbStep.test.ts,AppKeyboard.tsx,styles.css}`, `ofp/doc/{Fms.tsx,OfpDocument.tsx}`, `hourly/HourlyCheck.tsx`, `inflight/EntrySheet.tsx`

### D-090 RVSM · SYSTEMS 카드 다시 나눔 (D-088 2 수정)
- **날짜** 2026-11-19 (사용자: "rvsm altimeter랑 system preflight 분리해줘. 순서는 지금 이대로")
- **결정** RVSM · ALTIMETERS와 SYSTEMS · PRE-FLIGHT를 각각 카드로. 순서 FLIGHT(+ALTERNATES) → FUEL → WEIGHTS → RVSM → SYSTEMS → FMS → EDTO·ETP … 그대로. 아이패드 가로에서 RVSM | SYSTEMS가 한 줄(데모 484 · 475px)
- **영향** `ofp/doc/{Fms.tsx,OfpDocument.tsx}`, `app/styles.css`(`.pf-two` 지움)

### D-091 앱 버전 표시 · 앱 파일 새로 받기 · 합동 브리핑 저장 원고 안내
- **날짜** 2026-11-19 (사용자 아이패드 사진 15:34: 배포 뒤 새로 고침 여러 번에도 합동 브리핑이 첫 배포(D-083) 원고. "확인좀")
- **확인한 것**: 배포 서비스 워커 미리 받기 파일 22개 모두 200(설치 실패 아님). 첫 배포 원고 틀은 지금 코드가 "예전 틀"로 알아봄 → 원인은 ① 아이패드가 아직 예전 앱 ② 예전에 "항목 편집"으로 고친 원고가 기기에 저장돼 있음 중 하나. 멀리서 구분 불가 → 화면에서 바로 보이게 함
- **결정**
  1. 사이드바 맨 아래 `BUILD MM/DD HHMMZ` (누르면 Settings)
  2. Settings 고지 카드: 지금 앱 버전 · [새 버전 확인](서비스 워커 update) · [앱 파일 새로 받기](서비스 워커 등록 해제 + Cache Storage 삭제 + 다시 불러오기. IndexedDB의 비행·기록·OUTBOX·설정은 그대로, 오프라인이면 막음)
  3. 합동 브리핑: 저장된 고친 원고를 쓰는 중이면 맨 위 주황 상자 "기기에 저장된 고친 원고 사용 중 · 기준 원고에 새 문단 n개" + [새 문단 넣기] [최신 원고로 바꾸기](체크·고른 값은 그대로)
- **영향** `app/{App.tsx,styles.css}`, `settings/SettingsPage.tsx`, `joint/JointBrief.tsx`

### D-092 탭 순서 · OFP PDF 탭 · NAV LOG 정리 · Inflight 통과 기록 삭제 · Hourly 표
- **날짜** 2026-11-22 (사용자 요청 25개 중 바로 할 수 있는 것. 나머지 묶음·답은 `private/manuals/REQUESTS-2026-11-22.md`)
- **결정**
  1. 탭 순서 Dashboard · OFP · Briefing · Weather · Map · NOTAM · Ops · Inflight · MEL · Manual · OFP PDF · Settings (회사 Pre-Flight Briefing Checklist 순서 서류 → 기상 → NOTAM과 같음)
  2. "PDF · 추출"을 OFP 탭에서 빼 **OFP PDF 탭**으로. OFP 카드·NOTAM의 원문 줄 이동은 이 탭으로
  3. 계획 방식 표시 = REFILE / 3% CONT / 5% CONT. REFILE이면 5% CONT를 붙이지 않음(OFP 칸·합동 브리핑 글)
  4. NAV LOG: 줄을 누르면 원문으로 가지 않고 그 줄만 색 표시, ATO 열 삭제, 머리글 누르면 뜻 한 줄, 난류 구간 줄의 SR 칸 ◫ → 난류 구간 창
  5. CRZ WIND 열 = 왼쪽 낮은 FL → 오른쪽 높은 FL
  6. Weather: METAR/TAF 원문을 발표 양식처럼 줄바꿈(FM·BECMG·TEMPO·PROB·NOSIG·RMK), 공항 옆 STD·ETA, 교체 = 도착 ETA + 회항 ETA(OFP 교체 시간)
  7. Inflight: 지점 통과 기록(다음 지점 버튼·입력 창)·요약 칸·Fuel plan vs actual·Waypoint log 삭제. 예전 기록은 DB에 그대로(지우지 않음). 점검 알림에서 연료·통과 지연 알림 삭제(연료는 Hourly check)
  8. Hourly check: 칸 순서 … ΔP/CAB → OXY → FU+FOB(연료 맨 끝). 기록 목록을 NAV LOG 같은 표로(작은 글 = 고도계 차이·오일 사용·RAMP 대비), 메모는 표 아래
- **영향** `app/{tabs.tsx,App.tsx,styles.css}`, `ofp/{OfpPage.tsx,PdfPage.tsx(신규),sourceJump.ts,OfpOpenButton.tsx}`, `ofp/doc/{NavLog,CrzWind,OfpDocument}.tsx`, `joint/{template.ts,joint.test.ts}`, `weather/{WeatherPage.tsx,decode.ts,decode.test.ts(신규)}`, `inflight/{InflightPage.tsx,reminders.ts}`(EntrySheet·FuelChart 삭제), `hourly/{HourlyCheck.tsx,hourly.ts,hourly.test.ts}`

### D-093 NOTAM 공항별 시간창 · 시간 관계 한 줄 · 약어 풀이
- **날짜** 2026-11-22 (사용자 요청 20: "notam decoder가 필요할까? 비행 시간대에 겹침 + 시간도 작성해줘. std나 eta라던가")
- **결정**
  1. 공항 NOTAM의 시간창 = Briefing과 같은 공항별 창(출발 ETD±1h · 도착 ETA±1h · 교체 교체 ETA±1h · ETP ETO±1h · EDTO 창 · ERA 비행 시간대). FIR은 그대로 통과 시각. 공항 머리에 "시간창 시각 ~ 시각 · 근거"
  2. NOTAM마다 시간창과의 관계 한 줄: "시간창 내내 유효" · "시간창 중 10 1800Z 종료" · "11 0800Z 시작 — 시간창 끝 10:48 후" 등. D) 시간표는 여전히 해석 안 함
  3. 전체 해독기는 만들지 않음(원문이 공식, 오역 위험). OFP NOTAM에는 Q) 줄이 없어 Q-코드 대신 **본문 약어 풀이**(ICAO Doc 8400 일반 약어 약 110개, 접힌 칸)
- **영향** `notam/{relevance.ts,abbr.ts(신규),NotamPage.tsx,notam.test.ts}`, `app/styles.css`

### D-094 ETP·EDTO 교체공항 예상 사용 시간 (FOM 계산식) · 실제 출발 시각으로 옮기기
- **날짜** 2026-11-22 (사용자 요청 15: "etp 공항은 각 공항별로 std 기준으로 실제 디파쳐 할 경우에 예상 사용 시간을 표시해줘" → 계산 방식 승인)
- **결정**
  1. 계산은 회사 FOM Supplement "EDTO ETP Data" 식: Alternate n 예상 착륙 = 이륙 + (앞·뒤) ETP까지 시간 + 회항 시간, 예상 운항 시간대 = 앞뒤 1시간. 공항 순서 = ETP1 [A,B] · ETP2 [B,C] → A(ETP1) · B(ETP1~ETP2) · C(ETP2)
  2. OFP에 EEP·EXP와 고속/1엔진 회항 시간 구분이 없으면 ETP와 OFP 회항 시간 하나로 계산(첫·마지막 공항은 한 시각). OFP에 "SUITABLE FROM ~ TO"(쌍발 EDTO)가 있으면 그 값을 예상 착륙 시간대로 씀
  3. OFP 화면 EDTO·ETP 카드 아래 "ERA 예상 사용 시간" 표 + 실제 출발 시각(HHMM Z) 칸 → (실제 − STD)만큼 모두 옮김. 기기 안에만 저장(비행별)
  4. Briefing·NOTAM의 ETP·EDTO 공항 시간창도 이 운항 시간대(STD 기준)로 바꿈 (이전: ETP ETO ±1h). OFP EDTO "1159Z" 글자를 시각으로 못 읽던 버그도 같이 고침
- **영향** `ofp/{eraTimes.ts,eraTimes.test.ts}`(신규), `ofp/doc/OfpDocument.tsx`, `brief/assess.ts`, `app/styles.css`

### D-095 난류 창에 단면(버티컬 뷰) 함께 · NAV LOG FIR 줄 → FIR 통신 창
- **날짜** 2026-11-22 (사용자 요청 7·8: "fir은 누르면 mel 링크처럼 교신 방법", "cpdlc 절차도", "sr 높은 지역은 위에서 본 지도 + 버티컬뷰 2개 다 한번에")
- **결정**
  1. 난류 SR 구간 창: 플랜 뷰 아래에 버티컬 뷰를 그 구간만 확대해 함께 (구간 앞뒤 25%, 최소 80NM 여유). 버티컬 뷰에 `focus` 옵션(구간 밖은 잘라냄)
  2. NAV LOG "▸ FIR …" 줄(ADIZ 제외)을 누르면 FIR 통신 창: OFP 진입 지점·시각 · 개인 통신표(창 안에서 편집) · 회사 FOM 데이터링크 절 📖(Log-on · End of Service · CPDLC · ADS-C · Emergency/Non-Normal · 보고) · FOM "FIR 별 절차"에 그 FIR이 있으면 그 쪽을 FIR 이름 강조로 바로 열기
  3. 통신표는 여전히 개인 입력(D-055). Jeppesen 자료로 채우는 일은 사용자 자료가 오면 private에서 JSON으로 만들어 가져오기
- **영향** `vertical/VerticalView.tsx`, `ofp/doc/{TurbPopup,NavLog}.tsx`, `fir/{FirPopup.tsx(신규),FirCommSection.tsx}`, `app/{App.tsx,styles.css}`

### D-096 Hourly check SD 페이지 가이드 (FCOM 정상 범위·경고 조건)
- **날짜** 2026-11-22 (사용자 요청 18: "sd page cruise check 할 때 fcom system control indication의 normal range, amber, red 조건 표기")
- **결정**
  1. Hourly check SD 줄에 [가이드 (정상·경고 범위)] → SD 페이지(ENG·BLEED·ELEC·HYD·F/CTL·FUEL·DOOR) 골라 보기
  2. 내용 = 기기에 가져온 FCOM 묶음의 Controls and Indicators 절(DSC-70-20·36-20·24-20·29-20·27-10-20·28-20·35-20-20 등)에서 **숫자+단위가 있는 조건 문장을 원문 그대로** 뽑음. 앱 코드에 FCOM 내용 없음. 같은 제목(GENERATOR VOLTAGE 등)은 첫 문장(“The APU generator …”)을 부제로 구분
  3. FCOM의 색(초록·AMBER·RED)은 그림에만 있어 글로는 확실히 알 수 없음 → 문장 낱말로 "정상·AMBER·RED·주의·조건" **앱 분류**만 붙이고 📖 원본 쪽(사진)으로 확인. BLEED는 FCOM 글에 숫자가 거의 없어 적게 나옴(K-50)
- **영향** `hourly/{sdGuide.ts,sdGuide.test.ts,SdGuidePanel.tsx}`(신규), `hourly/HourlyCheck.tsx`, `app/styles.css`

### D-097 Manual 책장 · 검색 범위 · PDF Expert식 목차
- **날짜** 2026-11-22 (사용자 요청 21: "목차가 깔끔하면, 검색할 때 누르는 거랑 매뉴얼 선택 버튼이 달라서 헷갈림, PDF Expert처럼")
- **결정**
  1. 맨 위 **매뉴얼 책장**(매뉴얼마다 버튼 하나, 날짜 표시) = 보기와 검색이 같이 쓰는 선택. 드롭다운·매뉴얼별 검색 칩 없앰
  2. 검색 범위는 두 개만: **이 매뉴얼 / 전체**
  3. 목차 = 장 ▸ 펼침, 들여쓰기 선, 지금 위치 강조, **목차 안 찾기** 칸. 1024px 이상(아이패드 가로)은 왼쪽에 늘 보이고, 좁으면 [목차]로 옆에서 나오고 항목을 누르면 닫힘
- **영향** `manual/ManualPage.tsx`, `app/styles.css`

### D-098 Briefing 탭 = 회사 Pre-flight Briefing 점검 순서의 단계 화면
- **날짜** 2026-11-22 (사용자 요청 2: "출두해서 플랜 확인하고 다른 크루에게 브리핑할 때 보여 줄 자료가 FOM 순서대로")
- **결정**
  1. 9단계: 개요 → 기상·출발 → 기상·항로 → 기상·목적지/교체 → NOTAM → OFP·MEL/CDL → ATS FPL 대조 → 인가·허가·통신 → 위협·회항 후보 (FOM Pre-flight Briefing 점검 항목 순서 + 앞에 개요)
  2. 위에 단계 버튼, 아래 [‹ 이전] [다음 ›] 고정 막대(아이패드로 보여 주며 넘김), [전체 보기]로 한 화면에 모두
  3. 내용은 기존 카드 재사용: 공항 METAR/TAF(원문 줄바꿈·STD/ETA) + 공항별 판정, 버티컬·플랜 뷰·SIGMET·루트 바람 비교·난류, ERA 예상 사용 시간, NOTAM(강조 분류 × 시간창 겹침만 요약, 전체는 NOTAM 탭), 연료·중량·MEL·노트, ROUTE·OFP 번호 대조, FIR 통신, 비행 전체 판정·브리핑 초안·회항 후보
- **영향** `brief/BriefPage.tsx`, `notam/NotamPage.tsx`(build export), `weather/WeatherPage.tsx`(WxAirportCard export), `ofp/doc/OfpDocument.tsx`(RouteCheckRow export), `app/styles.css`

### D-099 기상 확장: 움직이는 레이더 · SIGMET 잘 보이게 · 기압면 추가 · 권계면 · 겹쳐 보기
- **날짜** 2026-11-22 (사용자 요청 10~12)
- **결정**
  1. Map **레이더** 레이어 = RainViewer 공개 API(키 없음, 지난 약 2시간 10분 간격 + 단기 예측이 있으면 함께). 영상 시각을 시간 막대에 넣어 ▶ 재생으로 움직임. 지상 레이더 없는 바다 위는 안 보임. 8초 시간 제한, 실패하면 "레이더 받기 실패"만. 출처 표기
  2. Map SIGMET: 선 굵게·채움 진하게, 위험 종류·고도 글자, 날짜변경선 꼭짓점 이어 붙이기 (Mac에서는 표시되고 있었음 — 흐려서 안 보인 것으로 판단)
  3. Open-Meteo 기압면 800·100 hPa 추가(11개) → 단면 세로 해상도·FL530까지. 버티컬 뷰 위쪽 FL520
  4. **권계면(근사)**: 500 hPa 위에서 기온 감률이 처음 2 °C/km 이하인 기압면 → 버티컬 뷰 점선, 플랜 뷰 "TP" 글자
  5. 버티컬 뷰 바탕 **여러 개 겹치기**(색 칸은 옅게 겹침, 난류 지수는 빗금), 플랜 뷰 겹쳐 보기 칩(바람 화살표·SIGMET·PIREP·SR 구간·권계면)
  6. IATA Turbulence Aware는 항공사 회원 전용이라 넣지 않음. WAFS 격자 난류·착빙·CB는 Worker 해석이 필요해 다음으로(K-50)
- **영향** `map/{radar.ts,radar.test.ts}`(신규), `map/MapPage.tsx`, `weather/decode.ts`(LEVELS_HPA), `vertical/{profile.ts,VerticalView.tsx,PlanView.tsx}`, `app/styles.css`

### D-100 SD 가이드 = 실제 SD 화면 모양(ECAM 색) · ETP 카드 숫자 칸·Driftdown 표 삭제
- **날짜** 2026-11-22 (사용자: "sd 페이지처럼 눈으로 보기 좋게", "etp 가독성 좋게 기존 테마에, 두번째 표(Driftdown)는 지워" → 시안 `private/design/2026-11-22-sd-etp-mockup.html`에서 **SD-B · ETP-A** 선택)
- **결정**
  1. SD 가이드 위쪽 = 검은 바탕 ECAM 색 화면(ENG 1~4 표 · ELEC GEN/APU·RAT/TR 칸 · HYD G/Y · FUEL FEED · DOOR OXY). 값 자리에 초록/AMBER/RED 한계, 누르면 설명 + FCOM 원문 문장 + 📖. 아래 = FCOM 숫자 조건 문장 전체(접힘, D-096)
  2. 한계 숫자는 FCOM 값이라 **회사 기준 파일 `sdGuide`(비공개)** 에 둠 — `private/manuals/build-sd.py`로 만들고 가져오기. 앱 코드에는 숫자 없음. 파일이 예전 것이면 "sdGuide 없음" 안내
  3. FCOM 글에 색 낱말이 없는 값(HYD PSI·OVHT, ELEC 과부하·과열, FUEL 온도, OXY REGUL)은 `chk` 표시 → 누르면 "원본 그림으로 확인 필요". BLEED·F/CTL은 한계 숫자가 거의 없어 원문·📖만
  4. ECAM 색은 주간/야간과 상관없이 고정(`--ec-*` 토큰)
  5. ETP: 이름·공항(⇄) 크게, ETO·FOB·TO ALT·TIME(+CFR·EXC 있으면) 숫자 칸, Driftdown 표 삭제 — W 표시만 "DRIFTDOWN W: M LRC · M 2LE" 칸으로
- **영향** `brief/rules.ts`(SdGuideData), `hourly/SdGuidePanel.tsx`, `ofp/doc/OfpDocument.tsx`(EtpBlock), `app/styles.css`. private: `build-sd.py`(신규), `company-rules.json`·`out/company-rules.json`(sdGuide 추가, 이전 파일은 세션 임시 폴더에 백업)

### D-101 Jeppesen Airway Manual을 Manual 묶음으로 · FIR 통신표는 Jeppesen에서 만든 가져오기 파일
- **날짜** 2026-11-27 (사용자: "젭슨 파일 md로 해서 넣자 … atc comm이랑 cpdlc 등 contact 방법들 넣자", "Manual에도 넣기")
- **결정**
  1. Jeppesen Airway Manual(General·Pacific) PDF → md(pdf2md.py, 사용자 Mac) → 매뉴얼 묶음 `JEPP-GENERAL`·`JEPP-PACIFIC`(kind OTHER). 표지 "AIRWAY MANUAL" + "JEPPESEN"으로 알아봄
  2. 쪽 나누기: 쪽 머리 굵은 줄 다음 `**숫자**` = 인쇄 쪽 = PDF 쪽(`p.N`). 쪽 제목·왼쪽 목차는 PDF 목차(`pdf2md.py toc` → `<이름>_meta.json`, level 포함)에서 그 쪽이 시작하는 경로. 목차 묶음 = 앞 3단계(편 › 지역 › 나라), 항목 = 그 아래 2단계
  3. FIR 통신표(D-055 개인 표)는 Jeppesen Pacific CPDLC 표 + 국가별 규정으로 만든 가져오기 파일(`private/manuals/jeppesen/build-fircomm.py` → `out/fir-comm-jeppesen.json`)로 채움. 출처 칸 = 책·쪽, 입력일 = 책 발행일
  4. Jeppesen 자료는 저작권 → private·구글드라이브만(D-028)
- **영향** `manual/parse.ts`(jeppesenArea·jeppesenPaths·splitJeppesen, TocEntry.level), `manual/lookup.ts`(buildToc Jeppesen), `manual/manual.test.ts`, `tools/manual-convert/{pdf2md.py,build.ts}`. MANUAL_PARSER_VERSION은 그대로(기존 묶음 결과 안 바뀜 → 다시 올릴 필요 없음)

### D-102 지도가 아래 탭을 덮지 않게 · 매뉴얼 가져오기에서 FIR 통신표·목차 파일 받기 · 업로드 대기 지우기
- **날짜** 2026-11-27 (사용자 아이패드 사진: 지도 때문에 아래 탭이 잘 안 눌림, 매뉴얼 가져오기에서 json "매뉴얼 묶음 파일이 아님", "업로드 저거 지울 수 있게")
- **결정**
  1. `.leaflet-container`에 `isolation: isolate; z-index: 0` — Leaflet 안쪽 z-index(200~1000)가 탭바(20) 위로 올라가지 않음
  2. 매뉴얼 가져오기 한 곳에서 `efb-fir-comm` JSON → FIR 통신표로, `<이름>_meta.json` → 같이 고른 같은 이름 .md의 목차로 씀(따로 저장 안 함)
  3. Settings 업로드 대기: 항목마다 "지우기" + "전부 지우기"(확인 창). 지우지 않고 outbox `status=discarded`로 바꿈 → 시트로 안 보내고, 기기 안 기록은 그대로, Inflight 기록 표시는 "–"(보내지 않음). DB 버전 그대로(상태 값만 추가)
- **영향** `app/styles.css`, `manual/{ManualCard.tsx,store.ts}`, `sync/{outbox.ts,outbox.test.ts}`, `db/schema.ts`(OutboxStatus·discardedAt), `settings/SettingsPage.tsx`, `inflight/InflightPage.tsx`

### D-103 업로드 대기 선택 지우기 · PIREP 범위 좌표 소수 둘째 자리 (기상 레이어 점검)
- **날짜** 2026-11-27 (사용자: "선택지우기도 가능하게", "버티컬뷰·플랜뷰·위성 등 기상 레이어 잘되는지 다시 점검")
- **결정**
  1. 업로드 대기: 항목마다 체크 상자, "전체 선택/선택 해제" · "선택 지우기 (n)" · "전부 지우기"(둘 다 확인 창). 항목별 "지우기" 버튼은 체크 상자로 대신. 목록은 실패 먼저, 만든 시각 순
  2. 점검 결과 PIREP이 실제 항로에서 늘 실패하고 있었음 — AWC가 긴 소수 좌표(`29.94250000000001`)의 bbox를 HTTP 400으로 거절. bbox를 바깥쪽으로 소수 둘째 자리로 맞춤(`routeBoxes`)
  3. Mac 개발·미리보기 서버의 내장 기상 중계(`vite.config.ts` AWC_ALLOWED)에 pirep·gairmet 추가 (Worker와 같게) — 아이패드(Worker)는 원래 됨
- **영향** `settings/SettingsPage.tsx`(OutboxCard), `app/styles.css`, `sync/outbox.ts`(정렬), `weather/extra.ts`(routeBoxes), `ops/ops.test.ts`, `vite.config.ts`

### D-104 항로 스펙 대조 = 항로 띠 + FIR × 스펙 표 (시안 A·C 합침)
- **날짜** 2026-11-27 (사용자: "내 항로의 스펙 확인·검증, ats fpln·mel·fcom·pbn·pbcs" → 시안 `private/design/2026-11-27-route-spec-mockup.html` → "a,c 를 합쳐")
- **결정**
  1. Briefing 7단계(ATS FPL 대조)에 카드 하나: 위 = 항로 띠(FIR 구간 시간 비례, 스펙마다 한 줄), 아래 = FIR × 스펙(RVSM·PBN·CPDLC·ADS-C·PBCS) 표 + 결과(분리·통신). 띠 조각·표 칸을 누르면 근거 서랍(① 항로 요구 + 📖 ② FPL 신고 코드 ③ 오늘 비행기)
  2. ① 요구 = 회사 기준 파일 `routeSpec`(비공개, FOM PBCS·RVSM 절 / Jeppesen Pacific 쪽). 규칙 = FIR·항로 이름·FL 범위 × 필요 능력 × 수준(required 필수 → ✕ · area 적용 구역 → ⚠, 운항 가능하나 분리·절차 달라짐 · info 참고(운영 시간) · nodata ?)
  3. ② 신고 = OFP 안 ATS FPL 장비·Item 18을 파서가 저장(`atsFpl`, 파서 aviator-1.8) → ICAO 표준 코드 해석(공개 코드)
  4. ③ 비행기 = OFP MEL/CDL 항목 번호 앞부분 → 영향 줄 수 있는 능력(앱 분류 `melMap`, 비공개) → "⚠ 확인"까지만, 판정 안 함. 기종 기본 능력(회사 승인·FCOM)은 자료 없음 → "자료 없음" 표시, 자료 오면 `aircraft`에
  5. Jeppesen 쪽 코드 = `JEPP-PACIFIC-158`(책 이름 포함, General·Pacific 쪽 번호 겹침) → 근거 링크가 한 권을 가리킴. JEPP 묶음 다시 만듦
- **영향** `routespec/{fplCaps.ts,evaluate.ts,RouteSpecCard.tsx,routespec.test.ts}`(신규), `ofp/types.ts`·`ofp/parser/index.ts`(atsFpl, 버전 1.8), `brief/rules.ts`(RouteSpecData·검사), `brief/BriefPage.tsx`, `brief/brief.test.ts`, `manual/parse.ts`(Jeppesen 쪽 코드), `app/styles.css`. private: `build-routespec.py`(신규), company-rules.json, JEPP 묶음

### D-105 아이패드 요청 묶음 바로 할 것 (2026-11-27): ETP 칸 · 바람표 차이 · 공항 시각 · 회사 기준 상자
- **날짜** 2026-11-27 (사용자 아이패드 사진 21장 · 10개 항목 — 나머지는 비공개 요청 목록)
- **결정**
  1. OFP EDTO·ETP 숫자 칸 = 카드 폭 기준 자동 줄 바꿈(최소 124px) — 가로 아이패드 2열에서 잘림 방지, 빈 칸 회색 없음
  2. 바람표 예보 vs OFP: **바람 방향 30° · 속도 30kt · 기온 5°C 이상** 차이면 줄 색 + "방향 40°" 표 (사용자 지정 표시 기준, 매뉴얼 수치 아님)
  3. 파서 aviator-1.9: Aviator OT 열은 부호가 없어 앱이 비교를 못 했음 → **FL250 이상은 영하로 읽음**(ISA −35 °C 이하라 양수 불가). 그 아래(상승·하강)는 비워 둠
  4. Briefing 공항 카드: "창 ETD ±1h (…)" 대신 **기준 시각(ETD·ETA·ALTN ETA) + 판정 시간대**. 시간 창 자료에 기준 시각(`at`) 추가 — NOTAM에도 쓸 예정
  5. Briefing 1단계 "회사 기준" 상자 삭제 — 파일 없을 때만 경고, 회사 기준 버전·판정 규칙은 맨 아래 한 줄
- **영향** `app/styles.css`, `weather/WeatherPage.tsx`(windDiff·WIND_DIFF, 테스트 `winddiff.test.ts`), `ofp/parser/{aviator.ts,index.ts}`, `notam/relevance.ts`(Window.at), `brief/{assess.ts,BriefPage.tsx}`, `routespec/routespec.test.ts`

### D-106 활주로 방위 = 자방위(M) 표시 · 진방위는 계산에만
- **날짜** 2026-11-27 (사용자: "인천 젭슨에는 334로 나오는데" → "자방위로 바꿔")
- **결정**
  1. Briefing 활주로 표의 방위 = **자방위**(차트와 같은 기준) 크게, 진방위(T)는 옆에 작게. 자방위 = 공개 자료 진방위 − 자기 편차
  2. 자기 편차 = NOAA·BGS **WMM2025**(2024-11~2029-11 유효), 라이브러리 `geomagnetism`(Apache-2.0, 계수 포함, 오프라인 계산, 약 70KB). 공항 위치는 기존 공개 공항 자료
  3. 바람 성분(정풍·측풍·배풍)은 그대로 **진방위**로 계산 — METAR·TAF 바람이 진방위라서. 진방위가 없으면 번호×10(≈M)
  4. 차트와 1° 안팎 차이 가능(모델·반올림·차트 기준 연도) — 화면 메모에 표시
- **영향** `lib/magvar.ts`(신규), `brief/runways.ts`(hdgM), `brief/assess.ts`, `brief/BriefPage.tsx`, `brief/brief.test.ts`, `app/styles.css`, `package.json`(geomagnetism)

### D-107 플랜 뷰 = 값마다 작은 지도 한 장 (앞/뒷바람·난류·ISA·기온) · 웨이포인트 이름+ETO
- **날짜** 2026-11-27 (요청 4·5. 시안 A~I 중 사용자 "e로 가자 … wpt 잘 표시해줘. 시간이 필요하면 시간도")
- **결정**
  1. 드롭다운 없앰 → 4가지 값을 지도 4장으로 동시에(값마다 한 장, 같은 투영·같은 겹쳐 보기). 동서로 긴 항로(지도 높이 < 420)는 4장을 위아래로, 아니면 2×2. 장 머리를 누르면 그 장만 크게, 다시 누르면 4장. 난류 창(SR 구간)은 난류 지수부터 크게
  2. 항로 = 한 줄(값 색 + 바다색 테두리). SIGMET·PIREP·OFP SR(주황/빨강 괄호 점선)·FIR 경계(가로 막대) 겹침. 바람 화살표는 바람 장에만, 권계면은 기온 장에만
  3. 웨이포인트: 점 + 굵은 이름 + 아래 ETO(·FL). 우선순위(출발·도착 > TOC·TOD·FIR·ETP > SR 끝 > 이름 지점 > 좌표 지점)로 놓고 겹치면 덜 중요한 이름을 숨김. ADIZ는 FIR이 아님(이름 "ADIZ")
  4. 장마다 한 줄 요약(시각 포함): 앞바람 최대 @지점 시각 · 난류 중 이상 구간 시각 · ISA 최고/최저 · 최저 기온
  5. 출처 = 자료 칩 한 줄(받은 지 얼마) + "ⓘ 어떻게 계산했나" 접기 (요청 5의 첫 적용)
  6. 아이폰: 지도를 720px로 그리고 옆으로 밀어 보기(글자 크기 유지)
- **영향** `vertical/PlanView.tsx`, `app/styles.css`. 시안 `private/design/2026-11-27-planview-mockup*.html`

### D-108 공항 = 역할마다 시간창 · ETP 공항 담당 구간
- **날짜** 2026-11-27 (사용자: KSFO가 3% ERA이면서 ETP2 공항일 때 "두 가지가 표시되거나 … 각각 항목에 대해 사용 시간대 표시 … 목적에 따라 공항은 겹칠 수도 있지. 구간으로 고쳐")
- **결정**
  1. 한 공항이 여러 역할이면 **역할마다 창**(`Slot.uses`, `AirportBrief.uses`). 기상 판정은 모든 역할 창을 덮는 범위, 화면·NOTAM은 역할마다 따로 (예: KSFO = 3% ERA 창 + ETP 창). 전에는 처음 잡힌 역할 창(3% ERA "비행 후반 대략")만 쓰고 ETP 계산을 버렸음(버그)
  2. ETP 공항 **담당 구간**: 공항 순서 A·B·C(ETP1[A/B]·ETP2[B/C])에서 A = 이륙→ETP1, B = ETP1→ETP2, C = ETP2→도착. 사용(운항) 시간대는 그대로 FOM 식(ETP 통과 + 회항 시간 = 착륙 예상, ±1h). 지도는 담당 구간을, 글은 착륙 예상·운항 시간대를
  3. OFP NOTAM 패키지의 ERA 목록은 이미 역할이 있는 공항엔 "비행 전체" 창을 더하지 않음 (도착·ETP 공항에 "항로 교체: 내내 유효"가 붙던 것)
  4. 순수 ERA(다른 역할 없음) 창은 지금처럼 비행 전체 — "항로가 가장 가까울 때 ±1h"는 시안의 제안(FOM 근거 없음, 사용자 확인 대기)
- **영향** `brief/assess.ts`(Slot.uses·AirportBrief.uses·ERA 중복 방지), `ofp/eraTimes.ts`(seg), `notam/relevance.ts`(Window.role·seg, timeNote 역할별), `notam/NotamPage.tsx`, `brief/BriefPage.tsx`(공항 카드 역할별 줄), `app/styles.css`, 테스트 `eraTimes.test.ts`·`brief.test.ts`(실제 샘플 KSFO)

### D-109 시간창 근거 정리 — 3% ERA = OFP ERA ETA ±1h (FOM), 출발·순수 ERA = 앱 기준 표시
- **날짜** 2026-11-27 (사용자: "±1시간 예전에 내가 지침줘서 그런 거 같은데 FOM 이거 괜찮은가")
- **확인** FOM R75-1: 목적지·교체 = 5.7.1 "도착예정시각 1시간 전부터 1시간 후까지" ✅ · ETP/EDTO = 5.13.1.5 + Supplement(Earliest −1h ~ Latest +1h) ✅ · **3% ERA = 3% Contingency 제한사항 "도착 예상시각 1시간 전부터 1시간 후까지"** — 앱은 "비행 후반 대략"을 쓰고 있었음 ❌ · 출발 ETD±1h, 순수 ERA(3·4발 60분 ERA) = FOM에 시간창 문장 없음
- **결정**
  1. 파서 aviator-1.10: OFP "3% CONTINGENCY ERA VALIDATION"의 ERA **ETA**와 기준 지점(COC 좌표·누적 거리)을 읽음
  2. 3% ERA 창 = ERA ETA ±1h. 담당 구간 = COC를 중심으로 반경 "총 비행계획 거리 20%"(FOM 선정 기준 원)가 덮는 항로. OFP에 ETA가 없으면 예전 근사(표시: "OFP에 ERA ETA 없음")
  3. 창 설명에 근거 표시: "FOM EDTO: …" · "FOM 3% Contingency: …" · 출발 "ETD ±1h (앱 기준 — FOM 문장 없음)" · 순수 ERA "비행 시간대 (앱 기준 — FOM 시간창 규정 없음)". 시안의 "가장 가까울 때 ±1h"는 근거 없어 버림
- **영향** `ofp/types.ts`(OfpAlternate.eta·coc), `ofp/parser/{aviator.ts,index.ts}`, `brief/assess.ts`(era3Window·basis), `brief/brief.test.ts`

### D-110 공항 순서 + Refile 공항·교체 역할
- **날짜** 2026-11-27 (사용자: "refile 공항은 ofp 보면 나오는데 · 추천 순서대로")
- **결정**
  1. 공항 순서 (NOTAM·브리핑 공통): 출발(이륙 교체) → 도착 → 목적지 교체 → 3% ERA · Refile 공항 · Refile 교체 → ETP·EDTO → 항로 교체(ERA). 묶음 안은 시각 순. 이유: 매 비행 쓰는 공항과 연료 계획이 걸린 공항이 먼저, 참고용 ERA는 뒤로
  2. 파서 aviator-1.11: OFP "REFILE FLT PLAN" 머리에서 결정 지점(Refile Point)·Refile 공항·Refile 교체·시간 읽음 (`OfpData.refile`) — 샘플 6개 모두 같은 형식
  3. 시간창: Refile ETA = 결정 지점 ETO + "P TO R" 시간, ±1h. Refile 교체 ETA = Refile ETA + ALTN 시간, ±1h. **앱 기준** 표시 — FOM 5.10.1.1은 Refile 공항·교체도 "운항 시간대 기상 제한치 이내"라고만 하고 ±1h는 목적지 규정(5.7.1)을 준용
  4. 지도: 결정 지점 표시 + 결정 지점 → Refile 공항(→ 교체) 점선, 색은 3% ERA와 같은 주황 (두 방식은 한 비행에 같이 나오지 않음 — 샘플 10개 확인)
- **영향** `ofp/types.ts`(refile), `ofp/parser/index.ts`(refilePlan), `brief/assess.ts`(Role REFILE·REFILE ALTN), `brief/BriefPage.tsx`(ROLE_ORDER), `notam/relevance.ts`(ROLE_LABEL), `brief/brief.test.ts`(샘플 02)
