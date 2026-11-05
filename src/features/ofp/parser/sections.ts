// Aviator OFP 구간 나누기.
// 표시 문자열은 참고 분석(private/reference) 기준 — 회사 샘플로 확인하면 verified: true 로 바꾼다.
import { isPageMark } from './lines';
import type { DocLine, Section, SectionDef, SectionId } from './types';

export const AVIATOR_SECTIONS: SectionDef[] = [
  { id: 'altnRoute', label: 'ROUTE TO ALTN', start: /ROUTE TO ALTN/, verified: false, note: '메인 루트 테이블 종료 직후' },
  { id: 'refile', label: 'REFILE FLT PLAN', start: /REFILE FLT PLAN/, verified: false, note: '독립 루트 — 메인 루트와 섞이면 안 됨' },
  { id: 'end', label: 'END OF JEPPESEN DATAPLAN', start: /END OF JEPPESEN/, verified: false },
  { id: 'etp', label: 'EQUAL TIME POINT', start: /EQUAL TIME POINT/, verified: false },
  { id: 'windSummary', label: 'WIND/TEMP SUMMARY', start: /START OF WIND AND TEMPERATURE SUMMARY/, verified: false },
  { id: 'fpl', label: 'ATS FPL', start: /\(FPL-/, all: true, verified: true, note: 'ICAO Doc 4444 표준 형식' },
  { id: 'dispatch', label: 'DISPATCH / COMPANY ADVISORY', start: /COMPANY ADVISORY|DISPATCH RELEASE/, verified: false },
  { id: 'notam1', label: 'NOTAM PACKAGE 1', start: /NOTAM PACKAGE\s*1\b/, verified: false },
  { id: 'notam2', label: 'NOTAM PACKAGE 2', start: /NOTAM PACKAGE\s*2\b/, verified: false },
  { id: 'notam3', label: 'NOTAM PACKAGE 3', start: /NOTAM PACKAGE\s*3\b/, verified: false },
];

const LABELS: Record<SectionId, string> = {
  cfp: 'MAIN CFP',
  cfpCopy: 'CFP 복사본 (제외)',
  ...Object.fromEntries(AVIATOR_SECTIONS.map((d) => [d.id, d.label])),
} as Record<SectionId, string>;

/** 메인 CFP를 끝내는 표시 (이후 REFILE·복사본이 루트에 섞이는 것 방지) */
const CFP_TERMINATORS: SectionId[] = ['altnRoute', 'refile', 'end'];

interface Start {
  id: SectionId;
  idx: number;
  verified: boolean;
  ignored?: boolean;
}

/** 메인 CFP 첫머리를 대표하는 줄 (복사본 탐지용): 2페이지 첫 의미 있는 줄 */
function cfpSignature(lines: DocLine[], from: number, to: number): string | null {
  const meaningful = (l: DocLine) => !isPageMark(l) && /[A-Z]{3}/.test(l.text) && l.text.trim().length >= 12;
  const page2 = lines.slice(from, to).find((l) => l.page >= 2 && meaningful(l));
  const any = page2 ?? lines.slice(from, to).find(meaningful);
  return any ? any.text.trim() : null;
}

export function splitSections(lines: DocLine[]): { sections: Section[]; missing: SectionDef[] } {
  const starts: Start[] = [];
  const missing: SectionDef[] = [];

  for (const def of AVIATOR_SECTIONS) {
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (def.start.test(lines[i].text)) {
        starts.push({ id: def.id, idx: i, verified: def.verified });
        found = true;
        if (!def.all) break;
      }
    }
    if (!found) missing.push(def);
  }

  // 메인 CFP: 문서 첫 줄 ~ 첫 종료 표시 전
  const firstTerm = Math.min(...starts.filter((s) => CFP_TERMINATORS.includes(s.id)).map((s) => s.idx), lines.length);
  const firstContent = Math.max(0, lines.findIndex((l) => !isPageMark(l)));
  starts.push({ id: 'cfp', idx: firstContent, verified: false });

  // 후반부 CFP 복사본: 메인 CFP 대표 줄이 종료 표시 이후에 다시 나오면 그 지점부터 제외
  const sig = cfpSignature(lines, firstContent, firstTerm);
  if (sig && firstTerm < lines.length) {
    const lastMarker = Math.max(firstTerm, ...starts.filter((s) => s.id !== 'cfp').map((s) => s.idx));
    const searchFrom = Math.min(firstTerm + 1, lastMarker);
    for (let i = searchFrom; i < lines.length; i++) {
      if (lines[i].text.trim() === sig && i > firstTerm) {
        starts.push({ id: 'cfpCopy', idx: i, verified: false, ignored: true });
        break;
      }
    }
  }

  // 복사본 안에 다시 나오는 FPL 등은 파싱에서 제외
  const copyStart = starts.find((s) => s.id === 'cfpCopy')?.idx;
  if (copyStart !== undefined) for (const s of starts) if (s.idx > copyStart) s.ignored = true;

  // 같은 줄에서 시작하는 중복 제거 후 정렬. 각 섹션은 다음 섹션 직전까지
  const uniq = [...new Map(starts.map((s) => [`${s.idx}:${s.id}`, s])).values()].sort((a, b) => a.idx - b.idx);
  const sections: Section[] = uniq.map((s, k) => {
    let endIdx = k + 1 < uniq.length ? uniq[k + 1].idx - 1 : lines.length - 1;
    if (s.id === 'cfp') endIdx = Math.min(endIdx, firstTerm - 1);
    return {
      id: s.id,
      label: LABELS[s.id],
      startLine: lines[s.idx].n,
      endLine: lines[Math.max(s.idx, endIdx)].n,
      page: lines[s.idx].page,
      verified: s.verified,
      ignored: s.ignored,
    };
  });

  return { sections, missing };
}

/** 섹션에 해당하는 줄 */
export function sectionLines(lines: DocLine[], s: Section): DocLine[] {
  return lines.slice(s.startLine - 1, s.endLine);
}
