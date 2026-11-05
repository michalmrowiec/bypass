import { describe, expect, it } from 'vitest';
import { generate } from './generator';
import {
  buy, DATA_BY_LEN, daemonsAfterMatrix, endMatrix, finishMatrix, forSale, matrixData, movePreview, newRunState, nextSection, offerDaemons, played,
  removeDaemon, scoreMatrix, sectionMatrix, SECTIONS, SHELF, stockShop,
  type DaemonId, type ItemId,
} from './roguelike';

describe('roguelike run', () => {
  it('scores uploaded targets by length', () => {
    expect(matrixData(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']])).toBe(35);
  });

  it('sections grow 5x5 -> 7x7 with no spare buffer and max data 45/60/95', () => {
    expect(SECTIONS.map((_, i) => sectionMatrix(i).n)).toEqual([5, 6, 7]);
    expect(SECTIONS.map((_, i) => sectionMatrix(i).slack)).toEqual([0, 0, 0]);
    expect(SECTIONS.map((_, i) => sectionMatrix(i).lens.reduce((a, l) => a + DATA_BY_LEN[l], 0))).toEqual([45, 60, 95]);
  });

  it('plays every matrix of a room, even past the quota', () => {
    const s = newRunState(1);
    s.section = 1;
    expect(endMatrix(s, 200, 0)).toBe('continue');
    expect(endMatrix(s, 0, 0)).toBe('section');
  });

  it('pays empty slots only when something was uploaded', () => {
    const s = newRunState(1);
    s.section = 1;
    endMatrix(s, 0, 6);
    expect(s.credits).toBe(0);
    endMatrix(s, 10, 5);
    expect(s.credits).toBe(2);
  });

  it('pays the section credit plus surplus over the quota', () => {
    const s = newRunState(1);
    s.section = 1;
    endMatrix(s, 60, 0);
    endMatrix(s, 55, 0); // 115 vs quota 70: surplus 45
    expect(s.credits).toBe(1 + 2);
    nextSection(s);
    expect([s.section, s.data, played(s)]).toEqual([2, 0, 0]);
  });

  it('rooms grow from 1 to 3 matrices', () => {
    expect(SECTIONS.map((sec) => sec.matrices)).toEqual([1, 2, 3]);
    const s = newRunState(1);
    expect(endMatrix(s, 30, 0)).toBe('section');
    expect(s.scores[0]).toEqual([30]);
  });

  it('ends the run below the quota after the last matrix', () => {
    const s = newRunState(1);
    expect(endMatrix(s, 20, 0)).toBe('lose');
  });

  it('wins after the last section', () => {
    const s = newRunState(1);
    s.section = SECTIONS.length - 1;
    s.scores[s.section] = [0, 0];
    expect(endMatrix(s, 1000, 0)).toBe('win');
  });
});

describe('daemons', () => {
  const tgt = [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']];
  // A row 0 corner start, then a full-length column move (edge jump), then shorter/longer moves.
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: tgt, l: 8, n: 5 };
  const run = (...daemons: DaemonId[]) => ({ ...newRunState(1), daemons });

  it('scores 0 without an upload, whatever the daemons', () => {
    expect(scoreMatrix({ ...ctx, buf: ['X'] }, run('overflow', 'corner')).total).toBe(0);
  });

  it('applies (data + flat) × (1 + boost) × mult', () => {
    expect(scoreMatrix(ctx, run()).total).toBe(35);
    expect(scoreMatrix(ctx, run('chain')).total).toBe(52); // B is shared: ×1.5
    expect(scoreMatrix(ctx, run('overflow')).total).toBe(105); // 4 empty slots -> +2
    expect(scoreMatrix(ctx, run('light', 'corner')).total).toBe(105); // ×2 ×1.5
    expect(scoreMatrix(ctx, run('longjump')).total).toBe(45); // two moves of length 4
    expect(scoreMatrix(ctx, run('zigzag')).total).toBe(52); // 4,2,4: one longer move -> +0.5
    expect(scoreMatrix(ctx, run('compressor')).total).toBe(40); // B is shared: +5 data
    expect(scoreMatrix(ctx, run('chain', 'compressor')).total).toBe(60);
    expect(scoreMatrix(ctx, run('fullstack')).fired).toEqual([]); // XY not uploaded
  });

  it('Cache stacks on roomy matrices, this one included, and resets on a full buffer', () => {
    const s = run('cache');
    expect(scoreMatrix(ctx, s).total).toBe(43); // 4 empty slots: the first matrix already counts, ×1.25
    daemonsAfterMatrix(ctx, s, false);
    daemonsAfterMatrix(ctx, s, false);
    expect(s.cache).toBe(0.5);
    expect(scoreMatrix(ctx, s).total).toBe(61); // ×1.75
    expect(scoreMatrix({ ...ctx, l: 4 }, s).fired).toEqual([]);
    daemonsAfterMatrix({ ...ctx, l: 4 }, s, false);
    expect(s.cache).toBe(0);
  });

  it('Silent pays credits only for a disconnect', () => {
    const s = run('silent');
    daemonsAfterMatrix(ctx, s, false);
    daemonsAfterMatrix(ctx, s, true);
    expect(s.credits).toBe(2);
  });

  it('finishMatrix reports the score and where the credits came from', () => {
    const s = run('silent', 'chain');
    s.section = 1;
    const { score, out } = finishMatrix(s, ctx, true);
    expect([score.total, out]).toEqual([52, 'continue']);
    expect(score.fired).toEqual([['chain', { boost: 0.5 }]]);
    expect(s.earned).toEqual([['Silent daemon', 2], ['4 empty buffer slots (1 per 2)', 2]]);
  });

  it('offers 3 distinct unowned daemons, stable per seed and section', () => {
    const s = run('chain');
    const o = offerDaemons(s);
    expect(new Set(o).size).toBe(3);
    expect(o).not.toContain('chain');
    expect(offerDaemons(run('chain'))).toEqual(o);
  });

  it('previews only the owned path daemons for one move', () => {
    const path = ctx.path.slice(0, 2); // (0,0) -> (4,0): a length-4 move
    expect(movePreview([], [0, 4], 5, ['corner'])).toEqual(['corner start ×1.5']);
    expect(movePreview(path, [4, 4], 5, ['corner', 'longjump', 'zigzag'])).toEqual(['long jump +5']); // corner start already counts
    expect(movePreview(path, [4, 4], 5, [])).toEqual([]);
    expect(movePreview([[0, 1], [3, 1]], [3, 0], 5, ['zigzag'])).toEqual([]);
    expect(movePreview([[0, 1], [1, 1]], [1, 4], 5, ['zigzag', 'corner'])).toEqual(['zigzag +0.5 boost']);
  });
});

describe('shop', () => {
  const rich = (credits: number, items: ItemId[] = []) => ({ ...newRunState(7), credits, items });

  it('stocks the same shelf for the same seed, without v2.0 for non-owners', () => {
    const s = rich(10);
    stockShop(s);
    expect(s.shelf).toHaveLength(SHELF);
    expect(s.shelf).not.toContain('buffer2');
    const t = rich(10);
    stockShop(t);
    expect(t.shelf).toEqual(s.shelf);
  });

  it('a v2.0 is sold over its v1.0 and replaces it', () => {
    const s = rich(10, ['buffer1']);
    expect(forSale(s)).toContain('buffer2');
    s.shelf = ['buffer2'];
    expect(buy(s, 'buffer2')).toBe(true);
    expect([s.items, s.credits, s.shelf]).toEqual([['buffer2'], 6, []]);
    expect(forSale(s)).not.toContain('buffer1');
  });

  it('charges for items, rerolls and daemon removal', () => {
    const s = { ...rich(3), shelf: ['buffer1'] as ItemId[], daemons: ['chain'] as DaemonId[] };
    expect(buy(s, 'buffer1')).toBe(false);
    expect(stockShop(s, true)).toBe(true);
    expect(removeDaemon(s, 'chain')).toBe(true);
    expect([s.daemons, s.credits]).toEqual([[], 0]);
    expect(stockShop(s, true)).toBe(false);
  });

  it('items reshape the room matrix', () => {
    expect(sectionMatrix(0, ['buffer2']).slack).toBe(2);
    expect(sectionMatrix(0, ['shortkey'])).toMatchObject({ lens: [2, 2, 2], slack: 1 });
    expect(sectionMatrix(0, ['linker1']).links).toEqual([2]);
    expect(SECTIONS[0].size.lens).toEqual([2, 2, 3]);
  });

  it('Linker v2.0 overlaps one link on 2 codes', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = generate(seed, sectionMatrix(2, ['linker2']));
      expect(p.l).toBe(3 + 3 + 4 - 2 - 1);
      expect(p.targets.some((a) => p.targets.some((b) => a !== b && a.slice(-2).join() === b.slice(0, 2).join()))).toBe(true);
    }
  });
});
