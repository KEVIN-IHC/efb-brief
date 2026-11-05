// iOS Safari는 Background Sync API 미지원 → 앱이 열려 있을 때 다음 시점에 flush (SPEC §3.1, §7.2)
//   online 이벤트 / 앱 시작 / visibilitychange(visible) → 대기 무시하고 즉시(force)
//   + 30초마다 '보낼 때가 된' 항목만 점검 (iOS는 online 이벤트를 믿기 어려움, D-042)
import { create } from 'zustand';
import { getSetting } from '../db/settings';
import { isOnline } from '../lib/time';
import { flushOutbox, getOutboxCounts, outboxEvents, pruneSent, type FlushResult } from './outbox';

const PERIOD_MS = 30_000; // 보낼 항목이 없으면 네트워크 요청 없음 (IndexedDB만 확인)

interface SyncState {
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  pending: number;
  failed: number;
  lastResult: FlushResult | null;
}

export const useSync = create<SyncState>(() => ({
  online: isOnline(),
  syncing: false,
  lastSyncAt: null,
  pending: 0,
  failed: 0,
  lastResult: null,
}));

async function refreshCounts() {
  const [counts, lastSyncAt] = await Promise.all([getOutboxCounts(), getSetting('lastSyncAt')]);
  useSync.setState({ ...counts, lastSyncAt: lastSyncAt ?? null });
}

export async function syncNow(force = false): Promise<FlushResult> {
  useSync.setState({ syncing: true });
  try {
    const r = await flushOutbox({ force });
    useSync.setState({ lastResult: r });
    return r;
  } finally {
    useSync.setState({ syncing: false });
    await refreshCounts();
  }
}

let started = false;

export function startSyncManager(): () => void {
  if (started) return () => {};
  started = true;

  const onOnline = () => {
    useSync.setState({ online: true });
    void syncNow(true); // 연결이 돌아왔으니 대기시간 무시하고 바로
  };
  const onOffline = () => useSync.setState({ online: false });
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      useSync.setState({ online: isOnline() });
      void syncNow(true); // 앱을 다시 열면 바로 재시도
    }
  };
  const onChange = () => void refreshCounts();

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  outboxEvents.addEventListener('change', onChange);
  const timer = window.setInterval(() => {
    if (isOnline() && !useSync.getState().syncing) void syncNow();
  }, PERIOD_MS);

  // 앱 시작
  void pruneSent().then(refreshCounts).then(() => syncNow());

  return () => {
    started = false;
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    outboxEvents.removeEventListener('change', onChange);
    clearInterval(timer);
  };
}
