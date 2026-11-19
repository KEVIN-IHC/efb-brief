// 매시간 System Check 카드 (D-084) — 순항 화면. 칸 = 손글씨 한 줄 순서, 아래 = 기록 표, SD 페이지 체크, 📖 근거
import { useEffect, useRef, useState } from 'react';
import { kbProps, moveField, useAppKeyboard, useKbActive } from '../../app/AppKeyboard';
import { fmtSigned } from '../../lib/format';
import { formatZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { uuid } from '../../lib/uuid';
import { fmsKey, parseKilo, parseOil, type FmsEntry } from '../checks/checks';
import type { Step } from '../../app/kbStep';
import { docPages, loadCodeRefs, openManualPage, type ManualTarget } from '../manual/lookup';
import { listManuals, manualEvents } from '../manual/store';
import { DocSection } from '../ofp/doc/ui';
import type { OfpData } from '../ofp/types';
import { putKey, useDraft, useKey } from '../ops/store';
import { altCheck, dec1, DEC1_KEYS, num, draftKey, ENTRY_KEYS, normEntry, fuelTotal, lineText, nextDue, nowHHMM, oilBase, oilDelta, recsKey, SD_PAGES, type HourlyEntry, type HourlyRec } from './hourly';

type Refs = { alt?: ManualTarget; sd?: ManualTarget; fuel?: ManualTarget; oil?: ManualTarget; press?: ManualTarget; oxy?: ManualTarget };

/** 기기에 있는 매뉴얼에서 근거 쪽 찾기 (MEL처럼 📖로 그 자리 창) */
function useRefs(): Refs | undefined {
  const [refs, setRefs] = useState<Refs>();
  const [n, setN] = useState(0);
  useEffect(() => {
    const re = () => setN((x) => x + 1);
    manualEvents.addEventListener('change', re);
    return () => manualEvents.removeEventListener('change', re);
  }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: Refs = {};
      const fom = (await loadCodeRefs(['FOM-10.4.1.3']))['FOM-10.4.1.3'];
      if (fom) out.alt = { docId: fom.docId, seq: fom.seq, mark: '1 시간' };
      for (const d of (await listManuals()).filter((x) => x.kind === 'FCOM')) {
        const pages = await docPages(d.docId);
        const find = (code: string, re: RegExp, mark: string) => {
          const p = pages.find((x) => x.code?.startsWith(code) && re.test(x.text));
          return p ? { docId: d.docId, seq: p.seq, mark } : undefined;
        };
        out.sd ??= find('PRO-NOR-SOP-150', /SD PAGES/i, 'SD PAGES');
        out.fuel ??= find('PRO-NOR-SOP-150', /EVERY 30 MIN/i, 'EVERY 30 MIN');
        out.oil ??= find('PRO-NOR-SOP-150', /oil quantity variation/i, 'oil quantity variation');
        out.press ??= find('LIM-AIR', /Cabin Pressure/i, 'Cabin Pressure');
        out.oxy ??= find('LIM-OXY', /OXYGEN/i, 'OXYGEN');
      }
      if (alive) setRefs(out);
    })();
    return () => {
      alive = false;
    };
  }, [n]);
  return refs;
}

function Ref({ to, label, src }: { to: ManualTarget | undefined | null; label: string; src: string }) {
  return (
    <button type="button" className="fms-tl" onClick={() => (to ? openManualPage(to) : alert(`기기에 ${src.split(' ')[0]}가 없거나 해당 쪽을 찾지 못했습니다 — Settings → 매뉴얼 → 가져오기`))}>
      {label} <span>📖 {src}</span>
    </button>
  );
}

function Field({ v, set, title, ph, w, dec, step }: { v: string; set: (v: string) => void; title: string; ph: string; w: number; dec?: boolean; step?: Step }) {
  const appKb = useAppKeyboard();
  const ref = useRef<HTMLInputElement>(null);
  const kbEl = useKbActive();
  const [focus, setFocus] = useState(false);
  const editing = focus || (!!ref.current && kbEl === ref.current);
  const shown = dec && !editing && v ? (dec1(v) ?? v) : v;
  return (
    <input
      className="hc-in mono kb-in"
      style={{ width: `${w}ch` }}
      autoComplete="off"
      enterKeyHint="next"
      placeholder={ph}
      aria-label={title}
      ref={ref}
      value={shown}
      onChange={(ev) => set(ev.target.value)}
      {...kbProps(appKb, { label: title, set, raw: () => v, step })}
      onFocus={(ev) => (setFocus(true), ev.currentTarget.select())}
      onBlur={() => setFocus(false)}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          moveField(ev.currentTarget, 1);
        }
      }}
    />
  );
}

const sgn = (d: number | undefined) => (d === undefined ? '' : d === 0 ? '±0' : fmtSigned(d));
/** 오일처럼 소수 첫째 자리 */
const sgn1 = (d: number | undefined) => (d === undefined ? '—' : d === 0 ? '±0' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`);

const EMPTY: Partial<HourlyEntry> = Object.fromEntries([...ENTRY_KEYS, 'memo'].map((k) => [k, undefined]));

export function HourlyCheck({ flightId, o }: { flightId: string; o: OfpData | null }) {
  const recs = useKey<HourlyRec[]>(recsKey(flightId), []);
  const [e, set] = useDraft<HourlyEntry>(draftKey(flightId), {});
  // 연달아 눌러도 앞 값이 빠지지 않게 마지막 값 기준
  const latest = useRef(e);
  latest.current = e;
  const [editId, setEditId] = useState<string | null>(null);
  const editing = editId ? recs.find((r) => r.id === editId) : undefined;
  const fms = useKey<FmsEntry>(fmsKey(flightId), {});
  const refs = useRefs();
  const now = useNow(15000);
  const due = nextDue(recs, now);
  const idx = editing ? recs.indexOf(editing) : recs.length;
  const prev = recs[idx - 1];

  // 시각: 비어 있으면 지금 시각을 칸에 그대로 보여 줌(그대로 기록됨), 고치면 고친 값
  const timeShown = e.time ?? nowHHMM(new Date(now));
  const view: HourlyEntry = { ...e, time: timeShown };

  // 출발 FOB (100 단위): FMS 칸에 쓴 FOB → 없으면 OFP RAMP OUT
  const depLbs = parseKilo(fms.fob) ?? o?.fuel.block;
  const dep100 = depLbs !== undefined ? Math.round(depLbs / 100) : undefined;
  const tot = fuelTotal(view);
  const alt = altCheck(view);
  const od = oilDelta(view, prev);
  // 오일 사용량 기준: Preflight(OFP 화면 SYSTEMS 오일 칸) → 없으면 첫 기록
  const ob = oilBase(fms, recs);
  const obd = ob && (editing ? editing.id !== (ob.base as HourlyRec).id : true) ? oilDelta(view, ob.base) : undefined;
  const fuelSrc = parseKilo(fms.fob) !== undefined ? 'FMS FOB' : 'OFP RAMP';
  const sd = new Set(e.sd ?? []);
  const toggleSd = (id: string) => {
    const s2 = new Set(latest.current.sd ?? []);
    if (s2.has(id)) s2.delete(id);
    else s2.add(id);
    latest.current = { ...latest.current, sd: [...s2] };
    set({ sd: [...s2] });
  };
  const hasAny = ENTRY_KEYS.some((k) => k !== 'time' && e[k]?.trim()) || sd.size > 0 || !!e.memo?.trim();

  // ± 키 기준 (D-089): 앞 기록 값. F/O·STBY 고도는 지금 쓴 CAPT 값, 엔진 2~4 오일은 지금 쓴 1번 값 먼저
  const stepFor = (k: (typeof ENTRY_KEYS)[number]): Step => {
    if (k === 'time') return { kind: 'hm', clock: true };
    const dec = (DEC1_KEYS as readonly string[]).includes(k);
    const p = (s: string | undefined) => (s?.trim() ? (dec ? parseOil(s) : num(s)) : undefined);
    if ((k === 'altF' || k === 'altS') && p(e.altC) !== undefined) return { kind: 'num', plan: p(e.altC), planLabel: 'CAPT' };
    if ((k === 'oil2' || k === 'oil3' || k === 'oil4') && p(e.oil1) !== undefined && p(prev?.[k]) === undefined) return { kind: 'num', dp: 1, plan: p(e.oil1), planLabel: 'ENG 1' };
    const pv = p(prev?.[k]);
    // 첫 기록의 오일 = 출발 전 SYSTEMS 오일 칸
    if (pv === undefined && (k === 'oil1' || k === 'oil2' || k === 'oil3' || k === 'oil4') && parseOil(fms[k]) !== undefined) return { kind: 'num', dp: 1, plan: parseOil(fms[k]), planLabel: 'PREFLIGHT' };
    return dec ? { kind: 'num', dp: 1, plan: pv, planLabel: '앞 기록' } : { kind: 'num', plan: pv, planLabel: '앞 기록' };
  };
  const f = (k: (typeof ENTRY_KEYS)[number], title: string, ph: string, w: number) => (
    <Field v={(k === 'time' ? timeShown : e[k]) ?? ''} set={(v) => set({ [k]: v })} title={title} ph={ph} w={w} dec={(DEC1_KEYS as readonly string[]).includes(k)} step={stepFor(k)} />
  );
  const sl = <span className="hc-sl">/</span>;

  const clear = () => {
    set({ ...EMPTY, sd: [] });
    setEditId(null);
  };
  const save = () => {
    const vals = normEntry({ ...e, time: timeShown.trim() || nowHHMM() });
    if (editing) {
      void putKey(recsKey(flightId), recs.map((r) => (r.id === editing.id ? { ...r, ...EMPTY, ...vals, id: r.id, savedAt: r.savedAt } : r)));
    } else {
      void putKey(recsKey(flightId), [...recs, { ...vals, id: uuid(), savedAt: new Date().toISOString() }]);
    }
    clear();
  };
  const startEdit = (r: HourlyRec) => {
    const { id: _i, savedAt: _s, ...vals } = r;
    set({ ...EMPTY, ...vals, sd: r.sd ?? [] });
    setEditId(r.id);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= recs.length) return;
    const next = [...recs];
    [next[i], next[j]] = [next[j], next[i]];
    void putKey(recsKey(flightId), next);
  };

  const altTxt = (x: { d: number; ok: boolean; lim?: number } | undefined, lor?: boolean) =>
    x && (
      <span className={`mono ${x.ok ? 'c-ok' : 'c-warn'}`}>
        {sgn(x.d)}
        {x.lim !== undefined ? (x.ok ? ' ✓' : ' ⚠') : ''}
        {lor ? ' LOSS OF REDUNDANCY' : ''}
      </span>
    );

  return (
    <DocSection
      title="Hourly check"
      meta={
        due ? (
          <span className={`mono ${due.inMin <= 0 ? 'c-warn' : ''}`}>
            다음 {formatZ(due.at)} · {due.inMin > 0 ? `${due.inMin}분 후` : `${-due.inMin}분 지남`}
          </span>
        ) : (
          <span className="mono">첫 기록 전</span>
        )
      }
      className="span-all"
    >
      <div className={`hc-form ${editing ? 'editing' : ''}`}>
        {editing && <div className="hc-editing">{editing.time}Z 기록 수정 중</div>}
        <div className="hc-strip">
          <div className="hc-g">
            <span className="cell-k">TIME Z</span>
            <div className="hc-ins">{f('time', 'TIME Z', 'HHMM', 5)}</div>
          </div>
          <div className="hc-g">
            <Ref to={refs && (refs.alt ?? null)} label="ALT C / S / F · FT" src="FOM 10.4.1.3" />
            <div className="hc-ins">
              {f('altC', 'ALT CAPT FT', 'CAPT', 6)}
              {sl}
              {f('altS', 'ALT STBY FT', 'STBY', 6)}
              {sl}
              {f('altF', 'ALT F/O FT', 'F/O', 6)}
            </div>
          </div>
          <div className="hc-g">
            <Ref to={refs && (refs.oil ?? null)} label="OIL 1 / 2 / 3 / 4 · QT" src="FCOM SOP-150" />
            <div className="hc-ins">
              {f('oil1', 'OIL ENG 1 QT', '1', 4.5)}
              {sl}
              {f('oil2', 'OIL ENG 2 QT', '2', 4.5)}
              {sl}
              {f('oil3', 'OIL ENG 3 QT', '3', 4.5)}
              {sl}
              {f('oil4', 'OIL ENG 4 QT', '4', 4.5)}
            </div>
          </div>
          <div className="hc-g">
            <Ref to={refs && (refs.press ?? null)} label="ΔP PSI / CAB ALT FT" src="LIM-AIR" />
            <div className="hc-ins">
              {f('dp', 'ΔP PSI', 'PSI', 4)}
              {sl}
              {f('cab', 'CAB ALT FT', 'FT', 5.5)}
            </div>
          </div>
          <div className="hc-g">
            <Ref to={refs && (refs.fuel ?? null)} label="FU + FOB (×100)" src="FCOM SOP-150" />
            <div className="hc-ins">
              {f('fu', 'FU', 'FU', 5)}
              <span className="hc-sl">+</span>
              {f('fob', 'FOB', 'FOB', 5)}
              <span className="hc-sl">=</span>
              <b className="mono hc-tot">{tot ?? '—'}</b>
            </div>
          </div>
          <div className="hc-g">
            <Ref to={refs && (refs.oxy ?? null)} label="OXY CKPT / CABIN · PSI" src="LIM-OXY" />
            <div className="hc-ins">
              {f('oxyC', 'OXY CKPT PSI', 'CKPT', 5)}
              {sl}
              {f('oxyCab', 'OXY CABIN PSI', 'CABIN', 5)}
            </div>
          </div>
        </div>

        <div className="hc-sum">
          {(alt.pfd || alt.isis) && (
            <div className="hc-stat">
              <span className="cell-k">ALT 차이</span>
              <span className="hc-stat-v">
                {alt.pfd && (
                  <span>
                    F/O {altTxt(alt.pfd, alt.pfd.lor)} <i>≤{alt.pfd.lim}</i>
                  </span>
                )}
                {alt.isis && (
                  <span>
                    STBY {altTxt(alt.isis)} {alt.isis.lim !== undefined && <i>≤{alt.isis.lim}</i>}
                  </span>
                )}
              </span>
            </div>
          )}
          {dep100 !== undefined && (
            <div className="hc-stat">
              <span className="cell-k">FUEL vs RAMP</span>
              <span className="hc-stat-v mono">
                <b className={`hc-big ${tot !== undefined && tot - dep100 < 0 ? 'c-warn' : ''}`}>{tot !== undefined ? sgn(tot - dep100) : '—'}</b>
                <span className="hc-mini">
                  {tot ?? '—'} vs {dep100} <i>{fuelSrc}</i>
                </span>
              </span>
            </div>
          )}
          {(obd?.some((x) => x !== undefined) || od.some((x) => x !== undefined)) && (
            <div className="hc-stat">
              <span className="cell-k">OIL 사용 · QT</span>
              <span className="hc-stat-v mono">
                {obd?.some((x) => x !== undefined) && (
                  <b className="hc-big hc-oil">{obd.map(sgn1).join('/')}</b>
                )}
                <span className="hc-mini">
                  {!obd?.some((x) => x !== undefined) && <>{od.map(sgn1).join("/")} <i>앞 기록 대비</i></>}
                  {obd?.some((x) => x !== undefined) && <i>{ob!.src === 'PREFLIGHT' ? '출발 전 대비' : '첫 기록 대비'}</i>}
                  {od.some((x) => x !== undefined) && obd?.some((x) => x !== undefined) && prev !== ob?.base && <> · 앞 기록 {od.map(sgn1).join('/')}</>}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="hc-sdrow">
          <Ref to={refs && (refs.sd ?? null)} label="SD" src="FCOM SOP-150" />
          {SD_PAGES.map((p) => (
            <button key={p.id} type="button" aria-pressed={sd.has(p.id)} title={p.what} className={`jb-chip ${sd.has(p.id) ? 'on' : ''}`} onClick={() => toggleSd(p.id)}>
              {sd.has(p.id) ? '✓ ' : ''}
              {p.label}
            </button>
          ))}
          <button type="button" className="btn small" onClick={() => set({ sd: SD_PAGES.map((p) => p.id) })}>
            모두
          </button>
        </div>

        <div className="hc-save">
          <input className="input" aria-label="메모" placeholder="메모 (선택)" value={e.memo ?? ''} onChange={(ev) => set({ memo: ev.target.value })} />
          {(editing || hasAny || e.time !== undefined) && (
            <button className="btn" onClick={clear}>
              {editing ? '취소' : '비우기'}
            </button>
          )}
          <button className="btn primary" disabled={!hasAny && !editing} onClick={save}>
            {editing ? '수정 저장' : '기록'}
          </button>
        </div>
      </div>

      {recs.length > 0 && (
        <ol className="hc-list">
          {recs.map((r, i) => {
            const a = altCheck(r);
            const t = fuelTotal(r);
            const ok = (!a.pfd || a.pfd.ok) && (!a.isis || a.isis.ok);
            const odr = ob ? oilDelta(r, ob.base) : oilDelta(r, recs[i - 1]);
            return (
              <li key={r.id} className={r.id === editId ? 'on' : ''}>
                <button type="button" className="hc-line mono" onClick={() => startEdit(r)} aria-label={`${r.time}Z 기록 수정`}>
                  <span className={ok ? '' : 'c-warn'}>{lineText(r)}</span>
                  <span className="hc-sub">
                    {t !== undefined && dep100 !== undefined && <span className={t - dep100 < 0 ? 'c-warn' : ''}>RAMP {sgn(t - dep100)}</span>}
                    {odr.some((x) => x !== undefined && x !== 0) && <span>OIL {odr.map(sgn1).join('/')}</span>}
                    <span>SD {r.sd?.length ?? 0}/{SD_PAGES.length}</span>
                  </span>
                </button>
                <span className="hc-tools">
                  <button className="btn small" aria-label={`${r.time}Z 위로`} disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button className="btn small" aria-label={`${r.time}Z 아래로`} disabled={i === recs.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button
                    className="btn small"
                    aria-label={`${r.time}Z 기록 지우기`}
                    onClick={() => {
                      if (!confirm(`${r.time}Z 기록을 지울까요?`)) return;
                      if (r.id === editId) clear();
                      void putKey(recsKey(flightId), recs.filter((x) => x.id !== r.id));
                    }}
                  >
                    ✕
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {recs.length > 0 && (
        <button className="btn small hc-copy" onClick={() => void navigator.clipboard?.writeText(recs.map(lineText).join('\n')).catch(() => alert('복사 실패'))}>
          손글씨 줄로 복사
        </button>
      )}
      <p className="small muted">
        줄을 누르면 위 칸에서 고칠 수 있습니다. 시각은 지금 시각이 자동으로 들어가고 고칠 수 있습니다. 연료는 100 단위(2445 = 244,500). 고도계 ✓/⚠ = FL300 이상 FCOM 표(PFD 150 · ISIS 320), 아래는 FOM 순항 200 · 200 초과 = Loss of Redundancy. FUEL vs RAMP = FU+FOB − 출발 연료(FMS FOB 칸 → 없으면 OFP RAMP OUT), 마이너스면 누유 의심(주황). OIL 사용 = 출발 전 SYSTEMS 오일 칸(없으면 첫 기록) 대비. 오일·여압·산소는 숫자만(판정 안 함). 기기 안에만 저장.
      </p>
    </DocSection>
  );
}
