// 한계 대비 여유 판정 (SPEC §10.3 "여유가 적은 항목 하이라이트")
// ⚠ 임시 기준값 — 회사 매뉴얼 근거로 확정 필요 (SPEC §17-5). 나중에 Settings로 이동
import type { LimitPair, MassUnit, OfpData, OfpEtp } from './types';

export type Level = 'ok' | 'caution' | 'warning';

/** 기준값은 kg로 정의, lbs OFP면 환산 */
export const THRESHOLDS = {
  weightCautionKg: 2000, // 한계까지 2t 미만이면 주의
  fuelCautionKg: 1000, // Block - 최소요구량 1t 미만이면 주의
  etpCautionKg: 1500, // ETP 임계연료 대비 여유 1.5t 미만이면 주의
};

const KG_TO_LBS = 2.20462;
const inUnit = (kg: number, unit: MassUnit) => (unit === 'lbs' ? kg * KG_TO_LBS : kg);

export interface Margin {
  margin: number;
  level: Level;
}

function judge(margin: number, caution: number): Level {
  if (margin < 0) return 'warning';
  if (margin < caution) return 'caution';
  return 'ok';
}

export function limitMargin(p: LimitPair, unit: MassUnit = 'kg'): Margin {
  const margin = p.limit - p.planned;
  return { margin, level: judge(margin, inUnit(THRESHOLDS.weightCautionKg, unit)) };
}

export function fuelMargin(fuel: OfpData['fuel'], unit: MassUnit = 'kg'): Margin {
  const margin = fuel.block - fuel.minRequired;
  return { margin, level: judge(margin, inUnit(THRESHOLDS.fuelCautionKg, unit)) };
}

/** OFP에 임계 연료가 명시된 경우만 판정. 없으면 null (추측 금지) */
export function etpMargin(etp: OfpEtp, unit: MassUnit = 'kg'): Margin | null {
  if (etp.criticalFuel == null) return null;
  const margin = etp.fuelOnBoard - etp.criticalFuel;
  return { margin, level: judge(margin, inUnit(THRESHOLDS.etpCautionKg, unit)) };
}

export function worstLevel(levels: Level[]): Level {
  if (levels.includes('warning')) return 'warning';
  if (levels.includes('caution')) return 'caution';
  return 'ok';
}
