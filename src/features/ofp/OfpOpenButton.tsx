// "OFP 열기" — 어느 화면에서든 회사 OFP PDF를 골라 바로 분석·현재 비행으로 설정
// (iPad: 파일 앱 / 메일 첨부 / AirDrop으로 받은 PDF를 '파일'에서 선택)
import { create } from 'zustand';
import { useEffect, useRef, useState } from 'react';
import { useWxActions } from '../weather/actions';
import { importOfpText } from '../flight/activeFlight';
import { extractPdfText } from './pdfText';

interface ImportState {
  busy: string | null;
  msg: { text: string; tone: 'ok' | 'bad' } | null;
  lastId: string | null;
}
export const useOfpImport = create<ImportState>(() => ({ busy: null, msg: null, lastId: null }));

export async function importOfpFile(file: File): Promise<void> {
  const set = useOfpImport.setState;
  set({ msg: null, busy: 'PDF 여는 중…' });
  try {
    const res = await extractPdfText(file, (d, t) => set({ busy: `읽는 중… ${d}/${t} 페이지` }));
    set({ busy: 'OFP 분석 중…' });
    const { rec, activated } = await importOfpText({ fileName: file.name, pageCount: res.pageCount, rawText: res.text });
    const h = rec.parsed?.header;
    set({
      lastId: rec.flightId,
      msg: activated
        ? { text: `✓ ${h!.flightNo} ${h!.dep}→${h!.arr} (${h!.date}) 열림`, tone: 'ok' }
        : { text: '일부 항목을 읽지 못했습니다. OFP PDF 탭에서 결과를 확인하세요.', tone: 'bad' },
    });
    location.hash = 'ofp';
  } catch (e) {
    set({ msg: { text: `열기 실패: ${e instanceof Error ? e.message : String(e)}`, tone: 'bad' } });
  } finally {
    set({ busy: null });
  }
}

const FileIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M12 17v-6M9 14l3-3 3 3" />
  </svg>
);

/** 앱 전체에 하나 — 맨 위 상태 줄 (D-061). compact = 좁은 화면에서 글자 줄임 */
export function OfpOpenButton({ variant = 'primary', label = 'OFP 열기', showStatus = true, compact = false }: { variant?: 'primary' | 'plain'; label?: string; showStatus?: boolean; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const { busy, msg } = useOfpImport();
  return (
    <span className="ofp-open">
      <input
        ref={ref}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importOfpFile(f);
          e.target.value = '';
        }}
      />
      <button className={`btn ${variant === 'primary' ? 'primary' : ''} btn-icon ${compact ? 'ofp-top' : ''}`} disabled={!!busy} onClick={() => ref.current?.click()} aria-label={label}>
        {FileIcon}
        {compact ? (
          <span className="ofp-top-label">{busy ? '…' : <>OFP<span className="xs-hide"> 열기</span></>}</span>
        ) : (
          <span>{busy ?? label}</span>
        )}
      </button>
      {showStatus && msg && !busy && <span className={`small ${msg.tone === 'ok' ? 'c-ok' : 'c-bad'}`}>{msg.text}</span>}
    </span>
  );
}

/** 맨 위 줄 아래 한 줄: 여는 중·실패 안내 (성공은 OFP 화면에서 보임) */
export function OfpImportLine() {
  const { busy, msg } = useOfpImport();
  const wx = useWxActions();
  const [, tick] = useState(0);
  // 기상 갱신·저장 결과는 6초 동안만
  useEffect(() => {
    if (!wx.msg) return;
    const id = setTimeout(() => tick((n) => n + 1), 6000);
    return () => clearTimeout(id);
  }, [wx.msg]);
  if (busy) return <p className="small muted ofp-import-line">{busy}</p>;
  if (msg?.tone === 'bad') return <p className="small c-bad ofp-import-line">{msg.text}</p>;
  if (wx.saving) return <p className="small muted ofp-import-line">오프라인 저장 중… {wx.prog ? `위성 ${wx.prog.done}/${wx.prog.total} · ${(wx.prog.bytes / 1048576).toFixed(1)} MB` : '기상 받는 중'}</p>;
  if (wx.refreshing) return <p className="small muted ofp-import-line">기상 받는 중…</p>;
  if (wx.msg && Date.now() - wx.msg.at < 6000) return <p className={`small ofp-import-line ${wx.msg.tone === 'ok' ? 'c-ok' : 'c-bad'}`}>{wx.msg.text}</p>;
  return null;
}
