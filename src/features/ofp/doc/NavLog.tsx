// Lido식 NAV LOG. 좁은 화면: WPT·FL·WIND·ETO·ATO·R/F 만, 넓을수록 열이 늘어남
import { Fragment } from 'react';
import { fmtFl, fmtHm, fmtKg, fmtTemp, fmtWind } from '../../../lib/format';
import { formatLatLon } from '../../../lib/geo';
import { formatZ } from '../../../lib/time';
import type { OfpData, OfpWaypoint } from '../types';
import { DocSection } from './ui';
import { srLevel, turbulenceZones } from '../turbulence';
import type { Actual } from '../../inflight/deviation';

const dash = (v: number | null | undefined, f: (n: number) => string = String) => (v == null || Number.isNaN(v) ? '—' : f(v));
/** TOC·TOD·ETP는 줄 색 없이 이름 앞 표시만 (D-074) */
const markOf = (w: OfpWaypoint) => (w.name === 'TOC' ? '▲' : w.name === 'TOD' ? '▼' : /^ETP\d+$/.test(w.name) ? '◆' : null);
/** MSA (D-075): 100(=10,000 ft) 이상만 숫자 색·굵게, 높을수록 진한 색 (100 → 옅은 주황 … 200 이상 진한 주황) */
const msaStyle = (msa: number | null | undefined) => {
  if (msa == null || msa < 100) return undefined;
  const pct = Math.round(Math.min(1, (msa - 100) / 100) * 50) + 50;
  return { color: `color-mix(in srgb, var(--msa) ${pct}%, var(--text))` };
};
const comp = (c: number | null | undefined) => (c == null ? '—' : `${c >= 0 ? 'P' : 'M'}${String(Math.abs(c)).padStart(3, '0')}`);

export function NavLog({ o, onLine, actuals }: { o: OfpData; onLine?: (n: number) => void; actuals?: Map<number, Actual> }) {
  const last = o.route[o.route.length - 1];
  // 난류 구간에 속한 지점 → 행 왼쪽 표시
  const inZone = new Map(turbulenceZones(o.route).flatMap((z) => z.points.map((p) => [p.seq, z.level] as const)));
  return (
    <DocSection
      title={`Nav log · ${o.unit.toUpperCase()}`}
      meta={`${o.route.length} WPT · ${fmtKg(last?.cumDist)} NM · ${fmtHm(last?.cumMin)}`}
      className="span-all flush-doc"
    >
      <div className="table-wrap navwrap">
        <table className="dt nav">
          <thead>
            <tr>
              <th className="sticky">WPT</th>
              <th>FL</th>
              <th className="r hide-md">MC</th>
              <th className="r">WIND</th>
              <th className="r hide-xs">CMP</th>
              <th className="r hide-xs">OT</th>
              <th className="r hide-md">TAS</th>
              <th className="r hide-xs">GS</th>
              <th className="r hide-md">MSA</th>
              <th className="r hide-xs">SR</th>
              <th className="r hide-xs">DIST</th>
              <th className="r hide-xs">ZT</th>
              <th className="r hide-xs">ACTM</th>
              <th className="r">ETO</th>
              <th className="r ato hide-xs">ATO</th>
              <th className="r">R/F</th>
              <th className="r hide-md">B/O</th>
            </tr>
          </thead>
          <tbody>
            {o.route.map((w) => (
              <Fragment key={w.seq}>
                {w.fir && (
                  <tr className="row-fir">
                    <td colSpan={17}>▸ FIR {w.fir}</td>
                  </tr>
                )}
                <tr className={inZone.has(w.seq) ? `zone-${inZone.get(w.seq)}` : ''} onClick={w.srcLine && onLine ? () => onLine(w.srcLine!) : undefined}>
                  <td className="sticky">
                    <div className="mono strong">
                      {markOf(w) && <span className="wpt-mark">{markOf(w)}</span>}
                      {w.name}
                    </div>
                    <div className="wpt-sub">{w.fullName && w.fullName !== w.name ? w.fullName : Number.isFinite(w.lat) ? formatLatLon(w.lat, w.lon) : ''}</div>
                  </td>
                  <td className="mono">{w.flText && !/^\d+$/.test(w.flText) ? w.flText : fmtFl(w.fl)}</td>
                  <td className="r mono hide-md">{dash(w.mc)}</td>
                  <td className="r mono">{w.windDir != null && w.windSpd != null ? fmtWind(w.windDir, w.windSpd) : '—'}</td>
                  <td className={`r mono hide-xs ${w.windComp != null && w.windComp < 0 ? 'c-caution' : ''}`}>{comp(w.windComp)}</td>
                  <td className="r mono hide-xs">{w.tempText ?? dash(w.oat, fmtTemp)}</td>
                  <td className="r mono hide-md">{dash(w.tas)}</td>
                  <td className="r mono hide-xs">{dash(w.gs)}</td>
                  <td className={`r mono hide-md msa ${w.msa != null && w.msa >= 100 ? 'msa-hi' : ''}`} style={msaStyle(w.msa)} title={w.msa != null ? `MSA ${(w.msa * 100).toLocaleString()} ft` : undefined}>
                    {dash(w.msa)}
                  </td>
                  <td className={`r mono hide-xs sr-${srLevel(w.sr)}`}>{dash(w.sr)}</td>
                  <td className="r mono hide-xs">{w.legDist || '—'}</td>
                  <td className="r mono hide-xs">{w.legMin}</td>
                  <td className="r mono hide-xs">{fmtHm(w.cumMin)}</td>
                  <td className="r mono strong">{formatZ(w.eto)}</td>
                  <td className={`r mono ato hide-xs ${actuals?.get(w.seq) ? 'ato-set' : ''}`}>
                    {actuals?.get(w.seq) ? (
                      <>
                        {formatZ(actuals.get(w.seq)!.ata)}
                        {actuals.get(w.seq)!.fuel != null && <div className="wpt-sub">{fmtKg(actuals.get(w.seq)!.fuel!)}</div>}
                      </>
                    ) : (
                      '····'
                    )}
                  </td>
                  <td className="r mono strong">{fmtKg(w.fuelRem)}</td>
                  <td className="r mono hide-md">{dash(w.accBurn, fmtKg)}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="doc-foot muted">
        ▲ TOC · ▼ TOD · ◆ ETP · 지점 앞 색 선 = 난류 SR 구간(주황 주의·빨강 HIGH) · SR 숫자 색 = 등급 · MSA 100 이상은 굵게, 높을수록 진한 색 · ETO = ETD + ACTM · R/F 계획 잔여연료 · ATO·실제 연료는 Inflight 탭에서 기록 · SR 5–6 주의·7+ HIGH (임시 기준){onLine ? ' · 행을 누르면 원문 위치' : ''}
      </p>
    </DocSection>
  );
}
