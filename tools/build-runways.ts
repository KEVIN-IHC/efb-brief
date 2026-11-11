// 개발용: 활주로 공개 자료 생성 (인터넷 필요, 결과물 public/geo/runways.json — 커밋 가능한 공개 자료)
// 사용: npx vite-node tools/build-runways.ts
//  - OurAirports runways.csv (퍼블릭 도메인) → public/geo/airports.json 에 있는 공항만
//  - 활주로 양 끝 번호·진방위(°T)·길이·폭(ft)·조명 여부. 닫힌 활주로는 뺌
//  - 바람 성분 계산용 (D-050). 길이·폭은 OFP NOTAM의 "1. RUNWAY" 줄이 있으면 그쪽이 우선
import { readFileSync, writeFileSync } from 'node:fs';

const RW = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/runways.csv';
const OUT = 'public/geo/runways.json';

/** 따옴표 안 쉼표를 지키는 CSV 한 줄 나누기 */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const num = (s: string): number | null => {
  const n = Number(s);
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
};

async function main() {
  const airports = JSON.parse(readFileSync('public/geo/airports.json', 'utf8')).airports as Record<string, unknown>;
  const res = await fetch(RW);
  if (!res.ok) throw new Error(`runways.csv HTTP ${res.status}`);
  const lines = (await res.text()).split(/\r?\n/);
  const head = splitCsv(lines[0]);
  const col = (n: string) => head.indexOf(n);
  const C = {
    ident: col('airport_ident'),
    len: col('length_ft'),
    wid: col('width_ft'),
    lighted: col('lighted'),
    closed: col('closed'),
    le: col('le_ident'),
    leH: col('le_heading_degT'),
    he: col('he_ident'),
    heH: col('he_heading_degT'),
  };
  // icao → [leIdent, heIdent, leHdgT, heHdgT, lenFt, widthFt, lighted(0/1)]
  const out: Record<string, (string | number | null)[][]> = {};
  let n = 0;
  for (const l of lines.slice(1)) {
    if (!l.trim()) continue;
    const r = splitCsv(l);
    const icao = r[C.ident];
    if (!airports[icao] || r[C.closed] === '1') continue;
    const le = r[C.le]?.trim();
    const he = r[C.he]?.trim();
    if (!le || !/^\d{1,2}[LRC]?$/.test(le)) continue;
    let leH = num(r[C.leH]);
    let heH = num(r[C.heH]);
    if (leH == null && heH != null) leH = (heH + 180) % 360;
    if (heH == null && leH != null) heH = (leH + 180) % 360;
    (out[icao] ??= []).push([le, he || null, leH == null ? null : Math.round(leH), heH == null ? null : Math.round(heH), num(r[C.len]), num(r[C.wid]), r[C.lighted] === '1' ? 1 : 0]);
    n++;
  }
  writeFileSync(OUT, JSON.stringify({ source: 'OurAirports (Public Domain)', builtAt: new Date().toISOString().slice(0, 10), fields: ['le', 'he', 'leHdgT', 'heHdgT', 'lenFt', 'widthFt', 'lighted'], runways: out }));
  console.log(`runways.json: 공항 ${Object.keys(out).length}개 · 활주로 ${n}개`);
}

void main();
