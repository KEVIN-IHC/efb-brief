// 개인 설정 (D-053): Low Time·수습 기장, Low Time 부기장, 엔진 부작동 CAT III 교체 최저치 적용 — 기기 안에만
import { getDB } from '../../db/schema';

export interface CrewProfile {
  /** 해 기종 기장 Low Time (Low Time 기장 착륙 최저치 적용) */
  lowTimeCaptain: boolean;
  /** 수습(OE) 기장 */
  oeCaptain: boolean;
  /** 해 기종 회사 기장 경험 짧음 — 이착륙 직접 */
  captainHandling: boolean;
  /** 같은 편조 부기장이 Low Time */
  foLowTime: boolean;
  /** 회사(운항관리)가 이 기종을 "엔진 부작동 CAT III 가능"으로 확인 → 교체공항 CAT III 구성 최저치 적용 */
  cat3EoConfirmed: boolean;
}

export const DEFAULT_PROFILE: CrewProfile = { lowTimeCaptain: false, oeCaptain: false, captainHandling: false, foLowTime: false, cat3EoConfirmed: false };

export const profileEvents = new EventTarget();
const KEY = 'crewProfile';

export async function loadProfile(): Promise<CrewProfile> {
  const row = await (await getDB()).get('settings', KEY);
  return { ...DEFAULT_PROFILE, ...((row?.value as Partial<CrewProfile> | undefined) ?? {}) };
}

export async function saveProfile(p: CrewProfile): Promise<void> {
  await (await getDB()).put('settings', { key: KEY, value: p });
  profileEvents.dispatchEvent(new Event('change'));
}
