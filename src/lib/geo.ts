// 대권(Great Circle) 계산. 좌표는 도(deg), 거리는 NM
export interface LatLon {
  lat: number;
  lon: number;
}

const R_NM = 3440.065;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function gcDistanceNm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** a→b 대권 위 비율 f(0~1) 지점 */
export function gcInterpolate(a: LatLon, b: LatLon, f: number): LatLon {
  const d = gcDistanceNm(a, b) / R_NM;
  if (d === 0) return { ...a };
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const [φ1, λ1, φ2, λ2] = [rad(a.lat), rad(a.lon), rad(b.lat), rad(b.lon)];
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: deg(Math.atan2(z, Math.hypot(x, y))), lon: deg(Math.atan2(y, x)) };
}

/** 초기 진방위 (deg, 0~360) */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const [φ1, φ2, Δλ] = [rad(a.lat), rad(b.lat), rad(b.lon - a.lon)];
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** "N3728.2 E12627.0" (도·분) */
export function formatLatLon(lat: number, lon: number): string {
  const f = (v: number, pos: string, neg: string, w: number) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = (a - d) * 60;
    return `${v >= 0 ? pos : neg}${String(d).padStart(w, '0')}${m.toFixed(1).padStart(4, '0')}`;
  };
  return `${f(lat, 'N', 'S', 2)} ${f(lon, 'E', 'W', 3)}`;
}
