// SD 페이지 가이드 창 (D-096 · D-100): Hourly check SD 줄의 [가이드] → 페이지 골라
//   위 = 실제 SD 화면처럼 검은 바탕 ECAM 색으로 한계 (회사 기준 파일 sdGuide — FCOM 값이라 비공개 파일에서만)
//   값 줄을 누르면 아래에 설명 + FCOM 원문 문장 + 📖 원본 쪽 · 맨 아래 = FCOM 숫자 조건 문장 전체(접힘)
import { useEffect, useState } from 'react';
import { loadRules, rulesEvents, type SdGuideData, type SdLimit, type SdPanel } from '../brief/rules';
import { docPages, openManualPage } from '../manual/lookup';
import { listManuals, manualEvents } from '../manual/store';
import { SD_PAGES } from './hourly';
import { extractSd, SD_SECTIONS, type SdBlock, type SdKind } from './sdGuide';

const KIND: Record<SdKind, string> = { normal: '정상', amber: 'AMBER', red: 'RED', advisory: '주의(맥동)', cond: '조건' };

/** 숫자+단위 강조 */
function Hl({ t }: { t: string }) {
  const parts = t.split(/(\d[\d ,.]*\s?(?:PSI|°C|%|QT|V\b|Hz|kVA|KVA|A\b|kg|ft|bar|s\b|mn\b))/i);
  return <>{parts.map((p, i) => (i % 2 ? <b key={i} className="mono">{p}</b> : p))}</>;
}

/** 한 값의 초록·AMBER·RED 글 */
function Lim({ r }: { r: SdLimit }) {
  if (!r.g && !r.a && !r.r) return <span className="ec-w">—</span>;
  return (
    <>
      {r.g && <span className="ec-g">{r.g}</span>}
      {r.a && <span className="ec-a">{r.a}</span>}
      {r.r && <span className="ec-r">{r.r}</span>}
    </>
  );
}

function Panel({ p, sel, onSel }: { p: SdPanel; sel: string | null; onSel: (k: string) => void }) {
  const key = (r: SdLimit) => `${p.title}|${r.label}`;
  return (
    <div className="ec-panel">
      <div className="ec-title">{p.title}</div>
      {p.kind === 'cols' ? (
        <div className="ec-cols" style={{ gridTemplateColumns: `minmax(56px, auto) repeat(${p.cols.length}, minmax(0, 1fr))` }}>
          <span />
          {p.cols.map((c) => (
            <span key={c} className="ec-hdr">
              {c}
            </span>
          ))}
          {p.rows.map((r) => (
            <button key={r.label} type="button" className={`ec-row ${sel === key(r) ? 'on' : ''}`} style={{ gridColumn: `1 / span ${p.cols.length + 1}` }} onClick={() => onSel(key(r))}>
              <span className="ec-lbl">{r.label}</span>
              {p.cols.map((c) => (
                <span key={c} className="ec-lim">
                  <Lim r={r} />
                </span>
              ))}
            </button>
          ))}
        </div>
      ) : (
        <div className="ec-boxes">
          {p.cols.map((c) => (
            <div key={c} className="ec-box">
              <div className="ec-hdr">{c}</div>
              {p.rows.map((r) => (
                <button key={r.label} type="button" className={`ec-brow ${sel === key(r) ? 'on' : ''}`} onClick={() => onSel(key(r))}>
                  <span className="ec-lbl">{r.label}</span>
                  <span className="ec-lim">
                    <Lim r={r} />
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SdGuide({ initial, onClose }: { initial: string; onClose: () => void }) {
  const [sd, setSd] = useState(initial);
  const [sel, setSel] = useState<string | null>(null);
  const [doc, setDoc] = useState<{ docId: string; blocks: Record<string, SdBlock[]> } | null | undefined>(undefined);
  const [guide, setGuide] = useState<SdGuideData | null | undefined>(undefined);
  const [n, setN] = useState(0);
  useEffect(() => {
    const re = () => setN((x) => x + 1);
    manualEvents.addEventListener('change', re);
    rulesEvents.addEventListener('change', re);
    return () => {
      manualEvents.removeEventListener('change', re);
      rulesEvents.removeEventListener('change', re);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    void loadRules().then((r) => alive && setGuide(r?.rules.sdGuide ?? null));
    void (async () => {
      const f = (await listManuals()).find((x) => x.kind === 'FCOM');
      if (!f) return alive && setDoc(null);
      const pages = await docPages(f.docId);
      const blocks = Object.fromEntries(Object.keys(SD_SECTIONS).map((k) => [k, extractSd(pages, k)]));
      if (alive) setDoc({ docId: f.docId, blocks });
    })();
    return () => {
      alive = false;
    };
  }, [n]);
  const pages = SD_PAGES.filter((p) => SD_SECTIONS[p.id]);
  const list = doc?.blocks[sd] ?? [];
  const panels = guide?.pages[sd] ?? [];
  const selRow = sel ? panels.flatMap((p) => p.rows.map((r) => ({ p, r }))).find((x) => `${x.p.title}|${x.r.label}` === sel) : undefined;
  const selBlock = selRow?.r.title ? list.find((b) => b.title.toUpperCase() === selRow.r.title!.toUpperCase()) : undefined;
  const pick = (id: string) => {
    setSd(id);
    setSel(null);
  };

  return (
    <div className="sd-guide">
      <div className="sd-guide-bar">
        <div className="chips">
          {pages.map((p) => (
            <button key={p.id} type="button" className={`jb-chip ${sd === p.id ? 'on' : ''}`} aria-pressed={sd === p.id} onClick={() => pick(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn small" onClick={onClose}>
          닫기
        </button>
      </div>

      {guide === null && <p className="small c-caution">회사 기준 파일에 SD 한계(sdGuide)가 없습니다 — 새 company-rules.json을 Settings → 매뉴얼 → 가져오기. 아래 FCOM 원문 문장은 볼 수 있음</p>}
      {guide && !panels.length && <p className="small muted">이 페이지는 FCOM 글에 한계 숫자가 거의 없습니다 — 아래 원문·📖 원본 쪽(그림)으로 확인</p>}
      {panels.length > 0 && (
        <div className="ecam">
          {panels.map((p) => (
            <Panel key={p.title} p={p} sel={sel} onSel={(k) => setSel(sel === k ? null : k)} />
          ))}
          <div className="ec-legend">
            <span className="ec-g">초록 정상</span> <span className="ec-a">AMBER</span> <span className="ec-r">RED</span> · 값을 누르면 설명
          </div>
        </div>
      )}

      {selRow && (
        <div className="sd-tip">
          <div className="sd-bt">
            <b>
              {selRow.p.title} · {selRow.r.label}
            </b>
            {doc && selBlock && (
              <button type="button" className="linkish small" onClick={() => openManualPage({ docId: doc.docId, seq: selBlock.seq, mark: selBlock.title })}>
                📖 원본 쪽
              </button>
            )}
          </div>
          {selRow.r.note && <p className="small">{selRow.r.note}</p>}
          {selRow.r.chk && <p className="small c-caution">FCOM 글에 색 낱말이 없어 AMBER·RED 구분은 원본 그림으로 확인 필요</p>}
          {selBlock?.lines.map((l, j) => (
            <div key={j} className={`sd-line sd-${l.kind}`}>
              <span className="sd-k">{KIND[l.kind]}</span>
              <span>
                <Hl t={l.text} />
              </span>
            </div>
          ))}
        </div>
      )}

      <details className="sd-all">
        <summary className="small">FCOM 원문 문장 전체 ({list.length})</summary>
        {doc === undefined && <p className="small muted">FCOM 읽는 중…</p>}
        {doc === null && <p className="small muted">기기에 FCOM 묶음이 없습니다 — Settings → 매뉴얼 → 가져오기</p>}
        {doc && (
          <ul className="sd-blocks">
            {list.map((b, i) => (
              <li key={`${b.seq}-${i}`}>
                <div className="sd-bt">
                  <b>{b.title}</b>
                  <button type="button" className="linkish small" onClick={() => openManualPage({ docId: doc.docId, seq: b.seq, mark: b.title })}>
                    📖 원본 쪽
                  </button>
                </div>
                {b.sub && <div className="small muted sd-sub">{b.sub}</div>}
                {b.lines.map((l, j) => (
                  <div key={j} className={`sd-line sd-${l.kind}`}>
                    <span className="sd-k">{KIND[l.kind]}</span>
                    <span>
                      <Hl t={l.text} />
                    </span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </details>
      <p className="small muted">
        한계 = 회사 기준 파일 sdGuide({guide?.source ?? '없음'}) · 원문 = FCOM {SD_SECTIONS[sd]?.label} Controls and Indicators. 실제 색은 FCOM 그림이 기준 — ECAM·QRH가 우선.
      </p>
    </div>
  );
}
