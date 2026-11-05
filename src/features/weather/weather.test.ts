import { describe, expect, it } from 'vitest';
import { corridorTiles, tileInCoverage } from '../map/satellite';
import { ceilingFt, decodeIsigmet, decodeMetar, decodeTaf, flightCategory, interpolateAtFl, isaPressure, visibSm } from './decode';
import { freshness, isDue } from './freshness';
import { nearLon, pointInPoly, sigmetNearRoute, unwrapLons } from './route';
import { flightStations } from './store';

const NOW = Date.parse('2026-11-05T06:00:00Z');
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString();

describe('freshness (PROJECT_SPEC §5.6)', () => {
  it('METAR 60분 주황, 120분 빨강', () => {
    expect(freshness('metar', ago(59), NOW)).toBe('ok');
    expect(freshness('metar', ago(60), NOW)).toBe('warn');
    expect(freshness('metar', ago(120), NOW)).toBe('bad');
  });
  it('유효기간 끝나면 빨강', () => {
    expect(freshness('taf', ago(10), NOW, ago(1))).toBe('bad');
    expect(freshness('sigmet', ago(10), NOW, ago(-60))).toBe('ok');
  });
  it('데이터 없으면 빨강', () => expect(freshness('winds', null, NOW)).toBe('bad'));
  it('갱신 주기', () => {
    expect(isDue('metar', ago(9), NOW)).toBe(false);
    expect(isDue('metar', ago(10), NOW)).toBe(true);
    expect(isDue('taf', undefined, NOW)).toBe(true);
  });
});

describe('decode', () => {
  it('시정 표기', () => {
    expect(visibSm('10+')).toBe(10);
    expect(visibSm('1/2')).toBe(0.5);
    expect(visibSm('1 1/2')).toBe(1.5);
    expect(visibSm(3.73)).toBe(3.73);
    expect(visibSm(null)).toBeNull();
  });
  it('운고 = BKN/OVC 최저', () => {
    expect(ceilingFt([{ cover: 'FEW', base: 800 }, { cover: 'BKN', base: 2500 }, { cover: 'OVC', base: 4000 }])).toBe(2500);
    expect(ceilingFt([{ cover: 'SCT', base: 800 }])).toBeNull();
    expect(ceilingFt([], 200)).toBe(200);
  });
  it('비행 등급', () => {
    expect(flightCategory(5000, 10)).toBe('VFR');
    expect(flightCategory(3000, 10)).toBe('MVFR');
    expect(flightCategory(800, 10)).toBe('IFR');
    expect(flightCategory(null, 0.5)).toBe('LIFR');
    expect(flightCategory(null, null)).toBeNull();
  });
  it('METAR JSON', () => {
    const m = decodeMetar({ icaoId: 'RKSI', obsTime: 1793854800, rawOb: 'METAR RKSI 050500Z 28012KT CAVOK 17/10 Q1012 NOSIG', wdir: 280, wspd: 12, visib: '6+', temp: 17, dewp: 10, altim: 1012, clouds: [], cover: 'CAVOK', fltCat: 'VFR' });
    expect(m.obsTime).toBe('2026-11-05T05:00:00.000Z');
    expect(m.fltCat).toBe('VFR');
  });
  it('TAF 구간 등급 계산', () => {
    const t = decodeTaf({
      icaoId: 'RKSI',
      issueTime: '2026-11-05T05:00:00.000Z',
      validTimeFrom: 1793858400,
      validTimeTo: 1793966400,
      rawTAF: 'TAF RKSI …',
      fcsts: [{ timeFrom: 1793883600, timeTo: 1793890800, fcstChange: 'TEMPO', visib: 3.73, wxString: '-RA', clouds: [{ cover: 'FEW', base: 1000 }, { cover: 'BKN', base: 3000 }] }],
    });
    expect(t.validTo).toBe('2026-11-06T12:00:00.000Z'); // 0506/0612
    expect(t.periods[0].fltCat).toBe('MVFR');
    expect(t.periods[0].change).toBe('TEMPO');
  });
  it('SIGMET 다중 다각형', () => {
    const s = decodeIsigmet({ firId: 'NZZO', seriesId: '1', validTimeFrom: 1, validTimeTo: 2, hazard: 'TURB', coords: [[{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }, { lat: 1, lon: 1 }], [{ lat: 5, lon: 5 }]] });
    expect(s.polys).toHaveLength(1); // 점 3개 미만은 버림
  });
  it('FL ↔ 기압면 보간', () => {
    expect(isaPressure(30000)).toBeCloseTo(300.9, 0);
    expect(isaPressure(39000)).toBeCloseTo(196.8, 0);
    const lv = [
      { hpa: 300, dir: 270, spd: 100, temp: -40 },
      { hpa: 250, dir: 270, spd: 140, temp: -50 },
    ];
    expect(interpolateAtFl(300, lv)).toEqual({ dir: 270, spd: 100, temp: -40 });
    const mid = interpolateAtFl(320, lv);
    expect(mid.dir).toBe(270);
    expect(mid.spd!).toBeGreaterThan(100);
    expect(mid.spd!).toBeLessThan(140);
    expect(interpolateAtFl(450, lv).spd).toBe(140); // 범위 밖은 끝값
  });
});

describe('route geometry', () => {
  it('날짜변경선 경도 이어 붙이기', () => {
    const r = unwrapLons([{ lon: 170 }, { lon: 179 }, { lon: -178 }, { lon: -150 }]);
    expect(r.map((p) => p.lon)).toEqual([170, 179, 182, 210]);
    expect(nearLon(-118, 180)).toBe(242);
  });
  it('점-다각형', () => {
    const sq: [number, number][] = [[0, 0], [0, 10], [10, 10], [10, 0]];
    expect(pointInPoly(5, 5, sq)).toBe(true);
    expect(pointInPoly(15, 5, sq)).toBe(false);
  });
  it('루트 관련 SIGMET (날짜변경선 너머 포함)', () => {
    const route = [{ lat: 40, lon: 170 }, { lat: 42, lon: -170 }];
    const base = { id: 'x', source: 'intl' as const, fir: 'X', hazard: 'TURB', base: null, top: null, validFrom: '', validTo: '', raw: '' };
    expect(sigmetNearRoute({ ...base, polys: [[[39, 178], [43, 178], [43, -178], [39, -178]]] }, route)).toBe(true);
    expect(sigmetNearRoute({ ...base, polys: [[[0, 100], [1, 100], [1, 101]]] }, route)).toBe(false);
  });
});

describe('공항 목록·위성', () => {
  it('출발·도착·교체·EDTO 중복 합침', () => {
    const st = flightStations('RKSI', 'KLAX', { alternates: [{ icao: 'KONT' }, { icao: 'KLAX' }], edtoAirports: ['PACD', 'RJCC'] } as never);
    expect(st.map((s) => s.icao)).toEqual(['RKSI', 'KLAX', 'KONT', 'PACD', 'RJCC']);
    expect(st[1].roles).toEqual(['DEST', 'ALTN']);
  });
  it('위성 범위', () => {
    expect(tileInCoverage('Himawari_AHI_Band13_Clean_Infrared', 3, 6)).toBe(true); // 동경 90~135
    expect(tileInCoverage('GOES-East_ABI_Band13_Clean_Infrared', 3, 6)).toBe(false);
  });
  it('루트 회랑 조각 수가 적당함', () => {
    const t = corridorTiles([{ lat: 37.5, lon: 126.5 }, { lat: 50, lon: 180 }, { lat: 34, lon: -118 }]);
    expect(t.length).toBeGreaterThan(20);
    expect(t.length).toBeLessThan(400);
    expect(t.every((x) => x.z >= 3 && x.z <= 5)).toBe(true);
  });
});

describe('기상 중계 주소', () => {
  it('로컬 서버 판별', async () => {
    const { isLocalHost } = await import('./api');
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('192.168.0.5')).toBe(true);
    expect(isLocalHost('kevin-ihc.github.io')).toBe(false);
  });
});
