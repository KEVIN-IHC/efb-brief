// OFP 데이터 모델 (SPEC §10.2). 시간 분, 거리 NM, 시각 ISO UTC
// 연료·중량 단위는 OfpData.unit (데모 kg, 회사 Aviator 100LBS → lbs로 환산해 저장)

export type MassUnit = 'kg' | 'lbs';

export interface OfpWaypoint {
  seq: number;
  name: string;
  fullName?: string; // 예: NIIGATA, 43N160E
  lat: number;
  lon: number;
  airway: string;
  fl: number; // 0 = 지상 또는 CLB/DSC
  flText?: string; // 'CLB' | 'DSC' | '370'
  windDir: number | null; // deg (from)
  windSpd: number | null; // kt
  windComp?: number | null; // + tailwind
  oat: number | null; // °C (부호 있음)
  tempText?: string; // OFP 원문 표기 (Aviator OT 열은 부호 없음)
  tas: number | null;
  gs: number | null;
  mc?: number;
  mh?: number;
  tc?: number;
  msa?: number;
  sr?: number | null; // shear rate
  legDist: number;
  cumDist: number;
  legMin: number;
  cumMin: number; // 이륙 기준 누적
  eto: string;
  fuelRem: number; // 계획 잔여연료
  burn?: number; // 구간 소모
  accBurn?: number; // 누적 소모
  fir?: string; // 이 지점에서 진입하는 FIR (예: KZAK OAKLAND OCEANIC)
  srcLine?: number; // 원문 줄 번호
}

export interface EtpScenario {
  mode: string; // LRC / 1LE / 2LE …
  airports: [string, string];
  burn: [number, number];
  fl: [number, number];
  fob: number;
  lat: number;
  lon: number;
  flags: string; // M/D/F/S
}

export interface OfpEtp {
  name: string;
  airports: [string, string];
  lat: number;
  lon: number;
  eto: string;
  fuelOnBoard: number; // 계획상 ETP 도달 시 잔여연료
  /** 임계 연료 요구량 — OFP에 명시된 경우만 (추측해서 채우지 않음) */
  criticalFuel?: number;
  distFromDep?: number;
  distToAlt?: number;
  timeToAltMin?: number;
  fuelToAlt?: number;
  scenarios?: EtpScenario[];
}

export interface OfpMelItem {
  kind: 'MEL' | 'CDL';
  itemNo: string;
  title: string;
  category?: string;
  fuelPenalty?: string;
  restriction?: string;
  remarks?: string;
}

export interface OfpAlternate {
  icao: string;
  role: string; // DEST ALTN, TKOF ALTN, ENRT ALTN
  distNm: number;
  timeMin: number;
  fuel?: number;
  fl?: number;
  route?: string;
}

export interface LimitPair {
  planned: number;
  limit: number;
}

/** OFP 연료표 원래 줄 (Lido식 표시용) */
export interface FuelRow {
  label: string;
  fuel: number;
  timeMin?: number;
  kind?: 'sub' | 'total' | 'key';
}

export interface OfpData {
  unit: MassUnit;
  header: {
    flightNo: string;
    date: string; // YYYY-MM-DD (UTC)
    acType: string;
    reg: string;
    dep: string;
    arr: string;
    std: string;
    sta: string;
    takeoff: string; // 계획 이륙 시각
    blockMin: number;
    airMin: number;
    cruiseFl: number;
    costIndex: number;
    edtoRule?: string; // 예: "EDTO 180"
    engine?: string;
    selcal?: string;
    planNo?: string;
    computedAt?: string; // HHMMZ
    avgWindTemp?: string; // P074/M50
    routeString?: string;
    validUntil?: string;
  };
  fuel: {
    taxi: number;
    trip: number;
    contingency: number;
    alternate: number;
    finalReserve: number;
    extra: number;
    block: number;
    minRequired: number;
    rows?: FuelRow[];
  };
  weights: {
    zfw: LimitPair;
    tow: LimitPair;
    lw: LimitPair;
    payload: number;
    extraLimits?: { label: string; value: number }[]; // RWY, TCAP, AGTOW …
  };
  alternates: OfpAlternate[];
  route: OfpWaypoint[];
  etps: OfpEtp[];
  edtoAirports: string[];
  /** FL별 바람·기온 요약 (CRZ WIND). 높은 FL부터 */
  crzWind?: {
    fls: number[];
    isa: Record<number, number>;
    points: { name: string; byFl: Record<number, { dir: number; spd: number; comp: number; temp: number }> }[];
  };
  /** EDTO 형식 OFP: 항로 교체공항 사용 가능 시간창, 가장 임계 연료 시나리오 */
  edto?: { windows: { icao: string; from: string; to: string }[]; mostCritical?: string };
  mel: OfpMelItem[];
  notes: string[];
  pax?: string;
  cargo?: string;
  /** 노선 연료 소모 통계: 실제 − 계획 */
  fuelStats?: { period?: string; items: { label: string; value: number }[] };
  /** OFP NOTAM PACKAGE 1/2/3 (Phase 4). 원문 구조 그대로 — 분류는 화면에서 규칙으로 계산 */
  notams?: OfpNotams;
}

/** 원문 한 줄 (n = 원문 뷰어 줄 번호) */
export interface SrcText {
  n: number;
  text: string;
}

export interface OfpNotamItem {
  /** notam = 당국 NOTAM(번호 있음) · company = 회사 권고(COAD 등) · text = 제목 아래 자유 글(번호·유효기간 없음) */
  kind: 'notam' | 'company' | 'text';
  id?: string; // 예: A0001/26, COAD01/26, AIP SUP 1/26
  loc?: string; // 머리 줄의 위치 지시자 (RKSI)
  /** OFP가 붙인 분류 제목 (◼ RUNWAY) */
  category: string;
  categoryLine?: number;
  fromText?: string;
  toText?: string;
  from?: string; // ISO UTC
  to?: string; // ISO UTC — UFN·PERM이면 없음
  open?: 'UFN' | 'PERM';
  schedule?: string; // D)
  lower?: string; // F)
  upper?: string; // G)
  /** E) 본문 (회사 권고·자유 글은 본문 전체) */
  text: string;
  comment?: string; // COMMENT) — 회사 주석
  line: number; // 머리 줄
  /** 원문 줄 (페이지 꼬리말 제외) */
  lines: SrcText[];
}

export interface OfpNotamLocation {
  pkg: 1 | 2 | 3;
  role: string; // DEP · DEST · ALTN · ETP · EDTO · ERA · 3% ERA · REFILE · FIR
  icao: string;
  name: string;
  line: number;
  /** 공항 머리 아래 정보 줄 (1. RUNWAY : … / 2. COMPANY RADIO : …) */
  info: SrcText[];
  /** SEE THE SAME AIRPORT IN PACKAGE n */
  seeAlso?: number;
  noNotams?: boolean;
  items: OfpNotamItem[];
}

export interface OfpNotamPackage {
  no: 1 | 2 | 3;
  startLine: number;
  endLine: number;
  /** END OF … PACKAGE n 표시를 찾았는가 */
  endFound: boolean;
  header: SrcText[];
  locations: OfpNotamLocation[];
  /** 누락 점검: 날짜로 시작하는 머리 줄 수 vs 추출된 NOTAM·회사 권고 수 */
  counts: { headLines: number; parsed: number };
}

export interface OfpNotams {
  packages: OfpNotamPackage[];
  /** PACKAGE 3 머리의 FIR: 목록 (통과 순서) */
  firOrder: string[];
}

export interface OfpRecord {
  flightId: string;
  source: 'demo' | 'pdf';
  fileName?: string;
  pageCount?: number;
  /** 원문 텍스트 (PDF 추출 결과). 줄 번호 = 배열 index + 1 */
  rawText?: string;
  parsed?: OfpData;
  parserVersion: string;
  createdAt: string;
}
