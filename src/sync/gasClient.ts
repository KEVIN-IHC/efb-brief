// Apps Script 웹앱 통신. Content-Type: text/plain → CORS preflight 없음 (SPEC §7.3)
import type { GasConfig } from '../db/settings';
import type { FlightRecord, LogRecord } from '../db/schema';

export interface UpsertResult {
  logId: string;
  status: 'inserted' | 'duplicate' | 'error';
  error?: string;
}

export interface UpsertResponse {
  ok: true;
  results: UpsertResult[];
  warnings?: string[];
}

export class GasError extends Error {}
/** 서버에 닿지도 못함 (비행기 모드·Wi-Fi 없음 등) — 서버 오류와 구분해 짧게 자동 재시도 (D-042) */
export class NetworkError extends GasError {}

export async function postToGas<T>(cfg: GasConfig, body: Record<string, unknown>, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: cfg.token }),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new GasError(`HTTP ${resp.status}`);
    let data: { ok?: boolean; error?: string };
    try {
      data = await resp.json();
    } catch {
      throw new GasError('응답이 JSON이 아님 (배포 URL·권한 확인)');
    }
    if (!data.ok) throw new GasError(data.error || 'server error');
    return data as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new GasError(`timeout ${timeoutMs / 1000}s`);
    // fetch 자체가 실패(응답 없음) = 연결 없음. iOS는 비행기 모드에서도 navigator.onLine이 true일 수 있음
    if (e instanceof TypeError) throw new NetworkError('연결 안 됨 (자동 재시도)');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function upsertLogs(cfg: GasConfig, records: LogRecord[], flights: FlightRecord[]) {
  const flightMeta = flights.map(({ flightId, flightNo, dep, arr, std }) => ({ flightId, flightNo, dep, arr, std }));
  return postToGas<UpsertResponse>(cfg, { op: 'upsertLog', records, flights: flightMeta });
}

export function pingGas(cfg: GasConfig) {
  return postToGas<{ ok: true }>(cfg, { op: 'ping' }, 10000);
}
