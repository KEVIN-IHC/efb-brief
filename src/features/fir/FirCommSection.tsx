// FIR · 통신 (D-055): OFP FIR 통과 순서·진입 시각 + 개인 통신표. Briefing(전체)·Inflight(지금·다음) 공용
import { useEffect, useMemo, useRef, useState } from 'react';
import { airacAge, airacOf } from '../../lib/airac';
import { formatZ } from '../../lib/time';
import type { WptCheck } from '../inflight/deviation';
import { DocSection } from '../ofp/doc/ui';
import { jumpToOfpSource } from '../ofp/sourceJump';
import type { OfpData } from '../ofp/types';
import { exportFirComm, FIR_COMM_FIELDS, mergeFirComm, parseFirCommImport, putFirComm, useFirComm, type FirComm } from './commTable';
import { firSequence, firTimeline, type FirStatus } from './sequence';

interface Props {
  o: OfpData;
  checks: WptCheck[];
  timeDevMin: number;
  now: number;
  /** Inflight: 지금·다음 FIR만 (전체는 펼치기) */
  compact?: boolean;
}

const STATE_TEXT = { past: '지남', current: '지금', next: '다음', later: '' } as const;

function whenText(s: FirStatus): string {
  if (!s.leg.entry) return '출발 FIR (이륙부터)';
  const t = `${s.leg.entry.wpt} ${formatZ(s.at)}${s.actual ? ' 실제' : s.at !== s.leg.entry.eto ? ' 수정' : ''}`;
  if (s.state === 'next' && s.minsTo !== undefined && s.minsTo >= 0) return `${t} · ${s.minsTo}분 후`;
  return t;
}

export function FirCommSection({ o, checks, timeDevMin, now, compact }: Props) {
  const seq = useMemo(() => firSequence(o), [o]);
  const rows = firTimeline(seq.legs, checks, timeDevMin, now);
  const table = useFirComm();
  const [edit, setEdit] = useState<string | null>(null);
  const [all, setAll] = useState(!compact);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!rows.length) {
    return (
      <DocSection title="FIR · 통신" className="span-all">
        <p className="small muted">OFP에서 FIR 진입 줄을 찾지 못했습니다 (NAV LOG "/ XXXX FIR" 줄 · NOTAM PACKAGE 3 "FIR:" 목록).</p>
      </DocSection>
    );
  }

  const shown = all ? rows : rows.filter((r) => r.state === 'current' || r.state === 'next');
  const filled = rows.filter((r) => table[r.leg.icao]).length;

  const doExport = () => {
    const blob = new Blob([exportFirComm(table)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fir-comm-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const doImport = async (f: File) => {
    try {
      const n = await mergeFirComm(parseFirCommImport(await f.text()));
      setMsg(`${n}개 FIR 가져옴 (같은 FIR은 덮어씀)`);
    } catch (e) {
      setMsg(`가져오기 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <DocSection title="FIR · 통신" meta={`${rows.length} FIR · 통신표 ${filled}/${rows.length}${o.header.selcal ? ` · SELCAL ${o.header.selcal}` : ''}`} className="span-all">
      <ul className="fir-list">
        {shown.map((s) => {
          const c = table[s.leg.icao];
          return (
            <li key={`${s.leg.icao}-${s.leg.entry?.seq ?? 0}`} className={`fir-row fir-${s.state}`}>
              <div className="fir-top">
                <span className="mono strong fir-icao">{s.leg.icao}</span>
                <span className="fir-name">{s.leg.name}</span>
                {STATE_TEXT[s.state] && <span className={`chip ${s.state === 'past' ? 'chip-muted' : s.state === 'current' ? 'chip-ok' : 'chip-caution'}`}>{STATE_TEXT[s.state]}</span>}
                <button className="btn small fir-edit" onClick={() => setEdit(s.leg.icao)} aria-label={`${s.leg.icao} 통신 편집`}>
                  편집
                </button>
              </div>
              <div className="small mono muted">
                {whenText(s)}
                {s.leg.entry?.line && (
                  <button className="fir-jump" onClick={() => jumpToOfpSource(s.leg.entry!.line!)}>
                    OFP L{s.leg.entry.line}
                  </button>
                )}
              </div>
              {c ? (
                <dl className="fir-comm">
                  {FIR_COMM_FIELDS.filter((f) => c[f.key] && f.key !== 'source').map((f) => (
                    <div key={f.key} className={f.key === 'note' ? 'wide' : ''}>
                      <dt>{f.label}</dt>
                      <dd className={f.key === 'note' ? '' : 'mono'}>{c[f.key]}</dd>
                    </div>
                  ))}
                  <div className="wide fir-src small muted">
                    {c.source ? `출처: ${c.source}` : '출처 없음'}
                    {c.updatedAt ? ` · 입력 ${c.updatedAt.slice(0, 10)} (AIRAC ${airacOf(c.updatedAt).id})` : ''}
                  </div>
                  {(airacAge(c.updatedAt, now) ?? 0) > 0 && <div className="wide small c-caution">입력 후 AIRAC {airacAge(c.updatedAt, now)}주기 지남 (현재 {airacOf(now).id}) — 최신 AIP로 다시 확인</div>}
                </dl>
              ) : (
                <div className="small muted">통신표 없음 — 편집으로 입력</div>
              )}
            </li>
          );
        })}
      </ul>
      {compact && rows.length > shown.length && (
        <button className="btn small" onClick={() => setAll(true)}>
          전체 {rows.length} FIR 보기
        </button>
      )}
      {compact && all && (
        <button className="btn small" onClick={() => setAll(false)}>
          지금·다음만
        </button>
      )}
      {seq.unplaced.length > 0 && <p className="small c-caution">OFP FIR 목록에 있지만 NAV LOG 진입 지점이 없음: {seq.unplaced.join(' ')} — 원문 확인</p>}
      {!compact && (
        <div className="row">
          <button className="btn small" onClick={doExport} disabled={!Object.keys(table).length}>
            통신표 내보내기
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            통신표 가져오기
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0]).finally(() => (e.target.value = ''))} />
          {msg && <span className="small muted">{msg}</span>}
        </div>
      )}
      <p className="doc-foot">
        FIR 순서·진입 시각은 OFP 기준(기록이 있으면 실제, 없으면 시간 편차 반영). 통신 정보는 직접 입력한 개인 표이며 기기 안에만 저장됩니다 — 사용 전 최신 AIP·차트·ATC 지시로 확인.
      </p>
      {edit && <FirCommSheet icao={edit} name={rows.find((r) => r.leg.icao === edit)?.leg.name ?? ''} value={table[edit]} onClose={() => setEdit(null)} />}
    </DocSection>
  );
}

function FirCommSheet({ icao, name, value, onClose }: { icao: string; name: string; value?: FirComm; onClose: () => void }) {
  const [v, setV] = useState<FirComm>(value ?? {});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (next: FirComm | null) => {
    setBusy(true);
    try {
      await putFirComm(icao, next);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop sheetish" role="dialog" aria-modal="true" aria-label={`${icao} 통신 편집`} onClick={onClose}>
      <form
        className="modal entry"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void save(v);
        }}
      >
        <div className="mono flt-no small-no">{icao}</div>
        <div className="muted small">{name}</div>
        {FIR_COMM_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={`fc-${f.key}`}>
              {f.label}
            </label>
            {f.key === 'note' ? (
              <textarea id={`fc-${f.key}`} className="input" rows={2} placeholder={f.hint} value={v[f.key] ?? ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            ) : (
              <input id={`fc-${f.key}`} className="input mono" autoComplete="off" autoCapitalize="characters" placeholder={f.hint} value={v[f.key] ?? ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            )}
          </div>
        ))}
        <div className="row entry-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            저장
          </button>
          <button type="button" className="btn" onClick={onClose}>
            닫기
          </button>
          {value && (
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={() => {
                if (confirm(`${icao} 통신표를 지울까요?`)) void save(null);
              }}
            >
              지우기
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
