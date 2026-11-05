import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetDBForTests, getDB } from '../db/schema';
import { setSetting } from '../db/settings';
import { FAIL_THRESHOLD, flushOutbox, getOutboxCounts, NETWORK_RETRY_MS, pruneSent, saveLog } from './outbox';

// 서버(Apps Script) 흉내: logId 기준 멱등
function fakeServer() {
  const stored = new Map<string, unknown>();
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const results = body.records.map((r: { logId: string }) => {
      if (stored.has(r.logId)) return { logId: r.logId, status: 'duplicate' };
      stored.set(r.logId, r);
      return { logId: r.logId, status: 'inserted' };
    });
    return new Response(JSON.stringify({ ok: true, results }), { status: 200 });
  });
  return { stored, fetchMock };
}

const memo = (note: string) => ({ flightId: 'F1', kind: 'memo' as const, note });

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  _resetDBForTests();
  await setSetting('gasUrl', 'https://example.test/exec');
  await setSetting('gasToken', 't');
  vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => vi.unstubAllGlobals());

describe('outbox', () => {
  it('saveLog은 logs와 outbox에 함께 기록한다', async () => {
    const rec = await saveLog(memo('hello'));
    const db = await getDB();
    expect(await db.get('logs', rec.logId)).toBeTruthy();
    const ob = await db.getAll('outbox');
    expect(ob).toHaveLength(1);
    expect(ob[0]).toMatchObject({ status: 'pending', retries: 0 });
    expect(ob[0].payload.logId).toBe(rec.logId);
  });

  it('오프라인이면 전송하지 않고, 온라인 복귀 후 1회만 저장된다', async () => {
    const { stored, fetchMock } = fakeServer();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { onLine: false });
    await saveLog(memo('a'));
    await saveLog(memo('b'));
    expect((await flushOutbox()).status).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getOutboxCounts()).toEqual({ pending: 2, failed: 0 });

    vi.stubGlobal('navigator', { onLine: true });
    const r = await flushOutbox();
    expect(r).toMatchObject({ status: 'ok', sent: 2 });
    expect(stored.size).toBe(2);
    expect(await getOutboxCounts()).toEqual({ pending: 0, failed: 0 });

    // 다시 flush 해도 보낼 것이 없음
    expect((await flushOutbox()).status).toBe('idle');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('응답 유실 후 재전송돼도 서버는 duplicate로 처리하고 클라이언트는 sent로 마킹', async () => {
    const { stored, fetchMock } = fakeServer();
    // 첫 요청: 서버엔 저장됐지만 응답이 유실됨
    fetchMock.mockImplementationOnce(async (_u, init) => {
      const body = JSON.parse(String(init.body));
      body.records.forEach((r: { logId: string }) => stored.set(r.logId, r));
      throw new TypeError('Load failed');
    });
    vi.stubGlobal('fetch', fetchMock);
    await saveLog(memo('x'));
    expect((await flushOutbox()).status).toBe('offline'); // 응답 없음 = 연결 끊김으로 보고 자동 재시도
    expect(await getOutboxCounts()).toEqual({ pending: 1, failed: 0 });

    const r = await flushOutbox({ force: true });
    expect(r).toMatchObject({ status: 'ok', sent: 1 });
    expect(stored.size).toBe(1);
  });

  it('서버 오류는 백오프로 대기하고, 5회 이상 실패하면 failed', async () => {
    const fetchMock = vi.fn(async () => new Response('busy', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    await saveLog(memo('x'));
    await flushOutbox();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 백오프 중이라 일반 flush는 건너뜀
    expect((await flushOutbox()).status).toBe('idle');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (let i = 1; i < FAIL_THRESHOLD; i++) await flushOutbox({ force: true });
    const [item] = await (await getDB()).getAll('outbox');
    expect(item.retries).toBe(FAIL_THRESHOLD);
    expect(item.status).toBe('failed');
    expect(item.lastError).toBe('HTTP 500');
    expect(await getOutboxCounts()).toEqual({ pending: 1, failed: 1 });
  });

  it('연결 없음(iOS 비행기 모드, onLine=true여도)은 실패로 세지 않고 30초 뒤 자동 재시도 → 복귀 시 1회 저장 (D-042)', async () => {
    const fail = vi.fn(async () => {
      throw new TypeError('Load failed');
    });
    vi.stubGlobal('fetch', fail);
    await saveLog(memo('x'));
    for (let i = 0; i < 8; i++) expect((await flushOutbox({ force: true })).status).toBe('offline');
    const [item] = await (await getDB()).getAll('outbox');
    expect(item.status).toBe('pending');
    expect(item.retries).toBe(0);
    expect(item.nextAttemptAt - Date.now()).toBeLessThanOrEqual(NETWORK_RETRY_MS);
    expect(await getOutboxCounts()).toEqual({ pending: 1, failed: 0 });

    // 연결 복귀: 30초가 지나면 일반 점검(force 아님)으로도 전송
    const { stored, fetchMock } = fakeServer();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + NETWORK_RETRY_MS + 1000);
    const r = await flushOutbox();
    vi.useRealTimers();
    expect(r).toMatchObject({ status: 'ok', sent: 1 });
    expect(stored.size).toBe(1);
    expect(await getOutboxCounts()).toEqual({ pending: 0, failed: 0 });
  });

  it('토큰 오류 등 서버 거부도 실패로 처리', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'unauthorized' }))),
    );
    await saveLog(memo('x'));
    const r = await flushOutbox();
    expect(r).toMatchObject({ status: 'error', error: 'unauthorized' });
  });

  it('설정이 없으면 unconfigured', async () => {
    globalThis.indexedDB = new IDBFactory();
    _resetDBForTests();
    await saveLog(memo('x'));
    expect((await flushOutbox()).status).toBe('unconfigured');
  });

  it('전송 완료 후 7일 지난 outbox 항목 정리', async () => {
    const { fetchMock } = fakeServer();
    vi.stubGlobal('fetch', fetchMock);
    await saveLog(memo('x'));
    await flushOutbox();
    expect(await pruneSent()).toBe(0);
    expect(await pruneSent(Date.now() + 8 * 24 * 3600 * 1000)).toBe(1);
    expect(await (await getDB()).count('logs')).toBe(1);
  });
});
