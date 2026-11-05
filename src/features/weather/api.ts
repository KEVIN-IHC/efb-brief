// 외부 기상 소스 호출 (D-034). 실패가 기본 — 타임아웃 15초, 호출한 쪽이 이전 데이터를 유지한다.
//  - aviationweather.gov: 기상 중계 경유 (<중계>/awc/<종류>?…)
//  - Open-Meteo: 브라우저 직접 (CORS 허용, 비상업 무료)
import { getSetting } from '../../db/settings';
import type { OfpWaypoint } from '../ofp/types';
import { decodeIsigmet, decodeMetar, decodeTaf, decodeUsSigmet, interpolateAtFl, LEVELS_HPA } from './decode';
import type { Metar, Sigmet, Taf, WindPoint, WindsData } from './types';

export const TIMEOUT_MS = 15_000;

/**
 * 기본 기상 중계 = 사용자 Cloudflare Worker (D-041). 공개 기상 자료만 전달하는 주소라 비밀값 아님.
 * Worker 쪽 ALLOWED_ORIGINS로 이 앱 사이트에서만 쓰이게 제한한다.
 */
export const DEFAULT_WX_PROXY = 'https://efb-wx.kaisian1004.workers.dev';

/** localhost·사설 IP(같은 Wi-Fi에서 Mac 서버 접속) */
export const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.local') || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h);

/** 기상 중계 주소: Settings 입력값 → (Mac 테스트 서버) 내장 /wx → (그 외) 기본 Worker */
export function resolveWxProxy(setting: string | undefined, href: string): string {
  const s = (setting ?? '').trim().replace(/\/+$/, '');
  if (s) return s;
  const u = new URL(href);
  if (isLocalHost(u.hostname)) return new URL('./wx', href).href.replace(/\/+$/, '');
  return DEFAULT_WX_PROXY;
}

export async function getWxProxyBase(): Promise<string> {
  return resolveWxProxy(await getSetting('wxProxyUrl'), location.href);
}

export async function fetchJson<T = unknown>(url: string, timeoutMs = TIMEOUT_MS): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    if (!text.trim()) return [] as T; // AWC: 결과 없음 = 빈 응답
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('응답이 JSON이 아님 (중계 주소 확인)');
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error(`시간 초과 (${timeoutMs / 1000}초)`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function awc<T>(path: string, params: Record<string, string>): Promise<T> {
  const base = await getWxProxyBase();
  return fetchJson<T>(`${base}/awc/${path}?${new URLSearchParams({ ...params, format: 'json' })}`);
}

export async function fetchMetars(icaos: string[]): Promise<Metar[]> {
  if (!icaos.length) return [];
  const raw = await awc<unknown[]>('metar', { ids: icaos.join(',') });
  // 같은 공항 여러 개면 최신만
  const by = new Map<string, Metar>();
  for (const m of raw.map(decodeMetar)) {
    const prev = by.get(m.icao);
    if (!prev || m.obsTime > prev.obsTime) by.set(m.icao, m);
  }
  return [...by.values()];
}

export async function fetchTafs(icaos: string[]): Promise<Taf[]> {
  if (!icaos.length) return [];
  const raw = await awc<unknown[]>('taf', { ids: icaos.join(',') });
  const by = new Map<string, Taf>();
  for (const t of raw.map(decodeTaf)) {
    const prev = by.get(t.icao);
    if (!prev || t.issueTime > prev.issueTime) by.set(t.icao, t);
  }
  return [...by.values()];
}

/** 국제 SIGMET 전체 + 미국 국내 SIGMET(AIRMET 제외) */
export async function fetchSigmets(): Promise<Sigmet[]> {
  const [intl, us] = await Promise.all([awc<unknown[]>('isigmet', {}), awc<{ airSigmetType?: string }[]>('airsigmet', {})]);
  const list = [...intl.map(decodeIsigmet), ...us.filter((s) => s.airSigmetType === 'SIGMET').map(decodeUsSigmet)];
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

/* ---------------- 상층풍·기온 (Open-Meteo) ---------------- */

const OM_URL = 'https://api.open-meteo.com/v1/forecast';
const MAX_POINTS = 60;
const DAY = 86_400_000;

/** 순항 구간 웨이포인트를 최대 60개로 줄임 (첫·끝 유지) */
export function pickWindPoints(route: OfpWaypoint[], max = MAX_POINTS): OfpWaypoint[] {
  const cr = route.filter((w) => w.fl > 0);
  const src = cr.length >= 2 ? cr : route;
  if (src.length <= max) return src;
  const step = (src.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => src[Math.round(i * step)]);
}

const hourStr = (ms: number) => new Date(ms).toISOString().slice(0, 13) + ':00';

export async function fetchWinds(route: OfpWaypoint[], cruiseFl: number, now = Date.now()): Promise<WindsData> {
  const pts = pickWindPoints(route);
  if (!pts.length) return { model: 'Open-Meteo', basis: 'now', points: [] };
  const etos = pts.map((p) => Date.parse(p.eto)).filter((t) => Number.isFinite(t));
  let start = Math.min(...etos);
  let end = Math.max(...etos);
  // 이미 끝난 비행(오래된 샘플 OFP 등)이나 예보 범위(14일) 밖이면 현재 시각 기준으로 받는다
  // (과거 날짜 요청은 Open-Meteo 응답이 약 20초로 느리고, 운항 참고 가치도 없음)
  const basis: WindsData['basis'] = !etos.length || end < now - DAY || start > now + 14 * DAY ? 'now' : 'eto';
  if (basis === 'now') {
    start = now;
    end = now + 3_600_000;
  }
  const vars = LEVELS_HPA.flatMap((l) => [`wind_speed_${l}hPa`, `wind_direction_${l}hPa`, `temperature_${l}hPa`]);
  const q = new URLSearchParams({
    latitude: pts.map((p) => p.lat.toFixed(2)).join(','),
    longitude: pts.map((p) => p.lon.toFixed(2)).join(','),
    hourly: vars.join(','),
    wind_speed_unit: 'kn',
    timezone: 'GMT',
    start_hour: hourStr(start - 3_600_000),
    end_hour: hourStr(end + 3_600_000),
  });
  type OmLoc = { hourly: Record<string, (number | null)[]> & { time: string[] } };
  const res = await fetchJson<OmLoc | OmLoc[]>(`${OM_URL}?${q}`, 40_000); // 60개 지점 × 18개 값이라 여유 있게
  const locs = Array.isArray(res) ? res : [res];
  const points: WindPoint[] = pts.map((p, i) => {
    const h = locs[i]?.hourly;
    const fl = p.fl > 0 ? p.fl : cruiseFl;
    if (!h) return { seq: p.seq, name: p.name, lat: p.lat, lon: p.lon, fl, time: '', dir: null, spd: null, temp: null };
    const target = basis === 'eto' && Number.isFinite(Date.parse(p.eto)) ? Date.parse(p.eto) : now;
    let best = 0;
    h.time.forEach((t, k) => {
      if (Math.abs(Date.parse(`${t}Z`) - target) < Math.abs(Date.parse(`${h.time[best]}Z`) - target)) best = k;
    });
    const levels = LEVELS_HPA.map((hpa) => ({
      hpa,
      spd: h[`wind_speed_${hpa}hPa`]?.[best] ?? null,
      dir: h[`wind_direction_${hpa}hPa`]?.[best] ?? null,
      temp: h[`temperature_${hpa}hPa`]?.[best] ?? null,
    }));
    return { seq: p.seq, name: p.name, lat: p.lat, lon: p.lon, fl, time: `${h.time[best]}Z`, ...interpolateAtFl(fl, levels) };
  });
  return { model: 'Open-Meteo (best match)', basis, points };
}
