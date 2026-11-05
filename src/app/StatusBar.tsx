import { useNow } from '../lib/useNow';
import { formatAgo, formatZ } from '../lib/time';
import { useSync } from '../sync/syncManager';
import { useActiveFlight } from '../features/flight/activeFlight';
import { toggleDayNight, useTheme } from './theme';

const Sun = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const Moon = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

/** 상단 상태 배지: ONLINE/OFFLINE · 마지막 동기화 · 업로드 대기 건수 (SPEC §2.2-2) + 주간/야간 */
export function StatusBar() {
  const { online, lastSyncAt, pending, failed, syncing } = useSync();
  const isDemo = useActiveFlight((s) => s.isDemo);
  const theme = useTheme((s) => s.resolved);
  const now = useNow(30_000);

  return (
    <header className="statusbar">
      <span className={`badge ${online ? 'ok' : 'off'}`}>
        <span className="dot" />
        {online ? 'ONLINE' : 'OFFLINE'}
      </span>
      <span className="stat">
        <span className="stat-label">SYNC</span> {lastSyncAt ? formatZ(lastSyncAt) : '—'}
        {lastSyncAt && <span className="stat-ago"> · {formatAgo(lastSyncAt, now)}</span>}
        {syncing && <span className="spin" aria-label="syncing" />}
      </span>
      {isDemo && (
        <span className="demo-chip" title="더미 데이터 사용 중">
          DEMO<span className="demo-long"> DATA</span>
        </span>
      )}
      <a href="#settings" className={`badge ${failed ? 'bad' : pending ? 'warn' : 'muted'}`}>
        OUTBOX {pending}
        {failed > 0 && ` · ⚠${failed}`}
      </a>
      <button className="icon-btn" onClick={toggleDayNight} aria-label={theme === 'day' ? '야간 화면으로' : '주간 화면으로'} title={theme === 'day' ? '야간 화면' : '주간 화면'}>
        {theme === 'day' ? Moon : Sun}
      </button>
    </header>
  );
}
