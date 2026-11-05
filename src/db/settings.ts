import { getDB } from './schema';

export interface SettingsMap {
  gasUrl: string;
  gasToken: string;
  lastSyncAt: string; // 마지막으로 서버 전송에 성공한 시각
  disclaimerAckAt: string;
  activeFlightId: string;
  /** 기상 중계 주소 (D-034). 비어 있으면 같은 서버의 /wx */
  wxProxyUrl: string;
}

export async function getSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K] | undefined> {
  const row = await (await getDB()).get('settings', key);
  return row?.value as SettingsMap[K] | undefined;
}

export async function setSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]): Promise<void> {
  await (await getDB()).put('settings', { key, value });
}

export interface GasConfig {
  url: string;
  token: string;
}

export async function getGasConfig(): Promise<GasConfig | null> {
  const [url, token] = await Promise.all([getSetting('gasUrl'), getSetting('gasToken')]);
  return url && token ? { url, token } : null;
}
