// 순항 기록 계산 (SPEC §11): 시간·연료 편차, 착륙 예상 연료, 수정 ETO
// 모든 연료 값은 OFP 단위(OfpData.unit) 그대로
import type { OfpData, OfpWaypoint } from '../ofp/types';

export interface Actual {
  seq: number;
  ata: string; // ISO UTC
  fuel: number | null; // 실제 잔여연료 (미입력 가능)
  logId: string;
  createdAt: string;
}

export interface WptCheck {
  w: OfpWaypoint;
  actual?: Actual;
  timeDevMin?: number; // + 늦음
  fuelDev?: number; // + 계획보다 많음
}

/** ⚠ 임시 기준 — 회사 매뉴얼로 확정 필요 (SPEC §17-5) */
export const FUEL_DEV_RULES = {
  /** 실제 연료가 계획보다 TRIP의 이 비율 이상 적으면 주의 */
  cautionPctOfTrip: 0.02,
  /** 예상 착륙 연료가 (ALTN + FINAL RES) + 이 비율 × FINAL RES 이하면 주의, (ALTN+FINAL) 미만이면 경고 */
  landingCautionPctOfFinal: 0.5,
  basis: '임시 기준 · 편차 TRIP의 −2% 주의 · 예상 착륙 연료 < ALTN+FINAL 경고 · 회사 매뉴얼 확인 필요',
};

export function buildChecks(o: OfpData, actuals: Map<number, Actual>): WptCheck[] {
  return o.route.map((w) => {
    const a = actuals.get(w.seq);
    if (!a) return { w };
    return {
      w,
      actual: a,
      timeDevMin: Math.round((Date.parse(a.ata) - Date.parse(w.eto)) / 60000),
      fuelDev: a.fuel == null ? undefined : a.fuel - w.fuelRem,
    };
  });
}

export interface Projection {
  last?: WptCheck; // 가장 최근 (시간상 마지막) 기록 지점
  lastFuel?: WptCheck; // 연료가 입력된 마지막 지점
  timeDevMin: number; // 현재 시간 편차 (마지막 기록 기준)
  plannedLanding: number; // OFP 계획 착륙 연료 (FOD)
  minLanding: number; // ALTN + FINAL RES
  /** 남은 구간을 계획대로 소모할 때 */
  landingIfPlanBurn?: number;
  /** 지금까지의 편차 추세(시간당)가 계속될 때 */
  landingIfTrend?: number;
  trendPerHour?: number;
  level: 'ok' | 'caution' | 'warning';
  eta: string; // 수정 ETA
}

export function project(o: OfpData, checks: WptCheck[]): Projection {
  const last = o.route[o.route.length - 1];
  const plannedLanding = last.fuelRem;
  const minLanding = o.fuel.alternate + o.fuel.finalReserve;
  const withAta = checks.filter((c) => c.actual);
  const withFuel = withAta.filter((c) => c.fuelDev !== undefined);
  const lastC = withAta[withAta.length - 1];
  const lastF = withFuel[withFuel.length - 1];
  const timeDevMin = lastC?.timeDevMin ?? 0;
  const eta = new Date(Date.parse(last.eto) + timeDevMin * 60000).toISOString();

  let landingIfPlanBurn: number | undefined;
  let landingIfTrend: number | undefined;
  let trendPerHour: number | undefined;
  if (lastF) {
    landingIfPlanBurn = plannedLanding + lastF.fuelDev!;
    // 추세: 연료 입력 지점이 2개 이상이고 30분 이상 떨어져 있을 때만 (짧으면 잡음)
    const firstF = withFuel[0];
    const dtH = (lastF.w.cumMin - firstF.w.cumMin) / 60;
    if (withFuel.length >= 2 && dtH >= 0.5) {
      trendPerHour = (lastF.fuelDev! - firstF.fuelDev!) / dtH;
      const remainH = (last.cumMin - lastF.w.cumMin) / 60;
      landingIfTrend = landingIfPlanBurn + trendPerHour * remainH;
    }
  }
  const worst = Math.min(...[landingIfPlanBurn, landingIfTrend].filter((x): x is number => x !== undefined), Infinity);
  const level: Projection['level'] =
    worst === Infinity
      ? 'ok'
      : worst < minLanding
        ? 'warning'
        : worst < minLanding + o.fuel.finalReserve * FUEL_DEV_RULES.landingCautionPctOfFinal || (lastF && lastF.fuelDev! < -o.fuel.trip * FUEL_DEV_RULES.cautionPctOfTrip)
          ? 'caution'
          : 'ok';
  return { last: lastC, lastFuel: lastF, timeDevMin, plannedLanding, minLanding, landingIfPlanBurn, landingIfTrend, trendPerHour, level, eta };
}

/** 지점별 편차 수준 (목록 색) */
export function fuelDevLevel(o: OfpData, dev: number | undefined): 'ok' | 'caution' | 'warning' {
  if (dev === undefined) return 'ok';
  if (dev < -o.fuel.trip * FUEL_DEV_RULES.cautionPctOfTrip * 2) return 'warning';
  if (dev < -o.fuel.trip * FUEL_DEV_RULES.cautionPctOfTrip) return 'caution';
  return 'ok';
}

/** 다음 지점 = 마지막 기록 이후 첫 지점 */
export function nextWaypoint(checks: WptCheck[]): WptCheck | undefined {
  let lastIdx = -1;
  checks.forEach((c, i) => {
    if (c.actual) lastIdx = i;
  });
  return checks[lastIdx + 1];
}

/** 수정 ETO = 계획 ETO + 현재 시간 편차 */
export const revisedEto = (w: OfpWaypoint, timeDevMin: number) => new Date(Date.parse(w.eto) + timeDevMin * 60000).toISOString();

/**
 * 연료 입력 해석. "288000" 그대로, 또는 100단위 축약 "2880" (100LBS OFP 습관) → 288000.
 * 계획값 대비 1/20 미만이면 100단위로 본다. 해석 결과는 화면에 미리 보여줌.
 */
export function parseFuelInput(raw: string, planned: number, unit: 'kg' | 'lbs'): { value: number; scaled: boolean } | null {
  const n = Number(raw.replace(/[,\s]/g, ''));
  if (!raw.trim() || !Number.isFinite(n) || n < 0) return null;
  if (unit === 'lbs' && planned > 2000 && n > 0 && n < planned / 20) return { value: Math.round(n * 100), scaled: true };
  return { value: Math.round(n), scaled: false };
}

/** "0533" (UTC HHMM) → 계획 ETO와 가장 가까운 날짜의 ISO. 형식 오류면 null */
export function parseAta(hhmm: string, eto: string): string | null {
  const m = /^(\d{2}):?(\d{2})$/.exec(hhmm.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const ref = new Date(eto);
  const base = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), Number(m[1]), Number(m[2]));
  const cands = [base - 86400000, base, base + 86400000];
  const best = cands.reduce((a, b) => (Math.abs(b - ref.getTime()) < Math.abs(a - ref.getTime()) ? b : a));
  return new Date(best).toISOString();
}

export const nowHHMM = (d = new Date()) => `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
