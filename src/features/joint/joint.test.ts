import { describe, expect, it } from 'vitest';
import { buildDemoOfp } from '../../mock/demoOfp';
import { activeItems, autoValues, GENERIC_ITEMS, parseTemplate, paxText, planText, renderText, turbSentence, type JbItem } from './template';
import type { OfpData } from '../ofp/types';

describe('합동 브리핑 원고 틀', () => {
  it('자동·선택·입력 조각으로 나눔 (번호는 선택·입력 순서)', () => {
    const segs = parseTemplate('편명 {편명}, 등급 [A|B|C], 음어 <음어>. 끝');
    expect(segs).toEqual([
      { t: 'text', v: '편명 ' },
      { t: 'auto', key: '편명' },
      { t: 'text', v: ', 등급 ' },
      { t: 'choice', n: 0, opts: ['A', 'B', 'C'] },
      { t: 'text', v: ', 음어 ' },
      { t: 'input', n: 1, label: '음어' },
      { t: 'text', v: '. 끝' },
    ]);
  });

  it('[ ] 안에 | 가 없으면 그냥 글', () => {
    expect(parseTemplate('[참고]')).toEqual([{ t: 'text', v: '[참고]' }]);
  });

  it('원고 글: 고른 값·쓴 값·마지막 값·빠진 자동 값', () => {
    const it0: JbItem = { id: 'x', title: 't', group: 'a', text: '{편명} [가|나] <음어> {없는값}' };
    expect(renderText(it0, { choice: { 'x:0': 1 }, input: { 'x:1': 'APPLE' } }, { 편명: 'AAR602' }, [])).toBe('AAR602 나 APPLE [없는값?]');
    expect(renderText(it0, {}, { 편명: 'AAR602' }, [], { 음어: 'BANANA' })).toBe('AAR602 가 BANANA [없는값?]');
  });

  it('승객 예약 글', () => {
    expect(paxText('FIRST 0/0 BUSINESS 74/78 ECONOMY 344/417')).toBe('비즈니스 74/78, 이코노미 344/417, 총 418명');
    expect(paxText(undefined)).toBeUndefined();
  });

  it('계획 방식 글', () => {
    const base = buildDemoOfp();
    const mk = (plan: OfpData['header']['plan'], edtoRule?: string) => ({ ...base, header: { ...base.header, plan, edtoRule } }) as OfpData;
    expect(planText(mk({ contPct: 3, era3: ['KSFO'] }))).toBe('3% Contingency(3% ERA KSFO)');
    expect(planText(mk({ contPct: 5, refile: ['RJAA', 'RJBB'] }))).toBe('5% Contingency · REFILE(RJAA·RJBB)');
    expect(planText(mk({ contPct: 5, refile: ['YBBN'], edto: true }, 'EDTO 180'))).toBe('5% Contingency · REFILE(YBBN) · EDTO 180');
  });

  it('난류 문장: 구간 없음 / 구간별 정도', () => {
    expect(turbSentence([], {})).toBe('OFP상 예상 난류 구간은 없습니다.');
    expect(turbSentence([{ i: 0, text: 'A' }, { i: 1, text: 'B' }], { turb: { 1: 1 } })).toBe('난류는 A 약한(Light) 정도, B 보통(Moderate) 정도 예상됩니다.');
  });

  it('b) 문단은 첫 비행·교체일 때만, 뺀 문단은 빠짐', () => {
    const all = activeItems(GENERIC_ITEMS, {});
    expect(all.some((x) => x.group === 'b')).toBe(true);
    expect(activeItems(GENERIC_ITEMS, { firstFlight: false }).every((x) => x.group === 'a')).toBe(true);
    expect(activeItems(GENERIC_ITEMS, { off: { security: true } }).find((x) => x.id === 'security')).toBeUndefined();
  });

  it('데모 OFP 자동 값', () => {
    const v = autoValues(buildDemoOfp());
    expect(v.편명).toBeTruthy();
    expect(v.비행시간).toMatch(/시간|분/);
    expect(v.계획방식).toBeTruthy();
  });
});
