# EFB Briefing (개인 보조 PWA)

> 개인 참고용 보조 도구. 승인된 EFB·OFP·운항 매뉴얼을 대체하지 않는다.

회사 OFP(Jeppesen Aviator PDF)를 아이패드 안에서 분석해 Lido식으로 보여주고, 순항 기록을 오프라인으로 저장했다가 연결되면 구글 시트로 자동 동기화하는 웹앱(PWA).

## 문서 지도

| 문서 | 내용 | 언제 읽나 |
|---|---|---|
| [CLAUDE.md](CLAUDE.md) | Claude Code 작업 지침 (짧음) | 매 세션 자동 |
| [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md) | **지금 상태·다음 작업·최근 인계** | 매 세션 처음 |
| [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) | 기능 명세 (구현 상태 표시) | 기능 작업 전 해당 절 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 파일 구조·데이터 흐름 | 코드 수정 전 해당 절 |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 확정된 결정 (재논의 금지) | 설계 판단 전 |
| [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | 알려진 문제·제약 | 버그·테스트 작업 전 |
| [LOCAL_TEST.md](LOCAL_TEST.md) | 사용자용 Mac 테스트 안내 | 직접 써볼 때 |
| [SPEC.md](SPEC.md) | 원본 명세 (보존용, 갱신 안 함) | 원문 확인할 때만 |

## 새 Claude Code 세션 시작 방법

대화창 하나를 계속 쓰지 않는다. **기능 하나(또는 Phase 하나) = 세션 하나**로 하고, 프로젝트의 기억은 위 문서들에 둔다.

1. 이 폴더(`~/IPBS`)에서 새 Claude Code 세션을 연다
2. 아래 **시작 프롬프트**를 붙여넣는다 (또는 `/session-start` 입력)
3. 작업이 끝나면 **마무리 프롬프트**를 붙여넣는다 (또는 `/session-handoff` 입력) → `docs/CURRENT_STATUS.md`가 갱신되어 다음 세션이 이어받는다

### 시작 프롬프트 (복사해서 사용)

```text
EFB 브리핑 웹앱 작업을 이어서 한다. 이전 대화는 불러오지 말고 프로젝트 문서로 이어받아라.

1) CLAUDE.md 규칙을 따른다.
2) docs/CURRENT_STATUS.md를 읽고 현재 상태와 "다음에 할 작업"을 확인한다.
3) 이번 작업: [여기에 할 일을 적는다. 예: Phase 3 기상 지도 — 우선 계획만]
4) 이번 작업과 관련된 docs/PROJECT_SPEC.md·docs/ARCHITECTURE.md·docs/DECISIONS.md의 해당 절만 읽고, 관련 소스 파일만 직접 확인한다. 프로젝트 전체를 읽지 않는다.
5) 문서와 실제 코드가 다르면 코드를 기준으로 하고 나에게 차이를 알려라.
6) 시작 전에 이해한 현재 상태와 작업 계획을 짧게 한국어로 알려주고, 확정 결정(DECISIONS)과 충돌하는 게 있으면 먼저 물어봐라.
```

### 마무리 프롬프트 (복사해서 사용)

```text
이번 세션을 마무리한다.
1) npm test, npx tsc -b, npm run build를 실행하고 결과를 알려줘. 화면을 바꿨다면 주요 화면 크기·주간/야간도 확인해줘.
2) docs/CURRENT_STATUS.md를 갱신해줘: 상태표, 그리고 맨 아래 "세션 인계"에 완료한 것·변경한 파일·테스트 결과·해결 못 한 것·다음 할 일.
3) 새 결정이 있으면 docs/DECISIONS.md, 새 문제/해결이 있으면 docs/KNOWN_ISSUES.md, 요구사항이 바뀌었으면 docs/PROJECT_SPEC.md, 구조가 바뀌었으면 docs/ARCHITECTURE.md를 고쳐줘. 해당 없는 문서는 건드리지 마.
4) 확인하지 못한 것은 완료로 쓰지 마.
```

### 세션 나누기 요령
- 큰 작업(예: Phase 3)은 "계획 세션 → 구현 세션(기능별) → 검증 세션"으로 나눠도 된다. 각 세션 끝에 인계만 하면 된다
- 같은 결정을 다시 묻지 않도록, 결정이 나면 바로 DECISIONS에 적게 한다
- 긴 로그·디버깅은 파일로 남기고 대화에는 요약만

## 로컬 개발

```bash
npm install
npm run dev      # http://localhost:5173 , 내장 Mock GAS 포함
npm run local    # 배포판 빌드 + 미리보기 http://localhost:4173
npm test
```

Settings에 URL `http://localhost:5173/mock-gas`(또는 `:4173`), 토큰 `dev-token`을 넣으면 실제 구글 없이 동기화를 확인할 수 있다 (메모리 저장, 서버 재시작 시 초기화). 사용자용 단계별 안내는 [LOCAL_TEST.md](LOCAL_TEST.md).

## Apps Script 백엔드 설치

1. 새 Google Sheet 생성 → 확장 프로그램 → Apps Script
2. `apps-script/Code.gs` 내용을 붙여넣고 저장
3. 함수 `setup` 실행 → 권한 승인 → **실행 로그에 출력된 토큰**을 복사 (토큰은 Script Properties에만 저장됨)
4. 배포 → 새 배포 → 웹 앱 / 실행 사용자: 나 / 액세스 권한: 모든 사용자 → `/exec` URL 복사
5. 앱 Settings에 URL·토큰 입력 → "연결 테스트"
6. 코드 수정 시: 배포 관리 → 편집 → 버전 "새 버전"으로 재배포 (URL 유지)

## 배포 (정적 호스팅)

`npm run build` → `dist/` 폴더를 GitHub Pages 또는 Cloudflare Pages에 올린다(결정: GitHub Pages, 단 로컬·아이패드 확인 후). `base: './'`라 하위 경로·루트 모두 동작. Service Worker는 HTTPS에서만 동작하므로 iPad 테스트는 HTTPS 주소(배포 또는 임시 터널)로 한다.

## Phase 0 완료 조건 테스트 (iPad Safari)

1. HTTPS 주소를 Safari로 열기 → 고지 확인
2. 공유 버튼 → **홈 화면에 추가** → 홈 화면 아이콘으로 실행 (Settings에서 "홈 화면 앱 실행: YES" 확인)
3. Settings에 Apps Script URL·토큰 입력 → 연결 테스트 ✓
4. 앱을 한 번 완전히 닫았다가 다시 열기 (Service Worker 캐시 완료 확인용)
5. **비행기 모드 ON** → 상단 배지 `OFFLINE`
6. 앱을 닫고 다시 실행해도 열리는지 확인 (오프라인 앱 셸)
7. Inflight 탭 아래 Memo에서 메모 2~3개 저장 → `⏳`, 상단 `OUTBOX n`
8. **비행기 모드 OFF** → 배지 `ONLINE` → 자동 업로드 → `✓`, `OUTBOX 0`
   - 자동으로 안 되면 앱을 백그라운드로 보냈다가 다시 열기 (visibilitychange 트리거)
9. Google Sheet `Logs` 탭에 메모가 **각각 1행씩만** 있는지 확인 (Settings "지금 동기화"를 여러 번 눌러도 중복 없음)

## 보안

- 회사 OFP·매뉴얼 원본은 `private/`에만 둔다 (gitignore, `*.pdf` 포함). 개발·미리보기 서버는 `/private`·`*.pdf` 요청을 차단
- Apps Script 토큰은 앱(기기 IndexedDB)과 Script Properties에만 존재. 유출 의심 시 `rotateToken` 실행
