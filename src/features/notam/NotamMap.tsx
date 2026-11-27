// NOTAM 공항 지도 (D-110, 시안 J3 v4): 항로(회색) 위에 이 공항이 맡는 구간을 역할 색 차선으로.
// - ETP 공항: 담당 구간(출발→ETP1 · ETP k→k+1 · ETP→도착) · 3% ERA: 기준 지점 둘레 20% 구간 · 도착·교체: 도착 전 1시간
// - Refile 공항·교체: 결정 지점 + 결정 지점 → Refile 공항(→ 교체) 점선
// 글자는 글자색(역할색 아님), 역할은 옆의 짧은 색 막대. 같은 지점 끝 라벨은 하나로. 라벨끼리 겹치면 그 라벨은 생략.
// 오프라인: 육지 윤곽·공항 좌표는 앱에 같이 저장된 public/geo 파일.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { landRings, loadLand, type LandGeo } from '../../lib/land';
import type { OfpData } from '../ofp/types';
import { loadAirports } from '../weather/airports';
import { ROLE_LABEL, roleColor, winTime, type Window } from './relevance';

interface Pt {
  n: string;
  t: number;
  lat: number;
  x: number;
}
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const Z = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
};
/** 기준 경도(ref)에서 ±180° 안으로 */
const near = (lon: number, ref: number) => lon + 360 * Math.round((ref - lon) / 360);

export function NotamMap({ o, icao, wins }: { o: OfpData; icao: string; wins: Window[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [land, setLand] = useState<LandGeo | null>(null);
  const [aps, setAps] = useState<Record<string, [number, number, string]> | null>(null);
  useEffect(() => {
    loadLand().then(setLand).catch(() => undefined);
    loadAirports().then(setAps).catch(() => undefined);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const R = useMemo(() => {
    const out: Pt[] = [];
    let prev = o.route[0]?.lon ?? 0;
    for (const w of o.route) {
      const t = Date.parse(w.eto);
      if (!Number.isFinite(w.lat) || !Number.isFinite(w.lon) || !Number.isFinite(t)) continue;
      const x = near(w.lon, prev);
      prev = x;
      out.push({ n: w.name, t, lat: w.lat, x });
    }
    return out;
  }, [o.route]);

  const svg = useMemo(() => (W > 0 && R.length > 1 ? drawMap({ W, R, icao, wins, o, land, aps }) : null), [W, R, icao, wins, o, land, aps]);

  const hasSeg = wins.some((w) => w.seg || (w.at && w.role !== '3% ERA'));
  return (
    <div className="ntm-map" ref={ref}>
      <div className="ntm-map-legend">
        {wins.map((w, i) => (
          <span key={i}>
            <span className="ntm-key" style={{ background: roleColor(w.role) }} />
            <b>{ROLE_LABEL[w.role ?? ''] ?? w.role ?? '비행'}</b>
            <small className="mono">
              {winTime(w)}
              {w.seg ? (w.seg.from === w.seg.to ? ` · 결정 지점 ${w.seg.from} ${Z(w.seg.fromT)}` : ` · ${w.seg.from}→${w.seg.to}`) : ''}
            </small>
          </span>
        ))}
        {!hasSeg && <span className="muted">이 공항은 항로 담당 구간 없음 (비행 전체 · 앱 기준)</span>}
      </div>
      {svg}
      {!aps && <p className="small muted ntm-map-note">공항 좌표를 불러오는 중…</p>}
    </div>
  );
}

function drawMap({ W, R, icao, wins, o, land, aps }: { W: number; R: Pt[]; icao: string; wins: Window[]; o: OfpData; land: LandGeo | null; aps: Record<string, [number, number, string]> | null }): ReactNode {
  const small = W < 600;
  const fs = small ? 12 : 15;
  const fsB = small ? 14 : 17;
  const H = Math.round(Math.max(240, Math.min(480, W * 0.52)));
  const cRef = R[Math.floor(R.length / 2)].x;
  const apXY = (c?: string): [number, number] | null => {
    const a = c && aps?.[c];
    return a ? [near(a[1], cRef), a[0]] : null;
  };

  // 역할마다 구간 (route 점)
  const segOf = (w: Window): Pt[] => {
    if (w.seg && w.seg.from !== w.seg.to) return R.filter((x) => x.t >= w.seg!.fromT - 60e3 && x.t <= w.seg!.toT + 60e3);
    if (w.at && !w.seg && w.role !== '3% ERA' && w.role !== 'DEP') return R.filter((x) => x.t >= w.at!.t - 3.6e6 && x.t <= w.at!.t + 60e3);
    if (w.role === 'DEP') return R.filter((x) => x.t <= R[0].t + 3.6e6);
    return [];
  };
  const segs = wins.map((w) => ({ w, s: segOf(w) })).filter((x) => x.s.length > 1);
  // Refile: 결정 지점 → Refile 공항 (→ 교체)
  const rf = wins.find((w) => w.role === 'REFILE' || w.role === 'REFILE ALTN');
  const rfP = rf && o.refile ? R.find((x) => x.n === o.refile!.point) : undefined;
  const rfPath: [number, number][] = rfP
    ? [[rfP.x, rfP.lat], ...[o.refile!.airport, ...(rf!.role === 'REFILE ALTN' && o.refile!.altn ? [o.refile!.altn] : [])].map(apXY).filter((p): p is [number, number] => !!p)]
    : [];
  const ap = apXY(icao);

  // 보기 범위
  const pts: [number, number][] = [...segs.flatMap((x) => x.s.map((p) => [p.x, p.lat] as [number, number])), ...rfPath, ...(ap ? [ap] : [])];
  const use = pts.length > 1 ? pts : R.map((p) => [p.x, p.lat] as [number, number]);
  const xs = use.map((p) => p[0]);
  const ys = use.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const sx = Math.max(14, Math.max(...xs) - Math.min(...xs));
  const sy = Math.max(8, Math.max(...ys) - Math.min(...ys));
  const k = Math.cos((cy * Math.PI) / 180);
  const s = Math.min((W * 0.84) / (sx * k || 1), (H * 0.74) / sy);
  const P = (x: number, y: number): [number, number] => [W / 2 + (x - cx) * k * s, H / 2 - (y - cy) * s];
  const x0 = cx - W / 2 / (k * s) - 5;
  const x1 = cx + W / 2 / (k * s) + 5;
  const y0 = cy - H / 2 / s - 5;
  const y1 = cy + H / 2 / s + 5;

  const el: ReactNode[] = [];
  let key = 0;
  // 육지
  if (land) {
    for (const ring of landRings(land)) {
      const la = ring.map((c) => c[1]);
      if (Math.max(...la) < y0 || Math.min(...la) > y1) continue;
      const lo = ring.map((c) => c[0]);
      const a = Math.min(...lo);
      const b = Math.max(...lo);
      for (const d of [-720, -360, 0, 360, 720]) {
        if (b + d < x0 || a + d > x1) continue;
        el.push(<path key={key++} className="nm-land" d={ring.map((c, i) => `${i ? 'L' : 'M'}${P(c[0] + d, c[1]).map((v) => v.toFixed(1)).join(',')}`).join('') + 'Z'} />);
      }
    }
  }
  // 항로
  el.push(<polyline key={key++} className="nm-route" points={R.map((p) => P(p.x, p.lat).join(',')).join(' ')} />);
  // 차선 (여러 역할이면 나란히, 사이 2px 바다색 틈)
  const LW = 7;
  const GAP = 2;
  const nrm = (p: Pt, q: Pt) => {
    const [ax, ay] = P(p.x, p.lat);
    const [bx, by] = P(q.x, q.lat);
    const L = Math.hypot(bx - ax, by - ay) || 1;
    return [-(by - ay) / L, (bx - ax) / L];
  };
  const lanePts = (ss: Pt[], off: number) =>
    ss.map((p, j) => {
      const [nx, ny] = nrm(ss[Math.max(0, j - 1)], ss[Math.min(ss.length - 1, j + 1)]);
      const [x, y] = P(p.x, p.lat);
      return [x + nx * off, y + ny * off] as [number, number];
    });
  const lanes = segs.map((x, n) => ({ ...x, off: (n - (segs.length - 1) / 2) * (LW + GAP) }));
  for (const l of lanes) el.push(<polyline key={key++} className="nm-gap" strokeWidth={LW + GAP * 2} points={lanePts(l.s, l.off).map((p) => p.join(',')).join(' ')} />);
  for (const l of lanes) el.push(<polyline key={key++} className="nm-lane" stroke={roleColor(l.w.role)} strokeWidth={LW} points={lanePts(l.s, l.off).map((p) => p.join(',')).join(' ')} />);
  if (rfPath.length > 1) {
    const q = rfPath.map(([x, y]) => P(x, y).join(',')).join(' ');
    el.push(<polyline key={key++} className="nm-gap" strokeWidth={8} points={q} />);
    el.push(<polyline key={key++} className="nm-lane" stroke={roleColor(rf!.role)} strokeWidth={4} strokeDasharray="10 7" points={q} />);
  }

  // 끝점 (같은 지점은 라벨 하나)
  const ends = new Map<string, { p: Pt; roles: { r?: string; kind: string }[] }>();
  const addEnd = (p: Pt, r: string | undefined, kind: string) => {
    const kk = p.n + p.t;
    const e = ends.get(kk) ?? { p, roles: [] };
    e.roles.push({ r, kind });
    ends.set(kk, e);
  };
  for (const l of lanes) {
    addEnd(l.s[0], l.w.role, '시작');
    addEnd(l.s[l.s.length - 1], l.w.role, '끝');
  }
  if (rfP) addEnd(rfP, rf!.role, '결정 지점');
  const boxes: Box[] = [];
  const hit = (b: Box) => boxes.some((q) => b.x < q.x + q.w && b.x + b.w > q.x && b.y < q.y + q.h && b.y + b.h > q.y);
  for (const l of lanes) for (const [x, y] of lanePts(l.s, 0)) boxes.push({ x: x - 4, y: y - 4, w: 8, h: 8 });
  for (const e of ends.values()) {
    const [x, y] = P(e.p.x, e.p.lat);
    e.roles.forEach((r, j) => el.push(<circle key={key++} className="nm-end" cx={x} cy={y} r={5 - j} fill={roleColor(r.r)} />));
    boxes.push({ x: x - 7, y: y - 7, w: 14, h: 14 });
  }
  // 출발·도착 (작은 점)
  for (const p of [R[0], R[R.length - 1]]) {
    const [x, y] = P(p.x, p.lat);
    el.push(<circle key={key++} className="nm-term" cx={x} cy={y} r={4} />);
  }
  // 이 공항 (경보색 아님: 글자색 사각형)
  let apAt: [number, number] | null = null;
  if (ap) {
    const [x, y] = P(ap[0], ap[1]);
    el.push(<rect key={key++} className="nm-ap" x={x - 7} y={y - 7} width={14} height={14} rx={3} />);
    boxes.push({ x: x - 9, y: y - 9, w: 18, h: 18 });
    apAt = [x, y];
  }
  const place = (x: number, y: number, w: number, h: number): Box | null => {
    for (const [dx, dy] of [
      [12, -h - 6],
      [12, 8],
      [-w - 12, -h - 6],
      [-w - 12, 8],
      [-w / 2, -h - 16],
      [-w / 2, 18],
      [24, -h / 2],
      [-w - 24, -h / 2],
    ]) {
      const b = { x: x + dx, y: y + dy, w, h };
      if (b.x < 4 || b.x + w > W - 4 || b.y < 4 || b.y + h > H - 4 || hit(b)) continue;
      boxes.push(b);
      return b;
    }
    return null;
  };
  const cw = fs * 0.62;
  if (apAt) {
    const [x, y] = apAt;
    const w = Math.max(icao.length * fsB * 0.72, 10 * cw) + 8;
    const h = fsB + fs + 10;
    const b = place(x, y, w, h);
    if (b)
      el.push(
        <g key={key++}>
          <line className="nm-lead" x1={x} y1={y} x2={b.x < x ? b.x + w : b.x} y2={b.y + h / 2} />
          <text className="nm-t nm-strong" x={b.x + 4} y={b.y + fsB} fontSize={fsB}>
            {icao}
          </text>
        </g>,
      );
  }
  for (const e of ends.values()) {
    const [x, y] = P(e.p.x, e.p.lat);
    const t1 = `${e.p.n} ${Z(e.p.t)}`;
    const ks = e.roles.map((r) => (r.kind === '결정 지점' ? 'Refile 결정 지점' : `${ROLE_LABEL[r.r ?? ''] ?? r.r} ${r.kind}`));
    const w = Math.max(t1.length * fsB * 0.64, ...ks.map((q) => q.length * cw * 1.25 + 22)) + 8;
    const h = fsB + 6 + (fs + 4) * ks.length;
    const b = place(x, y, w, h);
    if (!b) continue;
    const lx = b.x + 4;
    el.push(
      <g key={key++}>
        <line className="nm-lead" x1={x} y1={y} x2={b.x < x ? b.x + w : b.x} y2={b.y + fsB / 2 + 2} />
        <text className="nm-t nm-strong mono" x={lx} y={b.y + fsB} fontSize={fsB}>
          {t1}
        </text>
        {e.roles.map((r, j) => {
          const yy = b.y + fsB + 4 + (fs + 4) * (j + 1);
          return (
            <g key={j}>
              <line x1={lx} y1={yy - fs / 3} x2={lx + 14} y2={yy - fs / 3} stroke={roleColor(r.r)} strokeWidth={5} strokeLinecap="round" />
              <text className="nm-t nm-dim" x={lx + 20} y={yy} fontSize={fs}>
                {ks[j]}
              </text>
            </g>
          );
        })}
      </g>,
    );
  }
  return (
    <svg className="ntm-map-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${icao} 담당 구간 지도`}>
      <rect className="nm-sea" width={W} height={H} />
      {el}
    </svg>
  );
}
