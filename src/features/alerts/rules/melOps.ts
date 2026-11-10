// MEL 항목에 (o) 운항 절차·Return To Gate·Contact MCC 문구가 있음 → 확인 안내 (매뉴얼 원문 근거)
import { itemFlags } from '../../manual/lookup';
import type { AlertResult, AlertRule, Basis } from '../types';

export const melOps: AlertRule = {
  id: 'mel-ops',
  name: 'MEL 운항 절차',
  threshold: 'manual',
  manualRef: { doc: 'MEL', chapter: '각 항목 (o) 조건·OpsProc' },
  evaluate({ mel, manualDocs }) {
    const out: AlertResult[] = [];
    for (const m of mel) {
      if (m.kind !== 'MEL' || !m.item) continue;
      const f = itemFlags(m.item.text);
      const notes = f.notes.filter((n) => !/Performance|Fuel consumption/i.test(n));
      if (!f.ops && !notes.length) continue;
      const doc = manualDocs.find((d) => d.docId === m.item!.docId);
      const basis: Basis[] = [{ kind: 'manual', label: `${doc?.docId ?? m.item.docId} ${doc?.issueDate ?? ''} · ${m.item.ref ?? m.item.itemNo}`, manual: { docId: m.item.docId, seq: m.item.pageSeq, mark: m.item.itemNo } }];
      if (m.item.opsProcSeq !== undefined) basis.push({ kind: 'manual', label: `(o) 절차 ${m.item.itemNo}`, manual: { docId: m.item.docId, seq: m.item.opsProcSeq, mark: m.item.itemNo } });
      out.push({
        key: m.itemNo,
        severity: 'info',
        title: `MEL ${m.itemNo} ${m.item.title}${f.ops ? ' — (o) 절차 확인' : ''}`,
        detail: [m.item.repairInterval && `CAT ${m.item.repairInterval}`, ...notes].filter(Boolean).join(' · ') || undefined,
        basis,
      });
    }
    return out;
  },
};
