// 근거 절 목록 — 📖를 누르면 그 자리에서 원문 펼치기/접기 (D-062). Ops 상황 카드·우주기상 등에서 공용
import { BasisRow } from '../alerts/AlertsCard';
import { manualBasis } from '../brief/assess';
import type { RuleRef } from '../brief/rules';
import type { useBriefData } from '../brief/useBrief';
import { ManualInline } from './ManualInline';
import { setInlineOpen, useInlineOpen } from './lookup';

type Refs = ReturnType<typeof useBriefData>['refs'];

export function RefList({ refs, all, id }: { refs: RuleRef[]; all: Refs; id: string }) {
  const key = `ref:${id}`;
  const open = useInlineOpen((s) => s[key] ?? null);
  const setOpen = (v: string | null) => setInlineOpen(key, v);
  return (
    <ul className="ops-refs">
      {refs.map((r) => {
        const b = manualBasis(all, r);
        const can = !!b.manual;
        return (
          <li key={r.code}>
            <div className="ops-ref-row">
              <BasisRow b={b} open={open === r.code} onManual={can ? () => setOpen(open === r.code ? null : r.code) : undefined} />
            </div>
            {open === r.code && b.manual && (
              <div className="man-inline-wrap">
                <ManualInline target={b.manual} onClose={() => setOpen(null)} compact />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
