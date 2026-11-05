// 기상 상태 + 저장 + 자동 갱신 (D-038)
//  - 받은 데이터는 IndexedDB wxSnapshots에 저장 → 오프라인에서도 같은 화면
//  - 갱신은 온라인 + 화면이 보일 때만, 주기는 freshness.REFRESH_MS
//  - 실패하면 이전 데이터 유지, 오류만 표시
import { create } from 'zustand';
import { getDB } from '../../db/schema';
import { isOnline } from '../../lib/time';
import { useActiveFlight } from '../flight/activeFlight';
import type { OfpData } from '../ofp/types';
import { fetchMetars, fetchSigmets, fetchTafs, fetchWinds } from './api';
import { isDue, type WxKind } from './freshness';
import type { Metar, Sigmet, Taf, WindsData, WxSnapshot } from './types';

export type StationRole = 'DEP' | 'DEST' | 'ALTN' | 'EDTO';
export interface Station {
  icao: string;
  roles: StationRole[];
}

/** 현재 비행의 공항 목록: 출발·도착·교체·EDTO (중복 합침) */
export function flightStations(dep: string, arr: string, ofp?: OfpData | null): Station[] {
  const map = new Map<string, Station>();
  const add = (icao: string | undefined, role: StationRole) => {
    const k = (icao ?? '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(k)) return;
    const s = map.get(k) ?? { icao: k, roles: [] };
    if (!s.roles.includes(role)) s.roles.push(role);
    map.set(k, s);
  };
  add(dep, 'DEP');
  add(arr, 'DEST');
  ofp?.alternates?.forEach((a) => add(a.icao, 'ALTN'));
  ofp?.edtoAirports?.forEach((a) => add(a, 'EDTO'));
  ofp?.edto?.windows?.forEach((w) => add(w.icao, 'EDTO'));
  return [...map.values()];
}

export interface Snap<T> {
  fetchedAt: string;
  data: T;
}

type DataKind = Exclude<WxKind, 'sat'>;

interface WxState {
  loaded: boolean;
  metars: Record<string, Snap<Metar>>;
  tafs: Record<string, Snap<Taf>>;
  sigmets: Snap<Sigmet[]> | null;
  winds: (Snap<WindsData> & { flightId: string }) | null;
  busy: Partial<Record<DataKind, boolean>>;
  errors: Partial<Record<DataKind, string>>;
  lastAttempt: Partial<Record<DataKind, string>>;
}

export const useWx = create<WxState>(() => ({
  loaded: false,
  metars: {},
  tafs: {},
  sigmets: null,
  winds: null,
  busy: {},
  errors: {},
  lastAttempt: {},
}));

const CACHE_DAYS = 7;

/** 기기에 저장된 기상 불러오기 + 받은 지 7일 지난 캐시 삭제 */
export async function loadWxCache(): Promise<void> {
  const db = await getDB();
  const all = (await db.getAll('wxSnapshots')) as WxSnapshot[];
  const cutoff = Date.now() - CACHE_DAYS * 86_400_000;
  const metars: WxState['metars'] = {};
  const tafs: WxState['tafs'] = {};
  let sigmets: WxState['sigmets'] = null;
  const windsByFlight: Record<string, Snap<WindsData>> = {};
  for (const s of all) {
    if (Date.parse(s.fetchedAt) < cutoff) {
      await db.delete('wxSnapshots', [s.type, s.station]);
      continue;
    }
    if (s.type === 'metar') metars[s.station] = { fetchedAt: s.fetchedAt, data: s.data as Metar };
    else if (s.type === 'taf') tafs[s.station] = { fetchedAt: s.fetchedAt, data: s.data as Taf };
    else if (s.type === 'sigmet') sigmets = { fetchedAt: s.fetchedAt, data: s.data as Sigmet[] };
    else if (s.type === 'winds') windsByFlight[s.station] = { fetchedAt: s.fetchedAt, data: s.data as WindsData };
  }
  const fid = useActiveFlight.getState().flight.flightId;
  const w = windsByFlight[fid];
  useWx.setState({ loaded: true, metars, tafs, sigmets, winds: w ? { ...w, flightId: fid } : null });
  // 위성 조각도 7일 지난 것은 삭제
  const tx = db.transaction('wxFrames', 'readwrite');
  for await (const cur of tx.store) {
    const fa = (cur.value as { fetchedAt?: string }).fetchedAt;
    if (!fa || Date.parse(fa) < cutoff) await cur.delete();
  }
  await tx.done;
}

async function save(type: WxSnapshot['type'], station: string, fetchedAt: string, data: unknown) {
  await (await getDB()).put('wxSnapshots', { type, station, fetchedAt, data } as WxSnapshot as never);
}

const activeContext = () => {
  const { flight, ofp } = useActiveFlight.getState();
  return { flight, parsed: ofp?.parsed ?? null, stations: flightStations(flight.dep, flight.arr, ofp?.parsed) };
};

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function run(kind: DataKind, job: (now: string) => Promise<void>) {
  if (useWx.getState().busy[kind]) return;
  const now = new Date().toISOString();
  useWx.setState((s) => ({ busy: { ...s.busy, [kind]: true }, lastAttempt: { ...s.lastAttempt, [kind]: now } }));
  try {
    await job(now);
    useWx.setState((s) => ({ errors: { ...s.errors, [kind]: undefined } }));
  } catch (e) {
    useWx.setState((s) => ({ errors: { ...s.errors, [kind]: msg(e) } }));
  } finally {
    useWx.setState((s) => ({ busy: { ...s.busy, [kind]: false } }));
  }
}

export async function refreshKind(kind: DataKind): Promise<void> {
  if (!isOnline()) return; // 오프라인: 갱신하지 않고 마지막 데이터 표시
  const { flight, parsed, stations } = activeContext();
  const icaos = stations.map((s) => s.icao);
  if (kind === 'metar')
    return run(kind, async (now) => {
      const list = await fetchMetars(icaos);
      const metars = { ...useWx.getState().metars };
      for (const m of list) {
        metars[m.icao] = { fetchedAt: now, data: m };
        await save('metar', m.icao, now, m);
      }
      useWx.setState({ metars });
    });
  if (kind === 'taf')
    return run(kind, async (now) => {
      const list = await fetchTafs(icaos);
      const tafs = { ...useWx.getState().tafs };
      for (const t of list) {
        tafs[t.icao] = { fetchedAt: now, data: t };
        await save('taf', t.icao, now, t);
      }
      useWx.setState({ tafs });
    });
  if (kind === 'sigmet')
    return run(kind, async (now) => {
      const list = await fetchSigmets();
      await save('sigmet', 'ALL', now, list);
      useWx.setState({ sigmets: { fetchedAt: now, data: list } });
    });
  if (kind === 'winds' && parsed?.route?.length)
    return run(kind, async (now) => {
      const data = await fetchWinds(parsed.route, parsed.header.cruiseFl);
      await save('winds', flight.flightId, now, data);
      useWx.setState({ winds: { fetchedAt: now, data, flightId: flight.flightId } });
    });
}

const KINDS: DataKind[] = ['metar', 'taf', 'sigmet', 'winds'];

/** 지금 받은 지 오래된 것만 (force면 전부) */
export async function refreshDue(force = false): Promise<void> {
  if (!isOnline()) return;
  const s = useWx.getState();
  const fid = useActiveFlight.getState().flight.flightId;
  const { stations } = activeContext();
  const oldest = (rec: Record<string, Snap<unknown>>) => {
    const t = stations.map((st) => rec[st.icao]?.fetchedAt);
    return t.some((x) => !x) ? undefined : t.sort()[0];
  };
  const fetchedAt: Record<DataKind, string | undefined> = {
    metar: oldest(s.metars),
    taf: oldest(s.tafs),
    sigmet: s.sigmets?.fetchedAt,
    winds: s.winds?.flightId === fid ? s.winds.fetchedAt : undefined,
  };
  // 실패 직후 1분 동안은 다시 시도하지 않음 (응답 없는 서버를 계속 두드리지 않게)
  const recentFail = (k: DataKind) => !!s.errors[k] && Date.now() - Date.parse(s.lastAttempt[k] ?? '') < 60_000;
  await Promise.all(KINDS.filter((k) => force || (isDue(k, fetchedAt[k]) && !recentFail(k))).map(refreshKind));
}

let started = false;
/** 앱 시작 시 1회: 캐시 로드 + 1분마다 갱신 점검 + 온라인 복귀·화면 복귀 시 점검 */
export function startWxScheduler(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const tick = () => {
    if (document.visibilityState === 'visible') void refreshDue();
  };
  void loadWxCache().then(tick);
  setInterval(tick, 60_000);
  window.addEventListener('online', tick);
  document.addEventListener('visibilitychange', tick);
  // 현재 비행이 바뀌면 그 비행의 바람 캐시로 교체 후 필요한 것 갱신
  let prev = useActiveFlight.getState().flight.flightId;
  useActiveFlight.subscribe((st) => {
    if (st.flight.flightId === prev) return;
    prev = st.flight.flightId;
    void loadWxCache().then(tick);
  });
}
