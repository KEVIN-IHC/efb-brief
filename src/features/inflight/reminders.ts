// 순항 중 점검 알림: ETP 접근, 다음 FIR 통신 (비행 시간대에만). 매시간 연료는 Hourly check 카드가 담당, 지점 통과 기록은 없앰
import { formatZ } from '../../lib/time';
import { FIR_LEAD_MIN, firSequence, firTimeline } from '../fir/sequence';
import type { OfpData } from '../ofp/types';
import { revisedEto, type Projection, type WptCheck } from './deviation';

export const REMINDER_RULES = { etpLeadMin: 20 };

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
  // 4) 다음 FIR 진입 전 통신 확인 (D-055, 앱 기준 시점)
  const fir = firTimeline(firSequence(o).legs, checks, proj.timeDevMin, now).find((f) => f.state === 'next');
  if (fir?.leg.entry && fir.minsTo !== undefined && fir.minsTo >= 0 && fir.minsTo <= FIR_LEAD_MIN) {
    out.push({ id: `fir-${fir.leg.icao}`, level: 'info', text: `${fir.leg.icao} ${fir.leg.name} 진입 ${fir.minsTo}분 전 (${fir.leg.entry.wpt} ${formatZ(fir.at)}) — 주파수·CPDLC 로그온 확인` });
  }
  return out;
}
