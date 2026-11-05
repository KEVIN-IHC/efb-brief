// 난류(SR) 구간 블록 — NAV LOG SR 값으로 묶은 연속 구간
import { formatZ } from '../../../lib/time';
import { SR_BASIS, SR_THRESHOLDS, turbulenceZones } from '../turbulence';
import type { OfpData } from '../types';
import { DocSection, LevelPill } from './ui';

export function TurbulenceBlock({ o, onWpt }: { o: OfpData; onWpt?: (name: string) => void }) {
  const zones = turbulenceZones(o.route);
  const high = zones.filter((z) => z.level === 'warning').length;
  return (
    <DocSection title="Turbulence · SR" meta={zones.length ? `${zones.length} ZONES${high ? ` · ${high} HIGH` : ''}` : 'NIL'}>
      {zones.length === 0 ? (
        <p className="muted small">SR {SR_THRESHOLDS.caution} 이상 구간 없음</p>
      ) : (
        <table className="dt">
          <thead>
            <tr>
              <th>FROM → TO</th>
              <th className="r">ETO</th>
              <th>FL</th>
              <th className="r">MAX SR</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z, i) => (
              <tr key={i} className={`turb-${z.level}`} onClick={onWpt ? () => onWpt(z.points[0].name) : undefined}>
                <td className="mono strong">
                  {z.from.name} → {z.to.name}
                  <div className="wpt-sub">{z.points.length}개 지점</div>
                </td>
                <td className="r mono">
                  {formatZ(z.from.eto)}–{formatZ(z.to.eto)}
                </td>
                <td className="mono">{z.fls}</td>
                <td className="r">
                  <LevelPill level={z.level}>{`SR ${z.maxSr}${z.level === 'warning' ? ' HIGH' : ''}`}</LevelPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="doc-foot muted">{SR_BASIS}</p>
    </DocSection>
  );
}
