// 기상 확장 카드 (D-060): 우주기상 · 항로 근처 PIREP · 열대저기압 · 미국 G-AIRMET. 출처·받은 시각·공식 여부 표시
import { useEffect, useMemo } from 'react';
import { formatAgo, formatDayZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { useSync } from '../../sync/syncManager';
import { useActiveFlight } from '../flight/activeFlight';
import { loadExtraCache, refreshExtra, useWxExtra } from './extra';
import { distToRouteNm } from './route';

const R_TEXT = ['없음', 'R1 약함', 'R2 보통', 'R3 강함', 'R4 심함', 'R5 극심'];
const S_TEXT = ['없음', 'S1 약함', 'S2 보통', 'S3 강함', 'S4 심함', 'S5 극심'];

function Src({ label, at, now, kind }: { label: string; at?: string; now: number; kind: '공식' | '참고' }) {
  return (
    <span className="small muted">
      <span className={`chip ${kind === '공식' ? 'chip-ok' : 'chip-muted'}`}>{kind}</span> {label} · {at ? `받음 ${formatAgo(at, now)}` : '아직 없음'}
    </span>
  );
}

export function ExtraCard() {
  const now = useNow(60_000);
  const online = useSync((s) => s.online);
  const x = useWxExtra();
  const { ofp } = useActiveFlight();
  const route = useMemo(() => ofp?.parsed?.route ?? [], [ofp]);
  useEffect(() => {
    void loadExtraCache().then(() => refreshExtra());
  }, [route]);

  const pireps = useMemo(
    () =>
      (x.pirep?.data ?? [])
        .map((p) => ({ p, d: distToRouteNm(p, route) }))
        .filter((v) => v.d <= 150 && (v.p.turb || v.p.icing))
        .sort((a, b) => b.p.obsTime.localeCompare(a.p.obsTime)),
    [x.pirep, route],
  );
  const tcs = useMemo(() => (x.tc?.data ?? []).map((c) => ({ c, d: distToRouteNm(c, route) })).sort((a, b) => a.d - b.d), [x.tc, route]);
  const sw = x.swx?.data;
  const busy = Object.values(x.busy).some(Boolean);

  return (
    <section className="card">
      <div className="card-title">
        <h3>기상 추가 (우주기상 · PIREP · 열대저기압)</h3>
        <button className="btn small" disabled={!online || busy} onClick={() => void refreshExtra(undefined, true)}>
          {busy ? '받는 중…' : online ? '지금 갱신' : 'OFFLINE'}
        </button>
      </div>

      <h4 className="ops-gh">우주기상 (HF 통신·극지 방사선)</h4>
      {sw ? (
        <div className="cells compact">
          <div className={`cell`}>
            <div className="cell-k">R 전파 두절 (HF)</div>
            <div className={`cell-v ${sw.r ? 'c-caution' : ''}`}>{R_TEXT[sw.r ?? 0] ?? sw.r}</div>
          </div>
          <div className="cell">
            <div className="cell-k">S 방사선 폭풍</div>
            <div className={`cell-v ${sw.s ? 'c-caution' : ''}`}>{S_TEXT[sw.s ?? 0] ?? sw.s}</div>
          </div>
          <div className="cell">
            <div className="cell-k">G 지자기 폭풍</div>
            <div className={`cell-v ${sw.g ? 'c-caution' : ''}`}>G{sw.g ?? 0}</div>
          </div>
          <div className="cell">
            <div className="cell-k">오늘 확률 R1-2 / R3+ / S1+</div>
            <div className="cell-v">
              {sw.rMinorProb ?? '—'}% / {sw.rMajorProb ?? '—'}% / {sw.sProb ?? '—'}%
            </div>
          </div>
        </div>
      ) : (
        <p className="small muted">자료 없음</p>
      )}
      <p className="small">
        <Src label={`NOAA SWPC 등급${sw ? ` (발표 ${formatDayZ(sw.stamp)})` : ''}`} at={x.swx?.fetchedAt} now={now} kind="공식" />
        {x.errors.swx && <span className="c-warn small"> · 실패: {x.errors.swx}</span>}
      </p>
      <p className="small muted">R은 낮 쪽 HF 감쇠, S는 극지·고위도 고고도 방사선과 극지 HF에 영향. 등급 판단·조치는 회사 절차(극지 운항·통신) 기준.</p>

      <h4 className="ops-gh">항로 150NM 안 PIREP·AIREP (최근 3시간, 난류·착빙만)</h4>
      {pireps.length ? (
        <ul className="ops-timeline">
          {pireps.slice(0, 20).map(({ p, d }) => (
            <li key={p.id}>
              <span className="mono strong">{formatDayZ(p.obsTime)}</span> {p.fl != null ? `FL${p.fl}` : ''} {p.acType ?? ''} {p.turb ? `난류 ${p.turb}` : ''} {p.icing ? `착빙 ${p.icing}` : ''} <span className="muted">· 항로에서 {d}NM</span>
              <div className="mono small muted">{p.raw}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">{x.pirep ? '없음 (미국·북대서양 외 지역은 보고가 적음)' : '자료 없음'}</p>
      )}
      <p className="small">
        <Src label="AWC PIREP/AIREP (조종사 보고, 관측)" at={x.pirep?.fetchedAt} now={now} kind="공식" />
        {x.errors.pirep && <span className="c-warn small"> · {x.errors.pirep}</span>}
      </p>

      <h4 className="ops-gh">열대저기압 (현재)</h4>
      {tcs.length ? (
        <ul className="ops-timeline">
          {tcs.map(({ c, d }) => (
            <li key={c.id} className={d <= 500 ? 'c-caution' : ''}>
              <span className="strong">{c.name}</span> · {c.level} · {c.severity ?? ''} · 항로에서 약 {d}NM
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">{x.tc ? '현재 없음' : '자료 없음'}</p>
      )}
      <p className="small">
        <Src label="GDACS 재난 경보 (항공 공식 아님 — TC 권고는 SIGMET·RSMC 확인)" at={x.tc?.fetchedAt} now={now} kind="참고" />
        {x.errors.tc && <span className="c-warn small"> · 실패: {x.errors.tc}</span>}
      </p>

      {(x.gairmet?.data.length ?? 0) > 0 && (
        <p className="small">
          미국 G-AIRMET {x.gairmet!.data.length}개 (지도 탭에 표시) · <Src label="AWC G-AIRMET" at={x.gairmet?.fetchedAt} now={now} kind="공식" />
        </p>
      )}
      {x.errors.gairmet && <p className="small c-warn">G-AIRMET: {x.errors.gairmet}</p>}
    </section>
  );
}
