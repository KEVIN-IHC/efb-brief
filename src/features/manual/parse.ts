// 변환된 매뉴얼 Markdown(pymupdf4llm 출력) → 매뉴얼 묶음 (D-044).
// Mac 도구와 앱(MD 파일 직접 가져오기)이 같은 함수를 쓴다. 기기 안에서만 처리, 외부 전송 없음.
//
// 원칙
// - 쪽 단위로 나눈다. 쪽 끝에 찍힌 쪽 표시(예: "MI-36-11 P 2/8", "DSC-34-20-30-10 P 5/20")가 경계이자 근거 위치.
// - 쪽 표시를 못 찾은 부분은 버리지 않고 다음 쪽에 합친다(unlabeledPages로 센다).
// - MEL 하위 항목(36-11-01B)·CDL 항목(27-22)은 별도 목록으로 뽑아 OFP MEL/CDL 번호와 맞출 수 있게 한다.
import {
  MANUAL_FORMAT,
  MANUAL_FORMAT_VERSION,
  type ManualBundle,
  type ManualItem,
  type ManualKind,
  type ManualMeta,
  type ManualPage,
} from './types';

export const MANUAL_PARSER_VERSION = 'manual-1.4';
/** 원문 줄바꿈(<br>, 주로 그림 글·표 칸) 표시. 화면에서는 줄바꿈, 검색에서는 공백 */
export const BR = ' ¦ ';

const KIND_TITLES: [ManualKind, RegExp, string][] = [
  ['MEL', /MINIMUM EQUIPMENT LIST/i, 'MINIMUM EQUIPMENT LIST'],
  ['CDL', /CONFIGURATION DEVIATION LIST/i, 'CONFIGURATION DEVIATION LIST'],
  ['FCOM', /FLIGHT CREW OPERATING MANUAL/i, 'FLIGHT CREW OPERATING MANUAL'],
  ['FCTM', /FLIGHT CREW TECHNIQUES MANUAL/i, 'FLIGHT CREW TECHNIQUES MANUAL'],
  ['QRH', /QUICK REFERENCE HANDBOOK/i, 'QUICK REFERENCE HANDBOOK'],
  ['FOM', /FLIGHT OPERATIONS? MANUAL|OPERATIONS MANUAL/i, 'FLIGHT OPERATIONS MANUAL'],
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "19 OCT 26" → "2026-10-19" */
export function issueToIso(s: string | undefined): string | undefined {
  const m = /^(\d{1,2}) ([A-Z]{3}) (\d{2}|\d{4})$/.exec((s ?? '').trim().toUpperCase());
  if (!m) return undefined;
  const mon = MONTHS.indexOf(m[2]);
  if (mon < 0) return undefined;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${y}-${String(mon + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const DATE = String.raw`\d{1,2} [A-Z]{3} \d{2,4}`;

/** 앞부분 글(MD 또는 PDF 일반 텍스트)에서 문서 종류·기종·발행일을 찾는다 */
export function detectMeta(head: string, fileName: string): Pick<ManualMeta, 'docId' | 'kind' | 'aircraft' | 'title' | 'issueDate' | 'issueIso' | 'replaces' | 'revision'> {
  const text = head.slice(0, 20000);
  // "REFERENCE: XXX A380 FLEET MEL" 처럼 명시된 종류를 먼저, 없으면 제목 문구
  let kind: ManualKind = 'OTHER';
  let title = '';
  const stem0 = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  // 종류: ① "REFERENCE: XXX A380 FLEET MEL" ② 파일 이름의 종류 표기 ③ 본문에서 가장 먼저 나오는 제목 문구
  const ref = /REFERENCE:\s*.*?FLEET\s+([A-Z]{2,5})\b/i.exec(text);
  const refKind = ref?.[1].toUpperCase();
  const fileKind = /(?:^|[^A-Za-z])(MEL|CDL|FCOM|FCTM|FOM|QRH)(?=[^A-Za-z]|$)/i.exec(stem0)?.[1].toUpperCase();
  const byTitle = KIND_TITLES.map((k) => ({ k, i: k[1].exec(text)?.index ?? Infinity }))
    .filter((x) => x.i < Infinity)
    .sort((a, b) => a.i - b.i)[0]?.k;
  const hit = KIND_TITLES.find(([k]) => k === refKind) ?? KIND_TITLES.find(([k]) => k === fileKind) ?? byTitle;
  if (hit) [kind, , title] = hit;
  // 기종: REFERENCE 줄 → 파일 이름 → 머리의 "_A380_" 표기 (본문 아무 곳의 기종 언급은 쓰지 않음)
  const flat = text.replace(/_/g, ' ');
  const ac =
    /REFERENCE:\s*\S+\s+([AB]\d{3})\b/i.exec(flat)?.[1] ??
    /(?:^|[^A-Za-z0-9])([AB]\d{3})(?=[^0-9]|$)/.exec(stem0)?.[1] ??
    /(?:^|\s)_([AB]\d{3})_(?:\s|$)/m.exec(text.slice(0, 3000))?.[1];
  const aircraft = ac?.toUpperCase();
  const at = new RegExp(String.raw`at issue date\s+(${DATE})`, 'i').exec(text)?.[1];
  const any = new RegExp(String.raw`issue date:?\**\s*(${DATE})`, 'i').exec(text)?.[1];
  // 파일 이름의 개정·날짜 (예: FOM(R12-1_20260101)) — 본문에 발행일이 없을 때
  const fr = /R(\d+(?:-\d+)?)_(\d{4})(\d{2})(\d{2})/.exec(stem0);
  const fileIssue = fr ? `${fr[4]} ${MONTHS[Number(fr[3]) - 1]} ${fr[2].slice(2)}` : undefined;
  const issueDate = (at ?? any)?.toUpperCase() ?? fileIssue;
  const revision = fr ? `R${fr[1]}` : /(?:^|[^A-Za-z])R(\d+)(?=[^0-9]|$)/.exec(stem0)?.[0].replace(/^[^R]*/, '');
  const replaces = new RegExp(String.raw`replacing last issue dated\s+(${DATE})`, 'i').exec(text)?.[1]?.toUpperCase();
  const stem = fileName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  const docId =
    kind === 'OTHER'
      ? stem.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase() || 'MANUAL'
      : `${aircraft ?? 'GEN'}-${kind}`;
  return { docId, kind, aircraft, title: title || stem, issueDate, issueIso: issueToIso(issueDate), replaces, revision };
}

// 쪽 표시: "MI-36-11 P 2/8", "DSC-34-20-30-10 P 5/20", "27-10 P 1/2", "TRL P 1/2"
// 줄 처음·공백·표 칸(|)·<br> 다음에 오고, 뒤는 공백·|·<·줄끝
const FOOTER = /(?:^|[\s|>])((?=[0-9A-Z.-]*[0-9-])[0-9A-Z]{1,8}(?:-[0-9A-Z.]+)*|[A-Z]{3,8}) P (\d{1,3})\/(\d{1,3})(?=[\s|<]|$)/;

/** 쪽 사이 잡음 줄 (운영사·기종 줄, 개정 표시 화살표, 날짜만 있는 줄 등) */
function isNoise(t: string): boolean {
  const s = t.replace(/[|*_]/g, ' ').trim();
  if (!s) return true;
  if (/^[A-Z]{2,4} [AB]\d{3}(?:-\d+)? FLEET\b/.test(s)) return true;
  if (/^(FCOM|FCTM|MEL|CDL|FOM|QRH|AFM)(\s+\d{1,2} [A-Z]{3} \d{2})?$/.test(s)) return true;
  if (/^(←\s*)?[A-Z](\s+to\s+[A-Z])?(\s*→)?$/.test(s)) return true;
  if (/^\d{1,2} [A-Z]{3} \d{2}$/.test(s)) return true;
  if (/^(Intentionally left blank|Continued (from the previous|on the following) page)$/i.test(s)) return true;
  return false;
}

/** 한 줄의 변환 찌꺼기 정리 (취소선 잡음, mark/u 태그, 그림 글 표시) */
export function cleanLine(t: string): string {
  return t
    .replace(/~~[^~]*~~/g, '')
    .replace(/<\/?(mark|u)>/g, '')
    .replace(/<!-- (Start|End) of picture text -->/g, '')
    .replace(/<br>/g, BR)
    .replace(/\b_?([AB]\d{3})_\b/g, '')
    .replace(/[ \t]+/g, ' ')
    .trimEnd();
}

const HEADER_PHRASES = [
  ...KIND_TITLES.map(([, , t]) => t),
  'FLIGHT CREW',
  'OPERATING MANUAL',
  'TECHNIQUES MANUAL',
];

function headerOf(line: string): string {
  let s = line.replace(/[#*_]/g, ' ');
  for (const p of HEADER_PHRASES) s = s.split(p).join(' ');
  return s.replace(/Applicable to: ALL/i, '').replace(/\s+/g, ' ').trim();
}

function isHeaderLine(line: string): boolean {
  if (HEADER_PHRASES.slice(0, KIND_TITLES.length + 2).some((p) => line.includes(p)) && /\*\*/.test(line)) return true;
  // "**MEL ITEMS 31 - INDICATING/RECORDING** 31-53 - Flight Warning System" — 굵은 대문자 뒤에 글이 더 있는 줄
  return /^#{0,6}\s*\*\*[A-Z0-9][A-Z0-9 /&-]{3,}\*\*\s+\S/.test(line);
}

/** MD 전체 → 쪽 목록 */
export function splitPages(md: string): { pages: ManualPage[]; unlabeled: number } {
  const lines = md.split(/\r?\n/);
  const pages: ManualPage[] = [];
  let buf: { t: string; n: number }[] = [];
  let unlabeled = 0;
  const flush = (ref?: string, code?: string) => {
    const kept = buf.map((b) => ({ t: cleanLine(b.t), n: b.n })).filter((b) => !isNoise(b.t));
    buf = [];
    if (!kept.length) return;
    let header: string | undefined;
    const hi = kept.slice(0, 3).findIndex((b) => isHeaderLine(b.t));
    if (hi >= 0) {
      header = headerOf(kept[hi].t) || undefined;
      kept.splice(hi, 1);
    }
    const text = kept
      .map((b) => b.t)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!text && !header) return;
    pages.push({ seq: pages.length, ref, code, header, text, line: kept[0]?.n ?? 0 });
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const m = FOOTER.exec(raw);
    if (!m) {
      buf.push({ t: raw, n: i + 1 });
      continue;
    }
    // 쪽 표시 앞의 글이 본문이면 이 쪽에 넣는다 (운영사 줄 같은 잡음은 isNoise가 거른다)
    const before = raw.slice(0, m.index).trim();
    if (before) buf.push({ t: before, n: i + 1 });
    const code = m[1];
    const ref = `${code} P ${m[2]}/${m[3]}`;
    // 이미 같은 표시를 받은 직전 쪽이 있고 버퍼가 비었다면 중복 표시 — 무시
    if (!buf.some((b) => !isNoise(cleanLine(b.t))) && pages.at(-1)?.ref === ref) {
      buf = [];
      continue;
    }
    // 쪽 표시 없이 앞에 쌓인 쪽(쪽 번호가 건너뛴 경우)은 셀 수 없으므로, 쪽 번호 차이로 추정
    const prev = pages.at(-1);
    if (prev?.code === code && Number(m[2]) > Number(prev.ref!.split(' P ')[1].split('/')[0]) + 1) unlabeled++;
    flush(ref, code);
  }
  flush();
  return { pages, unlabeled };
}

// ---------- 절 단위 (marker 변환: 쪽 표시 없음, "#### 5.13.5.3 Fuel Monitoring" 같은 번호 제목) ----------
/** marker 의 _meta.json table_of_contents 항목 (제목·0부터 쪽 번호) */
export interface TocEntry {
  title: string;
  page_id: number;
}

const SPAN_PAGE = /<span id="page-(\d+)-\d+"><\/span>/g;
const SEC_NUM = /^(S?\d+(?:\.\d+)+|S?\d+\.?)\s+(.+)$/;
const CHAPTER = /^제\s*\d+\s*장(?:\s|$)/;
const normTitle = (t: string) => t.replace(/<[^>]+>/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_\\]/g, '').replace(/\s+/g, ' ').trim();

/** marker 전용 정리: span 표시·쪽 링크·그림 */
function cleanMarker(t: string): string {
  return cleanLine(
    t
      .replace(SPAN_PAGE, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '[그림]')
      .replace(/\[((?:\\.|[^\]\\])*)\]\(#page-\d+-\d+\)/g, '$1')
      .replace(/\\([[\]])/g, '$1'),
  );
}

/**
 * 번호 제목(1.1.3 / S6.8.1 / 5.13.2.2)이나 "제 N 장" 제목마다 한 덩어리. 번호 없는 제목(a) Caution 등)은 안에 둔다.
 * "Flight Crew Reference Manual" 제목 뒤는 FCRM 으로 구분 (같은 파일에 함께 든 경우).
 * 쪽 번호: 제목의 <span id="page-N-…"> 또는 _meta.json 목차(같은 제목 순서대로 맞춤).
 */
export function splitSections(md: string, baseKind: string, toc?: TocEntry[]): { pages: ManualPage[] } {
  const lines = md.split(/\r?\n/);
  const pages: ManualPage[] = [];
  const tocList = (toc ?? []).filter((x) => x.title?.trim()).map((x) => ({ t: normTitle(x.title), p: x.page_id }));
  let tp = 0;
  let part = baseKind;
  let chapter = '';
  let pdfPage: number | undefined;
  let cur: { code?: string; ref?: string; header?: string; line: number; page?: number; buf: string[] } = { line: 1, buf: [] };
  const flush = () => {
    const text = cur.buf.map(cleanMarker).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text || cur.header) {
      const pg = cur.page !== undefined ? cur.page + 1 : undefined;
      pages.push({ seq: pages.length, code: cur.code, ref: cur.ref ? `${cur.ref}${pg ? ` · p.${pg}` : ''}` : pg ? `p.${pg}` : undefined, header: cur.header, text, line: cur.line, pdfPage: pg });
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    for (const m of raw.matchAll(SPAN_PAGE)) pdfPage = Number(m[1]);
    const h = /^(#{1,6})\s+(.*)$/.exec(raw);
    if (!h) {
      cur.buf.push(raw);
      continue;
    }
    const title = normTitle(h[2]);
    // 목차와 맞추기: 앞으로 40개 안에서 같은 제목
    let tocPage: number | undefined;
    for (let k = tp; k < Math.min(tocList.length, tp + 40); k++) {
      if (tocList[k].t === title) {
        tocPage = tocList[k].p;
        tp = k + 1;
        break;
      }
    }
    const spanPage = /<span id="page-(\d+)-/.exec(h[2])?.[1];
    const page = spanPage !== undefined ? Number(spanPage) : (tocPage ?? pdfPage);
    if (page !== undefined) pdfPage = page;
    if (/^Flight Crew Reference Manual$/i.test(title)) {
      part = 'FCRM';
      chapter = '';
    }
    const num = SEC_NUM.exec(title);
    const isChapter = CHAPTER.test(title);
    if (!num && !isChapter) {
      cur.buf.push(raw);
      continue;
    }
    flush();
    if (isChapter) chapter = title;
    const no = num ? num[1].replace(/\.$/, '') : title.replace(/\s+/g, ' ');
    cur = {
      code: num ? `${part}-${no}` : undefined,
      ref: `${part} ${num ? no : title}`,
      header: [chapter && !isChapter ? chapter : '', title].filter(Boolean).join(' › '),
      line: i + 1,
      page,
      buf: [],
    };
  }
  flush();
  return { pages };
}

// ---------- MEL ----------
// 제목이 같은 줄에 있거나("**36-11-01B One Pack set to OFF**") 다음 굵은 줄로 떨어져 있다("**31-53-01**" / "**FWS 2**")
// 같은 줄 뒤에 "Ident.: … Applicable to: ALL" 이 붙기도 한다. 그림 글로 바뀐 제목("23-75-03 Fin Taxi Aid Camera /")도 받는다
const MEL_ITEM = /^#{0,6}\s*\*\*(\d{2}-\d{2}-\d{2})(?:\s+([^*]+?))?\s*\*\*(?:\s+Ident\.:.*)?\s*$/;
const MEL_ITEM_PIC = /(?:^|[/¦])\s*(\d{2}-\d{2}-\d{2})\s+([A-Za-z][^/¦|*]*?)\s*[/¦]\s*$/;
const MEL_SUB = /^#{0,6}\s*\*\*(\d{2}-\d{2}-\d{2}[A-Z])(?:\s+([^*]+?))?\s*\*\*(?:\s+Ident\.:.*)?\s*$/;
const BOLD_LINE = /^#{0,6}\s*\*\*([^*]+?)\s*\*\*\s*$/;

/** 번호만 있는 제목 줄이면 바로 다음 굵은 줄(번호 아님)을 제목으로 쓰고 그 줄 번호를 돌려준다 */
function titleAt(ls: string[], i: number, inline: string | undefined): { title: string; skip: number } {
  if (inline) return { title: inline, skip: 0 };
  const nx = ls[i + 1] ?? '';
  const m = BOLD_LINE.exec(nx);
  if (m && !/^\d{2}-\d{2}/.test(m[1])) return { title: m[1], skip: 1 };
  return { title: '', skip: 0 };
}
const MEL_TABLE_HEAD = /^\|+\s*Repair interval\b/i;
const MEL_PIC_TABLE = /Repair interval\s+Nbr installed\s+Nbr required\s+Placard\s*[/¦]\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/i;
const cell = (s: string) => s.replace(/\*/g, '').trim();

/** MEL 쪽 목록에서 항목·하위 항목 추출. (o) 운항 절차 쪽(MO-…)은 opsProcSeq로 연결 */
export function extractMelItems(pages: ManualPage[]): ManualItem[] {
  const itemPages = pages.filter((p) => p.code?.startsWith('MI-'));
  const scan = itemPages.length ? itemPages : pages;
  const items: ManualItem[] = [];
  let cur: ManualItem | null = null;
  let lastParent: ManualItem | null = null;
  let lines: string[] = [];
  const close = () => {
    if (cur) {
      cur.text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      items.push(cur);
    }
    cur = null;
    lines = [];
  };
  for (const p of scan) {
    const ls = p.text.split('\n');
    for (let i = 0; i < ls.length; i++) {
      const t = ls[i];
      let m: RegExpExecArray | null;
      if ((m = MEL_ITEM.exec(t) ?? MEL_ITEM_PIC.exec(t))) {
        close();
        const tt = titleAt(ls, i, m[2]);
        i += tt.skip;
        cur = { itemNo: m[1], kind: 'MEL', title: tt.title, pageSeq: p.seq, ref: p.ref, text: '' };
        lastParent = cur;
        continue;
      }
      if ((m = MEL_SUB.exec(t))) {
        close();
        const no = m[1];
        const tt = titleAt(ls, i, m[2]);
        i += tt.skip;
        const sub: ManualItem = { itemNo: no, kind: 'MEL', parent: no.slice(0, 8), title: tt.title, pageSeq: p.seq, ref: p.ref, text: '' };
        // 다음 줄들: | Repair interval | Nbr installed | Nbr required | Placard |
        const h = ls.slice(i + 1, i + 4).findIndex((x) => MEL_TABLE_HEAD.test(x));
        if (h >= 0) {
          const at = i + 1 + h;
          const row = ls.slice(at + 1, at + 4).find((x) => /^\|/.test(x) && !/^\|\s*-{3}/.test(x));
          if (row) [sub.repairInterval, sub.installed, sub.required, sub.placard] = row.split(/\||\s[/¦]\s/).map(cell).filter(Boolean);
          i = at + 2; // 표 머리·구분·값 줄은 본문에서 뺀다
        } else {
          // 그림 글로 변환된 표: "Repair interval Nbr installed Nbr required Placard / D 1 0 Yes"
          const k = ls.slice(i + 1, i + 4).findIndex((x) => MEL_PIC_TABLE.test(x));
          if (k >= 0) {
            const pm = MEL_PIC_TABLE.exec(ls[i + 1 + k])!;
            [sub.repairInterval, sub.installed, sub.required, sub.placard] = pm.slice(1, 5);
            i = i + 1 + k;
          }
        }
        // 하위 항목이 하나뿐이면 제목이 없다 → 상위 항목 제목
        const lp = lastParent as ManualItem | null;
        if (!sub.title && lp && lp.itemNo === sub.parent) sub.title = lp.title;
        cur = sub;
        continue;
      }
      if (cur) lines.push(t);
    }
  }
  close();
  // 제목 없는 하위 항목은 상위 항목 제목으로
  const parents = new Map(items.filter((x) => !x.parent).map((x) => [x.itemNo, x]));
  for (const it of items) if (it.parent && !it.title) it.title = parents.get(it.parent)?.title ?? '';
  // (o) 운항 절차 쪽(MO-…)에서 같은 번호로 시작하는 쪽을 찾아 연결
  // 목차(PLP-TOC 등) 쪽은 빼고, 번호 다음 줄 근처에 Ident.: 가 있는 실제 절차 쪽을 고른다
  const ops = pages.filter((p) => p.code?.startsWith('MO-') && !/PLP|TOC|LEP|LESS/.test(p.code));
  for (const it of items) {
    if (!it.parent) continue;
    const re = new RegExp(String.raw`(^|\n)\W*${it.itemNo}\b`);
    const op = ops.find((p) => re.test(p.text));
    if (op) it.opsProcSeq = op.seq;
  }
  return dedupe(items);
}

// ---------- CDL ----------
const CDL_CODE = /^\d{2}-\d{2}$/;

/** CDL 은 쪽 표시 자체가 항목 번호 (예: "27-22 P 1/3"). 같은 번호 쪽을 묶는다 */
export function extractCdlItems(pages: ManualPage[]): ManualItem[] {
  const byNo = new Map<string, ManualItem>();
  for (const p of pages) {
    if (!p.code || !CDL_CODE.test(p.code)) continue;
    const no = p.code;
    const it = byNo.get(no);
    if (it) {
      it.text += `\n\n${p.text}`;
      continue;
    }
    const src = `${p.header ?? ''}\n${p.text}`;
    const tm = new RegExp(String.raw`\b${no}\s+(?:Quantity installed\s+)?([A-Za-z][^\n*|¦]*?)\s*(?:\*\*|Applicable to|\n|$)`).exec(src);
    byNo.set(no, { itemNo: no, kind: 'CDL', title: (tm?.[1] ?? p.header ?? '').replace(/[\s/¦]+$/, '').trim(), pageSeq: p.seq, ref: p.ref, text: p.text });
  }
  return [...byNo.values()];
}

function dedupe(items: ManualItem[]): ManualItem[] {
  const seen = new Map<string, ManualItem>();
  for (const it of items) {
    const prev = seen.get(it.itemNo);
    if (!prev || (!prev.text && it.text)) seen.set(it.itemNo, it);
  }
  return [...seen.values()];
}

/** MD 한 파일 → 묶음 */
export function buildManualBundle(md: string, fileName: string, now = new Date(), opts: { toc?: TocEntry[] } = {}): ManualBundle {
  const meta0 = detectMeta(md, fileName);
  // 쪽 표시가 거의 없고 번호 제목이 많으면(marker 변환) 절 단위로 나눈다
  const footerCount = md.split('\n', 200000).filter((l) => FOOTER.test(l)).length;
  const numHeads = (md.match(/^#{1,6}\s+(?:<span[^>]*><\/span>)*\**S?\d+(?:\.\d+)+\s/gm) ?? []).length;
  const splitMode: 'page' | 'section' = numHeads >= 2 && footerCount * 5 < numHeads ? 'section' : 'page';
  const { pages, unlabeled } = splitMode === 'section' ? { ...splitSections(md, meta0.kind === 'OTHER' ? 'DOC' : meta0.kind, opts.toc), unlabeled: 0 } : splitPages(md);
  const items = meta0.kind === 'MEL' ? extractMelItems(pages) : meta0.kind === 'CDL' ? extractCdlItems(pages) : [];
  const meta: ManualMeta = {
    ...meta0,
    sourceFile: fileName.replace(/^.*[\\/]/, ''),
    builtAt: now.toISOString(),
    parserVersion: MANUAL_PARSER_VERSION,
    splitMode,
    pageCount: pages.length,
    unlabeledPages: unlabeled,
    itemCount: items.length,
  };
  return { format: MANUAL_FORMAT, formatVersion: MANUAL_FORMAT_VERSION, meta, pages, items };
}

/** 가져온 JSON이 묶음 형식인지 확인 (아니면 이유) */
export function validateBundle(x: unknown): string | null {
  const b = x as Partial<ManualBundle> | null;
  if (!b || typeof b !== 'object') return '형식이 아님';
  if (b.format !== MANUAL_FORMAT) return '매뉴얼 묶음 파일이 아님';
  if (typeof b.formatVersion !== 'number' || b.formatVersion > MANUAL_FORMAT_VERSION) return `지원하지 않는 묶음 버전 (${b.formatVersion}) — 앱 새로고침 후 다시 시도`;
  if (!b.meta?.docId || !Array.isArray(b.pages) || !Array.isArray(b.items)) return '묶음 내용이 비어 있거나 손상됨';
  return null;
}
