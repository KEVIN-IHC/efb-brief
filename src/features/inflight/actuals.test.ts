import { describe, expect, it } from 'vitest';
import type { LogRecord } from '../../db/schema';
import { latestActuals } from './actuals';

const rec = (p: Partial<LogRecord>): LogRecord => ({ logId: Math.random().toString(), flightId: 'F', kind: 'wpt', note: '', createdAt: '', ...p });

describe('latestActuals', () => {
  it('지점별 최신 기록이 유효, 취소가 최신이면 제외, 메모는 무시', () => {
    const m = latestActuals([
      rec({ seq: 1, ata: '2026-01-01T01:00:00Z', fuel: 100, createdAt: '2026-01-01T01:00:01Z' }),
      rec({ seq: 1, ata: '2026-01-01T01:02:00Z', fuel: 90, createdAt: '2026-01-01T01:05:00Z' }), // 수정
      rec({ seq: 2, ata: '2026-01-01T02:00:00Z', createdAt: '2026-01-01T02:00:01Z' }),
      rec({ seq: 2, void: true, createdAt: '2026-01-01T02:10:00Z' }), // 취소
      rec({ seq: 3, ata: '2026-01-01T03:00:00Z', createdAt: '2026-01-01T03:00:01Z' }),
      rec({ kind: 'memo', note: 'x', createdAt: '2026-01-01T04:00:00Z' }),
    ]);
    expect([...m.keys()].sort()).toEqual([1, 3]);
    expect(m.get(1)).toMatchObject({ ata: '2026-01-01T01:02:00Z', fuel: 90 });
    expect(m.get(3)!.fuel).toBeNull();
  });
});
