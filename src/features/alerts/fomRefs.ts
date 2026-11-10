// 얼러트 기준의 FOM 근거 위치 (D-048). 절 번호로 찾아 Manual 탭 링크를 만든다 — FOM을 안 가져왔으면 글자로만 표시
import type { Basis, FlightContext } from './types';

export interface FomRef {
  code: string;
  label: string;
}

export const FOM_REF = {
  fuelEmergency: { code: 'FOM-8.2.1.2', label: 'FOM 8.2.1.2 FUEL EMERGENCY' },
  minFuel: { code: 'FOM-8.2.1.1', label: 'FOM 8.2.1.1 MINIMUM FUEL' },
  inflightFuel: { code: 'FOM-8.2.1', label: 'FOM 8.2.1 In-Flight Fuel Management' },
  fuelCheck: { code: 'FOM-6.5.3.1', label: 'FOM 6.5.3.1 연료 점검' },
  reqTakeoff: { code: 'FOM-6.3.2.1', label: 'FOM 6.3.2.1 Required Takeoff Fuel' },
  edtoCritical: { code: 'FOM-5.13.2.2', label: 'FOM 5.13.2.2 EDTO Critical Fuel' },
  edtoMonitor: { code: 'FOM-5.13.5.3', label: 'FOM 5.13.5.3 Fuel Monitoring' },
  srDef: { code: 'FOM-S5.3.2.2', label: 'FOM S5.3.2.2 Plan Body Data' },
} satisfies Record<string, FomRef>;

export const FOM_CODES = Object.values(FOM_REF).map((r) => r.code);

export function fomBasis(ctx: Pick<FlightContext, 'refs'>, r: FomRef): Basis {
  const t = ctx.refs[r.code];
  return { kind: 'manual', label: t ? `${r.label} · ${t.ref ?? ''}`.replace(/ · $/, '') : `${r.label} (FOM 미보유 — 가져오면 링크)`, manual: t ? { docId: t.docId, seq: t.seq } : undefined };
}
