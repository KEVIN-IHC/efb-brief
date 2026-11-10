// 난류(SR) 구간 — OFP NAV LOG SR 값 (D-023 임시 기준)
import { SR_BASIS, turbulenceZones } from '../../ofp/turbulence';
import { FOM_REF, fomBasis } from '../fomRefs';
import type { AlertRule } from '../types';

export const turbulenceSr: AlertRule = {
  id: 'turbulence-sr',
  name: '난류 예상 구간 (SR)',
  threshold: 'temporary',
  evaluate(ctx) {
    const { o } = ctx;
    return turbulenceZones(o.route)
      .filter((z) => z.level === 'warning')
      .map((z) => ({
        key: `${z.from.name}-${z.to.name}`,
        severity: 'caution' as const,
        title: `HIGH SR ${z.maxSr} · ${z.from.name}–${z.to.name}`,
        detail: `${z.fls} · ${z.points.length}개 지점`,
        basis: [
          { kind: 'temporary' as const, label: `${SR_BASIS} (D-023)` },
          fomBasis(ctx, FOM_REF.srDef),
          ...(z.points[0].srcLine ? [{ kind: 'ofp' as const, label: `NAV LOG ${z.points[0].name}`, ofpLine: z.points[0].srcLine }] : []),
        ],
      }));
  },
};
