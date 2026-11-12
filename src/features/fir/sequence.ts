// FIR 통과 순서 (D-055): OFP NAV LOG의 "/ KZAK FIR … OAKLAND OCEANIC" 진입 줄 + PACKAGE 3 "FIR:" 목록
// - 진입 시각 = 진입 지점 ETO(계획) → 기록이 있으면 실제 ATA, 없으면 시간 편차 반영 수정 ETO
// - 출발 FIR = FIR 목록 첫 번째인데 NAV LOG 진입 줄이 없는 것 (이륙부터)
// - ADIZ는 FIR 경계가 아님 → 제외. 목록에는 있는데 NAV LOG 진입 지점이 없는 FIR은 숨기지 않고 따로 알림
import type { WptCheck } from '../inflight/deviation';
import { revisedEto } from '../inflight/deviation';
import type { OfpData } from '../ofp/types';

export interface FirLeg {
  icao: string;
  name: string;
  /** 없으면 출발 FIR (이륙부터) */
  entry?: { seq: number; wpt: string; eto: string; line?: number };
}

export interface FirSequence {
  legs: FirLeg[];
  /** PACKAGE 3 FIR 목록에 있지만 NAV LOG 진입 지점이 없는 FIR */
  unplaced: string[];
}

const ICAO = /^[A-Z]{4}$/;

export function firSequence(o: OfpData): FirSequence {
  const order = o.notams?.firOrder ?? [];
  const pkgName = new Map<string, string>();
  for (const p of o.notams?.packages ?? []) for (const l of p.locations) if (l.role === 'FIR' && l.name) pkgName.set(l.icao, l.name);

  const legs: FirLeg[] = [];
  for (const w of o.route) {
    if (!w.fir) continue;
    const icao = w.fir.slice(0, 4);
    if (!ICAO.test(icao) || icao === 'ADIZ') continue;
    if (legs.length && legs[legs.length - 1].icao === icao) continue; // 같은 FIR 연속 = 하나
    const name = w.fir.slice(4).trim() || pkgName.get(icao) || '';
    legs.push({ icao, name, entry: { seq: w.seq, wpt: w.name, eto: w.eto, line: w.srcLine } });
  }
  const first = order[0];
  if (first && first !== legs[0]?.icao) legs.unshift({ icao: first, name: pkgName.get(first) ?? '' });
  // NAV LOG에 이름이 없을 때 PACKAGE 3 이름으로
  for (const l of legs) if (!l.name) l.name = pkgName.get(l.icao) ?? '';

  const placed = new Set(legs.map((l) => l.icao));
  return { legs, unplaced: order.filter((f) => !placed.has(f)) };
}

export type FirState = 'past' | 'current' | 'next' | 'later';

export interface FirStatus {
  leg: FirLeg;
  /** 진입 시각 ISO (출발 FIR은 없음) */
  at?: string;
  /** at이 실제 통과 기록(ATA)인가 */
  actual: boolean;
  state: FirState;
  /** 진입까지 남은 분 (지났으면 음수) */
  minsTo?: number;
}

/** 지금 어느 FIR인지: 진입 지점 기록이 있거나 (수정) 진입 시각이 지났으면 들어간 것으로 본다 */
export function firTimeline(legs: FirLeg[], checks: WptCheck[], timeDevMin: number, now: number): FirStatus[] {
  const rows = legs.map((leg) => {
    if (!leg.entry) return { leg, actual: false, entered: true } as const;
    const c = checks.find((x) => x.w.seq === leg.entry!.seq);
    const at = c?.actual ? c.actual.ata : c ? revisedEto(c.w, timeDevMin) : leg.entry.eto;
    const t = Date.parse(at);
    return { leg, at, actual: !!c?.actual, entered: !!c?.actual || t <= now, minsTo: Math.round((t - now) / 60000) };
  });
  let cur = -1;
  rows.forEach((r, i) => r.entered && (cur = i));
  return rows.map((r, i) => ({
    leg: r.leg,
    at: 'at' in r ? r.at : undefined,
    actual: r.actual,
    minsTo: 'minsTo' in r ? r.minsTo : undefined,
    state: i < cur ? 'past' : i === cur ? 'current' : i === cur + 1 ? 'next' : 'later',
  }));
}

/** 다음 FIR 진입 전 확인 알림을 띄우는 시점 (앱 기준, 매뉴얼 수치 아님) */
export const FIR_LEAD_MIN = 10;
