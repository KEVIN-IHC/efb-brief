// 얼러트 확인(Acknowledge)·이력 저장 (D-046). 기기 안에만, 동기화하지 않음
import { getDB, type AlertRecord } from '../../db/schema';
import type { Alert } from './types';

export const alertEvents = new EventTarget();

/** 처음 보는 얼러트만 기록 (이미 있으면 그대로 — 처음 뜬 시각·확인 시각 유지) */
export async function recordAlerts(flightId: string, alerts: Alert[], now = new Date()): Promise<number> {
  const db = await getDB();
  const tx = db.transaction('alerts', 'readwrite');
  let added = 0;
  for (const a of alerts) {
    const ex = await tx.store.get([flightId, a.id]);
    if (ex) continue;
    await tx.store.put({ flightId, id: a.id, ruleId: a.ruleId, severity: a.severity, title: a.title, detail: a.detail, firstSeenAt: now.toISOString() });
    added++;
  }
  await tx.done;
  if (added) alertEvents.dispatchEvent(new Event('change'));
  return added;
}

export async function ackAlerts(flightId: string, ids: string[], now = new Date()): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('alerts', 'readwrite');
  for (const id of ids) {
    const r = await tx.store.get([flightId, id]);
    if (r && !r.ackAt) await tx.store.put({ ...r, ackAt: now.toISOString() });
  }
  await tx.done;
  alertEvents.dispatchEvent(new Event('change'));
}

export async function alertHistory(flightId: string): Promise<AlertRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('alerts', 'byFlight', flightId);
  return all.sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
}
