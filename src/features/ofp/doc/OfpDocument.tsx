// Lido식 OFP 요약 문서: FLIGHT(+ALTERNATES) → FUEL → WEIGHTS → RVSM → SYSTEMS PRE-FLIGHT → FMS → EDTO/ETP → MEL/CDL → NOTES
import { useEffect, useState } from 'react';
import { fmtFl, fmtHm, fmtKg, fmtSigned } from '../../../lib/format';
import { formatLatLon } from '../../../lib/geo';
import { formatDayZ, formatZ } from '../../../lib/time';
import { etpMargin, fuelMargin, limitMargin } from '../margins';
import { agtowCalc } from '../agtow';
import { loadMelMatches, manualAircraft, openManualPage, type MelMatch } from '../../manual/lookup';
import { manualEvents } from '../../manual/store';
import type { FuelRow, OfpData } from '../types';
import { Cell, DocSection, LevelPill } from './ui';
import { TurbulenceBlock } from './Turbulence';
import { Dlt, FmsBlock, FmsCell, FmsInput, showHm, showKilo, RvsmBlock, SystemsBlock, type Fms } from './Fms';
import { fmsKey, ofpRefs, parseHm, parseKilo, type FmsEntry } from '../../checks/checks';
import { putKey, useDraft, useKey } from '../../ops/store';
import { flightIdFor, useActiveFlight } from '../../flight/activeFlight';
import { kbProps, useAppKeyboard } from '../../../app/AppKeyboard';
import { depShift, eraTimes } from '../eraTimes';
import { focusTurbZone } from '../turbulence';

const U = (o: OfpData) => o.unit.toUpperCase();
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const dayMon = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
/** 항로 문자열은 ".." 와 공백에서만 줄바꿈 (단어 중간 끊김 방지) */
const breakable = (s: string) => s.replace(/\.\./g, '..​');

/** 항로·OFP 번호가 OFP 안 여러 곳에서 같은지 (D-067). 펼치면 곳마다 결과와 원문 줄 */
function RouteCheckRow({ o, onLine }: { o: OfpData; onLine?: (n: number) => void }) {
  const rc = o.routeCheck;
  if (!rc) return null;
  const r = rc.route;
  const p = rc.planNo;
  const rN = r.sources.length;
  return (
    <details className={`rc ${r.ok && p.ok ? 'rc-ok' : 'rc-bad'}`}>
      <summary>
        <span className={r.ok ? 'c-ok' : 'c-bad'}>{r.ok ? `✓ 이 OFP의 ROUTE ${rN}곳 모두 같음` : `⚠ ROUTE 다른 곳 있음 (${r.sources.filter((s) => !s.ok).length}/${rN})`}</span>
        <span className="rc-sep">·</span>
        <span className={p.ok ? 'c-ok' : 'c-bad'}>{p.ok ? `✓ OFP NO. ${p.value} ${p.sources.length}곳 같음` : p.sources.length < 2 ? 'OFP 번호 비교할 곳 부족' : '⚠ OFP 번호 다른 곳 있음'}</span>
      </summary>
      <ul className="rc-list small">
        {r.sources.map((s, i) => (
          <li key={`r${i}`}>
            <span className={s.ok ? 'c-ok' : 'c-bad'}>{s.ok ? '✓' : '✗'}</span> {s.where}
            {s.diff && <span className="c-bad"> — {s.diff}</span>}
            {s.line > 0 && onLine && (
              <button className="linkish mono" onClick={() => onLine(s.line)}>
                L{s.line}
              </button>
            )}
          </li>
        ))}
        {p.sources.map((s, i) => (
          <li key={`p${i}`}>
            <span className={s.ok ? 'c-ok' : 'c-bad'}>{s.ok ? '✓' : '✗'}</span> {s.where} <span className="mono">{s.value}</span>
            {onLine && (
              <button className="linkish mono" onClick={() => onLine(s.line)}>
                L{s.line}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="small muted">
        비교 = CFP 요약 항로 · OFP FPL · 제출된 ATS FPL 사본(기준) · NAV LOG 지점 순서. 표기 차이(.. ↔ DCT, 속도·고도 변경점, 같은 항로 위 중간 지점, 좌표 표기)와 SID·STAR는 같게 봄. 앱 확인 — 원본 OFP·ATC 허가가 기준
      </p>
    </details>
  );
}

/** 계획 방식은 3가지: REFILE · 3% CONT · 5% CONT. REFILE이면 5%는 따로 붙이지 않음 */
const showCont = (h: OfpData['header']) => !!h.plan?.contPct && !(h.plan.contPct === 5 && h.plan.refile?.length);

/** OPS PLAN 칸: EDTO(OFP에 있을 때만 — 쌍발기) · REFILE / 3% CONT / 5% CONT */
export function opsPlan(o: OfpData): string {
  const h = o.header;
  const parts: string[] = [];
  if (h.edtoRule || h.plan?.edto) parts.push(h.edtoRule ?? 'EDTO');
  if (h.plan?.refile?.length) parts.push('REFILE');
  if (showCont(h)) parts.push(`${h.plan!.contPct}% CONT`);
  return parts.join(' · ') || '—';
}

export function FlightBlock({ o, onLine }: { o: OfpData; onLine?: (n: number) => void }) {
  const h = o.header;
  const sp = h.speedPlan;
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
        {(h.plan?.contPct || h.plan?.refile?.length || h.edtoRule || h.plan?.edto) && (
          <div className="flt-plan">
            {showCont(h) && h.plan?.contPct && <span className={`pill ${h.plan.contPct === 3 ? 'plan-3' : 'plan-n'}`}>{h.plan.contPct}% CONT{h.plan.contPct === 3 && h.plan.era3?.length ? ` · ERA ${h.plan.era3.join(' ')}` : ''}</span>}
            {h.plan?.refile?.length ? <span className="pill plan-x">REFILE · {h.plan.refile.join(' ')}</span> : null}
            {(h.edtoRule || h.plan?.edto) && <span className="pill plan-x">{h.edtoRule ?? 'EDTO'}</span>}
          </div>
        )}
        {sp && (
          <div className="flt-sub mono">
            {[sp.clb && `CLB ${sp.clb}`, sp.crz && `CRZ CI${sp.crz}`, sp.dsc && `DSC ${sp.dsc}`, sp.apmsPct !== undefined && `APMS ${sp.apmsPct}%`].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      <div className="cells">
        <Cell k="ETD" v={formatZ(h.std)} />
        <Cell k="ETA" v={formatZ(h.sta)} />
        <Cell k="FLT TIME" v={fmtHm(h.airMin)} />
        <Cell k="MAX FL" v={fmtFl(h.cruiseFl)} />
        <Cell k="CI" v={Number.isFinite(h.costIndex) ? h.costIndex : '—'} />
        <Cell k="AVG W/T" v={h.avgWindTemp ?? '—'} />
        <Cell k="OPS PLAN" v={opsPlan(o)} tone={h.plan?.contPct === 3 || h.plan?.refile?.length || h.edtoRule || h.plan?.edto ? 'warn' : undefined} />
        <Cell k="PLAN VALID" v={h.validUntil ?? '—'} />
      </div>
      {h.routeString && (
        <div className="route-str mono">
          <span className="cell-k">ROUTE</span>
          {breakable(h.routeString)}
        </div>
      )}
      <RouteCheckRow o={o} onLine={onLine} />
      {o.alternates.length > 0 && (
        <div className="sub-sec">
          <div className="sub-h">ALTERNATES</div>
          <AlternatesTable o={o} />
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

export function FuelBlock({ o, fms }: { o: OfpData; fms?: Fms }) {
  const rows = o.fuel.rows?.length ? o.fuel.rows : fallbackRows(o);
  const m = fuelMargin(o.fuel, o.unit);
  const e = fms?.[0];
  const ref = ofpRefs(o);
  const sb = o.header.secondBest;
  const tripRow = rows.find((r) => /^TRIP\b/.test(r.label));
  const d = (v: number | undefined, r: number | undefined) => (v === undefined || r === undefined ? undefined : v - r);
  /** FMS 칸이 있는 줄: TRIP(시간) · RAMP OUT(FOB) · FOD */
  const fmsCell = (label: string) => {
    if (!fms || !e) return null;
    if (/^TRIP\b/.test(label))
      return (
        <FmsCell d={<Dlt d={d(parseHm(e.trip), ref.tripMin)} hm />}>
          <FmsInput fms={fms} k="trip" ph="TIME" mode="numeric" show={showHm} label="TRIP TIME" step={{ kind: 'hm', plan: ref.tripMin }} />
        </FmsCell>
      );
    if (/^(RAMP OUT|BLOCK)$/.test(label))
      return (
        <FmsCell d={<Dlt d={d(parseKilo(e.fob), ref.fob)} />}>
          <FmsInput fms={fms} k="fob" ph="FOB" show={showKilo} label="FOB" step={{ kind: 'kilo', plan: ref.fob }} />
        </FmsCell>
      );
    if (/^FOD$/.test(label))
      return (
        <FmsCell d={<Dlt d={d(parseKilo(e.fod), ref.fod)} />}>
          <FmsInput fms={fms} k="fod" ph="FOD" show={showKilo} label="FOD" step={{ kind: 'kilo', plan: ref.fod }} />
        </FmsCell>
      );
    return <td />;
  };
  return (
    <DocSection title={`Fuel · ${U(o)}`} meta={<LevelPill level={m.level}>{`EXTRA ${fmtSigned(m.margin)}`}</LevelPill>}>
      <table className={`dt ${fms ? 'fms-fuel' : ''}`}>
        {fms && (
          <colgroup>
            <col style={{ width: '36%' }} />
            <col style={{ width: '21%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '30%' }} />
          </colgroup>
        )}
        <thead>
          <tr>
            <th />
            <th className="r">FUEL</th>
            <th className="r">TIME</th>
            {fms && <th className="r fms-h">FMS</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.kind ? `row-${r.kind}` : undefined}>
              <td>{r.label}</td>
              <td className="r mono">{fmtKg(r.fuel)}</td>
              <td className="r mono muted">{r.timeMin !== undefined ? fmtHm(r.timeMin) : ''}</td>
              {fmsCell(r.label)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="doc-foot">
        BLOCK − 최소 요구량 (RQD + TAXI) = <b className={`mono c-${m.level}`}>{fmtSigned(m.margin)}</b>
        {sb && (
          <>
            <br />
            2ND BEST FL{sb.fl} · TRIP <b className="mono">{fmtKg(sb.trip)}</b>
            {tripRow && <span className="fms-dl mono">{fmtSigned(sb.trip - tripRow.fuel)}</span>} · <b className="mono">{fmtHm(sb.timeMin)}</b>
            {tripRow?.timeMin !== undefined && (
              <span className="fms-dl mono">
                {sb.timeMin - tripRow.timeMin >= 0 ? '+' : '−'}
                {fmtHm(Math.abs(sb.timeMin - tripRow.timeMin))}
              </span>
            )}
          </>
        )}
      </p>
    </DocSection>
  );
}

/** AGTOW·ACL 풀이 (D-068) */
function AgtowDetails({ o }: { o: OfpData }) {
  const c = agtowCalc(o);
  if (!c || c.ofpAgtow == null) return null; // OFP에 AGTOW가 있을 때만 (식은 회사 OFP 형식으로 확인한 것)
  return (
    <div className="ag">
      <div className="ag-h">
        <span className="cell-k">AGTOW = 가장 낮은 값</span>
        <span className="cell-k">{U(o)}</span>
      </div>
      {!c.ok && <p className="small c-bad">⚠ 계산값이 OFP AGTOW와 다름</p>}
      <ul className="ag-rows">
        {c.terms.map((t) => (
          <li key={t.label} className={t.limiting ? 'ag-lim' : ''}>
            <span className="ag-k">
              <span className="mono">{t.label}</span>
              {t.parts && <span className="ag-f mono">{t.parts.map(([, v]) => fmtKg(v)).join(' + ')}</span>}
            </span>
            <span className="ag-v mono">
              {t.limiting && <span className="ag-tag">AGTOW</span>}
              {fmtKg(t.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "FIRST 0/0 BUSINESS 10/12 ECONOMY 100/120" → 등급별 + 합계 (OFP 예약 표기 그대로) */
export function paxClasses(s?: string): { cls: { k: string; a: number; b: number }[]; a: number; b: number } | null {
  const cls = [...(s ?? '').matchAll(/(FIRST|BUSINESS|PRESTIGE|PREMIUM(?:\s+ECONOMY)?|ECONOMY)\s+(\d+)\s*\/\s*(\d+)/gi)].map((m) => ({ k: m[1].toUpperCase(), a: Number(m[2]), b: Number(m[3]) }));
  if (!cls.length) return null;
  return { cls, a: cls.reduce((x, c) => x + c.a, 0), b: cls.reduce((x, c) => x + c.b, 0) };
}
/** "PAX 12345 LBS · CARGO 678 LBS" → 숫자 */
const loadOf = (s: string | undefined, k: string) => {
  const m = new RegExp(`${k}\\D*(\\d+)`, 'i').exec(s ?? '');
  return m ? Number(m[1]) : null;
};

export function WeightBlock({ o }: { o: OfpData }) {
  const rows = [
    ['ZFW', 'MZFW', o.weights.zfw],
    ['TOW', 'MTOW', o.weights.tow],
    ['LDW', 'MLDW', o.weights.lw],
  ] as const;
  const pc = paxClasses(o.pax);
  const paxW = loadOf(o.cargo, 'PAX');
  const cargoW = loadOf(o.cargo, 'CARGO');
  return (
    <DocSection title={`Weights · ${U(o)}`}>
      {pc && (
        <div className="pax-row">
          {pc.cls.map((c) => (
            <span key={c.k} className="pax-c">
              <span className="cell-k">{c.k}</span> <b className="mono">{c.a}/{c.b}</b>
            </span>
          ))}
          <span className="pax-c pax-total">
            <span className="cell-k">TOTAL PAX</span> <b className="mono">{pc.a}</b>
            <span className="mono muted">/{pc.b}</span>
          </span>
        </div>
      )}
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
          {(paxW != null || cargoW != null) && (
            <tr className="row-load">
              <td colSpan={4} className="mono small">
                {paxW != null && <>PAX {fmtKg(paxW)}</>}
                {cargoW != null && <> · CARGO {fmtKg(cargoW)}</>}
                {paxW != null && cargoW != null && o.weights.payload - paxW - cargoW > 0 && <> · 기타 {fmtKg(o.weights.payload - paxW - cargoW)}</>}
                <span className="muted"> = PAYLOAD {fmtKg(o.weights.payload)}</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="cells compact">
        <Cell k="PAYLOAD" v={fmtKg(o.weights.payload)} />
        {o.weights.extraLimits?.map((l) => <Cell key={l.label} k={l.label} v={fmtKg(l.value)} />)}
      </div>
      <AgtowDetails o={o} />
      {o.pax && !pc && <p className="doc-foot mono">{o.pax}</p>}
    </DocSection>
  );
}

/** 교체공항 표 — FLIGHT 카드 안 (D-088) */
function AlternatesTable({ o }: { o: OfpData }) {
  return (
    <>
      <div className="table-wrap">
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
      </div>
      {o.alternates.find((a) => a.route)?.route && <p className="doc-foot mono">ROUTE TO ALTN: {o.alternates.find((a) => a.route)!.route}</p>}
    </>
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
                <div className="table-wrap">
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
                </div>
              )}
            </div>
          );
        })}
      </div>
      <EraTimes o={o} />
      {o.etps.some((e) => e.scenarios?.some((s) => s.flags)) && <p className="doc-foot mono">W: M-MSA · D-FUEL DUMP REQ · F-DIVERT FUEL REQ · S-SPIRAL DESCENT</p>}
      {!o.etps.some((e) => e.criticalFuel !== undefined) && o.etps.length > 0 && (
        <p className="doc-foot muted">이 OFP 양식에는 ETP 임계 연료(CFR)가 명시되어 있지 않아 여유 판정을 하지 않습니다.</p>
      )}
    </DocSection>
  );
}

/** ERA 예상 사용 시간 (D-094): FOM Earliest/Latest Estimated Time of Landing · 실제 출발 시각을 넣으면 옮김 */
function EraTimes({ o }: { o: OfpData }) {
  const flightId = useActiveFlight((s) => s.flight.flightId);
  const key = `eraDep:${flightId}`;
  const dep = useKey<string>(key, '');
  const appKb = useAppKeyboard();
  const shift = depShift(o, dep);
  const rows = eraTimes(o, shift);
  if (!rows.length) return null;
  const set = (v: string) => void putKey(key, v.replace(/\D/g, '').slice(0, 4));
  const z = (ms: number) => formatZ(new Date(ms).toISOString());
  const sh = Math.round(shift / 60000);
  return (
    <div className="era-times">
      <div className="era-head">
        <span className="cell-k">ERA 예상 사용 시간</span>
        <label className="era-dep">
          <span className="muted small">STD {formatZ(o.header.std)} · 실제 출발</span>
          <input
            className="hc-in mono kb-in"
            style={{ width: '6ch' }}
            placeholder="HHMM"
            aria-label="실제 출발 시각 Z"
            value={dep}
            onChange={(e) => set(e.target.value)}
            {...kbProps(appKb, { label: '실제 출발 Z', set, raw: () => dep, step: { kind: 'hm', clock: true } }, 'numeric')}
          />
          <span className="mono small">{dep && sh ? `${sh > 0 ? '+' : '−'}${fmtHm(Math.abs(sh))}` : dep ? '±0' : ''}</span>
          {dep && (
            <button type="button" className="btn small" onClick={() => void putKey(key, '')}>
              지우기
            </button>
          )}
        </label>
      </div>
      <div className="table-wrap">
        <table className="dt small-t">
          <thead>
            <tr>
              <th>ERA</th>
              <th className="r">예상 착륙</th>
              <th className="r">운항 시간대 ±1h</th>
              <th className="hide-xs">근거</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.icao}>
                <td className="mono strong">{r.icao}</td>
                <td className="r mono">{r.earliest === r.latest ? z(r.earliest) : `${z(r.earliest)}–${z(r.latest)}`}</td>
                <td className="r mono strong">
                  {z(r.opsFrom)}–{z(r.opsTo)}
                </td>
                <td className="muted small hide-xs">{r.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="doc-foot muted">
        FOM EDTO ETP Data: 예상 착륙 = 이륙 + (앞·뒤) ETP까지 시간 + 회항 시간, 운항 시간대 = 앞뒤 1시간.{' '}
        {rows[0].src === 'OFP EDTO'
          ? 'OFP "SUITABLE FROM ~ TO" 값을 예상 착륙 시간대로 씀.'
          : 'OFP에 EEP·EXP와 고속·1엔진 회항 시간 구분이 없어 ETP와 OFP 회항 시간 하나로 계산 — 첫·마지막 공항은 한 시각으로 나옴.'}{' '}
        {dep ? `실제 출발 ${dep}Z 기준으로 옮김.` : 'STD 기준. 실제 출발 시각을 넣으면 옮겨 계산.'} 이 시간대는 Briefing·NOTAM에도 씀(STD 기준).
      </p>
    </div>
  );
}

/** MEL/CDL — 줄을 누르면 가져온 매뉴얼 항목을 그 자리 창으로 (D-073) */
export function MelBlock({ o }: { o: OfpData }) {
  const [matches, setMatches] = useState<MelMatch[] | null>(null);
  useEffect(() => {
    if (!o.mel.length) return;
    const load = () => void loadMelMatches(o.mel, manualAircraft(o.header.acType)).then((r) => setMatches(r.matches), () => setMatches([]));
    load();
    manualEvents.addEventListener('change', load);
    return () => manualEvents.removeEventListener('change', load);
  }, [o]);
  return (
    <DocSection title="MEL / CDL" meta={`${o.mel.length}`}>
      {o.mel.length === 0 ? (
        <p className="muted small">NIL</p>
      ) : (
        <ul className="mel-rows">
          {o.mel.map((m, i) => {
            const it = matches?.[i]?.item;
            const row = (
              <>
                <span className={`tag ${m.kind === 'CDL' ? 'tag-cdl' : 'tag-mel'}`}>{m.kind}</span>
                <span className="mono strong">{m.itemNo}</span>
                <span className="mel-t">{m.title}</span>
                {m.fuelPenalty && m.fuelPenalty !== 'NIL' && <span className="mono c-caution small">{m.fuelPenalty}</span>}
                {it && <span className="mel-open" aria-hidden>📖</span>}
              </>
            );
            return (
              <li key={i}>
                {it ? (
                  <button className="mel-row-btn" onClick={() => openManualPage({ docId: it.docId, seq: it.pageSeq, mark: it.itemNo })} aria-label={`${m.kind} ${m.itemNo} 매뉴얼 보기`}>
                    {row}
                  </button>
                ) : (
                  <div className="mel-row-btn is-static">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {o.mel.length > 0 && (
        <p className="doc-foot">
          {matches && matches.some((m) => m.item) ? '줄을 누르면 매뉴얼 항목이 열립니다 · ' : matches ? '매뉴얼(MEL·CDL)을 가져오면 줄을 눌러 항목을 볼 수 있습니다 · ' : ''}
          <a href="#mel">MEL 탭 (등급·조건·쪽) →</a>
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

export function OfpDocument({ o, onLine }: { o: OfpData; onLine?: (n: number) => void }) {
  // FMS 입력은 세 카드가 한 저장 값을 같이 씀 (D-079)
  const fms = useDraft<FmsEntry>(fmsKey(flightIdFor(o)), {});
  return (
    <div className="page-grid doc">
      {/* 순서 (D-088·D-090): FLIGHT(+ALTERNATES) → FUEL · WEIGHTS → RVSM · SYSTEMS → FMS */}
      <FlightBlock o={o} onLine={onLine} />
      <FuelBlock o={o} fms={fms} />
      <WeightBlock o={o} />
      <RvsmBlock fms={fms} />
      <SystemsBlock fms={fms} flightMin={ofpRefs(o).flightMin} />
      <FmsBlock fms={fms} dist={ofpRefs(o).dist} maxFl={ofpRefs(o).maxFl} />
      <EtpBlock o={o} />
      <TurbulenceBlock o={o} onZone={(z) => focusTurbZone(z, 'popup')} />
      <MelBlock o={o} />
      <NotesBlock o={o} />
    </div>
  );
}
