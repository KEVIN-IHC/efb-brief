import { describe, expect, it } from 'vitest';
import { formatAgo, formatZ } from './time';

describe('time', () => {
  const now = Date.parse('2026-11-05T05:30:00Z');
  it('formatAgo', () => {
    expect(formatAgo('2026-11-05T03:16:00Z', now)).toBe('2h 14m ago');
    expect(formatAgo('2026-11-05T05:29:30Z', now)).toBe('just now');
    expect(formatAgo('2026-11-05T05:05:00Z', now)).toBe('25m ago');
    expect(formatAgo('2026-11-03T03:30:00Z', now)).toBe('2d 2h ago');
    expect(formatAgo(null, now)).toBe('—');
  });
  it('formatZ', () => {
    expect(formatZ('2026-11-05T03:12:00Z')).toBe('0312Z');
  });
});
