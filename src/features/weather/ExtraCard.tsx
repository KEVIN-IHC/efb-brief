// 기상 확장 카드 (D-060): 우주기상 · 항로 근처 PIREP · 열대저기압 · 미국 G-AIRMET. 출처·받은 시각·공식 여부 표시
import { useEffect, useMemo } from 'react';
import { formatAgo, formatDayZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { useBriefData } from '../brief/useBrief';
import { RefList } from '../manual/RefList';
import { useActiveFlight } from '../flight/activeFlight';
import { loadExtraCache, refreshExtra, useWxExtra } from './extra';
import { distToRouteNm } from './route';

const R_TEXT = ['없음', 'R1 약함', 'R2 보통', 'R3 강함', 'R4 심함', 'R5 극심'];
const S_TEXT = ['없음', 'S1 약함', 'S2 보통', 'S3 강함', 'S4 심함', 'S5 극심'];
const G_TEXT = ['G0 없음', 'G1 약함', 'G2 보통', 'G3 강함', 'G4 심함', 'G5 극심'];

function Src({ label, at, now, kind }: { label: string; at?: string; now: number; kind: '공식' | '참고' }) {
  return (
    <span className="small muted">
      <span className={`chip ${kind === '공식' ? 'chip-ok' : 'chip-muted'}`}>{kind}</span> {label} · {at ? `받음 ${formatAgo(at, now)}` : '아직 없음'}
    </span>
  );
}

export function ExtraCard() {
  const now = useNow(60_000);
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
  const data = useBriefData();

  // 항로 최고 위도 — 고위도일수록 S·G 등급 영향이 큼
  const maxLat = route.length ? Math.max(...route.map((w) => Math.abs(w.lat))) : null;
  const hiLat = maxLat != null && maxLat >= 60;
  const lvl = (v: number | null | undefined) => (v == null || v === 0 ? '' : v >= 3 ? 'c-warning' : 'c-caution');

  return (
    <section className="card">
      <div className="card-title">
        <h3>기상 추가 (우주기상 · PIREP · 열대저기압)</h3>
        <span className="small muted">{busy ? '받는 중…' : '맨 위 ⟳ 기상으로 함께 갱신'}</span>
      </div>

      <h4 className="ops-gh">우주기상 (HF 통신·극지 방사선)</h4>
      {sw ? (
        <div className="swx-grid">
          <div className="swx-tile">
            <div className="cell-k">R 전파 두절 (HF)</div>
            <div className={`swx-v ${lvl(sw.r)}`}>{R_TEXT[sw.r ?? 0] ?? `R${sw.r}`}</div>
          </div>
          <div className="swx-tile">
            <div className="cell-k">S 방사선 폭풍</div>
            <div className={`swx-v ${lvl(sw.s)}`}>{S_TEXT[sw.s ?? 0] ?? `S${sw.s}`}</div>
          </div>
          <div className="swx-tile">
            <div className="cell-k">G 지자기 폭풍</div>
            <div className={`swx-v ${lvl(sw.g)}`}>{G_TEXT[sw.g ?? 0] ?? `G${sw.g}`}</div>
          </div>
          <div className="swx-tile">
            <div className="cell-k">오늘 확률 R1–2</div>
            <div className="swx-v mono">{sw.rMinorProb ?? '—'}%</div>
          </div>
          <div className="swx-tile">
            <div className="cell-k">오늘 확률 R3 이상</div>
            <div className="swx-v mono">{sw.rMajorProb ?? '—'}%</div>
          </div>
          <div className="swx-tile">
            <div className="cell-k">오늘 확률 S1 이상</div>
            <div className="swx-v mono">{sw.sProb ?? '—'}%</div>
          </div>
        </div>
      ) : (
        <p className="small muted">자료 없음</p>
      )}
      <p className="small">
        <Src label={`NOAA SWPC 등급${sw ? ` (발표 ${formatDayZ(sw.stamp)})` : ''}`} at={x.swx?.fetchedAt} now={now} kind="공식" />
        {x.errors.swx && <span className="c-warn small"> · 실패: {x.errors.swx}</span>}
      </p>
      {maxLat != null && (
        <p className={`small ${hiLat && sw && ((sw.s ?? 0) > 0 || (sw.g ?? 0) > 0) ? 'c-caution' : 'muted'}`}>
          이 항로 최고 위도 <b className="mono">{Math.round(maxLat)}°</b>
          {maxLat >= 78 ? ' — Polar 지역(78° 이상) 통과' : hiLat ? ' — 고위도 구간 있음: S·G 등급이 오르면 HF·방사선 영향이 큼' : ' — 고위도 구간 없음: 주로 R 등급(낮 쪽 HF)만 관련'}
        </p>
      )}
      <details className="swx-help">
        <summary>등급 뜻 (NOAA 우주기상 등급 요약)</summary>
        <ul className="small">
          <li>
            <b>R (Radio Blackout, 1~5)</b> — 태양 플레어로 <b>해가 비치는 쪽</b> HF 통신이 약해지거나 끊김. R1–2는 짧은 HF 감쇠, R3 이상은 넓은 지역에서 약 1시간 HF 끊김 가능. 플레어가 끝나면 빨리 회복
          </li>
          <li>
            <b>S (Solar Radiation Storm, 1~5)</b> — 고에너지 입자. <b>극지·고위도</b>에서 HF가 오래(며칠) 끊길 수 있고(PCA), 고고도·고위도에서 승무원·승객 방사선 노출 증가. S2 이상이면 극지 항로 회피·고도 낮추기 권고가 나오기도 함
          </li>
          <li>
            <b>G (Geomagnetic Storm, 1~5)</b> — 지자기 폭풍. 고위도 HF 품질 저하, GNSS(위성항법) 정확도 저하, 오로라. G3 이상이면 중위도까지 영향 가능
          </li>
          <li>
            <b>확률</b> — NOAA가 발표한 <b>오늘</b> 일어날 확률(R1–2, R3 이상, S1 이상)
          </li>
        </ul>
        <p className="small muted">설명은 NOAA SWPC 공개 등급표를 줄인 것. 실제 조치(항로·고도 변경, 통신 대책)는 회사 절차와 운항관리 지시가 기준</p>
      </details>
      <div className="swx-refs">
        <div className="small strong">회사 매뉴얼 근거</div>
        {data.rules?.refs.spaceWeather?.length ? (
          <RefList refs={data.rules.refs.spaceWeather} all={data.refs} id="space-weather" />
        ) : (
          <p className="small muted">{data.rules ? '회사 기준 파일에 우주기상 근거가 없습니다 (새 company-rules.json 가져오기)' : 'Settings → 매뉴얼에서 회사 기준 파일(company-rules.json)을 가져오면 FOM 근거가 열립니다'}</p>
        )}
      </div>

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
