// "OFP 열기" — 어느 화면에서든 회사 OFP PDF를 골라 바로 분석·현재 비행으로 설정
// (iPad: 파일 앱 / 메일 첨부 / AirDrop으로 받은 PDF를 '파일'에서 선택)
import { create } from 'zustand';
import { useRef } from 'react';
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
        : { text: '일부 항목을 읽지 못했습니다. OFP › PDF·추출에서 결과를 확인하세요.', tone: 'bad' },
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

export function OfpOpenButton({ variant = 'primary', label = 'OFP 열기', showStatus = true }: { variant?: 'primary' | 'plain'; label?: string; showStatus?: boolean }) {
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
      <button className={`btn ${variant === 'primary' ? 'primary' : ''} btn-icon`} disabled={!!busy} onClick={() => ref.current?.click()}>
        {FileIcon}
        <span>{busy ?? label}</span>
      </button>
      {showStatus && msg && !busy && <span className={`small ${msg.tone === 'ok' ? 'c-ok' : 'c-bad'}`}>{msg.text}</span>}
    </span>
  );
}
