// 활주로: OFP NOTAM의 "1. RUNWAY : 07L/25R : 12923FT X 150FT" 줄(길이·폭) + 공개 자료 runways.json(진방위) (D-050)
// 바람 성분은 진방위로 계산 (METAR·TAF 바람은 진방위). 진방위를 모르면 활주로 번호×10(자방위, 대략)으로 계산하고 "대략" 표시
import type { OfpData } from '../ofp/types';

export interface RunwayEnd {
  id: string; // 07L
  hdgT: number | null; // 진방위
  approx: boolean; // 번호로 추정한 방위 (자방위)
  lenFt: number | null;
  widthFt: number | null;
}

export interface AirportRunways {
  icao: string;
  ends: RunwayEnd[];
  /** 활주로 (양 끝 한 쌍) — 길이·폭 표시용 */
  strips: { ids: string; lenFt: number | null; widthFt: number | null; src: 'ofp' | 'data' }[];
  src: 'ofp' | 'data' | 'both' | 'none';
}

/** 앞 0 없애기: 06L → 6L (공개 자료 표기) */
const norm = (id: string) => id.replace(/^0(\d)/, '$1');
/** 7L → 07L (OFP 표기) */
const pad = (id: string) => (/^\d[LRC]?$/.test(id) ? `0${id}` : id);

/** OFP 공항 정보 줄 → 활주로 (양 끝, 길이, 폭) */
export function parseOfpRunways(info: string[]): { a: string; b: string; lenFt: number; widthFt: number }[] {
  const txt = info.join(' ');
  if (!/RUNWAY/i.test(txt)) return [];
  const out: { a: string; b: string; lenFt: number; widthFt: number }[] = [];
  for (const m of txt.matchAll(/\b(\d{2}[LRC]?)\s*\/\s*(\d{2}[LRC]?)\s*:\s*(\d{3,5})\s*FT\s*X\s*(\d{2,4})\s*FT/gi)) {
    out.push({ a: m[1], b: m[2], lenFt: Number(m[3]), widthFt: Number(m[4]) });
  }
  return out;
}

/** 공항별 OFP 활주로 줄 (패키지 여러 곳에 같은 공항이 나오면 정보 있는 쪽) */
export function ofpRunwayInfo(o: OfpData): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const p of o.notams?.packages ?? [])
    for (const l of p.locations) {
      const t = l.info.map((i) => i.text);
      if (parseOfpRunways(t).length && !out[l.icao]) out[l.icao] = t;
    }
  return out;
}

export type RunwayDb = Record<string, (string | number | null)[][]>;

let dbPromise: Promise<RunwayDb> | null = null;
export function loadRunwayDb(): Promise<RunwayDb> {
  if (!dbPromise)
    dbPromise = fetch(`${import.meta.env.BASE_URL}geo/runways.json`)
      .then((r) => (r.ok ? r.json() : { runways: {} }))
      .then((j) => (j.runways ?? {}) as RunwayDb)
      .catch(() => {
        dbPromise = null;
        return {};
      });
  return dbPromise;
}

export function airportRunways(icao: string, ofpInfo: string[] | undefined, db: RunwayDb): AirportRunways {
  const fromOfp = parseOfpRunways(ofpInfo ?? []);
  const rows = db[icao] ?? [];
  const hdg = new Map<string, number>();
  const dataStrips: AirportRunways['strips'] = [];
  for (const r of rows) {
    const [le, he, leH, heH, len, wid] = r as [string, string | null, number | null, number | null, number | null, number | null];
    if (leH != null) hdg.set(norm(le), leH);
    if (he && heH != null) hdg.set(norm(he), heH);
    dataStrips.push({ ids: he ? `${le}/${he}` : le, lenFt: len, widthFt: wid, src: 'data' });
  }
  const ends: RunwayEnd[] = [];
  const strips: AirportRunways['strips'] = [];
  const mk = (id: string, lenFt: number | null, widthFt: number | null): RunwayEnd => {
    const h = hdg.get(norm(id));
    const n = Number(id.slice(0, 2));
    return { id, hdgT: h ?? (Number.isFinite(n) ? (n * 10) % 360 || 360 : null), approx: h == null, lenFt, widthFt };
  };
  if (fromOfp.length) {
    for (const r of fromOfp) {
      ends.push(mk(r.a, r.lenFt, r.widthFt), mk(r.b, r.lenFt, r.widthFt));
      strips.push({ ids: `${r.a}/${r.b}`, lenFt: r.lenFt, widthFt: r.widthFt, src: 'ofp' });
    }
  } else {
    for (const r of rows) {
      const [le, he, , , len, wid] = r as [string, string | null, number | null, number | null, number | null, number | null];
      ends.push(mk(pad(le), len, wid));
      if (he) ends.push(mk(pad(he), len, wid));
    }
    strips.push(...dataStrips);
  }
  return { icao, ends, strips, src: fromOfp.length ? (rows.length ? 'both' : 'ofp') : rows.length ? 'data' : 'none' };
}

export interface WindComp {
  head: number; // + 정풍 / − 배풍
  cross: number; // 절대값
  tail: number; // 배풍 (≥0)
}

/** 바람(진방위 from, kt)과 활주로 방위 → 성분. VRB는 최악(측풍=풍속, 배풍=풍속)으로 */
export function windComponents(wdir: number | 'VRB' | null, spd: number, hdg: number): WindComp {
  if (wdir === 'VRB' || wdir == null) return { head: -spd, cross: spd, tail: spd };
  const a = ((wdir - hdg) * Math.PI) / 180;
  const head = Math.round(spd * Math.cos(a));
  const cross = Math.abs(Math.round(spd * Math.sin(a)));
  return { head, cross, tail: Math.max(0, -head) };
}

/**
 * 판정에 쓸 풍속 (FOM 바람 적용 규칙): 돌풍(Gust)이 있으면 Steady와 Gust 중 큰 값.
 * steadyOnly = 비행 계획 단계의 일반 공항(Steady 적용)
 */
export function windSpeedFor(spd: number | null, gst: number | null, steadyOnly: boolean): number | null {
  if (spd == null) return null;
  if (steadyOnly) return spd;
  return Math.max(spd, gst ?? 0);
}

export interface EndWind extends WindComp {
  end: RunwayEnd;
}

/** 모든 활주로 끝의 성분 — 정풍이 큰 순 (가장 유리한 활주로가 먼저) */
export function rankEnds(ends: RunwayEnd[], wdir: number | 'VRB' | null, spd: number): EndWind[] {
  return ends
    .filter((e) => e.hdgT != null)
    .map((e) => ({ end: e, ...windComponents(wdir, spd, e.hdgT!) }))
    .sort((a, b) => b.head - a.head || a.cross - b.cross);
}
