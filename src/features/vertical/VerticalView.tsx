// 버티컬 뷰 (D-058): 항로 단면 SVG. 화면 폭이 좁으면 안에서만 가로 스크롤 (페이지 가로 스크롤 없음)
import { useMemo, useState } from 'react';
import { formatAgo, formatZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { firSequence } from '../fir/sequence';
import { useActiveFlight } from '../flight/activeFlight';
import { latestActuals, useFlightLogs } from '../inflight/actuals';
import { buildChecks, project, revisedEto } from '../inflight/deviation';
import { srLevel } from '../ofp/turbulence';
import { useWx } from '../weather/store';
import { plannedProfile, sigmetSpans, windCells } from './profile';

const W = 1000;
const H = 380;
const PAD = { l: 44, r: 12, t: 14, b: 40 };
const FL_MAX = 470;

export function VerticalView() {
  const { flight, ofp } = useActiveFlight();
  const o = ofp?.parsed ?? null;
  const logs = useFlightLogs(flight.flightId);
  const now = useNow(60_000);
  const winds = useWx((s) => (s.winds?.flightId === flight.flightId ? s.winds : null));
  const sigmets = useWx((s) => s.sigmets);
  const [show, setShow] = useState({ wind: true, temp: false, sigmet: true, sr: true });
  const proj = useMemo(() => (o ? project(o, buildChecks(o, latestActuals(logs))) : null), [o, logs]);

  const calc = useMemo(() => {
    if (!o?.route.length) return null;
    const total = o.route[o.route.length - 1].cumDist || 1;
    const profile = plannedProfile(o);
    const wc = windCells(o, winds?.data ?? null);
    const sg = sigmetSpans(o, sigmets?.data ?? [], now);
    const firs = firSequence(o).legs.filter((l) => l.entry).map((l) => ({ icao: l.icao, x: o.route.find((w) => w.seq === l.entry!.seq)?.cumDist ?? 0 }));
    return { total, profile, wc, sg, firs };
  }, [o, winds, sigmets, now]);

  if (!o || !calc) return null;
  const { total, profile, wc, sg, firs } = calc;
  const X = (nm: number) => PAD.l + (nm / total) * (W - PAD.l - PAD.r);
  const Y = (fl: number) => H - PAD.b - (Math.min(fl, FL_MAX) / FL_MAX) * (H - PAD.t - PAD.b);
  const hasLevels = wc.cells.length > 0;
  const oldCache = !!winds && !hasLevels;

  // 지금 위치 (계획 + 기록 편차)
  let nowX: number | null = null;
  if (proj) {
    const ts = o.route.map((w) => Date.parse(revisedEto(w, proj.timeDevMin)));
    const i = ts.findIndex((t) => t > now);
    if (i > 0) nowX = o.route[i - 1].cumDist + ((now - ts[i - 1]) / (ts[i] - ts[i - 1] || 1)) * (o.route[i].cumDist - o.route[i - 1].cumDist);
  }
  const msaPts = o.route.filter((w) => w.msa != null && w.msa > 0);
  const flTicks = [0, 100, 200, 300, 400];
  const labelEvery = Math.max(1, Math.ceil(o.route.length / 14));

  return (
    <section className="card flush vv">
      <div className="card-title pad">
        <h3>버티컬 뷰 (항로 단면)</h3>
        <div className="vv-toggles" role="group" aria-label="단면 레이어">
          {(
            [
              ['wind', '앞/뒷바람'],
              ['temp', 'ISA 편차'],
              ['sigmet', 'SIGMET'],
              ['sr', 'SR'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={`chip ${show[k] ? 'on' : ''}`} aria-pressed={show[k]} onClick={() => setShow({ ...show, [k]: !show[k] })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="vv-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="vv-svg" role="img" aria-label="항로 단면: 계획 고도와 고도별 바람·기상">
          {/* 바람·기온 칸 */}
          {(show.wind || show.temp) &&
            wc.cells.map((c, i) => {
              const v = show.temp ? c.isaDev : c.comp;
              if (v == null) return null;
              const scale = show.temp ? 15 : 120;
              const a = Math.min(1, Math.abs(v) / scale) * 0.55;
              const cls = show.temp ? (v >= 0 ? 'vv-warm' : 'vv-cold') : v >= 0 ? 'vv-tail' : 'vv-head';
              return <rect key={i} x={X(c.x0)} y={Y(c.fl1)} width={Math.max(0.5, X(c.x1) - X(c.x0))} height={Math.max(0.5, Y(c.fl0) - Y(c.fl1))} className={cls} opacity={a} />;
            })}
          {/* 눈금 */}
          {flTicks.map((f) => (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(f)} y2={Y(f)} className="vv-grid" />
              <text x={PAD.l - 6} y={Y(f) + 4} className="vv-ax" textAnchor="end">
                {f === 0 ? 'SFC' : `FL${f}`}
              </text>
            </g>
          ))}
          {/* FIR 경계 */}
          {firs.map((f) => (
            <g key={`${f.icao}-${f.x}`}>
              <line x1={X(f.x)} x2={X(f.x)} y1={PAD.t} y2={H - PAD.b} className="vv-fir" />
              <text x={X(f.x) + 3} y={PAD.t + 10} className="vv-ax">
                {f.icao}
              </text>
            </g>
          ))}
          {/* MSA (OFP) */}
          {msaPts.length > 1 && <polyline className="vv-msa" points={msaPts.map((w) => `${X(w.cumDist)},${Y(w.msa!)}`).join(' ')} />}
          {/* 결빙고도 */}
          {calc.wc.freezing.length > 1 && <polyline className="vv-frz" points={calc.wc.freezing.map((p) => `${X(p.x)},${Y(p.fl)}`).join(' ')} />}
          {/* SIGMET */}
          {show.sigmet &&
            sg.map((s) => (
              <g key={s.id}>
                <rect x={X(s.x0) - 4} width={Math.max(8, X(s.x1) - X(s.x0) + 8)} y={Y(s.top ?? FL_MAX)} height={Y(s.base ?? 0) - Y(s.top ?? FL_MAX)} className={`vv-sig ${s.top == null || s.base == null ? 'vv-sig-open' : ''}`}>
                  <title>{s.raw}</title>
                </rect>
                <text x={X(s.x0)} y={Y(s.top ?? FL_MAX) + 12} className="vv-sigt">
                  {s.hazard}
                </text>
              </g>
            ))}
          {/* SR */}
          {show.sr &&
            o.route.map((w) => {
              const lv = srLevel(w.sr);
              if (lv === 'none' || !w.fl) return null;
              return <circle key={w.seq} cx={X(w.cumDist)} cy={Y(w.fl)} r={5} className={`vv-sr vv-sr-${lv}`} />;
            })}
          {/* 계획 고도 */}
          <polyline className="vv-plan" points={profile.map((p) => `${X(p.x)},${Y(p.fl)}`).join(' ')} />
          {/* ETP */}
          {o.etps.map((e) => {
            const w = o.route.find((r) => r.name === e.name);
            if (!w) return null;
            return (
              <g key={e.name}>
                <line x1={X(w.cumDist)} x2={X(w.cumDist)} y1={Y(w.fl || o.header.cruiseFl) - 18} y2={Y(w.fl || o.header.cruiseFl) + 18} className="vv-etp" />
                <text x={X(w.cumDist)} y={Y(w.fl || o.header.cruiseFl) - 22} textAnchor="middle" className="vv-ax vv-etpt">
                  {e.name}
                </text>
              </g>
            );
          })}
          {/* 지금 */}
          {nowX != null && (
            <g>
              <line x1={X(nowX)} x2={X(nowX)} y1={PAD.t} y2={H - PAD.b} className="vv-now" />
              <text x={X(nowX) + 3} y={H - PAD.b - 4} className="vv-ax vv-nowt">
                지금
              </text>
            </g>
          )}
          {/* 지점 이름 */}
          {o.route.map((w, i) =>
            i % labelEvery === 0 || i === o.route.length - 1 ? (
              <text key={w.seq} x={X(w.cumDist)} y={H - PAD.b + 14} className="vv-ax" textAnchor="middle">
                {w.name}
              </text>
            ) : null,
          )}
          <text x={W - PAD.r} y={H - 6} textAnchor="end" className="vv-ax">
            {Math.round(total)} NM
          </text>
        </svg>
      </div>
      <div className="pad small vv-legend">
        <span>
          <i className="vv-k vv-k-plan" /> 계획 고도 (OFP)
        </span>
        <span>
          <i className="vv-k vv-k-msa" /> MSA (OFP)
        </span>
        <span>
          <i className="vv-k vv-k-frz" /> 0°C 고도 (예보)
        </span>
        {show.wind && !show.temp && (
          <span>
            <i className="vv-k vv-tail" /> 뒷바람 <i className="vv-k vv-head" /> 앞바람
          </span>
        )}
        {show.temp && (
          <span>
            <i className="vv-k vv-warm" /> ISA+ <i className="vv-k vv-cold" /> ISA−
          </span>
        )}
        <span>
          <i className="vv-k vv-k-sig" /> SIGMET (점선 = 고도 없음)
        </span>
      </div>
      <p className="pad small muted">
        출처: 계획 고도·MSA·SR·ETP·FIR = <b>OFP</b> · 바람·기온·0°C 고도 = <b>Open-Meteo 모델 예보</b>
        {winds ? ` (받음 ${formatAgo(winds.fetchedAt, now)}${winds.data.basis === 'now' ? ', 비행 시각이 예보 범위 밖이라 현재 시각 기준' : ', 지점 ETO 기준'})` : ' (아직 받지 않음 — Weather에서 갱신)'} · SIGMET = <b>AWC 발표</b>
        {sigmets ? ` (받음 ${formatAgo(sigmets.fetchedAt, now)})` : ''}. 공식 WAFS 난류·착빙·CB 예보가 아님 — 참고용.
        {oldCache && <span className="c-caution"> 예전 형식 바람 자료 — Weather에서 다시 받으면 고도별 칸이 나옵니다.</span>}
        {proj && nowX != null && ` 지금 위치 = 계획 + 기록 편차 (${formatZ(new Date(now).toISOString())}).`}
      </p>
    </section>
  );
}
