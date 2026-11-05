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
