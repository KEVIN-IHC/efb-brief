// 기상 데이터 모델 — aviationweather.gov(JSON)·Open-Meteo 응답을 앱에서 쓰는 모양으로 줄인 것
export type FltCat = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface Cloud {
  cover: string; // FEW SCT BKN OVC OVX NSC CAVOK
  base: number | null; // ft AGL
}

export interface Metar {
  icao: string;
  name?: string;
  obsTime: string; // ISO
  raw: string;
  wdir: number | 'VRB' | null;
  wspd: number | null;
  wgst: number | null;
  visib: string | number | null; // SM (AWC 표기 '10+', '6+')
  temp: number | null;
  dewp: number | null;
  altim: number | null; // hPa
  clouds: Cloud[];
  cover?: string;
  fltCat: FltCat | null;
  lat?: number;
  lon?: number;
}

export interface TafPeriod {
  from: string;
  to: string;
  change: string | null; // FM BECMG TEMPO PROB
  prob: number | null;
  wdir: number | 'VRB' | null;
  wspd: number | null;
  wgst: number | null;
  visib: string | number | null;
  wx: string | null;
  clouds: Cloud[];
  vertVis: number | null;
  fltCat: FltCat | null;
}

export interface Taf {
  icao: string;
  name?: string;
  issueTime: string;
  validFrom: string;
  validTo: string;
  raw: string;
  periods: TafPeriod[];
}

export interface Sigmet {
  id: string; // 중복 제거용
  source: 'intl' | 'us';
  fir: string; // FIR 코드 또는 발표 기관
  firName?: string;
  hazard: string; // TS TURB ICE VA MTW TC CONVECTIVE …
  qualifier?: string;
  base: number | null; // ft
  top: number | null;
  validFrom: string;
  validTo: string;
  raw: string;
  /** 다각형 (여러 개 가능). 점 = [lat, lon] */
  polys: [number, number][][];
}

export interface WindPoint {
  seq: number;
  name: string;
  lat: number;
  lon: number;
  fl: number; // 표시한 고도
  time: string; // 예보 시각 (웨이포인트 ETO에 가장 가까운 시각)
  dir: number | null;
  spd: number | null; // kt
  temp: number | null; // °C
  /** 기압면별 값 (버티컬 뷰, D-058). 예전 캐시에는 없음 */
  levels?: { hpa: number; dir: number | null; spd: number | null; temp: number | null }[];
  /** 0°C 고도 ft (Open-Meteo freezing_level_height) */
  freezingFt?: number | null;
}

export interface WindsData {
  model: string;
  /** 비행 시각이 예보 범위 밖이면 현재 시각 기준으로 대신 받음 */
  basis: 'eto' | 'now';
  points: WindPoint[];
}

/** IndexedDB wxSnapshots 한 줄 (키 [type, station]) */
export interface WxSnapshot<T = unknown> {
  type: 'metar' | 'taf' | 'sigmet' | 'winds' | 'meta';
  station: string; // ICAO, 'ALL', flightId
  fetchedAt: string;
  data: T;
  [k: string]: unknown;
}
