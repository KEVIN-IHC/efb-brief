// 가져온 FOM에서 표를 읽는다 (D-052): 특수공항 목록, 공항별 회사 제한.
// 회사 매뉴얼 내용은 코드에 넣지 않고, 기기에 가져온 매뉴얼에서 그때그때 읽는다 (개정되면 자동 반영).
import { docPages, type StoredPage } from '../manual/lookup';
import { listManuals } from '../manual/store';

export interface SpecialAirport {
  icao: string;
  iata: string;
  name: string;
  /** 특성 (원문, 예 "Mountainous Terrain") */
  note: string;
  /** 표가 있던 쪽 */
  docId: string;
  seq: number;
  ref?: string;
}

export interface Restriction {
  /** 절 제목 (예 "5.8.2.1 B777 제한 사항") */
  title: string;
  icao: string;
  /** 다른 기종 전용 절이면 그 기종 */
  aircraft?: string;
  docId: string;
  seq: number;
  ref?: string;
}

/** 표 줄 "| Hong Kong | VHHH/HKG | Mountainous Terrain |" → 공항 */
export function parseSpecialTable(text: string): Omit<SpecialAirport, 'docId' | 'seq' | 'ref'>[] {
  const out: Omit<SpecialAirport, 'docId' | 'seq' | 'ref'>[] = [];
  for (const line of text.split('\n')) {
    const m = /^\|\s*([^|]*?)\s*\|\s*([A-Z]{4})\s*\/\s*([A-Z]{3})\s*\|\s*([^|]*?)\s*\|/.exec(line);
    if (m) out.push({ name: m[1], icao: m[2], iata: m[3], note: m[4] });
  }
  return out;
}

const startsSection = (p: StoredPage, code: string) => p.code === code || (p.code?.startsWith(`${code}.`) ?? false);

async function fomPages(): Promise<{ docId: string; pages: StoredPage[] }[]> {
  const docs = (await listManuals()).filter((d) => d.kind === 'FOM');
  return Promise.all(docs.map(async (d) => ({ docId: d.docId, pages: await docPages(d.docId) })));
}

/** 특수공항 표 (절 코드 예: FOM-S3.1.1.2 — 회사 기준 파일의 sections.specialAirports) */
export async function loadSpecialAirports(sectionCode: string): Promise<SpecialAirport[]> {
  const out: SpecialAirport[] = [];
  for (const { docId, pages } of await fomPages()) {
    // 표가 절 머리 다음 쪽(번호 없는 소제목 a) b) …)으로 이어질 수 있어, 절 시작부터 다음 번호 절 전까지
    const i = pages.findIndex((p) => p.code === sectionCode);
    if (i < 0) continue;
    for (let j = i; j < pages.length && (j === i || !pages[j].code || startsSection(pages[j], sectionCode)); j++)
      for (const a of parseSpecialTable(pages[j].text)) out.push({ ...a, docId, seq: pages[j].seq, ref: pages[j].ref });
  }
  return out;
}

const AIRCRAFT_RE = /\b(A3[2-8]\d|B7[3-8]\d)\b/;
/** 국내 공항 한글 이름 (FOM 공항 제한 절 제목에 코드가 없는 경우) — 공개 정보 */
const KO_NAMES: Record<string, string> = { 제주: 'RKPC', 김해: 'RKPK', 김포: 'RKSS', 인천: 'RKSI', 청주: 'RKTU', 대구: 'RKTN', 광주: 'RKJJ', 무안: 'RKJB', 양양: 'RKNY' };
const IATA_ICAO = /\(([A-Z]{3})\/([A-Z]{4})\)|\(([A-Z]{4})\/([A-Z]{3})\)/;

/**
 * 공항 제한 절(예 FOM-5.8) 아래 절마다 공항 코드 찾기.
 * 하위 절 제목에 기종이 있으면(예 "B777 제한 사항") 그 기종 전용으로 표시 → 화면에서 기종 필터
 */
export async function loadRestrictions(sectionCode: string): Promise<Restriction[]> {
  const out: Restriction[] = [];
  for (const { docId, pages } of await fomPages()) {
    let icao: string | null = null;
    for (const p of pages) {
      if (!p.code || !startsSection(p, sectionCode) || p.code === sectionCode) continue;
      // 절 제목: 쪽 머리("제 5 장 … › 5.8.3 KUMAMOTO (KMJ/RJFT) 공항")의 마지막 부분
      const head = (p.header?.split('›').pop() ?? p.text.split('\n').find((l) => /^#+\s/.test(l)) ?? '').replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
      const depth = p.code.split('.').length - sectionCode.split('.').length;
      if (depth === 1) {
        const c = IATA_ICAO.exec(head);
        icao = c ? (c[2] ?? c[3]) : (Object.entries(KO_NAMES).find(([k]) => head.includes(k))?.[1] ?? null);
      }
      if (!icao) continue;
      const ac = AIRCRAFT_RE.exec(head)?.[1];
      out.push({ title: head.slice(0, 80), icao, aircraft: ac, docId, seq: p.seq, ref: p.ref });
    }
  }
  return out;
}

/** 기종 일치 (A388·A380 → A380 계열) */
export function sameAircraft(restriction: string | undefined, acType: string): boolean {
  if (!restriction) return true;
  return restriction.slice(0, 3) === acType.toUpperCase().slice(0, 3);
}

/** 매뉴얼 쪽 코드(FOM 절·FCOM 쪽 코드) → 위치. 같은 코드가 여러 쪽이면 첫 쪽 */
export async function loadRefsFor(codes: string[]): Promise<Record<string, { docId: string; seq: number; ref?: string }>> {
  const docs = await listManuals();
  const out: Record<string, { docId: string; seq: number; ref?: string }> = {};
  const want = new Set(codes);
  for (const d of docs) {
    const pages = await docPages(d.docId);
    for (const p of pages) if (p.code && want.has(p.code) && !out[p.code]) out[p.code] = { docId: d.docId, seq: p.seq, ref: p.ref };
  }
  return out;
}
