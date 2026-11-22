// SD 페이지 점검 가이드 (D-096): 기기에 가져온 FCOM의 "Controls and Indicators" 절에서
// 지시값의 정상 범위·경고 조건 문장(숫자+단위가 있는 문장)을 원문 그대로 뽑는다. 해석·번역 안 함.
// 색(초록·AMBER·RED)은 FCOM 그림에만 있어 글에서 확실히 알 수 없음 → 문장 낱말로 "앱 분류"만 붙이고, 원본 쪽(사진)으로 확인하게 함
// FCOM 내용은 앱 코드에 넣지 않는다 — 기기 안 매뉴얼 묶음에서 읽음

/** SD 페이지 → FCOM 절 코드 앞부분 (A380 FCOM DSC) */
export const SD_SECTIONS: Record<string, { codes: string[]; label: string }> = {
  ENG: { codes: ['DSC-70-20'], label: 'DSC-70-20 Engines' },
  BLEED: { codes: ['DSC-36-20'], label: 'DSC-36-20 Bleed Air' },
  ELEC: { codes: ['DSC-24-20'], label: 'DSC-24-20 Electrical' },
  HYD: { codes: ['DSC-29-20'], label: 'DSC-29-20 Hydraulic' },
  FCTL: { codes: ['DSC-27-10-20', 'DSC-27-20-30'], label: 'DSC-27 Flight Controls' },
  FUEL: { codes: ['DSC-28-20'], label: 'DSC-28-20 Fuel' },
  DOOR: { codes: ['DSC-35-20-20', 'DSC-52-30-30-20'], label: 'DSC-35·52 Oxygen · Doors' },
};

export type SdKind = 'normal' | 'amber' | 'red' | 'advisory' | 'cond';
export interface SdLine {
  text: string;
  kind: SdKind;
}
export interface SdBlock {
  title: string;
  /** 무엇에 대한 것인지 (예: "The APU generator load is normal.") — 같은 제목이 여러 번 나올 때 구분 */
  sub?: string;
  seq: number;
  lines: SdLine[];
}

interface Page {
  seq: number;
  code?: string;
  text: string;
}

const UNIT = /\d[\d ,.]*\s?(?:PSI|°C|%|QT|V\b|Hz|kVA|KVA|A\b|kg|ft|bar|s\b|mn\b)/i;
const COND = /\b(above|below|more than|less than|greater than|lower than|higher than|exceed|between|at or above|at or below|normal|abnormal|pulses?|amber|red|advisory)\b/i;
const SENTENCE = /\b(is|are|at or|when|if|between)\b/i;

/** 문장 낱말로 앱 분류 (색 단정 아님) */
export function kindOf(t: string): SdKind {
  if (/\bred\b/i.test(t)) return 'red';
  if (/\bamber\b/i.test(t)) return 'amber';
  if (/\b(pulses?|advisory)\b/i.test(t)) return 'advisory';
  if (/\bnormal\b/i.test(t) && !/\babnormal\b/i.test(t)) return 'normal';
  return 'cond';
}

/** 그림 글자(OCR)처럼 깨진 줄 거르기: 글자 비율·문장 낱말 */
const looksLikeSentence = (l: string) => {
  const letters = (l.match(/[A-Za-z]/g) ?? []).length;
  return l.length >= 15 && letters / l.length > 0.55 && SENTENCE.test(l) && !/Ident\.|Applicable to/i.test(l);
};

export function extractSd(pages: Page[], sdId: string): SdBlock[] {
  const sec = SD_SECTIONS[sdId];
  if (!sec) return [];
  const out: SdBlock[] = [];
  let cur: SdBlock | null = null;
  for (const p of pages) {
    if (!sec.codes.some((c) => (p.code ?? '').startsWith(c))) continue;
    for (const raw of p.text.split('\n')) {
      const l = raw.replace(/[*_¦|]+/g, ' ').replace(/\s+/g, ' ').trim();
      const h = /^#{3,6}\s*(.+)$/.exec(l);
      if (h) {
        cur = { title: h[1].trim(), seq: p.seq, lines: [] };
        out.push(cur);
        continue;
      }
      if (cur && !cur.sub && looksLikeSentence(l)) {
        // 줄의 첫 문장이 숫자 없는 "The … is …" 면 부제 (예: "The APU generator load is normal. The load is normal, when …")
        const first = l.replace(/^- /, '').split(/(?<=\.)\s/)[0];
        if (!/\d/.test(first) && /^The [a-z].{6,80}?\b(is|are)\b/i.test(first)) cur.sub = first.slice(0, 90);
      }
      if (!cur || !UNIT.test(l) || !COND.test(l) || !looksLikeSentence(l)) continue;
      // 한 줄에 여러 문장이면 나눠서 숫자 있는 문장만
      for (const s of l.split(/(?<=\.)\s+(?=[A-Z‐-])/)) {
        const t = s.replace(/^[-‐•\s]+/, '').trim();
        if (t.length >= 12 && UNIT.test(t) && COND.test(t) && !cur.lines.some((x) => x.text === t)) cur.lines.push({ text: t.slice(0, 240), kind: kindOf(t) });
      }
    }
  }
  // 내용이 같은 블록은 하나만
  const seen = new Set<string>();
  return out.filter((b) => {
    if (!b.lines.length) return false;
    const k = `${b.title}|${b.sub ?? ''}|${b.lines.map((l) => l.text).join('|')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
