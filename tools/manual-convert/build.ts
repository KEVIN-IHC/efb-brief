// 매뉴얼 넣기 도구 (D-044) — Mac에서 실행. 결과물은 전부 private/ 안 (커밋 금지, D-028·D-029)
//
//   npm run manuals            # private/manuals/inbox 의 새 PDF·MD 처리
//   npm run manuals -- --force # 묶음 전부 다시 만들기
//   npm run manuals -- --images  # + 그림·표 쪽 사진 묶음 (<docId>-img.efbimg, D-076). 원본 PDF가 inbox에 있는 매뉴얼만
//
// 1) inbox 의 PDF 중 같은 매뉴얼·같은 발행일의 MD가 아직 없는 것만 MD로 변환 → private/manuals/md/
// 2) 같은 매뉴얼(docId)이 여러 개면 발행일이 가장 최근인 것만 사용 (이전 개정은 무시하고 알려 줌)
// 3) 매뉴얼마다 묶음 파일 → private/manuals/out/<docId>.efbman.json.gz
//    이 파일을 구글드라이브에 올리고 아이패드 앱 Settings → 매뉴얼 → 가져오기
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { buildManualBundle, detectMeta, MANUAL_PARSER_VERSION, type TocEntry } from '../../src/features/manual/parse';
import { validateRules } from '../../src/features/brief/rules';

const ROOT = resolve(import.meta.dirname ?? __dirname, '../..');
const BASE = join(ROOT, 'private/manuals');
const INBOX = join(BASE, 'inbox');
const MD_DIR = join(BASE, 'md');
const OUT = join(BASE, 'out');
const PY_SCRIPT = join(ROOT, 'tools/manual-convert/pdf2md.py');
const force = process.argv.includes('--force');
const images = process.argv.includes('--images');
const IMG_SCRIPT = join(ROOT, 'tools/manual-convert/pdf2img.py');

interface Candidate {
  path: string;
  docId: string;
  issueIso?: string;
  issueDate?: string;
  mtime: number;
  pdfPages?: number;
}

function python(): string | null {
  const p = process.env.MANUAL_PYTHON ?? join(BASE, '.venv/bin/python');
  return existsSync(p) ? p : null;
}

const list = (dir: string, ext: RegExp) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => ext.test(f) && !f.startsWith('.')).map((f) => join(dir, f)) : [];

function main() {
  for (const d of [INBOX, MD_DIR, OUT]) mkdirSync(d, { recursive: true });
  const mds: Candidate[] = [...list(INBOX, /\.md$/i), ...list(MD_DIR, /\.md$/i)].map((path) => {
    const head = readFileSync(path, 'utf8').slice(0, 20000);
    const m = detectMeta(head, path);
    return { path, docId: m.docId, issueIso: m.issueIso, issueDate: m.issueDate, mtime: statSync(path).mtimeMs };
  });

  // 1) PDF → MD (필요한 것만)
  const pdfs = list(INBOX, /\.pdf$/i);
  const pdfByDoc = new Map<string, string>();
  const py = python();
  for (const pdf of pdfs) {
    if (!py) {
      console.log(`! PDF 확인 불가 (Python 없음): ${basename(pdf)} — 아래 "변환 준비" 참고`);
      continue;
    }
    const probe = execFileSync(py, [PY_SCRIPT, 'probe', pdf], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const pages = Number(/@@PAGES (\d+)/.exec(probe)?.[1]);
    const m = detectMeta(probe, pdf);
    pdfByDoc.set(m.docId, pdf);
    const have = mds.find((c) => c.docId === m.docId && (c.issueIso ?? '') >= (m.issueIso ?? ''));
    if (have) {
      have.pdfPages ??= pages;
      continue;
    }
    const out = join(MD_DIR, basename(pdf).replace(/\.pdf$/i, '.md'));
    console.log(`… 변환 중 ${basename(pdf)} (${pages}쪽) → md/${basename(out)} — 큰 매뉴얼은 수십 분~몇 시간`);
    const t0 = Date.now();
    const r = spawnSync(py, [PY_SCRIPT, 'convert', pdf, out], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.log(`✗ 변환 실패: ${basename(pdf)}`);
      continue;
    }
    console.log(`✓ 변환 완료 ${Math.round((Date.now() - t0) / 1000)}초`);
    const head = readFileSync(out, 'utf8').slice(0, 20000);
    const mm = detectMeta(head, out);
    mds.push({ path: out, docId: mm.docId, issueIso: mm.issueIso, issueDate: mm.issueDate, mtime: Date.now(), pdfPages: pages });
  }

  // 2) 매뉴얼별 최신 개정만
  const byDoc = new Map<string, Candidate[]>();
  for (const c of mds) byDoc.set(c.docId, [...(byDoc.get(c.docId) ?? []), c]);

  const manifestPath = join(OUT, 'manifest.json');
  const manifest: Record<string, { source: string; issueDate?: string; parserVersion: string; mtime: number }> = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : {};

  console.log('\n매뉴얼 | 발행일 | 쪽(찾음/PDF) | MEL·CDL 항목 | 묶음 크기 | 원본');
  for (const [docId, cs] of [...byDoc].sort()) {
    cs.sort((a, b) => (b.issueIso ?? '').localeCompare(a.issueIso ?? '') || b.mtime - a.mtime);
    const c = cs[0];
    for (const old of cs.slice(1)) console.log(`  (이전 개정 무시: ${basename(old.path)} ${old.issueDate ?? ''})`);
    const outFile = join(OUT, `${docId}.efbman.json.gz`);
    const prev = manifest[docId];
    if (!force && prev && existsSync(outFile) && prev.source === basename(c.path) && prev.parserVersion === MANUAL_PARSER_VERSION && prev.mtime === c.mtime) {
      console.log(`${docId} | ${c.issueDate ?? '?'} | (변경 없음 — 그대로) | | | ${basename(c.path)}`);
      continue;
    }
    // marker 변환이면 옆의 <이름>_meta.json 목차로 제목별 PDF 쪽 번호를 채운다 (없어도 됨)
    const metaJson = c.path.replace(/\.md$/i, '_meta.json');
    // Jeppesen(D-101): 목차 파일이 없으면 inbox 원본 PDF 목차로 만든다 (쪽 제목·왼쪽 목차에 필요)
    const jpdf = pdfByDoc.get(docId);
    if (docId.startsWith('JEPP-') && jpdf && py && (!existsSync(metaJson) || statSync(metaJson).mtimeMs < statSync(jpdf).mtimeMs)) {
      execFileSync(py, [PY_SCRIPT, 'toc', jpdf, metaJson]);
      console.log(`  (${docId} PDF 목차 → ${basename(metaJson)})`);
    }
    const toc = existsSync(metaJson) ? (JSON.parse(readFileSync(metaJson, 'utf8')).table_of_contents as TocEntry[] | undefined) : undefined;
    const b = buildManualBundle(readFileSync(c.path, 'utf8'), c.path, new Date(), { toc });
    const gz = gzipSync(JSON.stringify(b), { level: 9 });
    writeFileSync(outFile, gz);
    manifest[docId] = { source: basename(c.path), issueDate: c.issueDate, parserVersion: MANUAL_PARSER_VERSION, mtime: c.mtime };
    const subs = b.items.filter((i) => i.parent);
    const itemsTxt =
      b.meta.kind === 'MEL'
        ? `${subs.length} (등급 없음 ${subs.filter((i) => !i.repairInterval).length}, 제목 없음 ${subs.filter((i) => !i.title).length})`
        : b.meta.splitMode === 'section'
          ? `절 단위 ${b.pages.length} (PDF 쪽 표시 ${b.pages.filter((p) => p.pdfPage).length}${toc ? ', 목차 json 사용' : ''})`
          : b.items.length || '-';
    console.log(
      `${docId} | ${b.meta.issueDate ?? '?'} | ${b.meta.pageCount}/${c.pdfPages ?? '?'} | ${itemsTxt} | ${(gz.length / 1048576).toFixed(1)} MB | ${basename(c.path)}`,
    );
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // 그림·표 쪽 사진 묶음 (D-076) — 원본 PDF가 있는 매뉴얼만. 글 묶음·PDF보다 새 사진 묶음이 있으면 건너뜀(--force면 다시)
  if (images) {
    const py2 = python();
    console.log('\n사진 묶음 | 매뉴얼 쪽 연결 | 사진 쪽 | 크기 | 파일');
    for (const [docId, pdf] of [...pdfByDoc].sort()) {
      const bundle = join(OUT, `${docId}.efbman.json.gz`);
      if (!py2 || !existsSync(bundle)) {
        console.log(`${docId} | (건너뜀: ${py2 ? '글 묶음 없음' : 'Python 없음'})`);
        continue;
      }
      const olds = readdirSync(OUT).filter((f) => f.startsWith(`${docId}-img`) && f.endsWith('.efbimg'));
      const newest = Math.max(statSync(bundle).mtimeMs, statSync(pdf).mtimeMs);
      if (!force && olds.length && olds.every((f) => statSync(join(OUT, f)).mtimeMs > newest)) {
        console.log(`${docId} | (변경 없음 — 그대로) | | | ${olds.join(', ')}`);
        continue;
      }
      for (const f of olds) rmSync(join(OUT, f));
      console.log(`… ${docId} 사진 만드는 중 (큰 매뉴얼은 수 분)`);
      const r = spawnSync(py2, ['-W', 'ignore', IMG_SCRIPT, pdf, bundle, join(OUT, `${docId}-img`), ...(/-MEL$/.test(docId) ? ['--raster-only'] : [])], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      if (r.status !== 0) {
        console.log(`✗ ${docId} 사진 실패: ${(r.stderr || '').slice(-300)}`);
        continue;
      }
      const j = JSON.parse(r.stdout.trim().split('\n').pop()!);
      console.log(`${docId} | ${j.mapped}/${j.pages} | ${j.images} | ${j.mb} MB | ${j.files.map((f: string) => basename(f)).join(', ')} (${j.sec}초)`);
    }
    if (!pdfByDoc.size) console.log('(inbox에 원본 PDF가 없음 — 사진 묶음은 PDF가 있어야 만들 수 있음)');
  }
  // 회사 기준 파일 (D-049): private/manuals/company-rules.json → 점검 후 out/ 에 같이 둔다
  const rulesSrc = join(BASE, 'company-rules.json');
  if (existsSync(rulesSrc)) {
    const txt = readFileSync(rulesSrc, 'utf8');
    const err = validateRules(JSON.parse(txt));
    if (err) console.log(`\n회사 기준 파일 오류: ${err} — out/ 에 복사하지 않음`);
    else {
      writeFileSync(join(OUT, 'company-rules.json'), txt);
      console.log('\n회사 기준 파일 점검 통과 → out/company-rules.json');
    }
  }
  console.log(`\n묶음 폴더: ${OUT}\n→ 바뀐 .efbman.json.gz 파일만 구글드라이브에 올리고, 아이패드 앱 Settings → 매뉴얼 → 가져오기`);
  if (!py && pdfs.length)
    console.log(
      '\n[변환 준비] PDF를 직접 넣으려면 한 번만:\n  python3 -m venv private/manuals/.venv\n  private/manuals/.venv/bin/pip install pymupdf4llm pymupdf-layout\n(또는 MANUAL_PYTHON=<pymupdf4llm 이 설치된 python 경로>)',
    );
}

main();
