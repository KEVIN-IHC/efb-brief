// 항로 스펙 (D-104): 위 = 항로 띠(시간 축, 스펙마다 한 줄 — 시안 C), 아래 = FIR × 스펙 표(시안 A), 칸·띠를 누르면 근거 서랍.
// 요구 표는 회사 기준 파일(routeSpec, 비공개) — 없으면 FPL 신고 풀이만.
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadRules, rulesEvents, type RouteSpecData, type SpecKey } from '../brief/rules';
import { loadCodeRefs, openManualPage } from '../manual/lookup';
import { DocSection } from '../ofp/doc/ui';
import type { OfpData } from '../ofp/types';
import { CAP_LABEL } from './fplCaps';
import { evaluateRouteSpec, SPEC_COLS, type CellStatus, type SpecLeg } from './evaluate';

const BADGE: Record<CellStatus, { cls: string; t: string }> = {
  ok: { cls: 'ok', t: '✓ 맞음' },
  warn: { cls: 'warn', t: '⚠ 확인' },
  missing: { cls: 'bad', t: '✕ 신고 없음' },
  unknown: { cls: 'q', t: '? 자료 없음' },
  na: { cls: 'na', t: '요구 없음' },
};
const LEVEL: Record<string, string> = { required: '필수', area: '적용 구역 (못 맞추면 분리·절차가 달라짐)', info: '참고', nodata: '자료 없음' };
const z = (t: number) => (Number.isFinite(t) ? `${new Date(t).toISOString().slice(11, 13)}${new Date(t).toISOString().slice(14, 16)}Z` : '—');

function useRouteSpecData(): RouteSpecData | null | undefined {
  const [d, setD] = useState<RouteSpecData | null | undefined>(undefined);
  useEffect(() => {
    const load = () => void loadRules().then((r) => setD(r?.rules.routeSpec ?? null), () => setD(null));
    load();
    rulesEvents.addEventListener('change', load);
    return () => rulesEvents.removeEventListener('change', load);
  }, []);
  return d;
}

export function RouteSpecCard({ o }: { o: OfpData }) {
  const data = useRouteSpecData();
  const res = useMemo(() => evaluateRouteSpec(o, data), [o, data]);
  const [sel, setSel] = useState<{ leg: number; spec: SpecKey } | null>(null);
  const drawer = useRef<HTMLDivElement>(null);
  // 칸을 고르면 근거 서랍이 보이게 (아이폰에서 띠를 누르면 서랍이 화면 밖이라)
  useEffect(() => {
    if (sel) drawer.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [sel]);
  const [refs, setRefs] = useState<Record<string, { docId: string; seq: number }>>({});
  useEffect(() => {
    const codes = [...new Set((data?.rules ?? []).flatMap((r) => r.refs.map((x) => x.code)))];
    if (codes.length) void loadCodeRefs(codes).then(setRefs).catch(() => setRefs({}));
  }, [data]);

  const total = res.legs.length ? Math.max(1, res.legs.at(-1)!.end - res.legs[0].start) : 1;
  const width = (l: SpecLeg) => (Number.isFinite(l.end - l.start) && l.end > l.start ? Math.max(7, ((l.end - l.start) / total) * 100) : 100 / res.legs.length);
  const cur = sel ? res.legs[sel.leg]?.cells[sel.spec] : null;
  const curLeg = sel ? res.legs[sel.leg] : null;
  const meta = o.atsFpl ? `FPL ${o.header.acType} · ${o.atsFpl.equipment}` : 'ATS FPL 없음';

  return (
    <DocSection title="Route Spec · 항로 스펙" meta={<span className="mono">{meta}</span>} className="span-all">
      {data === null && <p className="notice warn small">회사 기준 파일에 항로 요구 표(routeSpec)가 없습니다 — Settings → 매뉴얼 → 가져오기로 새 company-rules.json을 넣으면 FIR마다 요구와 비교합니다. 지금은 FPL 신고 풀이만.</p>}
      {res.noFpl && <p className="notice warn small">OFP에서 ATS FPL 블록을 찾지 못해 신고 내용을 비교할 수 없습니다.</p>}
      <div className="rs-sum">
        {(['ok', 'warn', 'missing', 'unknown'] as CellStatus[]).map((k) =>
          res.counts[k] ? (
            <span key={k} className={`rs-b ${BADGE[k].cls}`}>
              {BADGE[k].t} {res.counts[k]}
            </span>
          ) : null,
        )}
        <span className={`rs-b ${res.melHits.length ? 'warn' : 'ok'}`}>
          MEL {o.mel.length}건 · 스펙 계통 {res.melHits.length}
        </span>
        {!res.aircraftKnown && <span className="rs-b q">기종 기본 능력 자료 없음</span>}
      </div>

      {/* C: 항로 띠 */}
      <div className="rs-scroll">
        <div className="rs-strip">
          <div className="rs-segs">
            {res.legs.map((l, i) => (
              <div key={`${l.icao}-${i}`} style={{ width: `${width(l)}%` }}>
                <b className="mono">{l.icao}</b>
                <small className="mono">{z(l.start)}</small>
              </div>
            ))}
          </div>
          {SPEC_COLS.map((c) => (
            <div key={c.key} className="rs-lane">
              <span className="rs-lb">{c.label}</span>
              <div className="rs-bar">
                {res.legs.map((l, i) => {
                  const cell = l.cells[c.key];
                  const on = sel?.leg === i && sel.spec === c.key;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`rs-seg s-${cell.status} ${on ? 'on' : ''}`}
                      style={{ width: `${width(l)}%` }}
                      title={`${l.icao} · ${c.label}: ${BADGE[cell.status].t}`}
                      aria-label={`${l.icao} ${c.label} ${BADGE[cell.status].t}`}
                      onClick={() => setSel(on ? null : { leg: i, spec: c.key })}
                    >
                      {cell.status === 'na' ? '' : BADGE[cell.status].t.slice(0, 1)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* A: FIR × 스펙 표 */}
      <div className="rs-scroll">
        <table className="rs-tbl">
          <thead>
            <tr>
              <th>FIR · 진입</th>
              {SPEC_COLS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>결과</th>
            </tr>
          </thead>
          <tbody>
            {res.legs.map((l, i) => (
              <tr key={`${l.icao}-${i}`} className={sel?.leg === i ? 'sel' : ''}>
                <td className="rs-fir">
                  <b className="mono">{l.icao}</b>
                  <small>
                    {l.name ? `${l.name} · ` : ''}
                    <span className="mono">{z(l.start)}</span>
                  </small>
                </td>
                {SPEC_COLS.map((c) => {
                  const cell = l.cells[c.key];
                  const on = sel?.leg === i && sel.spec === c.key;
                  return (
                    <td key={c.key}>
                      <button type="button" className={`rs-cell ${on ? 'on' : ''}`} onClick={() => setSel(on ? null : { leg: i, spec: c.key })} aria-expanded={on}>
                        <span className={`rs-b ${BADGE[cell.status].cls}`}>{BADGE[cell.status].t}</span>
                        {cell.status !== 'na' && <span className="rs-short">{cell.short}</span>}
                      </button>
                    </td>
                  );
                })}
                <td className="rs-res small">{l.result.join(' · ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cur && curLeg && (
        <div className="rs-drawer" ref={drawer}>
          <h4>
            {curLeg.icao} · {SPEC_COLS.find((c) => c.key === cur.spec)?.label} <span className={`rs-b ${BADGE[cur.status].cls}`}>{BADGE[cur.status].t}</span>
            <button type="button" className="btn small rs-close" onClick={() => setSel(null)}>
              닫기
            </button>
          </h4>
          <div className="rs-tri">
            <div>
              <b>① 항로 요구</b>
              {cur.hits.length === 0 && <p className="muted">이 FIR·구간에 요구 표 항목 없음</p>}
              {cur.hits.map((h) => (
                <div key={h.rule.id} className="rs-rule">
                  <span className={`rs-b ${BADGE[h.status].cls}`}>{LEVEL[h.rule.level] ?? h.rule.level}</span> {h.rule.text}
                  {h.rule.need.length > 0 && <div className="small muted">필요: {h.rule.need.map((c) => CAP_LABEL[c]).join(' · ')}</div>}
                  {h.outOfHours && <div className="small c-caution">통과 {z(curLeg.start)}–{z(curLeg.end)} — 운영 시간 {h.rule.hours}Z 밖</div>}
                  {h.missing.length > 0 && <div className="small c-bad">FPL 신고 없음: {h.missing.map((c) => CAP_LABEL[c]).join(' · ')}</div>}
                  {h.status === 'ok' && h.rule.okText && <div className="small">→ {h.rule.okText}</div>}
                  {h.status !== 'ok' && h.rule.ifNot && <div className="small">→ {h.rule.ifNot}</div>}
                  <div className="rs-refs">
                    {h.rule.refs.map((r) =>
                      refs[r.code] ? (
                        <button key={r.code} type="button" className="btn small" onClick={() => openManualPage(refs[r.code])}>
                          📖 {r.label}
                        </button>
                      ) : (
                        <span key={r.code} className="small muted" title="이 기기에 그 매뉴얼 묶음이 없음">
                          {r.label} (매뉴얼 없음)
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <b>② FPL 신고</b>
              {cur.filed.length ? (
                <ul className="rs-codes">
                  {cur.filed.map((c) => (
                    <li key={c.code}>
                      <span className="mono rs-code">{c.code}</span> {c.meaning}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">해당 코드 없음</p>
              )}
            </div>
            <div>
              <b>③ 오늘 비행기</b>
              {cur.mel.length ? (
                <ul className="rs-codes">
                  {cur.mel.map((m) => (
                    <li key={m.item.itemNo + m.item.title}>
                      <span className="mono rs-code">
                        {m.item.kind} {m.item.itemNo}
                      </span>{' '}
                      {m.item.title} — <span className="c-caution">{m.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>OFP MEL/CDL {o.mel.length}건 중 이 스펙 계통 없음</p>
              )}
              {cur.baseMissing.length > 0 && <p className="c-caution small">기종 기본 능력 표에 없음: {cur.baseMissing.map((c) => CAP_LABEL[c]).join(' · ')}</p>}
              {!res.aircraftKnown && <p className="small muted">기종 기본 능력(회사 승인·FCOM)은 자료 없음 — 회사 자료로 확인</p>}
              <p className="small muted">MEL 계통 → 스펙 연결은 앱 분류(확인 필요까지만). MEL 원문은 OFP · MEL/CDL 카드에서</p>
            </div>
          </div>
        </div>
      )}

      <details className="rs-dec">
        <summary>② FPL 신고 코드 풀이 ({res.codes.length}개 · ICAO Doc 4444)</summary>
        <ul className="rs-codes">
          {res.codes.map((c) => (
            <li key={c.code}>
              <span className="mono rs-code">{c.code}</span> {c.meaning}
            </li>
          ))}
        </ul>
      </details>
      <p className="small muted">
        요구 = 회사 기준 파일 항로 요구 표{data?.source ? ` (${data.source})` : ''} · 신고 = OFP 안 ATS FPL · 비행기 = OFP MEL/CDL. 앱은 대조만 — 승인·운항 판단은 회사 자료·승인된 EFB 기준.
      </p>
    </DocSection>
  );
}
