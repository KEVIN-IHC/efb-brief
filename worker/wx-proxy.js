// EFB Brief 기상 중계 — Cloudflare Worker (D-034)
// aviationweather.gov는 브라우저 CORS를 허용하지 않아, 이 Worker가 대신 받아서 앱에 돌려준다.
//
// 규격: GET <worker 주소>/awc/<metar|taf|isigmet|airsigmet|pirep|gairmet>?<원래 쿼리>
//       → https://aviationweather.gov/api/data/<종류>?<원래 쿼리>
//  - 허용 목록 경로·GET만. 키·토큰 없음 (공개 기상 자료 전달만)
//  - 같은 요청은 Cloudflare에 60초 보관 (aviationweather.gov 부담·속도)
//  - 선택: Worker 변수 ALLOWED_ORIGINS = "https://아이디.github.io,http://localhost:5173"
//    를 넣으면 그 사이트에서 온 브라우저 요청만 허용 (비우면 모두 허용)
//
// 설치: Cloudflare 대시보드 → Workers & Pages → Create → Worker → 이 파일 내용 붙여넣기 → Deploy
// (자세한 순서: docs/CLOUDFLARE_WORKER.md)

const ALLOWED = new Set(['metar', 'taf', 'isigmet', 'airsigmet', 'pirep', 'gairmet']); // pirep·gairmet = D-060
const UPSTREAM = 'https://aviationweather.gov/api/data/';
const CACHE_SECONDS = 60;
const TIMEOUT_MS = 15000;

function corsHeaders(origin, env) {
  const list = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) return { 'Access-Control-Allow-Origin': '*' };
  if (origin && list.includes(origin)) return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  return null; // 허용 안 된 사이트
}

function reply(status, body, headers) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers } });
}

export default {
  async fetch(request, env = {}, ctx = { waitUntil() {} }) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);
    if (!cors) return reply(403, 'origin not allowed', {});

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
    }
    if (url.pathname === '/' || url.pathname === '/health') return reply(200, 'efb wx proxy ok', cors);

    const m = /^\/awc\/([a-z]+)\/?$/.exec(url.pathname);
    if (request.method !== 'GET' || !m || !ALLOWED.has(m[1])) return reply(404, 'not found', cors);

    const target = UPSTREAM + m[1] + url.search;
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const cacheKey = new Request(target, { method: 'GET' });
    if (cache) {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const r = new Response(hit.body, hit);
        Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v));
        r.headers.set('X-Proxy-Cache', 'HIT');
        return r;
      }
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let up;
    try {
      up = await fetch(target, { signal: ctrl.signal, headers: { 'User-Agent': 'efb-brief-wx-proxy' } });
    } catch (e) {
      return reply(502, 'upstream error: ' + (e && e.message ? e.message : String(e)), cors);
    } finally {
      clearTimeout(timer);
    }

    const body = await up.arrayBuffer();
    const headers = {
      'Content-Type': up.headers.get('content-type') || 'application/json',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
      ...cors,
    };
    const res = new Response(body, { status: up.status, headers });
    if (cache && up.ok) ctx.waitUntil(cache.put(cacheKey, new Response(body, { status: up.status, headers })));
    return res;
  },
};
