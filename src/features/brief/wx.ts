// 기상 → 판정용 값: 시정(m)·RVR(m)·운고(ft)·현상·바람. METAR는 원문에서 RVR·현상을 읽고, TAF는 시간 창으로 자른다.
// 해석하지 않은 원문은 화면에 그대로 함께 보인다.
import { ceilingFt, visibSm } from '../weather/decode';
import type { Metar, Taf, TafPeriod } from '../weather/types';

const SM_M = 1609.34;
/** SM로 바뀌어 온 미터 시정(6000m → 3.73SM)을 되돌릴 때 50m 단위로 */
const smToM = (sm: number) => (sm >= 6 ? 10000 : Math.round((sm * SM_M) / 50) * 50);
const FT_M = 0.3048;

export interface Rvr {
  rwy: string;
  m: number;
  /** P = 이상(위 한계), M = 미만(아래 한계) */
  qual?: 'P' | 'M';
  trend?: string;
}

export interface Cond {
  /** 시정 (m) — 9999 이상은 10000 */
  visM: number | null;
  /** 운고 (ft) — 없으면 null(구름 낮지 않음) */
  ceilFt: number | null;
  rvr: Rvr[];
  /** 현상 원문 (예 "-RA BR", "+TSRA") */
  wx: string;
  wdir: number | 'VRB' | null;
  wspd: number | null;
  wgst: number | null;
  temp?: number | null;
}

/** 판정에 쓸 시정: RVR이 있으면 가장 낮은 RVR, 없으면 시정 */
export function controllingVis(c: Cond): { m: number | null; kind: 'RVR' | 'VIS' } {
  const r = c.rvr.map((x) => x.m);
  if (r.length) return { m: Math.min(...r), kind: 'RVR' };
  return { m: c.visM, kind: 'VIS' };
}

const RVR_RE = /^R(\d{2}[LRC]?)\/([PM])?(\d{4})(?:V([PM])?(\d{4}))?(FT)?(?:\/?([UDN]))?$/;
const WX_RE = /^(?:[-+]|VC)?(?:MI|BC|PR|DR|BL|SH|TS|FZ)?(?:DZ|RA|SN|SG|PL|GR|GS|UP|IC|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)+$|^(?:[-+]|VC)?(?:TS|SH)$/;

/** METAR 원문에서 RVR·시정(m)·현상 */
export function parseMetarRaw(raw: string): { rvr: Rvr[]; visM: number | null; wx: string[]; vv: number | null } {
  const toks = raw.replace(/=\s*$/, '').split(/\s+/);
  const rvr: Rvr[] = [];
  const wx: string[] = [];
  let visM: number | null = null;
  let vv: number | null = null;
  // RMK·TEMPO·BECMG 뒤는 관측이 아님
  const end = toks.findIndex((t, i) => i > 1 && /^(RMK|TEMPO|BECMG|NOSIG)$/.test(t));
  const obs = end > 0 ? toks.slice(0, end) : toks;
  for (let i = 2; i < obs.length; i++) {
    const t = obs[i];
    const r = RVR_RE.exec(t);
    if (r) {
      const ft = r[6] === 'FT';
      // 변동 RVR(V)은 낮은 쪽을 쓴다
      const v = Number(r[3]);
      rvr.push({ rwy: r[1], m: Math.round(ft ? v * FT_M : v), qual: (r[2] as 'P' | 'M') || undefined, trend: r[7] });
      continue;
    }
    if (t === 'CAVOK') {
      visM = 10000;
      continue;
    }
    if (visM == null && /^\d{4}$/.test(t)) {
      visM = t === '9999' ? 10000 : Number(t);
      continue;
    }
    if (visM == null && /^\d{4}(N|NE|E|SE|S|SW|W|NW|NDV)$/.test(t)) {
      visM = Number(t.slice(0, 4));
      continue;
    }
    if (visM == null && /^(P|M)?(\d+|\d+\/\d+)SM$/.test(t)) {
      // "1 1/2SM" 은 앞 토큰이 정수
      const prev = obs[i - 1];
      const whole = /^\d$/.test(prev) ? Number(prev) : 0;
      const sm = visibSm(t.replace(/^[PM]/, '').replace('SM', ''));
      if (sm != null) visM = Math.round((whole + sm) * SM_M);
      continue;
    }
    const vvm = /^VV(\d{3}|\/\/\/)$/.exec(t);
    if (vvm) {
      vv = vvm[1] === '///' ? 0 : Number(vvm[1]) * 100;
      continue;
    }
    if (WX_RE.test(t)) wx.push(t);
  }
  return { rvr, visM, wx, vv };
}

export function metarCond(m: Metar): Cond {
  const p = parseMetarRaw(m.raw);
  const sm = visibSm(m.visib);
  const visM = p.visM ?? (sm != null ? smToM(sm) : null);
  return {
    visM,
    ceilFt: ceilingFt(m.clouds, p.vv),
    rvr: p.rvr,
    wx: p.wx.join(' '),
    wdir: m.wdir,
    wspd: m.wspd,
    wgst: m.wgst,
    temp: m.temp,
  };
}

export function periodCond(p: TafPeriod): Cond {
  const sm = visibSm(p.visib);
  return {
    visM: sm != null ? smToM(sm) : null,
    ceilFt: ceilingFt(p.clouds, p.vertVis),
    rvr: [],
    wx: p.wx ?? '',
    wdir: p.wdir,
    wspd: p.wspd,
    wgst: p.wgst,
  };
}

/** TEMPO·PROB = 일시적 변화 (FOM: 일시적 미달은 미달로 보지 않음 — 대신 교체공항 추가 검토) */
export const isTemporary = (p: TafPeriod) => p.change === 'TEMPO' || p.change === 'PROB' || p.prob != null;

export interface WindowCond {
  /** 기본 예보(FM·BECMG·처음) 가운데 가장 나쁜 값 */
  base: Cond | null;
  /** 일시적 변화 가운데 가장 나쁜 값 */
  temp: Cond | null;
  basePeriods: TafPeriod[];
  tempPeriods: TafPeriod[];
  /** 창이 TAF 유효기간 밖으로 나감 */
  outside: boolean;
}

/** 여러 조건 중 가장 나쁜 값 (시정·운고는 최소, 바람은 최대, 현상은 합침) */
export function worst(conds: Cond[]): Cond | null {
  if (!conds.length) return null;
  const min = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.min(...v) : null;
  };
  const max = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? Math.max(...v) : null;
  };
  // 바람은 가장 센 기간의 방향
  const strongest = [...conds].sort((a, b) => (b.wgst ?? b.wspd ?? 0) - (a.wgst ?? a.wspd ?? 0))[0];
  return {
    visM: min(conds.map((c) => c.visM)),
    ceilFt: min(conds.map((c) => c.ceilFt)),
    rvr: conds.flatMap((c) => c.rvr),
    wx: [...new Set(conds.flatMap((c) => c.wx.split(/\s+/)).filter(Boolean))].join(' '),
    wdir: strongest.wdir,
    wspd: max(conds.map((c) => c.wspd)),
    wgst: max(conds.map((c) => c.wgst)),
    temp: min(conds.map((c) => c.temp ?? null)),
  };
}

/** TAF에서 [from, to] 시간 창과 겹치는 기간 */
export function tafWindow(t: Taf, from: number, to: number): WindowCond {
  const overl = t.periods.filter((p) => Date.parse(p.from) < to && Date.parse(p.to) > from);
  const basePeriods = overl.filter((p) => !isTemporary(p));
  const tempPeriods = overl.filter(isTemporary);
  // BECMG·TEMPO 기간은 바람·구름이 비어 있으면 바로 앞 기본 예보를 이어받는다 (AWC JSON은 바뀐 것만 줌)
  const fill = (p: TafPeriod): Cond => {
    const c = periodCond(p);
    const prev = [...t.periods].filter((q) => !isTemporary(q) && Date.parse(q.from) <= Date.parse(p.from) && q !== p).pop();
    if (!prev) return c;
    const pc = periodCond(prev);
    return {
      ...c,
      visM: c.visM ?? pc.visM,
      ceilFt: p.clouds.length || p.vertVis != null ? c.ceilFt : pc.ceilFt,
      wdir: c.wdir ?? pc.wdir,
      wspd: c.wspd ?? pc.wspd,
      wgst: c.wgst ?? (c.wspd == null ? pc.wgst : null),
    };
  };
  return {
    base: worst(basePeriods.map(fill)),
    temp: worst(tempPeriods.map(fill)),
    basePeriods,
    tempPeriods,
    outside: from < Date.parse(t.validFrom) || to > Date.parse(t.validTo),
  };
}

export const fmtVis = (m: number | null) => (m == null ? '—' : m >= 10000 ? '10km+' : `${m}m`);
export const fmtCeil = (ft: number | null) => (ft == null ? '없음' : `${ft}ft`);
export function fmtWind(c: Pick<Cond, 'wdir' | 'wspd' | 'wgst'>): string {
  if (c.wspd == null) return '—';
  const d = c.wdir === 'VRB' ? 'VRB' : c.wdir == null ? '///' : String(c.wdir).padStart(3, '0');
  return `${d}/${c.wspd}${c.wgst ? `G${c.wgst}` : ''}kt`;
}

/** 현상 분류 */
export const hasTs = (wx: string) => /TS/.test(wx);
export const hasHail = (wx: string) => /\b[-+]?(?:TS|SH)?(?:GR|GS)/.test(wx);
export const hasFreezing = (wx: string) => /FZ(?:RA|DZ|FG)/.test(wx);
export const hasSnowIce = (wx: string) => /(SN|SG|PL|IC|GS)/.test(wx);
export const hasRain = (wx: string) => /(RA|DZ)/.test(wx);
export const hasAsh = (wx: string) => /VA/.test(wx);
