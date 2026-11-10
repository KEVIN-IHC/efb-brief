// 대시보드 얼러트 카드 (D-046): 심각도순, 항목마다 근거(매뉴얼·OFP 원문·임시 기준), 확인·이력
import { formatDayZ } from '../../lib/time';
import { openManualPage } from '../manual/lookup';
import { jumpToOfpSource } from '../ofp/sourceJump';
import { DocSection } from '../ofp/doc/ui';
import type { Alert, Basis, Severity } from './types';
import { useAlerts } from './useAlerts';
import { RULES } from './rules';

const SEV: Record<Severity, string> = { warning: '경고', caution: '주의', info: '안내' };

function BasisRow({ b }: { b: Basis }) {
  if (b.kind === 'manual' && b.manual)
    return (
      <button className="al-basis al-manual" onClick={() => openManualPage(b.manual!)}>
        📖 {b.label}
      </button>
    );
  if (b.kind === 'manual') return <span className="al-basis">📖 {b.label}</span>;
  if (b.kind === 'ofp' && b.ofpLine)
    return (
      <button className="al-basis al-ofp" onClick={() => jumpToOfpSource(b.ofpLine!)}>
        OFP 원문 L{b.ofpLine} · {b.label}
      </button>
    );
  if (b.kind === 'temporary')
    return (
      <span className="al-basis al-temp">
        <b>임시 기준 · 매뉴얼 근거 없음</b> — {b.label}
      </span>
    );
  return <span className={`al-basis ${b.kind === 'data' ? 'al-data mono' : 'al-app'}`}>{b.label}</span>;
}

function AlertRow({ a, acked, onAck }: { a: Alert; acked?: string; onAck?: () => void }) {
  return (
    <li className={`al-row al-${a.severity}`}>
      <div className="al-top">
        <span className={`al-sev al-sev-${a.severity}`}>{SEV[a.severity]}</span>
        <span className="al-title">{a.title}</span>
        {onAck && !acked && (
          <button className="btn al-ack" onClick={onAck}>
            확인
          </button>
        )}
      </div>
      {a.detail && <div className="small">{a.detail}</div>}
      <div className="al-bases">
        {a.basis.map((b, i) => (
          <BasisRow key={i} b={b} />
        ))}
      </div>
      {acked && <div className="muted small">확인 {formatDayZ(acked)}</div>}
    </li>
  );
}

export function AlertsCard() {
  const { alerts, history, ackAt, ack, hasOfp } = useAlerts();
  if (!hasOfp) return null;
  const open = alerts.filter((a) => !ackAt.get(a.id));
  const done = alerts.filter((a) => ackAt.get(a.id));
  const activeIds = new Set(alerts.map((a) => a.id));
  const gone = history.filter((h) => !activeIds.has(h.id));
  const count = (s: Severity) => alerts.filter((a) => a.severity === s).length;

  return (
    <DocSection title="Alerts" meta={`경고 ${count('warning')} · 주의 ${count('caution')} · 안내 ${count('info')}`} className="span-all al-card">
      {alerts.length === 0 && <p className="muted small">현재 해당하는 얼러트 없음 (규칙 {RULES.length}개 기준 · 기상은 받아 둔 자료 기준)</p>}
      {open.length > 0 && (
        <>
          <ul className="al-list">
            {open.map((a) => (
              <AlertRow key={a.id} a={a} onAck={() => void ack([a.id])} />
            ))}
          </ul>
          {open.length > 1 && (
            <div className="row">
              <button className="btn" onClick={() => void ack(open.map((a) => a.id))}>
                모두 확인 ({open.length})
              </button>
            </div>
          )}
        </>
      )}
      {done.length > 0 && (
        <details className="al-more">
          <summary>확인한 얼러트 {done.length}건 (아직 해당)</summary>
          <ul className="al-list">
            {done.map((a) => (
              <AlertRow key={a.id} a={a} acked={ackAt.get(a.id)} />
            ))}
          </ul>
        </details>
      )}
      {gone.length > 0 && (
        <details className="al-more">
          <summary>이력 — 지금은 해당 없음 {gone.length}건</summary>
          <ul className="al-hist">
            {gone.map((h) => (
              <li key={h.id} className="small">
                <span className={`al-sev al-sev-${h.severity}`}>{SEV[h.severity]}</span> {h.title}
                <span className="muted"> · 처음 {formatDayZ(h.firstSeenAt)}{h.ackAt ? ` · 확인 ${formatDayZ(h.ackAt)}` : ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="doc-foot">
        얼러트는 보조 알림입니다. 📖 표시는 근거 매뉴얼 위치, "임시 기준"은 회사 매뉴얼에 수치 근거가 없는 값입니다(D-048). 운항 판단은 승인된 EFB·원본 매뉴얼·운항관리 기준.
      </p>
    </DocSection>
  );
}
