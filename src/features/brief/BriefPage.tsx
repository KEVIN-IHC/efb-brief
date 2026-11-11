// Briefing 탭 (D-054): 운항관리사식 공항별 브리핑 — 기상 × 회사 기준 × 활주로 × NOTAM, 브리핑 카드 초안, 회항 후보
// 모든 판정 옆에 근거(매뉴얼 위치·OFP 원문·기상 원문). 보조 도구 — 판단은 승인된 EFB·원본 매뉴얼·운항관리
import { useMemo, useState } from 'react';
import { formatAgo } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { BasisRow } from '../alerts/AlertsCard';
import { useActiveFlight } from '../flight/activeFlight';
import { latestActuals, useFlightLogs } from '../inflight/actuals';
import { buildChecks, project } from '../inflight/deviation';
import { DocSection } from '../ofp/doc/ui';
import { jumpToOfpSource } from '../ofp/sourceJump';
import { ROLE_KO, manualBasis, type AirportBrief, type Finding, type Role } from './assess';
import { buildCards, currentPosition, diversionList } from './cards';
import { BRAKING_LABEL, IMPACT_LABEL } from './notamImpact';
import { useBrief } from './useBrief';
import { fmtCeil, fmtVis, fmtWind, type Cond } from './wx';

const SEV = { warning: '경고', caution: '주의', info: '참고' } as const;
const ROLE_ORDER: Role[] = ['DEP', 'DEST', 'ALTN', 'TKOF ALTN', '3% ERA', 'EDTO', 'ETP', 'ERA'];
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
        창 {a.window.basis} ({hhmm(a.window.from)}–{hhmm(a.window.to)}){a.night ? ' · 야간' : ''} · 경고 {sevCount('warning')} · 주의 {sevCount('caution')}
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
                    <td className="r mono">{e.hdgT != null ? `${String(e.hdgT).padStart(3, '0')}${e.approx ? '≈M' : 'T'}` : '—'}</td>
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
          {a.runways.src === 'both' ? 'OFP + 공개 자료' : a.runways.src === 'ofp' ? 'OFP (방위 ≈번호)' : '공개 자료'}
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

  const proj = useMemo(() => (o ? project(o, buildChecks(o, latestActuals(logs))) : null), [o, logs]);
  const cards = useMemo(() => (o && brief ? buildCards(o, brief, data.rules, data.profile, proj) : []), [o, brief, data.rules, data.profile, proj]);
  const pos = useMemo(() => (o ? currentPosition(o, now, proj?.last ? proj.timeDevMin : 0) : null), [o, now, proj]);
  const div = useMemo(() => (brief ? diversionList(brief, pos) : []), [brief, pos]);

  if (!o || !brief) return <p className="muted">OFP를 열면 공항별 브리핑을 만듭니다.</p>;

  const sorted = [...brief.airports].sort((x, y) => ROLE_ORDER.indexOf(x.roles[0]) - ROLE_ORDER.indexOf(y.roles[0]));
  const main = sorted.filter((a) => a.roles.some((r) => r !== 'ERA'));
  const era = sorted.filter((a) => a.roles.every((r) => r === 'ERA'));
  const copy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  const divRefs = data.rules?.refs.diversion ?? [];

  return (
    <div className="page-grid doc">
      <DocSection title="Briefing" meta={brief.hasRules ? '회사 기준 적용' : '회사 기준 없음'} className="span-all">
        <p className="small">
          {brief.hasRules ? (
            <>
              회사 기준: <span className="mono">{brief.rulesSource}</span>
            </>
          ) : (
            <span className="c-warn">회사 기준 파일 없음 — Settings → 매뉴얼 → 가져오기로 company-rules.json을 넣으면 최저치·바람 제한을 판정합니다. 지금은 기상·활주로·NOTAM 자료만 정리.</span>
          )}
        </p>
        <p className="small muted">
          판정은 받아 둔 METAR/TAF·OFP NOTAM 기준 · 기상 시간 창은 공항 역할별(출발 ETD±1h, 목적지 ETA±1h, 교체 ETA±1h) · 차트 최저치가 회사 하한보다 높으면 차트가 우선 · 활주로 방위 ≈M은 번호로 추정한 값
        </p>
        <nav className="br-jump">
          {main.map((a) => (
            <a key={a.icao} className="chip chip-muted" href={`#br-${a.icao}`} onClick={(e) => (e.preventDefault(), document.getElementById(`br-${a.icao}`)?.scrollIntoView({ behavior: 'smooth' }))}>
              {a.icao}
              {a.findings.some((f) => f.severity === 'warning') ? ' ⚠' : ''}
            </a>
          ))}
        </nav>
      </DocSection>

      {main.map((a) => (
        <AirportCard key={a.icao} a={a} />
      ))}

      {brief.flight.length > 0 && (
        <DocSection title="비행 전체" className="span-all">
          <ul className="al-list">
            {brief.flight.map((f) => (
              <FindingRow key={f.key} f={f} />
            ))}
          </ul>
        </DocSection>
      )}

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

      <p className="doc-foot span-all">
        보조 도구입니다. 회사 기준 수치는 회사 기준 파일(Mac private/에서 만든 파일)에서 읽고, 매뉴얼 위치는 📖로 엽니다. 운항 판단은 승인된 EFB·원본 매뉴얼·운항관리 기준.{' '}
        {data.refs && Object.keys(data.refs).length === 0 && brief.hasRules ? '매뉴얼을 가져오면 근거 링크가 열립니다.' : ''}
      </p>
    </div>
  );
}
