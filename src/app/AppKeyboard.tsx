// 앱 키보드 (D-081·D-082): 아이패드(≥768px)에서 iOS 키보드 대신 화면 아래에 뜸. FMS 칸·순항 기록 입력 창에서 사용.
// 위 막대 = ‹ 이전 · 다음 › · 칸 이름 · OFP 값 · 완료, 아래 = QWERTY + 작은 숫자판. 블루투스 키보드는 그대로 동작.
// 쓰는 법: input에 class `kb-in`(또는 `fms-in`) + inputMode={useAppKeyboard() ? 'none' : …} + onFocus kbFocus / onBlur kbBlur
import { useEffect, useSyncExternalStore, type PointerEvent as RPointerEvent } from 'react';

type Active = { el: HTMLInputElement; label: string; set: (v: string) => void; hint?: string };

/* ---------- 지금 입력 중인 칸 (모듈 하나에 저장) ---------- */
let active: Active | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f));

export function kbFocus(a: Active) {
  active = a;
  emit();
}
export function kbBlur(el: HTMLInputElement) {
  if (active?.el === el) {
    active = null;
    emit();
  }
}

/* ---------- 아이패드 크기에서만 앱 키보드 (아이폰은 iOS 키보드) ---------- */
const MQ = '(min-width: 768px)';
const mqSub = (f: () => void) => {
  const m = window.matchMedia(MQ);
  m.addEventListener('change', f);
  return () => m.removeEventListener('change', f);
};
export function useAppKeyboard(): boolean {
  return useSyncExternalStore(mqSub, () => window.matchMedia(MQ).matches, () => false);
}

/** 화면 순서로 앞/뒤 칸 (창 안에 있으면 그 창 안에서만) */
export function moveField(el: HTMLInputElement, dir: 1 | -1) {
  const root: ParentNode = el.closest('[role="dialog"]') ?? document;
  const all = [...root.querySelectorAll<HTMLInputElement>('input.fms-in, input.kb-in')];
  const next = all[all.indexOf(el) + dir];
  if (next) next.focus();
  else if (dir === 1) el.blur();
}

function insert(a: Active, ch: string) {
  const { el } = a;
  const v = el.value;
  const s = el.selectionStart ?? v.length;
  const e = el.selectionEnd ?? v.length;
  a.set(v.slice(0, s) + ch + v.slice(e));
  requestAnimationFrame(() => el.setSelectionRange(s + ch.length, s + ch.length));
}
function backspace(a: Active) {
  const { el } = a;
  const v = el.value;
  let s = el.selectionStart ?? v.length;
  const e = el.selectionEnd ?? v.length;
  if (s === e) s = Math.max(0, s - 1);
  if (s === e) return;
  a.set(v.slice(0, s) + v.slice(e));
  requestAnimationFrame(() => el.setSelectionRange(s, s));
}

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** 앱에 하나만 둔다 (App.tsx). 키를 눌러도 입력 칸 초점이 빠지지 않게 pointerdown 기본 동작을 막음 */
export function AppKeyboard() {
  const a = useSyncExternalStore(subscribe, () => active, () => null);
  const on = useAppKeyboard();
  const open = on && !!a;

  // 열려 있는 동안 화면 아래·창 아래에 키보드 높이만큼 여백(.kb-open) + 입력 칸이 키보드에 가리지 않게
  useEffect(() => {
    document.documentElement.classList.toggle('kb-open', open);
    if (open && a) a.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return () => document.documentElement.classList.remove('kb-open');
  }, [open, a]);

  // 입력 칸이 화면에서 사라지면(창 닫힘·탭 이동) 키보드도 닫음 — 이때는 blur가 오지 않음
  useEffect(() => {
    if (!a) return;
    const mo = new MutationObserver(() => !a.el.isConnected && kbBlur(a.el));
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [a]);

  if (!open || !a) return null;
  const ofp = a.hint ?? a.el.closest('tr')?.children[1]?.textContent?.trim();
  const keep = (ev: RPointerEvent) => ev.preventDefault();
  const K = ({ t, c = '', fn, aria }: { t: string; c?: string; fn?: () => void; aria?: string }) => (
    <button type="button" className={`kb-k ${c}`} aria-label={aria ?? t} onClick={fn ?? (() => insert(a, t))}>
      {t}
    </button>
  );

  return (
      <div className="kb" role="group" aria-label="입력 키보드" onPointerDown={keep}>
        <div className="kb-bar">
          <button type="button" className="kb-nb" onClick={() => moveField(a.el, -1)}>
            ‹ 이전
          </button>
          <button type="button" className="kb-nb" onClick={() => moveField(a.el, 1)}>
            다음 ›
          </button>
          <span className="kb-f">
            {a.label}
            {ofp && /\d/.test(ofp) && <i className="mono">{a.hint ? ofp : `OFP ${ofp}`}</i>}
          </span>
          <button type="button" className="kb-nb kb-done" onClick={() => a.el.blur()}>
            완료
          </button>
        </div>
        <div className="kb-keys">
          <div className="kb-qw">
            <div className="kb-r r1">
              {[...ROWS[0]].map((c) => (
                <K key={c} t={c} />
              ))}
              <K t="⌫" c="s" aria="지우기" fn={() => backspace(a)} />
            </div>
            <div className="kb-r r2">
              <span />
              {[...ROWS[1]].map((c) => (
                <K key={c} t={c} />
              ))}
              <K t="다음 ↵" c="ac" aria="다음 칸" fn={() => moveField(a.el, 1)} />
            </div>
            <div className="kb-r r3">
              {[...ROWS[2]].map((c) => (
                <K key={c} t={c} />
              ))}
              <K t="." c="s" />
              <K t="/" c="s" />
              <K t=":" c="s" />
            </div>
            <div className="kb-r r4">
              <K t="-" c="s" aria="빼기" />
              <K t="space" c="s" aria="띄어쓰기" fn={() => insert(a, ' ')} />
              <K t="지우기" c="s" aria="칸 비우기" fn={() => a.set('')} />
            </div>
          </div>
          <div className="kb-np">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((c) => (
              <K key={c} t={c} c="n" />
            ))}
            <K t="⌫" c="s" aria="지우기" fn={() => backspace(a)} />
          </div>
        </div>
      </div>
  );
}
