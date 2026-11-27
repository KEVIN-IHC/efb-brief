// 항로 스펙 대조 (D-104). 요구 표는 형식만 흉내 낸 가짜 값 (회사 기준 아님). FPL 코드는 ICAO 표준.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAviatorOfp } from '../ofp/parser';
import type { RouteSpecData } from '../brief/rules';
import { buildDemoOfp } from '../../mock/demoOfp';
import { decodeFpl } from './fplCaps';
import { evaluateRouteSpec, overlapsHours } from './evaluate';

describe('FPL 신고 해석 (ICAO Doc 4444)', () => {
  it('Item 10a·10b·PBN·SUR', () => {
    const { codes, caps } = decodeFpl('SDE1E2E3FGHIJ1J2J3J4J5M1P2RWXYZ/LB1D1', { PBN: 'A1B1C1D1L1O1S2', DAT: '1FANSP', SUR: 'RSP180 260B' });
    for (const c of ['RVSM', 'PBN', 'CPDLC', 'FANS', 'ADSC', 'RCP240', 'RSP180', 'SATVOICE', 'HF', 'RNP4', 'RNP10', 'RNAV1', 'RNP1', 'RNP_APCH'] as const) expect(caps.has(c)).toBe(true);
    expect(caps.has('RCP400')).toBe(false);
    expect(codes.map((c) => c.code)).toContain('PBN/L1');
    expect(codes.map((c) => c.code)).toContain('SUR/RSP180');
  });
  it('운영 시간 겹침 (자정 넘김 포함)', () => {
    const t = (h: number, m = 0) => Date.UTC(2026, 10, 5, h, m);
    expect(overlapsHours('1500-1859', t(3, 40), t(4, 17))).toBe(false);
    expect(overlapsHours('1500-1859', t(18, 0), t(20, 0))).toBe(true);
    expect(overlapsHours('2200-0200', t(1, 0), t(1, 30))).toBe(true);
  });
});

const fake = (): RouteSpecData => ({
  source: 'TEST',
  rules: [
    { id: 'rvsm', spec: 'rvsm', flMin: 290, flMax: 410, need: ['RVSM'], level: 'required', text: 'RVSM', refs: [{ code: 'X-1', label: 'X 1' }] },
    { id: 'pbcs', spec: 'pbcs', firs: ['KZAK'], need: ['RCP240', 'RSP180'], level: 'area', text: 'PBCS', okText: 'OK 분리', ifNot: '50NM', refs: [] },
    { id: 'cpdlc-rjjj', spec: 'cpdlc', firs: ['RJJJ'], need: ['CPDLC'], level: 'info', hours: '0000-0001', text: '시간 한정', refs: [] },
    { id: 'nd', spec: 'pbn', firs: ['KZLA'], need: [], level: 'nodata', text: '자료 없음 테스트', refs: [] },
  ],
  melMap: [{ prefix: '23-20', caps: ['CPDLC', 'RCP240', 'RSP180'], label: '데이터링크' }],
});

describe('항로 스펙 대조', () => {
  it('신고 다 있으면 맞음, 시간 밖·자료 없음·요구 없음 구분', () => {
    const o = { ...buildDemoOfp(), atsFpl: { equipment: 'SJ5P2W/D1', item18: { SUR: 'RSP180' }, level: 'F350', route: '' } };
    const r = evaluateRouteSpec(o, fake());
    const leg = (icao: string) => r.legs.find((l) => l.icao === icao)!;
    expect(leg('KZAK').cells.pbcs.status).toBe('ok');
    expect(leg('KZAK').result).toContain('OK 분리');
    expect(leg('KZAK').cells.rvsm.status).toBe('ok');
    expect(leg('RJJJ').cells.cpdlc.status).toBe('warn'); // 운영 시간 밖
    expect(leg('RJJJ').cells.cpdlc.short).toMatch(/시간 밖/);
    expect(leg('KZLA').cells.pbn.status).toBe('unknown');
    expect(leg('KZOA').cells.pbcs.status).toBe('na');
  });
  it('신고 빠지면 area는 확인, required는 신고 없음 · 스펙 계통 MEL이면 확인', () => {
    const base = buildDemoOfp();
    const noW = evaluateRouteSpec({ ...base, atsFpl: { equipment: 'SJ5/D1', item18: {}, level: 'F350', route: '' } }, fake());
    const kz = noW.legs.find((l) => l.icao === 'KZAK')!;
    expect(kz.cells.rvsm.status).toBe('missing');
    expect(kz.cells.pbcs.status).toBe('warn');
    expect(kz.cells.pbcs.hits[0].missing).toEqual(['RCP240', 'RSP180']);
    const withMel = evaluateRouteSpec(
      { ...base, atsFpl: { equipment: 'SJ5P2W/D1', item18: { SUR: 'RSP180' }, level: 'F350', route: '' }, mel: [{ kind: 'MEL', itemNo: '23-20-04A', title: 'SATCOM DATALINK' }] },
      fake(),
    );
    const c = withMel.legs.find((l) => l.icao === 'KZAK')!.cells.pbcs;
    expect(c.status).toBe('warn');
    expect(c.mel[0].item.itemNo).toBe('23-20-04A');
  });
  it('요구 표 없음 → 전부 요구 없음, FPL 없음 표시', () => {
    const r = evaluateRouteSpec(buildDemoOfp(), null);
    expect(r.noFpl).toBe(true);
    expect(r.legs.every((l) => Object.values(l.cells).every((c) => c.status === 'na'))).toBe(true);
  });
});

// 실제 샘플 OFP + 실제 회사 기준 파일 (private 있을 때만, 커밋되는 값 없음)
const S1 = join(process.cwd(), 'private/samples/ofp-01.txt');
const RULES = join(process.cwd(), 'private/manuals/company-rules.json');
describe.skipIf(!existsSync(S1) || !existsSync(RULES))('실제 샘플 ofp-01 × 회사 요구 표', () => {
  it('FPL 저장 · PAC FIR PBCS·CPDLC 맞음 · 인천 CPDLC 시간 밖', () => {
    const o = parseAviatorOfp(readFileSync(S1, 'utf8')).ofp!;
    expect(o.atsFpl?.equipment).toMatch(/J5/);
    expect(o.atsFpl?.item18.PBN).toBeTruthy();
    // OT 열 부호 없음 → FL250 이상은 영하 (파서 1.9)
    const cr = o.route.filter((w) => w.fl >= 250);
    expect(cr.length).toBeGreaterThan(10);
    expect(cr.every((w) => w.oat != null && w.oat < -20)).toBe(true);
    const rs = JSON.parse(readFileSync(RULES, 'utf8')).routeSpec;
    const r = evaluateRouteSpec(o, rs);
    const leg = (icao: string) => r.legs.find((l) => l.icao === icao);
    expect(r.legs.map((l) => l.icao).slice(0, 3)).toEqual(['RKRR', 'RJJJ', 'KZAK']);
    expect(leg('KZAK')!.cells.pbcs.status).toBe('ok');
    expect(leg('KZAK')!.cells.pbn.status).toBe('ok');
    expect(leg('RJJJ')!.cells.cpdlc.status).toBe('ok');
    expect(leg('RKRR')!.cells.cpdlc.status).toBe('warn');
    expect(r.counts.missing).toBe(0);
    expect(r.melHits).toHaveLength(0);
  });
});
