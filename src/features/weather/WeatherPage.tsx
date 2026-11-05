// Weather 탭 (PROJECT_SPEC §5.6): 공항별 METAR/TAF, 루트 관련 SIGMET, 웨이포인트 바람·기온 vs OFP
import { useMemo, useState } from 'react';
import { fmtFl, fmtTemp, fmtWind } from '../../lib/format';
import { formatDayZ, formatZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { useActiveFlight } from '../flight/activeFlight';
import { ceilingFt, visibSm } from './decode';
import { sigmetNearRoute } from './route';
import { flightStations, useWx, type Station } from './store';
import type { Cloud, Metar, Sigmet, Taf, TafPeriod } from './types';
import { CatBadge, FreshTag, PrepareCard, WxStatusCard } from './ui';

const windText = (dir: number | 'VRB' | null, spd: number | null, gst: number | null) =>
  spd == null ? '—' : `${dir === 'VRB' ? 'VRB' : String(dir ?? 0).padStart(3, '0')}/${String(spd).padStart(2, '0')}${gst ? `G${gst}` : ''}KT`;
const cloudText = (c: Cloud[]) => (c.length ? c.map((x) => `${x.cover}${x.base != null ? String(Math.round(x.base / 100)).padStart(3, '0') : ''}`).join(' ') : '—');
const visText = (v: string | number | null) => {
  const n = visibSm(v);
  if (n == null) return '—';
  if (n >= 6) return '≥10 km';
  return n * 1.609 < 5 ? `${Math.round(n * 1609)} m` : `${(n * 1.609).toFixed(0)} km`;
};

function MetarBlock({ m, now }: { m: Metar; now: number }) {
  const ceil = ceilingFt(m.clouds);
  return (
    <div className="wx-block">
      <div className="wx-head">
        <FreshTag kind="metar" label={`${m.icao} METAR`} refIso={m.obsTime} now={now} />
      </div>
      <pre className="raw mono">{m.raw}</pre>
      <ul className="wx-decode small">
        <li>
          <span>바람</span>
          <b className="mono">{windText(m.wdir, m.wspd, m.wgst)}</b>
        </li>
        <li>
          <span>시정</span>
          <b className="mono">{m.cover === 'CAVOK' ? 'CAVOK' : visText(m.visib)}</b>
        </li>
        <li>
          <span>구름</span>
          <b className="mono">{m.cover === 'CAVOK' ? 'CAVOK' : cloudText(m.clouds)}</b>
        </li>
        <li>
          <span>운고</span>
          <b className="mono">{ceil != null ? `${ceil} ft` : '없음'}</b>
        </li>
        <li>
          <span>기온/이슬점</span>
          <b className="mono">
            {m.temp ?? '—'}/{m.dewp ?? '—'}°C
          </b>
        </li>
        <li>
          <span>QNH</span>
          <b className="mono">{m.altim != null ? Math.round(m.altim) : '—'}</b>
        </li>
      </ul>
    </div>
  );
}

/** ETD/ETA ±1시간과 겹치는 TAF 구간 강조 */
function TafBlock({ t, now, focus }: { t: Taf; now: number; focus: { label: string; iso: string }[] }) {
  const hit = (p: TafPeriod) =>
    focus.filter((f) => {
      const x = Date.parse(f.iso);
      return Date.parse(p.from) <= x + 3_600_000 && Date.parse(p.to) >= x - 3_600_000;
    });
  return (
    <div className="wx-block">
      <div className="wx-head">
        <FreshTag kind="taf" label={`${t.icao} TAF`} refIso={t.issueTime} validTo={t.validTo} now={now} />
      </div>
      <pre className="raw mono">{t.raw}</pre>
      <div className="table-wrap">
        <table className="tbl small">
          <thead>
            <tr>
              <th>구간 (UTC)</th>
              <th>변화</th>
              <th>등급</th>
              <th>바람</th>
              <th>시정</th>
              <th>날씨</th>
              <th>구름</th>
            </tr>
          </thead>
          <tbody>
            {t.periods.map((p, i) => {
              const h = hit(p);
              return (
                <tr key={i} className={h.length ? 'hl' : ''}>
                  <td className="mono nowrap">
                    {formatDayZ(p.from).replace(' ', '/')}–{formatZ(p.to)}
                    {h.map((f) => (
                      <span key={f.label} className="pill focus">
                        {f.label}
                      </span>
                    ))}
                  </td>
                  <td className="mono">{p.change ? `${p.change}${p.prob ? ` ${p.prob}` : ''}` : p.prob ? `PROB${p.prob}` : 'BASE'}</td>
                  <td>
                    <CatBadge cat={p.fltCat} />
                  </td>
                  <td className="mono nowrap">{p.wspd != null ? windText(p.wdir, p.wspd, p.wgst) : ''}</td>
                  <td className="mono nowrap">{p.visib != null ? visText(p.visib) : ''}</td>
                  <td className="mono">{p.wx ?? ''}</td>
                  <td className="mono">{p.clouds.length ? cloudText(p.clouds) : p.vertVis != null ? `VV${String(p.vertVis / 100).padStart(3, '0')}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { DEP: '출발', DEST: '도착', ALTN: '교체', EDTO: 'EDTO' };

function AirportCard({ st, now }: { st: Station; now: number }) {
  const m = useWx((s) => s.metars[st.icao]);
  const t = useWx((s) => s.tafs[st.icao]);
  const flight = useActiveFlight((s) => s.flight);
  const focus = [
    ...(st.roles.includes('DEP') ? [{ label: 'ETD', iso: flight.std }] : []),
    ...(st.roles.includes('DEST') || st.roles.includes('ALTN') ? [{ label: 'ETA', iso: flight.sta }] : []),
  ];
  return (
    <section className="card wx-airport">
      <div className="card-title">
        <h3>
          <span className="mono">{st.icao}</span> <CatBadge cat={m?.data.fltCat} />
        </h3>
        <span className="roles">
          {st.roles.map((r) => (
            <span key={r} className="pill">
              {ROLE_LABEL[r]}
            </span>
          ))}
        </span>
      </div>
      {m?.data.name && <p className="muted small">{m.data.name}</p>}
      {m ? <MetarBlock m={m.data} now={now} /> : <p className="muted small">METAR 없음 (아직 받지 않았거나 발표 없음)</p>}
      {t ? <TafBlock t={t.data} now={now} focus={focus} /> : <p className="muted small">TAF 없음</p>}
    </section>
  );
}

function SigmetCard({ now }: { now: number }) {
  const sig = useWx((s) => s.sigmets);
  const ofp = useActiveFlight((s) => s.ofp);
  const [showAll, setShowAll] = useState(false);
  const route = useMemo(() => (ofp?.parsed?.route ?? []).map((w) => ({ lat: w.lat, lon: w.lon })), [ofp]);
  const { near, all } = useMemo(() => {
    const list = (sig?.data ?? []).filter((s) => Date.parse(s.validTo) > now);
    return { all: list, near: list.filter((s) => sigmetNearRoute(s, route)) };
  }, [sig, route, now]);
  const shown = showAll ? all : near;
  return (
    <section className="card">
      <div className="card-title">
        <h3>SIGMET</h3>
        <FreshTag kind="sigmet" label="SIGMET" refIso={sig?.fetchedAt} now={now} />
      </div>
      <p className="muted small">
        루트 좌우 200NM 관련 {near.length}건 / 전 세계 유효 {all.length}건 (국제 SIGMET + 미국 국내 SIGMET)
      </p>
      <div className="segmented" role="radiogroup" aria-label="SIGMET 범위">
        <button role="radio" aria-checked={!showAll} className={!showAll ? 'on' : ''} onClick={() => setShowAll(false)}>
          루트 관련
        </button>
        <button role="radio" aria-checked={showAll} className={showAll ? 'on' : ''} onClick={() => setShowAll(true)}>
          전체
        </button>
      </div>
      {shown.length === 0 && <p className="muted small">{sig ? '해당 SIGMET 없음' : '아직 받지 않음'}</p>}
      <ul className="sigmet-list">
        {shown.slice(0, showAll ? 200 : 50).map((s) => (
          <SigmetItem key={s.id} s={s} />
        ))}
      </ul>
    </section>
  );
}

const ftToFl = (ft: number | null) => (ft == null ? '' : ft === 0 ? 'SFC' : `FL${String(Math.round(ft / 100)).padStart(3, '0')}`);

function SigmetItem({ s }: { s: Sigmet }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="sigmet">
      <button className="sigmet-row" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={`hz hz-${s.hazard.toLowerCase()}`}>{s.hazard}</span>
        <span className="mono">{s.fir}</span>
        <span className="muted small">{s.qualifier}</span>
        <span className="mono small">
          {ftToFl(s.base)}
          {s.top != null ? `–${ftToFl(s.top)}` : ''}
        </span>
        <span className="mono small muted">
          {formatDayZ(s.validFrom)}–{formatZ(s.validTo)}
        </span>
      </button>
      {open && <pre className="raw mono">{s.raw}</pre>}
    </li>
  );
}

function WindsCard({ now }: { now: number }) {
  const { flight, ofp } = useActiveFlight();
  const w = useWx((s) => (s.winds?.flightId === flight.flightId ? s.winds : null));
  const route = ofp?.parsed?.route ?? [];
  const bySeq = new Map(route.map((r) => [r.seq, r]));
  return (
    <section className="card flush">
      <div className="card-title pad">
        <h3>루트 바람·기온 (예보 vs OFP)</h3>
        <FreshTag kind="winds" label="Open-Meteo" refIso={w?.fetchedAt} now={now} />
      </div>
      <p className="pad muted small">
        {w?.data.basis === 'now'
          ? '⚠ 이미 끝난 비행이거나 예보 범위 밖이라 현재 시각 예보를 표시합니다 (비교는 참고만).'
          : '각 웨이포인트 ETO에 가장 가까운 정시 예보, OFP 계획 고도에서 기압면 보간.'}{' '}
        기온차 = 예보 − OFP.
      </p>
      {!w ? (
        <p className="pad muted small">{route.length ? '아직 받지 않음' : 'OFP 루트 없음'}</p>
      ) : (
        <div className="table-wrap">
          <table className="tbl small">
            <thead>
              <tr>
                <th>지점</th>
                <th>FL</th>
                <th>예보 시각</th>
                <th>예보 바람</th>
                <th>OFP 바람</th>
                <th>예보 °C</th>
                <th>OFP °C</th>
                <th>차</th>
              </tr>
            </thead>
            <tbody>
              {w.data.points.map((p) => {
                const o = bySeq.get(p.seq);
                const dT = p.temp != null && o?.oat != null ? p.temp - o.oat : null;
                return (
                  <tr key={p.seq}>
                    <td className="mono">{p.name}</td>
                    <td className="mono">{fmtFl(p.fl)}</td>
                    <td className="mono">{p.time ? formatZ(p.time) : '—'}</td>
                    <td className="mono">{p.dir != null && p.spd != null ? fmtWind(p.dir, p.spd) : '—'}</td>
                    <td className="mono muted">{o?.windDir != null && o.windSpd != null ? fmtWind(o.windDir, o.windSpd) : '—'}</td>
                    <td className="mono">{p.temp != null ? fmtTemp(p.temp) : '—'}</td>
                    <td className="mono muted">{o?.oat != null ? fmtTemp(o.oat) : o?.tempText ?? '—'}</td>
                    <td className={`mono ${dT != null && Math.abs(dT) >= 5 ? 'warn-text' : ''}`}>{dT != null ? fmtTemp(dT) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function WeatherPage() {
  const now = useNow(30_000);
  const { flight, ofp } = useActiveFlight();
  const stations = flightStations(flight.dep, flight.arr, ofp?.parsed);
  return (
    <div className="wx-page">
      <div className="wx-top">
        <WxStatusCard />
        <PrepareCard />
      </div>
      <p className="muted small wx-src">
        출처: aviationweather.gov (METAR·TAF·SIGMET) · Open-Meteo (상층풍) · NASA GIBS (위성). 비행 등급 색은 미국 FAA 기준 참고용. 공식 브리핑을 대체하지 않습니다.
      </p>
      <div className="wx-airports">
        {stations.map((s) => (
          <AirportCard key={s.icao} st={s} now={now} />
        ))}
      </div>
      <SigmetCard now={now} />
      <WindsCard now={now} />
    </div>
  );
}
