// 기상 신선도 (PROJECT_SPEC §5.6 표, D-038). 임계값은 명세 기본값 — 설정 변경은 이후
export type Fresh = 'ok' | 'warn' | 'bad';
export type WxKind = 'metar' | 'taf' | 'sigmet' | 'winds' | 'sat';

const MIN = 60_000;
const H = 60 * MIN;

/** 자동 갱신 주기 (ms) */
export const REFRESH_MS: Record<WxKind, number> = {
  metar: 10 * MIN,
  taf: 30 * MIN,
  sigmet: 15 * MIN,
  winds: 60 * MIN,
  sat: 30 * MIN,
};

/** 주황·빨강 경과 기준 (ms). TAF·SIGMET 빨강은 유효기간 종료가 우선 */
export const FRESH_LIMITS: Record<WxKind, { warn: number; bad: number; basis: string }> = {
  metar: { warn: 60 * MIN, bad: 120 * MIN, basis: '관측 시각 기준 60분 주황 · 120분 빨강' },
  taf: { warn: 6 * H, bad: 30 * H, basis: '발표 6시간(다음 발표 주기) 경과 주황 · 유효기간 종료 빨강' },
  sigmet: { warn: 30 * MIN, bad: 4 * H, basis: '받은 지 30분 주황 · 4시간(SIGMET 최대 유효) 빨강' },
  winds: { warn: 6 * H, bad: 12 * H, basis: '받은 지 6시간 주황 · 12시간 빨강' },
  sat: { warn: 2 * H, bad: 6 * H, basis: '영상 시각 기준 2시간 주황 · 6시간 빨강' },
};

/**
 * @param refIso 기준 시각 (METAR 관측, TAF 발표, 위성 영상, 그 외 받은 시각)
 * @param validToIso 유효기간 끝 (TAF·SIGMET) — 지나면 빨강
 */
export function freshness(kind: WxKind, refIso: string | null | undefined, now = Date.now(), validToIso?: string | null): Fresh {
  if (!refIso) return 'bad';
  const t = Date.parse(refIso);
  if (Number.isNaN(t)) return 'bad';
  if (validToIso && Date.parse(validToIso) <= now) return 'bad';
  const age = now - t;
  const lim = FRESH_LIMITS[kind];
  if (age >= lim.bad) return 'bad';
  if (age >= lim.warn) return 'warn';
  return 'ok';
}

export const isDue = (kind: WxKind, fetchedAtIso: string | null | undefined, now = Date.now()) =>
  !fetchedAtIso || now - Date.parse(fetchedAtIso) >= REFRESH_MS[kind];
