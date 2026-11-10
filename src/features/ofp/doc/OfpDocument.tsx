// Lido식 OFP 요약 문서: FLIGHT → FUEL → WEIGHTS → ALTERNATES → EDTO/ETP → MEL/CDL → NOTES
import { fmtFl, fmtHm, fmtKg, fmtSigned } from '../../../lib/format';
import { formatLatLon } from '../../../lib/geo';
import { formatDayZ, formatZ } from '../../../lib/time';
import { etpMargin, fuelMargin, limitMargin } from '../margins';
import type { FuelRow, OfpData } from '../types';
import { Cell, DocSection, LevelPill } from './ui';
import { TurbulenceBlock } from './Turbulence';

const U = (o: OfpData) => o.unit.toUpperCase();
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const dayMon = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
/** 항로 문자열은 ".." 와 공백에서만 줄바꿈 (단어 중간 끊김 방지) */
const breakable = (s: string) => s.replace(/\.\./g, '..​');

export function FlightBlock({ o }: { o: OfpData }) {
  const h = o.header;
  const altn = o.alternates.filter((a) => a.role.startsWith('DEST')).map((a) => a.icao);
  return (
    <DocSection title="Flight" meta={[h.planNo && `PLAN ${h.planNo}`, h.computedAt && `COMPUTED ${h.computedAt}`].filter(Boolean).join(' · ')} className="span-all">
      <div className="flt-hero">
        <div className="flt-no mono">{h.flightNo}</div>
        <div className="flt-route mono">
          {h.dep} <span className="arrow">→</span> {h.arr}
          {altn.length > 0 && <span className="flt-altn"> ALTN {altn.join(' ')}</span>}
        </div>
        <div className="flt-sub mono">
          {dayMon(h.std)} · {h.acType} {h.reg}
          {h.engine && ` · ${h.engine}`}
          {h.selcal && ` · SELCAL ${h.selcal}`}
        </div>
      </div>
      <div className="cells">
        <Cell k="ETD" v={formatZ(h.std)} />
        <Cell k="ETA" v={formatZ(h.sta)} />
        <Cell k="FLT TIME" v={fmtHm(h.airMin)} />
        <Cell k="MAX FL" v={fmtFl(h.cruiseFl)} />
        <Cell k="CI" v={Number.isFinite(h.costIndex) ? h.costIndex : '—'} />
        <Cell k="AVG W/T" v={h.avgWindTemp ?? '—'} />
        <Cell k="EDTO" v={h.edtoRule ?? '—'} />
        <Cell k="PLAN VALID" v={h.validUntil ?? '—'} />
      </div>
      {h.routeString && (
        <div className="route-str mono">
          <span className="cell-k">ROUTE</span>
          {breakable(h.routeString)}
        </div>
      )}
    </DocSection>
  );
}

function fallbackRows(o: OfpData): FuelRow[] {
  const f = o.fuel;
  return [
    { label: 'TRIP', fuel: f.trip },
    { label: 'CONT', fuel: f.contingency, kind: 'sub' },
    { label: 'ALTN', fuel: f.alternate, kind: 'sub' },
    { label: 'FINAL RES', fuel: f.finalReserve, kind: 'sub' },
    { label: 'MIN REQUIRED', fuel: f.minRequired - f.taxi, kind: 'total' },
    { label: 'EXTRA', fuel: f.extra },
    { label: 'TAXI', fuel: f.taxi },
    { label: 'BLOCK', fuel: f.block, kind: 'key' },
  ];
}

export function FuelBlock({ o }: { o: OfpData }) {
  const rows = o.fuel.rows?.length ? o.fuel.rows : fallbackRows(o);
  const m = fuelMargin(o.fuel, o.unit);
  return (
    <DocSection title={`Fuel · ${U(o)}`} meta={<LevelPill level={m.level}>{`EXTRA ${fmtSigned(m.margin)}`}</LevelPill>}>
      <table className="dt">
        <thead>
          <tr>
            <th />
            <th className="r">FUEL</th>
            <th className="r">TIME</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.kind ? `row-${r.kind}` : undefined}>
              <td>{r.label}</td>
              <td className="r mono">{fmtKg(r.fuel)}</td>
              <td className="r mono muted">{r.timeMin !== undefined ? fmtHm(r.timeMin) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="doc-foot">
        BLOCK − 최소 요구량 (RQD + TAXI) = <b className={`mono c-${m.level}`}>{fmtSigned(m.margin)}</b>
      </p>
    </DocSection>
  );
}

export function WeightBlock({ o }: { o: OfpData }) {
  const rows = [
    ['ZFW', 'MZFW', o.weights.zfw],
    ['TOW', 'MTOW', o.weights.tow],
    ['LDW', 'MLDW', o.weights.lw],
  ] as const;
  return (
    <DocSection title={`Weights · ${U(o)}`}>
      <table className="dt">
        <thead>
          <tr>
            <th />
            <th className="r">PLAN</th>
            <th className="r">LIMIT</th>
            <th className="r">MARGIN</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, lk, p]) => {
            const m = limitMargin(p, o.unit);
            return (
              <tr key={k}>
                <td>
                  {k}
                  <div className="meter thin">
                    <span className={`lv-bg-${m.level}`} style={{ width: `${Math.min(100, (p.planned / p.limit) * 100)}%` }} />
                  </div>
                </td>
                <td className="r mono strong">{fmtKg(p.planned)}</td>
                <td className="r mono muted">
                  <span className="lim-k">{lk}</span> {fmtKg(p.limit)}
                </td>
                <td className={`r mono c-${m.level}`}>{fmtSigned(m.margin)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="cells compact">
        <Cell k="PAYLOAD" v={fmtKg(o.weights.payload)} />
        {o.weights.extraLimits?.map((l) => <Cell key={l.label} k={l.label} v={fmtKg(l.value)} />)}
      </div>
      {(o.pax || o.cargo) && (
        <p className="doc-foot mono">
          {o.pax}
          {o.pax && o.cargo && <br />}
          {o.cargo}
        </p>
      )}
    </DocSection>
  );
}

export function AlternatesBlock({ o }: { o: OfpData }) {
  return (
    <DocSection title="Alternates">
      <table className="dt">
        <thead>
          <tr>
            <th>ICAO</th>
            <th>TYPE</th>
            <th className="r">DIST</th>
            <th className="r">FL</th>
            <th className="r">TIME</th>
            <th className="r">FUEL</th>
          </tr>
        </thead>
        <tbody>
          {o.alternates.map((a) => (
            <tr key={a.role + a.icao}>
              <td className="mono strong">{a.icao}</td>
              <td className="muted small">{a.role}</td>
              <td className="r mono">{Number.isFinite(a.distNm) ? a.distNm : '—'}</td>
              <td className="r mono">{a.fl ? fmtFl(a.fl) : '—'}</td>
              <td className="r mono">{Number.isFinite(a.timeMin) ? fmtHm(a.timeMin) : '—'}</td>
              <td className="r mono">{a.fuel ? fmtKg(a.fuel) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {o.alternates.find((a) => a.route)?.route && <p className="doc-foot mono">ROUTE TO ALTN: {o.alternates.find((a) => a.route)!.route}</p>}
    </DocSection>
  );
}

export function EtpBlock({ o }: { o: OfpData }) {
  if (!o.etps.length && !o.edtoAirports.length) return null;
  return (
    <DocSection title="EDTO · ETP" meta={o.header.edtoRule ?? (o.edtoAirports.length ? `RALT ${o.edtoAirports.join(' ')}` : '')}>
      <div className="etp-list">
        {o.etps.map((e) => {
          const m = etpMargin(e, o.unit);
          const critical = o.edto?.mostCritical && Number(o.edto.mostCritical.replace(/\D/g, '')) === Number(e.name.replace(/\D/g, ''));
          return (
            <div key={e.name} className={`etp ${m ? `lv-border-${m.level}` : ''}`}>
              <div className="etp-head">
                <b className="mono">{e.name}</b>
                <span className="mono">{e.airports.join(' / ')}</span>
                <span className="mono muted">{formatDayZ(e.eto)}</span>
                {critical && <span className="pill lv-caution">MOST CRITICAL</span>}
              </div>
              <div className="mono small muted">{Number.isFinite(e.lat) ? formatLatLon(e.lat, e.lon) : ''}</div>
              <div className="etp-fuel">
                <span>
                  FOB <b className="mono">{fmtKg(e.fuelOnBoard)}</b>
                </span>
                {e.criticalFuel !== undefined && (
                  <span>
                    CFR <b className="mono">{fmtKg(e.criticalFuel)}</b>
                  </span>
                )}
                {m && (
                  <span className={`c-${m.level}`}>
                    EXC <b className="mono">{fmtSigned(m.margin)}</b>
                  </span>
                )}
                {e.distToAlt !== undefined && (
                  <span className="muted">
                    → ALT {e.distToAlt} NM{e.timeToAltMin !== undefined ? ` · ${fmtHm(e.timeToAltMin)}` : ''}
                  </span>
                )}
              </div>
              {e.scenarios && e.scenarios.length > 0 && (
                <table className="dt small-t">
                  <thead>
                    <tr>
                      <th>DRIFTDOWN</th>
                      <th className="r">{e.airports[0]} BURN</th>
                      <th className="r">{e.airports[1]} BURN</th>
                      <th className="r">FOB</th>
                      <th>W</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.scenarios.map((s) => (
                      <tr key={s.mode}>
                        <td className="mono">{s.mode}</td>
                        <td className="r mono">{fmtKg(s.burn[0])}</td>
                        <td className="r mono">{fmtKg(s.burn[1])}</td>
                        <td className="r mono">{fmtKg(s.fob)}</td>
                        <td className="mono c-caution">{s.flags}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
      {o.edto?.windows.length ? (
        <p className="doc-foot mono">
          {o.edto.windows.map((w) => `${w.icao} ${w.from}–${w.to}`).join(' · ')}
        </p>
      ) : null}
      {o.etps.some((e) => e.scenarios?.some((s) => s.flags)) && <p className="doc-foot mono">W: M-MSA · D-FUEL DUMP REQ · F-DIVERT FUEL REQ · S-SPIRAL DESCENT</p>}
      {!o.etps.some((e) => e.criticalFuel !== undefined) && o.etps.length > 0 && (
        <p className="doc-foot muted">이 OFP 양식에는 ETP 임계 연료(CFR)가 명시되어 있지 않아 여유 판정을 하지 않습니다.</p>
      )}
    </DocSection>
  );
}

export function MelBlock({ o }: { o: OfpData }) {
  return (
    <DocSection title="MEL / CDL" meta={`${o.mel.length}`}>
      {o.mel.length === 0 ? (
        <p className="muted small">NIL</p>
      ) : (
        <ul className="mel-rows">
          {o.mel.map((m, i) => (
            <li key={i}>
              <span className={`tag ${m.kind === 'CDL' ? 'tag-cdl' : 'tag-mel'}`}>{m.kind}</span>
              <span className="mono strong">{m.itemNo}</span>
              <span className="mel-t">{m.title}</span>
              {m.fuelPenalty && m.fuelPenalty !== 'NIL' && <span className="mono c-caution small">{m.fuelPenalty}</span>}
            </li>
          ))}
        </ul>
      )}
      {o.mel.length > 0 && (
        <p className="doc-foot">
          <a href="#mel">매뉴얼 항목 보기 (등급·조건·쪽) →</a>
        </p>
      )}
    </DocSection>
  );
}

export function NotesBlock({ o }: { o: OfpData }) {
  return (
    <DocSection title="Dispatch notes" meta={`${o.notes.length}`}>
      <ol className="doc-notes">
        {o.notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ol>
      {o.fuelStats && (
        <div className="stats-line">
          <span className="cell-k">ROUTE FUEL STAT {o.fuelStats.period ? `· ${o.fuelStats.period}` : ''} · ACTUAL − PLAN</span>
          <div className="cells compact">
            {o.fuelStats.items.map((s) => (
              <Cell key={s.label} k={s.label} v={fmtSigned(s.value)} tone={s.value > o.fuel.extra + o.fuel.contingency ? 'warning' : undefined} />
            ))}
          </div>
        </div>
      )}
    </DocSection>
  );
}

export function OfpDocument({ o }: { o: OfpData }) {
  return (
    <div className="page-grid doc">
      <FlightBlock o={o} />
      <FuelBlock o={o} />
      <WeightBlock o={o} />
      <AlternatesBlock o={o} />
      <EtpBlock o={o} />
      <TurbulenceBlock o={o} />
      <MelBlock o={o} />
      <NotesBlock o={o} />
    </div>
  );
}
