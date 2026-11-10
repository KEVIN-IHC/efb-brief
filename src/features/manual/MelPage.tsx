// MEL 탭 (Phase 5 2단계, D-045): 현재 OFP의 MEL/CDL 번호 → 가져온 매뉴얼 항목 자동 매칭.
// 원문 문구만 보여 준다(조건을 요약·해석하지 않음). 매칭 못 하면 숨기지 않고 "매뉴얼에서 못 찾음".
import { useEffect, useState } from 'react';
import { useActiveFlight } from '../flight/activeFlight';
import { OfpOpenButton } from '../ofp/OfpOpenButton';
import { itemFlags, loadMelMatches, manualAircraft, openManualPage, type MelMatch } from './lookup';
import { ManualText } from './ManualText';
import { manualEvents, type StoredManual } from './store';

export function MelPage() {
  const { ofp, loaded } = useActiveFlight();
  const o = ofp?.parsed;
  const [data, setData] = useState<{ docs: StoredManual[]; matches: MelMatch[] } | null>(null);
  const aircraft = manualAircraft(o?.header.acType);

  useEffect(() => {
    if (!o) return;
    const load = () => void loadMelMatches(o.mel, aircraft).then(setData);
    load();
    manualEvents.addEventListener('change', load);
    return () => manualEvents.removeEventListener('change', load);
  }, [o, aircraft]);

  if (!loaded) return null;
  if (!o)
    return (
      <section className="card placeholder">
        <p>현재 비행의 OFP가 없습니다.</p>
        <OfpOpenButton />
      </section>
    );
  if (!data) return null;

  const { docs, matches } = data;
  const melDocs = docs.filter((d) => d.kind === 'MEL' || d.kind === 'CDL');
  const found = matches.filter((m) => m.how !== 'none').length;

  return (
    <div className="mel">
      <section className="doc-sec">
        <header className="doc-h">
          <h3>MEL / CDL</h3>
          <span className="doc-meta">
            {o.header.flightNo} · {o.header.acType}
          </span>
        </header>
        <div className="doc-b">
          <p className="small">
            OFP 디스패치 MEL/CDL <b className="mono">{matches.length}</b>건 · 매뉴얼에서 찾음 <b className="mono">{found}</b>건
          </p>
          {melDocs.length === 0 ? (
            <p className="small c-warn">
              MEL·CDL 매뉴얼을 아직 가져오지 않았습니다 → <a href="#settings">Settings → 매뉴얼</a>
            </p>
          ) : (
            <p className="muted small">
              {melDocs.map((d) => `${d.docId} ${d.issueDate ?? ''}`).join(' · ')}
              {aircraft && melDocs.every((d) => d.aircraft !== aircraft) && <span className="c-warn"> · OFP 기종({o.header.acType})과 맞는 매뉴얼 없음</span>}
            </p>
          )}
          <p className="doc-foot">매뉴얼 문구를 그대로 보여 줍니다(요약·해석 없음). 디스패치 가능 여부는 정비·운항관리 판단과 승인된 원본 MEL이 기준입니다.</p>
        </div>
      </section>

      {matches.length === 0 && <section className="card placeholder"><p>이 OFP에는 MEL/CDL 항목이 없습니다 (NIL).</p></section>}

      {matches.map((m, i) => (
        <MelCard key={i} m={m} ofpTitle={o.mel[i]?.title ?? ''} docs={docs} />
      ))}
    </div>
  );
}

function MelCard({ m, ofpTitle, docs }: { m: MelMatch; ofpTitle: string; docs: StoredManual[] }) {
  const it = m.item;
  const doc = it && docs.find((d) => d.docId === it.docId);
  const flags = it ? itemFlags(it.text) : null;
  return (
    <section className={`card mel-card ${m.kind === 'CDL' ? 'is-cdl' : ''}`}>
      <div className="mel-head">
        <span className={`tag ${m.kind === 'CDL' ? 'tag-cdl' : 'tag-mel'}`}>{m.kind}</span>
        <span className="mono strong">{m.itemNo}</span>
        {it?.repairInterval && <span className="chip chip-caution">CAT {it.repairInterval}</span>}
        {it?.installed && (
          <span className="mono small">
            장착 {it.installed} · 필요 {it.required ?? '?'}
          </span>
        )}
        {it?.placard && <span className="small muted">플래카드 {it.placard}</span>}
      </div>
      <div className="mel-title">{it?.title || ofpTitle}</div>
      <div className="muted small">OFP: {ofpTitle}</div>

      {m.how === 'none' && <p className="small c-warn">가져온 매뉴얼에서 이 번호를 찾지 못함 — 원본 {m.kind} 확인</p>}
      {m.how === 'parent' && <p className="small c-warn">하위 항목 {m.itemNo}를 못 찾아 상위 항목 {it?.itemNo}을 보여 줍니다 — 원본 확인</p>}
      {m.aircraftOk === false && <p className="small c-warn">다른 기종 매뉴얼({doc?.aircraft})에서 찾은 항목</p>}

      {flags && (flags.ops || flags.maint || flags.notes.length > 0) && (
        <div className="mel-flags">
          {flags.ops && <span className="chip chip-caution">(o) 운항 절차</span>}
          {flags.maint && <span className="chip">(m) 정비 절차</span>}
          {flags.notes.map((n) => (
            <span key={n} className="chip">
              {n}
            </span>
          ))}
        </div>
      )}

      {it && (
        <details className="mel-body">
          <summary>매뉴얼 원문 ({it.ref ?? '쪽 표시 없음'})</summary>
          <ManualText text={it.text} marks={[m.itemNo]} />
        </details>
      )}

      {it && (
        <div className="row mel-links">
          <button className="btn" onClick={() => openManualPage({ docId: it.docId, seq: it.pageSeq, mark: it.itemNo })}>
            {it.ref ?? '매뉴얼 쪽'} 열기
          </button>
          {it.opsProcSeq !== undefined && (
            <button className="btn" onClick={() => openManualPage({ docId: it.docId, seq: it.opsProcSeq!, mark: it.itemNo })}>
              (o) 절차 쪽 열기
            </button>
          )}
          {m.parent && m.parent !== it && (
            <button className="btn" onClick={() => openManualPage({ docId: m.parent!.docId, seq: m.parent!.pageSeq, mark: m.parent!.itemNo })}>
              상위 {m.parent.itemNo}
            </button>
          )}
        </div>
      )}
      {doc && (
        <p className="muted small">
          근거: {doc.docId} {doc.issueDate ?? ''} · {it?.ref ?? ''}
        </p>
      )}
    </section>
  );
}

