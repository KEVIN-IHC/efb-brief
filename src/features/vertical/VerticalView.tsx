// 버티컬 뷰 (D-058): 항로 단면 SVG. 화면 폭이 좁으면 안에서만 가로 스크롤 (페이지 가로 스크롤 없음)
import { useId, useMemo, useState } from 'react';
import { gcDistanceNm } from '../../lib/geo';
import { formatAgo, formatZ } from '../../lib/time';
import { firSequence } from '../fir/sequence';
import { revisedEto } from '../inflight/deviation';
import { srLevel, turbulenceZones } from '../ofp/turbulence';
import { fmtHm } from '../../lib/format';
import type { OfpData } from '../ofp/types';
import { useWxExtra, type Pirep } from '../weather/extra';
import { useWx } from '../weather/store';
import { plannedProfile, sigmetSpans, windCells } from './profile';
import { useWxPick } from './useWxPick';
import { edrFromRaw, relLabel } from './wxTime';

const W = 1000;
const H = 380;
const PAD = { l: 44, r: 12, t: 14, b: 40 };
const FL_MAX = 520; // D-099: 100 hPa(FL530) 받음 → 권계면까지

type Bg = 'wind' | 'isa' | 'turb' | 'grad' | 'dT3' | 'none';
const BG: { id: Bg; label: string }[] = [
  { id: 'wind', label: '앞/뒷바람' },
  { id: 'isa', label: 'ISA 편차' },
  { id: 'turb', label: '난류 지수' },
  { id: 'grad', label: '기온 경도' },
  { id: 'dT3', label: '기온 변화 3h' },
  { id: 'none', label: '없음' },
];
const BG_KEY = 'efb.vv.bgs';
const FILL_BG: Bg[] = ['wind', 'isa', 'grad', 'dT3'];

/** PIREP·AIREP 중 난류·EDR 있는 것 → 항로 100NM 안이면 단면 위치 */
function pirepMarks(o: OfpData, list: Pirep[]) {
  const out: { id: string; x: number; fl: number; turb?: string; edr: number | null; raw: string; obsTime: string }[] = [];
  for (const p of list) {
    const edr = edrFromRaw(p.raw);
    if (p.fl == null || (!p.turb && edr == null)) continue;
    let best: { d: number; x: number } | null = null;
    for (const w of o.route) {
      const d = gcDistanceNm(w, p);
      if (!best || d < best.d) best = { d, x: w.cumDist };
    }
    if (best && best.d <= 100) out.push({ id: p.id, x: best.x, fl: p.fl, turb: p.turb, edr, raw: p.raw, obsTime: p.obsTime });
  }
  return out;
}

const turbSev = (t?: string, edr?: number | null) => (edr != null ? (edr >= 0.4 ? 3 : edr >= 0.2 ? 2 : 1) : /SEV|EXTRM/i.test(t ?? '') ? 3 : /MOD/i.test(t ?? '') ? 2 : 1);

/** focus = 이 구간(지점 seq)만 확대 (난류 SR 창, D-095). title = 머리 글 바꾸기 */
export function VerticalView({ focus, title = '버티컬 뷰 (항로 단면)' }: { focus?: { from: number; to: number }; title?: string } = {}) {
  const clipId = useId().replace(/:/g, '');
  const { o, winds, now, proj, dev, pick, etoRange, mode, t: selT } = useWxPick();
  const sigmets = useWx((s) => s.sigmets);
  const pireps = useWxExtra((s) => s.pirep);
  // 바탕은 여러 개 겹쳐 볼 수 있음 (D-099). 칸 색 2개 이상이면 옅게 겹침, 난류 지수는 빗금
  const [bgs, setBgsState] = useState<Bg[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(BG_KEY) ?? 'null') as Bg[] | null;
      return Array.isArray(v) ? v.filter((b) => BG.some((x) => x.id === b)) : ['wind'];
    } catch {
      return ['wind'];
    }
  });
  const toggleBg = (b: Bg) => {
    const next = b === 'none' ? [] : bgs.includes(b) ? bgs.filter((x) => x !== b) : [...bgs, b];
    setBgsState(next);
    try {
      localStorage.setItem(BG_KEY, JSON.stringify(next));
    } catch {
      /* 저장 못 해도 화면은 동작 */
    }
  };
  const fills = FILL_BG.filter((b) => bgs.includes(b));
  const [show, setShow] = useState({ sigmet: true, sr: true, pirep: true, tropo: true });

  const calc = useMemo(() => {
    if (!o?.route.length) return null;
    const total = o.route[o.route.length - 1].cumDist || 1;
    const profile = plannedProfile(o);
    const wc = windCells(o, winds?.data ?? null, pick);
    const sg = sigmetSpans(o, sigmets?.data ?? [], now);
    const firs = firSequence(o).legs.filter((l) => l.entry).map((l) => ({ icao: l.icao, x: o.route.find((w) => w.seq === l.entry!.seq)?.cumDist ?? 0 }));
    const pr = pirepMarks(o, pireps?.data ?? []);
    return { total, profile, wc, sg, firs, pr };
  }, [o, winds, sigmets, pireps, now, pick]);

  if (!o || !calc) return null;
  const { total, profile, wc, sg, firs, pr } = calc;
  // 보이는 거리 범위: 전체 또는 구간 앞뒤 여유 (구간 길이의 25%, 최소 80NM)
  const f0 = focus ? o.route.find((w) => w.seq === focus.from) : undefined;
  const f1 = focus ? o.route.find((w) => w.seq === focus.to) : undefined;
  const pad = f0 && f1 ? Math.max(80, (f1.cumDist - f0.cumDist) * 0.25) : 0;
  const r0 = f0 && f1 ? Math.max(0, f0.cumDist - pad) : 0;
  const r1 = f0 && f1 ? Math.min(total, f1.cumDist + pad) : total;
  const inRange = (nm: number) => nm >= r0 - 1 && nm <= r1 + 1;
  const X = (nm: number) => PAD.l + ((nm - r0) / (r1 - r0 || 1)) * (W - PAD.l - PAD.r);
  const Y = (fl: number) => H - PAD.b - (Math.min(fl, FL_MAX) / FL_MAX) * (H - PAD.t - PAD.b);
  const hasLevels = wc.cells.length > 0;
  const oldCache = !!winds && !hasLevels;

  // 지금 위치 (계획 + 기록 편차)
  const ts = o.route.map((w) => Date.parse(revisedEto(w, dev)));
  const xAt = (ms: number) => {
    const i = ts.findIndex((t) => t > ms);
    return i > 0 ? o.route[i - 1].cumDist + ((ms - ts[i - 1]) / (ts[i] - ts[i - 1] || 1)) * (o.route[i].cumDist - o.route[i - 1].cumDist) : null;
  };
  const nowX = proj ? xAt(now) : null;
  // 시각 고정이면 그 시각에 있을 위치
  const selX = mode === 'fixed' && selT != null && Math.abs(selT - now) > 1800_000 ? xAt(selT) : null;
  const msaPts = o.route.filter((w) => w.msa != null && w.msa > 0);
  const flTicks = [0, 100, 200, 300, 400, 500];
  const visible = o.route.filter((w) => inRange(w.cumDist));
  const labelEvery = Math.max(1, Math.ceil(visible.length / 14));

  return (
    <section className="card flush vv">
      <div className="card-title pad">
        <h3>{title}</h3>
        <span className="small muted mono">{mode === 'fixed' && selT != null ? `${formatZ(new Date(selT).toISOString())} · ${relLabel(selT, now)}` : etoRange ? '지점 통과 시각' : '지금'}</span>
      </div>
      <div className="pad vv-ctl">
        <div className="vv-toggles" role="group" aria-label="바탕 (여러 개 겹치기)">
          <span className="small muted">바탕</span>
          {BG.filter((b) => b.id !== 'none').map((b) => (
            <button key={b.id} className={`chip ${bgs.includes(b.id) ? 'on' : ''}`} aria-pressed={bgs.includes(b.id)} onClick={() => toggleBg(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
        <div className="vv-toggles" role="group" aria-label="겹쳐 보기">
          {(
            [
              ['sigmet', 'SIGMET'],
              ['sr', 'SR 구간 (OFP)'],
              ['pirep', 'PIREP·EDR'],
              ['tropo', '권계면'],
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
          <defs>
            {[1, 2, 3].map((lv) => (
              <pattern key={lv} id={`${clipId}-h${lv}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" className={`vv-hatch-l vv-turb-${lv}`} strokeWidth={lv + 1} />
              </pattern>
            ))}
            <clipPath id={clipId}>
              <rect x={PAD.l} y={0} width={W - PAD.l - PAD.r} height={H - PAD.b + 2} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
          {/* 바탕 칸: 바람·기온·기온 변화 */}
          {fills.map((fb) =>
            wc.cells.map((c, i) => {
              const v = fb === 'isa' ? c.isaDev : fb === 'grad' ? c.grad : fb === 'dT3' ? c.dT3 : c.comp;
              if (v == null) return null;
              const scale = fb === 'isa' ? 15 : fb === 'grad' ? 3 : fb === 'dT3' ? 4 : 120;
              const a = (Math.min(1, Math.abs(v) / scale) * 0.6) / Math.sqrt(fills.length);
              const cls = fb === 'wind' ? (v >= 0 ? 'vv-tail' : 'vv-head') : v >= 0 ? 'vv-warm' : 'vv-cold';
              const unit = fb === 'wind' ? 'kt' : fb === 'grad' ? '°C/100NM' : '°C';
              return (
                <rect key={`${fb}${i}`} x={X(c.x0)} y={Y(c.fl1)} width={Math.max(0.5, X(c.x1) - X(c.x0))} height={Math.max(0.5, Y(c.fl0) - Y(c.fl1))} className={cls} opacity={a}>
                  <title>{`${c.hpa}hPa · ${BG.find((x) => x.id === fb)?.label} ${v > 0 ? '+' : ''}${v}${unit}${c.temp != null ? ` · ${Math.round(c.temp)}°C` : ''}`}</title>
                </rect>
              );
            }),
          )}
          {/* 난류 지수 (VWS·Ri) */}
          {bgs.includes('turb') &&
            wc.turb.map((c, i) =>
              c.level === 0 ? null : (
                <rect key={i} x={X(c.x0)} y={Y(c.fl1)} width={Math.max(0.5, X(c.x1) - X(c.x0))} height={Math.max(0.5, Y(c.fl0) - Y(c.fl1))} className={`vv-turb vv-turb-${c.level} ${fills.length ? 'vv-hatch' : ''}`} style={fills.length ? { fill: `url(#${clipId}-h${c.level})`, opacity: 1 } : undefined}>
                  <title>{`FL${c.fl0}–${c.fl1} · VWS ${c.vws} kt/1000ft · Ri ${c.ri ?? '—'}`}</title>
                </rect>
              ),
            )}
          {/* 눈금 */}
          {flTicks.map((f) => (
            <line key={f} x1={PAD.l} x2={W - PAD.r} y1={Y(f)} y2={Y(f)} className="vv-grid" />
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
          {wc.freezing.length > 1 && <polyline className="vv-frz" points={wc.freezing.map((p) => `${X(p.x)},${Y(p.fl)}`).join(' ')} />}
          {/* 권계면 (근사, D-099) */}
          {show.tropo && wc.tropo.length > 1 && (
            <polyline className="vv-tropo" points={wc.tropo.map((p) => `${X(p.x)},${Y(p.fl)}`).join(' ')}>
              <title>{`권계면 (근사) FL${Math.min(...wc.tropo.map((p) => p.fl))}–${Math.max(...wc.tropo.map((p) => p.fl))}`}</title>
            </polyline>
          )}
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
          {/* SR 구간 (OFP, D-069): 계획 고도 ±1,000ft 띠 + 이륙 후 시간 */}
          {show.sr &&
            turbulenceZones(o.route).map((z, i) => {
              const fls = z.points.map((p) => p.fl).filter((f) => f > 0);
              const lo = (fls.length ? Math.min(...fls) : o.header.cruiseFl) - 10;
              const hi = (fls.length ? Math.max(...fls) : o.header.cruiseFl) + 10;
              return (
                <g key={`z${i}`}>
                  <rect x={X(z.from.cumDist)} width={Math.max(6, X(z.to.cumDist) - X(z.from.cumDist))} y={Y(hi)} height={Math.max(6, Y(lo) - Y(hi))} className={`vv-srz vv-srz-${z.level}`}>
                    <title>{`SR ${z.maxSr} · ${z.from.name}→${z.to.name} · ${z.fls} · T/O +${fmtHm(z.from.cumMin)}~+${fmtHm(z.to.cumMin)}`}</title>
                  </rect>
                  <text x={X(z.from.cumDist) + 2} y={Y(hi) - 4} className={`vv-srzt vv-srzt-${z.level}`}>
                    SR{z.maxSr} +{fmtHm(z.from.cumMin)}
                  </text>
                </g>
              );
            })}
          {show.sr &&
            o.route.map((w) => {
              const lv = srLevel(w.sr);
              if (lv === 'none' || !w.fl) return null;
              return <circle key={w.seq} cx={X(w.cumDist)} cy={Y(w.fl)} r={5} className={`vv-sr vv-sr-${lv}`} />;
            })}
          {/* PIREP·AIREP (난류·EDR) */}
          {show.pirep &&
            pr.map((p) => {
              const cx = X(p.x);
              const cy = Y(p.fl);
              return (
                <path key={p.id} d={`M${cx},${cy - 7} L${cx + 7},${cy + 5} L${cx - 7},${cy + 5} Z`} className={`vv-pirep vv-turb-${turbSev(p.turb, p.edr)}`}>
                  <title>{`${p.turb ?? ''}${p.edr != null ? ` EDR ${p.edr}` : ''} · ${formatZ(p.obsTime)} · ${p.raw}`}</title>
                </path>
              );
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
          {selX != null && (
            <g>
              <line x1={X(selX)} x2={X(selX)} y1={PAD.t} y2={H - PAD.b} className="vv-sel-t" />
              <text x={X(selX) + 3} y={PAD.t + 24} className="vv-ax vv-selt">
                {relLabel(selT!, now)}
              </text>
            </g>
          )}
          </g>
          {flTicks.map((f) => (
            <text key={f} x={PAD.l - 6} y={Y(f) + 4} className="vv-ax" textAnchor="end">
              {f === 0 ? 'SFC' : `FL${f}`}
            </text>
          ))}
          {/* 지점 이름 */}
          {visible.map((w, i) =>
            i % labelEvery === 0 || i === visible.length - 1 ? (
              <text key={w.seq} x={X(w.cumDist)} y={H - PAD.b + 14} className="vv-ax" textAnchor="middle">
                {w.name}
              </text>
            ) : null,
          )}
          <text x={W - PAD.r} y={H - 6} textAnchor="end" className="vv-ax">
            {focus ? `${Math.round(r0)}–${Math.round(r1)} / ${Math.round(total)} NM` : `${Math.round(total)} NM`}
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
        {show.tropo && (
          <span>
            <i className="vv-k vv-k-tropo" /> 권계면 (근사)
          </span>
        )}
        {bgs.includes('wind') && (
          <span>
            <i className="vv-k vv-tail" /> 뒷바람 <i className="vv-k vv-head" /> 앞바람
          </span>
        )}
        {bgs.includes('isa') && (
          <span>
            <i className="vv-k vv-warm" /> ISA+ <i className="vv-k vv-cold" /> ISA−
          </span>
        )}
        {bgs.includes('grad') && (
          <span>
            <i className="vv-k vv-warm" /> 앞으로 갈수록 따뜻 <i className="vv-k vv-cold" /> 차가움 (°C/100NM)
          </span>
        )}
        {bgs.includes('dT3') && (
          <span>
            <i className="vv-k vv-warm" /> 3시간 사이 오름 <i className="vv-k vv-cold" /> 내림
          </span>
        )}
        {bgs.includes('turb') && (
          <span>
            <i className="vv-k vv-turb-1" /> 약 <i className="vv-k vv-turb-2" /> 중 <i className="vv-k vv-turb-3" /> 강 (모델 지수)
          </span>
        )}
        {show.pirep && (
          <span>
            <i className="vv-k vv-k-pirep" /> PIREP 난류·EDR (100NM 안, 3시간)
          </span>
        )}
        <span>
          <i className="vv-k vv-k-sig" /> SIGMET (점선 = 고도 없음)
        </span>
      </div>
      <p className="pad small muted">
        출처: 계획 고도·MSA·SR·ETP·FIR = <b>OFP</b> · 바람·기온·0°C 고도 = <b>Open-Meteo 모델 예보</b>
        {winds ? ` (받음 ${formatAgo(winds.fetchedAt, now)}${winds.data.basis === 'now' ? ', 비행 시각이 예보 범위 밖이라 현재 시각 앞뒤' : ''})` : ' (아직 받지 않음 — Weather에서 갱신)'} · SIGMET = <b>AWC 발표</b>
        {sigmets ? ` (받음 ${formatAgo(sigmets.fetchedAt, now)})` : ''} · PIREP = <b>AWC</b>
        {pireps ? ` (받음 ${formatAgo(pireps.fetchedAt, now)})` : ''}. 권계면 = 500 hPa 위에서 기온 감률이 처음 2 °C/km 이하가 되는 기압면(근사, 수천 ft 오차 가능). 바탕은 여러 개 겹치기 가능(난류 지수는 빗금). 난류 지수 = 기압면 사이 수직 풍속 차(VWS)·리처드슨 수(Ri)로 앱이 계산한 <b>참고 지수</b>(앱 임시 기준: VWS 4/6/9 kt/1000ft 또는 Ri 1/0.5/0.25) — 공식 EDR·WAFS 난류 예보가 아님. EDR 값은 자동 보고(AIREP)에 있을 때만 표시.
        {oldCache && <span className="c-caution"> 예전 형식 바람 자료 — Weather에서 다시 받으면 고도별 칸이 나옵니다.</span>}
        {proj && nowX != null && ` 지금 위치 = 계획 + 기록 편차 (${formatZ(new Date(now).toISOString())}).`}
      </p>
    </section>
  );
}
