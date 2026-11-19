// 공항 → 브리핑에서 말하는 한국어 도시 이름 (D-086). 없으면 ICAO 그대로. 공개 정보만
export const CITY_KO: Record<string, string> = {
  RKSI: '인천', RKSS: '김포', RKPC: '제주', RKPK: '부산', RKTU: '청주', RKTN: '대구', RKJB: '무안',
  RJAA: '도쿄 나리타', RJTT: '도쿄 하네다', RJBB: '오사카', RJGG: '나고야', RJFF: '후쿠오카', RJCC: '삿포로', RJSS: '센다이', ROAH: '오키나와', RORS: '시모지',
  RCTP: '타이베이', VHHH: '홍콩', VMMC: '마카오', ZBAA: '베이징', ZBAD: '베이징 다싱', ZSPD: '상하이 푸둥', ZSSS: '상하이 훙차오', ZGGG: '광저우', ZUUU: '청두', ZYTX: '선양',
  WSSS: '싱가포르', VTBS: '방콕', VVTS: '호찌민', VVNB: '하노이', VVDN: '다낭', RPLL: '마닐라', RPVM: '세부', WADD: '발리', WIII: '자카르타', WMKK: '쿠알라룸푸르', VDPP: '프놈펜',
  VIDP: '델리', VABB: '뭄바이', OMDB: '두바이', OTHH: '도하', LTFM: '이스탄불', UUEE: '모스크바', UTTT: '타슈켄트', UAAA: '알마티',
  EDDF: '프랑크푸르트', EDDM: '뮌헨', LFPG: '파리', EGLL: '런던', LIRF: '로마', LIMC: '밀라노', LEBL: '바르셀로나', LEMD: '마드리드', LOWW: '빈', LKPR: '프라하', EHAM: '암스테르담', LSZH: '취리히', LHBP: '부다페스트', LPPT: '리스본',
  KLAX: '로스앤젤레스', KSFO: '샌프란시스코', KJFK: '뉴욕', KEWR: '뉴어크', KSEA: '시애틀', KORD: '시카고', KATL: '애틀랜타', KDFW: '댈러스', KIAD: '워싱턴', KBOS: '보스턴', KLAS: '라스베이거스', KONT: '온타리오', KSAN: '샌디에이고', KPDX: '포틀랜드', KSJC: '산호세', KOAK: '오클랜드',
  PANC: '앵커리지', PHNL: '호놀룰루', PGUM: '괌', PGSN: '사이판', PMDY: '미드웨이', PKWA: '콰잘레인', PWAK: '웨이크',
  CYVR: '밴쿠버', CYYZ: '토론토',
  YSSY: '시드니', YMML: '멜버른', YBBN: '브리즈번', YBCG: '골드코스트', YBCS: '케언스', YPPH: '퍼스', NZAA: '오클랜드', AYPY: '포트모르즈비',
};
export const cityKo = (icao: string | undefined) => (icao ? (CITY_KO[icao] ?? icao) : undefined);
