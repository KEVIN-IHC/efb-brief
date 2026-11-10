// 루트 근처 SIGMET — 비행 시간대와 유효기간이 겹치고 루트 200NM 이내 (앱 기준, Weather 탭과 같은 판정)
import { sigmetNearRoute } from '../../weather/route';
import type { AlertRule } from '../types';

export const SIGMET_NM = 200;

export const sigmetRoute: AlertRule = {
  id: 'sigmet-route',
  name: '루트 SIGMET',
  threshold: 'app',
  evaluate({ o, wx, now }) {
    const sig = wx.sigmets?.data ?? [];
    const from = Math.max(now, Date.parse(o.header.takeoff) - 3_600_000);
    const to = Date.parse(o.header.sta);
    const route = o.route.map((w) => ({ lat: w.lat, lon: w.lon }));
    return sig
      .filter((s) => Date.parse(s.validTo) > from && Date.parse(s.validFrom) < to && sigmetNearRoute(s, route, SIGMET_NM))
      .map((s) => ({
        key: s.id,
        severity: 'caution' as const,
        title: `SIGMET ${s.hazard}${s.qualifier ? ` ${s.qualifier}` : ''} · ${s.firName ?? s.fir}`,
        detail: `${s.base != null ? `FL${Math.round(s.base / 100)}` : 'SFC'}–${s.top != null ? `FL${Math.round(s.top / 100)}` : '?'} · ${s.validFrom.slice(11, 16)}–${s.validTo.slice(11, 16)}Z`,
        basis: [
          { kind: 'data' as const, label: s.raw.replace(/\s+/g, ' ').slice(0, 160) },
          { kind: 'app' as const, label: `앱 기준 · 루트 ${SIGMET_NM}NM 이내 + 비행 시간대 겹침 (실제 고도·시각 교차는 Phase 3.5)` },
        ],
      }));
  },
};
