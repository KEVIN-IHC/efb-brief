// Manual 탭 (Phase 5 2단계, D-045 · D-097): 위 = 매뉴얼 책장(보기·검색 공통), 검색(이 매뉴얼/전체), 왼쪽 = PDF Expert식 목차(넓은 화면 늘 보임, 좁으면 옆에서 나옴)
// 가져온 매뉴얼을 쪽 단위로 보기 + 오프라인 검색 + "Refer to" 이동
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildToc, directKey, type TocGroup, docPages, itemSlice, openManualPage, resolveRef, searchPages, useManualNav, type SearchHit, type StoredPage } from './lookup';
import { ManualText } from './ManualText';
import { PageImages } from './PageImages';
import { listManuals, manualEvents, type StoredManual } from './store';

export function ManualPage() {
  const [docs, setDocs] = useState<StoredManual[] | null>(null);
  const nav = useManualNav();
  const [docId, setDocId] = useState<string | null>(null);
  const [seq, setSeq] = useState(0);
  const [mark, setMark] = useState<string | undefined>();
  const [pages, setPages] = useState<StoredPage[]>([]);
  const [q, setQ] = useState('');
  /** 검색 범위: 이 매뉴얼만 / 전체 */
  const [scopeAll, setScopeAll] = useState(true);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<{ docId: string; seq: number }[]>([]);
  const viewRef = useRef<HTMLElement>(null);
  /** 항목 번호로 열었을 때 그 항목만 보기(기본) ↔ 쪽 전체 */
  const [whole, setWhole] = useState(false);
  /** 목차 펼침 · 쪽 번호 입력 (D-077) */
  const [tocOpen, setTocOpen] = useState(false);
  const [jump, setJump] = useState<string | null>(null);

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
      setWhole(false);
    }
    if (nav.query) {
      setQ(nav.query);
      void runSearch(nav.query, true);
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
  const toc = useMemo(() => buildToc(pages), [pages]);
  const hasPdf = useMemo(() => pages.some((p) => p.pdfPage), [pages]);
  const curGroup = useMemo(() => {
    let k = -1;
    toc.forEach((g, i) => g.seq <= seq && (k = i));
    return k;
  }, [toc, seq]);
  const curEntry = useMemo(() => {
    let e = -1;
    for (const x of toc[curGroup]?.entries ?? []) if (x.seq <= seq) e = x.seq;
    return e;
  }, [toc, curGroup, seq]);
  const doc = docs?.find((d) => d.docId === docId);
  const slice = useMemo(() => itemSlice(pages, seq, mark), [pages, seq, mark]);
  const focus = slice && !whole ? slice : null;
  const refLabel = focus && focus.seqs.length > 1 ? `${page?.ref} ~ ${pages[focus.seqs.at(-1)!]?.ref?.split(' P ')[1] ?? ''}` : page?.ref;
  // 쪽 전체 보기에서는 해당 항목 제목으로 스크롤
  useEffect(() => {
    if (!whole) return;
    viewRef.current?.querySelector('.mh-target')?.scrollIntoView({ block: 'start' });
  }, [whole]);
  const marks = useMemo(() => [mark, ...(hits ? q.split(/\s+/) : [])].filter((x): x is string => !!x && x.length >= 2), [mark, hits, q]);

  const go = (d: string, s: number, m?: string, keepHistory = true) => {
    if (keepHistory && docId) setHistory((h) => [...h.slice(-30), { docId, seq }]);
    setDocId(d);
    setSeq(s);
    setMark(m);
    setWhole(false);
    setTocOpen(false);
    setJump(null);
    viewRef.current?.scrollIntoView({ block: 'start' });
  };

  /** 쪽 번호로 이동: 숫자 = 순번(…/전체), p34 = 원본 PDF 쪽(FOM처럼 알 때), 그 밖은 쪽 코드·절 번호 */
  const onJump = async (raw: string) => {
    const v = raw.trim();
    if (!v || !docId || !docs) return;
    const pdf = /^p\.?\s*(\d+)$/i.exec(v);
    if (pdf) {
      const n = Number(pdf[1]);
      const hit = [...pages].reverse().find((x) => x.pdfPage !== undefined && x.pdfPage <= n);
      if (hit) return go(docId, hit.seq);
      return setMsg(`원본 쪽 p.${n}을 찾지 못함 (이 매뉴얼은 원본 쪽 번호가 없음)`);
    }
    if (/^\d+$/.test(v)) return go(docId, Math.min(pages.length, Math.max(1, Number(v))) - 1);
    const dk = directKey(v);
    const t = dk && (await resolveRef(dk, docId, docs));
    if (t) return go(t.docId, t.seq, t.mark);
    setMsg(`"${v}" 위치를 찾지 못함`);
  };

  async function runSearch(text: string, everywhere: boolean) {
    const query = text.trim();
    if (!query || !docs) return;
    setMsg(null);
    const dk = directKey(query);
    if (dk) {
      const t = await resolveRef(dk, docId ?? '', docs);
      if (t) {
        setHits(null);
        go(t.docId, t.seq, t.mark ?? query.toUpperCase());
        return;
      }
    }
    setSearching(true);
    const ids = everywhere || !docId ? docs.map((d) => d.docId) : [docId];
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
      <nav className="man-shelf" aria-label="매뉴얼 고르기">
        {docs.map((d) => (
          <button key={d.docId} type="button" className={`man-book ${d.docId === docId ? 'on' : ''}`} aria-current={d.docId === docId ? 'true' : undefined} onClick={() => d.docId !== docId && go(d.docId, 0)}>
            <span className="mono strong">{d.docId}</span>
            <span className="small muted">{d.issueDate ?? d.revision ?? ''}</span>
          </button>
        ))}
      </nav>
      <section className="card">
        <form
          className="man-search"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(q, scopeAll);
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
          <span className="small muted">검색 범위</span>
          <div className="segmented man-scope-seg">
            <button type="button" role="radio" aria-checked={!scopeAll} className={!scopeAll ? 'on' : ''} onClick={() => setScopeAll(false)}>
              이 매뉴얼 ({docId})
            </button>
            <button type="button" role="radio" aria-checked={scopeAll} className={scopeAll ? 'on' : ''} onClick={() => setScopeAll(true)}>
              전체 {docs.length}권
            </button>
          </div>
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

      <div className={`man-body ${tocOpen ? 'toc-open' : ''}`}>
      {toc.length > 0 && (
        <aside className="man-side" aria-label="목차">
          <TocTree toc={toc} curGroup={curGroup} curEntry={curEntry} onGo={(s2) => go(docId!, s2)} onClose={() => setTocOpen(false)} title={docId ?? ''} />
        </aside>
      )}
      {tocOpen && <div className="man-side-backdrop" onClick={() => setTocOpen(false)} />}
      <section className="card man-view" ref={viewRef}>
        <div className="man-bar">
          <span className="man-title">
            <b className="mono">{docId}</b> <span className="small muted">{doc?.title}</span>
          </span>
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
            <button className="btn mono man-count" onClick={() => setJump((j) => (j === null ? '' : null))} aria-label="쪽 번호로 이동" aria-expanded={jump !== null}>
              {pages.length ? seq + 1 : 0}/{pages.length}
            </button>
            <button className="btn" disabled={seq >= pages.length - 1} onClick={() => go(docId!, seq + 1, undefined, false)} aria-label="다음 쪽">
              ›
            </button>
            <button className={`btn man-toc-btn ${tocOpen ? 'primary' : ''}`} onClick={() => setTocOpen((o) => !o)} aria-expanded={tocOpen} disabled={!toc.length}>
              목차
            </button>
          </div>
        </div>
        {jump !== null && (
          <form
            className="man-jump"
            onSubmit={(e) => {
              e.preventDefault();
              void onJump(jump);
            }}
          >
            <input
              className="input mono"
              autoFocus
              enterKeyHint="go"
              autoCapitalize="characters"
              autoCorrect="off"
              placeholder={hasPdf ? `1–${pages.length} · p34(원본 쪽) · 1.2.3` : `1–${pages.length} · DSC-21-20 같은 쪽 코드`}
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              aria-label="이동할 쪽"
            />
            <button className="btn primary" type="submit" disabled={!jump.trim()}>
              이동
            </button>
            <button className="btn" type="button" onClick={() => setJump(null)}>
              닫기
            </button>
          </form>
        )}
        {page ? (
          <>
            <div className="man-ref">
              <span className="mono strong">{refLabel ?? '쪽 표시 없음'}</span>
              {page.header && <span className="small muted">{page.header}</span>}
              {slice && (
                <button className="btn man-whole" onClick={() => setWhole((w) => !w)}>
                  {whole ? `${mark} 항목만 보기` : '쪽 전체 보기'}
                </button>
              )}
            </div>
            <PageImages docId={docId!} seqs={focus ? focus.seqs : [seq]} />
            <ManualText text={focus ? focus.text : page.text} marks={focus ? [] : marks} target={mark} onRef={(k) => void onRef(k)} />
            <p className="muted small man-foot">
              근거: {doc?.title} {doc?.revision ?? ''} {doc?.issueDate ?? ''} · {refLabel ?? '쪽 표시 없음'} · 변환 MD L{page.line}. 변환본이라 표·그림이 깨질 수 있음 — 운항 판단은 승인된 원본 매뉴얼로.
            </p>
          </>
        ) : (
          <p className="muted">{pages.length ? '' : '불러오는 중…'}</p>
        )}
      </section>
      </div>
    </div>
  );
}

/** PDF Expert식 목차: 장 ▸ 펼침, 들여쓰기 선, 지금 위치 강조, 목차 안 찾기 */
function TocTree({ toc, curGroup, curEntry, onGo, onClose, title }: { toc: TocGroup[]; curGroup: number; curEntry: number; onGo: (seq: number) => void; onClose: () => void; title: string }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set([curGroup]));
  const [f, setF] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen((o) => (o.has(curGroup) ? o : new Set([...o, curGroup])));
  }, [curGroup]);
  useEffect(() => {
    ref.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }, [curEntry]);
  const q = f.trim().toLowerCase();
  const match = (t?: string) => !!t && t.toLowerCase().includes(q);
  return (
    <div className="toc">
      <div className="toc-head">
        <b className="small">목차 · {title}</b>
        <button type="button" className="btn small toc-close" onClick={onClose}>
          닫기
        </button>
      </div>
      <input className="input toc-filter" type="search" placeholder="목차에서 찾기" value={f} onChange={(e) => setF(e.target.value)} aria-label="목차에서 찾기" />
      <div className="toc-list" ref={ref}>
        {toc.map((g, gi) => {
          const entries = q ? g.entries.filter((e) => match(e.title) || match(e.code)) : g.entries;
          if (q && !entries.length && !match(g.title)) return null;
          const isOpen = !!q || open.has(gi);
          return (
            <div key={`${g.key}-${g.seq}`} className={`toc-g ${gi === curGroup ? 'cur' : ''}`}>
              <button
                type="button"
                className="toc-gh"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen((o) => {
                    const n = new Set(o);
                    if (n.has(gi)) n.delete(gi);
                    else n.add(gi);
                    return n;
                  })
                }
              >
                <span className="toc-chev">{isOpen ? '▾' : '▸'}</span>
                <span className="toc-gt">{g.title}</span>
                <span className="mono small muted">{g.entries.length}</span>
              </button>
              {isOpen && (
                <ul>
                  {entries.map((e) => (
                    <li key={e.seq} style={{ ['--d' as string]: e.depth }}>
                      <button type="button" className={`toc-e ${e.seq === curEntry && gi === curGroup ? 'on' : ''}`} onClick={() => onGo(e.seq)}>
                        {e.code && <span className="mono toc-code">{e.code}</span>}
                        <span className="toc-t">{e.title}</span>
                        {e.pages > 1 && <span className="mono small muted toc-p">{e.pages}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
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
