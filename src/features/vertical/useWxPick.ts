// 버티컬·플랜 뷰 공통: 현재 비행 + 바람 자료 + 시간 선택 → 지점별 값 고르는 함수 (D-063)
import { useMemo } from 'react';
import { useNow } from '../../lib/useNow';
import { useActiveFlight } from '../flight/activeFlight';
import { latestActuals, useFlightLogs } from '../inflight/actuals';
import { buildChecks, project, revisedEto } from '../inflight/deviation';
import { useWx } from '../weather/store';
import type { WindPoint } from '../weather/types';
import { pointAt, useWxTime } from './wxTime';

export function useWxPick() {
  const { flight, ofp } = useActiveFlight();
  const o = ofp?.parsed ?? null;
  const logs = useFlightLogs(flight.flightId);
  const now = useNow(60_000);
  const winds = useWx((s) => (s.winds?.flightId === flight.flightId ? s.winds : null));
  const { mode, t } = useWxTime();
  const proj = useMemo(() => (o ? project(o, buildChecks(o, latestActuals(logs))) : null), [o, logs]);
  const dev = proj?.timeDevMin ?? 0;

  return useMemo(() => {
    const etoBySeq = new Map<number, number>();
    for (const w of o?.route ?? []) {
      const ms = Date.parse(revisedEto(w, dev));
      if (Number.isFinite(ms)) etoBySeq.set(w.seq, ms);
    }
    const vals = [...etoBySeq.values()];
    const etoRange: [number, number] | null = vals.length ? [Math.min(...vals), Math.max(...vals)] : null;
    // 지난 비행(basis now)은 ETO가 자료 범위 밖 → 지금 시각
    const useEto = winds?.data.basis !== 'now';
    const pick = (p: WindPoint) => (winds ? pointAt(p, winds.data, mode, t ?? now, useEto ? (etoBySeq.get(p.seq) ?? null) : now) : null);
    /** 계획(+기록 편차) 기준 그 시각의 위치. 비행 시간 밖이면 null */
    const route = o?.route ?? [];
    const ts = route.map((w) => etoBySeq.get(w.seq) ?? NaN);
    const posAt = (ms: number): { lat: number; lon: number } | null => {
      const i = ts.findIndex((x) => x > ms);
      if (i <= 0) return null;
      const f = (ms - ts[i - 1]) / (ts[i] - ts[i - 1] || 1);
      const a = route[i - 1];
      const b = route[i];
      let dl = b.lon - a.lon;
      if (dl > 180) dl -= 360;
      if (dl < -180) dl += 360;
      return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + dl * f };
    };
    return { o, winds, now, proj, dev, pick, posAt, etoRange: useEto ? etoRange : null, mode, t };
  }, [o, winds, now, proj, dev, mode, t]);
}
