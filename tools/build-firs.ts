// 개발용: FIR 경계 공개 자료 생성 (인터넷 필요) → public/geo/firs.json (D-059)
// 사용: npx vite-node tools/build-firs.ts
//  - 출처: VATSpy Data Project (VATSIM, https://github.com/vatsimnetwork/vatspy-data-project) — CC BY-SA 4.0
//    비행 시뮬레이션 커뮤니티 자료 = **비공식**. 실제 AIP 경계와 다를 수 있음 → 앱에서 "참고용"으로만 그림
//  - 4글자 FIR만 (시뮬레이터 하위 구역 RKRR-N 등은 기본 FIR이 없을 때만 합침). 좌표 0.01° 반올림 + 단순화(약 0.05°)
//  - 이름은 VATSpy 표기 (실제 FIR 이름과 다를 수 있음. 앱은 OFP 이름을 먼저 씀)
import { writeFileSync } from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/';
const OUT = 'public/geo/firs.json';
const TOL = 0.05;

type Pt = [number, number]; // [lon, lat]

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (!dx && !dy) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const c: Pt = [a[0] + t * dx, a[1] + t * dy];
  return Math.hypot(p[0] - c[0], p[1] - c[1]);
}

function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let max = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > max) (max = d), (idx = i);
    }
    if (max > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

async function main() {
  const [geo, dat, commit] = await Promise.all([
    fetch(BASE + 'Boundaries.geojson').then((r) => r.json()),
    fetch(BASE + 'VATSpy.dat').then((r) => r.text()),
    fetch('https://api.github.com/repos/vatsimnetwork/vatspy-data-project/commits/master')
      .then((r) => r.json())
      .catch(() => null),
  ]);
  // [FIRs] ICAO|NAME|CALLSIGN|BOUNDARY — 이름 (첫 번째)
  const names = new Map<string, string>();
  let inFirs = false;
  for (const line of dat.split(/\r?\n/)) {
    if (line.startsWith('[')) inFirs = line.trim() === '[FIRs]';
    else if (inFirs && line && !line.startsWith(';')) {
      const [icao, name, , boundary] = line.split('|');
      const k = (boundary || icao).trim();
      if (k && name && !names.has(k)) names.set(k, name.trim());
    }
  }
  const byId = new Map<string, { oceanic: boolean; polys: Pt[][] }>();
  for (const f of geo.features as { properties: { id: string; oceanic: string }; geometry: { coordinates: Pt[][][] } }[]) {
    byId.set(f.properties.id, { oceanic: f.properties.oceanic === '1', polys: f.geometry.coordinates.map((p) => p[0]) });
  }
  const out: { id: string; name: string; oceanic?: 1; polys: [number, number][][] }[] = [];
  const groups = new Map<string, string[]>();
  for (const id of byId.keys()) {
    const m = /^([A-Z]{4})(-.+)?$/.exec(id);
    if (!m) continue;
    groups.set(m[1], [...(groups.get(m[1]) ?? []), id]);
  }
  let points = 0;
  for (const [base, ids] of [...groups].sort()) {
    const use = byId.has(base) ? [base] : ids;
    const polys: [number, number][][] = [];
    for (const id of use)
      for (const ring of byId.get(id)!.polys) {
        // 앱 형식 [lat, lon], 0.01° 반올림
        const s = simplify(ring, TOL).map(([lon, lat]) => [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100] as [number, number]);
        if (s.length >= 4) {
          polys.push(s);
          points += s.length;
        }
      }
    if (!polys.length) continue;
    out.push({ id: base, name: names.get(base) ?? names.get(use[0]) ?? base, ...(byId.get(use[0])!.oceanic ? { oceanic: 1 as const } : {}), polys });
  }
  const doc = {
    source: 'VATSpy Data Project (VATSIM) — https://github.com/vatsimnetwork/vatspy-data-project',
    license: 'CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ (단순화·좌표 반올림한 변형본, 같은 조건)',
    note: '비행 시뮬레이션 커뮤니티 자료 — 비공식, 실제 AIP 경계와 다를 수 있음',
    commit: commit?.sha?.slice(0, 7) ?? null,
    commitDate: commit?.commit?.committer?.date ?? null,
    builtAt: new Date().toISOString(),
    firs: out,
  };
  writeFileSync(OUT, JSON.stringify(doc));
  console.log(`FIR ${out.length}개, 점 ${points}개 → ${OUT} (${Math.round(JSON.stringify(doc).length / 1024)}KB)`);
}

void main();
