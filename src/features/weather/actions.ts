// 맨 위 줄 "기상 갱신"·"저장" (D-071): 어느 화면에서든 기상을 새로 받고, 비행 준비(오프라인 저장)까지.
// Weather 탭 카드와 같은 동작·같은 진행 상태를 쓴다
import { create } from 'zustand';
import { getDB } from '../../db/schema';
import { isOnline } from '../../lib/time';
import { useActiveFlight } from '../flight/activeFlight';
import { prefetchSatCorridor } from '../map/satellite';
import { refreshExtra, useWxExtra } from './extra';
import { refreshDue, useWx } from './store';

export interface PrepMeta {
  fetchedAt: string;
  bytes: number;
  failed: number;
}

interface WxActionState {
  refreshing: boolean;
  saving: boolean;
  prog: { done: number; total: number; bytes: number } | null;
  msg: { text: string; tone: 'ok' | 'bad'; at: number } | null;
}
export const useWxActions = create<WxActionState>(() => ({ refreshing: false, saving: false, prog: null, msg: null }));
const say = (text: string, tone: 'ok' | 'bad' = 'ok') => useWxActions.setState({ msg: { text, tone, at: Date.now() } });

/** METAR·TAF·SIGMET·바람 + 우주기상·PIREP·열대저기압·G-AIRMET 전부 지금 받기 */
export async function refreshAllWx(): Promise<void> {
  if (!isOnline()) return say('오프라인 — 기상 갱신 불가 (저장된 자료 표시 중)', 'bad');
  if (useWxActions.getState().refreshing) return;
  useWxActions.setState({ refreshing: true });
  try {
    await Promise.all([refreshDue(true), refreshExtra(undefined, true)]);
    const hhmm = `${new Date().toISOString().slice(11, 16).replace(':', '')}Z`;
    // 각 자료의 실패는 store에만 남고 여기로 오지 않음 → 모아서 알림 (전에는 실패가 있어도 "완료"로 보였음)
    const failed = [...Object.entries(useWx.getState().errors), ...Object.entries(useWxExtra.getState().errors)].filter(([, e]) => e).map(([k]) => k.toUpperCase());
    if (failed.length) say(`기상 갱신 ${hhmm} — 일부 실패: ${failed.join(', ')} (이전 자료 표시 중, Weather 탭에서 이유 확인)`, 'bad');
    else say(`기상 갱신 완료 ${hhmm}`);
  } catch (e) {
    say(`기상 갱신 일부 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
  } finally {
    useWxActions.setState({ refreshing: false });
  }
}

/** 비행 준비 = 기상 전부 받기 + 루트 좌우 위성 영상 저장 (오프라인용) */
export async function prepareFlight(): Promise<PrepMeta | null> {
  if (!isOnline()) {
    say('오프라인 — 저장할 수 없음', 'bad');
    return null;
  }
  const { flight, ofp } = useActiveFlight.getState();
  const route = ofp?.parsed?.route ?? [];
  if (!route.length) {
    say('OFP 루트가 없어 저장할 수 없음 — 먼저 OFP 열기', 'bad');
    return null;
  }
  if (useWxActions.getState().saving) return null;
  useWxActions.setState({ saving: true, prog: null });
  try {
    await refreshAllWx();
    const r = await prefetchSatCorridor(route, (done, total, bytes) => useWxActions.setState({ prog: { done, total, bytes } }));
    const m: PrepMeta = { fetchedAt: new Date().toISOString(), ...r };
    await (await getDB()).put('wxSnapshots', { type: 'meta', station: flight.flightId, fetchedAt: m.fetchedAt, data: m } as never);
    say(`오프라인 저장 완료 — 기상 + 위성 ${(r.bytes / 1048576).toFixed(1)} MB${r.failed ? ` (실패 ${r.failed})` : ''}`, r.failed ? 'bad' : 'ok');
    window.dispatchEvent(new Event('efb:prep-saved'));
    return m;
  } catch (e) {
    say(`저장 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
    return null;
  } finally {
    useWxActions.setState({ saving: false });
  }
}
