// 개발용: OFP PDF → 앱과 동일한 방식으로 텍스트 추출 → 같은 폴더에 .txt 저장
// 사용: npx vite-node tools/extract-ofp.ts private/samples/*.pdf
// (결과물은 private/ 안에만 둔다 — 커밋 금지)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { itemsToLines, PAGE_MARK, type TextItemLite } from '../src/features/ofp/pdfText';

const require = createRequire(import.meta.url);

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  for (const path of process.argv.slice(2)) {
    const data = new Uint8Array(readFileSync(path));
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    const out: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items: TextItemLite[] = [];
      for (const it of tc.items) {
        if (!('str' in it)) continue;
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) });
      }
      out.push(PAGE_MARK(p), ...itemsToLines(items));
    }
    const txt = path.replace(/\.pdf$/i, '.txt');
    writeFileSync(txt, out.join('\n'));
    console.log(`${path} → ${txt} (${doc.numPages}p, ${out.length} lines)`);
    await doc.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
