import { describe, expect, it } from 'vitest';
import { COMPANIES, DAEMONS, growthOf, needsStartChoice, newRunState, offerDaemons, quota, type DaemonId, type Entry } from './roguelike';

const runner = (Object.keys(DAEMONS) as DaemonId[]).filter((id) => DAEMONS[id].family === 'Runner');

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

  it('a fixed family offers only that family', () => {
    withEntry({ family: 'Runner', offer: 4 }, (s) => {
      expect(needsStartChoice(s)).toBeUndefined();
      const o = offerDaemons(s);
      expect(o.length).toBe(4);
      for (const id of o) expect(DAEMONS[id].family).toBe('Runner');
    });
  });

  it('a family offer refills from the last offer when the family runs short', () => {
    withEntry({ family: 'Runner', offer: 4 }, (s) => {
      s.daemons = runner.slice(3);
      s.lastOffer = runner.slice(0, 2);
      const o = offerDaemons(s);
      expect(o.length).toBe(3);
      expect(o.every(Boolean)).toBe(true);
      expect(o.some((id) => s.daemons.includes(id))).toBe(false);
      expect(o).toEqual(expect.arrayContaining(runner.slice(0, 2)));
    });
  });

  it('an old save family is ignored', () => {
    withEntry({ family: 'Runner' }, (s) => {
      Object.assign(s, { family: 'Ghost' });
      for (const id of offerDaemons(s)) expect(DAEMONS[id].family).toBe('Runner');
    });
  });
});
