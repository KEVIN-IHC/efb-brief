// Ops 탭 "정상 절차" (D-078): 개인 체크리스트(편집 가능) · HAA 칸. FCOM SOP 원문 칸은 D-079에서 뺌
// 체크·입력은 비행마다 기기 안에만 저장. 회사 절차를 대신하지 않음
import { useState } from 'react';
import { formatZ } from '../../lib/time';
import { CHECKLIST_KEY, checksKey, DEFAULT_CHECKLIST, haaKey, progress, type CheckGroup, type CheckState, type HaaEntry } from '../checks/checks';
import { uuid } from '../../lib/uuid';
import { putKey, useDraft, useKey } from './store';
import { DocSection } from '../ofp/doc/ui';

export function Checklist({ flightId }: { flightId: string }) {
  const groups = useKey<CheckGroup[]>(CHECKLIST_KEY, DEFAULT_CHECKLIST);
  const st = useKey<CheckState>(checksKey(flightId), {});
  const [edit, setEdit] = useState(false);
  const p = progress(groups, st);
  const toggle = (id: string) => {
    const next = { ...st };
    if (next[id]) delete next[id];
    else next[id] = new Date().toISOString();
    void putKey(checksKey(flightId), next);
  };
  const saveGroups = (g: CheckGroup[]) => void putKey(CHECKLIST_KEY, g);

  return (
    <>
      <DocSection
        title="정상 절차 체크"
        meta={<span className={`mono ${p.done === p.total && p.total ? 'c-ok' : ''}`}>{p.done}/{p.total}</span>}
        className="span-all"
      >
        <div className="chk-bar">
          <button className={`btn small ${edit ? 'primary' : ''}`} onClick={() => setEdit((x) => !x)}>
            {edit ? '편집 끝' : '목록 편집'}
          </button>
          <button className="btn small" disabled={!p.done} onClick={() => confirm('이 비행의 체크를 모두 지울까요?') && void putKey(checksKey(flightId), {})}>
            체크 모두 지우기
          </button>
          {edit && (
            <button className="btn small" onClick={() => confirm('목록을 처음 기본 목록으로 되돌릴까요? (직접 추가한 항목은 없어짐)') && saveGroups(DEFAULT_CHECKLIST)}>
              기본 목록으로
            </button>
          )}
        </div>
        <div className="chk-groups">
          {groups.map((g, gi) => {
            const gp = progress([g], st);
            return (
              <div key={g.id} className="chk-group">
                <h4 className="ops-gh">
                  {g.title} <span className="mono">{gp.done}/{gp.total}</span>
                </h4>
                <ul className="chk-list">
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <label className={`chk-item ${st[it.id] ? 'on' : ''}`}>
                        <input type="checkbox" checked={!!st[it.id]} onChange={() => toggle(it.id)} />
                        <span>{it.label}</span>
                        {st[it.id] && <span className="mono small muted">{formatZ(st[it.id])}</span>}
                      </label>
                      {edit && (
                        <button
                          className="btn small"
                          aria-label={`${it.label} 빼기`}
                          onClick={() => saveGroups(groups.map((x, i) => (i === gi ? { ...x, items: x.items.filter((y) => y.id !== it.id) } : x)))}
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {edit && <AddItem onAdd={(label) => saveGroups(groups.map((x, i) => (i === gi ? { ...x, items: [...x.items, { id: uuid(), label }] } : x)))} />}
              </div>
            );
          })}
        </div>
        <p className="small muted">개인 확인용 목록입니다(기기 안, 비행마다 따로). 승인된 체크리스트·QRH·ECAM을 대신하지 않습니다.</p>
      </DocSection>
      <HaaSection flightId={flightId} />
    </>
  );
}

function AddItem({ onAdd }: { onAdd: (label: string) => void }) {
  const [t, setT] = useState('');
  return (
    <form
      className="chk-add"
      onSubmit={(e) => {
        e.preventDefault();
        if (t.trim()) onAdd(t.trim());
        setT('');
      }}
    >
      <input className="input" placeholder="항목 추가" value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn small" type="submit" disabled={!t.trim()}>
        추가
      </button>
    </form>
  );
}

function HaaSection({ flightId }: { flightId: string }) {
  const [h, set] = useDraft<HaaEntry>(haaKey(flightId), {});
  const f = (k: keyof HaaEntry, label: string, unit: string) => (
    <label className="fms-f">
      <span className="small muted">
        {label} ({unit})
      </span>
      <input className="input mono" inputMode="numeric" placeholder={unit} value={h[k] ?? ''} onChange={(e) => set({ [k]: e.target.value })} />
    </label>
  );
  return (
    <DocSection title="HAA" className="span-all">
      <div className="fms-grid">
        {f('hdg', 'HDG', '°')}
        {f('alt', 'ALT', 'ft')}
        {f('spd', 'AIR SPEED', 'kt')}
        {f('fuel', 'REQUIRED FUEL', 'lbs')}
      </div>
    </DocSection>
  );
}
