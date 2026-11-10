import { describe, expect, it } from 'vitest';
import { compareFpl, cutFplBlock, parseFpl, parseItem18 } from './fpl';
import { parseAviatorOfp } from './index';
import { toDocLines } from './lines';
import { splitSections } from './sections';

// ⚠ 가짜 데이터. 섹션 표시만 Aviator 구조를 흉내 냄 (실제 회사 OFP 아님)
const FPL = [
  '(FPL-DMO001-IS',
  '-B77W/H-SDE2E3FGHIJ2J3J4J5M1RWXYZ/LB1D1',
  '-RKSI1100',
  '-N0490F330 DCT DM01 DCT DM02 DCT DM03 DCT DM04',
  ' DCT DM05 DCT',
  '-KLAX1015 KONT KSAN',
  '-PBN/A1B1C1D1L1O1S2 DOF/261105 REG/HL0000 EET/RJJJ0120',
  ' PAZA0410 RMK/TCAS-II EQUIPPED DEMO)',
];

const FAKE = [
  '===== PAGE 1 =====',
  'COVER PAGE DEMO',
  '===== PAGE 2 =====',
  'DEMO AIRLINES OPERATIONAL FLIGHT PLAN DMO001',
  'FUEL  TRIP 93800',
  'DM01  FL290  1201Z',
  'DM02  FL330  1243Z',
  'ROUTE TO ALTN',
  'KLAX KONT 49NM',
  '===== PAGE 3 =====',
  ...FPL,
  '===== PAGE 4 =====',
  'REFILE FLT PLAN',
  'DM03 RJTT 00+14',
  'END OF JEPPESEN DATAPLAN',
  '===== PAGE 5 =====',
  'ATS FLIGHT PLAN COPY',
  ...FPL,
  '===== PAGE 6 =====',
  'NOTAM PACKAGE 1',
  'RKSI A1234/26 RWY 15L CLSD',
  '===== PAGE 7 =====',
  'DEMO AIRLINES OPERATIONAL FLIGHT PLAN DMO001',
  'FUEL  TRIP 93800',
  'DM01  FL290  1201Z',
].join('\n');

describe('ICAO FPL', () => {
  it('Item 18은 정해진 지시자만 키로 인식 (RMK 안의 - 와 공백 유지)', () => {
    expect(parseItem18('PBN/A1B1 DOF/261105 REG/HL0000 RMK/TCAS-II EQUIPPED X/Y')).toEqual({
      PBN: 'A1B1',
      DOF: '261105',
      REG: 'HL0000',
      RMK: 'TCAS-II EQUIPPED X/Y',
    });
  });

  it('여러 줄 FPL 해석', () => {
    const f = parseFpl(FPL.join('\n'))!;
    expect(f).toMatchObject({
      acid: 'DMO001', flightRules: 'I', flightType: 'S', acType: 'B77W', wake: 'H',
      dep: 'RKSI', eobt: '1100', speed: 'N0490', level: 'F330',
      dest: 'KLAX', eet: '1015', altns: ['KONT', 'KSAN'],
    });
    expect(f.route).toBe('DCT DM01 DCT DM02 DCT DM03 DCT DM04 DCT DM05 DCT');
    expect(f.item18.EET).toBe('RJJJ0120 PAZA0410');
    expect(f.item18.RMK).toBe('TCAS-II EQUIPPED DEMO');
  });

  it('형식이 깨지면 null', () => {
    expect(parseFpl('(FPL-ABC)')).toBeNull();
    expect(parseFpl('no fpl here')).toBeNull();
  });

  it('괄호 짝으로 블록 자르기', () => {
    const lines = toDocLines(['xx', ...FPL, 'after'].join('\n'));
    const b = cutFplBlock(lines)!;
    expect(b.lines).toHaveLength(FPL.length);
    expect(b.text.endsWith('DEMO)')).toBe(true);
  });

  it('두 FPL 비교', () => {
    const a = parseFpl(FPL.join('\n'))!;
    expect(compareFpl(a, a)).toEqual([]);
    expect(compareFpl(a, { ...a, level: 'F350' })).toEqual(['속도/고도: N0490F330 ≠ N0490F350']);
  });
});

describe('구간 나누기', () => {
  const { sections, missing } = splitSections(toDocLines(FAKE));
  const byId = (id: string) => sections.filter((s) => s.id === id);

  it('메인 CFP는 ROUTE TO ALTN 직전에서 끝남', () => {
    const cfp = byId('cfp')[0];
    expect(cfp.startLine).toBe(2);
    expect(cfp.endLine).toBe(7); // "DM02 FL330" 줄
  });
  it('FPL 블록 2개 모두 찾음', () => {
    expect(byId('fpl')).toHaveLength(2);
  });
  it('후반부 CFP 복사본은 제외 표시', () => {
    const copy = byId('cfpCopy')[0];
    expect(copy.ignored).toBe(true);
    expect(copy.page).toBe(7);
  });
  it('없는 구간은 missing 으로 보고', () => {
    expect(missing.map((m) => m.id)).toEqual(expect.arrayContaining(['etp', 'windSummary', 'notam2', 'notam3']));
  });
});

describe('parseAviatorOfp', () => {
  const r = parseAviatorOfp(FAKE);

  it('FPL에서 헤더 값 추출 + 원문 줄 번호 기록', () => {
    expect(r.data.header).toMatchObject({ flightNo: 'DMO001', acType: 'B77W', dep: 'RKSI', arr: 'KLAX', cruiseFl: 330, reg: 'HL0000', date: '2026-11-05' });
    expect(r.data.alternates).toEqual(['KONT', 'KSAN']);
    const fpl = r.extractors.find((e) => e.id === 'fpl')!;
    expect(fpl.status).toBe('ok');
    const dof = fpl.fields.find((f) => f.path === 'fpl.dof')!;
    expect(r.lineCount).toBeGreaterThan(dof.line);
    expect(FAKE.split('\n')[dof.line - 1]).toContain('DOF/261105');
  });

  it('형식이 안 맞으면 failed, 구간이 없으면 missing, 일부만 있으면 partial (조용히 빠지지 않음)', () => {
    const st = Object.fromEntries(r.extractors.map((e) => [e.id, e.status]));
    expect(st.fuel).toBe('failed');
    expect(st.etp).toBe('missing');
    expect(st.wind).toBe('missing');
    expect(st.notam).toBe('partial'); // 패키지 1만 있음 → 부분 추출로 드러남
    expect(r.ofp).toBeUndefined(); // 불완전하면 조립하지 않음
  });

  it('교차검증', () => {
    const c = Object.fromEntries(r.checks.map((x) => [x.id, x.status]));
    expect(c).toMatchObject({ cfpEnd: 'pass', cfpCopy: 'pass', fplMatch: 'pass' });
  });

  it('빈 문서도 오류 없이 처리', () => {
    const e = parseAviatorOfp('');
    expect(e.extractors.find((x) => x.id === 'fpl')!.status).toBe('missing');
    expect(e.checks.find((x) => x.id === 'cfpEnd')!.status).toBe('fail');
  });
});
