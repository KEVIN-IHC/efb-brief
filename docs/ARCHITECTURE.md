# ARCHITECTURE — 기술 구조

> 코드를 고치기 전에 해당 모듈 절만 읽는다. **문서와 코드가 다르면 코드가 기준**이고, 차이를 사용자에게 알린 뒤 이 문서를 고친다.
> 마지막 확인: 2026-11-05 (소스 약 5,600줄, 테스트 9파일 59개)

## 1. 전체 구조

```
┌───────────────────── iPad / iPhone / PC 브라우저 (PWA) ─────────────────────┐
│ React UI (src/app, src/features/*)                                          │
│   └ Zustand 상태: useActiveFlight · useSync · useTheme · useOfpImport        │
│ Service Worker (vite-plugin-pwa/Workbox) — 앱 셸 + pdf.js worker precache    │
│ IndexedDB 'efb' v1 (idb) — flights · ofp · route · logs · outbox · settings  │
│ pdf.js (legacy 빌드, 기기 내 PDF 텍스트 추출 — 네트워크 없음)                 │
│ Sync manager — online / 시작 / 화면 복귀 / 5분 주기에 outbox flush            │
└──────────────┬──────────────────────────────────────────────────────────────┘
               │ POST text/plain JSON {token, op}  (온라인일 때만)
       ┌───────▼───────────────────────┐        ┌──────────────────────────┐
       │ Google Apps Script Web App     │        │ (Phase 3) 기상 API / 필요 시 │
       │  doPost: upsertLog·listLogs·ping│        │ Cloudflare Worker 프록시   │
       │  → Sheet 'Logs' + Drive JSON    │        └──────────────────────────┘
       └────────────────────────────────┘
개발/미리보기 서버(Vite): /mock-gas (Mock Apps Script), /private·*.pdf 403 차단
```

## 2. 디렉터리

```
IPBS/
├─ CLAUDE.md               # 세션 지침 (짧게)
├─ README.md               # 설치·실행·새 세션 시작 프롬프트
├─ LOCAL_TEST.md           # 사용자용 Mac 테스트 안내 (한국어)
├─ SPEC.md                 # 원본 명세 (2026-11-05, 보존용 동결)
├─ docs/                   # 프로젝트 기억: CURRENT_STATUS · PROJECT_SPEC · ARCHITECTURE · DECISIONS · KNOWN_ISSUES
├─ .claude/                # launch.json(미리보기 서버 설정), skills/(세션 시작·인계)
├─ .github/workflows/deploy.yml  # GitHub Pages 배포 (아직 미사용)
├─ apps-script/            # Code.gs (백엔드), appsscript.json
├─ worker/                 # wx-proxy.js: Cloudflare Worker 기상 중계 (D-034, 설치 안내 docs/CLOUDFLARE_WORKER.md) + 테스트
├─ tools/
│  ├─ mock-gas.ts          # Vite 플러그인: 개발용 Apps Script 흉내 (dev + preview)
│  ├─ extract-ofp.ts       # 개발용: PDF → 앱과 동일한 텍스트 (.txt)  `npx vite-node tools/extract-ofp.ts …`
│  └─ build-geo.ts         # 개발용(인터넷 필요): Natural Earth·OurAirports → public/geo/*.json (D-035/036/039)
├─ public/icons/           # PWA 아이콘 (Python으로 생성한 PNG + SVG)
├─ public/geo/             # 내장 지도·공항 (land/borders/airports.json, 약 820KB, precache)
├─ private/                # ⚠ gitignore. 회사 OFP 샘플(samples/ofp-NN.pdf|txt), 참고 분석(reference/)
└─ src/
   ├─ main.tsx             # 부팅: 테마 적용 → DB 시드(데모) → 오래된 OFP 재파싱 → 현재 비행 로드 → 동기화 시작 → 렌더
   ├─ app/                 # 셸·공통 UI
   ├─ db/                  # IndexedDB 스키마·설정
   ├─ sync/                # outbox·Apps Script 클라이언트·동기화 매니저
   ├─ lib/                 # 시간·형식·대권·uuid·useNow
   ├─ mock/                # 데모 비행·데모 OFP (ICN→LAX 대권 생성, kg)
   └─ features/
      ├─ flight/           # 현재 비행 (activeFlight.ts)
      ├─ ofp/              # PDF 추출, 파서, OFP 화면
      ├─ inflight/         # 순항 기록 (Phase 2)
      ├─ weather/          # 기상 받기·저장·갱신·Weather 탭 (Phase 3)
      ├─ map/              # Map 탭(Leaflet)·위성 조각 (Phase 3)
      ├─ notam/            # NOTAM 분류·관련성·근거·NOTAM 탭 (Phase 4)
      ├─ dashboard/
      └─ settings/
```

## 3. 모듈별 역할

### 3.1 앱 셸 `src/app/`
| 파일 | 역할 |
|---|---|
| `App.tsx` | 해시 라우팅(`#ofp` 등), 사이드바/하단 탭/More 시트, 페이지 전환. 시작 시 현재 비행 미로드면 재시도 |
| `tabs.tsx` | 탭 정의(`primary`=아이폰 하단 노출, `phase`=예정 표시), 인라인 SVG 아이콘 |
| `StatusBar.tsx` | ONLINE/OFFLINE·SYNC·DEMO·OUTBOX·해/달 버튼 |
| `theme.ts` | 주간/야간/자동, `localStorage('efb.theme')`, `<html data-theme>` (index.html 인라인 스크립트와 같은 규칙) |
| `styles.css` | **디자인 토큰**(`:root` 야간, `:root[data-theme=light]` 주간) + 전 컴포넌트 스타일. 반응형 기준 768/1024/1280/1360, 아이폰 480 미만 |
| `Disclaimer.tsx`, `InstallBanner.tsx` | 첫 실행 고지, iOS 홈 화면 안내 |

### 3.2 데이터 `src/db/`
- `schema.ts` — DB `efb` **v3**. 스토어: `flights`(flightId) · `ofp`(flightId, `OfpRecord`) · `route`(flightId) · `logs`(logId, idx `byFlight`) · `outbox`(opId, idx `byStatus`) · `settings`(key) · `wxSnapshots` · `wxFrames` · `mapTiles` · (v2, D-044) `manualDocs`(docId) · `manualPages`([docId, seq]) · `manualItems`([docId, itemNo], idx `byItem`) · (v3, D-046) `alerts`([flightId, id], idx `byFlight`). v1의 `manualIndex`·`melItems`는 v2에서 삭제. **스토어 추가 = DB_VERSION 올리고 `upgrade`에 `if (oldVersion < 2)` 추가**
- `settings.ts` — `gasUrl`, `gasToken`, `lastSyncAt`, `disclaimerAckAt`, `activeFlightId`

### 3.3 동기화 `src/sync/`
- `outbox.ts` — `saveLog()`(logs+outbox 한 트랜잭션), `flushOutbox()`(중복 실행 방지, 50건 배치, 결과별 sent/재시도, 백오프), `pruneSent()`(7일), `outboxEvents`(변경 알림)
- `gasClient.ts` — `postToGas()`(20초 타임아웃, JSON 아니면 오류), `upsertLogs()`(비행 메타 포함), `pingGas()`
- `syncManager.ts` — `useSync` 스토어(online·syncing·pending·failed·lastSyncAt), 트리거 등록

### 3.4 현재 비행 `src/features/flight/activeFlight.ts`
- `useActiveFlight` {flight, ofp, isDemo, loaded}. `importOfpText()`(파싱 → 완전하면 ofp·flights·route 저장 + 활성화), `reparseStale()`(파서 버전 다르면 원문 재파싱·ID 이전), `deleteOfp()`, `setActiveFlight()`, `flightIdFor()` = `편명-날짜-출발-도착`

### 3.5 OFP `src/features/ofp/`
| 파일 | 역할 |
|---|---|
| `types.ts` | `OfpData`(unit·header·fuel{rows}·weights·alternates·route·etps·edto·crzWind·mel·notes·pax·cargo·fuelStats), `OfpWaypoint`, `OfpRecord` |
| `pdfText.ts` | pdf.js 동적 로드, `itemsToLines()`(y로 줄 묶기, x/글자폭으로 **열 위치 복원**), 페이지 구분선 `===== PAGE n =====` |
| `parser/lines.ts` | `DocLine{n,page,text}`, 페이지 잡음 판별 |
| `parser/sections.ts` | Aviator 구간 표시 문자열(`verified` 플래그), 메인 CFP 끝·복사본 탐지 |
| `parser/fpl.ts` | ICAO FPL 해석·블록 자르기·비교 |
| `parser/notam.ts` | NOTAM PACKAGE 1/2/3 구조 추출(`parseNotams`): 패키지·공항/FIR·분류 제목·항목·필드·원문 줄, 누락 점검 수 (D-043) |
| `parser/aviator.ts` | **Aviator 추출 규칙**: 헤더, 연료(`FUEL_ROW`), 중량, 루트 로그(3줄/지점 `ROW_A/B/C`), 교체공항·ERA, ETP(LOLV/EDTO)·드리프트다운, 디스패치, 바람 요약 |
| `parser/extractors.ts` | 추출기 목록(각각 `FieldTrace` 기록), 상태 ok/partial/failed/pending/missing |
| `parser/index.ts` | `parseAviatorOfp()` → 조립(`assemble`) + 교차검증 9종(NOTAM 건수 포함). **`AVIATOR_PARSER_VERSION`** (현재 `aviator-1.3`) |
| `margins.ts` | 한계 여유 판정(kg 기준 → lbs 환산), ETP는 CFR 있을 때만 |
| `turbulence.ts` | SR 수준·연속 구간 묶기 (임시 기준) |
| `useOfp.ts` | 업로드 목록 훅, `ofpEvents` |
| `sourceJump.ts` | 다른 탭에서 원문 줄로 이동 (`jumpToOfpSource(n)` → `#ofp` PDF·추출 탭) |
| `OfpOpenButton.tsx` | 어디서나 PDF 열기 → `importOfpFile()` (`useOfpImport` 진행 상태) |
| `OfpPage.tsx` | 하위 탭 OFP / NAV LOG / CRZ WIND / PDF·추출 |
| `RawPdfView.tsx`, `ParsePanel.tsx` | 업로드 목록·추출 결과·원문 뷰어(줄 이동) |
| `doc/*` | Lido식 화면: `ui.tsx`(DocSection·Cell·LevelPill), `OfpDocument`, `NavLog`, `CrzWind`, `Turbulence` |

### 3.6 순항 기록 `src/features/inflight/`
| 파일 | 역할 |
|---|---|
| `deviation.ts` | `buildChecks`(편차), `project`(착륙 예상 2종·수준·수정 ETA), `nextWaypoint`, `revisedEto`, `parseFuelInput`(100단위), `parseAta`(가까운 날짜), `FUEL_DEV_RULES`(임시) |
| `actuals.ts` | `latestActuals`(seq별 최신, VOID 제외), `useFlightLogs`, `saveWaypointActual`, `voidWaypointActual` |
| `reminders.ts` | 점검 알림 3종 |
| `EntrySheet.tsx`, `FuelChart.tsx`(SVG), `InflightPage.tsx`(+메모) | 화면 |

### 3.7 기상 `src/features/weather/` · 지도 `src/features/map/` (Phase 3)
| 파일 | 역할 |
|---|---|
| `api.ts` | 외부 호출(타임아웃 15초, 바람 40초). AWC는 `<중계>/awc/<종류>` (`getWxProxyBase`: 설정 `wxProxyUrl` 또는 같은 서버 `/wx`), Open-Meteo 직접. `fetchWinds`: 웨이포인트 최대 60개, ETO에 가까운 정시, 기압면 보간 |
| `decode.ts` | AWC JSON → `Metar`/`Taf`/`Sigmet`, `flightCategory`, `visibSm`, `isaPressure`, `interpolateAtFl` |
| `freshness.ts` | 갱신 주기 `REFRESH_MS`·신선도 기준 `FRESH_LIMITS` (PROJECT_SPEC §5.6) |
| `store.ts` | `useWx`(zustand), `flightStations`, `loadWxCache`(7일 지난 캐시 삭제), `refreshKind`/`refreshDue`, `startWxScheduler`(main.tsx: 1분 점검·online·visibility) |
| `route.ts` | `unwrapLons`(날짜변경선), `nearLon`, `pointInPoly`, `sigmetNearRoute` |
| `airports.ts` | `public/geo/airports.json` 로드 |
| `ui.tsx` / `WeatherPage.tsx` | `FreshTag`·`CatBadge`·갱신 카드·비행 준비 카드 / Weather 탭 |
| `map/satellite.ts` | GIBS 조각 fetch(동시 4개)→`wxFrames` 저장, 30분 이내·오프라인이면 저장본, `corridorTiles`·`prefetchSatCorridor`, 영상 시각 = 헤더 `layer-time-actual` |
| `map/MapPage.tsx` | Leaflet: 내장 지도(pane `ne`) · 위성(pane `sat`, GridLayer) · 루트·ETP · 공항 · SIGMET · 바람 화살표. 개발 중 `window.__efbMap` |

- 개발 서버 중계: `vite.config.ts` `wxProxyPlugin` (`/wx/awc/{metar,taf,isigmet,airsigmet}` GET만 → aviationweather.gov)

### 3.7b NOTAM `src/features/notam/` (Phase 4, D-043)
| 파일 | 역할 |
|---|---|
| `refs.ts` | 근거 문서 목록(PANS-AIM 부록 3, Doc 8400 약어·NOTAM Code, FAA JO 7930.2, OFP 원문, 회사 자료) + `checked` |
| `classify.ts` | OFP 분류 제목 → 그룹(`HEADING`), 본문 약어 칩(`KW`), RWY 추출, 강조 판단, 근거(`Reason`) |
| `relevance.ts` | 비행 시간대(ETD~ETA), FIR 통과 시간대(NAV LOG `fir`·ETO), 유효기간 겹침 |
| `NotamPage.tsx` | 요약(패키지 건수 점검)·보기 필터·공항 목록·항목 카드(근거·원문 링크) |

- 데이터: `OfpData.notams`(파서가 원문 구조만 저장). 분류는 화면에서 계산 → 규칙을 고쳐도 재파싱 불필요

### 3.7c 매뉴얼 `src/features/manual/` (Phase 5, D-044)
| 파일 | 역할 |
|---|---|
| `types.ts` | 묶음 형식 `ManualBundle`(meta·pages·items), `MANUAL_FORMAT_VERSION` |
| `parse.ts` | 변환 MD → 묶음: 종류·기종·발행일·개정(`detectMeta`), 쪽 나누기(`splitPages`, 쪽 표시 경계) 또는 절 나누기(`splitSections`, marker 변환·FOM, D-047), MEL 하위 항목·CDL 항목 추출. `MANUAL_PARSER_VERSION` |
| `store.ts` | 파일 읽기(gzip/JSON/MD), 저장(같은 docId 통째 교체·오래된 개정 확인), 목록·삭제, 번호로 항목 찾기(`findManualItems`) |
| `ManualCard.tsx` | Settings → 매뉴얼 카드 |
| `lookup.ts` | (D-045) 쪽 캐시, 탭 이동(`openManualPage`), OFP MEL/CDL 매칭(`matchMelItem`, 기종 변환), 표시 문구(`itemFlags`), 참조 찾기·이동(`findRefs`·`resolveRef`), 검색(`searchPages`·`directKey`), MEL 항목만 잘라 보기(`itemSlice`: 상위 제목부터 다음 항목 전까지, 다음 쪽 이어 붙임) |
| `ManualText.tsx` | 쪽 본문 표시(제목·굵게·표·목록·원문 줄바꿈 ¦, 참조 링크, 강조). 그림 글로 바뀐 MEL 표(Repair interval…)→표, 쪽 머리 그림 글→작은 회색 한 줄, 번호만 있는 제목+다음 제목 합치기, 대상 항목 제목 강조 |
| `ManualPage.tsx` | Manual 탭: 검색·범위·결과, 매뉴얼·쪽 이동·되돌아가기. MEL 항목 번호로 열면 그 항목만(기본) ↔ 쪽 전체 보기 |
| `MelPage.tsx` | MEL 탭: OFP MEL/CDL ↔ 매뉴얼 항목 카드 |
- Mac 도구 `tools/manual-convert/build.ts`(`npm run manuals`) + `pdf2md.py`(pymupdf4llm). 입력 `private/manuals/inbox` → MD `private/manuals/md` → 묶음 `private/manuals/out/<docId>.efbman.json.gz` + `manifest.json`

### 3.7d 얼러트 `src/features/alerts/` (Phase 5, D-046)
| 파일 | 역할 |
|---|---|
| `types.ts` | `AlertRule`(id·name·threshold·manualRef·evaluate) · `AlertResult` · `Basis`(manual·ofp·temporary·app·data) · `FlightContext` |
| `rules/*.ts` | 규칙 하나씩 (`rules/index.ts`의 `RULES`에 등록) |
| `fomRefs.ts` | (D-048) 근거 FOM 절 코드·이름, `fomBasis`(가져온 FOM에서 위치 찾아 링크) |
| `engine.ts` | 실행·중복 제거·심각도순, 실패 규칙 안내 |
| `store.ts` | IndexedDB `alerts` 기록·확인·이력 |
| `useAlerts.ts` | 현재 비행 맥락 만들기(OFP·기록·MEL 매칭·기상) → 실행 → 새 얼러트 기록 |
| `AlertsCard.tsx` | 대시보드 카드 |

### 3.7e 브리핑 `src/features/brief/` (D-049~D-054)
| 파일 | 역할 |
|---|---|
| `rules.ts` | 회사 기준 파일 형식(`CompanyRules`)·점검·저장(IndexedDB `settings.companyRules`) — 수치는 코드에 없음 |
| `wx.ts` | METAR 원문(RVR·시정 m·현상·VV), TAF 시간 창(기본/TEMPO 분리), 가장 나쁜 값 |
| `runways.ts` | OFP 활주로 줄 + `public/geo/runways.json` 진방위, 바람 성분 |
| `notamImpact.ts` | NOTAM → 시설 고장·폐쇄·소방등급·GNSS·RWYCC |
| `fomTables.ts` | 가져온 FOM에서 특수공항 표·공항 제한 절, 매뉴얼 쪽 코드 → 위치 |
| `assess.ts` | 공항 역할·시간 창, 공항별·비행 전체 판정(`Finding` + 근거) |
| `cards.ts` | 브리핑 카드 초안, 현재 위치, 회항 후보 |
| `profile.ts` · `ProfileCard.tsx` | 개인 운항 조건 (Settings) |
| `useBrief.ts` | 기기 자료 불러오기 → `buildBrief` (Briefing 탭·얼러트 공용) |
| `BriefPage.tsx` | Briefing 탭 |
- 얼러트 연결: `alerts/rules/briefRules.ts` (판정 묶음 7개), `FlightContext.brief`

### 3.8 기타
- `features/dashboard/DashboardPage.tsx` — 비행·OFP 요약·순항 요약·동기화
- `features/settings/SettingsPage.tsx` — 테마·GAS 설정·대기 목록·저장소·고지
- `lib/` — `time.ts`(formatZ·formatAgo·isOnline), `format.ts`(fmtKg 등 — 단위 무관 숫자 형식), `geo.ts`(대권·좌표 형식), `uuid.ts`, `useNow.ts`
- `mock/` — `demoFlight.ts`, `demoOfp.ts`(`DEMO_PARSER_VERSION`)

## 4. 데이터 흐름

**OFP 가져오기**
```
PDF 선택 → extractPdfText (pdf.js, 기기 내) → rawText
 → parseAviatorOfp: toDocLines → splitSections → EXTRACTORS(run) → assemble(OfpData) + runChecks
 → importOfpText: 완전 → ofp/flights/route 저장 + activeFlightId 설정 → useActiveFlight 갱신 → 모든 화면
                  불완전 → 원문만 저장(upload-…), 현재 비행 유지
앱 시작 시 reparseStale: parserVersion ≠ 현재 → 저장된 rawText로 재파싱
```

**순항 기록 / 메모**
```
EntrySheet 저장 → saveLog({kind:'wpt', seq, ata, fuel, unit} | {kind:'memo'})
 → IndexedDB logs + outbox(pending) [한 트랜잭션] → outboxEvents
 → latestActuals → buildChecks/project → 화면·그래프·NAV LOG ATO·대시보드
 → (온라인) flushOutbox → Apps Script upsertLog → {inserted|duplicate} → sent
```

## 5. 저장·캐시

| 대상 | 위치 | 비고 |
|---|---|---|
| 앱 셸·JS·CSS·아이콘·pdf.js worker(1.4MB) | Service Worker precache (17개, 약 2MB) | `registerType: autoUpdate` — 새 버전은 새로고침 1~2회 후 |
| OFP 원문 텍스트·파싱 결과 | IndexedDB `ofp` | 원본 PDF는 저장 안 함 |
| 순항 기록·메모 | IndexedDB `logs` + `outbox` | 전송 후 outbox는 7일 뒤 정리, logs는 유지 |
| 설정 | IndexedDB `settings` | |
| 기기별 화면 선호 | localStorage (`efb.theme`, `efb.ofp.sub2`, 설치 배너 닫음) | 실패해도 동작 |
| 기상 | IndexedDB `wxSnapshots` 키 `[type, station]`: metar·taf(ICAO) / sigmet(`ALL`) / winds·meta(flightId) | 받은 시각 `fetchedAt`, 7일 지나면 삭제 |
| 위성 조각 | IndexedDB `wxFrames` 키 `[layer, 'latest', 'z/x/y']` Blob | 30분마다 새로 받음, 7일 지나면 삭제 |
| 지도·공항 데이터 | precache (`public/geo/*.json`) | 앱과 함께 오프라인 |
| 지도 레이어 선택 | localStorage `efb.mapLayers` | |
| 매뉴얼 | IndexedDB `manualDocs`·`manualPages`·`manualItems` | 가져온 묶음, 같은 매뉴얼은 교체. A380 4종 약 13MB |

## 6. 외부 연동

| 대상 | 상태 | 방식 |
|---|---|---|
| Google Apps Script | 코드 ✅ / 실연동 ❓ | `apps-script/Code.gs` v0.2.0. 설치: 시트 → Apps Script에 붙여넣기 → `setup()`(토큰 발급, 로그 확인) → 웹앱 배포(나·모든 사용자) → 앱 Settings에 URL·토큰. 코드 수정 시 "새 버전"으로 재배포 |
| aviationweather.gov | ✅ 로컬 중계 / ✅ Cloudflare Worker(사용자 계정, 주소는 기기 Settings에만) | METAR·TAF·isigmet·airsigmet JSON. CORS 없음 → 중계(D-034) |
| Open-Meteo | ✅ | 상층풍·기온, 브라우저 직접(비상업 무료) |
| NASA GIBS | ✅ | 위성 IR WMTS, 브라우저 직접 |
| AI(Claude/Gemini) | ⏳ P6 | 프록시로 키 은닉 |

## 7. 테스트·검증

- `npm test` (Vitest, node 환경, fake-indexeddb) — `src/**/*.test.ts`
  - `sync/outbox.test.ts` 오프라인·멱등·백오프 / `ofp/parser/parser.test.ts` 가짜 텍스트 / `ofp/parser/samples.test.ts` **실제 샘플**(`private/samples/*.txt` 있을 때만, 없으면 건너뜀. NOTAM 건수·지정 항목 기대값은 `private/samples/notam.expect.json`) / `notam/notam.test.ts` 가짜 NOTAM 구조·분류·관련성 / `inflight/*.test.ts` / 기타
- `npx tsc -b` 타입 검사, `npm run build` 빌드
- 실제 샘플 텍스트 재생성: `npx vite-node tools/extract-ofp.ts private/samples/*.pdf`
- 화면 확인: 개발 브라우저에서 360/375·768·1180·1440px, 주간/야간, `document.documentElement.scrollWidth - innerWidth === 0`
- 오프라인 흉내(개발 중): `Navigator.prototype.onLine` 재정의 + `offline`/`online` 이벤트 발생. 실제 오프라인 앱 셸은 미리보기 서버를 끄고 새로고침으로 확인
