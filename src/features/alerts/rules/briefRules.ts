// 브리핑 판정(D-049~D-054)을 얼러트로: 묶음마다 규칙 하나. 판정 자체는 features/brief/assess.ts
import type { Group } from '../../brief/assess';
import type { AlertRule } from '../types';

const GROUPS: { g: Group; name: string; threshold: AlertRule['threshold'] }[] = [
  { g: 'minima', name: '회사 기상 최저치', threshold: 'manual' },
  { g: 'facility', name: 'NOTAM 시설·소방', threshold: 'manual' },
  { g: 'wind', name: '바람·활주로 상태', threshold: 'manual' },
  { g: 'airport', name: '특수공항·공항 제한', threshold: 'manual' },
  { g: 'hazard', name: '위험 기상·저온 보정', threshold: 'manual' },
  { g: 'crew', name: 'Low Time·수습 조건', threshold: 'manual' },
  { g: 'ops', name: '운항 통보·MEL 항로 요건', threshold: 'manual' },
];

export const briefRules: AlertRule[] = GROUPS.map(({ g, name, threshold }) => ({
  id: `brief-${g}`,
  name,
  threshold,
  evaluate: ({ brief }) =>
    (brief?.findings ?? [])
      .filter((f) => f.group === g && !f.briefOnly)
      .map((f) => ({ key: f.key, severity: f.severity, title: f.title, detail: f.detail, basis: f.basis })),
}));
