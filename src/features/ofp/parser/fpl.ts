// ICAO ATS 비행계획(FPL) 메시지 해석 — ICAO Doc 4444 (PANS-ATM) Appendix 2/3 형식
// (FPL-편명-비행규칙·종류-기종/후류-장비-출발공항EOBT-속도고도 항로-목적지EET 교체-기타정보)
// 항공사·OFP 시스템과 무관한 국제 표준이라 샘플 없이도 정확히 해석 가능.
import { isPageNoise } from './lines';
import type { DocLine } from './types';

export interface FplData {
  acid: string; // Item 7 항공기 식별부호 (편명)
  flightRules: string; // Item 8 I/V/Y/Z
  flightType: string; // Item 8 S/N/G/M/X
  acType: string; // Item 9
  wake: string;
  equipment: string; // Item 10
  dep: string; // Item 13
  eobt: string; // HHMM
  speed: string; // Item 15 (예: N0490)
  level: string; // Item 15 (예: F330)
  route: string; // Item 15 항로
  dest: string; // Item 16
  eet: string; // HHMM
  altns: string[];
  item18: Record<string, string>;
}

// Item 18 지시자 (ICAO Doc 4444 Appendix 2) — 이 목록에 있는 것만 키로 인식 (RMK 안의 '/'를 잘못 자르지 않도록)
const ITEM18_KEYS = [
  'STS', 'PBN', 'NAV', 'COM', 'DAT', 'SUR', 'DEP', 'DEST', 'DOF', 'REG', 'EET', 'SEL', 'TYP', 'CODE',
  'DLE', 'OPR', 'ORGN', 'PER', 'ALTN', 'RALT', 'TALT', 'RIF', 'RMK',
];
const ITEM18_RE = new RegExp(`(?:^|\\s)(${ITEM18_KEYS.join('|')})\\/`, 'g');

export function parseItem18(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const hits = [...s.matchAll(ITEM18_RE)];
  hits.forEach((m, i) => {
    const key = m[1];
    const valStart = (m.index ?? 0) + m[0].length;
    const valEnd = i + 1 < hits.length ? hits[i + 1].index! : s.length;
    const val = s.slice(valStart, valEnd).trim();
    out[key] = out[key] ? `${out[key]} ${val}` : val;
  });
  return out;
}

/** FPL 메시지 문자열 → 구조. 형식이 맞지 않으면 null */
export function parseFpl(text: string): FplData | null {
  const s = text.replace(/\s+/g, ' ').trim();
  const open = s.indexOf('(FPL-');
  const close = s.lastIndexOf(')');
  if (open < 0 || close <= open) return null;
  const body = s.slice(open + 1, close);
  const parts = body.split('-').map((p) => p.trim());
  // [0]FPL [1]ACID [2]규칙·종류 [3]기종/후류 [4]장비 [5]출발+EOBT [6]속도고도+항로 [7]목적지+EET+교체 [8..]Item18
  if (parts.length < 8 || parts[0] !== 'FPL') return null;

  const [, acid, rulesType, typeWake, equipment, depPart, routePart, destPart, ...rest] = parts;
  const dep = /^([A-Z]{4})(\d{4})$/.exec(depPart);
  const sl = /^([NKM]\d{3,4})(F\d{3}|A\d{3}|S\d{4}|M\d{4}|VFR)\s*(.*)$/.exec(routePart);
  const destTokens = destPart.split(' ').filter(Boolean);
  const dst = /^([A-Z]{4})(\d{4})$/.exec(destTokens[0] ?? '');
  if (!/^[A-Z0-9]{2,7}$/.test(acid) || !dep || !sl || !dst) return null;

  const [acType, wake = ''] = typeWake.split('/');
  return {
    acid,
    flightRules: rulesType[0] ?? '',
    flightType: rulesType[1] ?? '',
    acType,
    wake,
    equipment,
    dep: dep[1],
    eobt: dep[2],
    speed: sl[1],
    level: sl[2],
    route: sl[3].trim(),
    dest: dst[1],
    eet: dst[2],
    altns: destTokens.slice(1).filter((t) => /^[A-Z]{4}$/.test(t)),
    // Item 18 값 안의 '-'는 split으로 잘렸으므로 다시 붙임 (Item 19는 Aviator OFP에 거의 없음)
    item18: parseItem18(rest.join('-')),
  };
}

/** 섹션 줄들에서 첫 FPL 블록(괄호 짝이 맞을 때까지)을 잘라냄 */
export function cutFplBlock(lines: DocLine[]): { text: string; lines: DocLine[] } | null {
  const startIdx = lines.findIndex((l) => l.text.includes('(FPL-'));
  if (startIdx < 0) return null;
  let depth = 0;
  const taken: DocLine[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    if (isPageNoise(lines[i].text)) continue; // 페이지 경계에 걸친 FPL
    const t = i === startIdx ? lines[i].text.slice(lines[i].text.indexOf('(FPL-')) : lines[i].text;
    taken.push(lines[i]);
    for (const ch of t) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    if (depth <= 0) {
      const raw = taken.map((l, k) => (k === 0 ? t0(l.text) : l.text)).join('\n');
      const end = raw.lastIndexOf(')');
      return { text: raw.slice(0, end + 1), lines: taken };
    }
  }
  return null; // 괄호가 닫히지 않음
}
const t0 = (s: string) => s.slice(s.indexOf('(FPL-'));

/** "261105" → "2026-11-05" */
export function dofToDate(dof?: string): string | undefined {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(dof ?? '');
  return m ? `20${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/** 두 FPL 비교 (OFP 안 FPL ↔ ATS 제출 FPL 일치 확인) */
export function compareFpl(a: FplData, b: FplData): string[] {
  const diffs: string[] = [];
  const cmp = (k: string, x: string, y: string) => x !== y && diffs.push(`${k}: ${x} ≠ ${y}`);
  cmp('편명', a.acid, b.acid);
  cmp('기종', a.acType, b.acType);
  cmp('출발', a.dep, b.dep);
  cmp('EOBT', a.eobt, b.eobt);
  cmp('목적지', a.dest, b.dest);
  cmp('속도/고도', a.speed + a.level, b.speed + b.level);
  cmp('항로', a.route, b.route);
  cmp('교체', a.altns.join(' '), b.altns.join(' '));
  return diffs;
}
