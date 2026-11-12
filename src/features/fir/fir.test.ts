// D-055 FIR 통과 순서·현재 FIR·통신표 가져오기
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildChecks } from '../inflight/deviation';
import { parseAviatorOfp } from '../ofp/parser';
import type { OfpData, OfpWaypoint } from '../ofp/types';
import { exportFirComm, parseFirCommImport } from './commTable';
import { firSequence, firTimeline } from './sequence';

const T = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 5, h, m)).toISOString();
const wp = (seq: number, name: string, eto: string, fir?: string, srcLine?: number) => ({ seq, name, eto, fir, srcLine }) as unknown as OfpWaypoint;

const o = {
  header: { takeoff: T(8), sta: T(18), selcal: 'ABCD' },
  route: [
    wp(1, 'P1', T(9)),
    wp(2, 'P2', T(10), 'ZZZB DEMO ONE', 70),
    wp(3, 'P3', T(11), 'ADIZ -----'),
    wp(4, 'P4', T(12), 'ZZZB DEMO ONE'),
    wp(5, 'P5', T(13), 'ZZZC', 90),
  ],
  notams: {
    firOrder: ['ZZZA', 'ZZZB', 'ZZZC', 'ZZZD'],
    packages: [{ no: 3, locations: [{ role: 'FIR', icao: 'ZZZA', name: 'START FIR' }, { role: 'FIR', icao: 'ZZZC', name: 'CHARLIE' }] }],
  },
} as unknown as OfpData;

describe('firSequence', () => {
  it('출발 FIR 앞에 붙임, ADIZ 제외, 같은 FIR 연속은 하나, 이름은 PACKAGE 3로 보충, 진입 지점 없는 FIR 알림', () => {
    const s = firSequence(o);
    expect(s.legs.map((l) => l.icao)).toEqual(['ZZZA', 'ZZZB', 'ZZZC']);
    expect(s.legs[0].name).toBe('START FIR');
    expect(s.legs[0].entry).toBeUndefined();
    expect(s.legs[1]).toMatchObject({ name: 'DEMO ONE', entry: { wpt: 'P2', seq: 2, line: 70 } });
    expect(s.legs[2].name).toBe('CHARLIE');
    expect(s.unplaced).toEqual(['ZZZD']);
  });
});

describe('firTimeline', () => {
  const legs = firSequence(o).legs;
  it('시간으로 현재·다음 FIR, 시간 편차 반영', () => {
    const checks = buildChecks({ ...o, route: o.route } as OfpData, new Map());
    const r = firTimeline(legs, checks, 0, Date.parse(T(9, 50)));
    expect(r.map((x) => x.state)).toEqual(['current', 'next', 'later']);
    expect(r[1].minsTo).toBe(10);
    // 15분 늦음 → 진입 수정 시각 10:15
    const late = firTimeline(legs, checks, 15, Date.parse(T(10, 5)));
    expect(late[1]).toMatchObject({ state: 'next', at: T(10, 15), minsTo: 10, actual: false });
  });
  it('통과 기록이 있으면 실제 시각으로 진입 처리', () => {
    const checks = buildChecks(o, new Map([[2, { ata: T(9, 55) } as never]]));
    const r = firTimeline(legs, checks, 0, Date.parse(T(9, 56)));
    expect(r[1]).toMatchObject({ state: 'current', at: T(9, 55), actual: true });
    expect(r[0].state).toBe('past');
  });
});

describe('통신표 가져오기·내보내기', () => {
  it('왕복, 빈 칸·잘못된 키 버림, 소문자 ICAO 대문자로', () => {
    const t = { KZAK: { cpdlc: 'KZAK', hf: '8903 / 13344', note: '' } };
    const back = parseFirCommImport(exportFirComm(t));
    expect(back).toEqual({ KZAK: { cpdlc: 'KZAK', hf: '8903 / 13344', updatedAt: undefined } });
    const odd = parseFirCommImport(JSON.stringify({ format: 'efb-fir-comm', version: 1, firs: { rjjj: { vhf: ' 132.1 ' }, BAD1X: { vhf: '1' }, ZZZZ: { note: '  ' } } }));
    expect(odd).toEqual({ RJJJ: { vhf: '132.1', updatedAt: undefined } });
  });
  it('다른 형식은 오류', () => {
    expect(() => parseFirCommImport('{"format":"x"}')).toThrow();
    expect(() => parseFirCommImport('not json')).toThrow();
  });
});

// 실제 OFP: FIR 순서가 PACKAGE 3 "FIR:" 목록과 맞는지 (샘플이 있을 때만)
const DIR = join(process.cwd(), 'private/samples');
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.txt')) : [];
describe.skipIf(files.length === 0)('실제 샘플 FIR 순서', () => {
  for (const f of files) {
    it(f, () => {
      const r = parseAviatorOfp(readFileSync(join(DIR, f), 'utf8')).ofp!;
      const s = firSequence(r);
      expect(s.legs.length).toBeGreaterThan(1);
      expect(s.legs.every((l, i) => i === 0 || l.entry)).toBe(true);
      expect(s.legs.every((l) => l.name.length > 0)).toBe(true);
      // 진입 시각은 오름차순
      const ts = s.legs.filter((l) => l.entry).map((l) => Date.parse(l.entry!.eto));
      expect([...ts].sort((a, b) => a - b)).toEqual(ts);
      // NAV LOG 순서(처음 들어가는 순서)가 FIR 목록 순서와 같음 — 같은 FIR 재진입(예: KZAK→PGZU→KZAK)은 목록에 한 번
      const order = r.notams?.firOrder ?? [];
      const inList = [...new Set(s.legs.map((l) => l.icao))].filter((x) => order.includes(x));
      expect(inList).toEqual(order.filter((x) => inList.includes(x)));
    });
  }
});
