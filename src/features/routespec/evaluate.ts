// 항로 스펙 대조 (D-104): ① 항로 요구(회사 기준 파일 routeSpec) × ② ATS FPL 신고 × ③ 오늘 비행기(기종 기본 + OFP MEL)
// FIR(OFP 순서) × 스펙(RVSM·PBN·CPDLC·PBCS) 칸마다 결과. 앱은 "맞음·확인 필요·신고 빠짐·자료 없음"까지만 — 운항 판단은 사람이.
import type { RouteSpecData, RouteSpecRule, SpecKey } from '../brief/rules';
import { firSequence } from '../fir/sequence';
import type { OfpData, OfpMelItem } from '../ofp/types';
import { CAP_LABEL, decodeFpl, type Cap, type FplCode } from './fplCaps';

export const SPEC_COLS: { key: SpecKey; label: string }[] = [
  { key: 'rvsm', label: 'RVSM' },
  { key: 'pbn', label: 'PBN (항법)' },
  { key: 'cpdlc', label: 'CPDLC · ADS-C' },
  { key: 'pbcs', label: 'PBCS (RCP·RSP)' },
];

/** 나쁜 순서: missing > warn > unknown > ok > na */
export type CellStatus = 'missing' | 'warn' | 'unknown' | 'ok' | 'na';
const RANK: Record<CellStatus, number> = { missing: 4, warn: 3, unknown: 2, ok: 1, na: 0 };
export const worst = (a: CellStatus, b: CellStatus): CellStatus => (RANK[a] >= RANK[b] ? a : b);

export interface RuleHit {
  rule: RouteSpecRule;
  status: CellStatus;
  /** 신고에서 빠진 능력 */
  missing: Cap[];
  /** 운영 시간 밖 통과 */
  outOfHours?: boolean;
}

export interface SpecCell {
  spec: SpecKey;
  status: CellStatus;
  hits: RuleHit[];
  /** 이 칸에 해당하는 신고 코드 */
  filed: FplCode[];
  /** 영향 줄 수 있는 MEL 항목 */
  mel: { item: OfpMelItem; label: string }[];
  /** 기종 기본 능력에 없는 요구 능력 (기종 표가 있을 때) */
  baseMissing: Cap[];
  /** 짧은 글 (칸 안) */
  short: string;
}

export interface SpecLeg {
  icao: string;
  name: string;
  /** 진입 시각 (출발 FIR은 이륙 시각) */
  start: number;
  end: number;
  fls: number[];
  airways: string[];
  cells: Record<SpecKey, SpecCell>;
  /** 결과 한 줄 (분리·통신) */
  result: string[];
}

export interface RouteSpecResult {
  legs: SpecLeg[];
  codes: FplCode[];
  caps: Set<Cap>;
  /** 스펙 계통 MEL 항목 (전체) */
  melHits: { item: OfpMelItem; label: string; caps: Cap[] }[];
  aircraftKnown: boolean;
  noFpl: boolean;
  counts: Record<CellStatus, number>;
}

const SPEC_CAPS: Record<SpecKey, Cap[]> = {
  rvsm: ['RVSM'],
  pbn: ['PBN', 'RNP10', 'RNAV5', 'RNAV2', 'RNAV1', 'RNP4', 'RNP2', 'RNP1'],
  cpdlc: ['CPDLC', 'FANS', 'ADSC', 'HF', 'SATVOICE'],
  pbcs: ['RCP240', 'RCP400', 'RSP180', 'RSP400'],
};

const hhmm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(2, 4));
/** UTC 운영 시간 "1500-1859"과 [start,end] 겹침 (자정 넘김 처리) */
export function overlapsHours(hours: string, start: number, end: number): boolean {
  const m = /^(\d{4})-(\d{4})$/.exec(hours.trim());
  if (!m || !Number.isFinite(start) || !Number.isFinite(end)) return true;
  const a = hhmm(m[1]);
  const b = hhmm(m[2]);
  for (let t = start; t <= end; t += 60_000 * 10) {
    const d = new Date(t);
    const x = d.getUTCHours() * 60 + d.getUTCMinutes();
    if (a <= b ? x >= a && x <= b : x >= a || x <= b) return true;
  }
  return false;
}

function ruleApplies(r: RouteSpecRule, icao: string, fls: number[], airways: string[]): boolean {
  if (r.firs?.length && !r.firs.includes(icao)) return false;
  if (r.airways?.length && !r.airways.some((a) => airways.includes(a))) return false;
  if (r.flMin !== undefined || r.flMax !== undefined) {
    const lo = r.flMin ?? 0;
    const hi = r.flMax ?? 999;
    if (!fls.some((f) => f >= lo && f <= hi)) return false;
  }
  return true;
}

export function evaluateRouteSpec(o: OfpData, data: RouteSpecData | null | undefined): RouteSpecResult {
  const fpl = o.atsFpl;
  const { codes, caps } = fpl ? decodeFpl(fpl.equipment, fpl.item18) : { codes: [], caps: new Set<Cap>() };
  const melMap = data?.melMap ?? [];
  const melHits = o.mel
    .map((item) => {
      const m = melMap.filter((x) => item.itemNo.startsWith(x.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
      return m ? { item, label: m.label, caps: m.caps } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const ac = data?.aircraft?.find((a) => new RegExp(a.match, 'i').test(o.header.acType));

  const seq = firSequence(o).legs;
  const t0 = Date.parse(o.route[0]?.eto ?? o.header.std);
  const tEnd = Date.parse(o.header.sta);
  const counts: Record<CellStatus, number> = { missing: 0, warn: 0, unknown: 0, ok: 0, na: 0 };
  const legs: SpecLeg[] = seq.map((leg, i) => {
    const from = leg.entry?.seq ?? 0;
    const next = seq[i + 1]?.entry?.seq ?? Infinity;
    const wpts = o.route.filter((w) => w.seq >= from && w.seq < next);
    const fls = [...new Set(wpts.map((w) => w.fl).filter((f) => f > 0))];
    const airways = [...new Set(wpts.map((w) => w.airway).filter((a) => a && a !== 'DCT'))];
    const start = leg.entry ? Date.parse(leg.entry.eto) : t0;
    const end = seq[i + 1]?.entry ? Date.parse(seq[i + 1].entry!.eto) : tEnd;
    const cells = {} as Record<SpecKey, SpecCell>;
    const result: string[] = [];
    for (const { key } of SPEC_COLS) {
      const rules = (data?.rules ?? []).filter((r) => r.spec === key && ruleApplies(r, leg.icao, fls, airways));
      const hits: RuleHit[] = rules.map((rule) => {
        if (rule.level === 'nodata') return { rule, status: 'unknown', missing: [] };
        const missing = rule.need.filter((c) => !caps.has(c));
        const outOfHours = rule.hours ? !overlapsHours(rule.hours, start, end) : false;
        let status: CellStatus = 'ok';
        if (missing.length) status = rule.level === 'required' ? 'missing' : rule.level === 'area' ? 'warn' : 'ok';
        if (rule.level === 'info' && (outOfHours || missing.length)) status = 'warn';
        return { rule, status, missing, outOfHours };
      });
      const need = [...new Set(rules.filter((r) => r.level !== 'nodata').flatMap((r) => r.need))];
      const mel = melHits.filter((h) => h.caps.some((c) => need.includes(c))).map(({ item, label }) => ({ item, label }));
      const baseMissing = ac ? need.filter((c) => !ac.caps.includes(c)) : [];
      let status: CellStatus = hits.length ? hits.map((h) => h.status).reduce(worst) : 'na';
      if (status === 'ok' && (mel.length || baseMissing.length)) status = 'warn';
      const filed = codes.filter((c) => c.caps.some((k) => SPEC_CAPS[key].includes(k) && (need.length === 0 || need.includes(k))));
      const short =
        status === 'na'
          ? '요구 없음'
          : status === 'unknown'
            ? (hits.find((h) => h.status === 'unknown')?.rule.text ?? '자료 없음')
            : hits.some((h) => h.outOfHours)
              ? `운영 ${hits.find((h) => h.outOfHours)!.rule.hours}Z · 통과 시간 밖`
              : hits.some((h) => h.missing.length)
                ? `신고 없음: ${[...new Set(hits.flatMap((h) => h.missing))].map((c) => CAP_LABEL[c]).join(', ')}`
                : mel.length
                  ? `MEL ${mel.map((m) => m.item.itemNo).join(', ')}`
                  : filed.map((c) => c.code).join(' · ') || need.map((c) => CAP_LABEL[c]).join(' · ');
      cells[key] = { spec: key, status, hits, filed, mel, baseMissing, short };
      counts[status]++;
      for (const h of hits) {
        const t = h.status === 'ok' ? h.rule.okText : h.status === 'warn' || h.status === 'missing' ? h.rule.ifNot : undefined;
        if (t && !result.includes(t)) result.push(t);
      }
    }
    return { icao: leg.icao, name: leg.name, start, end, fls, airways, cells, result };
  });
  return { legs, codes, caps, melHits, aircraftKnown: !!ac, noFpl: !fpl, counts };
}
