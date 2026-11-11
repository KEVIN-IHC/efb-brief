// OFP NOTAM → 운항 영향 (D-051): 시설 고장·폐쇄·소방등급·GNSS·활주로 상태(RWYCC)
// "사용 불가" 낱말(U/S·OTS·CLSD…)이 같이 있어야 고장으로 본다 (IAP 개정 알림 등은 제외).
// 해석이 틀릴 수 있으므로 항상 원문 줄(OFP 원문 L…)을 함께 보여 준다. 숨기지 않는다.
import { timeStatus, type Window } from '../notam/relevance';
import type { OfpData, OfpNotamItem } from '../ofp/types';

export type ImpactKind = 'adClosed' | 'rwyClosed' | 'als' | 'edgeLights' | 'clLights' | 'rvr' | 'ils' | 'gnss' | 'rff' | 'rwyCond' | 'width';

export const IMPACT_LABEL: Record<ImpactKind, string> = {
  adClosed: '공항 폐쇄',
  rwyClosed: '활주로 폐쇄',
  als: '진입등(ALS) 고장',
  edgeLights: '활주로 등화(Edge) 고장',
  clLights: '활주로 중심선등(CL) 고장',
  rvr: 'RVR 장비 고장',
  ils: 'ILS 고장',
  gnss: 'GNSS(GPS) 제한',
  rff: '소방등급',
  rwyCond: '활주로 상태',
  width: '활주로 폭 축소',
};

export type Braking = 'good' | 'goodMedium' | 'medium' | 'mediumPoor' | 'poor' | 'nil';

/** RWYCC → Braking Action (ICAO GRF / FAA RCAM 공통 대응) */
export const RWYCC_BRAKING: Record<number, Braking | 'dry'> = { 6: 'dry', 5: 'good', 4: 'goodMedium', 3: 'medium', 2: 'mediumPoor', 1: 'poor', 0: 'nil' };
export const BRAKING_LABEL: Record<Braking | 'dry', string> = {
  dry: 'Dry',
  good: 'Good',
  goodMedium: 'Good to Medium',
  medium: 'Medium',
  mediumPoor: 'Medium to Poor',
  poor: 'Poor',
  nil: 'Nil',
};
const BRAKING_ORDER: (Braking | 'dry')[] = ['dry', 'good', 'goodMedium', 'medium', 'mediumPoor', 'poor', 'nil'];
export const worseBraking = (a: Braking | 'dry', b: Braking | 'dry') => (BRAKING_ORDER.indexOf(a) >= BRAKING_ORDER.indexOf(b) ? a : b);

export interface Impact {
  kind: ImpactKind;
  icao: string;
  /** 관련 활주로 (있으면) */
  rwys: string[];
  /** 소방등급 숫자 */
  rffCat?: number;
  /** 활주로 상태: 3구간 RWYCC, 가장 나쁜 Braking */
  rwycc?: number[];
  braking?: Braking | 'dry';
  contaminant?: string;
  text: string;
  line: number;
  id?: string;
  time: ReturnType<typeof timeStatus>;
}

const OUT = /\b(U\/S|UNSERVICEABLE|OTS|OUT OF SERVICE|UNUSBL|UNUSABLE|NOT AVBL|NOT AVAILABLE|UNAVBL|INOP|WITHDRAWN|CLSD|CLOSED)\b/;
const RWY_RE = /\bRWY\s*(\d{2}[LRC]?(?:\/\d{2}[LRC]?)?)/g;

const PATTERNS: { kind: ImpactKind; re: RegExp; needOut: boolean }[] = [
  { kind: 'adClosed', re: /\b(AD|AERODROME|AIRPORT)\s+(CLSD|CLOSED)\b/, needOut: false },
  { kind: 'als', re: /\b(ALS|ALSF-?[12]|MALSR?|SSALR|SALS|APCH\s+(LGT|LIGHT)S?|APPROACH\s+LIGHT(ING|S)?(\s+SYSTEM)?|PALS|CALVERT)\b/, needOut: true },
  { kind: 'edgeLights', re: /\b(EDGE\s+(LGT|LIGHT)S?|HIRL|MIRL|REDL|RWY\s+LGT(S)?)\b/, needOut: true },
  { kind: 'clLights', re: /\b(RCLL?|CL\s+(LGT|LIGHT)S?|CENTRE\s*LINE\s+(LGT|LIGHT)S?|CENTER\s*LINE\s+(LGT|LIGHT)S?)\b/, needOut: true },
  { kind: 'rvr', re: /\bRVR\b/, needOut: true },
  { kind: 'ils', re: /\b(ILS|LOC|LLZ|GP|GS|GLIDE\s*PATH|GLIDE\s*SLOPE|LOCALI[SZ]ER)\b/, needOut: true },
  { kind: 'gnss', re: /\b(RAIM\s+OUTAGE|GPS|GNSS)\b.*\b(OUTAGE|U\/S|UNRELIABLE|UNAVBL|NOT AVBL|INTERFERENCE|JAMMING|SPOOFING)\b|\bRAIM\s+OUTAGES?\b/, needOut: false },
  { kind: 'width', re: /\bWIDTH\b.*\b(REDUCED|AVBL)\b/, needOut: false },
];

/** 활주로 상태: "15L 5/5/3", "RWYCC 5/5/3", "FICON 5/5/3", 브레이킹 액션 */
export function parseRwyCond(body: string): { rwys: string[]; rwycc?: number[]; braking?: Braking | 'dry'; contaminant?: string } | null {
  const cc = /\b(?:RWY\s*)?(\d{2}[LRC]?)?\s*(?:RWYCC|FICON|RCC)?\s*\b([0-6])\/([0-6])\/([0-6])\b/.exec(body);
  const ba = /\b(?:BRAKING ACTION|BRKG ACT(?:ION)?|BA)\s+(GOOD TO MEDIUM|MEDIUM TO POOR|GOOD|MEDIUM|MEDIUM-POOR|POOR|NIL|LESS THAN POOR)\b/.exec(body);
  const cont = /\b(STANDING WATER|SLUSH|WET SNOW|DRY SNOW|COMPACTED SNOW|WET ICE|ICE|FROST|SNOW)\b/.exec(body);
  const isCond = cc && /(RWYCC|FICON|RCC|SNOWTAM|\bRWY\b)/.test(body);
  if (!isCond && !ba) return null;
  let braking: Braking | 'dry' | undefined;
  let rwycc: number[] | undefined;
  if (isCond && cc) {
    rwycc = [Number(cc[2]), Number(cc[3]), Number(cc[4])];
    braking = RWYCC_BRAKING[Math.min(...rwycc)];
  }
  if (ba) {
    const k = ba[1].replace('-', ' TO ');
    const b: Braking = k === 'GOOD TO MEDIUM' ? 'goodMedium' : k === 'MEDIUM TO POOR' ? 'mediumPoor' : k === 'GOOD' ? 'good' : k === 'MEDIUM' ? 'medium' : k === 'POOR' ? 'poor' : 'nil';
    braking = braking ? worseBraking(braking, b) : b;
  }
  const rwys = cc?.[1] ? [cc[1]] : [...new Set([...body.matchAll(RWY_RE)].map((m) => m[1]))];
  return { rwys, rwycc, braking, contaminant: cont?.[1] };
}

export function itemImpacts(icao: string, it: OfpNotamItem, wins: Window[]): Impact[] {
  if (it.kind === 'text') return [];
  const body = it.text.toUpperCase().replace(/\s+/g, ' ');
  // 절차 개정 알림(IAP … AMDT)은 고장이 아님
  const iapAmend = /^\s*IAP\b/.test(body) && !OUT.test(body);
  const time = timeStatus(it, wins);
  if (time === 'before' || time === 'after') return [];
  const rwys = [...new Set([...body.matchAll(RWY_RE)].map((m) => m[1]))];
  const base = { icao, rwys, text: it.text.trim(), line: it.line, id: it.id, time };
  const out: Impact[] = [];
  if (!iapAmend) {
    for (const p of PATTERNS) {
      if (!p.re.test(body)) continue;
      if (p.needOut && !OUT.test(body)) continue;
      out.push({ ...base, kind: p.kind });
    }
    // 활주로 폐쇄 (공항 폐쇄·유도로 폐쇄 제외)
    if (/\bRWY\s*\d{2}[LRC]?(?:\/\d{2}[LRC]?)?\s+(CLSD|CLOSED)\b/.test(body) && !/\bTWY\b[^.]*\bBTN\b/.test(body)) out.push({ ...base, kind: 'rwyClosed' });
  }
  const rff = /\b(?:RFF|FIRE(?:\s+FIGHTING)?(?:\s+AND\s+RESCUE)?|RESCUE\s+AND\s+FIRE(?:\s+FIGHTING)?|ARFF|AD\s+CAT(?:EGORY)?\s+FOR\s+RFF)\b[^.]{0,40}?\bCAT(?:EGORY)?\s*(\d{1,2})\b/.exec(body);
  if (rff) out.push({ ...base, kind: 'rff', rffCat: Number(rff[1]) });
  const cond = parseRwyCond(body);
  if (cond) out.push({ ...base, kind: 'rwyCond', rwys: cond.rwys.length ? cond.rwys : rwys, rwycc: cond.rwycc, braking: cond.braking, contaminant: cond.contaminant });
  return out;
}

/** 공항별 영향 (OFP 패키지 1·2의 같은 공항은 합침) */
export function airportImpacts(o: OfpData, icao: string, wins: Window[]): Impact[] {
  const out: Impact[] = [];
  const seen = new Set<number>();
  for (const p of o.notams?.packages ?? [])
    for (const l of p.locations) {
      if (l.icao !== icao || l.role === 'FIR') continue;
      for (const it of l.items) {
        if (seen.has(it.line)) continue;
        seen.add(it.line);
        out.push(...itemImpacts(icao, it, wins));
      }
    }
  return out;
}
