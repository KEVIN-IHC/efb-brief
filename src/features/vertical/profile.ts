// 버티컬 뷰 계산 (D-058): 항로 단면 — 가로 = 누적 거리(NM), 세로 = FL
// 계획 고도·MSA·SR = OFP(공식), 바람·기온·결빙고도 = Open-Meteo 모델 예보(참고), SIGMET = AWC 발표(공식 기상)
import { bearingDeg } from '../../lib/geo';
import type { OfpData } from '../ofp/types';
import { isaPressure } from '../weather/decode';
import { pointInPoly, nearLon } from '../weather/route';
import type { Sigmet, WindPoint, WindsData } from '../weather/types';
import { shearLayers, tempGradient, type PointAt } from './wxTime';

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

/**
 * 권계면 (근사, D-099): 500 hPa 위에서 처음으로 기온 감률이 2 °C/km 이하가 되는 기압면의 고도 (WMO 정의를 받은 기압면 간격으로 단순화).
 * 기압면 간격이 넓어 수천 ft 오차 가능 — 참고값
 */
export function tropopauseFl(levels: { hpa: number; temp: number | null }[]): number | null {
  const lv = levels.filter((l) => l.temp != null && l.hpa <= 500).sort((a, b) => b.hpa - a.hpa);
  for (let i = 0; i < lv.length - 1; i++) {
    const z0 = flOfHpa(lv[i].hpa) * 100 * 0.3048;
    const z1 = flOfHpa(lv[i + 1].hpa) * 100 * 0.3048;
    const lapse = -((lv[i + 1].temp! - lv[i].temp!) / ((z1 - z0) / 1000));
    if (lapse <= 2) return flOfHpa(lv[i].hpa);
  }
  return null;
}

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
  /** 거리 방향 기온 경도 °C/100NM (D-064) */
  grad?: number | null;
  /** 3시간 사이 기온 변화 °C (D-064) */
  dT3?: number | null;
}

/** 기압면 사이 층의 난류 지수 칸 (D-064) */
export interface TurbCell {
  x0: number;
  x1: number;
  fl0: number;
  fl1: number;
  vws: number;
  ri: number | null;
  level: 0 | 1 | 2 | 3;
}

const isaTemp = (fl: number) => Math.max(-56.5, 15 - 1.98 * (fl / 10));

/** 지점별 사용할 값 (시간 선택 반영). 없으면 예전 캐시처럼 p.levels */
export type PickFn = (p: WindPoint) => PointAt | null;
const defaultPick: PickFn = (p) => (p.levels ? { levels: p.levels, freezingFt: p.freezingFt ?? null, time: p.time } : null);

/** 예보 지점마다 세로 칸 (기압면 사이 경계 = 두 면 FL의 중간) */
export function windCells(
  o: OfpData,
  winds: WindsData | null,
  pick: PickFn = defaultPick,
): { cells: WindCell[]; turb: TurbCell[]; freezing: { x: number; fl: number }[]; tropo: { x: number; fl: number }[]; times: string[] } {
  if (!winds?.points.length) return { cells: [], turb: [], freezing: [], tropo: [], times: [] };
  const bySeq = new Map(o.route.map((w, i) => [w.seq, i]));
  const pts = winds.points
    .map((p) => {
      const i = bySeq.get(p.seq);
      if (i === undefined) return null;
      const w = o.route[i];
      const nb = o.route[i + 1] ?? o.route[i - 1];
      const track = nb ? (o.route[i + 1] ? bearingDeg(w, nb) : bearingDeg(nb, w)) : 0;
      const at = pick(p);
      return at ? { p, at, x: w.cumDist, track } : null;
    })
    .filter((v): v is NonNullable<typeof v> => !!v)
    .sort((a, b) => a.x - b.x);
  const cells: WindCell[] = [];
  const turb: TurbCell[] = [];
  const freezing: { x: number; fl: number }[] = [];
  const tropo: { x: number; fl: number }[] = [];
  const total = o.route[o.route.length - 1]?.cumDist ?? 0;
  const tempAt = (k: number, hpa: number) => pts[k]?.at.levels.find((l) => l.hpa === hpa)?.temp ?? null;
  pts.forEach((v, k) => {
    const x0 = k === 0 ? Math.max(0, v.x - (pts[1] ? (pts[1].x - v.x) / 2 : 50)) : (pts[k - 1].x + v.x) / 2;
    const x1 = k === pts.length - 1 ? Math.min(total, v.x + (k ? (v.x - pts[k - 1].x) / 2 : 50)) : (v.x + pts[k + 1].x) / 2;
    if (v.at.freezingFt != null) freezing.push({ x: v.x, fl: Math.round(v.at.freezingFt / 100) });
    const tp = tropopauseFl(v.at.levels);
    if (tp != null) tropo.push({ x: v.x, fl: tp });
    const lv = v.at.levels.slice().sort((a, b) => b.hpa - a.hpa); // 낮은 고도부터
    const fls = lv.map((l) => flOfHpa(l.hpa));
    const kp = Math.max(0, k - 1);
    const kn = Math.min(pts.length - 1, k + 1);
    lv.forEach((l, j) => {
      const fl0 = j === 0 ? Math.max(0, fls[0] - (fls[1] - fls[0]) / 2) : (fls[j - 1] + fls[j]) / 2;
      const fl1 = j === lv.length - 1 ? fls[j] + (fls[j] - fls[j - 1]) / 2 : (fls[j] + fls[j + 1]) / 2;
      const comp = l.spd != null && l.dir != null ? -Math.round(l.spd * Math.cos(((l.dir - v.track) * Math.PI) / 180)) : null;
      const prevT = v.at.prev?.find((q) => q.hpa === l.hpa)?.temp ?? null;
      cells.push({
        x0,
        x1,
        fl0,
        fl1,
        comp,
        temp: l.temp,
        isaDev: l.temp != null ? Math.round(l.temp - isaTemp(fls[j])) : null,
        hpa: l.hpa,
        grad: kn !== kp ? tempGradient(tempAt(kp, l.hpa), tempAt(kn, l.hpa), pts[kn].x - pts[kp].x) : null,
        dT3: l.temp != null && prevT != null ? Math.round((l.temp - prevT) * 10) / 10 : null,
      });
    });
    for (const s of shearLayers(lv, flOfHpa)) turb.push({ x0, x1, fl0: flOfHpa(s.hpaLow), fl1: flOfHpa(s.hpaHigh), vws: s.vws, ri: s.ri, level: s.level });
  });
  return { cells, turb, freezing, tropo, times: pts.map((v) => v.at.time) };
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
