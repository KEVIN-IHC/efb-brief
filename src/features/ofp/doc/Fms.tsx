// OFP 카드 안 FMS 입력 (D-079): FUEL·FLIGHT 표 오른쪽 얇은 FMS 열 + SYSTEMS·PRE-FLIGHT 카드.
// 입력 칸은 표 숫자와 같은 글씨·줄 높이(테두리 없음). 차이는 같은 줄 왼쪽 작은 글씨. 기기 안에만 저장(비행마다 따로)
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmtHm, fmtSigned } from '../../../lib/format';
import { formatZ } from '../../../lib/time';
import { altChecks, fmtCoord, minOil, parseFl, parseHm, parseKilo, parseNum, parseOil, parseQnh, RVSM_LIMITS, type FmsEntry } from '../../checks/checks';
import { docPages, openManualPage, type ManualTarget } from '../../manual/lookup';
import { listManuals, manualEvents } from '../../manual/store';
import { kbProps, moveField, useAppKeyboard, useKbActive } from '../../../app/AppKeyboard';
import { DocSection } from './ui';
import type { Step } from '../../../app/kbStep';

export type Fms = [FmsEntry, (patch: Partial<FmsEntry>) => void];
type K = Exclude<keyof FmsEntry, 'latH' | 'lonH' | 'updatedAt'>;

const nf = new Intl.NumberFormat('en-US');

/** 테두리 없는 입력 칸. 누르고 있는 동안은 입력한 글자, 떠나면 다듬은 표시 */
export function FmsInput({ fms, k, ph, show, mode = 'decimal', label, warn, step }: { fms: Fms; k: K; ph: string; show?: (raw: string) => string | undefined; mode?: 'decimal' | 'numeric' | 'text'; label: string; warn?: boolean; /** ± 키 (D-089) */ step?: Step }) {
  const [e, set] = fms;
  const [focus, setFocus] = useState(false);
  const appKb = useAppKeyboard(); // 아이패드: 앱 키보드 (D-081·D-086 — 초점 없이 "지금 칸")
  const ref = useRef<HTMLInputElement>(null);
  const kbEl = useKbActive();
  const editing = focus || (!!ref.current && kbEl === ref.current);
  const raw = e[k] ?? '';
  const shown = !editing && raw ? (show?.(raw) ?? raw) : raw;
  return (
    <input
      ref={ref}
      className={`fms-in mono ${warn ? 'c-warn' : ''}`}
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="next"
      aria-label={`${label} FMS 입력`}
      placeholder={ph}
      value={shown}
      {...kbProps(appKb, { label, set: (v) => set({ [k]: v }), raw: () => e[k] ?? '', step }, mode)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onChange={(ev) => set({ [k]: ev.target.value })}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          moveField(ev.currentTarget, 1);
        }
      }}
    />
  );
}

/** 차이 표시: 0 = ✓ 초록, 그 밖 = 주황 */
export function Dlt({ d, hm, ok, tol }: { d: number | undefined; hm?: boolean; ok?: boolean; tol?: boolean }) {
  if (d === undefined) return null;
  const good = ok ?? d === 0;
  const txt = d === 0 && !tol ? '✓' : `${hm ? `${d > 0 ? '+' : d < 0 ? '−' : '±'}${fmtHm(Math.abs(d))}` : fmtSigned(d)}${tol ? (good ? ' ✓' : ' ⚠') : ''}`;
  return <span className={`fms-d mono ${good ? 'c-ok' : 'c-warn'}`}>{txt}</span>;
}

/** 표의 FMS 칸 (td 아무 곳이나 누르면 입력) */
export function FmsCell({ children, d }: { children: ReactNode; d?: ReactNode }) {
  return (
    <td className="fms-c" onClick={(ev) => (ev.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
      <span className="fms-x">
        {d}
        {children}
      </span>
    </td>
  );
}

/* ---------- 표시 다듬기 ---------- */
export const showKilo = (r: string) => {
  const v = parseKilo(r);
  return v === undefined ? undefined : nf.format(v);
};
export const showHm = (r: string) => {
  const v = parseHm(r);
  return v === undefined ? undefined : fmtHm(v);
};
const showNum = (r: string) => {
  const v = parseNum(r);
  return v === undefined ? undefined : nf.format(v);
};
const showFl = (r: string) => {
  const v = parseFl(r);
  return v === undefined ? undefined : `FL${String(v).padStart(3, '0')}`;
};
const showQnh = (r: string) => {
  const q = parseQnh(r);
  return q ? (q.unit === 'hPa' ? `${q.hpa} hPa` : `${q.inhg.toFixed(2)} inHg`) : undefined;
};
const showOil = (r: string) => {
  const v = parseOil(r);
  return v === undefined ? undefined : v.toFixed(1);
};

/** N/S · E/W 바꾸기 */
function Hemi({ fms, k, a, b }: { fms: Fms; k: 'latH' | 'lonH'; a: string; b: string }) {
  const [e, set] = fms;
  const v = (e[k] as string | undefined) ?? a;
  return (
    <button type="button" className="fms-hemi mono" aria-label={`${v} — 눌러서 바꾸기`} onClick={(ev) => (ev.stopPropagation(), set({ [k]: v === a ? b : a }))}>
      {v}
    </button>
  );
}

/** FMS 카드 (FLIGHT 카드에서 분리): DIST·FL·GATE·COORD */
export function FmsBlock({ fms, dist, maxFl }: { fms: Fms; dist?: number; /** OFP 순항고도 = MAX FL ± 기준 */ maxFl?: number }) {
  const [e] = fms;
  const dd = (v: number | undefined, ref: number | undefined) => (v === undefined || ref === undefined ? undefined : v - ref);
  return (
    <DocSection title="FMS">
      <table className="dt fms-t2">
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '40%' }} />
        </colgroup>
        <thead>
          <tr>
            <th />
            <th className="r">OFP</th>
            <th className="r fms-h">FMS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>DIST</td>
            <td className="r mono">{dist !== undefined ? nf.format(dist) : '—'}</td>
            <FmsCell d={<Dlt d={dd(parseNum(e.dist), dist)} />}>
              <FmsInput fms={fms} k="dist" ph="NM" mode="numeric" show={showNum} label="DIST" step={{ kind: 'num', plan: dist }} />
            </FmsCell>
          </tr>
          <tr>
            <td>MAX FL</td>
            <td className="r mono muted">—</td>
            <FmsCell>
              <FmsInput fms={fms} k="maxFl" ph="FL" mode="numeric" show={showFl} label="MAX FL" step={{ kind: 'num', plan: maxFl }} />
            </FmsCell>
          </tr>
          <tr>
            <td>OPT FL</td>
            <td className="r mono muted">—</td>
            <FmsCell>
              <FmsInput fms={fms} k="optFl" ph="FL" mode="numeric" show={showFl} label="OPT FL" step={{ kind: 'num', plan: parseFl(e.maxFl) ?? maxFl, planLabel: 'MAX FL' }} />
            </FmsCell>
          </tr>
          <tr>
            <td>EO FL</td>
            <td className="r mono muted">—</td>
            <FmsCell>
              <FmsInput fms={fms} k="eoFl" ph="FL" mode="numeric" show={showFl} label="EO FL" step={{ kind: 'num' }} />
            </FmsCell>
          </tr>
          <tr>
            <td>GATE</td>
            <td className="r mono muted">—</td>
            <FmsCell>
              <FmsInput fms={fms} k="gate" ph="GATE" mode="text" show={(r) => r.toUpperCase()} label="GATE" />
            </FmsCell>
          </tr>
          <tr>
            <td>COORD</td>
            <td className="r mono muted">LAT</td>
            <FmsCell d={<Hemi fms={fms} k="latH" a="N" b="S" />}>
              <FmsInput fms={fms} k="lat" ph="DD MM.M" mode="numeric" show={(r) => fmtCoord(r, 2)} label="LAT" />
            </FmsCell>
          </tr>
          <tr>
            <td />
            <td className="r mono muted">LON</td>
            <FmsCell d={<Hemi fms={fms} k="lonH" a="E" b="W" />}>
              <FmsInput fms={fms} k="lon" ph="DDD MM.M" mode="numeric" show={(r) => fmtCoord(r, 3)} label="LON" />
            </FmsCell>
          </tr>
        </tbody>
      </table>
    </DocSection>
  );
}

/** RVSM · ALTIMETERS 카드 (FLIGHT 카드에서 분리): QNH·표고·PFD 3개 + 기준표 */
/** RVSM · ALTIMETERS 카드 (D-090: D-088에서 합쳤다가 다시 나눔) */
export function RvsmBlock({ fms }: { fms: Fms }) {
  return (
    <DocSection title="RVSM · Altimeters" meta="FOM · FCOM">
      <RvsmPart fms={fms} />
    </DocSection>
  );
}

/** SYSTEMS · PRE-FLIGHT 카드 */
export function SystemsBlock({ fms, flightMin }: { fms: Fms; flightMin?: number }) {
  return (
    <DocSection title="Systems · Pre-flight" meta="FCOM">
      <SystemsPart fms={fms} flightMin={flightMin} />
    </DocSection>
  );
}

function RvsmPart({ fms }: { fms: Fms }) {
  const [e] = fms;
  const q = parseQnh(e.qnh);
  const alt = altChecks(e);
  return (
    <div>
      <table className="dt fms-t2">
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '40%' }} />
        </colgroup>
        <thead>
          <tr>
            <th />
            <th className="r" />
            <th className="r fms-h">FMS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>QNH</td>
            <td className="r mono muted">{q ? (q.unit === 'hPa' ? `${q.inhg.toFixed(2)} inHg` : `${q.hpa} hPa`) : '—'}</td>
            <FmsCell d={q === null ? <span className="fms-d c-warn">범위 밖</span> : q?.high ? <span className="fms-d c-warn">&gt;1050 SUPP</span> : undefined}>
              <FmsInput fms={fms} k="qnh" ph="hPa·inHg" show={showQnh} label="QNH" />
            </FmsCell>
          </tr>
          <tr>
            <td>ELEV</td>
            <td className="r mono muted">FT</td>
            <FmsCell>
              <FmsInput fms={fms} k="elev" ph="FT" mode="numeric" show={showNum} label="ELEV 공항 표고" step={{ kind: 'num' }} />
            </FmsCell>
          </tr>
          <tr>
            <td>CAPT PFD</td>
            <td className="r fms-vs">vs ELEV</td>
            <FmsCell d={alt.capt && <Dlt d={alt.capt.d} ok={alt.capt.ok} tol />}>
              <FmsInput fms={fms} k="altC" ph="FT" mode="numeric" show={showNum} label="CAPT PFD 고도" step={{ kind: 'num', plan: parseNum(e.elev), planLabel: 'ELEV' }} />
            </FmsCell>
          </tr>
          <tr>
            <td>F/O PFD</td>
            <td className="r fms-vs">vs CAPT</td>
            <FmsCell d={alt.fo && <Dlt d={alt.fo.d} ok={alt.fo.ok} tol />}>
              <FmsInput fms={fms} k="altF" ph="FT" mode="numeric" show={showNum} label="F/O PFD 고도" step={{ kind: 'num', plan: parseNum(e.altC), planLabel: 'CAPT' }} />
            </FmsCell>
          </tr>
          <tr>
            <td>STBY ISIS</td>
            <td className="r fms-vs">vs CAPT</td>
            <FmsCell d={alt.stby && <Dlt d={alt.stby.d} ok={alt.stby.ok} tol />}>
              <FmsInput fms={fms} k="altS" ph="FT" mode="numeric" show={showNum} label="STBY ISIS 고도" step={{ kind: 'num', plan: parseNum(e.altC), planLabel: 'CAPT' }} />
            </FmsCell>
          </tr>
        </tbody>
      </table>
      <RvsmLimits />
    </div>
  );
}

const Src = ({ fom }: { fom?: boolean }) => <span className={`fms-src ${fom ? 'fom' : ''}`}>{fom ? 'FOM' : 'FCOM'}</span>;

/** RVSM 기준표 (D-080): 행 GND·CRZ·FL300+, 열 PFD↔표고 · PFD↔PFD · PFD↔ISIS. 큰 숫자 + 출처 */
function RvsmLimits() {
  const L = RVSM_LIMITS;
  const na = <td className="na">—</td>;
  return (
    <>
      <div className="fms-lim">
        <table>
          <colgroup>
            <col style={{ width: '25%' }} />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>MAX FT</th>
              <th>
                PFD ↔ 표고<small>각 PFD vs ELEV</small>
              </th>
              <th>
                PFD ↔ PFD<small>기장 vs 부기장</small>
              </th>
              <th>
                PFD ↔ ISIS<small>PFD vs STBY</small>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                GND<small>QNH</small>
              </td>
              <td>
                {L.gnd.elev}
                <Src fom />
              </td>
              <td>
                {L.gnd.pfd}
                <Src />
              </td>
              <td>
                {L.gnd.isis}
                <Src />
              </td>
            </tr>
            <tr>
              <td>
                CRZ<small>약 1시간마다</small>
              </td>
              {na}
              <td>
                {L.crz.pfd}
                <Src fom />
              </td>
              {na}
            </tr>
            <tr>
              <td>
                FL300+<small>M.85</small>
              </td>
              {na}
              <td>
                {L.fl300.pfd}
                <Src />
              </td>
              <td>
                {L.fl300.isis}
                <Src />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="fms-limn">FOM 10.4.1.3 · FCOM PRO-SPO-RVSM (FL410 PFD↔ISIS 360). CRZ 200 초과 = Loss of Redundancy. ✓/⚠는 GND 값으로 비교.</p>
    </>
  );
}

type FcomRefs = { oil?: ManualTarget; oxy?: ManualTarget; hyd?: ManualTarget };

/** 기기에 가져온 FCOM에서 SYSTEMS 제목이 열 쪽 (D-080): ENG OIL = LIM-ENG OIL QUANTITY · OXY = LIM-OXY · HYD = SOP "RESERVOIR FLUID LEVEL" (FCOM LIM에 유압 양 쪽 없음) */
function useFcomRefs(): FcomRefs | undefined {
  const [refs, setRefs] = useState<FcomRefs | undefined>(undefined);
  const [n, setN] = useState(0);
  useEffect(() => {
    const re = () => setN((x) => x + 1);
    manualEvents.addEventListener('change', re);
    return () => manualEvents.removeEventListener('change', re);
  }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: FcomRefs = {};
      for (const d of (await listManuals()).filter((x) => x.kind === 'FCOM')) {
        const pages = await docPages(d.docId);
        const find = (code: string, re: RegExp, mark: string) => {
          const p = pages.find((x) => x.code?.startsWith(code) && re.test(x.text));
          return p ? { docId: d.docId, seq: p.seq, mark } : undefined;
        };
        out.oil ??= find('LIM-ENG', /OIL QUANTITY[\s\S]*Minimum Oil/i, 'OIL QUANTITY');
        out.oxy ??= find('LIM-OXY', /MINIMUM FLIGHT CREW OXYGEN/i, 'MINIMUM FLIGHT CREW OXYGEN PRESSURE');
        out.hyd ??= find('PRO-NOR-SOP', /RESERVOIR FLUID LEVEL/i, 'RESERVOIR FLUID LEVEL');
        if (out.oil && out.oxy && out.hyd) break;
      }
      if (alive) setRefs(out);
    })();
    return () => {
      alive = false;
    };
  }, [n]);
  return refs;
}

/** 칸 묶음 제목 = FCOM 원문 링크 */
function SysTitle({ label, src, to }: { label: string; src: string; to: ManualTarget | undefined | null }) {
  return (
    <button
      type="button"
      className="fms-tl"
      onClick={() => (to ? openManualPage(to) : alert(`기기에 FCOM이 없거나 ${src} 쪽을 찾지 못했습니다 — Settings → 매뉴얼 → 가져오기`))}
    >
      {label} <span>📖 {src}</span>
    </button>
  );
}

function CellIn({ fms, k, title, ph, show, mode, warn, step }: { fms: Fms; k: K; title: string; ph: string; show: (r: string) => string | undefined; mode?: 'decimal' | 'numeric'; warn?: boolean; step?: Step }) {
  return (
    <label className="fms-cell">
      <span className="cell-k">{title}</span>
      <FmsInput fms={fms} k={k} ph={ph} show={show} mode={mode} label={title} warn={warn} step={step} />
    </label>
  );
}

function HydChip({ fms, k, label, color }: { fms: Fms; k: 'hydG' | 'hydY'; label: string; color: 'g' | 'y' }) {
  const [e, set] = fms;
  const at = e[k];
  return (
    <button type="button" role="checkbox" aria-checked={!!at} aria-label={`${label} NORMAL`} className={`fms-chip ${at ? 'on' : ''}`} onClick={() => set({ [k]: at ? undefined : new Date().toISOString() })}>
      <span>
        <span className={`fms-dot hyd-${color}`} />
        {label}
      </span>
      <span className="fms-chip-r">
        {at && <span className="mono muted fms-tm">{formatZ(at)}</span>}
        <i aria-hidden="true" />
      </span>
    </button>
  );
}

/** SYSTEMS · PRE-FLIGHT 카드 (D-080): ENG OIL 4칸 + 최소량(FCOM LIM-ENG, RAMP OUT 시간) · HYD NORMAL 체크 · OXY 2칸. 오일이 최소량(두 값 중 큰 값)보다 적으면 주황 */
function SystemsPart({ fms, flightMin }: { fms: Fms; flightMin?: number }) {
  const [e] = fms;
  const refs = useFcomRefs();
  const mo = minOil(flightMin);
  const low = (k: 'oil1' | 'oil2' | 'oil3' | 'oil4') => {
    const v = parseOil(e[k]);
    return v !== undefined && mo !== undefined && v < mo.max;
  };
  return (
    <div>
      <div className="fms-lbl">
        <SysTitle label="ENG OIL · QT" src="LIM-ENG" to={refs && (refs.oil ?? null)} />
      </div>
      <div className="fms-cells c4">
        {(['oil1', 'oil2', 'oil3', 'oil4'] as const).map((k, i) => (
          <CellIn key={k} fms={fms} k={k} title={`ENG ${i + 1}`} ph="QT" show={showOil} warn={low(k)} step={{ kind: 'num', dp: 1, plan: i ? parseOil(e.oil1) : undefined, planLabel: 'ENG 1' }} />
        ))}
      </div>
      {mo && (
        <table className="fms-mo">
          <colgroup>
            <col style={{ width: '24%' }} />
            <col />
            <col style={{ width: '24%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>MIN OIL · QT</th>
              <th>FCOM LIM-ENG</th>
              <th className="r">FLT {fmtHm(flightMin)}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>OAT &lt; 0°C</td>
              <td>{flightMin! < 14 * 60 ? 'FLT < 14h → 13' : 'FLT ≥ 14h → 6 + 0.5×FLT'}</td>
              <td className="r">{mo.cold.toFixed(1).replace(/\.0$/, '')}</td>
            </tr>
            <tr>
              <td>OAT ≥ 0°C</td>
              <td>{flightMin! < 8 * 60 ? 'FLT < 8h → 10' : 'FLT ≥ 8h → 6 + 0.5×FLT'}</td>
              <td className="r">{mo.warm.toFixed(1).replace(/\.0$/, '')}</td>
            </tr>
          </tbody>
        </table>
      )}
      <div className="fms-lbl">
        <SysTitle label="HYD · QTY" src="SOP · HYD SD" to={refs && (refs.hyd ?? null)} />
      </div>
      <div className="fms-hyd">
        <HydChip fms={fms} k="hydG" label="GREEN" color="g" />
        <HydChip fms={fms} k="hydY" label="YELLOW" color="y" />
      </div>
      <div className="fms-lbl">
        <SysTitle label="OXY · PSI" src="LIM-OXY" to={refs && (refs.oxy ?? null)} />
      </div>
      <div className="fms-cells c2">
        <CellIn fms={fms} k="oxyCrew" title="CREW" ph="PSI" mode="numeric" show={showNum} step={{ kind: 'num' }} />
        <CellIn fms={fms} k="oxyCabin" title="CABIN" ph="PSI" mode="numeric" show={showNum} step={{ kind: 'num', plan: parseNum(e.oxyCrew), planLabel: 'CREW' }} />
      </div>
      <p className="fms-limn">오일 최소량 = OFP RAMP OUT 시간으로 계산(소수 첫째 자리 올림). 주황 = 두 값 중 큰 값보다 적음. 제목을 누르면 FCOM 원문.</p>
    </div>
  );
}
