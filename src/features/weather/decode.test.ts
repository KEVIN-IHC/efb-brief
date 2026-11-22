import { describe, expect, it } from 'vitest';

import { rawLines } from './decode';
describe('원문 줄바꿈', () => {
  it('TAF는 FM·BECMG·TEMPO·PROB 앞에서 새 줄, PROB30 TEMPO는 한 줄', () => {
    const t = 'TAF RKSI 211700Z 2118/2224 32010KT 9999 FEW030 BECMG 2203/2205 27008KT PROB30 TEMPO 2210/2214 4000 BR FM221800 VRB03KT CAVOK';
    expect(rawLines(t, 'taf').split('\n').map((l) => l.trim())).toEqual([
      'TAF RKSI 211700Z 2118/2224 32010KT 9999 FEW030',
      'BECMG 2203/2205 27008KT',
      'PROB30 TEMPO 2210/2214 4000 BR',
      'FM221800 VRB03KT CAVOK',
    ]);
  });
  it('METAR는 추세·RMK 앞에서 새 줄', () => {
    expect(rawLines('METAR RJAA 211800Z 34005KT 9999 FEW020 08/03 Q1021 NOSIG RMK 1CU020', 'metar').split('\n').length).toBe(3);
  });
});
