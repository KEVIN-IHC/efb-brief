// 주간(day) / 야간(night) / 자동(기기 설정 따름). 기기별 선호라 localStorage 사용 (실패해도 동작)
import { create } from 'zustand';

export type ThemePref = 'auto' | 'day' | 'night';
const KEY = 'efb.theme';

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'day' || v === 'night' || v === 'auto') return v;
  } catch {
    /* private mode 등 */
  }
  return 'night'; // 콕핏 기본 = 야간 (SPEC §2.2-4)
}

const mql = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
export const resolveTheme = (p: ThemePref): 'day' | 'night' => (p === 'auto' ? (mql?.matches ? 'day' : 'night') : p);

export function applyTheme(p: ThemePref) {
  const t = resolveTheme(p);
  document.documentElement.dataset.theme = t === 'day' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'day' ? '#f3f5f8' : '#0a0e13');
}

export const useTheme = create<{ pref: ThemePref; resolved: 'day' | 'night' }>(() => {
  const pref = read();
  return { pref, resolved: resolveTheme(pref) };
});

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  applyTheme(pref);
  useTheme.setState({ pref, resolved: resolveTheme(pref) });
}

/** 상단 버튼: 주간 ↔ 야간 */
export const toggleDayNight = () => setThemePref(useTheme.getState().resolved === 'day' ? 'night' : 'day');

mql?.addEventListener('change', () => {
  const { pref } = useTheme.getState();
  if (pref === 'auto') setThemePref('auto');
});
