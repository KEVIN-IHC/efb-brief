import { describe, expect, it } from 'vitest';
import { radarFrameAt, radarTileUrl } from './radar';

describe('레이더 영상 고르기 (D-099)', () => {
  const fr = [0, 10, 20].map((m) => ({ t: Date.UTC(2026, 0, 1, 10, m), path: `/v2/radar/${m}` }));
  it('선택 시각 이전 가장 가까운 영상, 앞이면 가장 이른 것, 미래면 최근', () => {
    expect(radarFrameAt(fr, Date.UTC(2026, 0, 1, 10, 15))?.path).toBe('/v2/radar/10');
    expect(radarFrameAt(fr, Date.UTC(2026, 0, 1, 9, 0))?.path).toBe('/v2/radar/0');
    expect(radarFrameAt(fr, Date.UTC(2026, 0, 1, 12, 0))?.path).toBe('/v2/radar/20');
    expect(radarFrameAt([], 0)).toBeNull();
    expect(radarTileUrl('https://h', fr[0])).toBe('https://h/v2/radar/0/256/{z}/{x}/{y}/2/1_1.png');
  });
});
