import { describe, expect, it } from 'vitest';
import { COMPANIES, growthOf, newRunState, quota, type Entry } from './roguelike';

// Runs fn on a throwaway entry added to company 0, removed afterwards.
function withEntry(extra: Partial<Entry>, fn: (s: ReturnType<typeof newRunState>) => void) {
  const list = COMPANIES[0].entries;
  list.push({ id: 'test', name: 'Test', plus: '', minus: '', ...extra });
  try { fn(newRunState(1, 0, 'test')); } finally { list.pop(); }
}

describe('entry challenge fields', () => {
  it('quotaGrowth raises iterations 2 and 3 only', () => {
    withEntry({ quotaGrowth: 3 }, (s) => {
      expect(quota(s, 0)).toBe(quota(newRunState(1), 0));
      s.loop = 2;
      expect(quota(s, 0)).toBe(Math.round((COMPANIES[0].sections[0].quota * 9) / 5) * 5);
      expect(growthOf(s)).toBe(3);
    });
    expect(growthOf(newRunState(1))).toBe(2.5);
  });
});
