// 버티컬 뷰 계산 (D-058): 항로 단면 — 가로 = 누적 거리(NM), 세로 = FL
// 계획 고도·MSA·SR = OFP(공식), 바람·기온·결빙고도 = Open-Meteo 모델 예보(참고), SIGMET = AWC 발표(공식 기상)
import { bearingDeg } from '../../lib/geo';
import type { OfpData } from '../ofp/types';
import { isaPressure } from '../weather/decode';
import { pointInPoly, nearLon } from '../weather/route';
import type { Sigmet, WindsData } from '../weather/types';

export interface ProfilePoint {
  x: number; // NM
  fl: number;
  name: string;
}

/** 계획 고도선: 순항 지점(fl>0) + 출발·도착 0. CLB/DSC 줄(fl 0)은 건너뛰어 직선으로 잇는다 */
export function plannedProfile(o: OfpData): ProfilePoint[] {
  const r = o.route;
  if (!r.length) return [];
  const pts: ProfilePoint[] = [{ x: 0, fl: 0, name: r[0].name }];
  for (const w of r.slice(1, -1)) if (w.fl > 0) pts.push({ x: w.cumDist, fl: w.fl, name: w.name });
  const last = r[r.length - 1];
  pts.push({ x: last.cumDist, fl: 0, name: last.name });
  return pts;
}

export const flOfHpa = (hpa: number) => {
  // 표준대기 역산 (이분법)
  let lo = 0;
  let hi = 60000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (isaPressure(mid) > hpa) lo = mid;
    else hi = mid;
  }
  return Math.round(lo / 100);
};

export interface WindCell {
  x0: number;
  x1: number;
  fl0: number;
  fl1: number;
  /** + 뒷바람, − 앞바람 (kt, 진로 기준) */
  comp: number | null;
  temp: number | null;
  isaDev: number | null;
  hpa: number;
}

const isaTemp = (fl: number) => Math.max(-56.5, 15 - 1.98 * (fl / 10));

/** 예보 지점마다 세로 칸 (기압면 사이 경계 = 두 면 FL의 중간) */
export function windCells(o: OfpData, winds: WindsData | null): { cells: WindCell[]; freezing: { x: number; fl: number }[] } {
  if (!winds?.points.length) return { cells: [], freezing: [] };
  const bySeq = new Map(o.route.map((w, i) => [w.seq, i]));
  const pts = winds.points
    .map((p) => {
      const i = bySeq.get(p.seq);
      if (i === undefined) return null;
      const w = o.route[i];
      const nb = o.route[i + 1] ?? o.route[i - 1];
      const track = nb ? (o.route[i + 1] ? bearingDeg(w, nb) : bearingDeg(nb, w)) : 0;
      return { p, x: w.cumDist, track };
    })
    .filter((v): v is NonNullable<typeof v> => !!v)
    .sort((a, b) => a.x - b.x);
  const cells: WindCell[] = [];
  const freezing: { x: number; fl: number }[] = [];
  const total = o.route[o.route.length - 1]?.cumDist ?? 0;
  pts.forEach((v, k) => {
    const x0 = k === 0 ? Math.max(0, v.x - (pts[1] ? (pts[1].x - v.x) / 2 : 50)) : (pts[k - 1].x + v.x) / 2;
    const x1 = k === pts.length - 1 ? Math.min(total, v.x + (k ? (v.x - pts[k - 1].x) / 2 : 50)) : (v.x + pts[k + 1].x) / 2;
    if (v.p.freezingFt != null) freezing.push({ x: v.x, fl: Math.round(v.p.freezingFt / 100) });
    const lv = (v.p.levels ?? []).slice().sort((a, b) => b.hpa - a.hpa); // 낮은 고도부터
    const fls = lv.map((l) => flOfHpa(l.hpa));
    lv.forEach((l, j) => {
      const fl0 = j === 0 ? Math.max(0, fls[0] - (fls[1] - fls[0]) / 2) : (fls[j - 1] + fls[j]) / 2;
      const fl1 = j === lv.length - 1 ? fls[j] + (fls[j] - fls[j - 1]) / 2 : (fls[j] + fls[j + 1]) / 2;
      const comp = l.spd != null && l.dir != null ? -Math.round(l.spd * Math.cos(((l.dir - v.track) * Math.PI) / 180)) : null;
      cells.push({ x0, x1, fl0, fl1, comp, temp: l.temp, isaDev: l.temp != null ? Math.round(l.temp - isaTemp(fls[j])) : null, hpa: l.hpa });
    });
  });
  return { cells, freezing };
}

export interface SigmetSpan {
  id: string;
  hazard: string;
  x0: number;
  x1: number;
  base: number | null; // FL
  top: number | null;
  raw: string;
}

/** 항로 지점이 SIGMET 다각형 안에 드는 구간 (지점 ETO가 유효시간에 걸칠 때만) */
export function sigmetSpans(o: OfpData, sigmets: Sigmet[], now = Date.now()): SigmetSpan[] {
  const out: SigmetSpan[] = [];
  for (const s of sigmets) {
    const from = Date.parse(s.validFrom);
    const to = Date.parse(s.validTo);
    if (Number.isFinite(to) && to < now) continue;
    let run: number[] = [];
    const flush = () => {
      if (run.length) out.push({ id: `${s.id}-${run[0]}`, hazard: s.hazard, x0: o.route[run[0]].cumDist, x1: o.route[run[run.length - 1]].cumDist, base: s.base != null ? Math.round(s.base / 100) : null, top: s.top != null ? Math.round(s.top / 100) : null, raw: s.raw });
      run = [];
    };
    o.route.forEach((w, i) => {
      const t = Date.parse(w.eto);
      const timeOk = !Number.isFinite(t) || !Number.isFinite(from) || (t >= from - 3_600_000 && t <= to + 3_600_000);
      const inside = timeOk && s.polys.some((poly) => pointInPoly(w.lat, nearLon(w.lon, poly[0]?.[1] ?? w.lon), poly));
      if (inside) run.push(i);
      else flush();
    });
    flush();
  }
  return out;
}
