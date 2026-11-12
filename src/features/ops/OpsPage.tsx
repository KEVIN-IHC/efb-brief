// Ops 탭 (D-056): 비정상·보안·정상운항 상황 카드(회사 매뉴얼 원문 링크·사건 버튼·양식·타이머) + 사건 기록·PA·연락처·보고서 초안
// 절차는 기기에 가져온 매뉴얼 원문을 그대로 보여줄 뿐 해석하지 않는다. 카드 목록·절 코드는 회사 기준 파일(ops)에서
import { useEffect, useMemo, useState } from 'react';
import { fmtHm } from '../../lib/format';
import { formatDayZ, formatZ } from '../../lib/time';
import { useNow } from '../../lib/useNow';
import { BasisRow } from '../alerts/AlertsCard';
import { manualBasis } from '../brief/assess';
import { loadRules, rulesEvents, type CompanyRules, type OpsCard } from '../brief/rules';
import { useBriefData } from '../brief/useBrief';
import { useActiveFlight } from '../flight/activeFlight';
import { latestActuals, useFlightLogs } from '../inflight/actuals';
import { buildChecks, project } from '../inflight/deviation';
import { positionAt } from './position';
import { getManualPage } from '../manual/store';
import { ManualText } from '../manual/ManualText';
import { DocSection } from '../ofp/doc/ui';
import type { OfpData } from '../ofp/types';
import { useWx } from '../weather/store';
import {
  clearTimer,
  fillPa,
  newContact,
  newPa,
  PA_VARS,
  parseEvents,
  saveContacts,
  saveEvent,
  savePaTemplates,
  saveReportDraft,
  startTimer,
  stopTimer,
  timerStatus,
  useContacts,
  usePaTemplates,
  useReportDraft,
  useTimers,
  type OpsEvent,
} from './store';

const GROUPS: { id: OpsCard['group']; title: string }[] = [
  { id: 'abnormal', title: '비정상 상황' },
  { id: 'security', title: '보안' },
  { id: 'normal', title: '정상운항 참고' },
];

type Refs = ReturnType<typeof useBriefData>['refs'];

function copyText(t: string, done: () => void) {
  void navigator.clipboard?.writeText(t).then(done, () => alert('복사 실패 — 길게 눌러 직접 복사하세요'));
}

/** 가져온 매뉴얼의 해당 절 원문을 카드 안에서 바로 */
function FomInline({ docId, seq }: { docId: string; seq: number }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    void getManualPage(docId, seq).then((p) => setText(p?.text ?? ''));
  }, [docId, seq]);
  if (text === null) return <p className="small muted">불러오는 중…</p>;
  if (!text.trim()) return <p className="small muted">이 절은 본문이 없습니다 (하위 절을 보세요)</p>;
  return (
    <div className="ops-fom">
      <ManualText text={text} />
    </div>
  );
}

function RefList({ refs, all }: { refs: OpsCard['refs']; all: Refs }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="ops-refs">
      {refs.map((r) => {
        const t = all[r.code];
        return (
          <li key={r.code}>
            <div className="ops-ref-row">
              <BasisRow b={manualBasis(all, r)} />
              {t && (
                <button className="btn small" onClick={() => setOpen(open === r.code ? null : r.code)}>
                  {open === r.code ? '원문 접기' : '원문'}
                </button>
              )}
            </div>
            {open === r.code && t && <FomInline docId={t.docId} seq={t.seq} />}
          </li>
        );
      })}
    </ul>
  );
}

/** 지금 비행 정보로 PA·보고서 빈칸 채우기 */
function useFlightVars(o: OfpData | null, timeDevMin: number, now: number, geo: Record<string, [number, number, string]>) {
  const { flight } = useActiveFlight();
  const metars = useWx((s) => s.metars);
  return useMemo(() => {
    const eta = o ? new Date(Date.parse(o.header.sta) + timeDevMin * 60000).toISOString() : flight.sta;
    const remain = Math.round((Date.parse(eta) - now) / 60000);
    const t = metars[flight.arr]?.data.temp;
    return {
      FLT: flight.flightNo,
      DEP: flight.dep,
      ARR: flight.arr,
      DEP_NAME: geo[flight.dep]?.[2],
      ARR_NAME: geo[flight.arr]?.[2],
      ETA_Z: formatZ(eta),
      REMAIN: remain > 0 ? fmtHm(remain) : undefined,
      FLIGHT_TIME: o?.header.airMin ? fmtHm(o.header.airMin) : undefined,
      ARR_TEMP: t != null ? `${t}°C` : undefined,
      CRZ_FL: o?.header.cruiseFl ? `FL${o.header.cruiseFl}` : undefined,
    } as Record<string, string | undefined>;
  }, [o, flight, metars, geo, timeDevMin, now]);
}

export function OpsPage() {
  const { flight, ofp } = useActiveFlight();
  const o = ofp?.parsed ?? null;
  const logs = useFlightLogs(flight.flightId);
  const now = useNow(30_000);
  const data = useBriefData();
  const proj = useMemo(() => (o ? project(o, buildChecks(o, latestActuals(logs))) : null), [o, logs]);
  const dev = proj?.timeDevMin ?? 0;
  const events = useMemo(() => parseEvents(logs), [logs]);
  const vars = useFlightVars(o, dev, now, data.geo);
  const cards = data.rules?.ops?.cards ?? [];
  const [openCard, setOpenCard] = useState<string | null>(null);

  return (
    <div className="page-grid doc">
      <DocSection title="Ops" meta={`${flight.flightNo} ${flight.dep}→${flight.arr}`} className="span-all">
        <p className="small muted">
          상황 카드는 기기에 가져온 회사 매뉴얼 원문을 그대로 엽니다(해석 없음). QRH·ECAM·승인된 EFB를 대신하지 않습니다. 사건 기록은 메모로 저장·동기화되므로 <b>승객 이름 등 개인정보는 적지 마세요</b>.
        </p>
        <nav className="br-jump">
          {['ops-events', 'ops-cards', 'ops-pa', 'ops-contacts', 'ops-report'].map((id, i) => (
            <a key={id} className="chip chip-muted" href={`#${id}`} onClick={(e) => (e.preventDefault(), document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }))}>
              {['사건 기록', '상황 카드', 'PA', '연락처', '보고서'][i]}
            </a>
          ))}
        </nav>
      </DocSection>

      <ActiveTimers />
      <EventLog flightId={flight.flightId} events={events} o={o} dev={dev} />

      <DocSection title="상황 카드" meta={cards.length ? `${cards.length}` : ''} className="span-all" id="ops-cards">
        {!data.rules ? (
          <p className="small c-warn">회사 기준 파일 없음 — Settings → 매뉴얼 → 가져오기로 company-rules.json을 넣으면 카드가 나옵니다.</p>
        ) : !cards.length ? (
          <p className="small muted">회사 기준 파일에 상황 카드(ops)가 없습니다 — Mac에서 새로 만든 파일을 다시 가져오세요.</p>
        ) : (
          GROUPS.map((g) => {
            const list = cards.filter((c) => c.group === g.id);
            if (!list.length) return null;
            return (
              <div key={g.id} className="ops-group">
                <h4 className="ops-gh">{g.title}</h4>
                <div className="ops-chips">
                  {list.map((c) => (
                    <button key={c.id} className={`btn small ops-chip ${openCard === c.id ? 'primary' : ''}`} onClick={() => setOpenCard(openCard === c.id ? null : c.id)}>
                      {c.title}
                    </button>
                  ))}
                </div>
                {list.some((c) => c.id === openCard) && <CardBody c={list.find((c) => c.id === openCard)!} refs={data.refs} flightId={flight.flightId} now={now} />}
              </div>
            );
          })
        )}
        {Object.keys(data.refs).length === 0 && cards.length > 0 && <p className="small muted">매뉴얼(FOM)을 가져오면 📖 링크와 원문 보기가 열립니다.</p>}
      </DocSection>

      <PaSection vars={vars} />
      <ContactsSection />
      <ReportSection flightId={flight.flightId} o={o} dev={dev} events={events} vars={vars} reports={data.rules?.ops?.reports} refs={data.refs} />
    </div>
  );
}

function CardBody({ c, refs, flightId, now }: { c: OpsCard; refs: Refs; flightId: string; now: number }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const timers = useTimers();
  const timer = timers.find((t) => t.flightId === flightId && t.cardId === c.id);

  const record = async (label: string) => {
    setBusy(label);
    try {
      await saveEvent(flightId, `${c.title}: ${label}`);
    } finally {
      setBusy(null);
    }
  };
  const formText = c.form ? `[${c.form.title}]\n${c.form.fields.map((f) => `- ${f}: ${form[f]?.trim() || ''}`).join('\n')}` : '';

  return (
    <div className="ops-card">
      <h4 className="ops-title">{c.title}</h4>
      {c.events?.length ? (
        <>
          <div className="label">사건 기록 (누르면 지금 시각으로)</div>
          <div className="ops-chips">
            {c.events.map((e) => (
              <button key={e} className="btn small" disabled={busy === e} onClick={() => void record(e)}>
                ⏱ {e}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {c.timer && (
        <div className="ops-timer">
          <div className="label">{c.timer.label} 타이머</div>
          {timer ? (
            <TimerLine label={c.timer.label} startAt={timer.startAt} stopAt={timer.stopAt} marks={c.timer.marks} now={now} />
          ) : (
            <p className="small muted">기준: {c.timer.startHint ?? '시작 시각'}</p>
          )}
          <div className="row">
            {!timer || timer.stopAt ? (
              <button
                className="btn primary small"
                onClick={async () => {
                  const at = new Date().toISOString();
                  await startTimer({ flightId, cardId: c.id, label: c.timer!.label, startAt: at });
                  await saveEvent(flightId, `${c.timer!.label} 타이머 시작`, undefined, at);
                }}
              >
                지금 시작
              </button>
            ) : (
              <button
                className="btn small"
                onClick={async () => {
                  await stopTimer(flightId, c.id);
                  await saveEvent(flightId, `${c.timer!.label} 타이머 종료`);
                }}
              >
                종료
              </button>
            )}
            {timer && (
              <button className="btn small" onClick={() => void clearTimer(flightId, c.id)}>
                지우기
              </button>
            )}
          </div>
          {c.timer.marks.map((m, i) => (
            <div key={i} className="small">
              {m.every ? `${m.every}분마다` : `${m.at}분`} — {m.text} {m.ref && <BasisRow b={manualBasis(refs, m.ref)} />}
            </div>
          ))}
          {c.timer.note && <p className="small c-caution">{c.timer.note}</p>}
        </div>
      )}

      {c.form && (
        <div className="ops-form">
          <div className="label">{c.form.title} (이 화면에만, 저장 안 함)</div>
          {c.form.fields.map((f) => (
            <div key={f} className="ops-form-row">
              <label className="small" htmlFor={`f-${c.id}-${f}`}>
                {f}
              </label>
              <input id={`f-${c.id}-${f}`} className="input" autoComplete="off" value={form[f] ?? ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
            </div>
          ))}
          <div className="row">
            <button className="btn small" onClick={() => copyText(formText, () => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>
              {copied ? '복사됨' : '글 복사 (OCC 전달용)'}
            </button>
            <button className="btn small" onClick={() => setForm({})}>
              비우기
            </button>
            {c.form.ref && <BasisRow b={manualBasis(refs, c.form.ref)} />}
          </div>
        </div>
      )}

      <div className="label">회사 매뉴얼 ({c.refs.length})</div>
      <RefList refs={c.refs} all={refs} />
    </div>
  );
}

function TimerLine({ label, startAt, stopAt, marks, now }: { label: string; startAt: string; stopAt?: string; marks: { every?: number; at?: number; text: string }[]; now: number }) {
  const s = timerStatus(startAt, marks, now, stopAt);
  return (
    <div className="ops-tline">
      <span className="mono strong ops-elapsed">{fmtHm(s.elapsed)}</span>
      <span className="small">
        {label} · 시작 {formatZ(startAt)}
        {stopAt ? ` · 종료 ${formatZ(stopAt)}` : s.next ? ` · 다음 ${s.inMin}분 후: ${s.next.text}` : ''}
      </span>
    </div>
  );
}

/** 회사 기준 파일만 (매뉴얼 쪽 찾기 없이 가볍게) */
function useRulesOnly() {
  const [r, setR] = useState<CompanyRules | null>(null);
  useEffect(() => {
    const load = () => void loadRules().then((x) => setR(x?.rules ?? null), () => setR(null));
    load();
    rulesEvents.addEventListener('change', load);
    return () => rulesEvents.removeEventListener('change', load);
  }, []);
  return r;
}

/** 진행 중 타이머 (Ops·Inflight 공용) */
export function ActiveTimers() {
  const timers = useTimers();
  const { flight } = useActiveFlight();
  const now = useNow(30_000);
  const rules = useRulesOnly();
  const live = timers.filter((t) => t.flightId === flight.flightId && !t.stopAt);
  if (!live.length) return null;
  return (
    <DocSection title="진행 중 타이머" className="span-all">
      {live.map((t) => {
        const marks = rules?.ops?.cards.find((c) => c.id === t.cardId)?.timer?.marks ?? [];
        return <TimerLine key={t.cardId} label={t.label} startAt={t.startAt} marks={marks} now={now} />;
      })}
      <p className="doc-foot">Ops 탭 상황 카드에서 종료. 시각은 이 기기 시계 기준</p>
    </DocSection>
  );
}

function EventLog({ flightId, events, o, dev }: { flightId: string; events: OpsEvent[]; o: OfpData | null; dev: number }) {
  const [label, setLabel] = useState('');
  const [hhmm, setHhmm] = useState('');
  const [busy, setBusy] = useState(false);
  const atIso = (() => {
    if (!/^\d{4}$/.test(hhmm)) return undefined;
    const d = new Date();
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), +hhmm.slice(0, 2), +hhmm.slice(2));
    if (+hhmm.slice(0, 2) > 23 || +hhmm.slice(2) > 59) return undefined;
    if (t - d.getTime() > 12 * 3_600_000) t -= 86_400_000;
    return new Date(t).toISOString();
  })();
  const add = async () => {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await saveEvent(flightId, label, undefined, atIso);
      setLabel('');
      setHhmm('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <DocSection title="사건 기록" meta={`${events.length}`} className="span-all" id="ops-events">
      <div className="ops-evform">
        <input className="input" placeholder="무슨 일 (예: 난류 조우, 객실 통보)" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} />
        <input className="input mono ops-hhmm" inputMode="numeric" maxLength={4} placeholder="지금" aria-label="시각 UTC HHMM (비우면 지금)" value={hhmm} onChange={(e) => setHhmm(e.target.value.replace(/\D/g, ''))} />
        <button className="btn primary" disabled={!label.trim() || busy || (hhmm !== '' && !atIso)} onClick={() => void add()}>
          기록
        </button>
      </div>
      {events.length > 0 && (
        <ol className="ops-timeline">
          {events.map((e) => (
            <li key={e.logId}>
              <span className="mono strong">{formatZ(e.at)}</span> <span>{e.label}</span>
              {e.text && <span className="muted"> — {e.text}</span>}
              {o && <div className="small muted">{positionAt(o, e.at, dev)}</div>}
            </li>
          ))}
        </ol>
      )}
      <p className="doc-foot">시각은 UTC. 비우면 지금 시각. 기록은 메모로 저장되어 연결 시 동기화. 지우거나 고치지 않으니 틀리면 정정 기록을 새로 남기세요</p>
    </DocSection>
  );
}

function PaSection({ vars }: { vars: Record<string, string | undefined> }) {
  const list = usePaTemplates();
  const [edit, setEdit] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const editing = list.find((p) => p.id === edit);
  const update = (id: string, patch: Partial<(typeof list)[number]>) => void savePaTemplates(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  return (
    <DocSection title="PA 문안" meta={`${list.length}`} className="span-all" id="ops-pa">
      <p className="small muted">
        직접 넣는 개인 문안(회사 예문집 등). 글 안의 <span className="mono">{'{FLT}'}</span> 같은 자리는 지금 비행 값으로 채워집니다:{' '}
        {PA_VARS.map((v) => (
          <span key={v.key} className="chip chip-muted ops-var">
            {`{${v.key}}`} {v.label}
          </span>
        ))}
      </p>
      {list.map((p) => {
        const f = fillPa(p.text, vars);
        return (
          <div key={p.id} className="ops-pa">
            <div className="fir-top">
              <span className="strong fir-name">{p.title || '(제목 없음)'}</span>
              <button className="btn small" onClick={() => setEdit(edit === p.id ? null : p.id)}>
                {edit === p.id ? '닫기' : '편집'}
              </button>
              <button className="btn small" onClick={() => copyText(f.text, () => (setCopied(p.id), setTimeout(() => setCopied(null), 1500)))}>
                {copied === p.id ? '복사됨' : '복사'}
              </button>
            </div>
            <div className="ops-pa-text">{f.text}</div>
            {f.missing.length > 0 && <div className="small c-caution">채울 값 없음: {f.missing.join(' ')}</div>}
            {p.source && <div className="small muted">출처: {p.source}</div>}
          </div>
        );
      })}
      {editing && (
        <div className="ops-card">
          <label className="label" htmlFor="pa-title">
            제목
          </label>
          <input id="pa-title" className="input" value={editing.title} onChange={(e) => update(editing.id, { title: e.target.value })} />
          <label className="label" htmlFor="pa-text">
            문안
          </label>
          <textarea id="pa-text" className="input" rows={6} value={editing.text} onChange={(e) => update(editing.id, { text: e.target.value })} />
          <label className="label" htmlFor="pa-src">
            출처
          </label>
          <input id="pa-src" className="input" placeholder="예: 회사 기장방송 예문집 (2026)" value={editing.source ?? ''} onChange={(e) => update(editing.id, { source: e.target.value })} />
          <div className="row">
            <button
              className="btn danger small"
              onClick={() => {
                if (confirm('이 문안을 지울까요?')) {
                  void savePaTemplates(list.filter((x) => x.id !== editing.id));
                  setEdit(null);
                }
              }}
            >
              지우기
            </button>
          </div>
        </div>
      )}
      <div className="row">
        <button
          className="btn small"
          onClick={() => {
            const p = newPa();
            void savePaTemplates([...list, p]);
            setEdit(p.id);
          }}
        >
          문안 추가
        </button>
      </div>
    </DocSection>
  );
}

function ContactsSection() {
  const list = useContacts();
  const [editing, setEditing] = useState(false);
  const update = (id: string, patch: Partial<(typeof list)[number]>) => void saveContacts(list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return (
    <DocSection title="연락처" meta={`${list.length}`} className="span-all" id="ops-contacts">
      <p className="small muted">OCC·운항관리·SATCOM 단축번호·의료 지원 등. 이 기기에만 저장(동기화 안 함)</p>
      {!editing ? (
        <ul className="ops-contacts">
          {list.map((c) => (
            <li key={c.id}>
              <span className="strong">{c.name}</span> <span className="mono">{c.value}</span>
              {c.note && <span className="small muted"> — {c.note}</span>}
            </li>
          ))}
        </ul>
      ) : (
        list.map((c) => (
          <div key={c.id} className="ops-contact-edit">
            <input className="input" placeholder="이름" aria-label="이름" value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} />
            <input className="input mono" placeholder="번호·주파수" aria-label="번호" value={c.value} onChange={(e) => update(c.id, { value: e.target.value })} />
            <input className="input" placeholder="메모" aria-label="메모" value={c.note ?? ''} onChange={(e) => update(c.id, { note: e.target.value })} />
            <button className="btn danger small" onClick={() => void saveContacts(list.filter((x) => x.id !== c.id))}>
              삭제
            </button>
          </div>
        ))
      )}
      <div className="row">
        <button className="btn small" onClick={() => setEditing((v) => !v)}>
          {editing ? '편집 끝' : '편집'}
        </button>
        {editing && (
          <button className="btn small" onClick={() => void saveContacts([...list, newContact()])}>
            추가
          </button>
        )}
      </div>
    </DocSection>
  );
}

function ReportSection({
  flightId,
  o,
  dev,
  events,
  vars,
  reports,
  refs,
}: {
  flightId: string;
  o: OfpData | null;
  dev: number;
  events: OpsEvent[];
  vars: Record<string, string | undefined>;
  reports?: { refs: OpsCard['refs']; kinds: string[] };
  refs: Refs;
}) {
  const saved = useReportDraft(flightId);
  const [d, setD] = useState(saved);
  const [copied, setCopied] = useState(false);
  useEffect(() => setD(saved), [saved]);
  const kinds = reports?.kinds ?? ['ASR', 'FOR'];
  const change = (patch: Partial<typeof d>) => {
    const n = { ...d, ...patch };
    setD(n);
    void saveReportDraft(flightId, n);
  };
  const header = [
    `[${d.kind || '보고서'}] ${d.title}`.trim(),
    `편명 ${vars.FLT} · ${vars.DEP}→${vars.ARR}${o ? ` · ${o.header.acType} ${o.header.reg}` : ''}${o ? ` · ${o.header.date}` : ''}`,
  ];
  const timeline = events.map((e) => `- ${formatDayZ(e.at)} ${e.label}${e.text ? ` — ${e.text}` : ''}${o ? ` · ${positionAt(o, e.at, dev)}` : ''}`);
  const full = [...header, '', '경과 (사건 기록)', ...(timeline.length ? timeline : ['- (기록 없음)']), '', '내용', d.body].join('\n');

  return (
    <DocSection title="보고서 초안" className="span-all" id="ops-report">
      <p className="small muted">사건 기록과 비행 정보로 초안을 만듭니다. 보고 종류·제출 기한은 아래 매뉴얼 원문으로 판단하세요(앱이 판정하지 않음). 초안은 이 기기에만 저장.</p>
      <div className="ops-chips">
        {kinds.map((k) => (
          <button key={k} className={`btn small ${d.kind === k ? 'primary' : ''}`} onClick={() => change({ kind: k })}>
            {k}
          </button>
        ))}
      </div>
      <label className="label" htmlFor="rp-title">
        제목
      </label>
      <input id="rp-title" className="input" value={d.title} onChange={(e) => change({ title: e.target.value })} />
      <label className="label" htmlFor="rp-body">
        내용 (무엇이·왜·어떻게 조치)
      </label>
      <textarea id="rp-body" className="input" rows={5} value={d.body} onChange={(e) => change({ body: e.target.value })} />
      <div className="label">미리보기</div>
      <pre className="ops-preview">{full}</pre>
      <div className="row">
        <button className="btn primary small" onClick={() => copyText(full, () => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}>
          {copied ? '복사됨' : '글 복사'}
        </button>
        <button className="btn small" onClick={() => confirm('초안을 비울까요?') && change({ kind: '', title: '', body: '' })}>
          비우기
        </button>
      </div>
      {reports?.refs?.length ? (
        <>
          <div className="label">보고 기준 (회사 매뉴얼)</div>
          <RefList refs={reports.refs} all={refs} />
        </>
      ) : null}
    </DocSection>
  );
}
