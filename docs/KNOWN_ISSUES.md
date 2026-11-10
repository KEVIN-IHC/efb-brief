# KNOWN ISSUES — 알려진 문제·제약

> 상태: 🔴 미해결 · 🟡 완화됨/임시 · 🟢 해결(기록 보존) · ⚪ 설계상 제약
> 새 문제를 발견하면 번호를 이어서 추가한다. 해결되면 지우지 말고 🟢로 바꾼다.

## K-01 아이패드 실기기 미확인 🟢 (2026-11-05 사용자 확인 "잘 작동함" — 항목별 세부 결과는 미수령)
- **설명** 모든 화면·오프라인 동작은 Mac 브라우저에서만 확인. iPad Safari 홈 화면 앱으로 설치·실행한 적 없음
- **발생 조건** iPad에서 오프라인 앱 설치는 HTTPS 필요 (`http://Mac-IP:5173`은 화면만 가능)
- **재현** —
- **관련 파일** 전체, `vite.config.ts`(PWA)
- **시도** 없음
- **향후** Cloudflare 임시 터널(`cloudflared tunnel --url http://localhost:4173`) 또는 GitHub Pages로 설치 → 비행기 모드·OFP 열기·입력 시트(키보드 가림)·주간/야간 확인

## K-02 실제 Apps Script·구글 시트 연동 미확인 🔴
- **설명** 동기화는 Mock GAS로만 검증. 실제 배포 시 리다이렉트·CORS·권한·LockService 동작 미확인
- **관련 파일** `apps-script/Code.gs`, `src/sync/gasClient.ts`
- **향후** 사용자가 `setup()`·배포 후 Settings 연결 테스트 → 메모·웨이포인트 기록이 `Logs` 탭에 1행씩, Drive JSON 백업 생성 확인

## K-03 경고 기준이 임시값 🟡 (일부 해결: 착륙 예상 연료는 FOM 근거 D-048)
- **설명** 연료 편차(−2% TRIP), SR(5/7), 중량·연료·ETP 여유(2t/1t/1.5t)는 수치 근거가 회사 매뉴얼에 없음(FOM에 해당 수치 없음 확인, 2026-11-10). 착륙 예상 연료는 FOM 8.2.1·8.2.1.1·8.2.1.2로 교체(D-048)
- **관련 파일** `inflight/deviation.ts` (`FUEL_DEV_RULES`), `ofp/turbulence.ts` (`SR_THRESHOLDS`), `ofp/margins.ts` (`THRESHOLDS`)
- **현재** 화면에 "임시 기준 · 회사 매뉴얼 확인 필요" 표시. 얼러트(D-046)에도 "임시 기준 · 매뉴얼 근거 없음"으로 표시
- **향후** 사용자에게 매뉴얼 근거 받기(원본 명세 미결 #5) → 값 수정 + Settings로 이동 + DECISIONS 갱신

## K-04 OT(기온) 부호 없음 ⚪
- **설명** Aviator NAV LOG의 OT 칸은 부호가 없어(FL390 `48` = −48°C) 원문 그대로 표시. 지상 부근 양/음 구분 불가
- **관련 파일** `parser/aviator.ts` (`tempText`), `doc/NavLog.tsx`
- **향후** 필요하면 CRZ WIND 요약표의 부호 있는 기온(같은 지점·FL)으로 보강 검토

## K-05 ETO/ETA는 택시 시간 미반영 ⚪
- **설명** ETO = ETD + ACTM. OFP의 ETA = ETD + 비행시간과 일치하지만, ETD가 EOBT(블록 아웃)라면 실제 이륙과 택시 시간만큼 차이
- **관련 파일** `parser/aviator.ts`, `parser/index.ts` (`std`=`takeoff`=ETD)
- **향후** 순항 기록은 ATA 실측으로 시간 편차를 반영하므로 영향 작음. 필요 시 사용자 확인

## K-06 개발 서버 HMR 중 현재 비행 미로드 🟡
- **설명** 개발 중 코드 자동 교체(HMR)와 앱 시작이 겹치면 현재 비행이 DEMO로 보인 적 있음 (DB에는 정상)
- **재현** `npm run dev` 상태에서 `activeFlight.ts` 등 수정 직후 새로고침 — 간헐적
- **관련 파일** `src/app/App.tsx`(재시도 안전장치 추가), `src/main.tsx`(`[boot]` 오류 로그)
- **현재** 안전장치 이후 재발 없음. 배포판(HMR 없음)에는 해당 없음으로 판단 ❓

## K-07 iOS에서 "공유 → 앱으로 열기" 불가 ⚪
- **설명** iOS 홈 화면 웹앱은 Web Share Target 미지원 → 메일 첨부 OFP는 파일 앱에 저장 후 "OFP 열기"로 선택
- **관련 파일** `ofp/OfpOpenButton.tsx`

## K-08 iOS Background Sync 없음 ⚪
- **설명** 앱이 닫혀 있으면 업로드 안 됨 → 앱을 열거나 화면 복귀 시 동기화 (D-002)

## K-09 Service Worker 업데이트 지연 ⚪
- **설명** 새 버전 배포 후 처음 열 때는 이전 버전, 새로고침 1~2회 후 반영 (`autoUpdate`)
- **향후** 필요 시 "새 버전 있음" 안내 배너

## K-10 데모·테스트 흔적 데이터 🟡
- **설명** 개발 브라우저(:5173) IndexedDB에 가짜 PDF 업로드 기록(`upload-…`, 추출 불완전)과 데모 비행이 남아 있음. 사용자 기기와 무관
- **향후** 필요 시 PDF·추출 탭에서 삭제

## K-11 MEL 제목 잘림 ⚪
- **설명** OFP 디스패치 릴리스의 MEL/CDL 설명이 원문에서 잘려 있음(예: `ANGULAR ADJU`) → 그대로 표시
- **향후** Phase 5 MEL DB 매칭으로 전체 명칭 보강

## K-12 FPL 후류 등급 차이 무시 ⚪
- **설명** OFP 안 FPL 블록끼리 `A388/J`와 `A388/H`처럼 후류 등급이 다를 수 있음(디스패치 노트: 제출본 우선). 비교에서 제외
- **관련 파일** `parser/fpl.ts` (`compareFpl`)

## K-13 Git 커밋 없음 🟢 (2026-11-05 첫 커밋·GitHub 업로드)
- **설명** `git init`만 됨, 커밋 0개, 스테이징은 초기 상태라 오래됨. 되돌리기 지점이 없음
- **향후** 사용자 확인 후 첫 커밋 (`private/`는 gitignore로 제외 확인됨)

## K-14 연료 그래프 끝 라벨 겹침 🟡
- **설명** 그래프 오른쪽 끝에서 예상 착륙 연료 숫자가 마지막 점과 겹칠 수 있음(미관상)
- **관련 파일** `inflight/FuelChart.tsx`

## K-15 OFP 샘플을 외부 AI가 읽음 ⚪
- **설명** 샘플 10개는 사용자가 Claude(Anthropic)로 전송됨을 알고 제공. 사내 보안 규정 확인은 사용자 책임(원본 명세 §16)
- **향후** 새 샘플은 개인정보 가린 지난 비행 OFP 권장

## K-16 구간 표시 `verified` 플래그 미갱신 🟢 (2026-11-10 Phase 4에서 샘플 확인 후 전부 `verified: true`)
- **설명** 샘플 10개로 Aviator 구간 표시 문자열(ROUTE TO ALTN, REFILE, END OF JEPPESEN, EQUAL TIME POINT, WIND SUMMARY, DISPATCH RELEASE)을 검증했지만 `sections.ts`의 `verified: false`가 그대로라 PDF·추출 화면에 "샘플 확인 전" 칩이 표시됨
- **관련 파일** `src/features/ofp/parser/sections.ts`
- **향후** 샘플로 실제 확인된 항목만 `verified: true`로 변경 (NOTAM PACKAGE 1/2/3은 Phase 4에서 확인). 문서 작업 세션이라 코드 미변경

## K-17 아이패드·배포판에는 기상 중계가 없음 🟢 (2026-11-05 Cloudflare Worker 설치)
- **설명** METAR·TAF·SIGMET은 중계가 필요(D-034). 지금은 Mac 개발·미리보기 서버(`/wx`)만 중계함 → GitHub Pages·아이패드(터널 포함 배포판 외)에서는 이 세 가지가 "실패"로 표시됨. 바람·위성·지도는 영향 없음
- **향후** 사용자가 Cloudflare 무료 계정 만든 뒤 같은 규격(`/awc/<metar|taf|isigmet|airsigmet>`) Worker 설치 → Settings "기상 중계 주소"에 입력

## K-18 기상 캐시 삭제 기준이 근사치 🟡
- **설명** 명세는 "비행 종료 7일 후 삭제"지만 구현은 "받은 지 7일 지난 기상·위성 캐시 삭제"(`loadWxCache`). 현재 비행 기상은 계속 다시 받으므로 실사용 차이는 작음
- **관련 파일** `src/features/weather/store.ts`

## K-19 비행 등급 색은 미국 FAA 기준 ⚪
- **설명** VFR/MVFR/IFR/LIFR는 aviationweather.gov 값(없으면 FAA 기준 계산). 회사·국가 최저치와 다를 수 있음 — 참고용 표시

## K-20 지도 FL 선택 없음 ⏳
- **설명** 바람 화살표·표는 웨이포인트 OFP 계획 고도(없으면 순항 FL) 기준. 명세의 "FL 수동 변경"은 미구현
- **해결** 사용자 Cloudflare 계정에 Worker 설치·배포(`worker/wx-proxy.js`, 안내 `docs/CLOUDFLARE_WORKER.md`). 4종 응답·CORS·허용 밖 경로 404 확인, Mac 개발 앱에서 Settings 주소 입력 → 연결 성공·Weather 갱신 확인. 아이패드 기기 자체는 아직 미확인(K-01). `ALLOWED_ORIGINS` 제한은 GitHub Pages 주소가 정해지면 설정

## K-21 오프라인 후 복귀해도 업로드가 failed로 남음 🟢 (2026-11-05 D-042로 수정)
- **설명** 아이패드 비행기 모드에서 기록 → 복귀해도 OUTBOX가 failed로 남아 "지금 동기화"를 눌러야 전송됨
- **원인·수정** D-042. 개발 브라우저에서 접속 불가 주소로 6건 전송 실패(failed 0, 대기 6) → 주소 복구 후 버튼 없이 30초 안에 6건 자동 전송, 서버에 각 1회 확인
- **남은 확인** 아이패드 실기기에서 다시 확인 필요

## K-22 NOTAM D) 시간표는 해석하지 않음 ⚪
- **설명** 겹침 판단은 B)~C) 전체 유효기간만 사용. `D) 01-05 1400-2100` 같은 요일·시간 조합은 "시간표 있음 — 원문 확인"으로만 표시 (D-043)
- **향후** 형식이 모이면 해석 규칙 추가 검토 (오판하면 '해당 없음'으로 보일 위험 → 사용자 확인 후)

## K-23 NOTAM 근거 문서 일부는 원문 대조 전 🟡
- **설명** Doc 8400 약어 뜻, FAA JO 7930.2 약어, NOTAM Code GNSS(G) 그룹은 2차 자료 기준. 화면에 "원문 대조 필요" 표시. PANS-AIM 부록 3(NOTAM 형식)·Q-code 주제 그룹은 공개 자료로 확인
- **향후** ICAO Doc 8400·FAA JO 7930.2 원문(최신판)으로 대조 후 `refs.ts`의 `checked` 갱신

## K-24 NOTAM 분류 제목은 샘플에 나온 20종만 등록 ⚪
- **설명** 새 제목이 나오면 "기타" + "앱에 등록 안 된 제목"으로 표시(숨기지 않음). `classify.ts` `HEADING`에 추가하면 됨


## K-25 매뉴얼 변환 품질 — 일부 MEL 제목·등급, FCOM 쪽 합침 🟡
- **설명** 실제 A380 MEL 하위 항목 1,243개 중 1,242개 추출, 그중 제목 못 찾음 71(그림 글·표로 깨진 제목), 수리 등급 못 찾음 21. FCOM은 PDF 7,383쪽 중 6,938쪽 표시를 찾음(못 찾은 쪽은 앞 쪽에 합쳐져 근거 쪽 표시가 1쪽 어긋날 수 있음). 쪽 머리 제목은 그림 글 쪽에서 비어 있음. OFP 샘플의 MEL 19종·CDL 3종은 모두 찾음
- **현재** `npm run manuals` 보고표에 "등급 없음·제목 없음·쪽(찾음/PDF)"을 항상 표시. 앱에는 원문 그대로 보임
- **향후** 필요하면 규칙 보강(`MANUAL_PARSER_VERSION` 올리고 묶음 다시 만들기). MEL 탭은 매뉴얼 제목이 비면 OFP 제목을 보여 줌

## K-27 매뉴얼 본문 속 참조 링크는 누르기 영역이 작음 ⚪
- **설명** 글 속 `Refer to …` 링크는 문장 안에 있어 44px 터치 기준보다 작음(위아래 여백만 4px). 쪽 이동 버튼·검색 결과·MEL 버튼은 44px
- **향후** 아이패드 실사용에서 불편하면 참조 목록을 쪽 아래 버튼으로 따로 모아 보이기

## K-26 변환용 Python 환경이 바탕화면 폴더에 연결됨 ⚪
- **설명** `private/manuals/.venv` = 바탕화면 `PDF변환/.venv`(사용자가 만든 pymupdf4llm 환경)로 연결(심볼릭 링크). 바탕화면 폴더를 지우면 PDF 변환이 안 됨(이미 만든 MD·묶음은 영향 없음)
- **향후** 필요 시 `python3 -m venv private/manuals/.venv && private/manuals/.venv/bin/pip install pymupdf4llm pymupdf-layout` (도구가 안내문 출력). 큰 FCOM PDF 변환은 수십 분~몇 시간

## K-28 얼러트 규칙에 minima·측풍 없음 ⏳
- **설명** 원본 명세 §13.2의 도착지 minima 근접·교체공항 planning minima·강한 측풍/배풍 규칙은 아직 없음. 회사 FOM의 기준·접근 minima·활주로 방향 자료가 필요
- **향후** FOM을 받으면(같은 `npm run manuals`) 기준 위치를 확인하고 규칙 추가. 측풍은 활주로 자료(OurAirports runways) 추가 검토

## K-29 FOM 그림·일부 절 ⚪
- **설명** FOM 변환본의 그림(jpeg 96개)은 앱에 넣지 않고 "[그림]"으로만 표시. 번호 없는 큰 제목 아래 글은 앞 절에 붙음(가장 긴 덩어리 약 5.7만 자). 같은 번호가 두 번 나오는 절 6곳(첫 번째로 이동)
- **향후** 필요하면 그림을 묶음과 함께 옮기는 방식 검토(용량↑)
