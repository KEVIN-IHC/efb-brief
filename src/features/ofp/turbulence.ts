// 난류(SR, shear rate) 구간 묶기 — NAV LOG의 웨이포인트별 SR 값으로 연속 구간을 만든다
// ⚠ 임시 기준: 회사 OFP 디스패치 노트 표현 "HIGH SR(7-8)", "HIGH SR(8-14)" 를 근거로 7 이상 HIGH.
//   회사 매뉴얼 기준 확정 필요 (SPEC §17-5). 나중에 Settings로 이동
import type { OfpWaypoint } from './types';

export const SR_THRESHOLDS = { caution: 5, high: 7 };
export const SR_BASIS = '임시 기준 · SR 5–6 주의, 7 이상 HIGH (디스패치 노트 표현 "HIGH SR(7-8)" 근거) · 회사 매뉴얼 확인 필요';

export type SrLevel = 'none' | 'caution' | 'warning';

export function srLevel(sr: number | null | undefined, th = SR_THRESHOLDS): SrLevel {
  if (sr == null) return 'none';
  if (sr >= th.high) return 'warning';
  if (sr >= th.caution) return 'caution';
  return 'none';
}

export interface TurbZone {
  from: OfpWaypoint; // 구간 시작 (첫 해당 지점의 직전 지점 — SR은 그 구간 값)
  to: OfpWaypoint;
  points: OfpWaypoint[];
  maxSr: number;
  level: Exclude<SrLevel, 'none'>;
  fls: string; // 예: "FL370" / "FL370–390"
}

const flLabel = (pts: OfpWaypoint[]) => {
  const fls = [...new Set(pts.map((p) => (p.fl > 0 ? p.fl : NaN)).filter((x) => !Number.isNaN(x)))].sort((a, b) => a - b);
  if (!fls.length) return pts[0]?.flText ?? '—';
  return fls.length === 1 ? `FL${fls[0]}` : `FL${fls[0]}–${fls[fls.length - 1]}`;
};

/** 주의 이상인 지점이 연속되면 한 구간으로. 사이에 1개 지점만 낮으면 이어 붙임 */
export function turbulenceZones(route: OfpWaypoint[], th = SR_THRESHOLDS): TurbZone[] {
  const zones: TurbZone[] = [];
  let cur: OfpWaypoint[] = [];
  let gap = 0;
  const close = () => {
    if (!cur.length) return;
    const first = route.indexOf(cur[0]);
    const maxSr = Math.max(...cur.map((p) => p.sr ?? 0));
    zones.push({
      from: route[Math.max(0, first - 1)],
      to: cur[cur.length - 1],
      points: cur,
      maxSr,
      level: maxSr >= th.high ? 'warning' : 'caution',
      fls: flLabel(cur),
    });
    cur = [];
    gap = 0;
  };
  for (const w of route) {
    if (srLevel(w.sr, th) !== 'none') {
      cur.push(w);
      gap = 0;
    } else if (cur.length && gap === 0 && w.sr != null) {
      gap = 1; // 한 지점 정도 낮아지는 건 같은 구간으로 봄
    } else {
      close();
    }
  }
  close();
  return zones;
}
