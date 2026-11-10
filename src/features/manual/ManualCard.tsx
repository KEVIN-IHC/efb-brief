// Settings → 매뉴얼: 묶음 가져오기(새 개정은 자동 교체)·목록·삭제 (D-044)
import { useEffect, useRef, useState } from 'react';
import { MANUAL_PARSER_VERSION } from './parse';
import { deleteManual, listManuals, manualEvents, OlderRevisionError, readManualFile, saveManual, type StoredManual } from './store';

const fmtDate = (iso: string) => iso.slice(0, 10);

export function ManualCard() {
  const [docs, setDocs] = useState<StoredManual[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () => void listManuals().then(setDocs).catch(() => setDocs([]));
    load();
    manualEvents.addEventListener('change', load);
    return () => manualEvents.removeEventListener('change', load);
  }, []);

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const out: string[] = [];
    for (const f of Array.from(files)) {
      setBusy(`${f.name} 읽는 중…`);
      try {
        const b = await readManualFile(f);
        setBusy(`${b.meta.docId} 저장 중… (${b.meta.pageCount}쪽)`);
        let r;
        try {
          r = await saveManual(b);
        } catch (e) {
          if (!(e instanceof OlderRevisionError)) throw e;
          if (!confirm(`${b.meta.docId}: ${e.message}\n\n그래도 이 파일로 바꿀까요?`)) {
            out.push(`– ${f.name}: 건너뜀 (더 최신 개정 유지)`);
            continue;
          }
          r = await saveManual(b, { allowOlder: true });
        }
        out.push(
          `✓ ${r.meta.docId} ${r.meta.issueDate ?? ''} — ${r.meta.pageCount}쪽${r.meta.itemCount ? ` · 항목 ${r.meta.itemCount}` : ''}` +
            (r.replaced ? ` (이전 ${r.replaced.issueDate ?? '?'} 교체)` : ''),
        );
      } catch (e) {
        out.push(`✗ ${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(null);
    setLog(out);
    if (ref.current) ref.current.value = '';
  };

  const remove = async (d: StoredManual) => {
    if (!confirm(`${d.docId} (${d.issueDate ?? ''}) 를 이 기기에서 지울까요?\n원본·구글드라이브 파일은 그대로입니다.`)) return;
    await deleteManual(d.docId);
    setLog([`– ${d.docId} 삭제됨`]);
  };

  return (
    <section className="card">
      <div className="card-title">
        <h3>매뉴얼 ({docs.length})</h3>
      </div>
      {docs.length === 0 && <p className="muted small">아직 없음. Mac에서 만든 묶음 파일(.efbman.json.gz)이나 변환된 .md 파일을 가져오세요.</p>}
      <ul className="manual-list">
        {docs.map((d) => (
          <li key={d.docId}>
            <div className="manual-main">
              <b>{d.docId}</b>
              <span className="mono">{d.issueDate ?? '발행일 ?'}</span>
            </div>
            <div className="muted small">
              {d.title} · {d.pageCount}쪽{d.itemCount ? ` · 항목 ${d.itemCount}` : ''} · 가져옴 {fmtDate(d.importedAt)}
              {d.parserVersion !== MANUAL_PARSER_VERSION && <span className="c-warn"> · 이전 변환 규칙({d.parserVersion}) — Mac에서 묶음을 다시 만들어 가져오면 표시가 나아짐</span>}
            </div>
            <button className="btn" onClick={() => void remove(d)} aria-label={`${d.docId} 삭제`}>
              삭제
            </button>
          </li>
        ))}
      </ul>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        onChange={(e) => void importFiles(e.target.files)}
      />
      <div className="row">
        <button className="btn primary" disabled={!!busy} onClick={() => ref.current?.click()}>
          {busy ? '처리 중…' : '매뉴얼 가져오기'}
        </button>
      </div>
      {busy && <p className="small">{busy}</p>}
      {log.map((l, i) => (
        <p key={i} className={`small ${l.startsWith('✗') ? 'c-bad' : ''}`}>
          {l}
        </p>
      ))}
      <p className="muted small">
        같은 매뉴얼의 새 개정을 가져오면 자동으로 교체됩니다. 매뉴얼은 이 기기 안에만 저장되고 외부로 보내지 않습니다. 운항 판단은 승인된 원본 매뉴얼 기준.
      </p>
    </section>
  );
}
