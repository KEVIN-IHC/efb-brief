// aviationweather.gov JSON → 앱 모델, 비행 등급, FL ↔ 기압면 보간
import type { Cloud, FltCat, Metar, Sigmet, Taf, TafPeriod } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const iso = (v: unknown): string => {
  if (typeof v === 'number') return new Date(v * 1000).toISOString();
  if (typeof v === 'string' && v) return new Date(v.endsWith('Z') || v.includes('+') ? v : `${v}Z`).toISOString();
  return '';
};
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const wdir = (v: unknown): number | 'VRB' | null => (v === 'VRB' ? 'VRB' : num(v));

/** '10+' → 10, '6+' → 6, '1/2' → 0.5, 3.73 → 3.73 (SM) */
export function visibSm(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = v.replace('+', '').trim();
  const frac = /^(\d+)?\s*(\d+)\/(\d+)$/.exec(s);
  if (frac) return Number(frac[1] ?? 0) + Number(frac[2]) / Number(frac[3]);
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 운고 = BKN·OVC·OVX 중 가장 낮은 층 또는 수직시정 (ft) */
export function ceilingFt(clouds: Cloud[], vertVis?: number | null): number | null {
  const bases = clouds.filter((c) => /^(BKN|OVC|OVX)$/.test(c.cover) && c.base != null).map((c) => c.base as number);
  if (vertVis != null) bases.push(vertVis);
  return bases.length ? Math.min(...bases) : null;
}

/**
 * 비행 등급 (미국 FAA 기준, 참고용 색 표시)
 * LIFR: 운고 <500ft 또는 시정 <1SM · IFR: <1000 / <3 · MVFR: ≤3000 / ≤5 · 그 외 VFR
 */
export function flightCategory(ceil: number | null, vis: number | null): FltCat | null {
  if (ceil == null && vis == null) return null;
  const c = ceil ?? Infinity;
  const v = vis ?? Infinity;
  if (c < 500 || v < 1) return 'LIFR';
  if (c < 1000 || v < 3) return 'IFR';
  if (c <= 3000 || v <= 5) return 'MVFR';
  return 'VFR';
}

const clouds = (arr: Any): Cloud[] => (Array.isArray(arr) ? arr.map((c: Any) => ({ cover: String(c.cover ?? ''), base: num(c.base) })) : []);

export function decodeMetar(m: Any): Metar {
  const cl = clouds(m.clouds);
  const fc = (['VFR', 'MVFR', 'IFR', 'LIFR'] as const).find((x) => x === m.fltCat) ?? null;
  return {
    icao: String(m.icaoId),
    name: m.name ?? undefined,
    obsTime: iso(m.obsTime) || iso(m.reportTime),
    raw: String(m.rawOb ?? ''),
    wdir: wdir(m.wdir),
    wspd: num(m.wspd),
    wgst: num(m.wgst),
    visib: m.visib ?? null,
    temp: num(m.temp),
    dewp: num(m.dewp),
    altim: num(m.altim),
    clouds: cl,
    cover: m.cover ?? undefined,
    fltCat: fc ?? (m.cover === 'CAVOK' ? 'VFR' : flightCategory(ceilingFt(cl, num(m.vertVis)), visibSm(m.visib))),
    lat: num(m.lat) ?? undefined,
    lon: num(m.lon) ?? undefined,
  };
}

export function decodeTaf(t: Any): Taf {
  const periods: TafPeriod[] = (Array.isArray(t.fcsts) ? t.fcsts : []).map((f: Any) => {
    const cl = clouds(f.clouds);
    const vv = num(f.vertVis);
    return {
      from: iso(f.timeFrom),
      to: iso(f.timeTo),
      change: f.fcstChange ?? null,
      prob: num(f.probability),
      wdir: wdir(f.wdir),
      wspd: num(f.wspd),
      wgst: num(f.wgst),
      visib: f.visib ?? null,
      wx: f.wxString ?? null,
      clouds: cl,
      vertVis: vv,
      fltCat: cl.some((c) => c.cover === 'CAVOK') ? 'VFR' : flightCategory(ceilingFt(cl, vv), visibSm(f.visib)),
    };
  });
  return {
    icao: String(t.icaoId),
    name: t.name ?? undefined,
    issueTime: iso(t.issueTime),
    validFrom: iso(t.validTimeFrom),
    validTo: iso(t.validTimeTo),
    raw: String(t.rawTAF ?? ''),
    periods,
  };
}

const ring = (pts: Any): [number, number][] =>
  Array.isArray(pts) ? pts.filter((p: Any) => p && typeof p.lat === 'number' && typeof p.lon === 'number').map((p: Any) => [p.lat, p.lon] as [number, number]) : [];

/** 국제 SIGMET (isigmet) */
export function decodeIsigmet(s: Any): Sigmet {
  const c = s.coords;
  const polys = Array.isArray(c) && Array.isArray(c[0]) ? c.map(ring) : [ring(c)];
  return {
    id: `I-${s.firId}-${s.seriesId}-${s.validTimeFrom}`,
    source: 'intl',
    fir: String(s.firId ?? s.icaoId ?? ''),
    firName: s.firName ?? undefined,
    hazard: String(s.hazard ?? ''),
    qualifier: s.qualifier ?? undefined,
    base: num(s.base),
    top: num(s.top),
    validFrom: iso(s.validTimeFrom),
    validTo: iso(s.validTimeTo),
    raw: String(s.rawSigmet ?? ''),
    polys: polys.filter((p: [number, number][]) => p.length >= 3),
  };
}

/** 미국 국내 SIGMET (airsigmet 중 SIGMET만) */
export function decodeUsSigmet(s: Any): Sigmet {
  return {
    id: `U-${s.seriesId}-${s.validTimeFrom}`,
    source: 'us',
    fir: String(s.icaoId ?? 'KKCI'),
    hazard: String(s.hazard ?? ''),
    qualifier: s.severity != null ? `SEV ${s.severity}` : undefined,
    base: num(s.altitudeLow1),
    top: num(s.altitudeHi1),
    validFrom: iso(s.validTimeFrom),
    validTo: iso(s.validTimeTo),
    raw: String(s.rawAirSigmet ?? ''),
    polys: [ring(s.coords)].filter((p) => p.length >= 3),
  };
}

/* ---------------- FL ↔ 기압면 (표준대기) ---------------- */

/** 표준대기 기압 (hPa) — 고도 ft */
export function isaPressure(ft: number): number {
  if (ft <= 36089) return 1013.25 * (1 - 6.8756e-6 * ft) ** 5.2559;
  return 226.32 * Math.exp(-(ft - 36089) / 20806);
}

/** Open-Meteo에서 받는 기압면 (PROJECT_SPEC §5.6: FL180=500 … FL450=150). 850~600은 버티컬 뷰 상승·강하 구간용 (D-058) */
export const LEVELS_HPA = [850, 700, 600, 500, 400, 300, 250, 200, 150] as const;

export interface LevelValue {
  hpa: number;
  dir: number | null;
  spd: number | null;
  temp: number | null;
}

/** 두 기압면 사이를 ln(p)로 선형 보간 (바람은 u·v 성분으로) */
export function interpolateAtFl(fl: number, levels: LevelValue[]): { dir: number | null; spd: number | null; temp: number | null } {
  const p = isaPressure(fl * 100);
  const ok = levels.filter((l) => l.spd != null && l.dir != null && l.temp != null).sort((a, b) => b.hpa - a.hpa); // 높은 기압(낮은 고도)부터
  if (!ok.length) return { dir: null, spd: null, temp: null };
  let lo = ok[0];
  let hi = ok[ok.length - 1];
  for (let i = 0; i < ok.length - 1; i++) {
    if (ok[i].hpa >= p && ok[i + 1].hpa <= p) {
      lo = ok[i];
      hi = ok[i + 1];
      break;
    }
  }
  if (p >= ok[0].hpa) hi = lo = ok[0];
  if (p <= ok[ok.length - 1].hpa) lo = hi = ok[ok.length - 1];
  const f = lo === hi ? 0 : (Math.log(lo.hpa) - Math.log(p)) / (Math.log(lo.hpa) - Math.log(hi.hpa));
  const uv = (l: LevelValue) => {
    const r = ((l.dir as number) * Math.PI) / 180;
    return [-(l.spd as number) * Math.sin(r), -(l.spd as number) * Math.cos(r)];
  };
  const [u1, v1] = uv(lo);
  const [u2, v2] = uv(hi);
  const u = u1 + (u2 - u1) * f;
  const v = v1 + (v2 - v1) * f;
  const spd = Math.hypot(u, v);
  const dir = (((Math.atan2(-u, -v) * 180) / Math.PI) + 360) % 360;
  return {
    dir: Math.round(dir) || 360,
    spd: Math.round(spd),
    temp: Math.round((lo.temp as number) + ((hi.temp as number) - (lo.temp as number)) * f),
  };
}
