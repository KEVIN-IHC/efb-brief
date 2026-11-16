import { describe, expect, it } from 'vitest';
import { windsWindow } from '../weather/api';
import type { WindPoint, WindsData } from '../weather/types';
import { flOfHpa } from './profile';
import { edrFromRaw, nearestIndex, pointAt, relLabel, shearLayers, tempGradient } from './wxTime';

const H = 3_600_000;
const T0 = Date.parse('2026-11-16T00:00:00Z');

describe('기상 시간 범위 (D-063)', () => {
  it('지난 비행 = 지금 −6h ~ +12h', () => {
    expect(windsWindow('now', 0, 0, T0)).toEqual({ start: T0 - 6 * H, end: T0 + 12 * H });
  });
  it('곧 출발할 비행 = 지금 −3h ~ 도착 +3h', () => {
    expect(windsWindow('eto', T0 + 2 * H, T0 + 14 * H, T0)).toEqual({ start: T0 - 3 * H, end: T0 + 17 * H });
  });
  it('이틀 뒤 비행은 첫 ETO −3h부터 (지금부터 받지 않음)', () => {
    const w = windsWindow('eto', T0 + 50 * H, T0 + 60 * H, T0);
    expect(w.start).toBe(T0 + 47 * H);
  });
  it('최대 48시간', () => {
    const w = windsWindow('eto', T0 + 20 * H, T0 + 60 * H, T0);
    expect(w.end - w.start).toBe(48 * H);
  });
});

describe('시각 고르기', () => {
  const times = [0, 1, 2, 3, 4, 5].map((h) => new Date(T0 + h * H).toISOString());
  const lv = (temp: number) => [{ hpa: 250, dir: 270, spd: 100, temp }];
  const p: WindPoint = { seq: 1, name: 'A', lat: 0, lon: 0, fl: 350, time: times[2], dir: null, spd: null, temp: null, levels: lv(-99), series: [0, 1, 2, 3, 4, 5].map((h) => ({ levels: lv(-50 - h), freezingFt: null })) };
  const data: WindsData = { model: 'x', basis: 'eto', points: [p], times };

  it('가장 가까운 정시', () => {
    expect(nearestIndex(times, T0 + 2.4 * H)).toBe(2);
    expect(nearestIndex(times, T0 - 10 * H)).toBe(0);
  });
  it('ETO 모드 = 지점 통과 시각, 고정 모드 = 그 시각', () => {
    expect(pointAt(p, data, 'eto', null, T0 + 4 * H)!.levels[0].temp).toBe(-54);
    expect(pointAt(p, data, 'fixed', T0 + 1 * H, T0 + 4 * H)!.levels[0].temp).toBe(-51);
  });
  it('3시간 전 값 함께 (기온 변화)', () => {
    const a = pointAt(p, data, 'fixed', T0 + 5 * H, null)!;
    expect(a.prev![0].temp).toBe(-52);
  });
  it('예전 캐시(series 없음)는 한 시각 값', () => {
    const old = { ...p, series: undefined };
    expect(pointAt(old, { ...data, times: undefined }, 'fixed', T0, null)!.levels[0].temp).toBe(-99);
  });
  it('지금 기준 표시', () => {
    expect(relLabel(T0 + 3 * H, T0)).toBe('지금 +3h');
    expect(relLabel(T0 - 2 * H, T0)).toBe('지금 −2h');
    expect(relLabel(T0 + 10 * 60_000, T0)).toBe('지금');
  });
});

describe('난류 지수 (D-064, 앱 임시 기준)', () => {
  it('바람이 그대로고 안정하면 0', () => {
    const s = shearLayers(
      [
        { hpa: 300, dir: 270, spd: 80, temp: -45 },
        { hpa: 250, dir: 270, spd: 82, temp: -50 },
      ],
      flOfHpa,
    );
    expect(s).toHaveLength(1);
    expect(s[0].level).toBe(0);
    expect(s[0].ri!).toBeGreaterThan(1);
  });
  it('강한 시어 = 높은 단계', () => {
    const [s] = shearLayers(
      [
        { hpa: 300, dir: 270, spd: 60, temp: -45 },
        { hpa: 250, dir: 270, spd: 110, temp: -51 },
      ],
      flOfHpa,
    );
    // FL300 → FL340 (약 4,000 ft), 50 kt 차 ≈ 12 kt/1000ft
    expect(s.vws).toBeGreaterThan(9);
    expect(s.level).toBe(3);
  });
  it('값 빠진 면은 건너뜀', () => {
    expect(shearLayers([{ hpa: 300, dir: null, spd: null, temp: null }, { hpa: 250, dir: 270, spd: 80, temp: -50 }], flOfHpa)).toHaveLength(0);
  });
  it('기온 경도 °C/100NM', () => {
    expect(tempGradient(-50, -46, 200)).toBe(2);
    expect(tempGradient(null, -46, 200)).toBeNull();
  });
  it('원문 EDR', () => {
    expect(edrFromRaw('ARP UAL123 4000N 15000W 0130 F350 MS52 TB EDR 0.24')).toBe(0.24);
    expect(edrFromRaw('UA /OV ABC /TB MOD')).toBeNull();
  });
});

describe('Map 시간 목록 (D-065)', async () => {
  const { mergeTimes } = await import('./TimeBar');
  const { satPastTimes } = await import('../map/satellite');
  it('지난 위성 시각: 30분 간격 3시간, 가장 최근은 30분 이상 전', () => {
    const now = Date.parse('2026-11-16T12:10:00Z');
    const t = satPastTimes(now);
    expect(t).toHaveLength(6);
    expect(t.at(-1)).toBe('2026-11-16T11:30:00Z');
    expect(t[0]).toBe('2026-11-16T09:00:00Z');
  });
  it('합치기: 정렬·10분 안 겹침 제거', () => {
    expect(mergeTimes([T0 + 2 * H, T0], [T0 + 5 * 60_000, T0 + H])).toEqual([T0, T0 + H, T0 + 2 * H]);
  });
});
