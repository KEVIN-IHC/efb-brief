# CURRENT STATUS — 현재 개발 상태

> **새 세션은 이 문서부터 읽는다.** 작업이 끝날 때마다 맨 아래 "세션 인계"와 관련 표를 갱신한다.
> 상태 표기: ✅ 완료 · 🔄 진행 중 · ⏳ 대기 · ❓ 미확인 · ❌ 오류 발생
> 마지막 갱신: 2026-11-05 06:30Z (Phase 3 세션 종료 시점)

## 1. 한눈에

| 항목 | 상태 |
|---|---|
| 현재 Phase | **Phase 3 기상 지도 구현 완료(로컬) + Cloudflare 기상 중계 설치됨 — 사용자 확인 대기**. 다음: 아이패드 테스트 → Phase 3.5 또는 4 |
| 테스트 | ✅ `npm test` 81개 통과 (실제 OFP 샘플 포함), `tsc -b` 통과, `npm run build` 통과 (2026-11-05 Phase 3) |
| 브라우저 확인 | ✅ Mac Chrome(개발 브라우저 패널)에서 아이폰·아이패드 세로/가로·PC 크기, 주간/야간 |
| 아이패드 실기기 | ❓ **한 번도 확인 안 함** — 배포 주소 준비됨: https://kevin-ihc.github.io/efb-brief/ |
| 실제 구글 시트 연동 | ❓ **확인 안 함** (Mock GAS로만 검증) |
| Git·호스팅 | ✅ 공개 저장소 https://github.com/KEVIN-IHC/efb-brief (main), GitHub Actions → Pages 자동 배포. 커밋 작성자 = GitHub 비공개 이메일(저장소 로컬 설정) |
| 로컬 서버 | 개발 `npm run dev` → :5173 / 배포판 미리보기 `npm run local` → :4173 |

## 2. Phase별 상태 (원본 명세 §15 기준)

| Phase | 범위 | 상태 | 비고 |
|---|---|---|---|
| 0 뼈대 | PWA·IndexedDB·상태 배지·outbox 동기화·Apps Script | ✅ 로컬 / ❓ 아이패드 | 완료 조건(아이패드 홈 화면 설치 → 비행기 모드 메모 → 시트에 1회 저장) 중 **아이패드·실제 시트는 미확인**. Mac에서 오프라인 저장 → 복귀 시 1회 업로드는 확인 |
| 1 OFP 대시보드 | 더미 OFP 대시보드·루트표, PDF 업로드·텍스트 추출 | ✅ | 이후 1.5에서 화면 교체 |
| 1.5 실제 파서 | Aviator 파서 | ✅ | 샘플 10개(A388·B78X, ICN↔LAX·SYD↔ICN) 전부 교차검증 통과. 추가: Lido식 화면, 주간/야간, CRZ WIND, 난류(SR), OFP 열기 버튼 |
| 2 순항 기록 | 웨이포인트 체크·편차·그래프 | ✅ 로컬 / ⏳ 사용자 확인 | 완료 조건(오프라인 전 구간 기록 → 온라인 일괄 동기화) Mac에서 56개 지점으로 확인 |
| 3 기상 지도 | Leaflet·METAR/TAF/SIGMET/바람/위성·신선도·오프라인 패키지 | ✅ 로컬 / ⏳ 사용자 확인 | 완료 조건 3개 Mac 개발 서버에서 확인. 아이패드·배포판은 Cloudflare 중계 필요(K-17) |
| 3.5 4D | 시간 슬라이더·SIGMET 교차 | ⏳ | |
| 4 NOTAM | OFP NOTAM 파싱·분류 | ⏳ | 구간(`NOTAM PACKAGE 1/2/3`)만 찾음. 공식 근거 기반(D-030) |
| 5 매뉴얼·MEL·얼러트 | | ⏳ | MEL/CDL 목록은 OFP에서 추출됨(매뉴얼 매칭 없음) |
| 6 AI 보조 | | ⏳ | |

## 3. 완료된 기능 (코드로 확인됨)

- **앱 셸**: 반응형 3단 레이아웃, 탭(아이폰 More 시트), 상태 배지(ONLINE/OFFLINE·SYNC·OUTBOX), 첫 실행 고지, iOS 홈 화면 안내 배너, `navigator.storage.persist()`
- **테마**: 주간/야간/자동, 상단 해·달 버튼
- **동기화**: outbox(트랜잭션·UUID 멱등·지수 백오프·5회 실패 표시), Mock GAS, Apps Script(`upsertLog`/`listLogs`/`ping`, 비행별 Drive JSON 백업)
- **OFP**: OFP 열기 버튼(3곳) → pdf.js 기기 내 추출 → Aviator 파싱 → 현재 비행 설정 / 원문 뷰어(페이지·검색·줄 이동) / 추출 결과 패널(구간·추출 항목·교차검증 8종)
- **OFP 화면(Lido식)**: FLIGHT·FUEL·WEIGHTS·ALTERNATES·EDTO/ETP(드리프트다운)·TURBULENCE·MEL/CDL·DISPATCH NOTES·연료 통계 / NAV LOG(FIR 경계·TOC/TOD/ETP 강조·SR 색·ATO 표시) / CRZ WIND
- **순항 기록**: 다음 지점 버튼, 입력 시트(ATA·연료·100단위 축약), 편차·착륙 예상(2종)·수정 ETO/ETA, 연료 그래프, 점검 알림, 기록 수정/취소, 메모
- **대시보드**: 비행 요약, OFP 요약(연료·중량·ETP·난류·MEL·유효시간), 순항 요약, 동기화
- **Settings**: Apps Script URL·토큰·연결 테스트·지금 동기화·업로드 대기 목록·기기 저장소·화면 테마·고지

## 4. 진행 중 / 미완료

| 항목 | 상태 | 메모 |
|---|---|---|
| 아이패드 실기기 테스트 | ❓ | 사용자 계획: "로컬 → 아이패드 실사용 → GitHub" 순서 |
| 실제 Apps Script 배포·연동 | ❓ | `apps-script/Code.gs` v0.2.0 (칸 `seq, unit, void` 추가). 사용자가 설치한 적 없음 |
| 연료·SR·중량 경고 기준 | ⏳ 임시값 | 회사 매뉴얼 근거 필요 (원본 명세 미결 #5) |
| 사용자 정의 점검 목록 | ⏳ | 원본 명세 §11 "체크 항목"의 사용자 정의 부분 |
| 민감정보 마스킹 업로드 옵션 | ⏳ | 원본 명세 §16 |
| 비행 종료 7일 후 캐시 자동 삭제 | ⏳ | 원본 명세 §9.3 (Phase 3 오프라인 패키지와 함께) |
| Git 첫 커밋 / GitHub 업로드 | ✅ | 2026-11-05 |

## 5. 현재 오류

❌ 없음. 알려진 제약·주의는 `docs/KNOWN_ISSUES.md`.

## 6. 원본 명세 미결 사항 (원본 명세 §17)

| # | 항목 | 상태 |
|---|---|---|
| 1 | 회사 OFP 샘플 | ✅ 10개 수령 (`private/samples/`) |
| 2 | OFP 시스템명 | ✅ Jeppesen Aviator |
| 3 | 사용 기기 (회사/개인 아이패드) | ❓ 미확인 |
| 4 | 주 운항 기종 | ❓ 미확인 (샘플은 A388 위주 + B78X 1개) |
| 5 | 얼러트 임계값의 매뉴얼 근거 | ⏳ 임시값 사용 중 (D-023, D-025) |
| 6 | 변환할 매뉴얼 목록 | ❓ 미확인 |
| 7 | 호스팅 | ✅ GitHub Pages (D-005) |

## 7. 다음에 할 작업 (우선순위)

1. **사용자 Phase 3 확인** — `LOCAL_TEST.md` §9
2. ~~Cloudflare Worker 기상 중계~~ ✅ 설치됨 (2026-11-05). GitHub Pages 주소가 정해지면 Worker 변수 `ALLOWED_ORIGINS` 설정
3. **아이패드 실사용 테스트** — Safari로 https://kevin-ihc.github.io/efb-brief/ → 공유 → 홈 화면에 추가 → Settings 기상 중계 주소 입력 → OFP 열기·비행기 모드 확인
4. 실제 Apps Script 설치·연동 확인
5. Worker `ALLOWED_ORIGINS` = `https://kevin-ihc.github.io,http://localhost:5173,http://localhost:4173` (선택)
6. Phase 3.5(4D 슬라이더·SIGMET 교차) 또는 Phase 4(NOTAM) — 사용자 선택

## 8. 세션 인계 (가장 최근 작업)

### 2026-11-05 — 첫 개발 대화 (Phase 0 → 2) + 문서 체계 구축
- **완료**: Phase 0·1·1.5·2 구현, 문서 체계(`docs/*`, CLAUDE.md 정리, README 새 세션 안내, `.claude/skills/session-start`·`session-handoff`)
- **변경 파일(문서 작업)**: `CLAUDE.md`, `README.md`, `SPEC.md`(머리말 1줄 — 보존용 동결 표시), `docs/*` 6개 신규, `.claude/skills/*` 신규. **소스·설정 변경 없음**(해시로 확인)
- **테스트**: 59/59 통과, tsc·build 통과
- **해결 못 한 것**: 아이패드·실제 시트 미확인, 경고 기준 임시값
- **다음**: Phase 3 기상 지도 (새 세션에서 시작)

### 2026-11-05 — Phase 3 기상 지도 (조사 → 결정 → 구현 → 로컬 검증)
- **완료**: 기상 소스 CORS 실측(aviationweather.gov 차단, Open-Meteo·NASA GIBS 허용), 결정 **D-034~D-040**(D-035는 CARTO 키 필요가 드러나 D-039로 대체 — 사용자 선택). Weather 탭(METAR·TAF 해석·등급·ETD/ETA 강조, SIGMET 루트 관련/전체, 바람·기온 예보 vs OFP), Map 탭(Leaflet, 내장 세계지도, 날짜변경선 루트, 공항 등급 색, SIGMET, 바람 화살표, 위성 IR, 루트 보기), 신선도 색, 자동 갱신, 오프라인 갱신 비활성, "비행 준비 완료" 오프라인 저장, Settings 기상 중계 주소·연결 테스트, Mac 서버 내장 중계
- **변경 파일**: `vite.config.ts`(wxProxyPlugin, precache json), `package.json`(leaflet, @types/leaflet), `tools/build-geo.ts`, `public/geo/{land,borders,airports}.json`, `src/features/weather/*`(api·decode·freshness·store·route·airports·ui·WeatherPage·weather.test), `src/features/map/{MapPage,satellite}.ts(x)`, `src/app/{App,tabs}.tsx`, `src/app/styles.css`(Weather·Map 절, 토큰 `--cat-*`·`--map-*`), `src/main.tsx`, `src/db/settings.ts`(`wxProxyUrl`), `src/features/settings/SettingsPage.tsx`, 문서(DECISIONS·PROJECT_SPEC·ARCHITECTURE·KNOWN_ISSUES K-17~20·LOCAL_TEST §9)
- **테스트**: `npm test` 76/76 (새 17개), `tsc -b` 통과, `npm run build` 통과(precache 20개 약 3.0MB). 개발 브라우저에서 데모 비행 + 실제 OFP(KLAX→RKSI)로 확인: 실데이터 수신, 새로고침 후 요청 없이 캐시 표시, 오프라인 흉내에서 갱신 버튼 꺼짐·위성/SIGMET 저장본 표시, 비행 준비 105조각 7.9MB 15초 실패 0, 375·768·1180·1440 × 주간/야간 가로 스크롤 0
- **Phase 3 완료 조건**: 온라인 자동 갱신 ✅ · 오프라인 캐시 열람 ✅ · 갱신 버튼 비활성 ✅ — **Mac 로컬 기준**. 아이패드·배포판은 Cloudflare 중계 필요(K-17)
- **해결 못 한 것**: Cloudflare Worker 중계(사용자 가입 필요), FL 선택(K-20), 신선도 설정 화면, 캐시 삭제 기준 근사(K-18), 실제 오프라인(서버 끔) 상태에서 배포판 확인 안 함(개발 서버에서 onLine 흉내로만 확인)
- **다음**: 사용자 확인 → (아이패드 테스트 전) Cloudflare 계정 + Worker 중계 → Phase 3.5(4D) 또는 Phase 4(NOTAM)

### 2026-11-05 — Cloudflare Worker 기상 중계 설치
- **완료**: `worker/wx-proxy.js`(허용 4개 경로·GET만, CORS, 60초 캐시, 선택 `ALLOWED_ORIGINS`) + `worker/wx-proxy.test.ts`(5개), 설치 안내 `docs/CLOUDFLARE_WORKER.md`. 사용자가 Cloudflare 가입 후 Worker `efb-wx` 배포(주소 `https://efb-wx.<계정>.workers.dev`). 개발 앱 Settings에 주소 입력 → 연결 테스트 성공, METAR·TAF·isigmet·airsigmet 모두 Worker 경유로 오류 없이 갱신
- **변경 파일**: `worker/*`, `vite.config.ts`(test.include에 worker), `docs/CLOUDFLARE_WORKER.md`, KNOWN_ISSUES(K-17 해결), ARCHITECTURE, CURRENT_STATUS
- **테스트**: `npm test` 81/81, `tsc -b` 통과
- **미해결**: 아이패드 실기기, `ALLOWED_ORIGINS` 미설정(모든 사이트 허용 — 공개 기상이라 위험 낮음). Worker 이름은 사용자가 `efb-wz` → `efb-wx`로 변경(주소 `https://efb-wx.<계정>.workers.dev`), 앱 설정 갱신·연결 확인
- **다음**: 아이패드 실사용 테스트 → Phase 3.5 또는 4

### 2026-11-05 — GitHub 첫 업로드·Pages 배포
- **완료**: 공개 전 정리(항공사명 4곳·실제 등록번호 1곳 일반화, 실제 OFP 값 고정 테스트 기대값을 `private/samples/ofp-01.expect.json`으로 이동 — 공개 저장소에는 형식 예시만), 첫 커밋, `gh repo create KEVIN-IHC/efb-brief --public`, Pages(build_type=workflow) 활성화, Actions 배포 성공(테스트·빌드 통과). 배포판에서 중계 주소가 비어 있으면 "기상 중계 주소 미설정" 안내(`isLocalHost`)
- **확인**: https://kevin-ihc.github.io/efb-brief/ 200, SW 활성, `/private/` 404, 바람(Open-Meteo) 수신. METAR 등은 기기별로 중계 주소 입력 필요
- **테스트**: `npm test` 82/82, `tsc -b` 통과
- **주의**: 저장소는 공개. 앞으로도 커밋 전에 회사 OFP 원문·실제 편명·등록번호가 코드·문서·테스트에 들어가지 않게 확인
