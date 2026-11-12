// 순항 중 점검 알림: 매시간 연료 점검, ETP 접근, 통과 기록 지연 (비행 시간대에만)
import { fmtHm } from '../../lib/format';
import { formatZ } from '../../lib/time';
import { FIR_LEAD_MIN, firSequence, firTimeline } from '../fir/sequence';
import type { OfpData } from '../ofp/types';
import { nextWaypoint, revisedEto, type Projection, type WptCheck } from './deviation';

export const REMINDER_RULES = { fuelCheckMin: 60, etpLeadMin: 20, overdueMin: 5 };

export interface Reminder {
  id: string;
  level: 'info' | 'caution';
  text: string;
}

export function reminders(o: OfpData, checks: WptCheck[], proj: Projection, now: number): Reminder[] {
  const out: Reminder[] = [];
  const takeoff = Date.parse(o.header.takeoff);
  const eta = Date.parse(proj.eta);
  if (now < takeoff || now > eta + 30 * 60000) return out; // 비행 중일 때만

  // 1) 매시간 연료 점검
  const lastFuelAt = proj.lastFuel ? Date.parse(proj.lastFuel.actual!.ata) : takeoff;
  const since = Math.round((now - lastFuelAt) / 60000);
  if (since >= REMINDER_RULES.fuelCheckMin) {
    out.push({ id: 'fuel', level: 'caution', text: `연료 점검 시간 — 마지막 연료 기록 후 ${fmtHm(since)}` });
  }
  // 2) ETP 접근
  for (const e of o.etps) {
    const w = o.route.find((r) => r.name === e.name);
    const t = w ? Date.parse(revisedEto(w, proj.timeDevMin)) : Date.parse(e.eto);
    const mins = Math.round((t - now) / 60000);
    const passed = w && checks.find((c) => c.w.seq === w.seq)?.actual;
    if (!passed && mins >= 0 && mins <= REMINDER_RULES.etpLeadMin) {
      out.push({ id: `etp-${e.name}`, level: 'info', text: `${e.name} ${e.airports.join('/')} 접근 — ${formatZ(new Date(t).toISOString())} (${mins}분 후) · ETP 점검` });
    }
  }
  // 3) 통과 기록 지연
  const next = nextWaypoint(checks);
  if (next) {
    const t = Date.parse(revisedEto(next.w, proj.timeDevMin));
    const late = Math.round((now - t) / 60000);
    if (late >= REMINDER_RULES.overdueMin) out.push({ id: 'overdue', level: 'info', text: `${next.w.name} 통과 기록 대기 (수정 ETO ${formatZ(new Date(t).toISOString())}, ${late}분 경과)` });
  }
  // 4) 다음 FIR 진입 전 통신 확인 (D-055, 앱 기준 시점)
  const fir = firTimeline(firSequence(o).legs, checks, proj.timeDevMin, now).find((f) => f.state === 'next');
  if (fir?.leg.entry && fir.minsTo !== undefined && fir.minsTo >= 0 && fir.minsTo <= FIR_LEAD_MIN) {
    out.push({ id: `fir-${fir.leg.icao}`, level: 'info', text: `${fir.leg.icao} ${fir.leg.name} 진입 ${fir.minsTo}분 전 (${fir.leg.entry.wpt} ${formatZ(fir.at)}) — 주파수·CPDLC 로그온 확인` });
  }
  return out;
}
