// Outbox 동기화 (SPEC §7.2)
// 1) saveLog: logs + outbox(pending)를 같은 트랜잭션에 기록 → 둘 중 하나만 남는 일이 없다
// 2) flushOutbox: 대기 항목을 Apps Script로 전송. logId가 멱등성 키 → 재전송해도 시트엔 1회만 저장
// 3) 실패 시 지수 백오프, 5회 이상 실패하면 status=failed (UI 표시, 재시도는 계속)
import { getDB, type FlightRecord, type LogRecord, type OutboxItem } from '../db/schema';
import { getGasConfig, setSetting } from '../db/settings';
import { isOnline } from '../lib/time';
import { uuid } from '../lib/uuid';
import { NetworkError, upsertLogs } from './gasClient';

export const FAIL_THRESHOLD = 5;
const MAX_BATCH = 50;
const MAX_BATCHES_PER_FLUSH = 10;
const SENT_RETENTION_MS = 7 * 24 * 3600 * 1000;

/** outbox 변경 알림 (UI 카운터 갱신용) */
export const outboxEvents = new EventTarget();
const notify = () => outboxEvents.dispatchEvent(new Event('change'));

export function backoffMs(retries: number): number {
  // 30s, 1m, 2m, 4m, 8m ... 최대 30m
  return Math.min(30_000 * 2 ** Math.max(0, retries - 1), 30 * 60_000);
}

export async function saveLog(input: Omit<LogRecord, 'logId' | 'createdAt'>): Promise<LogRecord> {
  const db = await getDB();
  const now = new Date().toISOString();
  const rec: LogRecord = { ...input, logId: uuid(), createdAt: now };
  const item: OutboxItem = {
    opId: uuid(),
    target: 'gas',
    op: 'upsertLog',
    payload: rec,
    status: 'pending',
    retries: 0,
    nextAttemptAt: 0,
    createdAt: now,
  };
  const tx = db.transaction(['logs', 'outbox'], 'readwrite');
  await Promise.all([tx.objectStore('logs').add(rec), tx.objectStore('outbox').add(item), tx.done]);
  notify();
  return rec;
}

export type FlushStatus = 'ok' | 'idle' | 'offline' | 'unconfigured' | 'error' | 'partial';

export interface FlushResult {
  status: FlushStatus;
  sent: number;
  failed: number;
  error?: string;
}

let inflight: Promise<FlushResult> | null = null;

/** 동시에 여러 트리거가 와도 한 번만 실행 */
export function flushOutbox(opts: { force?: boolean } = {}): Promise<FlushResult> {
  if (!inflight) inflight = doFlush(!!opts.force).finally(() => (inflight = null));
  return inflight;
}

/** 연결 없음은 실패 횟수에 세지 않고 30초 뒤 다시 (D-042) */
export const NETWORK_RETRY_MS = 30_000;

async function markNetworkWait(items: OutboxItem[], error: string) {
  const db = await getDB();
  const tx = db.transaction('outbox', 'readwrite');
  const next = Date.now() + NETWORK_RETRY_MS;
  for (const it of items) await tx.store.put({ ...it, lastError: error, nextAttemptAt: next });
  await tx.done;
}

async function markFailure(items: OutboxItem[], error: string) {
  const db = await getDB();
  const tx = db.transaction('outbox', 'readwrite');
  const now = Date.now();
  for (const it of items) {
    const retries = it.retries + 1;
    await tx.store.put({
      ...it,
      retries,
      lastError: error,
      status: retries >= FAIL_THRESHOLD ? 'failed' : 'pending',
      nextAttemptAt: now + backoffMs(retries),
    });
  }
  await tx.done;
}

async function doFlush(force: boolean): Promise<FlushResult> {
  const result: FlushResult = { status: 'idle', sent: 0, failed: 0 };
  if (!isOnline()) return { ...result, status: 'offline' };
  const cfg = await getGasConfig();
  if (!cfg) return { ...result, status: 'unconfigured' };
  const db = await getDB();

  try {
    for (let batchNo = 0; batchNo < MAX_BATCHES_PER_FLUSH; batchNo++) {
      const now = Date.now();
      const [pending, failed] = await Promise.all([
        db.getAllFromIndex('outbox', 'byStatus', 'pending'),
        db.getAllFromIndex('outbox', 'byStatus', 'failed'),
      ]);
      const due = [...pending, ...failed]
        .filter((i) => force || i.nextAttemptAt <= now)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .slice(0, MAX_BATCH);
      if (due.length === 0) break;

      const flightIds = [...new Set(due.map((i) => i.payload.flightId))];
      const flights = (await Promise.all(flightIds.map((id) => db.get('flights', id)))).filter(
        (f): f is FlightRecord => !!f,
      );

      let resp;
      try {
        resp = await upsertLogs(cfg, due.map((i) => i.payload), flights);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (e instanceof NetworkError) {
          await markNetworkWait(due, msg);
          result.status = 'offline';
          result.error = msg;
          break;
        }
        await markFailure(due, msg);
        result.failed += due.length;
        result.error = msg;
        break; // 네트워크/서버 오류 → 이번 flush 중단
      }

      const byId = new Map(resp.results.map((r) => [r.logId, r]));
      const ok: OutboxItem[] = [];
      const bad: OutboxItem[] = [];
      for (const it of due) {
        const r = byId.get(it.payload.logId);
        (r && r.status !== 'error' ? ok : bad).push(it);
      }
      const sentAt = new Date().toISOString();
      const tx = db.transaction('outbox', 'readwrite');
      for (const it of ok) await tx.store.put({ ...it, status: 'sent', sentAt, lastError: undefined });
      await tx.done;
      if (bad.length) {
        const firstErr = byId.get(bad[0].payload.logId)?.error ?? 'no result from server';
        await markFailure(bad, firstErr);
        result.error = firstErr;
      }
      result.sent += ok.length;
      result.failed += bad.length;
      await setSetting('lastSyncAt', sentAt);
      if (bad.length) break; // 같은 항목을 이번 flush에서 다시 시도하지 않도록
    }
  } finally {
    notify();
  }

  if (result.status === 'offline' && !result.sent && !result.failed) return result; // 연결 없음 → 다음 점검 때 자동 재시도
  result.status = result.failed ? (result.sent ? 'partial' : 'error') : result.sent ? 'ok' : 'idle';
  return result;
}

export interface OutboxCounts {
  pending: number; // 미전송 전체 (pending + failed)
  failed: number;
}

export async function getOutboxCounts(): Promise<OutboxCounts> {
  const db = await getDB();
  const [p, f] = await Promise.all([
    db.countFromIndex('outbox', 'byStatus', 'pending'),
    db.countFromIndex('outbox', 'byStatus', 'failed'),
  ]);
  return { pending: p + f, failed: f };
}

/** logId → outbox 상태 */
export async function getLogSyncStatus(): Promise<Map<string, OutboxItem>> {
  const all = await (await getDB()).getAll('outbox');
  return new Map(all.map((i) => [i.payload.logId, i]));
}

export async function getUnsentItems(): Promise<OutboxItem[]> {
  const db = await getDB();
  const [p, f] = await Promise.all([
    db.getAllFromIndex('outbox', 'byStatus', 'pending'),
    db.getAllFromIndex('outbox', 'byStatus', 'failed'),
  ]);
  return [...f, ...p];
}

/** 전송 완료 후 7일 지난 outbox 항목 정리 (logs 자체는 유지) */
export async function pruneSent(now = Date.now()): Promise<number> {
  const db = await getDB();
  const sent = await db.getAllFromIndex('outbox', 'byStatus', 'sent');
  const old = sent.filter((i) => i.sentAt && now - Date.parse(i.sentAt) > SENT_RETENTION_MS);
  if (!old.length) return 0;
  const tx = db.transaction('outbox', 'readwrite');
  for (const i of old) await tx.store.delete(i.opId);
  await tx.done;
  return old.length;
}
