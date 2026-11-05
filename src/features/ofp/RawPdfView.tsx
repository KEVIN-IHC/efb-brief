import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDayZ } from '../../lib/time';
import { deleteOfp, setActiveFlight, useActiveFlight } from '../flight/activeFlight';
import { OfpOpenButton } from './OfpOpenButton';
import { ParsePanel } from './ParsePanel';
import { parseAviatorOfp } from './parser';
import { useUploadedOfps } from './useOfp';
import type { OfpRecord } from './types';

/** OFP PDF 가져오기 → 기기 안에서 텍스트 추출 → Aviator 파싱 → 현재 비행으로 설정. 추출 결과·원문 검증 */
export function RawPdfView({ focus: extFocus }: { focus?: { n: number; t: number } | null }) {
  const uploads = useUploadedOfps();
  const active = useActiveFlight((s) => s.flight.flightId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = uploads.find((u) => u.flightId === selectedId) ?? uploads.find((u) => u.flightId === active) ?? uploads[0];
  // 파싱은 원문에서 다시 계산 (빠름, 파서 개선이 바로 반영됨)
  const parsed = useMemo(() => (selected?.rawText ? parseAviatorOfp(selected.rawText) : null), [selected?.rawText]);
  const [focus, setFocus] = useState<{ n: number; t: number } | null>(null);
  useEffect(() => {
    if (extFocus) setFocus(extFocus);
  }, [extFocus]);
  const jump = (n: number) => setFocus({ n, t: Date.now() });

  const remove = async (id: string) => {
    if (!confirm('이 기기에서 이 OFP를 지울까요? (순항 기록은 남습니다)')) return;
    await deleteOfp(id);
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="page-grid">
      <section className="card">
        <div className="card-title">
          <h3>OFP PDF 가져오기</h3>
          <span className="muted small">Jeppesen Aviator</span>
        </div>
        <p className="muted small">PDF는 이 기기 안에서만 읽습니다. 인터넷이 필요 없고 외부로 보내지 않습니다. 원본 PDF는 저장하지 않고 추출한 텍스트만 보관합니다.</p>
        <div className="row">
          <OfpOpenButton />
        </div>

        {uploads.length > 0 && (
          <ul className="loglist upload-list">
            {uploads.map((u) => (
              <li key={u.flightId} className={u.flightId === selected?.flightId ? 'sel' : ''}>
                <button className="linklike" onClick={() => setSelectedId(u.flightId)}>
                  <span className="lognote">
                    {u.parsed ? `${u.parsed.header.flightNo} ${u.parsed.header.dep}→${u.parsed.header.arr} · ${u.parsed.header.date}` : u.fileName}
                  </span>
                  <span className="muted small mono">
                    {u.fileName} · {u.pageCount}p · {formatDayZ(u.createdAt)}
                  </span>
                </button>
                {u.flightId === active ? (
                  <span className="chip chip-ok">현재 비행</span>
                ) : u.parsed ? (
                  <button className="btn small" onClick={() => void setActiveFlight(u.flightId)}>
                    현재 비행으로
                  </button>
                ) : (
                  <span className="chip chip-warning">추출 불완전</span>
                )}
                <button className="btn small" onClick={() => void remove(u.flightId)} aria-label="삭제">
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {parsed && <ParsePanel r={parsed} onJump={jump} />}
      {selected?.rawText && <RawTextViewer key={selected.flightId} rec={selected} focus={focus} />}
    </div>
  );
}

function RawTextViewer({ rec, focus }: { rec: OfpRecord; focus: { n: number; t: number } | null }) {
  const lines = useMemo(() => rec.rawText!.split('\n'), [rec.rawText]);
  const pageStarts = useMemo(() => lines.flatMap((l, i) => (l.startsWith('===== PAGE ') ? [i] : [])), [lines]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [hl, setHl] = useState<number | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // 줄 번호를 누르면: 그 줄이 있는 페이지로 이동 → 스크롤 → 강조
  useEffect(() => {
    if (!focus) return;
    let p = 1;
    pageStarts.forEach((s, i) => {
      if (s <= focus.n - 1) p = i + 1;
    });
    setQ('');
    setPage(p);
    setHl(focus.n);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = preRef.current?.querySelector<HTMLElement>(`[data-ln="${focus.n}"]`);
        if (!el || !preRef.current) return;
        preRef.current.scrollTop = el.offsetTop - preRef.current.clientHeight / 3;
        preRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }),
    );
  }, [focus, pageStarts]);

  const query = q.trim().toUpperCase();
  const shown = useMemo(() => {
    if (query.length >= 2) return lines.flatMap((l, i) => (l.toUpperCase().includes(query) ? [{ n: i + 1, l }] : [])).slice(0, 500);
    const start = pageStarts[page - 1] ?? 0;
    const end = pageStarts[page] ?? lines.length;
    return lines.slice(start, end).map((l, k) => ({ n: start + k + 1, l }));
  }, [lines, pageStarts, page, query]);

  return (
    <section className="card span-all flush">
      <div className="card-title pad">
        <h3>원문</h3>
        <span className="muted small">
          {rec.fileName} · {lines.length.toLocaleString()} 줄
        </span>
      </div>
      <div className="row pad viewer-tools">
        <input className="input" placeholder="검색 (2글자 이상, 예: TRIP)" value={q} onChange={(e) => setQ(e.target.value)} />
        {query.length < 2 && (
          <div className="pager">
            <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="이전 페이지">
              ◀
            </button>
            <select className="input" value={page} onChange={(e) => setPage(Number(e.target.value))}>
              {pageStarts.map((_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} / {pageStarts.length}
                </option>
              ))}
            </select>
            <button className="btn small" disabled={page >= pageStarts.length} onClick={() => setPage(page + 1)} aria-label="다음 페이지">
              ▶
            </button>
          </div>
        )}
        {query.length >= 2 && <span className="small muted">{shown.length}건{shown.length === 500 ? ' (최대 500)' : ''}</span>}
      </div>
      <pre className="rawtext" ref={preRef}>
        {shown.map(({ n, l }) => (
          <div key={n} data-ln={n} className={`${l.startsWith('===== PAGE') ? 'pagemark' : ''} ${n === hl ? 'hl' : ''}`}>
            <span className="ln">{n}</span>
            {l || ' '}
          </div>
        ))}
      </pre>
    </section>
  );
}
