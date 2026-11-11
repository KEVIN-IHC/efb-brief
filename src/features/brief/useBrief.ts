// 현재 비행 브리핑: 회사 기준 파일·개인 설정·활주로 자료·FOM 표·기상 → buildBrief (화면·얼러트 공용)
import { useEffect, useMemo, useState } from 'react';
import { useNow } from '../../lib/useNow';
import { useActiveFlight } from '../flight/activeFlight';
import { latestActuals, useFlightLogs } from '../inflight/actuals';
import { buildChecks, project } from '../inflight/deviation';
import { manualEvents } from '../manual/store';
import { loadAirports } from '../weather/airports';
import { useWx } from '../weather/store';
import { buildBrief, type BriefResult } from './assess';
import { loadRefsFor, loadRestrictions, loadSpecialAirports, type Restriction, type SpecialAirport } from './fomTables';
import { DEFAULT_PROFILE, loadProfile, profileEvents, type CrewProfile } from './profile';
import { loadRules, rulesEvents, type CompanyRules, type RuleRef } from './rules';
import { loadRunwayDb, type RunwayDb } from './runways';

/** 회사 기준 파일 안의 모든 근거 코드 */
export function ruleCodes(r: CompanyRules | null): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach(walk);
    const o = v as Partial<RuleRef> & Record<string, unknown>;
    if (typeof o.code === 'string' && typeof o.label === 'string') out.add(o.code);
    Object.values(o).forEach(walk);
  };
  walk(r);
  return [...out];
}

interface Loaded {
  rules: CompanyRules | null;
  profile: CrewProfile;
  runwayDb: RunwayDb;
  specials: SpecialAirport[];
  restrictions: Restriction[];
  refs: Record<string, { docId: string; seq: number; ref?: string }>;
  geo: Record<string, [number, number, string]>;
}

const EMPTY: Loaded = { rules: null, profile: DEFAULT_PROFILE, runwayDb: {}, specials: [], restrictions: [], refs: {}, geo: {} };

/** 기기 자료 (회사 기준·설정·활주로·FOM 표). 바뀌면 다시 읽음 */
export function useBriefData(): Loaded & { ready: boolean } {
  const [d, setD] = useState<Loaded>(EMPTY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [stored, profile, runwayDb, geo] = await Promise.all([loadRules().catch(() => null), loadProfile().catch(() => DEFAULT_PROFILE), loadRunwayDb(), loadAirports().catch(() => ({}))]);
      const rules = stored?.rules ?? null;
      const [specials, restrictions, refs] = await Promise.all([
        rules ? loadSpecialAirports(rules.sections.specialAirports).catch(() => []) : Promise.resolve([]),
        rules ? loadRestrictions(rules.sections.airportRestrictions).catch(() => []) : Promise.resolve([]),
        loadRefsFor(ruleCodes(rules)).catch(() => ({})),
      ]);
      if (alive) {
        setD({ rules, profile, runwayDb, specials, restrictions, refs, geo: geo as Loaded['geo'] });
        setReady(true);
      }
    };
    void load();
    const on = () => void load();
    rulesEvents.addEventListener('change', on);
    profileEvents.addEventListener('change', on);
    manualEvents.addEventListener('change', on);
    return () => {
      alive = false;
      rulesEvents.removeEventListener('change', on);
      profileEvents.removeEventListener('change', on);
      manualEvents.removeEventListener('change', on);
    };
  }, []);
  return { ...d, ready };
}

export function useBrief(): { brief: BriefResult | null; data: ReturnType<typeof useBriefData> } {
  const { ofp, flight } = useActiveFlight();
  const o = ofp?.parsed ?? null;
  const logs = useFlightLogs(flight.flightId);
  const now = useNow(60_000);
  const metars = useWx((s) => s.metars);
  const tafs = useWx((s) => s.tafs);
  const data = useBriefData();
  const brief = useMemo(() => {
    if (!o) return null;
    const proj = project(o, buildChecks(o, latestActuals(logs)));
    return buildBrief({ o, now, wx: { metars, tafs }, rules: data.rules, profile: data.profile, runwayDb: data.runwayDb, specials: data.specials, restrictions: data.restrictions, refs: data.refs, geo: data.geo, proj });
  }, [o, logs, now, metars, tafs, data]);
  return { brief, data };
}
