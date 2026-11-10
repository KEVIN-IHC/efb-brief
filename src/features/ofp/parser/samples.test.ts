// 실제 OFP 샘플 검증 — private/samples/*.txt 가 있을 때만 실행 (샘플은 커밋 금지라 CI에선 건너뜀)
// 텍스트 생성: npx vite-node tools/extract-ofp.ts private/samples/*.pdf
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAviatorOfp } from './index';

const DIR = join(process.cwd(), 'private/samples');
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.txt')) : [];

describe.skipIf(files.length === 0)('Aviator 실제 샘플', () => {
  for (const f of files) {
    it(f, () => {
      const r = parseAviatorOfp(readFileSync(join(DIR, f), 'utf8'));
      const failedChecks = r.checks.filter((c) => c.status === 'fail').map((c) => `${c.label}: ${c.detail}`);
      const failedEx = r.extractors.filter((e) => e.status === 'failed' || e.status === 'partial').map((e) => `${e.id}: ${e.message}`);
      expect(failedChecks, '교차검증 실패').toEqual([]);
      expect(failedEx, '추출 실패').toEqual([]);
      const o = r.ofp!;
      expect(o, '조립 실패').toBeDefined();
      expect(o.route.length).toBeGreaterThan(20);
      expect(o.header.reg).toMatch(/^HL\d{4}$/);
      expect(o.weights.zfw.planned).toBeLessThan(o.weights.zfw.limit);
      expect(o.weights.tow.planned).toBeLessThanOrEqual(o.weights.tow.limit);
      expect(o.alternates.length).toBeGreaterThan(0);
      expect(Number.isFinite(o.header.costIndex)).toBe(true);
      // 좌표·바람이 말이 되는지
      for (const w of o.route) {
        expect(Math.abs(w.lat)).toBeLessThanOrEqual(90);
        expect(Math.abs(w.lon)).toBeLessThanOrEqual(180);
        if (w.windDir != null) {
          expect(w.windDir).toBeGreaterThanOrEqual(0);
          expect(w.windDir).toBeLessThanOrEqual(360);
          expect(w.windSpd!).toBeLessThan(300);
          // 성분(구간 평균)은 지점 풍속과 크게 다를 수 없음 — 원문 예: 23008M010 (풍속 8, 성분 −10)
          expect(Math.abs(w.windComp!)).toBeLessThanOrEqual(w.windSpd! + 20);
        }
      }
      const cruise = o.route.filter((w) => w.fl > 0);
      expect(cruise.filter((w) => w.windDir != null).length / cruise.length, '순항 구간 바람 대부분 존재').toBeGreaterThan(0.8);
    });
  }
});

// 원문과 한 줄씩 대조한 고정값 — 회사 OFP에서 나온 값이라 기대값은 private/samples/ofp-01.expect.json 에만 둔다 (공개 저장소 보호)
describe.skipIf(!files.includes('ofp-01.txt') || !existsSync(join(DIR, 'ofp-01.expect.json')))('ofp-01 원문 대조', () => {
  it('지정 행 고정값', () => {
    const o = parseAviatorOfp(readFileSync(join(DIR, 'ofp-01.txt'), 'utf8')).ofp!;
    const e = JSON.parse(readFileSync(join(DIR, 'ofp-01.expect.json'), 'utf8'));
    const w = o.route.find((x) => x.name === e.samon.name)!;
    expect(w).toMatchObject(e.samon.match);
    expect(w.lat).toBeCloseTo(e.samon.lat, 6);
    expect(w.lon).toBeCloseTo(e.samon.lon, 6);
    expect(o.route.find((x) => x.name === e.fir.name)!.fir).toBe(e.fir.fir);
  });
});

describe.skipIf(!files.includes('ofp-01.txt') || !existsSync(join(DIR, 'ofp-01.expect.json')))('ofp-01 CRZ WIND 원문 대조', () => {
  it('지정 지점 FL별 값 + 페이지에 걸친 블록', () => {
    const o = parseAviatorOfp(readFileSync(join(DIR, 'ofp-01.txt'), 'utf8')).ofp!;
    const c = JSON.parse(readFileSync(join(DIR, 'ofp-01.expect.json'), 'utf8')).crz;
    const p = o.crzWind!.points.find((x) => x.name === c.point)!;
    for (const [fl, v] of Object.entries(c.byFl)) expect(p.byFl[Number(fl)]).toEqual(v);
    expect(o.crzWind!.isa[370]).toBe(c.isa370);
    expect(o.crzWind!.points.find((x) => x.name === c.split.point)!.byFl[Number(c.split.fl)]).toEqual(c.split.v);
  });
});

// NOTAM (Phase 4): 패키지별 건수와 지정 항목을 원문과 대조. 기대값은 private/samples/notam.expect.json (회사 자료)
const NOTAM_EXP = join(DIR, 'notam.expect.json');
describe.skipIf(files.length === 0 || !existsSync(NOTAM_EXP))('NOTAM 원문 대조', () => {
  const exp = existsSync(NOTAM_EXP) ? JSON.parse(readFileSync(NOTAM_EXP, 'utf8')) : { counts: {} };
  for (const f of files) {
    it(`${f} 패키지별 건수·원문 위치`, async () => {
      const text = readFileSync(join(DIR, f), 'utf8');
      const src = text.split('\n');
      const n = parseAviatorOfp(text).ofp!.notams!;
      expect(n.packages.map((p) => p.counts.parsed), '패키지별 건수').toEqual(exp.counts[f]);
      for (const p of n.packages) {
        expect(p.endFound).toBe(true);
        expect(p.counts.headLines).toBe(p.counts.parsed);
        let prev = p.startLine;
        for (const l of p.locations) {
          expect(src[l.line - 1]).toContain(`${l.icao}/`);
          for (const it of l.items) {
            // 머리 줄 = 원문의 그 줄, 줄 번호는 앞으로만 진행 (겹침·역순 없음)
            if (it.id) expect(src[it.line - 1].replace(/\s+/g, ' ')).toContain(it.id);
            expect(it.line).toBeGreaterThan(prev);
            for (const s of it.lines) expect(src[s.n - 1].replace(/\s+$/, '')).toBe(s.text);
            prev = it.lines[it.lines.length - 1].n;
            expect(prev).toBeLessThan(p.endLine);
          }
        }
      }
    });
  }

  it.skipIf(!files.includes('ofp-01.txt'))('ofp-01 지정 NOTAM', async () => {
    const { classifyNotam } = await import('../../notam/classify');
    const n = parseAviatorOfp(readFileSync(join(DIR, 'ofp-01.txt'), 'utf8')).ofp!.notams!;
    const e = exp.ofp01;
    expect(n.firOrder).toEqual(e.firOrder);
    const locs = n.packages.flatMap((p) => p.locations);
    for (const x of e.items) {
      const loc = locs.find((l) => l.pkg === x.pkg && l.role === x.role && l.icao === x.icao)!;
      expect(loc, `${x.id} 공항`).toBeDefined();
      const it = loc.items.find((i) => i.id === x.id)!;
      expect(it, x.id).toBeDefined();
      expect(it.line).toBe(x.line);
      expect(it.kind).toBe(x.kind);
      for (const k of ['loc', 'category', 'from', 'to', 'open', 'lower', 'upper'] as const) if (x[k] !== undefined) expect(it[k], `${x.id}.${k}`).toBe(x[k]);
      if (x.textStart) expect(it.text.startsWith(x.textStart)).toBe(true);
      if (x.commentStart) expect(it.comment?.startsWith(x.commentStart)).toBe(true);
      const c = classifyNotam(it);
      expect(c.group, `${x.id} 그룹`).toBe(x.group);
      if (x.chips) expect(c.chips.map((k) => k.id), `${x.id} 칩`).toEqual(x.chips);
      if (x.runways) expect(c.runways).toEqual(x.runways);
      if (x.key !== undefined) expect(c.key).toBe(x.key);
    }
    const t = locs.find((l) => l.pkg === e.textItem.pkg && l.icao === e.textItem.icao)!.items.find((i) => i.kind === 'text')!;
    expect(t.category).toBe(e.textItem.category);
    expect(t.line).toBe(e.textItem.line);
  });
});
