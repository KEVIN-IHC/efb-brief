const nf = new Intl.NumberFormat('en-US');

/** 106400 → "106,400" */
export const fmtKg = (n: number | null | undefined) => (n == null ? '—' : nf.format(Math.round(n)));

/** +1,200 / −350 */
export const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${nf.format(Math.abs(Math.round(n)))}`;

/** 615 → "10:15" */
export const fmtHm = (min: number | null | undefined) => {
  if (min == null) return '—';
  const m = Math.round(min);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

/** 270, 95 → "270/095" */
export const fmtWind = (dir: number, spd: number) => `${String(Math.round(dir)).padStart(3, '0')}/${String(Math.round(spd)).padStart(3, '0')}`;

/** 350 → "FL350", 0 → "—" */
export const fmtFl = (fl: number) => (fl > 0 ? `FL${String(fl).padStart(3, '0')}` : '—');

export const fmtTemp = (c: number) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c)}`;
