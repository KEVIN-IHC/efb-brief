// NOTAM 약어 사전 (D-112): 오프라인 검색. 출처 두 가지를 합친다.
//  1) 앱 내장 (abbr.ts — ICAO Doc 8400 중심, 한국어 뜻)
//  2) 기기에 가져온 Jeppesen Airway Manual(General)의 "ABBREVIATIONS USED IN AIRWAY MANUAL" 쪽을 기기 안에서 읽음
//     — Jeppesen 본문은 코드·GitHub에 넣지 않는다 (매뉴얼은 기기 IndexedDB에만)
import { docPages } from '../manual/lookup';
import { listManuals, manualEvents } from '../manual/store';
import { ABBR_BUILTIN } from './abbr';

export interface AbbrEntry {
  k: string;
  v: string;
  src: 'app' | 'jepp';
  docId?: string;
  seq?: number;
  ref?: string;
}

const ABBR_TOK = /^(?:[A-Z0-9][A-Z0-9/&.\-]*|\([A-Z]{1,3}\))$/;
const isAbbrTok = (t: string) => ABBR_TOK.test(t) && /[A-Z]/.test(t);
const firstLetter = (t: string) => t.replace(/^[^A-Za-z]+/, '')[0]?.toUpperCase() ?? '';

/**
 * Jeppesen 약어 쪽 본문 → 약어·뜻. 두 가지 모양:
 *  - 표 "|AERO|Aerodrome|"
 *  - 한 줄로 이어진 글 "A/A Air to Air AAF Army Air Field ..." → 대문자 낱말 묶음 = 약어, 뒤의 보통 낱말 = 뜻.
 *    대문자 묶음이 여럿이면 뜻의 첫 글자와 같은 글자로 시작하는 낱말부터 약어로 본다 (예: "Digital ATIS DCL Data Link" → DCL).
 *    맞는 글자가 없으면: 뒤가 보통 낱말이면 묶음 첫 낱말부터 약어, 아니면 앞 뜻의 일부 (예: "Category D (Large Aircraft)").
 */
export function parseJeppAbbr(text: string): { k: string; v: string }[] {
  const out: { k: string; v: string }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || /^#|^\*\*|^\|\s*-/.test(line)) continue;
    const tm = /^\|([^|]+)\|([^|]+)\|$/.exec(line);
    if (tm) {
      const k = tm[1].trim();
      const v = tm[2].trim();
      if (k && v && k !== '---') out.push({ k, v });
      continue;
    }
    const toks = line.split(/\s+/);
    let cur: { k: string; v: string[] } | null = null;
    let i = 0;
    while (i < toks.length) {
      if (!isAbbrTok(toks[i])) {
        if (cur) cur.v.push(toks[i]);
        i++;
        continue;
      }
      let j = i;
      while (j < toks.length && isAbbrTok(toks[j])) j++;
      const run = toks.slice(i, j);
      const next = toks[j];
      if (!next) {
        if (cur) cur.v.push(...run);
        break;
      }
      const L = firstLetter(next);
      const at = run.findIndex((t) => firstLetter(t) === L);
      // 첫 글자가 안 맞아도 뒤가 보통 낱말(대문자+소문자)이면 묶음의 첫 낱말부터 약어 (예: "HS During…", "C ATC IFR Flight Plan…")
      if (at < 0 && cur && !/^[A-Z][a-z]/.test(next)) {
        cur.v.push(...run);
      } else {
        const s = at < 0 ? 0 : at;
        if (cur) cur.v.push(...run.slice(0, s));
        if (cur?.v.length) out.push({ k: cur.k, v: cur.v.join(' ') });
        cur = { k: run.slice(s).join(' '), v: [] };
      }
      i = j;
    }
    if (cur?.v.length) out.push({ k: cur.k, v: cur.v.join(' ') });
  }
  return out;
}

const builtin = (): AbbrEntry[] => Object.entries(ABBR_BUILTIN).map(([k, v]) => ({ k, v, src: 'app' }));

let cache: Promise<AbbrEntry[]> | null = null;
manualEvents.addEventListener('change', () => (cache = null));

/** 사전 전체 (앱 내장 + 기기에 있는 Jeppesen) */
export function loadAbbrDict(): Promise<AbbrEntry[]> {
  return (cache ??= (async () => {
    const out = builtin();
    try {
      const docs = (await listManuals()).filter((m) => m.docId.startsWith('JEPP-'));
      for (const d of docs) {
        const pages = (await docPages(d.docId)).filter((p) => /ABBREVIATIONS USED IN AIRWAY MANUAL/.test(p.text) || /Abbreviations Used in Airway Manual/.test(p.header ?? ''));
        for (const p of pages) for (const e of parseJeppAbbr(p.text)) out.push({ ...e, src: 'jepp', docId: d.docId, seq: p.seq, ref: p.ref });
      }
    } catch {
      /* 매뉴얼 없음 → 앱 내장만 */
    }
    return out;
  })());
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9/]/g, '');

/** 찾기: 약어가 같음 → 약어가 그 글로 시작 → 뜻에 그 글이 들어 있음 (각 묶음 안은 앱 내장 먼저) */
export function searchAbbr(dict: AbbrEntry[], q: string, limit = 60): AbbrEntry[] {
  const raw = q.trim();
  if (!raw) return [];
  const n = norm(raw);
  // 뜻 찾기는 낱말 첫머리부터 ("PPR"이 approach에 걸리지 않게)
  const wordStart = new RegExp(`(^|[^a-z])${raw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  const rank = (e: AbbrEntry) => {
    const k = norm(e.k);
    if (n && k === n) return 0;
    if (n && k.startsWith(n)) return 1;
    if (raw.length >= 3 && wordStart.test(e.v)) return 2;
    return 9;
  };
  const seen = new Set<string>();
  return dict
    .map((e) => ({ e, r: rank(e) }))
    .filter((x) => x.r < 9)
    .sort((a, b) => a.r - b.r || (a.e.src === b.e.src ? a.e.k.localeCompare(b.e.k) : a.e.src === 'app' ? -1 : 1))
    .map((x) => x.e)
    .filter((e) => {
      const key = `${e.src}|${e.k}|${e.v}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/** 누른 낱말에서 찾을 말 고르기 (예: "RWY06L/24R" → RWY, "U/S" 그대로, "(ATIS)" → ATIS) */
export function tapWord(w: string, dict: AbbrEntry[]): string {
  const t = w.toUpperCase().replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, '');
  if (!t) return '';
  const has = (s: string) => dict.some((e) => norm(e.k) === norm(s));
  if (has(t)) return t;
  const letters = /^[A-Z]+(?:\/[A-Z]+)?/.exec(t)?.[0] ?? t;
  return has(letters) ? letters : (/^[A-Z]+/.exec(t)?.[0] ?? t);
}
