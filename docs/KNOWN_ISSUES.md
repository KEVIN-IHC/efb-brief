# KNOWN ISSUES — 알려진 문제·제약

> 상태: 🔴 미해결 · 🟡 완화됨/임시 · 🟢 해결(기록 보존) · ⚪ 설계상 제약
> 새 문제를 발견하면 번호를 이어서 추가한다. 해결되면 지우지 말고 🟢로 바꾼다.

## K-01 아이패드 실기기 미확인 🔴
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

## K-03 경고 기준이 임시값 🟡
- **설명** 연료 편차(−2% TRIP), 착륙 예상(ALTN+FINAL), SR(5/7), 중량·연료·ETP 여유(2t/1t/1.5t)는 근거가 회사 매뉴얼이 아님
- **관련 파일** `inflight/deviation.ts` (`FUEL_DEV_RULES`), `ofp/turbulence.ts` (`SR_THRESHOLDS`), `ofp/margins.ts` (`THRESHOLDS`)
- **현재** 화면에 "임시 기준 · 회사 매뉴얼 확인 필요" 표시
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

## K-13 Git 커밋 없음 🟡
- **설명** `git init`만 됨, 커밋 0개, 스테이징은 초기 상태라 오래됨. 되돌리기 지점이 없음
- **향후** 사용자 확인 후 첫 커밋 (`private/`는 gitignore로 제외 확인됨)

## K-14 연료 그래프 끝 라벨 겹침 🟡
- **설명** 그래프 오른쪽 끝에서 예상 착륙 연료 숫자가 마지막 점과 겹칠 수 있음(미관상)
- **관련 파일** `inflight/FuelChart.tsx`

## K-15 OFP 샘플을 외부 AI가 읽음 ⚪
- **설명** 샘플 10개는 사용자가 Claude(Anthropic)로 전송됨을 알고 제공. 사내 보안 규정 확인은 사용자 책임(원본 명세 §16)
- **향후** 새 샘플은 개인정보 가린 지난 비행 OFP 권장

## K-16 구간 표시 `verified` 플래그 미갱신 🟡
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
