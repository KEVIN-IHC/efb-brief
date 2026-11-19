// 앱 키보드 (D-081·D-082·D-086): 아이패드(≥768px)에서 iOS 키보드 대신 화면 아래에 뜸. FMS 칸·순항 기록·매시간 점검에서 사용.
// 위 막대 = ‹ 이전 · 다음 › · 칸 이름 · OFP 값 · 완료, 아래 = QWERTY + 작은 숫자판.
// D-086: iPad Safari는 빠르게 여러 번 누르면 입력 칸 "초점"을 자기 방식대로 빼서 키보드가 닫혔음 →
//   아이패드에서는 입력 칸에 초점을 주지 않는다(readOnly). 칸을 누르면 앱이 "지금 칸"을 기억하고,
//   키보드는 [완료] 또는 키보드·입력 칸 밖을 누를 때만 닫힘. 블루투스 키보드는 화면 전체 keydown으로 받음.
// 쓰는 법: <input className="kb-in" {...kbProps(appKb, { label, set })} /> · 표시를 바꾸려면 useKbActive()로 지금 칸인지 확인
import { memo, useEffect, useSyncExternalStore, type PointerEvent as RPointerEvent, type SyntheticEvent } from 'react';

type Cfg = { label: string; set: (v: string) => void; hint?: string; /** 다듬기 전 값 (표시가 다른 칸) */ raw?: () => string };
/** buf = 키보드가 들고 있는 지금 글자 — 화면이 다시 그려지기 전에 다음 키가 와도 앞 글자를 잃지 않게 */
type Active = Cfg & { el: HTMLInputElement; fresh: boolean; buf: string };

/* ---------- 지금 입력 중인 칸 (모듈 하나에 저장) ---------- */
let active: Active | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f));

function setActive(next: Active | null) {
  if (active?.el && active.el !== next?.el) active.el.classList.remove('kb-on');
  active = next;
  next?.el.classList.add('kb-on');
  emit();
}

/** 이 칸을 지금 칸으로. 값이 있으면 첫 키는 덮어씀(MCDU 입력처럼) */
export function kbFocus(el: HTMLInputElement, cfg: Cfg) {
  const buf = cfg.raw?.() ?? el.value;
  setActive({ ...cfg, el, fresh: !!buf, buf });
}
export function kbClose() {
  setActive(null);
}

/** 지금 칸의 입력 요소 (표시 형식을 바꾸는 칸에서 사용) */
export function useKbActive(): HTMLInputElement | null {
  return useSyncExternalStore(subscribe, () => active?.el ?? null, () => null);
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

/** 입력 칸에 붙이는 속성. 아이패드: 초점 없이 누르면 지금 칸이 됨. 아이폰: 보통 입력 칸 */
export function kbProps(appKb: boolean, cfg: Cfg, inputMode: 'decimal' | 'numeric' | 'text' = 'decimal') {
  if (!appKb) return { inputMode };
  return {
    readOnly: true,
    inputMode: 'none' as const,
    onPointerDown: (e: RPointerEvent<HTMLInputElement>) => {
      e.preventDefault(); // iOS 초점·선택 메뉴·확대 막기
      kbFocus(e.currentTarget, cfg);
    },
  };
}

/** 화면 순서로 앞/뒤 칸 (창 안에 있으면 그 창 안에서만). 다음 칸이 없으면 닫음 */
export function moveField(el: HTMLInputElement, dir: 1 | -1) {
  const root: ParentNode = el.closest('[role="dialog"]') ?? document;
  const all = [...root.querySelectorAll<HTMLInputElement>('input.fms-in, input.kb-in')];
  const next = all[all.indexOf(el) + dir];
  if (next) {
    if (active) next.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); // 그 칸의 kbProps가 이어받음
    else next.focus();
  } else if (dir === 1) {
    if (active) kbClose();
    else el.blur();
  }
}

function put(a: Active, v: string) {
  a.fresh = false;
  a.buf = v;
  a.set(v);
}
const insert = (a: Active, ch: string) => put(a, (a.fresh ? '' : a.buf) + ch);
const backspace = (a: Active) => put(a, a.buf.slice(0, -1));

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** 키 하나. 손가락이 닿는 순간(pointerdown) 바로 처리 */
const K = memo(function K({ t, c = '', fn, aria }: { t: string; c?: string; fn: () => void; aria?: string }) {
  return (
    <button
      type="button"
      className={`kb-k ${c}`}
      aria-label={aria ?? t}
      onPointerDown={(e) => {
        e.preventDefault();
        fn();
      }}
    >
      {t}
    </button>
  );
});

/** 키보드 안에서는 초점 이동·click·확대를 모두 막음 */
const stop = (e: SyntheticEvent) => e.preventDefault();

/** 앱에 하나만 둔다 (App.tsx) */
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

  // 입력 칸이 화면에서 사라지면(창 닫힘·탭 이동) 키보드도 닫음
  useEffect(() => {
    if (!a) return;
    const mo = new MutationObserver(() => !a.el.isConnected && kbClose());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [a]);

  // 키보드·입력 칸 밖을 누르면 닫음
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('.kb, input.kb-in, input.fms-in')) return;
      kbClose();
    };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [open]);

  // 블루투스 키보드
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      const x = active;
      if (!x || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Backspace') backspace(x);
      else if (e.key === 'Enter' || e.key === 'Tab') moveField(x.el, e.shiftKey ? -1 : 1);
      else if (e.key === 'Escape') kbClose();
      else if (e.key.length === 1 && /[0-9A-Za-z./:\- ]/.test(e.key)) insert(x, e.key.toUpperCase());
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);

  if (!open || !a) return null;
  const ofp = a.hint ?? a.el.closest('tr')?.children[1]?.textContent?.trim();
  const ins = (t: string) => () => insert(a, t);
  const nb = (fn: () => void) => ({
    onPointerDown: (e: SyntheticEvent) => {
      e.preventDefault();
      fn();
    },
  });

  return (
    <div className="kb" role="group" aria-label="입력 키보드" onPointerDown={stop} onMouseDown={stop} onTouchEnd={stop}>
      <div className="kb-bar">
        <button type="button" className="kb-nb" {...nb(() => moveField(a.el, -1))}>
          ‹ 이전
        </button>
        <button type="button" className="kb-nb" {...nb(() => moveField(a.el, 1))}>
          다음 ›
        </button>
        <span className="kb-f">
          {a.label}
          {ofp && /\d/.test(ofp) && <i className="mono">{a.hint ? ofp : `OFP ${ofp}`}</i>}
        </span>
        <button type="button" className="kb-nb kb-done" {...nb(kbClose)}>
          완료
        </button>
      </div>
      <div className="kb-keys">
        <div className="kb-qw">
          <div className="kb-r r1">
            {[...ROWS[0]].map((c) => (
              <K key={c} t={c} fn={ins(c)} />
            ))}
            <K t="⌫" c="s" aria="지우기" fn={() => backspace(a)} />
          </div>
          <div className="kb-r r2">
            <span />
            {[...ROWS[1]].map((c) => (
              <K key={c} t={c} fn={ins(c)} />
            ))}
            <K t="다음 ↵" c="ac" aria="다음 칸" fn={() => moveField(a.el, 1)} />
          </div>
          <div className="kb-r r3">
            {[...ROWS[2]].map((c) => (
              <K key={c} t={c} fn={ins(c)} />
            ))}
            <K t="." c="s" fn={ins('.')} />
            <K t="/" c="s" fn={ins('/')} />
            <K t=":" c="s" fn={ins(':')} />
          </div>
          <div className="kb-r r4">
            <K t="-" c="s" aria="빼기" fn={ins('-')} />
            <K t="space" c="s" aria="띄어쓰기" fn={ins(' ')} />
            <K
              t="지우기"
              c="s"
              aria="칸 비우기"
              fn={() => put(a, '')}
            />
          </div>
        </div>
        <div className="kb-np">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((c) => (
            <K key={c} t={c} c="n" fn={ins(c)} />
          ))}
          <K t="⌫" c="s" aria="지우기" fn={() => backspace(a)} />
        </div>
      </div>
    </div>
  );
}
