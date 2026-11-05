// 현재 비행(active flight) — 업로드한 OFP가 앱 전체(대시보드·OFP·순항기록·동기화)의 기준이 된다.
// 없으면 DEMO 비행으로 동작.
import { create } from 'zustand';
import { getDB, type FlightRecord } from '../../db/schema';
import { getSetting, setSetting } from '../../db/settings';
import { DEMO_FLIGHT } from '../../mock/demoFlight';
import { AVIATOR_PARSER_VERSION, parseAviatorOfp } from '../ofp/parser';
import type { OfpData, OfpRecord } from '../ofp/types';
import { notifyOfpChanged, ofpEvents } from '../ofp/useOfp';

interface ActiveState {
  loaded: boolean;
  flight: FlightRecord;
  ofp: OfpRecord | null;
  isDemo: boolean;
}

export const useActiveFlight = create<ActiveState>(() => ({ loaded: false, flight: DEMO_FLIGHT, ofp: null, isDemo: true }));

/** 같은 비행(편명·날짜·구간)을 다시 올리면 OFP만 교체되고 순항 기록은 유지 */
export const flightIdFor = (o: OfpData) => `${o.header.flightNo}-${o.header.date}-${o.header.dep}-${o.header.arr}`;

export function flightFromOfp(o: OfpData): FlightRecord {
  return {
    flightId: flightIdFor(o),
    flightNo: o.header.flightNo,
    dep: o.header.dep,
    arr: o.header.arr,
    std: o.header.std,
    sta: o.header.sta,
    acType: o.header.acType,
    reg: o.header.reg,
    status: 'planned',
  };
}

export async function loadActiveFlight(): Promise<void> {
  const db = await getDB();
  const id = (await getSetting('activeFlightId')) ?? DEMO_FLIGHT.flightId;
  const flight = (await db.get('flights', id)) ?? DEMO_FLIGHT;
  const ofp = (await db.get('ofp', flight.flightId)) ?? null;
  useActiveFlight.setState({ loaded: true, flight, ofp, isDemo: !!flight.demo });
}

export async function setActiveFlight(flightId: string): Promise<void> {
  await setSetting('activeFlightId', flightId);
  await loadActiveFlight();
}

/** 추출된 원문 → 파싱 → 저장. 완전히 추출되면 비행으로 등록하고 현재 비행으로 설정 */
export async function importOfpText(args: { fileName: string; pageCount: number; rawText: string }): Promise<{ rec: OfpRecord; activated: boolean }> {
  const db = await getDB();
  const r = parseAviatorOfp(args.rawText);
  const now = new Date().toISOString();
  if (r.ofp) {
    const rec: OfpRecord = { flightId: flightIdFor(r.ofp), source: 'pdf', ...args, parsed: r.ofp, parserVersion: AVIATOR_PARSER_VERSION, createdAt: now };
    const tx = db.transaction(['ofp', 'flights', 'route'], 'readwrite');
    await Promise.all([
      tx.objectStore('ofp').put(rec),
      tx.objectStore('flights').put(flightFromOfp(r.ofp)),
      tx.objectStore('route').put({ flightId: rec.flightId, waypoints: r.ofp.route }),
      tx.done,
    ]);
    await setActiveFlight(rec.flightId);
    notifyOfpChanged();
    return { rec, activated: true };
  }
  // 추출 불완전 → 원문만 보관 (조용히 데모로 대체하지 않음)
  const rec: OfpRecord = { flightId: `upload-${now}`, source: 'pdf', ...args, parserVersion: AVIATOR_PARSER_VERSION, createdAt: now };
  await db.put('ofp', rec);
  notifyOfpChanged();
  return { rec, activated: false };
}

/** 파서가 개선되면 저장된 원문으로 다시 파싱 (앱 시작 시) */
export async function reparseStale(): Promise<number> {
  const db = await getDB();
  const stale = (await db.getAll('ofp')).filter((r) => r.source === 'pdf' && r.rawText && r.parserVersion !== AVIATOR_PARSER_VERSION);
  for (const old of stale) {
    const r = parseAviatorOfp(old.rawText!);
    // 예전 원문만 저장된 기록(upload-…)도 이제 추출되면 정식 비행 ID로 옮김
    const flightId = r.ofp ? flightIdFor(r.ofp) : old.flightId;
    const upd: OfpRecord = { ...old, flightId, parsed: r.ofp ?? old.parsed, parserVersion: AVIATOR_PARSER_VERSION };
    if (flightId !== old.flightId) await db.delete('ofp', old.flightId);
    await db.put('ofp', upd);
    if (r.ofp) {
      await db.put('route', { flightId, waypoints: r.ofp.route });
      await db.put('flights', flightFromOfp(r.ofp));
    }
  }
  return stale.length;
}

/** 이 기기에서 OFP 삭제 (순항 기록은 남김). 현재 비행이면 데모로 돌아감 */
export async function deleteOfp(flightId: string): Promise<void> {
  const db = await getDB();
  await db.delete('ofp', flightId);
  await db.delete('route', flightId);
  if ((await getSetting('activeFlightId')) === flightId) await setSetting('activeFlightId', DEMO_FLIGHT.flightId);
  await loadActiveFlight();
  notifyOfpChanged();
}

ofpEvents.addEventListener('change', () => void loadActiveFlight());
