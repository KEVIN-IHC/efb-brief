// Jeppesen Aviator OFP (항공사 CFP 출력) 추출 규칙
// 근거: private/samples 10개 (A388·B78X, ICN↔LAX, SYD↔ICN). 값 단위는 OFP 'UNIT 100LBS' → lbs로 환산.
import { isPageNoise } from './lines';
import type { DocLine } from './types';
import type { EtpScenario, FuelRow, OfpAlternate, OfpEtp, OfpMelItem, OfpWaypoint } from '../types';

// ---------- 공통 ----------
export const isFooter = isPageNoise;
const MON: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

/** "10.16" → 616 (분) */
export const hmToMin = (s: string) => {
  const m = /^(\d{1,2})\.(\d{2})$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
/** "N37 29.2" / "E127 22.8" → 도 */
export function parseDm(s: string): number {
  const m = /^([NSEW])(\d{2,3}) (\d{2}\.\d)$/.exec(s.trim());
  if (!m) return NaN;
  const v = Number(m[2]) + Number(m[3]) / 60;
  return m[1] === 'S' || m[1] === 'W' ? -v : v;
}
/** "N45366" / "E168258" (도·분·1/10분) → 도 */
export function parseDmPacked(s: string): number {
  const m = /^([NSEW])(\d{2,3})(\d{2})(\d)$/.exec(s.trim());
  if (!m) return NaN;
  const v = Number(m[2]) + (Number(m[3]) + Number(m[4]) / 10) / 60;
  return m[1] === 'S' || m[1] === 'W' ? -v : v;
}
const num = (s: string) => Number(s.replace(/,/g, ''));
const H = 100; // 100 LBS 단위

export interface Traced<T> {
  value: T;
  line: number;
}

// ---------- 헤더 ----------
export interface AviatorHeader {
  planNo?: Traced<string>;
  flightNo: Traced<string>;
  dep: Traced<string>;
  arr: Traced<string>;
  date: Traced<string>; // YYYY-MM-DD
  computedAt?: Traced<string>;
  acCode?: Traced<string>;
  reg?: Traced<string>;
  engine?: Traced<string>;
  selcal?: Traced<string>;
  avgWindTemp?: Traced<string>;
  unit?: Traced<string>;
  costIndex?: Traced<number>;
  etd?: Traced<string>; // HHMM
  eta?: Traced<string>;
  routeString?: Traced<string>;
}

export function parseHeader(lines: DocLine[]): AviatorHeader | null {
  let h: Partial<AviatorHeader> = {};
  for (let i = 0; i < lines.length; i++) {
    const { text: t, n } = lines[i];
    let m: RegExpExecArray | null;
    if (!h.planNo && (m = /^CFP PLAN\s+(\d+)/.exec(t))) h.planNo = { value: m[1], line: n };
    if (!h.flightNo && (m = /FLIGHT RELEASE\s+([A-Z0-9]+)\s+([A-Z]{4})\/([A-Z]{4})\s+ON\s+(\d{2})\/([A-Z]{3})\/(\d{2})/.exec(t))) {
      h = { ...h, flightNo: { value: m[1], line: n }, dep: { value: m[2], line: n }, arr: { value: m[3], line: n } };
      h.date = { value: `20${m[6]}-${MON[m[5]] ?? '01'}-${m[4]}`, line: n };
      const c = /COMPUTED\s+(\d{4})Z/.exec(t);
      if (c) h.computedAt = { value: `${c[1]}Z`, line: n };
    }
    if (!h.reg && /^A\/C\s+REG/.test(t) && lines[i + 1]) {
      const nl = lines[i + 1];
      const tk = nl.text.trim().split(/\s+/);
      // 388 HL0000 TRENT970 HS-EJ TR18 F BRK 1718UK P074/M50 100LBS
      if (tk.length >= 4 && /^HL\d{4}$|^[A-Z]{1,2}-?[A-Z0-9]{3,5}$/.test(tk[1])) {
        h.acCode = { value: tk[0], line: nl.n };
        h.reg = { value: tk[1], line: nl.n };
        h.engine = { value: tk[2], line: nl.n };
        h.selcal = { value: tk[3], line: nl.n };
        const wt = tk.find((x) => /^[PM]\d{3}\/[PM]\d{2}$/.test(x));
        if (wt) h.avgWindTemp = { value: wt, line: nl.n };
        const u = tk.find((x) => /LBS$|KGS?$/.test(x));
        if (u) h.unit = { value: u, line: nl.n };
      }
    }
    if (h.costIndex === undefined && (m = /CRZ-\s*(\d{1,4})\b/.exec(t))) h.costIndex = { value: Number(m[1]), line: n };
    if (!h.etd && (m = /ETD\s+[A-Z]{4}\s+(\d{4})Z\s+ETA\s+[A-Z]{4}\s+(\d{4})Z/.exec(t))) {
      h.etd = { value: m[1], line: n };
      h.eta = { value: m[2], line: n };
    }
    // 항로 문자열: "2ND-$" 다음 줄부터 루트 로그 머리글 전까지
    if (!h.routeString && /^2ND-\$/.test(t)) {
      const parts: string[] = [];
      for (let k = i + 1; k < lines.length && !/^DIST\s+LATITUDE/.test(lines[k].text); k++) {
        if (!isFooter(lines[k].text) && lines[k].text.trim()) parts.push(lines[k].text.trim());
      }
      if (parts.length) h.routeString = { value: parts.reduce((acc, p) => (acc.endsWith('..') || !acc ? acc + p : `${acc} ${p}`), ''), line: lines[i + 1].n };
    }
    if (/^DIST\s+LATITUDE/.test(t)) break;
  }
  return h.flightNo && h.dep && h.arr && h.date ? (h as AviatorHeader) : null;
}

// ---------- 연료·중량 ----------
const FUEL_ROW = /^\s*(TRIP|RESERVE|ALTN\/[A-Z]{4}|FINAL RES|\d+ PCT CONT|REFILE RES|ETP RES|RQD TAKEOFF|DISC|TANKERING|PLN TAKEOFF|TAXI|RAMP OUT|FOD)\s+(\d{4})(?:\s+(\d{2}\.\d{2}))?/;
const SUB_ROWS = /^(ALTN\/|FINAL RES|\d+ PCT CONT|REFILE RES|ETP RES)/;

export interface AviatorFuel {
  rows: (FuelRow & { line: number })[];
  get: (label: RegExp) => (FuelRow & { line: number }) | undefined;
}

export function parseFuel(lines: DocLine[]): AviatorFuel | null {
  const rows: (FuelRow & { line: number })[] = [];
  for (const l of lines) {
    if (/^DIST\s+LATITUDE/.test(l.text)) break;
    const m = FUEL_ROW.exec(l.text);
    if (!m) continue;
    const label = m[1];
    if (rows.some((r) => r.label === label)) continue;
    const kind = SUB_ROWS.test(label) ? 'sub' : /^(RQD TAKEOFF|PLN TAKEOFF)$/.test(label) ? 'total' : /^(RAMP OUT|FOD)$/.test(label) ? 'key' : undefined;
    rows.push({ label, fuel: Number(m[2]) * H, timeMin: m[3] ? hmToMin(m[3]) : undefined, kind, line: l.n });
  }
  if (!rows.some((r) => r.label === 'TRIP') || !rows.some((r) => r.label === 'RAMP OUT')) return null;
  return { rows, get: (re) => rows.find((r) => re.test(r.label)) };
}

const WT_RE = /\b(SOW|PLD|ZFW|MZFW|TOF|TOW|MTOW|TIF|TCAP|LDW|MLDW|RWY|ACL|AGTOW)\s+(\d{5})\b/g;

export function parseWeights(lines: DocLine[]): Record<string, Traced<number>> {
  const out: Record<string, Traced<number>> = {};
  for (const l of lines) {
    if (/^DIST\s+LATITUDE/.test(l.text)) break;
    for (const m of l.text.matchAll(WT_RE)) if (!out[m[1]]) out[m[1]] = { value: Number(m[2]) * H, line: l.n };
  }
  return out;
}

// ---------- 루트 로그 (웨이포인트당 3줄) ----------
// A: DIST LAT MC FL ETO/MSA R/F OT WIND/COMP SR TAS ZT B/O
// WIND/COMP는 9자: "25057P030", 성분 0이면 부호 자리가 공백 "20014 000", 미기재 "........."
const ROW_A = /^(\d{4})\s+([NS]\d{2} \d{2}\.\d)\s+(\d{3})\s+(CLB|DSC|\d{3})\s+(\S{7})\s+(\d{4})\s+(\S{1,3})\s+(\d{5}[PM ]\d{3}|\.{9})\s+(\S{2})\s+(\S{3})\s+(\d{3})\s+(\d{3})\s*$/;
// B: NAME LON MH  (ATO/DF)  MW GS ACTM ACBO/
const ROW_B = /^(\S+)\s+([EW]\d{3} \d{2}\.\d)\s+(\d{3})\s+.*?(\S{2})\s+(\S{2,3})\s+(\d{2}\.\d{2})\s+(\d{4})\/?\s*$/;
const ROW_C_FIR = /^\/\s+([A-Z]{4})\s+FIR\s+(\d{3})\s+(.*?)\s{2,}(\S.*?)\s*$/;
const ROW_C = /^\s+(\d{3})\s+(\S.*?)\s*$/;

const n3 = (s: string) => (/^\d+$/.test(s) ? Number(s) : null);

export function parseRouteLog(lines: DocLine[], takeoffMs: number): OfpWaypoint[] {
  const start = lines.findIndex((l) => /^DIST\s+LATITUDE/.test(l.text));
  if (start < 0) return [];
  const body = lines.slice(start + 3).filter((l) => !isFooter(l.text) && l.text.trim() !== '');
  const wpts: OfpWaypoint[] = [];
  let cumDist = 0;
  for (let i = 0; i < body.length; i++) {
    if (/^ROUTE TO ALTN/.test(body[i].text)) break;
    const a = ROW_A.exec(body[i].text);
    if (!a) continue;
    const b = body[i + 1] && ROW_B.exec(body[i + 1].text);
    if (!b) continue;
    const c = body[i + 2]?.text ?? '';
    const cf = ROW_C_FIR.exec(c);
    const cc = !cf && !ROW_A.test(c) ? ROW_C.exec(c) : null;

    // 풍향 10도 단위 2자리 + 풍속 3자리: "23077P050" = 230°/077kt, 성분 +50 (배풍)
    const wind = /^(\d{2})(\d{3})([PM ])(\d{3})$/.exec(a[8]);
    const msa = /\/(\d{3})$/.exec(a[5]);
    const legDist = Number(a[1]);
    cumDist += legDist;
    const cumMin = hmToMin(b[6]);
    const flNum = /^\d{3}$/.test(a[4]) ? Number(a[4]) : 0;
    wpts.push({
      seq: wpts.length + 1,
      name: b[1],
      fullName: cf ? cf[4] : cc ? cc[2] : undefined,
      lat: parseDm(a[2]),
      lon: parseDm(b[2]),
      airway: '',
      fl: flNum,
      flText: a[4],
      windDir: wind ? Number(wind[1]) * 10 : null,
      windSpd: wind ? Number(wind[2]) : null,
      windComp: wind ? (wind[3] === 'M' ? -1 : 1) * Number(wind[4]) : null,
      oat: null,
      tempText: a[7],
      tas: n3(a[10]),
      gs: n3(b[5]),
      mc: Number(a[3]),
      mh: Number(b[3]),
      tc: cf ? Number(cf[2]) : cc ? Number(cc[1]) : undefined,
      msa: msa ? Number(msa[1]) : undefined,
      sr: n3(a[9]),
      legDist,
      cumDist,
      legMin: Number(a[11]),
      cumMin,
      eto: new Date(takeoffMs + cumMin * 60000).toISOString(),
      fuelRem: Number(a[6]) * H,
      burn: Number(a[12]) * H,
      accBurn: Number(b[7]) * H,
      fir: cf ? `${cf[1]} ${cf[3]}`.trim() : undefined,
      srcLine: body[i].n,
    });
    i += cf || cc ? 2 : 1;
  }
  return wpts;
}

// ---------- 교체공항 ----------
export function parseAlternates(lines: DocLine[]): (OfpAlternate & { line: number })[] {
  const out: (OfpAlternate & { line: number })[] = [];
  let route: string | undefined;
  let era = false;
  for (const l of lines) {
    let m: RegExpExecArray | null;
    if ((m = /^ROUTE TO ALTN\s*:\s*(.+)$/.exec(l.text))) route = m[1].trim();
    // ALTERNATE  - 1  KONT  129  080  0105  100  P006  00.22 11600
    if ((m = /^ALTERNATE\s+-\s*(\d)\s+([A-Z]{4})\s+(\d{3})\s+(\d{3})\s+(\d{4})\s+(\d{3})\s+([PM]\d{3})\s+(\d{2}\.\d{2})\s+(\d+)/.exec(l.text))) {
      out.push({ icao: m[2], role: `DEST ALTN ${m[1]}`, distNm: Number(m[5]), fl: Number(m[6]), timeMin: hmToMin(m[8]), fuel: Number(m[9]), route, line: l.n });
    }
    if (/CONTINGENCY ERA VALIDATION/.test(l.text)) era = true;
    // KSFO    N4412.2  4170   61  112  1038   2.05  1310
    if (era && (m = /^([A-Z]{4})\s+[NS]\d{4}\.\d\s+\d+\s+\d+\s+\d+\s+(\d+)\s+(\d{1,2})\.(\d{2})\s+\d{4}/.exec(l.text))) {
      out.push({ icao: m[1], role: '3% CONT ERA', distNm: Number(m[2]), timeMin: Number(m[3]) * 60 + Number(m[4]), line: l.n });
    }
    if (/EQUAL TIME POINT/.test(l.text)) break;
  }
  return out;
}

// ---------- ETP ----------
// EDTO 형식 (B787 등): ETP1 RJBB/PGUM 0706/0654 P013/M019 028531 116713 088182 02.24/01.55
//                         N23192 E139462
const EDTO_ROW = /^ETP(\d+)\s+([A-Z]{4})\/([A-Z]{4})\s+(\d{4})\/(\d{4})\s+([PM]\d{3})\/([PM]\d{3})\s+(\d{6})\s+(\d{6})\s+(\d{6})\s+(\d{2}\.\d{2})\/(\d{2}\.\d{2})/;

export interface EdtoInfo {
  windows: { icao: string; from: string; to: string }[];
  mostCritical?: string;
}

export function parseEdtoInfo(lines: DocLine[]): EdtoInfo {
  const info: EdtoInfo = { windows: [] };
  for (const l of lines) {
    let m: RegExpExecArray | null;
    if ((m = /^([A-Z]{4}) SUITABLE FROM (\d{4}) UTC \/ TO (\d{4}) UTC/.exec(l.text))) info.windows.push({ icao: m[1], from: `${m[2]}Z`, to: `${m[3]}Z` });
    if ((m = /MOST CRITICAL FUEL SCENARIO AT\s*:\s*(\S+)/.exec(l.text))) info.mostCritical = m[1];
  }
  return info;
}

function parseEdtoEtp(lines: DocLine[], route: OfpWaypoint[], takeoffMs: number): (OfpEtp & { line: number })[] {
  const out: (OfpEtp & { line: number })[] = [];
  lines.forEach((l, i) => {
    const m = EDTO_ROW.exec(l.text.trim());
    if (!m) return;
    const p = /([NS]\d{5})\s+([EW]\d{6})/.exec(lines[i + 1]?.text ?? '');
    const name = `ETP${m[1]}`;
    const w = route.find((r) => r.name === name || r.name === `ETP${m[1].padStart(2, '0')}`);
    const toPoint = hmToMin(m[11]);
    out.push({
      name,
      airports: [m[2], m[3]],
      lat: p ? parseDmPacked(p[1]) : w?.lat ?? NaN,
      lon: p ? parseDmPacked(p[2]) : w?.lon ?? NaN,
      eto: w?.eto ?? new Date(takeoffMs + toPoint * 60000).toISOString(),
      fuelOnBoard: Number(m[9]),
      criticalFuel: Number(m[8]), // OFP 명시 CFR
      distToAlt: Number(m[4]),
      timeToAltMin: hmToMin(m[12]),
      line: l.n,
    });
  });
  return out;
}

export function parseEtp(etpLines: DocLine[], driftLines: DocLine[], route: OfpWaypoint[], takeoffMs: number): (OfpEtp & { line: number })[] {
  const edto = parseEdtoEtp(etpLines, route, takeoffMs);
  if (edto.length) return edto;
  const txt = etpLines.map((l) => l.text);
  const pairLine = etpLines.find((l) => /[A-Z]{4}-[A-Z]{4}/.test(l.text));
  if (!pairLine) return [];
  const pairs = [...pairLine.text.matchAll(/([A-Z]{4})-([A-Z]{4})/g)].map((m) => [m[1], m[2]] as [string, string]);
  const all = (re: RegExp) => txt.flatMap((t) => [...t.matchAll(re)].map((m) => m[1]));
  const dist = all(/DIST\s+(\d+)/g).map(Number);
  const time = all(/TIME\s+(\d{2}\.\d{2})/g).map(hmToMin);
  const trip = all(/TRIP\s+(\d{4})/g).map((v) => Number(v) * H);
  const pos = txt.flatMap((t) => [...t.matchAll(/LAT\/LONG\s+([NS]\d{5})\s+([EW]\d{6})/g)].map((m) => [parseDmPacked(m[1]), parseDmPacked(m[2])]));
  const scen = parseDriftdown(driftLines);

  return pairs.map((ap, k) => {
    const name = `ETP${k + 1}`;
    const w = route.find((r) => r.name === name);
    const [lat, lon] = pos[k] ?? [w?.lat ?? NaN, w?.lon ?? NaN];
    return {
      name,
      airports: ap,
      lat,
      lon,
      eto: w?.eto ?? new Date(takeoffMs + (time[2 * k] ?? 0) * 60000).toISOString(),
      fuelOnBoard: w?.fuelRem ?? NaN,
      distFromDep: dist[2 * k],
      distToAlt: dist[2 * k + 1],
      timeToAltMin: time[2 * k + 1],
      fuelToAlt: trip[2 * k + 1],
      scenarios: scen.filter((s) => s.idx === k).map(({ idx: _i, ...s }) => s),
      line: pairLine.n,
    };
  });
}

// LRC RJCC 098077 100 098 PACD 097060 100 119 198347 N45366 E168258 M
//    *PACD 085209 100 094 KSFO 085410 100 062 107457 N44132 W143354
const DD_ROW = /^\s*(?:([A-Z0-9]{3})\s+)?\*?([A-Z]{4})\s+(\d{6})\s+(\d{3})\s+\d{3}\s+\*?([A-Z]{4})\s+(\d{6})\s+(\d{3})\s+\d{3}\s+(\d{6})\s+([NS]\d{5})\s+([EW]\d{6})\s*([MDFS ]*)$/;

export function parseDriftdown(lines: DocLine[]): (EtpScenario & { idx: number })[] {
  const out: (EtpScenario & { idx: number })[] = [];
  let mode = '';
  let idx = 0;
  let inBlock = false;
  for (const l of lines) {
    if (/DRIFTDOWN SUMMARY/.test(l.text)) inBlock = true;
    if (!inBlock) continue;
    const m = DD_ROW.exec(l.text);
    if (!m) continue;
    if (m[1]) {
      mode = m[1];
      idx = 0;
    } else idx++;
    out.push({
      idx,
      mode,
      airports: [m[2], m[5]],
      burn: [Number(m[3]), Number(m[6])],
      fl: [Number(m[4]), Number(m[7])],
      fob: Number(m[8]),
      lat: parseDmPacked(m[9]),
      lon: parseDmPacked(m[10]),
      flags: m[11].trim(),
    });
  }
  return out;
}

// ---------- 디스패치 릴리스 ----------
export interface AviatorDispatch {
  pax?: Traced<string>;
  cargo?: Traced<string>;
  stats?: { period?: string; items: { label: string; value: number }[]; line: number };
  mel: (OfpMelItem & { line: number })[];
  notes: { text: string; line: number }[];
}

export function parseDispatch(lines: DocLine[]): AviatorDispatch {
  const d: AviatorDispatch = { mel: [], notes: [] };
  let sec = 0;
  let inStats = false;
  let cur: { text: string; line: number } | null = null;
  const push = () => {
    if (cur && cur.text.trim()) d.notes.push({ ...cur, text: cur.text.replace(/\s+/g, ' ').trim() });
    cur = null;
  };
  for (const l of lines) {
    const t = l.text;
    if (/WEATHER BRIEFING|\*\*\* ATTENTION \*\*\*/.test(t)) break;
    if (isFooter(t) || /^-{10,}/.test(t.trim())) continue;
    let m: RegExpExecArray | null;
    if ((m = /^\s*(\d)\.\s+\S/.exec(t))) {
      push();
      sec = Number(m[1]);
      inStats = false;
      continue;
    }
    if ((m = /PASSENGERS:\s*(.+)$/.exec(t))) d.pax = { value: m[1].replace(/\s+/g, ' ').trim(), line: l.n };
    if ((m = /PAX:\s*([\d,]+)\s*LBS,\s*CARGO:\s*([\d,]+)\s*LBS/.exec(t))) d.cargo = { value: `PAX ${m[1]} LBS · CARGO ${m[2]} LBS`, line: l.n };
    if (/ROUTE FUEL CONSUMPTION STATISTICS/.test(t)) {
      push();
      inStats = true;
      continue;
    }
    if (inStats) {
      const p = /(\d+\s*Months?\([^)]*\))/i.exec(t);
      if (p) d.stats = { ...(d.stats ?? { items: [], line: l.n }), period: p[1] };
      if (/MEAN\//.test(t)) {
        const items = [...t.matchAll(/(MEAN|\d+%)\s*(?:STAT)?\/\s*(-?[\d,]+)\s*LBS/g)].map((x) => ({ label: x[1], value: num(x[2]) }));
        d.stats = { period: d.stats?.period, items, line: l.n };
        inStats = false;
      }
      continue;
    }
    if ((m = /^\s*-\s*(MEL|CDL)\s+([\dA-Z-]+)\s*:\s*(.+)$/.exec(t))) {
      push();
      d.mel.push({ kind: m[1] as 'MEL' | 'CDL', itemNo: m[2], title: m[3].trim(), line: l.n });
      continue;
    }
    if (sec === 1 || sec === 3) continue; // 승객·MEL 섹션의 나머지 줄
    if (sec === 0) continue; // 머리말 (연락처 등) 은 노트로 쓰지 않음
    if (/_{4,}/.test(t)) continue; // 서명·기입란
    if ((m = /^\s*-\s+(.*)$/.exec(t))) {
      push();
      cur = { text: m[1], line: l.n };
    } else if ((m = /^\s*\*\s+(.*)$/.exec(t))) {
      if (cur) cur.text += ` · ${m[1]}`;
      else cur = { text: m[1], line: l.n };
    } else if (cur && t.trim()) cur.text += ` ${t.trim()}`;
  }
  push();
  return d;
}

/** "388"·"781" 같은 OFP 기종 코드 → ICAO (FPL이 있으면 FPL 값을 우선) */
export const AC_CODE: Record<string, string> = { '388': 'A388', '781': 'B78X', '789': 'B789', '77W': 'B77W', '359': 'A359', '333': 'A333' };

// ---------- FL별 바람·기온 요약 (START OF WIND AND TEMPERATURE SUMMARY) ----------
// FL    ISA   WIND CMP TMP   WIND CMP TMP ...
// 370   -56   25054+033-48   25061+031-53          ← 칸: 풍향(10도)2 + 풍속3, 성분, 기온
//                AGSUS          LANAT              ← 블록 아래 지점 이름 (최대 4개)
const WS_ROW = /^(\d{3})\s+(-?\d{1,3})\s+(.*)$/;
const WS_CELL = /(\d{2})(\d{3})([+-]\d{3})([+-]\d{2,3})/g;

export interface WindPoint {
  name: string;
  byFl: Record<number, { dir: number; spd: number; comp: number; temp: number }>;
}
export interface WindSummary {
  fls: number[]; // 높은 FL부터
  isa: Record<number, number>;
  points: WindPoint[];
  line: number;
}

export function parseWindSummary(lines: DocLine[]): WindSummary | null {
  const start = lines.findIndex((l) => /START OF WIND AND TEMPERATURE SUMMARY/.test(l.text));
  if (start < 0) return null;
  const isa: Record<number, number> = {};
  const points: WindPoint[] = [];
  let block: { fl: number; cells: { dir: number; spd: number; comp: number; temp: number }[] }[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].text;
    if (/DRIFTDOWN SUMMARY|END OF JEPPESEN|^-{5,}/.test(t)) break;
    if (isPageNoise(t) || /^FL\s+ISA/.test(t) || !t.trim()) continue;
    const r = WS_ROW.exec(t);
    if (r) {
      const fl = Number(r[1]);
      isa[fl] = Number(r[2]);
      const cells = [...r[3].matchAll(WS_CELL)].map((m) => ({ dir: Number(m[1]) * 10, spd: Number(m[2]), comp: Number(m[3]), temp: Number(m[4]) }));
      if (cells.length) block.push({ fl, cells });
      continue;
    }
    // 이름 줄: 블록이 열려 있을 때만
    if (block.length) {
      const names = t.trim().split(/\s+/);
      const n = Math.max(...block.map((b) => b.cells.length));
      if (names.length === n && names.every((x) => /^[A-Z0-9]{2,7}$/.test(x))) {
        names.forEach((name, k) => {
          const byFl: WindPoint['byFl'] = {};
          for (const b of block) if (b.cells[k]) byFl[b.fl] = b.cells[k];
          points.push({ name, byFl });
        });
        block = [];
      }
    }
  }
  if (!points.length) return null;
  const fls = [...new Set(points.flatMap((p) => Object.keys(p.byFl).map(Number)))].sort((a, b) => b - a);
  return { fls, isa, points, line: lines[start].n };
}
