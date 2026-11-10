// OFP의 MEL/CDL이 가져온 매뉴얼에서 확인되지 않음 (매뉴얼 없음·번호 없음·상위 항목만)
import type { AlertResult, AlertRule } from '../types';

export const melUnmatched: AlertRule = {
  id: 'mel-unmatched',
  name: 'MEL/CDL 매뉴얼 미확인',
  threshold: 'app',
  evaluate({ mel, manualDocs }) {
    if (!mel.length) return [];
    const out: AlertResult[] = [];
    for (const kind of ['MEL', 'CDL'] as const) {
      const list = mel.filter((m) => m.kind === kind);
      if (!list.length) continue;
      if (!manualDocs.some((d) => d.kind === kind)) {
        out.push({ key: `nodoc:${kind}`, severity: 'info', title: `${kind} 매뉴얼 없음 — OFP ${kind} ${list.length}건 내용 확인 불가`, detail: 'Settings → 매뉴얼에서 가져오기', basis: [{ kind: 'app', label: '앱 기준 · 가져온 매뉴얼 목록' }] });
        continue;
      }
      for (const m of list) {
        if (m.how === 'exact' && m.aircraftOk !== false) continue;
        const why = m.how === 'none' ? '매뉴얼에서 번호를 찾지 못함' : m.how === 'parent' ? '하위 항목이 없어 상위 항목만 확인' : '다른 기종 매뉴얼에서만 찾음';
        out.push({ key: m.itemNo, severity: 'caution', title: `${kind} ${m.itemNo} — ${why}`, detail: '원본 MEL/CDL로 확인', basis: [{ kind: 'app', label: '앱 기준 · OFP 번호와 가져온 매뉴얼 항목 번호 대조' }] });
      }
    }
    return out;
  },
};
