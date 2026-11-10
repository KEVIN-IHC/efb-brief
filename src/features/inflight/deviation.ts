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

/**
 * 연료 기준 (D-048, D-025 대체). 착륙 예상 단계의 근거 위치: FOM 8.2.1 · 8.2.1.1 · 8.2.1.2 (내용 요약은 비공개 메모).
 * 편차 %는 회사 매뉴얼에 수치 근거가 없어 임시.
 */
export const FUEL_DEV_RULES = {
  /** 임시: 실제 연료가 계획보다 TRIP의 이 비율 이상 적으면 주의 */
  cautionPctOfTrip: 0.02,
  /** FINAL RES 대비 배수 (근거 FOM 8.2.1.1) */
  minFuelPrepOfFinal: 1.3,
  basis: '예상 착륙 < FINAL 경고(FOM 8.2.1.2) · < FINAL×130% 경고(FOM 8.2.1.1) · < ALTN+FINAL 주의(FOM 8.2.1) · 편차 TRIP −2% 주의는 임시 기준',
};

/** 착륙 예상 단계 (심한 순) */
export type LandingStage = 'belowFinal' | 'minFuelPrep' | 'belowAltnFinal' | 'devCaution' | 'ok';

export function landingStage(o: OfpData, landing: number | undefined, fuelDev?: number): LandingStage {
  const fin = o.fuel.finalReserve;
  if (landing !== undefined) {
    if (landing < fin) return 'belowFinal';
    if (landing < fin * FUEL_DEV_RULES.minFuelPrepOfFinal) return 'minFuelPrep';
    if (landing < o.fuel.alternate + fin) return 'belowAltnFinal';
  }
  if (fuelDev !== undefined && fuelDev < -o.fuel.trip * FUEL_DEV_RULES.cautionPctOfTrip) return 'devCaution';
  return 'ok';
}

export const STAGE_LEVEL: Record<LandingStage, 'ok' | 'caution' | 'warning'> = {
  belowFinal: 'warning',
  minFuelPrep: 'warning',
  belowAltnFinal: 'caution',
  devCaution: 'caution',
  ok: 'ok',
};

export const STAGE_LABEL: Record<LandingStage, string> = {
  belowFinal: 'BELOW FINAL RES',
  minFuelPrep: 'MIN FUEL PREP (FINAL×130%)',
  belowAltnFinal: 'BELOW ALTN+FINAL',
  devCaution: 'FUEL DEV',
  ok: 'FUEL OK',
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
  /** 무엇 때문에 그 level 인지 (D-048) */
  stage: LandingStage;
  /** FINAL RES × 130% (MINIMUM FUEL 선포 준비 기준) */
  minFuelPrep: number;
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
  const worst = [landingIfPlanBurn, landingIfTrend].filter((x): x is number => x !== undefined);
  const stage = landingStage(o, worst.length ? Math.min(...worst) : undefined, lastF?.fuelDev);
  const level = STAGE_LEVEL[stage];
  const minFuelPrep = o.fuel.finalReserve * FUEL_DEV_RULES.minFuelPrepOfFinal;
  return { last: lastC, lastFuel: lastF, timeDevMin, plannedLanding, minLanding, landingIfPlanBurn, landingIfTrend, trendPerHour, level, stage, minFuelPrep, eta };
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
