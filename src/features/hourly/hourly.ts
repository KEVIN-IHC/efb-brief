// 매시간 System Check (D-084): 손으로 적던 한 줄을 그대로
//   1700Z  31000/30990/31020  17.4/17.4/17.4/17.4  8.6/5800  455+2445=2900  1767/1828
//   시각 · 고도계 CAPT/STBY/F/O · 엔진 오일 1~4 · 여압 ΔP/CAB ALT · FU+FOB=합계(100 단위) · 산소 CKPT/CABIN (psi)
// 근거: FOM 10.4.1.3 d) 약 1시간마다 고도계 교차 점검, FCOM PRO-NOR-SOP-150 순항(SD 페이지·연료 FOB+FU), LIM-AIR(여압), LIM-OXY(산소)
// 기록은 기기 안(비행마다), 동기화 안 함. 판정 기준은 이미 앱에 있는 RVSM 표(D-080)만 씀 — 오일·여압·연료·산소는 숫자만 보여 줌

/** 기록 칸 (입력 순서 = 손글씨 순서) */
export const ENTRY_KEYS = ['time', 'altC', 'altS', 'altF', 'oil1', 'oil2', 'oil3', 'oil4', 'dp', 'cab', 'fu', 'fob', 'oxyC', 'oxyCab'] as const;
import { parseOil, RVSM_LIMITS } from '../checks/checks';

export interface HourlyEntry {
  time?: string; // HHMM (UTC)
  altC?: string;
  altS?: string;
  altF?: string;
  oil1?: string;
  oil2?: string;
  oil3?: string;
  oil4?: string;
  dp?: string; // psi
  cab?: string; // ft
  fu?: string; // 100 단위
  fob?: string; // 100 단위
  oxyC?: string; // 조종실 산소 압력 psi
  oxyCab?: string; // 객실 산소 압력 psi
  memo?: string;
  sd?: string[]; // 점검한 SD 페이지
  updatedAt?: string;
}

export interface HourlyRec extends HourlyEntry {
  id: string;
  savedAt: string; // ISO
}

export const recsKey = (flightId: string) => `hourly:${flightId}`;
export const draftKey = (flightId: string) => `hourlyDraft:${flightId}`;

/** FCOM PRO-NOR-SOP-150 순항 "SD PAGES … REVIEW" 항목 (+ ECAM MEMO). 설명은 짧게 줄인 것 — 원문은 📖 */
export const SD_PAGES: { id: string; label: string; what: string }[] = [
  { id: 'ENG', label: 'ENG', what: '오일 압력 · 오일 양 변화' },
  { id: 'BLEED', label: 'BLEED', what: '블리드 값' },
  { id: 'ELEC', label: 'ELEC', what: '전기 값 · GEN LOAD' },
  { id: 'HYD', label: 'HYD', what: '유압유 양' },
  { id: 'FCTL', label: 'F/CTL', what: '조종면 비정상 위치' },
  { id: 'FUEL', label: 'FUEL', what: '연료 양 · 분배' },
  { id: 'DOOR', label: 'DOOR', what: '산소 압력' },
  { id: 'MEMO', label: 'ECAM MEMO', what: 'MEMO 확인' },
];

export const num = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const v = Number(s.replace(/[,\s]/g, ''));
  return Number.isFinite(v) && s.trim() !== '' ? v : undefined;
};

/** 소수 첫째 자리 칸: 점 없이 쓰면 마지막 자리를 소수로 (오일 174 → 17.4, ΔP 86 → 8.6). Preflight 오일 칸과 같은 규칙 */
export const dec1 = (s: string | undefined): string | undefined => {
  const v = parseOil(s);
  return v === undefined ? s : v.toFixed(1);
};
export const DEC1_KEYS = ['oil1', 'oil2', 'oil3', 'oil4', 'dp'] as const;
/** 기록할 때 소수 칸 다듬기 */
export function normEntry<T extends HourlyEntry>(e: T): T {
  const out = { ...e };
  for (const k of DEC1_KEYS) if (out[k]?.trim()) out[k] = dec1(out[k]);
  return out;
}

/** 연료는 손글씨처럼 100 단위 (2445 = 244,500). 10,000 이상을 쓰면 원래 단위로 보고 100으로 나눔 */
export const fuel100 = (s: string | undefined): number | undefined => {
  const v = num(s);
  return v === undefined ? undefined : v >= 10000 ? Math.round(v / 100) : v;
};

export function fuelTotal(e: HourlyEntry): number | undefined {
  const fu = fuel100(e.fu);
  const fob = fuel100(e.fob);
  return fu === undefined || fob === undefined ? undefined : fu + fob;
}

/**
 * 고도계: CAPT↔F/O, CAPT↔STBY 차이. FL300 이상이면 FCOM 표(PFD 150 · ISIS 320), 아래면 FOM 순항 PFD 200만.
 * 200 초과 = Loss of Redundancy (FOM 10.4.1.3 d)
 */
export function altCheck(e: HourlyEntry) {
  const c = num(e.altC);
  const s = num(e.altS);
  const f = num(e.altF);
  const high = c !== undefined && c >= 30000;
  const pfdLim = high ? RVSM_LIMITS.fl300.pfd : RVSM_LIMITS.crz.pfd;
  const pfd = c !== undefined && f !== undefined ? { d: f - c, lim: pfdLim, ok: Math.abs(f - c) <= pfdLim, lor: Math.abs(f - c) > RVSM_LIMITS.crz.pfd } : undefined;
  const isis = c !== undefined && s !== undefined ? { d: s - c, lim: high ? RVSM_LIMITS.fl300.isis : undefined, ok: high ? Math.abs(s - c) <= RVSM_LIMITS.fl300.isis : true } : undefined;
  return { pfd, isis };
}

/** 엔진별 오일 변화 (앞 기록 대비, 소수 첫째 자리) */
export function oilDelta(e: HourlyEntry, prev: HourlyEntry | undefined): (number | undefined)[] {
  return (['oil1', 'oil2', 'oil3', 'oil4'] as const).map((k) => {
    const a = parseOil(e[k]);
    const b = parseOil(prev?.[k]);
    return a === undefined || b === undefined ? undefined : Math.round((a - b) * 10) / 10;
  });
}

/** 엔진별 오일 사용량 = 기준(출발 전 Preflight 오일 → 없으면 첫 기록) 대비 (D-088) */
export function oilBase(preflight: Partial<Record<'oil1' | 'oil2' | 'oil3' | 'oil4', string>> | undefined, recs: HourlyEntry[]): { base: HourlyEntry; src: 'PREFLIGHT' | 'FIRST' } | undefined {
  const keys = ['oil1', 'oil2', 'oil3', 'oil4'] as const;
  if (preflight && keys.some((k) => parseOil(preflight[k]) !== undefined)) return { base: preflight, src: 'PREFLIGHT' };
  const first = recs.find((r) => keys.some((k) => parseOil(r[k]) !== undefined));
  return first ? { base: first, src: 'FIRST' } : undefined;
}

/** 기록 시각(HHMM) → ISO. 저장 시각과 같은 날, 12시간 넘게 미래면 전날 */
export function recIso(r: HourlyRec): string {
  const m = /^(\d{2})(\d{2})$/.exec(r.time ?? '');
  if (!m) return r.savedAt;
  const s = new Date(r.savedAt);
  let t = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), +m[1], +m[2]);
  if (t - s.getTime() > 12 * 3_600_000) t -= 86_400_000;
  return new Date(t).toISOString();
}

/** 다음 점검: 마지막 기록 + 60분. 남은 분(음수 = 지남) */
export function nextDue(recs: HourlyRec[], now: number): { at: string; inMin: number } | undefined {
  if (!recs.length) return undefined;
  const last = Math.max(...recs.map((r) => Date.parse(recIso(r))));
  const at = last + 60 * 60000;
  return { at: new Date(at).toISOString(), inMin: Math.round((at - now) / 60000) };
}

export const nowHHMM = (d = new Date()) => `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;

/** 손글씨 한 줄 (복사·표시용) */
export function lineText(r0: HourlyEntry): string {
  const r = normEntry(r0);
  const j = (xs: (string | undefined)[]) => (xs.some(Boolean) ? xs.map((x) => x || '—').join('/') : '');
  const tot = fuelTotal(r);
  return [
    r.time ? `${r.time}Z` : '',
    j([r.altC, r.altS, r.altF]),
    j([r.oil1, r.oil2, r.oil3, r.oil4]),
    j([r.dp, r.cab]),
    r.fu || r.fob ? `${r.fu || '—'}+${r.fob || '—'}${tot !== undefined ? `=${tot}` : ''}` : '',
    j([r.oxyC, r.oxyCab]),
    r.memo ?? '',
  ]
    .filter(Boolean)
    .join('  ');
}
