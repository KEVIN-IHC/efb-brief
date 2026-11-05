import { describe, expect, it } from 'vitest';
import { buildDemoOfp } from '../../mock/demoOfp';
import { buildChecks, nextWaypoint, parseAta, parseFuelInput, project, revisedEto, type Actual } from './deviation';

const o = buildDemoOfp(); // kg, 14개 지점, 착륙 12,600
const act = (seq: number, devMin: number, fuelDev: number | null): Actual => {
  const w = o.route[seq];
  return { seq, ata: new Date(Date.parse(w.eto) + devMin * 60000).toISOString(), fuel: fuelDev == null ? null : w.fuelRem + fuelDev, logId: `L${seq}`, createdAt: '' };
};

describe('편차·예상', () => {
  it('기록 없으면 계획 그대로', () => {
    const p = project(o, buildChecks(o, new Map()));
    expect(p.level).toBe('ok');
    expect(p.landingIfPlanBurn).toBeUndefined();
    expect(p.eta).toBe(o.route[o.route.length - 1].eto);
  });

  it('시간·연료 편차와 계획 소모 유지 시 착륙 연료', () => {
    const checks = buildChecks(o, new Map([[3, act(3, 4, -800)]]));
    expect(checks[3]).toMatchObject({ timeDevMin: 4, fuelDev: -800 });
    const p = project(o, checks);
    expect(p.landingIfPlanBurn).toBe(12600 - 800);
    expect(p.timeDevMin).toBe(4);
    expect(Date.parse(p.eta) - Date.parse(o.route[13].eto)).toBe(4 * 60000);
    expect(p.landingIfTrend).toBeUndefined(); // 기록 1개 → 추세 없음
  });

  it('추세: 편차가 점점 커지면 착륙 연료를 더 낮게 예상', () => {
    // 지점 2 → −200, 지점 6 → −1,200 (약 3시간 간격)
    const checks = buildChecks(o, new Map([[2, act(2, 0, -200)], [6, act(6, 0, -1200)]]));
    const p = project(o, checks);
    expect(p.trendPerHour!).toBeLessThan(0);
    expect(p.landingIfTrend!).toBeLessThan(p.landingIfPlanBurn!);
  });

  it('예상 착륙 연료 < ALTN + FINAL 이면 경고', () => {
    const min = o.fuel.alternate + o.fuel.finalReserve; // 7,800
    const p = project(o, buildChecks(o, new Map([[8, act(8, 0, -(12600 - min) - 100)]])));
    expect(p.level).toBe('warning');
  });

  it('다음 지점·수정 ETO', () => {
    const checks = buildChecks(o, new Map([[1, act(1, 0, 0)], [2, act(2, 6, 0)]]));
    expect(nextWaypoint(checks)!.w.seq).toBe(3);
    expect(Date.parse(revisedEto(o.route[3], 6)) - Date.parse(o.route[3].eto)).toBe(360000);
  });
});

describe('입력 해석', () => {
  it('연료: 100 LBS 축약 입력', () => {
    expect(parseFuelInput('2880', 288000, 'lbs')).toEqual({ value: 288000, scaled: true });
    expect(parseFuelInput('288,000', 288000, 'lbs')).toEqual({ value: 288000, scaled: false });
    expect(parseFuelInput('77800', 77800, 'kg')).toEqual({ value: 77800, scaled: false });
    expect(parseFuelInput('', 1, 'kg')).toBeNull();
    expect(parseFuelInput('abc', 1, 'kg')).toBeNull();
  });
  it('ATA: ETO와 가장 가까운 날짜 (자정 넘김)', () => {
    expect(parseAta('2350', '2026-11-06T00:10:00Z')).toBe('2026-11-05T23:50:00.000Z');
    expect(parseAta('0005', '2026-11-05T23:55:00Z')).toBe('2026-11-06T00:05:00.000Z');
    expect(parseAta('12:34', '2026-11-05T12:00:00Z')).toBe('2026-11-05T12:34:00.000Z');
    expect(parseAta('2460', '2026-11-05T12:00:00Z')).toBeNull();
  });
});
