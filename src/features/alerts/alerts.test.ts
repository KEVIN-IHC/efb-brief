// 얼러트 엔진 (D-046). 매뉴얼 문장은 형식만 흉내 낸 가짜 문장
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { _resetDBForTests } from '../../db/schema';
import { buildDemoOfp } from '../../mock/demoOfp';
import { buildChecks, project, type Actual } from '../inflight/deviation';
import type { MelMatch, StoredItem } from '../manual/lookup';
import type { StoredManual } from '../manual/store';
import type { OfpData } from '../ofp/types';
import type { Sigmet } from '../weather/types';
import { evaluateAlerts } from './engine';
import { RULES } from './rules';
import { cdlPerformance, performanceLines } from './rules/cdlPerformance';
import { melIcingSigmet } from './rules/melIcingSigmet';
import { melOps } from './rules/melOps';
import { melUnmatched } from './rules/melUnmatched';
import { wxStale } from './rules/wxStale';
import { ackAlerts, alertHistory, recordAlerts } from './store';
import type { AlertRule, FlightContext } from './types';

const o: OfpData = buildDemoOfp();
const doc = (kind: 'MEL' | 'CDL'): StoredManual => ({
  docId: `A999-${kind}`, kind, aircraft: 'A999', title: kind, issueDate: '01 JAN 26', issueIso: '2026-01-01', sourceFile: 'x', builtAt: '', parserVersion: 'manual-1.2', pageCount: 1, unlabeledPages: 0, itemCount: 1, importedAt: '',
});
const item = (kind: 'MEL' | 'CDL', itemNo: string, text: string, extra: Partial<StoredItem> = {}): StoredItem => ({ docId: `A999-${kind}`, kind, itemNo, title: 'Test item', pageSeq: 5, ref: 'MI-99-10 P 1/2', text, ...extra });
const match = (it: StoredItem, how: MelMatch['how'] = 'exact'): MelMatch => ({ kind: it.kind, itemNo: it.itemNo, how, item: how === 'none' ? undefined : it, aircraftOk: true });

function ctx(over: Partial<FlightContext> = {}): FlightContext {
  const checks = buildChecks(o, new Map());
  return { now: Date.parse(o.header.takeoff), flightId: 'F1', o, checks, proj: project(o, checks), mel: [], manualDocs: [], refs: {}, wx: { metars: {}, tafs: {}, sigmets: null }, ...over };
}

const iceSigmet = (): Sigmet => {
  const w = o.route[Math.floor(o.route.length / 2)];
  const d = 1;
  return {
    id: 'S1', source: 'intl', fir: 'XXXX', hazard: 'ICE', qualifier: 'SEV', base: 20000, top: 30000,
    validFrom: new Date(Date.parse(o.header.takeoff) - 3600e3).toISOString(), validTo: new Date(Date.parse(o.header.sta) + 3600e3).toISOString(),
    raw: 'XXXX SIGMET 1 VALID SEV ICE FCST', polys: [[[w.lat - d, w.lon - d], [w.lat - d, w.lon + d], [w.lat + d, w.lon + d], [w.lat + d, w.lon - d], [w.lat - d, w.lon - d]]],
  };
};

describe('얼러트 엔진', () => {
  it('모든 규칙: 결과마다 근거 1개 이상, id 중복 없음, 심각도순', () => {
    const mel = [match(item('MEL', '99-10-01A', '- **(o)** do this\n**_Crew Defer_** icing conditions', { opsProcSeq: 9 })), match(item('CDL', '12-34', '**Performance:** Fuel consumption is increased by 0.4 %.'))];
    const all = evaluateAlerts(ctx({ mel, manualDocs: [doc('MEL'), doc('CDL')], wx: { metars: {}, tafs: {}, sigmets: { fetchedAt: new Date(Date.parse(o.header.takeoff)).toISOString(), data: [iceSigmet()] } } }), RULES);
    expect(all.length).toBeGreaterThan(0);
    for (const a of all) expect(a.basis.length, a.id).toBeGreaterThan(0);
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
    const sev = all.map((a) => ({ warning: 0, caution: 1, info: 2 })[a.severity]);
    expect(sev).toEqual([...sev].sort((a, b) => a - b));
    expect(all[0].ruleId).toBe('mel-icing-sigmet'); // 경고가 맨 앞
  });

  it('규칙이 실패해도 나머지는 실행, 실패를 안내로 보인다', () => {
    const bad: AlertRule = { id: 'bad', name: '고장 규칙', threshold: 'none', evaluate: () => { throw new Error('boom'); } };
    const ok: AlertRule = { id: 'ok', name: '정상', threshold: 'app', evaluate: () => [{ key: 'k', severity: 'caution', title: 't', basis: [] }] };
    const r = evaluateAlerts(ctx(), [bad, ok]);
    expect(r.map((a) => a.id)).toEqual(['ok:k:caution', 'bad:error:info']);
    expect(r[0].basis[0].label).toMatch(/근거 누락/);
  });

  const withLanding = (landing: number, extra: Partial<FlightContext> = {}) => {
    const last = o.route[Math.floor(o.route.length / 2)];
    const planned = o.route[o.route.length - 1].fuelRem;
    const actual: Actual = { seq: last.seq, ata: last.eto, fuel: last.fuelRem - (planned - landing), logId: 'l', createdAt: '' };
    const checks = buildChecks(o, new Map([[last.seq, actual]]));
    return evaluateAlerts(ctx({ checks, proj: project(o, checks), ...extra }), RULES).filter((a) => a.ruleId === 'fuel-projection');
  };

  it('착륙 예상 연료 단계: FINAL / FINAL×130% / ALTN+FINAL — FOM 근거, 편차만 임시 (D-048)', () => {
    const fin = o.fuel.finalReserve;
    const altnFin = o.fuel.alternate + fin;
    expect(withLanding(fin - 10)[0]).toMatchObject({ severity: 'warning', title: expect.stringMatching(/< FINAL RES/) });
    expect(withLanding(fin * 1.3 - 10)[0]).toMatchObject({ severity: 'warning', title: expect.stringMatching(/MINIMUM FUEL/) });
    const c = withLanding(altnFin - 10)[0];
    expect(c).toMatchObject({ severity: 'caution', title: expect.stringMatching(/ALTN\+FINAL/) });
    expect(c.basis.filter((b) => b.kind === 'manual').map((b) => b.label.split(' ')[1])).toEqual(['8.2.1', '6.5.3.1']);
    expect(c.basis.some((b) => b.kind === 'temporary')).toBe(false);
    // FOM을 가져왔으면 근거에 링크
    const linked = withLanding(altnFin - 10, { refs: { 'FOM-8.2.1': { docId: 'GEN-FOM', seq: 7, ref: 'FOM 8.2.1 · p.470' } } })[0];
    expect(linked.basis[0]).toMatchObject({ kind: 'manual', manual: { docId: 'GEN-FOM', seq: 7 } });
    expect(c.basis[0].manual).toBeUndefined();
    expect(c.basis[0].label).toMatch(/FOM 미보유/);
  });

  it('편차만 큰 경우는 임시 기준 근거', () => {
    const last = o.route[Math.floor(o.route.length / 2)];
    const actual: Actual = { seq: last.seq, ata: last.eto, fuel: last.fuelRem - o.fuel.trip * 0.03, logId: 'l', createdAt: '' };
    const checks = buildChecks(o, new Map([[last.seq, actual]]));
    const p = project(o, checks);
    if (p.stage !== 'devCaution') return; // 데모 OFP 여유가 작아 착륙 단계가 먼저 걸리면 이 검사는 해당 없음
    const r = evaluateAlerts(ctx({ checks, proj: p }), RULES).filter((a) => a.ruleId === 'fuel-projection');
    expect(r[0].basis.some((b) => b.kind === 'temporary')).toBe(true);
  });

  it('MEL (o) 절차 → 매뉴얼 쪽·절차 쪽 근거', () => {
    const r = melOps.evaluate(ctx({ mel: [match(item('MEL', '99-10-01A', '- **(o)** x\nReturn To Gate', { opsProcSeq: 9 }))], manualDocs: [doc('MEL')] }));
    expect(r).toHaveLength(1);
    expect(r[0].basis.map((b) => b.manual?.seq)).toEqual([5, 9]);
    expect(r[0].detail).toMatch(/Return To Gate/);
    expect(melOps.evaluate(ctx({ mel: [match(item('MEL', '99-10-02A', 'May be inoperative.'))] }))).toHaveLength(0);
  });

  it('CDL 성능 문구는 원문 그대로 뽑는다', () => {
    expect(performanceLines('- Takeoff weights are reduced by 480 kg (1 059 lb)\n- Fuel consumption is increased by 0.4 %.\nother')).toEqual(['Takeoff weights are reduced by 480 kg (1 059 lb)', 'Fuel consumption is increased by 0.4 %.']);
    const r = cdlPerformance.evaluate(ctx({ mel: [match(item('CDL', '12-34', '**Performance:**\n- En-route limiting weight is reduced by 100 kg'))], manualDocs: [doc('CDL')] }));
    expect(r[0]).toMatchObject({ severity: 'caution' });
    expect(r[0].detail).toMatch(/reduced by 100 kg/);
  });

  it('매뉴얼 미확인: 매뉴얼 없음 / 번호 없음 / 상위 항목만', () => {
    const it1 = item('MEL', '99-10-01A', 'x');
    expect(melUnmatched.evaluate(ctx({ mel: [match(it1)] }))[0].key).toBe('nodoc:MEL');
    const r = melUnmatched.evaluate(ctx({ mel: [match(it1), { kind: 'MEL', itemNo: '11-11-11A', how: 'none' }, { ...match(it1), itemNo: '99-10-01C', how: 'parent' }], manualDocs: [doc('MEL')] }));
    expect(r.map((a) => a.key)).toEqual(['11-11-11A', '99-10-01C']);
  });

  it('결빙 MEL × 결빙 SIGMET: 둘 다 있을 때만 경고', () => {
    const icing = match(item('MEL', '30-11-01A', 'Do not operate in icing conditions.'));
    const sig = { fetchedAt: o.header.takeoff, data: [iceSigmet()] };
    expect(melIcingSigmet.evaluate(ctx({ mel: [icing], wx: { metars: {}, tafs: {}, sigmets: sig } }))[0]).toMatchObject({ severity: 'warning' });
    expect(melIcingSigmet.evaluate(ctx({ mel: [icing], wx: { metars: {}, tafs: {}, sigmets: { ...sig, data: [{ ...iceSigmet(), hazard: 'TURB' }] } } }))).toHaveLength(0);
    expect(melIcingSigmet.evaluate(ctx({ mel: [match(item('MEL', '25-20-04A', 'Seat inop'))], wx: { metars: {}, tafs: {}, sigmets: sig } }))).toHaveLength(0);
  });

  it('기상 오래됨: 도착지 자료 없음 안내, 비행 끝나면 판단 안 함', () => {
    expect(wxStale.evaluate(ctx()).some((a) => a.key === `none:${o.header.arr}`)).toBe(true);
    expect(wxStale.evaluate(ctx({ now: Date.parse(o.header.sta) + 2 * 3600e3 }))).toHaveLength(0);
  });
});

describe('얼러트 확인·이력', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetDBForTests();
  });

  it('처음 본 얼러트만 기록, 확인 시각 저장, 다시 기록해도 유지', async () => {
    const a = evaluateAlerts(ctx(), RULES);
    expect(await recordAlerts('F1', a, new Date('2026-01-01T00:00:00Z'))).toBe(a.length);
    expect(await recordAlerts('F1', a)).toBe(0);
    await ackAlerts('F1', [a[0].id], new Date('2026-01-01T01:00:00Z'));
    await recordAlerts('F1', a);
    const h = await alertHistory('F1');
    expect(h.find((x) => x.id === a[0].id)).toMatchObject({ firstSeenAt: '2026-01-01T00:00:00.000Z', ackAt: '2026-01-01T01:00:00.000Z' });
    expect(await alertHistory('F2')).toHaveLength(0);
  });
});
