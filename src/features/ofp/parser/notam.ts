// Aviator NOTAM PACKAGE 1/2/3 구조 추출 (Phase 4).
// 샘플 10개로 확인한 형식 (docs/DECISIONS.md D-043):
//   패키지 시작   "NOTAM      PACKAGE 1" (낱말 사이 공백 제각각, 앞에 항공사명이 붙기도 함)
//   패키지 끝     "END OF PACKAGE 1 FOR …" / "END OF NOTAM PACKAGE 2 FOR …"
//   공항·FIR 머리 "[DEP]ZZAA/ AAA/ 이름, 도시, 국가" · "[FIR] ZZZZ/ 이름, 국가"
//   분류 제목     "◼ RUNWAY"
//   NOTAM 머리    "05NOV26 10:00 - 05NOV26 14:00      ZZAA A0001/26"  (끝: 날짜 | UFN | PERM)
//   회사 권고     " 1. 01NOV26 00:00 - UFN      ZZAA COAD01/26"
//   본문 필드     D) E) F) G) COMMENT)  — Q) 줄은 OFP에 없음
// 원칙(D-014): 패키지 안의 모든 줄은 어딘가에 들어간다(조용히 버리지 않음). 페이지 꼬리말만 제외.
import type { OfpNotamItem, OfpNotamLocation, OfpNotamPackage, OfpNotams, SrcText } from '../types';
import { isPageNoise } from './lines';
import type { DocLine } from './types';

export const NOTAM_PKG_START = /^\s*(?:[A-Z]+\s+)*NOTAM\s+PACKAGE\s+([123])\s*$/;
export const NOTAM_PKG_END = /^\s*END\s+OF\s+.*PACKAGE\s+([123])\s+FOR\b/;
const LOC_HEAD = /^\s*\[([A-Z0-9% ]+?)\]\s*([A-Z0-9]{4})\/\s*(.*)$/;
const CAT_HEAD = /^\s*◼\s*(.+?)\s*$/;
export const ITEM_HEAD =
  /^\s*(?:(\d+)\.\s+)?(\d{2}[A-Z]{3}\d{2})\s+(\d{2}:\d{2})\s*-\s*(UFN|PERM|\d{2}[A-Z]{3}\d{2}\s+\d{2}:\d{2})(?:\s+EST)?\s+([A-Z0-9]{4})\s+(\S.*?)\s*$/;
/** 누락 점검용 느슨한 머리 줄 (날짜 시각 - 로 시작) */
const LOOSE_HEAD = /^\s*(?:\d+\.\s+)?\d{2}[A-Z]{3}\d{2}\s+\d{2}:\d{2}\s*-/;
const SEE_ALSO = /SEE THE SAME AIRPORT IN PACKAGE\s+(\d)/;
const NO_NOTAMS = /NO CURRENT NOTAMS FOUND/;
const FIELD = /^\s*(D|E|F|G|COMMENT)\)\s?(.*)$/;

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "05NOV26" + "10:00" → ISO UTC */
export function notamTime(date: string, hm: string): string | undefined {
  const m = /^(\d{2})([A-Z]{3})(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(hm);
  const mon = m ? MON.indexOf(m[2]) : -1;
  if (!m || !t || mon < 0) return undefined;
  const ms = Date.UTC(2000 + Number(m[3]), mon, Number(m[1]), Number(t[1]), Number(t[2]));
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const src = (l: DocLine): SrcText => ({ n: l.n, text: l.text.replace(/\s+$/, '') });

/** 머리 줄 → 항목 뼈대 */
function startItem(m: RegExpExecArray, line: DocLine, category: string, categoryLine?: number): OfpNotamItem {
  const [, seq, fd, ft, to, loc, id] = m;
  const toText = clean(to);
  const open = toText === 'UFN' || toText === 'PERM' ? (toText as 'UFN' | 'PERM') : undefined;
  const [td, tt] = open ? [] : toText.split(' ');
  const idc = clean(id);
  const company = /^COAD/.test(idc) || (!!seq && /COMPANY/.test(category));
  return {
    kind: company ? 'company' : 'notam',
    id: idc,
    loc,
    category,
    categoryLine,
    fromText: `${fd} ${ft}`,
    toText,
    from: notamTime(fd, ft),
    to: open ? undefined : notamTime(td, tt),
    open,
    text: '',
    line: line.n,
    lines: [src(line)],
  };
}

/** 본문 줄 → E)/D)/F)/G)/COMMENT) 필드 채우기 */
function fillFields(it: OfpNotamItem) {
  const body = it.lines.slice(it.kind === 'text' ? 0 : 1).map((l) => l.text);
  if (it.kind !== 'notam') {
    it.text = body.map((s) => s.trim()).join('\n');
    return;
  }
  const f: Record<string, string[]> = {};
  let cur: string | null = null;
  for (const s of body) {
    const m = FIELD.exec(s);
    if (m) {
      cur = m[1];
      let rest = m[2];
      // "F)SFC G)UNL" 처럼 한 줄에 두 필드
      const g = /\bG\)\s*(.*)$/.exec(rest);
      if (cur === 'F' && g) {
        (f.G ??= []).push(g[1]);
        rest = rest.slice(0, g.index);
      }
      (f[cur] ??= []).push(rest.trim());
    } else (f[cur ?? 'E'] ??= []).push(s.trim());
  }
  const j = (k: string) => (f[k] ? f[k].filter(Boolean).join('\n') : undefined);
  it.text = j('E') ?? '';
  it.schedule = j('D');
  it.lower = j('F');
  it.upper = j('G');
  it.comment = j('COMMENT');
}

/** 패키지 하나 (시작 줄 ~ 끝 표시) */
function parsePackage(no: 1 | 2 | 3, lines: DocLine[]): OfpNotamPackage {
  const pkg: OfpNotamPackage = { no, startLine: lines[0].n, endLine: lines[lines.length - 1].n, endFound: false, header: [], locations: [], counts: { headLines: 0, parsed: 0 } };
  let loc: OfpNotamLocation | null = null;
  let cat = '';
  let catLine: number | undefined;
  let item: OfpNotamItem | null = null;
  let justHead = false;

  const close = () => {
    if (item) {
      fillFields(item);
      item = null;
    }
  };

  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (isPageNoise(l.text) || !l.text.trim()) continue;
    const t = l.text;

    const end = NOTAM_PKG_END.exec(t);
    if (end && Number(end[1]) === no) {
      close();
      pkg.endFound = true;
      pkg.endLine = l.n;
      break;
    }

    const lh = LOC_HEAD.exec(t);
    if (lh) {
      close();
      loc = { pkg: no, role: clean(lh[1]), icao: lh[2], name: clean(lh[3].replace(/^[A-Z0-9]{3}\/\s*/, '')), line: l.n, info: [], items: [] };
      pkg.locations.push(loc);
      cat = '';
      catLine = undefined;
      justHead = true;
      continue;
    }
    // 공항 이름이 다음 줄로 넘어간 경우 ("US")
    if (justHead && loc && /^\s*[A-Z]{2}\s*$/.test(t)) {
      loc.name = `${loc.name} ${t.trim()}`.replace(/,\s*$/, ',').replace(/\s+/g, ' ');
      justHead = false;
      continue;
    }
    justHead = false;

    if (!loc) {
      pkg.header.push(src(l)); // 패키지 머리 (편명·PRINTED AT·DEP/ETP/ERA/FIR 목록)
      continue;
    }

    const see = SEE_ALSO.exec(t);
    if (see) {
      close();
      loc.seeAlso = Number(see[1]);
      continue;
    }
    if (NO_NOTAMS.test(t)) {
      close();
      loc.noNotams = true;
      continue;
    }

    const ch = CAT_HEAD.exec(t);
    if (ch) {
      close();
      cat = clean(ch[1]);
      catLine = l.n;
      continue;
    }

    if (LOOSE_HEAD.test(t)) pkg.counts.headLines++;
    const ih = ITEM_HEAD.exec(t);
    if (ih) {
      close();
      item = startItem(ih, l, cat || '(제목 없음)', catLine);
      loc.items.push(item);
      pkg.counts.parsed++;
      continue;
    }

    if (item) {
      item.lines.push(src(l));
    } else if (cat) {
      // 제목 아래 번호·유효기간 없는 글 (예: COMPANY MINIMA, TECHNICAL INFORMATION)
      item = { kind: 'text', category: cat, categoryLine: catLine, text: '', line: l.n, lines: [src(l)] };
      loc.items.push(item);
    } else {
      loc.info.push(src(l)); // 1. RUNWAY : … / 2. COMPANY RADIO : …
    }
  }
  close();
  return pkg;
}

/** 문서 전체 줄에서 NOTAM 패키지 1/2/3 추출. 패키지가 하나도 없으면 null */
export function parseNotams(lines: DocLine[], ranges: { no: 1 | 2 | 3; from: number; to: number }[]): OfpNotams | null {
  const packages = ranges.map((r) => parsePackage(r.no, lines.slice(r.from, r.to + 1)));
  if (!packages.length) return null;
  const p3 = packages.find((p) => p.no === 3);
  const firLine = p3?.header.find((h) => /^\s*FIR\s*:/.test(h.text));
  const firOrder = firLine ? firLine.text.replace(/^\s*FIR\s*:/, '').trim().split(/\s+/).filter((s) => /^[A-Z0-9]{4}$/.test(s)) : [];
  return { packages, firOrder };
}
