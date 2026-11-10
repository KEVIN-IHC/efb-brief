// Aviator OFP 파서 진입점: 원문 텍스트 → 구간 → 추출기 → 조립 → 교차검증
import type { OfpData } from '../types';
import { AC_CODE } from './aviator';
import { compareFpl } from './fpl';
import { EXTRACTORS, type ExtractCtx } from './extractors';
import { toDocLines } from './lines';
import { splitSections } from './sections';
import type { CheckResult, ExtractorResult, ParseResult } from './types';

export const AVIATOR_PARSER_VERSION = 'aviator-1.3'; // 1.3: NOTAM 패키지 추출 (Phase 4)

export function parseAviatorOfp(rawText: string): ParseResult {
  const lines = toDocLines(rawText);
  const { sections, missing } = splitSections(lines);
  const ctx: ExtractCtx = { lines, sections, data: { header: {}, alternates: [] }, fpls: [], av: {} };

  const extractors: ExtractorResult[] = EXTRACTORS.map((ex) => {
    const base = { id: ex.id, label: ex.label, section: ex.section };
    const secs = sections.filter((s) => s.id === ex.section && !s.ignored);
    if (!secs.length) return { ...base, status: 'missing', fields: [], message: '해당 구간을 찾지 못함' };
    if (!ex.run) return { ...base, status: 'pending', fields: [], message: ex.pendingNote };
    try {
      return { ...base, ...ex.run(ctx, secs) };
    } catch (e) {
      // 한 추출기 오류가 전체 파싱을 멈추지 않도록
      return { ...base, status: 'failed', fields: [], message: `오류: ${e instanceof Error ? e.message : String(e)}` };
    }
  });

  const ofp = assemble(ctx, lines.map((l) => l.text));
  return {
    parserVersion: AVIATOR_PARSER_VERSION,
    lineCount: lines.length,
    pageCount: Math.max(0, ...lines.map((l) => l.page)),
    sections,
    missingSections: missing,
    extractors,
    checks: runChecks(ctx),
    data: ctx.data,
    ofp,
  };
}

/** 헤더·연료·중량·루트가 모두 있으면 앱 공통 OfpData로 조립 (하나라도 없으면 undefined → 데모로 대체되지 않고 '불완전'으로 표시) */
function assemble(ctx: ExtractCtx, texts: string[]): OfpData | undefined {
  const { header: h, fuel, weights: w, route } = ctx.av;
  if (!h || !fuel || !w || !route?.length || ctx.av.takeoffMs === undefined) return undefined;
  const fpl = ctx.fpls[0]?.fpl;
  const g = (re: RegExp) => fuel.get(re)?.fuel ?? 0;
  const takeoffMs = ctx.av.takeoffMs;
  let staMs = h.eta ? Date.parse(`${h.date.value}T${h.eta.value.slice(0, 2)}:${h.eta.value.slice(2)}:00Z`) : takeoffMs + (fuel.get(/^TRIP$/)?.timeMin ?? 0) * 60000;
  while (staMs < takeoffMs) staMs += 86400000; // 자정 넘김
  const valid = texts.map((t) => /PLAN VALID FOR DEPARTURE UNTIL\s+(\d{4}Z)/.exec(t)).find(Boolean);
  const d = ctx.av.dispatch;
  const lim = (k: string) => (w[k] ? [{ label: k, value: w[k].value }] : []);

  return {
    unit: 'lbs',
    header: {
      flightNo: h.flightNo.value,
      date: h.date.value,
      acType: fpl?.acType ?? AC_CODE[h.acCode?.value ?? ''] ?? h.acCode?.value ?? '',
      reg: h.reg?.value ?? fpl?.item18.REG ?? '',
      dep: h.dep.value,
      arr: h.arr.value,
      std: new Date(takeoffMs).toISOString(),
      sta: new Date(staMs).toISOString(),
      takeoff: new Date(takeoffMs).toISOString(),
      blockMin: Math.round((staMs - takeoffMs) / 60000),
      airMin: fuel.get(/^TRIP$/)?.timeMin ?? route[route.length - 1].cumMin,
      cruiseFl: Math.max(0, ...route.map((r) => r.fl)),
      costIndex: h.costIndex?.value ?? NaN,
      engine: h.engine?.value,
      selcal: h.selcal?.value,
      planNo: h.planNo?.value,
      computedAt: h.computedAt?.value,
      avgWindTemp: h.avgWindTemp?.value,
      routeString: h.routeString?.value ?? fpl?.route,
      validUntil: valid?.[1],
      edtoRule: (d?.notes ?? []).map((n) => /(\d{2,3})\s*MIN\s+(?:EDTO|ETOPS)/.exec(n.text)).find(Boolean)?.slice(1, 2).map((m) => `EDTO ${m}`)[0],
    },
    fuel: {
      taxi: g(/^TAXI$/),
      trip: g(/^TRIP$/),
      contingency: g(/PCT CONT$/),
      alternate: g(/^ALTN\//),
      finalReserve: g(/^FINAL RES$/),
      extra: g(/^DISC$/) + g(/^TANKERING$/),
      block: g(/^RAMP OUT$/),
      minRequired: g(/^RQD TAKEOFF$/) + g(/^TAXI$/),
      rows: fuel.rows.map(({ line: _l, ...r }) => r),
    },
    weights: {
      zfw: { planned: w.ZFW?.value ?? NaN, limit: w.MZFW?.value ?? NaN },
      tow: { planned: w.TOW?.value ?? NaN, limit: w.MTOW?.value ?? NaN },
      lw: { planned: w.LDW?.value ?? NaN, limit: w.MLDW?.value ?? NaN },
      payload: w.PLD?.value ?? NaN,
      extraLimits: [...lim('RWY'), ...lim('TCAP'), ...lim('AGTOW'), ...lim('ACL'), ...lim('SOW')],
    },
    alternates: ctx.av.alternates ?? (fpl?.altns ?? []).map((icao) => ({ icao, role: 'DEST ALTN', distNm: NaN, timeMin: NaN })),
    route,
    etps: ctx.av.etps ?? [],
    edtoAirports: (fpl?.item18.RALT ?? '').split(/\s+/).filter(Boolean),
    edto: ctx.av.edto?.windows.length ? ctx.av.edto : undefined,
    crzWind: ctx.av.wind ? { fls: ctx.av.wind.fls, isa: ctx.av.wind.isa, points: ctx.av.wind.points } : undefined,
    mel: (d?.mel ?? []).map(({ line: _l, ...m }) => m),
    notes: (d?.notes ?? []).map((n) => n.text),
    pax: d?.pax?.value,
    cargo: d?.cargo?.value,
    fuelStats: d?.stats ? { period: d.stats.period, items: d.stats.items } : undefined,
    notams: ctx.av.notams,
  };
}

function runChecks(ctx: ExtractCtx): CheckResult[] {
  const checks: CheckResult[] = [];
  const add = (id: string, label: string, ok: boolean | null, detail: string, lines: number[] = []) =>
    checks.push({ id, label, status: ok === null ? 'skip' : ok ? 'pass' : 'fail', detail, lines });

  // 1) 구간
  const term = ctx.sections.find((s) => s.id === 'altnRoute' || s.id === 'refile' || s.id === 'end');
  add('cfpEnd', '메인 CFP 종료 표시', !!term, term ? `${term.label} 에서 종료 (L${term.startLine})` : '종료 표시 없음 → 루트 중복·혼입 위험', term ? [term.startLine] : []);
  const copy = ctx.sections.find((s) => s.id === 'cfpCopy');
  add('cfpCopy', '후반부 CFP 복사본', copy ? true : null, copy ? `L${copy.startLine}~L${copy.endLine} 파싱에서 제외` : '복사본 없음 (또는 탐지 못함)', copy ? [copy.startLine] : []);

  // 2) FPL 블록끼리
  if (ctx.fpls.length >= 2) {
    const diffs = ctx.fpls.slice(1).flatMap((b) => compareFpl(ctx.fpls[0].fpl, b.fpl));
    add('fplMatch', 'FPL 블록 일치 (OFP ↔ ATS PLAN)', diffs.length === 0, diffs.length ? [...new Set(diffs)].join(' / ') : `FPL ${ctx.fpls.length}개 모두 일치`, ctx.fpls.map((f) => f.lines[0].n));
  } else add('fplMatch', 'FPL 블록 일치 (OFP ↔ ATS PLAN)', null, `FPL 블록 ${ctx.fpls.length}개 — 비교하려면 2개 필요`);

  // 3) 헤더 ↔ FPL
  const h = ctx.av.header;
  const f = ctx.fpls[0]?.fpl;
  if (h && f) {
    const diffs: string[] = [];
    if (h.flightNo.value !== f.acid) diffs.push(`편명 ${h.flightNo.value}≠${f.acid}`);
    if (h.dep.value !== f.dep || h.arr.value !== f.dest) diffs.push('출발/도착');
    if (h.reg && f.item18.REG && h.reg.value !== f.item18.REG) diffs.push(`REG ${h.reg.value}≠${f.item18.REG}`);
    add('hdrFpl', 'OFP 헤더 ↔ FPL', diffs.length === 0, diffs.length ? diffs.join(' / ') : '편명·출발·도착·REG 일치', [h.flightNo.line]);
  }

  // 4) 연료 산수 (100 LBS 단위 정수라 오차 0이어야 함)
  const fu = ctx.av.fuel;
  if (fu) {
    const g = (re: RegExp) => fu.get(re)?.fuel;
    const subs = fu.rows.filter((r) => r.kind === 'sub').reduce((s, r) => s + r.fuel, 0);
    const eqs: [string, number | undefined, number | undefined][] = [
      ['RESERVE = Σ(ALTN·FINAL·CONT·REFILE·ETP)', g(/^RESERVE$/), subs],
      ['TRIP + RESERVE = RQD TAKEOFF', (g(/^TRIP$/) ?? NaN) + (g(/^RESERVE$/) ?? NaN), g(/^RQD TAKEOFF$/)],
      ['RQD + DISC + TANKERING = PLN TAKEOFF', (g(/^RQD TAKEOFF$/) ?? NaN) + (g(/^DISC$/) ?? 0) + (g(/^TANKERING$/) ?? 0), g(/^PLN TAKEOFF$/)],
      ['PLN TAKEOFF + TAXI = RAMP OUT', (g(/^PLN TAKEOFF$/) ?? NaN) + (g(/^TAXI$/) ?? NaN), g(/^RAMP OUT$/)],
    ];
    const bad = eqs.filter(([, a, b]) => a === undefined || b === undefined || a !== b);
    add('fuelSum', '연료표 합계', bad.length === 0, bad.length ? bad.map((e) => e[0]).join(' / ') : `${eqs.length}개 등식 모두 일치`, [fu.rows[0].line]);
  }

  // 5) 중량 산수
  const w = ctx.av.weights;
  if (w?.ZFW && w.TOF && w.TOW && w.TIF && w.LDW) {
    const ok1 = w.ZFW.value + w.TOF.value === w.TOW.value;
    const ok2 = w.TOW.value - w.TIF.value === w.LDW.value;
    const ok3 = !fu?.get(/^PLN TAKEOFF$/) || fu.get(/^PLN TAKEOFF$/)!.fuel === w.TOF.value;
    add('wtSum', '중량 합계', ok1 && ok2 && ok3, [!ok1 && 'ZFW+TOF≠TOW', !ok2 && 'TOW−TIF≠LDW', !ok3 && 'TOF≠PLN TAKEOFF'].filter(Boolean).join(' / ') || 'ZFW+TOF=TOW · TOW−TIF=LDW · TOF=PLN TAKEOFF', [w.ZFW.line]);
  }

  // 6) 루트 ↔ 연료표
  const r = ctx.av.route;
  if (r?.length && fu) {
    const last = r[r.length - 1];
    const trip = fu.get(/^TRIP$/);
    const fod = fu.get(/^FOD$/);
    const pln = fu.get(/^PLN TAKEOFF$/);
    const issues: string[] = [];
    if (trip && last.accBurn !== trip.fuel) issues.push(`누적 소모 ${last.accBurn} ≠ TRIP ${trip.fuel}`);
    if (trip?.timeMin !== undefined && last.cumMin !== trip.timeMin) issues.push(`누적 시간 ≠ TRIP 시간`);
    if (fod && last.fuelRem !== fod.fuel) issues.push(`도착 잔여 ${last.fuelRem} ≠ FOD ${fod.fuel}`);
    if (pln && Math.abs(pln.fuel - r[0].accBurn! - r[0].fuelRem) > 100) issues.push('첫 지점 잔여연료 불일치');
    let mono = true;
    for (let i = 1; i < r.length; i++) if (r[i].cumMin < r[i - 1].cumMin || r[i].fuelRem > r[i - 1].fuelRem) mono = false;
    if (!mono) issues.push('시간·연료 순서 역전 (REFILE 혼입 의심)');
    add('routeFuel', '루트 로그 ↔ 연료표', issues.length === 0, issues.length ? issues.join(' / ') : `${r.length}개 지점 · 누적 소모=TRIP · 도착 잔여=FOD`, [r[0].srcLine!, last.srcLine!]);
  }

  // 7) CRZ WIND 요약표 ↔ NAV LOG (같은 지점·같은 FL 바람이 같아야 함)
  const ws = ctx.av.wind;
  if (ws && r?.length) {
    let cmp = 0;
    const bad: string[] = [];
    for (const p of r) {
      const c = ws.points.find((x) => x.name === p.name)?.byFl[p.fl];
      if (!c || p.windDir == null) continue;
      cmp++;
      if (c.dir !== p.windDir || c.spd !== p.windSpd) bad.push(p.name);
    }
    add('windNav', 'CRZ WIND ↔ NAV LOG 바람', cmp ? bad.length === 0 : null, cmp ? (bad.length ? `불일치: ${bad.join(', ')}` : `${cmp}개 지점 일치`) : '비교할 지점 없음', [ws.line]);
  }

  // 8) NOTAM 누락 점검: 패키지마다 날짜로 시작하는 머리 줄 수 = 추출 건수, 끝 표시 확인
  const nt = ctx.av.notams;
  if (nt) {
    const bad = nt.packages.filter((p) => !p.endFound || p.counts.headLines !== p.counts.parsed);
    add(
      'notamCount',
      'NOTAM 머리 줄 수 = 추출 건수',
      nt.packages.length === 3 && bad.length === 0,
      nt.packages.map((p) => `P${p.no} ${p.counts.parsed}/${p.counts.headLines}${p.endFound ? '' : ' (끝 표시 없음)'}`).join(' · '),
      nt.packages.map((p) => p.startLine),
    );
  }

  return checks;
}

export type { ParseResult } from './types';
