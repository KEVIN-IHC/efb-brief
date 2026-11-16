// "원본 쪽 사진" (D-076): 그림·표가 있는 쪽이면 원본 PDF 쪽 사진을 펼쳐 본다. 사진은 기기 안(IndexedDB)
import { useEffect, useState } from 'react';
import { manualEvents, pageImages } from './store';

export function PageImages({ docId, seqs }: { docId: string; seqs: number[] }) {
  const [imgs, setImgs] = useState<{ pdf: number; url: string; w: number; h: number }[]>([]);
  const [open, setOpen] = useState(false);
  const key = `${docId}:${seqs.join(',')}`;

  useEffect(() => {
    let alive = true;
    let urls: string[] = [];
    const load = () =>
      void pageImages(docId, seqs).then((l) => {
        if (!alive) return;
        urls.forEach(URL.revokeObjectURL);
        const next = l.map((x) => ({ pdf: x.pdf, w: x.w, h: x.h, url: URL.createObjectURL(x.blob) }));
        urls = next.map((x) => x.url);
        setImgs(next);
      });
    load();
    manualEvents.addEventListener('change', load);
    return () => {
      alive = false;
      urls.forEach(URL.revokeObjectURL);
      manualEvents.removeEventListener('change', load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => setOpen(false), [key]);
  if (!imgs.length) return null;
  return (
    <div className="pimg">
      <button className={`btn small ${open ? 'primary' : ''}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        🖼 원본 쪽 사진{imgs.length > 1 ? ` ${imgs.length}장` : ''} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="pimg-list">
          {imgs.map((im) => (
            <figure key={im.pdf}>
              <a href={im.url} target="_blank" rel="noreferrer" title="새 창에서 크게">
                <img src={im.url} width={im.w} height={im.h} alt={`원본 PDF ${im.pdf}쪽`} loading="lazy" />
              </a>
              <figcaption className="small muted">원본 PDF {im.pdf}쪽 · 누르면 새 창에서 크게 (두 손가락으로 확대)</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
