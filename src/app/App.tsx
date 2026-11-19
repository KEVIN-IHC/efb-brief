import { useEffect, useState } from 'react';
import { StatusBar } from './StatusBar';
import { goBack, onTabChange, useReturnTo } from './returnTo';
import { OfpImportLine } from '../features/ofp/OfpOpenButton';
import { Disclaimer } from './Disclaimer';
import { InstallBanner } from './InstallBanner';
import { MORE_ICON, TABS, isTabId, type TabId } from './tabs';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { BriefPage } from '../features/brief/BriefPage';
import { OpsPage } from '../features/ops/OpsPage';
import { InflightPage } from '../features/inflight/InflightPage';
import { OfpPage } from '../features/ofp/OfpPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { WeatherPage } from '../features/weather/WeatherPage';
import { MapPage } from '../features/map/MapPage';
import { NotamPage } from '../features/notam/NotamPage';
import { ManualPage } from '../features/manual/ManualPage';
import { MelPage } from '../features/manual/MelPage';
import { ManualPopup } from '../features/manual/ManualInline';
import { TurbPopup } from '../features/ofp/doc/TurbPopup';
import { AppKeyboard } from './AppKeyboard';
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
      onTabChange(location.hash);
      setTab(readHash());
      setMoreOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const current = TABS.find((t) => t.id === tab)!;
  const f = useActiveFlight((s) => s.flight);
  const back = useReturnTo((s) => s.from);

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
        {/* 지금 쓰는 앱 버전 — 아이패드가 새 배포를 받았는지 바로 보이게 (D-091) */}
        <a className="build-tag mono" href="#settings">
          BUILD {__BUILD_TIME__.slice(5, 7)}/{__BUILD_TIME__.slice(8, 10)} {__BUILD_TIME__.slice(11, 13)}
          {__BUILD_TIME__.slice(14, 16)}Z
        </a>
      </aside>

      <div className="main-col">
        <StatusBar />
        <OfpImportLine />
        <main className="content">
          <InstallBanner />
          <header className="page-header">
            <h1>{current.label}</h1>
          </header>
          {back && back.to === `#${tab}` && (
            <button className="btn primary man-return" onClick={goBack}>
              ← {TABS.find((t) => `#${t.id}` === back.hash)?.label ?? '이전 화면'}(으)로 돌아가기
            </button>
          )}
          {tab === 'dashboard' && <DashboardPage />}
          {tab === 'brief' && <BriefPage />}
          {tab === 'ops' && <OpsPage />}
          {tab === 'ofp' && <OfpPage />}
          {tab === 'inflight' && <InflightPage />}
          {tab === 'settings' && <SettingsPage />}
          {tab === 'weather' && <WeatherPage />}
          {tab === 'map' && <MapPage />}
          {tab === 'notam' && <NotamPage />}
          {tab === 'mel' && <MelPage />}
          {tab === 'manual' && <ManualPage />}
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

      <ManualPopup />
      <TurbPopup />
      <AppKeyboard />
      <Disclaimer />
    </div>
  );
}
