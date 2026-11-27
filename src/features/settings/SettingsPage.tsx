import { useEffect, useState } from 'react';
import { DISCLAIMER_TEXT } from '../../app/Disclaimer';
import { isStandalone } from '../../app/InstallBanner';
import type { OutboxItem } from '../../db/schema';
import { getGasConfig, getSetting, setSetting } from '../../db/settings';
import { ManualCard } from '../manual/ManualCard';
import { ProfileCard } from '../brief/ProfileCard';
import { DEFAULT_WX_PROXY, fetchJson, getWxProxyBase } from '../weather/api';
import { formatDayZ } from '../../lib/time';
import { pingGas } from '../../sync/gasClient';
import { discardOutbox, getUnsentItems, outboxEvents } from '../../sync/outbox';
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
        METAR·TAF·SIGMET(aviationweather.gov)은 브라우저에서 직접 받을 수 없어 중계를 거칩니다. <b>보통은 비워 두세요</b> — 자동으로 기본 중계(Cloudflare)를 씁니다. Mac 테스트 서버에서는 내장 중계(<code>/wx</code>)를 씁니다. 다른 중계를 쓸 때만 입력합니다.
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
        placeholder={`비우면 자동: ${DEFAULT_WX_PROXY}`}
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

      <OutboxCard items={unsent} />

      <ManualCard />
      <ProfileCard />

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
        <AppFiles />
      </section>
    </div>
  );
}

/** 업로드 대기 (D-102·D-103): 고른 항목만 / 전부 지우기. 지운 항목은 시트로 안 보냄, 기기 안 기록은 그대로 */
function OutboxCard({ items }: { items: OutboxItem[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  // 목록이 바뀌면 사라진 항목은 선택에서 뺀다
  useEffect(() => setSel((s) => new Set([...s].filter((id) => items.some((i) => i.opId === id)))), [items]);
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const all = items.length > 0 && sel.size === items.length;
  const discard = (ids?: string[]) => {
    const n = ids ? ids.length : items.length;
    if (!confirm(`업로드 대기 ${n}건을 지울까요?\n시트로 보내지 않습니다. 기기 안 기록은 그대로 남습니다. 되돌릴 수 없습니다.`)) return;
    void discardOutbox(ids).then(() => setSel(new Set()));
  };
  return (
    <section className="card">
      <div className="card-title">
        <h3>업로드 대기 ({items.length})</h3>
      </div>
      {items.length === 0 && <p className="muted">대기 항목 없음</p>}
      {items.length > 0 && (
        <>
          <p className="small muted">지우면 시트로 보내지 않습니다 (기기 안 기록은 그대로).</p>
          <div className="row outbox-tools">
            <button className="btn small" onClick={() => setSel(all ? new Set() : new Set(items.map((i) => i.opId)))}>
              {all ? '선택 해제' : '전체 선택'}
            </button>
            <button className="btn small danger" disabled={!sel.size} onClick={() => discard([...sel])}>
              선택 지우기{sel.size ? ` (${sel.size})` : ''}
            </button>
            <button className="btn small" onClick={() => discard()}>
              전부 지우기
            </button>
          </div>
        </>
      )}
      <ul className="loglist">
        {items.map((i) => (
          <li key={i.opId} className={sel.has(i.opId) ? 'sel' : ''}>
            <label className="outbox-row">
              <input type="checkbox" checked={sel.has(i.opId)} onChange={() => toggle(i.opId)} aria-label="이 항목 선택" />
              <span className="outbox-body">
                <span className="logmeta">
                  <span className="mono">{formatDayZ(i.createdAt)}</span>
                  <span className={`mark ${i.status === 'failed' ? 'bad' : 'warn'}`}>
                    {i.status} ×{i.retries}
                  </span>
                </span>
                <span className="lognote">{i.payload.note}</span>
                {i.lastError && <span className="small c-bad">{i.lastError}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 앱 파일(서비스 워커·저장된 화면 파일) 새로 받기 (D-091). 아이패드 Safari가 예전 앱을 붙잡을 때.
 * 지우는 것: 서비스 워커 등록 + Cache Storage(앱 파일)뿐. 비행·기록·OUTBOX·설정(IndexedDB)은 그대로.
 */
function AppFiles() {
  const [msg, setMsg] = useState('');
  const check = async () => {
    if (!navigator.onLine) return setMsg('오프라인 — 인터넷 연결 후 다시 눌러 주세요');
    setMsg('확인 중…');
    try {
      const r = await navigator.serviceWorker?.getRegistration();
      await r?.update();
      setMsg(r?.installing || r?.waiting ? '새 버전 받는 중 — 곧 다시 불러옵니다' : '서버 확인 완료. 화면이 그대로면 "앱 파일 새로 받기"를 눌러 주세요');
    } catch {
      setMsg('확인 실패 — 인터넷 연결을 확인해 주세요');
    }
  };
  const refetch = async () => {
    if (!navigator.onLine) return setMsg('오프라인에서는 하지 마세요 — 앱 파일이 없어져 화면이 안 열릴 수 있습니다');
    if (!confirm('앱 파일을 새로 받고 다시 불러올까요?\n비행·순항 기록·OUTBOX·설정은 지워지지 않습니다.')) return;
    setMsg('새로 받는 중…');
    try {
      for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister();
      if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
    } finally {
      location.reload();
    }
  };
  return (
    <>
      <p className="small">
        지금 앱 버전 <b className="mono">build {__BUILD_TIME__}</b>
      </p>
      <div className="row">
        <button className="btn" onClick={() => void check()}>
          새 버전 확인
        </button>
        <button className="btn" onClick={() => void refetch()}>
          앱 파일 새로 받기
        </button>
      </div>
      {msg && <p className="small muted">{msg}</p>}
      <p className="muted small">새 배포는 앱을 열 때·다시 볼 때·30분마다 자동으로 받습니다. "앱 파일 새로 받기"는 화면 파일만 지우고 비행·기록·OUTBOX는 그대로 둡니다(인터넷 연결 필요).</p>
    </>
  );
}

