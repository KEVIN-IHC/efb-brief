import { useNow } from '../lib/useNow';
import { formatAgo, formatZ } from '../lib/time';
import { useSync } from '../sync/syncManager';
import { useActiveFlight } from '../features/flight/activeFlight';
import { toggleDayNight, useTheme } from './theme';
import { OfpOpenButton } from '../features/ofp/OfpOpenButton';
import { prepareFlight, refreshAllWx, useWxActions } from '../features/weather/actions';

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

const RefreshIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16m0 4v-4h-4" />
  </svg>
);
const SaveIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
);
const OutIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

/** 상단 상태 배지: ONLINE/OFFLINE · 마지막 동기화 · 업로드 대기 건수 (SPEC §2.2-2) + 주간/야간 */
export function StatusBar() {
  const { online, lastSyncAt, pending, failed, syncing } = useSync();
  const isDemo = useActiveFlight((s) => s.isDemo);
  const theme = useTheme((s) => s.resolved);
  const now = useNow(30_000);
  const { refreshing, saving, prog } = useWxActions();

  return (
    <header className="statusbar">
      <span className={`badge ${online ? 'ok' : 'off'}`}>
        <span className="dot" />
        <span className="xs-hide">{online ? 'ONLINE' : 'OFFLINE'}</span>
      </span>
      <span className="stat">
        <span className="stat-label">SYNC</span> {lastSyncAt ? formatZ(lastSyncAt) : '—'}
        {lastSyncAt && <span className="stat-ago"> · {formatAgo(lastSyncAt, now)}</span>}
        {syncing && <span className="spin" aria-label="syncing" />}
      </span>
      <OfpOpenButton variant={isDemo ? 'primary' : 'plain'} showStatus={false} compact />
      <button className="btn btn-icon top-btn" disabled={!online || refreshing} onClick={() => void refreshAllWx()} aria-label="기상 갱신" title={online ? '기상 전부 지금 받기 (METAR·TAF·SIGMET·바람·우주기상·PIREP)' : '오프라인'}>
        <span className={refreshing ? 'spin-icon' : ''}>{RefreshIcon}</span>
        <span className="top-label">기상</span>
      </button>
      <button className="btn btn-icon top-btn" disabled={!online || saving} onClick={() => void prepareFlight()} aria-label="오프라인 저장" title="비행 준비: 기상 전부 + 루트 위성 영상을 기기에 저장">
        {SaveIcon}
        <span className="top-label">{saving && prog ? `${Math.round((prog.done / Math.max(1, prog.total)) * 100)}%` : saving ? '…' : '저장'}</span>
      </button>
      {isDemo && (
        <span className="demo-chip xs-hide" title="더미 데이터 사용 중">
          DEMO<span className="demo-long"> DATA</span>
        </span>
      )}
      <a href="#settings" className={`btn btn-icon top-btn top-out ${failed ? 'is-bad' : pending ? 'is-warn' : ''}`} aria-label={`업로드 대기 ${pending}건${failed ? `, 실패 ${failed}` : ''}`} title="OUTBOX — 동기화 대기 (Settings)">
        {OutIcon}
        <span className="top-label">OUTBOX</span>
        <span className="mono">{pending}</span>
        {failed > 0 && <span className="mono">⚠{failed}</span>}
      </a>
      <button className="icon-btn" onClick={toggleDayNight} aria-label={theme === 'day' ? '야간 화면으로' : '주간 화면으로'} title={theme === 'day' ? '야간 화면' : '주간 화면'}>
        {theme === 'day' ? Moon : Sun}
      </button>
    </header>
  );
}
