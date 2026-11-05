// 웨이포인트 실제값 저장·조회. 기록은 수정하지 않고 항상 새 기록을 추가 (최신이 유효) → 오프라인·동기화 안전
import { useCallback, useEffect, useState } from 'react';
import { getDB, type LogRecord } from '../../db/schema';
import { outboxEvents, saveLog } from '../../sync/outbox';
import type { MassUnit, OfpWaypoint } from '../ofp/types';
import type { Actual } from './deviation';

/** 지점(seq)별 최신 기록. 취소 기록이 최신이면 제외 */
export function latestActuals(logs: LogRecord[]): Map<number, Actual> {
  const bySeq = new Map<number, LogRecord>();
  for (const l of [...logs].filter((x) => x.kind === 'wpt' && x.seq != null).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    bySeq.set(l.seq!, l);
  }
  const out = new Map<number, Actual>();
  for (const [seq, l] of bySeq) {
    if (l.void || !l.ata) continue;
    out.set(seq, { seq, ata: l.ata, fuel: l.fuel ?? null, logId: l.logId, createdAt: l.createdAt });
  }
  return out;
}

export function useFlightLogs(flightId: string) {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const reload = useCallback(async () => {
    const db = await getDB();
    setLogs(await db.getAllFromIndex('logs', 'byFlight', flightId));
  }, [flightId]);
  useEffect(() => {
    void reload();
    outboxEvents.addEventListener('change', reload);
    return () => outboxEvents.removeEventListener('change', reload);
  }, [reload]);
  return logs;
}

export function saveWaypointActual(args: { flightId: string; w: OfpWaypoint; ata: string; fuel: number | null; unit: MassUnit }) {
  return saveLog({
    flightId: args.flightId,
    kind: 'wpt',
    wpt: args.w.name,
    seq: args.w.seq,
    ata: args.ata,
    ...(args.fuel != null && { fuel: args.fuel }),
    unit: args.unit,
    note: '',
  });
}

export function voidWaypointActual(args: { flightId: string; w: OfpWaypoint }) {
  return saveLog({ flightId: args.flightId, kind: 'wpt', wpt: args.w.name, seq: args.w.seq, void: true, note: 'VOID' });
}
