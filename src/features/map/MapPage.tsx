// Map 탭 (PROJECT_SPEC §5.7, D-039): 내장 세계지도 위에 OFP 루트·공항·SIGMET·바람·위성
// 날짜변경선을 넘는 루트는 경도를 이어 붙여(unwrap) 한 화면에 그린다
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../../app/theme';
import { fmtFl, fmtTemp, fmtWind } from '../../lib/format';
import { formatDayZ, formatZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { firSequence } from '../fir/sequence';
import { useActiveFlight } from '../flight/activeFlight';
import { loadExtraCache, refreshExtra, useWxExtra } from '../weather/extra';
import { loadAirports } from '../weather/airports';
import { nearLon, unwrapLons } from '../weather/route';
import { flightStations, useWx } from '../weather/store';
import { FreshTag } from '../weather/ui';
import { getSatTile, SAT_LAYERS, SAT_MAX_ZOOM, tileInCoverage, useSat } from './satellite';

type LayerKey = 'sat' | 'sigmet' | 'wind' | 'airports' | 'fir' | 'pirep' | 'tc' | 'gairmet';
const LAYER_LABEL: Record<LayerKey, string> = { sat: '위성', sigmet: 'SIGMET', wind: '바람', airports: '공항', fir: 'FIR 경계', pirep: 'PIREP', tc: '열대저기압', gairmet: 'G-AIRMET' };
const LS_KEY = 'efb.mapLayers';

function readLayers(): Record<LayerKey, boolean> {
  const def = { sat: false, sigmet: true, wind: true, airports: true, fir: true, pirep: true, tc: true, gairmet: true };
  try {
    return { ...def, ...(JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as Partial<Record<LayerKey, boolean>>) };
  } catch {
    return def;
  }
}

/** CSS 토큰 값을 Leaflet 스타일에 사용 (주간/야간 따라감) */
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';

type Geo = GeoJSON.FeatureCollection;
let geoCache: Promise<{ land: Geo; borders: Geo }> | null = null;

/** FIR 경계 공개 자료 (D-059, VATSpy CC BY-SA 4.0 — 비공식) */
interface FirFile {
  source: string;
  license: string;
  commitDate: string | null;
  firs: { id: string; name: string; oceanic?: 1; polys: [number, number][][] }[];
}
let firCache: Promise<FirFile> | null = null;
const loadFirs = () =>
  (firCache ??= fetch(new URL('./geo/firs.json', location.href).href)
    .then((r) => r.json() as Promise<FirFile>)
    .catch((e) => {
      firCache = null;
      throw e;
    }));
const loadGeo = () =>
  (geoCache ??= Promise.all(['land', 'borders'].map((n) => fetch(new URL(`./geo/${n}.json`, location.href).href).then((r) => r.json() as Promise<Geo>)))
    .then(([land, borders]) => ({ land, borders }))
    .catch((e) => {
      geoCache = null;
      throw e;
    }));

/** GeoJSON 좌표 경도 이동 (날짜변경선 너머 사본) */
function shiftGeo(g: Geo, dLon: number): Geo {
  const sh = (c: unknown): unknown => (typeof (c as number[])[0] === 'number' ? [(c as number[])[0] + dLon, (c as number[])[1]] : (c as unknown[]).map(sh));
  return { ...g, features: g.features.map((f) => ({ ...f, geometry: { ...f.geometry, coordinates: sh((f.geometry as GeoJSON.Polygon).coordinates) } as GeoJSON.Geometry })) };
}

/** 위성: IndexedDB 저장본 우선(30분), 온라인이면 새로 받음 */
const SatGrid = L.GridLayer.extend({
  createTile(this: L.GridLayer & { options: { satLayer: string } }, coords: L.Coords, done: L.DoneCallback) {
    const img = document.createElement('img');
    img.alt = '';
    const n = 2 ** coords.z;
    const x = ((coords.x % n) + n) % n;
    if (!tileInCoverage(this.options.satLayer, coords.z, x)) {
      setTimeout(() => done(undefined, img));
      return img;
    }
    void getSatTile(this.options.satLayer, coords.z, x, coords.y).then((row) => {
      if (row && row.blob.size > 500) {
        const url = URL.createObjectURL(row.blob);
        img.onload = () => {
          URL.revokeObjectURL(url);
          done(undefined, img);
        };
        img.onerror = () => done(undefined, img);
        img.src = url;
      } else done(undefined, img);
    });
    return img;
  },
}) as unknown as new (o: L.GridLayerOptions & { satLayer: string }) => L.GridLayer;

const windIcon = (dir: number, spd: number, label: string) =>
  L.divIcon({
    className: 'wind-icon',
    iconSize: [80, 34],
    iconAnchor: [12, 17],
    // 화살표 = 바람이 불어가는 방향 (dir + 180)
    html: `<svg width="24" height="24" viewBox="-12 -12 24 24" style="transform:rotate(${dir + 180}deg)"><path d="M0 -10 L5 2 L1 0 L1 10 L-1 10 L-1 0 L-5 2 Z"/></svg><span>${label}</span><small>${spd}</small>`,
  });

export function MapPage() {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const fitted = useRef<unknown>(null);
  const groups = useRef<Partial<Record<LayerKey | 'route' | 'ne', L.LayerGroup>>>({});
  const [layers, setLayers] = useState(readLayers);
  const theme = useTheme((s) => s.resolved);
  const { flight, ofp } = useActiveFlight();
  const wx = useWx();
  const satTimes = useSat((s) => s.times);
  const now = useNow(30_000);
  const parsed = ofp?.parsed ?? null;

  const route = useMemo(() => unwrapLons((parsed?.route ?? []).map((w) => ({ lat: w.lat, lon: w.lon, name: w.name, fl: w.fl, eto: w.eto }))), [parsed]);
  const refLon = route.length ? (Math.min(...route.map((p) => p.lon)) + Math.max(...route.map((p) => p.lon))) / 2 : 0;

  // 지도 생성 (1회)
  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, { zoomControl: true, worldCopyJump: false, minZoom: 2, maxZoom: 9, attributionControl: true, preferCanvas: false });
    map.setView([30, 150], 3);
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __efbMap?: L.Map }).__efbMap = map; // 개발 중 점검용
    map.createPane('ne').style.zIndex = '150';
    map.createPane('sat').style.zIndex = '250';
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      groups.current = {};
      fitted.current = null; // 지도를 다시 만들면 루트에 다시 맞춤
    };
  }, []);

  const fitRoute = () => {
    const map = mapRef.current;
    if (!map || !route.length) return;
    map.invalidateSize();
    map.fitBounds(L.latLngBounds(route.map((p) => [p.lat, p.lon] as L.LatLngTuple)).pad(0.1));
  };

  const group = (k: LayerKey | 'route' | 'ne') => {
    const map = mapRef.current!;
    const g = (groups.current[k] ??= L.layerGroup().addTo(map));
    g.clearLayers();
    return g;
  };

  // 배경: 내장 세계지도 (온라인·오프라인 동일, D-039)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let alive = true;
    const ne = group('ne');
    const offsets = [0];
    if (route.some((p) => p.lon > 180)) offsets.push(360);
    if (route.some((p) => p.lon < -180)) offsets.push(-360);
    void loadGeo()
      .then(({ land, borders }) => {
        if (!alive) return;
        for (const d of offsets) {
          L.geoJSON(d ? shiftGeo(land, d) : land, { pane: 'ne', interactive: false, style: { stroke: true, weight: 0.6, color: cssVar('--line-strong'), fillColor: cssVar('--map-land'), fillOpacity: 1 } }).addTo(ne);
          L.geoJSON(d ? shiftGeo(borders, d) : borders, { pane: 'ne', interactive: false, style: { weight: 0.5, color: cssVar('--line-strong'), opacity: 0.8 } }).addTo(ne);
        }
      })
      .catch(() => {});
    map.getContainer().style.background = cssVar('--map-sea');
    return () => {
      alive = false;
    };
  }, [theme, route]);

  // 위성
  useEffect(() => {
    if (!mapRef.current) return;
    const g = group('sat');
    if (!layers.sat) return;
    for (const s of SAT_LAYERS) new SatGrid({ satLayer: s.id, pane: 'sat', opacity: 0.75, maxNativeZoom: SAT_MAX_ZOOM, maxZoom: 9, attribution: 'NASA GIBS' }).addTo(g);
  }, [layers.sat]);

  // 루트·웨이포인트·ETP
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const g = group('route');
    if (!route.length) return;
    const accent = cssVar('--accent');
    const line = route.map((p) => [p.lat, p.lon] as L.LatLngTuple);
    L.polyline(line, { color: cssVar('--bg'), weight: 7, opacity: 0.7, interactive: false }).addTo(g); // 위성 위에서도 보이게 테두리
    L.polyline(line, { color: accent, weight: 3, opacity: 1 }).addTo(g);
    for (const p of route)
      L.circleMarker([p.lat, p.lon], { radius: 3, color: accent, weight: 1, fillColor: cssVar('--bg'), fillOpacity: 1 })
        .bindTooltip(`${p.name} · ${fmtFl(p.fl)} · ${formatZ(p.eto)}`, { direction: 'top' })
        .addTo(g);
    for (const e of parsed?.etps ?? []) {
      const lon = nearLon(e.lon, refLon);
      L.circleMarker([e.lat, lon], { radius: 6, color: cssVar('--warn'), weight: 2, fillOpacity: 0 })
        .bindTooltip(`${e.name} ${e.airports.join('/')} · ${formatZ(e.eto)}`, { direction: 'top' })
        .addTo(g);
    }
    if (fitted.current !== route) {
      fitted.current = route;
      fitRoute();
    }
  }, [route, parsed, refLon, theme]);

  // 공항 (비행 등급 색)
  useEffect(() => {
    if (!mapRef.current) return;
    const g = group('airports');
    if (!layers.airports) return;
    let alive = true;
    const stations = flightStations(flight.dep, flight.arr, parsed);
    void loadAirports()
      .catch(() => ({}) as Record<string, [number, number, string]>)
      .then((db) => {
        if (!alive) return;
        for (const st of stations) {
          const m = wx.metars[st.icao]?.data;
          const pos = db[st.icao] ?? (m?.lat != null && m.lon != null ? [m.lat, m.lon, ''] : null);
          if (!pos) continue;
          const cat = m?.fltCat;
          const color = cat ? cssVar(`--cat-${cat.toLowerCase()}`) : cssVar('--text-dim');
          L.marker([pos[0], nearLon(pos[1], refLon)], {
            icon: L.divIcon({ className: 'apt-icon', iconSize: [64, 22], iconAnchor: [8, 11], html: `<i style="background:${color}"></i><span>${st.icao}</span>` }),
          })
            .bindPopup(
              `<b>${st.icao}</b> ${st.roles.join('/')} ${cat ?? ''}<br>${pos[2] ?? ''}<pre>${(m?.raw ?? 'METAR 없음').replace(/</g, '&lt;')}</pre>${m ? `<small>${formatDayZ(m.obsTime)}</small>` : ''}`,
            )
            .addTo(g);
        }
      });
    return () => {
      alive = false;
    };
  }, [layers.airports, wx.metars, flight, parsed, refLon, theme]);

  // SIGMET 다각형 (유효한 것만)
  useEffect(() => {
    if (!mapRef.current) return;
    const g = group('sigmet');
    if (!layers.sigmet) return;
    for (const s of wx.sigmets?.data ?? []) {
      if (Date.parse(s.validTo) <= now) continue;
      const severe = /^(TS|CONVECTIVE|VA|TC)$/.test(s.hazard);
      const color = cssVar(severe ? '--bad' : '--warn');
      for (const poly of s.polys) {
        const off = nearLon(poly[0][1], refLon) - poly[0][1];
        L.polygon(
          poly.map(([la, lo]) => [la, lo + off] as L.LatLngTuple),
          { color, weight: 1.5, fillColor: color, fillOpacity: 0.12 },
        )
          .bindPopup(`<b>${s.hazard}</b> ${s.fir} ${s.qualifier ?? ''}<br>${formatDayZ(s.validFrom)}–${formatZ(s.validTo)}<pre>${s.raw.replace(/</g, '&lt;')}</pre>`)
          .addTo(g);
      }
    }
  }, [layers.sigmet, wx.sigmets, refLon, now, theme]);

  // 바람 화살표 (웨이포인트 순항고도)
  useEffect(() => {
    if (!mapRef.current) return;
    const g = group('wind');
    if (!layers.wind || wx.winds?.flightId !== flight.flightId) return;
    for (const p of wx.winds.data.points) {
      if (p.dir == null || p.spd == null) continue;
      L.marker([p.lat, nearLon(p.lon, refLon)], { icon: windIcon(p.dir, p.spd, p.temp != null ? fmtTemp(p.temp) : ''), interactive: true, keyboard: false })
        .bindTooltip(`${p.name} ${fmtFl(p.fl)} · ${fmtWind(p.dir, p.spd)} · ${p.temp != null ? fmtTemp(p.temp) : '—'}°C · ${formatZ(p.time)}`, { direction: 'top' })
        .addTo(g);
    }
  }, [layers.wind, wx.winds, flight.flightId, refLon]);

  // FIR 경계 (비공식 공개 자료) — 루트 근처만, 루트가 지나는 FIR은 굵게 + OFP 이름
  const [firMeta, setFirMeta] = useState<{ source: string; commitDate: string | null } | null>(null);
  useEffect(() => {
    if (!mapRef.current) return;
    const g = group('fir');
    if (!layers.fir || !route.length) return;
    let alive = true;
    const onRoute = new Map((parsed ? firSequence(parsed).legs : []).map((l) => [l.icao, l.name]));
    const lats = route.map((p) => p.lat);
    const lons = route.map((p) => p.lon);
    const box = { s: Math.min(...lats) - 15, n: Math.max(...lats) + 15, w: Math.min(...lons) - 25, e: Math.max(...lons) + 25 };
    void loadFirs()
      .then((f) => {
        if (!alive) return;
        setFirMeta({ source: f.source, commitDate: f.commitDate });
        const line = cssVar('--text-dim');
        const hot = cssVar('--accent');
        for (const fir of f.firs) {
          const on = onRoute.has(fir.id);
          for (const poly of fir.polys) {
            const off = nearLon(poly[0][1], refLon) - poly[0][1];
            const pts = poly.map(([la, lo]) => [la, lo + off] as L.LatLngTuple);
            if (!on && !pts.some(([la, lo]) => la >= box.s && la <= box.n && lo >= box.w && lo <= box.e)) continue;
            L.polygon(pts, { pane: 'ne', color: on ? hot : line, weight: on ? 1.6 : 0.8, opacity: on ? 0.9 : 0.5, dashArray: '4 4', fill: false, interactive: on })
              .bindTooltip(`${fir.id} ${onRoute.get(fir.id) || fir.name}${on ? ' · 항로 통과' : ''} · 경계 = 비공식 공개 자료(참고)`, { sticky: true })
              .addTo(g);
          }
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [layers.fir, route, parsed, refLon, theme]);

  // PIREP · 열대저기압 · G-AIRMET (D-060)
  const extra = useWxExtra();
  useEffect(() => {
    void loadExtraCache().then(() => refreshExtra());
  }, [route]);
  useEffect(() => {
    if (!mapRef.current) return;
    const g = group('pirep');
    if (!layers.pirep) return;
    for (const p of extra.pirep?.data ?? []) {
      if (!p.turb && !p.icing) continue;
      const sev = /SEV|EXTRM/.test(`${p.turb ?? ''}${p.icing ?? ''}`);
      L.circleMarker([p.lat, nearLon(p.lon, refLon)], { radius: 5, color: cssVar(sev ? '--bad' : '--warn'), weight: 2, fillOpacity: 0.3 })
        .bindTooltip(`${p.aireP ? 'AIREP' : 'PIREP'} ${formatDayZ(p.obsTime)} ${p.fl != null ? `FL${p.fl}` : ''} ${p.turb ? `TB ${p.turb}` : ''} ${p.icing ? `IC ${p.icing}` : ''}`, { direction: 'top' })
        .bindPopup(`<pre>${p.raw.replace(/</g, '&lt;')}</pre>`)
        .addTo(g);
    }
  }, [layers.pirep, extra.pirep, refLon, theme]);
  useEffect(() => {
    if (!mapRef.current) return;
    const g = group('tc');
    if (!layers.tc) return;
    for (const c of extra.tc?.data ?? []) {
      L.marker([c.lat, nearLon(c.lon, refLon)], { icon: L.divIcon({ className: 'tc-icon', iconSize: [90, 22], iconAnchor: [9, 11], html: `<i>🌀</i><span>${c.name}</span>` }) })
        .bindPopup(`<b>${c.name}</b> ${c.level}<br>${c.severity ?? ''}<br><small>GDACS 재난 경보 — 항공 공식 아님</small>`)
        .addTo(g);
    }
  }, [layers.tc, extra.tc, refLon, theme]);
  useEffect(() => {
    if (!mapRef.current) return;
    const g = group('gairmet');
    if (!layers.gairmet) return;
    const color = cssVar('--warn');
    for (const a of extra.gairmet?.data ?? []) {
      if (a.expire && Date.parse(a.expire) <= now) continue;
      const off = nearLon(a.poly[0][1], refLon) - a.poly[0][1];
      L.polygon(
        a.poly.map(([la, lo]) => [la, lo + off] as L.LatLngTuple),
        { color, weight: 1, dashArray: '2 3', fillColor: color, fillOpacity: 0.06 },
      )
        .bindPopup(`<b>G-AIRMET ${a.hazard}</b> ${a.base ?? ''}${a.top ? `–${a.top}` : ''}<br>${formatDayZ(a.validTime)} · 만료 ${formatZ(a.expire)}`)
        .addTo(g);
    }
  }, [layers.gairmet, extra.gairmet, refLon, now, theme]);

  const toggle = (k: LayerKey) =>
    setLayers((s) => {
      const n = { ...s, [k]: !s[k] };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(n));
      } catch {
        /* ignore */
      }
      return n;
    });

  const satT = SAT_LAYERS.map((l) => satTimes[l.id]).filter(Boolean).sort();
  return (
    <div className="map-page">
      <div className="map-toolbar">
        <div className="chips" role="group" aria-label="지도 레이어">
          <button className="chip" onClick={fitRoute} disabled={!route.length}>
            루트 보기
          </button>
          {(Object.keys(LAYER_LABEL) as LayerKey[]).map((k) => (
            <button key={k} className={`chip ${layers[k] ? 'on' : ''}`} aria-pressed={layers[k]} onClick={() => toggle(k)}>
              {LAYER_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="map-fresh">
          {layers.sigmet && <FreshTag kind="sigmet" label="SIGMET" refIso={wx.sigmets?.fetchedAt} now={now} />}
          {layers.wind && <FreshTag kind="winds" label={`바람 ${parsed ? fmtFl(parsed.header.cruiseFl) : ''}`} refIso={wx.winds?.flightId === flight.flightId ? wx.winds.fetchedAt : null} now={now} />}
          {layers.sat && <FreshTag kind="sat" label="위성 IR" refIso={satT[satT.length - 1]} now={now} />}
        </div>
      </div>
      <div ref={el} className="map-box" role="region" aria-label="기상 지도" />
      <p className="muted small">
        {layers.fir && firMeta && (
          <>
            FIR 경계 = VATSpy 공개 자료(CC BY-SA 4.0{firMeta.commitDate ? `, ${firMeta.commitDate.slice(0, 10)}` : ''}) — <b>비공식, 실제 경계와 다를 수 있음</b>. 진입 시각은 OFP 기준 ·{' '}
          </>
        )}
        루트 = OFP 웨이포인트 · 주황 원 = ETP · 공항 색 = METAR 비행 등급 · SIGMET 빨강 = 뇌우·화산재·열대저기압, 주황 = 난류·착빙 등 · 바람 화살표 = 불어가는 방향(웨이포인트 계획 고도) · 참고용, 공식 브리핑 대체 아님
      </p>
    </div>
  );
}
