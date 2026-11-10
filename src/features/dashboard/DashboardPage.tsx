import { fmtFl, fmtHm, fmtKg, fmtSigned } from '../../lib/format';
import { formatAgo, formatDayZ, formatZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { useSync } from '../../sync/syncManager';
import { useActiveFlight } from '../flight/activeFlight';
import { Cell, DocSection, LevelPill } from '../ofp/doc/ui';
import { etpMargin, fuelMargin, limitMargin, worstLevel, type Margin } from '../ofp/margins';
import { OfpOpenButton } from '../ofp/OfpOpenButton';
import { turbulenceZones } from '../ofp/turbulence';
import { useMemo } from 'react';
import { AlertsCard } from '../alerts/AlertsCard';
import { latestActuals, useFlightLogs } from '../inflight/actuals';
import { buildChecks, nextWaypoint, project, revisedEto } from '../inflight/deviation';

export function DashboardPage() {
  const { flight, ofp, isDemo } = useActiveFlight();
  const o = ofp?.parsed;
  const { online, pending, failed, lastSyncAt } = useSync();
  const now = useNow();

  const fuel = o && fuelMargin(o.fuel, o.unit);
  const wts = o && (['zfw', 'tow', 'lw'] as const).map((k) => ({ k, ...limitMargin(o.weights[k], o.unit) }));
  const tightest = wts && [...wts].sort((a, b) => a.margin - b.margin)[0];
  const etps = (o?.etps.map((e) => etpMargin(e, o.unit)).filter(Boolean) ?? []) as Margin[];
  const U = o?.unit.toUpperCase() ?? '';
  const turb = o ? turbulenceZones(o.route) : [];
  const logs = useFlightLogs(flight.flightId);
  const checks = useMemo(() => (o ? buildChecks(o, latestActuals(logs)) : []), [o, logs]);
  const proj = o ? project(o, checks) : null;
  const next = nextWaypoint(checks);
  const turbHigh = turb.filter((z) => z.level === 'warning');

  return (
    <div className="page-grid doc">
      <DocSection
        title={isDemo ? 'Flight · demo' : 'Flight'}
        meta={o?.header.planNo ? `PLAN ${o.header.planNo}` : undefined}
        className="span-all"
      >
        <div className="flt-hero">
          <div className="flt-no mono">{flight.flightNo}</div>
          <div className="flt-route mono">
            {flight.dep} <span className="arrow">→</span> {flight.arr}
          </div>
          <div className="flt-sub mono">
            {flight.acType} {flight.reg}
          </div>
        </div>
        <div className="cells cells-4">
          <Cell k="ETD" v={formatDayZ(flight.std)} />
          <Cell k="ETA" v={formatDayZ(flight.sta)} />
          {o && <Cell k="FLT TIME" v={fmtHm(o.header.airMin)} />}
          {o && <Cell k="MAX FL" v={fmtFl(o.header.cruiseFl)} />}
        </div>
        <div className="row">
          <OfpOpenButton variant={isDemo ? 'primary' : 'plain'} label={isDemo ? '회사 OFP 열기' : '다른 OFP 열기'} />
        </div>
      </DocSection>

      <AlertsCard />

      {o && fuel && wts && tightest && (
        <a className="card-link" href="#ofp">
          <DocSection title="OFP 요약" meta={<LevelPill level={worstLevel([fuel.level, ...wts.map((w) => w.level), ...etps.map((e) => e.level)])} />}>
            <ul className="kv dense">
              <li>
                <span>BLOCK / MIN REQ ({U})</span>
                <b className="mono">
                  {fmtKg(o.fuel.block)} / {fmtKg(o.fuel.minRequired)}
                </b>
              </li>
              <li>
                <span>연료 여유 (EXTRA)</span>
                <b className={`mono c-${fuel.level}`}>{fmtSigned(fuel.margin)}</b>
              </li>
              <li>
                <span>중량 최소 여유 ({tightest.k.toUpperCase()})</span>
                <b className={`mono c-${tightest.level}`}>{fmtSigned(tightest.margin)}</b>
              </li>
              {etps.length > 0 && (
                <li>
                  <span>ETP 연료 최소 여유 (CFR 대비)</span>
                  <b className={`mono c-${worstLevel(etps.map((e) => e.level))}`}>{fmtSigned(Math.min(...etps.map((e) => e.margin)))}</b>
                </li>
              )}
              <li>
                <span>난류 (SR) 구간</span>
                <b className={`mono ${turbHigh.length ? 'c-warning' : turb.length ? 'c-caution' : ''}`}>
                  {turb.length ? `${turb.length}${turbHigh.length ? ` · HIGH ${turbHigh.map((z) => `${z.from.name}–${z.to.name}`).join(', ')}` : ''}` : 'NIL'}
                </b>
              </li>
              <li>
                <span>ALTN</span>
                <b className="mono">{o.alternates.map((a) => a.icao).join(' · ')}</b>
              </li>
              <li>
                <span>MEL / CDL</span>
                <b>{o.mel.length ? `${o.mel.length}건` : 'NIL'}</b>
              </li>
              {o.header.validUntil && (
                <li>
                  <span>PLAN VALID UNTIL</span>
                  <b className="mono">{o.header.validUntil}</b>
                </li>
              )}
            </ul>
          </DocSection>
        </a>
      )}

      {o && proj && (
        <a className="card-link" href="#inflight">
          <DocSection title="Inflight" meta={<LevelPill level={proj.level}>{proj.last ? `ΔFUEL ${proj.lastFuel ? fmtSigned(proj.lastFuel.fuelDev!) : '—'}` : '기록 전'}</LevelPill>}>
            <ul className="kv dense">
              <li>
                <span>마지막 통과</span>
                <b className="mono">{proj.last ? `${proj.last.w.name} ${formatZ(proj.last.actual!.ata)}` : '—'}</b>
              </li>
              <li>
                <span>다음</span>
                <b className="mono">{next ? `${next.w.name} ${formatZ(revisedEto(next.w, proj.timeDevMin))}` : '—'}</b>
              </li>
              <li>
                <span>예상 착륙 연료 ({U})</span>
                <b className={`mono c-${proj.level}`}>{fmtKg(proj.landingIfTrend ?? proj.landingIfPlanBurn ?? proj.plannedLanding)}</b>
              </li>
              <li>
                <span>ALTN + FINAL</span>
                <b className="mono">{fmtKg(proj.minLanding)}</b>
              </li>
              <li>
                <span>ETA (수정)</span>
                <b className="mono">{formatZ(proj.eta)}</b>
              </li>
            </ul>
          </DocSection>
        </a>
      )}

      <DocSection title="Sync">
        <ul className="kv dense">
          <li>
            <span>Connection</span>
            <b className={online ? 'c-ok' : 'c-off'}>{online ? 'ONLINE' : 'OFFLINE'}</b>
          </li>
          <li>
            <span>Last sync</span>
            <b className="mono">{lastSyncAt ? `${formatZ(lastSyncAt)} · ${formatAgo(lastSyncAt, now)}` : '—'}</b>
          </li>
          <li>
            <span>Outbox 대기</span>
            <b className={failed ? 'c-bad' : pending ? 'c-warn' : ''}>
              {pending}
              {failed ? ` (실패 ${failed})` : ''}
            </b>
          </li>
        </ul>
        <div className="row">
          <a className="btn" href="#inflight">
            메모 작성
          </a>
        </div>
      </DocSection>
    </div>
  );
}
