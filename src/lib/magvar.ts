// 자기 편차 (D-106): NOAA·BGS World Magnetic Model (WMM2025, 2024-11 ~ 2029-11 유효) — geomagnetism 라이브러리(Apache-2.0)에 계수 포함, 오프라인 계산.
// 편차 decl: 동(+)·서(−). 자방위 = 진방위 − decl. 차트(Jeppesen) 활주로 자방위와 1° 안팎 차이 가능(모델·반올림·차트 기준 연도)
import geomagnetism from 'geomagnetism';

export function magVar(lat: number, lon: number, at = new Date()): number | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  try {
    return geomagnetism.model(at, { allowOutOfBoundsModel: true }).point([lat, lon]).decl;
  } catch {
    return null;
  }
}

/** 진방위 → 자방위 (1~360, 정수) */
export function trueToMag(hdgT: number, decl: number): number {
  const m = Math.round((((hdgT - decl) % 360) + 360) % 360);
  return m === 0 ? 360 : m;
}
