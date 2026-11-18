// FMS 입력·RVSM (D-079) · 정상 절차 체크리스트 (D-078) — 계산만. 저장은 ops/store 의 settings 키(기기 안, 동기화 안 함)
import type { OfpData } from '../ofp/types';

/* ---------------- FMS 입력 (OFP 탭 FUEL·FLIGHT·SYSTEMS 카드, D-079) ---------------- */

/** 입력한 글자 그대로 저장 (표시는 칸을 떠날 때 다듬음). 비행마다 따로, 기기 안에만 */
export interface FmsEntry {
  trip?: string; // TRIP 시간
  fob?: string; // RAMP OUT 줄 = FOB
  fod?: string;
  dist?: string;
  maxFl?: string;
  optFl?: string;
  eoFl?: string;
  gate?: string;
  latH?: 'N' | 'S';
  lat?: string;
  lonH?: 'E' | 'W';
  lon?: string;
  qnh?: string;
  elev?: string; // 공항 표고 ft (D-080)
  altC?: string; // CAPT
  altS?: string; // STBY
  altF?: string; // F/O
  oil1?: string;
  oil2?: string;
  oil3?: string;
  oil4?: string;
  hydG?: string; // NORMAL 체크 시각 (ISO)
  hydY?: string;
  oxyCrew?: string;
  oxyCabin?: string;
  updatedAt?: string;
}
export const fmsKey = (flightId: string) => `fmsCheck:${flightId}`;

/** 숫자 칸: 쉼표·공백 허용 */
export function parseNum(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const t = s.replace(/[,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return undefined;
  return Number(t);
}

/** 연료 칸(FOB·FOD): "290" · "290.2"(천 단위) · "290200" 모두 → 290200. 소수점이 있거나 1000 미만이면 ×1000 */
export function parseKilo(s: string | undefined): number | undefined {
  const v = parseNum(s);
  if (v === undefined || v < 0) return undefined;
  return s!.includes('.') || v < 1000 ? Math.round(v * 1000) : Math.round(v);
}

/** 시간 칸: "10:15" · "1015" · "615"(6시간 15분) → 분 */
export function parseHm(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const t = s.trim();
  let m = /^(\d{1,2})[:.hH](\d{2})$/.exec(t);
  if (!m) m = /^(\d{1,2})(\d{2})$/.exec(t);
  if (!m || Number(m[2]) > 59) return undefined;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** FL 칸: "380" · "FL380" · "37000"(ft) → 380 */
export function parseFl(s: string | undefined): number | undefined {
  const d = (s ?? '').replace(/\D/g, '');
  if (!d) return undefined;
  const v = Number(d);
  if (d.length >= 5) return Math.round(v / 100);
  return v >= 10 && v <= 510 ? v : undefined;
}

/** 좌표 칸: 숫자만 넣으면 도·분·소수 첫째 자리. 위도 "37271" → 37°27.1', 경도 "126270" → 126°27.0' */
export function fmtCoord(s: string | undefined, degDigits: 2 | 3): string | undefined {
  const d = (s ?? '').replace(/\D/g, '');
  if (d.length < degDigits + 2) return undefined;
  const deg = d.slice(0, degDigits);
  const min = d.slice(degDigits, degDigits + 2);
  const tenth = d.slice(degDigits + 2, degDigits + 3);
  if (Number(min) > 59 || Number(deg) > (degDigits === 2 ? 90 : 180)) return undefined;
  return `${deg}°${min}${tenth ? `.${tenth}` : ''}'`;
}

export const diff = (entered: number | undefined, ref: number | undefined) => (entered === undefined || ref === undefined ? undefined : entered - ref);

/** OFP 쪽 기준값: FUEL 표의 TRIP 시간·RAMP OUT·FOD, 거리 = 마지막 지점 누적 거리 */
export function ofpRefs(o: OfpData) {
  const row = (re: RegExp) => o.fuel.rows?.find((r) => re.test(r.label));
  return {
    tripMin: row(/^TRIP\b/)?.timeMin ?? o.header.airMin,
    /** 오일 최소량 계산용 비행 시간 = RAMP OUT 줄 시간 (없으면 비행 시간) */
    flightMin: row(/^(RAMP OUT|BLOCK)$/)?.timeMin ?? o.header.airMin,
    fob: o.fuel.block,
    fod: row(/^FOD$/)?.fuel,
    dist: o.route.at(-1)?.cumDist,
    maxFl: o.header.cruiseFl || undefined,
  };
}

/* ---------------- RVSM 고도계 ---------------- */

const HPA_PER_INHG = 33.8639;
/** 고도계 기압 설정 범위 — FCOM DSC (Baro reference): 745–1100 hPa / 22.00–32.48 inHg */
export const QNH_RANGE = { hpa: [745, 1100], inhg: [22, 32.48] } as const;
/** FCOM PRO-SUP "Operations at QNH above 1050 hPa (31.00 inHg)" */
export const QNH_HIGH_HPA = 1050;

export type Qnh = { unit: 'hPa' | 'inHg'; hpa: number; inhg: number; high: boolean };
/** QNH 한 칸: 745~1100 → hPa, 2200~3248 → inHg(÷100), "29.92"처럼 소수점 → inHg. 범위 밖이면 null, 빈칸이면 undefined */
export function parseQnh(s: string | undefined): Qnh | null | undefined {
  const t = (s ?? '').replace(/[^\d.]/g, '');
  if (!t) return undefined;
  const v = Number(t);
  if (!Number.isFinite(v)) return null;
  let unit: Qnh['unit'];
  let inhg: number;
  let hpa: number;
  if (t.includes('.') && v < 40) {
    if (v < QNH_RANGE.inhg[0] || v > QNH_RANGE.inhg[1]) return null;
    unit = 'inHg';
    inhg = v;
    hpa = Math.round(v * HPA_PER_INHG);
  } else if (v >= QNH_RANGE.hpa[0] && v <= QNH_RANGE.hpa[1]) {
    unit = 'hPa';
    hpa = Math.round(v);
    inhg = Math.round((v / HPA_PER_INHG) * 100) / 100;
  } else if (v >= QNH_RANGE.inhg[0] * 100 && v <= QNH_RANGE.inhg[1] * 100) {
    unit = 'inHg';
    inhg = v / 100;
    hpa = Math.round(inhg * HPA_PER_INHG);
  } else return null;
  return { unit, hpa, inhg, high: hpa > QNH_HIGH_HPA };
}

/** RVSM 고도계 기준 (D-080). GND: FOM 10.4.1.3 b) QNH로 맞춘 각 PFD − 공항 표고 75 ft · FCOM PRO-SPO-RVSM 지상 PFD↔PFD 20 · PFD↔ISIS 30.
 *  CRZ: FOM 10.4.1.3 d) 약 1시간마다 PFD↔PFD 200 (초과 = Loss of Redundancy). FL300+: FCOM M.85 PFD↔PFD 150 · PFD↔ISIS 320 (FL410 360) */
export const RVSM_LIMITS = {
  gnd: { elev: 75, pfd: 20, isis: 30 },
  crz: { pfd: 200 },
  fl300: { pfd: 150, isis: 320 },
} as const;

/** CAPT PFD는 공항 표고와, F/O PFD·STBY ISIS는 CAPT와 비교 (지상 기준) */
export function altChecks(e: Pick<FmsEntry, 'elev' | 'altC' | 'altS' | 'altF'>) {
  const [el, c, st, f] = [parseNum(e.elev), parseNum(e.altC), parseNum(e.altS), parseNum(e.altF)];
  const g = RVSM_LIMITS.gnd;
  const one = (v: number | undefined, ref: number | undefined, tol: number) => {
    const d = diff(v, ref);
    return d === undefined ? undefined : { d, ok: Math.abs(d) <= tol, tol };
  };
  return { capt: one(c, el, g.elev), fo: one(f, c, g.pfd), stby: one(st, c, g.isis) };
}

/* ---------------- SYSTEMS ---------------- */

/** 엔진 오일 최소량 (FCOM LIM-ENG OIL QUANTITY). 비행 시간 = OFP RAMP OUT 시간 (D-080).
 *  OAT < 0°C: 14h 미만 13 qt, 이상 6 + 0.5×FT · OAT ≥ 0°C: 8h 미만 10 qt, 이상 6 + 0.5×FT. 최소량이라 소수 첫째 자리 올림 */
export function minOil(flightMin: number | undefined): { cold: number; warm: number; max: number } | undefined {
  if (flightMin === undefined || !Number.isFinite(flightMin) || flightMin <= 0) return undefined;
  const h = flightMin / 60;
  const up = (x: number) => Math.ceil(x * 10 - 1e-9) / 10;
  const cold = h < 14 ? 13 : up(6 + 0.5 * h);
  const warm = h < 8 ? 10 : up(6 + 0.5 * h);
  return { cold, warm, max: Math.max(cold, warm) };
}

/** 엔진 오일(qt): "185" → 18.5 (소수점 없으면 마지막 자리를 소수 첫째로), "18.5" 그대로 */
export function parseOil(s: string | undefined): number | undefined {
  const t = (s ?? '').replace(/[^\d.]/g, '');
  if (!t) return undefined;
  if (t.includes('.')) return Number.isFinite(Number(t)) ? Number(t) : undefined;
  return t.length > 1 ? Number(t) / 10 : Number(t);
}

/* ---------------- 정상 절차 체크리스트 (Ops 탭) ---------------- */

export interface CheckGroup {
  id: string;
  title: string;
  items: { id: string; label: string }[];
}
/** 기본 목록 = 사용자 개인 항목 (회사 매뉴얼 내용 아님). 화면에서 고칠 수 있음 */
export const DEFAULT_CHECKLIST: CheckGroup[] = [
  { id: 'fms', title: 'FMS CHK', items: ['F-PLN', 'FIX INFO', 'TIME', 'EQUI-TIME POINT', 'CLST AP', 'SEC', 'RTE SAVE'].map((l, i) => ({ id: `fms${i}`, label: l })) },
  { id: 'balt', title: 'BALT', items: ['Briefing', 'ATC clearance', 'Load sheet', 'TO perf calculation'].map((l, i) => ({ id: `balt${i}`, label: l })) },
  { id: 'debtn', title: 'DEBTN', items: ['Door', 'Ext pwr', 'Bridge', 'Towing car', 'N/W STRG'].map((l, i) => ({ id: `debtn${i}`, label: l })) },
  { id: 'hwp', title: 'HWP', items: ['HF check', 'WPT check (random WPT)', 'PA'].map((l, i) => ({ id: `hwp${i}`, label: l })) },
];
export const CHECKLIST_KEY = 'opsChecklist';
/** 이 비행에서 체크한 항목: 항목 id → 체크 시각 */
export const checksKey = (flightId: string) => `opsChecks:${flightId}`;
export type CheckState = Record<string, string>;

export function progress(groups: CheckGroup[], st: CheckState) {
  const all = groups.flatMap((g) => g.items);
  return { done: all.filter((i) => st[i.id]).length, total: all.length };
}

/** HAA 칸 */
export interface HaaEntry {
  hdg?: string;
  alt?: string;
  spd?: string;
  fuel?: string;
}
export const haaKey = (flightId: string) => `opsHaa:${flightId}`;
