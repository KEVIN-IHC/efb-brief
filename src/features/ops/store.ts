// 공통 도구 (D-056): 사건 시각 기록 · 연락처 · PA 문안 · 상황 타이머 — 모두 기기 안
// - 사건 기록 = 순항 메모(LogRecord kind 'memo')에 "⏱ HHMMZ 이름 — 내용" 형식 → 기존 동기화 그대로 (시트 칸 변경 없음)
// - 연락처·PA 문안·타이머 = IndexedDB settings (동기화 안 함)
import { useEffect, useState } from 'react';
import { getDB, type LogRecord } from '../../db/schema';
import { saveLog } from '../../sync/outbox';
import { uuid } from '../../lib/uuid';

export const opsEvents = new EventTarget();

async function getKey<T>(key: string, fallback: T): Promise<T> {
  const row = await (await getDB()).get('settings', key);
  return (row?.value as T | undefined) ?? fallback;
}
async function putKey(key: string, value: unknown): Promise<void> {
  await (await getDB()).put('settings', { key, value });
  opsEvents.dispatchEvent(new Event('change'));
}

function useKey<T>(key: string, fallback: T): T {
  const [v, setV] = useState<T>(fallback);
  useEffect(() => {
    const reload = () => void getKey(key, fallback).then(setV);
    reload();
    opsEvents.addEventListener('change', reload);
    return () => opsEvents.removeEventListener('change', reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return v;
}

/* ---------------- 사건 기록 ---------------- */

export const EVENT_MARK = '⏱';

export interface OpsEvent {
  logId: string;
  at: string; // ISO
  label: string;
  text?: string;
  void?: boolean;
}

const hhmmZ = (iso: string) => `${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;

export function eventNote(at: string, label: string, text?: string): string {
  return `${EVENT_MARK} ${hhmmZ(at)} ${label.trim()}${text?.trim() ? ` — ${text.trim()}` : ''}`;
}

/** 메모 중 사건 기록만. 시각은 글의 HHMMZ (저장 시각과 같은 날 기준, 12시간 넘게 미래면 전날) */
export function parseEvents(logs: LogRecord[]): OpsEvent[] {
  const out: OpsEvent[] = [];
  for (const l of logs) {
    if (l.kind !== 'memo' || !l.note.startsWith(EVENT_MARK)) continue;
    const m = /^⏱ (\d{2})(\d{2})Z (.+?)(?: — ([\s\S]*))?$/.exec(l.note);
    if (!m) continue;
    const c = new Date(l.createdAt);
    let t = Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate(), +m[1], +m[2]);
    if (t - c.getTime() > 12 * 3_600_000) t -= 86_400_000;
    out.push({ logId: l.logId, at: new Date(t).toISOString(), label: m[3], text: m[4] });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export async function saveEvent(flightId: string, label: string, text?: string, at = new Date().toISOString()): Promise<void> {
  await saveLog({ flightId, kind: 'memo', note: eventNote(at, label, text) });
}

/* ---------------- 연락처 ---------------- */

export interface Contact {
  id: string;
  name: string;
  value: string; // 전화·SATCOM 단축번호·주파수 등
  note?: string;
}

export const useContacts = () => useKey<Contact[]>('opsContacts', []);
export async function saveContacts(list: Contact[]): Promise<void> {
  await putKey('opsContacts', list);
}
export const newContact = (): Contact => ({ id: uuid(), name: '', value: '' });

/* ---------------- PA 문안 ---------------- */

export interface PaTemplate {
  id: string;
  title: string;
  text: string;
  /** 출처 (예: 회사 기장방송 예문집, 개인 작성) */
  source?: string;
}

export const usePaTemplates = () => useKey<PaTemplate[]>('opsPa', []);
export async function savePaTemplates(list: PaTemplate[]): Promise<void> {
  await putKey('opsPa', list);
}
export const newPa = (): PaTemplate => ({ id: uuid(), title: '', text: '' });

/** {이름} 자리를 값으로. 값이 없으면 [이름?]로 남겨 눈에 띄게 */
export function fillPa(text: string, vars: Record<string, string | undefined>): { text: string; missing: string[] } {
  const missing: string[] = [];
  const out = text.replace(/\{([A-Z_]+)\}/g, (_, k: string) => {
    const v = vars[k];
    if (v) return v;
    missing.push(k);
    return `[${k}?]`;
  });
  return { text: out, missing: [...new Set(missing)] };
}

export const PA_VARS: { key: string; label: string }[] = [
  { key: 'FLT', label: '편명' },
  { key: 'DEP', label: '출발 ICAO' },
  { key: 'ARR', label: '도착 ICAO' },
  { key: 'DEP_NAME', label: '출발 공항 이름' },
  { key: 'ARR_NAME', label: '도착 공항 이름' },
  { key: 'ETA_Z', label: '도착 예정 (UTC)' },
  { key: 'REMAIN', label: '남은 비행시간' },
  { key: 'FLIGHT_TIME', label: '계획 비행시간' },
  { key: 'ARR_TEMP', label: '도착지 기온 (METAR)' },
  { key: 'CRZ_FL', label: '순항 고도' },
];

/* ---------------- 상황 타이머 ---------------- */

export interface TimerState {
  flightId: string;
  cardId: string;
  label: string;
  startAt: string;
  stopAt?: string;
}

export const useTimers = () => useKey<TimerState[]>('opsTimers', []);

export async function startTimer(t: Omit<TimerState, 'stopAt'>): Promise<void> {
  const list = (await getKey<TimerState[]>('opsTimers', [])).filter((x) => !(x.flightId === t.flightId && x.cardId === t.cardId));
  await putKey('opsTimers', [...list, t]);
}
export async function stopTimer(flightId: string, cardId: string, at = new Date().toISOString()): Promise<void> {
  const list = await getKey<TimerState[]>('opsTimers', []);
  await putKey('opsTimers', list.map((x) => (x.flightId === flightId && x.cardId === cardId && !x.stopAt ? { ...x, stopAt: at } : x)));
}
export async function clearTimer(flightId: string, cardId: string): Promise<void> {
  const list = await getKey<TimerState[]>('opsTimers', []);
  await putKey('opsTimers', list.filter((x) => !(x.flightId === flightId && x.cardId === cardId)));
}

export interface TimerMark {
  every?: number;
  at?: number;
  text: string;
}

/** 경과 분과 다음 표시 시점 */
export function timerStatus(startAt: string, marks: TimerMark[], now: number, stopAt?: string) {
  const end = stopAt ? Date.parse(stopAt) : now;
  const elapsed = Math.max(0, Math.floor((end - Date.parse(startAt)) / 60000));
  let next: { min: number; text: string } | undefined;
  for (const m of marks) {
    const cand = m.every ? (Math.floor(elapsed / m.every) + 1) * m.every : m.at !== undefined && m.at > elapsed ? m.at : undefined;
    if (cand !== undefined && (!next || cand < next.min)) next = { min: cand, text: m.text };
  }
  return { elapsed, next, inMin: next ? next.min - elapsed : undefined };
}

/* ---------------- 보고서 초안 ---------------- */

export interface ReportDraft {
  kind: string;
  title: string;
  body: string;
}
export const reportKey = (flightId: string) => `opsReport:${flightId}`;
export const useReportDraft = (flightId: string) => useKey<ReportDraft>(reportKey(flightId), { kind: '', title: '', body: '' });
export async function saveReportDraft(flightId: string, d: ReportDraft): Promise<void> {
  await putKey(reportKey(flightId), d);
}
