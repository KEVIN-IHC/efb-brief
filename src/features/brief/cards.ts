// 브리핑 카드 초안 (D-054): OFP·기상·판정에서 자동으로 채운 글. 승무원이 고쳐 쓰는 초안이며 판단을 대신하지 않는다.
import { gcDistanceNm, gcInterpolate, type LatLon } from '../../lib/geo';
import { fmtHm, fmtKg } from '../../lib/format';
import type { Projection } from '../inflight/deviation';
import type { OfpData } from '../ofp/types';
import { turbulenceZones } from '../ofp/turbulence';
import { ROLE_KO, type AirportBrief, type BriefResult, type Finding } from './assess';
import { BRAKING_LABEL, IMPACT_LABEL } from './notamImpact';
import type { CrewProfile } from './profile';
import type { CompanyRules, RuleRef } from './rules';
import { fmtCeil, fmtVis, fmtWind, type Cond } from './wx';

export interface BriefCard {
  id: 'joint' | 'takeoff' | 'landing' | 'handover';
  title: string;
  ref?: RuleRef;
  lines: string[];
}

const hhmm = (ms: number | string) => new Date(ms).toISOString().slice(11, 16) + 'Z';
const cond = (c: Cond | null | undefined) => (c ? `${fmtWind(c)} · 시정 ${fmtVis(c.visM)}${c.rvr.length ? ` (RVR ${Math.min(...c.rvr.map((r) => r.m))}m)` : ''} · 운고 ${fmtCeil(c.ceilFt)}${c.wx ? ` · ${c.wx}` : ''}` : '기상 자료 없음');
const top = (fs: Finding[], n = 4) =>
  fs
    .filter((f) => f.severity !== 'info')
    .sort((a, b) => (a.severity === 'warning' ? 0 : 1) - (b.severity === 'warning' ? 0 : 1))
    .slice(0, n)
    .map((f) => `${f.severity === 'warning' ? '⚠' : '•'} ${f.title}`);

function windLine(a: AirportBrief): string | null {
  const w = a.wind;
  if (!w) return null;
  const best = w.ok[0] ?? w.ranked[0];
  if (!best) return null;
  return `바람 ${fmtWind(w.cond)} → ${best.end.id}: 정풍 ${best.head} · 측풍 ${best.cross} · 배풍 ${best.tail}kt${best.end.approx ? ' (방위 대략)' : ''} · 활주로 ${w.braking ? BRAKING_LABEL[w.braking] : '오염 가능'}${w.limit ? ` · 한계 ${w.limit[0]}/${w.limit[1] ?? '불가'}` : ''}`;
}

function impactsLine(a: AirportBrief): string | null {
  const xs = a.impacts;
  if (!xs.length) return null;
  return `NOTAM: ${[...new Set(xs.map((x) => `${IMPACT_LABEL[x.kind]}${x.rwys.length ? ` ${x.rwys.join(',')}` : ''}${x.rffCat != null ? ` CAT ${x.rffCat}` : ''}`))].join(' · ')}`;
}

export function buildCards(o: OfpData, b: BriefResult, rules: CompanyRules | null, profile: CrewProfile, proj: Projection | null): BriefCard[] {
  const dep = b.airports.find((a) => a.roles.includes('DEP'));
  const dest = b.airports.find((a) => a.roles.includes('DEST'));
  const alts = b.airports.filter((a) => a.roles.some((r) => r === 'ALTN' || r === 'TKOF ALTN' || r === '3% ERA' || r === 'EDTO'));
  const turb = turbulenceZones(o.route);
  const h = o.header;
  const cards: BriefCard[] = [];

  cards.push({
    id: 'joint',
    title: '합동 브리핑',
    ref: rules?.refs.briefings.joint,
    lines: [
      `${h.flightNo} ${h.dep}→${h.arr} · ${h.acType} ${h.reg} · ETD ${hhmm(h.takeoff)} ETA ${hhmm(h.sta)} · 비행 ${fmtHm(h.airMin)}`,
      `순항 FL${h.cruiseFl}${h.edtoRule ? ` · ${h.edtoRule}` : ''} · 블록 연료 ${fmtKg(o.fuel.block)} ${o.unit}`,
      turb.length ? `난류 예상: ${turb.map((z) => `${z.from.name}–${z.to.name} ${hhmm(z.from.eto)}~${hhmm(z.to.eto)} (SR ${z.maxSr})`).join(' · ')}` : '난류: OFP SR 주의 구간 없음',
      `목적지 ${h.arr}: ${cond(dest?.base)}`,
      alts.length ? `교체: ${alts.map((a) => `${a.icao}(${a.roles.map((r) => ROLE_KO[r]).join('·')})`).join(', ')}` : '교체공항 정보 없음',
      ...(b.airports.filter((a) => a.special).map((a) => `특수공항 ${a.icao}: ${a.special!.note}`)),
      ...(o.mel.length ? [`MEL/CDL: ${o.mel.map((m) => m.itemNo).join(', ')}`] : []),
      ...top(b.findings, 5),
    ],
  });

  if (dep)
    cards.push({
      id: 'takeoff',
      title: `Takeoff 브리핑 — ${dep.icao}`,
      ref: rules?.refs.briefings.takeoff,
      lines: [
        `기상 (${dep.window.basis}): ${cond(dep.base)}`,
        dep.takeoffLevel ? `이륙 최저치: ${dep.takeoffLevel.kind === 'standard' ? 'Standard 이상' : dep.takeoffLevel.kind === 'lower' ? `Lower than Standard — ${dep.takeoffLevel.need}` : '회사 최저치 미만'}` : `이륙 최저치: ${rules ? '시간 창 기상 없음' : '회사 기준 파일 없음'}`,
        windLine(dep) ?? '바람·활주로: 자료 없음',
        impactsLine(dep) ?? 'NOTAM 영향: 찾은 것 없음 (원문 확인)',
        `이륙 교체: ${o.alternates.filter((a) => /TKOF|TAKE ?OFF/i.test(a.role)).map((a) => a.icao).join(', ') || '없음'}`,
        ...(dep.special ? [`특수공항: ${dep.special.note}`] : []),
        ...(profile.captainHandling || profile.foLowTime ? ['기장 이륙 (개인 설정)'] : []),
        ...top(dep.findings),
      ],
    });

  if (dest)
    cards.push({
      id: 'landing',
      title: `Landing 브리핑 — ${dest.icao}`,
      ref: rules?.refs.briefings.landing,
      lines: [
        `기상 (${dest.window.basis}): ${cond(dest.base)}${dest.taf?.temp ? ` · 일시적 ${cond(dest.taf.temp)}` : ''}`,
        dest.approachNeed ? `접근: ${dest.approachNeed.base < 0 ? '회사 최저치 미만 예보' : `${dest.approachNeed.names[dest.approachNeed.base]} 가능 예보`}` : `접근 등급: ${rules ? '시간 창 기상 없음' : '회사 기준 파일 없음'}`,
        windLine(dest) ?? '바람·활주로: 자료 없음',
        impactsLine(dest) ?? 'NOTAM 영향: 찾은 것 없음 (원문 확인)',
        `계획 착륙 연료 ${fmtKg(o.route[o.route.length - 1]?.fuelRem)} ${o.unit} · ALTN+FINAL ${fmtKg(o.fuel.alternate + o.fuel.finalReserve)}`,
        alts.length ? `교체: ${alts.map((a) => `${a.icao} ${cond(a.base)}`).join(' / ')}` : '교체공항 정보 없음',
        ...(dest.special ? [`특수공항: ${dest.special.note}`] : []),
        ...dest.restrictions.map((r) => `회사 제한: ${r.title}`),
        ...top(dest.findings),
      ],
    });

  cards.push({
    id: 'handover',
    title: '승무원 교대',
    ref: rules?.refs.briefings.handover,
    lines: proj?.last
      ? [
          `마지막 기록 ${proj.last.w.name} · 시간 편차 ${proj.timeDevMin >= 0 ? '+' : ''}${proj.timeDevMin}분 · 수정 ETA ${hhmm(proj.eta)}`,
          `착륙 예상 연료 ${fmtKg(proj.landingIfPlanBurn ?? proj.plannedLanding)} ${o.unit} (계획 ${fmtKg(proj.plannedLanding)})`,
          `목적지 ${h.arr}: ${cond(dest?.base)}`,
          ...top(b.findings, 4),
        ]
      : ['순항 기록이 아직 없음 — Inflight 탭에서 기록하면 채워집니다'],
  });
  return cards;
}

// ---------- 회항 후보 ----------
export interface DivCandidate {
  a: AirportBrief;
  distNm: number | null;
  warn: number;
  caution: number;
  longestFt: number | null;
}

/** 지금 위치 (순항 기록 시간 편차 반영, 경로 위 보간). 비행 전 = 출발, 후 = 도착 */
export function currentPosition(o: OfpData, now: number, timeDevMin = 0): LatLon | null {
  const r = o.route.filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lon));
  if (!r.length) return null;
  const t = now - timeDevMin * 60000;
  if (t <= Date.parse(r[0].eto)) return r[0];
  for (let i = 1; i < r.length; i++) {
    const a = Date.parse(r[i - 1].eto);
    const b = Date.parse(r[i].eto);
    if (t <= b) return gcInterpolate(r[i - 1], r[i], b > a ? (t - a) / (b - a) : 1);
  }
  return r[r.length - 1];
}

export function diversionList(b: BriefResult, pos: LatLon | null): DivCandidate[] {
  return b.airports
    .filter((a) => !a.roles.includes('DEP') || a.roles.length > 1)
    .map((a) => ({
      a,
      distNm: pos && a.lat != null && a.lon != null ? Math.round(gcDistanceNm(pos, { lat: a.lat, lon: a.lon })) : null,
      warn: a.findings.filter((f) => f.severity === 'warning').length,
      caution: a.findings.filter((f) => f.severity === 'caution').length,
      longestFt: a.runways.strips.reduce<number | null>((m, s) => (s.lenFt != null && (m == null || s.lenFt > m) ? s.lenFt : m), null),
    }))
    .sort((x, y) => (x.distNm ?? 1e9) - (y.distNm ?? 1e9));
}
