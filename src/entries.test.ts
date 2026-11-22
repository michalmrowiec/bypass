import { describe, expect, it } from 'vitest';
import { canSell, leadsBonus, rarityOf, COMPANIES, DAEMONS, forSale, growthOf, sell, stockShop, needsStartChoice, newRunState, offerDaemons, quota, type DaemonId, type Entry, type ItemId } from './roguelike';

const runner = (Object.keys(DAEMONS) as DaemonId[]).filter((id) => DAEMONS[id].family === 'Runner');

// Runs fn on a throwaway entry added to company 0, removed afterwards.
function withEntry(extra: Partial<Entry>, fn: (s: ReturnType<typeof newRunState>) => void) {
  const list = COMPANIES[0].entries;
  list.push({ id: 'test', name: 'Test', traits: [], ...extra });
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

  it('noSell true blocks every sale', () => {
    withEntry({ noSell: true }, (s) => {
      s.items = ['thumb'];
      const cash = s.credits;
      expect(sell(s, 'thumb')).toBe(false);
      expect([s.items, s.credits]).toEqual([['thumb'], cash]);
    });
  });

  it('a noSell list covers the whole item line', () => {
    withEntry({ noSell: ['linker1'] }, (s) => {
      s.items = ['linker2', 'thumb'];
      expect(canSell(s, 'linker2')).toBe(false);
      expect(canSell(s, 'thumb')).toBe(true);
      expect(sell(s, 'thumb')).toBe(true);
    });
  });

  it('banned items never reach the shelf', () => {
    const ban: ItemId[] = ['wildcard1', 'wildcard2', 'linker1', 'linker2'];
    withEntry({ banned: ban }, (s) => {
      s.items = ['linker1'];
      expect(forSale(s).filter((id) => ban.includes(id))).toEqual([]);
      for (let i = 0; i < 20; i++) { s.credits = 99; stockShop(s, i > 0); expect(s.shelf.filter((id) => ban.includes(id))).toEqual([]); }
    });
  });

  it('the bonus label only marks a rare or legendary lead', () => {
    withEntry({ family: 'Runner' }, (s) => {
      s.legendOffer = true;
      s.daemons = runner.filter((id) => rarityOf(id) !== 'common');
      const o = offerDaemons(s);
      expect(o.every((id) => rarityOf(id) === 'common')).toBe(true);
      expect(leadsBonus(s, o)).toBe(false);
      s.daemons = [];
      expect(leadsBonus(s, offerDaemons(s))).toBe(true);
    });
  });
});
