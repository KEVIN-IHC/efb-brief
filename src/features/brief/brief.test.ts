// 브리핑 판정 (D-049~D-054). 회사 기준 수치는 공개 저장소에 두지 않으므로 아래 FAKE 규칙은 가짜 값이다.
// 실제 회사 기준 대조는 private/manuals/company-rules.json + private/samples 가 있을 때만 (커밋 안 됨).
import 'fake-indexeddb/auto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDemoOfp } from '../../mock/demoOfp';
import type { OfpNotamItem } from '../ofp/types';
import { parseAviatorOfp } from '../ofp/parser';
import type { Taf } from '../weather/types';
import { alternateCheck, approachNeed, buildBrief, coldCorrection, flightAirports, surfaceBraking, takeoffLevel, type BriefInput } from './assess';
import { currentPosition } from './cards';
import { loadRefsFor, loadRestrictions, loadSpecialAirports, parseSpecialTable } from './fomTables';
import { saveManual } from '../manual/store';
import { ruleCodes } from './useBrief';
import { itemImpacts, parseRwyCond } from './notamImpact';
import { DEFAULT_PROFILE } from './profile';
import { validateRules, type CompanyRules } from './rules';
import { airportRunways, parseOfpRunways, rankEnds, windComponents } from './runways';
import { sunElevation } from './sun';
import { parseMetarRaw, tafWindow, type Cond } from './wx';

const ref = (code: string) => ({ code, label: code });
/** 가짜 회사 기준 (수치는 시험용) */
export const FAKE: CompanyRules = {
  format: 'efb-company-rules',
  version: 1,
  source: 'TEST',
  takeoff: { byEngines: { '4': { standard: { rvr: 700, vis: 700 }, lower: [{ rvr: 400, need: 'A' }, { rvr: 200, need: 'B' }, { rvr: 100, need: 'C' }] } }, lowerConditions: ['x'], ref: ref('T') },
  approach: { levels: [{ name: 'L1', dh: 200, rvr: 600, vis: 900 }, { name: 'L2', dh: 100, rvr: 300 }, { name: 'L3', rvr: 100 }], circling: { ceil: 1000, vis: 5000 }, ref: ref('A'), circlingRef: ref('C') },
  alternate: { cat3: { ceil: 250, rvr: 600, vis: 900 }, cat2: { ceil: 350, rvr: 1300, vis: 1300 }, otherRules: ['r'], cat3NeedsEoCapability: true, ref: ref('ALT') },
  dispatch: { longFlightMin: 120, ref: ref('D') },
  takeoffAlternate: { maxTimeMin: { '4': 100 }, ref: ref('TA') },
  facility: { alsInop: { rvr: 1100, vis: 1100, ref: ref('F1') }, edgeLightsInop: { summary: 's', ref: ref('F2') } },
  landingPlan: { wetBelowM: 1000, ref: ref('LP') },
  runwayWidthMinFt: { byAircraft: { A380: 160 }, ref: ref('W') },
  rff: { aircraftCat: { A380: 10 }, depDest: { normal: 0, reduced: 1, temp: 2 }, alternate: { normal: 2, temp: 3 }, eraMin: 4, ref: ref('R') },
  wind: { tailCaptainAbove: 8, ref: ref('WI'), applyRef: ref('WA') },
  windLimits: {
    byAircraft: {
      A380: {
        takeoff: { good: [25, 8], goodMedium: [15, 4], medium: [15, 4], mediumPoor: [8, null], poor: [8, null], nil: null },
        landing: { good: [25, 8], goodMedium: [15, 4], medium: [15, 4], mediumPoor: [8, null], poor: [8, null], nil: null },
        autoland: { head: 30, tail: 8, cross: 25, crossCat23: 12 },
        cat3FailOpNotOnContaminated: true,
        ref: ref('WL'),
        autolandRef: ref('AL'),
        rcamRef: ref('RC'),
      },
    },
  },
  lowTime: { captain: { ceil: 400, vis: 2000, rvrTable: [[600, 1500]], exemptions: ['e'], ref: ref('LT') }, oe: { conditions: [], ref: ref('OE') }, captainHandling: { summary: 'h', ref: ref('CH') }, fo: { visMax: 1000, rvrMax: 1000, crossMax: 12, conditions: [], ref: ref('FO') } },
  contingency3: { etaDelayMin: 10, altChangeFt: 3000, ref: ref('C3') },
  coldTemp: { applyAtOrBelow: 0, heightsFt: [500, 1000, 2000], rows: [{ temp: 0, add: [1, 2, 3] }, { temp: -10, add: [4, 5, 6] }], ref: ref('CT') },
  sections: { specialAirports: 'FOM-S', airportRestrictions: 'FOM-R', specialQual: ref('SQ') },
  refs: { cat23: ref('X'), rnp: ref('X'), diversion: [], briefings: { joint: ref('J'), takeoff: ref('TK'), landing: ref('LD'), handover: ref('HO'), cat23: ref('X') }, edtoEra: ref('X'), era3: ref('X'), deicing: ref('X'), thunderstorm: ref('X'), windshear: ref('X'), volcanic: ref('X') },
};

const C = (p: Partial<Cond>): Cond => ({ visM: 10000, ceilFt: null, rvr: [], wx: '', wdir: 0, wspd: 0, wgst: null, ...p });

describe('기상 읽기', () => {
  it('METAR 원문: 시정(m)·RVR·현상·수직시정', () => {
    const p = parseMetarRaw('RKSI 110000Z 34005KT 0400 R33L/0550N R33R/P2000 FG VV001 M02/M03 Q1020 NOSIG');
    expect(p.visM).toBe(400);
    expect(p.rvr.map((r) => [r.rwy, r.m, r.qual])).toEqual([
      ['33L', 550, undefined],
      ['33R', 2000, 'P'],
    ]);
    expect(p.wx).toEqual(['FG']);
    expect(p.vv).toBe(100);
  });
  it('미국 METAR: SM 시정·FT RVR, RMK 뒤 무시', () => {
    const p = parseMetarRaw('KLAX 110053Z 25010KT 1 1/2SM R25R/2400FT -RA BR OVC004 12/11 A2992 RMK AO2 TSB10');
    expect(p.visM).toBe(Math.round(1.5 * 1609.34));
    expect(p.rvr[0]).toMatchObject({ rwy: '25R', m: 732 });
    expect(p.wx).toEqual(['-RA', 'BR']);
  });
  it('TAF 시간 창: 기본 예보와 TEMPO 분리, BECMG 빈 칸은 앞 예보 이어받기', () => {
    const t: Taf = {
      icao: 'TEST', issueTime: '2026-11-11T00:00:00Z', validFrom: '2026-11-11T00:00:00Z', validTo: '2026-11-12T00:00:00Z', raw: '',
      periods: [
        { from: '2026-11-11T00:00:00Z', to: '2026-11-11T12:00:00Z', change: null, prob: null, wdir: 270, wspd: 15, wgst: 25, visib: 6, wx: null, clouds: [{ cover: 'BKN', base: 3000 }], vertVis: null, fltCat: null },
        { from: '2026-11-11T06:00:00Z', to: '2026-11-11T10:00:00Z', change: 'TEMPO', prob: null, wdir: null, wspd: null, wgst: null, visib: 0.5, wx: 'FG', clouds: [{ cover: 'OVC', base: 200 }], vertVis: null, fltCat: null },
      ],
    };
    const w = tafWindow(t, Date.parse('2026-11-11T07:00:00Z'), Date.parse('2026-11-11T09:00:00Z'));
    expect(w.base?.ceilFt).toBe(3000);
    expect(w.temp?.visM).toBe(800);
    expect(w.temp?.wspd).toBe(15);
    expect(w.outside).toBe(false);
  });
});

describe('활주로·바람', () => {
  it('OFP 활주로 줄 읽기', () => {
    expect(parseOfpRunways(['1. RUNWAY :  07L/25R : 12923FT X 150FT 07R/25L : 11095FT X 200FT', '   06R/24L : 10885FT X 150FT'])).toEqual([
      { a: '07L', b: '25R', lenFt: 12923, widthFt: 150 },
      { a: '07R', b: '25L', lenFt: 11095, widthFt: 200 },
      { a: '06R', b: '24L', lenFt: 10885, widthFt: 150 },
    ]);
  });
  it('공개 자료 진방위 병합 (0 없는 번호), 없으면 번호×10 대략', () => {
    const r = airportRunways('TEST', ['1. RUNWAY : 07L/25R : 12000FT X 150FT 13/31 : 9000FT X 148FT'], { TEST: [['7L', '25R', 83, 263, 12000, 150, 1]] });
    expect(r.ends.find((e) => e.id === '07L')).toMatchObject({ hdgT: 83, approx: false });
    expect(r.ends.find((e) => e.id === '31')).toMatchObject({ hdgT: 310, approx: true });
    expect(r.src).toBe('both');
  });
  it('바람 성분 (정풍·측풍·배풍), VRB는 최악', () => {
    expect(windComponents(300, 20, 270)).toEqual({ head: 17, cross: 10, tail: 0 });
    expect(windComponents(90, 10, 270)).toEqual({ head: -10, cross: 0, tail: 10 });
    expect(windComponents('VRB', 5, 90)).toEqual({ head: -5, cross: 5, tail: 5 });
    const ranked = rankEnds([{ id: '09', hdgT: 90, approx: false, lenFt: null, widthFt: null }, { id: '27', hdgT: 270, approx: false, lenFt: null, widthFt: null }], 250, 20);
    expect(ranked[0].end.id).toBe('27');
  });
});

describe('NOTAM 영향', () => {
  const it0 = (text: string, extra: Partial<OfpNotamItem> = {}): OfpNotamItem => ({ kind: 'notam', category: 'RUNWAY', text, line: 10, lines: [], from: '2026-11-11T00:00:00Z', ...extra });
  const W = [{ from: Date.parse('2026-11-11T01:00:00Z'), to: Date.parse('2026-11-11T03:00:00Z'), basis: 't' }];
  const kinds = (t: string) => itemImpacts('TEST', it0(t), W).map((x) => x.kind);
  it('고장 낱말이 있어야 고장', () => {
    expect(kinds('RWY 33L ALS U/S')).toEqual(['als']);
    expect(kinds('IAP LOS ANGELES INTL. ILS OR LOC RWY 25R, AMDT 3')).toEqual([]);
    expect(kinds('ILS-LOC,GP,DME FOR RWY 16L U/S DUE TO CONST')).toEqual(['ils']);
    expect(kinds('RWY 15R/33L EDGE LGT U/S')).toContain('edgeLights');
    expect(kinds('AD CLSD')).toEqual(['adClosed']);
    expect(kinds('RWY 07L/25R CLSD')).toEqual(['rwyClosed']);
    expect(kinds('TWY B6 BTN RWY 07L/25R AND TWY B CLSD')).toEqual([]);
    expect(kinds('GPS RAIM OUTAGES PREDICTED FOR APCH RNP0.3 AS FLW')).toEqual(['gnss']);
  });
  it('소방등급 숫자', () => {
    expect(itemImpacts('TEST', it0('FIRE AND RESCUE CAT 7 HR OF SER AMD'), W)[0]).toMatchObject({ kind: 'rff', rffCat: 7 });
  });
  it('비행 시간대 밖이면 제외', () => {
    expect(itemImpacts('TEST', it0('AD CLSD', { from: '2026-11-12T00:00:00Z' }), W)).toEqual([]);
  });
  it('활주로 상태 RWYCC·Braking', () => {
    expect(parseRwyCond('RWY 15L RWYCC 5/5/3 100/100/50 WET/WET/SLUSH')).toMatchObject({ rwys: ['15L'], rwycc: [5, 5, 3], braking: 'medium', contaminant: 'SLUSH' });
    expect(parseRwyCond('RWY 34 BRAKING ACTION MEDIUM TO POOR')).toMatchObject({ braking: 'mediumPoor' });
    expect(parseRwyCond('RWY 34 CLSD')).toBeNull();
  });
});

describe('회사 기준 판정 (가짜 수치)', () => {
  it('기준 파일 형식 점검', () => {
    expect(validateRules(FAKE)).toBeNull();
    expect(validateRules({ format: 'x' })).toMatch(/아님/);
  });
  it('이륙: Standard / Lower(필요 시설) / 미만', () => {
    expect(takeoffLevel(FAKE, '4', C({ visM: 800 }))?.kind).toBe('standard');
    expect(takeoffLevel(FAKE, '4', C({ rvr: [{ rwy: '33L', m: 250 }] }))).toMatchObject({ kind: 'lower', need: 'B' });
    expect(takeoffLevel(FAKE, '4', C({ rvr: [{ rwy: '33L', m: 50 }] }))?.kind).toBe('below');
  });
  it('접근 등급과 교체공항 하한', () => {
    expect(approachNeed(FAKE, C({ visM: 2000, ceilFt: 500 }))).toBe(0);
    expect(approachNeed(FAKE, C({ rvr: [{ rwy: 'x', m: 350 }], ceilFt: 150 }))).toBe(1);
    expect(approachNeed(FAKE, C({ rvr: [{ rwy: 'x', m: 50 }] }))).toBe(-1);
    expect(alternateCheck(FAKE, C({ visM: 800 }))).toBe('belowCat3');
    expect(alternateCheck(FAKE, C({ visM: 1200 }))).toBe('belowCat2');
    expect(alternateCheck(FAKE, C({ visM: 5000, ceilFt: 2000 }))).toBe('ok');
  });
  it('활주로 표면: NOTAM 우선, 비 = Wet(Good), 눈 = 모름', () => {
    expect(surfaceBraking([], C({ wx: '-RA' })).braking).toBe('good');
    expect(surfaceBraking([], C({ wx: 'SN' })).braking).toBeNull();
    expect(surfaceBraking([{ kind: 'rwyCond', icao: 'T', rwys: [], braking: 'mediumPoor', text: '', line: 1, time: 'overlap' }], C({})).braking).toBe('mediumPoor');
  });
  it('저온 보정: 다음으로 추운 행, 높이 열', () => {
    expect(coldCorrection(FAKE, -3, 1000)).toBe(5);
    expect(coldCorrection(FAKE, 0, 600)).toBe(2);
  });
});

describe('FOM 표 읽기 (가짜 표)', () => {
  it('특수공항 표 줄', () => {
    expect(parseSpecialTable('| Airport | Identification | Characteristics |\n|---|---|---|\n| Testville | ZZZZ/ZZZ | Hills |')).toEqual([{ name: 'Testville', icao: 'ZZZZ', iata: 'ZZZ', note: 'Hills' }]);
  });
});

describe('비행 전체 (데모 OFP)', () => {
  const base = (o = buildDemoOfp()): BriefInput => ({ o, now: Date.parse(o.header.takeoff) - 3 * 3_600_000, wx: { metars: {}, tafs: {} }, rules: FAKE, profile: DEFAULT_PROFILE, runwayDb: {}, specials: [], restrictions: [], refs: {}, geo: {} });
  it('역할별 공항·시간 창', () => {
    const o = buildDemoOfp();
    const s = flightAirports(o, FAKE);
    expect(s.find((x) => x.icao === o.header.dep)?.roles).toContain('DEP');
    expect(s.find((x) => x.icao === o.header.arr)?.roles).toContain('DEST');
  });
  it('기상 없이도 오류 없이 만든다', () => {
    const b = buildBrief(base());
    expect(b.airports.length).toBeGreaterThan(1);
    expect(b.hasRules).toBe(true);
  });
  it('회사 기준 없으면 안내 한 줄', () => {
    const b = buildBrief({ ...base(), rules: null });
    expect(b.flight.map((f) => f.key)).toContain('no-rules');
  });
  it('목적지 저시정 METAR → 접근 등급 경고', () => {
    const o = buildDemoOfp();
    const at = new Date(Date.parse(o.header.sta) - 1_800_000).toISOString();
    const metar = { icao: o.header.arr, obsTime: at, raw: `${o.header.arr} 000000Z 25005KT 0100 R25R/0050 FG VV001 10/10 Q1013`, wdir: 250, wspd: 5, wgst: null, visib: 0.06, temp: 10, dewp: 10, altim: 1013, clouds: [], fltCat: null };
    const b = buildBrief({ ...base(o), now: Date.parse(at), wx: { metars: { [o.header.arr]: { fetchedAt: at, data: metar } }, tafs: {} } });
    expect(b.findings.some((f) => f.key.startsWith('dest-below:'))).toBe(true);
  });
  it('현재 위치: 이륙 전 = 출발, 비행 중 = 경로 위', () => {
    const o = buildDemoOfp();
    expect(currentPosition(o, 0)).toMatchObject({ lat: o.route[0].lat });
    const mid = currentPosition(o, (Date.parse(o.route[0].eto) + Date.parse(o.route[o.route.length - 1].eto)) / 2)!;
    expect(mid.lat).not.toBe(o.route[0].lat);
  });
  it('태양 고도: 정오 적도 높음, 자정 낮음', () => {
    expect(sunElevation(0, 0, Date.parse('2026-03-20T12:00:00Z'))).toBeGreaterThan(80);
    expect(sunElevation(0, 0, Date.parse('2026-03-20T00:00:00Z'))).toBeLessThan(-60);
  });
});

// ---- 실제 회사 기준·OFP 샘플 (private, 커밋 안 됨) ----
const RULES_FILE = join(__dirname, '../../../private/manuals/company-rules.json');
const SAMPLES = join(__dirname, '../../../private/samples');
const RUNWAYS = join(__dirname, '../../../public/geo/runways.json');
const hasReal = existsSync(RULES_FILE) && existsSync(SAMPLES);
describe.skipIf(!hasReal)('실제 회사 기준 + OFP 샘플 (private)', () => {
  it('회사 기준 파일 형식 통과', () => {
    expect(validateRules(JSON.parse(readFileSync(RULES_FILE, 'utf8')))).toBeNull();
  });
  it('샘플마다 오류 없이 브리핑, 출발·목적지 활주로 방위는 공개 자료로', () => {
    const rules = JSON.parse(readFileSync(RULES_FILE, 'utf8')) as CompanyRules;
    const runwayDb = existsSync(RUNWAYS) ? JSON.parse(readFileSync(RUNWAYS, 'utf8')).runways : {};
    const files = readdirSync(SAMPLES).filter((f) => /^ofp-\d+\.txt$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const o = parseAviatorOfp(readFileSync(join(SAMPLES, f), 'utf8')).ofp!;
      const b = buildBrief({ o, now: Date.parse(o.header.takeoff), wx: { metars: {}, tafs: {} }, rules, profile: DEFAULT_PROFILE, runwayDb, specials: [], restrictions: [], refs: {}, geo: {} });
      const dest = b.airports.find((a) => a.roles.includes('DEST'))!;
      expect(dest.runways.ends.length, f).toBeGreaterThan(0);
      expect(dest.runways.ends.every((e) => !e.approx), `${f} ${dest.icao} 진방위`).toBe(true);
      expect(b.findings.every((x) => x.basis.length > 0), f).toBe(true);
    }
  });
});

const FOM_BUNDLE = join(__dirname, '../../../private/manuals/out/GEN-FOM.efbman.json.gz');
const FCOM_BUNDLE = join(__dirname, '../../../private/manuals/out/A380-FCOM.efbman.json.gz');
describe.skipIf(!existsSync(FOM_BUNDLE) || !existsSync(RULES_FILE))('실제 FOM 표 (private)', () => {
  it('특수공항 표·공항 제한 절·근거 코드 전부 찾기', async () => {
    const rules = JSON.parse(readFileSync(RULES_FILE, 'utf8')) as CompanyRules;
    await saveManual(JSON.parse(gunzipSync(readFileSync(FOM_BUNDLE)).toString('utf8')));
    if (existsSync(FCOM_BUNDLE)) await saveManual(JSON.parse(gunzipSync(readFileSync(FCOM_BUNDLE)).toString('utf8')));
    const sp = await loadSpecialAirports(rules.sections.specialAirports);
    expect(sp.length).toBeGreaterThan(20);
    expect(sp.every((a) => /^[A-Z]{4}$/.test(a.icao) && a.note)).toBe(true);
    const rs = await loadRestrictions(rules.sections.airportRestrictions);
    expect(rs.length).toBeGreaterThan(3);
    expect(rs.every((r) => /^[A-Z]{4}$/.test(r.icao))).toBe(true);
    // 기종 전용 절은 기종이 표시됨
    expect(rs.some((r) => r.aircraft)).toBe(true);
    const codes = ruleCodes(rules);
    const refs = await loadRefsFor(codes);
    const missing = codes.filter((c) => !refs[c] && (existsSync(FCOM_BUNDLE) || c.startsWith('FOM-')));
    expect(missing).toEqual([]);
  }, 60_000);
});
