// 내장 공항 좌표 (OurAirports 퍼블릭 도메인 축약본, D-036) — public/geo/airports.json (앱과 함께 미리 저장되어 오프라인 동작)
export interface AirportInfo {
  icao: string;
  lat: number;
  lon: number;
  label: string;
}

let cache: Promise<Record<string, [number, number, string]>> | null = null;

export function loadAirports(): Promise<Record<string, [number, number, string]>> {
  if (!cache)
    cache = fetch(new URL('./geo/airports.json', location.href).href)
      .then((r) => r.json() as Promise<{ airports: Record<string, [number, number, string]> }>)
      .then((j) => j.airports)
      .catch((e) => {
        cache = null;
        throw e;
      });
  return cache;
}

export async function airportInfo(icao: string): Promise<AirportInfo | null> {
  const a = (await loadAirports())[icao.toUpperCase()];
  return a ? { icao: icao.toUpperCase(), lat: a[0], lon: a[1], label: a[2] } : null;
}
