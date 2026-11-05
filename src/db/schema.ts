// IndexedDB 스키마 (SPEC §6). Phase 0에서는 logs / outbox / settings / flights 만 실제로 사용하고,
// 나머지 store는 이후 Phase를 위해 미리 생성해 둔다 (나중에 store 추가 = DB 버전 업 + 마이그레이션 필요).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { OfpRecord, OfpWaypoint } from '../features/ofp/types';

export const DB_NAME = 'efb';
export const DB_VERSION = 1;

export interface FlightRecord {
  flightId: string;
  flightNo: string;
  dep: string; // ICAO
  arr: string;
  std: string; // ISO UTC
  sta: string;
  acType?: string;
  reg?: string;
  status: 'planned' | 'active' | 'done';
  demo?: boolean;
}

export type LogKind = 'memo' | 'wpt';

export interface LogRecord {
  logId: string; // UUID = 서버 멱등성 키
  flightId: string;
  kind: LogKind;
  wpt?: string;
  seq?: number; // OFP 루트 순번 (같은 이름 지점 구분)
  ata?: string; // ISO UTC
  fuel?: number; // 실제 잔여연료 (unit 단위)
  unit?: 'kg' | 'lbs';
  /** 이 지점 기록 취소 (기록은 지우지 않고 취소 기록을 추가 → 동기화 이력 보존) */
  void?: boolean;
  note: string;
  createdAt: string; // ISO UTC
}

export type OutboxStatus = 'pending' | 'sent' | 'failed';

export interface OutboxItem {
  opId: string;
  target: 'gas';
  op: 'upsertLog';
  payload: LogRecord;
  status: OutboxStatus;
  retries: number;
  nextAttemptAt: number; // epoch ms
  lastError?: string;
  createdAt: string;
  sentAt?: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

type Loose<K extends string, T> = { [P in K]: T } & Record<string, unknown>;

export interface EfbDB extends DBSchema {
  flights: { key: string; value: FlightRecord };
  ofp: { key: string; value: OfpRecord };
  route: { key: string; value: { flightId: string; waypoints: OfpWaypoint[] } };
  wxSnapshots: { key: [string, string]; value: Loose<'type' | 'station', string> };
  wxFrames: { key: [string, string, string]; value: Loose<'layer' | 'validTime' | 'tile', string> };
  mapTiles: { key: [number, number, number]; value: { z: number; x: number; y: number; blob: Blob } };
  logs: { key: string; value: LogRecord; indexes: { byFlight: string } };
  outbox: { key: string; value: OutboxItem; indexes: { byStatus: OutboxStatus } };
  manualIndex: { key: [string, string]; value: Loose<'docId' | 'section', string> };
  melItems: { key: string; value: Loose<'itemNo', string> };
  settings: { key: string; value: SettingRow };
}

export type EfbDatabase = IDBPDatabase<EfbDB>;

let dbPromise: Promise<EfbDatabase> | null = null;

export function getDB(): Promise<EfbDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<EfbDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('flights', { keyPath: 'flightId' });
          db.createObjectStore('ofp', { keyPath: 'flightId' });
          db.createObjectStore('route', { keyPath: 'flightId' });
          db.createObjectStore('wxSnapshots', { keyPath: ['type', 'station'] });
          db.createObjectStore('wxFrames', { keyPath: ['layer', 'validTime', 'tile'] });
          db.createObjectStore('mapTiles', { keyPath: ['z', 'x', 'y'] });
          db.createObjectStore('logs', { keyPath: 'logId' }).createIndex('byFlight', 'flightId');
          db.createObjectStore('outbox', { keyPath: 'opId' }).createIndex('byStatus', 'status');
          db.createObjectStore('manualIndex', { keyPath: ['docId', 'section'] });
          db.createObjectStore('melItems', { keyPath: 'itemNo' });
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        // 이후 버전: if (oldVersion < 2) { ... }
      },
      blocked() {
        console.warn('[db] 다른 탭이 이전 버전 DB를 열고 있음');
      },
    });
  }
  return dbPromise;
}

/** 테스트 전용 */
export function _resetDBForTests() {
  dbPromise = null;
}
