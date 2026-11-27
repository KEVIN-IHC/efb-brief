// 내장 육지 윤곽 (public/geo/land.json, 앱과 함께 미리 저장 → 오프라인)
export type LandGeo = { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
let landCache: Promise<LandGeo> | null = null;
export const loadLand = () =>
  (landCache ??= fetch(new URL('./geo/land.json', location.href).href)
    .then((r) => r.json() as Promise<LandGeo>)
    .catch((e) => {
      landCache = null;
      throw e;
    }));
/** 고리마다 바깥 고리만 */
export function landRings(g: LandGeo): number[][][] {
  const out: number[][][] = [];
  for (const f of g.features) {
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
    for (const p of polys) if (p[0]?.length) out.push(p[0]);
  }
  return out;
}
