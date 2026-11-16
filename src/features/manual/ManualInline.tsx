// 매뉴얼을 "그 자리에서" 보기 (D-062): MEL 카드·Ops 근거 안에서 펼치기/접기, 그 밖의 📖 링크는 화면 위 창.
// Manual 탭으로 옮겨 가지 않으므로 닫으면 보던 화면·스크롤 그대로.
import { useEffect, useMemo, useState } from 'react';
import { docPages, itemSlice, openManualTab, resolveRef, useManualPopup, type ManualTarget, type StoredPage } from './lookup';
import { ManualText } from './ManualText';
import { PageImages } from './PageImages';
import { listManuals, manualEvents, type StoredManual } from './store';

export function ManualInline({ target, onClose, compact = false, inPopup = false }: { target: ManualTarget; onClose?: () => void; compact?: boolean; inPopup?: boolean }) {
  const [docs, setDocs] = useState<StoredManual[] | null>(null);
  const [cur, setCur] = useState<ManualTarget>(target);
  const [pages, setPages] = useState<StoredPage[]>([]);
  const [whole, setWhole] = useState(false);
  const [history, setHistory] = useState<ManualTarget[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setCur(target);
    setHistory([]);
    setWhole(false);
  }, [target.docId, target.seq, target.mark]);

  useEffect(() => {
    const load = () => void listManuals().then(setDocs);
    load();
    manualEvents.addEventListener('change', load);
    return () => manualEvents.removeEventListener('change', load);
  }, []);

  useEffect(() => {
    let alive = true;
    void docPages(cur.docId).then((p) => alive && setPages(p));
    return () => {
      alive = false;
    };
  }, [cur.docId, docs]);

  const page = pages[cur.seq];
  const doc = docs?.find((d) => d.docId === cur.docId);
  const slice = useMemo(() => itemSlice(pages, cur.seq, cur.mark), [pages, cur]);
  const focus = slice && !whole ? slice : null;

  const go = (t: ManualTarget, keep = true) => {
    if (keep) setHistory((h) => [...h.slice(-20), cur]);
    setCur(t);
    setWhole(false);
    setMsg(null);
  };
  const onRef = async (key: string) => {
    if (!docs) return;
    const t = await resolveRef(key, cur.docId, docs);
    if (t) go(t);
    else setMsg(`참조 위치를 찾지 못함: ${key.split(':')[1]}`);
  };

  return (
    <div className={`man-inline ${compact ? 'compact' : ''}`}>
      <div className="man-inline-bar">
        <span className="mono strong man-inline-ref">
          {cur.docId} · {page?.ref ?? (pages.length ? '쪽 표시 없음' : '불러오는 중…')}
        </span>
        <div className="man-nav">
          <button className="btn small" disabled={!history.length} onClick={() => (go(history.at(-1)!, false), setHistory((h) => h.slice(0, -1)))} aria-label="이전 위치로">
            ↩
          </button>
          <button className="btn small" disabled={cur.seq <= 0} onClick={() => go({ docId: cur.docId, seq: cur.seq - 1 })} aria-label="앞 쪽">
            ‹
          </button>
          <button className="btn small" disabled={cur.seq >= pages.length - 1} onClick={() => go({ docId: cur.docId, seq: cur.seq + 1 })} aria-label="다음 쪽">
            ›
          </button>
          {slice && (
            <button className="btn small" onClick={() => setWhole((w) => !w)}>
              {whole ? '항목만' : '쪽 전체'}
            </button>
          )}
          {onClose && (
            <button className="btn small" onClick={onClose}>
              닫기
            </button>
          )}
        </div>
      </div>
      {page?.header && <p className="small muted man-inline-head">{page.header}</p>}
      {msg && <p className="small c-warn">{msg}</p>}
      {page ? (
        <>
          <PageImages docId={cur.docId} seqs={focus ? focus.seqs : [cur.seq]} />
          <ManualText text={focus ? focus.text : page.text} marks={focus || !cur.mark ? [] : [cur.mark]} target={cur.mark} onRef={(k) => void onRef(k)} />
        </>
      ) : (
        <p className="small muted">{pages.length ? '이 쪽이 없습니다' : '불러오는 중…'}</p>
      )}
      {page && !page.text.trim() && <p className="small muted">이 절은 본문이 없습니다 (하위 절을 보세요 ›)</p>}
      <p className="muted small man-foot">
        근거: {doc?.title ?? cur.docId} {doc?.revision ?? ''} {doc?.issueDate ?? ''}. 변환본 — 운항 판단은 승인된 원본으로.{' '}
        <button className="linkish" onClick={() => (inPopup ? onClose?.() : undefined, openManualTab(cur, { popup: inPopup ? cur : undefined }))}>
          Manual 탭에서 크게 보기
        </button>
      </p>
    </div>
  );
}

/** 📖 링크로 연 매뉴얼 창. 바깥·닫기·Esc로 닫으면 보던 화면 그대로 */
export function ManualPopup() {
  const target = useManualPopup((s) => s.target);
  const close = () => useManualPopup.setState({ target: null });
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onHash = () => close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
    };
  }, [target]);
  if (!target) return null;
  return (
    <div className="man-pop-backdrop" onClick={close}>
      <div className="man-pop" role="dialog" aria-modal="true" aria-label="매뉴얼 보기" onClick={(e) => e.stopPropagation()}>
        <ManualInline target={target} onClose={close} inPopup />
      </div>
    </div>
  );
}
