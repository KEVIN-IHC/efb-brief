// 항로·OFP 번호 일치 확인 (D-067)
// 같은 OFP 안에서 항로가 나오는 곳(CFP 요약 항로·OFP FPL·제출된 ATS FPL 사본·NAV LOG)과
// OFP 번호가 나오는 곳(CFP PLAN·디스패치 PLAN #·REQUEST NO.)을 모두 찾아 서로 같은지 본다.
// 표기 차이(.. ↔ DCT, 속도·고도 변경점, 같은 항로 위 중간 지점, N07E142 ↔ 07N142E)는 같은 것으로 본다.
import { cutFplBlock, parseFpl } from './fpl';
import { isPageNoise } from './lines';
import type { DocLine } from './types';

export interface RouteSource {
  where: string; // 예: CFP 요약 항로 (1)
  line: number;
  ok: boolean;
  /** 다를 때: 처음 다른 곳 */
  diff?: string;
}
export interface OfpRouteCheck {
  planNo: { ok: boolean; value?: string; sources: { where: string; value: string; line: number; ok: boolean }[] };
  route: { ok: boolean; sources: RouteSource[]; key: string[] };
}

const COORD_CFP = /^([NS])(\d{2,4})([EW])(\d{3,5})$/; // N07E142 · N4620W07805
const COORD_FPL = /^(\d{2,4})([NS])(\d{3,5})([EW])$/; // 07N142E
const coord = (t: string) => {
  let m = COORD_CFP.exec(t);
  if (m) return `${m[2]}${m[1]}${m[4]}${m[3]}`;
  m = COORD_FPL.exec(t);
  return m ? t : null;
};
/** 항로 이름 (A123, Y456, UL888, OTR5, NCA12…) — 숫자가 들어 있고 좌표가 아닌 짧은 토큰 */
export const isAirway = (t: string) => !coord(t) && /^[A-Z]{1,3}\d{1,4}[A-Z]?$/.test(t);
/** SID·STAR (IRNMN2, BOPTA1A …) — 출발·도착 끝에서만 */
const isProc = (t: string) => /^[A-Z]{3,6}\d[A-Z]?$/.test(t) && !/^[A-Z]{1,3}\d{1,4}$/.test(t);

/** 항로 글 → 비교용 열 (지점·항로 이름) */
export function routeKey(text: string, dep?: string, dest?: string): string[] {
  let t = text
    .replace(/\.\./g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x.split('/')[0]) // WPTAA/N0480F340 → WPTAA
    .filter((x) => x !== 'DCT' && !/^[NKM]\d{3,4}(F|A|S|M)\d{3,4}$/.test(x))
    .map((x) => coord(x) ?? x);
  if (dep && t[0] === dep) t = t.slice(1);
  if (dest && t[t.length - 1] === dest) t = t.slice(0, -1);
  // 출발·도착 절차(SID/STAR)는 OFP와 제출 FPL이 다를 수 있다고 회사가 안내 → 비교에서 뺌
  while (t.length && isProc(t[0])) t = t.slice(1);
  while (t.length && isProc(t[t.length - 1])) t = t.slice(0, -1);
  // 같은 항로 위 중간 지점: A123 WPTAA A123 → A123
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 1; i < t.length - 1; i++)
      if (isAirway(t[i - 1]) && t[i - 1] === t[i + 1] && !isAirway(t[i])) {
        t = [...t.slice(0, i), ...t.slice(i + 2)];
        changed = true;
        break;
      }
  }
  return t;
}

function firstDiff(a: string[], b: string[]): string | undefined {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return `${i ? `${a[i - 1]} 다음 ` : ''}${a[i] ?? '(끝)'} ↔ ${b[i] ?? '(끝)'}`;
  return undefined;
}

/** CFP 요약 항로: "2ND-$" 다음 줄부터 NAV LOG 머리(DIST …) 전까지 */
function cfpRoutes(lines: DocLine[]): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  lines.forEach((l, i) => {
    if (!/^2ND-\$/.test(l.text.trim())) return;
    const parts: string[] = [];
    let first = 0;
    for (let k = i + 1; k < Math.min(lines.length, i + 12); k++) {
      const t = lines[k].text.trim();
      if (!t || isPageNoise(t)) continue;
      if (/^DIST\b/.test(t) || /LATITUDE/.test(t)) break;
      if (!/^[A-Z0-9]+(\.\.|\s|$)/.test(t)) break;
      first ||= lines[k].n;
      parts.push(t);
    }
    if (parts.length) out.push({ text: parts.reduce((acc, p) => (acc.endsWith('..') || !acc ? acc + p : `${acc} ${p}`), ''), line: first });
  });
  return out;
}

export function checkRouteConsistency(lines: DocLine[], navNames: string[], dep: string, dest: string): OfpRouteCheck {
  // ---- OFP 번호 ----
  const pn: { where: string; value: string; line: number; ok: boolean }[] = [];
  let cfpN = 0;
  for (const l of lines) {
    const t = l.text;
    let m: RegExpExecArray | null;
    if ((m = /CFP PLAN\s+(\d+)/.exec(t))) pn.push({ where: `CFP PLAN (${++cfpN})`, value: m[1], line: l.n, ok: true });
    else if ((m = /PLAN\s*#\s*(\d+)/.exec(t))) pn.push({ where: '디스패치 릴리스 PLAN #', value: m[1], line: l.n, ok: true });
    else if ((m = /REQUEST NO\.\s*(\d+)/.exec(t))) pn.push({ where: 'DATAPLAN REQUEST NO.', value: m[1], line: l.n, ok: true });
  }
  pn.sort((a, b) => a.line - b.line);
  const norm = (v: string) => String(Number(v));
  const ref = pn[0]?.value;
  for (const p of pn) p.ok = norm(p.value) === norm(ref!);

  // ---- 항로 ----
  const srcs: (RouteSource & { key: string[] })[] = [];
  cfpRoutes(lines).forEach((r, i, arr) => srcs.push({ where: `CFP 요약 항로${arr.length > 1 ? ` (${i + 1})` : ''}`, line: r.line, ok: true, key: routeKey(r.text, dep, dest) }));
  let ofpFpl = 0;
  lines.forEach((l, i) => {
    if (!l.text.includes('(FPL-')) return;
    const blk = cutFplBlock(lines.slice(i));
    const f = blk && parseFpl(blk.text);
    if (!f || !blk) return;
    if (f.dep !== dep || f.dest !== dest) return; // 다른 구간(회항·재출발 계획 등)은 비교 대상 아님
    const end = lines.indexOf(blk.lines[blk.lines.length - 1]);
    const after = lines.slice(end + 1, end + 4).map((x) => x.text).join(' ');
    const copy = /COPY OF ATS FPL/.test(after);
    srcs.push({ where: copy ? '제출된 ATS FPL 사본' : `OFP FPL (${++ofpFpl})`, line: l.n, ok: true, key: routeKey(f.route, dep, dest) });
  });
  srcs.sort((a, b) => a.line - b.line);
  const base = srcs.find((s) => s.where.startsWith('제출된')) ?? srcs[0];
  for (const s of srcs) {
    const d = base ? firstDiff(base.key, s.key) : undefined;
    s.ok = !d;
    if (d) s.diff = d;
  }
  // NAV LOG: 항로의 지점이 같은 순서로 모두 나오는지
  if (base && navNames.length) {
    const fixes = base.key.filter((t) => !isAirway(t));
    let j = 0;
    let missing: string | undefined;
    for (const fx of fixes) {
      const k = navNames.indexOf(fx, j);
      if (k < 0) {
        missing = fx;
        break;
      }
      j = k + 1;
    }
    srcs.push({ where: 'NAV LOG 지점 순서', line: 0, ok: !missing, ...(missing && { diff: `${missing} 없음(또는 순서 다름)` }), key: [] });
  }
  return {
    planNo: { ok: pn.length >= 2 && pn.every((p) => p.ok), value: ref, sources: pn },
    route: { ok: srcs.length >= 2 && (base?.key.length ?? 0) >= 2 && srcs.every((s) => s.ok), sources: srcs.map(({ key: _k, ...s }) => s), key: base?.key ?? [] },
  };
}
