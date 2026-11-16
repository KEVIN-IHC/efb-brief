// 매뉴얼 묶음 가져오기·저장·교체·삭제 (D-044). 전부 기기 안(IndexedDB)에서만.
import { getDB, type ManualImgIndex } from '../../db/schema';
import { buildManualBundle, validateBundle } from './parse';
import type { ManualBundle, ManualItem, ManualMeta, ManualPage } from './types';

export type StoredManual = ManualMeta & { importedAt: string };

export const manualEvents = new EventTarget();

/** 가져온 파일 → 묶음. .efbman.json.gz / .json / 변환된 .md 를 받는다 */
export async function readManualFile(file: File): Promise<ManualBundle> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let text: string;
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 압축 파일을 풀 수 없음 (iOS 16.4 이상 필요)');
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(buf);
  }
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('JSON을 읽을 수 없음 (파일이 잘렸을 수 있음)');
    }
    const err = validateBundle(json);
    if (err) throw new Error(err);
    return json as ManualBundle;
  }
  if (/\.(md|markdown|txt)$/i.test(file.name)) return buildManualBundle(text, file.name);
  throw new Error('매뉴얼 묶음(.efbman.json.gz) 또는 변환된 .md 파일이 아님');
}

export class OlderRevisionError extends Error {
  constructor(
    public incoming: ManualMeta,
    public existing: StoredManual,
  ) {
    super(`이미 더 최신 개정(${existing.issueDate ?? '?'})이 들어 있음 — 가져오려는 파일 ${incoming.issueDate ?? '?'}`);
  }
}

/** 같은 docId는 통째로 교체. 더 오래된 개정은 allowOlder 없이는 거절 */
export async function saveManual(b: ManualBundle, opts: { allowOlder?: boolean } = {}): Promise<{ meta: StoredManual; replaced?: StoredManual }> {
  const db = await getDB();
  const docId = b.meta.docId;
  const existing = await db.get('manualDocs', docId);
  if (existing && !opts.allowOlder && (b.meta.issueIso ?? '') < (existing.issueIso ?? '')) throw new OlderRevisionError(b.meta, existing);
  const meta: StoredManual = { ...b.meta, importedAt: new Date().toISOString() };
  const tx = db.transaction(['manualDocs', 'manualPages', 'manualItems'], 'readwrite');
  const pages = tx.objectStore('manualPages');
  const items = tx.objectStore('manualItems');
  await pages.delete(IDBKeyRange.bound([docId, -Infinity], [docId, Infinity]));
  await items.delete(IDBKeyRange.bound([docId, ''], [docId, '￿']));
  for (const p of b.pages) void pages.put({ ...p, docId });
  for (const it of b.items) void items.put({ ...it, docId });
  void tx.objectStore('manualDocs').put(meta);
  await tx.done;
  manualEvents.dispatchEvent(new Event('change'));
  return { meta, replaced: existing };
}

export async function listManuals(): Promise<StoredManual[]> {
  const db = await getDB();
  const all = await db.getAll('manualDocs');
  const order = ['MEL', 'CDL', 'FCOM', 'FCTM', 'QRH', 'FOM', 'OTHER'];
  return all.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.docId.localeCompare(b.docId));
}

export async function deleteManual(docId: string): Promise<void> {
  await deleteManualImages(docId);
  const db = await getDB();
  const tx = db.transaction(['manualDocs', 'manualPages', 'manualItems'], 'readwrite');
  await tx.objectStore('manualPages').delete(IDBKeyRange.bound([docId, -Infinity], [docId, Infinity]));
  await tx.objectStore('manualItems').delete(IDBKeyRange.bound([docId, ''], [docId, '￿']));
  await tx.objectStore('manualDocs').delete(docId);
  await tx.done;
  manualEvents.dispatchEvent(new Event('change'));
}

/** MEL·CDL 번호로 항목 찾기 (모든 매뉴얼) — 2단계 OFP 매칭에서 사용 */
export async function findManualItems(itemNo: string): Promise<(ManualItem & { docId: string })[]> {
  const db = await getDB();
  return db.getAllFromIndex('manualItems', 'byItem', itemNo);
}

export async function getManualPage(docId: string, seq: number): Promise<(ManualPage & { docId: string }) | undefined> {
  const db = await getDB();
  return db.get('manualPages', [docId, seq]);
}

// ---------------- 쪽 사진 묶음 (D-076) ----------------
// .efbimg = "EFBIMG1\n" + 머리 길이(4바이트) + 머리 JSON + JPEG들. Mac `npm run manuals -- --images`가 만든다

const IMG_MAGIC = 'EFBIMG1\n';
export const isImagePack = (name: string) => /\.efbimg$/i.test(name);

interface ImgHead {
  format: 'efbimg';
  version: number;
  docId: string;
  issueDate?: string;
  part: number;
  parts: number;
  map: Record<string, number>;
  images: { pdf: number; off: number; len: number; w: number; h: number }[];
}

/** 사진 묶음 한 부분 가져오기. 글 묶음과 개정이 다르면 오류 */
export async function importImagePack(file: File): Promise<{ docId: string; part: number; parts: number; count: number; mb: number }> {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if (new TextDecoder().decode(u8.slice(0, 8)) !== IMG_MAGIC) throw new Error('쪽 사진 묶음(.efbimg) 형식이 아님');
  const hlen = new DataView(buf).getUint32(8);
  let head: ImgHead;
  try {
    head = JSON.parse(new TextDecoder().decode(u8.slice(12, 12 + hlen)));
  } catch {
    throw new Error('사진 묶음 머리를 읽을 수 없음 (파일이 잘렸을 수 있음)');
  }
  if (head.format !== 'efbimg' || !head.docId || !Array.isArray(head.images)) throw new Error('사진 묶음 형식 오류');
  const db = await getDB();
  const doc = await db.get('manualDocs', head.docId);
  if (!doc) throw new Error(`${head.docId} 글 묶음을 먼저 가져오세요`);
  if (head.issueDate && doc.issueDate && head.issueDate !== doc.issueDate) throw new Error(`개정이 다름 — 글 ${doc.issueDate}, 사진 ${head.issueDate}. 같은 때 만든 파일을 쓰세요`);
  const base = 12 + hlen;
  const prev = await db.get('manualImgIndex', head.docId);
  const same = prev && prev.issueDate === head.issueDate && prev.partsTotal === head.parts;
  if (!same) await deleteManualImages(head.docId);
  const tx = db.transaction(['manualImages', 'manualImgIndex'], 'readwrite');
  for (const im of head.images) void tx.objectStore('manualImages').put({ docId: head.docId, pdf: im.pdf, w: im.w, h: im.h, blob: new Blob([buf.slice(base + im.off, base + im.off + im.len)], { type: 'image/jpeg' }) });
  const parts = [...new Set([...(same ? prev!.parts : []), head.part])].sort((a, b) => a - b);
  void tx.objectStore('manualImgIndex').put({
    docId: head.docId,
    issueDate: head.issueDate,
    map: head.map,
    parts,
    partsTotal: head.parts,
    count: (same ? prev!.count : 0) + head.images.length,
    importedAt: new Date().toISOString(),
  });
  await tx.done;
  manualEvents.dispatchEvent(new Event('change'));
  return { docId: head.docId, part: head.part, parts: head.parts, count: head.images.length, mb: Math.round((buf.byteLength / 1048576) * 10) / 10 };
}

export async function deleteManualImages(docId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['manualImages', 'manualImgIndex'], 'readwrite');
  await tx.objectStore('manualImages').delete(IDBKeyRange.bound([docId, -Infinity], [docId, Infinity]));
  await tx.objectStore('manualImgIndex').delete(docId);
  await tx.done;
}

export async function listImageIndexes(): Promise<ManualImgIndex[]> {
  return (await getDB()).getAll('manualImgIndex');
}

/** 이 매뉴얼 쪽들(seq)의 원본 쪽 사진 (그림·표가 있는 쪽만 있음) */
export async function pageImages(docId: string, seqs: number[]): Promise<{ pdf: number; blob: Blob; w: number; h: number }[]> {
  const db = await getDB();
  const idx = await db.get('manualImgIndex', docId);
  if (!idx) return [];
  const doc = await db.get('manualDocs', docId);
  if (doc?.issueDate && idx.issueDate && doc.issueDate !== idx.issueDate) return []; // 글이 새 개정으로 바뀌면 옛 사진은 안 씀
  const pdfs = [...new Set(seqs.map((s) => idx.map[String(s)]).filter((n): n is number => !!n))];
  const out = await Promise.all(pdfs.map((n) => db.get('manualImages', [docId, n])));
  return out.filter((x): x is NonNullable<typeof x> => !!x);
}
