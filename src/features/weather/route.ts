// 루트 ↔ 기상 위치 관계 (SIGMET 관련성, 날짜변경선 처리)
import { gcDistanceNm, type LatLon } from '../../lib/geo';
import type { Sigmet } from './types';

/** 점이 다각형 안인가 (경도는 같은 범위로 맞춰져 있다고 가정) */
export function pointInPoly(lat: number, lon: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 경도를 기준 경도 ±180 안으로 */
export const nearLon = (lon: number, ref: number) => lon + 360 * Math.round((ref - lon) / 360);

/**
 * 날짜변경선을 넘는 루트를 끊기지 않게: 앞 점과 180° 넘게 차이 나면 ±360
 * (지도에서 RKSI→KLAX가 지구 반대편으로 돌아가지 않도록)
 */
export function unwrapLons<T extends { lon: number }>(pts: T[]): T[] {
  let prev: number | null = null;
  return pts.map((p) => {
    const lon = prev == null ? p.lon : nearLon(p.lon, prev);
    prev = lon;
    return { ...p, lon };
  });
}

/**
 * 루트 관련 SIGMET: 다각형이 루트 점을 포함하거나, 다각형 꼭짓점이 루트 점에서 nm 이내
 * (루트 점 간격이 넓어도 놓치지 않도록 구간을 50NM 간격으로 보간)
 */
export function sigmetNearRoute(s: Sigmet, route: LatLon[], nm = 200): boolean {
  if (!route.length) return false;
  const dense = densify(route, 50);
  for (const poly of s.polys) {
    const ref = poly[0][1];
    const pts = dense.map((p) => ({ lat: p.lat, lon: nearLon(p.lon, ref) }));
    if (pts.some((p) => pointInPoly(p.lat, p.lon, poly))) return true;
    for (const [lat, lon] of poly) if (pts.some((p) => gcDistanceNm(p, { lat, lon }) <= nm)) return true;
  }
  return false;
}

function densify(route: LatLon[], stepNm: number): LatLon[] {
  const out: LatLon[] = [route[0]];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const n = Math.max(1, Math.ceil(gcDistanceNm(a, b) / stepNm));
    const bl = nearLon(b.lon, a.lon);
    for (let k = 1; k <= n; k++) out.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + ((bl - a.lon) * k) / n });
  }
  return out;
}
