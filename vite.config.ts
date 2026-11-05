/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Connect, Plugin } from 'vite';
import { mockGasPlugin } from './tools/mock-gas';

/** 회사 OFP·매뉴얼이 있는 private/ 는 개발·미리보기 서버에서 절대 내보내지 않음 (같은 Wi-Fi 기기 접근 차단) */
function blockPrivatePlugin(): Plugin {
  const deny: Connect.NextHandleFunction = (req, res, next) => {
    const url = decodeURIComponent((req.url ?? '').split('?')[0]).toLowerCase();
    if (url.includes('/private/') || url.endsWith('/private') || url.endsWith('.pdf')) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    next();
  };
  return {
    name: 'efb-block-private',
    configureServer: (s) => void s.middlewares.use(deny),
    configurePreviewServer: (s) => void s.middlewares.use(deny),
  };
}

/**
 * 로컬 기상 중계 (D-034): /wx/awc/<종류>?… → https://aviationweather.gov/api/data/<종류>?…
 * aviationweather.gov는 브라우저 CORS를 허용하지 않아 개발·미리보기 서버가 대신 받아 준다.
 * 허용 목록 경로만, GET만, 키·토큰 없음. 배포 후에는 같은 규격의 Cloudflare Worker로 대체.
 */
const AWC_ALLOWED = new Set(['metar', 'taf', 'isigmet', 'airsigmet']);
function wxProxyPlugin(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const m = /^\/wx\/awc\/([a-z]+)(\?.*)?$/.exec(req.url ?? '');
    if (!m) return next();
    if (req.method !== 'GET' || !AWC_ALLOWED.has(m[1])) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const target = `https://aviationweather.gov/api/data/${m[1]}${m[2] ?? ''}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    fetch(target, { signal: ctrl.signal, headers: { 'User-Agent': 'efb-brief-local-proxy' } })
      .then(async (r) => {
        res.statusCode = r.status;
        res.setHeader('Content-Type', r.headers.get('content-type') ?? 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(Buffer.from(await r.arrayBuffer()));
      })
      .catch((e: unknown) => {
        res.statusCode = 502;
        res.end(`proxy error: ${e instanceof Error ? e.message : String(e)}`);
      })
      .finally(() => clearTimeout(timer));
  };
  return {
    name: 'efb-wx-proxy',
    configureServer: (s) => void s.middlewares.use(handler),
    configurePreviewServer: (s) => void s.middlewares.use(handler),
  };
}

// base: './' — GitHub Pages(하위 경로)와 Cloudflare Pages(루트) 어느 쪽이든 그대로 배포 가능
export default defineConfig({
  base: './',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16) + 'Z'),
  },
  server: {
    fs: { deny: ['.env', '.env.*', '**/private/**'] },
  },
  plugins: [
    react(),
    blockPrivatePlugin(),
    mockGasPlugin(),
    wxProxyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'EFB Briefing (개인 보조)',
        short_name: 'EFB Brief',
        description: '개인 참고용 운항 브리핑 보조 도구',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0f14',
        theme_color: '#0b0f14',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱 셸만 precache. 기상 등 API 응답은 SW 캐시가 아니라 IndexedDB에 직접 저장 (SPEC §7.1)
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webmanifest,json}'],
        // pdf.js worker(약 1.4MB)도 오프라인용으로 미리 저장
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/mock-gas/, /^\/wx\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
});
