// 항로·OFP 번호 일치 확인 (D-067). 가상 예시 + private 실제 샘플(있을 때만)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAviatorOfp } from './index';
import { checkRouteConsistency, routeKey } from './routeCheck';
import { toDocLines } from './lines';

describe('항로 비교 열 만들기', () => {
  it('CFP 요약(..)과 FPL(DCT·속도고도·좌표 표기)을 같은 열로', () => {
    const cfp = routeKey('AAAA..ALFAA H111 BRAVO Q222 CHRLY..N07E142..N14E140..DELTA G333 ECHOO..BBBB', 'AAAA', 'BBBB');
    const fpl = routeKey('DCT ALFAA H111 FOXXX/N0480F340 H111 BRAVO Q222 CHRLY DCT 07N142E 14N140E/N0480F360 DCT DELTA G333 GOLFF/N0480F380 G333 ECHOO DCT', 'AAAA', 'BBBB');
    expect(fpl).toEqual(cfp);
    expect(cfp).toEqual(['ALFAA', 'H111', 'BRAVO', 'Q222', 'CHRLY', '07N142E', '14N140E', 'DELTA', 'G333', 'ECHOO']);
  });
  it('끝의 STAR·SID는 비교에서 뺌', () => {
    expect(routeKey('AAAA..EGOBA Y697 LANAT..BURGL IRNMN2 BBBB', 'AAAA', 'BBBB')).toEqual(['EGOBA', 'Y697', 'LANAT', 'BURGL']);
  });
});

const fake = (route2: string, plan2 = '0042') =>
  [
    'CFP PLAN 0042',
    '2ND-$    280 2738 10.04',
    'AAAA..ALFAA H111 BRAVO Q222 CHRLY..BBBB',
    'DIST  LATITUDE  MC  FL',
    '(FPL-XYZ1-IS',
    '-A388/J-S/LB1',
    '-AAAA1055',
    '-N0470F300 DCT ALFAA H111 BRAVO Q222 CHRLY DCT',
    '-BBBB0924 CCCC',
    '-DOF/261023)',
    '(FPL-XYZ1-IS',
    '-A388/J-S/LB1',
    '-AAAA1055',
    `-N0470F300 ${route2}`,
    '-BBBB0924 CCCC',
    '-DOF/261023)',
    '* COPY OF ATS FPL, SUBMITTED AT 0741Z 23OCT *',
    `AS PLAN # ${plan2} UNDER THE FOLLOWING CONDITION.`,
    'REQUEST NO.    42',
  ].join('\n');

describe('일치 확인', () => {
  const nav = ['ALFAA', 'X1', 'BRAVO', 'CHRLY', 'BBBB'];
  it('모두 같으면 통과', () => {
    const r = checkRouteConsistency(toDocLines(fake('DCT ALFAA H111 BRAVO Q222 CHRLY DCT')), nav, 'AAAA', 'BBBB');
    expect(r.route.ok).toBe(true);
    expect(r.route.sources.map((s) => s.where)).toEqual(['CFP 요약 항로', 'OFP FPL (1)', '제출된 ATS FPL 사본', 'NAV LOG 지점 순서']);
    expect(r.planNo.ok).toBe(true); // 0042 = 42
  });
  it('제출 FPL 항로가 다르면 다른 곳 표시', () => {
    const r = checkRouteConsistency(toDocLines(fake('DCT ALFAA H111 BRAVO Q229 CHRLY DCT')), nav, 'AAAA', 'BBBB');
    expect(r.route.ok).toBe(false);
    expect(r.route.sources.find((s) => !s.ok)?.diff).toContain('Q222');
  });
  it('OFP 번호가 다르면 실패', () => {
    const r = checkRouteConsistency(toDocLines(fake('DCT ALFAA H111 BRAVO Q222 CHRLY DCT', '0043')), nav, 'AAAA', 'BBBB');
    expect(r.planNo.ok).toBe(false);
  });
  it('NAV LOG에 지점이 빠지면 실패', () => {
    const r = checkRouteConsistency(toDocLines(fake('DCT ALFAA H111 BRAVO Q222 CHRLY DCT')), ['ALFAA', 'CHRLY'], 'AAAA', 'BBBB');
    expect(r.route.sources.at(-1)).toMatchObject({ ok: false });
  });
});

const DIR = join(process.cwd(), 'private/samples');
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^ofp-.*\.txt$/.test(f)) : [];
describe.skipIf(!files.length)('실제 OFP 샘플 (private)', () => {
  it.each(files)('%s: 항로 4곳 이상·OFP 번호 3곳 이상 모두 같음', (f) => {
    const text = readFileSync(join(DIR, f), 'utf8');
    const rc = parseAviatorOfp(text).ofp!.routeCheck!;
    expect(rc.route.ok).toBe(true);
    expect(rc.route.sources.length).toBeGreaterThanOrEqual(4);
    expect(rc.route.sources.some((s) => s.where === '제출된 ATS FPL 사본')).toBe(true);
    expect(rc.planNo.ok).toBe(true);
    expect(rc.planNo.sources.length).toBeGreaterThanOrEqual(3);
    // 일부러 제출 FPL 항로 하나를 바꾸면 잡아내야 함
    const i = text.indexOf('* COPY OF ATS FPL');
    const head = text.slice(0, i);
    const k = head.lastIndexOf('(FPL-');
    const block = head.slice(k);
    const m = / ([A-Z]\d{1,3}) /.exec(block.slice(block.indexOf('\n-N') > 0 ? block.indexOf('\n-N') : 0));
    expect(m).toBeTruthy();
    const broken = text.slice(0, k) + block.replace(` ${m![1]} `, ` ${m![1]}X `) + text.slice(i);
    expect(parseAviatorOfp(broken).ofp!.routeCheck!.route.ok).toBe(false);
  });
});
