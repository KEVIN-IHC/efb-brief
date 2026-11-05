// 계획 연료선 vs 실제 연료 점 + 착륙 예상 + 최소 착륙 연료(ALTN+FINAL) — SVG 직접 그림 (라이브러리 없음, 오프라인)
import { useLayoutEffect, useRef, useState } from 'react';
import { fmtHm, fmtKg } from '../../lib/format';
import type { OfpData } from '../ofp/types';
import { fuelDevLevel, type Projection, type WptCheck } from './deviation';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function FuelChart({ o, checks, proj }: { o: OfpData; checks: WptCheck[]; proj: Projection }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = W < 480 ? 220 : 260;
  const pad = { l: W < 480 ? 44 : 56, r: 12, t: 14, b: 26 };
  const route = o.route;
  const T = route[route.length - 1].cumMin || 1;
  const yMax = Math.max(route[0].fuelRem + route[0].burn! || 0, route[0].fuelRem, ...checks.map((c) => c.actual?.fuel ?? 0)) * 1.02;
  const yMin = Math.min(proj.minLanding * 0.8, ...[proj.landingIfTrend, proj.landingIfPlanBurn].filter((v): v is number => v !== undefined).map((v) => v * 0.95));
  const x = (min: number) => pad.l + (min / T) * (W - pad.l - pad.r);
  const y = (f: number) => pad.t + (1 - (f - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);

  const plan = route.map((w) => `${x(w.cumMin).toFixed(1)},${y(w.fuelRem).toFixed(1)}`).join(' ');
  const pts = checks.filter((c) => c.actual?.fuel != null);
  const actualLine = pts.map((c) => `${x(c.w.cumMin).toFixed(1)},${y(c.actual!.fuel!).toFixed(1)}`).join(' ');
  const lastF = proj.lastFuel;

  const hourTicks = Array.from({ length: Math.floor(T / 60 / (W < 480 ? 3 : 2)) + 1 }, (_, i) => i * (W < 480 ? 3 : 2) * 60);
  const yTicks = 4;
  const ys = Array.from({ length: yTicks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / yTicks);
  const short = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : fmtKg(v));

  return (
    <div ref={ref} className="fuelchart">
      <svg width={W} height={H} role="img" aria-label="계획 대비 실제 연료 그래프">
        {ys.map((v) => (
          <g key={v}>
            <line className="fc-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
            <text className="fc-tick" x={pad.l - 6} y={y(v) + 4} textAnchor="end">
              {short(v)}
            </text>
          </g>
        ))}
        {hourTicks.map((m) => (
          <text key={m} className="fc-tick" x={x(m)} y={H - 8} textAnchor="middle">
            {fmtHm(m)}
          </text>
        ))}
        {/* 최소 착륙 연료 */}
        <line className="fc-min" x1={pad.l} x2={W - pad.r} y1={y(proj.minLanding)} y2={y(proj.minLanding)} />
        <text className="fc-min-t" x={pad.l + 6} y={y(proj.minLanding) - 5} textAnchor="start">
          ALTN+FINAL {fmtKg(proj.minLanding)}
        </text>
        {/* 계획 */}
        <polyline className="fc-plan" points={plan} />
        {/* 예상 (마지막 실제 → 도착) */}
        {lastF && proj.landingIfPlanBurn !== undefined && (
          <line className="fc-proj" x1={x(lastF.w.cumMin)} y1={y(lastF.actual!.fuel!)} x2={x(T)} y2={y(proj.landingIfPlanBurn)} />
        )}
        {lastF && proj.landingIfTrend !== undefined && (
          <line className="fc-trend" x1={x(lastF.w.cumMin)} y1={y(lastF.actual!.fuel!)} x2={x(T)} y2={y(proj.landingIfTrend)} />
        )}
        {/* 실제 */}
        {pts.length > 1 && <polyline className="fc-act" points={actualLine} />}
        {pts.map((c) => (
          <circle key={c.w.seq} className={`fc-pt lv-${fuelDevLevel(o, c.fuelDev)}`} cx={x(c.w.cumMin)} cy={y(c.actual!.fuel!)} r={4.5}>
            <title>{`${c.w.name} ${fmtKg(c.actual!.fuel!)} (Δ ${fmtKg(c.fuelDev!)})`}</title>
          </circle>
        ))}
        {proj.landingIfPlanBurn !== undefined && (
          <text className="fc-end" x={x(T) - 4} y={y(proj.landingIfPlanBurn) - 8} textAnchor="end">
            {fmtKg(proj.landingIfPlanBurn)}
          </text>
        )}
      </svg>
      <div className="fc-legend small">
        <span className="lg lg-plan">계획 R/F</span>
        <span className="lg lg-act">실제</span>
        <span className="lg lg-proj">계획 소모 유지 시</span>
        {proj.landingIfTrend !== undefined && <span className="lg lg-trend">현 추세 지속 시</span>}
        <span className="lg lg-min">ALTN+FINAL</span>
      </div>
    </div>
  );
}
