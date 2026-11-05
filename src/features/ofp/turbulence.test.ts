import { describe, expect, it } from 'vitest';
import { srLevel, turbulenceZones } from './turbulence';
import type { OfpWaypoint } from './types';

const wp = (name: string, sr: number | null, fl = 370): OfpWaypoint =>
  ({ seq: 0, name, sr, fl, lat: 0, lon: 0, airway: '', windDir: null, windSpd: null, oat: null, tas: null, gs: null, legDist: 0, cumDist: 0, legMin: 0, cumMin: 0, eto: '', fuelRem: 0 }) as OfpWaypoint;

describe('turbulence', () => {
  it('srLevel', () => {
    expect([null, 4, 5, 6, 7, 12].map((x) => srLevel(x))).toEqual(['none', 'none', 'caution', 'caution', 'warning', 'warning']);
  });
  it('연속 구간 묶기 + 1지점 공백은 이어 붙임', () => {
    const r = [wp('A', 2), wp('B', 5), wp('C', 8, 390), wp('D', 3), wp('E', 6), wp('F', 1), wp('G', 1), wp('H', 5)];
    const z = turbulenceZones(r);
    expect(z.map((x) => [x.from.name, x.to.name, x.maxSr, x.level, x.fls])).toEqual([
      ['A', 'E', 8, 'warning', 'FL370–390'],
      ['G', 'H', 5, 'caution', 'FL370'],
    ]);
  });
  it('SR 없는 구간(CLB/DSC)은 끊음', () => {
    expect(turbulenceZones([wp('A', 6), wp('B', null), wp('C', 6)])).toHaveLength(2);
  });
});
