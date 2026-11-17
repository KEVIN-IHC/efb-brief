// 맨 위 줄 "기상 갱신" 결과 문구: 일부 자료가 실패하면 "완료"가 아니라 실패 종류를 알린다
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/time', async (orig) => ({ ...(await orig<object>()), isOnline: () => true }));
vi.mock('./store', async () => {
  const { create } = await import('zustand');
  return { useWx: create(() => ({ errors: {} as Record<string, string | undefined> })), refreshDue: vi.fn(async () => {}) };
});
vi.mock('./extra', async () => {
  const { create } = await import('zustand');
  return { useWxExtra: create(() => ({ errors: {} as Record<string, string | undefined> })), refreshExtra: vi.fn(async () => {}) };
});

const { refreshAllWx, useWxActions } = await import('./actions');
const { useWx } = await import('./store');
const { useWxExtra } = await import('./extra');

describe('refreshAllWx 결과 문구', () => {
  beforeEach(() => {
    useWx.setState({ errors: {} });
    useWxExtra.setState({ errors: {} });
  });
  it('모두 성공 → 완료', async () => {
    await refreshAllWx();
    expect(useWxActions.getState().msg).toMatchObject({ tone: 'ok' });
    expect(useWxActions.getState().msg?.text).toMatch(/^기상 갱신 완료/);
  });
  it('일부 실패 → 실패 종류 표시', async () => {
    useWx.setState({ errors: { metar: undefined, sigmet: 'HTTP 500' } });
    useWxExtra.setState({ errors: { pirep: 'HTTP 404' } });
    await refreshAllWx();
    const m = useWxActions.getState().msg!;
    expect(m.tone).toBe('bad');
    expect(m.text).toMatch(/일부 실패: SIGMET, PIREP/);
  });
});
