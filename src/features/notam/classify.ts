// NOTAM 분류·강조 규칙 (D-043). 숨기지 않고 분류·강조만 한다.
// 1) 그룹: OFP가 붙인 분류 제목(◼ RUNWAY 등) → 앱 그룹. 근거 = OFP 제목 줄 + 대응 NOTAM Code 주제 그룹(앱 해석)
// 2) 키워드 칩: E) 본문의 공식 약어. 근거 = Doc 8400 약어 / FAA JO 7930.2 / 일반 낱말(근거 문서 없음)
import type { OfpNotamItem } from '../ofp/types';
import type { RefId } from './refs';

export type NotamGroup = 'runway' | 'navaid' | 'airspace' | 'procedure' | 'ground' | 'comms' | 'aerodrome' | 'company' | 'other';

export const GROUPS: { id: NotamGroup; label: string; key: boolean }[] = [
  { id: 'runway', label: '활주로', key: true },
  { id: 'navaid', label: '항행시설', key: true },
  { id: 'airspace', label: '공역', key: true },
  { id: 'procedure', label: '접근·출발', key: false },
  { id: 'ground', label: '유도로·계류장', key: false },
  { id: 'comms', label: '통신', key: false },
  { id: 'aerodrome', label: '공항·장애물', key: false },
  { id: 'other', label: '기타', key: false },
  { id: 'company', label: '회사', key: false },
];
export const groupLabel = (g: NotamGroup) => GROUPS.find((x) => x.id === g)!.label;

/** OFP 분류 제목 → 그룹 + 대응 NOTAM Code 주제 그룹 (샘플 10개에 나온 제목 전부) */
const HEADING: Record<string, { group: NotamGroup; qcode?: string }> = {
  RUNWAY: { group: 'runway', qcode: 'M 이동·착륙 지역 (MR 활주로)' },
  'RUNWAY LIGHT': { group: 'runway', qcode: 'L 조명 시설' },
  'APPROACH LIGHT': { group: 'runway', qcode: 'L 조명 시설 (LA 진입등)' },
  NAVAID: { group: 'navaid', qcode: 'N 터미널·항로 항법시설' },
  GPS: { group: 'navaid', qcode: 'GNSS (G 그룹 — 원문 대조 전)' },
  AIRSPACE: { group: 'airspace', qcode: 'R 공역 제한 · A 공역 구성' },
  AIRWAY: { group: 'airspace', qcode: 'A 공역 구성 (AR ATS 항로)' },
  APPROACH: { group: 'procedure', qcode: 'I ILS/MLS · P 항공교통 절차' },
  DEPARTURE: { group: 'procedure', qcode: 'P 항공교통 절차' },
  TAXIWAY: { group: 'ground', qcode: 'M 이동·착륙 지역 (MX 유도로)' },
  'TAXIWAY LIGHT': { group: 'ground', qcode: 'L 조명 시설' },
  RAMP: { group: 'ground', qcode: 'M 이동·착륙 지역 (MN 계류장)' },
  COMMUNICATION: { group: 'comms', qcode: 'C 통신·레이더 · S 항공교통 업무' },
  AIRPORT: { group: 'aerodrome', qcode: 'F 시설·업무 (FA 비행장)' },
  OBSTRUCTION: { group: 'aerodrome', qcode: 'O 기타 (OB 장애물)' },
  AIP: { group: 'other' },
  OTHER: { group: 'other', qcode: 'O 기타' },
};

export interface Reason {
  text: string;
  ref: RefId;
  line?: number;
}

export interface Chip {
  id: string;
  label: string;
  /** 영향이 큰 상태 (폐쇄·사용 불가·활성) */
  strong: boolean;
  /** 본문에서 실제로 찾은 낱말 */
  hit: string;
  reason: Reason;
}

export interface Classified {
  group: NotamGroup;
  chips: Chip[];
  runways: string[];
  reasons: Reason[];
  /** 활주로·항행시설·공역 그룹이면서 강한 칩이 있음 → 강조 */
  key: boolean;
  /** 그룹이 핵심(활주로·항행시설·공역) */
  keyGroup: boolean;
}

interface KwRule {
  id: string;
  label: string;
  re: RegExp;
  strong: boolean | ((g: NotamGroup) => boolean);
  ref: RefId;
  meaning: string;
}

/** 본문 키워드 규칙. meaning = 화면 근거 문구 */
const KW: KwRule[] = [
  { id: 'clsd', label: '폐쇄', re: /\bCLSD\b|\bCLOSED\b/, strong: true, ref: 'doc8400Abbr', meaning: 'CLSD = closed (폐쇄)' },
  { id: 'us', label: '사용 불가', re: /\bU\/S\b|\bUNSERVICEABLE\b/, strong: true, ref: 'doc8400Abbr', meaning: 'U/S = unserviceable (사용 불가)' },
  { id: 'ots', label: '사용 중지', re: /\bOTS\b|\bOUT OF SERVICE\b/, strong: true, ref: 'faa7930', meaning: 'OTS = out of service (사용 중지)' },
  { id: 'unusbl', label: '사용 불가', re: /\bUNUSBL\b|\bUNUSABLE\b/, strong: true, ref: 'faa7930', meaning: 'UNUSBL = unusable (사용 불가)' },
  { id: 'notavbl', label: '이용 불가', re: /\bNOT\s+AVBL\b|\bNOT\s+AVAILABLE\b/, strong: true, ref: 'doc8400Abbr', meaning: 'AVBL = available — NOT AVBL (이용 불가)' },
  { id: 'act', label: '활성', re: /\bACT\b|\bACTIVATED\b|\bACTIVE\b/, strong: (g) => g === 'airspace', ref: 'doc8400Abbr', meaning: 'ACT = active / activated / activity (활성·활동)' },
  { id: 'area', label: '금지·제한·위험 구역', re: /\bPROHIBITED\b|\bRESTRICTED AREA\b|\bDANGER AREA\b|\bTRA\b|\bTSA\b/, strong: false, ref: 'doc8400Qcode', meaning: 'NOTAM Code R 그룹 (RP 금지 · RR 제한 · RD 위험 · RT 임시 제한 구역)' },
  { id: 'dthr', label: '시단 이동', re: /\bDTHR\b|\bTHR\s+DISPLACED\b|\bDISPLACED\s+THR\b/, strong: false, ref: 'doc8400Abbr', meaning: 'DTHR = displaced threshold (이동된 활주로 시단)' },
  { id: 'decl', label: '공시거리', re: /\b(?:TORA|TODA|ASDA|LDA)\b/, strong: false, ref: 'doc8400Abbr', meaning: 'TORA/TODA/ASDA/LDA = 공시거리' },
  { id: 'wip', label: '공사', re: /\bWIP\b|\bWORK IN PROGRESS\b|\bCONSTRUCTION\b/, strong: false, ref: 'doc8400Abbr', meaning: 'WIP = work in progress (공사 중)' },
  { id: 'obst', label: '장애물', re: /\bOBST\b|\bCRANES?\b/, strong: false, ref: 'doc8400Abbr', meaning: 'OBST = obstacle (장애물)' },
  { id: 'ils', label: 'ILS', re: /\bILS\b|\bLOC\b|\bGP\b|\bGLIDE ?PATH\b|\bLOCALIZER\b/, strong: false, ref: 'doc8400Abbr', meaning: 'ILS / LOC / GP = 계기착륙장치·로컬라이저·활공로' },
  { id: 'vor', label: 'VOR·DME·NDB', re: /\bVOR\b|\bVORTAC\b|\bVOR\/DME\b|\bDME\b|\bNDB\b|\bTACAN\b/, strong: false, ref: 'doc8400Abbr', meaning: 'VOR / DME / NDB / TACAN = 지상 항법시설' },
  { id: 'gnss', label: 'GNSS', re: /\bGPS\b|\bGNSS\b|\bRAIM\b|\bRNP\b|\bRNAV\b/, strong: false, ref: 'doc8400Abbr', meaning: 'GNSS / RAIM(수신기 자체 무결성 감시) / RNP' },
  { id: 'interf', label: '전파 간섭', re: /\bINTERFERENCE\b|\bJAMMING\b|\bSPOOFING\b|\bUNRELIABLE\b/, strong: false, ref: 'ofp', meaning: '본문 낱말 (INTERFERENCE·JAMMING·UNRELIABLE) — 공식 약어 아님' },
  { id: 'uas', label: '무인기·로켓·사격', re: /\bUAS\b|\bUAV\b|\bDRONES?\b|\bROCKET\b|\bMISSILE\b|\bFIRING\b|\bGUNFIRING\b/, strong: false, ref: 'ofp', meaning: '본문 낱말 (UAS·ROCKET·FIRING 등) — 공식 약어 아님' },
];

const RWY = /\bRWY\s*(\d{2}[LRC]?(?:\/\d{2}[LRC]?)?)/g;

export function classifyNotam(it: OfpNotamItem): Classified {
  const reasons: Reason[] = [];
  let group: NotamGroup;
  if (it.kind === 'company' || /COMPANY|TECHNICAL INFORMATION/.test(it.category)) {
    group = 'company';
    reasons.push({ text: `회사 권고 — OFP 제목 "${it.category}"${it.id ? ` · 번호 ${it.id}` : ''}. 당국 NOTAM 아님`, ref: 'company', line: it.categoryLine ?? it.line });
  } else {
    const h = HEADING[it.category];
    group = h?.group ?? 'other';
    reasons.push({ text: `OFP 분류 제목 "${it.category}"${h ? '' : ' (앱에 등록 안 된 제목 → 기타)'}`, ref: 'ofp', line: it.categoryLine ?? it.line });
    if (h?.qcode) reasons.push({ text: `대응 NOTAM Code 주제 그룹: ${h.qcode} (앱 해석)`, ref: 'doc8400Qcode' });
  }

  // 키워드는 E) 본문(당국 NOTAM) 또는 본문 전체(회사·자유 글)에서만. COMMENT)는 회사 주석이라 제외
  const body = it.text.toUpperCase();
  const chips: Chip[] = [];
  for (const k of KW) {
    const m = k.re.exec(body);
    if (!m) continue;
    const strong = typeof k.strong === 'function' ? k.strong(group) : k.strong;
    chips.push({ id: k.id, label: k.label, strong, hit: m[0], reason: { text: `본문 "${m[0]}" — ${k.meaning}`, ref: k.ref } });
  }
  const runways = [...new Set([...body.matchAll(RWY)].map((m) => m[1]))];
  const keyGroup = GROUPS.find((g) => g.id === group)!.key;
  const key = keyGroup && chips.some((c) => c.strong);
  if (it.kind === 'notam') reasons.push({ text: 'NOTAM 항목 구분 (D 시간표 · E 본문 · F 하한 · G 상한)', ref: 'pansAim' });
  return { group, chips, runways, reasons, key, keyGroup };
}

/** 분류 제목 목록에 없는 제목 (규칙 보강 필요 표시용) */
export const isKnownHeading = (c: string) => c in HEADING || /COMPANY|TECHNICAL INFORMATION/.test(c);
