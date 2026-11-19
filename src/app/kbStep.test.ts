import { describe, expect, it } from 'vitest';
import { stepBase, stepLabel, stepValue } from './kbStep';

describe('앱 키보드 ± 키 (D-089)', () => {
  it('기준: 칸 값 → 계획 값 → 0', () => {
    expect(stepValue({ kind: 'num', plan: 350 }, '', 10)).toBe('360');
    expect(stepValue({ kind: 'num', plan: 350 }, '370', -1)).toBe('369');
    expect(stepValue({ kind: 'num' }, '', 1)).toBe('1');
    expect(stepValue({ kind: 'num' }, '', -10)).toBe('-10');
    expect(stepBase({ kind: 'num', plan: 350 }, '').src).toBe('plan');
  });
  it('소수 칸: 점 없이 쓴 174 = 17.4, 한 번 0.1', () => {
    expect(stepValue({ kind: 'num', dp: 1 }, '174', 1)).toBe('17.5');
    expect(stepValue({ kind: 'num', dp: 1, plan: 17.4 }, '', -10)).toBe('16.4');
    expect(stepLabel({ kind: 'num', dp: 1 }, 1)).toBe('+0.1');
    expect(stepLabel({ kind: 'num', dp: 1 }, -10)).toBe('−1');
    expect(stepLabel({ kind: 'num' }, 10)).toBe('+10');
  });
  it('연료 천 단위: 계획 107,400 → 107.5 · 106.4', () => {
    expect(stepValue({ kind: 'kilo', plan: 107400 }, '', 1)).toBe('107.5');
    expect(stepValue({ kind: 'kilo', plan: 107400 }, '', -10)).toBe('106.4');
    expect(stepValue({ kind: 'num', unit: 100, plan: 52300 }, '', 10)).toBe('53300');
  });
  it('시각: HHMM, 자정 넘으면 돌림 · 시간은 0 아래로 안 감', () => {
    expect(stepValue({ kind: 'hm', clock: true, plan: 3 * 60 + 55 }, '', 10)).toBe('0405');
    expect(stepValue({ kind: 'hm', clock: true }, '2355', 10)).toBe('0005');
    expect(stepValue({ kind: 'hm', plan: 615 }, '', -1)).toBe('1014');
  });
});
