import { useEffect, useState } from 'react';
import { DISCLAIMER_TEXT } from '../../app/Disclaimer';
import { isStandalone } from '../../app/InstallBanner';
import type { OutboxItem } from '../../db/schema';
import { getGasConfig, getSetting, setSetting } from '../../db/settings';
import { fetchJson, getWxProxyBase } from '../weather/api';
import { formatDayZ } from '../../lib/time';
import { pingGas } from '../../sync/gasClient';
import { getUnsentItems, outboxEvents } from '../../sync/outbox';
import { syncNow, useSync } from '../../sync/syncManager';
import { setThemePref, useTheme, type ThemePref } from '../../app/theme';

const THEMES: { id: ThemePref; label: string; note: string }[] = [
  { id: 'day', label: '주간', note: '밝은 화면' },
  { id: 'night', label: '야간', note: '어두운 화면 (기본)' },
  { id: 'auto', label: '자동', note: '기기 설정 따름' },
];

function ThemeCard() {
  const pref = useTheme((s) => s.pref);
  return (
    <section className="card">
      <div className="card-title">
        <h3>화면 (주간·야간)</h3>
      </div>
      <div className="segmented" role="radiogroup" aria-label="화면 테마">
        {THEMES.map((t) => (
          <button key={t.id} role="radio" aria-checked={pref === t.id} className={pref === t.id ? 'on' : ''} onClick={() => setThemePref(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="muted small">{THEMES.find((t) => t.id === pref)?.note} · 상단 해·달 버튼으로도 바꿀 수 있습니다</p>
    </section>
  );
}

function StorageInfo() {
  const [info, setInfo] = useState<{ persisted?: boolean; usage?: number; quota?: number }>({});
  useEffect(() => {
    void (async () => {
      const s = navigator.storage;
      if (!s) return;
      const [persisted, est] = await Promise.all([s.persisted?.(), s.estimate?.()]);
      setInfo({ persisted, usage: est?.usage, quota: est?.quota });
    })().catch(() => {});
  }, []);
  const mb = (n?: number) => (n == null ? '—' : `${(n / 1048576).toFixed(1)} MB`);
  return (
    <ul className="kv">
      <li>
        <span>홈 화면 앱 실행</span>
        <b className={isStandalone() ? 'c-ok' : 'c-warn'}>{isStandalone() ? 'YES' : 'NO (브라우저 탭)'}</b>
      </li>
      <li>
        <span>영구 저장소 (persist)</span>
        <b className={info.persisted ? 'c-ok' : 'c-warn'}>
          {info.persisted == null ? '—' : info.persisted ? 'GRANTED' : 'NOT GRANTED'}
        </b>
      </li>
      <li>
        <span>사용량 / 할당</span>
        <b>
          {mb(info.usage)} / {mb(info.quota)}
        </b>
      </li>
    </ul>
  );
}

/** 기상 중계 주소 (D-034). 비우면 같은 서버의 /wx (Mac 개발·미리보기 서버 내장 중계) */
function WxProxyCard() {
  const online = useSync((s) => s.online);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    void getSetting('wxProxyUrl').then((v) => setUrl(v ?? ''));
  }, []);
  const save = async () => {
    await setSetting('wxProxyUrl', url.trim());
    setMsg('저장했습니다.');
  };
  const test = async () => {
    setMsg('확인 중…');
    try {
      await setSetting('wxProxyUrl', url.trim());
      const base = await getWxProxyBase();
      const r = await fetchJson<{ icaoId?: string }[]>(`${base}/awc/metar?ids=RKSI&format=json`);
      setMsg(Array.isArray(r) && r[0]?.icaoId ? `연결 성공 — ${base}` : `응답은 왔지만 METAR가 없습니다 — ${base}`);
    } catch (e) {
      setMsg(`연결 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <section className="card">
      <div className="card-title">
        <h3>기상 중계 주소</h3>
      </div>
      <p className="muted small">
        METAR·TAF·SIGMET(aviationweather.gov)은 브라우저에서 직접 받을 수 없어 중계를 거칩니다. 비워 두면 이 서버의 내장 중계(<code>/wx</code>, Mac 테스트용)를 씁니다. 아이패드·GitHub
        Pages에서는 Cloudflare Worker 주소를 넣어야 합니다.
      </p>
      <label className="label" htmlFor="wx-proxy">
        중계 주소
      </label>
      <input
        id="wx-proxy"
        className="input"
        inputMode="url"
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="비우면 내장 중계 (예: https://wx.이름.workers.dev)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="row">
        <button className="btn primary" onClick={() => void save()}>
          저장
        </button>
        <button className="btn" onClick={() => void test()} disabled={!online}>
          연결 테스트
        </button>
      </div>
      {msg && <p className="small">{msg}</p>}
    </section>
  );
}

export function SettingsPage() {
  const { online, syncing, lastResult } = useSync();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [unsent, setUnsent] = useState<OutboxItem[]>([]);

  useEffect(() => {
    void getGasConfig().then((c) => {
      if (c) {
        setUrl(c.url);
        setToken(c.token);
      }
    });
    const load = () => void getUnsentItems().then(setUnsent);
    load();
    outboxEvents.addEventListener('change', load);
    return () => outboxEvents.removeEventListener('change', load);
  }, []);

  const save = async () => {
    await setSetting('gasUrl', url.trim());
    await setSetting('gasToken', token.trim());
    setMsg('저장됨');
  };

  const test = async () => {
    setMsg('연결 확인 중…');
    try {
      await pingGas({ url: url.trim(), token: token.trim() });
      setMsg('✓ 연결 성공');
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="page-grid">
      <ThemeCard />
      <WxProxyCard />
      <section className="card">
        <div className="card-title">
          <h3>동기화 (Apps Script)</h3>
        </div>
        <label className="label" htmlFor="gas-url">
          Web App URL
        </label>
        <input
          id="gas-url"
          className="input"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="https://script.google.com/macros/s/…/exec"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <label className="label" htmlFor="gas-token">
          개인 토큰
        </label>
        <input
          id="gas-token"
          className="input"
          type="password"
          autoCapitalize="off"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="row">
          <button className="btn primary" onClick={save} disabled={!url.trim() || !token.trim()}>
            저장
          </button>
          <button className="btn" onClick={test} disabled={!online || !url.trim() || !token.trim()}>
            연결 테스트
          </button>
          <button className="btn" onClick={() => void syncNow(true)} disabled={!online || syncing}>
            지금 동기화
          </button>
        </div>
        {msg && <p className="small">{msg}</p>}
        {lastResult && (
          <p className="muted small">
            마지막 실행: {lastResult.status} · sent {lastResult.sent} · failed {lastResult.failed}
            {lastResult.error ? ` · ${lastResult.error}` : ''}
          </p>
        )}
        {(import.meta.env.DEV || location.hostname === 'localhost') && (
          <p className="muted small">
            로컬 테스트용 가짜 서버: URL <code>{location.origin}/mock-gas</code> · 토큰 <code>dev-token</code>
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-title">
          <h3>업로드 대기 ({unsent.length})</h3>
        </div>
        {unsent.length === 0 && <p className="muted">대기 항목 없음</p>}
        <ul className="loglist">
          {unsent.map((i) => (
            <li key={i.opId}>
              <div className="logmeta">
                <span className="mono">{formatDayZ(i.createdAt)}</span>
                <span className={`mark ${i.status === 'failed' ? 'bad' : 'warn'}`}>
                  {i.status} ×{i.retries}
                </span>
              </div>
              <div className="lognote">{i.payload.note}</div>
              {i.lastError && <div className="small c-bad">{i.lastError}</div>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-title">
          <h3>기기 저장소</h3>
        </div>
        <StorageInfo />
      </section>

      <section className="card">
        <div className="card-title">
          <h3>고지</h3>
        </div>
        <p className="small">{DISCLAIMER_TEXT}</p>
        <p className="muted small">build {__BUILD_TIME__}</p>
      </section>
    </div>
  );
}
