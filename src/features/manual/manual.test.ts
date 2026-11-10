// 매뉴얼 묶음 (D-044). 아래 MD는 변환 결과의 "형식"만 흉내 낸 가짜 문장이다 (회사 매뉴얼 원문 아님).
// 실제 매뉴얼 대조는 private/manuals 가 있을 때만 (커밋 안 됨).
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { _resetDBForTests } from '../../db/schema';
import { buildManualBundle, cleanLine, detectMeta, issueToIso, splitPages, validateBundle } from './parse';
import { deleteManual, findManualItems, listManuals, OlderRevisionError, readManualFile, saveManual } from './store';

const MEL_MD = (issue: string) => `###### _A999_

###### **MINIMUM EQUIPMENT LIST**

REFERENCE: XYZ A999 FLEET MEL

## **TRANSMITTAL LETTER** _A999_ **MINIMUM EQUIPMENT LIST** ~~— ee~~ **Issue date: ${issue}**

This is the Minimum Equipment List at issue date ${issue} for the A999 and replacing last issue dated 01 JAN 20

TRL P 1/1 ${issue}

XYZ A999 FLEET MEL

**MEL ITEMS 99 - TEST SYSTEMS** 99-10 - Widget _A999_ **MINIMUM EQUIPMENT LIST** ~~<u>— ee</u>~~

**99-10-01 Widget Lamp**

<mark>Ident.: MI-99-10-00000001.0001001 / 01 JAN 20</mark> **<mark>Applicable to: ALL</mark>**

###### **99-10-01A One lamp inoperative**

|Repair interval|Nbr installed|Nbr required|Placard|
|---|---|---|---|
|**C**|**2**|**1**|**Yes**|

- **(o)** One may be inoperative provided that the other lamp is checked.

_Continued on the following page_

MI-99-10 P 1/2

XYZ A999 FLEET MEL

A →

01 JAN 20

##### **MEL ITEMS 99 - TEST SYSTEMS** 99-10 - Widget _A999_ **MINIMUM EQUIPMENT LIST** ~~<u>—|</u>~~

_Continued from the previous page_

- **(o)** _Refer to OpsProc 99-10-01A Widget Lamp_

<!-- Start of picture text -->
99-10-02 Widget Fan<br><!-- End of picture text -->

###### **99-10-02A**

<!-- Start of picture text -->
Repair interval Nbr installed Nbr required Placard<br>D 1 0 Yes<br><!-- End of picture text -->

May be inoperative.

MI-99-10 P 2/2

XYZ A999 FLEET MEL

**MEL OPERATIONAL PROCEDURES** _A999_ **MINIMUM EQUIPMENT LIST**

99-10-01A Widget Lamp<br>Ident.: MO-99-10-00000002.0001001 / 01 JAN 20<br>

Check the remaining lamp before flight.

MO-99-10 P 1/1

XYZ A999 FLEET MEL
`;

const CDL_MD = `###### **CONFIGURATION DEVIATION LIST**

REFERENCE: XYZ A999 FLEET CDL

###### **Issue date: 05 MAR 21**

TRL P 1/1 05 MAR 21

XYZ A999 FLEET CDL

###### **TEST PANELS** _A999_ **CONFIGURATION DEVIATION LIST** ~~<u>— ee</u>~~ **12-34 Test access panel** <mark>Applicable to: ALL</mark>

**12-34 Quantity installed TEST ACCESS PANEL 4**

One may be missing.

- **<u>Performance:</u>** Fuel consumption is increased by 0.1 %.

12-34 P 1/2 05 MAR 21

XYZ A999 FLEET CDL

## **TEST PANELS** _A999_ **CONFIGURATION DEVIATION LIST ILLUSTRATION TEST ACCESS PANEL**

For dispatch conditions : _Refer to 12-34 Test access panel_

12-34 P 2/2 05 MAR 21
`;

describe('매뉴얼 파서 (가짜 형식 샘플)', () => {
  it('발행일 변환', () => {
    expect(issueToIso('19 OCT 26')).toBe('2026-10-19');
    expect(issueToIso('5 JAN 2027')).toBe('2027-01-05');
    expect(issueToIso('XX')).toBeUndefined();
  });

  it('종류·기종·발행일·이전 발행일 — MD와 PDF 일반 글 모두', () => {
    const m = detectMeta(MEL_MD('19 OCT 26'), 'x/y/some_file.md');
    expect(m).toMatchObject({ docId: 'A999-MEL', kind: 'MEL', aircraft: 'A999', issueDate: '19 OCT 26', issueIso: '2026-10-19', replaces: '01 JAN 20' });
    const plain = 'REFERENCE: XYZ A999 FLEET FCOM\nA999\nFLIGHT CREW OPERATING MANUAL\nIssue date: 09 APR 26\n';
    expect(detectMeta(plain, 'a.pdf')).toMatchObject({ docId: 'A999-FCOM', kind: 'FCOM', issueIso: '2026-04-09' });
    expect(detectMeta('hello world', 'My Notes v2.md')).toMatchObject({ kind: 'OTHER', docId: 'MY-NOTES-V2' });
  });

  it('줄 정리: 취소선 잡음·mark·그림 표시 제거', () => {
    expect(cleanLine('**A** ~~<u>— ee</u>~~ <mark>Ident.: X</mark>')).toBe('**A** Ident.: X');
    expect(cleanLine('<!-- Start of picture text -->a<br>b<!-- End of picture text -->')).toBe('a ¦ b');
  });

  it('쪽 나누기: 쪽 표시가 경계·근거, 잡음 줄 제거, 머리 제목 분리', () => {
    const { pages } = splitPages(MEL_MD('19 OCT 26'));
    expect(pages.map((p) => p.ref)).toEqual(['TRL P 1/1', 'MI-99-10 P 1/2', 'MI-99-10 P 2/2', 'MO-99-10 P 1/1']);
    const p1 = pages[1];
    expect(p1.code).toBe('MI-99-10');
    expect(p1.header).toContain('MEL ITEMS 99 - TEST SYSTEMS');
    expect(p1.text).not.toMatch(/FLEET|Continued on/);
    expect(p1.text).toContain('99-10-01A One lamp inoperative');
    expect(p1.line).toBeGreaterThan(1);
  });

  it('MEL 하위 항목: 제목·수리 등급·수량·플래카드·운항 절차 쪽', () => {
    const b = buildManualBundle(MEL_MD('19 OCT 26'), 'mel.md');
    const a = b.items.find((i) => i.itemNo === '99-10-01A')!;
    expect(a).toMatchObject({ kind: 'MEL', parent: '99-10-01', title: 'One lamp inoperative', repairInterval: 'C', installed: '2', required: '1', placard: 'Yes', ref: 'MI-99-10 P 1/2' });
    expect(a.text).toContain('other lamp is checked');
    expect(a.text).toContain('Refer to OpsProc'); // 다음 쪽으로 이어진 본문
    expect(a.text).not.toContain('Repair interval');
    expect(b.pages[a.opsProcSeq!].ref).toBe('MO-99-10 P 1/1');
    // 그림 글 제목·표, 하나뿐인 하위 항목 → 상위 제목
    const f = b.items.find((i) => i.itemNo === '99-10-02A')!;
    expect(f).toMatchObject({ title: 'Widget Fan', repairInterval: 'D', installed: '1', required: '0', placard: 'Yes' });
    expect(b.items.find((i) => i.itemNo === '99-10-01')?.title).toBe('Widget Lamp');
    expect(b.meta).toMatchObject({ docId: 'A999-MEL', pageCount: 4, itemCount: b.items.length });
  });

  it('CDL: 쪽 표시 = 항목 번호, 같은 번호 쪽을 묶음', () => {
    const b = buildManualBundle(CDL_MD, 'cdl.md');
    expect(b.meta.docId).toBe('A999-CDL'); // 기종은 REFERENCE 줄에서
    const it = b.items.find((i) => i.itemNo === '12-34')!;
    expect(it.title).toBe('Test access panel');
    expect(it.text).toContain('Fuel consumption is increased');
    expect(it.text).toContain('For dispatch conditions');
    expect(b.items).toHaveLength(1);
  });

  it('묶음 검사', () => {
    expect(validateBundle(buildManualBundle(CDL_MD, 'c.md'))).toBeNull();
    expect(validateBundle({ format: 'x' })).toMatch(/아님/);
    expect(validateBundle({ format: 'efb-manual', formatVersion: 99, meta: { docId: 'a' }, pages: [], items: [] })).toMatch(/버전/);
  });
});

describe('매뉴얼 저장 (IndexedDB)', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetDBForTests();
  });

  it('가져오기 → 목록·번호 찾기, 새 개정은 교체, 이전 개정은 거절, 삭제', async () => {
    const r1 = await saveManual(buildManualBundle(MEL_MD('01 FEB 26'), 'a.md'));
    expect(r1.replaced).toBeUndefined();
    expect((await findManualItems('99-10-01A'))[0]).toMatchObject({ docId: 'A999-MEL', repairInterval: 'C' });

    const r2 = await saveManual(buildManualBundle(MEL_MD('01 MAR 26'), 'b.md'));
    expect(r2.replaced?.issueDate).toBe('01 FEB 26');
    const docs = await listManuals();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ issueDate: '01 MAR 26', sourceFile: 'b.md' });
    expect(await findManualItems('99-10-01A')).toHaveLength(1); // 이전 개정 항목이 남지 않음

    await expect(saveManual(buildManualBundle(MEL_MD('01 JAN 26'), 'c.md'))).rejects.toBeInstanceOf(OlderRevisionError);
    await saveManual(buildManualBundle(MEL_MD('01 JAN 26'), 'c.md'), { allowOlder: true });
    expect((await listManuals())[0].issueDate).toBe('01 JAN 26');

    await deleteManual('A999-MEL');
    expect(await listManuals()).toHaveLength(0);
    expect(await findManualItems('99-10-01A')).toHaveLength(0);
  });

  it('파일 읽기: gzip 묶음 / JSON / MD / 엉뚱한 파일', async () => {
    const b = buildManualBundle(CDL_MD, 'c.md');
    const { gzipSync } = await import('node:zlib');
    const gz = new File([gzipSync(JSON.stringify(b))], 'A999-CDL.efbman.json.gz');
    expect((await readManualFile(gz)).meta.docId).toBe('A999-CDL');
    expect((await readManualFile(new File([JSON.stringify(b)], 'x.json'))).items).toHaveLength(1);
    expect((await readManualFile(new File([CDL_MD], 'cdl.md'))).meta.kind).toBe('CDL');
    await expect(readManualFile(new File(['%PDF-1.7'], 'a.pdf'))).rejects.toThrow(/아님/);
  });
});

// marker 변환 형식 흉내 (쪽 표시 없음, 번호 제목, span 쪽 번호) — 가짜 문장
const FOM_MD = `# 가상 운영 교범 Flight Operations Manual

Copyright 가상

# 제 1 장 일반

#### <span id="page-9-0"></span>1.1 개요

개요 문장 [\\[FOM 1.2\\]](#page-10-0) 참조.

#### a) 하위 제목

하위 문장.

#### 1.2 연료 점검

연료 점검 문장. ![](_page_10_Picture_1.jpeg)

# **Flight Crew Reference Manual**

# 제 1 장 OPERATIONAL INFORMATION

### 1.2 SMGCS

참고 문장.
`;

describe('절 단위 매뉴얼 (marker 변환 형식)', () => {
  it('파일 이름의 종류·개정·날짜, 기종 없음', () => {
    expect(detectMeta(FOM_MD, 'X(KOR)_FOM(R12-1_20261020)_FCRM(R05_20260901).md')).toMatchObject({ docId: 'GEN-FOM', kind: 'FOM', aircraft: undefined, revision: 'R12-1', issueDate: '20 OCT 26', issueIso: '2026-10-20' });
  });

  it('번호 제목마다 한 덩어리, FCRM 구분, 쪽 번호(span·목차 json), 그림·링크 정리', () => {
    const toc = [{ title: '1.2 연료 점검', page_id: 10 }, { title: '1.2 SMGCS', page_id: 30 }];
    const b = buildManualBundle(FOM_MD, 'X_FOM(R12_20261020).md', new Date(), { toc });
    expect(b.meta.splitMode).toBe('section');
    const codes = b.pages.map((p) => p.code);
    expect(codes).toEqual([undefined, undefined, 'FOM-1.1', 'FOM-1.2', undefined, 'FCRM-1.2']);
    const p11 = b.pages.find((p) => p.code === 'FOM-1.1')!;
    expect(p11).toMatchObject({ ref: 'FOM 1.1 · p.10', pdfPage: 10 });
    expect(p11.header).toBe('제 1 장 일반 › 1.1 개요');
    expect(p11.text).toContain('하위 문장'); // 번호 없는 제목은 안에
    expect(p11.text).toContain('[FOM 1.2]');
    expect(b.pages.find((p) => p.code === 'FOM-1.2')!.text).toContain('[그림]');
    expect(b.pages.find((p) => p.code === 'FCRM-1.2')!.ref).toBe('FCRM 1.2 · p.31');
  });

  it('절 번호 참조·바로가기', async () => {
    const { findRefs, directKey } = await import('./lookup');
    expect(findRefs('개요 [FOM 1.2] 참조').map((r) => r.key)).toEqual(['code:FOM-1.2']);
    expect(directKey('fom 6.5.3.1')).toBe('code:FOM-6.5.3.1');
    expect(directKey('5.13.5.3')).toBe('sec:5.13.5.3');
  });
});

// ---- 실제 매뉴얼 (private/manuals/inbox, 커밋 안 됨) ----
const DIR = join(__dirname, '../../../private/manuals/inbox');
const real = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.md')) : [];
const realMel = real.find((f) => /MEL/i.test(f));

describe.skipIf(!realMel)('실제 MEL (private)', () => {
  it('하위 항목 번호 거의 전부 추출, OFP 샘플에 나온 번호 매칭', () => {
    const md = readFileSync(join(DIR, realMel!), 'utf8');
    const b = buildManualBundle(md, realMel!);
    const inMd = new Set([...md.matchAll(/^#{0,6}\s*\*\*(\d{2}-\d{2}-\d{2}[A-Z])/gm)].map((m) => m[1]));
    const subs = b.items.filter((i) => i.parent);
    expect(subs.length / inMd.size).toBeGreaterThan(0.99);
    expect(subs.filter((i) => i.repairInterval).length / subs.length).toBeGreaterThan(0.95);
    // 실제 OFP 샘플(private/samples)의 MEL 번호가 매뉴얼에서 찾아지는지 — 번호를 코드에 적지 않음
    const SAMPLES = join(__dirname, '../../../private/samples');
    const ofpNos = existsSync(SAMPLES)
      ? [...new Set(readdirSync(SAMPLES).filter((f) => f.endsWith('.txt')).flatMap((f) => [...readFileSync(join(SAMPLES, f), 'utf8').matchAll(/^\s*-\s*MEL\s+(\d{2}-\d{2}-\d{2}[A-Z])\s*:/gm)].map((m) => m[1])))]
      : [];
    for (const no of ofpNos) {
      const it = b.items.find((i) => i.itemNo === no);
      expect(it, no).toBeDefined();
      expect(it!.title.length, no).toBeGreaterThan(3);
      expect(it!.ref, no).toMatch(/^MI-\d{2}-\d{2} P \d+\/\d+$/);
    }
  });
});

describe('매뉴얼 찾기 (2단계)', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetDBForTests();
  });

  it('기종 코드 변환', async () => {
    const { manualAircraft } = await import('./lookup');
    expect(manualAircraft('A388')).toBe('A380');
    expect(manualAircraft('B78X')).toBe('B787');
    expect(manualAircraft(undefined)).toBeUndefined();
  });

  it('OFP MEL/CDL 번호 매칭: 정확·상위 항목·없음, 기종 우선', async () => {
    const { matchMelItem } = await import('./lookup');
    await saveManual(buildManualBundle(MEL_MD('01 MAR 26'), 'm.md'));
    await saveManual(buildManualBundle(CDL_MD, 'c.md'));
    const docs = await listManuals();
    const items = [...(await findManualItems('99-10-01A')), ...(await findManualItems('99-10-01')), ...(await findManualItems('12-34'))];
    const a = matchMelItem({ kind: 'MEL', itemNo: '99-10-01A' }, items, docs, 'A999');
    expect(a).toMatchObject({ how: 'exact', aircraftOk: true });
    expect(a.item?.repairInterval).toBe('C');
    expect(a.parent?.itemNo).toBe('99-10-01');
    expect(matchMelItem({ kind: 'MEL', itemNo: '99-10-01C' }, items, docs, 'A999')).toMatchObject({ how: 'parent' });
    expect(matchMelItem({ kind: 'MEL', itemNo: '11-11-11A' }, items, docs, 'A999').how).toBe('none');
    expect(matchMelItem({ kind: 'CDL', itemNo: '12-34' }, items, docs, 'B787')).toMatchObject({ how: 'exact', aircraftOk: false });
    expect(matchMelItem({ kind: 'MEL', itemNo: '12-34' }, items, docs, 'A999').how).toBe('none'); // 종류가 다르면 매칭 안 함
  });

  it('항목 표시: (o)·(m)·Crew Defer 등 원문 문구만', async () => {
    const { itemFlags } = await import('./lookup');
    const f = itemFlags('- **(o)** x\n_Note:_ **_Crew Defer_**\n- **(m)** y\nFuel consumption is increased by 0.4 %.');
    expect(f.ops).toBe(true);
    expect(f.maint).toBe(true);
    expect(f.notes).toEqual(['Crew Defer', 'Fuel consumption is increased by 0.4 %']);
  });

  it('참조 찾기·이동: OpsProc·Item·쪽 코드·CDL', async () => {
    const { findRefs, resolveRef, directKey } = await import('./lookup');
    expect(findRefs('Refer to OpsProc 99-10-01A Widget').map((r) => r.key)).toEqual(['ops:99-10-01A']);
    expect(findRefs('_Refer to DSC-34-20-30-20 GAIN Knob_').map((r) => r.key)).toEqual(['code:DSC-34-20-30-20']);
    expect(findRefs('Refer to Item 99-10-01 x').map((r) => r.key)).toEqual(['item:99-10-01']);
    const cdl = findRefs('For dispatch conditions : Refer to 12-34 Test');
    expect(cdl.map((r) => [r.key, r.text])).toEqual([['cdl:12-34', '12-34']]);
    expect(directKey('36-11-01b')).toBe('item:36-11-01B');
    expect(directKey('27-22')).toBe('cdl:27-22');
    expect(directKey('dsc-21-10')).toBe('code:DSC-21-10');
    expect(directKey('engine bleed')).toBeNull();

    await saveManual(buildManualBundle(MEL_MD('01 MAR 26'), 'm.md'));
    const docs = await listManuals();
    const b = buildManualBundle(MEL_MD('01 MAR 26'), 'm.md');
    expect(await resolveRef('ops:99-10-01A', 'A999-MEL', docs)).toEqual({ docId: 'A999-MEL', seq: b.pages.find((p) => p.code === 'MO-99-10')!.seq, mark: '99-10-01A' });
    expect(await resolveRef('code:MI-99-10', 'A999-MEL', docs)).toEqual({ docId: 'A999-MEL', seq: 1 });
    expect(await resolveRef('code:MI-99', 'A999-MEL', docs)).toEqual({ docId: 'A999-MEL', seq: 1 }); // 앞부분 일치
    expect(await resolveRef('code:DSC-1', 'A999-MEL', docs)).toBeNull();
  });

  it('검색: 모든 낱말(AND)·구절·머리 제목 가산·발췌', async () => {
    const { searchPages } = await import('./lookup');
    const b = buildManualBundle(MEL_MD('01 MAR 26'), 'm.md');
    const pages = b.pages.map((p) => ({ ...p, docId: 'X' }));
    const h = searchPages(pages, 'lamp checked');
    expect(h.map((x) => x.ref)).toEqual(['MI-99-10 P 1/2']);
    expect(h[0].snippet).toMatch(/lamp/i);
    expect(searchPages(pages, '"remaining lamp"').map((x) => x.ref)).toEqual(['MO-99-10 P 1/1']);
    expect(searchPages(pages, 'lamp zebra')).toHaveLength(0);
    expect(searchPages(pages, 'x')).toHaveLength(0); // 한 글자는 무시
  });
});
