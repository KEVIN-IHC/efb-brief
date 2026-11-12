// 개인 FIR 통신표 (D-055): FIR별 CPDLC 로그온·HF·VHF·보고 방식·SATCOM·메모·출처
// 기기 안(IndexedDB settings, 키 firComm)에만 저장. 공개 코드·배포판에는 넣지 않는다 (Jeppesen·회사 자료 저작권, D-049 방식)
// 백업: JSON 파일로 내보내기·가져오기 (형식 efb-fir-comm v1)
import { useEffect, useState } from 'react';
import { getDB } from '../../db/schema';

export interface FirComm {
  cpdlc?: string; // 로그온 코드 (예: KZAK)
  hf?: string; // 주·예비 주파수 / 패밀리
  vhf?: string;
  report?: string; // 위치보고 방식 (CPDLC · ADS-C · 음성)
  satcom?: string;
  note?: string;
  /** 어디서 확인했는지 (예: eAIP ENR 2.1, 2026-10) */
  source?: string;
  updatedAt?: string;
}

export type FirCommTable = Record<string, FirComm>;

export const FIR_COMM_FIELDS: { key: Exclude<keyof FirComm, 'updatedAt'>; label: string; hint: string }[] = [
  { key: 'cpdlc', label: 'CPDLC 로그온', hint: '예: KZAK' },
  { key: 'hf', label: 'HF', hint: '주 / 예비 주파수 또는 패밀리' },
  { key: 'vhf', label: 'VHF', hint: '' },
  { key: 'report', label: '위치보고', hint: 'CPDLC · ADS-C · 음성' },
  { key: 'satcom', label: 'SATCOM', hint: '' },
  { key: 'note', label: '메모', hint: '진입 전 할 일, 주의' },
  { key: 'source', label: '출처', hint: '예: eAIP ENR 2.1 (2026-10)' },
];

const KEY = 'firComm';
export const firCommEvents = new EventTarget();

export async function loadFirComm(): Promise<FirCommTable> {
  const row = await (await getDB()).get('settings', KEY);
  return (row?.value as FirCommTable | undefined) ?? {};
}

export async function saveFirComm(t: FirCommTable): Promise<void> {
  await (await getDB()).put('settings', { key: KEY, value: t });
  firCommEvents.dispatchEvent(new Event('change'));
}

/** 한 FIR 저장 (빈 칸만 있으면 지움) */
export async function putFirComm(icao: string, c: FirComm | null): Promise<void> {
  const t = await loadFirComm();
  const clean = c ? cleanEntry(c) : null;
  if (clean) t[icao] = { ...clean, updatedAt: new Date().toISOString() };
  else delete t[icao];
  await saveFirComm(t);
}

function cleanEntry(c: FirComm): FirComm | null {
  const out: FirComm = {};
  for (const { key } of FIR_COMM_FIELDS) {
    const v = typeof c[key] === 'string' ? c[key]!.trim() : '';
    if (v) out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

export function useFirComm(): FirCommTable {
  const [t, setT] = useState<FirCommTable>({});
  useEffect(() => {
    const reload = () => void loadFirComm().then(setT);
    reload();
    firCommEvents.addEventListener('change', reload);
    return () => firCommEvents.removeEventListener('change', reload);
  }, []);
  return t;
}

export const FIR_COMM_FORMAT = 'efb-fir-comm';

export function exportFirComm(t: FirCommTable): string {
  return JSON.stringify({ format: FIR_COMM_FORMAT, version: 1, exportedAt: new Date().toISOString(), firs: t }, null, 2);
}

/** 가져오기 파일 해석. 형식이 다르면 오류. 결과는 기존 표에 FIR 단위로 덮어씀 */
export function parseFirCommImport(text: string): FirCommTable {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('JSON 파일이 아닙니다');
  }
  const o = j as { format?: string; firs?: unknown };
  if (o?.format !== FIR_COMM_FORMAT || !o.firs || typeof o.firs !== 'object') throw new Error(`${FIR_COMM_FORMAT} 형식 파일이 아닙니다`);
  const out: FirCommTable = {};
  for (const [k, v] of Object.entries(o.firs as Record<string, unknown>)) {
    const icao = k.toUpperCase();
    if (!/^[A-Z]{4}$/.test(icao) || !v || typeof v !== 'object') continue;
    const c = cleanEntry(v as FirComm);
    if (c) out[icao] = { ...c, updatedAt: (v as FirComm).updatedAt };
  }
  return out;
}

export async function mergeFirComm(add: FirCommTable): Promise<number> {
  const t = await loadFirComm();
  Object.assign(t, add);
  await saveFirComm(t);
  return Object.keys(add).length;
}
