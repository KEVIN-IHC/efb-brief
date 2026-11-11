import type { ReactNode } from 'react';

export type TabId = 'dashboard' | 'brief' | 'ofp' | 'map' | 'weather' | 'notam' | 'inflight' | 'mel' | 'manual' | 'settings';

export interface TabDef {
  id: TabId;
  label: string;
  /** 아이폰 하단 탭바에 바로 보이는 탭. 나머지는 "More" 안으로 */
  primary: boolean;
  /** 아직 구현 전이면 예정 Phase */
  phase?: string;
  icon: ReactNode;
}

// 24x24 선 아이콘 (외부 라이브러리 없이 inline SVG — 오프라인·용량 고려)
const I = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

export const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', primary: true, icon: I(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>) },
  { id: 'brief', label: 'Briefing', primary: false, icon: I(<><path d="M9 4h6v3H9z" /><path d="M7 5H5v16h14V5h-2" /><path d="M8 12l2 2 4-4M8 17h8" /></>) },
  { id: 'ofp', label: 'OFP', primary: true, icon: I(<><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6M10 17h6M10 9h2" /></>) },
  { id: 'map', label: 'Map', primary: false, icon: I(<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>) },
  { id: 'weather', label: 'Weather', primary: true, icon: I(<><path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7Z" /></>) },
  { id: 'inflight', label: 'Inflight', primary: true, icon: I(<><path d="M12 3v18" /><path d="M3 13l9-4 9 4" /><path d="M8 20l4-1.5 4 1.5" /></>) },
  { id: 'notam', label: 'NOTAM', primary: false, icon: I(<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>) },
  { id: 'mel', label: 'MEL', primary: false, icon: I(<><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" /></>) },
  { id: 'manual', label: 'Manual', primary: false, icon: I(<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5M8 7h7" /></>) },
  { id: 'settings', label: 'Settings', primary: false, icon: I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>) },
];

export const MORE_ICON = I(<><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>);

export const isTabId = (s: string): s is TabId => TABS.some((t) => t.id === s);
