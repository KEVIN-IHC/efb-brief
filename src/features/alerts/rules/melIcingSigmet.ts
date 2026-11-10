// 결빙 관련 MEL + 루트 결빙(ICE) SIGMET (원본 명세 §12.2 예시). MEL 문구·SIGMET 원문을 근거로만, 가능 여부 판정 없음
import { sigmetNearRoute } from '../../weather/route';
import { SIGMET_NM } from './sigmetRoute';
import type { AlertResult, AlertRule } from '../types';

const ICING = /icing conditions?|anti-?ice|de-?ic(e|ing)/i;

export const melIcingSigmet: AlertRule = {
  id: 'mel-icing-sigmet',
  name: '결빙 관련 MEL × 결빙 SIGMET',
  threshold: 'manual',
  manualRef: { doc: 'MEL', chapter: '해당 항목 결빙 조건 문구' },
  evaluate({ o, mel, wx, now, manualDocs }) {
    const icingMel = mel.filter((m) => m.kind === 'MEL' && m.item && ICING.test(m.item.text));
    if (!icingMel.length) return [];
    const to = Date.parse(o.header.sta);
    const route = o.route.map((w) => ({ lat: w.lat, lon: w.lon }));
    const ice = (wx.sigmets?.data ?? []).filter((s) => /ICE|ICING/i.test(s.hazard) && Date.parse(s.validTo) > now && Date.parse(s.validFrom) < to && sigmetNearRoute(s, route, SIGMET_NM));
    if (!ice.length) return [];
    const out: AlertResult[] = [];
    for (const m of icingMel) {
      const it = m.item!;
      const doc = manualDocs.find((d) => d.docId === it.docId);
      const phrase = ICING.exec(it.text.replace(/[*_]/g, ''))?.[0] ?? 'icing';
      out.push({
        key: `${m.itemNo}:${ice.map((s) => s.id).join(',')}`,
        severity: 'warning',
        title: `결빙 관련 MEL ${m.itemNo} + 루트 결빙 SIGMET ${ice.length}건`,
        detail: `MEL 문구 "${phrase}" · ${ice.map((s) => `${s.firName ?? s.fir} ${s.validFrom.slice(11, 16)}–${s.validTo.slice(11, 16)}Z`).join(', ')} — MEL 조건 원문 확인`,
        basis: [
          { kind: 'manual', label: `${doc?.docId ?? it.docId} ${doc?.issueDate ?? ''} · ${it.ref ?? it.itemNo}`, manual: { docId: it.docId, seq: it.pageSeq, mark: phrase } },
          ...ice.map((s) => ({ kind: 'data' as const, label: s.raw.replace(/\s+/g, ' ').slice(0, 120) })),
          { kind: 'app', label: `앱 기준 · 결빙 문구 포함 MEL + ICE SIGMET 루트 ${SIGMET_NM}NM 이내` },
        ],
      });
    }
    return out;
  },
};
