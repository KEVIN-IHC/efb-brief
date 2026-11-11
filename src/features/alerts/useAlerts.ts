// 현재 비행의 얼러트: 맥락(OFP·순항 기록·MEL 매칭·기상) → 규칙 실행 → 새 얼러트 기록·확인 상태
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AlertRecord } from '../../db/schema';
import { useNow } from '../../lib/useNow';
import { useActiveFlight } from '../flight/activeFlight';
import { latestActuals, useFlightLogs } from '../inflight/actuals';
import { buildChecks, project } from '../inflight/deviation';
import { loadCodeRefs, loadMelMatches, manualAircraft, type MelMatch } from '../manual/lookup';
import { FOM_CODES } from './fomRefs';
import { manualEvents, type StoredManual } from '../manual/store';
import { useWx } from '../weather/store';
import { useBrief } from '../brief/useBrief';
import { evaluateAlerts } from './engine';
import { RULES } from './rules';
import { ackAlerts, alertEvents, alertHistory, recordAlerts } from './store';
import type { Alert, FlightContext } from './types';

export function useAlerts() {
  const { flight, ofp } = useActiveFlight();
  const o = ofp?.parsed ?? null;
  const flightId = flight.flightId;
  const logs = useFlightLogs(flightId);
  const now = useNow(60_000);
  const metars = useWx((s) => s.metars);
  const tafs = useWx((s) => s.tafs);
  const sigmets = useWx((s) => s.sigmets);
  const [mel, setMel] = useState<{ docs: StoredManual[]; matches: MelMatch[] }>({ docs: [], matches: [] });
  const [history, setHistory] = useState<AlertRecord[]>([]);
  const [refs, setRefs] = useState<FlightContext['refs']>({});
  const { brief } = useBrief();

  useEffect(() => {
    const load = () => void loadCodeRefs(FOM_CODES).then(setRefs).catch(() => {});
    load();
    manualEvents.addEventListener('change', load);
    return () => manualEvents.removeEventListener('change', load);
  }, []);

  useEffect(() => {
    if (!o) return;
    const load = () => void loadMelMatches(o.mel, manualAircraft(o.header.acType)).then(setMel).catch(() => {});
    load();
    manualEvents.addEventListener('change', load);
    return () => manualEvents.removeEventListener('change', load);
  }, [o]);

  const alerts: Alert[] = useMemo(() => {
    if (!o) return [];
    const checks = buildChecks(o, latestActuals(logs));
    return evaluateAlerts(
      { now, flightId, o, checks, proj: project(o, checks), mel: mel.matches, manualDocs: mel.docs, refs, wx: { metars, tafs, sigmets }, brief },
      RULES,
    );
  }, [o, logs, now, flightId, mel, refs, metars, tafs, sigmets, brief]);

  const idsKey = alerts.map((a) => a.id).join('|');
  useEffect(() => {
    if (alerts.length) void recordAlerts(flightId, alerts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId, idsKey]);

  useEffect(() => {
    const load = () => void alertHistory(flightId).then(setHistory);
    load();
    alertEvents.addEventListener('change', load);
    return () => alertEvents.removeEventListener('change', load);
  }, [flightId]);

  const ackAt = useMemo(() => new Map(history.map((h) => [h.id, h.ackAt])), [history]);
  const ack = useCallback((ids: string[]) => ackAlerts(flightId, ids), [flightId]);
  return { alerts, history, ackAt, ack, hasOfp: !!o };
}
