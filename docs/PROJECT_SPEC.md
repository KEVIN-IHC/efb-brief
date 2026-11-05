# PROJECT SPEC — EFB 브리핑 웹앱 기능 명세

> **살아있는 기능 명세.** 원본 명세(`/SPEC.md`, 2026-11-05 사용자 작성, 보존용으로 동결)의 요구사항을 **축약·삭제 없이** 옮기고, 이후 확정된 요구사항을 합쳤다.
> 각 기능의 구현 상태: ✅ 완료 · 🔄 진행 중 · ⏳ 대기 · ❓ 미확인. 결정의 이유는 `DECISIONS.md`(D-번호), 현재 진행은 `CURRENT_STATUS.md`.
> 요구사항이 바뀌면 이 문서를 고치고 DECISIONS에 기록한다.

## 1. 개요

| 항목 | 내용 |
|---|---|
| 목적 | 회사 OFP를 분석하고 기상·NOTAM·MEL·매뉴얼을 통합해 운항을 돕는 **개인용 보조 브리핑 앱** |
| 형태 | PWA(설치형 웹앱) — 겉은 웹사이트, 홈 화면에 설치하면 앱처럼 동작 |
| 성격 | **개인 참고용 보조 도구.** 승인된 EFB·운항 문서를 대체하지 않는다 |
| 벤치마크 | WSI Weather Brief, Jeppesen Aviator, Jeppesen FD Pro (루트 + 기상 오버레이), Lido eOFP(화면 틀, D-010) |
| 참고 앱 | ckpt-prep-stack(Aviator 파서 PWA, 코드 복사 금지), AeroBrief EFB(AI Studio, 화면 아이디어) — D-031 |

첫 실행·Settings 고지 문구(원본 명세 §16): *"본 앱은 개인 참고용 보조 도구이며, 승인된 EFB·OFP·운항 매뉴얼을 대체하지 않습니다. 운항 판단은 공식 자료를 기준으로 합니다."* ✅

## 2. 사용자·사용 환경

- 사용자: 운항승무원 본인(개발 비전문가, 한국어). 회사 OFP 시스템 = **Jeppesen Aviator**(D-013), 샘플 기종 A380(+B787-10)
- 기기: **iPad Safari 홈 화면 앱(주)**, PC 브라우저(보조), 아이폰(보조). 회사/개인 아이패드 여부 ❓ — 회사 기기면 EFB 관리 부서 정책 확인 필요
- 환경: 순항 중 **오프라인**이 기본. 콕핏 → 다크 기본, 큰 터치(≥44px), 야간 밝기 고려, 주간 화면 전환(D-011)
- 저장: 기기 IndexedDB + 구글드라이브(Apps Script 백엔드)
- 화면 크기: 아이폰 / 아이패드 세로·가로 / PC 모두 자연스럽게 (D-008)

## 3. 연결 상태별 동작 (원본 명세 §2.1)

| 기능 | 온라인 | 오프라인 (순항 중) | 상태 |
|---|---|---|---|
| 기상 업데이트 | 자동 주기 갱신 | 🔒 갱신 비활성, 마지막 데이터 표시 | ✅ 로컬 (P3) |
| 기상 지도·레이어 | ✅ 최신 | ✅ 캐시 데이터로 동일하게 열람 | ✅ 로컬 (P3) |
| 시간 슬라이더(4D) | ✅ | ✅ 미리 받은 예보 프레임 범위 내 | ⏳ P3.5 |
| OFP 대시보드 | ✅ | ✅ | ✅ |
| 순항 기록 입력 | ✅ 즉시 업로드 | ✅ 기기 저장 → 연결 시 자동 업로드 | ✅ |
| 매뉴얼·MEL 조회 | ✅ (AI가 매뉴얼 근거로 답변·출처 표시, D-029) | ✅ 미리 내려받은 범위 (기기 내 검색) | ⏳ P5·6 |
| OFP PDF 업로드·분석 | ✅ | ✅ (파싱은 기기 내부) | ✅ |

## 4. 필수 UX 원칙 (원본 명세 §2.2)

1. **데이터 신선도 표시**: 모든 기상 정보에 발표 시각과 경과 시간. 예: `RKSI METAR · 2h 14m ago` — 유틸 `formatAgo` ✅, 기상 적용 ✅ (Weather·Map, 색 = 신선도)
2. **상태 배지**: 화면 상단에 항상 `ONLINE / OFFLINE`, 마지막 동기화 시각, 업로드 대기 건수 ✅
3. **얼러트에는 근거**: 모든 경고에 원인 데이터와 매뉴얼 위치(문서명·챕터·페이지) ⏳ P5. 현재 임시 경고(연료·SR)는 "임시 기준" 근거 문구 표시 ✅
4. **콕핏 환경**: 다크 기본, 최소 44px 터치, 야간 색 ✅ + 주간 화면 ✅

## 5. 주요 기능과 상세 요구사항

### 5.1 앱 셸·상태 ✅
- 탭: Dashboard · OFP · Map · Weather · Inflight · NOTAM · MEL · Manual · Settings (원본 명세 §14 + OFP 탭 추가). 미구현 탭은 `P3` 등 예정 Phase 표시
- 상단: ONLINE/OFFLINE · SYNC 시각·경과 · DEMO 표시(데모 비행일 때만) · OUTBOX n(실패 시 ⚠) · 해/달 버튼
- iOS: "홈 화면에 추가" 안내 배너, 저장소 영구 보존 요청

### 5.2 동기화 ✅ (원본 명세 §7)
- 기록 저장 시 `logs`+`outbox`를 같은 트랜잭션에 기록 → `flushOutbox()`: online 이벤트·앱 시작·화면 복귀·온라인 5분 주기
- Apps Script `doPost`, UUID 멱등(서버는 이미 있는 UUID 무시), 실패 시 지수 백오프, 5회 이상 실패 UI 표시
- Apps Script 규격: `POST`, `text/plain`, JSON 본문, 개인 토큰(PropertiesService), 저장 = Sheet `Logs` 탭 + 비행 단위 JSON 백업을 Drive 폴더에. 파일명 `YYYYMMDD_HHMM_편명_출발-도착.json`(한국시간, STD 기준). 기록 조회는 `POST op=listLogs`(D-004, 원본의 doGet 조회와 다름)
- 실제 구글 시트 연동은 ❓ 미확인

### 5.3 OFP 가져오기·파서 ✅ (원본 명세 §10)
- **OFP 열기** 버튼(OFP 탭 맨 위·대시보드·사이드바) → PDF 선택 → 기기 내 텍스트 추출(열 위치 보존) → Aviator 파싱 → 완전하면 **현재 비행**으로 설정(D-021)
- 원칙: 규칙 기반(정규식 + 섹션 분할), AI는 보조. 섹션별 모듈, 실패 섹션은 원문 표시(조용히 누락 금지), `parserVersion`과 원문 줄 번호 기록
- 추출 대상(원본 §10.2)과 상태:

| 섹션 | 항목 | 상태 |
|---|---|---|
| 헤더 | 편명, 날짜, 기종, 등록부호, 출발·도착·대체, STD/STA, 계획 비행시간 (+엔진, SELCAL, CI, AVG W/T, PLAN 번호, 계산 시각, 항로 문자열, PLAN VALID) | ✅ |
| 연료 | Trip, Contingency, Alternate, Final Reserve, Extra(DISC+TANKERING), Taxi, Block(RAMP OUT), 최소 요구량(RQD TAKEOFF+TAXI), + REFILE RES·ETP RES·FOD·시간 | ✅ |
| 중량 | ZFW, TOW, LW 계획값 및 한계, Payload (+SOW, RWY, TCAP, AGTOW, ACL) | ✅ |
| 루트 | 웨이포인트, 좌표, (항로는 문자열), FL, 풍향풍속·성분, 기온(OT 원문), TAS/GS, 구간·누적 시간, 계획 잔여연료, MC/MH/TC, MSA, SR, 구간·누적 소모, FIR 경계 | ✅ |
| EDTO/ETP | ETP 지점, 적합 공항, 임계 연료(**OFP 명시 시만**, D-019), 드리프트다운(LRC/1LE/2LE), 항로 교체공항 시간창 | ✅ |
| 교체공항 | 목적지 교체(거리·FL·시간·연료·루트), 3% CONT ERA | ✅ |
| FPL | ICAO Doc 4444 형식, 블록 간 일치 검증 | ✅ |
| 바람·기온 요약 | FL별 지점 바람·성분·기온·ISA (CRZ WIND) | ✅ |
| NOTAM | 공항별·FIR별 NOTAM 원문 | ⏳ P4 (구간만 탐지) |
| 기상 | OFP에 포함된 METAR/TAF, SIGWX 요약 | ⏳ P3 |
| MEL/CDL | 적용 항목 번호와 비고 (+승객·화물, 디스패치 노트, 노선 연료 통계) | ✅ (매뉴얼 매칭 ⏳ P5) |

- 교차검증 8종: 메인 CFP 종료 표시 · 후반부 복사본 제외 · FPL 블록 일치 · 헤더↔FPL · 연료표 합계 · 중량 합계 · 루트↔연료표 · CRZ WIND↔NAV LOG ✅
- 단위: `100LBS` → lbs 저장, 화면 단위 표시(D-016)

### 5.4 OFP 화면 (Lido식) ✅ (원본 명세 §10.3 + D-010)
- **OFP 문서**: FLIGHT(편명·구간·ALTN·날짜·기종·REG·엔진·SELCAL / ETD·ETA·FLT TIME·MAX FL·CI·AVG W/T·EDTO·PLAN VALID / ROUTE) → FUEL(OFP 원래 줄 + EXTRA 여유) → WEIGHTS(계획/한계/여유·막대, 기타 한계, 승객·화물) → ALTERNATES → EDTO·ETP → TURBULENCE(SR) → MEL/CDL → DISPATCH NOTES(+노선 연료 통계)
- 원본 요구 "상단 요약 카드: 연료(Block vs 최소 요구량, 여유분), 중량(실제 vs 한계, 여유분), 비행시간, 대체공항" 및 "한계 대비 여유가 적은 항목 하이라이트" → 문서 블록과 대시보드로 충족 ✅
- **NAV LOG**: WPT/FL/MC/WIND/CMP/OT/TAS/GS/MSA/SR/DIST/ZT/ACTM/ETO/ATO/R/F/B·O, FIR 경계 줄, TOC·TOD·ETP 강조, 난류 구간 표시, 행 클릭 → 원문 위치. 좁은 화면은 핵심 열만
- **CRZ WIND**: 지점×FL, 계획 FL·성분 최대 FL 표시 (D-022)
- **PDF·추출**: 업로드 목록(현재 비행 지정·삭제), 추출 결과(구간·항목·교차검증), 원문 뷰어(페이지·검색·줄 강조)

### 5.5 순항 기록 (Inflight) ✅ (원본 명세 §11)

| 기능 | 내용 | 상태 |
|---|---|---|
| 웨이포인트 체크 | 통과 시 ATA, 실제 잔여연료 입력 (탭 한 번 + 숫자 키패드). "다음 지점" 큰 버튼, ATA 기본 지금·±1분, 연료 100단위 축약 입력(D-026) | ✅ |
| 자동 계산 | 계획 대비 시간 편차, 연료 편차, 착륙 시 예상 잔여연료(계획 소모 유지 / 현 추세), 수정 ETO·ETA | ✅ |
| 그래프 | 계획 연료선 vs 실제 연료 포인트 (+예상선, ALTN+FINAL 선) | ✅ |
| 경고 | 연료 편차가 설정값을 넘으면 경고 — **현재 임시 기준**(D-025), 회사 매뉴얼 근거로 확정 필요 | ✅ 임시 |
| 자유 메모 | 기상 조우, 난류, 관제 지시 등 시각과 함께 기록 | ✅ |
| 체크 항목 | 사용자가 정의하는 주기적 점검 목록 (예: 매 시간 fuel check, ETP 통과 시 점검) | 🔄 기본 알림 3종만(D-027), 사용자 정의 ⏳ |
| 저장 | 모든 입력은 즉시 IndexedDB에 저장, outbox로 동기화. 기록은 추가만(최신 유효, 취소=VOID, D-024) | ✅ |
| NAV LOG 연동 | ATO 칸에 기록 표시 | ✅ |

### 5.6 기상 (Weather 탭) 🔄 Phase 3 (원본 명세 §8)

**구현 현황 (2026-11-05, D-034~D-040)** ✅ 공항별(출발·도착·교체·EDTO) METAR·TAF 원문+해석, 비행 등급 배지, TAF ETD/ETA 구간 강조 · ✅ 국제 SIGMET + 미국 국내 SIGMET(루트 좌우 200NM 관련/전체) · ✅ 웨이포인트별 예보 바람·기온 vs OFP(기압면 보간) · ✅ 신선도 색·자동 갱신·오프라인 갱신 비활성 · ✅ "비행 준비 완료" 오프라인 저장 · ⏳ 국내 기상청 API·PIREP·레이더·GTG·D-ATIS·측풍 계산기(D-037 제외 범위) · ⏳ 신선도·주기 설정 변경 화면 · ❓ 아이패드·Cloudflare Worker 중계


소스 (모두 Phase 3에서 실제 동작·CORS·이용약관 재확인):

| 데이터 | 소스 | 커버리지 | 비고 |
|---|---|---|---|
| METAR / TAF | aviationweather.gov Data API | 전 세계 | 무료, 키 불필요 (브라우저 CORS 차단으로 알려짐 → 프록시 검토) |
| 국제 SIGMET / SIGMET / G-AIRMET | aviationweather.gov | 국제 + 미국 | |
| PIREP | aviationweather.gov | 미국 위주 | |
| 국내 공항 기상 | 공공데이터포털 항공기상청 API | 국내 | 인증키 필요 |
| 상층풍·기온 (FL별) | Open-Meteo 등압면 예보 | 전 세계 | 비상업 무료 |
| 위성영상 | NASA GIBS (WMTS) | 전 세계 | |
| 레이더 | RainViewer 등 | 일부 | 무료 범위 축소 추세, 확인 필요 |
| 난류 GTG | aviationweather.gov | 미국 본토만 | 그 외 구간은 SIGMET·PIREP + OFP SR로 보완 |
| D-ATIS | 미국 공항 위주 공개 서비스 | 미국 | 국내·아시아는 METAR로 대체 |

FL ↔ 기압면 (표준대기 근사): FL180=500hPa, FL240=400, FL300=300, FL340=250, FL390=200, FL450=150

갱신 주기·신선도 임계값 (설정에서 변경 가능):

| 데이터 | 갱신 주기 | 주황 | 빨강 |
|---|---|---|---|
| METAR | 10분 | 60분 경과 | 120분 경과 |
| TAF | 30분 | 새 발표 주기 경과 | 유효기간 종료 |
| SIGMET | 15분 | 30분 | 유효기간 종료 |
| 상층풍·기온 | 60분 | 6시간 | 12시간 |
| 위성 | 30분 | 2시간 | 6시간 |

화면: 공항별 METAR/TAF(원문 + 디코드), SIGMET 목록. 참고 앱 아이디어: VFR/MVFR/IFR/LIFR 색 배지, TAF에서 ETD/ETA 시간대 블록 강조, 공항 기상 칩, 측풍·배풍 계산기.
API 키가 필요하면 Cloudflare Worker 프록시(환경변수)로 은닉, 코드 하드코딩 금지.

### 5.7 지도·4D 🔄 Phase 3·3.5 (원본 명세 §9)

**구현 현황 (2026-11-05)** ✅ 내장 세계지도(D-039) 위 OFP 루트(날짜변경선 연결)·웨이포인트·ETP·공항(METAR 등급 색)·SIGMET 다각형·바람 화살표(계획 고도)·위성 IR(Himawari/GOES-W/GOES-E), 레이어 토글, "루트 보기" · ✅ 오프라인 패키지: 회랑 200NM 위성 조각 줌 3~5(ICN↔LAX 실측 105조각·7.9MB), 공항 기상, SIGMET, 바람 · 🟡 7일 캐시 삭제는 "받은 지 7일" 기준(비행 종료 기준 아님) · ⏳ FL 선택(현재 OFP 계획 고도 고정)·기온 레이어·FIR 경계·기상 프레임 3개 층·4D(3.5)

- 배경지도 위에 OFP 루트(웨이포인트, FIR 경계, ETP/EDTO 지점, 대체공항). 레이어 토글: SIGMET / 바람(바브 또는 화살표) / 기온 / 위성 / 레이더 / PIREP / 공항 기상 색상(VFR·MVFR·IFR·LIFR) / (OFP 난류 SR 구간)
- FL 선택: 기본값 OFP 순항고도, 수동 변경 가능
- **4D 시간 슬라이더**: 범위 `STD − 1h` ~ `STA + 2h`. 슬라이더를 움직이면 OFP ETO 기준으로 항공기 아이콘이 루트 위를 이동, 해당 시각과 가장 가까운 예보 프레임 표시. 각 웨이포인트에서 "도착 예정 시각의 바람·기온·SIGMET 해당 여부" 표. 루트가 유효한 SIGMET 폴리곤과 시공간적으로 교차하면 해당 구간 빨간색 + 얼러트
- **출발 전 오프라인 패키지** ("비행 준비 완료" 버튼 하나): 루트 회랑(좌우 200NM) 배경지도 타일 줌 3~7 / 비행시간 + 2시간 범위 기상 프레임(FL 3개 층: 순항 FL, ±4,000ft) / 출발·도착·대체·EDTO 공항 METAR/TAF. 진행률과 예상 용량 표시. **비행 종료 후 7일이 지난 캐시 자동 삭제**
- 데이터 준비 상태: 루트 좌표 ✅(`OfpWaypoint.lat/lon`), 공항 좌표 ✅(OurAirports 내장, D-036), ETP 좌표 ✅, FIR 경계 이름 ✅(경계 폴리곤 ❌)

### 5.8 NOTAM ⏳ Phase 4
- OFP NOTAM PACKAGE 1/2/3 파싱, 공항·FIR별 분류, 중요도 하이라이트(활주로·항행시설·공역 분류)
- **공식 근거 기반 분석·출처 표시**(D-030). 참고 앱 규칙(기종 무관 항목 제외, GPS RAIM은 ETD~ETA 겹칠 때만 등)은 아이디어로만, 공식 근거로 재정의

### 5.9 매뉴얼·MEL ⏳ Phase 5 (원본 명세 §12)
- 보유 매뉴얼(200~300MB)을 Markdown으로 변환, 문서명·챕터·섹션·페이지 메타데이터 보존. 변환 파이프라인 별도 스크립트(`tools/manual-convert/`), 원본·결과물은 `private/`에만. **GitHub 금지, 구글드라이브에서 내려받음**(D-029)
- 앱 내부 전문 검색(예: MiniSearch), 오프라인 동작. 모든 얼러트·MEL 항목에서 매뉴얼 위치로 바로 이동하는 링크
- MEL을 구조화 JSON: 항목 번호, 명칭, 수리 기한 카테고리, (O)·(M) 절차, 운항 제한(고도·EDTO·결빙·접근 등급 등), 매뉴얼 위치. OFP MEL/CDL란에서 항목 번호 자동 매칭(추출은 ✅), 수동 추가 가능. 운항 제한 → 얼러트 규칙 자동 변환(예: 결빙 제한 MEL + 루트상 결빙 SIGMET → 경고)

### 5.10 얼러트 엔진 ⏳ Phase 5 (원본 명세 §13)
```ts
interface AlertRule {
  id: string; name: string;
  severity: 'info' | 'caution' | 'warning';
  evaluate(ctx: FlightContext): AlertResult | null; // ctx: OFP, 기상, 기록, MEL
  manualRef: { doc: string; chapter: string; page?: string };
}
```
- 규칙은 파일 하나에 하나씩, 점진 추가. 같은 얼러트 중복 금지, 확인(Acknowledge)·이력 저장
- 초기 규칙 후보(임계값은 회사 매뉴얼로 확정): 도착지 기상 minima 근접(TAF 시정·운고, ETA±1h) / 대체공항 기상 부적합(planning minima) / 루트 SIGMET 교차 / 강한 측풍·배풍(기종 제한 근접) / 연료 편차 / MEL 제한 위반 가능 / 기상 데이터 노후(신선도 빨강)
- 현재 임시 경고(연료 D-025, SR D-023, 중량·연료 여유 `margins.ts`)는 Phase 5에서 이 엔진으로 이관

### 5.11 AI 보조 ⏳ Phase 6 (선택)
- NOTAM 요약, 브리핑 요약, 매뉴얼 질의. **온라인 시에만**, 결과에 "AI 요약" 표시, 근거 출처 필수(D-029, D-030). Gemini API 또는 Claude API(키는 프록시)

### 5.12 Settings ✅ (일부)
- ✅ Apps Script URL·토큰·연결 테스트·지금 동기화·업로드 대기 목록, 기기 저장소 상태, 화면 테마, 고지
- ⏳ 갱신 주기, 신선도·경고 임계값, 단위, 오프라인 패키지 관리, 민감정보 마스킹 옵션

## 6. 입력·출력 데이터

| 입력 | 형식 | 처리 |
|---|---|---|
| 회사 OFP | Aviator PDF (70~110쪽) | 기기 내 텍스트 추출 → `OfpData` (원본 PDF 미저장) |
| 순항 기록 | ATA(HHMM UTC), 잔여연료, 메모 | `LogRecord` → IndexedDB → outbox → Apps Script |
| 기상 | 각 API (⏳) | IndexedDB `wxSnapshots`/`wxFrames` (신선도 메타 포함) |
| 매뉴얼 | Markdown 변환본 (⏳) | `manualIndex` |

| 출력 | 위치 |
|---|---|
| 순항 기록 | Google Sheet `Logs` 탭 (칸: logId, flightId, kind, wpt, ata, fuel, note, createdAt, receivedAt, seq, unit, void) + Drive 비행별 JSON |
| 화면 | 대시보드, OFP 문서·NAV LOG·CRZ WIND, Inflight |

## 7. 보안·규정 (원본 명세 §16)
- 회사 OFP·매뉴얼을 개인 구글드라이브나 외부 AI에 올리는 것이 **사내 보안 규정에 맞는지 먼저 확인** (사용자 책임 — 샘플 10개는 사용자가 인지하고 제공)
- 민감정보(승무원명, 편명 등)는 선택적으로 기기 안에서만 처리, 업로드 시 마스킹 옵션 ⏳. 현재 파서는 디스패처 이름·연락처를 추출하지 않음
- 토큰·API 키 하드코딩 금지 (Script Properties, Worker 환경변수)
- 회사 아이패드 설치 시 EFB 관리 부서 정책 확인

## 8. 향후 개발 예정 (로드맵)

| Phase | 범위 | 완료 조건 |
|---|---|---|
| 3 기상 지도 | Leaflet 지도, 루트 표시, METAR/TAF/SIGMET/바람/위성 레이어, 신선도, 오프라인 패키지 | 온라인 자동 갱신, 오프라인에서 캐시 열람, 갱신 버튼 비활성 |
| 3.5 4D | 시간 슬라이더, 항공기 아이콘 이동, SIGMET 교차 판정 | 슬라이더에 따라 레이어·아이콘 동기화, 교차 구간 하이라이트 |
| 4 NOTAM | OFP NOTAM 파싱·분류·하이라이트 | 활주로·항행시설·공역 NOTAM 분류 표시 |
| 5 매뉴얼·MEL·얼러트 | 매뉴얼 md 인덱스, MEL DB, 규칙 엔진, 팝업 | 초기 규칙 5개 동작, 모든 얼러트에 매뉴얼 위치 링크 |
| 6 AI 보조 (선택) | NOTAM 요약, 브리핑 요약 | 온라인 시에만 동작, 결과에 "AI 요약" 표시 |

추가 후보(참고 앱): 캐빈 브리핑 페이지, 손글씨 메모(드로우패드), 측풍 계산기, 공항 기상 칩. 게이트 조회(유료 API)는 보류.
