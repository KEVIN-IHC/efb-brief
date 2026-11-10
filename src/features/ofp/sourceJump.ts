// 다른 탭(NOTAM 등)에서 "원문 L123"을 누르면 OFP 탭의 PDF·추출 원문 뷰어로 이동
import { create } from 'zustand';

export const useSourceJump = create<{ pending: { n: number; t: number } | null }>(() => ({ pending: null }));

export function jumpToOfpSource(n: number) {
  useSourceJump.setState({ pending: { n, t: Date.now() } });
  location.hash = '#ofp';
}
