// 매뉴얼 쪽 본문 표시: 가벼운 Markdown(제목·**굵게**·표·목록) + "Refer to …" 누르면 이동 + 검색어 강조
import { Fragment, type ReactNode } from 'react';
import { findRefs, RUNNING_HEAD } from './lookup';

interface Props {
  text: string;
  /** 강조할 낱말(검색어·항목 번호) */
  marks?: string[];
  onRef?: (key: string) => void;
  /** 이 번호의 항목 제목을 눈에 띄게(스크롤 대상) */
  target?: string;
}

// 그림 글로 바뀐 MEL 표: "Repair interval Nbr installed Nbr required Placard ¦ D – 0 Yes ¦"
const PIC_TABLE = /^Repair interval\s+Nbr installed\s+Nbr required\s+Placard\s*¦\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*¦?\s*$/i;
const ITEM_NO_ONLY = /^#{1,6}\s*\*\*(\d{2}-\d{2}-\d{2}[A-Z]?)\*\*\s*$/;
const HEAD = /^(#{1,6})\s*(.*)$/;

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

function Table({ head, rows, marks, onRef, k }: { head?: string[]; rows: string[][]; marks: string[]; onRef?: (k: string) => void; k: number }) {
  return (
    <div key={k} className="mtable-wrap">
      <table className="mtable">
        {head && (
          <thead>
            <tr>
              {head.map((c, ci) => (
                <th key={ci}>{inline(c.trim(), marks, onRef)}</th>
              ))}
            </tr>
          </thead>
        )}
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
    </div>
  );
}

export function ManualText({ text, marks = [], onRef, target }: Props) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  const tgt = target?.toUpperCase();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\|/.test(l)) {
      const rows: string[][] = [];
      let head: string[] | undefined;
      while (i < lines.length && /^\|/.test(lines[i])) {
        if (/^\|\s*-{3}/.test(lines[i])) {
          // 구분 줄 바로 위 한 줄이 머리 줄
          if (rows.length === 1 && !head) head = rows.pop();
        } else rows.push(lines[i].split('|').slice(1, -1));
        i++;
      }
      i--;
      blocks.push(<Table key={i} k={i} head={head} rows={rows} marks={marks} onRef={onRef} />);
      continue;
    }
    const pt = PIC_TABLE.exec(l);
    if (pt) {
      blocks.push(<Table key={i} k={i} head={['Repair interval', 'Nbr installed', 'Nbr required', 'Placard']} rows={[pt.slice(1, 5)]} marks={marks} onRef={onRef} />);
      continue;
    }
    if (RUNNING_HEAD.test(l)) {
      // 쪽 머리(장·절 이름) — 본문과 구분해 작게
      const parts = l
        .replace(/\*/g, '')
        .split(/\s*¦\s*/)
        .map((x) => x.trim())
        .filter((x) => x && !/^MINIMUM EQUIPMENT LIST$|^[AB]\d{3}$/.test(x));
      blocks.push(
        <p key={i} className="mrun">
          {parts.join(' › ')}
        </p>,
      );
      continue;
    }
    // 제목 표시(#) 없이 굵게만 된 항목 제목 줄("**00-00-00 Title …**")도 제목으로
    const h = HEAD.exec(l) ?? (/^\*\*\d{2}-\d{2}-\d{2}[A-Z]?\b[^*]*\*\*\s*$/.test(l) ? ['', '', l] : null);
    if (h) {
      // "**00-00-00**" 다음 줄 "**Title …**" → 한 제목으로
      let body = h[2];
      const only = ITEM_NO_ONLY.exec(l);
      const nx = only ? HEAD.exec(lines[i + 1] ?? '') : null;
      if (only && nx && !/^\**\d{2}-\d{2}/.test(nx[2])) {
        body = `${h[2]} ${nx[2]}`;
        i++;
      }
      const no = /^\**(\d{2}-\d{2}-\d{2}[A-Z]?)\b/.exec(body)?.[1];
      blocks.push(
        <h4 key={i} className={`mh${no ? ' mh-item' : ''}${no && tgt && no === tgt ? ' mh-target' : ''}`}>
          {inline(body, marks, onRef)}
        </h4>,
      );
      continue;
    }
    if (/^Ident\.:/.test(l)) {
      blocks.push(
        <p key={i} className="mident">
          {inline(l, marks, onRef)}
        </p>,
      );
      continue;
    }
    const li = /^(\s*)-\s+(.*)$/.exec(l);
    if (li) {
      blocks.push(
        <p key={i} className={`mli mli-${li[1].length ? Math.min(3, Math.floor(li[1].length / 3) + 2) : 1}`}>
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
