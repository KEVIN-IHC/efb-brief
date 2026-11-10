// 매뉴얼 묶음(bundle) 형식 — Mac 도구(tools/manual-convert)와 앱이 함께 쓴다 (D-044).
// 매뉴얼 본문은 private/ 와 기기(IndexedDB)에만 있다. 이 파일에는 형식만 있다.

export type ManualKind = 'MEL' | 'CDL' | 'FCOM' | 'FCTM' | 'FOM' | 'QRH' | 'OTHER';

export interface ManualMeta {
  /** 같은 매뉴얼의 개정판은 같은 docId → 가져오면 통째로 교체 (예: A380-MEL) */
  docId: string;
  kind: ManualKind;
  aircraft?: string;
  /** 사람이 읽는 이름 (예: MINIMUM EQUIPMENT LIST) */
  title: string;
  /** 원문 표기 그대로 (예: 19 OCT 26) */
  issueDate?: string;
  /** 비교용 YYYY-MM-DD */
  issueIso?: string;
  /** 이 개정이 대체한 이전 발행일 (원문 표기) */
  replaces?: string;
  /** 개정 번호 (파일 이름의 R12-1 등) */
  revision?: string;
  /** 나눈 방식: 쪽 표시(page) / 절 번호 제목(section, marker 변환 FOM 등) */
  splitMode?: 'page' | 'section';
  sourceFile: string;
  builtAt: string;
  parserVersion: string;
  pageCount: number;
  /** 쪽 표시(예: MI-36-11 P 2/8)를 못 찾아 앞 쪽과 합쳐진 구간 수 — 품질 지표 */
  unlabeledPages: number;
  itemCount: number;
}

export interface ManualPage {
  /** 문서 안 순번 (0부터) */
  seq: number;
  /** 원문 쪽 표시 (예: DSC-34-20-30-10 P 5/20). 없으면 표지 등 */
  ref?: string;
  /** 쪽 표시의 앞부분 (예: DSC-34-20-30-10) — "Refer to ..." 연결용 */
  code?: string;
  /** 쪽 머리 제목 (장·절) */
  header?: string;
  /** 정리된 본문 (가벼운 Markdown: **굵게**, # 제목, | 표) */
  text: string;
  /** 변환 MD 파일의 시작 줄 번호 (1부터) — 대조용 */
  line: number;
  /** 원본 PDF 쪽 번호 (1부터, 알 때만) */
  pdfPage?: number;
}

export interface ManualItem {
  /** MEL 하위 항목(36-11-01B) / MEL 항목(36-11-01) / CDL 항목(27-22) */
  itemNo: string;
  kind: 'MEL' | 'CDL';
  /** 하위 항목의 상위 항목 번호 */
  parent?: string;
  title: string;
  /** 시작 쪽 */
  pageSeq: number;
  ref?: string;
  /** MEL: 수리 기한 등급, 장착·필요 수량, 플래카드 */
  repairInterval?: string;
  installed?: string;
  required?: string;
  placard?: string;
  /** 항목 본문 (여러 쪽에 걸치면 이어 붙임) */
  text: string;
  /** MEL (o) 운항 절차가 있는 쪽 */
  opsProcSeq?: number;
}

export const MANUAL_FORMAT = 'efb-manual';
export const MANUAL_FORMAT_VERSION = 1;

export interface ManualBundle {
  format: typeof MANUAL_FORMAT;
  formatVersion: number;
  meta: ManualMeta;
  pages: ManualPage[];
  items: ManualItem[];
}
