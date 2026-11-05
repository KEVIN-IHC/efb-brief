import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { getDB } from './db/schema';
import { DEMO_FLIGHT } from './mock/demoFlight';
import { DEMO_PARSER_VERSION, demoOfpRecord } from './mock/demoOfp';
import { startSyncManager } from './sync/syncManager';
import { applyTheme, useTheme } from './app/theme';
import { loadActiveFlight, reparseStale } from './features/flight/activeFlight';
import { startWxScheduler } from './features/weather/store';

applyTheme(useTheme.getState().pref);
import './app/styles.css';

async function boot() {
  const db = await getDB();
  // 더미 비행 시드 (Phase 0~1)
  if (!(await db.get('flights', DEMO_FLIGHT.flightId))) await db.put('flights', DEMO_FLIGHT);
  // 더미 OFP 시드 (생성 로직이 바뀌면 버전으로 갱신)
  const ofp = await db.get('ofp', DEMO_FLIGHT.flightId);
  if (ofp?.parserVersion !== DEMO_PARSER_VERSION) {
    const rec = demoOfpRecord();
    await db.put('ofp', rec);
    await db.put('route', { flightId: rec.flightId, waypoints: rec.parsed!.route });
  }
  // 파서가 바뀌었으면 저장된 원문으로 다시 파싱 → 현재 비행 불러오기
  await reparseStale().catch((e) => console.warn('[reparse]', e));
  await loadActiveFlight();
  // iOS 저장소 자동 정리 대비 (SPEC §7.2-5). 결과는 Settings에서 확인
  if (navigator.storage?.persist) void navigator.storage.persist().catch(() => false);
  startSyncManager();
  startWxScheduler();
}

void boot()
  .catch((e) => console.error('[boot]', e))
  .finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
