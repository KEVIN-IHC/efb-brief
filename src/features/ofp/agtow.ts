// AGTOW·ACL 풀이 (D-068): OFP 숫자로 다시 계산해 OFP 값과 맞는지 보여 준다.
// 식은 샘플 10개(A388·B78X)의 OFP 숫자로 맞춰 확인한 것 — 공식 정의는 회사 매뉴얼·Aviator 자료가 기준
//   AGTOW = 가장 작은 값 ( MTOW · RWY(활주로 제한) · TCAP(이륙 성능 제한) · MZFW + TOF · MLDW + TIF )
//   ACL   = AGTOW − SOW − TOF   (실을 수 있는 최대 탑재량)   · 여유 = ACL − PAYLOAD = AGTOW − TOW
import type { OfpData } from './types';

export interface AgtowTerm {
  label: string;
  /** 식 표시 (예: MZFW 806,800 + TOF 288,200) */
  parts?: [string, number][];
  value: number;
  limiting: boolean;
  hint: string;
}
export interface AgtowCalc {
  terms: AgtowTerm[];
  agtow: number;
  ofpAgtow?: number;
  sow?: number;
  tof: number;
  tif: number;
  acl?: number;
  ofpAcl?: number;
  payload: number;
  /** ACL − PAYLOAD (= AGTOW − TOW) */
  spare?: number;
  ok: boolean;
}

export function agtowCalc(o: OfpData): AgtowCalc | null {
  const w = o.weights;
  const ex = (k: string) => w.extraLimits?.find((l) => l.label === k)?.value;
  const tof = w.tow.planned - w.zfw.planned;
  const tif = w.tow.planned - w.lw.planned;
  if (!(tof > 0) || !(tif > 0) || !(w.tow.limit > 0)) return null;
  const raw: Omit<AgtowTerm, 'limiting'>[] = [
    { label: 'MTOW', value: w.tow.limit, hint: '구조상 최대 이륙 중량' },
    ...(ex('RWY') ? [{ label: 'RWY', value: ex('RWY')!, hint: '활주로·장애물 이륙 성능 제한' }] : []),
    ...(ex('TCAP') ? [{ label: 'TCAP', value: ex('TCAP')!, hint: '이륙 성능(상승·온도 등) 제한' }] : []),
    { label: 'MZFW + TOF', parts: [['MZFW', w.zfw.limit], ['TOF', tof]], value: w.zfw.limit + tof, hint: '무연료 중량 한도 + 이륙 연료' },
    { label: 'MLDW + TIF', parts: [['MLDW', w.lw.limit], ['TIF', tif]], value: w.lw.limit + tif, hint: '착륙 중량 한도 + 운항 소모 연료' },
  ];
  const agtow = Math.min(...raw.map((t) => t.value));
  const terms = raw.map((t) => ({ ...t, limiting: t.value === agtow }));
  const sow = ex('SOW');
  const acl = sow != null ? agtow - sow - tof : undefined;
  const ofpAgtow = ex('AGTOW');
  const ofpAcl = ex('ACL');
  const ok = (ofpAgtow == null || ofpAgtow === agtow) && (ofpAcl == null || acl == null || ofpAcl === acl);
  return { terms, agtow, ofpAgtow, sow, tof, tif, acl, ofpAcl, payload: w.payload, spare: acl != null ? acl - w.payload : undefined, ok };
}
