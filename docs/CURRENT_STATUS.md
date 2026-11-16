# CURRENT STATUS — 현재 개발 상태

> **새 세션은 이 문서부터 읽는다.** 작업이 끝날 때마다 맨 아래 "세션 인계"와 관련 표를 갱신한다.
> 상태 표기: ✅ 완료 · 🔄 진행 중 · ⏳ 대기 · ❓ 미확인 · ❌ 오류 발생
> 마지막 갱신: 2026-11-16 (D-061~D-076, 커밋 전)

## 1. 한눈에

| 항목 | 상태 |
|---|---|
| 현재 Phase | **Phase 5 매뉴얼·MEL·얼러트 배포 (7ef2954, 2026-11-10, D-044~D-048)** + **운항관리사식 Briefing(D-049~D-054) 배포 (1e432fe, 2026-11-12)** — 남은 것: 아이패드 확인, 회사 기준 파일 가져오기 확인. Phase 4 NOTAM은 배포됨(e236b29), 아이패드 확인 대기. **추가 기능 목록 1~8 (D-055~D-060: FIR 통신·Ops 탭·버티컬 뷰·FIR 경계·기상 추가) 배포 (fe06c57, 2026-11-12)** — Worker 재배포 필요(K-35), 아이패드 확인 대기. 목록: `private/manuals/NEXT-ITEMS.md` |
| 테스트 | ✅ `npm test` 242개 통과 (2026-11-16 AGTOW 12개 포함) · 이전: 230개 (항로·OFP 번호 일치) · 이전: 214개 · 이전: 212개 (기상 시간대·난류 지수) · 이전: 198개 (2026-11-12 Ops·버티컬·기상 추가 포함) · 이전: 167개 (2026-11-11 Briefing 포함) · 이전: 139개 통과 (실제 OFP 샘플 10개·NOTAM 원문 대조·실제 MEL 대조 포함), `tsc -b` 통과, `npm run build` 통과 (2026-11-10 FOM 근거 연결) |
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

### 2026-11-16 (7) — NAV LOG 숫자 색 (D-075) · 매뉴얼 쪽 사진 묶음 (D-076)
- **완료**: NAV LOG 줄 색 제거, SR 숫자 등급 색·굵게(구간은 이름 왼쪽 선), MSA 100 이상만 굵게·진한 주황. 매뉴얼: Mac `npm run manuals -- --images` → 그림·표 쪽만 JPEG 사진 묶음 `.efbimg`(매뉴얼별, 40MB 부분 나눔), 앱 가져오기·"🖼 원본 쪽 사진" 보기, DB v4
- **변경 파일**: `ofp/doc/NavLog.tsx`, `tools/manual-convert/{pdf2img.py(신규),build.ts}`, `db/schema.ts`(v4), `manual/{store.ts,ManualCard.tsx,PageImages.tsx(신규),ManualInline.tsx,ManualPage.tsx}`, `app/styles.css`, 문서(DECISIONS D-075·076, ARCHITECTURE §3.7o, KNOWN_ISSUES K-29, LOCAL_TEST §21)
- **사진 묶음 결과** (`npm run manuals -- --images`, 약 5분): CDL 488/488쪽 연결·사진 220쪽 9.5MB · FCOM 6938/6938·3805쪽 198.7MB(5개 파일) · FCTM 478/478·137쪽 8.2MB · MEL 2088/2088·39쪽 2.6MB. FOM은 원본 PDF가 없어 없음
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
