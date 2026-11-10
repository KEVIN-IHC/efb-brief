// Manual 탭 (Phase 5 2단계, D-045): 가져온 매뉴얼을 쪽 단위로 보기 + 오프라인 검색 + "Refer to" 이동
import { useEffect, useMemo, useRef, useState } from 'react';
import { directKey, docPages, openManualPage, resolveRef, searchPages, useManualNav, type SearchHit, type StoredPage } from './lookup';
import { ManualText } from './ManualText';
import { listManuals, manualEvents, type StoredManual } from './store';

export function ManualPage() {
  const [docs, setDocs] = useState<StoredManual[] | null>(null);
  const nav = useManualNav();
  const [docId, setDocId] = useState<string | null>(null);
  const [seq, setSeq] = useState(0);
  const [mark, setMark] = useState<string | undefined>();
  const [pages, setPages] = useState<StoredPage[]>([]);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<string>('ALL');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<{ docId: string; seq: number }[]>([]);
  const viewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const load = () => void listManuals().then(setDocs);
    load();
    manualEvents.addEventListener('change', load);
    return () => manualEvents.removeEventListener('change', load);
  }, []);

  // 다른 탭에서 들어온 이동·검색 요청
  useEffect(() => {
    if (nav.target) {
      setDocId(nav.target.docId);
      setSeq(nav.target.seq);
      setMark(nav.target.mark);
    }
    if (nav.query) {
      setQ(nav.query);
      void runSearch(nav.query, 'ALL');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.t]);

  useEffect(() => {
    if (!docId && docs?.length) setDocId(docs[0].docId);
  }, [docs, docId]);

  useEffect(() => {
    if (!docId) return;
    let alive = true;
    void docPages(docId).then((p) => alive && setPages(p));
    return () => {
      alive = false;
    };
  }, [docId, docs]);

  const page = pages[seq];
  const doc = docs?.find((d) => d.docId === docId);
  const marks = useMemo(() => [mark, ...(hits ? q.split(/\s+/) : [])].filter((x): x is string => !!x && x.length >= 2), [mark, hits, q]);

  const go = (d: string, s: number, m?: string, keepHistory = true) => {
    if (keepHistory && docId) setHistory((h) => [...h.slice(-30), { docId, seq }]);
    setDocId(d);
    setSeq(s);
    setMark(m);
    viewRef.current?.scrollIntoView({ block: 'start' });
  };

  async function runSearch(text: string, sc: string) {
    const query = text.trim();
    if (!query || !docs) return;
    setMsg(null);
    const dk = directKey(query);
    if (dk) {
      const t = await resolveRef(dk, sc === 'ALL' ? (docId ?? '') : sc, docs);
      if (t) {
        setHits(null);
        go(t.docId, t.seq, t.mark ?? query.toUpperCase());
        return;
      }
    }
    setSearching(true);
    const ids = sc === 'ALL' ? docs.map((d) => d.docId) : [sc];
    const all = (await Promise.all(ids.map(docPages))).flat();
    setHits(searchPages(all, query));
    setSearching(false);
  }

  const onRef = async (key: string) => {
    if (!docs || !docId) return;
    const t = await resolveRef(key, docId, docs);
    if (t) go(t.docId, t.seq, t.mark);
    else setMsg(`참조 위치를 찾지 못함: ${key.split(':')[1]} (그 매뉴얼을 가져오지 않았거나 쪽 표시가 없음)`);
  };

  if (!docs) return null;
  if (docs.length === 0)
    return (
      <section className="card placeholder">
        <p>가져온 매뉴얼이 없습니다.</p>
        <p className="muted small">Settings → 매뉴얼 → 매뉴얼 가져오기 (Mac에서 `npm run manuals`로 만든 묶음 파일)</p>
        <a className="btn" href="#settings">
          Settings 열기
        </a>
      </section>
    );

  return (
    <div className="man">
      <section className="card">
        <form
          className="man-search"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(q, scope);
          }}
        >
          <input
            className="input"
            type="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder='검색: 낱말·"구절"·항목 번호(36-11-01B)·절(FOM 6.5.3.1)'
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn primary" type="submit" disabled={!q.trim() || searching}>
            {searching ? '찾는 중…' : '검색'}
          </button>
        </form>
        <div className="man-scope" role="radiogroup" aria-label="검색 범위">
          {['ALL', ...docs.map((d) => d.docId)].map((id) => (
            <button key={id} role="radio" aria-checked={scope === id} className={`man-f ${scope === id ? 'on' : ''}`} onClick={() => setScope(id)}>
              {id === 'ALL' ? '전체' : id}
            </button>
          ))}
        </div>
        {msg && <p className="small c-warn">{msg}</p>}
        {hits && (
          <div className="man-hits">
            <p className="muted small">
              {hits.length === 0 ? '찾은 쪽 없음' : `${hits.length}${hits.length >= 60 ? '+' : ''}쪽 (관련도순)`}{' '}
              <button className="btn" onClick={() => setHits(null)}>
                닫기
              </button>
            </p>
            <ul>
              {hits.map((h) => (
                <li key={`${h.docId}:${h.seq}`}>
                  <button className="man-hit" onClick={() => go(h.docId, h.seq)}>
                    <span className="mono small strong">
                      {h.docId} · {h.ref ?? `#${h.seq + 1}`}
                    </span>
                    {h.header && <span className="small muted">{h.header}</span>}
                    <span className="small">{h.snippet}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card man-view" ref={viewRef}>
        <div className="man-bar">
          <select className="input" value={docId ?? ''} onChange={(e) => go(e.target.value, 0)} aria-label="매뉴얼 선택">
            {docs.map((d) => (
              <option key={d.docId} value={d.docId}>
                {d.docId} · {d.issueDate ?? ''}
              </option>
            ))}
          </select>
          <div className="man-nav">
            <button className="btn" disabled={!history.length} onClick={() => {
              const h = history.at(-1)!;
              setHistory((x) => x.slice(0, -1));
              go(h.docId, h.seq, undefined, false);
            }} aria-label="이전 위치로">
              ↩
            </button>
            <button className="btn" disabled={seq <= 0} onClick={() => go(docId!, seq - 1, undefined, false)} aria-label="앞 쪽">
              ‹
            </button>
            <span className="mono small">
              {pages.length ? seq + 1 : 0}/{pages.length}
            </span>
            <button className="btn" disabled={seq >= pages.length - 1} onClick={() => go(docId!, seq + 1, undefined, false)} aria-label="다음 쪽">
              ›
            </button>
          </div>
        </div>
        {page ? (
          <>
            <div className="man-ref">
              <span className="mono strong">{page.ref ?? '쪽 표시 없음'}</span>
              {page.header && <span className="small muted">{page.header}</span>}
            </div>
            <ManualText text={page.text} marks={marks} onRef={(k) => void onRef(k)} />
            <p className="muted small man-foot">
              근거: {doc?.title} {doc?.revision ?? ''} {doc?.issueDate ?? ''} · {page.ref ?? '쪽 표시 없음'} · 변환 MD L{page.line}. 변환본이라 표·그림이 깨질 수 있음 — 운항 판단은 승인된 원본 매뉴얼로.
            </p>
          </>
        ) : (
          <p className="muted">{pages.length ? '' : '불러오는 중…'}</p>
        )}
      </section>
    </div>
  );
}

/** 다른 화면에서 쓰는 작은 링크 버튼 */
export function ManualLink({ docId, seq, label, mark }: { docId: string; seq: number; label: string; mark?: string }) {
  return (
    <button className="btn man-link" onClick={() => openManualPage({ docId, seq, mark })}>
      {label}
    </button>
  );
}
