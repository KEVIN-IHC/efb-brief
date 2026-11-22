// 움직이는 레이더 (D-099): RainViewer 공개 API — 지난 약 2시간, 10분 간격 강수 레이더 합성 타일. 키·개인정보 없음
// 지상 레이더가 있는 곳(육지·연안)만 보임. 실패가 기본: 8초 시간 제한, 실패하면 레이어만 비고 다른 기상은 그대로
// 출처 표기 필수 (RainViewer). 앱 안 저장은 하지 않음 (타일은 브라우저 캐시만)
import { create } from 'zustand';

const API = 'https://api.rainviewer.com/public/weather-maps.json';
export const RADAR_MAX_ZOOM = 7; // 무료 타일 최대 확대 (그 이상은 늘려 보임)

export interface RadarFrame {
  t: number; // ms
  path: string;
}
interface RadarState {
  host: string | null;
  frames: RadarFrame[];
  fetchedAt: string | null;
  error: string | null;
}
export const useRadar = create<RadarState>(() => ({ host: null, frames: [], fetchedAt: null, error: null }));

export async function loadRadar(): Promise<void> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(API, { signal: ac.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as { host: string; radar?: { past?: { time: number; path: string }[]; nowcast?: { time: number; path: string }[] } };
    const frames = [...(j.radar?.past ?? []), ...(j.radar?.nowcast ?? [])].map((f) => ({ t: f.time * 1000, path: f.path })).sort((a, b) => a.t - b.t);
    useRadar.setState({ host: j.host, frames, fetchedAt: new Date().toISOString(), error: null });
  } catch (e) {
    useRadar.setState({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    clearTimeout(timer);
  }
}

/** 선택 시각에 쓸 영상: 그 시각 이전 중 가장 가까운 것, 없으면 가장 이른 것. 지금·미래는 가장 최근 */
export function radarFrameAt(frames: RadarFrame[], ms: number): RadarFrame | null {
  if (!frames.length) return null;
  const before = frames.filter((f) => f.t <= ms + 60_000);
  return before.at(-1) ?? frames[0];
}

export const radarTileUrl = (host: string, f: RadarFrame) => `${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`;
