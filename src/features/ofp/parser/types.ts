// OFP 파서 결과 구조 (SPEC §10.1)
//  - 섹션 단위로 나누고, 섹션마다 추출기를 돌린다
//  - 모든 값은 원문 줄 번호(FieldTrace.line)를 함께 기록 → 화면에서 원문으로 바로 이동해 검증
//  - 추출 실패·미작성 섹션은 조용히 빠지지 않고 상태로 드러난다
import type { OfpData } from '../types';

/** 원문 한 줄. n = 원문 뷰어의 줄 번호(1부터, 페이지 구분선 포함) */
export interface DocLine {
  n: number;
  page: number;
  text: string;
}

export type SectionId =
  | 'cfp' // 메인 CFP (헤더·연료·중량·루트)
  | 'altnRoute'
  | 'refile'
  | 'end'
  | 'etp'
  | 'windSummary'
  | 'dispatch'
  | 'fpl'
  | 'notam1'
  | 'notam2'
  | 'notam3'
  | 'cfpCopy'; // 후반부 메인 CFP 복사본 (파싱 제외)

export interface SectionDef {
  id: SectionId;
  label: string;
  start: RegExp;
  /** 같은 표시가 여러 번 나오면 전부 섹션으로 (예: FPL 블록 2개) */
  all?: boolean;
  /** 실제 회사 샘플로 확인했는가. false면 화면에 "샘플 확인 전" 표시 */
  verified: boolean;
  note?: string;
}

export interface Section {
  id: SectionId;
  label: string;
  startLine: number; // 포함
  endLine: number; // 포함
  page: number;
  verified: boolean;
  ignored?: boolean; // 복사본 등 파싱에서 제외한 구간
}

export type ExtractStatus = 'ok' | 'partial' | 'failed' | 'pending' | 'missing';

export interface FieldTrace {
  path: string; // 예: header.flightNo
  label: string;
  value: string | number;
  line: number;
  raw: string;
}

export interface ExtractorResult {
  id: string;
  label: string;
  section: SectionId;
  status: ExtractStatus;
  fields: FieldTrace[];
  message?: string;
}

export interface CheckResult {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'skip';
  detail: string;
  lines: number[];
}

export interface ParsedPartial {
  header: Partial<OfpData['header']> & { reg?: string };
  alternates: string[];
  routeString?: string;
}

export interface ParseResult {
  parserVersion: string;
  lineCount: number;
  pageCount: number;
  sections: Section[];
  missingSections: SectionDef[];
  extractors: ExtractorResult[];
  checks: CheckResult[];
  data: ParsedPartial;
  /** 헤더·연료·중량·루트가 모두 추출되면 앱 공통 구조로 조립된 결과 */
  ofp?: OfpData;
}
