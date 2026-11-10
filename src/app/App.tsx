import { useEffect, useState } from 'react';
import { StatusBar } from './StatusBar';
import { Disclaimer } from './Disclaimer';
import { InstallBanner } from './InstallBanner';
import { MORE_ICON, TABS, isTabId, type TabId } from './tabs';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { InflightPage } from '../features/inflight/InflightPage';
import { OfpPage } from '../features/ofp/OfpPage';
import { OfpOpenButton } from '../features/ofp/OfpOpenButton';
import { SettingsPage } from '../features/settings/SettingsPage';
import { WeatherPage } from '../features/weather/WeatherPage';
import { MapPage } from '../features/map/MapPage';
import { NotamPage } from '../features/notam/NotamPage';
import { loadActiveFlight, useActiveFlight } from '../features/flight/activeFlight';

const readHash = (): TabId => {
  const h = location.hash.replace('#', '');
  return isTabId(h) ? h : 'dashboard';
};

/**
 * 반응형 셸
 *  - 아이폰 (<768px): 하단 탭바 = 주요 4개 + More 시트
 *  - 아이패드 세로 (768~1023px): 하단 탭바에 전체 탭
 *  - 아이패드 가로·PC (≥1024px): 왼쪽 사이드바, 오른쪽 넓은 본문
 * 어느 탭을 보일지는 CSS(media query)가 결정 → JS 화면 크기 감지 없음
 */
export function App() {
  const [tab, setTab] = useState<TabId>(readHash);
  const [moreOpen, setMoreOpen] = useState(false);

  // 안전장치: 시작 과정에서 현재 비행을 못 불러왔으면 다시 시도
  useEffect(() => {
    if (!useActiveFlight.getState().loaded) void loadActiveFlight();
  }, []);

  useEffect(() => {
    const onHash = () => {
      setTab(readHash());
      setMoreOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const current = TABS.find((t) => t.id === tab)!;
  const f = useActiveFlight((s) => s.flight);

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="메뉴">
        <div className="brand">
          <img src="./icons/icon.svg" alt="" width="28" height="28" />
          <span>EFB Brief</span>
        </div>
        <div className="flight-chip">
          <div className="mono">{f.flightNo}</div>
          <div className="muted small">
            {f.dep} → {f.arr}
          </div>
          <OfpOpenButton variant="plain" showStatus={false} />
        </div>
        <nav className="sidenav">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className={`navlink ${t.id === tab ? 'active' : ''} ${t.phase ? 'later' : ''}`} aria-current={t.id === tab ? 'page' : undefined}>
              {t.icon}
              <span>{t.label}</span>
              {t.phase && <span className="phase-tag">P{t.phase}</span>}
            </a>
          ))}
        </nav>
      </aside>

      <div className="main-col">
        <StatusBar />
        <main className="content">
          <InstallBanner />
          <header className="page-header">
            <h1>{current.label}</h1>
          </header>
          {tab === 'dashboard' && <DashboardPage />}
          {tab === 'ofp' && <OfpPage />}
          {tab === 'inflight' && <InflightPage />}
          {tab === 'settings' && <SettingsPage />}
          {tab === 'weather' && <WeatherPage />}
          {tab === 'map' && <MapPage />}
          {tab === 'notam' && <NotamPage />}
          {current.phase && (
            <section className="card placeholder">
              {current.icon}
              <p className="muted">Phase {current.phase}에서 구현 예정</p>
            </section>
          )}
        </main>
      </div>

      <nav className="tabbar" aria-label="탭">
        {TABS.map((t) => (
          <a key={t.id} href={`#${t.id}`} className={`tab ${t.primary ? 'primary' : 'secondary'} ${t.id === tab ? 'active' : ''} ${t.phase ? 'later' : ''}`} aria-current={t.id === tab ? 'page' : undefined}>
            {t.icon}
            <span>{t.label}</span>
          </a>
        ))}
        <button className={`tab more ${!current.primary || moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
          {MORE_ICON}
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" role="menu" onClick={(e) => e.stopPropagation()}>
            {TABS.filter((t) => !t.primary).map((t) => (
              <a key={t.id} href={`#${t.id}`} role="menuitem" className={`sheet-item ${t.id === tab ? 'active' : ''}`} onClick={() => setMoreOpen(false)}>
                {t.icon}
                <span>{t.label}</span>
                {t.phase && <span className="phase-tag">P{t.phase}</span>}
              </a>
            ))}
          </div>
        </div>
      )}

      <Disclaimer />
    </div>
  );
}
