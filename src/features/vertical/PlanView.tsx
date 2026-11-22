// 플랜 뷰 (D-063): 위에서 본 항로 — 선택 고도·시각의 바람·기온·난류 지수를 항로 색으로, SIGMET·PIREP 겹쳐 보기.
// 육지 윤곽 = 앱에 들어 있는 Natural Earth(오프라인). 버티컬 뷰와 같은 시각 선택을 쓴다
import { useEffect, useMemo, useState } from 'react';
import { bearingDeg } from '../../lib/geo';
import { formatAgo, formatZ } from '../../lib/time';
import type { OfpData } from '../ofp/types';
import { interpolateAtFl } from '../weather/decode';
import { useWxExtra } from '../weather/extra';
import { nearLon } from '../weather/route';
import { useWx } from '../weather/store';
import type { WindPoint } from '../weather/types';
import { flOfHpa, tropopauseFl } from './profile';
import { turbulenceZones } from '../ofp/turbulence';
import { useWxPick } from './useWxPick';
import { edrFromRaw, relLabel, shearLayers, type PointAt } from './wxTime';

type Param = 'wind' | 'isa' | 'turb' | 'temp';
const PARAMS: { id: Param; label: string }[] = [
  { id: 'wind', label: '앞/뒷바람' },
  { id: 'isa', label: 'ISA 편차' },
  { id: 'turb', label: '난류 지수' },
  { id: 'temp', label: '기온' },
];
const FLS = ['plan', 290, 330, 370, 410] as const;
type FlSel = (typeof FLS)[number];

type Geo = { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
let landCache: Promise<Geo> | null = null;
const loadLand = () => (landCache ??= fetch(new URL('./geo/land.json', location.href).href).then((r) => r.json() as Promise<Geo>));

const W = 1000;
const isaTemp = (fl: number) => Math.max(-56.5, 15 - 1.98 * (fl / 10));

interface Sample {
  seq: number;
  name: string;
  lat: number;
  lon: number;
  fl: number;
  track: number;
  dir: number | null;
  spd: number | null;
  temp: number | null;
  turb: 0 | 1 | 2 | 3 | null;
  vws: number | null;
  /** 권계면 (근사) FL */
  tropo: number | null;
}

function sampleAt(o: OfpData, p: WindPoint, at: PointAt | null, flSel: FlSel): Sample | null {
  const i = o.route.findIndex((w) => w.seq === p.seq);
  if (i < 0 || !at) return null;
  const w = o.route[i];
  const nb = o.route[i + 1] ?? o.route[i - 1];
  const track = nb ? (o.route[i + 1] ? bearingDeg(w, nb) : bearingDeg(nb, w)) : 0;
  const fl = flSel === 'plan' ? (w.fl > 0 ? w.fl : o.header.cruiseFl) : flSel;
  const v = interpolateAtFl(fl, at.levels);
  const layer = shearLayers(at.levels, flOfHpa).find((s) => flOfHpa(s.hpaLow) <= fl && fl <= flOfHpa(s.hpaHigh));
  return { seq: p.seq, name: p.name, lat: w.lat, lon: w.lon, fl, track, ...v, turb: layer?.level ?? null, vws: layer?.vws ?? null, tropo: tropopauseFl(at.levels) };
}

function valueOf(s: Sample, param: Param): number | null {
  if (param === 'wind') return s.spd != null && s.dir != null ? -Math.round(s.spd * Math.cos(((s.dir - s.track) * Math.PI) / 180)) : null;
  if (param === 'isa') return s.temp != null ? Math.round(s.temp - isaTemp(s.fl)) : null;
  if (param === 'temp') return s.temp != null ? Math.round(s.temp) : null;
  return s.turb;
}

function colorClass(v: number | null, param: Param): string {
  if (v == null) return 'pv-none';
  if (param === 'turb') return `pv-turb-${v}`;
  if (param === 'wind') return v >= 40 ? 'pv-good-2' : v >= 0 ? 'pv-good-1' : v > -40 ? 'pv-bad-1' : 'pv-bad-2';
  if (param === 'isa') return v >= 10 ? 'pv-warm-2' : v >= 3 ? 'pv-warm-1' : v > -3 ? 'pv-mid' : v > -10 ? 'pv-cold-1' : 'pv-cold-2';
  return v >= -40 ? 'pv-warm-1' : v >= -55 ? 'pv-mid' : v >= -65 ? 'pv-cold-1' : 'pv-cold-2';
}

/** focus = 이 구간(지점 seq)만 확대하고 강조 (난류 SR 창, D-073). title = 머리 글 바꾸기 */
export function PlanView({ focus, title = '플랜 뷰 (위에서 본 항로)' }: { focus?: { from: number; to: number; level?: 'caution' | 'warning' }; title?: string } = {}) {
  const { o, winds, now, pick, mode, t } = useWxPick();
  const sigmets = useWx((s) => s.sigmets);
  const pireps = useWxExtra((s) => s.pirep);
  const [param, setParam] = useState<Param>('wind');
  const [flSel, setFlSel] = useState<FlSel>('plan');
  /** 겹쳐 보기 (D-099): 항로 색은 하나, 그 위에 여러 층 */
  const [ov, setOv] = useState({ arrows: true, sigmet: true, pirep: true, sr: true, tropo: false });
  const [land, setLand] = useState<Geo | null>(null);
  useEffect(() => {
    void loadLand().then(setLand, () => setLand(null));
  }, []);

  const view = useMemo(() => {
    if (!o?.route.length) return null;
    // 날짜변경선: 첫 점 기준으로 경도를 이어 붙임
    let prev = o.route[0].lon;
    const pts = o.route.map((w) => {
      const lon = nearLon(w.lon, prev);
      prev = lon;
      return { ...w, lon };
    });
    const i0 = focus ? pts.findIndex((p) => p.seq === focus.from) : -1;
    const i1 = focus ? pts.findIndex((p) => p.seq === focus.to) : -1;
    const box = i0 >= 0 && i1 >= i0 ? pts.slice(i0, i1 + 1) : pts;
    const lats = box.map((p) => p.lat);
    const lons = box.map((p) => p.lon);
    const pad = box === pts ? 4 : 6;
    const minLat = Math.max(-85, Math.min(...lats) - pad);
    const maxLat = Math.min(85, Math.max(...lats) + pad);
    const minLon = Math.min(...lons) - pad;
    const maxLon = Math.max(...lons) + pad;
    const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const spanX = (maxLon - minLon) * k;
    const spanY = maxLat - minLat;
    const H = Math.max(260, Math.min(700, Math.round((W * spanY) / spanX)));
    const sc = Math.min(W / spanX, H / spanY);
    const ox = (W - spanX * sc) / 2;
    const oy = (H - spanY * sc) / 2;
    const midLon = (minLon + maxLon) / 2;
    const Praw = (lat: number, lon: number) => [ox + (lon - minLon) * k * sc, oy + (maxLat - lat) * sc] as const;
    const P = (lat: number, lon: number) => Praw(lat, nearLon(lon, midLon));
    return { pts, H, P, Praw, minLat, maxLat, minLon, maxLon, midLon, zone: box === pts ? null : box };
  }, [o, focus?.from, focus?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const samples = useMemo(() => {
    if (!o || !winds) return [];
    return winds.data.points.map((p) => sampleAt(o, p, pick(p), flSel)).filter((s): s is Sample => !!s);
  }, [o, winds, pick, flSel]);

  const landPaths = useMemo(() => {
    if (!land || !view) return [];
    const { Praw, minLat, maxLat, minLon, maxLon } = view;
    const out: string[] = [];
    for (const f of land.features) {
      const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      for (const poly of polys) {
        const ring = poly[0];
        if (!ring?.length) continue;
        const lo = ring.map((c) => c[0]);
        const la = ring.map((c) => c[1]);
        if (Math.max(...la) < minLat || Math.min(...la) > maxLat) continue;
        // 고리 전체를 같은 만큼(−360·0·+360) 옮겨 화면과 겹치는 것만 — 꼭짓점마다 옮기면 날짜변경선에서 줄무늬가 생김
        const a = Math.min(...lo);
        const b = Math.max(...lo);
        for (const d of [-360, 0, 360]) {
          if (b + d < minLon || a + d > maxLon) continue;
          out.push(ring.map((c, i) => `${i ? 'L' : 'M'}${Praw(c[1], c[0] + d).map((v) => v.toFixed(1)).join(',')}`).join('') + 'Z');
        }
      }
    }
    return out;
  }, [land, view]);

  if (!o || !view) return null;
  const { pts, H, P } = view;
  /** 다각형은 꼭짓점을 앞 점에 이어 붙인 뒤 통째로 화면 쪽으로 옮김 (꼭짓점마다 옮기면 날짜변경선에서 띠가 생김) */
  const polyPoints = (poly: [number, number][]) => {
    let prev = poly[0]?.[1] ?? 0;
    const un = poly.map(([la, lo]) => {
      const l = nearLon(lo, prev);
      prev = l;
      return [la, l] as const;
    });
    const off = (un.length ? nearLon(un[0][1], view.midLon) : 0) - (un[0]?.[1] ?? 0);
    return un.map(([la, lo]) => view.Praw(la, lo + off).join(',')).join(' ');
  };
  const inView = (p: { lat: number; lon: number }) => { const [x, y] = P(p.lat, p.lon); return x >= -20 && x <= W + 20 && y >= -20 && y <= H + 20; };
  const selMs = mode === 'fixed' && t != null ? t : now;
  const activeSig = (sigmets?.data ?? []).filter((s) => Date.parse(s.validFrom) - 3_600_000 <= selMs && selMs <= Date.parse(s.validTo));
  const pr = (pireps?.data ?? []).filter((p) => p.turb || edrFromRaw(p.raw) != null);
  const arrowEvery = Math.max(1, Math.ceil(samples.length / 18));
  const unit = param === 'wind' ? 'kt' : param === 'turb' ? '' : '°C';

  return (
    <section className="card flush pv">
      <div className="card-title pad">
        <h3>{title}</h3>
        <span className="small muted mono">{mode === 'fixed' && t != null ? `${formatZ(new Date(t).toISOString())} · ${relLabel(t, now)}` : '지점 통과 시각'}</span>
      </div>
      <div className="pad vv-ctl">
        <label className="small vv-sel">
          <span className="muted">표시</span>
          <select className="input" value={param} onChange={(e) => setParam(e.target.value as Param)} aria-label="항로 색">
            {PARAMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="vv-toggles" role="group" aria-label="겹쳐 보기">
          {(
            [
              ['arrows', '바람 화살표'],
              ['sigmet', 'SIGMET'],
              ['pirep', 'PIREP·EDR'],
              ['sr', 'SR 구간 (OFP)'],
              ['tropo', '권계면 높이'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={`chip ${ov[k] ? 'on' : ''}`} aria-pressed={ov[k]} onClick={() => setOv({ ...ov, [k]: !ov[k] })}>
              {l}
            </button>
          ))}
        </div>
        <div className="segmented" role="radiogroup" aria-label="고도">
          {FLS.map((f) => (
            <button key={f} role="radio" aria-checked={flSel === f} className={flSel === f ? 'on' : ''} onClick={() => setFlSel(f)}>
              {f === 'plan' ? '계획 FL' : `FL${f}`}
            </button>
          ))}
        </div>
      </div>
      <div className="vv-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="pv-svg" role="img" aria-label="항로 평면도: 선택 고도의 바람·기온·난류 지수">
          <rect x={0} y={0} width={W} height={H} className="pv-sea" />
          {landPaths.map((d, i) => (
            <path key={i} d={d} className="pv-land" />
          ))}
          {/* SIGMET (선택 시각에 유효) */}
          {ov.sigmet &&
            activeSig.flatMap((s) =>
            s.polys.map((poly, j) => (
              <polygon key={`${s.id}-${j}`} points={polyPoints(poly)} className="pv-sig">
                <title>{s.raw}</title>
              </polygon>
            )),
          )}
          {/* 계획 항로 (회색 바탕) */}
          <polyline points={pts.map((p) => P(p.lat, p.lon).join(',')).join(' ')} className="pv-route" />
          {/* 강조 구간 (난류 SR) */}
          {view.zone && <polyline points={view.zone.map((p) => P(p.lat, p.lon).join(',')).join(' ')} className={`pv-zone pv-zone-${focus?.level ?? 'warning'}`} />}
          {/* 예보 값 색 */}
          {samples.slice(0, -1).map((s, i) => {
            const n = samples[i + 1];
            const [x1, y1] = P(s.lat, s.lon);
            const [x2, y2] = P(n.lat, n.lon);
            const v = valueOf(s, param);
            return (
              <line key={s.seq} x1={x1} y1={y1} x2={x2} y2={y2} className={`pv-seg ${colorClass(v, param)}`}>
                <title>{`${s.name} FL${s.fl} · ${v ?? '—'}${unit}${s.vws != null ? ` · VWS ${s.vws}` : ''}`}</title>
              </line>
            );
          })}
          {/* OFP SR 구간 (D-099) */}
          {ov.sr &&
            !view.zone &&
            turbulenceZones(o.route).map((z, i) => {
              const seg = pts.filter((p) => p.seq >= z.from.seq && p.seq <= z.to.seq);
              return seg.length > 1 ? <polyline key={`sr${i}`} points={seg.map((p) => P(p.lat, p.lon).join(',')).join(' ')} className={`pv-zone pv-zone-${z.level}`} /> : null;
            })}
          {/* 바람 화살표 (바람이 불어 가는 쪽) */}
          {samples.map((s, i) => {
            if (!ov.arrows || i % arrowEvery || s.dir == null || s.spd == null) return null;
            const [x, y] = P(s.lat, s.lon);
            const len = 10 + Math.min(30, s.spd / 5);
            const r = ((s.dir + 180) * Math.PI) / 180;
            const dx = Math.sin(r) * len;
            const dy = -Math.cos(r) * len;
            return (
              <g key={`a${s.seq}`} className="pv-arrow">
                <line x1={x} y1={y} x2={x + dx} y2={y + dy} />
                <circle cx={x + dx} cy={y + dy} r={2.5} />
                <text x={x + dx + 4} y={y + dy - 4} className="pv-txt">
                  {Math.round(s.spd)}
                </text>
              </g>
            );
          })}
          {/* 권계면 높이 (근사) */}
          {ov.tropo &&
            samples.map((s, i) => {
              if (i % arrowEvery || s.tropo == null) return null;
              const [x, y] = P(s.lat, s.lon);
              return (
                <text key={`tp${s.seq}`} x={x + 5} y={y + 16} className="pv-txt pv-tropo">
                  TP{s.tropo}
                </text>
              );
            })}
          {/* PIREP 난류·EDR */}
          {ov.pirep &&
            pr.map((p) => {
            const [x, y] = P(p.lat, p.lon);
            if (x < 0 || x > W || y < 0 || y > H) return null;
            const edr = edrFromRaw(p.raw);
            const sev = edr != null ? (edr >= 0.4 ? 3 : edr >= 0.2 ? 2 : 1) : /SEV|EXTRM/i.test(p.turb ?? '') ? 3 : /MOD/i.test(p.turb ?? '') ? 2 : 1;
            return (
              <path key={p.id} d={`M${x},${y - 6} L${x + 6},${y + 4} L${x - 6},${y + 4} Z`} className={`vv-pirep vv-turb-${sev}`}>
                <title>{`${p.turb ?? ''}${edr != null ? ` EDR ${edr}` : ''} FL${p.fl ?? '?'} · ${formatZ(p.obsTime)} · ${p.raw}`}</title>
              </path>
            );
          })}
          {/* 지점 이름 (드문드문) */}
          {pts.map((p, i) =>
            (view.zone ? inView(p) : i === 0 || i === pts.length - 1 || i % Math.max(1, Math.ceil(pts.length / 10)) === 0) ? (
              <text key={p.seq} x={P(p.lat, p.lon)[0] + 4} y={P(p.lat, p.lon)[1] + 12} className="pv-txt pv-wpt">
                {p.name}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      <div className="pad small vv-legend">
        {param === 'wind' && (
          <span>
            <i className="vv-k pv-good-2" /> 뒷바람 40kt+ <i className="vv-k pv-good-1" /> 뒷바람 <i className="vv-k pv-bad-1" /> 앞바람 <i className="vv-k pv-bad-2" /> 앞바람 40kt+
          </span>
        )}
        {param === 'isa' && (
          <span>
            <i className="vv-k pv-warm-2" /> ISA+10 <i className="vv-k pv-warm-1" /> +3 <i className="vv-k pv-mid" /> ±3 <i className="vv-k pv-cold-1" /> −3 <i className="vv-k pv-cold-2" /> −10
          </span>
        )}
        {param === 'temp' && (
          <span>
            <i className="vv-k pv-warm-1" /> −40°C 이상 <i className="vv-k pv-mid" /> −55 <i className="vv-k pv-cold-1" /> −65 <i className="vv-k pv-cold-2" /> 그 아래
          </span>
        )}
        {param === 'turb' && (
          <span>
            <i className="vv-k pv-turb-0" /> 없음 <i className="vv-k vv-turb-1" /> 약 <i className="vv-k vv-turb-2" /> 중 <i className="vv-k vv-turb-3" /> 강 (모델 지수)
          </span>
        )}
        <span>
          <i className="vv-k vv-k-sig" /> SIGMET (이 시각 유효)
        </span>
        <span>
          <i className="vv-k vv-k-pirep" /> PIREP 난류·EDR
        </span>
      </div>
      <p className="pad small muted">
        {winds ? `바람·기온 = Open-Meteo 모델 예보 (받음 ${formatAgo(winds.fetchedAt, now)})` : '바람 자료 없음 — Weather에서 갱신'} · 항로 = OFP · 육지 = Natural Earth · 화살표 = 바람이 불어 가는 쪽(숫자 kt). 난류 지수는 앱 계산 참고값(공식 EDR 아님).
      </p>
    </section>
  );
}
