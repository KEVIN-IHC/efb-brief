// 섹션별 추출기 목록. 각 추출기는 원문 줄 번호와 함께 값을 기록한다 (FieldTrace).
import { fmtHm, fmtKg } from '../../../lib/format';
import type { OfpAlternate, OfpEtp, OfpNotams, OfpWaypoint } from '../types';
import {
  AC_CODE,
  parseAlternates,
  parseDispatch,
  parseEdtoInfo,
  parseEtp,
  parseFuel,
  parseHeader,
  parseRouteLog,
  parseWeights,
  parseWindSummary,
  type WindSummary,
  type AviatorDispatch,
  type AviatorFuel,
  type AviatorHeader,
  type EdtoInfo,
  type Traced,
} from './aviator';
import { cutFplBlock, dofToDate, parseFpl, type FplData } from './fpl';
import { lineOf } from './lines';
import { parseNotams } from './notam';
import { sectionLines } from './sections';
import type { DocLine, ExtractorResult, FieldTrace, ParsedPartial, Section, SectionId } from './types';

export interface ExtractCtx {
  lines: DocLine[];
  sections: Section[];
  data: ParsedPartial;
  fpls: { fpl: FplData; lines: DocLine[] }[];
  av: {
    header?: AviatorHeader;
    takeoffMs?: number;
    fuel?: AviatorFuel;
    weights?: Record<string, Traced<number>>;
    route?: OfpWaypoint[];
    alternates?: OfpAlternate[];
    etps?: OfpEtp[];
    edto?: EdtoInfo;
    wind?: WindSummary;
    dispatch?: AviatorDispatch;
    notams?: OfpNotams;
  };
}

export interface Extractor {
  id: string;
  label: string;
  section: SectionId;
  run?: (ctx: ExtractCtx, secs: Section[]) => Omit<ExtractorResult, 'id' | 'label' | 'section'>;
  pendingNote?: string;
}

const raw = (ctx: ExtractCtx, n: number) => ctx.lines[n - 1]?.text.trim() ?? '';
const tr = (ctx: ExtractCtx, path: string, label: string, value: string | number | undefined, line: number): FieldTrace[] =>
  value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value)) ? [] : [{ path, label, value, line, raw: raw(ctx, line) }];
const cfpLines = (ctx: ExtractCtx, secs: Section[]) => secs.flatMap((s) => sectionLines(ctx.lines, s));

// ---------- FPL (ICAO 표준) ----------
const fplExtractor: Extractor = {
  id: 'fpl',
  label: 'ATS 비행계획 (FPL)',
  section: 'fpl',
  run(ctx, secs) {
    let failed = 0;
    for (const s of secs) {
      const blk = cutFplBlock(sectionLines(ctx.lines, s));
      const fpl = blk && parseFpl(blk.text);
      if (!blk || !fpl) failed++;
      else ctx.fpls.push({ fpl, lines: blk.lines });
    }
    const first = ctx.fpls[0];
    if (!first) return { status: 'failed', fields: [], message: `FPL 블록 ${secs.length}개를 찾았지만 형식 해석 실패` };
    const { fpl, lines } = first;
    const at = (token: string) => lineOf(lines, token, lines[0].n);
    const date = dofToDate(fpl.item18.DOF);
    const lvl = /^F(\d{3})$/.exec(fpl.level);
    const fields = [
      ...tr(ctx, 'fpl.acid', '편명 (Item 7)', fpl.acid, at(`(FPL-${fpl.acid}`)),
      ...tr(ctx, 'fpl.acType', '기종 (Item 9)', `${fpl.acType}/${fpl.wake}`, at(fpl.acType + '/')),
      ...tr(ctx, 'fpl.dep', '출발·EOBT (Item 13)', `${fpl.dep} ${fpl.eobt}`, at(fpl.dep + fpl.eobt)),
      ...tr(ctx, 'fpl.level', '초기 속도·고도 (Item 15)', fpl.speed + fpl.level, at(fpl.speed + fpl.level)),
      ...tr(ctx, 'fpl.dest', '목적지·EET·교체 (Item 16)', `${fpl.dest} ${fpl.eet} ${fpl.altns.join(' ')}`, at(fpl.dest + fpl.eet)),
      ...tr(ctx, 'fpl.ralt', '항로 교체 (RALT/)', fpl.item18.RALT, at('RALT/')),
      ...tr(ctx, 'fpl.dof', '운항일 (DOF/)', date, at('DOF/')),
    ];
    Object.assign(ctx.data.header, { flightNo: fpl.acid, acType: fpl.acType, dep: fpl.dep, arr: fpl.dest, ...(lvl && { cruiseFl: Number(lvl[1]) }), ...(fpl.item18.REG && { reg: fpl.item18.REG }), ...(date && { date }) });
    ctx.data.alternates = fpl.altns;
    ctx.data.routeString = fpl.route;
    return { status: failed ? 'partial' : 'ok', fields, message: `FPL 블록 ${ctx.fpls.length}개 해석${failed ? `, ${failed}개 실패` : ''} · ICAO Doc 4444` };
  },
};

// ---------- 헤더 ----------
const headerExtractor: Extractor = {
  id: 'header',
  label: '헤더 (편명·REG·CI·ETD/ETA)',
  section: 'cfp',
  run(ctx, secs) {
    const h = parseHeader(cfpLines(ctx, secs));
    if (!h) return { status: 'failed', fields: [], message: 'FLIGHT RELEASE 줄을 찾지 못함' };
    ctx.av.header = h;
    if (h.etd) {
      ctx.av.takeoffMs = Date.parse(`${h.date.value}T${h.etd.value.slice(0, 2)}:${h.etd.value.slice(2)}:00Z`);
    }
    const f = (k: keyof AviatorHeader, label: string) => {
      const v = h[k] as Traced<string | number> | undefined;
      return v ? tr(ctx, `header.${k}`, label, v.value, v.line) : [];
    };
    const fields = [
      ...f('flightNo', 'FLT NBR'), ...f('dep', 'FROM'), ...f('arr', 'TO'), ...f('date', 'DATE'), ...f('planNo', 'CFP PLAN'),
      ...f('computedAt', 'COMPUTED'), ...f('acCode', 'A/C'), ...f('reg', 'REG'), ...f('engine', 'ENGINE'), ...f('selcal', 'SELCAL'),
      ...f('costIndex', 'CI (CRZ)'), ...f('avgWindTemp', 'AVG WIND/TEMP'), ...f('unit', 'UNIT'), ...f('etd', 'ETD (Z)'), ...f('eta', 'ETA (Z)'),
    ];
    const missing = ['reg', 'etd', 'costIndex'].filter((k) => !h[k as keyof AviatorHeader]);
    return { status: missing.length ? 'partial' : 'ok', fields, message: missing.length ? `못 찾음: ${missing.join(', ')}` : undefined };
  },
};

// ---------- 연료 ----------
const fuelExtractor: Extractor = {
  id: 'fuel',
  label: '연료 (TRIP·RESERVE·DISC·TAXI·RAMP)',
  section: 'cfp',
  run(ctx, secs) {
    const fuel = parseFuel(cfpLines(ctx, secs));
    if (!fuel) return { status: 'failed', fields: [], message: 'TRIP / RAMP OUT 줄을 찾지 못함' };
    ctx.av.fuel = fuel;
    const fields = fuel.rows.flatMap((r) => tr(ctx, `fuel.${r.label}`, r.label, `${fmtKg(r.fuel)}${r.timeMin !== undefined ? ` · ${fmtHm(r.timeMin)}` : ''}`, r.line));
    const need = [/^TRIP$/, /^ALTN\//, /^FINAL RES$/, /PCT CONT$/, /^RQD TAKEOFF$/, /^DISC$/, /^TAXI$/, /^RAMP OUT$/];
    const miss = need.filter((re) => !fuel.get(re));
    return { status: miss.length ? 'partial' : 'ok', fields, message: `${fuel.rows.length}줄 · 단위 100 LBS → lbs` };
  },
};

// ---------- 중량 ----------
const weightExtractor: Extractor = {
  id: 'weights',
  label: '중량 (ZFW·TOW·LDW·한계)',
  section: 'cfp',
  run(ctx, secs) {
    const w = parseWeights(cfpLines(ctx, secs));
    ctx.av.weights = w;
    const keys = ['SOW', 'PLD', 'ZFW', 'MZFW', 'TOF', 'TOW', 'MTOW', 'TIF', 'LDW', 'MLDW', 'RWY', 'TCAP', 'AGTOW', 'ACL'];
    const fields = keys.flatMap((k) => (w[k] ? tr(ctx, `weights.${k}`, k, fmtKg(w[k].value), w[k].line) : []));
    const need = ['ZFW', 'MZFW', 'TOW', 'MTOW', 'LDW', 'MLDW'];
    const miss = need.filter((k) => !w[k]);
    if (miss.length === need.length) return { status: 'failed', fields, message: '중량 값을 찾지 못함' };
    return { status: miss.length ? 'partial' : 'ok', fields, message: miss.length ? `못 찾음: ${miss.join(', ')}` : '단위 100 LBS → lbs' };
  },
};

// ---------- 루트 로그 ----------
const routeExtractor: Extractor = {
  id: 'route',
  label: '루트 로그 (웨이포인트당 3줄)',
  section: 'cfp',
  run(ctx, secs) {
    if (ctx.av.takeoffMs === undefined) return { status: 'failed', fields: [], message: 'ETD 없음 → ETO 계산 불가' };
    const r = parseRouteLog(cfpLines(ctx, secs), ctx.av.takeoffMs);
    if (!r.length) return { status: 'failed', fields: [], message: '루트 로그 행을 찾지 못함' };
    ctx.av.route = r;
    const last = r[r.length - 1];
    const fields = [
      ...tr(ctx, 'route.first', '첫 지점', `${r[0].name} ${r[0].flText}`, r[0].srcLine!),
      ...tr(ctx, 'route.count', '웨이포인트 수', r.length, r[0].srcLine!),
      ...tr(ctx, 'route.last', '마지막 지점', `${last.name} · ${fmtHm(last.cumMin)} · ${fmtKg(last.accBurn)}`, last.srcLine!),
      ...tr(ctx, 'route.dist', '총 거리 (NM)', last.cumDist, last.srcLine!),
      ...r.filter((w) => w.fir).map((w) => ({ path: `route.fir.${w.seq}`, label: `FIR 경계 ${w.name}`, value: w.fir!, line: w.srcLine!, raw: raw(ctx, w.srcLine!) })),
    ];
    return { status: 'ok', fields, message: `${r.length}개 지점 · ${last.cumDist} NM` };
  },
};

// ---------- 교체공항 ----------
const altnExtractor: Extractor = {
  id: 'altnRoute',
  label: 'ROUTE TO ALTN · ERA',
  section: 'altnRoute',
  run(ctx, secs) {
    const a = parseAlternates(sectionLines(ctx.lines, secs[0]));
    if (!a.length) return { status: 'failed', fields: [], message: 'ALTERNATE 줄을 찾지 못함' };
    ctx.av.alternates = a.map(({ line: _l, ...x }) => x);
    const fields = a.flatMap((x) => tr(ctx, `altn.${x.icao}`, x.role, `${x.icao} · ${x.distNm} NM · ${fmtHm(x.timeMin)}${x.fuel ? ` · ${fmtKg(x.fuel)}` : ''}`, x.line));
    return { status: 'ok', fields };
  },
};

// ---------- ETP ----------
const etpExtractor: Extractor = {
  id: 'etp',
  label: 'ETP · 드리프트다운',
  section: 'etp',
  run(ctx, secs) {
    const drift = ctx.sections.filter((s) => s.id === 'windSummary' && !s.ignored).flatMap((s) => sectionLines(ctx.lines, s));
    const e = parseEtp(sectionLines(ctx.lines, secs[0]), drift, ctx.av.route ?? [], ctx.av.takeoffMs ?? 0);
    ctx.av.edto = parseEdtoInfo(sectionLines(ctx.lines, secs[0]));
    if (!e.length) return { status: 'failed', fields: [], message: 'ETP 공항 쌍을 찾지 못함' };
    ctx.av.etps = e.map(({ line: _l, ...x }) => x);
    const fields = e.flatMap((x) => tr(ctx, `etp.${x.name}`, x.name, `${x.airports.join('/')} · FOB ${fmtKg(x.fuelOnBoard)} · 시나리오 ${x.scenarios?.length ?? 0}`, x.line));
    return { status: 'ok', fields };
  },
};

// ---------- 디스패치 ----------
const dispatchExtractor: Extractor = {
  id: 'dispatch',
  label: '디스패치 (승객·MEL/CDL·노트·연료 통계)',
  section: 'dispatch',
  run(ctx, secs) {
    const d = parseDispatch(sectionLines(ctx.lines, secs[0]));
    ctx.av.dispatch = d;
    const fields = [
      ...(d.pax ? tr(ctx, 'dispatch.pax', 'PASSENGERS', d.pax.value, d.pax.line) : []),
      ...(d.cargo ? tr(ctx, 'dispatch.cargo', 'PAX/CARGO', d.cargo.value, d.cargo.line) : []),
      ...(d.stats ? tr(ctx, 'dispatch.stats', '연료 통계', d.stats.items.map((i) => `${i.label} ${i.value}`).join(' · '), d.stats.line) : []),
      ...d.mel.map((m) => ({ path: `mel.${m.itemNo}.${m.line}`, label: m.kind, value: `${m.itemNo} ${m.title}`, line: m.line, raw: raw(ctx, m.line) })),
    ];
    return { status: 'ok', fields, message: `MEL/CDL ${d.mel.length} · 노트 ${d.notes.length}` };
  },
};

// ---------- FL별 바람·기온 (CRZ WIND) ----------
const windExtractor: Extractor = {
  id: 'wind',
  label: 'CRZ WIND (FL별 바람·기온 요약)',
  section: 'windSummary',
  run(ctx, secs) {
    const w = parseWindSummary(sectionLines(ctx.lines, secs[0]));
    if (!w) return { status: 'failed', fields: [], message: '바람·기온 표를 해석하지 못함' };
    ctx.av.wind = w;
    const cells = w.points.reduce((s, p) => s + Object.keys(p.byFl).length, 0);
    return {
      status: 'ok',
      fields: tr(ctx, 'wind.summary', 'CRZ WIND', `${w.points.length}개 지점 · FL ${w.fls[w.fls.length - 1]}~${w.fls[0]} · ${cells}칸`, w.line),
      message: `${w.points.length}개 지점`,
    };
  },
};

// ---------- NOTAM PACKAGE 1/2/3 ----------
const notamExtractor: Extractor = {
  id: 'notam',
  label: 'NOTAM 패키지 1/2/3',
  section: 'notam1',
  run(ctx) {
    const idx = (n: number) => n - 1; // 줄 번호 → 배열 위치
    const ranges = (['notam1', 'notam2', 'notam3'] as const).flatMap((id, k) => {
      const s = ctx.sections.find((x) => x.id === id && !x.ignored);
      return s ? [{ no: (k + 1) as 1 | 2 | 3, from: idx(s.startLine), to: idx(s.endLine) }] : [];
    });
    const n = parseNotams(ctx.lines, ranges);
    if (!n) return { status: 'failed', fields: [], message: 'NOTAM 패키지를 해석하지 못함' };
    ctx.av.notams = n;
    const fields: FieldTrace[] = [];
    const problems: string[] = [];
    for (const p of n.packages) {
      const items = p.locations.reduce((s, l) => s + l.items.length, 0);
      fields.push(...tr(ctx, `notam.pkg${p.no}`, `PACKAGE ${p.no}`, `공항·FIR ${p.locations.length} · 항목 ${items} (머리 줄 ${p.counts.headLines} = 추출 ${p.counts.parsed})`, p.startLine));
      for (const l of p.locations) fields.push(...tr(ctx, `notam.pkg${p.no}.${l.role}.${l.icao}`, `[${l.role}] ${l.icao}`, l.seeAlso ? `PACKAGE ${l.seeAlso} 참조` : l.noNotams ? 'NOTAM 없음' : `${l.items.length}건`, l.line));
      if (!p.endFound) problems.push(`PACKAGE ${p.no} 끝 표시 없음`);
      if (p.counts.headLines !== p.counts.parsed) problems.push(`PACKAGE ${p.no} 머리 줄 ${p.counts.headLines} ≠ 추출 ${p.counts.parsed}`);
    }
    if (n.packages.length < 3) problems.push(`패키지 ${n.packages.length}/3개만 찾음`);
    const total = n.packages.reduce((s, p) => s + p.counts.parsed, 0);
    return { status: problems.length ? 'partial' : 'ok', fields, message: problems.length ? problems.join(' / ') : `NOTAM·회사 권고 ${total}건` };
  },
};

export const EXTRACTORS: Extractor[] = [
  fplExtractor,
  headerExtractor,
  fuelExtractor,
  weightExtractor,
  routeExtractor,
  altnExtractor,
  etpExtractor,
  dispatchExtractor,
  windExtractor,
  notamExtractor,
];

export { AC_CODE };
