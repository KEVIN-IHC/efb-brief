import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { agtowCalc } from './agtow';
import { parseAviatorOfp } from './parser';
import type { OfpData } from './types';

const fake = (mtow: number): OfpData =>
  ({
    unit: 'lbs',
    weights: {
      zfw: { planned: 700, limit: 800 },
      tow: { planned: 1000, limit: mtow },
      lw: { planned: 760, limit: 860 },
      payload: 90,
      extraLimits: [
        { label: 'RWY', value: 1300 },
        { label: 'TCAP', value: 1300 },
        { label: 'SOW', value: 610 },
      ],
    },
  }) as unknown as OfpData;

describe('AGTOW 풀이 (D-068)', () => {
  it('MZFW + TOF가 가장 작으면 그 값', () => {
    const c = agtowCalc(fake(1300))!;
    // TOF = 300, TIF = 240 → MZFW+TOF 1100, MLDW+TIF 1100 → 둘 다 제한
    expect(c.agtow).toBe(1100);
    expect(c.terms.filter((t) => t.limiting).map((t) => t.label)).toEqual(['MZFW + TOF', 'MLDW + TIF']);
    expect(c.acl).toBe(1100 - 610 - 300);
    expect(c.spare).toBe(c.acl! - 90);
  });
  it('MTOW가 가장 작으면 MTOW', () => {
    expect(agtowCalc(fake(1050))!.agtow).toBe(1050);
  });
});

const DIR = join(process.cwd(), 'private/samples');
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^ofp-.*\.txt$/.test(f)) : [];
describe.skipIf(!files.length)('실제 OFP 샘플 (private)', () => {
  it.each(files)('%s: 다시 계산한 AGTOW·ACL = OFP 값', (f) => {
    const c = agtowCalc(parseAviatorOfp(readFileSync(join(DIR, f), 'utf8')).ofp!)!;
    expect(c.ofpAgtow).toBe(c.agtow);
    expect(c.ofpAcl).toBe(c.acl);
    expect(c.ok).toBe(true);
  });
});
