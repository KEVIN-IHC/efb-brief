// Cloudflare Worker 중계 단위 테스트 (네트워크 없이 fetch 흉내)
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error — 순수 JS Worker 파일 (타입 없음)
import worker from './wx-proxy.js';

const call = (path: string, init: RequestInit & { origin?: string } = {}, env: Record<string, string> = {}) =>
  worker.fetch(new Request(`https://wx.example.workers.dev${path}`, { ...init, headers: init.origin ? { Origin: init.origin } : {} }), env) as Promise<Response>;

afterEach(() => vi.unstubAllGlobals());

describe('wx-proxy worker', () => {
  it('허용 경로는 aviationweather.gov로 전달하고 CORS를 붙임', async () => {
    const f = vi.fn(async () => new Response('[{"icaoId":"RKSI"}]', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', f);
    const r = await call('/awc/metar?ids=RKSI&format=json', { origin: 'https://x.github.io' });
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await r.json()).toEqual([{ icaoId: 'RKSI' }]);
    expect(f.mock.calls[0][0]).toBe('https://aviationweather.gov/api/data/metar?ids=RKSI&format=json');
  });

  it('PIREP·G-AIRMET 경로 허용 (D-060)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    for (const k of ['pirep', 'gairmet']) expect((await call(`/awc/${k}?format=json`)).status).toBe(200);
  });

  it('허용 목록 밖 경로·메서드는 거절 (열린 프록시 방지)', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect((await call('/awc/stationinfo?ids=RKSI')).status).toBe(404);
    expect((await call('/https://evil.example/')).status).toBe(404);
    expect((await call('/awc/metar', { method: 'POST' })).status).toBe(404);
    expect(f).not.toHaveBeenCalled();
  });

  it('ALLOWED_ORIGINS가 있으면 그 사이트만', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]')));
    const env = { ALLOWED_ORIGINS: 'https://me.github.io, http://localhost:5173' };
    expect((await call('/awc/taf?ids=RKSI', { origin: 'https://other.site' }, env)).status).toBe(403);
    const ok = await call('/awc/taf?ids=RKSI', { origin: 'https://me.github.io' }, env);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://me.github.io');
  });

  it('상류 오류는 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('down'))));
    expect((await call('/awc/isigmet?format=json')).status).toBe(502);
  });

  it('상태 확인 주소', async () => {
    const r = await call('/');
    expect(await r.text()).toContain('ok');
  });
});
