import { describe, expect, it } from 'vitest';
import { formatLatLon, gcDistanceNm, gcInterpolate } from '../../lib/geo';
import { buildDemoOfp } from '../../mock/demoOfp';
import { etpMargin, fuelMargin, limitMargin } from './margins';

describe('geo', () => {
  const RKSI = { lat: 37.4692, lon: 126.4505 };
  const KLAX = { lat: 33.9425, lon: -118.4081 };
  it('RKSI-KLAX 대권거리 ≈ 5,200NM', () => {
    const d = gcDistanceNm(RKSI, KLAX);
    expect(d).toBeGreaterThan(5100);
    expect(d).toBeLessThan(5300);
  });
  it('보간 중간점은 북태평양(위도 50도 이상)', () => {
    const mid = gcInterpolate(RKSI, KLAX, 0.5);
    expect(mid.lat).toBeGreaterThan(50);
  });
  it('formatLatLon', () => {
    expect(formatLatLon(37.5, 126.45)).toBe('N3730.0 E12627.0');
    expect(formatLatLon(-33.5, -118.25)).toBe('S3330.0 W11815.0');
  });
});

describe('demo OFP', () => {
  const o = buildDemoOfp();
  it('연료 합계와 최소 요구량', () => {
    const f = o.fuel;
    expect(f.block).toBe(f.taxi + f.trip + f.contingency + f.alternate + f.finalReserve + f.extra);
    expect(f.minRequired).toBe(f.block - f.extra);
  });
  it('루트: 14개 지점, 시간·거리 증가, 잔여연료 감소', () => {
    const r = o.route;
    expect(r).toHaveLength(14);
    expect(r[0].name).toBe('RKSI');
    expect(r.at(-1)!.name).toBe('KLAX');
    for (let i = 1; i < r.length; i++) {
      expect(r[i].cumMin).toBeGreaterThan(r[i - 1].cumMin);
      expect(r[i].cumDist).toBeGreaterThan(r[i - 1].cumDist);
      expect(r[i].fuelRem).toBeLessThan(r[i - 1].fuelRem);
    }
    expect(r.at(-1)!.cumMin).toBe(o.header.airMin);
    expect(r[0].fuelRem - r.at(-1)!.fuelRem).toBe(o.fuel.trip);
    // 마지막 ETO = 이륙 + 비행시간
    expect(Date.parse(r.at(-1)!.eto) - Date.parse(o.header.takeoff)).toBe(o.header.airMin * 60000);
  });
  it('중량은 한계 이내', () => {
    for (const k of ['zfw', 'tow', 'lw'] as const) expect(limitMargin(o.weights[k]).level).not.toBe('warning');
  });
  it('ETP 2개, 시간 순서', () => {
    expect(o.etps).toHaveLength(2);
    expect(Date.parse(o.etps[1].eto)).toBeGreaterThan(Date.parse(o.etps[0].eto));
  });
});

describe('margins', () => {
  it('한계 판정', () => {
    expect(limitMargin({ planned: 100, limit: 5000 }).level).toBe('ok');
    expect(limitMargin({ planned: 4000, limit: 5000 }).level).toBe('caution');
    expect(limitMargin({ planned: 5100, limit: 5000 })).toEqual({ margin: -100, level: 'warning' });
  });
  it('연료 여유', () => {
    const base = { taxi: 0, trip: 0, contingency: 0, alternate: 0, finalReserve: 0, extra: 0 };
    expect(fuelMargin({ ...base, block: 10000, minRequired: 9500 }).level).toBe('caution');
    expect(fuelMargin({ ...base, block: 10000, minRequired: 10500 }).level).toBe('warning');
  });
  it('ETP 여유', () => {
    const e = { name: 'E', airports: ['A', 'B'] as [string, string], lat: 0, lon: 0, eto: '' };
    expect(etpMargin({ ...e, fuelOnBoard: 50000, criticalFuel: 40000 })!.level).toBe('ok');
    expect(etpMargin({ ...e, fuelOnBoard: 41000, criticalFuel: 40000 })!.level).toBe('caution');
  });
});

describe('etpMargin 명시값 없을 때', () => {
  it('criticalFuel 없으면 판정하지 않음 (null)', () => {
    expect(etpMargin({ name: 'E', airports: ['A', 'B'], lat: 0, lon: 0, eto: '', fuelOnBoard: 1 })).toBeNull();
  });
});
