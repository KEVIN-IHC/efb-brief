// ATS FPL 장비·성능 신고 해석 (D-104) — ICAO Doc 4444 (PANS-ATM) Appendix 2, Item 10·18 표준 코드.
// 항공사·회사 자료가 아닌 국제 표준이라 공개 코드에 둔다. "신고했다" = 승인·장착을 FPL에 적었다는 뜻일 뿐, 실제 승인은 회사 자료로 확인.

/** 앱이 비교에 쓰는 능력 이름 */
export type Cap =
  | 'RVSM'
  | 'PBN'
  | 'RNP10'
  | 'RNAV5'
  | 'RNAV2'
  | 'RNAV1'
  | 'RNP4'
  | 'RNP2'
  | 'RNP1'
  | 'RNP_APCH'
  | 'RNP_AR'
  | 'CPDLC'
  | 'FANS'
  | 'ADSC'
  | 'RCP240'
  | 'RCP400'
  | 'RSP180'
  | 'RSP400'
  | 'SATVOICE'
  | 'HF'
  | 'MNPS';

export const CAP_LABEL: Record<Cap, string> = {
  RVSM: 'RVSM',
  PBN: 'PBN 승인',
  RNP10: 'RNP10 (RNAV10)',
  RNAV5: 'RNAV5',
  RNAV2: 'RNAV2',
  RNAV1: 'RNAV1',
  RNP4: 'RNP4',
  RNP2: 'RNP2',
  RNP1: 'RNP1',
  RNP_APCH: 'RNP APCH',
  RNP_AR: 'RNP AR',
  CPDLC: 'CPDLC',
  FANS: 'FANS 1/A',
  ADSC: 'ADS-C',
  RCP240: 'RCP240',
  RCP400: 'RCP400',
  RSP180: 'RSP180',
  RSP400: 'RSP400',
  SATVOICE: 'SATVOICE',
  HF: 'HF',
  MNPS: 'MNPS (NAT HLA)',
};

export interface FplCode {
  /** 원문 표기 (예: J5, PBN/L1, SUR/RSP180) */
  code: string;
  meaning: string;
  caps: Cap[];
}

// Item 10a (통신·항법 장비)
const ITEM10A: Record<string, [string, Cap[]]> = {
  H: ['HF RTF', ['HF']],
  J1: ['CPDLC ATN VDL Mode 2', ['CPDLC']],
  J2: ['CPDLC FANS 1/A HFDL', ['CPDLC', 'FANS']],
  J3: ['CPDLC FANS 1/A VDL Mode A', ['CPDLC', 'FANS']],
  J4: ['CPDLC FANS 1/A VDL Mode 2', ['CPDLC', 'FANS']],
  J5: ['CPDLC FANS 1/A SATCOM (INMARSAT)', ['CPDLC', 'FANS']],
  J6: ['CPDLC FANS 1/A SATCOM (MTSAT)', ['CPDLC', 'FANS']],
  J7: ['CPDLC FANS 1/A SATCOM (Iridium)', ['CPDLC', 'FANS']],
  M1: ['ATC SATVOICE (INMARSAT)', ['SATVOICE']],
  M2: ['ATC SATVOICE (MTSAT)', ['SATVOICE']],
  M3: ['ATC SATVOICE (Iridium)', ['SATVOICE']],
  P1: ['CPDLC RCP 400', ['RCP400']],
  P2: ['CPDLC RCP 240', ['RCP240']],
  P3: ['SATVOICE RCP 400', ['RCP400']],
  R: ['PBN 승인 (세부는 PBN/)', ['PBN']],
  W: ['RVSM 승인', ['RVSM']],
  X: ['MNPS (NAT HLA) 승인', ['MNPS']],
};
// Item 10b (감시 장비) — ADS-C만 비교에 씀
const ITEM10B: Record<string, [string, Cap[]]> = {
  D1: ['ADS-C FANS 1/A', ['ADSC']],
  G1: ['ADS-C ATN', ['ADSC']],
};
// Item 18 PBN/
const PBN: Record<string, [string, Cap[]]> = {
  A1: ['RNAV 10 (RNP 10)', ['RNP10']],
  B1: ['RNAV 5 (모든 센서)', ['RNAV5']],
  B2: ['RNAV 5 GNSS', ['RNAV5']],
  B3: ['RNAV 5 DME/DME', ['RNAV5']],
  B4: ['RNAV 5 VOR/DME', ['RNAV5']],
  B5: ['RNAV 5 INS/IRS', ['RNAV5']],
  B6: ['RNAV 5 LORAN C', ['RNAV5']],
  C1: ['RNAV 2 (모든 센서)', ['RNAV2']],
  C2: ['RNAV 2 GNSS', ['RNAV2']],
  C3: ['RNAV 2 DME/DME', ['RNAV2']],
  C4: ['RNAV 2 DME/DME/IRU', ['RNAV2']],
  D1: ['RNAV 1 (모든 센서)', ['RNAV1']],
  D2: ['RNAV 1 GNSS', ['RNAV1']],
  D3: ['RNAV 1 DME/DME', ['RNAV1']],
  D4: ['RNAV 1 DME/DME/IRU', ['RNAV1']],
  L1: ['RNP 4', ['RNP4']],
  O1: ['Basic RNP 1 (모든 센서)', ['RNP1']],
  O2: ['Basic RNP 1 GNSS', ['RNP1']],
  O3: ['Basic RNP 1 DME/DME', ['RNP1']],
  O4: ['Basic RNP 1 DME/DME/IRU', ['RNP1']],
  S1: ['RNP APCH', ['RNP_APCH']],
  S2: ['RNP APCH + BARO-VNAV', ['RNP_APCH']],
  T1: ['RNP AR APCH (RF 포함)', ['RNP_AR']],
  T2: ['RNP AR APCH (RF 없음)', ['RNP_AR']],
};

const tokens = (s: string) => s.match(/[A-Z]\d?/g) ?? [];

/** FPL Item 10 장비 문자열 (예: "SDE1E2E3FGHIJ1J2J3J4J5M1P2RWXYZ/LB1D1") + Item 18 → 신고 코드 목록과 능력 */
export function decodeFpl(equipment: string, item18: Record<string, string>): { codes: FplCode[]; caps: Set<Cap> } {
  const codes: FplCode[] = [];
  const [a = '', b = ''] = equipment.split('/');
  for (const t of tokens(a)) if (ITEM10A[t]) codes.push({ code: t, meaning: ITEM10A[t][0], caps: ITEM10A[t][1] });
  for (const t of tokens(b)) if (ITEM10B[t]) codes.push({ code: t, meaning: ITEM10B[t][0], caps: ITEM10B[t][1] });
  for (const t of tokens(item18.PBN ?? '')) if (PBN[t]) codes.push({ code: `PBN/${t}`, meaning: PBN[t][0], caps: PBN[t][1] });
  for (const m of (item18.SUR ?? '').matchAll(/\bRSP\s?(180|400)\b/g)) codes.push({ code: `SUR/RSP${m[1]}`, meaning: `RSP ${m[1]} (감시 성능)`, caps: [m[1] === '180' ? 'RSP180' : 'RSP400'] });
  for (const m of (item18.COM ?? '').matchAll(/\bRCP\s?(240|400)\b/g)) codes.push({ code: `COM/RCP${m[1]}`, meaning: `RCP ${m[1]} (통신 성능)`, caps: [m[1] === '240' ? 'RCP240' : 'RCP400'] });
  if (item18.DAT) codes.push({ code: `DAT/${item18.DAT.split(/\s+/)[0]}`, meaning: '데이터링크 종류 (FANS·PBCS 표시 등, 원문)', caps: [] });
  return { codes, caps: new Set(codes.flatMap((c) => c.caps)) };
}
