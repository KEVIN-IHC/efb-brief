// Inflight: 진행 중 타이머 · Hourly check · 점검 알림 · FIR 통신 · 메모. 모두 오프라인 저장 → 자동 동기화
// (지점 통과 기록·연료 plan vs actual·Waypoint log는 사용자 요청으로 뺌 — 예전 기록은 DB에 남음)
import { HourlyCheck } from '../hourly/HourlyCheck';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OutboxItem } from '../../db/schema';
import { formatDayZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { FAIL_THRESHOLD, getLogSyncStatus, outboxEvents, saveLog } from '../../sync/outbox';
import { syncNow, useSync } from '../../sync/syncManager';
import { FirCommSection } from '../fir/FirCommSection';
import { ActiveTimers } from '../ops/OpsPage';
import { useActiveFlight } from '../flight/activeFlight';
import { DocSection } from '../ofp/doc/ui';
import { latestActuals, useFlightLogs } from './actuals';
import { buildChecks, project } from './deviation';
import { reminders } from './reminders';

function useSyncStatus() {
  const [m, setM] = useState<Map<string, OutboxItem>>(new Map());
  const reload = useCallback(() => void getLogSyncStatus().then(setM), []);
  useEffect(() => {
    reload();
    outboxEvents.addEventListener('change', reload);
    return () => outboxEvents.removeEventListener('change', reload);
  }, [reload]);
  return m;
}

function SyncMark({ ob }: { ob?: OutboxItem }) {
  if (!ob || ob.status === 'sent') return <span className="mark ok" title="동기화됨">✓</span>;
  if (ob.status === 'discarded') return <span className="mark" title="업로드 대기에서 지움 — 시트로 보내지 않음">–</span>;
  if (ob.status === 'failed' || ob.retries >= FAIL_THRESHOLD) return <span className="mark bad" title={ob.lastError}>⚠</span>;
  return <span className="mark warn" title="업로드 대기">⏳</span>;
}

export function InflightPage() {
  const { flight, ofp } = useActiveFlight();
  const o = ofp?.parsed;
  const logs = useFlightLogs(flight.flightId);
  const sync = useSyncStatus();
  const now = useNow(30_000);

  const actuals = useMemo(() => latestActuals(logs), [logs]);
  const checks = useMemo(() => (o ? buildChecks(o, actuals) : []), [o, actuals]);
  const proj = useMemo(() => (o ? project(o, checks) : null), [o, checks]);
  const rem = o && proj ? reminders(o, checks, proj, now) : [];

  return (
    <div className="page-grid doc">
      {!o && (
        <DocSection title="Inflight" className="span-all">
          <p className="muted">현재 비행의 OFP가 없습니다. 메모는 아래에서 남길 수 있습니다.</p>
          <p className="muted small">맨 위 줄의 <b>OFP 열기</b> 버튼으로 회사 OFP PDF를 여세요.</p>
        </DocSection>
      )}

      <ActiveTimers />

      <HourlyCheck flightId={flight.flightId} o={o ?? null} />

      {rem.length > 0 && (
        <DocSection title="Checks due" className="span-all">
          <ul className="remind">
            {rem.map((r) => (
              <li key={r.id} className={`rm-${r.level}`}>
                {r.text}
              </li>
            ))}
          </ul>
        </DocSection>
      )}

      {o && proj && <FirCommSection o={o} checks={checks} timeDevMin={proj.timeDevMin} now={now} compact />}

      <MemoBlock flightId={flight.flightId} sync={sync} />

    </div>
  );
}

function MemoBlock({ flightId, sync }: { flightId: string; sync: Map<string, OutboxItem> }) {
  const logs = useFlightLogs(flightId);
  const online = useSync((s) => s.online);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const memos = logs.filter((l) => l.kind === 'memo').sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const save = async () => {
    const text = note.trim();
    if (!text) return;
    setSaving(true);
    setNote(''); // 저장 중 입력한 내용이 지워지지 않도록 먼저 비움
    try {
      await saveLog({ flightId, kind: 'memo', note: text });
      if (online) void syncNow();
    } catch (e) {
      setNote((cur) => (cur ? `${text}\n${cur}` : text));
      alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DocSection title="Memo" meta={`${memos.length}`} className="span-all">
      <textarea className="input" rows={2} placeholder="기상 조우, 난류, 관제 지시 등 (저장 시각 자동 기록)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="row">
        <button className="btn primary" disabled={!note.trim() || saving} onClick={save}>
          메모 저장
        </button>
        <span className="muted small">{online ? '저장 즉시 업로드' : 'OFFLINE — 기기에 저장 후 연결 시 자동 업로드'}</span>
      </div>
      {memos.length > 0 && (
        <ul className="loglist">
          {memos.map((l) => (
            <li key={l.logId}>
              <div className="logmeta">
                <span className="mono">{formatDayZ(l.createdAt)}</span>
                <SyncMark ob={sync.get(l.logId)} />
              </div>
              <div className="lognote">{l.note}</div>
            </li>
          ))}
        </ul>
      )}
    </DocSection>
  );
}

