import type { FlightRecord } from '../db/schema';

// Phase 0~1 더미 비행 (가상 편명, 실제 항로·편명 아님). 화면에 DEMO DATA 워터마크 표시.
export const DEMO_FLIGHT: FlightRecord = {
  flightId: 'DEMO-20261105-RKSI-KLAX',
  flightNo: 'DEMO001',
  dep: 'RKSI',
  arr: 'KLAX',
  std: '2026-11-05T11:00:00Z',
  sta: '2026-11-05T21:40:00Z',
  acType: 'B77W',
  reg: 'HL0000',
  status: 'planned',
  demo: true,
};
