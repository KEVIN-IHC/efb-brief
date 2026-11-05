// 기상 공통 UI: 신선도 표시, 비행 등급 배지, 갱신·비행 준비 카드
import { useEffect, useState } from 'react';
import { getDB } from '../../db/schema';
import { formatAgo, formatDayZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { useSync } from '../../sync/syncManager';
import { useActiveFlight } from '../flight/activeFlight';
import { prefetchSatCorridor, SAT_LAYERS, useSat } from '../map/satellite';
import { FRESH_LIMITS, freshness, type WxKind } from './freshness';
import { flightStations, refreshDue, useWx } from './store';
import type { FltCat, WxSnapshot } from './types';

/** "RKSI METAR · 2h 14m ago" — 색으로 신선도 (SPEC §2.2-1) */
export function FreshTag({ kind, label, refIso, validTo, now }: { kind: WxKind; label: string; refIso?: string | null; validTo?: string | null; now: number }) {
  const f = freshness(kind, refIso, now, validTo);
  const expired = !!validTo && Date.parse(validTo) <= now;
  return (
    <span className={`fresh fresh-${f}`} title={FRESH_LIMITS[kind].basis}>
      <span className="dot" />
      <span className="mono">
        {label} · {refIso ? `${formatDayZ(refIso)} · ${formatAgo(refIso, now)}` : '없음'}
        {expired ? ' · 유효기간 종료' : ''}
      </span>
    </span>
  );
}

export function CatBadge({ cat }: { cat: FltCat | null | undefined }) {
  if (!cat) return <span className="cat cat-none">—</span>;
  return <span className={`cat cat-${cat.toLowerCase()}`}>{cat}</span>;
}

const KIND_LABEL: Record<Exclude<WxKind, 'sat'>, string> = { metar: 'METAR', taf: 'TAF', sigmet: 'SIGMET', winds: '상층풍·기온' };

/** 갱신 상태 + "지금 갱신" 버튼 (오프라인이면 비활성) */
export function WxStatusCard() {
  const now = useNow(30_000);
  const online = useSync((s) => s.online);
  const wx = useWx();
  const sat = useSat();
  const { flight, ofp } = useActiveFlight();
  const stations = flightStations(flight.dep, flight.arr, ofp?.parsed);
  const oldest = (rec: Record<string, { fetchedAt: string }>) => stations.map((s) => rec[s.icao]?.fetchedAt).filter(Boolean).sort()[0] as string | undefined;
  const fetched: Record<Exclude<WxKind, 'sat'>, string | undefined> = {
    metar: oldest(wx.metars),
    taf: oldest(wx.tafs),
    sigmet: wx.sigmets?.fetchedAt,
    winds: wx.winds?.flightId === flight.flightId ? wx.winds.fetchedAt : undefined,
  };
  const busy = Object.values(wx.busy).some(Boolean);
  const satTimes = SAT_LAYERS.map((l) => sat.times[l.id]).filter(Boolean).sort();
  return (
    <section className="card">
      <div className="card-title">
        <h3>기상 갱신</h3>
        <button className="btn" disabled={!online || busy} onClick={() => void refreshDue(true)}>
          {!online ? '오프라인' : busy ? '받는 중…' : '지금 갱신'}
        </button>
      </div>
      {!online && <p className="notice warn small">오프라인 — 갱신이 꺼져 있습니다. 기기에 저장된 마지막 기상을 보여줍니다.</p>}
      <ul className="kv dense">
        {(Object.keys(KIND_LABEL) as Exclude<WxKind, 'sat'>[]).map((k) => (
          <li key={k}>
            <span>{KIND_LABEL[k]}</span>
            <b className="mono small">
              {fetched[k] ? `받음 ${formatAgo(fetched[k], now)}` : '아직 없음'}
              {wx.errors[k] && <span className="err"> · 실패: {wx.errors[k]}</span>}
            </b>
          </li>
        ))}
        <li>
          <span>위성 영상</span>
          <b className="mono small">{satTimes.length ? `영상 ${formatAgo(satTimes[satTimes.length - 1], now)}` : '지도에서 표시'}</b>
        </li>
      </ul>
      <p className="muted small">온라인일 때 자동 갱신: METAR 10분 · TAF 30분 · SIGMET 15분 · 바람 60분 · 위성 30분</p>
    </section>
  );
}

/** 출발 전 오프라인 패키지: 기상 전부 + 루트 회랑 위성 조각 (SPEC §5.7) */
export function PrepareCard() {
  const online = useSync((s) => s.online);
  const { flight, ofp } = useActiveFlight();
  const [prog, setProg] = useState<{ done: number; total: number; bytes: number } | null>(null);
  const [meta, setMeta] = useState<{ fetchedAt: string; bytes: number; failed: number } | null>(null);
  const [running, setRunning] = useState(false);
  const now = useNow(30_000);

  useEffect(() => {
    void getDB()
      .then((db) => db.get('wxSnapshots', ['meta', flight.flightId]))
      .then((r) => setMeta(r ? ((r as WxSnapshot).data as { fetchedAt: string; bytes: number; failed: number }) : null));
  }, [flight.flightId]);

  const route = ofp?.parsed?.route ?? [];
  const run = async () => {
    setRunning(true);
    try {
      await refreshDue(true);
      const r = await prefetchSatCorridor(route, (done, total, bytes) => setProg({ done, total, bytes }));
      const m = { fetchedAt: new Date().toISOString(), ...r };
      await (await getDB()).put('wxSnapshots', { type: 'meta', station: flight.flightId, fetchedAt: m.fetchedAt, data: m } as never);
      setMeta(m);
    } finally {
      setRunning(false);
    }
  };
  const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;
  return (
    <section className="card">
      <div className="card-title">
        <h3>비행 준비 (오프라인 저장)</h3>
        <button className="btn primary" disabled={!online || running || !route.length} onClick={() => void run()}>
          {running ? '저장 중…' : '비행 준비 완료'}
        </button>
      </div>
      <p className="muted small">출발 전에 한 번 누르면 공항 METAR·TAF, SIGMET, 루트 바람·기온, 루트 좌우 200NM 위성 영상을 기기에 저장합니다. 순항 중(오프라인)에는 저장된 것을 그대로 봅니다.</p>
      {prog && (
        <div className="progress" aria-label="저장 진행률">
          <div className="bar" style={{ width: `${Math.round((prog.done / Math.max(1, prog.total)) * 100)}%` }} />
          <span className="mono small">
            위성 {prog.done}/{prog.total} · {mb(prog.bytes)}
          </span>
        </div>
      )}
      {meta && (
        <p className="small">
          마지막 준비: <span className="mono">{formatDayZ(meta.fetchedAt)}</span> ({formatAgo(meta.fetchedAt, now)}) · 위성 {mb(meta.bytes)}
          {meta.failed > 0 && <span className="err"> · 실패 {meta.failed}개</span>}
        </p>
      )}
      {!online && <p className="notice warn small">오프라인에서는 준비할 수 없습니다.</p>}
    </section>
  );
}
