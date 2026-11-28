// Briefing 탭 (D-054 · D-098): 출두 후 플랜 확인·다른 승무원에게 브리핑할 때 보여 줄 자료를 회사 Pre-flight Briefing 점검 순서로
//   개요 → 기상(출발 · 항로 · 목적지/교체) → NOTAM → OFP(연료·중량·MEL/CDL) → ATS FPL 대조 → 인가·허가·통신 → 위협·회항 후보
//   [이전]/[다음]으로 한 단계씩(아이패드로 보여 주며 브리핑) 또는 [전체 보기]. 내용은 기존 카드(기상·NOTAM·OFP·판정)를 그대로 씀
// 모든 판정 옆에 근거(매뉴얼 위치·OFP 원문·기상 원문). 보조 도구 — 판단은 승인된 EFB·원본 매뉴얼·운항관리
import { useMemo, useState, type ReactNode } from 'react';
import { formatAgo } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { BasisRow } from '../alerts/AlertsCard';
import { FirCommSection } from '../fir/FirCommSection';
import { useActiveFlight } from '../flight/activeFlight';
import { latestActuals, useFlightLogs } from '../inflight/actuals';
import { buildChecks, project } from '../inflight/deviation';
import { RouteSpecCard } from '../routespec/RouteSpecCard';
import { DocSection } from '../ofp/doc/ui';
import { jumpToOfpSource } from '../ofp/sourceJump';
import { ROLE_KO, manualBasis, type AirportBrief, type Finding, type Role } from './assess';
import { buildCards, currentPosition, diversionList } from './cards';
import { BRAKING_LABEL, IMPACT_LABEL } from './notamImpact';
import { useBrief } from './useBrief';
import { fmtCeil, fmtVis, fmtWind, type Cond } from './wx';
import { EtpBlock, FlightBlock, FuelBlock, MelBlock, NotesBlock, RouteCheckRow, WeightBlock } from '../ofp/doc/OfpDocument';
import { TurbulenceBlock } from '../ofp/doc/Turbulence';
import { focusTurbZone } from '../ofp/turbulence';
import { SigmetCard, WindsCard, WxAirportCard } from '../weather/WeatherPage';
import { flightStations } from '../weather/store';
import { VerticalView } from '../vertical/VerticalView';
import { PlanView } from '../vertical/PlanView';
import { build as buildNotamViews } from '../notam/NotamPage';
import { groupLabel } from '../notam/classify';
import { relation, ROLE_LABEL, roleColor, winDetail, winTime } from '../notam/relevance';
import { NotamMap } from '../notam/NotamMap';

/** 회사 Pre-flight Briefing 점검 항목 순서 (Weather → NOTAM → OFP → ATS FPL 사본 대조 → 인가·Permit → 기타) */
const STEPS: { id: string; t: string; sub: string }[] = [
  { id: 'ovw', t: '개요', sub: '편명·구간·시각·계획 방식' },
  { id: 'wx-dep', t: '기상 · 출발', sub: 'METAR·TAF · 판정' },
  { id: 'wx-rte', t: '기상 · 항로', sub: '바람·기온 · 난류 · SIGMET' },
  { id: 'wx-dst', t: '기상 · 목적지·교체', sub: '목적지·교체·ERA 시간' },
  { id: 'notam', t: 'NOTAM', sub: '출발·도착·교체·항로' },
  { id: 'ofp', t: 'OFP · MEL/CDL', sub: '연료·중량·MEL·노트' },
  { id: 'fpl', t: 'ATS FPL 대조', sub: '날짜·ROUTE·OFP 번호·항로 스펙' },
  { id: 'auth', t: '인가 · 허가 · 통신', sub: 'RVSM·EDTO·FIR' },
  { id: 'threat', t: '위협 · 회항 후보', sub: '비행 전체 판정·초안' },
];
const STEP_KEY = 'efb.brief.step';
const readStep = () => {
  try {
    const v = sessionStorage.getItem(STEP_KEY);
    return v === 'all' || STEPS.some((x) => x.id === v) ? (v as string) : 'ovw';
  } catch {
    return 'ovw';
  }
};

/** NOTAM 요약: 강조 분류이거나 시간창과 겹치는 것만, 공항·FIR 순서대로 (전체는 NOTAM 탭) */
function NotamBrief({ o }: { o: NonNullable<ReturnType<typeof useActiveFlight.getState>['ofp']>['parsed'] }) {
  const views = useMemo(() => (o?.notams ? buildNotamViews(o, o.notams) : []), [o]);
  const [mapAt, setMapAt] = useState<number | null>(null);
  if (!o?.notams) return <p className="muted small span-all">이 OFP에는 NOTAM 패키지가 없습니다.</p>;
  // 같은 공항이 다른 패키지에 NOTAM 0건으로 또 나오면 생략 (예: P2의 RKSI)
  const shown = views.filter((v) => !v.loc.seeAlso && !(v.rows.length === 0 && views.some((x) => x !== v && x.loc.icao === v.loc.icao && x.rows.length))).map((v) => ({ v, rows: v.rows.filter((r) => r.c.key && r.ts === 'overlap') }));
  return (
    <DocSection title="NOTAM — 강조 · 시간창 겹침만" meta={`${shown.reduce((a, x) => a + x.rows.length, 0)} / ${views.reduce((a, v) => a + v.rows.length, 0)}`} className="span-all">
      {shown.map(({ v, rows }) => (
        <div key={`${v.loc.pkg}-${v.loc.line}`} className="brn-loc">
          {mapAt === v.loc.line && <NotamMap o={o} icao={v.loc.icao} wins={v.wins} />}
          <div className="brn-h">
            {v.loc.role === 'FIR' ? (
              <b className="mono">{v.loc.icao}</b>
            ) : (
              <button className="ntm-ap-btn" aria-expanded={mapAt === v.loc.line} onClick={() => setMapAt((x) => (x === v.loc.line ? null : v.loc.line))}>
                <span className="ntm-ap-ic mono">{v.loc.icao}</span>
                <span className="ntm-ap-map">{mapAt === v.loc.line ? '지도 닫기' : '지도'}</span>
              </button>
            )}{' '}
            <span className="small muted">{v.loc.name}</span>
            <span className="small muted mono">{rows.length ? `${rows.length}건` : '해당 없음'}</span>
          </div>
          {v.loc.role !== 'FIR' && (
            <ul className="ntm-uses">
              {v.wins.map((w, i) => (
                <li key={i}>
                  <span className="ntm-key" style={{ background: roleColor(w.role) }} />
                  <b className="ntm-rl">{ROLE_LABEL[w.role ?? ''] ?? w.role ?? ROLE_LABEL[v.loc.role] ?? v.loc.role}</b>
                  <span className="mono strong">{winTime(w)}</span>
                  <span className="ntm-bs small muted">{winDetail(w)}</span>
                </li>
              ))}
            </ul>
          )}
          {rows.map((r) => (
            <div key={r.it.line} className="brn-row">
              <span className={`ntm-g g-${r.c.group}`}>{groupLabel(r.c.group)}</span>
              <span className="mono small">{r.it.id}</span>
              <span className="small brn-t">{r.it.text.replace(/\s+/g, ' ').slice(0, 160)}</span>
              {v.loc.role === 'FIR' ? (
                r.note && <span className="small c-caution brn-note">{r.note}</span>
              ) : (
                <div className="ntm-rels brn-note">
                  {v.wins.map((w, i) => {
                    const x = relation(r.it, w);
                    return x ? (
                      <div key={i} className="ntm-rel">
                        {v.wins.length > 1 && <span className="ntm-key" style={{ background: roleColor(w.role) }} title={ROLE_LABEL[w.role ?? ''] ?? w.role} />}
                        <span className={`ntm-k ${x.k}`}>{x.a}</span>
                        {x.b && <span className="small muted mono">{x.b}</span>}
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      <p className="doc-foot">
        강조 분류(활주로·항행시설·공역)이면서 그 공항·FIR 시간창과 겹치는 것만. 공항 순서 = 출발 → 도착 → 교체 → 3% ERA·Refile → ETP → ERA, 공항 이름을 누르면 담당 구간 지도. 나머지·원문은{' '}
        <a href="#notam" className="linkish">
          NOTAM 탭
        </a>
        .
      </p>
    </DocSection>
  );
}

const SEV = { warning: '경고', caution: '주의', info: '참고' } as const;
/** 공항 순서 (2026-11-27 사용자 결정): 출발 → 도착 → 교체 → 3% ERA·Refile → ETP → ERA */
const ROLE_ORDER: Role[] = ['DEP', 'TKOF ALTN', 'DEST', 'ALTN', '3% ERA', 'REFILE', 'REFILE ALTN', 'ETP', 'EDTO', 'ERA'];
const roleRank = (rs: Role[]) => Math.min(...rs.map((r) => ROLE_ORDER.indexOf(r)));
const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16) + 'Z';

function CondLine({ label, c }: { label: string; c: Cond | null | undefined }) {
  if (!c) return null;
  return (
    <div className="br-cond">
      <span className="br-k">{label}</span>
      <span className="mono">
        {fmtWind(c)} · {fmtVis(c.visM)}
        {c.rvr.length ? ` · RVR ${c.rvr.map((r) => `${r.rwy} ${r.qual ?? ''}${r.m}`).join(' ')}` : ''} · CIG {fmtCeil(c.ceilFt)}
        {c.wx ? ` · ${c.wx}` : ''}
        {c.temp != null ? ` · ${c.temp}°C` : ''}
      </span>
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  return (
    <li className={`al-row al-${f.severity}`}>
      <div className="al-top">
        <span className={`al-sev al-sev-${f.severity}`}>{SEV[f.severity]}</span>
        <span className="al-title">{f.title}</span>
      </div>
      {f.detail && <div className="small">{f.detail}</div>}
      <div className="al-bases">
        {f.basis.map((b, i) => (
          <BasisRow key={i} b={b} />
        ))}
      </div>
    </li>
  );
}

function AirportCard({ a }: { a: AirportBrief }) {
  const w = a.wind;
  const shown = w?.ranked.slice(0, 6) ?? [];
  const sevCount = (s: Finding['severity']) => a.findings.filter((f) => f.severity === s).length;
  return (
    <DocSection
      title={`${a.roles.map((r) => ROLE_KO[r]).join(' · ')} — ${a.icao}`}
      meta={`${a.name ?? ''}`}
      className="br-ap"
      id={`br-${a.icao}`}
    >
      <div className="br-head small muted">
        <ul className="br-uses">
          {a.uses.map((u) => (
            <li key={u.role}>
              <span className="br-role">{ROLE_KO[u.role]}</span>{' '}
              {u.window.at ? (
                <>
                  <b className="mono br-at">
                    {u.window.at.label} {hhmm(u.window.at.t)}
                  </b>{' '}
                  · 판정 <span className="mono">{hhmm(u.window.from)}–{hhmm(u.window.to)}</span>
                </>
              ) : (
                <>
                  <b className="mono br-at">
                    {hhmm(u.window.from)}–{hhmm(u.window.to)}
                  </b>{' '}
                  <span>{u.window.basis}</span>
                </>
              )}
              {u.window.seg && (
                <span className="mono">
                  {' '}
                  · 담당 구간 {u.window.seg.from} {hhmm(u.window.seg.fromT)} → {u.window.seg.to} {hhmm(u.window.seg.toT)}
                </span>
              )}
            </li>
          ))}
        </ul>
        {a.night ? '야간 · ' : ''}경고 {sevCount('warning')} · 주의 {sevCount('caution')}
      </div>
      {!a.metar && !a.taf && <p className="small muted">기상 자료 없음 — Weather 탭에서 받아 두면 판정합니다</p>}
      {a.metar && (
        <div className="br-raw mono small">
          METAR {formatAgo(a.metar.obsTime)} · {a.metar.raw}
        </div>
      )}
      <CondLine label="판정 기상" c={a.base} />
      {a.taf?.temp && <CondLine label="일시적(TEMPO)" c={a.taf.temp} />}
      {a.taf?.outside && <p className="small c-warn">시간 창이 TAF 유효기간 밖으로 나감 — 새 TAF 확인</p>}

      {a.runways.ends.length > 0 && (
        <div className="table-wrap">
          <table className="tbl br-rwy">
            <thead>
              <tr>
                <th>RWY</th>
                <th className="r">방위</th>
                <th className="r">길이×폭 ft</th>
                {w && (
                  <>
                    <th className="r">정풍</th>
                    <th className="r">측풍</th>
                    <th className="r">배풍</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {(w ? shown.map((e) => e.end) : a.runways.ends).map((e) => {
                const c = w?.ranked.find((x) => x.end.id === e.id);
                const ok = w?.ok.some((x) => x.end.id === e.id);
                const closed = a.closedRwys.includes(e.id);
                return (
                  <tr key={e.id} className={closed ? 'br-closed' : ''}>
                    <td className="mono strong">
                      {e.id}
                      {closed ? ' 폐쇄' : ''}
                    </td>
                    <td className="r mono">
                      {e.hdgM != null ? `${String(e.hdgM).padStart(3, '0')}${e.approx ? '≈' : ''}M` : '—'}
                      {!e.approx && e.hdgT != null && <small className="br-hdgt"> {String(e.hdgT).padStart(3, '0')}T</small>}
                    </td>
                    <td className="r mono">
                      {e.lenFt ?? '—'}×{e.widthFt ?? '—'}
                    </td>
                    {w && c && (
                      <>
                        <td className="r mono">{c.head}</td>
                        <td className={`r mono ${w.limit && !ok ? 'c-bad' : ''}`}>{c.cross}</td>
                        <td className={`r mono ${w.limit && !ok && c.tail > 0 ? 'c-bad' : ''}`}>{c.tail}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {w && (
        <p className="small muted">
          {w.gust ? 'Gust/Max' : 'Steady'} {w.spd}kt · 활주로 {w.braking ? BRAKING_LABEL[w.braking] : '오염 가능(모름)'} ({w.brakingSrc})
          {w.limit !== undefined ? ` · 한계 측풍/배풍 ${w.limit ? `${w.limit[0]}/${w.limit[1] ?? '불가'}` : '불가'}kt` : ' · 회사 바람 제한 없음'} · 활주로 자료{' '}
          {a.runways.src === 'both' ? 'OFP + 공개 자료' : a.runways.src === 'ofp' ? 'OFP (방위 ≈번호)' : '공개 자료'} · 방위 M = 진방위 − 자기 편차(WMM), 바람 성분은 진방위(T)로 계산
        </p>
      )}

      {a.impacts.length > 0 && (
        <ul className="br-imp">
          {a.impacts.map((x, i) => (
            <li key={i}>
              <button className="al-basis al-ofp" onClick={() => jumpToOfpSource(x.line)}>
                <b>{IMPACT_LABEL[x.kind]}</b>
                {x.rffCat != null ? ` CAT ${x.rffCat}` : ''}
                {x.rwycc ? ` RWYCC ${x.rwycc.join('/')}` : ''} · {x.id ?? ''} {x.text.replace(/\s+/g, ' ').slice(0, 90)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {a.findings.length > 0 ? (
        <ul className="al-list">
          {a.findings.map((f) => (
            <FindingRow key={f.key} f={f} />
          ))}
        </ul>
      ) : (
        <p className="small muted">판정 항목 없음</p>
      )}
    </DocSection>
  );
}

export function BriefPage() {
  const { ofp, flight } = useActiveFlight();
  const o = ofp?.parsed ?? null;
  const { brief, data } = useBrief();
  const logs = useFlightLogs(flight.flightId);
  const now = useNow(60_000);
  const [showEra, setShowEra] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [step, setStep] = useState<string>(readStep);

  const checks = useMemo(() => (o ? buildChecks(o, latestActuals(logs)) : []), [o, logs]);
  const proj = useMemo(() => (o ? project(o, checks) : null), [o, checks]);
  const cards = useMemo(() => (o && brief ? buildCards(o, brief, data.rules, data.profile, proj) : []), [o, brief, data.rules, data.profile, proj]);
  const pos = useMemo(() => (o ? currentPosition(o, now, proj?.last ? proj.timeDevMin : 0) : null), [o, now, proj]);
  const div = useMemo(() => (brief ? diversionList(brief, pos) : []), [brief, pos]);

  if (!o || !brief) return <p className="muted">OFP를 열면 공항별 브리핑을 만듭니다.</p>;

  const sorted = [...brief.airports].sort((x, y) => roleRank(x.roles) - roleRank(y.roles) || x.window.from - y.window.from);
  const main = sorted.filter((a) => a.roles.some((r) => r !== 'ERA'));
  const era = sorted.filter((a) => a.roles.every((r) => r === 'ERA'));
  const copy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  const divRefs = data.rules?.refs.diversion ?? [];

  const cardsNode = (
    <>
      {cards.map((c) => {
        const text = `[${c.title}]\n${c.lines.join('\n')}`;
        return (
          <DocSection key={c.id} title={c.title} meta="초안" className="br-card">
            <ul className="br-lines">
              {c.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
            <div className="row">
              <button className="btn" onClick={() => copy(c.id, text)}>
                {copied === c.id ? '복사됨' : '글 복사'}
              </button>
              {c.ref && <BasisRow b={manualBasis(data.refs, c.ref)} />}
            </div>
          </DocSection>
        );
      })}

    </>
  );
  const diversionNode = (
    <DocSection title="회항 후보" meta={pos ? '현재 위치 기준 (계획 + 기록 편차)' : ''} className="span-all">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>공항</th>
                <th className="r">거리 NM</th>
                <th>기상</th>
                <th className="r">최장 RWY ft</th>
                <th>판정</th>
              </tr>
            </thead>
            <tbody>
              {div.slice(0, 12).map((d) => (
                <tr key={d.a.icao}>
                  <td className="mono strong">
                    {d.a.icao} <span className="muted small">{d.a.roles.map((r) => ROLE_KO[r]).join('·')}</span>
                  </td>
                  <td className="r mono">{d.distNm ?? '—'}</td>
                  <td className="mono small">{d.a.base ? `${fmtWind(d.a.base)} ${fmtVis(d.a.base.visM)} ${fmtCeil(d.a.base.ceilFt)}` : '자료 없음'}</td>
                  <td className="r mono">{d.longestFt ?? '—'}</td>
                  <td>
                    {d.warn ? <span className="chip chip-warning">경고 {d.warn}</span> : null} {d.caution ? <span className="chip chip-caution">주의 {d.caution}</span> : null}
                    {d.a.special ? <span className="chip chip-muted">특수</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="al-bases">
          {divRefs.map((r) => (
            <BasisRow key={r.code} b={manualBasis(data.refs, r)} />
          ))}
        </div>
        <p className="doc-foot">기상 자료가 없는 후보는 판정하지 않음. 실제 회항 공항 결정은 PIC·운항관리사.</p>
      </DocSection>

  );
  const stations = flightStations(o.header.dep, o.header.arr, o);
  const st = (roles: string[]) => stations.filter((x) => x.roles.some((r) => roles.includes(r)));
  const briefFor = (roles: Role[]) => main.filter((a) => a.roles.some((r) => roles.includes(r)));

  // 회사 기준 파일이 없을 때만 알림 (있으면 버전은 맨 아래 한 줄, 시간 창은 공항 카드마다 — 2026-11-27)
  const intro = brief.hasRules ? null : (
    <p className="notice warn small span-all">회사 기준 파일 없음 — Settings → 매뉴얼 → 가져오기로 company-rules.json을 넣으면 최저치·바람 제한을 판정합니다. 지금은 기상·활주로·NOTAM 자료만 정리.</p>
  );

  const wxPair = (roles: Role[], wroles: string[]) => (
    <>
      {st(wroles).map((x) => (
        <WxAirportCard key={`w-${x.icao}`} st={x} now={now} />
      ))}
      {briefFor(roles).map((a) => (
        <AirportCard key={a.icao} a={a} />
      ))}
    </>
  );

  const sections: Record<string, ReactNode> = {
    ovw: (
      <>
        <FlightBlock o={o} />
        {intro}
      </>
    ),
    'wx-dep': wxPair(['DEP', 'TKOF ALTN'], ['DEP']),
    'wx-rte': (
      <>
        <TurbulenceBlock o={o} onZone={(z) => focusTurbZone(z, 'popup')} className="span-all" />
        <div className="span-all">
          <VerticalView />
        </div>
        <div className="span-all">
          <PlanView />
        </div>
        <div className="span-all">
          <SigmetCard now={now} />
        </div>
        <div className="span-all">
          <WindsCard now={now} />
        </div>
      </>
    ),
    'wx-dst': (
      <>
        {wxPair(['DEST', 'ALTN'], ['DEST', 'ALTN'])}
        <EtpBlock o={o} />
        {era.length > 0 && (
          <DocSection title={`항로 교체 후보 ${era.length}`} className="span-all">
            <button className="btn" onClick={() => setShowEra((v) => !v)}>
              {showEra ? '접기' : '펼치기'}
            </button>
            {showEra && (
              <div className="page-grid">
                {era.map((a) => (
                  <AirportCard key={a.icao} a={a} />
                ))}
              </div>
            )}
          </DocSection>
        )}
      </>
    ),
    notam: <NotamBrief o={o} />,
    ofp: (
      <>
        <FuelBlock o={o} />
        <WeightBlock o={o} />
        <MelBlock o={o} />
        <NotesBlock o={o} />
      </>
    ),
    fpl: (
      <>
        <DocSection title="ATS FPL 사본 ↔ OFP" className="span-all">
          <p className="small muted">제출된 ATS Flight Plan 사본과 OFP의 날짜·ROUTE·OFP 번호를 대조 (OFP 안 여러 곳 비교)</p>
          <RouteCheckRow o={o} onLine={jumpToOfpSource} />
          <p className="mono small">
            {o.header.flightNo} · {o.header.date} · {o.header.dep}→{o.header.arr} · {o.header.acType} {o.header.reg}
          </p>
        </DocSection>
        <RouteSpecCard o={o} />
      </>
    ),
    auth: (
      <>
        <DocSection title="인가 · 허가" className="span-all">
          <ul className="br-lines">
            <li>
              RVSM 등 인가: 순항 FL{o.header.cruiseFl}
              {o.header.edtoRule ? ` · ${o.header.edtoRule}` : ''}
              {o.etps.length ? ` · ETP ${o.etps.length}개` : ''}
            </li>
            <li>Overfly · Landing Permit, 입국 서류 — 회사 서류로 확인 (앱 자료 없음)</li>
          </ul>
        </DocSection>
        <FirCommSection o={o} checks={checks} timeDevMin={proj?.timeDevMin ?? 0} now={now} />
      </>
    ),
    threat: (
      <>
        {brief.flight.length > 0 && (
          <DocSection title="비행 전체" className="span-all">
            <ul className="al-list">
              {brief.flight.map((f) => (
                <FindingRow key={f.key} f={f} />
              ))}
            </ul>
          </DocSection>
        )}
        {cardsNode}
        {diversionNode}
      </>
    ),
  };
  const idx = STEPS.findIndex((x) => x.id === step);
  const setStepSave = (v: string) => {
    setStep(v);
    try {
      sessionStorage.setItem(STEP_KEY, v);
    } catch {
      /* 저장 안 돼도 화면은 그대로 */
    }
    window.scrollTo(0, 0);
  };
  const stepper = (
    <nav className="br-steps span-all" aria-label="브리핑 순서">
      {STEPS.map((x, i) => (
        <button key={x.id} type="button" className={`br-step ${step === x.id ? 'on' : ''}`} aria-current={step === x.id ? 'step' : undefined} onClick={() => setStepSave(x.id)}>
          <span className="mono br-step-n">{i + 1}</span>
          <span className="br-step-t">{x.t}</span>
        </button>
      ))}
      <button type="button" className={`br-step br-all ${step === 'all' ? 'on' : ''}`} onClick={() => setStepSave(step === 'all' ? 'ovw' : 'all')}>
        {step === 'all' ? '한 단계씩' : '전체 보기'}
      </button>
    </nav>
  );
  const pager =
    step !== 'all' ? (
      <div className="br-pager span-all">
        <button type="button" className="btn" disabled={idx <= 0} onClick={() => setStepSave(STEPS[idx - 1].id)}>
          ‹ {idx > 0 ? STEPS[idx - 1].t : '처음'}
        </button>
        <span className="small muted mono">
          {idx + 1}/{STEPS.length}
        </span>
        <button type="button" className="btn primary" disabled={idx >= STEPS.length - 1} onClick={() => setStepSave(STEPS[idx + 1].id)}>
          {idx < STEPS.length - 1 ? STEPS[idx + 1].t : '끝'} ›
        </button>
      </div>
    ) : null;

  return (
    <div className="page-grid doc">
      {stepper}
      {step === 'all'
        ? STEPS.map((x, i) => (
            <div key={x.id} className="br-part span-all">
              <h3 className="br-part-h">
                <span className="mono">{i + 1}</span> {x.t} <span className="small muted">{x.sub}</span>
              </h3>
              <div className="page-grid doc">{sections[x.id]}</div>
            </div>
          ))
        : (
            <>
              <h3 className="br-part-h span-all">
                <span className="mono">{idx + 1}</span> {STEPS[idx].t} <span className="small muted">{STEPS[idx].sub}</span>
              </h3>
              {sections[step]}
            </>
          )}
      {pager}
      <p className="doc-foot span-all">
        보조 도구입니다. {brief.hasRules ? <>회사 기준 <span className="mono">{brief.rulesSource}</span> · </> : null}판정 = 받아 둔 METAR/TAF·OFP NOTAM · 차트 최저치가 회사 하한보다 높으면 차트 우선. 매뉴얼 위치는 📖. 운항 판단은 승인된 EFB·원본 매뉴얼·운항관리 기준.{' '}
        {data.refs && Object.keys(data.refs).length === 0 && brief.hasRules ? '매뉴얼을 가져오면 근거 링크가 열립니다.' : ''}
      </p>
    </div>
  );
}
