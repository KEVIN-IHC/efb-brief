import { describe, expect, it } from 'vitest';
import { extractSd, kindOf } from './sdGuide';

describe('SD 페이지 가이드 문장 뽑기 (D-096)', () => {
  const pages = [
    { seq: 1, code: 'DSC-29-20', text: '###### **SYSTEM PRESSURE**\nHydraulic pressure is above 2 900 PSI. Hydraulic pressure is below 2 900 PSI.\nGREEN 4A ELEC AP VeiLO 3@ 12 %\nIdent.: DSC-29-20-0001 / 22 MAY 07' },
    { seq: 2, code: 'DSC-24-20', text: '###### **GENERATOR LOAD**\nThe load is normal, when it is less than 108 %.\nThe load is greater than 108 % for more than 10 s.' },
    { seq: 3, code: 'DSC-70-20', text: '###### **EGT RED LINE**\nA red arc appears above the EGT red line. The EGT red line is at 900 °C.' },
  ];
  it('그 SD 페이지 절의 숫자 조건 문장만, 문장 단위로', () => {
    const h = extractSd(pages, 'HYD');
    expect(h).toHaveLength(1);
    expect(h[0].lines.map((l) => l.text)).toEqual(['Hydraulic pressure is above 2 900 PSI.', 'Hydraulic pressure is below 2 900 PSI.']);
    expect(extractSd(pages, 'ELEC')[0].lines.map((l) => l.kind)).toEqual(['normal', 'cond']);
    expect(extractSd(pages, 'ENG')[0].lines[0].kind).toBe('red');
  });
  it('abnormal은 정상으로 보지 않음', () => {
    expect(kindOf('The engine generator voltage is abnormal at 90 V.')).toBe('cond');
  });
});

describe('SD 가이드 블록 구분', () => {
  it('첫 문장을 부제로, 같은 내용은 하나만', () => {
    const p = [
      { seq: 1, code: 'DSC-24-20', text: '###### **GENERATOR LOAD**\nThe APU generator load is normal.\nThe load is normal, when it is less than 108 %.' },
      { seq: 2, code: 'DSC-24-20', text: '###### **GENERATOR LOAD**\nThe engine generator load is normal.\nThe load is normal, when it is less than 108 %.' },
      { seq: 3, code: 'DSC-24-20', text: '###### **GENERATOR LOAD**\nThe engine generator load is normal.\nThe load is normal, when it is less than 108 %.' },
    ];
    expect(extractSd(p, 'ELEC').map((b) => b.sub)).toEqual(['The APU generator load is normal.', 'The engine generator load is normal.']);
  });
});
