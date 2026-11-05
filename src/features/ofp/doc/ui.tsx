import type { ReactNode } from 'react';
import type { Level } from '../margins';

const LEVEL_TEXT: Record<Level, string> = { ok: 'OK', caution: 'CAUTION', warning: 'WARNING' };

export function LevelPill({ level, children }: { level: Level; children?: ReactNode }) {
  return <span className={`pill lv-${level}`}>{children ?? LEVEL_TEXT[level]}</span>;
}

/** Lido식 문서 블록: 대문자 머리줄 + 본문 */
export function DocSection({ title, meta, children, className = '', id }: { title: string; meta?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`doc-sec ${className}`} id={id}>
      <header className="doc-h">
        <h3>{title}</h3>
        {meta && <span className="doc-meta">{meta}</span>}
      </header>
      <div className="doc-b">{children}</div>
    </section>
  );
}

/** 라벨 위·값 아래 칸 */
export function Cell({ k, v, wide, tone }: { k: string; v: ReactNode; wide?: boolean; tone?: string }) {
  return (
    <div className={`cell ${wide ? 'wide' : ''}`}>
      <div className="cell-k">{k}</div>
      <div className={`cell-v ${tone ? `c-${tone}` : ''}`}>{v}</div>
    </div>
  );
}
