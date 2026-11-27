// 예보 vs OFP 차이 표시 (2026-11-27, 기준 = 사용자 지정 방향 30° · 속도 30kt · 기온 5°C)
import { describe, expect, it } from 'vitest';
import { windDiff } from './WeatherPage';

describe('바람·기온 차이 표시', () => {
  it('기준 넘는 것만, 방향은 360 넘김 고려', () => {
    expect(windDiff({ dir: 250, spd: 120, temp: -51 }, { windDir: 244, windSpd: 100, oat: -52 }).marks).toEqual([]);
    expect(windDiff({ dir: 10, spd: 150, temp: -45 }, { windDir: 330, windSpd: 110, oat: -52 }).marks).toEqual(['방향 40°', '속도 +40kt', '기온 +7°']);
    expect(windDiff({ dir: 350, spd: 50, temp: null }, { windDir: 20, windSpd: 60, oat: null }).marks).toEqual(['방향 30°']);
  });
});
