// 얼러트 엔진: 규칙 실행 → 중복 제거 → 심각도순 (원본 명세 §13, D-046)
import type { Alert, AlertRule, FlightContext, Severity } from './types';

export const SEVERITY_ORDER: Record<Severity, number> = { warning: 0, caution: 1, info: 2 };

export function evaluateAlerts(ctx: FlightContext, rules: AlertRule[]): Alert[] {
  const seen = new Map<string, Alert>();
  rules.forEach((r) => {
    let res;
    try {
      res = r.evaluate(ctx);
    } catch (e) {
      // 규칙 하나가 실패해도 나머지는 계속, 실패는 숨기지 않고 보인다
      res = [{ key: 'error', severity: 'info' as const, title: `규칙 실행 오류: ${r.name}`, detail: e instanceof Error ? e.message : String(e), basis: [{ kind: 'app' as const, label: '앱 내부 오류 — 이 규칙의 판단 없음' }] }];
    }
    for (const a of res) {
      const basis = a.basis.length ? a.basis : [{ kind: 'app' as const, label: '근거 누락 — 규칙 수정 필요' }];
      const id = `${r.id}:${a.key}:${a.severity}`;
      if (!seen.has(id)) seen.set(id, { ...a, basis, id, ruleId: r.id, ruleName: r.name, threshold: r.threshold });
    }
  });
  const order = new Map(rules.map((r, i) => [r.id, i]));
  return [...seen.values()].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || order.get(a.ruleId)! - order.get(b.ruleId)!);
}
