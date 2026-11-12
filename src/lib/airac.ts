// AIRAC 주기 (28일). 기준: AIRAC 2401 = 2024-01-25 시작. 통신표 등 개인 입력 자료가 몇 주기 전 것인지 보여줄 때 사용 (D-057)
const BASE = Date.UTC(2024, 0, 25);
const CYCLE = 28 * 86_400_000;

export interface Airac {
  /** 예: 2612 */
  id: string;
  start: string; // YYYY-MM-DD
  /** 기준 이후 주기 번호 (비교용) */
  n: number;
}

export function airacOf(at: number | string | Date = Date.now()): Airac {
  const t = typeof at === 'number' ? at : new Date(at).getTime();
  const n = Math.floor((t - BASE) / CYCLE);
  const start = BASE + n * CYCLE;
  const year = new Date(start).getUTCFullYear();
  const firstOfYear = BASE + Math.ceil((Date.UTC(year, 0, 1) - BASE) / CYCLE) * CYCLE;
  const idx = Math.round((start - firstOfYear) / CYCLE) + 1;
  return { id: `${String(year).slice(2)}${String(idx).padStart(2, '0')}`, start: new Date(start).toISOString().slice(0, 10), n };
}

/** 입력 시각 이후 지난 주기 수 (0 = 같은 주기) */
export function airacAge(at: string | undefined, now = Date.now()): number | null {
  if (!at || !Number.isFinite(Date.parse(at))) return null;
  return airacOf(now).n - airacOf(at).n;
}
