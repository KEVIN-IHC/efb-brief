// Phase 2 순항 기록: 웨이포인트 체크(ATA·연료) → 편차·착륙 예상·그래프·점검 알림. 메모. 모두 오프라인 저장 → 자동 동기화
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OutboxItem } from '../../db/schema';
import { fmtKg, fmtSigned } from '../../lib/format';
import { formatDayZ, formatZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { FAIL_THRESHOLD, getLogSyncStatus, outboxEvents, saveLog } from '../../sync/outbox';
import { syncNow, useSync } from '../../sync/syncManager';
import { useActiveFlight } from '../flight/activeFlight';
import { Cell, DocSection, LevelPill } from '../ofp/doc/ui';
import { OfpOpenButton } from '../ofp/OfpOpenButton';
import { latestActuals, saveWaypointActual, useFlightLogs, voidWaypointActual } from './actuals';
import { buildChecks, FUEL_DEV_RULES, fuelDevLevel, nextWaypoint, project, revisedEto } from './deviation';
import { EntrySheet } from './EntrySheet';
import { FuelChart } from './FuelChart';
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
  if (ob.status === 'failed' || ob.retries >= FAIL_THRESHOLD) return <span className="mark bad" title={ob.lastError}>⚠</span>;
  return <span className="mark warn" title="업로드 대기">⏳</span>;
}

const dtText = (m?: number) => (m === undefined ? '' : `${m > 0 ? '+' : m < 0 ? '−' : '±'}${Math.abs(m)}`);

export function InflightPage() {
  const { flight, ofp } = useActiveFlight();
  const o = ofp?.parsed;
  const logs = useFlightLogs(flight.flightId);
  const sync = useSyncStatus();
  const online = useSync((s) => s.online);
  const now = useNow(30_000);
  const [sheet, setSheet] = useState<number | null>(null);

  const actuals = useMemo(() => latestActuals(logs), [logs]);
  const checks = useMemo(() => (o ? buildChecks(o, actuals) : []), [o, actuals]);
  const proj = useMemo(() => (o ? project(o, checks) : null), [o, checks]);
  const next = nextWaypoint(checks);
  const rem = o && proj ? reminders(o, checks, proj, now) : [];
  const U = o?.unit.toUpperCase() ?? '';
  const sheetCheck = sheet != null ? checks.find((c) => c.w.seq === sheet) : undefined;

  const afterSave = () => online && void syncNow();

  return (
    <div className="page-grid doc">
      {!o && (
        <DocSection title="Inflight" className="span-all">
          <p className="muted">현재 비행의 OFP가 없어 웨이포인트 기록을 할 수 없습니다. 메모는 아래에서 남길 수 있습니다.</p>
          <OfpOpenButton />
        </DocSection>
      )}

      {o && proj && (
        <DocSection
          title={`Inflight · ${flight.flightNo} ${flight.dep}→${flight.arr}`}
          meta={<LevelPill level={proj.level}>{proj.level === 'ok' ? 'FUEL OK' : proj.level === 'caution' ? 'FUEL CAUTION' : 'BELOW ALTN+FINAL'}</LevelPill>}
          className="span-all"
        >
          {next ? (
            <button className="next-btn" onClick={() => setSheet(next.w.seq)}>
              <span className="next-k">다음</span>
              <span className="next-name mono">{next.w.name}</span>
              <span className="next-eto mono">ETO {formatZ(revisedEto(next.w, proj.timeDevMin))}</span>
              <span className="next-go">통과 기록 ›</span>
            </button>
          ) : (
            <p className="c-ok small">모든 지점 기록 완료</p>
          )}
          <div className="cells">
            <Cell k="LAST" v={proj.last ? `${proj.last.w.name} ${formatZ(proj.last.actual!.ata)}` : '—'} />
            <Cell k="ΔTIME (MIN)" v={proj.last ? dtText(proj.timeDevMin) : '—'} tone={Math.abs(proj.timeDevMin) >= 10 ? 'caution' : undefined} />
            <Cell k={`ΔFUEL (${U})`} v={proj.lastFuel ? fmtSigned(proj.lastFuel.fuelDev!) : '—'} tone={proj.lastFuel ? fuelDevLevel(o, proj.lastFuel.fuelDev) : undefined} />
            <Cell k="ETA (REVISED)" v={formatZ(proj.eta)} />
            <Cell k="LANDING · PLAN BURN" v={proj.landingIfPlanBurn !== undefined ? fmtKg(proj.landingIfPlanBurn) : fmtKg(proj.plannedLanding)} tone={proj.landingIfPlanBurn !== undefined && proj.landingIfPlanBurn < proj.minLanding ? 'warning' : undefined} />
            <Cell k="LANDING · TREND" v={proj.landingIfTrend !== undefined ? fmtKg(proj.landingIfTrend) : '—'} tone={proj.landingIfTrend !== undefined && proj.landingIfTrend < proj.minLanding ? 'warning' : undefined} />
            <Cell k="ALTN + FINAL" v={fmtKg(proj.minLanding)} />
            <Cell k="TREND / HR" v={proj.trendPerHour !== undefined ? fmtSigned(proj.trendPerHour) : '—'} />
          </div>
          <p className="doc-foot muted">
            계획 착륙 연료(FOD) {fmtKg(proj.plannedLanding)} {U} · {FUEL_DEV_RULES.basis}
          </p>
        </DocSection>
      )}

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

      {o && proj && (
        <DocSection title={`Fuel · plan vs actual · ${U}`} className="span-all">
          <FuelChart o={o} checks={checks} proj={proj} />
        </DocSection>
      )}

      {o && proj && (
        <DocSection title="Waypoint log" meta={`${actuals.size} / ${o.route.length}`} className="span-all flush-doc">
          <div className="table-wrap navwrap">
            <table className="dt nav wlog">
              <thead>
                <tr>
                  <th className="sticky">WPT</th>
                  <th className="r">ETO</th>
                  <th className="r hide-xs">PLAN R/F</th>
                  <th className="r">ATA</th>
                  <th className="r hide-xs">ΔT</th>
                  <th className="r">FUEL</th>
                  <th className="r">ΔFUEL</th>
                  <th className="hide-xs" />
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => {
                  const isNext = next?.w.seq === c.w.seq;
                  const lv = fuelDevLevel(o, c.fuelDev);
                  return (
                    <tr key={c.w.seq} className={`${isNext ? 'row-next' : ''} ${c.actual ? 'row-done' : ''}`} onClick={() => setSheet(c.w.seq)}>
                      <td className="sticky">
                        <div className="mono strong">{c.w.name}</div>
                        <div className="wpt-sub">{isNext ? '다음' : c.w.flText && !/^\d+$/.test(c.w.flText) ? c.w.flText : `FL${c.w.fl}`}</div>
                      </td>
                      <td className="r mono">{formatZ(c.actual ? c.w.eto : revisedEto(c.w, proj.timeDevMin))}</td>
                      <td className="r mono hide-xs muted">{fmtKg(c.w.fuelRem)}</td>
                      <td className="r mono strong">{c.actual ? formatZ(c.actual.ata) : '····'}</td>
                      <td className={`r mono hide-xs ${c.timeDevMin !== undefined && Math.abs(c.timeDevMin) >= 5 ? 'c-caution' : ''}`}>{dtText(c.timeDevMin)}</td>
                      <td className="r mono">{c.actual?.fuel != null ? fmtKg(c.actual.fuel) : c.actual ? '—' : ''}</td>
                      <td className={`r mono c-${lv}`}>{c.fuelDev !== undefined ? fmtSigned(c.fuelDev) : ''}</td>
                      <td className="hide-xs">{c.actual && <SyncMark ob={sync.get(c.actual.logId)} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="doc-foot muted">행을 누르면 기록·수정 · ETO는 마지막 기록의 시간 편차를 반영한 수정값 · ✓ 동기화 ⏳ 업로드 대기</p>
        </DocSection>
      )}

      <MemoBlock flightId={flight.flightId} sync={sync} />

      {sheet != null && sheetCheck && o && proj && (
        <EntrySheet
          w={sheetCheck.w}
          unit={o.unit}
          revisedEto={revisedEto(sheetCheck.w, proj.timeDevMin)}
          existing={sheetCheck.actual}
          onClose={() => setSheet(null)}
          onSave={async (ata, fuel) => {
            await saveWaypointActual({ flightId: flight.flightId, w: sheetCheck.w, ata, fuel, unit: o.unit });
            afterSave();
          }}
          onVoid={async () => {
            await voidWaypointActual({ flightId: flight.flightId, w: sheetCheck.w });
            afterSave();
          }}
        />
      )}
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

