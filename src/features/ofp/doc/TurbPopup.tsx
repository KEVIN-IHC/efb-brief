// 난류 SR 구간 창 (D-073·D-095): OFP·NAV LOG에서 구간을 누르면 그 자리 위에 확대 지도(플랜 뷰) + 단면(버티컬 뷰) + 지점 목록.
// "Map에서 크게 보기"는 Map 탭으로 가서 그 구간을 보여 주고, 맨 위 "돌아가기"로 이 창까지 되돌아온다
import { useEffect } from 'react';
import { goWithReturn } from '../../../app/returnTo';
import { fmtHm } from '../../../lib/format';
import { formatZ } from '../../../lib/time';
import { useActiveFlight } from '../../flight/activeFlight';
import { PlanView } from '../../vertical/PlanView';
import { VerticalView } from '../../vertical/VerticalView';
import { SR_BASIS, srLevel, turbulenceZones, useTurbFocus } from '../turbulence';
import { LevelPill } from './ui';

export function TurbPopup() {
  const f = useTurbFocus();
  const o = useActiveFlight((s) => s.ofp?.parsed ?? null);
  const close = () => useTurbFocus.setState({ popup: false });
  useEffect(() => {
    if (!f.popup) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', close);
    };
  }, [f.popup]);
  if (!f.popup || !o) return null;
  const z = turbulenceZones(o.route).find((x) => x.from.seq === f.from && x.to.seq === f.to);
  if (!z) return null;
  const i0 = o.route.indexOf(z.from);
  const i1 = o.route.indexOf(z.to);
  const pts = o.route.slice(i0, i1 + 1);
  const big = () => {
    const keep = { from: f.from, to: f.to };
    // 창을 닫고 Map 탭에서 그 구간으로 → 돌아가기 누르면 이 창 다시
    useTurbFocus.setState({ ...keep, popup: false, t: Date.now() });
    goWithReturn('#map', () => useTurbFocus.setState({ ...keep, popup: true, t: Date.now() }));
  };
  return (
    <div className="man-pop-backdrop" onClick={close}>
      <div className="man-pop" role="dialog" aria-modal="true" aria-label="난류 구간 지도" onClick={(e) => e.stopPropagation()}>
        <div className="man-inline">
          <div className="man-inline-bar">
            <span className="turb-pop-h">
              <LevelPill level={z.level}>{`SR ${z.maxSr}${z.level === 'warning' ? ' HIGH' : ''}`}</LevelPill>
              <b className="mono">
                {z.from.name} → {z.to.name}
              </b>
              <span className="mono muted">{z.fls}</span>
            </span>
            <div className="man-nav">
              <button className="btn small" onClick={big}>
                Map에서 크게 보기
              </button>
              <button className="btn small" onClick={close}>
                닫기
              </button>
            </div>
          </div>
          <p className="mono small">
            {formatZ(z.from.eto)}–{formatZ(z.to.eto)} · T/O +{fmtHm(z.from.cumMin)} ~ +{fmtHm(z.to.cumMin)} ({fmtHm(Math.max(0, z.to.cumMin - z.from.cumMin))})
          </p>
          <div className="turb-views">
            <PlanView focus={{ from: z.from.seq, to: z.to.seq, level: z.level }} title="이 구간 (위에서 본 모습)" />
            <VerticalView focus={{ from: z.from.seq, to: z.to.seq }} title="이 구간 (옆에서 본 단면)" />
          </div>
          <div className="table-wrap">
            <table className="dt">
              <thead>
                <tr>
                  <th>지점</th>
                  <th>FL</th>
                  <th className="r">ETO</th>
                  <th className="r">T/O +</th>
                  <th className="r">SR</th>
                </tr>
              </thead>
              <tbody>
                {pts.map((w) => (
                  <tr key={w.seq} className={`turb-${srLevel(w.sr)}`}>
                    <td className="mono strong">{w.name}</td>
                    <td className="mono">{w.flText ?? (w.fl ? `FL${w.fl}` : '—')}</td>
                    <td className="r mono">{formatZ(w.eto)}</td>
                    <td className="r mono">{fmtHm(w.cumMin)}</td>
                    <td className={`r mono ${srLevel(w.sr) === 'warning' ? 'c-bad' : srLevel(w.sr) === 'caution' ? 'c-caution' : ''}`}>{w.sr ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small man-foot">출처 = OFP NAV LOG SR · {SR_BASIS}</p>
        </div>
      </div>
    </div>
  );
}
