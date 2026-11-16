// 난류(SR) 구간 블록 — NAV LOG SR 값으로 묶은 연속 구간
import { fmtHm } from '../../../lib/format';
import { formatZ } from '../../../lib/time';
import { SR_BASIS, SR_THRESHOLDS, turbulenceZones, type TurbZone } from '../turbulence';
import type { OfpData } from '../types';
import { DocSection, LevelPill } from './ui';

export function TurbulenceBlock({ o, onZone, className }: { o: OfpData; onZone?: (z: TurbZone) => void; className?: string }) {
  const zones = turbulenceZones(o.route);
  const high = zones.filter((z) => z.level === 'warning').length;
  return (
    <DocSection className={className} title="Turbulence · SR" meta={zones.length ? `${zones.length} ZONES${high ? ` · ${high} HIGH` : ''}` : 'NIL'}>
      {zones.length === 0 ? (
        <p className="muted small">SR {SR_THRESHOLDS.caution} 이상 구간 없음</p>
      ) : (
        <ul className="turb-list">
          {zones.map((z, i) => {
            const a = z.from.cumMin;
            const b = z.to.cumMin;
            return (
              <li key={i} className={`turb-item turb-${z.level}`}>
                <button className="turb-btn" onClick={onZone ? () => onZone(z) : undefined} disabled={!onZone} aria-label={onZone ? `${z.from.name}–${z.to.name} 지도에서 보기` : undefined}>
                  <span className="turb-top">
                    <LevelPill level={z.level}>{`SR ${z.maxSr}${z.level === 'warning' ? ' HIGH' : ''}`}</LevelPill>
                    <span className="mono strong">
                      {z.from.name} → {z.to.name}
                    </span>
                    <span className="mono turb-fl">{z.fls}</span>
                  </span>
                  <span className="turb-sub mono">
                    <span>{formatZ(z.from.eto)}–{formatZ(z.to.eto)}</span>
                    <span title="이륙 후 누적 시간 (accumulated time)">
                      T/O +{fmtHm(a)} ~ +{fmtHm(b)} ({fmtHm(Math.max(0, b - a))})
                    </span>
                    <span className="muted">{z.points.length}개 지점</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {onZone && zones.length > 0 && <p className="small muted">구간을 누르면 지도로 보여 줍니다.</p>}
      <p className="doc-foot muted">ACCUM = 이륙 후 누적 시간(NAV LOG 계획) · 구간 길이. {SR_BASIS}</p>
    </DocSection>
  );
}
