// 운항관리사식 브리핑 판정 (D-049~D-054): 공항별 기상 × 회사 기준 × 활주로 × NOTAM → 판정·근거
// 원칙 (D-046 유지): 회사 기준 파일에 수치가 있고 자료로 확실히 비교될 때만 경고. 나머지는 참고(briefOnly)로 보인다.
// 회사 기준 수치는 코드에 없다 — rules(회사 기준 파일)에서 읽는다. 파일이 없으면 자료(기상·활주로·NOTAM)만 정리한다.
import type { Basis, Severity } from '../alerts/types';
import type { Projection } from '../inflight/deviation';
import { manualAircraft } from '../manual/lookup';
import type { Window } from '../notam/relevance';
import type { OfpData } from '../ofp/types';
import type { Snap } from '../weather/store';
import type { Metar, Taf } from '../weather/types';
import type { Restriction, SpecialAirport } from './fomTables';
import { sameAircraft } from './fomTables';
import { airportImpacts, BRAKING_LABEL, type Braking, type Impact, worseBraking } from './notamImpact';
import type { CrewProfile } from './profile';
import { engineCount, type CompanyRules, type RuleRef, type WindPair } from './rules';
import { airportRunways, ofpRunwayInfo, rankEnds, type AirportRunways, type EndWind, type RunwayDb, type RunwayEnd, windSpeedFor } from './runways';
import { isNight } from './sun';
import { controllingVis, fmtCeil, fmtVis, fmtWind, hasAsh, hasFreezing, hasHail, hasRain, hasSnowIce, hasTs, metarCond, tafWindow, type Cond, type WindowCond, worst } from './wx';

const H = 3_600_000;

export type Group = 'minima' | 'facility' | 'airport' | 'wind' | 'crew' | 'hazard' | 'ops';
export type Role = 'DEP' | 'DEST' | 'ALTN' | 'TKOF ALTN' | '3% ERA' | 'EDTO' | 'ETP' | 'ERA';

export const ROLE_KO: Record<Role, string> = {
  DEP: '출발',
  DEST: '목적지',
  ALTN: '목적지 교체',
  'TKOF ALTN': '이륙 교체',
  '3% ERA': '3% ERA',
  EDTO: 'EDTO ERA',
  ETP: 'ETP 공항',
  ERA: '항로 교체 후보',
};

export interface Finding {
  group: Group;
  key: string;
  severity: Severity;
  title: string;
  detail?: string;
  basis: Basis[];
  icao?: string;
  /** 브리핑 화면에만 (얼러트로 띄우지 않음) */
  briefOnly?: boolean;
}

export interface WindEval {
  phase: 'takeoff' | 'landing';
  gust: boolean;
  spd: number;
  cond: Cond;
  braking: Braking | 'dry' | null;
  brakingSrc: string;
  limit: WindPair | undefined;
  ranked: EndWind[];
  ok: EndWind[];
}

export interface AirportBrief {
  icao: string;
  name?: string;
  lat?: number;
  lon?: number;
  roles: Role[];
  window: Window;
  metar?: { cond: Cond; obsTime: string; raw: string };
  taf?: WindowCond & { raw: string; issueTime: string };
  /** 판정에 쓴 기본 조건 (TAF 기본 예보 + 창 안의 METAR 중 나쁜 쪽) */
  base: Cond | null;
  runways: AirportRunways;
  closedRwys: string[];
  impacts: Impact[];
  wind?: WindEval;
  approachNeed?: { base: number; temp: number | null; names: string[] };
  takeoffLevel?: TakeoffLevel;
  special?: SpecialAirport;
  restrictions: Restriction[];
  night: boolean;
  findings: Finding[];
}

export interface BriefInput {
  o: OfpData;
  now: number;
  wx: { metars: Record<string, Snap<Metar>>; tafs: Record<string, Snap<Taf>> };
  rules: CompanyRules | null;
  profile: CrewProfile;
  runwayDb: RunwayDb;
  specials: SpecialAirport[];
  restrictions: Restriction[];
  refs: Record<string, { docId: string; seq: number; ref?: string }>;
  geo: Record<string, [number, number, string]>;
  proj?: Projection | null;
}

export interface BriefResult {
  hasRules: boolean;
  rulesSource?: string;
  airports: AirportBrief[];
  flight: Finding[];
  /** 모든 판정 (공항 + 비행) */
  findings: Finding[];
}

// ---------- 근거 ----------
type Refs = BriefInput['refs'];
export function manualBasis(refs: Refs, r: RuleRef | undefined): Basis {
  if (!r) return { kind: 'app', label: '회사 기준 파일 없음' };
  const t = refs[r.code];
  return { kind: 'manual', label: t ? `${r.label}${t.ref ? ` · ${t.ref}` : ''}` : `${r.label} (매뉴얼 미보유 — 가져오면 링크)`, manual: t ? { docId: t.docId, seq: t.seq } : undefined };
}
const dataB = (label: string): Basis => ({ kind: 'data', label: label.replace(/\s+/g, ' ').slice(0, 180) });
const appB = (label: string): Basis => ({ kind: 'app', label });
const ofpB = (line: number, label: string): Basis => ({ kind: 'ofp', ofpLine: line, label: label.replace(/\s+/g, ' ').slice(0, 120) });

// ---------- 공항·역할·시간 창 ----------
interface Slot {
  icao: string;
  roles: Role[];
  window: Window;
}

export function flightAirports(o: OfpData, rules: CompanyRules | null): Slot[] {
  const T = Date.parse(o.header.takeoff);
  const S = Date.parse(o.header.sta);
  const air = (o.header.airMin || (S - T) / 60000) * 60000;
  const map = new Map<string, Slot>();
  const add = (icao: string | undefined, role: Role, w: Window) => {
    const k = (icao ?? '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(k)) return;
    const s = map.get(k);
    if (!s) map.set(k, { icao: k, roles: [role], window: w });
    else if (!s.roles.includes(role)) s.roles.push(role);
  };
  add(o.header.dep, 'DEP', { from: T - H, to: T + H, basis: 'ETD ±1h' });
  add(o.header.arr, 'DEST', { from: S - H, to: S + H, basis: 'ETA ±1h' });
  const tkMax = (rules?.takeoffAlternate.maxTimeMin[engineCount(o.header.acType)] ?? 120) * 60000;
  for (const a of o.alternates) {
    const r = a.role.toUpperCase();
    if (/TKOF|TAKE ?OFF/.test(r)) add(a.icao, 'TKOF ALTN', { from: T, to: T + tkMax, basis: '이륙 ~ 이륙 교체 시간 한도' });
    else if (/3%/.test(r)) add(a.icao, '3% ERA', { from: S - 0.4 * air - H, to: S, basis: '비행 후반 (3% ERA 위치 부근, 대략)' });
    else if (/ENRT|ERA/.test(r)) add(a.icao, 'ERA', { from: T, to: S, basis: '비행 시간대' });
    else {
      const eta = S + (a.timeMin || 0) * 60000;
      add(a.icao, 'ALTN', { from: eta - H, to: eta + H, basis: '교체공항 ETA ±1h' });
    }
  }
  for (const w of o.edto?.windows ?? []) add(w.icao, 'EDTO', { from: Date.parse(w.from), to: Date.parse(w.to), basis: 'EDTO 사용 시간창 (OFP)' });
  for (const e of o.etps) for (const icao of e.airports) add(icao, 'ETP', { from: Date.parse(e.eto) - H, to: Date.parse(e.eto) + H, basis: `${e.name} ETO ±1h` });
  for (const icao of o.edtoAirports) add(icao, 'ETP', { from: T, to: S, basis: '비행 시간대' });
  for (const p of o.notams?.packages ?? []) for (const l of p.locations) if (/ERA/.test(l.role)) add(l.icao, l.role === '3% ERA' ? '3% ERA' : 'ERA', { from: T, to: S, basis: '비행 시간대' });
  return [...map.values()];
}

// ---------- 판정 도구 ----------
export interface TakeoffLevel {
  kind: 'standard' | 'lower' | 'below';
  need?: string;
  req?: number;
  vis: ReturnType<typeof controllingVis>;
}

export function takeoffLevel(rules: CompanyRules, eng: string, c: Cond): TakeoffLevel | null {
  const tk = rules.takeoff.byEngines[eng];
  if (!tk) return null;
  const v = controllingVis(c);
  const req = (s: { rvr: number; vis?: number }) => (v.kind === 'VIS' ? (s.vis ?? s.rvr) : s.rvr);
  if (v.m == null || v.m >= req(tk.standard)) return { kind: 'standard', vis: v, req: req(tk.standard) };
  const steps = [...tk.lower].sort((a, b) => b.rvr - a.rvr).filter((s) => v.m! >= req(s));
  if (steps.length) return { kind: 'lower', need: steps[0].need, req: req(steps[0]), vis: v };
  return { kind: 'below', vis: v };
}

/** 접근 등급: 0 = 첫 단계(CAT I) 이상 가능 … −1 = 모든 단계 미만. 운고는 DH와 비교(참고) */
export function approachNeed(rules: CompanyRules, c: Cond): number {
  const v = controllingVis(c);
  const lv = rules.approach.levels;
  for (let i = 0; i < lv.length; i++) {
    const req = v.kind === 'VIS' ? (lv[i].vis ?? lv[i].rvr) : lv[i].rvr;
    const visOk = v.m == null || v.m >= req;
    const ceilOk = lv[i].dh == null || c.ceilFt == null || c.ceilFt >= lv[i].dh!;
    if (visOk && ceilOk) return i;
  }
  return -1;
}

export function alternateCheck(rules: CompanyRules, c: Cond): 'belowCat3' | 'belowCat2' | 'ok' {
  const a = rules.alternate;
  const v = controllingVis(c);
  const below = (r: { ceil: number; rvr: number; vis: number }) => (c.ceilFt != null && c.ceilFt < r.ceil) || (v.m != null && v.m < (v.kind === 'RVR' ? r.rvr : r.vis));
  if (below(a.cat3)) return 'belowCat3';
  if (below(a.cat2)) return 'belowCat2';
  return 'ok';
}

/** 활주로 표면: NOTAM 활주로 상태 우선, 없으면 기상 현상 (RA·DZ → Wet = RWYCC 5, 눈·얼음·어는 비 → 오염 가능 = 모름) */
export function surfaceBraking(impacts: Impact[], c: Cond | null): { braking: Braking | 'dry' | null; src: string; contaminated: boolean } {
  const cond = impacts.filter((i) => i.kind === 'rwyCond' && i.braking);
  if (cond.length) {
    const b = cond.map((i) => i.braking!).reduce(worseBraking);
    return { braking: b, src: `NOTAM 활주로 상태 (${cond.map((i) => i.rwycc?.join('/') ?? BRAKING_LABEL[i.braking!]).join(', ')})`, contaminated: b !== 'dry' && b !== 'good' };
  }
  const contam = impacts.some((i) => i.kind === 'rwyCond' && i.contaminant);
  const wx = c?.wx ?? '';
  if (contam || hasSnowIce(wx) || hasFreezing(wx)) return { braking: null, src: contam ? 'NOTAM 오염 물질 (RWYCC 없음)' : `기상 ${wx} → 오염 가능 (RWYCC 확인 필요)`, contaminated: true };
  if (hasRain(wx)) return { braking: 'good', src: `기상 ${wx} → Wet (RWYCC 5 = Good)`, contaminated: false };
  return { braking: 'dry', src: '보고 없음 → Dry 가정 (Good 한계 적용)', contaminated: false };
}

export function windEval(rules: CompanyRules | null, acKey: string | undefined, phase: 'takeoff' | 'landing', c: Cond, gust: boolean, ends: RunwayEnd[], surf: ReturnType<typeof surfaceBraking>): WindEval | undefined {
  const spd = windSpeedFor(c.wspd, c.wgst, !gust);
  if (spd == null) return undefined;
  const ranked = rankEnds(ends, c.wdir, spd);
  const lims = acKey ? rules?.windLimits.byAircraft[acKey] : undefined;
  const limit = lims && surf.braking ? lims[phase][surf.braking === 'dry' ? 'good' : surf.braking] : undefined;
  const ok = limit === undefined ? [] : limit === null ? [] : ranked.filter((e) => e.cross <= limit[0] && (limit[1] == null ? e.tail === 0 : e.tail <= limit[1]));
  return { phase, gust, spd, cond: c, braking: surf.braking, brakingSrc: surf.src, limit, ranked, ok };
}

/** 저온 보정 표에서 "다음으로 더 추운" 행과 높이 열 */
export function coldCorrection(rules: CompanyRules, temp: number, heightFt: number): number | null {
  const ct = rules.coldTemp;
  const row = [...ct.rows].sort((a, b) => b.temp - a.temp).find((r) => r.temp <= temp) ?? ct.rows[ct.rows.length - 1];
  const col = ct.heightsFt.findIndex((h) => h >= heightFt);
  if (!row || col < 0) return null;
  return row.add[col] ?? null;
}

const fmtCond = (c: Cond | null) => (c ? `시정 ${fmtVis(c.visM)}${c.rvr.length ? ` · RVR ${c.rvr.map((r) => `${r.rwy} ${r.qual ?? ''}${r.m}m`).join(', ')}` : ''} · 운고 ${fmtCeil(c.ceilFt)} · 바람 ${fmtWind(c)}${c.wx ? ` · ${c.wx}` : ''}` : '자료 없음');

// ---------- 공항 하나 ----------
function assessAirport(i: BriefInput, slot: Slot, ofpInfo: Record<string, string[]>, altnCount: number): AirportBrief {
  const { o, rules, refs, profile, now } = i;
  const mb = (r: RuleRef | undefined) => manualBasis(refs, r);
  const icao = slot.icao;
  const g = i.geo[icao];
  const w = slot.window;
  const has = (r: Role) => slot.roles.includes(r);
  const isDep = has('DEP');
  const isDest = has('DEST');
  const isAltLike = has('ALTN') || has('TKOF ALTN') || has('3% ERA') || has('EDTO');
  const gustRole = has('3% ERA') || has('EDTO') || isDep || now >= Date.parse(o.header.takeoff);
  const findings: Finding[] = [];
  const push = (f: Omit<Finding, 'icao'>) => findings.push({ ...f, icao });
  const rk = slot.roles.map((r) => ROLE_KO[r]).join('·');

  // 기상
  const m = i.wx.metars[icao]?.data;
  const t = i.wx.tafs[icao]?.data;
  const metar = m ? { cond: metarCond(m), obsTime: m.obsTime, raw: m.raw } : undefined;
  const taf = t ? { ...tafWindow(t, w.from, w.to), raw: t.raw, issueTime: t.issueTime } : undefined;
  const obsInWindow = metar && Date.parse(metar.obsTime) >= w.from - 2 * H && Date.parse(metar.obsTime) <= w.to;
  const base = worst([taf?.base, obsInWindow ? metar!.cond : null].filter((x): x is Cond => !!x));
  const tempC = taf?.temp ?? null;

  // 활주로·NOTAM
  const impacts = airportImpacts(o, icao, [w]);
  const closedRwys = impacts.filter((x) => x.kind === 'rwyClosed').flatMap((x) => x.rwys.flatMap((r) => r.split('/')));
  const runways = airportRunways(icao, ofpInfo[icao], i.runwayDb);
  const usable = runways.ends.filter((e) => !closedRwys.includes(e.id));
  const surf = surfaceBraking(impacts, base);
  const acKey = manualAircraft(o.header.acType);
  const night = g ? isNight(g[0], g[1], (w.from + w.to) / 2) : false;

  const brief: AirportBrief = { icao, name: g?.[2], lat: g?.[0], lon: g?.[1], roles: slot.roles, window: w, metar, taf, base, runways, closedRwys, impacts, restrictions: [], night, findings };
  const wxBasis = [taf ? dataB(`TAF ${t!.issueTime.slice(11, 16)}Z 발표 · 창 ${w.basis}`) : null, obsInWindow ? dataB(metar!.raw) : null].filter((x): x is Basis => !!x);

  // ---- 최저치 (회사 기준 파일 필요) ----
  if (rules && base) {
    if (isDep) {
      const tl = takeoffLevel(rules, engineCount(o.header.acType), base);
      brief.takeoffLevel = tl ?? undefined;
      if (tl?.kind === 'lower')
        push({ group: 'minima', key: `tkof-lower:${icao}`, severity: 'caution', title: `출발 ${icao} Lower than Standard 이륙 — ${tl.need} 필요`, detail: `${tl.vis.kind} ${tl.vis.m}m (기준 ${tl.req}m 이상 단계) · ${rules.takeoff.lowerConditions.join(' · ')}`, basis: [mb(rules.takeoff.ref), ...wxBasis] });
      if (tl?.kind === 'below') push({ group: 'minima', key: `tkof-below:${icao}`, severity: 'warning', title: `출발 ${icao} 회사 이륙 최저치 미만 예보`, detail: `${tl.vis.kind} ${tl.vis.m}m`, basis: [mb(rules.takeoff.ref), ...wxBasis] });
      // 이륙 교체공항 필요 (출발지 기상 < 착륙 최저치 첫 단계)
      if (approachNeed(rules, base) !== 0) {
        const hasTk = o.alternates.some((a) => /TKOF|TAKE ?OFF/i.test(a.role));
        push({ group: 'minima', key: `tkof-altn:${icao}`, severity: 'caution', title: `출발 ${icao} 기상이 ${rules.approach.levels[0].name} 최저치 미만 → 이륙 교체공항 필요 검토`, detail: `${hasTk ? 'OFP에 이륙 교체공항 있음' : 'OFP에 이륙 교체공항 없음'} · 거리 한도 ${rules.takeoffAlternate.maxTimeMin[engineCount(o.header.acType)] ?? '?'}분`, basis: [mb(rules.takeoffAlternate.ref), ...wxBasis] });
      }
    }
    if (isDest || has('ALTN') || has('TKOF ALTN')) {
      const need = approachNeed(rules, base);
      const tneed = taf?.temp ? approachNeed(rules, worst([base, taf.temp])!) : null;
      brief.approachNeed = { base: need, temp: tneed, names: rules.approach.levels.map((l) => l.name) };
      const lvName = (n: number) => (n < 0 ? '모든 단계 미만' : rules.approach.levels[n].name);
      if (isDest) {
        if (need < 0)
          push({ group: 'minima', key: `dest-below:${icao}`, severity: 'warning', title: `목적지 ${icao} 회사 접근 최저치(가장 낮은 단계) 미만 예보`, detail: `${fmtCond(base)} · 목적지 착륙 최저치 미만이면 교체공항 2개 필요 — OFP 목적지 교체 ${altnCount}개`, basis: [mb(rules.approach.ref), mb(rules.dispatch.ref), ...wxBasis] });
        else if (need > 0)
          push({ group: 'minima', key: `dest-cat:${icao}:${need}`, severity: 'caution', title: `목적지 ${icao} ${lvName(need)} 필요 예보`, detail: `${fmtCond(base)} · 차트 최저치가 더 높으면 차트 기준`, basis: [mb(rules.approach.ref), mb(rules.refs.cat23), ...wxBasis] });
        if (tneed != null && (tneed < 0 || tneed > need))
          push({ group: 'minima', key: `dest-marginal:${icao}`, severity: 'caution', title: `목적지 ${icao} 일시적(TEMPO·PROB) ${lvName(tneed)} — Marginal → 교체공항 1개 추가 검토`, detail: `일시적 미달은 미달로 보지 않음 · 교체공항 추가 지정 조건 · ${fmtCond(taf!.temp)}`, basis: [mb(rules.dispatch.ref), ...wxBasis] });
      }
    }
    if (isAltLike) {
      const ac = alternateCheck(rules, base);
      const lbl = `${rk} ${icao}`;
      if (ac === 'belowCat3')
        push({ group: 'minima', key: `altn-below:${icao}`, severity: 'warning', title: `${lbl} 회사 교체공항 최저치 하한 미만 예보`, detail: `${fmtCond(base)} · 하한 ${rules.alternate.cat3.ceil}ft / ${rules.alternate.cat3.vis}m (CAT III 구성)`, basis: [mb(rules.alternate.ref), ...wxBasis] });
      else if (ac === 'belowCat2') {
        const ok = profile.cat3EoConfirmed || !rules.alternate.cat3NeedsEoCapability;
        push({ group: 'minima', key: `altn-cat3:${icao}`, severity: ok ? 'info' : 'caution', title: `${lbl} CAT II 구성 교체 최저치 미만 → CAT III 구성이어야 함`, detail: `${fmtCond(base)} · ${ok ? '설정: 엔진 부작동 CAT III 확인됨' : '엔진 부작동 CAT III 가능 기종인지 회사 확인 필요 (Settings에서 확인 표시)'}`, basis: [mb(rules.alternate.ref), ...wxBasis] });
      } else
        push({ group: 'minima', key: `altn-rule:${icao}`, severity: 'info', briefOnly: true, title: `${lbl} 회사 하한 이상 — 실제 교체 최저치는 차트 + 가산 규칙`, detail: rules.alternate.otherRules.join(' · '), basis: [mb(rules.alternate.ref)] });
      if (taf?.temp && alternateCheck(rules, worst([base, taf.temp])!) !== 'ok')
        push({ group: 'minima', key: `altn-marginal:${icao}`, severity: 'caution', title: `${lbl} 일시적(TEMPO·PROB) 교체 최저치 미달 — 교체공항 추가 검토`, detail: fmtCond(taf.temp), basis: [mb(rules.dispatch.ref), ...wxBasis] });
    }
    // 착륙 거리 계획 기준 (Dry/Wet)
    if (isDest) {
      const v = controllingVis(base);
      const wet = (v.m != null && v.m < rules.landingPlan.wetBelowM) || hasRain(base.wx) || surf.contaminated;
      push({ group: 'ops', key: `ldg-plan:${icao}`, severity: 'info', briefOnly: true, title: `목적지 ${icao} 착륙 거리 계획 = ${wet ? 'Wet' : 'Dry'} 기준`, detail: `시정 ${fmtVis(v.m)} · 기준 ${rules.landingPlan.wetBelowM}m`, basis: [mb(rules.landingPlan.ref)] });
    }
  }

  // ---- 바람·활주로 상태 ----
  const windCond = base;
  if (windCond && usable.length) {
    const phase = isDep ? 'takeoff' : 'landing';
    const we = windEval(rules, acKey, phase, windCond, gustRole, usable, surf);
    brief.wind = we;
    if (we && rules) {
      const lims = acKey ? rules.windLimits.byAircraft[acKey] : undefined;
      const wb = [lims ? mb(lims.ref) : appB('이 기종 바람 제한 없음 (회사 기준 파일)'), mb(rules.wind.applyRef), dataB(`바람 ${fmtWind(windCond)} → ${gustRole ? 'Gust/Max' : 'Steady'} ${we.spd}kt · ${we.brakingSrc}`)];
      if (we.limit === null)
        push({ group: 'wind', key: `wind-nil:${icao}`, severity: 'warning', title: `${rk} ${icao} 활주로 상태 ${BRAKING_LABEL[we.braking!]} — ${phase === 'takeoff' ? '이륙' : '착륙'} 불가 (바람 제한표)`, basis: wb });
      else if (we.limit && !we.ok.length && we.ranked.length) {
        const b = we.ranked[0];
        push({ group: 'wind', key: `wind-over:${icao}`, severity: isDep || isDest ? 'warning' : 'caution', title: `${rk} ${icao} 모든 활주로가 바람 제한 초과`, detail: `가장 나은 ${b.end.id}: 측풍 ${b.cross} · 배풍 ${b.tail}kt (한계 ${we.limit[0]}/${we.limit[1] ?? '불가'}, ${BRAKING_LABEL[we.braking === null ? 'good' : we.braking]})${b.end.approx ? ' · 방위 대략' : ''}`, basis: wb });
      } else if (we.braking === null)
        push({ group: 'wind', key: `surface:${icao}`, severity: 'caution', title: `${rk} ${icao} 활주로 오염 가능 — RWYCC·Braking 확인 후 바람 제한 적용`, detail: we.brakingSrc, basis: [lims ? mb(lims.rcamRef) : appB('RCAM'), lims ? mb(lims.ref) : appB('바람 제한표'), ...wxBasis] });
      const best = we.ok[0] ?? we.ranked[0];
      if (best && best.tail > rules.wind.tailCaptainAbove && (isDep || isDest))
        push({ group: 'wind', key: `tail:${icao}`, severity: 'info', title: `${rk} ${icao} 배풍 ${best.tail}kt (${best.end.id}) — 기장 이착륙`, basis: [mb(rules.wind.ref)] });
    }
  }

  // ---- CAT II/III ----
  if (rules && (isDest || has('ALTN')) && brief.approachNeed && (brief.approachNeed.base > 0 || (brief.approachNeed.temp ?? 0) > 0)) {
    const lims = acKey ? rules.windLimits.byAircraft[acKey] : undefined;
    const best = brief.wind?.ok[0] ?? brief.wind?.ranked[0];
    if (lims && best && best.cross > lims.autoland.crossCat23)
      push({ group: 'wind', key: `autoland-x:${icao}`, severity: 'caution', title: `${rk} ${icao} CAT II/III 예상인데 측풍 ${best.cross}kt > 자동착륙 한계 ${lims.autoland.crossCat23}kt`, basis: [mb(lims.autolandRef), dataB(fmtCond(base))] });
    if (lims?.cat3FailOpNotOnContaminated && surf.contaminated && brief.approachNeed.base >= 2)
      push({ group: 'minima', key: `cat3-contam:${icao}`, severity: 'warning', title: `${rk} ${icao} CAT III 예상 + 활주로 오염 — CAT III Fail-Operational 불가`, detail: surf.src, basis: [mb(lims.autolandRef)] });
    const melAfs = o.mel.filter((x) => /^22-/.test(x.itemNo));
    if (melAfs.length)
      push({ group: 'minima', key: `cat23-mel:${icao}`, severity: 'caution', title: `${rk} ${icao} CAT II/III 예상 — 자동비행 MEL ${melAfs.map((x) => x.itemNo).join(', ')} 영향 확인`, basis: [mb(rules.refs.cat23), appB('MEL 탭에서 원문 확인')] });
  }

  // ---- NOTAM 시설 영향 ----
  const relevantImpact = (x: Impact) => x.time !== 'before' && x.time !== 'after';
  for (const x of impacts.filter(relevantImpact)) {
    const nb = ofpB(x.line, `${x.id ?? ''} ${x.text}`);
    const landing = isDest || isAltLike;
    if (x.kind === 'adClosed') push({ group: 'facility', key: `adclsd:${icao}:${x.line}`, severity: isDep || isDest || isAltLike ? 'warning' : 'caution', title: `${rk} ${icao} 공항 폐쇄 NOTAM (시간대 확인)`, basis: [nb] });
    if (x.kind === 'als' && landing && rules) {
      const v = base ? controllingVis(base).m : null;
      const lowWx = v != null && v < rules.facility.alsInop.vis;
      push({ group: 'facility', key: `als:${icao}:${x.line}`, severity: lowWx ? 'warning' : 'caution', title: `${rk} ${icao} 진입등 고장 ${x.rwys.join(',')} → CAT I 최저치 RVR ${rules.facility.alsInop.rvr} / VIS ${rules.facility.alsInop.vis}m${lowWx ? ' — 예보 시정 미만' : ''}`, basis: [mb(rules.facility.alsInop.ref), nb] });
    }
    if (x.kind === 'edgeLights' && landing && rules) {
      const imc = base ? (base.ceilFt != null && base.ceilFt < 1000) || (base.visM != null && base.visM < 5000) : false;
      push({ group: 'facility', key: `edge:${icao}:${x.line}`, severity: night && imc ? 'warning' : 'caution', title: `${rk} ${icao} 활주로 등화 고장 ${x.rwys.join(',')}${night ? ' · 야간' : ''}${night && imc ? ' + IMC 예보' : ''}`, detail: rules.facility.edgeLightsInop.summary, basis: [mb(rules.facility.edgeLightsInop.ref), nb] });
    }
    if (x.kind === 'clLights' && isDep && rules) push({ group: 'facility', key: `cl:${icao}:${x.line}`, severity: brief.takeoffLevel?.kind === 'lower' ? 'warning' : 'info', title: `출발 ${icao} 중심선등 고장 ${x.rwys.join(',')} — Lower than Standard 이륙 단계 제한`, basis: [mb(rules.takeoff.ref), nb] });
    if (x.kind === 'rvr' && (landing || isDep)) push({ group: 'facility', key: `rvr:${icao}:${x.line}`, severity: 'caution', title: `${rk} ${icao} RVR 장비 고장 ${x.rwys.join(',')}`, detail: '저시정 접근·이륙 단계 제한 (RVR 필요 조건 확인)', basis: [rules ? mb(rules.approach.ref) : appB('회사 기준 파일 없음'), nb] });
    if (x.kind === 'ils' && landing) {
      const lowNeed = (brief.approachNeed?.base ?? 0) > 0;
      push({ group: 'facility', key: `ils:${icao}:${x.line}`, severity: lowNeed ? 'warning' : 'caution', title: `${rk} ${icao} ILS 고장 ${x.rwys.join(',') || ''}${lowNeed ? ' — 저시정 예보' : ''}`, basis: [rules ? mb(rules.approach.ref) : appB('회사 기준 파일 없음'), nb] });
    }
    if (x.kind === 'gnss' && landing) push({ group: 'facility', key: `gnss:${icao}:${x.line}`, severity: 'info', title: `${rk} ${icao} GNSS 제한 NOTAM — RNP/GPS 접근 확인`, detail: '목적지·교체 중 하나는 지상 시설 접근 기준으로 계획', basis: [rules ? mb(rules.refs.rnp) : appB('회사 기준 파일 없음'), nb] });
    if (x.kind === 'rff' && rules && x.rffCat != null && acKey) {
      const cat = rules.rff.aircraftCat[acKey];
      if (cat) {
        const min = isDep || isDest ? cat - rules.rff.depDest.temp : has('EDTO') || has('ERA') || has('ETP') ? rules.rff.eraMin : cat - rules.rff.alternate.temp;
        const below = x.rffCat < min;
        push({ group: 'facility', key: `rff:${icao}:${x.line}`, severity: below ? 'warning' : 'info', briefOnly: !below, title: `${rk} ${icao} 소방등급 CAT ${x.rffCat} NOTAM${below ? ` — 최소 ${min} 미만` : ` (최소 ${min})`}`, detail: `${acKey} 소방등급 ${cat}`, basis: [mb(rules.rff.ref), nb] });
      }
    }
    if (x.kind === 'rwyCond') push({ group: 'facility', key: `rwycond:${icao}:${x.line}`, severity: 'info', briefOnly: true, title: `${rk} ${icao} 활주로 상태 ${x.rwys.join(',')} ${x.rwycc ? `RWYCC ${x.rwycc.join('/')}` : ''} ${x.braking ? BRAKING_LABEL[x.braking] : ''} ${x.contaminant ?? ''}`, basis: [nb] });
  }

  // ---- 활주로 폭 ----
  if (rules && acKey && runways.strips.length) {
    const min = rules.runwayWidthMinFt.byAircraft[acKey];
    const narrow = runways.strips.filter((s) => s.widthFt != null && s.widthFt < (min ?? 0));
    if (min && narrow.length === runways.strips.length && (isDest || isAltLike || isDep))
      push({ group: 'airport', key: `width:${icao}`, severity: 'warning', title: `${rk} ${icao} 모든 활주로 폭이 최소 ${min}ft 미만`, basis: [mb(rules.runwayWidthMinFt.ref)] });
    else if (min && narrow.length) push({ group: 'airport', key: `width-some:${icao}`, severity: 'info', briefOnly: true, title: `${icao} 폭 ${min}ft 미만 활주로: ${narrow.map((s) => s.ids).join(', ')}`, basis: [mb(rules.runwayWidthMinFt.ref)] });
  }

  // ---- 특수공항·공항 제한 ----
  const sp = i.specials.find((s) => s.icao === icao);
  if (sp) {
    brief.special = sp;
    push({ group: 'airport', key: `special:${icao}`, severity: isDep || isDest || has('ALTN') || has('TKOF ALTN') ? 'caution' : 'info', title: `${rk} ${icao} 특수공항 — ${sp.note}`, basis: [{ kind: 'manual', label: `FOM 특수공항 표${sp.ref ? ` · ${sp.ref}` : ''}`, manual: { docId: sp.docId, seq: sp.seq } }, rules ? mb(rules.sections.specialQual) : appB('자격 요건: FOM')] });
  }
  brief.restrictions = i.restrictions.filter((r) => r.icao === icao && sameAircraft(r.aircraft, o.header.acType));
  for (const r of brief.restrictions) push({ group: 'airport', key: `restr:${icao}:${r.seq}`, severity: 'info', title: `${rk} ${icao} 회사 공항 제한 — ${r.title}`, basis: [{ kind: 'manual', label: `FOM ${r.title}${r.ref ? ` · ${r.ref}` : ''}`, manual: { docId: r.docId, seq: r.seq } }] });

  // ---- 위험 기상 ----
  const hz = worst([base, tempC].filter((x): x is Cond => !!x));
  const hzWx = `${hz?.wx ?? ''} ${obsInWindow && /\bWS\b/.test(metar!.raw) ? 'WS' : ''}`;
  if ((isDep || isDest || isAltLike) && hz) {
    const hb = (r: RuleRef | undefined, lbl: string) => (rules ? mb(r) : appB(lbl));
    if (hasTs(hzWx)) push({ group: 'hazard', key: `ts:${icao}`, severity: 'caution', title: `${rk} ${icao} 뇌우 예보·관측 (${hzWx.trim()})`, basis: [hb(rules?.refs.thunderstorm, 'Thunderstorm'), ...wxBasis] });
    if (hasHail(hzWx)) push({ group: 'hazard', key: `gr:${icao}`, severity: 'caution', title: `${rk} ${icao} 우박`, basis: [hb(rules?.refs.thunderstorm, 'Hail'), ...wxBasis] });
    if (/\bWS\b/.test(hzWx)) push({ group: 'hazard', key: `ws:${icao}`, severity: 'caution', title: `${rk} ${icao} Windshear 보고`, basis: [hb(rules?.refs.windshear, 'Windshear'), ...wxBasis] });
    if (hasAsh(hzWx)) push({ group: 'hazard', key: `va:${icao}`, severity: 'warning', title: `${rk} ${icao} 화산재`, basis: [hb(rules?.refs.volcanic, 'Volcanic Ash'), ...wxBasis] });
    if (hasFreezing(hzWx)) push({ group: 'hazard', key: `fz:${icao}`, severity: 'caution', title: `${rk} ${icao} 어는 강수·안개 (${hzWx.trim()})`, basis: [hb(rules?.refs.deicing, 'De/Anti-icing'), ...wxBasis] });
  }
  // 저온 보정 (CTAC)
  const temp = obsInWindow ? metar!.cond.temp : metar?.cond.temp;
  if (rules && temp != null && temp <= rules.coldTemp.applyAtOrBelow && (isDep || isDest || isAltLike)) {
    const c1 = coldCorrection(rules, temp, 1000);
    const c2 = coldCorrection(rules, temp, 2000);
    push({ group: 'hazard', key: `cold:${icao}`, severity: 'caution', title: `${rk} ${icao} 저온 고도 보정 대상 (${temp}°C)`, detail: `공항 위 1000ft → +${c1 ?? '?'}ft · 2000ft → +${c2 ?? '?'}ft (표, METAR 기온 ${metar!.obsTime.slice(11, 16)}Z)`, basis: [mb(rules.coldTemp.ref), dataB(metar!.raw)] });
  }
  // 제빙 예상 (앱 기준 — 매뉴얼 수치 아님, 참고)
  if (isDep && base && (temp ?? 99) <= 5 && /(RA|SN|DZ|FG|BR|PL|SG|FZ)/.test(base.wx))
    push({ group: 'hazard', key: `deice:${icao}`, severity: 'info', briefOnly: true, title: `출발 ${icao} 제빙·방빙 가능성 (기온 ${temp}°C · ${base.wx})`, basis: [appB('앱 기준: 기온 5°C 이하 + 강수·안개 (참고)'), rules ? mb(rules.refs.deicing) : appB('De/Anti-icing')] });

  // ---- 개인 설정 (Low Time·OE) ----
  if (rules && base && (isDep || isDest)) {
    const v = controllingVis(base);
    const best = brief.wind?.ok[0] ?? brief.wind?.ranked[0];
    const lt = rules.lowTime;
    if (profile.lowTimeCaptain && isDest) {
      const rvrReq = lt.captain.rvrTable.find(([chart]) => chart >= rules.approach.levels[0].rvr)?.[1] ?? lt.captain.vis;
      const req = v.kind === 'RVR' ? rvrReq : lt.captain.vis;
      if ((base.ceilFt != null && base.ceilFt < lt.captain.ceil) || (v.m != null && v.m < req))
        push({ group: 'crew', key: `lt-cpt:${icao}`, severity: 'caution', title: `목적지 ${icao} Low Time 기장 착륙 최저치(${lt.captain.ceil}ft / ${req}m) 미만 예보`, detail: `${fmtCond(base)} · 면제 조건: ${lt.captain.exemptions.join(' / ')}`, basis: [mb(lt.captain.ref), ...wxBasis] });
    }
    if (profile.foLowTime) {
      const why: string[] = [];
      if (sp) why.push('특수공항');
      if (v.m != null && v.m <= (v.kind === 'RVR' ? lt.fo.rvrMax : lt.fo.visMax)) why.push(`${v.kind} ${v.m}m`);
      if (best && best.cross > lt.fo.crossMax) why.push(`측풍 ${best.cross}kt`);
      if (surf.braking === null || (surf.braking !== 'dry' && surf.braking !== 'good')) why.push(`활주로 ${surf.braking ? BRAKING_LABEL[surf.braking] : '오염 가능'}`);
      if (/\bWS\b/.test(hzWx)) why.push('Windshear');
      if (why.length) push({ group: 'crew', key: `lt-fo:${icao}`, severity: 'caution', title: `${rk} ${icao} 부기장 Low Time 조건 → 기장이 ${isDep ? '이륙' : '착륙'}`, detail: why.join(' · '), basis: [mb(lt.fo.ref)] });
    }
    if (profile.oeCaptain && (surf.braking === 'mediumPoor' || surf.braking === 'poor' || surf.braking === 'nil'))
      push({ group: 'crew', key: `oe:${icao}`, severity: 'caution', title: `${rk} ${icao} Braking ${BRAKING_LABEL[surf.braking]} — 수습 기장: 교관 이착륙`, basis: [mb(lt.oe.ref)] });
  }
  return brief;
}

// ---------- 비행 전체 ----------
export function buildBrief(i: BriefInput): BriefResult {
  const { o, rules, refs } = i;
  const mb = (r: RuleRef | undefined) => manualBasis(refs, r);
  const slots = flightAirports(o, rules);
  const ofpInfo = ofpRunwayInfo(o);
  const altnCount = o.alternates.filter((a) => !/TKOF|TAKE ?OFF|ERA|3%|ENRT/i.test(a.role)).length;
  const airports = slots.map((s) => assessAirport(i, s, ofpInfo, altnCount));
  const flight: Finding[] = [];
  if (!rules)
    flight.push({ group: 'ops', key: 'no-rules', severity: 'info', title: '회사 기준 파일 없음 — 최저치·바람 제한 판정 안 함', detail: 'Settings → 매뉴얼 → 가져오기에서 company-rules 파일을 넣으면 판정합니다', basis: [appB('D-049 회사 기준 파일')] });
  if (rules) {
    // 3% Contingency: 계획 대비 도착 지연 → OCC 통보
    const uses3 = o.alternates.some((a) => /3%/.test(a.role));
    const dev = i.proj?.timeDevMin;
    if (uses3 && dev != null && dev > rules.contingency3.etaDelayMin)
      flight.push({ group: 'ops', key: 'c3-eta', severity: 'caution', title: `계획 대비 도착 +${Math.round(dev)}분 — OCC/운항관리사 통보 (3% Contingency)`, detail: `기준: ${rules.contingency3.etaDelayMin}분 초과 · 순항고도 ${rules.contingency3.altChangeFt}ft 초과 변경도 통보`, basis: [mb(rules.contingency3.ref), appB('순항 기록의 시간 편차')] });
    // MEL × 항로 요건 (ATA 22 자동비행 · 23 통신 · 34 항법)
    const ata: Record<string, string> = { '22': '자동비행 — CAT II/III·RVSM', '23': '통신 — CPDLC·HF·SATCOM (대양·PBCS 구역)', '34': '항법 — RNP·RVSM·CAT II/III' };
    for (const x of o.mel) {
      const ch = x.itemNo.slice(0, 2);
      if (ata[ch]) flight.push({ group: 'ops', key: `mel-route:${x.itemNo}`, severity: 'info', title: `MEL ${x.itemNo} ${x.title} — ${ata[ch]} 요건 확인`, basis: [appB('ATA 장(22·23·34)으로 고른 확인 항목 — 판정 아님'), appB('MEL 탭에서 원문')] });
    }
  }
  const findings = [...airports.flatMap((a) => a.findings), ...flight];
  return { hasRules: !!rules, rulesSource: rules?.source, airports, flight, findings };
}
