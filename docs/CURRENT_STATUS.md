# CURRENT STATUS — 현재 개발 상태

> **새 세션은 이 문서부터 읽는다.** 작업이 끝날 때마다 맨 아래 "세션 인계"와 관련 표를 갱신한다.
> 상태 표기: ✅ 완료 · 🔄 진행 중 · ⏳ 대기 · ❓ 미확인 · ❌ 오류 발생
> 마지막 갱신: 2026-11-27 (D-101~D-107 배포 eba10e7 — 아이패드 확인 대기) · 이전: 2026-11-22 (D-092~D-100 배포 66968d6 — 아이패드 확인 대기 · — 맨 아래 "세션 인계" 첫 항목부터)

## 1. 한눈에

| 항목 | 상태 |
|---|---|
| 현재 Phase | **Phase 5 매뉴얼·MEL·얼러트 배포 (7ef2954, 2026-11-10, D-044~D-048)** + **운항관리사식 Briefing(D-049~D-054) 배포 (1e432fe, 2026-11-12)** — 남은 것: 아이패드 확인, 회사 기준 파일 가져오기 확인. Phase 4 NOTAM은 배포됨(e236b29), 아이패드 확인 대기. **추가 기능 목록 1~8 (D-055~D-060: FIR 통신·Ops 탭·버티컬 뷰·FIR 경계·기상 추가) 배포 (fe06c57, 2026-11-12)** — Worker 재배포 필요(K-35), 아이패드 확인 대기. 목록: `private/manuals/NEXT-ITEMS.md` |
| 테스트 | ✅ `npm test` 254개 통과 (2026-11-18 FMS 입력·SPEED SKD·2ND-$ 포함) · 이전: 245개 (2026-11-17 목차·검색 3개 포함) · 이전: 242개 (AGTOW 12개 포함) · 이전: 230개 (항로·OFP 번호 일치) · 이전: 214개 · 이전: 212개 (기상 시간대·난류 지수) · 이전: 198개 (2026-11-12 Ops·버티컬·기상 추가 포함) · 이전: 167개 (2026-11-11 Briefing 포함) · 이전: 139개 통과 (실제 OFP 샘플 10개·NOTAM 원문 대조·실제 MEL 대조 포함), `tsc -b` 통과, `npm run build` 통과 (2026-11-10 FOM 근거 연결) |
| 브라우저 확인 | ✅ Mac Chrome(개발 브라우저 패널)에서 아이폰·아이패드 세로/가로·PC 크기, 주간/야간 |
| 아이패드 실기기 | ✅ 사용자 확인 "잘 작동함" (2026-11-05, https://kevin-ihc.github.io/efb-brief/ 홈 화면 앱). 항목별 세부 결과는 받지 않음 |
| 실제 구글 시트 연동 | ✅ 아이패드 → 시트 온라인 저장 확인 (2026-11-05). 오프라인 복귀 자동 전송 문제는 D-042로 수정 — 아이패드 재확인 필요 |
| Git·호스팅 | ✅ 공개 저장소 https://github.com/KEVIN-IHC/efb-brief (main), GitHub Actions → Pages 자동 배포. 커밋 작성자 = GitHub 비공개 이메일(저장소 로컬 설정) |
| 로컬 서버 | 개발 `npm run dev` → :5173 / 배포판 미리보기 `npm run local` → :4173 |

## 2. Phase별 상태 (원본 명세 §15 기준)

| Phase | 범위 | 상태 | 비고 |
|---|---|---|---|
| 0 뼈대 | PWA·IndexedDB·상태 배지·outbox 동기화·Apps Script | ✅ 로컬 / ✅ 아이패드 설치·실행 / ❓ 실제 시트 | 완료 조건(아이패드 홈 화면 설치 → 비행기 모드 메모 → 시트에 1회 저장) 중 **아이패드·실제 시트는 미확인**. Mac에서 오프라인 저장 → 복귀 시 1회 업로드는 확인 |
| 1 OFP 대시보드 | 더미 OFP 대시보드·루트표, PDF 업로드·텍스트 추출 | ✅ | 이후 1.5에서 화면 교체 |
| 1.5 실제 파서 | Aviator 파서 | ✅ | 샘플 10개(A388·B78X, ICN↔LAX·SYD↔ICN) 전부 교차검증 통과. 추가: Lido식 화면, 주간/야간, CRZ WIND, 난류(SR), OFP 열기 버튼 |
| 2 순항 기록 | 웨이포인트 체크·편차·그래프 | ✅ 로컬 / ⏳ 사용자 확인 | 완료 조건(오프라인 전 구간 기록 → 온라인 일괄 동기화) Mac에서 56개 지점으로 확인 |
| 3 기상 지도 | Leaflet·METAR/TAF/SIGMET/바람/위성·신선도·오프라인 패키지 | ✅ (Mac 검증 + 아이패드 사용자 확인) | 배포판은 Cloudflare Worker 중계 자동 사용(D-041) |
| 3.5 4D | 시간 슬라이더·SIGMET 교차 | ✅ 로컬 | D-063·D-065: Map 시간 막대·재생(지난 위성 3h + 예보), 바람·SIGMET·✈ 위치·버티컬·플랜 뷰가 함께 움직임. 아이패드 확인 전 |
| 4 NOTAM | OFP NOTAM 파싱·분류 | ✅ 로컬·배포 / ⏳ 아이패드 확인 | D-043. 샘플 10개 패키지별 건수 일치, NOTAM 탭(공항·FIR·분류·강조·근거·원문 이동). e236b29 배포 |
| 5 매뉴얼·MEL·얼러트 | 1 넣기 → 2 MEL·CDL 매칭·보기·검색 → 3 얼러트 엔진 → (6 AI 질의) | ✅ 로컬·배포 / ⏳ 아이패드 확인 | D-044·D-045·D-046. MEL·Manual 탭, 대시보드 Alerts. A380 MEL·CDL·FCOM·FCTM 수령(`private/manuals/inbox`), FOM 대기 |
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
| 아이패드 실기기 테스트 | ✅ | 2026-11-05 사용자 확인 |
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
| 5 | 얼러트 임계값의 매뉴얼 근거 | 🔄 착륙 예상 연료 = FOM 근거 (D-048). 편차 %·여유 t·SR은 FOM에 수치 없음 → 임시 유지 |
| 6 | 변환할 매뉴얼 목록 | 🔄 A380 MEL·CDL·FCOM·FCTM + FOM·FCRM 수령 (2026-11-10). B78X 매뉴얼 여부 미확인 |
| 7 | 호스팅 | ✅ GitHub Pages (D-005) |

## 7. 다음에 할 작업 (우선순위)

1. **사용자 Phase 3 확인** — `LOCAL_TEST.md` §9
2. ~~Cloudflare Worker 기상 중계~~ ✅ 설치됨 (2026-11-05). GitHub Pages 주소가 정해지면 Worker 변수 `ALLOWED_ORIGINS` 설정
3. ~~아이패드 실사용 테스트~~ ✅ 사용자 확인 (2026-11-05). 실사용 중 문제 생기면 KNOWN_ISSUES에 추가
4. 실제 Apps Script 설치·연동 확인
5. ~~Worker `ALLOWED_ORIGINS`~~ ✅ 설정됨 (2026-11-05: github.io·localhost 5173/4173 허용, 그 외 403 확인)
6. ~~Phase 4(NOTAM)~~ 배포 완료 (2026-11-10, e236b29) → **아이패드에서 실제 OFP로 확인**(`LOCAL_TEST.md` §10)
7. **Phase 5 아이패드 확인**: 배포됨(7ef2954). 구글드라이브에 묶음 5개(`private/manuals/out/*.efbman.json.gz`) 올리기 → 매뉴얼 가져오기·MEL·Manual·Alerts 확인(`LOCAL_TEST.md` §11·§12). FOM 근거 연결됨(D-048). 남은 것: minima·측풍 규칙(K-28, FOM 근거 + 공항별 자료)
8. NOTAM 후속(선택): 근거 문서 원문 대조(K-23), D) 시간표(K-22)

## 8. 세션 인계 (가장 최근 작업)

### 2026-11-27 (7) — 아이패드 요청 10개 중 바로 할 것 (D-105) (다음 세션은 여기서 시작)
- **요청 목록·상태·다음 순서**: `private/manuals/REQUESTS-2026-11-27.md` (1·2·3a·6 완료, 9·10 원고 초안 `private/manuals/BRIEF-SCRIPTS-2026-11-27.md`, 3b 자방위는 사용자 결정 대기, 4·5·7·8은 시안 먼저)
- **완료**: ETP 칸 잘림, 바람표 차이 표시(30°·30kt·5°), OFP 순항 기온 부호(파서 1.9 → 저장된 OFP 자동 재파싱), 공항 카드 ETD·ETA + 판정 시간대, Briefing 회사 기준 상자 삭제
- **테스트**: `npm test` 301/301(새: 바람 차이 1 + 실제 샘플 기온 부호 검사 추가), `tsc -b`, `npm run build` 통과. 개발 브라우저(실제 ofp-01을 지금 시각으로 옮겨 메모리만 + 회사 기준 임시, 확인 후 지움): 1단계 상자 없음·맨 아래 한 줄, 공항 카드 "ETD 07:46Z · 판정 시간대 06:46Z–08:46Z", 바람표 차이 표시(9월 샘플이라 오늘 예보와 차이 큼 — 35줄 표시), ETP 칸 1366·1024·375 잘림 0·넘침 0. **커밋·배포·아이패드 확인 전**
- **(추가) 3b 자방위 (D-106)**: 사용자 "자방위로 바꿔" → WMM2025로 자방위, 인천 34R 325T → **334M**(Jeppesen과 같음) 확인. 테스트 303/303, 빌드 통과, 375 넘침 0
- **배포 917c47b** (사용자 요청 "커밋·배포", GitHub Actions 성공, 사이트에 새 코드·aviator-1.9, `/private/` 404). **아이패드 확인 전**
- **(추가) 4·5 시안**: `private/design/2026-11-27-planview-mockup.html` — A 차선(고른 값마다 항로 옆 색 띠) · B 선 색 1개 + 기호(난류 지그재그·ISA ±10 꼬리표·기온 숫자) · C 지도는 깨끗이 + 아래 거리 띠(누르면 지도 위치). 공통 출처 = 자료 칩 한 줄(받은 지 얼마, 30분 넘으면 노랑) + "ⓘ 어떻게 계산했나" 접기. 칩 실제로 눌러 볼 수 있음, 1180·375 넘침 0
- **(추가) 사용자 "셋 다 별로" → v2 시안**: `private/design/2026-11-27-planview-mockup-v2.html` — D 문제만 말풍선(기준 넘는 구간만 글: 앞바람 40kt+·난류 중+·ISA ±10·기온 −60 이하, 시각 포함) · E 작은 지도 4장(값마다 한 장, 한 줄 요약, 누르면 크게) · F 구간 카드 + 지도(시간 순 목록, 누르면 지도 강조). 1180·375 넘침 0
- **(추가) v2도 "별로" → 사용자 답(질문 2개)**: 여러 값을 **한 지도에 동시에** · 거슬리는 것 = 지명 겹침 · 색 구분 안 됨 · 지도가 작고 빈 곳 많음
- **시안 H**: `private/design/2026-11-27-planview-mockup-H.html` — 실제 샘플 ofp-01 항로·OFP 바람 성분·기온·해안선. 값마다 다른 모양: 바람 = 선 색 · 난류 = 보라 후광 · ISA = 오른쪽 옆 띠(±3 넘을 때) · 기온 = 숫자 꼬리표. 지명 겹침 피하기(우선순위·글자 테두리), 항로에 맞춰 확대, SIGMET 빨간 점선·빗금, SR 주황 괄호 점선. 전체 + 난류 창 확대 2장. 1366 주간/야간 확인
- **H도 "다른거" → 사용자 기준 확정**: "한줄로. 웨이포인트 표시 명확히. 하나 선택하면 끝, SIGMET 중첩, SR OFP도 표시"
- **시안 I**: `private/design/2026-11-27-planview-mockup-I.html` — 항로 한 줄 = 고른 값 하나의 색(칩 라디오, 드롭다운 없음), 웨이포인트 = 흰 테두리 점 + 굵은 이름 + ETO·FL(겹치면 덜 중요한 것부터 숨김), FIR 경계 = 가로 막대 + FIR 이름, SIGMET 빨간 점선·빗금, SR 주황 괄호 점선, 점 누르면 값 한 줄. 1366 확인
- **구현 (D-107)**: 사용자 "e로 가자 … wpt 잘 표시, 시간도" → 플랜 뷰 = 값마다 작은 지도 4장(동서로 긴 항로는 위아래, 아니면 2×2), 누르면 크게, 웨이포인트 이름+ETO·FL 겹침 없이, 장마다 요약(시각), 출처 칩. 테스트 303/303, tsc, build 통과. 개발 브라우저: 실제 ofp-01(인천→LA, 위아래 4장·지명 18개씩)·YSSY→RKSI 샘플(2×2·11개씩)을 지금 시각으로 옮겨 메모리만, 실시간 예보로 확인 — 1366·1024·768·375 × 주간/야간 넘침 0, 난류 창은 난류 장부터 크게. 확인 후 바람 캐시·임시 서버·복사본 지움. **배포 eba10e7** (사용자 요청 "커밋·배포", GitHub Actions 성공, 사이트에 새 코드, `/private/` 404). **아이패드 확인 전**
- **(추가) 7 NOTAM 시안**: `private/design/2026-11-27-notam-mockup.html` (실제 ofp-01 NOTAM·시간창·항로·해안선) — 공통: 공항 머리에 기준 시각 칩(도착 ETA·교체 ALTN ETA·ETP 사용 시간대), NOTAM마다 문장("ETA 13:56Z에 유효" · "ETA 56분 전 13:00Z 종료 — ETA 땐 끝남" · "사용 시간대 중 09:30Z까지만"), **ERA 공항은 항로가 가장 가까울 때 ±1h**(예: RJAA 05:02Z ELDAK 139NM — 지금은 비행 전체). J1 시간 막대 · J2 문장만 + 지도 펼침 · J3 목록+지도 나란히. 지도 = 그 공항 사용 구간만 확대·시작/끝 시각. 1366·375 넘침 0
- **(추가) D-108 공항 역할별 시간창·ETP 담당 구간**: 사용자 질문(ETP·ERA 사용 시간 계산) → 설명 + KSFO 버그(3% ERA 창만 쓰고 ETP 창 버림) → 역할마다 창, ETP 담당 구간(이륙→ETP1 · ETP1→ETP2 · ETP2→도착), NOTAM ERA 목록 중복 창 제거. 테스트 305/305(새 2), tsc·build 통과. 개발 브라우저(실제 ofp-01 메모리만): 공항 카드 역할 줄, NOTAM KSFO 두 역할 판정 확인. NOTAM 시안도 역할별 줄·담당 구간 지도로 갱신. **c411a56로 배포**
- **(추가) D-109 시간창 FOM 근거**: 3% ERA = OFP ERA ETA ±1h(FOM 3% Contingency) — 샘플 KSFO 1210–1410Z(전에는 0849–1356 근사), 파서 1.10. 출발·순수 ERA는 "앱 기준" 표시. 테스트 305/305, tsc·build 통과. **c411a56로 배포**
- **NOTAM J3 v2 시안** (사용자: J3이 낫지만 그림이 별로 · 스킬 있나 → 항공 지도 스킬은 없음, 설치된 dataviz 스킬 절차): `private/design/2026-11-27-notam-j3-v2.html` — 역할 색 3개(파랑 ETP · 주황 3% ERA · 청록 도착·교체) validate_palette all-pairs 통과(야간·주간 바다색), 글자는 글자색 + 색 막대, 겹치는 역할 = 나란한 차선 + 바다색 틈, 끝점 테두리, 같은 지점 라벨 하나로, 공항 표시 경보색 아님, 구간 누르면 시각. 1366 야간·주간, 375 넘침 0
- **(추가) D-110 공항 순서 + Refile**: 순서 출발→도착→교체→3%/Refile→ETP→ERA (NOTAM 시안·브리핑 화면). 파서 1.11이 REFILE FLT PLAN(결정 지점·Refile 공항·교체·시간) 읽음 → Refile ETA ±1h(앱 기준). 시안 J3 v4(샘플 01·02 전환, `private/design/2026-11-27-notam-j3-v2.html`). 테스트 306/306, tsc·build 통과. **c411a56로 배포**
- **(추가) NOTAM 화면 J3 구현 (D-110)**: 공항 순서 출발→도착→교체→3%/Refile→ETP→ERA, FIR 맨 뒤 · 공항 머리에 역할 줄(색 막대·시각·판정 창·담당 구간/결정 지점·근거) · NOTAM마다 역할별 시간 문장("Refile ETA 0418Z에 유효", "3% ERA ETA 3시간 40분 전 0930Z 종료") · 공항 이름 누르면 그 공항 위에 담당 구간 지도(`notam/NotamMap.tsx`, 오프라인 육지·공항 좌표, 폭에 맞춰 글자 크기 고정). 육지 로더는 `lib/land.ts`로 분리(PlanView도 사용). 실제 샘플 01·02로 개발 브라우저 1180·768·375 × 주간/야간 확인, 가로 넘침 0, 콘솔 오류 0. 테스트 307/307, tsc·build 통과. **커밋 c411a56 · 배포 완료(2026-11-27), 아이패드 확인 전**
- 남은 점: 순수 ERA끼리는 OFP 순서(시안처럼 "항로에서 가장 가까운 지점 시각" 순은 아님) · 좁은 화면에서 공간이 없으면 끝점 라벨 일부 생략
- **다음**: 아이패드에서 NOTAM 화면 확인 (새 버전 받기 → OFP 다시 열 필요 없음, 파서 1.11 자동 재파싱), 그 다음 8 FIR 통신 화면

### 2026-11-27 (6) — 항로 스펙 대조 구현 (D-104, 시안 A+C)
- **완료**: Briefing 7단계 "Route Spec · 항로 스펙" 카드 = 항로 띠 + FIR × 스펙 표 + 근거 서랍. 파서 ATS FPL 저장(aviator-1.8 → 저장된 OFP 자동 재파싱). 비공개 요구 표 13줄·MEL 분류 7줄(`private/manuals/build-routespec.py` → company-rules.json). Jeppesen 쪽 코드 `JEPP-PACIFIC-158`로 바꾸고 JEPP 묶음 다시 만듦
- **테스트**: `npm test` 300/300(새 6개: FPL 해석·운영 시간·대조·실제 ofp-01 × 회사 표), `tsc -b`, `npm run build` 통과. 개발 브라우저(실제 ofp-01 메모리만 + 회사 기준·FOM·JEPP 묶음 임시로 넣고 확인 후 지움): 시안 숫자와 같음(✓11·⚠1·?3, RKRR CPDLC 시간 밖), 서랍 📖 FOM·Jeppesen 열림, 375·768·1180·1440 × 주간/야간 넘침 0, 띠 조각 44px, 데모(요구 표·FPL 없음)도 안내만 나오고 정상. **배포 40a6212** (사용자 요청 "커밋·배포", GitHub Actions 성공, 사이트에 새 코드·aviator-1.8, 회사 값 없음, `/private/` 404). **아이패드 확인 전**
- **아이패드에서 (배포 후)**: 새 `out/company-rules.json`(routeSpec 포함)과 다시 만든 `JEPP-PACIFIC.efbman.json.gz`·`JEPP-GENERAL.efbman.json.gz`를 가져오기 (Jeppesen 근거 📖가 열리려면). OFP는 자동 재파싱
- **미해결**: K-51 (기종 기본 능력·미국 국내·다른 노선 요구)

### 2026-11-27 (5) — 항로 스펙 검증 시안
- **사용자 요청**: 내 항로의 스펙(RVSM·PBN·CPDLC·PBCS)을 ATS FPL·MEL·FCOM과 대조해 검증
- **시안**: `private/design/2026-11-27-route-spec-mockup.html` (샘플 ofp-01 실제 FPL·MEL 값) — 공통 = ① 항로 요구(비공개 요구 표, FOM·Jeppesen 근거) × ② FPL Item 10·18 신고(자동 해석) × ③ 오늘 비행기(MEL 22·23·34 계통 → "확인 필요"까지만). **A** FIR×스펙 표 + 근거 서랍 · **B** 스펙별 체크리스트(요구→신고→MEL, Briefing 8단계) · **C** 항로 띠(시간 축). 아래에 비공개 요구 표 초안. 1180·375 확인, 넘침 0
- **자료 없음**: 기종 기본 능력(회사 OpSpec·FCOM), 미국 국내·항로별 RNAV 요구(Jeppesen US), RVSM FIR별 범위 확인
- **다음**: 사용자 시안 선택 → 새 D-번호로 결정 → 구현(FPL 코드 해석은 공개 코드, 요구 표·MEL 계통 연결은 company-rules.json 비공개)

### 2026-11-27 (4) — 업로드 대기 선택 지우기 · 기상 레이어 점검 · PIREP 고침 (D-103)
- **완료**: 업로드 대기 체크 상자·선택 지우기, PIREP bbox 소수 둘째 자리(실제 항로에서 HTTP 400이던 것), Mac 내장 중계 pirep·gairmet 허용
- **기상 레이어 점검 (개발 브라우저, 데모 + 실제 샘플 ofp-01을 시각만 지금으로 옮겨 메모리에만)**: Map SIGMET·바람·위성(GIBS 3장)·레이더(RainViewer 12조각)·G-AIRMET·열대저기압·우주기상 정상, Briefing 3단계·Map의 버티컬 뷰·플랜 뷰 그려짐(실제 항로 56지점 Open-Meteo 정상). 배포 Worker 직접 확인: metar·taf·isigmet·airsigmet·gairmet 200, pirep은 짧은 좌표면 200·긴 좌표면 400 → 고침 후 PIREP 28건·항로 150NM 목록 표시. Open-Meteo 60지점×34값 요청 2초·연속 3번 문제없음
- **확인 못 함**: 아이패드 Safari에서의 표시(배포 전), 시간 막대 재생
- **테스트**: `npm test` 294/294(새 1개), `tsc -b`, `npm run build` 통과. 375 주간 넘침 0. 시험 기록·바람 캐시·임시 서버·샘플 복사본 모두 지움. **배포 45a7814** (사용자 요청 "커밋·배포", GitHub Actions 성공, 사이트에 새 코드, `/private/` 404). **아이패드 확인 전**

### 2026-11-27 (3) — 지도·탭 겹침 · 가져오기 JSON · 업로드 대기 지우기 (D-102)
- **사용자 아이패드 상황**: 배포판(build 11-22)에서 md를 직접 가져와 **EAWM-GENERAL(908쪽)·EAWM-PACIFIC(1130쪽)** 이 들어감(옛 코드라 Jeppesen 인식 없음). fir-comm·_meta.json은 "매뉴얼 묶음 파일이 아님". 업로드 대기 30건(Ops 시험 기록)
- **완료**: 지도가 아래 탭을 덮지 않음, 매뉴얼 가져오기에서 FIR 통신표·목차 파일 받음, 업로드 대기 항목별·전부 지우기(discarded 상태)
- **테스트**: `npm test` 293/293(새 1개), `tsc -b`, `npm run build` 통과. 개발 브라우저: 768 Map에서 탭바 5곳 눌림(수정 끄면 왼쪽이 지도에 가려짐 확인), 375도 3곳 눌림, 업로드 대기 시험 3건 → 하나 지우기(3→2) → 전부(0, 상단 숫자 0) → 시험 기록 삭제, 가짜 md+목차+FIR 파일 한 번에 가져오기 → 3줄 ✓·쪽 제목 목차 경로 → 지움. 375 주간 넘침 0. **배포 b223fcf** (사용자 요청 "커밋·배포", GitHub Actions 성공, 사이트에 새 코드·지도 CSS 있음, `/private/` 404). **아이패드 확인 전**
- **아이패드에서 (배포 후)**: Settings에서 EAWM-GENERAL·EAWM-PACIFIC 삭제 → JEPP 묶음 2개(.efbman.json.gz) 가져오기(또는 md + _meta.json 같이 고르기), fir-comm-jeppesen.json도 같은 버튼으로 가능. 업로드 대기 30건은 "전부 지우기"

### 2026-11-27 (2) — Jeppesen Manual 묶음 (D-101)
- **완료**: 매뉴얼 변환기가 Jeppesen Airway Manual을 알아보고 PDF 쪽 단위로 나눔 → `private/manuals/out/JEPP-GENERAL.efbman.json.gz`(0.8 MB, 1,399쪽) · `JEPP-PACIFIC.efbman.json.gz`(1.8 MB, 2,712쪽). 쪽 제목·왼쪽 목차 = PDF 목차 경로. 파일 위치 바뀜: PDF → `private/manuals/inbox/`, md → `private/manuals/md/`, 목차 `*_meta.json` 자동 생성
- **변경 파일**: `src/features/manual/{parse.ts,lookup.ts,manual.test.ts}`, `tools/manual-convert/{pdf2md.py,build.ts}`, 문서 DECISIONS(D-101)·ARCHITECTURE. private: `jeppesen/build-fircomm.py`(md 경로)
- **테스트**: `npm test` 292/292(새 1개), `tsc -b`, `npm run build` 통과. 개발 브라우저: JEPP-PACIFIC 묶음을 임시 127.0.0.1 서버로 넣어 "RKDA" 검색 → p.1474·1475·1840(경로 표시), p.1475 본문(인천 CPDLC 절), 목차(편 › 지역 › 나라, 쪽 수), 375 주간 넘침 0 → 확인 후 묶음 지우고 서버 종료·복사본 삭제. **아이패드 확인 전**
- **한계**: 쪽 번호 줄이 없는 쪽(General 76·Pacific 126, 주로 그림·차트 쪽)은 앞 쪽에 합쳐짐. 그림만 있는 쪽(예: Pacific HF-Communications 지도, p.187 부근)은 글이 깨짐 — HF 주파수는 이 그림에 있음 → 필요하면 `npm run manuals -- --images`로 사진 묶음
- **아이패드에서**: JEPP 묶음 2개를 구글드라이브에 올려 Settings → 매뉴얼 → 가져오기 (기존 5개 묶음은 그대로라 다시 올릴 필요 없음)

### 2026-11-27 — Jeppesen Airway Manual md · FIR 통신표 파일
- **완료**: 사용자가 Jeppesen Airway Manual General(1,649쪽)·Pacific(2,841쪽) PDF를 md로 변환(pdf2md.py, 지금 위치 `private/manuals/md/`). Pacific의 "Data link services by FIR" 표(PDF 189~197쪽, 23행)와 한국(1475쪽)·일본(1452~1454쪽)·NOPAC/오클랜드 본문으로 **FIR 통신표 가져오기 파일** `private/manuals/out/fir-comm-jeppesen.json` 생성(efb-fir-comm v1, FIR 23곳). 만드는 스크립트 `private/manuals/jeppesen/build-fircomm.py`. 우리 노선(RKRR·RJJJ·KZAK·PAZA·PGZU)은 한국어 요약 + 원문, 나머지는 원문. 출처 칸 = 책·쪽, 입력일 = 책 발행일 2026-11-26
- **앱 코드 변경 없음** (기존 가져오기 형식 사용). 공개 저장소에 들어간 것 없음(전부 `/private`)
- **확인**: 앱 `parseFirCommImport`로 23곳 읽힘. 개발 브라우저: RJJJ 항목을 넣고 NAV LOG FIR 줄 → 창에 CPDLC·HF·위치보고·SATCOM·메모·출처 표시, 375 주간 넘침 0 → 시험 값 지움. **아이패드 가져오기 전**
- **빠진 것**: 미국 국내 FIR(KZOA·KZLA·KZSE)은 이 두 책에 없음(Jeppesen US 책 필요). HF 주파수는 Jeppesen 본문에 FIR별로 거의 없음(엔루트 차트에 있음) — 오클랜드·도쿄는 "무선국에서 배정받음"만. 인천 FIR CPDLC는 1500–1859 UTC만 운영. General md는 아직 안 씀(ICAO 공통 절차)
- **아이패드에서**: `fir-comm-jeppesen.json`을 구글드라이브에 올림 → Briefing FIR·통신 카드 → 통신표 가져오기
- **다음**: 아이패드 확인, 필요하면 Jeppesen md를 Manual 탭 검색용 묶음으로 넣기, HF 주파수는 차트 자료가 오면 추가

### 2026-11-22 (7) — SD 가이드 ECAM 화면 · ETP 카드 정리 (D-100) (다음 세션은 여기서 시작)
- **완료**: 시안 SD-B·ETP-A 선택 → SD 가이드 ECAM 색 화면(한계는 회사 기준 파일 sdGuide), ETP 숫자 칸·Driftdown 표 삭제
- **아이패드에서**: 새 `private/manuals/out/company-rules.json`(sdGuide 포함)을 구글드라이브에 올려 Settings → 매뉴얼 → 가져오기 해야 SD 화면이 나옴(FCOM 묶음도 있어야 원문·📖)
- **테스트**: `npm test` 291/291, `tsc -b`, `npm run build` 통과. 개발 브라우저(새 회사 기준 파일·FCOM 묶음을 임시 127.0.0.1 서버로 넣음, 샘플 ofp-11은 메모리만, 서버 종료·복사본 삭제): ENG 2판 8줄·ELEC 3판·HYD·FUEL·DOOR 표시, OIL PSI 누르면 FCOM 원문 4줄 AMBER/RED, HYD PSI 누르면 "확인 필요"·📖, ETP1·ETP2 숫자 칸·DRIFTDOWN W 칸, 375 × 주간/야간 넘침 0. **배포 66968d6** (GitHub Actions 성공, 사이트에 새 코드, `/private/`·회사 기준 파일 404). **아이패드 확인 전**
- **주의**: 개발 브라우저 저장소가 한 번 비어 있었음(매뉴얼·회사 기준 없음) → 이번에 회사 기준 파일·FCOM을 다시 넣음(Mac 안)
- **다음**: 아이패드에 새 company-rules.json 가져오기 → SD·ETP 확인, chk 값 색 확정(FCOM 원본 그림)

### 2026-11-22 (6) — D-092~D-099 push·배포
- **배포**: 사용자 요청("push·배포"). push 전 검사: private·PDF·매뉴얼 묶음 없음, 회사 편명·등록번호·이름 없음. d95a877·f7835c5 push → GitHub Actions 성공. 배포 사이트: 새 코드(레이더·SD 가이드·OFP PDF 탭·권계면) 있음, `/private/`·샘플 PDF 404(첫 확인 한 번 503 → 다시 404)
- **아이패드에서 할 일**: ① 앱 새로고침(사이드바 BUILD 시각 11/22 확인, 안 바뀌면 Settings → 앱 파일 새로 받기) ② FCOM 묶음이 기기에 있어야 SD 가이드가 나옴 ③ 확인: 탭 순서·OFP PDF 탭, NAV LOG(줄 색·머리글 뜻·SR 칸·FIR 줄 창), Weather 원문 줄바꿈·STD/ETA, ERA 예상 사용 시간·실제 출발 칸(앱 키보드), NOTAM 시간창·약어, Hourly 표·SD 가이드, Manual 왼쪽 목차, Briefing 9단계, Map 레이더 재생·SIGMET 글자, 버티컬 겹치기·권계면
- **다음**: 아이패드 확인 결과 반영, 묶음 4 Ops(사용자 설명 대기), FIR 통신표(Jeppesen 자료), PA 책자
- **(추가 2026-11-22)** 사용자 요청: SD 가이드를 SD 페이지처럼 그림으로, EDTO·ETP 카드 가독성·Driftdown 표 삭제 → 시안 `private/design/2026-11-22-sd-etp-mockup.html` (SD-A 눈금 막대 · SD-B ECAM 화면 모양 · SD-C 색 표 / ETP-A 숫자 칸 · ETP-B 한 표 · ETP-C 항로 띠). **→ SD-B · ETP-A 선택, D-100으로 반영**

### 2026-11-22 (5) — 커밋 d95a877 · 묶음 5~8 (D-096~D-099)
- **사용자 요청**: "커밋하고 싹다 진행" → D-092~D-095 커밋 d95a877(push 안 함), 묶음 4(Ops)는 보류, 5~8 진행
- **완료**: D-096 Hourly SD 가이드(FCOM 조건 문장 원문·앱 분류·📖) · D-097 Manual 책장·검색 범위 2개·PDF Expert식 목차 · D-098 Briefing 9단계(이전/다음·전체 보기) · D-099 Map 레이더(RainViewer, 시간 막대 재생)·SIGMET 진하게+글자·기압면 800/100 추가·권계면·버티컬 겹치기·플랜 뷰 겹쳐 보기
- **테스트**: `npm test` 291/291(새: sdGuide 3·radar 1·기타), `tsc -b`, `npm run build` 통과. 개발 브라우저: SD 가이드(ELEC 16블록·부제 구분), Manual 1180 왼쪽 목차·375 옆 목차·목차 찾기, Briefing 9단계 실제 샘플(ofp-06 메모리만, 임시 서버 종료·삭제), 레이더 13개 영상·시간 막대로 −2h10m~−50m 영상 바뀜, SIGMET 글자 162개, 기상 다시 받기 후 권계면 선·빗금 겹치기. 375·768·1440 × 야간/주간 가로 스크롤 0. **아이패드 확인 전**
- **주의**: 개발 브라우저 IndexedDB에 FOM·FCOM 묶음 있음(Mac 안). 레이더는 외부(RainViewer)로 요청 — 개인정보 없음
- **미해결**: K-50(SD 색·권계면 근사·레이더 범위·WAFS 없음), 묶음 4 Ops 보류(사용자 설명 대기), FIR 통신표 내용(Jeppesen 자료 필요), PA 원문(기장 방송용 책자)
- **다음**: 사용자 확인 → push·배포(요청 시) → 아이패드 확인

### 2026-11-22 (4) — 묶음 3: 난류 창 단면 · FIR 통신 창 (D-095)
- **완료**: 난류 SR 창 = 플랜 뷰 + 그 구간 확대 버티컬 뷰, NAV LOG FIR 줄 → FIR 통신 창(통신표·편집·FOM 데이터링크 절·FIR 별 절차)
- **테스트**: `npm test` 287/287, `tsc -b`, `npm run build` 통과. 개발 브라우저: FIR 창 → FOM FIR 별 절차 쪽이 그 FIR 이름 강조로 열림 → 닫으면 FIR 창 그대로, 통신표 편집 저장(시험 값은 지움). 샘플 ofp-11을 메모리에만 넣어(임시 127.0.0.1 서버, 확인 후 종료·삭제·새로고침) SR 칸 18개 → 창에 지도+단면(19–195/4596 NM), **CRZ WIND FL260→FL400 순서 확인(D-092 미확인분)**. 1440·375 × 야간/주간 넘침 0. **아이패드 확인 전**
- **주의**: 개발 브라우저 IndexedDB에 FOM 묶음(GEN-FOM)을 넣었음(Mac 안)
- **다음**: 묶음 4 Ops — 시안 3개 만듦 `private/design/2026-11-22-ops-mockup.html` (A 지금 모양+편집 · B 출두→푸시백 시간선+왼쪽 목록/오른쪽 내용 · C 타일+아래 창+PA md). **보류 (2026-11-22 사용자: "건너뛰고 나중에 자세히 다시 이야기") — 시안 파일은 참고로 남김**. 정상 절차 추천 그룹 PALMC(출두)·OWN-EPRT(브리핑, FCRM 6.7.4) 제안. PA 문안 원본(회사 "기장 방송용 책자") 필요

### 2026-11-22 (3) — 묶음 2: ETP·EDTO 교체공항 예상 사용 시간 (D-094)
- **완료**: FOM 계산식으로 ERA별 예상 착륙·운항 시간대(±1h), 실제 출발 시각 칸(STD 대비 옮김), Briefing·NOTAM 시간창도 같은 값, OFP EDTO "HHMMZ" 시각 읽기 버그 수정
- **테스트**: `npm test` 287/287(새 3개), `tsc -b`, `npm run build` 통과. 실제 샘플 ofp-01(A388 ETP 계산)·ofp-12(B78X SUITABLE FROM~TO) 값 확인. 개발 브라우저(데모): 표·실제 출발 1130 → +0:30 이동·지우기, 1440·375 × 야간/주간 넘침 0, Briefing 정상. **아이패드(앱 키보드로 시각 입력) 확인 전**
- **다음**: 묶음 3 난류 창 버티컬 뷰 + FIR 줄 → 통신 창 (`private/manuals/REQUESTS-2026-11-22.md`)

### 2026-11-22 (2) — 묶음 1: NOTAM 시간창·약어 풀이 (D-093)
- **완료**: 공항별 시간창(Briefing과 같은 계산), NOTAM마다 시간창 관계 한 줄, 본문 약어 풀이(접힘)
- **테스트**: `npm test` 284/284(새 2개), `tsc -b`, `npm run build` 통과. 실제 샘플 ofp-01·06으로 계산 확인. 개발 브라우저: 샘플 ofp-06을 임시 127.0.0.1 서버로 메모리에만 넣어(기기 저장 안 함, 확인 후 서버 종료·복사본 삭제·새로고침) NOTAM 310건 — 1440·375 × 야간/주간 가로 스크롤 0·카드 넘침 0. **아이패드 확인 전**
- **다음**: 묶음 2 ETP 공항 예상 사용 시간 (`private/manuals/REQUESTS-2026-11-22.md`)

### 2026-11-22 — 사용자 요청 25개 중 바로 할 것 (D-092) · 나머지 묶음 정리
- **완료**: 탭 순서(…Manual · OFP PDF · Settings), OFP PDF 탭 분리, REFILE이면 5% 생략, NAV LOG(원문 이동 없음·ATO 삭제·줄 색·머리글 뜻·SR 칸 → 난류 창), CRZ WIND 낮은 FL 왼쪽, METAR/TAF 원문 줄바꿈·공항 옆 STD/ETA·교체 회항 ETA, Inflight 통과 기록·연료 그래프·Waypoint log 삭제, Hourly 연료 맨 끝·기록 표
- **남은 요청 묶음·질문 답**: `private/manuals/REQUESTS-2026-11-22.md` (추천 순서 1 NOTAM 시간 겹침 → 2 ETP 공항 사용 시간 → 3 난류 창 버티컬·FIR 통신 창 → 4 Ops PA·상황카드 편집·사건 기록·정상절차 → 5 SD 가이드 → 6 Manual 목차 → 7 Briefing 새로 → 8 기상 확장). 화면 큰 변경은 시안 3개 먼저
- **변경 파일**: D-092 "영향" 참고
- **테스트**: `npm test` 282/282(줄바꿈 2개 추가, 계획 방식 기대값 4곳 새 규칙으로), `tsc -b`, `npm run build` 통과. 개발 브라우저(데모 비행): 탭 순서·OFP 하위 탭 3개·NAV LOG 머리글 16개(ATO 없음)·SR 뜻·줄 색·FIR 줄 4개, Weather 줄바꿈·STD/ETA/회항 ETA, OFP PDF 탭, Hourly 칸 순서. 375 × 야간/주간·1440 가로 스크롤 0. **확인 못 함**: CRZ WIND(데모에 없음 — 실제 OFP 필요), 난류 SR 칸(데모에 구간 없음), Hourly 기록 표(기록 넣어 보지 않음), 768·1180, 아이패드
- **다음**: 사용자 확인 → 커밋·배포(요청 시) → 묶음 1부터

### 2026-11-16 — D-061~D-076 커밋·배포
- **배포**: 사용자 요청("마무리하고 커밋 배포"). 커밋 전 검사: private·PDF·.efbimg 없음, 공개 문서·테스트의 실제 샘플 값(지점 이름·OFP 번호·FOM 절 번호·MEL 번호·승객 수)을 일반 표현·가짜 예시로 바꿈(원래 문서는 `private/manuals/notes-2026-11-16/`에 보존). 테스트 242/242·tsc·build 통과. 2344513 push → GitHub Actions 성공. 배포 사이트: 새 코드 있음, `/private/` 404, 회사 이름·편명·등록번호 없음(이전부터 있던 연료 얼러트 FOM 코드만)
- **아이패드에서 할 일**: ① 새로고침 1~2회(K-09) — DB가 v4로 올라감(기존 자료 유지) ② 구글드라이브에 `private/manuals/out/company-rules.json`(우주기상 근거 추가)과 필요한 `.efbimg` 사진 묶음 올리기 → Settings → 매뉴얼 → 가져오기 ③ `LOCAL_TEST.md` §16~§21 확인 ④ Cloudflare Worker 재배포(K-35, PIREP·G-AIRMET)
- **다음 후보**: 아이패드 확인 결과 반영, MSA 열 좁은 화면 표시(K-43), Map 탭 외 시간 슬라이더 개선

### 2026-11-16 (7) — NAV LOG 숫자 색 (D-075) · 매뉴얼 쪽 사진 묶음 (D-076)
- **완료**: NAV LOG 줄 색 제거, SR 숫자 등급 색·굵게(구간은 이름 왼쪽 선), MSA 100 이상만 굵게·진한 주황. 매뉴얼: Mac `npm run manuals -- --images` → 그림·표 쪽만 JPEG 사진 묶음 `.efbimg`(매뉴얼별, 40MB 부분 나눔), 앱 가져오기·"🖼 원본 쪽 사진" 보기, DB v4
- **변경 파일**: `ofp/doc/NavLog.tsx`, `tools/manual-convert/{pdf2img.py(신규),build.ts}`, `db/schema.ts`(v4), `manual/{store.ts,ManualCard.tsx,PageImages.tsx(신규),ManualInline.tsx,ManualPage.tsx}`, `app/styles.css`, 문서(DECISIONS D-075·076, ARCHITECTURE §3.7o, KNOWN_ISSUES K-29, LOCAL_TEST §21)
- **사진 묶음 결과** (`npm run manuals -- --images`, 약 5분): CDL 488/488쪽 연결·사진 220쪽 9.5MB · FCOM 6938/6938·3805쪽 198.7MB(5개 파일) · FCTM 478/478·137쪽 8.2MB · MEL 2088/2088·39쪽 2.6MB. FOM(+FCRM)은 원본 PDF 받은 뒤 2026-11-17 생성(`GEN-FOM-img.efbimg`, 쪽 연결 거의 전부)
- **테스트**: `npm test` 242/242, `tsc -b`, `npm run build` 통과.  CDL 사진 묶음 220쪽 9.5MB → 개발 브라우저 가져오기 → Manual 탭 CDL 그림 쪽(글이 깨진 쪽)에서 원본 사진 표시 확인. 개발 브라우저 DB v3→v4 올라가며 기존 자료 유지. 샘플 OFP로 NAV LOG 숫자 색 확인 후 삭제. 사진 묶음 가져오기 자동 테스트는 없음(IndexedDB 필요). **아이패드 확인 전**
- **주의**: 개발 브라우저 IndexedDB에 CDL 쪽 사진이 들어 있음(Mac 안). 사진에는 회사 표지 글이 찍혀 있음 → `.efbimg`도 private·구글드라이브에만
- **다음**: 사용자 확인(`LOCAL_TEST.md` §21) → 커밋·배포(요청 시)

### 2026-11-16 (6) — NAV LOG 표시 정리 · AGTOW 모양 (D-074)
- **완료**: TOC▲·TOD▼·ETP◆ 이름 앞 표시(줄 색 제거), 난류 SR 구간 줄 전체 색, MSA 고도별 진하기(59→16%, 100→29%, 164→49%), AGTOW 두 줄 모양(3단 좁은 카드에서도 줄바꿈 없음)
- **변경 파일**: `ofp/doc/{NavLog,OfpDocument}.tsx`, `app/styles.css`, 문서(DECISIONS D-074)
- **테스트**: `npm test` 242/242, `tsc -b`, `npm run build` 통과. 개발 브라우저(샘플 ofp-11, 확인 후 삭제): 1440·375 × 주간/야간 OFP·NAV LOG 카드 넘침 0·가로 스크롤 0. MSA 열은 여전히 1280px 이상에서만(K-43). **아이패드 확인 전**
- **다음**: 사용자 확인 → 커밋·배포(요청 시). 매뉴얼 그림·표 쪽 사진(K-29)은 사용자 결정 대기

### 2026-11-16 (5) — 창·돌아가기 공통 · WEIGHTS 정리 · 전체 깨짐 점검 (D-073)
- **완료**: EDTO(34px)·ALTERNATES(7px) 넘침 수정(표 머리글 줄바꿈·여백·표 안 스크롤), 전 탭 375·768·1180·1440 × 주간/야간 점검(카드 밖 넘침 0, 페이지 가로 스크롤 0). WEIGHTS: 좌석 등급·TOTAL PAX 맨 위, PAX·CARGO·기타 = PAYLOAD를 LDW 아래, AGTOW 3열 표. 난류 구간 → 창(확대 플랜 뷰·지점 표) → Map 크게 보기 → 돌아가기(창 다시 열림, 스크롤 같음). OFP MEL/CDL 줄 → 매뉴얼 창. 돌아가기를 앱 공통(`app/returnTo.ts`)으로, Manual도 옮김. 플랜 뷰 SIGMET 가로 띠 버그 수정
- **변경 파일**: `app/{returnTo.ts(신규),App.tsx,styles.css}`, `manual/{lookup.ts,ManualPage.tsx}`, `ofp/doc/{TurbPopup.tsx(신규),OfpDocument.tsx,Turbulence.tsx}`, `ofp/turbulence.ts`, `vertical/PlanView.tsx`, 문서(DECISIONS D-073, ARCHITECTURE §3.7n, LOCAL_TEST §20)
- **테스트**: `npm test` 242/242, `tsc -b`, `npm run build` 통과. 개발 브라우저(샘플 ofp-11, 임시 127.0.0.1 서버, 확인 후 삭제·데모로 되돌림): 위 흐름 모두 확인, 돌아가기 스크롤 1201→1201·958.5→958.5. **아이패드 확인 전**
- **다음**: 사용자 확인(`LOCAL_TEST.md` §16~§20) → 커밋·배포(요청 시)

### 2026-11-16 (4) — AGTOW · SR 지도 · 우주기상 · 맨 위 기상/저장 버튼 · MSA (D-068~D-072)
- **완료**: WEIGHTS 아래 AGTOW 계산 줄(가장 낮은 값 강조, 샘플 10개 OFP 값과 일치) · 난류 SR 구간 Map 레이어·버티컬 뷰 띠·누르면 Map 이동 · 우주기상 칸 잘림 해결·등급 설명·FOM 근거 3곳(📖 펼치기)·카드 갱신 버튼 제거(맨 위·주기 갱신에 포함) · 맨 위 ⟳ 기상·⤓ 저장·OUTBOX 같은 모양 · NAV LOG MSA ≥ 100 주황
- **변경 파일**: `ofp/{agtow.ts,agtow.test.ts}`(신규), `ofp/doc/{OfpDocument,Turbulence,NavLog}.tsx`, `ofp/turbulence.ts`, `map/MapPage.tsx`, `vertical/VerticalView.tsx`, `weather/{actions.ts(신규),ExtraCard.tsx,ui.tsx,store.ts}`, `manual/RefList.tsx`(신규), `ops/OpsPage.tsx`, `brief/rules.ts`, `app/{StatusBar.tsx,styles.css}`, `ofp/OfpOpenButton.tsx`, 문서(DECISIONS D-068~072, ARCHITECTURE §3.7m, KNOWN_ISSUES K-42·43, LOCAL_TEST §19). private: `build-ops.py`(우주기상 근거), `company-rules.json`·`out/company-rules.json`(refs.spaceWeather 추가, 이전 파일은 세션 임시 폴더에 백업)
- **테스트**: `npm test` 242/242, `tsc -b`, `npm run build` 통과. 개발 브라우저(샘플 ofp-11 + 새 회사 기준 파일을 임시 127.0.0.1 서버로, 확인 후 OFP·비행 삭제): ⟳ 기상 → "기상 갱신 완료", ⤓ 저장 → 위성 진행 → "오프라인 저장 완료 7.5 MB", SR 구간 지도 4개·버티컬 띠 4개·목록 누르면 팝업(SR HIGH 구간·이륙 후 시간), 우주기상 FOM 근거 펼침, MSA 164 강조, 375·768·1024·1440 × 주간/야간 가로 스크롤·상태 줄 넘침 0. 작업 중 CSS 일부(SR·우주기상)를 실수로 지웠다가 복구함. **아이패드 확인 전**
- **주의**: 개발 브라우저 IndexedDB에 새 회사 기준 파일·위성 저장본이 있음(Mac 안)
- **다음**: 사용자 확인(`LOCAL_TEST.md` §16~§19) → 커밋·배포(요청 시) → 아이패드에 새 company-rules.json 가져오기 → Worker 재배포(K-35). 매뉴얼 그림·표 개선(K-29) 방법 결정

### 2026-11-16 (3) — 항로·OFP 번호 일치 확인 · 난류 이륙 후 시간 (D-067)
- **완료**: 파서 1.4 — OFP 안 항로 6곳 안팎(CFP 요약 항로 ×2, OFP FPL ×2, 제출된 ATS FPL 사본, NAV LOG)과 OFP 번호 5곳(CFP PLAN ×2, PLAN #, REQUEST NO. ×2) 비교 → FLIGHT 카드에 "✓ 이 OFP의 ROUTE n곳 모두 같음 · ✓ OFP NO. n곳 같음"(펼치면 곳별·원문 줄). 난류 카드 잘림 → 두 줄 목록 + T/O +h:mm 누적 시간·구간 길이, Dashboard·Briefing 문구에도
- **변경 파일**: `ofp/parser/{routeCheck.ts,routeCheck.test.ts}`(신규), `ofp/parser/index.ts`(버전 1.4), `ofp/types.ts`, `ofp/doc/{OfpDocument,Turbulence}.tsx`, `ofp/OfpPage.tsx`, `dashboard/DashboardPage.tsx`, `brief/cards.ts`, `app/styles.css`, 문서(DECISIONS D-067, ARCHITECTURE §3.7l, LOCAL_TEST §18)
- **테스트**: `npm test` 230/230(실제 샘플 10개 전부 항로·번호 일치 + 제출 FPL 항로를 일부러 바꾸면 잡아냄), `tsc -b`, `npm run build` 통과. 개발 브라우저에 샘플 ofp-11을 임시 127.0.0.1 서버로 넣어 확인(ROUTE 6곳·OFP 번호 5곳 일치, 난류 4구간 이륙 후 시간) → 확인 후 시험 OFP·비행 삭제, 데모 비행으로 되돌림. 375·768·1180·1440 × 주간/야간 가로 스크롤 0. 샘플 PDF→텍스트 재생성은 추출기 변경이 없어 하지 않음. **아이패드 확인 전**
- **다음**: 사용자 확인(`LOCAL_TEST.md` §16~§18) → 커밋·배포(요청 시) → Worker 재배포(K-35)

### 2026-11-16 (2) — Map 시간 재생·기상 모음 (D-065) · Manual 돌아가기 (D-066)
- **사용자 요청**: Mac에서 본 뒤 "맵 기상 재생·움직이기 + 밑에 버티컬 뷰, ATIS·TAF 빼곤 기상은 다 Map 탭으로", "크게 보기로 간 뒤 돌아가기 버튼", "company-rules.json을 앱 안에 합치면 안 되나(보안)" → 합치지 않음(아래)
- **완료**: Map 시간 막대(지난 위성 −3h~ + 예보 시각, ▶ 재생, 지금 ±h·m 표시), GIBS 시각별 위성(저장·12시간 뒤 삭제), 바람·SIGMET·G-AIRMET 시각 필터, ✈ 예상 위치. 지도 아래 버티컬·플랜 뷰·SIGMET·바람 표·기상 추가, Weather 탭은 공항 METAR·TAF. Manual "← (탭)(으)로 돌아가기"(스크롤·펼침·창 복원). Map 탭을 떠날 때 Leaflet 오류(확대 중) 수정
- **company-rules.json 합치기 안 함**: 앱 코드는 공개 GitHub 저장소·공개 사이트라 넣으면 누구나 내려받을 수 있음(D-049 유지). 지금처럼 한 번 가져오면 아이패드 IndexedDB에 남음
- **변경 파일**: `map/{MapPage,satellite}`, `vertical/{TimeBar,useWxPick,VerticalView,wxTime,wxTime.test}`, `weather/WeatherPage`, `manual/{lookup,ManualPage,ManualInline,MelPage}`, `ops/OpsPage`, `app/styles.css`, 문서(DECISIONS D-065·066, ARCHITECTURE §3.7k, KNOWN_ISSUES K-41, LOCAL_TEST §17)
- **테스트**: `npm test` 214/214, `tsc -b`, `npm run build` 통과. 개발 브라우저: Map 시각 −2h → 위성 1000Z 영상(GIBS 응답 시각 1000Z 확인)·재생으로 −2h→+1h 진행, 시간 범위 −3h~+11h, 지도 아래 카드 5개. MEL 펼침 → 크게 보기 → 돌아가기 = 같은 스크롤(742)·펼침 유지, Briefing 창 → 크게 보기 → 돌아가기 = 같은 스크롤·창 다시 열림. 375·768·1180·1440 × 주간/야간 가로 스크롤 0. **실제 OFP·아이패드·오프라인 재생은 확인 안 함**
- **다음**: 사용자 확인(`LOCAL_TEST.md` §16·§17) → 커밋·배포(요청 시) → Worker 재배포(K-35)

### 2026-11-16 — OFP 버튼 한 곳 · 매뉴얼 그 자리에서 · 기상 시간대·플랜 뷰·난류 지수 (D-061~D-064)
- **완료**: 1) OFP 열기 = 맨 위 상태 줄 하나(다른 곳은 안내 글, 아이폰 폭 "OFP") 2) 매뉴얼 그 자리에서: MEL 항목·Ops 📖 근거는 카드 안 펼치기/접기, 얼러트·Briefing 📖는 화면 위 창(닫으면 제자리) 3) Open-Meteo 시간대별 저장(최대 48h) + 시각 선택(지점 통과 시각 ↔ 시각 고정·슬라이더·재생, "지금 ±h") 4) 버티컬 뷰 바탕 선택(앞/뒷바람·ISA·난류 지수·기온 경도·기온 변화 3h) + PIREP·EDR 겹치기 + 선택 시각 위치 선 5) 플랜 뷰(항로 색·바람 화살표·SIGMET·PIREP, 오프라인 육지)
- **변경 파일**: `app/{App,StatusBar,styles}`, `ofp/{OfpOpenButton,OfpPage,RawPdfView}`, `dashboard/DashboardPage`, `notam/NotamPage`, `inflight/InflightPage`, `manual/{ManualInline(신규),lookup,MelPage}`, `alerts/AlertsCard`, `ops/OpsPage`, `weather/{api,types,WeatherPage}`, `vertical/{profile,VerticalView}` + 신규 `vertical/{wxTime,wxTime.test,useWxPick,TimeBar,PlanView}`. 문서: DECISIONS D-061~064, ARCHITECTURE §3.7h·3.7j, KNOWN_ISSUES K-38·K-39·K-40, LOCAL_TEST §16
- **테스트**: `npm test` 212/212, `tsc -b`, `npm run build` 통과. 개발 브라우저(데모 비행 + 기기 안에 A380 MEL·CDL·FOM·회사 기준을 임시 127.0.0.1 서버로 넣음, 확인 후 서버 종료): 상태 줄 버튼, MEL·CDL 카드 안 펼침, Ops 상황 카드 📖 FOM 근거 펼침(탭 그대로), Briefing 📖 창 → 닫으면 스크롤 위치 같음, Weather 갱신 → 시간 범위 지금 −6h~+12h·슬라이더 +7h·난류 지수 칸·플랜 뷰(육지·바람 화살표 12개). 375·768·1180·1440 × 주간/야간 가로 스크롤 0, 375 상태 줄 넘침 0. **실제 OFP·아이패드로는 확인 안 함. PIREP는 Worker 재배포 전이라 404(K-35) → PIREP·EDR 표시는 자동 테스트로만 확인.** 데모 비행은 지난 날짜라 "지점 통과 시각"은 지금 기준으로 대신 표시됨(실제 비행 전날 OFP로 확인 필요)
- **주의**: 개발 브라우저 IndexedDB에 매뉴얼 묶음·회사 기준 파일이 들어 있음(Mac 안). 빠르게 탭을 바꾸면 Map 탭에서 Leaflet 콘솔 오류가 날 수 있음(이번 변경과 무관, 자동 탭 전환 중에만 봄)
- **미해결**: K-39 난류 지수 기준 임시, K-40 플랜 뷰 항로 선만, Map 탭 시간 슬라이더 없음. 커밋 안 함
- **다음**: 사용자 확인(`LOCAL_TEST.md` §16) → 커밋·배포(요청 시) → Worker 재배포(K-35)

### 2026-11-12 — 추가 기능 커밋·배포
- **배포**: 사용자 요청("확인 후 커밋·배포"). 커밋 전 검사: private·PDF 없음, 항공사명·편명·등록번호·FOM 절 코드 새로 넣은 것 없음, 테스트 198/198. fe06c57 push → GitHub Actions 성공. 배포 사이트: 새 코드 있음, `geo/firs.json` 200, `/private/` 404, 회사 파일 내용 없음(이전부터 있던 연료 얼러트 FOM 코드만)
- **다음**: ① Cloudflare Worker에 새 `worker/wx-proxy.js` 붙여넣고 Deploy(K-35) ② 아이패드 새로고침(1~2회) → `out/company-rules.json` 다시 가져오기 → `LOCAL_TEST.md` §14·§15

### 2026-11-12 — 추가 기능 목록 2~8 (D-056~D-060, 사용자: "다 진행")
- **완료**: Ops 탭(상황 카드 35개 = 회사 파일 `ops` → FOM 원문 보기, 사건 버튼, 의료 지원 정보 양식(메모리만), Tarmac 타이머, PA 문안·빈칸 채우기, 연락처, 보고서 초안), 진행 중 타이머(Inflight), 버티컬 뷰(Weather), FIR 경계 지도(VATSpy CC BY-SA, 비공식 표시), 기상 추가(우주기상 SWPC·열대저기압 GDACS·PIREP·G-AIRMET + 지도 레이어), 통신표 AIRAC 경과 경고, 자료 출처·공식 여부 표시(D-057)
- **변경 파일**: `src/features/ops/*`·`vertical/*`·`weather/{extra.ts,ExtraCard.tsx}`·`lib/airac.ts`(신규), `brief/rules.ts`, `weather/{api,decode,types,route,WeatherPage}`, `map/MapPage.tsx`, `fir/FirCommSection.tsx`, `inflight/InflightPage.tsx`, `app/{tabs,App,styles}`, `worker/wx-proxy.{js,test.ts}`, `tools/build-firs.ts`·`public/geo/firs.json`(신규), 문서(DECISIONS D-056~060, ARCHITECTURE §3.7g~i, LOCAL_TEST §15, KNOWN_ISSUES K-35~38, CLOUDFLARE_WORKER). private: `company-rules.json`(`ops` 추가, 백업은 세션 임시 폴더), `build-ops.py`(신규), `out/company-rules.json`
- **테스트**: `npm test` 198/198, `tsc -b`, `npm run build` 통과. 개발 브라우저: 회사 파일·FOM 넣고(임시 127.0.0.1 서버, 5분 뒤 자동 종료) Ops 카드 35개·FOM 원문 펼치기·사건 기록·타이머 확인, 버티컬 뷰 108칸·0°C선, 지도 FIR·새 단추, 우주기상·GDACS 받기 성공, 375·768·1180 × 주간/야간 가로 스크롤 0. 시험 사건 기록 2개·타이머는 확인 후 삭제(동기화 주소 없음 — 외부 전송 없음). **PIREP는 Worker 재배포 전이라 404(예상), 1440·아이패드·실제 OFP로 Ops·버티컬 확인 안 함**
- **미해결**: K-35 Worker 재배포, K-36~38. PA 기본 문안 없음(회사 예문집 필요). 커밋 안 함
- **다음**: 사용자 확인(`LOCAL_TEST.md` §14·§15) → Worker 재배포 → 커밋·배포(요청 시)

### 2026-11-12 — 추가 기능 목록 정리 + FIR 통신 카드 (D-055)
- **완료**: 1) 추가 기능 후보 목록(정상운항·비정상 상황 카드·FIR 통신·버티컬 뷰·FIR 경계 지도·기상 확장·보고) 정리 → 비공개 `private/manuals/NEXT-ITEMS.md`(FOM 절 번호 포함), 공개 요약 `PROJECT_SPEC.md` §8. 무료 자료 조사: FIR 경계 = VATSpy(비공식, CC BY-SA 추정)·ICAO GIS(조회만), 통신 주파수 무료 API 없음, 기상 = Open-Meteo 기압면·AWC PIREP·NOAA SWPC 등, WAFS 격자는 WIFS 승인 필요 2) **FIR 통신 카드**: OFP FIR 순서·진입 시각(실제/수정) + 개인 통신표(기기 안, 내보내기/가져오기) — Briefing 전체, Inflight 지금·다음, 진입 10분 전 점검 알림. 데모 OFP에 FIR 진입 표시 추가
- **변경 파일**: `src/features/fir/{sequence.ts,commTable.ts,FirCommSection.tsx,fir.test.ts}`(신규), `src/features/inflight/{InflightPage.tsx,reminders.ts}`, `src/features/brief/BriefPage.tsx`, `src/mock/demoOfp.ts`, `src/app/styles.css`, 문서(DECISIONS D-055, PROJECT_SPEC §8, ARCHITECTURE §3.7f, LOCAL_TEST §14). private: `NEXT-ITEMS.md`
- **테스트**: `npm test` 182/182 (FIR 15개: 가짜 OFP + 실제 샘플 10개 FIR 순서가 PACKAGE 3 목록과 일치, 재진입 KZAK→PGZU→KZAK 확인), `tsc -b`, `npm run build` 통과. 개발 브라우저(데모 비행): Briefing FIR 4개 표시, 편집 → 저장 → 카드 표시(시험 값, 확인 후 삭제), Inflight 지금 FIR + 전체 보기, 375·768·1180·1440 × 주간/야간 가로 스크롤 0, 콘솔 오류 없음. **실제 OFP로 화면 확인·파일 선택창 가져오기·아이패드는 미확인**
- **미해결**: 통신표 내용은 사용자가 eAIP 등에서 채워야 함(앱에 기본값 없음). 진입 알림 10분은 앱 기준 임시값. 커밋 안 함
- **다음**: 사용자 확인(`LOCAL_TEST.md` §14) → 목록 2번 버티컬 뷰(Open-Meteo 기압면)

### 2026-11-12 — Briefing 커밋·배포
- **배포**: 사용자 요청("커밋·배포"). 커밋 전 검사: private·PDF 없음, 항공사명·편명·등록번호 없음, 회사 기준 수치 없음(주석의 개정 번호 예시도 일반 표현으로 바꿈). 1e432fe push → GitHub Actions 성공. 배포 사이트: 새 코드 있음, 회사 기준 값 없음(grep), `runways.json` 200, `/private/` 404
- **다음**: 아이패드에서 새로고침(1~2회) → 구글드라이브의 `company-rules.json`을 Settings → 매뉴얼 → 가져오기 → More → Briefing 확인 (`LOCAL_TEST.md` §13)

### 2026-11-11 — 운항관리사식 Briefing (D-049~D-054, 사용자: "12345 다 진행")
- **완료**: 1) 회사 기상 최저치(이륙 단계·이륙 교체·접근 등급·목적지 미달/Marginal·교체공항 하한·착륙 거리 Dry/Wet) 2) 공항(특수공항 표·공항 제한 = 가져온 FOM에서 읽기, 소방등급 NOTAM, 폐쇄, 활주로 폭, EDTO·3% ERA 기상) 3) 활주로 자료(OFP 활주로 줄 + OurAirports 진방위 `public/geo/runways.json`), 바람 성분 × RWYCC별 회사 바람 제한, 자동착륙 측풍, 오염 시 CAT III 4) Settings "내 운항 조건"(Low Time·수습·부기장 Low Time·엔진 부작동 CAT III 확인) 5) Briefing 탭(공항별 판정·근거, 카드 초안 4개 글 복사, 회항 후보 거리순) + 얼러트 묶음 7개. 추가: 저온 고도 보정(CTAC, 사용자 확인 2026-11-11), NOTAM 시설 영향(진입등·등화·중심선등·RVR·ILS·GNSS), 3% Contingency 지연 통보, MEL × 항로 요건
- **보안**: 회사 수치는 `private/manuals/company-rules.json`에만(D-049). `npm run manuals`가 점검 후 `out/`에 복사 → 아이패드 매뉴얼 가져오기. 빌드 결과에 회사 값 없음 확인(grep)
- **변경 파일**: `src/features/brief/*`(신규 11개), `alerts/rules/briefRules.ts`(신규), `alerts/{types.ts,useAlerts.ts,AlertsCard.tsx,rules/index.ts}`, `manual/ManualCard.tsx`, `settings/SettingsPage.tsx`, `app/{App.tsx,tabs.tsx,styles.css}`, `tools/build-runways.ts`(신규), `tools/manual-convert/build.ts`, `public/geo/runways.json`(신규), 문서. private: `company-rules.json`, `BRIEFING-ITEMS.md`
- **테스트**: `npm test` 167/167(브리핑 25개: 가짜 수치 + private 실제 회사 기준·OFP 샘플 10개·실제 FOM 특수공항/공항 제한/근거 코드 41개 전부 찾음), `tsc -b`, `npm run build` 통과. 개발 브라우저: 회사 기준 넣고 데모 비행을 지금 시각으로 옮긴 시험 비행(로컬, 확인 후 삭제)으로 실시간 METAR/TAF 판정·활주로 성분 확인, 교체공항 안개 TAF를 메모리에만 넣어 대시보드 경고+근거 확인. 375·768·1180·1440 × 주간/야간 가로 스크롤 0, 콘솔 오류 없음. 화면 캡처는 패널이 숨겨져 일부만
- **미해결**: K-30 엔진 부작동 CAT III 회사 확인, K-31 겨울 OFP(SNOWTAM) 형식, K-33 차트 최저치 모름, K-34 3% ERA 시간 창 대략. 아이패드 확인 전
- **다음**: 사용자 확인 → 커밋·배포(요청 시) → 아이패드에서 company-rules.json 가져오기 확인

### 2026-11-11 — 공개 문서의 매뉴얼 세부 최소화 + 브리핑 항목 목록 (초안)
- **완료**: 공개 문서(CURRENT_STATUS·DECISIONS·KNOWN_ISSUES·PROJECT_SPEC·LOCAL_TEST)에서 매뉴얼 쪽 표시 예시·FOM 절 번호·항목/쪽 개수·발행일을 일반 표현으로 바꿈. 원래 문장은 `private/manuals/NOTES-public-docs-detail.md`에 보존. 코드(`alerts/fomRefs.ts`, `inflight/deviation.ts` 화면 문구)의 FOM 절 번호는 링크·근거 표시에 필요해서 그대로 둠. 지난 커밋 기록에는 예전 문장이 남아 있음(기록을 지우려면 강제 push가 필요해서 하지 않음)
- **새 메모**: `private/manuals/BRIEFING-ITEMS.md` = 운항관리사식 브리핑 항목 초안(출발·목적지/교체·특수공항·항로·브리핑 카드·회항, 항목별 ALERT/REF·필요 자료·FOM/FCOM 위치). **구현 계획 아님** — 사용자와 우선순위를 정한 뒤 D-번호로 확정
- **테스트**: 문서만 바꿈(코드 변경 없음) → 테스트·빌드는 실행하지 않음
- **다음**: 브리핑 항목 우선순위 정하기. 활주로 자료(OurAirports) 추가 여부는 새 결정 필요

### 2026-11-11 — MEL 항목 보기 화면 정리
- **문제(사용자 제보)**: 얼러트·MEL에서 MEL 항목을 누르면 쪽 전체가 나오고, 쪽 머리 그림 글(MEL ITEMS…)이 본문처럼 보이며, 그림 글로 바뀐 "Repair interval / Nbr installed …" 표가 글 두 줄로 깨져 보임
- **완료**: 항목 번호로 열면 **그 항목만** 보여 줌(상위 항목 제목·Ident부터 다음 항목 전까지, 쪽을 넘기면 다음 쪽 이어 붙임 — 쪽 표시 범위), "쪽 전체 보기" 버튼으로 전환(전체 보기에서는 해당 항목으로 스크롤·강조). 그림 글 표 → 진짜 표(머리 줄 구분), 쪽 머리 → 작은 회색 한 줄, 번호만 있는 제목+다음 제목 합침, Ident 줄 작게, 하위 목록 들여쓰기. 표시만 바꿈 — 묶음 다시 만들 필요 없음(파서 버전 그대로)
- **변경 파일**: `src/features/manual/{lookup.ts,ManualText.tsx,ManualPage.tsx,manual.test.ts}`, `src/app/styles.css`, `docs/ARCHITECTURE.md` §3.7c
- **테스트**: `npm test` 142/142, `tsc -b`, `npm run build` 통과. 개발 브라우저에 A380-MEL 묶음을 넣어(임시 127.0.0.1 서버, 확인 후 종료) MEL 하위 항목 열기 확인(1180 주간·375 야간), 375·768·1440 가로 스크롤 0. 전체 MEL 하위 항목 모두 항목만 보기 성공, 다른 항목 섞임 0
- **주의**: 개발 브라우저 IndexedDB에 A380-MEL 묶음이 들어 있음(Mac 안)
- **배포**: 사용자 요청으로 커밋 4924018 push → GitHub Actions 성공, 배포 사이트에 새 코드 확인, `/private/` 404. 커밋 전 공개 코드 주석·테스트에서 실제 매뉴얼 제목을 가상 예시로 바꿈
- **다음**: 아이패드에서 얼러트·MEL 탭의 매뉴얼 쪽 열기 확인(새 버전은 새로고침 1~2회 — K-09)

### 2026-11-10 — Phase 5 커밋·배포
- **배포**: 사용자 요청("커밋·배포"). 첫 push는 작업 환경 안전장치가 공개 게시로 막음 → 사용자 선택("요약 빼고 올리기")으로 공개 코드·문서에서 FOM 내용 요약을 빼고 절 번호·제목만 남김(요약은 `private/manuals/NOTES-fom-basis.md`), 실제 개정 번호 예시도 가상 값으로 바꿈, 아직 안 올린 커밋에 합쳐 7ef2954로 push → GitHub Actions 성공, 배포 사이트 새 코드(`manual-1.4`, 얼러트) 확인, `/private/` 404. 커밋 전 실제 편명·등록번호·항공사명 검사 통과
- **다음**: 아이패드에서 매뉴얼 가져오기·MEL·Manual·Alerts 확인(`LOCAL_TEST.md` §11·§12, 새 버전은 새로고침 1~2회 — K-09)

### 2026-11-10 — 연료 경고 기준 FOM 근거 연결 (D-048, 사용자 승인)
- **완료**: 착륙 예상 연료 단계 < FINAL 경고 · < FINAL×130% 경고 · < ALTN+FINAL 주의(FOM 근거), ½FINAL 임시 주의 삭제, 편차 −2%는 임시 유지. Inflight 라벨·FINAL×130% 칸. 얼러트 근거에 FOM 절 링크(연료·블록·ETP·SR), FOM 없으면 글자만
- **변경 파일**: `src/features/inflight/{deviation.ts,InflightPage.tsx,deviation.test.ts}`, `src/features/alerts/{fomRefs.ts(신규),types.ts,useAlerts.ts,AlertsCard.tsx,alerts.test.ts,rules/{fuelProjection,planMargins,turbulence}.ts}`, `src/features/manual/lookup.ts`, 문서(DECISIONS D-025 표시·D-048, KNOWN_ISSUES K-03, PROJECT_SPEC §5.10, ARCHITECTURE §3.7d)
- **테스트**: `npm test` 139/139, `tsc -b`, `npm run build` 통과. 개발 브라우저에서 시험 기록(예상 착륙 FINAL×120%) → Alerts "FINAL×130% (MINIMUM FUEL)" 경고 + FOM 근거 링크 → 누르면 해당 FOM 절로 이동, Inflight 라벨 MIN FUEL PREP·FINAL×130% 칸 확인. 시험 기록·대기 전송·얼러트 기록은 확인 후 지움. 375·768 가로 스크롤 0, 콘솔 오류 없음
- **다음**: 사용자 요청 시 커밋·배포 → 아이패드 확인. minima·측풍 규칙(K-28)

### 2026-11-10 — FOM(+FCRM) 매뉴얼 추가 (D-047)
- **완료**: 사용자 FOM 변환본(marker, MD + _meta.json)을 `private/manuals/inbox/`에 보관(그림 jpeg는 안 옮김). 절 단위 나누기(번호 제목·제 N 장, FOM/FCRM 구분, span·목차 json으로 PDF 쪽), 파일 이름 종류·개정·날짜 판정, 절 번호 바로가기·`[FOM x.y]` 참조 링크. 묶음 GEN-FOM 생성. 파서 `manual-1.4`(나머지 4개 묶음도 다시 만듦)
- **찾은 것**: 연료·minima 관련 FOM 절 위치 확인(요약은 `private/manuals/NOTES-fom-basis.md`) → D-048에서 반영
- **테스트**: `npm test` 138/138, `tsc -b`, `npm run build` 통과. 개발 브라우저에 묶음 5개 넣어 FOM 절 번호 바로가기, 한글 검색 "Final Reserve Fuel 착륙" 확인
- **다음**: 사용자 확인 후 임계값 근거를 FOM 위치로 연결(값 변경은 새 D-번호), minima 규칙 검토

### 2026-11-10 — Phase 5 3단계: 얼러트 엔진 (D-046)
- **완료**: 규칙 파일 구조·엔진(중복 제거·심각도순·실패 규칙 안내)·근거 필수(매뉴얼 위치·OFP 줄·임시 기준·앱 기준·자료 원문)·확인/이력(DB v3 `alerts`)·대시보드 Alerts 카드(자리 표시 카드 교체). 규칙 9개(D-046 참고). 기존 임시 경고는 같은 함수·기준값 사용, 화면별 표시 유지
- **변경 파일**: `src/features/alerts/{types,engine,store,useAlerts}.ts·AlertsCard.tsx·alerts.test.ts·rules/*.ts`(신규), `src/db/schema.ts`(v3), `src/features/dashboard/DashboardPage.tsx`, `src/features/manual/{lookup.ts,MelPage.tsx,ManualPage.tsx}`, `src/app/styles.css`, 문서(DECISIONS D-046, KNOWN_ISSUES K-03·K-28, PROJECT_SPEC §5.10, ARCHITECTURE §3.2·3.7d, LOCAL_TEST §12)
- **테스트**: `npm test` 135/135, `tsc -b`, `npm run build` 통과. 개발 브라우저(샘플 OFP 1개 + A380 매뉴얼): Alerts 안내 4건(MEL Return To Gate·Crew Defer·(o) 절차, 근거 매뉴얼 쪽 링크), 확인 → "확인한 얼러트"로 이동, 375·768·1180·1440 가로 스크롤 0, 주간·야간, 버튼 44px, 콘솔 오류 없음. 연료 편차·SIGMET·결빙 조합은 자동 테스트로만 확인(브라우저에서 실제 기상으로는 미확인)
- **해결 못 한 것**: minima·측풍 규칙(K-28), 임계값 회사 근거(미결 #5). 커밋 안 함
- **다음**: 사용자 요청 시 커밋·배포 → 아이패드 확인. FOM 수령 후 근거 연결

### 2026-11-10 — Phase 5 2단계: MEL·CDL 매칭 + 매뉴얼 보기·검색 (D-045)
- **완료**: MEL 탭(OFP MEL/CDL → 매뉴얼 항목 카드: 제목·CAT·수량·플래카드·(o)(m)·Crew Defer 등 원문 표시, 원문 펼치기, 쪽·(o) 절차 쪽 열기, 못 찾음·상위 항목·다른 기종 경고). Manual 탭(매뉴얼·쪽 이동·되돌아가기, Refer to 링크로 다른 쪽·다른 매뉴얼 이동, 기기 안 검색·번호 바로가기). OFP MEL 블록 → MEL 탭 링크. 변환 규칙 manual-1.2(원문 줄바꿈 보존, (o) 절차 쪽에서 목차 제외)
- **변경 파일**: `src/features/manual/{lookup.ts,ManualText.tsx,ManualPage.tsx,MelPage.tsx}`(신규), `src/features/manual/{parse.ts,ManualCard.tsx,manual.test.ts}`, `src/app/{App.tsx,tabs.tsx,styles.css}`, `src/features/ofp/doc/OfpDocument.tsx`, 문서(DECISIONS D-045, KNOWN_ISSUES K-25 갱신·K-27, PROJECT_SPEC §5.9, ARCHITECTURE §3.7c, LOCAL_TEST §11)
- **테스트**: `npm test` 126/126, `tsc -b`, `npm run build` 통과. 개발 브라우저에 샘플 OFP 1개 텍스트와 묶음 4개를 넣어(임시 127.0.0.1 서버, 확인 후 종료·삭제) MEL 탭 4건 전부 매칭(제목·CAT·수량·(o) 절차 쪽 이동 확인), 검색 `crosswind landing` 43쪽(전체 약 0.15초), FCOM → FCTM 참조 이동 확인. MEL·Manual 탭 375·768·1180·1440 가로 스크롤 0, 주간·야간 표시, 콘솔 오류 없음. **아이패드·파일 선택창은 미확인**
- **해결 못 한 것**: K-25(일부 제목·등급), K-27(본문 링크 터치 영역 작음). 커밋 안 함
- **주의**: 개발 브라우저 IndexedDB에 샘플 OFP 1개(현재 비행)와 A380 매뉴얼 4개가 있음(Mac 안). 묶음은 manual-1.2로 다시 만들어 둠(`private/manuals/out`)
- **다음**: 3단계 얼러트 엔진 — 사용자에게 임계값 근거(매뉴얼 위치) 받기, MEL 제한 × 경로·기상 규칙

### 2026-11-10 — Phase 5 조사·계획 + 1단계 매뉴얼 넣기 (D-044)
- **완료**: Phase 5 계획 승인(1 넣기 → 2 MEL·CDL 매칭·보기·검색 → 3 얼러트 → Phase 6 AI 질의). 사용자 매뉴얼(A380 MEL·CDL·FCOM·FCTM PDF+MD)을 `private/manuals/inbox/`에 보관. 변환 MD 형식 조사(쪽 표시·발행일·MEL 표). Mac 도구 `npm run manuals`(PDF는 필요할 때만 MD 변환, 최신 개정만, 묶음 .efbman.json.gz). 앱 Settings → 매뉴얼 카드(가져오기·교체·삭제), DB v2. OFP MEL 번호 끝 A/B = 하위 항목으로 확인
- **결과**: 묶음 MEL·CDL·FCOM·FCTM 생성(수 초). OFP 샘플의 MEL·CDL 번호 전부 매뉴얼에서 찾음 (세부 수치는 비공개 메모)
- **변경 파일**: `src/features/manual/{types.ts,parse.ts,store.ts,ManualCard.tsx,manual.test.ts}`(신규), `src/db/schema.ts`(v2), `src/features/settings/SettingsPage.tsx`, `src/app/styles.css`, `tools/manual-convert/{build.ts,pdf2md.py}`(신규), `package.json`(`manuals`), 문서(DECISIONS D-044, KNOWN_ISSUES K-25·K-26, PROJECT_SPEC §5.9, ARCHITECTURE §3.2·3.7c·5, LOCAL_TEST §11)
- **테스트**: `npm test` 121/121, `tsc -b`, `npm run build` 통과. 개발 브라우저에 묶음 4개를 넣어(임시 127.0.0.1 서버로 전달, 확인 후 종료·삭제 — 파일 선택창 대신 같은 읽기·저장 함수 호출) 목록 표시, 항목 번호 찾기, 사용량 13.5MB, 375·768·1180·1440 × 주간/야간 가로 스크롤 0, 삭제 버튼 44px, 콘솔 오류 없음. **파일 선택창으로 가져오기·아이패드는 미확인**
- **해결 못 한 것**: K-25(MEL 제목 71·등급 21 못 찾음, FCOM 일부 쪽 합침), PDF→MD 변환 경로는 probe만 확인(실제 변환 실행은 안 함 — 이미 MD 있음). 커밋 안 함
- **주의**: 개발 브라우저 IndexedDB에 A380 매뉴얼 4개가 들어 있음(Mac 안). `private/manuals/.venv`는 바탕화면 `PDF변환/.venv` 링크(K-26)
- **다음**: 2단계 — OFP MEL/CDL 카드에 매뉴얼 항목(제목·등급·수량·(o)(m) 조건·OpsProc·쪽 표시) 붙이기, 매뉴얼 보기 화면(쪽 이동·"Refer to" 연결), 오프라인 검색. 사용자 확인: 아이패드에서 묶음 가져오기

### 2026-11-10 — Phase 4 NOTAM (조사 → 계획 승인 → 구현 → 로컬 검증)
- **완료**: 샘플 10개 NOTAM 구조 조사(패키지 1 공항 / 2 경로 공항 / 3 FIR, Q) 줄 없음). 기존 구간 탐지 버그 수정(시작 줄 공백 여러 칸·끝 줄을 시작으로 잡던 문제). NOTAM 추출기(패키지·공항/FIR·분류 제목·번호·유효기간·D/E/F/G/COMMENT·원문 줄, 버리는 줄 없음), 교차검증 `notamCount`. 분류·강조·근거(D-043), 비행 시간대·FIR 통과 시간대 겹침, NOTAM 탭, 다른 탭 → 원문 줄 이동. K-16 해결(구간 표시 전부 verified). 파서 `aviator-1.3`
- **샘플 결과**: 10개 모두 패키지별 "머리 줄 수 = 추출 건수" + 끝 표시 확인 (예: 샘플 1 = 67/142/85). 샘플 1의 7건을 원문과 직접 대조(번호·위치·기간·본문·분류·칩) — 기대값은 `private/samples/notam.expect.json`(커밋 금지)
- **변경 파일**: `src/features/ofp/parser/{notam.ts(신규),sections.ts,extractors.ts,index.ts,parser.test.ts,samples.test.ts}`, `src/features/ofp/{types.ts,OfpPage.tsx,sourceJump.ts(신규)}`, `src/features/notam/{refs,classify,relevance}.ts·NotamPage.tsx·notam.test.ts(신규)`, `src/app/{App.tsx,tabs.tsx,styles.css}`, 문서(DECISIONS D-043, KNOWN_ISSUES K-16🟢·K-22~24, PROJECT_SPEC §5.3·§5.8, ARCHITECTURE, LOCAL_TEST §10)
- **테스트**: `npm test` 111/111, `tsc -b` 통과, `npm run build` 통과. 개발 브라우저에 샘플 1을 넣어(임시 127.0.0.1 서버, 확인 후 종료·삭제) NOTAM 탭 295항목 표시, 원문 링크 → OFP 원문 L1047 강조 확인, 375·768·1180·1440 × 주간/야간 가로 스크롤 0, 콘솔 오류 없음(임시 서버 연결 1건 제외). PDF 추출(pdfText) 변경 없어 샘플 텍스트 재생성은 안 함
- **해결 못 한 것**: 아이패드 실사용 확인 전. 근거 문서 일부 원문 대조 전(K-23), D) 시간표 미해석(K-22). 공항 안 순서는 OFP 원문 순서 그대로(회사 권고가 앞에 와서 긴 공항은 스크롤 많음)
- **주의**: 개발 브라우저(앱 내장 브라우저) IndexedDB에 샘플 1 원문이 현재 비행으로 들어 있음 — Mac 안에만 있음
- **배포**: 사용자 요청("확인 후 배포")으로 커밋 e236b29 push → GitHub Actions 성공, 배포 사이트 새 버전(`aviator-1.3`) 확인, `/private/` 404. 커밋 전 실제 편명·등록번호·NOTAM 번호 혼입 검사 통과
- **다음**: 아이패드에서 실제 OFP로 NOTAM 탭 확인(`LOCAL_TEST.md` §10, 새 버전은 새로고침 1~2회 후 — K-09) → Phase 3.5 또는 5

### 2026-11-05 — 구글 시트 실연동 + 오프라인 복귀 자동 전송 수정
- **완료**: 사용자가 Apps Script 설치·배포, 아이패드 Settings 연결 테스트 성공. 온라인 기록은 시트에 저장됨(사용자 확인)
- **문제→수정**: 비행기 모드 후 복귀 시 failed로 남음 → D-042, K-21. 테스트 84/84
- **다음**: GitHub 반영 후 아이패드에서 비행기 모드 → 복귀 자동 전송 재확인

### 2026-11-05 — 아이패드 확인
- 사용자가 배포판을 아이패드 홈 화면 앱으로 사용해 보고 "잘 작동함" 보고. Phase 3 사용자 확인 완료

### 2026-11-05 — 기상 중계 자동 (D-041)
- 중계 주소 기본값 내장, Worker `ALLOWED_ORIGINS` 설정, push·배포(27aa6c7)

### 2026-11-05 — 이전 기록 요약
- GitHub 첫 업로드·Pages 배포(공개 저장소 — 회사 원문·실제 편명·등록번호 커밋 금지 주의) · Cloudflare Worker 기상 중계 설치(81/81) · Phase 3 기상 지도(D-034~040, 76/76) · 첫 개발 대화 Phase 0→2 + 문서 체계(59/59)

### 2026-11-17 — FOM 쪽 사진 · 매뉴얼 목차·쪽 이동·검색 (D-077)
- **완료**: ① FOM(+FCRM) 원본 PDF로 사진 묶음 생성(`GEN-FOM-img.efbimg`, 쪽 연결 거의 전부). **아이패드에서 매뉴얼 5개 글·사진 가져오기와 FOM "🖼 원본 쪽 사진" 표시를 사용자가 확인함**(`_meta.json`은 묶음 파일이 아니라서 거절됨, 정상) ② Manual 탭 "목차" 버튼(장·절 / 쪽 코드 묶음, 지금 위치 강조) ③ 쪽 수(순번/전체)를 누르면 입력: 숫자·`p34`(원본 쪽)·쪽 코드·절 번호 ④ 검색에서 한국어 띄어쓰기 차이 허용
- **변경 파일**: `manual/lookup.ts`, `manual/ManualPage.tsx`, `manual/manual.test.ts`, `app/styles.css`, 문서(DECISIONS D-076 보충·D-077, ARCHITECTURE §3.7p, 이 문서)
- **테스트**: `npm test` 245/245, `tsc -b`, `npm run build` 통과. 실제 묶음 5개로 목차·검색 결과를 Mac에서 출력해 봄. 개발 브라우저에 가짜 매뉴얼 2개(FOM형·FCOM형)를 넣어 목차 펼침·누르기·`p40`·`DSC-34-20` 이동 확인, 375·768·1180·1440 가로 스크롤 0, 주간·야간 확인 → 가짜 매뉴얼은 지움. 콘솔 오류는 기상 프록시 PIREP·G-AIRMET 404만(이번 변경과 무관, K-35)
- **배포**: 사용자 요청. 커밋 전 공개 문서의 목차 개수·FOM 쪽 수·실제 제목 낱말을 일반 표현으로 바꿈(원래 문장 `private/manuals/notes-2026-11-17/`). 88428f4 push → GitHub Actions 성공, 배포 사이트에 새 코드 있음, `/private/` 404
- **미해결**: 아이패드에서 목차·쪽 이동은 아직 확인 전(새로고침 1~2회 — K-09). 검색 결과는 최대 60쪽만 보임(관련도순)
- **다음**: 아이패드에서 Manual 탭 목차·쪽 번호 이동·검색 확인

### 2026-11-17 (2) — 점검 (상태 흐름·버그 분류·CI·다시 만든다면)
- **완료**: 사용자 요청 관점(숨은 상태 흐름, 빈도×심각도 분류, 오픈소스 비교, CI 감사, 다시 만든다면)으로 점검. 고친 것 1개: 기상 갱신 일부 실패를 "완료"로 표시하던 문제(K-45). 이슈로만 남김: K-44(비행 상태 안 바뀜), K-46(목차를 PDF 책갈피로 바꿀 수 있음). K-02·K-29 상태를 실제에 맞춤
- **CI**: 실행 기록 19회(150회 없음) 모두 성공. build 평균 = 대기 2초 · 셋업 9초 · 작업 14초, 가장 느린 작업 37초 → 고칠 것 없음
- **변경 파일**: `weather/actions.ts`, `weather/actions.test.ts`(신규), `docs/KNOWN_ISSUES.md`, 이 문서
- **테스트**: 개발 브라우저에서 ⟳ 기상 → "일부 실패: WINDS, PIREP, GAIRMET" 표시 확인(개발 서버 중계 404)
- **배포**: 사용자 요청. cdb934f push → GitHub Actions 성공, 배포 사이트에 새 문구 코드 있음, `/private/` 404
- **다음**: 아이패드에서 ⟳ 기상 → Worker 재배포 전이면 "일부 실패: PIREP, GAIRMET"가 보여야 정상(K-35). Manual 목차·쪽 이동 확인

### 2026-11-18 — FMS 대조 · RVSM · Ops 정상 절차 체크 (D-078)
- **완료**: OFP 탭 맨 위 FMS 대조(RAMP FUEL·TRIP TIME·FOB·TOTAL DIST 입력·차이, GATE·COORD, RVSM QNH hPa↔inHg·L/STBY/R 차이). Ops 탭 "정상 절차 | 비정상·상황" 두 탭, 정상 절차 = 개인 체크리스트(FMS CHK·BALT·DEBTN·HWP, 편집 가능, 체크 시각) + HAA 칸 + 기기 FCOM SOP 원문 열기
- **변경 파일**: `checks/{checks.ts,checks.test.ts}`(신규), `ofp/doc/{FmsCheck.tsx(신규),OfpDocument.tsx}`, `ops/{Checklist.tsx(신규),OpsPage.tsx,store.ts}`, `app/styles.css`, 문서(DECISIONS D-078, ARCHITECTURE §3.7q, KNOWN_ISSUES K-47, 이 문서)
- **테스트**: `npm test` 252/252, `tsc -b`, `npm run build` 통과. 개발 브라우저(데모 OFP): 입력 → 차이(+500 KG, −0:08), QNH 29.92 → 1013 hPa, L−R +20 ft, 새로고침 후 값 유지. 체크·해제·체크 시각, 항목 추가·기본으로, 비정상 탭 기존 내용. 375·768·1180·1440 가로 스크롤 0, 주간·야간. 시험 값은 지움. FCOM SOP 링크는 개발 브라우저에 매뉴얼이 없어 안내 문구만 확인(실제 목록은 아이패드에서)
- **다음**: 사용자 확인 → 커밋·배포(요청 시). 다음 단계: FCOM SOP·FOM 기반 체크 항목(K-47)

### 2026-11-18 (2) — OFP FMS 입력 디자인 시안 확정 중 → (3)에서 구현
- **상태**: D-078 코드는 **커밋 안 됨**(작업 폴더에 있음). 사용자가 화면을 보고 바꾸기로 함 → 아래대로 다시 만든 뒤 커밋·배포(요청 시)
- **최종 시안 파일**: `private/design/2026-11-18-ofp-fms-entry-mockup-v2.html` (v2: 입력 줄 높이 = 앱 표 줄과 같게(14px, 위아래 7px, 32px), 차이는 입력 왼쪽 같은 줄, 칸 좌우 여백 4px. 이전 v1은 `...-mockup.html`). 회사 OFP 값이 있어 private에만
- **사용자 결정 (시안 여러 번 거쳐 확정)**
  1. OFP 탭 맨 위 별도 "FMS 대조" 표(`ofp/doc/FmsCheck.tsx`)는 **없앰**. 대신 **원래 FUEL 카드 포맷 그대로**(여백·글씨·줄 강조 동일) + 오른쪽에 얇은 "FMS" 열. 입력 칸은 테두리 없이 숫자만, 비었을 때 흐린 대문자 안내(TRIP 줄 `TIME`, RAMP OUT 줄 `FOB`, FOD 줄 `FOD`). RESERVE 입력 없음. 차이는 입력 아래 작은 글씨(✓ 초록 / +n 주황)
  2. FUEL 카드 아래 줄: **2ND BEST FL·연료·시간 + 계획 대비 차이**(예: +10,500 · +0:07). Jeppesen `2ND-$ 320 2884 10.07` = FL·TRIP 연료(100LBS)·시간 → 파서에 추가 필요
  3. FLIGHT 카드도 FUEL과 **같은 여백·글씨**, 표 = 항목 | OFP | FMS. 회색 글자는 **모두 대문자**. 항목: DIST(숫자, 쉼표 자동) · MAX FL(OFP와 비교) · OPT FL · EO FL(3자리 → 앞에 `FL` 자동) · GATE(대문자) · COORD(N/S·E/W 버튼 + 숫자, 자릿수 맞춰 `37°27.1'`·`126°27.0'` 자동) · RVSM(QNH: `1013`→`1013 hPa`, `2992`→`29.92 inHg`, 반대 단위 옆에 / CAPT·STBY·F/O 고도, CAPT 대비 차이)
  4. FLIGHT 회색 줄에 Jeppesen에서 아직 안 보이던 값을 조용히 추가(“NEW” 표시 없이): 속도 계획 CLB/CRZ CI/DSC, APMS/P %. 그 밖 후보(PROGS·WX, NAM, LOCAL UTC±, 연료 소모 조정 TOW+2000→TRIP+N, 디스패처·CCF·TANK)는 사용자가 "공통 카드는 보기 싫다"고 해서 자리 미정 — 다음에 위치 제안
  5. 새 카드 **SYSTEMS · PRE-FLIGHT**: ENG OIL 1·2·3·4 (QT — FCOM: 엔진 오일 양 quart 표시, `185`→18.5) · HYD GREEN·YELLOW (초록·노랑 점) · OXY CREW·CABIN (PSI — FCOM). 기준값(최소량) 판정 없음
  5a. (v2 추가) RAMP OUT·FOD FMS 입력은 klbs 허용: `290`→290,000 · `290.2`→290,200 · `290200` 그대로 (소수점 있거나 1000 미만이면 ×1000)
  5b. (v2 추가) RVSM 아래에 FCOM PRO-SPO-RVSM "Maximum differences between altitude indications" 표(지상 20/20/30 … FL410 150/150/360 ft) + 지상 QNH 고도계−공항 표고 <75 ft. STBY·F/O 차이를 지상 허용값(F/O 20, STBY 30)과 비교해 ✓/⚠
  5c. (v2 추가) HYD는 값 입력 대신 NORMAL 체크(체크 시각 Z). ENG OIL 칸 제목 옆 "📖 LIMIT" → FCOM LIM-ENG OIL QUANTITY 쪽을 MEL처럼 그 자리 창(man-pop)으로
  5d. (v2 추가) QNH 단위 자동 판별 = FCOM 기압 설정 범위(745–1100 hPa / 22.00–32.48 inHg): `745~1100`→hPa, `2200~3248`→÷100 inHg, `29.92`처럼 소수점→inHg, 그 밖은 "범위 밖". 1050 hPa(31.00 inHg) 초과면 FCOM 보충 절차(Operations at QNH above 1050 hPa) 표시. 질문 ①(1013 = hPa) 사용자 확인 완료
  6. Enter = 다음 칸. 입력은 키보드(손글씨 글꼴 안 씀)
  7. Ops 탭: "FCOM 정상 절차 원문" 칸 **삭제**. 체크리스트 모양은 사용자가 "못생겼다" → OFP 쪽 끝난 뒤 같은 포맷으로 다시 시안
- **사용자에게 물어본 것 (답 대기)**: ① QNH 1013을 "10.13 hPa"라고 썼는데 1013 hPa로 표시했음 — 맞는지 ② HYD에 적는 값·단위(FCOM HYD 화면은 숫자 없이 막대) ③ COORD 소수 첫째 자리면 되는지 ④ TTL RSV(Lido)는 Jeppesen에 줄이 없음 — 이번 결정에서 RESERVE 입력은 빼기로 함
- **다음 작업 순서**: 위 답 받기 → `FmsCheck.tsx` 제거·FUEL/FLIGHT 블록에 FMS 열·SYSTEMS 카드 구현(저장은 D-078 `useDraft`·`fmsCheck:<비행>` 키 재사용, 필드 추가) → 파서에 2ND BEST·속도 계획·APMS 추가(`AVIATOR_PARSER_VERSION` 올림) → Ops 체크리스트 디자인 시안 → 테스트·화면 확인 → DECISIONS에 D-079(D-078 일부 대체) → 커밋·배포(요청 시)
- **작업 방식 메모**: 디자인은 코드 전에 시안(그림)으로 먼저 확인. 사용자는 **앱 원래 포맷 유지**를 원함(새 큰 표·“NEW” 배지·두꺼운 입력 칸 싫어함)

### 2026-11-18 (3) — FMS 입력 앱 구현 (D-079)
- **완료**: 시안 v2 확정분 구현. OFP 탭 맨 위 FMS 대조 표 삭제 → FUEL(TRIP 시간·FOB·FOD, klbs 입력)·FLIGHT(DIST·MAX FL·OPT/EO FL·GATE·COORD + RVSM QNH·CAPT/STBY/F/O + FCOM 허용 차이 표) 카드 안 FMS 열, SYSTEMS·PRE-FLIGHT 카드(ENG OIL + 📖 LIMIT → FCOM LIM-ENG 창, HYD NORMAL 체크, OXY). 파서 `aviator-1.5`: SPEED SKD·APMS·2ND-$(FUEL 카드 아래 2ND BEST + 차이). Ops 정상 절차 탭의 FCOM SOP 원문 칸 삭제. QNH 범위 = FCOM 745–1100 hPa / 22.00–32.48 inHg (사용자 "1013 = hPa 맞음, 범위 찾아봐")
- **변경 파일**: `checks/{checks.ts,checks.test.ts}`, `ofp/doc/{Fms.tsx(신규),OfpDocument.tsx}`, `ofp/doc/FmsCheck.tsx`(삭제), `ofp/parser/{aviator.ts,index.ts,samples.test.ts}`, `ofp/types.ts`, `ops/Checklist.tsx`, `app/styles.css`, 문서(DECISIONS D-079, ARCHITECTURE §3.7q, KNOWN_ISSUES K-47, 이 문서)
- **테스트**: `npm test` 254/254 (실제 OFP 10개에서 SPEED SKD·2ND-$ 읽기 포함), `tsc -b`, `npm run build` 통과. 개발 브라우저(데모 OFP, :5174): FOB `290`→290,000, `107.5`→107,500(+100), TRIP `916`→9:16(−0:59), DIST·MAX FL 차이, LAT `37271`→37°27.1', LON `126270`→126°27.0', QNH `2992`→29.92 inHg(1013 hPa), STBY +40 ⚠ · F/O +10 ✓, 오일 `185`→18.5, HYD 체크 시각, 새로고침 후 값 유지. 375·768·1440 × 주간/야간 가로 스크롤 0, 입력 줄 높이 = 다른 줄. 시험 값 지움. 콘솔 오류는 기상 중계 404만(K-35)
- **확인 못 한 것**: 데모 OFP에는 FOD 줄·2ND BEST·SPEED SKD가 없어 그 화면은 개발 브라우저에서 못 봄(파서 테스트로만 확인) → 실제 OFP로 확인 필요. 📖 LIMIT 창은 개발 브라우저에 FCOM이 없어 못 눌러 봄(아이패드에서). 커밋·배포 안 함
- **답 대기**: COORD 분 소수 첫째 자리면 되는지 (지금은 그렇게 만듦)
- **다음**: 사용자가 실제 OFP로 확인 → 커밋·배포(요청 시) → Ops 체크리스트 디자인 시안(같은 포맷) → FLIGHT 후보 값(PROGS·WX, NAM, LOCAL UTC±, TOW+2000→TRIP+N, 디스패처·CCF·TANK) 자리 제안


### 2026-11-19 — SYSTEMS·RVSM 다시 시안 (코드 변경 없음)
- **사용자 요청**: ① WEIGHTS·SYSTEMS 자리 바꾸기 ② SYSTEMS 더 예쁘게/쪼개기 ③ 오일 최소량 간략 표시 ④ RVSM 기준 아주 간략히 + FOM 75 ft 확인. "만들지 말고 이미지 먼저"
- **시안**: `private/design/2026-11-19-systems-rvsm-mockup.html` — SYSTEMS A(칸 묶음)·B(가로 표)·C(두 카드로 쪼갬), 오일 MIN 한 줄(FT 9:24 → OAT<0 13 qt / OAT≥0 10.7 qt), RVSM에 ELEV 칸 + 기준 두 줄(GND: −ELEV ≤75 · CAPT↔F/O ≤20 · STBY ≤30 / CRZ: 1시간마다 CAPT↔F/O ≤200)
- **확인한 근거**: 75 ft = FOM 10.4.1.3 b) "QNH Set 시 Primary 고도계 지시고도와 Airport Field Elevation 차이 75 ft 이내" (계기끼리 아님). 순항 두 Primary 고도계 차이 200 ft 이내(초과 = Loss of Redundancy) = FOM 10.4.1.3 d). FCOM 표는 FL300+ 150 ft
- **다음**: 사용자 선택(A/B/C, ELEV 칸 여부, 순항 200 vs 150) → 구현
- **(2) 사용자 답**: SYSTEMS = **B(가로 표)**. "가운데 글자 움직여서 정신없음" → 원인: 표 자동 열 너비(입력·"범위 밖"에 따라 가운데 열 이동) → 열 너비 고정(table-layout fixed)으로 고칠 것. RVSM 기준 표시 3안 시안 `private/design/2026-11-19-rvsm-systems-b-mockup.html` (R1 가운데 열에 기준·출처, R2 작은 기준표, R3 두 줄 칩) — 선택 대기
- **(3) 최종 시안** `private/design/2026-11-19-final-systems-rvsm-mockup.html`: SYSTEMS = 칸 묶음(ENG OIL 4칸 + MIN QT 띠 + HYD 체크 2개 + OXY 2칸) 한 카드. 오일 최소량 = FCOM LIM-ENG 표에 **OFP RAMP OUT 시간** 넣어 계산(소수 첫째 자리 올림, 예 11:04 → OAT<0 13 / OAT≥0 11.6). RVSM = R2 + 기준표(행 GND·CRZ·FL300+, 열 PFD↔표고 · PFD↔PFD · PFD↔ISIS, 큰 숫자 + FOM/FCOM 칩), 가운데 열 "vs ELEV / vs CAPT". 선택 대기: 오일 입력이 최소량보다 작으면 주황 표시할지
- **(4) 사용자 답**: 오일 최소량 미만 **주황 표시 함**(두 값 중 큰 값 기준). "FT"(피트로 읽힘) → **FLT**. 오일 최소량은 표 모양(OAT 행 · 규칙 · 값). 카드 안 제목 누르면 FCOM 원문 창: ENG OIL → `LIM-ENG` OIL QUANTITY, OXY → `LIM-OXY`(CREW 그래프 P1~2, CABIN P3), HYD → FCOM LIM에 유압 양 쪽 없음 → `PRO-NOR-SOP-40` "HYD SD page RESERVOIR FLUID LEVEL … WITHIN NORMAL RANGE" 쪽(사용자 확인 대기). 시안 같은 파일 갱신

### 2026-11-19 (5) — SYSTEMS·RVSM 앱 구현 (D-080) (다음 세션은 여기서 시작)
- **완료**: 카드 순서 WEIGHTS → SYSTEMS. FMS 표 열 고정(가운데 글자 안 움직임). SYSTEMS = ENG OIL 4칸 + MIN OIL 표(RAMP OUT 시간, 최소량 미만 주황) + HYD 체크 버튼 + OXY 2칸, 칸 제목 → FCOM LIM-ENG·LIM-OXY·SOP HYD 쪽 창. RVSM = ELEV 칸 추가, CAPT PFD vs ELEV(75 FOM)·F/O PFD vs CAPT(20)·STBY ISIS vs CAPT(30), 기준표 GND/CRZ/FL300+ × PFD↔표고/PFD↔PFD/PFD↔ISIS + FOM·FCOM 표시. "FT"→"FLT"
- **변경 파일**: `checks/{checks.ts,checks.test.ts}`, `ofp/doc/{Fms.tsx,OfpDocument.tsx}`, `app/styles.css`, 문서(DECISIONS D-080, ARCHITECTURE §3.7q, KNOWN_ISSUES K-47, 이 문서)
- **테스트**: `npm test` 255/255, `tsc -b`, `npm run build` 통과. 개발 브라우저(데모 OFP): QNH `299` 범위 밖 → `1013` 1013 hPa, 가운데 열 위치 변화 0px, ELEV 21·CAPT 30 → +9 ✓, F/O 40 → +10 ✓, STBY 70 → +40 ⚠, ENG 3 `110` → 11.0 주황(최소 13, 데모 FLT 10:15 → 13 / 11.2), HYD 체크, 카드 순서 확인. 375·768·1440 × 주간/야간 가로 스크롤 0, 잘린 칸 0(1440에서 FUEL 첫 열 넓힘). 시험 값 지움. FCOM 없는 개발 브라우저에서 제목 누르면 "FCOM 없음" 안내 확인
- **확인 못 한 것**: 실제 FCOM이 있는 아이패드에서 제목 → LIM-ENG·LIM-OXY·SOP 쪽이 맞게 열리는지. 실제 OFP의 RAMP OUT 시간·FOD·2ND BEST 화면. 커밋·배포 안 함(D-078~D-080 모두 작업 폴더에만)
- **다음**: 사용자 확인 → 커밋·배포(요청 시) → Ops 체크리스트 디자인 시안 → FLIGHT 후보 값 자리 제안

- **배포 (2026-11-19)**: 사용자 요청. 커밋 전 실제 OFP 샘플 10개를 화면 그대로 그려(서버 렌더) FUEL 표 RAMP OUT·FOD 줄, WEIGHTS AGTOW 풀이, 2ND BEST, SYSTEMS 모두 있는 것 확인 — 사용자가 본 "BLOCK·FOD 없음·AGTOW 없음" 화면은 **데모 OFP**(KG, 데모에 원래 없는 값)였음. 실제 편명·등록번호 혼입 검사 통과. e193a9f push → GitHub Actions 성공, 배포 사이트에 `aviator-1.5`·새 화면 코드 있음, `/private/` 404

### 2026-11-19 (6) — FMS·RVSM 표를 FLIGHT 카드에서 떼어 카드 2개로 (다음 세션은 여기서 시작)
- **사용자 요청**: FLIGHT 카드 아래 FMS 표 + RVSM 표를 분리해 FUEL 카드처럼 따로 된 카드 2개로. 시안 `private/design/2026-11-19-fms-rvsm-split-mockup.html`(A·B·C) 보고 → "요약 배지 필요 없음, MAX FL의 OFP 값(FL400) 없어도 됨, 기존 내용 그대로 잘라서 떼어내기만"
- **완료**: `FlightFms` → `FmsBlock`(카드 "FMS") + `RvsmBlock`(카드 "RVSM · Altimeters", 기준표 포함). 카드 순서 FLIGHT → FMS → RVSM → FUEL → … MAX FL 줄 OFP 칸 = "—"(차이 표시도 없음). 표 내용·입력·저장 값은 그대로. 안 쓰는 `.fms-cols` CSS 삭제
- **변경 파일**: `ofp/doc/{Fms.tsx,OfpDocument.tsx}`, `app/styles.css`, 이 문서
- **테스트**: `npm test` 255/255, `tsc -b`, `npm run build` 통과. 개발 브라우저(데모 OFP): 카드 제목 순서 확인, 375·768·1180·1440 가로 스크롤 0, 주간/야간
- **다음**: 사용자 확인 → 커밋·배포(요청 시) → Ops 체크리스트 디자인 시안 → FLIGHT 후보 값 자리 제안

### 2026-11-19 (7) — FMS 입력용 앱 키보드 (D-081)
- **완료**: 아이패드 폭(≥768px)에서 FMS 칸을 누르면 iOS 키보드 대신 앱 키보드(시안 C): 위 막대 ‹ 이전 · 다음 › · 칸 이름 · OFP 값 · 완료, 왼쪽 QWERTY, 오른쪽 작은 숫자판. 아이폰 폭은 iOS 키보드 그대로. 앞 작업(6) FMS·RVSM 카드 분리도 D-081에 기록
- **변경 파일**: `ofp/doc/{FmsKeyboard.tsx(신규),Fms.tsx,OfpDocument.tsx}`, `app/styles.css`, 문서(DECISIONS D-081, ARCHITECTURE §3.7q, KNOWN_ISSUES K-48, 이 문서)
- **테스트**: `npm test` 255/255, `tsc -b`, `npm run build` 통과. 개발 브라우저(데모 OFP): 1180 가로 — DIST 칸 누르면 키보드, 키 눌러도 초점 유지·글자 들어감, 다음 → MAX FL, 이전 → DIST, 칸 비우기, 완료 → 닫힘. 768 세로·야간 — 입력 칸이 키보드 위로 올라옴, 가로 스크롤 0. 375 — 앱 키보드 안 뜸(iOS 키보드). 시험 값 지움
- **확인 못 한 것**: 실제 아이패드(K-48). 커밋·배포 안 함
- **사용자 답**: 순항 기록 입력 창에도 쓰기 → (8)
- **다음**: 아이패드 확인 → 커밋·배포(요청 시) → Ops 체크리스트 디자인 시안

### 2026-11-19 (8) — 순항 기록 창에도 앱 키보드 (D-082) (다음 세션은 여기서 시작)
- **완료**: 키보드를 `app/AppKeyboard.tsx`로 옮겨 앱에 하나만 둠. 순항 통과 기록 창(ATA·FUEL)에서도 아이패드 폭이면 앱 키보드 — 막대에 ATA = ETO, FUEL = PLAN 잔량, 이전/다음은 창 안 두 칸끼리. 키보드가 뜨면 창이 그 위로 올라감. 창을 닫거나 탭을 옮기면 키보드도 닫힘
- **변경 파일**: `app/{AppKeyboard.tsx,App.tsx,styles.css}`, `inflight/EntrySheet.tsx`, `ofp/doc/{Fms.tsx,OfpDocument.tsx}`, 문서(DECISIONS D-082, ARCHITECTURE §3.7q, 이 문서)
- **테스트**: `npm test` 255/255, `tsc -b`, `npm run build` 통과. 개발 브라우저(데모 비행): 1180 가로 — FUEL 칸 누르면 키보드, 화면에서 창이 키보드 위로 올라간 것 확인, 숫자 입력 → "= 105 KG", 이전 → ATA, ⌫ 두 번·숫자 → 0350 → 03 → 0312, 닫기 → 키보드 닫힘. 768 세로·야간 — 창 아래 576 < 키보드 위 765, 가로 스크롤 0. 저장은 안 눌러 기록 안 남김
- **확인 못 한 것**: 실제 아이패드(K-48). 커밋·배포 안 함
- **다음**: 아이패드 확인 → 커밋·배포(요청 시) → Ops 체크리스트 디자인 시안
- **배포 (2026-11-19)**: 사용자 요청. 9e63d4a push → GitHub Actions 성공, 배포 사이트 코드에 앱 키보드 있음, `/private/` 404. 아이패드 확인 대기(K-48)

### 2026-11-19 (9) — A-OPCS 학습 · 합동 브리핑 · 매시간 점검 조사 (코드 변경 없음)
- **사용자 요청**: 폐기된 회사 앱 A-OPCS 매뉴얼 2개 학습(WPT별 연료·온도·바람·시간 기록은 빼기 — Jeppesen Aviator에서 함). 앞으로 만들 것: ① 매시간 System Check(FCOM·FOM 참조) ② OFP에 계획 방식(3% CONT / EDTO / REFILE) 표시 ③ 합동 브리핑 양식 — OFP 값 자동 + FOM 필수 항목 빠짐없이 + 반복 문구 preset 버튼(보안등급 등)
- **한 것**: 자료를 `private/reference/aopcs/`로 복사·텍스트 추출. FOM·FCOM에서 근거 조사 → 비공개 메모 `private/manuals/NOTES-aopcs-joint-brief-hourly.md`(A-OPCS 기능 대조, 계획 방식 읽는 법, 매시간 점검 근거 표, 합동 브리핑 필수 항목 전체). 시안 `private/design/2026-11-19-joint-brief-mockup.html`(공통 계획 방식 배지 + A 체크리스트형 · B 원고형 · C 입력+원고)
- **알게 된 것**: 계획 방식은 OFP에서 바로 읽힘(연료 줄 "3/5 PCT CONT", 2쪽 머리 "REFILE"·"EDTO", 교체공항 "3% ERA/REFILE/EDTO"). 승객 예약 F/C/Y는 파서가 이미 읽음. 회사 "매시간 점검 목록" 원문은 FOM·FCOM에 없음 — 고도계 약 1시간(FOM RVSM), 연료 WPT/30분·SD 페이지(FCOM SOP 순항)만 있음
- **못 한 것**: 사용자가 준 유튜브 영상(읽을 수 없음)
- **답 대기**: 합동 브리핑 시안 선택, 매시간 점검 목록 출처, 노크·음어 기본값, 기장 방송용 책자, FLT LOG(블록 시각·연료) 만들지
- **다음**: 사용자 선택 → 계획 방식 배지(파서 + FLIGHT 카드, 작음) → 합동 브리핑 → 매시간 점검

### 2026-11-19 (10) — 합동 브리핑 + OFP 계획 방식 배지 (D-083)
- **사용자 요청**: 시안 A(체크리스트) + C의 서비스·포함할 문단 칩 + 원고는 B처럼. 원고 preset 수정·저장, 녹색 부분 변경, 체크리스트에서 추가·삭제·수정·순서 변경
- **완료**: Ops 탭 첫 화면 "합동 브리핑"(체크리스트 + 원고, 편집·저장). 회사 preset 14문단은 비공개 기준 파일(`private/manuals/build-joint.py` → company-rules.json `jointBrief`), 코드에는 제목·OFP 값만 있는 기본 틀. OFP 파서 `aviator-1.6`: 계획 방식(3%/5% CONT·REFILE 공항·EDTO·3% ERA) → FLIGHT 카드 배지 + 원고 {계획방식}. 데모 OFP demo-5(계획 방식·승객·화물)
- **변경 파일**: `joint/{template.ts,JointBrief.tsx,joint.test.ts}`(신규), `ops/OpsPage.tsx`, `brief/rules.ts`, `ofp/{types.ts,parser/aviator.ts,parser/index.ts,doc/OfpDocument.tsx}`, `mock/demoOfp.ts`, `app/styles.css`, 문서(DECISIONS D-083, ARCHITECTURE §3.7r, KNOWN_ISSUES K-49, 이 문서) · 비공개: `private/manuals/{build-joint.py,company-rules.json}`
- **테스트**: `npm test` 263/263(합동 브리핑 8개 + 실제 OFP 10개 재파싱), `tsc -b`, `npm run build` 통과. 실제 OFP 10개 계획 방식: 3% 3개(ERA KSFO), REFILE 6개, REFILE+EDTO 180 1개. 개발 브라우저(데모): 기본 틀·회사 preset(주입) 표시, 칩 고르기 → 원고 반영, 원고 칩 누르면 바뀜, 음어 입력, 체크, 새로고침 후 유지, 편집(같은 묶음 안 위/아래, 원고 수정 + <입력> 추가, 항목 추가·삭제, 되돌리기). 375·768·1180·1440 × 주간/야간 가로 스크롤 0. 시험 값 지움
- **확인 못 한 것**: 아이패드에서 회사 기준 파일 다시 가져오기 후 preset 표시. 승객 숫자 뜻(K-49). 커밋·배포 안 함
- **답 대기(앞에서)**: 매시간 점검 목록 출처, 노크·음어 기본값, 기장 방송용 책자, FLT LOG
- **다음**: 사용자 확인 → 커밋·배포(요청 시) → 매시간 System Check
- **배포 (2026-11-19)**: 사용자 요청. 7d4e65e push 직후 예시 글에 실제 편명·등록부호가 들어간 것 발견 → 0edbec5에서 DEMO001·HL0000으로 바꾸고 승객 문구 "퍼스트 n분 … 총 n분"(사용자 요청)으로 함께 push. 7d4e65e 안에는 그 값이 이력에 남음(이력 지우기는 강제 push라 하지 않음). GitHub Actions 성공, `/private/` 404

### 2026-11-19 (11) — 매시간 System Check (D-084)
- **완료**: Inflight 화면 "Hourly check" 카드 — 손글씨 순서 칸(TIME·고도계 3·오일 4·ΔP/CAB·FU/FOB), SD 페이지 체크 8개(FCOM 순항 SOP), 메모, 기록 표·손글씨 줄 복사. 고도계 차이 ✓/⚠/Loss of Redundancy, 오일 변화, FU+FOB 합계·출발 FOB 차이, 다음 점검 시각. 📖 FOM 10.4.1.3 · FCOM SOP-150 · LIM-AIR
- **변경 파일**: `hourly/{hourly.ts,HourlyCheck.tsx,hourly.test.ts}`(신규), `inflight/InflightPage.tsx`, `app/styles.css`, 문서(DECISIONS D-084, ARCHITECTURE §3.7s, 이 문서)
- **테스트**: `npm test` 268/268, `tsc -b`, `npm run build` 통과. 개발 브라우저(데모): 사용자 예시 값 기록 → "1700Z 31000/30990/31020 17.4… 8.6/5800 455+2445=2900", 두 번째 기록 F/O 31260 → 주황, 오일 −0.3, 기록 후 칸 비움, SD 연달아 체크. 375·768·1180·1440 × 주간/야간 가로 스크롤 0. 시험 값 지움. FCOM·FOM 없는 개발 브라우저라 📖 창은 못 열어 봄
- **사용자에게 확인**: 예시 455+2445 = 2900(3000 아님) · 고도계 30090은 30990 오타로 봄 · 마지막 "1767/1828"이 무엇인지(아직 칸 없음, 메모에 적을 수 있음)
- **확인 못 한 것**: 아이패드(📖 쪽이 맞게 열리는지). 커밋·배포 안 함
- **다음**: 사용자 답 → 칸 추가 → 커밋·배포(요청 시)

### 2026-11-19 (12) — 키보드 빠른 입력 · 원고 문장형 · 브리핑 기상 · 매시간 기록 칸 (D-085)
- **사용자 답**: 1767/1828 = 조종실·객실 산소 압력. 승객은 "총 몇 분"만(배포함)
- **완료**: 앱 키보드 빠르게·두 번 눌러도 칸 유지(D-085 1). 합동 브리핑 기본 틀 문장형 + {목적지기상}·{교체공항}·{ERA} + "교체공항 · ERA" 문단. 매시간 기록 칸 한 줄형·시각 자동·줄 눌러 수정·↑↓·✕·산소 칸
- **변경 파일**: `app/{AppKeyboard.tsx,styles.css}`, `joint/{template.ts,JointBrief.tsx,joint.test.ts}`, `hourly/{hourly.ts,HourlyCheck.tsx,hourly.test.ts}`, 문서(DECISIONS D-085, 이 문서) · 비공개 build-joint.py·company-rules.json
- **테스트**: `npm test` 269/269, `tsc -b`, `npm run build` 통과. 개발 브라우저(1180): 실제 마우스로 키 빠르게·두 번 누르기 → 31000 정확, 칸 유지. 매시간: 예시 값 기록 → "1700Z 31000/30990/31020 17.4/17.4/17.4/17.4 8.6/5800 455+2445=2900 1767/1828", 시각 자동(0456), 줄 눌러 수정(OIL 2 17.2) 저장, 위로 이동. 합동 브리핑 원고에 목적지·교체 기상 문장(데모는 TAF 기간 밖). 375·768 × 주간/야간 가로 스크롤 0. 시험 값 지움
- **확인 못 한 것**: 실제 아이패드 터치(키보드), 실제 기상 있는 비행의 원고 길이(ERA가 많으면 길어짐). 아이패드에서 회사 기준 파일 다시 가져오기 전엔 preset 대신 기본 틀. 커밋·배포 안 함
- **기다리는 일 (사이드 대화)**: `private/manuals/NEXT-ITEMS.md` 9번 로드시트 사진 OCR → W&B 자동 기입, 10번 비행 후 기록 PDF·자동 업로드(업로드 안정화 먼저)
- **배포 (2026-11-19)**: 사용자 요청. 709c76b push → GitHub Actions 성공, 배포 사이트에 매시간 점검 코드 있음, `/private/` 404. 아이패드 확인 대기(K-48, 회사 기준 파일 다시 가져오기)

### 2026-11-19 (13) — 로드시트 OCR(추가 기능 9번) 시안 (코드 변경 없음)
- **한 것**: 로드시트 형식 확인(A-OPCS 매뉴얼의 ACARS 로드시트 예시), 넣는 방법 2가지(기기 안 OCR · iPad Live Text 붙여넣기), 시안 3개 `private/design/2026-11-19-loadsheet-mockup.html`. 세부는 `private/manuals/NEXT-ITEMS.md` 9번
- **답 대기**: 시안 A/B/C, 실제 로드시트 사진 2~3장(`private/samples/loadsheet/`), 로드시트 칸 뜻 확인
- **다음**: 답 받으면 구현(DB_VERSION 올려 사진 스토어, tesseract.js 오프라인 캐시)

### 2026-11-19 (14) — 아이패드 키보드 다시 만듦 · 오일/ΔP 소수점 · 원고 도시·현지 시각 (D-086)
- **사용자 보고**: iPad Safari에서 키를 빠르게 여러 번 누르면 키보드가 사라짐(Windows 크롬은 정상). 합동 브리핑 원고가 아이패드에서 B안처럼 안 나옴(첫 배포 때 짧은 기본 틀 그대로 — 예전 앱이 남았거나 그 틀이 기기에 저장된 것으로 봄)
- **완료**: D-086 — 아이패드는 초점 없이 "지금 칸"으로 입력(키보드가 글자를 직접 들고 있음, 첫 키 덮어씀, 완료·밖 누르기로 닫힘, 블루투스 키보드 keydown). 매시간 오일·ΔP 자동 소수점(174→17.4, 86→8.6)·FCOM 단위 표시. 원고 {출발도시}·{도착도시}·{도착시각}(현지) — 파서 `aviator-1.7`(HRS UTC±). 예전 기본 틀만 저장된 목록은 새 틀로. 로드시트 결정·추천 → `private/manuals/NEXT-ITEMS.md` 9번
- **변경 파일**: `app/{AppKeyboard.tsx,styles.css}`, `ofp/doc/Fms.tsx`, `inflight/EntrySheet.tsx`, `hourly/{hourly.ts,HourlyCheck.tsx,hourly.test.ts}`, `joint/{template.ts,JointBrief.tsx,cities.ts,joint.test.ts}`, `ofp/{types.ts,parser/aviator.ts,parser/index.ts}`, 문서(DECISIONS D-086, KNOWN_ISSUES K-48, ARCHITECTURE, 이 문서) · 비공개 build-joint.py·company-rules.json·NEXT-ITEMS.md
- **테스트**: `npm test` 271/271(실제 OFP 10개 재파싱 — 도착지 시간대 LAX −7·인천 +9·시드니 +11), `tsc -b`, `npm run build` 통과. 개발 브라우저(1180): 키 연속 4번(같은 순간) → 5555, ⌫·9 → 5559, 다음 칸 → MAX FL 380, 다시 누르면 첫 키 덮어씀, 완료·밖 누르기 닫힘. 매시간 오일 174 → 칸 나오면 17.4, ΔP 86 → 8.6. 원고 "DEMO001 편 인천에서 로스앤젤레스까지". 시험 값 지움
- **확인 못 한 것**: **실제 iPad Safari 터치**(이번 수정의 핵심, K-48). 실제 OFP의 현지 시각 문장
- **배포 (2026-11-19)**: 사용자 요청. 9250fb6 push → GitHub Actions 성공, 배포 사이트에 `aviator-1.7` 코드 있음, `/private/` 404
- **아이패드에서 확인 순서**: ① Settings 맨 아래 build 시각이 새 배포인지(아니면 홈 화면 앱 완전히 닫았다 열기) ② OFP FMS 칸·Inflight Hourly check에서 키 빠르게 연타 ③ Ops → 합동 브리핑 원고가 "○○에서 ○○까지 … (현지 HH:MM)" 문장인지 — 그래도 예전 틀이면 "항목 편집 → 되돌리기" ④ Settings → 회사 기준 파일에 `private/manuals/company-rules.json` 다시 가져오기(합동 브리핑 15문단)
- **다음 (우선순위)**: 1) 아이패드 확인(위 순서) 2) 로드시트 OCR(NEXT-ITEMS 9) — 사용자가 실제 로드시트 사진을 `private/samples/loadsheet/`에 넣으면 시작(결정: C 확인 창 + OFP 값, 확인하면 WEIGHTS L/S 열) 3) 비행 후 기록 PDF(NEXT-ITEMS 10) — 자동 업로드 안정화가 먼저 4) Ops 체크리스트 디자인 시안 · FLIGHT 후보 값

### 2026-11-19 (15) — 합동 브리핑 FOM 6.1.2.3 b) 전 항목 (D-087)
- **사용자 지적**: 좌석벨트 사인 운영·Sterile Cockpit 등 합동 브리핑 필수 항목이 빠짐
- **원인**: 배포 앱 기본 틀(회사 기준 파일 다시 가져오기 전)은 b) 문단이 객실 결함 1개뿐. 회사 preset에도 FOM b)의 안전 고려사항·PIC-객실 협조·장비 결함 정보 교환이 따로 없었음
- **완료**: FOM 6.1.2.3·12.2.10~17·2.2.7~2.3.4·S2.2.1~S2.5·8.2.13·12.2.29~30 다시 대조. 기본 틀 15문단(b) 8개, 일반 문장), 회사 preset 18문단(b) 10개), `{안전요점}` 자동 값, 새 문단 [넣기] 버튼, preset 없을 때 주황 안내
- **변경 파일**: `joint/{template.ts,JointBrief.tsx,joint.test.ts}`, 문서(DECISIONS D-087, 이 문서) · 비공개 `private/manuals/{build-joint.py,company-rules.json}`
- **테스트**: `npm test` 274/274, `tsc -b`, `npm run build` 통과. 회사 기준 파일 형식 점검 통과(18문단 렌더). 개발 브라우저(데모, 회사 파일 없음): b) 8문단·원고 문장·안전요점 "EDTO 180 비행, 3% Contingency 운항, MEL/CDL 3건(…)" 확인, 375·768·1440 × 주간/야간 가로 스크롤 0
- **확인 못 한 것**: 회사 기준 파일을 앱에 가져온 뒤 18문단 화면(파일 형식·렌더만 확인). 아이패드. 커밋·배포 안 함
- **아이패드에서**: 배포 후 Settings → 회사 기준 파일에 `private/manuals/company-rules.json` 다시 가져오기 → Ops 합동 브리핑 "첫 비행·교체"에 좌석벨트·Sterile 등 나오는지. 원고를 고쳐 쓰던 중이면 "새 문단 n개 [넣기]"
- **다음**: 사용자 확인 → 커밋·배포(요청 시) → 아이패드 확인(K-48) → 로드시트 OCR(NEXT-ITEMS 9)

### 2026-11-19 (16) — OFP 카드 정리 · OPS PLAN · 매시간 연료/오일 요약 · 새 배포 자동 받기 (D-088)
- **사용자 보고(아이패드)**: ΔP 86이 8.6으로 안 바뀜, 새로 고침해도 옛날 합동 브리핑 → 배포 사이트 JS에 D-086 코드가 있는 것 확인 = **아이패드가 예전 서비스 워커 캐시 사용**. 새 버전 자동 확인·다시 불러오기 추가
- **완료**: OPS PLAN 칸, FLIGHT+ALTERNATES, 순서 FUEL·WEIGHTS → RVSM·SYSTEMS(한 카드) → FMS, 같은 줄 높이 맞춤, 매시간 요약 상자(ALT 차이·FUEL vs RAMP·OIL 사용)
- **변경 파일**: `main.tsx`, `ofp/doc/{OfpDocument.tsx,Fms.tsx}`, `hourly/{hourly.ts,HourlyCheck.tsx,hourly.test.ts}`, `joint/joint.test.ts`, `app/styles.css`, 문서(DECISIONS D-088, 이 문서)
- **테스트**: `npm test` 276/276, `tsc -b`, `npm run build` 통과. 개발 브라우저(데모): 1180에서 FUEL/WEIGHTS 414·414, RVSM·SYSTEMS 505(좌우 두 칸), FMS/ETP 343·343. ΔP 86 → 8.6, 오일 172/174/171/174 기록 후 169/172/171 → −0.3/−0.2/±0, FUEL vs RAMP 표시. 375·768·1180·1440 × 주간/야간 가로 스크롤 0. 시험 값 지움
- **확인 못 한 것**: 실제 아이패드(새 배포 자동 받기 포함). 1440 폭은 3열이라 WEIGHTS 옆 한 칸 빔. 커밋·배포 안 함(D-087 포함)
- **아이패드에서 (배포 후)**: 이번 한 번은 앱을 완전히 닫았다 열거나 두 번 새로 고침(예전 서비스 워커에는 자동 받기 코드가 없음) → Settings 맨 아래 build 시각 확인 → 이후 배포는 자동. 그다음 회사 기준 파일 다시 가져오기(합동 브리핑 18문단)
- **다음**: 커밋·배포(요청 시) → 아이패드 확인 → 로드시트 OCR(NEXT-ITEMS 9)

### 2026-11-19 (17) — 앱 키보드 ± 키 (D-089)
- **사용자 선택**: 시안 C(숫자판 오른쪽 세로 열)에서 = PLAN 빼기. 같은 메시지의 나머지 요청(ΔP·램프 연료·오일·OPS PLAN·카드 합치기·높이)은 (16)에서 이미 완료
- **완료**: 숫자판 +10 · +1 · −1 · −10, 기준값(칸 값 → 계획 값 → 0) 막대 표시, 칸별 계획 값(D-089 3), 소수 칸 0.1 단위
- **변경 파일**: `app/{kbStep.ts,kbStep.test.ts,AppKeyboard.tsx,styles.css}`, `ofp/doc/{Fms.tsx,OfpDocument.tsx}`, `hourly/HourlyCheck.tsx`, `inflight/EntrySheet.tsx`, 문서(DECISIONS D-089, 이 문서) · 비공개 시안 `private/design/2026-11-19-keyboard-step-mockup.html`
- **테스트**: `npm test` 280/280, `tsc -b`, `npm run build` 통과. 개발 브라우저(1180·768, 데모): MAX FL 빈칸 +10 → 360(OFP 350), −1 → 359, 이어서 370 치면 370, FOB +0.1 → 107.5, GATE ± 흐림, 매시간 오일1 174 → 오일2 기준 17.4 · −0.1 → 17.3, TIME 기준 칸 값. 768 가로 스크롤 0, 키 글자 넘침 없음. 시험 값 지움
- **확인 못 한 것**: 실제 아이패드 터치. 순항 기록 FUEL에 100 단위 줄임 값(2445)을 쓴 뒤 ±는 원래 단위로 계산됨(빈칸·전체 값은 정상). 커밋·배포 안 함(D-087~D-089)
- **다음**: 커밋·배포(요청 시) → 아이패드 확인((16)의 순서 + 키보드 ±) → 로드시트 OCR(NEXT-ITEMS 9)
- **배포 (2026-11-19)**: 사용자 요청. 5f31ad6 push → GitHub Actions 성공, 배포 사이트 JS에 OPS PLAN·± 기준·FUEL vs RAMP·합동 브리핑 새 문단·서비스 워커 자동 갱신 코드 있음, `/private/` 404. 아이패드 확인 대기(앱 완전히 닫았다 열기 1회 → Settings build 시각 → 회사 기준 파일 다시 가져오기)

### 2026-11-19 (18) — RVSM · SYSTEMS 카드 다시 나눔 (D-090)
- **사용자 보고**: 아이패드에서 FLIGHT+ALTERNATES 합친 게 안 보임 → 배포 사이트(build 2026-11-19T06:26Z)를 직접 열어 보니 합쳐져 있고 순서도 맞음 = 아이패드가 아직 예전 버전. 새로 고침 두 번·탭 다시 열기 안내(웹사이트 데이터 지우기는 OUTBOX 21건 때문에 하지 말 것)
- **완료**: RVSM · ALTIMETERS / SYSTEMS · PRE-FLIGHT 다시 두 카드, 순서 그대로
- **테스트**: `npm test` 280/280, `tsc -b`, `npm run build` 통과. 개발 브라우저 1180: FUEL|WEIGHTS 414, RVSM|SYSTEMS 484, FMS|ETP 343. 768 순서 FLIGHT > FUEL > WEIGHTS > RVSM > SYSTEMS > FMS, 375·768·1180 가로 스크롤 0
- **확인 못 한 것**: 아이패드. 커밋·배포 안 함
- **다음**: 배포(요청 시) → 아이패드에서 build 시각 확인 → 로드시트 OCR(NEXT-ITEMS 9)

### 2026-11-19 (19) — 아이패드 예전 화면 대응: 앱 버전 표시 · 앱 파일 새로 받기 · 저장 원고 안내 (D-091) (다음 세션은 여기서 시작)
- **사용자 보고**: 배포 뒤에도 아이패드 합동 브리핑이 첫 배포 원고(7문단)
- **확인**: 배포 서비스 워커 미리 받기 파일 22개 모두 200. 첫 배포 원고 틀은 지금 코드가 예전 틀로 인식 → 원인 = 예전 앱이 남음 또는 고친 원고 저장. D-091로 화면에서 구분·해결
- **변경 파일**: `app/{App.tsx,styles.css}`, `settings/SettingsPage.tsx`, `joint/JointBrief.tsx` + (18)의 D-090 파일, 문서
- **테스트**: `npm test` 280/280, `tsc -b`, `npm run build` 통과. 개발 브라우저: 고친 원고를 기기에 넣고 → 주황 상자·새 문단 13개 표시 → [최신 원고로 바꾸기] → 15문단. 배포판 미리보기(:4173): [앱 파일 새로 받기] → 다시 불러옴, IndexedDB 시험 값 남음, 서비스 워커 다시 등록. 시험 값 지움
- **아이패드에서**: 사이드바 맨 아래 BUILD 시각 확인 → 예전이면 새로 고침 두 번(그래도면 탭 닫고 다시 열기) → 새 버전이면 Settings [앱 파일 새로 받기]는 앞으로 쓸 수 있음 → 합동 브리핑 맨 위 주황 상자가 보이면 [최신 원고로 바꾸기] → 회사 기준 파일 다시 가져오기

- **배포 (2026-11-19)**: b72f105 push → GitHub Actions 성공, 배포 build 2026-11-19T06:40Z(한국 15:40), 배포 JS에 앱 파일 새로 받기·최신 원고로 바꾸기·BUILD 표시·RVSM/SYSTEMS 나눔 있음, `/private/` 404
