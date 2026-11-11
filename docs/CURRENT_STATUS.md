# CURRENT STATUS — 현재 개발 상태

> **새 세션은 이 문서부터 읽는다.** 작업이 끝날 때마다 맨 아래 "세션 인계"와 관련 표를 갱신한다.
> 상태 표기: ✅ 완료 · 🔄 진행 중 · ⏳ 대기 · ❓ 미확인 · ❌ 오류 발생
> 마지막 갱신: 2026-11-10 (Phase 5 배포 7ef2954)

## 1. 한눈에

| 항목 | 상태 |
|---|---|
| 현재 Phase | **Phase 5 매뉴얼·MEL·얼러트 배포 (7ef2954, 2026-11-10, D-044~D-048)** — 남은 것: 아이패드 확인, minima·측풍 규칙(K-28). Phase 4 NOTAM은 배포됨(e236b29), 아이패드 확인 대기 |
| 테스트 | ✅ `npm test` 139개 통과 (실제 OFP 샘플 10개·NOTAM 원문 대조·실제 MEL 대조 포함), `tsc -b` 통과, `npm run build` 통과 (2026-11-10 FOM 근거 연결) |
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
| 3.5 4D | 시간 슬라이더·SIGMET 교차 | ⏳ | |
| 4 NOTAM | OFP NOTAM 파싱·분류 | ✅ 로컬·배포 / ⏳ 아이패드 확인 | D-043. 샘플 10개 패키지별 건수 일치, NOTAM 탭(공항·FIR·분류·강조·근거·원문 이동). e236b29 배포 |
| 5 매뉴얼·MEL·얼러트 | 1 넣기 → 2 MEL·CDL 매칭·보기·검색 → 3 얼러트 엔진 → (6 AI 질의) | ✅ 로컬·배포 / ⏳ 아이패드 확인 | D-044·D-045·D-046. MEL·Manual 탭, 대시보드 Alerts. A380 MEL·CDL·FCOM·FCTM 수령(`private/manuals/inbox`), FOM 대기. 묶음 4개 2.2MB |
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
| 5 | 얼러트 임계값의 매뉴얼 근거 | 🔄 착륙 예상 연료 = FOM 8.2.1·8.2.1.1·8.2.1.2 (D-048). 편차 %·여유 t·SR은 FOM에 수치 없음 → 임시 유지 |
| 6 | 변환할 매뉴얼 목록 | 🔄 A380 MEL·CDL·FCOM·FCTM + FOM·FCRM 수령 (2026-11-10). B78X 매뉴얼 여부 미확인 |
| 7 | 호스팅 | ✅ GitHub Pages (D-005) |

## 7. 다음에 할 작업 (우선순위)

1. **사용자 Phase 3 확인** — `LOCAL_TEST.md` §9
2. ~~Cloudflare Worker 기상 중계~~ ✅ 설치됨 (2026-11-05). GitHub Pages 주소가 정해지면 Worker 변수 `ALLOWED_ORIGINS` 설정
3. ~~아이패드 실사용 테스트~~ ✅ 사용자 확인 (2026-11-05). 실사용 중 문제 생기면 KNOWN_ISSUES에 추가
4. 실제 Apps Script 설치·연동 확인
5. ~~Worker `ALLOWED_ORIGINS`~~ ✅ 설정됨 (2026-11-05: github.io·localhost 5173/4173 허용, 그 외 403 확인)
6. ~~Phase 4(NOTAM)~~ 배포 완료 (2026-11-10, e236b29) → **아이패드에서 실제 OFP로 확인**(`LOCAL_TEST.md` §10)
7. **Phase 5 아이패드 확인**: 배포됨(7ef2954). 구글드라이브에 묶음 5개(`private/manuals/out/*.efbman.json.gz`) 올리기 → 매뉴얼 가져오기·MEL·Manual·Alerts 확인(`LOCAL_TEST.md` §11·§12). FOM 근거 연결됨(D-048). 남은 것: minima·측풍 규칙(K-28, FOM 4.1.3·4.1.3.9 + 공항별 자료)
8. NOTAM 후속(선택): 근거 문서 원문 대조(K-23), D) 시간표(K-22)

## 8. 세션 인계 (가장 최근 작업)

### 2026-11-11 — MEL 항목 보기 화면 정리
- **문제(사용자 제보)**: 얼러트·MEL에서 MEL 항목을 누르면 쪽 전체가 나오고, 쪽 머리 그림 글(MEL ITEMS…)이 본문처럼 보이며, 그림 글로 바뀐 "Repair interval / Nbr installed …" 표가 글 두 줄로 깨져 보임
- **완료**: 항목 번호로 열면 **그 항목만** 보여 줌(상위 항목 제목·Ident부터 다음 항목 전까지, 쪽을 넘기면 다음 쪽 이어 붙임 — 쪽 표시 "P 1/4 ~ 2/4"), "쪽 전체 보기" 버튼으로 전환(전체 보기에서는 해당 항목으로 스크롤·강조). 그림 글 표 → 진짜 표(머리 줄 구분), 쪽 머리 → 작은 회색 한 줄, 번호만 있는 제목+다음 제목 합침, Ident 줄 작게, 하위 목록 들여쓰기. 표시만 바꿈 — 묶음 다시 만들 필요 없음(파서 버전 그대로)
- **변경 파일**: `src/features/manual/{lookup.ts,ManualText.tsx,ManualPage.tsx,manual.test.ts}`, `src/app/styles.css`, `docs/ARCHITECTURE.md` §3.7c
- **테스트**: `npm test` 142/142, `tsc -b`, `npm run build` 통과. 개발 브라우저에 A380-MEL 묶음을 넣어(임시 127.0.0.1 서버, 확인 후 종료) MEL 하위 항목 열기 확인(1180 주간·375 야간), 375·768·1440 가로 스크롤 0. 전체 MEL 하위 항목 1,242개 모두 항목만 보기 성공(342개는 두 쪽 이상), 다른 항목 섞임 0
- **주의**: 개발 브라우저 IndexedDB에 A380-MEL 묶음이 들어 있음(Mac 안)
- **배포**: 사용자 요청으로 커밋 4924018 push → GitHub Actions 성공, 배포 사이트에 새 코드 확인, `/private/` 404. 커밋 전 공개 코드 주석·테스트에서 실제 매뉴얼 제목을 가상 예시로 바꿈
- **다음**: 아이패드에서 얼러트·MEL 탭의 매뉴얼 쪽 열기 확인(새 버전은 새로고침 1~2회 — K-09)

### 2026-11-10 — Phase 5 커밋·배포
- **배포**: 사용자 요청("커밋·배포"). 첫 push는 작업 환경 안전장치가 공개 게시로 막음 → 사용자 선택("요약 빼고 올리기")으로 공개 코드·문서에서 FOM 내용 요약을 빼고 절 번호·제목만 남김(요약은 `private/manuals/NOTES-fom-basis.md`), 실제 개정 번호 예시도 가상 값으로 바꿈, 아직 안 올린 커밋에 합쳐 7ef2954로 push → GitHub Actions 성공, 배포 사이트 새 코드(`manual-1.4`, 얼러트) 확인, `/private/` 404. 커밋 전 실제 편명·등록번호·항공사명 검사 통과
- **다음**: 아이패드에서 매뉴얼 가져오기·MEL·Manual·Alerts 확인(`LOCAL_TEST.md` §11·§12, 새 버전은 새로고침 1~2회 — K-09)

### 2026-11-10 — 연료 경고 기준 FOM 근거 연결 (D-048, 사용자 승인)
- **완료**: 착륙 예상 연료 단계 < FINAL 경고 · < FINAL×130% 경고 · < ALTN+FINAL 주의(FOM 8.2.1.2·8.2.1.1·8.2.1), ½FINAL 임시 주의 삭제, 편차 −2%는 임시 유지. Inflight 라벨·FINAL×130% 칸. 얼러트 근거에 FOM 절 링크(연료·블록·ETP·SR), FOM 없으면 글자만
- **변경 파일**: `src/features/inflight/{deviation.ts,InflightPage.tsx,deviation.test.ts}`, `src/features/alerts/{fomRefs.ts(신규),types.ts,useAlerts.ts,AlertsCard.tsx,alerts.test.ts,rules/{fuelProjection,planMargins,turbulence}.ts}`, `src/features/manual/lookup.ts`, 문서(DECISIONS D-025 표시·D-048, KNOWN_ISSUES K-03, PROJECT_SPEC §5.10, ARCHITECTURE §3.7d)
- **테스트**: `npm test` 139/139, `tsc -b`, `npm run build` 통과. 개발 브라우저에서 시험 기록(예상 착륙 FINAL×120%) → Alerts "FINAL×130% (MINIMUM FUEL)" 경고 + FOM 8.2.1.1·8.2.1·6.5.3.1 링크 → 누르면 FOM 8.2.1.1 p.471, Inflight 라벨 MIN FUEL PREP·FINAL×130% 칸 확인. 시험 기록·대기 전송·얼러트 기록은 확인 후 지움. 375·768 가로 스크롤 0, 콘솔 오류 없음
- **다음**: 사용자 요청 시 커밋·배포 → 아이패드 확인. minima·측풍 규칙(K-28)

### 2026-11-10 — FOM(+FCRM) 매뉴얼 추가 (D-047)
- **완료**: 사용자 FOM 변환본(marker, MD + _meta.json)을 `private/manuals/inbox/`에 보관(그림 jpeg는 안 옮김). 절 단위 나누기(번호 제목·제 N 장, FOM/FCRM 구분, span·목차 json으로 PDF 쪽), 파일 이름 종류·개정·날짜 판정, 절 번호 바로가기·`[FOM x.y]` 참조 링크. 묶음 GEN-FOM 1,997절(PDF 쪽 표시 1,996), 0.5MB. 파서 `manual-1.4`(나머지 4개 묶음도 다시 만듦)
- **찾은 것**: 연료·minima 관련 FOM 절 위치 확인(요약은 `private/manuals/NOTES-fom-basis.md`) → D-048에서 반영
- **테스트**: `npm test` 138/138, `tsc -b`, `npm run build` 통과. 개발 브라우저에 묶음 5개 넣어 `FOM 6.5.3.1` 바로가기(p.360), 한글 검색 "Final Reserve Fuel 착륙" 확인
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
- **결과**: 묶음 MEL 2,088쪽·하위 항목 1,242 / CDL 488쪽·209항목 / FCOM 6,938쪽 / FCTM 478쪽, 합계 2.2MB(gz), 만드는 데 3초. OFP 샘플 MEL 19종·CDL 3종 전부 매뉴얼에서 찾음
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
