// 약어 사전 (D-112): 오른쪽 아래 [약어] 버튼 → 찾기 창. 오프라인 (앱 내장 + 기기의 Jeppesen 약어 쪽).
// 창을 열어 둔 채 NOTAM 본문(data-abbr) 낱말을 누르면 그 낱말을 바로 찾는다 (사전처럼). 키보드는 띄우지 않음.
import { useEffect, useMemo, useRef, useState } from 'react';
import { openManualPage } from '../manual/lookup';
import { loadAbbrDict, searchAbbr, tapWord, type AbbrEntry } from './abbrDict';

const WORD = /[A-Za-z0-9/\-]/;

/** 누른 자리의 낱말 (Safari·Chrome: caretRangeFromPoint, Firefox: caretPositionFromPoint) */
function wordAt(x: number, y: number): string {
  const d = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let node: Node | null = null;
  let off = 0;
  const r = d.caretRangeFromPoint?.(x, y);
  if (r) {
    node = r.startContainer;
    off = r.startOffset;
  } else {
    const p = d.caretPositionFromPoint?.(x, y);
    if (p) {
      node = p.offsetNode;
      off = p.offset;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return '';
  const t = node.textContent ?? '';
  let a = off;
  let b = off;
  while (a > 0 && WORD.test(t[a - 1])) a--;
  while (b < t.length && WORD.test(t[b])) b++;
  return t.slice(a, b);
}

export function AbbrDock({ lift }: { lift?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [dict, setDict] = useState<AbbrEntry[] | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);
  const dictRef = useRef<AbbrEntry[]>([]);

  useEffect(() => {
    if (!open || dict) return;
    void loadAbbrDict().then((d) => {
      dictRef.current = d;
      setDict(d);
    });
  }, [open, dict]);

  // 창이 열려 있으면: NOTAM 본문 낱말 누르기 = 찾기
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('abbr-on');
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-abbr]');
      if (!el) return;
      const w = wordAt(e.clientX, e.clientY);
      if (!w || !/[A-Za-z]/.test(w)) return;
      const k = tapWord(w, dictRef.current);
      setQ(k);
      setTapped(w);
    };
    document.addEventListener('click', onClick);
    return () => {
      document.body.classList.remove('abbr-on');
      document.removeEventListener('click', onClick);
    };
  }, [open]);

  const res = useMemo(() => (dict ? searchAbbr(dict, q) : []), [dict, q]);
  const jepp = dict?.filter((e) => e.src === 'jepp').length ?? 0;

  return (
    <>
      {open && (
        <section className={`abbr-panel ${lift ? 'lift' : ''}`} role="dialog" aria-label="약어 사전">
          <header className="abbr-h">
            <b>약어 사전</b>
            <span className="small muted">{dict ? `앱 ${dict.length - jepp} · Jeppesen ${jepp || '없음'}` : '불러오는 중…'}</span>
            <button className="abbr-x" onClick={() => setOpen(false)} aria-label="닫기">
              ✕
            </button>
          </header>
          <div className="abbr-in">
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setTapped(null);
              }}
              placeholder="약어나 뜻 (예: CLSD, PPR, threshold)"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            {q && (
              <button className="abbr-clear" onClick={() => setQ('')} aria-label="지우기">
                지우기
              </button>
            )}
          </div>
          <div className="abbr-list">
            {!q && <p className="small muted abbr-tip">창을 열어 둔 채 NOTAM 본문의 낱말을 누르면 바로 찾아요. 오프라인에서도 됩니다.</p>}
            {q && tapped && tapped.toUpperCase() !== q && <p className="small muted abbr-tip">누른 낱말 {tapped} → {q}</p>}
            {q && dict && res.length === 0 && <p className="small muted abbr-tip">"{q}" 없음{jepp ? '' : ' — Manual에 Jeppesen General을 가져오면 약어가 많아집니다'}</p>}
            {res.map((e, i) => (
              <div key={i} className="abbr-row">
                <b className="mono abbr-k">{e.k}</b>
                <span className="abbr-v">{e.v}</span>
                {e.src === 'app' ? (
                  <span className="abbr-src small muted">앱 내장</span>
                ) : (
                  <button className="abbr-src linkish small" onClick={() => openManualPage({ docId: e.docId!, seq: e.seq!, mark: e.k })}>
                    Jeppesen {e.ref} 📖
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <button className={`abbr-fab ${open ? 'on' : ''} ${lift ? 'lift' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="약어 사전">
        <span className="abbr-fab-i">Aa</span>
        <span>약어</span>
      </button>
    </>
  );
}
