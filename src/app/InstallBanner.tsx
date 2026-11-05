import { useState } from 'react';

const KEY = 'efb.installBannerDismissed';

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** iOS: 홈 화면에 추가해야 저장소가 덜 정리되고 오프라인 실행이 안정적 (SPEC §7.2-5) */
export function InstallBanner() {
  const [hidden, setHidden] = useState(() => isStandalone() || !isIOS() || readDismissed());
  if (hidden) return null;
  return (
    <div className="banner">
      <span>
        오프라인 사용을 위해 Safari <b>공유 버튼 → "홈 화면에 추가"</b> 후 홈 화면 아이콘으로 실행하세요.
      </span>
      <button
        className="btn small"
        onClick={() => {
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            /* ignore */
          }
          setHidden(true);
        }}
      >
        닫기
      </button>
    </div>
  );
}
