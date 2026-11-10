// 도착·교체 공항 기상과 SIGMET 자료가 오래됨 (앱 신선도 기준 — 운항 규정 아님)
import { FRESH_LIMITS, freshness } from '../../weather/freshness';
import { flightStations } from '../../weather/store';
import type { AlertResult, AlertRule } from '../types';

const H = 3_600_000;

export const wxStale: AlertRule = {
  id: 'wx-stale',
  name: '기상 자료 오래됨',
  threshold: 'app',
  evaluate({ o, wx, now }) {
    // 비행이 끝난 뒤(ETA + 1시간)에는 판단하지 않음
    if (now > Date.parse(o.header.sta) + H) return [];
    const out: AlertResult[] = [];
    const st = flightStations(o.header.dep, o.header.arr, o).filter((s) => s.roles.includes('DEST') || s.roles.includes('ALTN'));
    for (const s of st) {
      const role = s.roles.includes('DEST') ? 'DEST' : 'ALTN';
      const m = wx.metars[s.icao];
      const t = wx.tafs[s.icao];
      if (!m && !t) {
        if (role === 'DEST')
          out.push({ key: `none:${s.icao}`, severity: 'info', title: `${s.icao} 기상 자료 없음`, detail: '온라인일 때 Weather 탭에서 받아 두세요', basis: [{ kind: 'app', label: '앱 기준 · 도착지 METAR/TAF 미보유' }] });
        continue;
      }
      if (m && freshness('metar', m.data.obsTime, now) === 'bad')
        out.push({ key: `metar:${s.icao}`, severity: 'caution', title: `${role} ${s.icao} METAR 오래됨`, detail: `관측 ${m.data.obsTime.slice(11, 16)}Z`, basis: [{ kind: 'app', label: `앱 신선도 기준 · METAR ${FRESH_LIMITS.metar.basis}` }] });
      if (t && freshness('taf', t.data.issueTime, now, t.data.validTo) === 'bad')
        out.push({ key: `taf:${s.icao}`, severity: 'caution', title: `${role} ${s.icao} TAF 오래됨·만료`, detail: `발표 ${t.data.issueTime.slice(11, 16)}Z · 유효 ~${t.data.validTo.slice(11, 16)}Z`, basis: [{ kind: 'app', label: `앱 신선도 기준 · TAF ${FRESH_LIMITS.taf.basis}` }] });
    }
    if (wx.sigmets && freshness('sigmet', wx.sigmets.fetchedAt, now) === 'bad')
      out.push({ key: 'sigmet', severity: 'caution', title: 'SIGMET 자료 오래됨', detail: `받은 시각 ${wx.sigmets.fetchedAt.slice(11, 16)}Z`, basis: [{ kind: 'app', label: `앱 신선도 기준 · SIGMET ${FRESH_LIMITS.sigmet.basis}` }] });
    return out;
  },
};
