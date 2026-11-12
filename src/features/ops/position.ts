// 사건 시각의 계획 위치 (D-056) — 사건 기록·보고서 초안용
import { revisedEto } from '../inflight/deviation';
import type { OfpData } from '../ofp/types';

/** 사건 시각의 계획 위치 (기록 편차 반영 ETO 기준) */
export function positionAt(o: OfpData | null, iso: string, timeDevMin: number): string {
  if (!o?.route.length) return '';
  const t = Date.parse(iso);
  const pts = o.route.map((w) => ({ w, t: Date.parse(revisedEto(w, timeDevMin)) }));
  if (t < pts[0].t) return `이륙 전 (${o.header.dep})`;
  const i = pts.findIndex((p) => p.t > t);
  if (i === -1) return `${o.header.arr} 도착 후`;
  const a = pts[i - 1];
  const b = pts[i];
  const fl = a.w.flText && !/^\d+$/.test(a.w.flText) ? a.w.flText : `FL${a.w.fl}`;
  return `${a.w.name}→${b.w.name} (${a.w.name} 후 ${Math.round((t - a.t) / 60000)}분, 계획 ${fl})`;
}
