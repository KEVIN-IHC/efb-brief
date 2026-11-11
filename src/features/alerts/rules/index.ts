// 규칙 목록 — 파일 하나에 규칙 하나 (원본 명세 §13.1). 새 규칙은 여기 추가
import type { AlertRule } from '../types';
import { briefRules } from './briefRules';
import { cdlPerformance } from './cdlPerformance';
import { fuelProjection } from './fuelProjection';
import { melIcingSigmet } from './melIcingSigmet';
import { melOps } from './melOps';
import { melUnmatched } from './melUnmatched';
import { planMargins } from './planMargins';
import { sigmetRoute } from './sigmetRoute';
import { turbulenceSr } from './turbulence';
import { wxStale } from './wxStale';

export const RULES: AlertRule[] = [fuelProjection, planMargins, melIcingSigmet, cdlPerformance, sigmetRoute, turbulenceSr, melUnmatched, wxStale, melOps, ...briefRules];
