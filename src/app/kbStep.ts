// 앱 키보드 ± 키 (D-089): 숫자판 오른쪽 세로 열 +10 · +1 · −1 · −10 (시안 C, = PLAN 없음)
// 기준값 = 칸에 쓴 값 → 없으면 계획 값(OFP·앞 기록) → 없으면 0. ±를 누른 뒤 숫자를 치면 새로 씀
import { parseHm, parseKilo, parseNum, parseOil } from '../features/checks/checks';

export type Step = (
  /** 보통 숫자. dp = 소수 자리(1이면 점 없이 쓴 174 → 17.4), unit = "1" 한 번의 크기 */
  | { kind: 'num'; dp?: 0 | 1; unit?: number; plan?: number }
  /** 시각·시간: 1분 단위, HHMM으로 씀. clock = 24시간 넘으면 돌림 */
  | { kind: 'hm'; clock?: boolean; plan?: number }
  /** 연료 천 단위(107.4 = 107,400). plan은 원래 단위(kg·lbs). "1" 한 번 = 0.1(=100) */
  | { kind: 'kilo'; plan?: number }
) & {
  /** 계획 값 이름 (기본 PLAN, 매시간 점검은 앞 기록) */
  planLabel?: string;
};

export type StepBase = { n: number; src: 'value' | 'plan' | 'zero' };

/** 칸 값 → 숫자 (Step 단위). 못 읽으면 undefined */
function parseBuf(step: Step, buf: string): number | undefined {
  const t = buf.trim();
  if (!t) return undefined;
  if (step.kind === 'hm') return parseHm(t);
  if (step.kind === 'kilo') {
    const v = parseKilo(t);
    return v === undefined ? undefined : v / 1000;
  }
  return step.dp === 1 ? parseOil(t) : parseNum(t);
}

export function stepBase(step: Step, buf: string): StepBase {
  const v = parseBuf(step, buf);
  if (v !== undefined) return { n: v, src: 'value' };
  if (step.plan !== undefined && Number.isFinite(step.plan)) return { n: step.kind === 'kilo' ? step.plan / 1000 : step.plan, src: 'plan' };
  return { n: 0, src: 'zero' };
}

/** "1" 한 번의 크기 */
export const stepUnit = (step: Step) => (step.kind === 'kilo' ? 0.1 : step.kind === 'hm' ? 1 : (step.unit ?? (step.dp === 1 ? 0.1 : 1)));
const dpOf = (step: Step) => (step.kind === 'kilo' ? 1 : step.kind === 'hm' ? 0 : (step.dp ?? 0));

/** 기준값을 칸 글자로 */
export function stepFmt(step: Step, n: number): string {
  if (step.kind === 'hm') {
    let m = Math.round(n);
    if (step.clock) m = ((m % 1440) + 1440) % 1440;
    else m = Math.max(0, m);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`;
  }
  return n.toFixed(dpOf(step));
}

/** ± 한 번: k = +10 · +1 · −1 · −10 */
export function stepValue(step: Step, buf: string, k: number): string {
  const b = stepBase(step, buf);
  const u = stepUnit(step);
  const next = Math.round((b.n + k * u) * 1000) / 1000;
  return stepFmt(step, next);
}

/** 키 글자: +10 / +1 / −1 / −10 (소수 칸은 +1 / +0.1) */
export function stepLabel(step: Step, k: number): string {
  const v = Math.abs(k * stepUnit(step));
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return `${k > 0 ? '+' : '−'}${s}`;
}
