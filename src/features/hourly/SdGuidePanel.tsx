// SD 페이지 가이드 창 (D-096): Hourly check SD 줄의 [가이드] → 페이지 골라 FCOM 정상 범위·경고 조건 문장 보기 + 📖 원본 쪽
import { useEffect, useState } from 'react';
import { docPages, openManualPage } from '../manual/lookup';
import { listManuals, manualEvents } from '../manual/store';
import { SD_PAGES } from './hourly';
import { extractSd, SD_SECTIONS, type SdBlock, type SdKind } from './sdGuide';

const KIND: Record<SdKind, string> = { normal: '정상', amber: 'AMBER', red: 'RED', advisory: '주의(맥동)', cond: '조건' };

/** 숫자+단위 강조 */
function Hl({ t }: { t: string }) {
  const parts = t.split(/(\d[\d ,.]*\s?(?:PSI|°C|%|QT|V\b|Hz|kVA|KVA|A\b|kg|ft|bar|s\b|mn\b))/i);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <b key={i} className="mono">
            {p}
          </b>
        ) : (
          p
        ),
      )}
    </>
  );
}

export function SdGuide({ initial, onClose }: { initial: string; onClose: () => void }) {
  const [sd, setSd] = useState(initial);
  const [doc, setDoc] = useState<{ docId: string; blocks: Record<string, SdBlock[]> } | null | undefined>(undefined);
  const [n, setN] = useState(0);
  useEffect(() => {
    const re = () => setN((x) => x + 1);
    manualEvents.addEventListener('change', re);
    return () => manualEvents.removeEventListener('change', re);
  }, []);
  useEffect(() => {
    let alive = true;
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
  return (
    <div className="sd-guide">
      <div className="sd-guide-bar">
        <div className="chips">
          {pages.map((p) => (
            <button key={p.id} type="button" className={`jb-chip ${sd === p.id ? 'on' : ''}`} aria-pressed={sd === p.id} onClick={() => setSd(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn small" onClick={onClose}>
          닫기
        </button>
      </div>
      {doc === undefined && <p className="small muted">FCOM 읽는 중…</p>}
      {doc === null && <p className="small muted">기기에 FCOM 묶음이 없습니다 — Settings → 매뉴얼 → 가져오기</p>}
      {doc && !list.length && <p className="small muted">이 페이지의 숫자 조건 문장을 FCOM에서 찾지 못했습니다 — 📖로 원문 확인</p>}
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
      <p className="small muted">
        출처 FCOM {SD_SECTIONS[sd]?.label} Controls and Indicators — 원문 문장 그대로(숫자 있는 것만). 왼쪽 표시는 문장 낱말로 앱이 붙인 분류이고 실제 색(초록·AMBER·RED)은 FCOM 그림이 기준 — 📖 원본 쪽(사진)에서 확인. ECAM·QRH가 우선.
      </p>
    </div>
  );
}
