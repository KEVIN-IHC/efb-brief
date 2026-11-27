// ETP·EDTO 교체공항(ERA) 예상 사용 시간 (D-094)
// 근거: 회사 FOM Supplement "EDTO Equal Time Point (ETP) Data" — Alternate n의
//   Earliest Estimated Time of Landing = 이륙 + (앞) ETP까지 시간 + 고속 회항 시간
//   Latest   Estimated Time of Landing = 이륙 + (뒤) ETP까지 시간 + 1엔진 저속 회항 시간
//   예상 착륙 시간대 = Earliest ~ Latest, 예상 운항 시간대 = Earliest − 1시간 ~ Latest + 1시간
// 앱 계산 방법:
//   - 공항 순서 = ETP1 [A,B] · ETP2 [B,C] … → A, B, C. 첫 공항은 앞 ETP가 없어 ETP1을 씀(FOM "or ETP1"), 마지막 공항은 뒤 ETP가 마지막 ETP
//   - EEP·EXP는 OFP에 없어 ETP로 대신함. 회항 시간은 OFP ETP 자료의 시간 하나뿐 → 고속·저속 구분 없이 같은 값(그래서 범위가 좁게 나올 수 있음)
//   - OFP에 EDTO 시간창(쌍발기 EDTO 표)이 있으면 그 값을 먼저 씀 (OFP가 EEP·EXP·회항 속도를 반영해 계산한 값)
//   - 실제 출발 시각을 넣으면 (실제 − STD)만큼 모두 옮김
import type { OfpData } from './types';

const H = 3_600_000;

export interface EraTime {
  icao: string;
  /** 예상 착륙 시간대 */
  earliest: number;
  latest: number;
  /** 예상 운항 시간대 (±1h) */
  opsFrom: number;
  opsTo: number;
  src: 'OFP EDTO' | 'ETP 계산';
  /** 어느 ETP로 계산했는지 (예: "ETP1 ~ ETP2") */
  basis: string;
  /** 회항 공항으로 맡는 항로 구간 — 공항 k = (ETP k 또는 이륙) → (ETP k+1 또는 도착) */
  seg?: { from: string; to: string; fromT: number; toT: number };
}

/** OFP EDTO 표의 "1159Z" → 이륙 날짜 기준 ISO 시각 (이륙 6시간 전보다 이르면 다음 날) */
export function hhmmzToMs(hhmmz: string, ref: number): number {
  const m = /^(\d{2})(\d{2})Z?$/.exec(hhmmz.trim());
  if (!m) return Date.parse(hhmmz);
  const d = new Date(ref);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(m[1]), Number(m[2]));
  while (t < ref - 6 * H) t += 24 * H;
  return t;
}

/** 실제 출발 HHMM(Z) → STD와의 차이(ms). STD 앞뒤 12시간 안에서 가장 가까운 날짜로 */
export function depShift(o: OfpData, actualHHMM: string | undefined): number {
  const m = /^(\d{2})(\d{2})$/.exec((actualHHMM ?? '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return 0;
  const std = Date.parse(o.header.std);
  const d = new Date(std);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Number(m[1]), Number(m[2]));
  if (t - std > 12 * H) t -= 24 * H;
  if (std - t > 12 * H) t += 24 * H;
  return t - std;
}

export function eraTimes(o: OfpData, shiftMs = 0): EraTime[] {
  const to = Date.parse(o.header.takeoff);
  const mk = (icao: string, e: number, l: number, src: EraTime['src'], basis: string): EraTime => ({
    icao,
    earliest: e + shiftMs,
    latest: l + shiftMs,
    opsFrom: e + shiftMs - H,
    opsTo: l + shiftMs + H,
    src,
    basis,
  });
  if (o.edto?.windows.length) {
    return o.edto.windows.map((w) => mk(w.icao, hhmmzToMs(w.from, to), hhmmzToMs(w.to, to), 'OFP EDTO', 'OFP SUITABLE FROM~TO'));
  }
  const etps = o.etps.filter((e) => Number.isFinite(Date.parse(e.eto)));
  if (!etps.length) return [];
  // ETP 지점 시각 + 회항 시간 = 그 ETP에서 회항할 때 착륙 시각
  const land = (i: number) => Date.parse(etps[i].eto) + (etps[i].timeToAltMin ?? 0) * 60000;
  const seq: string[] = [etps[0].airports[0], ...etps.map((e) => e.airports[1])];
  const out: EraTime[] = [];
  seq.forEach((icao, k) => {
    const a = Math.max(0, k - 1); // 앞 ETP (첫 공항은 ETP1)
    const b = Math.min(etps.length - 1, k); // 뒤 ETP (마지막 공항은 마지막 ETP)
    const prev = out.find((x) => x.icao === icao);
    const e = land(a);
    const l = land(b);
    const basis = a === b ? etps[a].name : `${etps[a].name} ~ ${etps[b].name}`;
    const segFrom = k === 0 ? { n: '이륙', t: to } : { n: etps[k - 1].name, t: Date.parse(etps[k - 1].eto) };
    const segTo = k < etps.length ? { n: etps[k].name, t: Date.parse(etps[k].eto) } : { n: '도착', t: Date.parse(o.header.sta) };
    const seg = { from: segFrom.n, to: segTo.n, fromT: segFrom.t + shiftMs, toT: segTo.t + shiftMs };
    if (prev) {
      // 같은 공항이 두 번 나오면 넓힘
      prev.earliest = Math.min(prev.earliest, e + shiftMs);
      prev.latest = Math.max(prev.latest, l + shiftMs);
      prev.opsFrom = prev.earliest - H;
      prev.opsTo = prev.latest + H;
      prev.basis += ` · ${basis}`;
      if (prev.seg) prev.seg = { from: prev.seg.from, to: seg.to, fromT: Math.min(prev.seg.fromT, seg.fromT), toT: Math.max(prev.seg.toT, seg.toT) };
    } else out.push({ ...mk(icao, e, l, 'ETP 계산', basis), seg });
  });
  return out;
}
