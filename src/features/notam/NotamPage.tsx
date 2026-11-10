// NOTAM 탭 (Phase 4): OFP NOTAM PACKAGE 1/2/3을 공항·FIR별로, 분류·강조·근거·원문 위치와 함께 보여준다.
// 원칙: 규칙으로 숨기지 않는다. 사용자가 고른 보기 필터만 있고, 필터로 가려진 건수를 항상 표시한다.
import { useMemo, useState } from 'react';
import { useActiveFlight } from '../flight/activeFlight';
import { OfpOpenButton } from '../ofp/OfpOpenButton';
import { jumpToOfpSource } from '../ofp/sourceJump';
import type { OfpData, OfpNotamItem, OfpNotamLocation, OfpNotams } from '../ofp/types';
import { formatDayZ } from '../../lib/time';
import { classifyNotam, GROUPS, groupLabel, type Classified, type NotamGroup } from './classify';
import { REFS } from './refs';
import { firWindows, flightWindow, ROLE_LABEL, TIME_TEXT, timeStatus, type TimeStatus, type Window } from './relevance';

type Pkg = 0 | 1 | 2 | 3;
const PKGS: { id: Pkg; label: string }[] = [
  { id: 0, label: '전체' },
  { id: 1, label: 'P1 공항' },
  { id: 2, label: 'P2 경로 공항' },
  { id: 3, label: 'P3 FIR' },
];

interface Row {
  it: OfpNotamItem;
  c: Classified;
  ts: TimeStatus;
}
interface LocView {
  loc: OfpNotamLocation;
  wins: Window[];
  rows: Row[];
}

function build(o: OfpData, n: OfpNotams): LocView[] {
  const fw = flightWindow(o);
  const firs = firWindows(o, n.firOrder);
  return n.packages.flatMap((p) =>
    p.locations.map((loc) => {
      const wins = loc.role === 'FIR' ? (firs.get(loc.icao) ?? [fw]) : [fw];
      return { loc, wins, rows: loc.items.map((it) => ({ it, c: classifyNotam(it), ts: timeStatus(it, wins) })) };
    }),
  );
}

const winText = (w: Window) => `${formatDayZ(new Date(w.from).toISOString())} ~ ${formatDayZ(new Date(w.to).toISOString())} · ${w.basis}`;

export function NotamPage() {
  const { ofp, loaded } = useActiveFlight();
  const o = ofp?.parsed;
  const n = o?.notams;
  const views = useMemo(() => (o && n ? build(o, n) : []), [o, n]);
  const [pkg, setPkg] = useState<Pkg>(0);
  const [groups, setGroups] = useState<Set<NotamGroup>>(new Set());
  const [keyOnly, setKeyOnly] = useState(false);
  const [overlapOnly, setOverlapOnly] = useState(false);

  if (!loaded) return null;
  if (!o || !n) {
    return (
      <section className="card placeholder">
        <p>{o ? '현재 OFP에 NOTAM 패키지가 없습니다 (데모 비행이거나 NOTAM이 빠진 OFP).' : '현재 비행의 OFP가 없습니다.'}</p>
        <OfpOpenButton />
      </section>
    );
  }

  const all = views.flatMap((v) => v.rows);
  const pass = (r: Row, v: LocView) =>
    (pkg === 0 || v.loc.pkg === pkg) && (groups.size === 0 || groups.has(r.c.group)) && (!keyOnly || r.c.key) && (!overlapOnly || r.ts === 'overlap');
  const shownViews = views.filter((v) => pkg === 0 || v.loc.pkg === pkg);
  const shown = shownViews.reduce((s, v) => s + v.rows.filter((r) => pass(r, v)).length, 0);
  const inPkg = shownViews.reduce((s, v) => s + v.rows.length, 0);
  const filtered = groups.size > 0 || keyOnly || overlapOnly;
  const toggle = (g: NotamGroup) =>
    setGroups((s) => {
      const x = new Set(s);
      if (x.has(g)) x.delete(g);
      else x.add(g);
      return x;
    });
  const fw = flightWindow(o);

  return (
    <div className="ntm">
      <section className="doc-sec">
        <header className="doc-h">
          <h3>NOTAM Summary</h3>
          <span className="doc-meta">
            {o.header.flightNo} {o.header.dep}→{o.header.arr}
          </span>
        </header>
        <div className="doc-b">
          <p className="small mono">비행 시간대 {winText(fw)}</p>
          <div className="ntm-pkgs">
            {n.packages.map((p) => {
              const ok = p.endFound && p.counts.headLines === p.counts.parsed;
              return (
                <button key={p.no} className="ntm-pkg" onClick={() => jumpToOfpSource(p.startLine)} title="원문 위치로">
                  <span className="cell-k">PACKAGE {p.no}</span>
                  <span className="mono strong">
                    {p.locations.length}곳 · {p.counts.parsed}건
                  </span>
                  <span className={`small ${ok ? 'c-ok' : 'c-bad'}`}>
                    {ok ? '✓' : '!'} 머리 줄 {p.counts.headLines} = 추출 {p.counts.parsed}
                    {p.endFound ? '' : ' · 끝 표시 없음'}
                  </span>
                  <span className="small muted mono">L{p.startLine}–L{p.endLine}</span>
                </button>
              );
            })}
          </div>
          <div className="ntm-groupsum">
            {GROUPS.filter((g) => g.key).map((g) => {
              const rs = all.filter((r) => r.c.group === g.id);
              return (
                <span key={g.id} className={`ntm-gs g-${g.id}`}>
                  {g.label} <b className="mono">{rs.length}</b>
                  <span className="muted"> · 강조 {rs.filter((r) => r.c.key).length} · 겹침 {rs.filter((r) => r.ts === 'overlap').length}</span>
                </span>
              );
            })}
          </div>
          <p className="doc-foot">
            규칙으로 숨긴 NOTAM은 없습니다. 분류는 OFP 제목(◼ …)과 본문의 공식 약어로 기기 안에서 계산합니다. D) 시간표는 해석하지 않으니 원문을 확인하세요. 보조 도구 — 승인된 EFB·원문이 우선합니다.
          </p>
          <details className="ntm-refs">
            <summary>근거 문서</summary>
            <ul>
              {Object.values(REFS).map((r) => (
                <li key={r.id}>
                  <b>{r.title}</b> — {r.where}
                  {!r.checked && <span className="chip chip-caution ntm-chk">원문 대조 필요</span>}
                  {r.note && <div className="muted small">{r.note}</div>}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>

      <div className="ntm-controls">
        <div className="segmented" role="tablist">
          {PKGS.map((p) => (
            <button key={p.id} role="tab" aria-selected={pkg === p.id} className={pkg === p.id ? 'on' : ''} onClick={() => setPkg(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="ntm-filters" aria-label="보기 필터">
          {GROUPS.map((g) => (
            <button key={g.id} className={`ntm-f g-${g.id} ${groups.has(g.id) ? 'on' : ''}`} aria-pressed={groups.has(g.id)} onClick={() => toggle(g.id)}>
              {g.label} <span className="mono">{all.filter((r) => r.c.group === g.id).length}</span>
            </button>
          ))}
          <button className={`ntm-f ${keyOnly ? 'on' : ''}`} aria-pressed={keyOnly} onClick={() => setKeyOnly((v) => !v)}>
            강조만
          </button>
          <button className={`ntm-f ${overlapOnly ? 'on' : ''}`} aria-pressed={overlapOnly} onClick={() => setOverlapOnly((v) => !v)}>
            시간대 겹침만
          </button>
        </div>
        <p className="small muted">
          표시 {shown} / {inPkg}건{filtered ? ` — 보기 필터로 ${inPkg - shown}건 가려짐` : ''}
          {filtered && (
            <button
              className="linkish"
              onClick={() => {
                setGroups(new Set());
                setKeyOnly(false);
                setOverlapOnly(false);
              }}
            >
              필터 해제
            </button>
          )}
        </p>
        <div className="ntm-index">
          {shownViews.map((v) => (
            <button key={`${v.loc.pkg}-${v.loc.line}`} className="ntm-idx" onClick={() => document.getElementById(`ntm-${v.loc.line}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <span className="muted">{v.loc.role}</span> <span className="mono">{v.loc.icao}</span>{' '}
              <span className="muted mono">{v.loc.seeAlso ? `→P${v.loc.seeAlso}` : v.rows.length}</span>
            </button>
          ))}
        </div>
      </div>

      {shownViews.map((v) => {
        const rows = v.rows.filter((r) => pass(r, v));
        return (
          <section key={`${v.loc.pkg}-${v.loc.line}`} className="doc-sec ntm-loc" id={`ntm-${v.loc.line}`}>
            <header className="doc-h">
              <h3>
                [{v.loc.role}] {v.loc.icao}
              </h3>
              <button className="doc-meta linkish" onClick={() => jumpToOfpSource(v.loc.line)}>
                P{v.loc.pkg} · L{v.loc.line}
              </button>
            </header>
            <div className="doc-b">
              <p className="ntm-locname">
                <b>{ROLE_LABEL[v.loc.role] ?? v.loc.role}</b> · {v.loc.name}
              </p>
              {!v.loc.seeAlso && <p className="small muted mono ntm-win">{v.wins.map(winText).join(' / ')}</p>}
              {v.loc.info.length > 0 && (
                <details className="ntm-info">
                  <summary>공항 정보 ({v.loc.info.length}줄)</summary>
                  <pre className="ntm-pre">{v.loc.info.map((l) => l.text).join('\n')}</pre>
                </details>
              )}
              {v.loc.seeAlso && <p className="small">PACKAGE {v.loc.seeAlso}의 같은 공항 참조 (OFP 원문 표기)</p>}
              {v.loc.noNotams && <p className="small">현재 NOTAM 없음 (OFP 원문 "NO CURRENT NOTAMS FOUND")</p>}
              {rows.map((r) => (
                <NotamCard key={r.it.line} r={r} />
              ))}
              {rows.length < v.rows.length && <p className="small muted">보기 필터로 {v.rows.length - rows.length}건 가려짐</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function NotamCard({ r }: { r: Row }) {
  const { it, c, ts } = r;
  const last = it.lines[it.lines.length - 1]?.n ?? it.line;
  return (
    <article className={`ntm-item g-${c.group} ${c.key ? 'key' : ''} ${ts === 'before' || ts === 'after' ? 'off-time' : ''}`}>
      <div className="ntm-top">
        <span className={`ntm-g g-${c.group}`}>{groupLabel(c.group)}</span>
        <span className="small muted">{it.category}</span>
        {it.id && <span className="mono strong">{it.id}</span>}
        {it.loc && <span className="mono small muted">{it.loc}</span>}
      </div>
      {it.kind !== 'text' && (
        <div className="ntm-time">
          <span className="mono small">
            {it.fromText} → {it.toText}
          </span>
          <span className={`chip ${ts === 'overlap' ? 'chip-caution' : 'chip-muted'}`}>{TIME_TEXT[ts]}</span>
          {it.schedule && <span className="chip chip-muted">D) 시간표 — 원문 확인</span>}
        </div>
      )}
      {(c.chips.length > 0 || c.runways.length > 0) && (
        <div className="ntm-chips">
          {c.runways.map((rw) => (
            <span key={rw} className="chip chip-muted mono">
              RWY {rw}
            </span>
          ))}
          {c.chips.map((k) => (
            <span key={k.id} className={`chip ${k.strong ? 'chip-warning' : 'chip-muted'}`} title={k.reason.text}>
              {k.label}
            </span>
          ))}
        </div>
      )}
      {it.schedule && <pre className="ntm-pre ntm-sub">D) {it.schedule}</pre>}
      <pre className="ntm-pre">{it.text}</pre>
      {(it.lower || it.upper) && (
        <p className="small mono">
          F) {it.lower ?? '—'} · G) {it.upper ?? '—'}
        </p>
      )}
      {it.comment && (
        <div className="ntm-comment">
          <span className="cell-k">회사 주석 (COMMENT)</span>
          <pre className="ntm-pre">{it.comment}</pre>
        </div>
      )}
      <div className="ntm-foot">
        <details>
          <summary>근거 {c.reasons.length + c.chips.length}</summary>
          <ul className="ntm-why">
            {[...c.reasons, ...c.chips.map((k) => k.reason)].map((x, i) => (
              <li key={i}>
                {x.text} <span className="muted">— {REFS[x.ref].short}</span>
                {!REFS[x.ref].checked && <span className="muted"> (원문 대조 필요)</span>}
                {x.line && (
                  <button className="linkish mono" onClick={() => jumpToOfpSource(x.line!)}>
                    L{x.line}
                  </button>
                )}
              </li>
            ))}
            {ts !== 'unknown' && <li>시간: 유효기간 B)~C)와 위 시간대 비교 (D) 시간표 미반영)</li>}
          </ul>
        </details>
        <button className="linkish mono small" onClick={() => jumpToOfpSource(it.line)}>
          원문 L{it.line}
          {last !== it.line ? `–L${last}` : ''}
        </button>
      </div>
    </article>
  );
}
