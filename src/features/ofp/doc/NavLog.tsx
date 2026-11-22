// Lido식 NAV LOG. 좁은 화면: WPT·FL·WIND·ETO·R/F 만, 넓을수록 열이 늘어남
// 줄을 누르면 그 줄만 색 표시(원문으로 가지 않음) · 머리글을 누르면 뜻 설명 · SR 구간 줄의 SR 표시는 난류 창(지도)
import { Fragment, useState } from 'react';
import { fmtFl, fmtHm, fmtKg, fmtTemp, fmtWind } from '../../../lib/format';
import { formatLatLon } from '../../../lib/geo';
import { formatZ } from '../../../lib/time';
import type { OfpData, OfpWaypoint } from '../types';
import { DocSection } from './ui';
import { focusTurbZone, srLevel, turbulenceZones } from '../turbulence';
import { openFirPopup } from '../../fir/FirPopup';

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

/** 머리글 뜻 (누르면 표 위에 한 줄로) */
const HELP: Record<string, string> = {
  WPT: 'WPT — 지점 이름. 아래 작은 글 = 전체 이름 또는 좌표. ▲ TOC · ▼ TOD · ◆ ETP',
  FL: 'FL — 그 지점의 계획 비행고도 (FL 100 단위, 상승·강하 중이면 CLB/DSC 표기)',
  MC: 'MC — Magnetic Course, 다음 지점까지 자기 침로(°)',
  WIND: 'WIND — 계획 바람 풍향/풍속 (진방위°/kt)',
  CMP: 'CMP — Wind Component. P = 배풍(+), M = 정풍(−), kt',
  OT: 'OT — Outside Temperature, 외기 온도(°C). ISA 편차 표기일 수 있음',
  TAS: 'TAS — True Airspeed, 진대기속도(kt)',
  GS: 'GS — Ground Speed, 대지속도(kt)',
  MSA: 'MSA — Minimum Safe Altitude (100 ft 단위). 100 이상(10,000 ft)은 굵게·주황',
  SR: 'SR — Shear Rate(수직 바람 시어 지수). 5–6 주의 · 7+ HIGH (임시 기준). 난류 구간 줄의 SR 칸(◫)을 누르면 그 구간 지도',
  DIST: 'DIST — 앞 지점에서 이 지점까지 거리(NM)',
  ZT: 'ZT — Zone Time, 앞 지점에서 이 지점까지 시간(분)',
  ACTM: 'ACTM — Accumulated Time, 이륙부터 누적 시간(h:mm)',
  ETO: 'ETO — Estimated Time Over, 예상 통과 시각(Z) = ETD + ACTM',
  'R/F': 'R/F — Remaining Fuel, 그 지점 계획 잔여 연료',
  'B/O': 'B/O — Burn Off, 이륙부터 누적 소모 연료',
};

export function NavLog({ o }: { o: OfpData }) {
  const last = o.route[o.route.length - 1];
  const [sel, setSel] = useState<number | null>(null);
  const [help, setHelp] = useState<string | null>(null);
  // 난류 구간에 속한 지점 → 행 왼쪽 표시
  const zones = turbulenceZones(o.route);
  const inZone = new Map(zones.flatMap((z) => z.points.map((p) => [p.seq, z.level] as const)));
  const zoneOf = (seq: number) => zones.find((z) => z.points.some((p) => p.seq === seq));
  const H = ({ k, c }: { k: string; c?: string }) => (
    <th className={`${c ?? ''} nav-h ${help === k ? 'on' : ''}`} onClick={() => setHelp(help === k ? null : k)}>
      {k}
    </th>
  );
  return (
    <DocSection
      title={`Nav log · ${o.unit.toUpperCase()}`}
      meta={`${o.route.length} WPT · ${fmtKg(last?.cumDist)} NM · ${fmtHm(last?.cumMin)}`}
      className="span-all flush-doc"
    >
      {help && (
        <p className="nav-help small" onClick={() => setHelp(null)}>
          {HELP[help]}
        </p>
      )}
      <div className="table-wrap navwrap">
        <table className="dt nav">
          <thead>
            <tr>
              <H k="WPT" c="sticky" />
              <H k="FL" />
              <H k="MC" c="r hide-md" />
              <H k="WIND" c="r" />
              <H k="CMP" c="r hide-xs" />
              <H k="OT" c="r hide-xs" />
              <H k="TAS" c="r hide-md" />
              <H k="GS" c="r hide-xs" />
              <H k="MSA" c="r hide-md" />
              <H k="SR" c="r hide-xs" />
              <H k="DIST" c="r hide-xs" />
              <H k="ZT" c="r hide-xs" />
              <H k="ACTM" c="r hide-xs" />
              <H k="ETO" c="r" />
              <H k="R/F" c="r" />
              <H k="B/O" c="r hide-md" />
            </tr>
          </thead>
          <tbody>
            {o.route.map((w) => (
              <Fragment key={w.seq}>
                {w.fir && (
                  <tr className="row-fir" onClick={() => /^[A-Z]{4}\b/.test(w.fir!) && !w.fir!.startsWith('ADIZ') && openFirPopup(w.fir!.slice(0, 4))}>
                    <td colSpan={16}>
                      ▸ FIR {w.fir}
                      {/^[A-Z]{4}\b/.test(w.fir) && !w.fir.startsWith('ADIZ') && <span className="fir-row-go"> · 통신 ›</span>}
                    </td>
                  </tr>
                )}
                <tr className={`${inZone.has(w.seq) ? `zone-${inZone.get(w.seq)}` : ''} ${sel === w.seq ? 'row-sel' : ''}`} onClick={() => setSel(sel === w.seq ? null : w.seq)}>
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
                  <td
                    className={`r mono hide-xs sr-${srLevel(w.sr)} ${zoneOf(w.seq) ? 'sr-zone' : ''}`}
                    onClick={
                      zoneOf(w.seq)
                        ? (e) => {
                            e.stopPropagation();
                            focusTurbZone(zoneOf(w.seq)!, 'popup');
                          }
                        : undefined
                    }
                  >
                    {dash(w.sr)}
                    {zoneOf(w.seq) && <span className="sr-zone-mk">◫</span>}
                  </td>
                  <td className="r mono hide-xs">{w.legDist || '—'}</td>
                  <td className="r mono hide-xs">{w.legMin}</td>
                  <td className="r mono hide-xs">{fmtHm(w.cumMin)}</td>
                  <td className="r mono strong">{formatZ(w.eto)}</td>
                  <td className="r mono strong">{fmtKg(w.fuelRem)}</td>
                  <td className="r mono hide-md">{dash(w.accBurn, fmtKg)}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="doc-foot muted">
        ▲ TOC · ▼ TOD · ◆ ETP · 지점 앞 색 선 = 난류 SR 구간(주황 주의·빨강 HIGH) · SR 숫자 색 = 등급 · MSA 100 이상은 굵게, 높을수록 진한 색 · ETO = ETD + ACTM · R/F 계획 잔여연료 · SR 5–6 주의·7+ HIGH (임시 기준) · SR 칸 ◫ 누르면 그 난류 구간 지도 · FIR 줄 = 통신 방법·CPDLC 절차 창 · 머리글을 누르면 뜻 · 줄을 누르면 색 표시
      </p>
    </DocSection>
  );
}
