// FIR 통신 창 (D-095): NAV LOG의 "▸ FIR …" 줄을 누르면 MEL 링크처럼 그 자리 위에 창.
// 진입 지점·시각(OFP) + 개인 통신표(편집) + 회사 FOM 데이터링크 절차 📖 (FIR별 절차가 있으면 그 FIR 줄 강조)
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { airacAge, airacOf } from '../../lib/airac';
import { formatDayZ } from '../../lib/time';
import { docPages, openManualPage, type ManualTarget } from '../manual/lookup';
import { listManuals, manualEvents } from '../manual/store';
import { useActiveFlight } from '../flight/activeFlight';
import { FIR_COMM_FIELDS, useFirComm } from './commTable';
import { FirCommSheet } from './FirCommSection';
import { firSequence } from './sequence';

export const useFirPopup = create<{ icao: string | null }>(() => ({ icao: null }));
export const openFirPopup = (icao: string) => useFirPopup.setState({ icao });

/** 회사 FOM 데이터링크 절 (코드 = 매뉴얼 묶음의 쪽 코드) */
const FOM_DL: { code: string; label: string }[] = [
  { code: 'FOM-S9.2.4.3', label: 'Log-on 절차' },
  { code: 'FOM-S9.2.4.5', label: 'End of Service · 연결 이전' },
  { code: 'FOM-S9.2.5.1', label: 'CPDLC 절차' },
  { code: 'FOM-S9.2.5.2', label: 'ADS-C 절차' },
  { code: 'FOM-S9.2.5.3', label: 'Emergency · Non-Normal' },
  { code: 'FOM-S9.2.5.4', label: '보고 절차' },
];
const FIR_PROC = 'FOM-S9.2.5.5';

type Refs = { list: (ManualTarget & { label: string })[]; fir?: ManualTarget };

function useDlRefs(icao: string | null): Refs | undefined {
  const [refs, setRefs] = useState<Refs>();
  const [n, setN] = useState(0);
  useEffect(() => {
    const re = () => setN((x) => x + 1);
    manualEvents.addEventListener('change', re);
    return () => manualEvents.removeEventListener('change', re);
  }, []);
  useEffect(() => {
    if (!icao) return;
    let alive = true;
    void (async () => {
      const out: Refs = { list: [] };
      for (const d of (await listManuals()).filter((x) => x.kind === 'FOM')) {
        const pages = await docPages(d.docId);
        for (const r of FOM_DL) {
          const p = pages.find((x) => x.code === r.code);
          if (p && !out.list.some((x) => x.label === r.label)) out.list.push({ docId: d.docId, seq: p.seq, label: r.label, mark: r.code.slice(4) });
        }
        // FIR별 절차: 그 절 쪽들 중 "(RJJJ)"가 있는 쪽
        const fp = pages.find((x) => x.code === FIR_PROC && x.text.includes(`(${icao})`));
        if (fp) out.fir = { docId: d.docId, seq: fp.seq, mark: `(${icao})` };
      }
      if (alive) setRefs(out);
    })();
    return () => {
      alive = false;
    };
  }, [icao, n]);
  return refs;
}

export function FirPopup() {
  const icao = useFirPopup((s) => s.icao);
  const o = useActiveFlight((s) => s.ofp?.parsed ?? null);
  const table = useFirComm();
  const refs = useDlRefs(icao);
  const [edit, setEdit] = useState(false);
  const close = () => useFirPopup.setState({ icao: null });
  useEffect(() => {
    if (!icao) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !edit && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', close);
    };
  }, [icao, edit]);
  const legs = useMemo(() => (o ? firSequence(o).legs : []), [o]);
  if (!icao) return null;
  const these = legs.filter((l) => l.icao === icao);
  const name = these[0]?.name ?? '';
  const c = table[icao];
  const now = Date.now();
  const noFom = refs && !refs.list.length && !refs.fir;

  return (
    <div className="man-pop-backdrop" onClick={close}>
      <div className="man-pop" role="dialog" aria-modal="true" aria-label={`${icao} FIR 통신`} onClick={(e) => e.stopPropagation()}>
        <div className="man-inline">
          <div className="man-inline-bar">
            <span className="turb-pop-h">
              <b className="mono">FIR {icao}</b>
              <span className="muted">{name}</span>
            </span>
            <div className="man-nav">
              <button className="btn small" onClick={() => setEdit(true)}>
                통신표 편집
              </button>
              <button className="btn small" onClick={close}>
                닫기
              </button>
            </div>
          </div>

          <p className="mono small">
            {these.length
              ? these.map((l) => (l.entry ? `진입 ${l.entry.wpt} ${formatDayZ(l.entry.eto)} (OFP 계획)` : '출발 FIR (이륙부터)')).join(' · ')
              : 'OFP NAV LOG에서 이 FIR 진입 지점을 찾지 못함'}
            {o?.header.selcal ? ` · SELCAL ${o.header.selcal}` : ''}
          </p>

          <h4 className="fir-pop-h">통신 방법 (개인 통신표)</h4>
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
              {(airacAge(c.updatedAt, now) ?? 0) > 0 && <div className="wide small c-caution">입력 후 AIRAC {airacAge(c.updatedAt, now)}주기 지남 — 최신 AIP·차트로 다시 확인</div>}
            </dl>
          ) : (
            <p className="small muted">
              이 FIR 통신표가 비어 있습니다. <b>통신표 편집</b>으로 직접 넣거나, Briefing의 FIR · 통신 카드에서 <b>통신표 가져오기</b>(JSON)로 한 번에 넣을 수 있습니다.
            </p>
          )}

          <h4 className="fir-pop-h">CPDLC · 데이터링크 (회사 FOM)</h4>
          {refs?.fir && (
            <button className="btn fir-pop-fir" onClick={() => openManualPage(refs.fir!)}>
              📖 FOM S9.2.5.5 FIR 별 절차 — {icao}
            </button>
          )}
          {refs && !refs.fir && refs.list.length > 0 && <p className="small muted">FOM S9.2.5.5 FIR 별 절차에 {icao}는 따로 없음</p>}
          {refs && refs.list.length > 0 && (
            <div className="fir-pop-refs">
              {refs.list.map((r) => (
                <button key={r.label} className="btn small" onClick={() => openManualPage(r)}>
                  📖 {r.label}
                </button>
              ))}
            </div>
          )}
          {noFom && <p className="small muted">기기에 FOM 묶음이 없습니다 — Settings → 매뉴얼 → 가져오기</p>}
          {!refs && <p className="small muted">매뉴얼 찾는 중…</p>}
          <p className="muted small man-foot">FIR·진입 시각 = OFP · 통신 정보 = 직접 입력한 개인 표(기기 안) · 사용 전 최신 AIP·차트·ATC 지시로 확인</p>
        </div>
      </div>
      {edit && (
        <div onClick={(e) => e.stopPropagation()}>
          <FirCommSheet icao={icao} name={name} value={c} onClose={() => setEdit(false)} />
        </div>
      )}
    </div>
  );
}
