// 태양 고도 (대략, ±1°) — 주간/야간 판단용 (활주로 등화 고장 시 야간 조건 등). 외부 자료 없이 계산
const RAD = Math.PI / 180;

/** 태양 고도각 (도). lat/lon 도, t = epoch ms */
export function sunElevation(lat: number, lon: number, t: number): number {
  const d = t / 86_400_000 - 10_957.5; // J2000 기준 일수
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst * 15 + lon) * RAD - ra) % (2 * Math.PI);
  const el = Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha));
  return el / RAD;
}

/** 야간 = 태양이 지평선 아래 6° (시민박명 끝) 미만 */
export const isNight = (lat: number, lon: number, t: number) => sunElevation(lat, lon, t) < -6;
