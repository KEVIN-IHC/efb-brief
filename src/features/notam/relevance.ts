// 비행과의 관련성: 공항 역할, FIR 통과 시간, NOTAM 유효기간과의 겹침 (D-043)
// - 공항(패키지 1·2): 비행 시간대 = 계획 이륙(ETD) ~ 도착(ETA)
// - FIR(패키지 3): NAV LOG의 FIR 진입 지점 ETO로 통과 시간대를 만들고, 없으면 비행 시간대
// - D) 시간표는 해석하지 않는다 → "시간표 있음 — 원문 확인" (잘못 해석해 '해당 없음'으로 오판하지 않도록)
// 어떤 경우에도 NOTAM을 숨기지 않는다. 겹침 여부는 표시만.
import type { OfpData, OfpNotamItem } from '../ofp/types';

export interface Window {
  from: number;
  to: number;
  /** 화면 문구 근거 (예: "NAV LOG FIR 진입 L812") */
  basis: string;
}

export type TimeStatus = 'overlap' | 'before' | 'after' | 'unknown';

export const ROLE_LABEL: Record<string, string> = {
  DEP: '출발',
  DEST: '도착',
  ALTN: '목적지 교체',
  ETP: 'ETP 공항',
  EDTO: 'EDTO 교체',
  ERA: '항로 교체(ERA)',
  '3% ERA': '3% ERA',
  REFILE: 'REFILE',
  FIR: 'FIR',
};

export function flightWindow(o: OfpData): Window {
  return { from: Date.parse(o.header.takeoff), to: Date.parse(o.header.sta), basis: 'ETD~ETA (OFP)' };
}

/** FIR별 통과 시간대. 같은 FIR을 두 번 지나면 둘 다 */
export function firWindows(o: OfpData, firOrder: string[]): Map<string, Window[]> {
  const fw = flightWindow(o);
  // ADIZ는 FIR 경계 아님 → 제외
  const entries = o.route.filter((w) => w.fir && /^[A-Z]{4}\b/.test(w.fir) && !w.fir.startsWith('ADIZ')).map((w) => ({ icao: w.fir!.slice(0, 4), at: Date.parse(w.eto), line: w.srcLine, name: w.name }));
  const out = new Map<string, Window[]>();
  const push = (k: string, w: Window) => out.set(k, [...(out.get(k) ?? []), w]);
  // 출발 FIR: 이륙 ~ 첫 진입 (FIR 목록 첫 번째이고 NAV LOG 진입 표시가 없는 경우)
  const first = firOrder[0];
  if (first && entries.length && !entries.some((e) => e.icao === first)) push(first, { from: fw.from, to: entries[0].at, basis: `이륙 ~ ${entries[0].name} (NAV LOG)` });
  entries.forEach((e, i) => {
    const to = i + 1 < entries.length ? entries[i + 1].at : fw.to;
    if (to > e.at || i + 1 === entries.length) push(e.icao, { from: e.at, to: Math.max(to, e.at), basis: `${e.name} 진입${e.line ? ` L${e.line}` : ''} (NAV LOG)` });
  });
  return out;
}

export function timeStatus(it: OfpNotamItem, wins: Window[]): TimeStatus {
  if (it.kind === 'text' || !it.from || !wins.length) return 'unknown';
  const f = Date.parse(it.from);
  const t = it.to ? Date.parse(it.to) : Infinity;
  if (wins.some((w) => f <= w.to && t >= w.from)) return 'overlap';
  if (wins.every((w) => t < w.from)) return 'before';
  if (wins.every((w) => f > w.to)) return 'after';
  return 'unknown';
}

export const TIME_TEXT: Record<TimeStatus, string> = {
  overlap: '비행 시간대와 겹침',
  before: '비행 전에 끝남',
  after: '비행 후 시작',
  unknown: '시간 판단 없음',
};
