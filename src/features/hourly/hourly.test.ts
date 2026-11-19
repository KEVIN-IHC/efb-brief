import { describe, expect, it } from 'vitest';
import { dec1, normEntry, altCheck, fuel100, fuelTotal, lineText, nextDue, oilDelta, recIso, type HourlyRec } from './hourly';

describe('매시간 점검', () => {
  it('손글씨 한 줄 그대로', () => {
    const e = { time: '1700', altC: '31000', altS: '30990', altF: '31020', oil1: '17.4', oil2: '17.4', oil3: '17.4', oil4: '17.4', dp: '8.6', cab: '5800', fu: '455', fob: '2445', oxyC: '1767', oxyCab: '1828' };
    expect(lineText(e)).toBe('1700Z  31000/30990/31020  17.4/17.4/17.4/17.4  8.6/5800  455+2445=2900  1767/1828');
  });

  it('연료 100 단위 · 큰 수는 원래 단위로 보고 나눔', () => {
    expect(fuel100('2445')).toBe(2445);
    expect(fuel100('244,500')).toBe(2445);
    expect(fuelTotal({ fu: '455', fob: '2445' })).toBe(2900);
    expect(fuelTotal({ fu: '455' })).toBeUndefined();
  });

  it('고도계: FL300 이상은 PFD 150 · ISIS 320, 아래는 PFD 200, 200 초과 = Loss of Redundancy', () => {
    const a = altCheck({ altC: '31000', altS: '30990', altF: '31020' });
    expect(a.pfd).toMatchObject({ d: 20, ok: true, lim: 150, lor: false });
    expect(a.isis).toMatchObject({ d: -10, ok: true, lim: 320 });
    expect(altCheck({ altC: '31000', altF: '31180' }).pfd).toMatchObject({ ok: false, lor: false });
    expect(altCheck({ altC: '31000', altF: '31250' }).pfd).toMatchObject({ ok: false, lor: true });
    const low = altCheck({ altC: '25000', altS: '25400', altF: '25180' });
    expect(low.pfd).toMatchObject({ lim: 200, ok: true });
    expect(low.isis).toMatchObject({ lim: undefined, ok: true });
  });

  it('오일 변화', () => {
    expect(oilDelta({ oil1: '17.1', oil2: '17.4' }, { oil1: '17.4', oil2: '17.4', oil3: '17' })).toEqual([-0.3, 0, undefined, undefined]);
  });

  it('기록 시각·다음 점검 (자정 넘김)', () => {
    const r: HourlyRec = { id: '1', time: '2350', savedAt: '2026-11-20T00:05:00Z' };
    expect(recIso(r)).toBe('2026-11-19T23:50:00.000Z');
    const d = nextDue([r], Date.parse('2026-11-20T00:30:00Z'))!;
    expect(d.at).toBe('2026-11-20T00:50:00.000Z');
    expect(d.inMin).toBe(20);
    expect(nextDue([], 0)).toBeUndefined();
  });

  it('점 없이 쓰면 소수 첫째 자리 (오일 174 → 17.4, ΔP 86 → 8.6)', () => {
    expect(dec1('174')).toBe('17.4');
    expect(dec1('86')).toBe('8.6');
    expect(dec1('17.4')).toBe('17.4');
    expect(normEntry({ oil1: '174', dp: '86', cab: '5800' })).toMatchObject({ oil1: '17.4', dp: '8.6', cab: '5800' });
    expect(lineText({ time: '1700', oil1: '174', oil2: '171', oil3: '17.4', oil4: '174', dp: '86', cab: '5800' })).toBe('1700Z  17.4/17.1/17.4/17.4  8.6/5800');
  });
});
