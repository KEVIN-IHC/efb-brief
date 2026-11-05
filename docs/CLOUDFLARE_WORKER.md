# Cloudflare Worker 기상 중계 설치 안내

> 왜 필요한가: METAR·TAF·SIGMET(aviationweather.gov)은 웹앱이 직접 받을 수 없게 막혀 있어서(D-034) 중간에서 대신 받아 주는 작은 서버가 필요합니다. Mac 테스트 서버에는 이미 들어 있지만, 아이패드·GitHub Pages에서는 이 Worker가 그 역할을 합니다.
> 비용: Cloudflare 무료 플랜(하루 10만 요청). 이 앱은 하루 수백 회 정도라 충분합니다. 카드 등록 불필요.
> 코드: `worker/wx-proxy.js` (공개 기상만 전달, 키·토큰 없음, 허용된 4개 경로만)

## 1. 계정 만들기 (처음 한 번)
1. https://dash.cloudflare.com/sign-up 에서 이메일·비밀번호로 가입
2. 받은 메일에서 이메일 인증
3. "도메인 추가" 같은 안내가 나와도 **필요 없습니다** — 건너뛰기

## 2. Worker 만들기
1. 왼쪽 메뉴 **Compute (Workers)** → **Workers & Pages**
2. **Create** → **Create Worker** (또는 "Start with Hello World!")
3. 이름: `efb-wx` (원하는 이름 가능 — 주소에 들어감) → **Deploy**
4. 다 되면 **Edit code** 클릭
5. 왼쪽 편집창의 내용을 **전부 지우고**, 이 프로젝트의 `worker/wx-proxy.js` 내용을 **전부 붙여넣기**
6. 오른쪽 위 **Deploy** → 확인

## 3. 주소 확인
- 주소 모양: `https://efb-wx.<내 계정 이름>.workers.dev`
- 브라우저에서 그 주소를 열면 `efb wx proxy ok` 가 보여야 합니다
- `…workers.dev/awc/metar?ids=RKSI&format=json` 을 열면 인천 METAR JSON이 보여야 합니다

## 4. 앱에 넣기
1. 앱 **Settings → 기상 중계 주소**에 `https://efb-wx.<내 계정 이름>.workers.dev` 입력 (끝에 `/` 없이)
2. **저장** → **연결 테스트** → "연결 성공"
3. Weather 탭 **지금 갱신**

## 5. (선택, 나중에) 내 사이트에서만 쓰게 제한
GitHub Pages 주소가 정해지면: Worker → **Settings → Variables and Secrets → Add**
- 이름 `ALLOWED_ORIGINS`, 값 예: `https://내아이디.github.io,http://localhost:5173,http://localhost:4173`
- 저장 후 다시 Deploy. 그러면 다른 웹사이트가 이 중계를 쓸 수 없습니다(완전한 차단은 아님 — 공개 기상 자료라 위험은 낮음)

## 코드를 바꾸면
`worker/wx-proxy.js`가 바뀌면 2-4~6을 다시 하면 됩니다 (주소는 그대로).
