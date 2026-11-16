// 위성 적외선 (NASA GIBS WMTS, CORS 허용 — D-034, D-037)
// 조각은 fetch로 받아 IndexedDB wxFrames에 저장 → 오프라인에서 마지막으로 본/미리 받은 영상 표시
// 영상 시각은 응답 헤더 layer-time-actual (GIBS가 노출 허용)
import { create } from 'zustand';
import { getDB } from '../../db/schema';
import type { LatLon } from '../../lib/geo';
import { isOnline } from '../../lib/time';
import { REFRESH_MS } from '../weather/freshness';
import { TIMEOUT_MS } from '../weather/api';

export interface SatLayer {
  id: string;
  label: string;
  /** 대략 영상 범위 (경도, 서→동, 동경 기준 0~360 연속) */
  lonFrom: number;
  lonTo: number;
}

// 겹치는 곳은 뒤의 것이 위에 그려짐: GOES-East → GOES-West → Himawari
export const SAT_LAYERS: SatLayer[] = [
  { id: 'GOES-East_ABI_Band13_Clean_Infrared', label: 'GOES-East', lonFrom: 210, lonTo: 350 },
  { id: 'GOES-West_ABI_Band13_Clean_Infrared', label: 'GOES-West', lonFrom: 150, lonTo: 290 },
  { id: 'Himawari_AHI_Band13_Clean_Infrared', label: 'Himawari', lonFrom: 70, lonTo: 220 },
];
export const SAT_MAX_ZOOM = 6; // GoogleMapsCompatible_Level6

/** time = 'latest'(최신) 또는 ISO 시각 — GIBS가 그 시각 이전 가장 가까운 영상으로 맞춤 (D-065) */
const tileUrl = (layer: string, z: number, x: number, y: number, time = 'latest') =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time === 'latest' ? 'default' : time}/GoogleMapsCompatible_Level6/${z}/${y}/${x}.png`;

/** 지난 위성 영상 시각 목록: 지금 30분 전부터 30분 간격으로 hours시간 (최신 영상이 보통 20~30분 늦음) */
export function satPastTimes(now: number, hours = 3): string[] {
  const step = 30 * 60_000;
  const last = Math.floor((now - step) / step) * step;
  const out: string[] = [];
  for (let t = last - hours * 3_600_000 + step; t <= last; t += step) out.push(new Date(t).toISOString().slice(0, 19) + 'Z');
  return out;
}

interface SatTileRow {
  layer: string;
  validTime: string; // 'latest' 또는 요청 시각
  tile: string; // z/x/y
  blob: Blob;
  imageTime: string | null;
  fetchedAt: string;
}

/** 화면에 보인 영상의 최신 시각 (신선도 표시용) */
export const useSat = create<{ times: Record<string, string>; error?: string }>(() => ({ times: {} }));

const noteTime = (layer: string, t: string | null) => {
  if (!t) return;
  const cur = useSat.getState().times[layer];
  if (!cur || t > cur) useSat.setState((s) => ({ times: { ...s.times, [layer]: t } }));
};

/** 동시에 4개까지만 받음 (브라우저 연결 수 제한 때문에 한꺼번에 요청하면 대기 중 시간 초과) */
let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(job: () => Promise<T>): Promise<T> {
  if (active >= 4) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await job();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

/** 이 조각이 위성 영상 범위에 걸치는가 (범위 밖 조각은 요청하지 않음) */
export function tileInCoverage(layerId: string, z: number, x: number): boolean {
  const L = SAT_LAYERS.find((l) => l.id === layerId);
  if (!L) return false;
  const c = lon360(x2lon(x + 0.5, z));
  const half = 180 / 2 ** z;
  const inRange = (v: number) => v + half >= L.lonFrom && v - half <= L.lonTo;
  return inRange(c) || inRange(c + 360);
}

function download(layer: string, z: number, x: number, y: number, time = 'latest'): Promise<SatTileRow> {
  return limited(() => downloadNow(layer, z, x, y, time));
}

async function downloadNow(layer: string, z: number, x: number, y: number, time: string): Promise<SatTileRow> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(tileUrl(layer, z, x, y, time), { signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const row: SatTileRow = {
      layer,
      validTime: time,
      tile: `${z}/${x}/${y}`,
      blob: await r.blob(),
      imageTime: r.headers.get('layer-time-actual'),
      fetchedAt: new Date().toISOString(),
    };
    await (await getDB()).put('wxFrames', row as never);
    return row;
  } finally {
    clearTimeout(timer);
  }
}

/** 저장본이 30분 이내거나 오프라인이면 저장본, 아니면 새로 받음(실패 시 저장본) */
export async function getSatTile(layer: string, z: number, x: number, y: number, time = 'latest'): Promise<SatTileRow | null> {
  const db = await getDB();
  const cached = (await db.get('wxFrames', [layer, time, `${z}/${x}/${y}`])) as SatTileRow | undefined;
  // 지난 시각 영상은 바뀌지 않으므로 저장본을 그대로
  const fresh = cached && (time !== 'latest' || Date.now() - Date.parse(cached.fetchedAt) < REFRESH_MS.sat);
  if (cached && (fresh || !isOnline())) {
    if (time === 'latest') noteTime(layer, cached.imageTime);
    return cached;
  }
  if (!isOnline()) return null;
  try {
    const row = await download(layer, z, x, y, time);
    if (time === 'latest') noteTime(layer, row.imageTime);
    return row;
  } catch (e) {
    useSat.setState({ error: e instanceof Error ? e.message : String(e) });
    if (cached && time === 'latest') noteTime(layer, cached.imageTime);
    return cached ?? null;
  }
}

/* ---------------- 출발 전 루트 회랑 미리 받기 ---------------- */

const lon2x = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
const x2lon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const lon360 = (lon: number) => ((lon % 360) + 360) % 360;

/** 루트 좌우 corridorNm 안에 걸리는 조각 목록 (층별 영상 범위 밖은 제외) */
export function corridorTiles(route: LatLon[], zooms = [3, 4, 5], corridorNm = 200): { layer: string; z: number; x: number; y: number }[] {
  const dLat = corridorNm / 60;
  const set = new Set<string>();
  // 루트를 약 50NM 간격으로 나눠 각 점 주변 사각형
  const pts: LatLon[] = [];
  for (let i = 0; i < route.length; i++) {
    pts.push(route[i]);
    const b = route[i + 1];
    if (!b) break;
    const a = route[i];
    let dl = b.lon - a.lon;
    if (dl > 180) dl -= 360;
    if (dl < -180) dl += 360;
    const n = Math.ceil(Math.hypot(b.lat - a.lat, dl) / 0.8);
    for (let k = 1; k < n; k++) pts.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + (dl * k) / n });
  }
  for (const z of zooms) {
    const n = 2 ** z;
    for (const p of pts) {
      const dLon = dLat / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
      const y0 = lat2y(p.lat + dLat, z);
      const y1 = lat2y(p.lat - dLat, z);
      const x0 = lon2x(p.lon - dLon, z);
      const x1 = lon2x(p.lon + dLon, z);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set.add(`${z}/${((x % n) + n) % n}/${y}`);
    }
  }
  const out: { layer: string; z: number; x: number; y: number }[] = [];
  for (const k of set) {
    const [z, x, y] = k.split('/').map(Number);
    for (const L of SAT_LAYERS) if (tileInCoverage(L.id, z, x)) out.push({ layer: L.id, z, x, y });
  }
  return out;
}

/** 회랑 위성 조각 받기. 진행률 콜백, 받은 바이트 합계 반환 */
export async function prefetchSatCorridor(route: LatLon[], onProgress: (done: number, total: number, bytes: number) => void): Promise<{ bytes: number; failed: number }> {
  const list = corridorTiles(route);
  let done = 0;
  let bytes = 0;
  let failed = 0;
  const queue = [...list];
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      try {
        const row = await download(t.layer, t.z, t.x, t.y);
        bytes += row.blob.size;
        noteTime(t.layer, row.imageTime);
      } catch {
        failed++;
      }
      onProgress(++done, list.length, bytes);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]); // download()가 동시 4개로 제한
  return { bytes, failed };
}

/** 지난 시각 위성 조각은 12시간 지나면 지움 (최신 'latest'는 그대로) */
export async function pruneSatFrames(now = Date.now()): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('wxFrames', 'readwrite');
  for (let c = await tx.store.openCursor(); c; c = await c.continue()) {
    const v = (c.value as { validTime: string }).validTime;
    if (v !== 'latest' && Date.parse(v) < now - 12 * 3_600_000) await c.delete();
  }
  await tx.done;
}
