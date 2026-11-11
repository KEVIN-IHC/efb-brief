// 매뉴얼 찾기 (D-045): OFP MEL/CDL 번호 매칭, "Refer to …" 연결, 오프라인 검색. 모두 기기 안.
import { create } from 'zustand';
import { getDB } from '../../db/schema';
import { listManuals, manualEvents, type StoredManual } from './store';
import type { ManualItem, ManualPage } from './types';

export type StoredPage = ManualPage & { docId: string };
export type StoredItem = ManualItem & { docId: string };

// ---------- 쪽 캐시 (매뉴얼 바뀌면 비움) ----------
const pageCache = new Map<string, Promise<StoredPage[]>>();
manualEvents.addEventListener('change', () => pageCache.clear());

export function docPages(docId: string): Promise<StoredPage[]> {
  let p = pageCache.get(docId);
  if (!p) {
    p = getDB().then((db) => db.getAll('manualPages', IDBKeyRange.bound([docId, -Infinity], [docId, Infinity])));
    pageCache.set(docId, p);
  }
  return p;
}

// ---------- 화면 이동 ----------
export interface ManualTarget {
  docId: string;
  seq: number;
  /** 쪽 안에서 강조할 글 (예: 항목 번호) */
  mark?: string;
}
export const useManualNav = create<{ target: ManualTarget | null; query: string | null; t: number }>(() => ({ target: null, query: null, t: 0 }));

export function openManualPage(target: ManualTarget) {
  useManualNav.setState({ target, query: null, t: Date.now() });
  location.hash = '#manual';
}
export function openManualSearch(query: string) {
  useManualNav.setState({ query, t: Date.now() });
  location.hash = '#manual';
}

// ---------- 기종 ----------
/** OFP 기종 코드(A388·B78X…) → 매뉴얼 기종(A380·B787…) */
export function manualAircraft(acType: string | undefined): string | undefined {
  const a = (acType ?? '').toUpperCase();
  if (/^A38/.test(a)) return 'A380';
  if (/^A35/.test(a)) return 'A350';
  if (/^A33/.test(a)) return 'A330';
  if (/^A32|^A31|^A2[01]N/.test(a)) return 'A320';
  if (/^B78|^B787/.test(a)) return 'B787';
  if (/^B77/.test(a)) return 'B777';
  if (/^B74/.test(a)) return 'B747';
  if (/^B73/.test(a)) return 'B737';
  return a || undefined;
}

// ---------- OFP MEL/CDL 매칭 ----------
export interface MelMatch {
  kind: 'MEL' | 'CDL';
  itemNo: string;
  /** 정확히 같은 번호 / 하위 항목이 없어 상위 항목으로 / 없음 */
  how: 'exact' | 'parent' | 'none';
  item?: StoredItem;
  parent?: StoredItem;
  /** 기종이 맞는 매뉴얼에서 찾았는지 (기종 모르면 undefined) */
  aircraftOk?: boolean;
}

/** 가져온 매뉴얼에서 OFP MEL/CDL 번호를 찾는다. 기종이 맞는 매뉴얼을 우선 */
export function matchMelItem(
  m: { kind: 'MEL' | 'CDL'; itemNo: string },
  items: StoredItem[],
  docs: StoredManual[],
  aircraft: string | undefined,
): MelMatch {
  const docOf = new Map(docs.map((d) => [d.docId, d]));
  const pool = items.filter((i) => i.kind === m.kind);
  const pick = (no: string) => {
    const c = pool.filter((i) => i.itemNo === no);
    return c.find((i) => docOf.get(i.docId)?.aircraft === aircraft) ?? c[0];
  };
  const ok = (it?: StoredItem) => (aircraft && it ? docOf.get(it.docId)?.aircraft === aircraft : undefined);
  const exact = pick(m.itemNo);
  if (m.kind === 'MEL') {
    const parentNo = m.itemNo.slice(0, 8);
    const parent = parentNo !== m.itemNo ? pick(parentNo) : undefined;
    if (exact) return { ...m, how: 'exact', item: exact, parent, aircraftOk: ok(exact) };
    if (parent) return { ...m, how: 'parent', item: parent, aircraftOk: ok(parent) };
  } else if (exact) return { ...m, how: 'exact', item: exact, aircraftOk: ok(exact) };
  return { ...m, how: 'none' };
}

/** OFP MEL/CDL 목록 → 매칭 결과 (가져온 매뉴얼 전체에서) */
export async function loadMelMatches(mel: { kind: 'MEL' | 'CDL'; itemNo: string }[], aircraft?: string): Promise<{ docs: StoredManual[]; matches: MelMatch[] }> {
  const db = await getDB();
  const docs = await listManuals();
  const nos = new Set(mel.flatMap((m) => [m.itemNo, m.itemNo.slice(0, 8)]));
  const items: StoredItem[] = (await Promise.all([...nos].map((n) => db.getAllFromIndex('manualItems', 'byItem', n)))).flat();
  return { docs, matches: mel.map((m) => matchMelItem(m, items, docs, aircraft)) };
}

/** 절·쪽 코드 목록 → 가져온 매뉴얼 안의 위치 (얼러트 근거 링크용) */
export async function loadCodeRefs(codes: string[]): Promise<Record<string, { docId: string; seq: number; ref?: string }>> {
  const docs = await listManuals();
  const out: Record<string, { docId: string; seq: number; ref?: string }> = {};
  for (const d of docs) {
    const pages = await docPages(d.docId);
    for (const c of codes) {
      if (out[c]) continue;
      const p = pages.find((x) => x.code === c);
      if (p) out[c] = { docId: d.docId, seq: p.seq, ref: p.ref };
    }
  }
  return out;
}

/** 항목 본문에서 운항에 바로 쓰이는 표시를 뽑는다 (원문 문구 그대로, 해석하지 않음) */
export function itemFlags(text: string): { ops: boolean; maint: boolean; notes: string[] } {
  const notes: string[] = [];
  const t = text.replace(/[*_]/g, '');
  for (const re of [/Crew Defer/i, /Return To Gate/i, /Contact MCC[^.]*/i, /Performance:/i, /Fuel consumption is increased by [\d.]+ ?%/i]) {
    const m = re.exec(t);
    if (m) notes.push(m[0].replace(/:$/, '').trim());
  }
  return { ops: /\(o\)/i.test(text), maint: /\(m\)/i.test(text), notes };
}

// ---------- "Refer to …" 연결 ----------
/** 쪽 본문 속 참조 문구 → 매뉴얼 쪽. 같은 매뉴얼 우선, 그다음 모든 매뉴얼 */
export interface RefLink {
  text: string;
  start: number;
  end: number;
  key: string;
}
// DSC-34-20-30-20 / PRO-ABN-… / OpsProc 36-11-01B / Item 36-11-01 / 27-22 (CDL, "Refer to 27-22 …")
// FOM/FCRM 절: "[FOM 1.4.4]" "FCRM 1.8.2"
const REF_RE = /(?:OpsProc\s+(\d{2}-\d{2}-\d{2}[A-Z]?)|Item\s+(\d{2}-\d{2}-\d{2}[A-Z]?)|\b((?:DSC|PRO|LIM|PER|GEN|FCB|OEB|PR|AS|OP|SI|TAB|MI|MO)(?:-[0-9A-Z]+){1,8})\b|Refer to\s+(\d{2}-\d{2})\b|\b(FOM|FCRM)\s+(S?\d+(?:\.\d+)+))/g;

export function findRefs(text: string): RefLink[] {
  const out: RefLink[] = [];
  for (const m of text.matchAll(REF_RE)) {
    if (m[3] && /-\d{6,}/.test(m[3])) continue; // Ident 번호(MO-36-11-00012228)는 쪽 코드가 아님
    const key = m[1] ? `ops:${m[1]}` : m[2] ? `item:${m[2]}` : m[3] ? `code:${m[3]}` : m[4] ? `cdl:${m[4]}` : `code:${m[5]}-${m[6]}`;
    const s = m.index! + (m[4] ? m[0].length - m[4].length : 0);
    out.push({ text: m[1] ?? m[2] ?? m[3] ?? m[4] ?? `${m[5]} ${m[6]}`, start: s, end: m.index! + m[0].length, key });
  }
  return out;
}

/** 참조 키 → 쪽 위치 */
export async function resolveRef(key: string, fromDocId: string, docs: StoredManual[]): Promise<ManualTarget | null> {
  const [kind, val] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  const order = [fromDocId, ...docs.map((d) => d.docId).filter((d) => d !== fromDocId)];
  const db = await getDB();
  if (kind === 'ops' || kind === 'item' || kind === 'cdl') {
    const its = (await db.getAllFromIndex('manualItems', 'byItem', val)).sort((a, b) => order.indexOf(a.docId) - order.indexOf(b.docId));
    const it = its[0];
    if (it) return { docId: it.docId, seq: kind === 'ops' && it.opsProcSeq !== undefined ? it.opsProcSeq : it.pageSeq, mark: val };
    return null;
  }
  if (kind === 'sec') {
    // 절 번호만 (예: 5.13.5.3) — 절 단위 매뉴얼에서 "<부분>-번호" 로 끝나는 쪽
    for (const d of order) {
      const p = (await docPages(d)).find((x) => x.code?.endsWith(`-${val}`));
      if (p) return { docId: d, seq: p.seq };
    }
    return null;
  }
  for (const d of order) {
    const pages = await docPages(d);
    // 같은 코드의 첫 쪽, 없으면 그 코드로 시작하는 첫 쪽 (DSC-34-20-30 → DSC-34-20-30-10)
    const p = pages.find((x) => x.code === val) ?? pages.find((x) => x.code?.startsWith(`${val}-`));
    if (p) return { docId: d, seq: p.seq };
  }
  return null;
}

// ---------- 검색 ----------
export interface SearchHit {
  docId: string;
  seq: number;
  ref?: string;
  header?: string;
  snippet: string;
  score: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[*_#|¦]/g, ' ');

/**
 * 단순 전문 검색: 모든 낱말이 들어 있는 쪽(AND), 점수 = 낱말 등장 수(쪽당 상한) + 머리 제목·쪽 표시 가산.
 * 따옴표로 묶으면 구절 그대로. 결과는 점수순 → 문서 순서.
 */
export function searchPages(pages: StoredPage[], query: string, limit = 60): SearchHit[] {
  const phrases = [...query.matchAll(/"([^"]+)"|(\S+)/g)].map((m) => norm(m[1] ?? m[2]).trim()).filter((x) => x.length >= 2);
  if (!phrases.length) return [];
  const hits: SearchHit[] = [];
  for (const p of pages) {
    const body = norm(p.text);
    const head = norm(`${p.header ?? ''} ${p.ref ?? ''}`);
    let score = 0;
    let first = -1;
    let all = true;
    for (const w of phrases) {
      let i = body.indexOf(w);
      const inHead = head.includes(w);
      if (i < 0 && !inHead) {
        all = false;
        break;
      }
      if (first < 0 || (i >= 0 && i < first)) first = i;
      let n = 0;
      while (i >= 0 && n < 10) {
        n++;
        i = body.indexOf(w, i + w.length);
      }
      score += n + (inHead ? 8 : 0);
    }
    if (!all) continue;
    const at = Math.max(0, first);
    const raw = p.text.replace(/[*_#]/g, '').replace(/¦/g, '/').replace(/\s+/g, ' ');
    const s = Math.max(0, Math.min(raw.length, at) - 60);
    hits.push({ docId: p.docId, seq: p.seq, ref: p.ref, header: p.header, snippet: (s > 0 ? '…' : '') + raw.slice(s, s + 200) + (raw.length > s + 200 ? '…' : ''), score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** 검색어가 항목 번호·쪽 코드·절 번호면 바로 그 위치 (예: 36-11-01B, 27-22, DSC-34-20-30, 5.13.5.3, FOM 6.5.3.1) */
export function directKey(q: string): string | null {
  const s = q.trim().toUpperCase();
  if (/^\d{2}-\d{2}-\d{2}[A-Z]?$/.test(s)) return `item:${s}`;
  if (/^\d{2}-\d{2}$/.test(s)) return `cdl:${s}`;
  if (/^[A-Z]{2,4}(-[0-9A-Z]+){1,8}$/.test(s)) return `code:${s}`;
  const fs = /^(FOM|FCRM)\s*(S?\d+(?:\.\d+)+)$/.exec(s);
  if (fs) return `code:${fs[1]}-${fs[2]}`;
  if (/^S?\d+(\.\d+)+$/.test(s)) return `sec:${s}`;
  return null;
}

// ---------- 항목만 보기 (MEL 항목 번호로 쪽을 열었을 때) ----------
const ITEM_HEAD = /^#{0,6}\s*\*\*(\d{2}-\d{2}-\d{2}[A-Z]?)\b/;
/** 쪽 머리 그림 글("MEL ITEMS ¦ 25 - … ¦ MINIMUM EQUIPMENT LIST ¦") */
export const RUNNING_HEAD = /^(?:\*\*)?MEL ITEMS\b.*(?:MINIMUM EQUIPMENT LIST|¦)/;

export interface ItemSlice {
  text: string;
  /** 이 항목이 걸친 쪽 seq (첫 쪽부터) */
  seqs: number[];
}

/**
 * 쪽 본문에서 MEL 항목(예: 00-00-00A) 부분만 잘라 낸다. 다음 항목 제목 전까지,
 * 쪽 끝까지 이어지면 같은 장의 다음 쪽(최대 2쪽)에서 이어 붙인다. 하위 항목 바로 위의 상위 항목 제목·Ident 줄은 함께 보여 준다.
 * 제목을 못 찾으면 null (쪽 전체를 보여 줌).
 */
export function itemSlice(pages: { seq: number; code?: string; text: string }[], seq: number, mark: string | undefined): ItemSlice | null {
  const no = mark?.trim().toUpperCase();
  if (!no || !/^\d{2}-\d{2}-\d{2}[A-Z]?$/.test(no)) return null;
  const page = pages[seq];
  if (!page) return null;
  const ls = page.text.split('\n');
  const idx = ls.findIndex((l) => ITEM_HEAD.exec(l)?.[1] === no);
  if (idx < 0) return null;
  const other = (l: string) => {
    const n = ITEM_HEAD.exec(l)?.[1];
    return !!n && !n.startsWith(no);
  };
  let start = idx;
  if (no.length === 9) {
    let j = idx - 1;
    while (j >= 0 && !ITEM_HEAD.test(ls[j])) j--;
    if (j >= 0 && ITEM_HEAD.exec(ls[j])![1] === no.slice(0, 8)) start = j;
  }
  let end = idx + 1;
  while (end < ls.length && !other(ls[end])) end++;
  const out = ls.slice(start, end);
  const seqs = [seq];
  // 쪽 끝까지 이어진 항목 → 다음 쪽에서 계속
  for (let s = seq + 1; end === ls.length && s < pages.length && s <= seq + 2; s++) {
    const np = pages[s];
    if (!np.code || np.code !== page.code) break;
    const nl = np.text.split('\n').filter((l) => !RUNNING_HEAD.test(l));
    let k = 0;
    while (k < nl.length && !other(nl[k])) k++;
    if (k === 0) break;
    out.push(...nl.slice(0, k));
    seqs.push(s);
    if (k < nl.length) break;
  }
  return { text: out.join('\n').trim(), seqs };
}
