// D-056~D-060: 공통 도구 · AIRAC · 버티컬 뷰 계산 · 기상 확장 해석
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LogRecord } from '../../db/schema';
import { airacAge, airacOf } from '../../lib/airac';
import { validateRules } from '../brief/rules';
import type { OfpData, OfpWaypoint } from '../ofp/types';
import { plannedProfile, sigmetSpans, windCells, flOfHpa } from '../vertical/profile';
import { decodeGairmets, decodeGdacs, decodePireps, decodeScales, routeBoxes } from '../weather/extra';
import type { Sigmet, WindsData } from '../weather/types';
import { positionAt } from './position';
import { eventNote, fillPa, parseEvents, timerStatus } from './store';

const T = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 5, h, m)).toISOString();

describe('AIRAC', () => {
  it('기준 주기·연도 첫 주기·28일 경계', () => {
    expect(airacOf('2024-01-25T00:00:00Z').id).toBe('2401');
    expect(airacOf('2024-01-24T23:59:00Z').id).toBe('2313');
    expect(airacOf('2025-01-23T00:00:00Z').id).toBe('2501');
    expect(airacOf('2026-01-22T00:00:00Z').id).toBe('2601');
    expect(airacOf('2026-11-12T00:00:00Z')).toMatchObject({ id: '2611', start: '2026-10-29' });
    expect(airacOf('2026-11-26T00:00:00Z').id).toBe('2612');
    expect(airacAge('2026-10-01T00:00:00Z', Date.parse('2026-11-12T00:00:00Z'))).toBe(1);
    expect(airacAge('2026-09-10T00:00:00Z', Date.parse('2026-11-12T00:00:00Z'))).toBe(2);
    expect(airacAge(undefined)).toBeNull();
  });
});

describe('사건 기록', () => {
  const log = (note: string, createdAt: string, i = 0) => ({ logId: `l${i}`, flightId: 'F', kind: 'memo', note, createdAt }) as LogRecord;
  it('메모 형식 왕복, 일반 메모 제외, 시각 순 정렬, 자정 넘김', () => {
    const n1 = eventNote(T(10, 5), '의사 호출', '12A 승객');
    expect(n1).toBe('⏱ 1005Z 의사 호출 — 12A 승객');
    const ev = parseEvents([log(n1, T(10, 6), 1), log('그냥 메모', T(10, 7), 2), log('⏱ 0940Z 객실 통보', T(10, 8), 3), log('⏱ 2355Z 어제 일', '2026-11-06T00:05:00.000Z', 4)]);
    expect(ev.map((e) => e.label)).toEqual(['객실 통보', '의사 호출', '어제 일']);
    expect(ev[1]).toMatchObject({ at: T(10, 5), text: '12A 승객' });
    expect(ev[2].at).toBe(T(23, 55));
  });
});

describe('PA 채우기', () => {
  it('값이 없으면 [이름?]로 남기고 목록에', () => {
    const r = fillPa('{FLT}편 {ARR_NAME} 도착 {ETA_Z}, 기온 {ARR_TEMP}', { FLT: 'XX123', ARR_NAME: 'LOS ANGELES', ETA_Z: '0530Z' });
    expect(r.text).toBe('XX123편 LOS ANGELES 도착 0530Z, 기온 [ARR_TEMP?]');
    expect(r.missing).toEqual(['ARR_TEMP']);
  });
});

describe('타이머', () => {
  it('n분마다 표시: 다음 시점·남은 분, 종료 시각 기준 경과', () => {
    const marks = [{ every: 30, text: 'PA' }];
    expect(timerStatus(T(10), marks, Date.parse(T(10, 45)))).toMatchObject({ elapsed: 45, next: { min: 60 }, inMin: 15 });
    expect(timerStatus(T(10), [{ at: 90, text: 'X' }], Date.parse(T(10, 20)))).toMatchObject({ inMin: 70 });
    expect(timerStatus(T(10), marks, Date.parse(T(12)), T(10, 50)).elapsed).toBe(50);
  });
});

const wp = (seq: number, name: string, cumDist: number, fl: number, eto: string, extra: Partial<OfpWaypoint> = {}) =>
  ({ seq, name, cumDist, fl, eto, lat: 30, lon: 140 + seq, ...extra }) as unknown as OfpWaypoint;

const o = {
  header: { dep: 'ZZAA', arr: 'ZZBB', cruiseFl: 350, takeoff: T(8), sta: T(12) },
  route: [wp(0, 'ZZAA', 0, 0, T(8)), wp(1, 'C1', 50, 0, T(8, 10), { flText: 'CLB' }), wp(2, 'P1', 150, 350, T(8, 30)), wp(3, 'P2', 600, 370, T(9, 30)), wp(4, 'D1', 900, 0, T(11, 30), { flText: 'DSC' }), wp(5, 'ZZBB', 1000, 0, T(12))],
  etps: [],
} as unknown as OfpData;

describe('사건 위치', () => {
  it('지점 사이·이륙 전·도착 후', () => {
    expect(positionAt(o, T(9), 0)).toBe('P1→P2 (P1 후 30분, 계획 FL350)');
    expect(positionAt(o, T(9, 10), 10)).toBe('P1→P2 (P1 후 30분, 계획 FL350)');
    expect(positionAt(o, T(7), 0)).toContain('이륙 전');
    expect(positionAt(o, T(13), 0)).toContain('도착 후');
  });
});

describe('버티컬 뷰', () => {
  it('계획 고도선: CLB/DSC 줄(0)은 건너뛰고 출발·도착은 0', () => {
    expect(plannedProfile(o).map((p) => [p.x, p.fl])).toEqual([
      [0, 0],
      [150, 350],
      [600, 370],
      [1000, 0],
    ]);
  });
  it('기압면 ↔ FL (표준대기)', () => {
    expect(flOfHpa(500)).toBeGreaterThanOrEqual(180);
    expect(flOfHpa(500)).toBeLessThanOrEqual(185);
    expect(flOfHpa(250)).toBeGreaterThanOrEqual(338);
    expect(flOfHpa(250)).toBeLessThanOrEqual(342);
  });
  it('바람 성분: 진로(동쪽 090) 기준 서풍 = 뒷바람 +, 동풍 = 앞바람 −', () => {
    const winds: WindsData = {
      model: 'x',
      basis: 'eto',
      points: [
        { seq: 2, name: 'P1', lat: 30, lon: 142, fl: 350, time: T(8), dir: 270, spd: 100, temp: -50, freezingFt: 15000, levels: [{ hpa: 250, dir: 270, spd: 100, temp: -50 }, { hpa: 300, dir: 90, spd: 40, temp: -40 }] },
      ],
    };
    const { cells, freezing } = windCells(o, winds);
    const c250 = cells.find((c) => c.hpa === 250)!;
    const c300 = cells.find((c) => c.hpa === 300)!;
    expect(c250.comp).toBe(100);
    expect(c300.comp).toBe(-40);
    expect(freezing).toEqual([{ x: 150, fl: 150 }]);
  });
  it('SIGMET 구간: 다각형 안 지점, 고도 FL로', () => {
    const s = { id: 'S1', hazard: 'TURB', base: 30000, top: 40000, validFrom: T(7), validTo: T(13), raw: 'x', polys: [[[25, 142.5], [35, 142.5], [35, 143.5], [25, 143.5]]] } as unknown as Sigmet;
    const sp = sigmetSpans(o, [s], Date.parse(T(8)));
    expect(sp).toHaveLength(1);
    expect(sp[0]).toMatchObject({ x0: 600, x1: 600, base: 300, top: 400 });
  });
});

describe('기상 확장 해석', () => {
  it('PIREP: 난류·착빙 강도, AIREP 구분', () => {
    const p = decodePireps([{ obsTime: 1794478920, lat: 28.4, lon: -89.1, fltLvl: 350, tbInt1: 'MOD', icgInt1: '', acType: 'A321', pirepType: 'PIREP', rawOb: 'UA /TB MOD' }, { lat: 'x' }]);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ fl: 350, turb: 'MOD', icing: undefined, aireP: false });
  });
  it('SWPC 등급: 현재 + 오늘 확률', () => {
    const s = decodeScales({ '0': { DateStamp: '2026-11-12', TimeStamp: '10:18:00', R: { Scale: '1' }, S: { Scale: '0' }, G: { Scale: '2' } }, '1': { R: { MinorProb: '45', MajorProb: '5' }, S: { Prob: '5' } } });
    expect(s).toMatchObject({ r: 1, s: 0, g: 2, rMinorProb: '45', sProb: '5', stamp: '2026-11-12T10:18:00.000Z' });
    expect(decodeScales({})).toBeNull();
  });
  it('GDACS: 현재(iscurrent) 열대저기압만', () => {
    const c = decodeGdacs({ features: [{ geometry: { coordinates: [130, 20] }, properties: { eventtype: 'TC', iscurrent: 'true', eventid: 1, eventname: 'AAA-26', alertlevel: 'Orange' } }, { geometry: { coordinates: [80, 15] }, properties: { eventtype: 'TC', iscurrent: 'false', eventid: 2 } }] });
    expect(c).toEqual([expect.objectContaining({ id: '1', name: 'AAA-26', lat: 20, lon: 130, level: 'Orange' })]);
  });
  it('G-AIRMET: 0시간 다각형만', () => {
    const g = decodeGairmets([
      { tag: '1', forecastHour: '0', geometryType: 'POLYGON', hazard: 'TURB-HI', validTime: T(9), expireTime: '1794495600', base: '180', top: '390', coords: [{ lat: '30', lon: '-120' }, { lat: '35', lon: '-120' }, { lat: '35', lon: '-110' }] },
      { tag: '2', forecastHour: '3', geometryType: 'POLYGON', hazard: 'ICE', coords: [] },
      { tag: '3', forecastHour: '0', geometryType: 'LINE', hazard: 'FZLVL', coords: [] },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ hazard: 'TURB-HI', base: '180', top: '390' });
  });
  it('루트 bbox: 날짜변경선을 넘으면 둘로', () => {
    expect(routeBoxes([{ lat: 37, lon: 126 }, { lat: 34, lon: -118 }], 0)).toEqual([
      [34, 126, 37, 180],
      [34, -180, 37, -118],
    ]);
    expect(routeBoxes([{ lat: 10, lon: 10 }, { lat: 20, lon: 20 }], 1)).toEqual([[9, 9, 21, 21]]);
  });
});

// 실제 회사 기준 파일(있을 때만): 상황 카드 형식이 맞는지
const RULES = join(process.cwd(), 'private/manuals/company-rules.json');
describe.skipIf(!existsSync(RULES))('실제 회사 기준 파일 상황 카드', () => {
  it('형식 통과, 카드마다 FOM 근거', () => {
    const r = JSON.parse(readFileSync(RULES, 'utf8'));
    expect(validateRules(r)).toBeNull();
    expect(r.ops.cards.length).toBeGreaterThan(20);
    for (const c of r.ops.cards) expect(c.refs.length, c.id).toBeGreaterThan(0);
  });
});
