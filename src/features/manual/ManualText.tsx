// 매뉴얼 쪽 본문 표시: 가벼운 Markdown(제목·**굵게**·표·목록) + "Refer to …" 누르면 이동 + 검색어 강조
import { Fragment, type ReactNode } from 'react';
import { findRefs } from './lookup';

interface Props {
  text: string;
  /** 강조할 낱말(검색어·항목 번호) */
  marks?: string[];
  onRef?: (key: string) => void;
}

function inline(s: string, marks: string[], onRef?: (k: string) => void): ReactNode[] {
  // 원문 줄바꿈(¦) → <br>
  const segs = s.split(/\s*¦\s*/);
  if (segs.length > 1)
    return segs.flatMap((seg, i) => [...(i ? [<br key={`b${i}`} />] : []), <Fragment key={`s${i}`}>{inline(seg, marks, onRef)}</Fragment>]);
  // **굵게** 로 먼저 나누고, 각 조각 안에서 참조 링크·강조
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const bold = /^\*\*[^*]+\*\*$/.test(part);
    const t = (bold ? part.slice(2, -2) : part).replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;])/g, '$1$2');
    const body = refsAndMarks(t, marks, onRef);
    return bold ? <b key={i}>{body}</b> : <Fragment key={i}>{body}</Fragment>;
  });
}

function refsAndMarks(s: string, marks: string[], onRef?: (k: string) => void): ReactNode[] {
  const refs = onRef ? findRefs(s) : [];
  const out: ReactNode[] = [];
  let pos = 0;
  refs.forEach((r, i) => {
    if (r.start < pos) return;
    if (r.start > pos) out.push(<Fragment key={`p${i}`}>{markText(s.slice(pos, r.start), marks)}</Fragment>);
    out.push(
      <button key={`r${i}`} className="mref" onClick={() => onRef!(r.key)}>
        {markText(s.slice(r.start, r.end), marks)}
      </button>,
    );
    pos = r.end;
  });
  if (pos < s.length) out.push(<Fragment key="end">{markText(s.slice(pos), marks)}</Fragment>);
  return out;
}

function markText(t: string, marks: string[]): ReactNode {
  const ms = marks.filter((m) => m.length >= 2);
  if (!ms.length) return t;
  const re = new RegExp(`(${ms.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return t.split(re).map((x, i) => (i % 2 ? <mark key={i}>{x}</mark> : x));
}

export function ManualText({ text, marks = [], onRef }: Props) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        if (!/^\|\s*-{3}/.test(lines[i])) rows.push(lines[i].split('|').slice(1, -1));
        i++;
      }
      i--;
      blocks.push(
        <div key={i} className="mtable-wrap">
          <table className="mtable">
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{inline(c.trim(), marks, onRef)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const h = /^(#{1,6})\s*(.*)$/.exec(l);
    if (h) {
      blocks.push(
        <h4 key={i} className="mh">
          {inline(h[2], marks, onRef)}
        </h4>,
      );
      continue;
    }
    const li = /^(\s*)-\s+(.*)$/.exec(l);
    if (li) {
      blocks.push(
        <p key={i} className={`mli mli-${Math.min(3, Math.floor(li[1].length / 3) + 1)}`}>
          {inline(li[2], marks, onRef)}
        </p>,
      );
      continue;
    }
    if (!l.trim()) continue;
    blocks.push(<p key={i}>{inline(l, marks, onRef)}</p>);
  }
  return <div className="mtext">{blocks}</div>;
}
