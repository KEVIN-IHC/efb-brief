// 얼러트 엔진 형식 (원본 명세 §13, D-046)
import type { MelMatch } from '../manual/lookup';
import type { ManualTarget } from '../manual/lookup';
import type { StoredManual } from '../manual/store';
import type { Projection, WptCheck } from '../inflight/deviation';
import type { OfpData } from '../ofp/types';
import type { Metar, Sigmet, Taf } from '../weather/types';
import type { Snap } from '../weather/store';

export type Severity = 'info' | 'caution' | 'warning';

/**
 * 근거 한 줄. 얼러트마다 최소 1개.
 * - manual: 매뉴얼 위치 (누르면 Manual 탭)
 * - ofp: OFP 원문 줄 (누르면 OFP 원문)
 * - temporary: 매뉴얼 근거 없는 임시 기준 (D-023·D-025 등) — 항상 "임시" 표시
 * - app: 앱 자체 기준 (기상 신선도 등, 운항 규정 아님)
 * - data: 기상 원문 등 자료 그 자체
 */
export interface Basis {
  kind: 'manual' | 'ofp' | 'temporary' | 'app' | 'data';
  label: string;
  manual?: ManualTarget;
  ofpLine?: number;
}

export interface AlertResult {
  /** 규칙 안에서 같은 상황을 가리키는 키 (중복 방지·확인 기록용) */
  key: string;
  severity: Severity;
  title: string;
  detail?: string;
  basis: Basis[];
}

export interface FlightContext {
  now: number;
  flightId: string;
  o: OfpData;
  checks: WptCheck[];
  proj: Projection | null;
  mel: MelMatch[];
  manualDocs: StoredManual[];
  /** 매뉴얼 절 코드(예: FOM-8.2.1.1) → 위치. 가져온 매뉴얼에 없으면 키 없음 */
  refs: Record<string, { docId: string; seq: number; ref?: string }>;
  wx: {
    metars: Record<string, Snap<Metar>>;
    tafs: Record<string, Snap<Taf>>;
    sigmets: Snap<Sigmet[]> | null;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  /** 판정 기준의 근거 종류 — temporary 면 화면에 "임시 기준" */
  threshold: 'manual' | 'temporary' | 'app' | 'none';
  /** 규칙 자체의 기준 문서 (명세 §13.1 manualRef). 매뉴얼 근거가 아직 없으면 undefined */
  manualRef?: { doc: string; chapter: string; page?: string };
  evaluate(ctx: FlightContext): AlertResult[];
}

/** 화면에 나가는 얼러트 */
export interface Alert extends AlertResult {
  /** `${ruleId}:${key}:${severity}` — 심각도가 오르면 새 얼러트 */
  id: string;
  ruleId: string;
  ruleName: string;
  threshold: AlertRule['threshold'];
}
