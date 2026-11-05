import type { DocLine } from './types';

const PAGE_RE = /^===== PAGE (\d+) =====$/;

/** 추출된 원문 텍스트 → 줄 목록 (페이지 번호 부여). 줄 번호는 원문 뷰어와 동일 */
export function toDocLines(rawText: string): DocLine[] {
  let page = 0;
  return rawText.split('\n').map((text, i) => {
    const m = PAGE_RE.exec(text);
    if (m) page = Number(m[1]);
    return { n: i + 1, page, text };
  });
}

export const isPageMark = (l: DocLine) => PAGE_RE.test(l.text);

/** 페이지 구분선·꼬리말 ("Page 5", "Page - 4 of  8") — 여러 페이지에 걸친 블록에서 제거 */
export const isPageNoise = (s: string) => PAGE_RE.test(s) || /^\s*Page\s+\d+\s*$/.test(s) || /Page\s+-\s+\d+\s+of\s+\d+/.test(s);

/** 줄 목록에서 정규식 첫 일치 */
export function findFirst(lines: DocLine[], re: RegExp, from = 0): { idx: number; line: DocLine; m: RegExpExecArray } | null {
  for (let i = from; i < lines.length; i++) {
    const m = re.exec(lines[i].text);
    if (m) return { idx: i, line: lines[i], m };
  }
  return null;
}

/** 특정 토큰이 처음 나오는 줄 번호 (값 출처 기록용). 없으면 fallback */
export function lineOf(lines: DocLine[], token: string, fallback: number): number {
  if (!token) return fallback;
  const hit = lines.find((l) => l.text.includes(token));
  return hit ? hit.n : fallback;
}
