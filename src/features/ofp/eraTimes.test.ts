import { describe, expect, it } from 'vitest';
import { depShift, eraTimes, hhmmzToMs } from './eraTimes';
import type { OfpData } from './types';

const base = (extra: Partial<OfpData>) =>
  ({
    header: { std: '2026-01-10T02:00:00Z', takeoff: '2026-01-10T02:00:00Z', sta: '2026-01-10T12:00:00Z' },
    etps: [
      { name: 'ETP1', airports: ['AAAA', 'BBBB'], eto: '2026-01-10T06:00:00Z', timeToAltMin: 180 },
      { name: 'ETP2', airports: ['BBBB', 'CCCC'], eto: '2026-01-10T09:00:00Z', timeToAltMin: 150 },
    ],
    ...extra,
  }) as unknown as OfpData;
const z = (ms: number) => new Date(ms).toISOString().slice(11, 16);

describe('ERA 예상 사용 시간 (FOM ETP Data, D-094)', () => {
  it('ETP 계산: 첫 공항 ETP1, 가운데 ETP1~ETP2, 마지막 ETP2 (+회항 시간, 운항 ±1h)', () => {
    const r = eraTimes(base({}));
    expect(r.map((x) => [x.icao, z(x.earliest), z(x.latest), z(x.opsFrom), z(x.opsTo)])).toEqual([
      ['AAAA', '09:00', '09:00', '08:00', '10:00'],
      ['BBBB', '09:00', '11:30', '08:00', '12:30'],
      ['CCCC', '11:30', '11:30', '10:30', '12:30'],
    ]);
  });
  it('담당 구간: 첫 공항 이륙→ETP1, 가운데 ETP1→ETP2, 마지막 ETP2→도착', () => {
    const r = eraTimes(base({}));
    expect(r.map((x) => [x.icao, x.seg?.from, z(x.seg!.fromT), x.seg?.to, z(x.seg!.toT)])).toEqual([
      ['AAAA', '이륙', '02:00', 'ETP1', '06:00'],
      ['BBBB', 'ETP1', '06:00', 'ETP2', '09:00'],
      ['CCCC', 'ETP2', '09:00', '도착', '12:00'],
    ]);
  });
  it('실제 출발 시각만큼 옮김 (자정 넘김 포함)', () => {
    const o = base({});
    expect(depShift(o, '0230') / 60000).toBe(30);
    expect(depShift(o, '0140') / 60000).toBe(-20);
    expect(depShift(o, '')).toBe(0);
    expect(z(eraTimes(o, depShift(o, '0230'))[0].earliest)).toBe('09:30');
  });
  it('OFP EDTO 시간창이 있으면 그 값 (HHMMZ, 날짜 넘김)', () => {
    const o = base({ header: { std: '2026-10-23T22:10:00Z', takeoff: '2026-10-23T22:10:00Z' } as OfpData['header'], edto: { windows: [{ icao: 'DDDD', from: '2355Z', to: '0512Z' }] } });
    const r = eraTimes(o)[0];
    expect(new Date(r.earliest).toISOString()).toBe('2026-10-23T23:55:00.000Z');
    expect(new Date(r.latest).toISOString()).toBe('2026-10-24T05:12:00.000Z');
    expect(r.src).toBe('OFP EDTO');
    expect(hhmmzToMs('1159Z', Date.parse('2026-10-23T10:10:00Z'))).toBe(Date.parse('2026-10-23T11:59:00Z'));
  });
});
