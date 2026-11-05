// CRZ WIND: 지점 × FL 바람·기온 표 (OFP "WIND AND TEMPERATURE SUMMARY")
// 계획 FL 칸 = 테두리, 그 지점에서 성분이 가장 좋은(배풍 최대) FL = 초록
import { Fragment } from 'react';
import { formatZ } from '../../../lib/time';
import type { OfpData } from '../types';
import { DocSection } from './ui';

const sgn = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`;
const pad3 = (n: number) => String(n).padStart(3, '0');

export function CrzWind({ o }: { o: OfpData }) {
  const w = o.crzWind;
  if (!w) {
    return (
      <DocSection title="CRZ WIND" className="span-all">
        <p className="muted small">이 OFP에는 FL별 바람·기온 요약이 없습니다.</p>
      </DocSection>
    );
  }
  const routeBy = new Map(o.route.map((r) => [r.name, r]));
  return (
    <DocSection title="CRZ WIND · 바람/기온" meta={`${w.points.length} PTS · FL${w.fls[w.fls.length - 1]}–${w.fls[0]}`} className="span-all flush-doc">
      <div className="table-wrap navwrap">
        <table className="dt nav crzw">
          <thead>
            <tr>
              <th className="sticky">WPT</th>
              {w.fls.map((fl) => (
                <th key={fl} className="c">
                  FL{fl}
                  <div className="isa">ISA {w.isa[fl]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {w.points.map((p) => {
              const r = routeBy.get(p.name);
              const cells = Object.entries(p.byFl).map(([fl, c]) => ({ fl: Number(fl), c }));
              const best = cells.length ? Math.max(...cells.map((x) => x.c.comp)) : NaN;
              return (
                <Fragment key={p.name}>
                  <tr>
                    <td className="sticky">
                      <div className="mono strong">{p.name}</div>
                      <div className="wpt-sub">{r ? `${formatZ(r.eto)} · ${r.flText && !/^\d+$/.test(r.flText) ? r.flText : `FL${r.fl}`}` : ''}</div>
                    </td>
                    {w.fls.map((fl) => {
                      const c = p.byFl[fl];
                      if (!c) return <td key={fl} className="c muted">·</td>;
                      const planned = r?.fl === fl;
                      const isBest = c.comp === best && cells.length > 1;
                      return (
                        <td key={fl} className={`c wcell ${planned ? 'planned' : ''} ${isBest ? 'best' : ''}`}>
                          <div className="mono">
                            {pad3(c.dir)}/{pad3(c.spd)}
                          </div>
                          <div className="wsub mono">
                            <span className={c.comp < 0 ? 'c-caution' : ''}>{sgn(c.comp)}</span> <span className="muted">{sgn(c.temp)}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="doc-foot">
        칸: 풍향/풍속 · 성분(+배풍/−정풍) · 기온 &nbsp;|&nbsp; <span className="legend planned">계획 FL</span> <span className="legend best">성분 최대 FL</span>
      </p>
    </DocSection>
  );
}
