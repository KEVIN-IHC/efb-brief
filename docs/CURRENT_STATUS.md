# CURRENT STATUS — 현재 개발 상태

> **새 세션은 이 문서부터 읽는다.** 작업이 끝날 때마다 맨 아래 "세션 인계"와 관련 표를 갱신한다.
> 상태 표기: ✅ 완료 · 🔄 진행 중 · ⏳ 대기 · ❓ 미확인 · ❌ 오류 발생
> 마지막 갱신: 2026-11-10 (Phase 4 NOTAM 세션 종료 시점)

## 1. 한눈에

| 항목 | 상태 |
|---|---|
| 현재 Phase | **Phase 4 NOTAM 로컬 구현·검증 완료 — 사용자 확인 대기** (커밋·배포 안 함). Phase 3까지 배포·사용자 확인 완료 |
| 테스트 | ✅ `npm test` 111개 통과 (실제 OFP 샘플 10개 + NOTAM 원문 대조 포함), `tsc -b` 통과, `npm run build` 통과 (2026-11-10 Phase 4) |
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
| 4 NOTAM | OFP NOTAM 파싱·분류 | ✅ 로컬 / ⏳ 사용자 확인 | D-043. 샘플 10개 패키지별 건수 일치, NOTAM 탭(공항·FIR·분류·강조·근거·원문 이동). 미커밋 |
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
| 5 | 얼러트 임계값의 매뉴얼 근거 | ⏳ 임시값 사용 중 (D-023, D-025) |
| 6 | 변환할 매뉴얼 목록 | ❓ 미확인 |
| 7 | 호스팅 | ✅ GitHub Pages (D-005) |

## 7. 다음에 할 작업 (우선순위)

1. **사용자 Phase 3 확인** — `LOCAL_TEST.md` §9
2. ~~Cloudflare Worker 기상 중계~~ ✅ 설치됨 (2026-11-05). GitHub Pages 주소가 정해지면 Worker 변수 `ALLOWED_ORIGINS` 설정
3. ~~아이패드 실사용 테스트~~ ✅ 사용자 확인 (2026-11-05). 실사용 중 문제 생기면 KNOWN_ISSUES에 추가
4. 실제 Apps Script 설치·연동 확인
5. ~~Worker `ALLOWED_ORIGINS`~~ ✅ 설정됨 (2026-11-05: github.io·localhost 5173/4173 허용, 그 외 403 확인)
6. ~~Phase 4(NOTAM)~~ 로컬 완료 (2026-11-10) → **사용자 확인**(`LOCAL_TEST.md` §10) → 커밋·배포는 사용자 요청 시
7. Phase 3.5(4D 슬라이더·SIGMET 교차) 또는 Phase 5 — 사용자 선택
8. NOTAM 후속(선택): 근거 문서 원문 대조(K-23), D) 시간표(K-22)

## 8. 세션 인계 (가장 최근 작업)

### 2026-11-10 — Phase 4 NOTAM (조사 → 계획 승인 → 구현 → 로컬 검증)
- **완료**: 샘플 10개 NOTAM 구조 조사(패키지 1 공항 / 2 경로 공항 / 3 FIR, Q) 줄 없음). 기존 구간 탐지 버그 수정(시작 줄 공백 여러 칸·끝 줄을 시작으로 잡던 문제). NOTAM 추출기(패키지·공항/FIR·분류 제목·번호·유효기간·D/E/F/G/COMMENT·원문 줄, 버리는 줄 없음), 교차검증 `notamCount`. 분류·강조·근거(D-043), 비행 시간대·FIR 통과 시간대 겹침, NOTAM 탭, 다른 탭 → 원문 줄 이동. K-16 해결(구간 표시 전부 verified). 파서 `aviator-1.3`
- **샘플 결과**: 10개 모두 패키지별 "머리 줄 수 = 추출 건수" + 끝 표시 확인 (예: 샘플 1 = 67/142/85). 샘플 1의 7건을 원문과 직접 대조(번호·위치·기간·본문·분류·칩) — 기대값은 `private/samples/notam.expect.json`(커밋 금지)
- **변경 파일**: `src/features/ofp/parser/{notam.ts(신규),sections.ts,extractors.ts,index.ts,parser.test.ts,samples.test.ts}`, `src/features/ofp/{types.ts,OfpPage.tsx,sourceJump.ts(신규)}`, `src/features/notam/{refs,classify,relevance}.ts·NotamPage.tsx·notam.test.ts(신규)`, `src/app/{App.tsx,tabs.tsx,styles.css}`, 문서(DECISIONS D-043, KNOWN_ISSUES K-16🟢·K-22~24, PROJECT_SPEC §5.3·§5.8, ARCHITECTURE, LOCAL_TEST §10)
- **테스트**: `npm test` 111/111, `tsc -b` 통과, `npm run build` 통과. 개발 브라우저에 샘플 1을 넣어(임시 127.0.0.1 서버, 확인 후 종료·삭제) NOTAM 탭 295항목 표시, 원문 링크 → OFP 원문 L1047 강조 확인, 375·768·1180·1440 × 주간/야간 가로 스크롤 0, 콘솔 오류 없음(임시 서버 연결 1건 제외). PDF 추출(pdfText) 변경 없어 샘플 텍스트 재생성은 안 함
- **해결 못 한 것**: 사용자 확인 전. 커밋·push·배포 안 함. 근거 문서 일부 원문 대조 전(K-23), D) 시간표 미해석(K-22). 공항 안 순서는 OFP 원문 순서 그대로(회사 권고가 앞에 와서 긴 공항은 스크롤 많음)
- **주의**: 개발 브라우저(앱 내장 브라우저) IndexedDB에 샘플 1 원문이 현재 비행으로 들어 있음 — Mac 안에만 있음
- **다음**: 사용자 확인(`LOCAL_TEST.md` §10) → 요청 시 커밋·배포 → Phase 3.5 또는 5

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
