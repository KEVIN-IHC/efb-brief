// 합동 브리핑 (D-083): 항목(문단) = 제목 + FOM 위치 + 원고 틀. 원고 틀은 사용자가 고칠 수 있고 기기에 저장
// 원고 틀 문법:  {편명} = OFP에서 자동 · [가|나|다] = 눌러서 고르기 · <음어> = 직접 쓰는 칸
// 항목 목록 우선순위: 사용자가 고친 목록(기기) → 회사 기준 파일의 preset → 코드의 기본 틀(GENERIC_ITEMS)
import type { AirportBrief, BriefResult } from '../brief/assess';
import { fmtCeil, fmtVis, fmtWind, type Cond } from '../brief/wx';
import { turbulenceZones } from '../ofp/turbulence';
import { cityKo } from './cities';
import type { OfpData } from '../ofp/types';

export interface JbItem {
  id: string;
  title: string;
  /** FOM 위치 (예: 12.2.10) */
  ref?: string;
  /** a = 모든 비행, b = 그날 첫 비행·승무원 교체 시 (FOM 6.1.2.3) */
  group: 'a' | 'b';
  text: string;
}

/** 비행마다 따로 저장하는 값 */
export interface JbState {
  /** 말했음 체크 시각 */
  checked?: Record<string, string>;
  /** 문단 넣기/빼기 (없으면 넣음) */
  off?: Record<string, boolean>;
  /** 고른 선택지 번호 — 키 `항목id:번호` */
  choice?: Record<string, number>;
  /** 직접 쓴 값 — 키 `항목id:번호` */
  input?: Record<string, string>;
  /** 난류 구간별 정도 0 Light · 1 Moderate · 2 Severe */
  turb?: Record<number, number>;
  /** b) 첫 비행·교체 문단 넣기 (기본 켬) */
  firstFlight?: boolean;
}

export const ITEMS_KEY = 'jointItems';
export const LAST_KEY = 'jointLast';
export const stateKey = (flightId: string) => `joint:${flightId}`;

export const TURB_LEVELS = ['약한(Light)', '보통(Moderate)', '심한(Severe)'];

/** 항공보안등급 (국토교통부 발령 5단계) */
const LEVELS = '[평시(GREEN)|관심(BLUE)|주의(YELLOW)|경계(ORANGE)|심각(RED)]';

/**
 * 코드에 두는 기본 틀 = 말하기용 문장 + OFP 자동 값 (공개 저장소 — 회사 매뉴얼의 절차·신호·수치 문장은 넣지 않음).
 * FOM에 맞춘 원고 preset은 회사 기준 파일(company-rules.json `jointBrief.items`, 비공개)에서 온다.
 */
export const GENERIC_ITEMS: JbItem[] = [
  {
    id: 'greet',
    title: '인사 · 비행 개요',
    group: 'a',
    text: '안녕하십니까, 오늘 {편명} 편 {출발도시}에서 {도착도시}까지 운항할 기장 <기장 이름>입니다. 비행시간은 {비행시간}, 순항고도는 {순항고도}, 출발 {출발시각}, 도착 예정 {도착시각}입니다. 연료 계획은 {계획방식}입니다.',
  },
  { id: 'security', title: '보안', group: 'a', text: `현재 항공보안등급은 ${LEVELS}입니다. 조종실 음어는 <음어>입니다.` },
  { id: 'wx', title: '기상 · 난류', group: 'a', text: '목적지 {도착도시} 날씨는 [양호합니다|다소 좋지 않습니다|확인 중입니다]. {목적지기상} {난류}' },
  { id: 'altn', title: '교체공항 · ERA', group: 'a', text: '{교체공항} {ERA}' },
  { id: 'service', title: '기내서비스', group: 'a', text: '기내서비스는 [난류 구간 전에 마쳐 주십시오|10,000피트 통과 후 시작해 주십시오|사무장님과 협의해 정하겠습니다].' },
  { id: 'pax', title: '승객', group: 'a', text: '예약 승객은 {승객}입니다. 특별 승객은 [없습니다|있습니다]. <특별 승객 메모>' },
  { id: 'cargo', title: '화물 · CIQ', group: 'a', text: '화물은 {화물}이고, 위험물은 [없습니다|있습니다]. 특별한 CIQ 절차는 [없습니다|있습니다]. <CIQ 메모>' },
  { id: 'cabinlog', title: '객실 결함', group: 'b', text: '객실 관련 정비 이월 항목: {객실결함}. 질문 있으십니까?' },
];

/** 예전 기본 틀(D-083 첫 배포·D-085) 문장 — 기기에 저장된 목록이 이것뿐이면(고친 게 없으면) 새 기본 틀/preset을 씀 */
const OLD_GENERIC_TEXTS = new Set([
  '{편명} {출발}→{도착}, 비행시간 {비행시간}, 순항고도 {순항고도}, 출발 {출발시각}, 도착 예정 {도착시각}. 연료 계획 {계획방식}.',
  `항공보안등급 ${LEVELS}. 음어 <음어>.`,
  '목적지 {도착} 날씨 [양호|불량|확인 중]. {난류}',
  '<서비스 시기>',
  '예약 승객 {승객}. <특별 승객>',
  '화물 {화물}. <CIQ>',
  '객실 관련 정비 이월 항목: {객실결함}.',
  '안녕하십니까, 오늘 {편명} 편 {출발}에서 {도착}까지 운항할 기장 <기장 이름>입니다. 비행시간은 {비행시간}, 순항고도는 {순항고도}, 출발 {출발시각}, 도착 예정 {도착시각}입니다. 연료 계획은 {계획방식}입니다.',
  '목적지 {도착} 날씨는 [양호합니다|다소 좋지 않습니다|확인 중입니다]. {목적지기상} {난류}',
]);
export function isOldGeneric(items: JbItem[]): boolean {
  // 예전 문장이 하나라도 있고, 나머지도 전부 (예전·지금) 기본 문장일 때만 — 지금 틀을 순서만 바꾼 목록은 그대로 둠
  return items.some((x) => OLD_GENERIC_TEXTS.has(x.text)) && items.every((x) => OLD_GENERIC_TEXTS.has(x.text) || GENERIC_ITEMS.some((g) => g.text === x.text));
}

/* ---------------- 원고 틀 나누기 ---------------- */

export type Seg =
  | { t: 'text'; v: string }
  | { t: 'auto'; key: string }
  | { t: 'choice'; n: number; opts: string[] }
  | { t: 'input'; n: number; label: string };

/** 원고 틀 → 조각. 선택지·입력 칸은 나온 순서대로 번호 */
export function parseTemplate(text: string): Seg[] {
  const out: Seg[] = [];
  let n = 0;
  const re = /\{([^{}]+)\}|\[([^[\]]*\|[^[\]]*)\]|<([^<>]+)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: 'auto', key: m[1].trim() });
    else if (m[2] !== undefined) out.push({ t: 'choice', n: n++, opts: m[2].split('|').map((s) => s.trim()) });
    else out.push({ t: 'input', n: n++, label: m[3].trim() });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

/* ---------------- OFP에서 끌어오는 값 ---------------- */

export const AUTO_KEYS: { key: string; label: string }[] = [
  { key: '편명', label: 'DEMO001' },
  { key: '출발', label: '출발 ICAO' },
  { key: '도착', label: '도착 ICAO' },
  { key: '출발도시', label: '시드니' },
  { key: '도착도시', label: '인천' },
  { key: '기종', label: 'A388' },
  { key: '등록부호', label: 'HL0000' },
  { key: '비행시간', label: '9시간 24분' },
  { key: '출발시각', label: 'ETD Z' },
  { key: '도착시각', label: 'ETA Z' },
  { key: '순항고도', label: 'FL300–380' },
  { key: '계획방식', label: '3%·REFILE·EDTO' },
  { key: '승객', label: '예약 승객' },
  { key: '화물', label: 'CARGO LBS' },
  { key: '객실결함', label: '객실 관련 MEL' },
  { key: 'MEL', label: 'MEL/CDL 번호' },
  { key: '난류', label: 'SR 구간·시각·정도' },
  { key: '목적지기상', label: '목적지 ETA ±1h 예보 (문장)' },
  { key: '교체공항', label: '회항할 교체공항·기상 (문장)' },
  { key: 'ERA', label: 'ERA 공항·예상 시간대 기상 (문장)' },
];

const nf = new Intl.NumberFormat('en-US');
const z = (iso: string) => `${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
/** UTC ISO + 분 → 현지 HH:MM */
const localHm = (iso: string, off: number) => new Date(Date.parse(iso) + off * 60000).toISOString().slice(11, 16);
const hmKo = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}시간${m ? ` ${m}분` : ''}` : `${m}분`;
};

/** 객실에 영향 주는 MEL 장(ATA): 25 객실 설비 · 33 조명 · 35 산소 · 38 물·화장실 · 44 객실 시스템 */
const CABIN_ATA = /^(25|33|35|38|44)-/;

/** 계획 방식 글: 3% CONT · ERA KSFO / 5% CONT · REFILE RJAA·RJBB · EDTO 180 */
export function planText(o: OfpData): string {
  const p = o.header.plan;
  const parts: string[] = [];
  if (p?.contPct) parts.push(`${p.contPct}% Contingency${p.contPct === 3 && p.era3?.length ? `(3% ERA ${p.era3.join('·')})` : ''}`);
  if (p?.refile?.length) parts.push(`REFILE(${p.refile.join('·')})`);
  if (o.header.edtoRule || p?.edto) parts.push(o.header.edtoRule ?? 'EDTO');
  return parts.join(' · ') || '기본 계획';
}

/** 승객 예약: "FIRST 0/0 BUSINESS 74/78 ECONOMY 344/417" → "비즈니스 74분, 이코노미 344분, 총 418분"
 *  앞 숫자 = 예약 인원 (뒤 숫자는 좌석 고장·좌석 수 변경·오버부킹으로 앞보다 작을 수 있어 브리핑에선 말하지 않음) */
export function paxText(pax: string | undefined): string | undefined {
  if (!pax) return undefined;
  const ko: Record<string, string> = { FIRST: '퍼스트', BUSINESS: '비즈니스', PRESTIGE: '비즈니스', ECONOMY: '이코노미' };
  const cls = [...pax.matchAll(/([A-Z]+)\s+(\d+)\/(\d+)/g)].filter((m) => Number(m[2]) > 0);
  if (!cls.length) return undefined;
  const total = cls.reduce((s, m) => s + Number(m[2]), 0);
  return `${cls.map((m) => `${ko[m[1]] ?? m[1]} ${nf.format(Number(m[2]))}분`).join(', ')}, 총 ${nf.format(total)}분`;
}

export interface TurbPart {
  i: number;
  text: string; // "이륙 후 약 2시간 15분(1310Z)부터 30분간"
}

/** OFP에서 자동으로 채우는 값. 없으면 undefined (화면에 "?"로) */
export function autoValues(o: OfpData | null): Record<string, string | undefined> {
  if (!o) return {};
  const h = o.header;
  const fls = [...new Set(o.route.map((r) => r.fl).filter((f) => f >= 100))].sort((a, b) => a - b);
  const cabin = o.mel.filter((m) => CABIN_ATA.test(m.itemNo)).map((m) => `${m.itemNo} ${m.title}`.trim());
  const cargo = /CARGO\s+([\d,]+)\s*LBS/.exec(o.cargo ?? '')?.[1];
  return {
    편명: h.flightNo,
    출발: h.dep,
    도착: h.arr,
    기종: h.acType,
    등록부호: h.reg,
    비행시간: h.airMin ? hmKo(h.airMin) : undefined,
    출발시각: h.takeoff ? z(h.takeoff) : undefined,
    도착시각: h.sta ? `${z(h.sta)}${h.arrUtcMin !== undefined ? `(현지 ${localHm(h.sta, h.arrUtcMin)})` : ''}` : undefined,
    출발도시: cityKo(h.dep),
    도착도시: cityKo(h.arr),
    순항고도: fls.length ? (fls.length > 1 ? `FL${fls[0]}에서 FL${fls[fls.length - 1]}까지` : `FL${fls[0]}`) : undefined,
    계획방식: planText(o),
    승객: paxText(o.pax),
    화물: cargo ? `${nf.format(Number(cargo.replace(/,/g, '')))} LBS` : undefined,
    객실결함: cabin.length ? cabin.join(', ') : '없음',
    MEL: o.mel.length ? o.mel.map((m) => `${m.kind} ${m.itemNo}`).join(', ') : '없음',
  };
}

/** {난류}: OFP SR 주의 구간 → 구간별 문장 조각 (정도는 화면에서 고름) */
export function turbParts(o: OfpData | null): TurbPart[] {
  if (!o) return [];
  return turbulenceZones(o.route).map((zn, i) => {
    const dur = Math.max(0, zn.to.cumMin - zn.from.cumMin);
    return { i, text: `이륙 후 약 ${hmKo(zn.from.cumMin)}(${z(zn.from.eto)})부터 ${dur ? `${hmKo(dur)}간` : '잠시'}` };
  });
}

/* ---------------- 기상 (Briefing 판정 결과에서) ---------------- */

const condKo = (c: Cond) => `바람 ${fmtWind(c)}, 시정 ${fmtVis(c.visM)}, 운고 ${fmtCeil(c.ceilFt)}${c.wx ? `, ${c.wx}` : ''}`;
const hm = (ms: number) => z(new Date(ms).toISOString());

/** 공항 한 곳: "RJBB 2140~2340Z 예보 바람 …, 일시적으로 … (TAF 1700Z 발표)". icao=false면 공항 코드 없이 */
export function airportWx(a: AirportBrief, icao = true): string {
  const head = icao ? `${a.icao} ` : '';
  const span = `${hm(a.window.from)}~${hm(a.window.to)}`;
  if (!a.taf && !a.base) return `${head}${span} 기상 자료 없음(기상 갱신 필요)`;
  const issued = a.taf?.issueTime ? ` (TAF ${z(a.taf.issueTime)} 발표)` : a.metar ? ` (METAR ${z(a.metar.obsTime)})` : '';
  const out = a.taf?.outside ? ', TAF 유효기간 밖' : '';
  return `${head}${span} 예보 ${a.base ? condKo(a.base) : '없음'}${a.taf?.temp ? `, 일시적으로 ${condKo(a.taf.temp)}` : ''}${out}${issued}`;
}

/** {목적지기상}·{교체공항}·{ERA}: 말하기용 문장 */
export function wxValues(b: BriefResult | null): Record<string, string | undefined> {
  if (!b) return {};
  const dest = b.airports.find((a) => a.roles.includes('DEST'));
  const altn = b.airports.filter((a) => a.roles.includes('ALTN'));
  const era = b.airports.filter((a) => a.roles.some((r) => r === '3% ERA' || r === 'EDTO' || r === 'ERA'));
  return {
    목적지기상: dest ? `도착 예정 앞뒤 1시간 ${airportWx(dest, false)}입니다.` : undefined,
    교체공항: altn.length
      ? `목적지에 내리지 못하면 ${altn.map((a) => a.icao).join(' 또는 ')}(으)로 회항합니다. ${altn.map((a) => airportWx(a)).join('. ')}입니다.`
      : 'OFP에 목적지 교체공항이 없습니다.',
    ERA: era.length ? `항로 교체공항(ERA)은 ${era.map((a) => a.icao).join(', ')}입니다. ${era.map((a) => airportWx(a)).join('. ')}입니다.` : '항로 교체공항(ERA)은 없습니다.',
  };
}

/** 원고 한 문단을 글로 (복사용) */
export function renderText(item: JbItem, st: JbState, auto: Record<string, string | undefined>, turb: TurbPart[], last: Record<string, string> = {}): string {
  return parseTemplate(item.text)
    .map((s) => {
      if (s.t === 'text') return s.v;
      if (s.t === 'auto') {
        if (s.key === '난류') return turbSentence(turb, st);
        return auto[s.key] ?? `[${s.key}?]`;
      }
      if (s.t === 'choice') return s.opts[st.choice?.[`${item.id}:${s.n}`] ?? 0] ?? '';
      return st.input?.[`${item.id}:${s.n}`] ?? last[s.label] ?? '';
    })
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function turbSentence(turb: TurbPart[], st: JbState): string {
  if (!turb.length) return 'OFP상 예상 난류 구간은 없습니다.';
  return `난류는 ${turb.map((p) => `${p.text} ${TURB_LEVELS[st.turb?.[p.i] ?? 0]} 정도`).join(', ')} 예상됩니다.`;
}

/** 이 비행에서 원고에 들어가는 항목 */
export function activeItems(items: JbItem[], st: JbState): JbItem[] {
  const first = st.firstFlight ?? true;
  return items.filter((it) => !st.off?.[it.id] && (it.group === 'a' || first));
}

