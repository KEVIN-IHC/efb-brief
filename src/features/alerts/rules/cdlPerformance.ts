// CDL 항목에 성능 제한(Performance) 문구가 있음 → 원문 수치를 그대로 안내 (매뉴얼 원문 근거)
import type { AlertResult, AlertRule } from '../types';

/** 원문에서 "… reduced by …" / "… increased by …" 문장만 그대로 뽑는다 (계산·해석 없음) */
export function performanceLines(text: string): string[] {
  return text
    .replace(/[*_]/g, '')
    .split(/\n|¦|(?<=\.)\s+/)
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter((l) => /(reduced|increased) by/i.test(l));
}

export const cdlPerformance: AlertRule = {
  id: 'cdl-performance',
  name: 'CDL 성능 제한',
  threshold: 'manual',
  manualRef: { doc: 'CDL', chapter: '각 항목 Performance' },
  evaluate({ mel, manualDocs }) {
    const out: AlertResult[] = [];
    for (const m of mel) {
      if (m.kind !== 'CDL' || !m.item || !/Performance/i.test(m.item.text)) continue;
      const lines = performanceLines(m.item.text);
      const doc = manualDocs.find((d) => d.docId === m.item!.docId);
      out.push({
        key: m.itemNo,
        severity: 'caution',
        title: `CDL ${m.itemNo} ${m.item.title} — 성능 제한 있음`,
        detail: (lines.length ? lines.slice(0, 4).join(' / ') : '원문 Performance 항목 확인') + ' · 빠진 부품 수만큼 적용(원문 기준) — OFP 반영 여부는 운항관리 확인',
        basis: [{ kind: 'manual', label: `${doc?.docId ?? m.item.docId} ${doc?.issueDate ?? ''} · ${m.item.ref ?? m.item.itemNo}`, manual: { docId: m.item.docId, seq: m.item.pageSeq, mark: m.item.itemNo } }],
      });
    }
    return out;
  },
};
