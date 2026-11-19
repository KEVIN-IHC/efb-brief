// 합동 브리핑 화면 (D-083): 왼쪽 체크리스트(고르기·편집) + 오른쪽 원고(그대로 읽는 문장)
// 체크·선택·입력은 비행마다 기기 안에(동기화 안 함). 항목 목록·원고 틀은 기기에 저장(사용자가 고친 것이 회사 preset보다 우선)
import { Fragment, useMemo, useRef, useState } from 'react';
import { uuid } from '../../lib/uuid';
import { formatZ } from '../../lib/time';
import type { CompanyRules } from '../brief/rules';
import { DocSection } from '../ofp/doc/ui';
import type { OfpData } from '../ofp/types';
import { useBrief } from '../brief/useBrief';
import { putKey, useDraft, useKey } from '../ops/store';
import {
  activeItems,
  AUTO_KEYS,
  autoValues,
  GENERIC_ITEMS,
  isOldGeneric,
  ITEMS_KEY,
  LAST_KEY,
  parseTemplate,
  renderText,
  stateKey,
  TURB_LEVELS,
  turbParts,
  wxValues,
  type JbItem,
  type JbState,
  type Seg,
  type TurbPart,
} from './template';

type Ctx = {
  st: JbState;
  set: (patch: Partial<JbState>) => void;
  auto: Record<string, string | undefined>;
  turb: TurbPart[];
  last: Record<string, string>;
};

const cKey = (it: JbItem, n: number) => `${it.id}:${n}`;

export function JointBrief({ flightId, o, rules }: { flightId: string; o: OfpData | null; rules: CompanyRules | null }) {
  const saved0 = useKey<JbItem[] | null>(ITEMS_KEY, null);
  // 예전 기본 틀을 그대로 저장한 것이면(고친 문장 없음) 무시 → 새 기본 틀·회사 preset
  const saved = saved0 && !isOldGeneric(saved0) ? saved0 : null;
  const preset = rules?.jointBrief?.items;
  const items = saved ?? preset ?? GENERIC_ITEMS;
  // 고친 목록을 쓰는 중인데 기준(preset·기본 틀)에 새로 생긴 문단 — 눌러서 넣기
  const missing = saved ? (preset ?? GENERIC_ITEMS).filter((p) => !saved.some((x) => x.id === p.id)) : [];
  const [st, set] = useDraft<JbState>(stateKey(flightId), {});
  const last = useKey<Record<string, string>>(LAST_KEY, {});
  const { brief } = useBrief();
  const auto = useMemo(() => ({ ...autoValues(o), ...wxValues(brief) }), [o, brief]);
  const turb = useMemo(() => turbParts(o), [o]);
  const ctx: Ctx = { st, set, auto, turb, last };
  const active = activeItems(items, st);
  const done = active.filter((it) => st.checked?.[it.id]).length;
  const [edit, setEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const first = st.firstFlight ?? true;

  const saveItems = (next: JbItem[]) => void putKey(ITEMS_KEY, next);
  const toggleCheck = (id: string) => {
    const c = { ...st.checked };
    if (c[id]) delete c[id];
    else c[id] = new Date().toISOString();
    set({ checked: c });
  };
  const script = active.map((it) => renderText(it, st, auto, turb, last)).join('\n\n');

  return (
    <div className="jb-two span-all">
      <DocSection title="Joint Briefing" meta={<span className={`mono ${done === active.length && active.length ? 'c-ok' : ''}`}>{done}/{active.length}</span>}>
        {saved && (
          <div className="jb-saved">
            <span>
              기기에 저장된 <b>고친 원고</b>를 쓰는 중입니다{missing.length > 0 ? ` · 기준 원고에 새 문단 ${missing.length}개(${missing.map((x) => x.title).join(' · ')})` : ''}.
            </span>
            {missing.length > 0 && (
              <button className="btn small" onClick={() => saveItems([...items, ...missing])}>
                새 문단 넣기
              </button>
            )}
            <button className="btn small primary" onClick={() => confirm(`저장된 원고를 지우고 ${preset ? '회사 preset' : '최신 기본 원고'}로 바꿀까요? (고친 문장은 없어짐, 체크·고른 값은 그대로)`) && void putKey(ITEMS_KEY, null)}>
              최신 원고로 바꾸기
            </button>
          </div>
        )}
        <div className="chk-bar">
          <div className="segmented jb-seg" role="group" aria-label="첫 비행·승무원 교체">
            <button className={first ? 'on' : ''} onClick={() => set({ firstFlight: true })}>
              첫 비행·교체
            </button>
            <button className={!first ? 'on' : ''} onClick={() => set({ firstFlight: false })}>
              이어서
            </button>
          </div>
          <button className={`btn small ${edit ? 'primary' : ''}`} onClick={() => setEdit((x) => !x)}>
            {edit ? '편집 끝' : '항목 편집'}
          </button>
          <button className="btn small" disabled={!done} onClick={() => confirm('이 비행의 체크를 모두 지울까요?') && set({ checked: {} })}>
            체크 지우기
          </button>
        </div>

        <div className="jb-lbl">포함할 문단</div>
        <div className="jb-chips">
          {items.map((it) => (
            <button
              key={it.id}
              className={`jb-chip ${!st.off?.[it.id] && (it.group === 'a' || first) ? 'on' : ''}`}
              disabled={it.group === 'b' && !first}
              aria-pressed={!st.off?.[it.id]}
              onClick={() => set({ off: { ...st.off, [it.id]: !st.off?.[it.id] } })}
            >
              {it.title}
            </button>
          ))}
        </div>

        {(['a', 'b'] as const).map((g) => (
          <Fragment key={g}>
            <div className="jb-gh">{g === 'a' ? 'a) 모든 비행' : 'b) 그날 첫 비행 · 승무원 교체 시'}</div>
            {items.map((it, idx) =>
              it.group !== g ? null : (
                <ItemRow
                  key={it.id}
                  it={it}
                  ctx={ctx}
                  on={!st.off?.[it.id] && (g === 'a' || first)}
                  checkedAt={st.checked?.[it.id]}
                  onCheck={() => toggleCheck(it.id)}
                  edit={edit}
                  onMove={(d) => {
                    // 같은 묶음(a/b) 안에서 바로 옆 항목과 바꿈
                    let j = idx + d;
                    while (j >= 0 && j < items.length && items[j].group !== g) j += d;
                    if (j < 0 || j >= items.length) return;
                    const next = [...items];
                    [next[idx], next[j]] = [next[j], next[idx]];
                    saveItems(next);
                  }}
                  onDelete={() => confirm(`"${it.title}" 항목을 지울까요?`) && saveItems(items.filter((x) => x.id !== it.id))}
                  onSave={(n) => saveItems(items.map((x) => (x.id === it.id ? n : x)))}
                />
              ),
            )}
            {edit && (
              <button className="btn small jb-add" onClick={() => saveItems([...items, { id: uuid(), title: '새 항목', group: g, text: '' }])}>
                + {g === 'a' ? 'a)' : 'b)'} 항목 추가
              </button>
            )}
          </Fragment>
        ))}
        {edit && (
          <div className="chk-bar jb-reset">
            <button
              className="btn small"
              disabled={!saved}
              onClick={() => confirm(`항목·원고를 ${preset ? '회사 기준 파일 preset' : '기본 틀'}으로 되돌릴까요? (고친 내용은 없어짐)`) && void putKey(ITEMS_KEY, null)}
            >
              {preset ? '회사 preset으로 되돌리기' : '기본 틀로 되돌리기'}
            </button>
          </div>
        )}
        {!preset && <p className="small c-warn">회사 기준 파일 preset이 없어 일반 기본 틀입니다. 신호 횟수 등 회사 문장은 Settings → 회사 기준 파일 가져오기 후 나옵니다.</p>}
        <p className="small muted">
          초록 = OFP에서 자동, 칩 = 눌러서 고르기. 근거 FOM 6.1.2.3 · 12.2.10. {preset ? `원고 preset: ${rules?.jointBrief?.source ?? '회사 기준 파일'}` : ''}
          {saved && ' · 고친 원고 사용 중'}
        </p>
      </DocSection>

      <DocSection
        title="원고"
        meta={
          <button className="btn small" onClick={() => void navigator.clipboard?.writeText(script).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)), () => alert('복사 실패'))}>
            {copied ? '복사됨' : '복사'}
          </button>
        }
      >
        <div className="jb-script">
          {active.map((it) => (
            <p key={it.id} className={st.checked?.[it.id] ? 'said' : ''}>
              <span className="jb-blk">
                {it.title}
                {it.ref && <span className="mono"> {it.ref}</span>}
              </span>
              <Script it={it} ctx={ctx} />
            </p>
          ))}
          {!active.length && <p className="muted">포함된 문단이 없습니다.</p>}
        </div>
      </DocSection>
    </div>
  );
}

/* ---------------- 원고 문단 ---------------- */

function Script({ it, ctx }: { it: JbItem; ctx: Ctx }) {
  const { st, set, auto, last } = ctx;
  return (
    <>
      {parseTemplate(it.text).map((s, i) => {
        if (s.t === 'text') return <Fragment key={i}>{s.v}</Fragment>;
        if (s.t === 'auto') {
          if (s.key === '난류') return <TurbScript key={i} ctx={ctx} />;
          const v = auto[s.key];
          return (
            <span key={i} className={`jb-fill ${v ? '' : 'miss'}`}>
              {v ?? `${s.key}?`}
            </span>
          );
        }
        if (s.t === 'choice') {
          const k = cKey(it, s.n);
          const cur = st.choice?.[k] ?? 0;
          return (
            <button key={i} className="jb-tap" onClick={() => set({ choice: { ...st.choice, [k]: (cur + 1) % s.opts.length } })} aria-label={`${s.opts[cur]} — 눌러서 바꾸기`}>
              {s.opts[cur]}
            </button>
          );
        }
        const v = st.input?.[cKey(it, s.n)] ?? last[s.label] ?? '';
        return v ? (
          <span key={i} className="jb-fill">
            {v}
          </span>
        ) : (
          <span key={i} className="jb-fill miss">
            {s.label}?
          </span>
        );
      })}
    </>
  );
}

function TurbScript({ ctx }: { ctx: Ctx }) {
  const { st, set, turb } = ctx;
  if (!turb.length) return <span className="jb-fill">OFP상 예상 난류 구간은 없습니다.</span>;
  return (
    <>
      난류는{' '}
      {turb.map((p, j) => {
        const lv = st.turb?.[p.i] ?? 0;
        return (
          <Fragment key={p.i}>
            <span className="jb-fill">{p.text}</span>{' '}
            <button className="jb-tap" onClick={() => set({ turb: { ...st.turb, [p.i]: (lv + 1) % TURB_LEVELS.length } })}>
              {TURB_LEVELS[lv]}
            </button>{' '}
            정도{j < turb.length - 1 ? ', ' : ' '}
          </Fragment>
        );
      })}
      예상됩니다.
    </>
  );
}

/* ---------------- 체크리스트 한 줄 ---------------- */

function ItemRow({
  it,
  ctx,
  on,
  checkedAt,
  onCheck,
  edit,
  onMove,
  onDelete,
  onSave,
}: {
  it: JbItem;
  ctx: Ctx;
  on: boolean;
  checkedAt?: string;
  onCheck: () => void;
  edit: boolean;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
  onSave: (n: JbItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const segs = parseTemplate(it.text);
  // 바꿀 수 있는 부분마다 앞말(직전 글의 마지막 구절)을 작은 이름표로 — 체크리스트에서도 무엇을 고르는지 보이게
  const live = segs.flatMap((s, i) => {
    if (s.t === 'text') return [];
    const prev = segs[i - 1];
    const tail = prev?.t === 'text' ? prev.v.split(/[.,!?。]\s*/).pop()!.trim() : '';
    const label = s.t === 'auto' ? (s.key === '난류' ? '' : s.key) : tail.length > 24 ? `…${tail.slice(-24)}` : tail;
    return [{ s, label }];
  });
  return (
    <div className={`jb-row ${on ? '' : 'off'} ${checkedAt ? 'said' : ''}`}>
      <div className="jb-row-h">
        <label className="jb-check">
          <input type="checkbox" checked={!!checkedAt} disabled={!on} onChange={onCheck} />
          <span className="jb-title">{it.title}</span>
        </label>
        {checkedAt && <span className="mono small muted">{formatZ(checkedAt)}</span>}
        {it.ref && <span className="jb-ref mono">{it.ref}</span>}
        {edit && (
          <span className="jb-tools">
            <button className="btn small" aria-label={`${it.title} 위로`} onClick={() => onMove(-1)}>
              ↑
            </button>
            <button className="btn small" aria-label={`${it.title} 아래로`} onClick={() => onMove(1)}>
              ↓
            </button>
            <button className={`btn small ${editing ? 'primary' : ''}`} onClick={() => setEditing((x) => !x)}>
              수정
            </button>
            <button className="btn small" aria-label={`${it.title} 지우기`} onClick={onDelete}>
              ✕
            </button>
          </span>
        )}
      </div>
      {editing ? (
        <ItemEditor it={it} onCancel={() => setEditing(false)} onSave={(n) => (onSave(n), setEditing(false))} />
      ) : live.length ? (
        <div className="jb-live">
          {live.map(({ s, label }, i) => (
            <span key={i} className="jb-part">
              {label && <span className="jb-plbl">{label}</span>}
              <Live s={s} it={it} ctx={ctx} />
            </span>
          ))}
        </div>
      ) : (
        <div className="jb-preview">{it.text || '(원고 없음 — 수정에서 쓰기)'}</div>
      )}
    </div>
  );
}

/** 체크리스트에서 바꿀 수 있는 부분: 선택지 = 칩 묶음, 입력 = 칸, 자동 = 초록 값 */
function Live({ s, it, ctx }: { s: Seg; it: JbItem; ctx: Ctx }) {
  const { st, set, auto, turb, last } = ctx;
  if (s.t === 'text') return null;
  if (s.t === 'auto') {
    if (s.key === '난류')
      return turb.length ? (
        <div className="jb-turb">
          {turb.map((p) => (
            <div key={p.i} className="jb-turb-row">
              <span className="jb-val">{p.text}</span>
              <span className="jb-chips">
                {TURB_LEVELS.map((l, k) => (
                  <button key={l} className={`jb-chip ${(st.turb?.[p.i] ?? 0) === k ? 'on' : ''}`} onClick={() => set({ turb: { ...st.turb, [p.i]: k } })}>
                    {l}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <span className="jb-val">난류: OFP SR 구간 없음</span>
      );
    const v = auto[s.key];
    return <span className={`jb-val ${v ? '' : 'miss'}`}>{v ?? `${s.key}?`}</span>;
  }
  if (s.t === 'choice') {
    const k = cKey(it, s.n);
    const cur = st.choice?.[k] ?? 0;
    return (
      <span className="jb-chips">
        {s.opts.map((op, j) => (
          <button key={j} className={`jb-chip ${cur === j ? 'on' : ''}`} onClick={() => set({ choice: { ...st.choice, [k]: j } })}>
            {op}
          </button>
        ))}
      </span>
    );
  }
  const k = cKey(it, s.n);
  return (
    <input
      className="input jb-in"
      placeholder={s.label}
      aria-label={s.label}
      value={st.input?.[k] ?? last[s.label] ?? ''}
      onChange={(e) => set({ input: { ...st.input, [k]: e.target.value } })}
      onBlur={(e) => e.target.value.trim() && void putKey(LAST_KEY, { ...last, [s.label]: e.target.value.trim() })}
    />
  );
}

/* ---------------- 항목 수정 ---------------- */

function ItemEditor({ it, onSave, onCancel }: { it: JbItem; onSave: (n: JbItem) => void; onCancel: () => void }) {
  const [d, setD] = useState<JbItem>(it);
  const ta = useRef<HTMLTextAreaElement>(null);
  const insert = (snip: string) => {
    const el = ta.current;
    const s = el?.selectionStart ?? d.text.length;
    const e = el?.selectionEnd ?? d.text.length;
    const text = d.text.slice(0, s) + snip + d.text.slice(e);
    setD({ ...d, text });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + snip.length, s + snip.length);
    });
  };
  return (
    <div className="jb-editor">
      <div className="jb-ed-row">
        <input className="input" aria-label="항목 제목" placeholder="제목" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        <input className="input mono jb-ed-ref" aria-label="FOM 위치" placeholder="FOM 위치" value={d.ref ?? ''} onChange={(e) => setD({ ...d, ref: e.target.value || undefined })} />
        <select className="input jb-ed-g" aria-label="묶음" value={d.group} onChange={(e) => setD({ ...d, group: e.target.value as 'a' | 'b' })}>
          <option value="a">a) 모든 비행</option>
          <option value="b">b) 첫 비행·교체</option>
        </select>
      </div>
      <textarea ref={ta} className="input jb-ed-text" rows={5} aria-label="원고" value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} />
      <div className="jb-chips jb-ed-ins">
        {AUTO_KEYS.map((a) => (
          <button key={a.key} className="jb-chip" title={a.label} onClick={() => insert(`{${a.key}}`)}>
            {`{${a.key}}`}
          </button>
        ))}
        <button className="jb-chip" onClick={() => insert('[없습니다|있습니다]')}>
          [선택지|…]
        </button>
        <button className="jb-chip" onClick={() => insert('<메모>')}>
          {'<직접 쓰기>'}
        </button>
      </div>
      <p className="small muted">
        {'{이름}'} = OFP 자동 · [가|나|다] = 눌러서 고르기 · {'<이름>'} = 직접 쓰는 칸. 미리보기: {renderText(d, {}, {}, [])}
      </p>
      <div className="chk-bar">
        <button className="btn small primary" disabled={!d.title.trim()} onClick={() => onSave({ ...d, title: d.title.trim() })}>
          저장
        </button>
        <button className="btn small" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}
