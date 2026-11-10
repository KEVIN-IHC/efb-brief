import { useEffect, useMemo, useState } from 'react';
import { useSourceJump } from './sourceJump';
import { latestActuals, useFlightLogs } from '../inflight/actuals';
import { useActiveFlight } from '../flight/activeFlight';
import { NavLog } from './doc/NavLog';
import { OfpDocument } from './doc/OfpDocument';
import { CrzWind } from './doc/CrzWind';
import { RawPdfView } from './RawPdfView';
import { OfpOpenButton, useOfpImport } from './OfpOpenButton';

function ImportStatus() {
  const { busy, msg } = useOfpImport();
  if (busy) return <p className="small muted import-status">{busy}</p>;
  if (!msg) return null;
  return <p className={`small import-status ${msg.tone === 'ok' ? 'c-ok' : 'c-bad'}`}>{msg.text}</p>;
}

type Sub = 'doc' | 'nav' | 'wind' | 'raw';
const SUBS: { id: Sub; label: string }[] = [
  { id: 'doc', label: 'OFP' },
  { id: 'nav', label: 'NAV LOG' },
  { id: 'wind', label: 'CRZ WIND' },
  { id: 'raw', label: 'PDF · 추출' },
];
const KEY = 'efb.ofp.sub2';

function readSub(): Sub {
  try {
    const v = localStorage.getItem(KEY);
    if (SUBS.some((s) => s.id === v)) return v as Sub;
  } catch {
    /* ignore */
  }
  return 'doc';
}

export function OfpPage() {
  const { ofp, loaded, flight } = useActiveFlight();
  const logs = useFlightLogs(flight.flightId);
  const actuals = useMemo(() => latestActuals(logs), [logs]);
  const [sub, setSubState] = useState<Sub>(readSub);
  const [focus, setFocus] = useState<{ n: number; t: number } | null>(null);
  const setSub = (s: Sub) => {
    setSubState(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* ignore */
    }
  };
  // 다른 탭(NOTAM)에서 원문 위치 요청 → PDF·추출 원문 뷰어로
  const pending = useSourceJump((s) => s.pending);
  useEffect(() => {
    if (!pending) return;
    setSub('raw');
    setFocus(pending);
    useSourceJump.setState({ pending: null });
  }, [pending]);
  const o = ofp?.parsed;
  const jumpToSource = ofp?.rawText
    ? (n: number) => {
        setSub('raw');
        setFocus({ n, t: Date.now() });
      }
    : undefined;

  return (
    <>
      <div className="ofp-bar">
        <div className="ofp-bar-cur">
          <span className="cell-k">현재 OFP</span>
          {o ? (
            <span className="mono strong">
              {o.header.flightNo} {o.header.dep}→{o.header.arr} · {o.header.date}
              {ofp?.source === 'demo' && <span className="demo-chip inline">DEMO</span>}
            </span>
          ) : (
            <span className="muted">없음</span>
          )}
        </div>
        <OfpOpenButton showStatus={false} />
      </div>
      <ImportStatus />
      <div className="segmented" role="tablist">
        {SUBS.map((s) => (
          <button key={s.id} role="tab" aria-selected={sub === s.id} className={sub === s.id ? 'on' : ''} onClick={() => setSub(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {sub === 'raw' && <RawPdfView focus={focus} />}
      {sub !== 'raw' && loaded && !o && (
        <section className="card placeholder">
          <p>현재 비행의 OFP가 없습니다.</p>
          <OfpOpenButton />
        </section>
      )}
      {o && sub === 'doc' && <OfpDocument o={o} />}
      {o && sub === 'wind' && (
        <div className="page-grid">
          <CrzWind o={o} />
        </div>
      )}
      {o && sub === 'nav' && (
        <div className="page-grid">
          <NavLog o={o} onLine={jumpToSource} actuals={actuals} />
        </div>
      )}
    </>
  );
}
