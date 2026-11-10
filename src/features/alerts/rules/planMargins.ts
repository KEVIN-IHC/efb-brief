// OFP 계획 여유 — 중량 한계·블록 연료·ETP 임계 연료 (margins.ts 임시 기준, 회사 매뉴얼 근거 없음)
import { fmtKg } from '../../../lib/format';
import { etpMargin, fuelMargin, limitMargin, THRESHOLDS } from '../../ofp/margins';
import { FOM_REF, fomBasis } from '../fomRefs';
import type { AlertResult, AlertRule } from '../types';

const BASIS = `임시 기준 · 한계까지 ${THRESHOLDS.weightCautionKg / 1000}t·최소 연료 대비 ${THRESHOLDS.fuelCautionKg / 1000}t·ETP 임계 연료 대비 ${THRESHOLDS.etpCautionKg / 1000}t 미만 주의 (kg 기준, lbs OFP는 환산)`;

export const planMargins: AlertRule = {
  id: 'plan-margins',
  name: 'OFP 계획 여유',
  threshold: 'temporary',
  evaluate(ctx) {
    const { o } = ctx;
    const U = o.unit.toUpperCase();
    const out: AlertResult[] = [];
    for (const k of ['zfw', 'tow', 'lw'] as const) {
      const m = limitMargin(o.weights[k], o.unit);
      if (m.level !== 'ok')
        out.push({
          key: k,
          severity: m.level,
          title: `${k.toUpperCase()} 한계 여유 ${fmtKg(m.margin)} ${U}`,
          detail: `계획 ${fmtKg(o.weights[k].planned)} / 한계 ${fmtKg(o.weights[k].limit)} ${U}`,
          basis: [{ kind: 'temporary', label: BASIS }],
        });
    }
    const f = fuelMargin(o.fuel, o.unit);
    if (f.level !== 'ok')
      out.push({
        key: 'block',
        severity: f.level,
        title: f.margin < 0 ? `블록 연료가 최소 요구보다 ${fmtKg(-f.margin)} ${U} 적음` : `블록 연료 − 최소 요구 ${fmtKg(f.margin)} ${U}`,
        basis: [fomBasis(ctx, FOM_REF.reqTakeoff), ...(f.margin < 0 ? [] : [{ kind: 'temporary' as const, label: BASIS }])],
      });
    for (const e of o.etps) {
      const m = etpMargin(e, o.unit);
      if (m && m.level !== 'ok')
        out.push({
          key: `etp:${e.name}`,
          severity: m.level,
          title: `${e.name} 임계 연료 여유 ${fmtKg(m.margin)} ${U}`,
          detail: `${e.airports.join('/')} · FOB ${fmtKg(e.fuelOnBoard)} / 임계 ${fmtKg(e.criticalFuel)} ${U} (OFP 명시값)`,
          basis: [fomBasis(ctx, FOM_REF.edtoCritical), fomBasis(ctx, FOM_REF.edtoMonitor), ...(m.margin < 0 ? [] : [{ kind: 'temporary' as const, label: BASIS }])],
        });
    }
    return out;
  },
};
