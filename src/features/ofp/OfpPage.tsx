import { useState } from 'react';
import { jumpToOfpSource } from './sourceJump';
import { useActiveFlight } from '../flight/activeFlight';
import { NavLog } from './doc/NavLog';
import { OfpDocument } from './doc/OfpDocument';
import { CrzWind } from './doc/CrzWind';
import { useOfpImport } from './OfpOpenButton';

function ImportStatus() {
  const { busy, msg } = useOfpImport();
  if (busy) return <p className="small muted import-status">{busy}</p>;
  if (!msg) return null;
  return <p className={`small import-status ${msg.tone === 'ok' ? 'c-ok' : 'c-bad'}`}>{msg.text}</p>;
}

type Sub = 'doc' | 'nav' | 'wind';
const SUBS: { id: Sub; label: string }[] = [
  { id: 'doc', label: 'OFP' },
  { id: 'nav', label: 'NAV LOG' },
  { id: 'wind', label: 'CRZ WIND' },
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
  const { ofp, loaded } = useActiveFlight();
  const [sub, setSubState] = useState<Sub>(readSub);
  const setSub = (s: Sub) => {
    setSubState(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* ignore */
    }
  };
  const o = ofp?.parsed;
  // OFP 카드의 원문 줄 → OFP PDF 탭 원문 뷰어 (NAV LOG는 원문으로 가지 않음)
  const jumpToSource = ofp?.rawText ? jumpToOfpSource : undefined;

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
      </div>
      <ImportStatus />
      <div className="segmented" role="tablist">
        {SUBS.map((s) => (
          <button key={s.id} role="tab" aria-selected={sub === s.id} className={sub === s.id ? 'on' : ''} onClick={() => setSub(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      {loaded && !o && (
        <section className="card placeholder">
          <p>현재 비행의 OFP가 없습니다.</p>
          <p className="muted small">맨 위 줄의 <b>OFP 열기</b> 버튼으로 회사 OFP PDF를 여세요.</p>
        </section>
      )}
      {o && sub === 'doc' && <OfpDocument o={o} onLine={jumpToSource} />}
      {o && sub === 'wind' && (
        <div className="page-grid">
          <CrzWind o={o} />
        </div>
      )}
      {o && sub === 'nav' && (
        <div className="page-grid">
          <NavLog o={o} />
        </div>
      )}
    </>
  );
}
