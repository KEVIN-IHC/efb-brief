import { describe, expect, it } from 'vitest';
import { parseNotams, notamTime } from '../ofp/parser/notam';
import { splitSections } from '../ofp/parser/sections';
import { toDocLines } from '../ofp/parser/lines';
import type { OfpData } from '../ofp/types';
import { classifyNotam } from './classify';
import { firWindows, flightWindow, timeStatus } from './relevance';

// ⚠ 가짜 데이터. Aviator NOTAM 패키지의 구조만 흉내 냄 (실제 NOTAM 아님 — 위치·번호 모두 가상)
const TEXT = [
  'END OF JEPPESEN DATAPLAN',
  '                       NOTAM      PACKAGE 1',
  'DMO001  / AAA / BBB                           PRINTED  AT05NOV26   1000Z',
  'DEP:  ZZAA     DEST:  ZZBB     ALTN:  ZZCC',
  '[DEP]ZZAA/ AAA/   Demo  Departure  Airport,  Demo,  ZZ',
  '1.  RUNWAY  :  15/33 : 12000FT  X 200FT',
  '◼ DEPARTURE   AIRPORT  TECHNICAL  INFORMATION',
  ' DEMO FREE TEXT LINE ONE',
  ' DEMO FREE TEXT LINE TWO',
  '◼ COMPANY   ADVISORY',
  ' 1. 01APR26  00:00 - 31OCT26    14:59                   ZZAA COAD01/26',
  '   DEMO COMPANY NOTE',
  '   -- BY DEMO --',
  '◼ RUNWAY',
  '05NOV26  10:00  - 05NOV26  14:00                           ZZAA A0001/26',
  ' E) RWY 15/33 CLSD',
  '                                                                       Page 9',
  '===== PAGE 10 =====',
  ' COMMENT) DEMO COMPANY COMMENT',
  '◼ APPROACH',
  '01OCT26 00:00 - UFN                                ZZAA A0002/26',
  ' D) 01-05 1400-2100',
  ' E) ILS RWY 33 U/S',
  '[DEST]ZZBB/ BBB/ Demo Arrival Airport, Demo City,',
  'ZZ',
  '◼ TAXIWAY',
  '01JAN26 00:00 - 01FEB26 00:00                      ZZBB B0003/26',
  ' E) TWY A WIP',
  '             END OF PACKAGE 1 FOR DMO 001 AAA/BBB .',
  '                    NOTAM    PACKAGE     2',
  'ETP: ZZDD',
  '[ETP]ZZDD/ DDD/ Demo Etp, Demo, ZZ',
  '           ******** NO CURRENT NOTAMS FOUND ********',
  '[ERA]ZZBB/ BBB/ Demo Arrival Airport, Demo City, ZZ',
  'SEE THE SAME AIRPORT IN PACKAGE 1',
  '          END OF NOTAM PACKAGE 2 FOR DMO 001 AAA / BBB',
  '                     NOTAM    PACKAGE 3',
  'FIR: ZZZA ZZZB',
  '[FIR] ZZZB/ Demo Fir, ZZ',
  '◼ AIRSPACE',
  '05NOV26 06:00 - 06NOV26 08:00                            ZZZB D0004/26',
  ' E) TEMPO PROHIBITED AREA ACT',
  ' F)SFC G)UNL',
  '◼ NAVAID',
  '20NOV26 00:00 - PERM                               ZZZB A0005/26',
  ' E) VOR ABC U/S',
  '              END OF NOTAM PACKAGE 3 FOR DMO 001 AAA/BBB',
  'TRAILING CFP COPY',
].join('\n');

const lines = toDocLines(TEXT);
const { sections } = splitSections(lines);
const ranges = (['notam1', 'notam2', 'notam3'] as const).map((id, k) => {
  const s = sections.find((x) => x.id === id)!;
  return { no: (k + 1) as 1 | 2 | 3, from: s.startLine - 1, to: s.endLine - 1 };
});
const n = parseNotams(lines, ranges)!;
const items = n.packages.flatMap((p) => p.locations.flatMap((l) => l.items));
const byId = (id: string) => items.find((i) => i.id === id)!;

describe('NOTAM 구간 표시', () => {
  it('공백이 여러 칸인 시작 줄을 찾고, END OF … 줄은 시작으로 잡지 않음', () => {
    for (const id of ['notam1', 'notam2', 'notam3'] as const) {
      const s = sections.find((x) => x.id === id)!;
      expect(lines[s.startLine - 1].text).toMatch(/^\s*NOTAM\s+PACKAGE/);
    }
  });
  it('항공사명이 앞에 붙은 시작 줄도 찾음', () => {
    const l = toDocLines('X\n            DEMO     AIR   NOTAM    PACKAGE 2\nY');
    expect(splitSections(l).sections.find((s) => s.id === 'notam2')?.startLine).toBe(2);
  });
});

describe('NOTAM 추출', () => {
  it('패키지별 건수 = 머리 줄 수, 끝 표시 확인', () => {
    expect(n.packages.map((p) => [p.no, p.counts.headLines, p.counts.parsed, p.endFound])).toEqual([
      [1, 4, 4, true],
      [2, 0, 0, true],
      [3, 2, 2, true],
    ]);
    expect(n.firOrder).toEqual(['ZZZA', 'ZZZB']);
  });

  it('공항 머리·역할·이름 (다음 줄로 넘어간 국가 코드 포함)', () => {
    const locs = n.packages.flatMap((p) => p.locations);
    expect(locs.map((l) => `${l.pkg}:${l.role}:${l.icao}`)).toEqual(['1:DEP:ZZAA', '1:DEST:ZZBB', '2:ETP:ZZDD', '2:ERA:ZZBB', '3:FIR:ZZZB']);
    expect(locs[1].name).toBe('Demo Arrival Airport, Demo City, ZZ');
    expect(locs[0].info.map((x) => x.text.trim())).toEqual(['1.  RUNWAY  :  15/33 : 12000FT  X 200FT']);
    expect(locs[2].noNotams).toBe(true);
    expect(locs[3].seeAlso).toBe(1);
  });

  it('NOTAM 머리 줄: 번호·위치·유효기간(UTC)·원문 줄 번호', () => {
    const a = byId('A0001/26');
    expect(a).toMatchObject({ kind: 'notam', loc: 'ZZAA', category: 'RUNWAY', from: '2026-11-05T10:00:00.000Z', to: '2026-11-05T14:00:00.000Z' });
    expect(lines[a.line - 1].text).toContain('A0001/26');
    expect(byId('A0002/26')).toMatchObject({ open: 'UFN', to: undefined, schedule: '01-05 1400-2100', text: 'ILS RWY 33 U/S' });
    expect(byId('A0005/26').open).toBe('PERM');
  });

  it('페이지 꼬리말을 건너 COMMENT)까지 같은 항목', () => {
    const a = byId('A0001/26');
    expect(a.text).toBe('RWY 15/33 CLSD');
    expect(a.comment).toBe('DEMO COMPANY COMMENT');
    expect(a.lines.map((l) => l.text)).not.toContain('===== PAGE 10 =====');
  });

  it('F)SFC G)UNL 한 줄 두 필드', () => {
    expect(byId('D0004/26')).toMatchObject({ lower: 'SFC', upper: 'UNL', text: 'TEMPO PROHIBITED AREA ACT' });
  });

  it('회사 권고와 제목 아래 자유 글도 버리지 않음', () => {
    expect(byId('COAD01/26')).toMatchObject({ kind: 'company', text: 'DEMO COMPANY NOTE\n-- BY DEMO --' });
    const t = items.find((i) => i.kind === 'text')!;
    expect(t).toMatchObject({ category: 'DEPARTURE AIRPORT TECHNICAL INFORMATION', text: 'DEMO FREE TEXT LINE ONE\nDEMO FREE TEXT LINE TWO' });
  });

  it('날짜 해석', () => {
    expect(notamTime('29FEB28', '23:59')).toBe('2028-02-29T23:59:00.000Z');
    expect(notamTime('31XYZ26', '00:00')).toBeUndefined();
  });
});

describe('NOTAM 분류·근거', () => {
  it('OFP 제목 → 그룹, 근거에 제목 줄 번호', () => {
    const c = classifyNotam(byId('A0001/26'));
    expect(c.group).toBe('runway');
    expect(c.reasons[0]).toMatchObject({ ref: 'ofp', line: byId('A0001/26').categoryLine });
    expect(c.reasons.some((r) => r.ref === 'doc8400Qcode')).toBe(true);
    expect(c.chips.map((k) => k.id)).toEqual(['clsd']);
    expect(c.runways).toEqual(['15/33']);
    expect(c.key).toBe(true);
  });
  it('회사 주석(COMMENT)의 낱말로는 칩을 만들지 않음', () => {
    const it2 = { ...byId('A0001/26'), text: 'RWY 15 LGT', comment: 'RWY CLSD' };
    expect(classifyNotam(it2).chips).toEqual([]);
  });
  it('공역 활성은 강조, 다른 그룹의 ACT는 강조 아님', () => {
    expect(classifyNotam(byId('D0004/26'))).toMatchObject({ group: 'airspace', key: true });
    const bird = { ...byId('B0003/26'), category: 'RUNWAY', text: 'AD AP BIRD ACT INCREASED' };
    const c = classifyNotam(bird);
    expect(c.chips.find((k) => k.id === 'act')?.strong).toBe(false);
    expect(c.key).toBe(false);
  });
  it('회사 권고는 회사 그룹 (당국 NOTAM 아님 표시)', () => {
    const c = classifyNotam(byId('COAD01/26'));
    expect(c.group).toBe('company');
    expect(c.reasons[0].ref).toBe('company');
  });
  it('모르는 제목은 기타 + 표시', () => {
    const c = classifyNotam({ ...byId('A0001/26'), category: 'NEW HEADING' });
    expect(c.group).toBe('other');
    expect(c.reasons[0].text).toContain('등록 안 된');
  });
});

describe('비행 관련성', () => {
  const o = {
    header: { takeoff: '2026-11-05T08:00:00.000Z', sta: '2026-11-05T18:00:00.000Z' },
    route: [
      { name: 'P1', eto: '2026-11-05T09:00:00.000Z', fir: undefined },
      { name: 'P2', eto: '2026-11-05T12:00:00.000Z', fir: 'ZZZB DEMO', srcLine: 77 },
      { name: 'P3', eto: '2026-11-05T13:00:00.000Z', fir: 'ADIZ -----' },
    ],
  } as unknown as OfpData;

  it('공항 = ETD~ETA 겹침 판단, UFN은 끝없음, D) 시간표는 해석 안 함', () => {
    const w = [flightWindow(o)];
    expect(timeStatus(byId('A0001/26'), w)).toBe('overlap');
    expect(timeStatus(byId('B0003/26'), w)).toBe('before');
    expect(timeStatus(byId('A0002/26'), w)).toBe('overlap');
    expect(timeStatus(byId('A0005/26'), w)).toBe('after');
    expect(timeStatus(items.find((i) => i.kind === 'text')!, w)).toBe('unknown');
  });

  it('FIR 통과 시간대: 출발 FIR = 이륙~첫 진입, ADIZ는 경계 아님', () => {
    const f = firWindows(o, n.firOrder);
    expect(f.get('ZZZA')![0]).toMatchObject({ from: Date.parse('2026-11-05T08:00:00Z'), to: Date.parse('2026-11-05T12:00:00Z') });
    expect(f.get('ZZZB')![0]).toMatchObject({ from: Date.parse('2026-11-05T12:00:00Z'), to: Date.parse('2026-11-05T18:00:00Z') });
    expect(f.has('ADIZ')).toBe(false);
    expect(timeStatus(byId('D0004/26'), f.get('ZZZB')!)).toBe('overlap');
  });
});
