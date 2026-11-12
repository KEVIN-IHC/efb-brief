// 회사 기준 파일 (D-049): 회사 매뉴얼(FOM·FCOM)의 최저치·바람 제한 등 "수치"는 공개 코드에 넣지 않는다.
// Mac의 private/manuals/company-rules.json → 구글드라이브 → Settings 매뉴얼 가져오기 → 기기(IndexedDB settings)
// 앱 코드는 형식과 계산만 갖고, 값과 근거 위치(매뉴얼 쪽 코드)는 이 파일에서 읽는다. 없으면 "회사 기준 파일 없음".
import { getDB } from '../../db/schema';

export const RULES_FORMAT = 'efb-company-rules';
export const RULES_FORMAT_VERSION = 1;

/** 근거 위치: 매뉴얼 쪽 코드 (FOM 절 · FCOM 쪽 코드) + 화면 글 */
export interface RuleRef {
  code: string;
  label: string;
}

/** 시정 기준 (m). rvr = 활주로 가시거리, vis = 시정 (RVR 없을 때) */
export interface VisReq {
  rvr: number;
  vis?: number;
}

export interface TakeoffStep extends VisReq {
  /** 필요한 시설 (원문 표기) */
  need: string;
  note?: string;
}

/** 측풍/배풍 한계 (kt). null = 불가 */
export type WindPair = [number, number | null] | null;
export type BrakingKey = 'good' | 'goodMedium' | 'medium' | 'mediumPoor' | 'poor' | 'nil';

export interface CompanyRules {
  format: typeof RULES_FORMAT;
  version: number;
  /** 근거 문서와 개정 (화면 표시용 글) */
  source: string;
  takeoff: {
    /** 엔진 수별 ("4" · "2") */
    byEngines: Record<string, { standard: VisReq; lower: TakeoffStep[]; nilFacilities?: TakeoffStep }>;
    /** Lower than Standard 조건 (원문 표기) */
    lowerConditions: string[];
    ref: RuleRef;
  };
  approach: {
    /** 높은 것부터: CAT I → CAT II → CAT III → No DH */
    levels: { name: string; dh?: number; rvr: number; vis?: number }[];
    circling: { ceil: number; vis: number };
    ref: RuleRef;
    circlingRef: RuleRef;
  };
  alternate: {
    cat3: { ceil: number; rvr: number; vis: number };
    cat2: { ceil: number; rvr: number; vis: number };
    /** 그 외 구성의 가산 규칙 (원문 요약 한 줄씩) */
    otherRules: string[];
    /** CAT III 구성을 쓰려면 엔진 부작동 CAT III 가능 기종이어야 함 (설정에서 확인) */
    cat3NeedsEoCapability: boolean;
    ref: RuleRef;
  };
  dispatch: {
    /** 이 분(min) 초과면 "장거리" 규칙 */
    longFlightMin: number;
    ref: RuleRef;
  };
  takeoffAlternate: { maxTimeMin: Record<string, number>; ref: RuleRef };
  facility: {
    alsInop: { rvr: number; vis: number; ref: RuleRef };
    edgeLightsInop: { summary: string; ref: RuleRef };
  };
  landingPlan: { wetBelowM: number; ref: RuleRef };
  runwayWidthMinFt: { byAircraft: Record<string, number>; ref: RuleRef };
  rff: {
    /** 기종별 항공기 소방등급 */
    aircraftCat: Record<string, number>;
    /** 등급 하향 허용 폭 (항공기 등급 − n) */
    depDest: { normal: number; reduced: number; temp: number };
    alternate: { normal: number; temp: number };
    eraMin: number;
    ref: RuleRef;
  };
  wind: { tailCaptainAbove: number; ref: RuleRef; applyRef: RuleRef };
  windLimits: {
    byAircraft: Record<
      string,
      {
        takeoff: Record<BrakingKey, WindPair>;
        landing: Record<BrakingKey, WindPair>;
        autoland: { head: number; tail: number; cross: number; crossCat23: number };
        /** 오염 활주로 CAT III Fail-Operational 불가 */
        cat3FailOpNotOnContaminated: boolean;
        ref: RuleRef;
        autolandRef: RuleRef;
        rcamRef: RuleRef;
      }
    >;
  };
  lowTime: {
    captain: { ceil: number; vis: number; rvrTable: [number, number][]; exemptions: string[]; ref: RuleRef };
    oe: { conditions: string[]; ref: RuleRef };
    captainHandling: { summary: string; ref: RuleRef };
    fo: { visMax: number; rvrMax: number; crossMax: number; conditions: string[]; ref: RuleRef };
  };
  contingency3: { etaDelayMin: number; altChangeFt: number; ref: RuleRef };
  coldTemp: {
    /** 이 기온(°C) 이하면 보정 대상 */
    applyAtOrBelow: number;
    /** 표: 기온 행(0, −10 …) × 공항 위 높이 열(ft) */
    heightsFt: number[];
    rows: { temp: number; add: (number | null)[] }[];
    ref: RuleRef;
  };
  /** 회사 FOM 절 코드 (특수공항 표·공항 제한) */
  sections: { specialAirports: string; airportRestrictions: string; specialQual: RuleRef };
  refs: {
    weatherRadar?: RuleRef;
    cat23: RuleRef;
    rnp: RuleRef;
    diversion: RuleRef[];
    briefings: { joint: RuleRef; takeoff: RuleRef; landing: RuleRef; handover: RuleRef; cat23: RuleRef };
    edtoEra: RuleRef;
    era3: RuleRef;
    deicing: RuleRef;
    thunderstorm: RuleRef;
    windshear: RuleRef;
    volcanic: RuleRef;
  };
  /** 상황 카드 (선택, D-056) */
  ops?: OpsConfig;
}

/** 상황 카드 (D-056): 회사 매뉴얼 절 링크·사건 버튼·정보 양식·타이머. 목록과 절 코드는 회사 기준 파일에만 */
export interface OpsTimerDef {
  label: string;
  startHint?: string;
  /** every = n분마다, at = 시작 후 n분 */
  marks: { every?: number; at?: number; text: string; ref?: RuleRef }[];
  note?: string;
}

export interface OpsCard {
  id: string;
  group: 'abnormal' | 'security' | 'normal';
  title: string;
  refs: RuleRef[];
  /** 누르면 사건 기록에 시각과 함께 남는 버튼 */
  events?: string[];
  /** 메모리에만 두는 정보 양식 (예: 도착 의료 지원 요청) — 개인정보라 저장·동기화 안 함 */
  form?: { title: string; ref?: RuleRef; fields: string[] };
  timer?: OpsTimerDef;
}

export interface OpsConfig {
  source?: string;
  cards: OpsCard[];
  reports?: { refs: RuleRef[]; kinds: string[] };
}

export const rulesEvents = new EventTarget();
const KEY = 'companyRules';

/** 형식 점검 — 틀리면 이유 글, 맞으면 null */
export function validateRules(json: unknown): string | null {
  const r = json as Partial<CompanyRules> | null;
  if (!r || typeof r !== 'object') return 'JSON 객체가 아님';
  if (r.format !== RULES_FORMAT) return '회사 기준 파일이 아님';
  if (typeof r.version !== 'number' || r.version > RULES_FORMAT_VERSION) return `지원하지 않는 버전 (${r.version}) — 앱을 새로 고침해 보세요`;
  for (const k of ['takeoff', 'approach', 'alternate', 'dispatch', 'windLimits', 'lowTime', 'rff', 'coldTemp'] as const) if (!r[k]) return `항목 없음: ${k}`;
  if (!Array.isArray(r.approach?.levels) || !r.approach.levels.length) return 'approach.levels 비어 있음';
  if (r.ops && (!Array.isArray(r.ops.cards) || r.ops.cards.some((c) => !c.id || !c.title || !Array.isArray(c.refs)))) return 'ops.cards 형식 오류';
  return null;
}

export function isRulesJson(json: unknown): boolean {
  return !!json && typeof json === 'object' && (json as { format?: string }).format === RULES_FORMAT;
}

export interface StoredRules {
  rules: CompanyRules;
  importedAt: string;
  fileName?: string;
}

export async function loadRules(): Promise<StoredRules | null> {
  const row = await (await getDB()).get('settings', KEY);
  return (row?.value as StoredRules | undefined) ?? null;
}

export async function saveRules(rules: CompanyRules, fileName?: string): Promise<void> {
  const err = validateRules(rules);
  if (err) throw new Error(err);
  await (await getDB()).put('settings', { key: KEY, value: { rules, importedAt: new Date().toISOString(), fileName } satisfies StoredRules });
  rulesEvents.dispatchEvent(new Event('change'));
}

export async function deleteRules(): Promise<void> {
  await (await getDB()).delete('settings', KEY);
  rulesEvents.dispatchEvent(new Event('change'));
}

/** 엔진 수 (규칙 표 키) — 4발 A380·B747, 그 외 2발 */
export function engineCount(acType: string | undefined): '4' | '2' {
  return /^(A38|A34|B74)/i.test(acType ?? '') ? '4' : '2';
}
