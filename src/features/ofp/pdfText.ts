// PDF → 텍스트 (기기 안에서만 처리, 네트워크 사용 안 함 → 오프라인 동작)
// OFP는 고정폭 표가 대부분이라 글자 x좌표로 열 위치를 복원한다.

export interface TextItemLite {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)];
};

/** 한 페이지의 텍스트 조각들을 줄 문자열로 복원 */
export function itemsToLines(items: TextItemLite[]): string[] {
  const its = items.filter((i) => i.str.length > 0 && Number.isFinite(i.x) && Number.isFinite(i.y));
  if (!its.length) return [];
  const charW = median(its.filter((i) => i.w > 0 && i.str.trim()).map((i) => i.w / i.str.length)) || 5;
  const tol = Math.max(1, median(its.map((i) => i.h)) * 0.4);
  const minX = Math.min(...its.map((i) => i.x));

  // y 내림차순 (PDF 좌표는 아래가 0) → 같은 줄 묶기
  const sorted = [...its].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextItemLite[][] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - it.y) <= tol) row.push(it);
    else rows.push([it]);
  }

  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let line = '';
    for (const it of row) {
      const col = Math.round((it.x - minX) / charW);
      if (col > line.length) line += ' '.repeat(col - line.length);
      else if (line.length && !line.endsWith(' ') && !it.str.startsWith(' ')) line += ' ';
      line += it.str;
    }
    return line.replace(/\s+$/, '');
  });
}

export const PAGE_MARK = (n: number) => `===== PAGE ${n} =====`;

export interface PdfTextResult {
  pageCount: number;
  text: string; // 페이지 구분선 포함
}

/** PDF 파일에서 전체 텍스트 추출. onProgress(완료 페이지, 전체) */
export async function extractPdfText(file: Blob, onProgress?: (done: number, total: number) => void): Promise<PdfTextResult> {
  // 필요할 때만 불러옴 (앱 첫 화면 용량 절약). legacy 빌드 = 구형 iPadOS Safari 호환 polyfill 포함
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const out: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items: TextItemLite[] = [];
      for (const it of tc.items) {
        if (!('str' in it)) continue;
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) });
      }
      out.push(PAGE_MARK(p), ...itemsToLines(items));
      page.cleanup();
      onProgress?.(p, doc.numPages);
    }
  } finally {
    await doc.destroy();
  }
  return { pageCount: doc.numPages, text: out.join('\n') };
}
