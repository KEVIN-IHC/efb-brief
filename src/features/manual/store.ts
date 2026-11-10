// 매뉴얼 묶음 가져오기·저장·교체·삭제 (D-044). 전부 기기 안(IndexedDB)에서만.
import { getDB } from '../../db/schema';
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
