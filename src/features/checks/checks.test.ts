import { describe, expect, it } from 'vitest';
import { altChecks, minOil, DEFAULT_CHECKLIST, diff, fmtCoord, ofpRefs, parseFl, parseHm, parseKilo, parseNum, parseOil, parseQnh, progress } from './checks';
import type { OfpData } from '../ofp/types';

describe('FMS 입력·RVSM (D-079)', () => {
  it('숫자·시간 칸 읽기', () => {
    expect(parseNum('512,300')).toBe(512300);
    expect(parseNum(' 6 120 ')).toBe(6120);
    expect(parseNum('abc')).toBeUndefined();
    expect(parseHm('10:15')).toBe(615);
    expect(parseHm('1015')).toBe(615);
    expect(parseHm('615')).toBe(375);
    expect(parseHm('10:75')).toBeUndefined();
    expect(diff(100, undefined)).toBeUndefined();
    expect(diff(120, 100)).toBe(20);
  });
  it('연료 칸: 천 단위·소수점·전체 자리', () => {
    expect(parseKilo('290')).toBe(290000);
    expect(parseKilo('290.2')).toBe(290200);
    expect(parseKilo('290200')).toBe(290200);
    expect(parseKilo('290,700')).toBe(290700);
    expect(parseKilo('38')).toBe(38000);
    expect(parseKilo('38.1')).toBe(38100);
    expect(parseKilo('38100')).toBe(38100);
    expect(parseKilo('')).toBeUndefined();
  });
  it('FL·좌표·오일', () => {
    expect(parseFl('380')).toBe(380);
    expect(parseFl('FL370')).toBe(370);
    expect(parseFl('37000')).toBe(370);
    expect(fmtCoord('37271', 2)).toBe("37°27.1'");
    expect(fmtCoord('3727', 2)).toBe("37°27'");
    expect(fmtCoord('126270', 3)).toBe("126°27.0'");
    expect(fmtCoord('3799', 2)).toBeUndefined();
    expect(parseOil('185')).toBe(18.5);
    expect(parseOil('18.5')).toBe(18.5);
  });
  it('OFP 기준값: TRIP 시간 · RAMP OUT · FOD · 마지막 누적 거리', () => {
    const o = {
      header: { airMin: 600, cruiseFl: 380 },
      fuel: { block: 500000, rows: [{ label: 'TRIP', fuel: 400000, timeMin: 610 }, { label: 'FOD', fuel: 38100 }] },
      route: [{ cumDist: 0 }, { cumDist: 5432 }],
    } as unknown as OfpData;
    expect(ofpRefs(o)).toEqual({ tripMin: 610, flightMin: 600, fob: 500000, fod: 38100, dist: 5432, maxFl: 380 });
    expect(ofpRefs({ ...o, fuel: { ...o.fuel, rows: [] } } as OfpData).tripMin).toBe(600);
  });
  it('QNH: FCOM 범위로 단위 판별', () => {
    expect(parseQnh('1013')).toEqual({ unit: 'hPa', hpa: 1013, inhg: 29.91, high: false });
    expect(parseQnh('998')?.unit).toBe('hPa');
    expect(parseQnh('2992')).toEqual({ unit: 'inHg', hpa: 1013, inhg: 29.92, high: false });
    expect(parseQnh('29.92')?.unit).toBe('inHg');
    expect(parseQnh('1055')?.high).toBe(true);
    expect(parseQnh('3110')?.high).toBe(true);
    expect(parseQnh('500')).toBeNull();
    expect(parseQnh('1500')).toBeNull();
    expect(parseQnh('3300')).toBeNull();
    expect(parseQnh('')).toBeUndefined();
  });
  it('고도계: CAPT PFD vs ELEV 75 · F/O PFD vs CAPT 20 · STBY ISIS vs CAPT 30 ft', () => {
    expect(altChecks({ elev: '21', altC: '30', altF: '40', altS: '70' })).toEqual({
      capt: { d: 9, ok: true, tol: 75 },
      fo: { d: 10, ok: true, tol: 20 },
      stby: { d: 40, ok: false, tol: 30 },
    });
    expect(altChecks({ elev: '21', altC: '120' }).capt?.ok).toBe(false);
    expect(altChecks({ altF: '40' }).fo).toBeUndefined();
  });
  it('엔진 오일 최소량 (FCOM LIM-ENG, RAMP OUT 시간)', () => {
    expect(minOil(664)).toEqual({ cold: 13, warm: 11.6, max: 13 }); // 11:04
    expect(minOil(7 * 60)).toEqual({ cold: 13, warm: 10, max: 13 });
    expect(minOil(9 * 60)).toEqual({ cold: 13, warm: 10.5, max: 13 });
    expect(minOil(15 * 60)).toEqual({ cold: 13.5, warm: 13.5, max: 13.5 });
    expect(minOil(undefined)).toBeUndefined();
  });
  it('체크 진행', () => {
    const p = progress(DEFAULT_CHECKLIST, { fms0: 'x', balt1: 'y' });
    expect(p.done).toBe(2);
    expect(p.total).toBe(19);
  });
});
