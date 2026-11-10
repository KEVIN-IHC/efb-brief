// NOTAM 분류·해석의 근거 문서 (D-030). 화면의 "근거"에 이 목록의 id를 단다.
// 조항 번호는 2차 자료로 확인한 것만 적는다 — 확인 안 된 것은 checked: false 로 두고 화면에 "원문 대조 필요" 표시.

export type RefId = 'pansAim' | 'doc8400Abbr' | 'doc8400Qcode' | 'faa7930' | 'ofp' | 'company';

export interface RefDoc {
  id: RefId;
  short: string;
  title: string;
  where: string; // 문서 안 위치
  checked: boolean;
  note?: string;
}

export const REFS: Record<RefId, RefDoc> = {
  pansAim: {
    id: 'pansAim',
    short: 'PANS-AIM',
    title: 'ICAO Doc 10066 PANS-AIM (항공정보관리 절차)',
    where: 'Appendix 3 NOTAM Format — 항목 A) 위치 · B) 시작 · C) 종료 · D) 시간표 · E) 본문 · F) 하한 · G) 상한',
    checked: true,
    note: '구 Annex 15 Appendix 6. 항목 정의는 ICAO·FAA·EASA 공개 자료로 확인, 최신판 원문 대조 권장',
  },
  doc8400Abbr: {
    id: 'doc8400Abbr',
    short: 'Doc 8400 약어',
    title: 'ICAO Doc 8400 PANS-ABC (약어·부호)',
    where: 'Part 1 약어 (CLSD, U/S, AVBL, ACT, WIP, OBST, DTHR, RAIM 등)',
    checked: false,
    note: '약어 뜻은 널리 쓰이는 정의 — Doc 8400 원문 대조 전',
  },
  doc8400Qcode: {
    id: 'doc8400Qcode',
    short: 'NOTAM Code',
    title: 'ICAO Doc 8400 PANS-ABC — NOTAM Code (Q-code)',
    where: '주제 그룹(2번째 글자): A 공역 구성 · C 통신·레이더 · F 시설·업무 · I ILS/MLS · L 조명 · M 이동·착륙 지역 · N 터미널·항로 항법시설 · O 기타 · P 항공교통 절차 · R 공역 제한 · S 항공교통·VOLMET · W 항행 경고',
    checked: true,
    note: 'OFP에는 Q) 줄이 없어 Q-code를 읽은 것이 아님 — OFP 제목을 이 그룹에 대응시킨 것은 앱의 해석. GNSS(G) 그룹은 원문 대조 전',
  },
  faa7930: {
    id: 'faa7930',
    short: 'FAA JO 7930.2',
    title: 'FAA Order JO 7930.2 Notices to Air Missions',
    where: '미국 NOTAM 약어 (OTS 사용 중지, UNUSBL 사용 불가)',
    checked: false,
    note: '미국 국내 NOTAM 용어 — 원문 대조 전',
  },
  ofp: {
    id: 'ofp',
    short: 'OFP 원문',
    title: 'OFP NOTAM PACKAGE (Jeppesen Aviator 출력)',
    where: '분류 제목(◼ …)과 머리 줄 — 원문 줄 번호로 표시',
    checked: true,
  },
  company: {
    id: 'company',
    short: '회사 자료',
    title: '회사 권고 (COMPANY ADVISORY · COAD · COMMENT)',
    where: '당국 NOTAM이 아님 — 회사가 OFP에 덧붙인 정보',
    checked: true,
  },
};
