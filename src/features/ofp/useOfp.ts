import { useCallback, useEffect, useState } from 'react';
import { getDB } from '../../db/schema';
import type { OfpRecord } from './types';

export const ofpEvents = new EventTarget();
export const notifyOfpChanged = () => ofpEvents.dispatchEvent(new Event('change'));

/** 특정 비행의 OFP (기기 IndexedDB에서 읽음 → 오프라인 동작) */
export function useOfp(flightId: string): OfpRecord | null | undefined {
  const [rec, setRec] = useState<OfpRecord | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void getDB()
        .then((db) => db.get('ofp', flightId))
        .then((r) => alive && setRec(r ?? null));
    load();
    ofpEvents.addEventListener('change', load);
    return () => {
      alive = false;
      ofpEvents.removeEventListener('change', load);
    };
  }, [flightId]);
  return rec;
}

/** 업로드된 PDF 원문 목록 (최신순) */
export function useUploadedOfps() {
  const [list, setList] = useState<OfpRecord[]>([]);
  const reload = useCallback(async () => {
    const all = await (await getDB()).getAll('ofp');
    setList(all.filter((r) => r.source === 'pdf').sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);
  useEffect(() => {
    void reload();
    ofpEvents.addEventListener('change', reload);
    return () => ofpEvents.removeEventListener('change', reload);
  }, [reload]);
  return list;
}
