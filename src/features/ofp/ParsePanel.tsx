import type { ExtractStatus, ParseResult } from './parser/types';

const EX_LABEL: Record<ExtractStatus, [string, string]> = {
  ok: ['추출됨', 'ok'],
  partial: ['일부', 'caution'],
  failed: ['실패', 'warning'],
  pending: ['규칙 미작성', 'muted'],
  missing: ['구간 없음', 'muted'],
};
const CHECK_LABEL = { pass: ['통과', 'ok'], fail: ['확인 필요', 'warning'], skip: ['건너뜀', 'muted'] } as const;

function Chip({ text, tone }: { text: string; tone: string }) {
  return <span className={`chip chip-${tone}`}>{text}</span>;
}

function LineLink({ n, onJump }: { n: number; onJump: (n: number) => void }) {
  return (
    <button className="linelink mono" onClick={() => onJump(n)} title="원문에서 보기">
      L{n}
    </button>
  );
}

/** Aviator 파서 결과: 구간 · 추출 항목 · 교차검증. 모든 값은 원문 줄로 이동 가능 */
export function ParsePanel({ r, onJump }: { r: ParseResult; onJump: (n: number) => void }) {
  const fieldRows = r.extractors.flatMap((e) => e.fields);
  return (
    <section className="card span-all parse-panel">
      <div className="card-title">
        <h3>자동 추출 결과</h3>
        <span className="muted small mono">
          {r.parserVersion} · {r.pageCount}p · {r.lineCount.toLocaleString()} lines
        </span>
      </div>

      <div className="parse-grid">
        <div>
          <h4>교차 검증</h4>
          <ul className="plist">
            {r.checks.map((c) => (
              <li key={c.id}>
                <div className="prow">
                  <span>{c.label}</span>
                  <Chip text={CHECK_LABEL[c.status][0]} tone={CHECK_LABEL[c.status][1]} />
                </div>
                <div className="small muted">
                  {c.detail} {c.lines.map((n) => <LineLink key={n} n={n} onJump={onJump} />)}
                </div>
              </li>
            ))}
          </ul>

          <h4>추출 항목</h4>
          <ul className="plist">
            {r.extractors.map((e) => (
              <li key={e.id}>
                <div className="prow">
                  <span>{e.label}</span>
                  <Chip text={EX_LABEL[e.status][0]} tone={EX_LABEL[e.status][1]} />
                </div>
                {e.message && <div className="small muted">{e.message}</div>}
              </li>
            ))}
          </ul>
        </div>

        <div>
          {fieldRows.length > 0 && (
            <>
              <h4>추출된 값</h4>
              <div className="table-wrap">
                <table className="tbl">
                  <tbody>
                    {fieldRows.map((f) => (
                      <tr key={f.path}>
                        <td className="muted small">{f.label}</td>
                        <td className="mono strong wrap">{String(f.value)}</td>
                        <td className="r">
                          <LineLink n={f.line} onJump={onJump} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h4>구간</h4>
          <ul className="plist">
            {r.sections.map((s) => (
              <li key={`${s.id}-${s.startLine}`} className={s.ignored ? 'dim' : ''}>
                <div className="prow">
                  <span>
                    {s.label} <span className="muted small mono">p{s.page}</span>
                  </span>
                  <span className="prow-r">
                    {s.ignored ? <Chip text="제외" tone="muted" /> : !s.verified && <Chip text="샘플 확인 전" tone="caution" />}
                    <LineLink n={s.startLine} onJump={onJump} />
                  </span>
                </div>
                <div className="small muted mono">
                  L{s.startLine}–L{s.endLine}
                </div>
              </li>
            ))}
            {r.missingSections.map((d) => (
              <li key={d.id} className="dim">
                <div className="prow">
                  <span>{d.label}</span>
                  <Chip text="못 찾음" tone="muted" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="muted small">
        ‘샘플 확인 전’ 구간은 참고 분석 기준 표시 문자열로 찾은 것입니다. 회사 OFP 샘플로 확인한 뒤 확정합니다.
      </p>
    </section>
  );
}
