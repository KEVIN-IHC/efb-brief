import { describe, expect, it } from 'vitest';
import { buildDemoOfp } from '../../mock/demoOfp';
import { safetyText, isOldGeneric, airportWx, wxValues, activeItems, autoValues, GENERIC_ITEMS, parseTemplate, paxText, planText, renderText, turbSentence, type JbItem } from './template';
import type { OfpData } from '../ofp/types';
import { opsPlan } from '../ofp/doc/OfpDocument';

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
    expect(renderText(it0, { choice: { 'x:0': 1 }, input: { 'x:1': 'APPLE' } }, { 편명: 'DEMO001' }, [])).toBe('DEMO001 나 APPLE [없는값?]');
    expect(renderText(it0, {}, { 편명: 'DEMO001' }, [], { 음어: 'BANANA' })).toBe('DEMO001 가 BANANA [없는값?]');
  });

  it('승객 예약 글', () => {
    expect(paxText('FIRST 0/0 BUSINESS 74/78 ECONOMY 344/417')).toBe('비즈니스 74분, 이코노미 344분, 총 418분');
    expect(paxText('FIRST 2/0 BUSINESS 409/408')).toBe('퍼스트 2분, 비즈니스 409분, 총 411분');
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

  it('기상 문장: 목적지 ETA±1h · 교체 · ERA', () => {
    const c = { wdir: 270, wspd: 12, wgst: null, visM: 9999, ceilFt: null, wx: '', rvr: [] };
    const ap = (icao: string, roles: string[], taf = true) =>
      ({ icao, roles, window: { from: Date.parse('2026-11-19T19:19:00Z'), to: Date.parse('2026-11-19T21:19:00Z'), basis: '' }, base: taf ? c : null, taf: taf ? { base: c, temp: null, basePeriods: [], tempPeriods: [], outside: false, raw: '', issueTime: '2026-11-19T17:00:00Z' } : undefined, runways: {}, closedRwys: [], impacts: [], restrictions: [], night: false, findings: [] }) as never;
    const b = { hasRules: false, airports: [ap('RKSI', ['DEST']), ap('RKSS', ['ALTN']), ap('KSFO', ['3% ERA'], false)], flight: [], findings: [] } as never;
    const v = wxValues(b);
    expect(v.목적지기상).toMatch(/^도착 예정 앞뒤 1시간 1919Z~2119Z 예보 바람 270\/12kt.*\(TAF 1700Z 발표\)입니다\.$/);
    expect(v.교체공항).toMatch(/^목적지에 내리지 못하면 RKSS\(으\)로 회항합니다\. RKSS 1919Z~2119Z 예보/);
    expect(v.ERA).toMatch(/^항로 교체공항\(ERA\)은 KSFO입니다\. KSFO 1919Z~2119Z 기상 자료 없음/);
    expect(airportWx(ap('RJBB', ['ALTN']), false)).toMatch(/^1919Z~2119Z/);
    expect(wxValues(null)).toEqual({});
  });

  it('예전 기본 틀만 저장된 목록은 새 틀로 (고친 문장이 있으면 그대로)', () => {
    const old: JbItem[] = [{ id: 'greet', title: '비행 개요', group: 'a', text: '{편명} {출발}→{도착}, 비행시간 {비행시간}, 순항고도 {순항고도}, 출발 {출발시각}, 도착 예정 {도착시각}. 연료 계획 {계획방식}.' }];
    expect(isOldGeneric(old)).toBe(true);
    expect(isOldGeneric([...old, { id: 'x', title: '내 문단', group: 'a', text: '직접 쓴 문장' }])).toBe(false);
    expect(isOldGeneric(GENERIC_ITEMS)).toBe(false);
    expect(isOldGeneric([...GENERIC_ITEMS].reverse())).toBe(false);
  });

  it('FOM 6.1.2.3 b) 항목이 기본 틀에 빠짐없이 (첫 비행·교체)', () => {
    const b = GENERIC_ITEMS.filter((x) => x.group === 'b').map((x) => x.title).join(' / ');
    for (const k of ['Cockpit Entry', 'Sterile', '안전 고려사항', 'Seat Belt', 'Turbulence', '비상 절차', '협조', '객실일지', '장비 결함']) expect(b).toContain(k);
  });

  it('안전 고려사항 요약', () => {
    const base = buildDemoOfp();
    const o = { ...base, header: { ...base.header, plan: { contPct: 3 }, edtoRule: 'EDTO 180' }, mel: [] } as OfpData;
    expect(safetyText(o)).toMatch(/^EDTO 180 비행, 3% Contingency 운항/);
    const none = { ...base, header: { ...base.header, plan: undefined, edtoRule: undefined }, mel: [], route: [] } as unknown as OfpData;
    expect(safetyText(none)).toBe('OFP상 특별한 사항 없음');
  });

  it('D-086 기본 틀 그대로 저장한 목록도 새 틀로', () => {
    const d086: JbItem[] = [
      { id: 'pax', title: '승객', group: 'a', text: '예약 승객은 {승객}입니다. 특별 승객은 [없습니다|있습니다]. <특별 승객 메모>' },
      { id: 'wx', title: '기상', group: 'a', text: '목적지 {도착도시} 날씨는 [양호합니다|다소 좋지 않습니다|확인 중입니다]. {목적지기상} {난류}' },
    ];
    expect(isOldGeneric(d086)).toBe(true);
  });

  it('OFP OPS PLAN 칸: EDTO · REFILE · CONT', () => {
    const base = buildDemoOfp();
    const mk = (plan: OfpData['header']['plan'], edtoRule?: string) => ({ ...base, header: { ...base.header, plan, edtoRule } }) as OfpData;
    expect(opsPlan(mk({ contPct: 5, refile: ['RJBB', 'RJGG'] }))).toBe('REFILE · 5% CONT');
    expect(opsPlan(mk({ contPct: 3, era3: ['KSFO'] }))).toBe('3% CONT');
    expect(opsPlan(mk({ contPct: 5, refile: ['YBBN'], edto: true }, 'EDTO 180'))).toBe('EDTO 180 · REFILE · 5% CONT');
    expect(opsPlan(mk(undefined))).toBe('—');
  });
});

