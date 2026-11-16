// Lido식 OFP 요약 문서: FLIGHT → FUEL → WEIGHTS → ALTERNATES → EDTO/ETP → MEL/CDL → NOTES
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

export function FlightBlock({ o, onLine }: { o: OfpData; onLine?: (n: number) => void }) {
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
      <RouteCheckRow o={o} onLine={onLine} />
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

export function AlternatesBlock({ o }: { o: OfpData }) {
  return (
    <DocSection title="Alternates">
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
  return (
    <div className="page-grid doc">
      <FlightBlock o={o} onLine={onLine} />
      <FuelBlock o={o} />
      <WeightBlock o={o} />
      <AlternatesBlock o={o} />
      <EtpBlock o={o} />
      <TurbulenceBlock o={o} onZone={(z) => focusTurbZone(z, 'popup')} />
      <MelBlock o={o} />
      <NotesBlock o={o} />
    </div>
  );
}
