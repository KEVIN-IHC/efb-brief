// 기상 시간 선택 + 모델 기반 난류·기온 지표 (D-063·D-064)
// 시각 선택은 버티컬 뷰·플랜 뷰가 함께 쓴다. 지표는 Open-Meteo 기압면 값에서 계산한 "참고 지수" — 공식 EDR·WAFS 아님.
import { create } from 'zustand';
import type { LevelValue } from '../weather/decode';
import type { WindPoint, WindsData } from '../weather/types';

export type TimeMode = 'eto' | 'fixed';
/** eto = 각 지점 통과 예정 시각의 예보 / fixed = 모든 지점을 한 시각으로 */
export const useWxTime = create<{ mode: TimeMode; t: number | null }>(() => ({ mode: 'eto', t: null }));

const HOUR = 3_600_000;

export function nearestIndex(times: string[], ms: number): number {
  let best = 0;
  let bd = Infinity;
  times.forEach((t, k) => {
    const d = Math.abs(Date.parse(t) - ms);
    if (d < bd) {
      bd = d;
      best = k;
    }
  });
  return best;
}

/** "지금 +3h" · "지금 −2h" · "지금" (가까운 정시 기준) */
export function relLabel(ms: number, now: number): string {
  const m = Math.round((ms - now) / 600_000) * 10; // 10분 단위
  if (Math.abs(m) < 15) return '지금';
  const a = Math.abs(m);
  const h = Math.floor(a / 60);
  const mm = a % 60;
  return `지금 ${m > 0 ? '+' : '−'}${h ? `${h}h` : ''}${mm ? `${mm}m` : ''}`;
}

export interface PointAt {
  levels: LevelValue[];
  freezingFt: number | null;
  /** 이 값의 예보 시각 */
  time: string;
  /** 3시간 전 같은 지점 값 (기온 변화용) */
  prev?: LevelValue[];
}

/**
 * 지점 p의 선택 시각 값. etoMs = 그 지점 통과 예정 시각(편차 반영)
 * 시간대별 자료(series)가 없으면 예전처럼 ETO 기준 한 시각 값
 */
export function pointAt(p: WindPoint, data: WindsData, mode: TimeMode, fixedMs: number | null, etoMs: number | null): PointAt | null {
  const times = data.times ?? [];
  if (!p.series?.length || !times.length) return p.levels ? { levels: p.levels, freezingFt: p.freezingFt ?? null, time: p.time } : null;
  const target = mode === 'fixed' && fixedMs != null ? fixedMs : etoMs ?? (p.time ? Date.parse(p.time) : Date.now());
  const k = nearestIndex(times, target);
  const s = p.series[k];
  if (!s) return null;
  const kp = nearestIndex(times, Date.parse(times[k]) - 3 * HOUR);
  return { levels: s.levels, freezingFt: s.freezingFt, time: times[k], prev: kp !== k ? p.series[kp]?.levels : undefined };
}

// ---------------- 난류 지수 (모델 값으로 계산) ----------------

const KT = 0.514444; // m/s
const FT = 0.3048;
const G = 9.80665;

const uv = (dir: number, spd: number) => {
  const r = (dir * Math.PI) / 180;
  return { u: -spd * Math.sin(r), v: -spd * Math.cos(r) };
};

export interface ShearLayer {
  hpaLow: number; // 아래 면 (기압 큼)
  hpaHigh: number;
  /** 수직 풍속 차 kt/1000ft */
  vws: number;
  /** 리처드슨 수 (작을수록 난류 가능성 큼, 0.25 이하 = 이론상 난류) */
  ri: number | null;
  /** 0 없음 · 1 약 · 2 중 · 3 강 (앱 임시 기준) */
  level: 0 | 1 | 2 | 3;
}

/**
 * 앱 임시 기준 (일반 기상 교재의 경험치, 회사 기준 아님 · D-064):
 *  VWS ≥ 4 / 6 / 9 kt/1000ft, 또는 Ri < 1 / 0.5 / 0.25 → 약 / 중 / 강
 * 기압면 간격이 넓어(약 3,000~5,000 ft) 실제 시어보다 작게 나온다.
 */
export const TURB_TEMP = { vws: [4, 6, 9], ri: [1, 0.5, 0.25] } as const;

export function shearLayers(levels: LevelValue[], flOf: (hpa: number) => number): ShearLayer[] {
  const ok = levels.filter((l) => l.spd != null && l.dir != null && l.temp != null).sort((a, b) => b.hpa - a.hpa);
  const out: ShearLayer[] = [];
  for (let j = 0; j < ok.length - 1; j++) {
    const a = ok[j];
    const b = ok[j + 1];
    const dzFt = (flOf(b.hpa) - flOf(a.hpa)) * 100;
    if (dzFt <= 0) continue;
    const wa = uv(a.dir!, a.spd!);
    const wb = uv(b.dir!, b.spd!);
    const dV = Math.hypot(wb.u - wa.u, wb.v - wa.v); // kt
    const vws = dV / (dzFt / 1000);
    const dz = dzFt * FT;
    const thA = (a.temp! + 273.15) * Math.pow(1000 / a.hpa, 0.2857);
    const thB = (b.temp! + 273.15) * Math.pow(1000 / b.hpa, 0.2857);
    const n2 = (G / ((thA + thB) / 2)) * ((thB - thA) / dz);
    const s2 = Math.pow((dV * KT) / dz, 2);
    const ri = s2 > 1e-9 ? n2 / s2 : null;
    const lvl = (i: number) => vws >= TURB_TEMP.vws[i] || (ri != null && ri < TURB_TEMP.ri[i]);
    const level = (lvl(2) ? 3 : lvl(1) ? 2 : lvl(0) ? 1 : 0) as ShearLayer['level'];
    out.push({ hpaLow: a.hpa, hpaHigh: b.hpa, vws: Math.round(vws * 10) / 10, ri: ri != null ? Math.round(ri * 100) / 100 : null, level });
  }
  return out;
}

/** 거리 방향 기온 경도 °C/100NM (앞뒤 지점 기온 차 ÷ 거리) */
export function tempGradient(tPrev: number | null, tNext: number | null, distNm: number): number | null {
  if (tPrev == null || tNext == null || distNm <= 0) return null;
  return Math.round(((tNext - tPrev) / distNm) * 100 * 10) / 10;
}

/** PIREP/AIREP 원문의 EDR 값 (자동 보고에 있을 때만) */
export function edrFromRaw(raw: string): number | null {
  const m = /\bEDR\s*[:/]?\s*(0?\.\d{1,2}|\d\.\d{1,2})/i.exec(raw);
  return m ? Number(m[1]) : null;
}

export const windsTimes = (w: WindsData | null | undefined) => (w?.times ?? []).map((t) => Date.parse(t));
