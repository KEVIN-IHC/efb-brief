// "크게 보기"로 다른 탭에 갔다가 원래 화면으로 돌아가기 (D-066 → D-073 앱 공통)
// 보던 탭·스크롤을 기억하고, 창(팝업)에서 왔으면 돌아갈 때 그 창을 다시 연다
import { create } from 'zustand';

export interface ReturnInfo {
  /** 돌아갈 탭 (#ofp …) */
  hash: string;
  scrollY: number;
  /** 옮겨 간 탭 — 이 탭에 있을 때만 돌아가기 줄을 보인다 */
  to: string;
  /** 돌아간 뒤 실행 (창 다시 열기 등) */
  reopen?: () => void;
}
export const useReturnTo = create<{ from: ReturnInfo | null }>(() => ({ from: null }));

/** 지금 화면을 기억하고 to 탭으로 이동 */
export function goWithReturn(to: string, reopen?: () => void) {
  const hash = location.hash && location.hash !== to ? location.hash : '';
  useReturnTo.setState({ from: hash ? { hash, scrollY: window.scrollY, to, reopen } : null });
  location.hash = to;
}

/** 원래 탭으로 → 내용이 그려질 때까지 기다렸다가 같은 스크롤 위치, 필요하면 창 다시 열기 */
export function goBack() {
  const f = useReturnTo.getState().from;
  if (!f) return;
  useReturnTo.setState({ from: null });
  location.hash = f.hash;
  const until = Date.now() + 3000;
  const tick = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max >= f.scrollY - 2 || Date.now() > until) {
      window.scrollTo(0, Math.min(f.scrollY, Math.max(0, max)));
      f.reopen?.();
      return;
    }
    requestAnimationFrame(tick);
  };
  // hashchange 처리(App이 맨 위로 올림)가 끝난 뒤 시작
  setTimeout(tick, 150);
}

/** 다른 탭으로 직접 옮겨 가면(돌아가기 아님) 기억을 버림 — App의 hashchange에서 호출 */
export function onTabChange(hash: string) {
  const f = useReturnTo.getState().from;
  if (f && hash !== f.to && hash !== f.hash) useReturnTo.setState({ from: null });
}
