// 플랜 뷰 (D-063 → D-107): 위에서 본 항로를 값마다 작은 지도 한 장(앞/뒷바람·난류·ISA·기온 2×2), 누르면 크게.
// 항로 = 한 줄(고른 값 색) · SIGMET·SR(OFP)·PIREP 겹침 · 웨이포인트 이름+ETO는 겹치지 않게 우선순위로 배치.
// 육지 윤곽 = 앱에 들어 있는 Natural Earth(오프라인). 버티컬 뷰와 같은 시각 선택을 쓴다
import { useEffect, useMemo, useState } from 'react';
import { bearingDeg } from '../../lib/geo';
import { loadLand, type LandGeo } from '../../lib/land';
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
  { id: 'turb', label: '난류 지수' },
  { id: 'isa', label: 'ISA 편차' },
  { id: 'temp', label: '기온' },
];
const FLS = ['plan', 290, 330, 370, 410] as const;
type FlSel = (typeof FLS)[number];

type Geo = LandGeo;

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
  /** 작은 지도 4장 중 크게 볼 하나 (D-107). 난류 창(focus)은 난류부터 크게 */
  const [big, setBig] = useState<Param | null>(focus ? 'turb' : null);
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
  const inView = (p: { lat: number; lon: number }) => {
    const [x, y] = P(p.lat, p.lon);
    return x >= -20 && x <= W + 20 && y >= -20 && y <= H + 20;
  };
  const selMs = mode === 'fixed' && t != null ? t : now;
  const activeSig = (sigmets?.data ?? []).filter((s) => Date.parse(s.validFrom) - 3_600_000 <= selMs && selMs <= Date.parse(s.validTo));
  const pr = (pireps?.data ?? []).filter((p) => p.turb || edrFromRaw(p.raw) != null);
  const arrowEvery = Math.max(1, Math.ceil(samples.length / 18));
  const etoOf = new Map(o.route.map((w) => [w.seq, w.eto]));
  const z = (seq: number) => {
    const e = etoOf.get(seq);
    return e ? `${e.slice(11, 13)}${e.slice(14, 16)}Z` : '';
  };
  const srZones = turbulenceZones(o.route);
  /** FIR 진입 지점 (ADIZ는 FIR 경계 아님) */
  const isFir = (w: { fir?: string }) => !!w.fir && !/^ADIZ/.test(w.fir);
  const srEnds = new Set(srZones.flatMap((zz) => [zz.from.seq, zz.to.seq]));
  // 웨이포인트 이름 우선순위: 출발·도착 > TOC·TOD·FIR 진입·ETP > SR 끝 > 이름 지점 > 좌표 지점
  const prio = (w: (typeof pts)[number], i: number) =>
    i === 0 || i === pts.length - 1 ? 0 : /^(TOC|TOD|ETP\d?)$/.test(w.name) || isFir(w) ? 1 : srEnds.has(w.seq) ? 2 : /^\d/.test(w.name) ? 4 : 3;

  /** 한 장 그리기. big = 크게(이름 + ETO·FL 모두), 작으면 중요한 이름만 크게 */
  const drawMap = (param: Param, big: boolean) => {
    const sc = big ? 1 : 1.9; // 작은 지도는 화면에 반쯤 줄어 보이므로 글자·선을 키워 그림
    const LW = (big ? 7 : 6) * (big ? 1 : 1.6);
    const fs = 12.5 * sc;
    const boxes: { x: number; y: number; w: number; h: number }[] = [];
    const hit = (b: { x: number; y: number; w: number; h: number }) => boxes.some((q) => b.x < q.x + q.w && b.x + b.w > q.x && b.y < q.y + q.h && b.y + b.h > q.y);
    const labels: JSX.Element[] = [];
    const order = pts.map((w, i) => ({ w, i, p: prio(w, i) })).filter((x) => (view.zone ? inView(x.w) : true) && (big || view.zone ? x.p <= 4 : x.p <= 2));
    for (const d of pts) {
      if (!inView(d)) continue;
      const [x, y] = P(d.lat, d.lon);
      boxes.push({ x: x - 5 * sc, y: y - 5 * sc, w: 10 * sc, h: 10 * sc });
    }
    order.sort((a, b) => a.p - b.p || a.i - b.i);
    for (const { w, p } of order) {
      const [x, y] = P(w.lat, w.lon);
      const name = isFir(w) ? `${w.fir!.slice(0, 4)} FIR` : w.fir && /^ADIZ/.test(w.fir) ? 'ADIZ' : w.name;
      const sub = big || view.zone ? `${z(w.seq)}${w.fl > 0 ? ` · F${w.fl}` : ''}` : z(w.seq);
      const bw = Math.max(name.length * fs * 0.66, sub.length * fs * 0.58) + 6;
      const bh = fs * 2.1;
      let at: { x: number; y: number; w: number; h: number } | null = null;
      for (const [dx, dy] of [
        [8 * sc, -bh - 2 * sc],
        [8 * sc, 6 * sc],
        [-bw - 8 * sc, -bh - 2 * sc],
        [-bw - 8 * sc, 6 * sc],
        [-bw / 2, -bh - 10 * sc],
        [-bw / 2, 12 * sc],
      ]) {
        const b = { x: x + dx, y: y + dy, w: bw, h: bh };
        if (b.x < 2 || b.x + b.w > W - 2 || b.y < 2 || b.y + b.h > H - 2 || hit(b)) continue;
        at = b;
        break;
      }
      if (!at) continue;
      boxes.push(at);
      labels.push(
        <g key={`l${w.seq}`} className="pv-lbl">
          <text x={at.x + 3} y={at.y + fs} className={`pv-name ${p <= 1 ? 'key' : ''}`} style={{ fontSize: fs }}>
            {name}
          </text>
          <text x={at.x + 3} y={at.y + fs * 2} className="pv-eto" style={{ fontSize: fs * 0.82 }}>
            {sub}
          </text>
        </g>,
      );
    }
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="pv-svg" role="img" aria-label={`항로 평면도: ${PARAMS.find((x) => x.id === param)?.label}`}>
        <rect x={0} y={0} width={W} height={H} className="pv-sea" />
        {landPaths.map((d, i) => (
          <path key={i} d={d} className="pv-land" />
        ))}
        {ov.sigmet &&
          activeSig.flatMap((s) =>
            s.polys.map((poly, j) => (
              <polygon key={`${s.id}-${j}`} points={polyPoints(poly)} className="pv-sig" style={{ strokeWidth: 1.5 * sc }}>
                <title>{s.raw}</title>
              </polygon>
            )),
          )}
        {/* 항로 한 줄: 테두리 + 고른 값 색 */}
        <polyline points={pts.map((p) => P(p.lat, p.lon).join(',')).join(' ')} className="pv-route" style={{ strokeWidth: LW + 3 * sc }} />
        {view.zone && <polyline points={view.zone.map((p) => P(p.lat, p.lon).join(',')).join(' ')} className={`pv-zone pv-zone-${focus?.level ?? 'warning'}`} style={{ strokeWidth: LW * 2.6 }} />}
        {samples.slice(0, -1).map((s, i) => {
          const n = samples[i + 1];
          const [x1, y1] = P(s.lat, s.lon);
          const [x2, y2] = P(n.lat, n.lon);
          const v = valueOf(s, param);
          return (
            <line key={s.seq} x1={x1} y1={y1} x2={x2} y2={y2} className={`pv-seg ${colorClass(v, param)}`} style={{ strokeWidth: LW }}>
              <title>{`${s.name} ${z(s.seq)} FL${s.fl} · ${v ?? '—'}${UNIT[param]}`}</title>
            </line>
          );
        })}
        {/* OFP SR 구간 = 주황 괄호 점선 (D-107) */}
        {ov.sr &&
          !view.zone &&
          srZones.map((zz, i) => {
            const seg = pts.filter((p) => p.seq >= zz.from.seq && p.seq <= zz.to.seq);
            if (seg.length < 2) return null;
            const side = (k: number) =>
              seg
                .map((p, j) => {
                  const a = seg[Math.max(0, j - 1)];
                  const b = seg[Math.min(seg.length - 1, j + 1)];
                  const [ax, ay] = P(a.lat, a.lon);
                  const [bx, by] = P(b.lat, b.lon);
                  const L = Math.hypot(bx - ax, by - ay) || 1;
                  const [x, y] = P(p.lat, p.lon);
                  const o = k * (LW + 5 * sc);
                  return `${x - ((by - ay) / L) * o},${y + ((bx - ax) / L) * o}`;
                })
                .join(' ');
            return (
              <g key={`sr${i}`} className={`pv-srz pv-srz-${zz.level}`} style={{ strokeWidth: 2.2 * sc, strokeDasharray: `${5 * sc} ${3 * sc}` }}>
                <polyline points={side(1)} />
                <polyline points={side(-1)} />
              </g>
            );
          })}
        {param === 'wind' &&
          ov.arrows &&
          samples.map((s, i) => {
            if (i % arrowEvery || s.dir == null || s.spd == null) return null;
            const [x, y] = P(s.lat, s.lon);
            const len = (10 + Math.min(30, s.spd / 5)) * (big ? 1 : 1.4);
            const r = ((s.dir + 180) * Math.PI) / 180;
            return (
              <g key={`a${s.seq}`} className="pv-arrow" style={{ strokeWidth: 1.5 * sc }}>
                <line x1={x} y1={y} x2={x + Math.sin(r) * len} y2={y - Math.cos(r) * len} />
                <circle cx={x + Math.sin(r) * len} cy={y - Math.cos(r) * len} r={2.5 * sc} />
              </g>
            );
          })}
        {param === 'temp' &&
          ov.tropo &&
          samples.map((s, i) => {
            if (i % arrowEvery || s.tropo == null) return null;
            const [x, y] = P(s.lat, s.lon);
            return (
              <text key={`tp${s.seq}`} x={x + 5} y={y + 16 * sc} className="pv-txt pv-tropo" style={{ fontSize: 11 * sc }}>
                TP{s.tropo}
              </text>
            );
          })}
        {ov.pirep &&
          pr.map((p) => {
            const [x, y] = P(p.lat, p.lon);
            if (x < 0 || x > W || y < 0 || y > H) return null;
            const edr = edrFromRaw(p.raw);
            const sev = edr != null ? (edr >= 0.4 ? 3 : edr >= 0.2 ? 2 : 1) : /SEV|EXTRM/i.test(p.turb ?? '') ? 3 : /MOD/i.test(p.turb ?? '') ? 2 : 1;
            const k = 6 * sc;
            return (
              <path key={p.id} d={`M${x},${y - k} L${x + k},${y + k * 0.7} L${x - k},${y + k * 0.7} Z`} className={`vv-pirep vv-turb-${sev}`}>
                <title>{`${p.turb ?? ''}${edr != null ? ` EDR ${edr}` : ''} FL${p.fl ?? '?'} · ${formatZ(p.obsTime)} · ${p.raw}`}</title>
              </path>
            );
          })}
        {/* FIR 경계 = 항로를 가로지르는 막대 */}
        {pts.map((w, i) => {
          if (!isFir(w) || !inView(w)) return null;
          const a = pts[Math.max(0, i - 1)];
          const b = pts[Math.min(pts.length - 1, i + 1)];
          const [ax, ay] = P(a.lat, a.lon);
          const [bx, by] = P(b.lat, b.lon);
          const L = Math.hypot(bx - ax, by - ay) || 1;
          const [nx, ny] = [-(by - ay) / L, (bx - ax) / L];
          const [x, y] = P(w.lat, w.lon);
          const h = 14 * sc;
          return <line key={`f${w.seq}`} x1={x - nx * h} y1={y - ny * h} x2={x + nx * h} y2={y + ny * h} className="pv-firbar" style={{ strokeWidth: 2.5 * sc }} />;
        })}
        {/* 웨이포인트 점 */}
        {pts.map((w, i) =>
          inView(w) ? <circle key={`d${w.seq}`} cx={P(w.lat, w.lon)[0]} cy={P(w.lat, w.lon)[1]} r={(prio(w, i) <= 1 ? 4.5 : 3) * sc} className={`pv-dot ${prio(w, i) <= 1 ? 'key' : ''}`} style={{ strokeWidth: 1.6 * sc }} /> : null,
        )}
        {labels}
      </svg>
    );
  };

  /** 한 줄 요약 (시각 포함) */
  const summary = (param: Param): string => {
    const vals = samples.map((s) => ({ s, v: valueOf(s, param) })).filter((x): x is { s: Sample; v: number } => x.v != null);
    if (!vals.length) return '예보 없음 — Weather에서 갱신';
    const at = (x: { s: Sample }) => `${x.s.name} ${z(x.s.seq)}`;
    if (param === 'wind') {
      const head = vals.reduce((m, x) => (x.v < m.v ? x : m));
      const tail = vals.reduce((m, x) => (x.v > m.v ? x : m));
      return head.v < 0 ? `앞바람 최대 ${-head.v}kt @${at(head)}` : `앞바람 없음 · 뒷바람 최대 ${tail.v}kt @${at(tail)}`;
    }
    if (param === 'turb') {
      const spans: { a: Sample; b: Sample; lv: number }[] = [];
      for (const x of vals) {
        const last = spans.at(-1);
        if (x.v >= 2) {
          if (last && last.b === vals[vals.indexOf(x) - 1]?.s) {
            last.b = x.s;
            last.lv = Math.max(last.lv, x.v);
          } else spans.push({ a: x.s, b: x.s, lv: x.v });
        }
      }
      if (!spans.length) return '중 이상 없음 (모델 지수)';
      const f = spans[0];
      const where = f.a === f.b ? `${z(f.a.seq)} ${f.a.name}` : `${z(f.a.seq)}–${z(f.b.seq)} ${f.a.name}→${f.b.name}`;
      return `중 이상 ${spans.length}구간 · ${where}${spans.length > 1 ? ' 외' : ''}`;
    }
    if (param === 'isa') {
      const hi = vals.reduce((m, x) => (x.v > m.v ? x : m));
      const lo = vals.reduce((m, x) => (x.v < m.v ? x : m));
      const sg = (v: number) => `${v >= 0 ? '+' : ''}${v}`;
      return `최고 ISA${sg(hi.v)} @${at(hi)} · 최저 ISA${sg(lo.v)} @${at(lo)}`;
    }
    const lo = vals.reduce((m, x) => (x.v < m.v ? x : m));
    return `최저 ${lo.v}°C @${at(lo)}`;
  };

  const shown = big ? [big] : PARAMS.map((p) => p.id);
  return (
    <section className="card flush pv">
      <div className="card-title pad">
        <h3>{title}</h3>
        <span className="small muted mono">{mode === 'fixed' && t != null ? `${formatZ(new Date(t).toISOString())} · ${relLabel(t, now)}` : '지점 통과 시각'}</span>
      </div>
      <div className="pad vv-ctl">
        <div className="vv-toggles" role="group" aria-label="겹쳐 보기">
          {(
            [
              ['sigmet', 'SIGMET'],
              ['sr', 'SR 구간 (OFP)'],
              ['pirep', 'PIREP·EDR'],
              ['arrows', '바람 화살표'],
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
      {/* 동서로 긴 항로는 지도가 납작해서 2×2면 작음 → 4장을 위아래로 (D-107) */}
      <div className={`pv-grid ${big ? 'one' : H < 420 ? 'stack' : ''}`}>
        {shown.map((param) => (
          <div key={param} className="pv-cell">
            <button type="button" className="pv-cell-h" onClick={() => setBig(big ? null : param)} aria-expanded={!!big}>
              <b>{PARAMS.find((x) => x.id === param)?.label}</b>
              <span className="pv-sum">{summary(param)}</span>
              <span className="pv-key">
                {LEGEND[param].map(([c, l]) => (
                  <span key={l}>
                    <i className={`vv-k ${c}`} />
                    {l}
                  </span>
                ))}
              </span>
              <span className="pv-more">{big ? '← 4장 보기' : '크게 ⤢'}</span>
            </button>
            <div className="pv-map" onClick={() => setBig(big ? null : param)}>
              {drawMap(param, !!big || H < 420)}
            </div>
          </div>
        ))}
      </div>
      <div className="pad small pv-src">
        <span className="muted">출처</span>
        <span className="pv-s">
          <b>OFP</b> 항로·SR·FIR
        </span>
        <span className="pv-s">
          <b>Open-Meteo</b> 바람·기온·난류 지수 · {winds ? formatAgo(winds.fetchedAt, now) : '없음'}
        </span>
        <span className="pv-s">
          <b>AWC</b> SIGMET{sigmets ? ` · ${formatAgo(sigmets.fetchedAt, now)}` : ''}
        </span>
        {pireps && (
          <span className="pv-s">
            <b>AWC</b> PIREP · {formatAgo(pireps.fetchedAt, now)}
          </span>
        )}
        <details className="pv-how">
          <summary>ⓘ 어떻게 계산했나</summary>
          <ul>
            <li>항로 색 = 각 웨이포인트 통과 시각(또는 고른 시각)의 모델 예보를 고른 FL에서 기압면 보간</li>
            <li>앞/뒷바람 = 항로 방향 성분 · ISA 편차 = 예보 기온 − 표준대기</li>
            <li>난류 지수 = 기압면 사이 수직 풍속 차(VWS)·리처드슨 수(Ri)로 앱이 계산한 참고값 — 공식 EDR·WAFS 아님</li>
            <li>육지 = Natural Earth · 화살표 = 바람이 불어 가는 쪽</li>
          </ul>
        </details>
      </div>
    </section>
  );
}

const UNIT: Record<Param, string> = { wind: 'kt', isa: '°C', turb: '', temp: '°C' };
const LEGEND: Record<Param, [string, string][]> = {
  wind: [
    ['pv-good-2', '뒷 40+'],
    ['pv-good-1', '뒷'],
    ['pv-bad-1', '앞'],
    ['pv-bad-2', '앞 40+'],
  ],
  turb: [
    ['pv-turb-0', '없음'],
    ['vv-turb-1', '약'],
    ['vv-turb-2', '중'],
    ['vv-turb-3', '강'],
  ],
  isa: [
    ['pv-cold-2', '−10'],
    ['pv-mid', '±3'],
    ['pv-warm-2', '+10'],
  ],
  temp: [
    ['pv-cold-2', '−65↓'],
    ['pv-mid', '−55'],
    ['pv-warm-1', '−40↑'],
  ],
};
