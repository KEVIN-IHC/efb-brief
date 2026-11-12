// 더미 OFP: RKSI → KLAX (Phase 1). 대권 경로 위 가상 웨이포인트 DM01~DM12.
// 실제 항로명·회사 데이터 아님. 모든 수치는 장거리 쌍발기(B77W급) 범위의 가상 값.
import { bearingDeg, gcDistanceNm, gcInterpolate, type LatLon } from '../lib/geo';
import type { OfpData, OfpEtp, OfpRecord, OfpWaypoint } from '../features/ofp/types';
import { DEMO_FLIGHT } from './demoFlight';

export const DEMO_PARSER_VERSION = "demo-4";

const RKSI: LatLon = { lat: 37.4692, lon: 126.4505 };
const KLAX: LatLon = { lat: 33.9425, lon: -118.4081 };

// 웨이포인트별 계획 값 (출발, DM01~DM12, 도착)
const FL = [0, 290, 330, 330, 330, 350, 350, 350, 350, 370, 370, 370, 250, 0];
const WIND: [number, number][] = [
  [300, 15], [280, 95], [275, 145], [270, 130], [265, 110], [270, 85], [275, 70],
  [280, 55], [285, 45], [270, 40], [260, 35], [255, 30], [250, 20], [250, 8],
];
const TAS_CRUISE = 490;
const TAXI_OUT_MIN = 15;
const AIR_MIN = 615; // 10:15

const FUEL = { taxi: 1000, trip: 93800, contingency: 2800, alternate: 4200, finalReserve: 3600, extra: 2000 };

function isaOat(fl: number) {
  return Math.round(Math.max(-56.5, 15 - 1.98 * (fl / 10)) + 2); // ISA+2 근사
}

function buildRoute(takeoffMs: number, toFuel: number, landFuel: number): OfpWaypoint[] {
  const n = 13; // 구간 수
  const pts = Array.from({ length: n + 1 }, (_, i) => gcInterpolate(RKSI, KLAX, i / n));
  const names = ['RKSI', ...Array.from({ length: 12 }, (_, i) => `DM${String(i + 1).padStart(2, '0')}`), 'KLAX'];

  // 1) 구간 거리·GS·원시 시간
  const legs = pts.slice(1).map((p, i) => {
    const prev = pts[i];
    const dist = gcDistanceNm(prev, p);
    const track = bearingDeg(prev, p);
    const [wd, ws] = WIND[i + 1];
    const head = ws * Math.cos(((wd - track) * Math.PI) / 180);
    const tas = FL[i + 1] >= 290 ? TAS_CRUISE : 440;
    const gs = Math.round(tas - head);
    return { dist, gs, tas, raw: dist / gs };
  });
  // 2) 총 비행시간을 AIR_MIN에 맞춤 (상승·강하 보정 대신 단순 스케일)
  const scale = AIR_MIN / (legs.reduce((s, l) => s + l.raw, 0) * 60);
  // 3) 연료: 무거운 초반에 더 많이 소모 (rate ∝ 1.15 - 0.3·진행률)
  const burnTotal = toFuel - landFuel;
  let cumMin = 0;
  let cumDist = 0;
  let cumW = 0;
  const weights = legs.map((l, i) => l.raw * (1.15 - (0.3 * (i + 0.5)) / n));
  const wSum = weights.reduce((a, b) => a + b, 0);

  const route: OfpWaypoint[] = [
    {
      seq: 0, name: names[0], lat: pts[0].lat, lon: pts[0].lon, airway: 'SID', fl: 0,
      windDir: WIND[0][0], windSpd: WIND[0][1], oat: 14, tas: 0, gs: 0,
      legDist: 0, cumDist: 0, legMin: 0, cumMin: 0, eto: new Date(takeoffMs).toISOString(), fuelRem: toFuel,
    },
  ];
  legs.forEach((l, i) => {
    const legMin = Math.round(l.raw * 60 * scale);
    cumMin = i === legs.length - 1 ? AIR_MIN : cumMin + legMin;
    cumDist += l.dist;
    cumW += weights[i];
    const p = pts[i + 1];
    route.push({
      seq: i + 1,
      name: names[i + 1],
      lat: p.lat,
      lon: p.lon,
      airway: i === legs.length - 1 ? 'STAR' : 'DCT',
      fl: FL[i + 1],
      windDir: WIND[i + 1][0],
      windSpd: WIND[i + 1][1],
      oat: FL[i + 1] ? isaOat(FL[i + 1]) : 18,
      tas: l.tas,
      gs: l.gs,
      legDist: Math.round(l.dist),
      cumDist: Math.round(cumDist),
      legMin,
      cumMin,
      eto: new Date(takeoffMs + cumMin * 60000).toISOString(),
      fuelRem: Math.round((toFuel - (burnTotal * cumW) / wSum) / 100) * 100,
    });
  });
  // 마지막은 정확히 착륙 연료
  route[route.length - 1].fuelRem = landFuel;
  return route;
}

/** route 위 누적거리 비율 f 지점의 위치·시각·연료 (선형 보간) */
function pointAt(route: OfpWaypoint[], f: number) {
  const total = route[route.length - 1].cumDist;
  const d = total * f;
  const i = route.findIndex((w) => w.cumDist >= d);
  const a = route[i - 1];
  const b = route[i];
  const t = (d - a.cumDist) / (b.cumDist - a.cumDist);
  const pos = gcInterpolate(a, b, t);
  const etoMs = Date.parse(a.eto) + (Date.parse(b.eto) - Date.parse(a.eto)) * t;
  return { ...pos, eto: new Date(etoMs).toISOString(), fuel: Math.round((a.fuelRem + (b.fuelRem - a.fuelRem) * t) / 100) * 100 };
}

export function buildDemoOfp(): OfpData {
  const f = DEMO_FLIGHT;
  const block = Object.values(FUEL).reduce((a, b) => a + b, 0);
  const minRequired = block - FUEL.extra;
  const takeoffMs = Date.parse(f.std) + TAXI_OUT_MIN * 60000;
  const toFuel = block - FUEL.taxi;
  const landFuel = toFuel - FUEL.trip;
  const route = buildRoute(takeoffMs, toFuel, landFuel);
  // FIR 진입 표시 (D-055 화면 확인용, 경계 위치는 가상)
  const DEMO_FIR: Record<string, string> = { DM02: 'RJJJ FUKUOKA (DEMO)', DM04: 'KZAK OAKLAND OCEANIC (DEMO)', DM10: 'KZOA OAKLAND (DEMO)', DM12: 'KZLA LOS ANGELES (DEMO)' };
  for (const w of route) if (DEMO_FIR[w.name]) w.fir = DEMO_FIR[w.name];

  const zfw = 225000;
  const etps: OfpEtp[] = [
    { name: 'ETP1', airports: ['RJCC', 'PACD'], ...pickEtp(route, 0.3, 41800) },
    { name: 'ETP2', airports: ['PACD', 'CYVR'], ...pickEtp(route, 0.62, 21600) },
  ];

  return {
    unit: "kg",
    header: {
      flightNo: f.flightNo,
      date: f.std.slice(0, 10),
      acType: f.acType ?? 'B77W',
      reg: f.reg ?? 'HL0000',
      dep: f.dep,
      arr: f.arr,
      std: f.std,
      sta: f.sta,
      takeoff: new Date(takeoffMs).toISOString(),
      blockMin: Math.round((Date.parse(f.sta) - Date.parse(f.std)) / 60000),
      airMin: AIR_MIN,
      cruiseFl: 350,
      costIndex: 80,
      edtoRule: 'EDTO 180',
    },
    fuel: { ...FUEL, block, minRequired },
    weights: {
      zfw: { planned: zfw, limit: 237682 },
      tow: { planned: zfw + toFuel, limit: 351534 },
      lw: { planned: zfw + landFuel, limit: 251290 },
      payload: 49800,
    },
    alternates: [
      { icao: 'KONT', role: 'DEST ALTN', distNm: 49, timeMin: 18, fuel: FUEL.alternate },
      { icao: 'KSAN', role: 'DEST ALTN 2', distNm: 96, timeMin: 26, fuel: 5300 },
    ],
    route,
    etps,
    edtoAirports: ['RJCC', 'PACD', 'PANC', 'CYVR'],
    mel: [
      {
        kind: 'MEL', itemNo: '21-51-02', title: 'PACK 1 INOPERATIVE (DEMO)', category: 'C',
        fuelPenalty: '+1.5% TRIP', restriction: 'MAX FL350 (DEMO)', remarks: '(O) PACK 1 OFF 확인, 단일 PACK 운용 절차 수행',
      },
      {
        kind: 'MEL', itemNo: '49-11-01', title: 'APU INOPERATIVE (DEMO)', category: 'C',
        fuelPenalty: 'NIL', restriction: '지상 전원·에어카트 필요', remarks: '(M) APU 격리 확인',
      },
      {
        kind: 'CDL', itemNo: '52-12', title: 'DOOR SEAL FAIRING MISSING (DEMO)',
        fuelPenalty: '+0.3% TRIP', remarks: '항력 증가분 연료 반영됨',
      },
    ],
    fuelStats: { period: "42 flights (DEMO)", items: [ { label: "MEAN", value: -350 }, { label: "95%", value: 1400 }, { label: "99%", value: 2300 } ] },
    notes: [
      'EXTRA 2,000 KG — 출발지 지상 지연 대비 (DEMO)',
      'DM03–DM06 구간 MOD TURB 예보 FL330–FL370 (DEMO)',
      'KLAX RWY 06L/24R CLSD 0600–1400Z (DEMO NOTAM)',
      'ETP1 통과 전 연료 점검 수행 (DEMO)',
    ],
  };
}

function pickEtp(route: OfpWaypoint[], f: number, criticalFuel: number) {
  const p = pointAt(route, f);
  return { lat: p.lat, lon: p.lon, eto: p.eto, fuelOnBoard: p.fuel, criticalFuel };
}

export function demoOfpRecord(): OfpRecord {
  return {
    flightId: DEMO_FLIGHT.flightId,
    source: 'demo',
    parsed: buildDemoOfp(),
    parserVersion: DEMO_PARSER_VERSION,
    createdAt: new Date().toISOString(),
  };
}
