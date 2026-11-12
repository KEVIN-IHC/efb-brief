// 기상 확장 (D-060): PIREP·AIREP(AWC, 중계 경유) · 우주기상 NOAA 등급(SWPC, 직접) · 열대저기압(GDACS, 직접)
// 모두 실패가 기본 — 이전 자료 유지 + 받은 시각 표시. 저장 = IndexedDB wxSnapshots(type pirep/swx/tc, 7일 뒤 자동 삭제)
import { create } from 'zustand';
import { getDB } from '../../db/schema';
import { isOnline } from '../../lib/time';
import { useActiveFlight } from '../flight/activeFlight';
import { unwrapLons } from './route';
import { fetchJson, getWxProxyBase } from './api';

export interface Pirep {
  id: string;
  obsTime: string;
  lat: number;
  lon: number;
  fl: number | null;
  acType?: string;
  turb?: string; // MOD · SEV …
  icing?: string;
  wx?: string;
  raw: string;
  aireP: boolean;
}

export interface SpaceWx {
  /** 현재(관측) 등급 0~5 */
  r: number | null; // 전파 두절 (HF)
  s: number | null; // 태양 방사선 폭풍 (극지 고고도 방사선·HF)
  g: number | null; // 지자기 폭풍
  /** 오늘 예보 확률 % */
  rMinorProb?: string | null;
  rMajorProb?: string | null;
  sProb?: string | null;
  stamp: string; // 발표 시각 ISO
}

/** 미국 G-AIRMET (예보 0시간 다각형만: 난류·착빙·LLWS·지상풍 등) */
export interface Gairmet {
  id: string;
  hazard: string;
  validTime: string;
  expire: string;
  base: string | null; // 원문 (예: 180 = FL180, SFC)
  top: string | null;
  poly: [number, number][];
}

export interface Cyclone {
  id: string;
  name: string;
  lat: number;
  lon: number;
  level: string; // Green/Orange/Red (GDACS 경보 단계)
  severity?: string;
  from: string;
  to: string;
  url?: string;
}

type Kind = 'pirep' | 'swx' | 'tc' | 'gairmet';
interface Snap<T> {
  fetchedAt: string;
  data: T;
}

interface ExtraState {
  pirep: Snap<Pirep[]> | null;
  swx: Snap<SpaceWx> | null;
  tc: Snap<Cyclone[]> | null;
  gairmet: Snap<Gairmet[]> | null;
  busy: Partial<Record<Kind, boolean>>;
  errors: Partial<Record<Kind, string>>;
  loaded: boolean;
}

export const useWxExtra = create<ExtraState>(() => ({ pirep: null, swx: null, tc: null, gairmet: null, busy: {}, errors: {}, loaded: false }));

export const EXTRA_REFRESH_MIN: Record<Kind, number> = { pirep: 15, swx: 60, tc: 60, gairmet: 30 };

/* ---------------- 해석 (테스트 가능하게 순수 함수) ---------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function decodePireps(raw: any[]): Pirep[] {
  return (raw ?? [])
    .filter((p) => typeof p?.lat === 'number' && typeof p?.lon === 'number')
    .map((p) => {
      const t = typeof p.obsTime === 'number' ? new Date(p.obsTime * 1000).toISOString() : String(p.obsTime ?? '');
      const turb = [p.tbInt1, p.tbInt2].filter(Boolean).join('/') || undefined;
      const icing = [p.icgInt1, p.icgInt2].filter(Boolean).join('/') || undefined;
      return {
        id: `${t}-${p.lat}-${p.lon}-${p.fltLvl}`,
        obsTime: t,
        lat: p.lat,
        lon: p.lon,
        fl: typeof p.fltLvl === 'number' ? p.fltLvl : null,
        acType: p.acType || undefined,
        turb,
        icing,
        wx: p.wxString || undefined,
        raw: String(p.rawOb ?? ''),
        aireP: p.pirepType === 'AIREP',
      };
    });
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

export function decodeScales(raw: any): SpaceWx | null {
  const now = raw?.['0'];
  if (!now) return null;
  const today = raw?.['1'];
  return {
    r: num(now.R?.Scale),
    s: num(now.S?.Scale),
    g: num(now.G?.Scale),
    rMinorProb: today?.R?.MinorProb ?? null,
    rMajorProb: today?.R?.MajorProb ?? null,
    sProb: today?.S?.Prob ?? null,
    stamp: new Date(`${now.DateStamp}T${now.TimeStamp}Z`).toISOString(),
  };
}

export function decodeGdacs(raw: any): Cyclone[] {
  return (raw?.features ?? [])
    .filter((f: any) => f?.properties?.eventtype === 'TC' && String(f.properties.iscurrent) === 'true')
    .map((f: any) => {
      const p = f.properties;
      const [lon, lat] = f.geometry?.coordinates ?? [NaN, NaN];
      return {
        id: String(p.eventid),
        name: p.eventname || p.name,
        lat,
        lon,
        level: p.alertlevel ?? '',
        severity: p.severitydata?.severitytext,
        from: p.fromdate ? `${p.fromdate}Z` : '',
        to: p.todate ? `${p.todate}Z` : '',
        url: p.url?.report,
      } satisfies Cyclone;
    })
    .filter((c: Cyclone) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
}
const noneToNull = (v: unknown) => (v == null || v === 'None' || v === '' ? null : String(v));

export function decodeGairmets(raw: any[]): Gairmet[] {
  return (raw ?? [])
    .filter((g) => String(g?.forecastHour) === '0' && (g?.geometryType ?? g?.geom) === 'POLYGON' && Array.isArray(g?.coords))
    .map((g) => ({
      id: `${g.tag}-${g.hazard}-${g.validTime}`,
      hazard: String(g.hazard),
      validTime: String(g.validTime),
      expire: typeof g.expireTime === 'string' && /^\d+$/.test(g.expireTime) ? new Date(+g.expireTime * 1000).toISOString() : String(g.expireTime ?? ''),
      base: noneToNull(g.base),
      top: noneToNull(g.top),
      poly: (g.coords as { lat: string; lon: string }[]).map((c) => [Number(c.lat), Number(c.lon)] as [number, number]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)),
    }))
    .filter((g) => g.poly.length >= 3);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** 루트를 덮는 bbox (날짜변경선을 넘으면 두 개). [minLat, minLon, maxLat, maxLon] */
export function routeBoxes(pts: { lat: number; lon: number }[], padDeg = 4): [number, number, number, number][] {
  if (!pts.length) return [];
  const u = unwrapLons(pts);
  const lats = u.map((p) => p.lat);
  const lons = u.map((p) => p.lon);
  const s = Math.max(-90, Math.min(...lats) - padDeg);
  const n = Math.min(90, Math.max(...lats) + padDeg);
  let w = Math.min(...lons) - padDeg;
  let e = Math.max(...lons) + padDeg;
  if (e - w >= 360) return [[s, -180, n, 180]];
  // -180..180 범위로 나눔
  const norm = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
  if (w >= -180 && e <= 180) return [[s, w, n, e]];
  w = norm(w);
  e = norm(e);
  return [
    [s, w, n, 180],
    [s, -180, n, e],
  ];
}

/* ---------------- 받기·저장 ---------------- */

async function save(kind: Kind, fetchedAt: string, data: unknown) {
  await (await getDB()).put('wxSnapshots', { type: kind, station: 'ALL', fetchedAt, data } as never);
}

export async function loadExtraCache(): Promise<void> {
  if (useWxExtra.getState().loaded) return;
  const db = await getDB();
  const get = async <T>(k: Kind) => ((await db.get('wxSnapshots', [k, 'ALL'])) as unknown as Snap<T> | undefined) ?? null;
  const [pirep, swx, tc, gairmet] = await Promise.all([get<Pirep[]>('pirep'), get<SpaceWx>('swx'), get<Cyclone[]>('tc'), get<Gairmet[]>('gairmet')]);
  useWxExtra.setState({ pirep, swx, tc, gairmet, loaded: true });
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 실패한 종류는 10분 동안 다시 시도하지 않음 (지금 갱신 버튼은 예외) */
const lastFail: Partial<Record<Kind, number>> = {};

async function run<T>(kind: Kind, job: () => Promise<T>) {
  if (useWxExtra.getState().busy[kind]) return;
  delete lastFail[kind];
  useWxExtra.setState((s) => ({ busy: { ...s.busy, [kind]: true } }));
  try {
    const data = await job();
    const fetchedAt = new Date().toISOString();
    await save(kind, fetchedAt, data);
    useWxExtra.setState((s) => ({ [kind]: { fetchedAt, data }, errors: { ...s.errors, [kind]: undefined } }) as Partial<ExtraState>);
  } catch (e) {
    let m = msg(e);
    if ((kind === 'pirep' || kind === 'gairmet') && /HTTP 404/.test(m)) m = '기상 중계(Worker)가 아직 이 자료를 허용하지 않음 — worker/wx-proxy.js 새 버전 배포 필요';
    lastFail[kind] = Date.now();
    useWxExtra.setState((s) => ({ errors: { ...s.errors, [kind]: m } }));
  } finally {
    useWxExtra.setState((s) => ({ busy: { ...s.busy, [kind]: false } }));
  }
}

export async function refreshExtra(kinds: Kind[] = ['pirep', 'swx', 'tc', 'gairmet'], force = false): Promise<void> {
  if (!isOnline()) return;
  await loadExtraCache();
  const s = useWxExtra.getState();
  const due = (k: Kind) => force || ((!s[k] || Date.now() - Date.parse(s[k]!.fetchedAt) > EXTRA_REFRESH_MIN[k] * 60_000) && Date.now() - (lastFail[k] ?? 0) > 10 * 60_000);
  const route = useActiveFlight.getState().ofp?.parsed?.route ?? [];
  await Promise.all(
    kinds.filter(due).map((k) => {
      if (k === 'pirep')
        return run(k, async () => {
          const base = await getWxProxyBase();
          const boxes = routeBoxes(route);
          if (!boxes.length) return [];
          const lists = await Promise.all(boxes.map((b) => fetchJson<unknown[]>(`${base}/awc/pirep?format=json&age=3&bbox=${b.join(',')}`)));
          return decodePireps(lists.flat());
        });
      if (k === 'gairmet')
        return run(k, async () => {
          // 미국 본토 상공을 지나지 않으면 받지 않음 (대략 20~55N, 130~60W)
          const us = route.some((w) => w.lat > 20 && w.lat < 55 && w.lon > -130 && w.lon < -60);
          if (!us) return [];
          const base = await getWxProxyBase();
          return decodeGairmets(await fetchJson<unknown[]>(`${base}/awc/gairmet?format=json`));
        });
      if (k === 'swx') return run(k, async () => decodeScales(await fetchJson('https://services.swpc.noaa.gov/products/noaa-scales.json')));
      return run(k, async () => decodeGdacs(await fetchJson('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC', 20_000)));
    }),
  );
}
