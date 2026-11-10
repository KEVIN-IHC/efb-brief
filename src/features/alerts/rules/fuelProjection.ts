// 착륙 예상 연료·연료 편차 — 순항 기록 기준 (D-048: 착륙 예상은 FOM 8.2.1·8.2.1.1·8.2.1.2, 편차 %는 임시)
import { fmtKg, fmtSigned } from '../../../lib/format';
import { FUEL_DEV_RULES, type LandingStage } from '../../inflight/deviation';
import { FOM_REF, fomBasis } from '../fomRefs';
import type { AlertRule, Basis } from '../types';

const TITLE: Record<Exclude<LandingStage, 'ok'>, string> = {
  belowFinal: '예상 착륙 연료 < FINAL RES (목적지 기준)',
  minFuelPrep: '예상 착륙 연료 < FINAL×130% (MINIMUM FUEL)',
  belowAltnFinal: '예상 착륙 연료 < ALTN+FINAL',
  devCaution: `연료 편차 TRIP −${FUEL_DEV_RULES.cautionPctOfTrip * 100}% 초과`,
};

export const fuelProjection: AlertRule = {
  id: 'fuel-projection',
  name: '착륙 예상 연료·연료 편차',
  threshold: 'manual',
  manualRef: { doc: 'FOM', chapter: '8.2.1 In-Flight Fuel Management / 8.2.1.1 / 8.2.1.2' },
  evaluate(ctx) {
    const { o, proj } = ctx;
    if (!proj || proj.stage === 'ok' || !proj.lastFuel) return [];
    const U = o.unit.toUpperCase();
    const ests = [proj.landingIfPlanBurn, proj.landingIfTrend].filter((x): x is number => x !== undefined);
    const worst = Math.min(...ests);
    const basis: Basis[] = [];
    if (proj.stage === 'belowFinal') basis.push(fomBasis(ctx, FOM_REF.fuelEmergency), { kind: 'app', label: '앱은 목적지 착륙 예상만 계산 — 판단은 PIC' });
    if (proj.stage === 'belowFinal' || proj.stage === 'minFuelPrep') basis.push(fomBasis(ctx, FOM_REF.minFuel));
    if (proj.stage !== 'devCaution') basis.push(fomBasis(ctx, FOM_REF.inflightFuel));
    if (proj.stage === 'devCaution') basis.push({ kind: 'temporary', label: `편차 TRIP의 ${FUEL_DEV_RULES.cautionPctOfTrip * 100}% — 회사 매뉴얼에 수치 근거 없음` });
    basis.push(fomBasis(ctx, FOM_REF.fuelCheck));
    if (proj.lastFuel.w.srcLine) basis.push({ kind: 'ofp', label: `NAV LOG ${proj.lastFuel.w.name}`, ofpLine: proj.lastFuel.w.srcLine });
    return [
      {
        key: 'landing',
        severity: proj.level === 'ok' ? 'info' : proj.level,
        title: TITLE[proj.stage],
        detail: `${proj.lastFuel.w.name} 편차 ${fmtSigned(proj.lastFuel.fuelDev!)} ${U} · 예상 착륙 ${fmtKg(worst)} ${U} (FINAL ${fmtKg(o.fuel.finalReserve)} · ×130% ${fmtKg(proj.minFuelPrep)} · ALTN+FINAL ${fmtKg(proj.minLanding)})`,
        basis,
      },
    ];
  },
};
