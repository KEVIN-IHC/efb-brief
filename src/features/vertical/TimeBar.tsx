// 기상 시각 선택 (D-063·D-065): 지점 통과 시각(ETO) ↔ 한 시각 고정 + 슬라이더·재생. 지금 기준 몇 시간 전/후인지 항상 표시
// 시각 목록 = 지난 위성 영상 시각(관측) + 모델 예보 시각. Map 탭 위에 하나 → 지도·버티컬·플랜 뷰가 같이 움직인다
import { useEffect, useMemo, useState } from 'react';
import { formatDayZ } from '../../lib/time';
import { relLabel, useWxTime } from './wxTime';

const nearestMs = (list: number[], ms: number) => list.reduce((b, v, i) => (Math.abs(v - ms) < Math.abs(list[b] - ms) ? i : b), 0);

/** 두 목록을 합쳐 정렬, 10분 안에 겹치면 하나만 */
export function mergeTimes(...lists: number[][]): number[] {
  const all = lists.flat().filter(Number.isFinite).sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of all) if (!out.length || t - out[out.length - 1] >= 10 * 60_000) out.push(t);
  return out;
}

export function TimeBar({ times, now, etoRange, note }: { times: number[]; now: number; etoRange: [number, number] | null; note?: string }) {
  const { mode, t } = useWxTime();
  const [playing, setPlaying] = useState(false);
  const k = useMemo(() => (times.length ? nearestMs(times, t ?? now) : 0), [times, t, now]);

  useEffect(() => {
    if (!playing || !times.length) return;
    const id = setInterval(() => {
      const s = useWxTime.getState();
      const cur = nearestMs(times, s.t ?? now);
      useWxTime.setState({ mode: 'fixed', t: times[cur >= times.length - 1 ? 0 : cur + 1] });
    }, 1200);
    return () => clearInterval(id);
  }, [playing, times, now]);

  if (!times.length) return <p className="small muted wxt">시간대별 자료 없음 — Weather에서 갱신하면 시간 슬라이더가 열립니다.</p>;

  const sel = times[k];
  const setFixed = (ms: number) => useWxTime.setState({ mode: 'fixed', t: ms });

  return (
    <div className="wxt">
      <div className="segmented" role="radiogroup" aria-label="예보 시각 기준">
        <button role="radio" aria-checked={mode === 'eto'} className={mode === 'eto' ? 'on' : ''} onClick={() => (setPlaying(false), useWxTime.setState({ mode: 'eto' }))}>
          지점 통과 시각
        </button>
        <button role="radio" aria-checked={mode === 'fixed'} className={mode === 'fixed' ? 'on' : ''} onClick={() => setFixed(t ?? now)}>
          시각 고정 · 재생
        </button>
      </div>
      {mode === 'eto' ? (
        <p className="small wxt-label">
          바람·기온 = 각 지점을 지나는 예정 시각의 예보
          {etoRange && (
            <>
              {' '}
              (<b className="mono">{relLabel(etoRange[0], now)}</b> ~ <b className="mono">{relLabel(etoRange[1], now)}</b>)
            </>
          )}
          {' '}· 위성·SIGMET = 지금
        </p>
      ) : (
        <div className="wxt-fixed">
          <div className="wxt-row">
            <button className={`btn small ${playing ? 'primary' : ''}`} onClick={() => setPlaying((p) => !p)} aria-label={playing ? '멈춤' : '시간 흐름 재생'}>
              {playing ? '❚❚' : '▶'}
            </button>
            <input
              className="wxt-range"
              type="range"
              min={0}
              max={times.length - 1}
              step={1}
              value={k}
              onChange={(e) => (setPlaying(false), setFixed(times[Number(e.target.value)]))}
              aria-label="기상 시각"
            />
            <button className="btn small" onClick={() => (setPlaying(false), setFixed(now))}>
              지금
            </button>
          </div>
          <p className="small wxt-label">
            <b className="mono">{formatDayZ(new Date(sel).toISOString())}</b> · <b className={`mono ${sel < now - 1800_000 ? 'c-caution' : sel > now + 1800_000 ? 'c-ok' : ''}`}>{relLabel(sel, now)}</b>
            <span className="muted">
              {' '}
              · 범위 {relLabel(times[0], now)} ~ {relLabel(times[times.length - 1], now)}
            </span>
            {note && <span className="muted"> · {note}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
