// 개발용: 지도에 내장할 공개 데이터 생성 (인터넷 필요, 결과물은 public/geo/ — 커밋 가능한 공개 자료)
// 사용: npx vite-node tools/build-geo.ts
//  - Natural Earth 1:50m 육지·국경선 (퍼블릭 도메인) → 좌표 단순화 → public/geo/land.json, borders.json
//  - OurAirports airports.csv (퍼블릭 도메인) → ICAO 4글자 대형·중형 공항 → public/geo/airports.json
// D-035, D-036
import { mkdirSync, writeFileSync } from 'node:fs';

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const OA = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv';
const OUT = 'public/geo';

type Pt = [number, number];

/** Douglas-Peucker 단순화 (도 단위 허용 오차) */
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const round = (p: Pt): Pt => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

function simplifyLine(line: Pt[], tol: number, closed: boolean): Pt[] | null {
  const r = line.map(round);
  // 닫힌 고리는 시작=끝이라 그대로 단순화하면 다 사라짐 → 중간에서 둘로 나눠 처리
  const mid = Math.floor(r.length / 2);
  const s = closed && r.length > 4 ? [...simplify(r.slice(0, mid + 1), tol).slice(0, -1), ...simplify(r.slice(mid), tol)] : simplify(r, tol);
  if (closed ? s.length < 4 : s.length < 2) return null;
  return s;
}

async function geo(name: string, tol: number) {
  const fc = (await (await fetch(`${NE}/${name}.geojson`)).json()) as { features: { geometry: { type: string; coordinates: unknown } }[] };
  const features: unknown[] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as Pt[][][];
      const out = polys.map((rings) => rings.map((r) => simplifyLine(r, tol, true)).filter(Boolean) as Pt[][]).filter((r) => r.length);
      if (out.length) features.push({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: out } });
    } else if (g.type === 'LineString' || g.type === 'MultiLineString') {
      const lines = (g.type === 'LineString' ? [g.coordinates] : g.coordinates) as Pt[][];
      const out = lines.map((l) => simplifyLine(l, tol, false)).filter(Boolean);
      if (out.length) features.push({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: out } });
    }
  }
  return { type: 'FeatureCollection', features };
}

/** 따옴표 처리하는 최소 CSV 파서 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (c !== '\r') cur += c;
  }
  if (cur || row.length) rows.push([...row, cur]);
  return rows;
}

async function airports() {
  const rows = parseCsv(await (await fetch(OA)).text());
  const h = rows[0];
  const col = (n: string) => h.indexOf(n);
  const [iType, iName, iLat, iLon, iIdent, iIcao, iMuni, iIso] = ['type', 'name', 'latitude_deg', 'longitude_deg', 'ident', 'icao_code', 'municipality', 'iso_country'].map(col);
  const out: Record<string, [number, number, string]> = {};
  for (const r of rows.slice(1)) {
    const icao = (r[iIcao] || r[iIdent] || '').toUpperCase();
    if (!/^[A-Z]{4}$/.test(icao)) continue;
    if (r[iType] !== 'large_airport' && r[iType] !== 'medium_airport') continue;
    const lat = Number(r[iLat]);
    const lon = Number(r[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const label = [r[iMuni] || r[iName], r[iIso]].filter(Boolean).join(', ');
    out[icao] = [Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4, label];
  }
  return { source: 'OurAirports (Public Domain)', builtAt: new Date().toISOString().slice(0, 10), airports: out };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const land = await geo('ne_50m_land', 0.04);
  writeFileSync(`${OUT}/land.json`, JSON.stringify(land));
  const borders = await geo('ne_50m_admin_0_boundary_lines_land', 0.04);
  writeFileSync(`${OUT}/borders.json`, JSON.stringify(borders));
  const ap = await airports();
  writeFileSync(`${OUT}/airports.json`, JSON.stringify(ap));
  console.log('land', land.features.length, 'borders', borders.features.length, 'airports', Object.keys(ap.airports).length);
}

void main();
