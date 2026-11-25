import { describe, expect, it } from 'vitest';
import { contains, isLegal, newRun, partner, pick, WILD } from './game';
import { canComplete } from './solver';
import { BLOCK, generate } from './generator';
import {
  buy, canExitRoom, exitRoom, EXIT_CREDIT, EXIT_FULL_CREDIT, DATA_BY_LEN, daemonsAfterMatrix, endMatrix, finishMatrix, forSale, matrixData, movePreview, newRunState, nextSection, offerDaemons, offerPacks, played, shareSquares,
  beltRow, LOOPS, NO_PORT_ICE, sections, burnOf, COMPANIES, roomIce, companyOpen, quota, revealed, coverage, cutMarks, dealRunMatrix, placeCells, sideDoor, swapDaemon, SWAP_COST, swapCost, scoreMatrix, buySlot, restartMatrix, sell, slotCost, RACK_BASE, sectionMatrix, SHELF, splitTarget, canSplit, stockShop, lockItem,
  setMiner, minerIdle, entryOf, payLevel, priceOf, zipPrice, setBossIce, canDisconnect, needsStartChoice, DAEMONS, bountyMet, claimReward, rewardsFor, bountyFor, bountyHere, BOUNTIES_PER_LOOP, plantRepeat, rarityOf, daemonSlots, DAEMON_SLOTS, trapCell, firstTargetData, sellValue, payloadFor, PAYLOADS, rewardPatch, rewardText, migratePayloads, buyZip, pickZip, zipSold, ZIP_PRICE, type DaemonId, type ItemId,
} from './roguelike';

const SECTIONS = COMPANIES[0].sections;
const BOSS = SECTIONS.length - 1;

describe('roguelike run', () => {
  it('scores uploaded targets by length', () => {
    expect(matrixData(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']])).toBe(35);
  });

  it('share squares: a line per iteration, coloured by data over the quota', () => {
    const s = newRunState(1);
    const q = (loop: number, room: number) => quota({ ...s, loop }, room);
    s.log = [[0, 0, q(0, 0)], [0, 1, q(0, 1) * 2], [0, 2, q(0, 2) * 3], [1, 0, q(1, 0) - 1]];
    expect(shareSquares(s)).toEqual(['🟨🟩🟪', '🟥']);
  });

  it('sections grow 5x5 -> 7x7 with no spare buffer and max data 45/60/95/95', () => {
    expect(SECTIONS.map((_, i) => sectionMatrix(i).n)).toEqual([5, 6, 7, 7]);
    expect(SECTIONS.map((_, i) => sectionMatrix(i).slack)).toEqual([0, 0, 0, 0]);
    expect(SECTIONS.map((_, i) => sectionMatrix(i).lens.reduce((a, l) => a + DATA_BY_LEN[l], 0))).toEqual([45, 60, 95, 95]);
  });

  it('plays every matrix of a room, even past the quota', () => {
    const s = newRunState(1);
    s.section = 1;
    expect(endMatrix(s, 200, 0)).toBe('continue');
    expect(endMatrix(s, 0, 0)).toBe('section');
  });

  it('pays $3 per skipped matrix after a full matrix in the room, until the next room', () => {
    const s = newRunState(1);
    s.section = 1;
    endMatrix(s, 130, 0);
    s.roomFull = true;
    s.credits = 0;
    exitRoom(s);
    expect(s.credits).toBe(EXIT_FULL_CREDIT + 2 + 2);
    nextSection(s);
    expect(s.roomFull).toBeUndefined();
  });

  it('lets the player leave a room early once the quota is met, $1 per skipped matrix', () => {
    const s = newRunState(1);
    s.section = 1; // two matrices, quota 70
    expect(canExitRoom(s)).toBe(false);
    endMatrix(s, 50, 0);
    expect(canExitRoom(s)).toBe(false); // under the quota
    s.data = 130;
    s.credits = 0;
    expect(exitRoom(s)).toBe('section');
    expect(s.credits).toBe(EXIT_CREDIT + 2 + 2); // skipped matrix, section cleared, surplus 60 (max $2)
    s.section = BOSS;
    s.scores[BOSS] = [999];
    s.data = 9999;
    expect(canExitRoom(s)).toBe(false); // the boss room is always played out
  });

  it('no credits for empty slots without a Miner in idle', () => {
    const s = { ...newRunState(1), items: ['chip'] as ItemId[] };
    s.section = 1;
    endMatrix(s, 10, 5);
    expect(s.credits).toBe(0);
  });

  it('Miner idle pays empty slots only when something was uploaded', () => {
    const s = { ...newRunState(1), items: ['chip'] as ItemId[], miner: 'idle' as const };
    s.section = 1;
    endMatrix(s, 0, 6);
    expect(s.credits).toBe(0);
    endMatrix(s, 10, 5);
    expect(s.credits).toBe(2);
    endMatrix(s, 10, 13); // capped at $3 per matrix
    expect(s.credits).toBe(5);
  });

  it('pays the section credit plus surplus over the quota', () => {
    const s = newRunState(1);
    s.section = 1;
    endMatrix(s, 60, 0);
    endMatrix(s, 70, 0); // 130 vs quota 70: surplus 60 (max $2)
    expect(s.credits).toBe(2 + 2);
    nextSection(s);
    expect([s.section, s.data, played(s)]).toEqual([2, 0, 0]);
  });

  it('rooms grow from 1 to 3 matrices, then the SOC plays 2', () => {
    expect(SECTIONS.map((sec) => sec.matrices)).toEqual([1, 2, 3, 2]);
    const s = newRunState(1);
    expect(endMatrix(s, 30, 0)).toBe('section');
    expect(s.scores[0]).toEqual([30]);
  });

  it('ends the run below the quota after the last matrix', () => {
    const s = newRunState(1);
    expect(endMatrix(s, 19, 0)).toBe('lose');
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

  it('scores the highest matching payload, its level adding data and mult', () => {
    expect(scoreMatrix(ctx, run()).pay).toEqual(['linked', 1, { flat: 5 }]); // B is shared; level 1 adds its data
    expect(scoreMatrix(ctx, { ...run(), payLevels: { linked: 3 } }).total).toBe(55); // (35 + 15) × 1.1
    expect(payloadFor({ ...ctx, buf: ['A', 'B', 'X', 'Y'], l: 4 })).toBe('multi');
    expect(payloadFor({ ...ctx, buf: ['A', 'B', 'C', 'D', 'X', 'Y'] })).toBe('all_linked');
    expect(payloadFor({ ...ctx, buf: ['X', 'Y', 'A', 'B'], targets: [['A', 'B'], ['X', 'Y']], l: 4 })).toBe('all_targets');
    expect(payloadFor({ ...ctx, buf: ['A', 'B', 'Q'], l: 3 })).toBe('single');
    expect(payloadFor({ ...ctx, buf: ['Q'] })).toBeUndefined();
    // Every shown example makes its own payload.
    for (const [id, p] of Object.entries(PAYLOADS)) expect(payloadFor({ ...ctx, ...p.ex })).toBe(id);
  });

  it('sells one patch.zip per shop visit and installs the patch kept', () => {
    const s = { ...newRunState(5), credits: 10 };
    expect(buyZip(s)).toBe(true);
    expect(s.credits).toBe(10 - ZIP_PRICE);
    expect(zipSold(s) && s.zipOpen?.length).toBe(3);
    expect(buyZip(s)).toBe(false); // one per visit
    const [id, n] = s.zipOpen![1];
    expect(pickZip(s, 1)).toBe(true);
    expect(s.payLevels?.[id]).toBe(1 + n);
    expect(s.zipOpen).toBeUndefined();
    expect(pickZip(s, 0)).toBe(false);
    s.section++; // next visit
    expect(buyZip(s)).toBe(true);
  });

  it('applies (data + flat) × (1 + boost) × mult', () => {
    expect(scoreMatrix(ctx, run()).total).toBe(40); // 35 + linked Lv1 5
    expect(scoreMatrix(ctx, run('chain')).total).toBe(60); // B is shared: ×1.5
    expect(scoreMatrix(ctx, run('overflow')).total).toBe(72); // 4 empty slots -> +0.8
    expect(scoreMatrix(ctx, run('light', 'corner')).total).toBe(120); // ×2 ×1.5
    const five = { ...ctx, buf: [...ctx.buf, 'E'] };
    expect(scoreMatrix({ ...five, l: 9 }, run('light')).fired).toEqual([['light', { mult: 2 }]]); // half of 9 rounds up to 5
    expect(scoreMatrix(five, run('light')).fired).toEqual([]);
    expect(scoreMatrix(ctx, run('longjump')).total).toBe(70); // two moves of length 4: +15 each
    expect(scoreMatrix(ctx, run('zigzag')).total).toBe(60); // 4,2,4: one longer move -> +0.5
    expect(scoreMatrix(ctx, run('circuit')).total).toBe(80); // ends at (0,2), in the first pick's row
    expect(scoreMatrix({ ...ctx, path: ctx.path.slice(0, 3) }, run('circuit')).fired).toEqual([]);
    expect(scoreMatrix(ctx, run('odometer')).total).toBe(60); // 4+2+4 = 10 cells: ×1.5
    expect(scoreMatrix(ctx, run('compressor')).total).toBe(50); // B is shared: +10 data
    expect(scoreMatrix(ctx, run('chain', 'compressor')).total).toBe(75);
    expect(scoreMatrix(ctx, run('fullstack')).fired).toEqual([]); // XY not uploaded
    expect(scoreMatrix({ ...ctx, buf: ['A', 'B', 'C', 'D', 'X', 'Y'] }, run('fullstack')).total).toBe(116); // (45 + all_linked 8) × 2.2 (3 targets)
  });

  it('Cache stacks on roomy matrices, this one included, and resets when every target is uploaded', () => {
    const s = run('cache');
    expect(scoreMatrix(ctx, s).total).toBe(50); // 4 empty slots: the first matrix already counts, (35 + 5) × 1.25
    daemonsAfterMatrix(ctx, s, false);
    daemonsAfterMatrix(ctx, s, false);
    daemonsAfterMatrix({ ...ctx, l: 4 }, s, false); // full buffer: no stack, no reset
    expect(s.stacks.cache).toBe(2);
    expect(scoreMatrix(ctx, s).total).toBe(70); // ×1.75
    const all = { ...ctx, targets: [['A', 'B'], ['B', 'C', 'D']] };
    expect(scoreMatrix(all, s).fired).toEqual([]);
    daemonsAfterMatrix(all, s, false);
    expect(s.stacks.cache).toBe(0);
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
    expect([score.total, out]).toEqual([60, 'continue']);
    expect(score.fired).toEqual([['chain', { boost: 0.5 }]]);
    expect(s.earned).toEqual([['Silent daemon', 2]]);
    const m = { ...run('silent'), items: ['chip'] as ItemId[], miner: 'idle' as const, section: 1 };
    finishMatrix(m, ctx, true);
    expect(m.earned).toEqual([['Silent daemon', 2], ['Credit chip idle · 4 empty buffer slots (1 per 2, max 3)', 2]]);
  });

  it('a full upload pays a credit; a Miner in idle adds 1 per 2 empty slots when the matrix ends on its own', () => {
    const s = run();
    s.section = 1;
    finishMatrix(s, { ...ctx, targets: [['A', 'B'], ['B', 'C', 'D']] }, false);
    expect(s.earned).toEqual([['every target uploaded', 2]]);
    const m = { ...run(), items: ['chip'] as ItemId[], miner: 'idle' as const, section: 1 };
    finishMatrix(m, { ...ctx, targets: [['A', 'B'], ['B', 'C', 'D']] }, false);
    expect(m.earned).toEqual([['every target uploaded', 2], ['Credit chip idle · 4 empty buffer slots (1 per 2, max 3)', 2]]);
  });

  it('switching to idle mid-room voids the Miner pool credit, also on an early exit; the next room pays again', () => {
    const s = { ...run(), items: ['chip'] as ItemId[], credits: 0 };
    s.section = 1; // Offices: 2 matrices, quota 70
    expect(setMiner(s, 'idle')).toBe(true);
    finishMatrix(s, { ...ctx, targets: [['A', 'B'], ['B', 'C', 'D']] }, false);
    s.data = 1000;
    expect(setMiner(s, 'pool')).toBe(true);
    exitRoom(s);
    expect(s.earned.some(([why]) => why === 'Credit chip pool')).toBe(false);
    nextSection(s);
    s.data = 1000;
    while (endMatrix(s, 0, 0) === 'continue');
    expect(s.earned.some(([why]) => why === 'Credit chip pool')).toBe(true);
  });

  it('setMiner needs a Miner; an old save without a mode plays pool', () => {
    expect(setMiner(run(), 'idle')).toBe(false);
    expect(minerIdle({ ...run(), items: ['chip'] as ItemId[] })).toBe(false);
  });

  it('offers 4 distinct unowned daemons, stable per seed and section', () => {
    const s = run('chain');
    const o = offerDaemons(s);
    expect(new Set(o).size).toBe(4);
    expect(o).not.toContain('chain');
    expect(offerDaemons(run('chain'))).toEqual(o);
  });

  it('still offers daemons with every slot full', () => {
    const o = offerDaemons(run('chain', 'cache', 'corner', 'silent'));
    expect(o).toHaveLength(4);
    expect(o.some((id) => ['chain', 'cache', 'corner', 'silent'].includes(id))).toBe(false);
  });

  it('previews only the owned path daemons for one move', () => {
    const path = ctx.path.slice(0, 2); // (0,0) -> (4,0): a length-4 move
    expect(movePreview([], [0, 4], 5, ['corner'])).toEqual([{ id: 'corner', name: 'corner start', add: '×1.5', kind: 'boost' }]);
    // corner start already counts; one long jump is banked, this one adds another
    expect(movePreview(path, [4, 4], 5, ['corner', 'longjump', 'zigzag'])).toEqual([{ id: 'longjump', name: 'long jump', now: '15', add: '+15', kind: 'data' }]);
    expect(movePreview(path, [4, 4], 5, ['longjump'], [1])).toEqual([{ id: 'longjump', name: 'long jump', now: undefined, add: '+15', kind: 'data' }]); // a jump is no move
    expect(movePreview(path, [4, 4], 5, [])).toEqual([]);
    expect(movePreview([[0, 1], [3, 1]], [3, 0], 5, ['zigzag'])).toEqual([]);
    expect(movePreview([[0, 1], [1, 1]], [1, 4], 5, ['zigzag', 'corner'])).toEqual([{ id: 'zigzag', name: 'zigzag', now: undefined, add: '+0.5 boost', kind: 'boost' }]);
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

  it('items rerolled away show up rarer on the next visit, only on its first shelf', () => {
    let seen = 0, base = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = { ...rich(10), seed };
      stockShop(s);
      const gone = [...s.shelf];
      stockShop(s, true);
      expect(s.skipped).toEqual(gone);
      s.section++;
      const t = { ...s, skipped: [] };
      stockShop(s);
      stockShop(t);
      expect(s.skipped).toEqual([]);
      seen += s.shelf.filter((id) => gone.includes(id)).length;
      base += t.shelf.filter((id) => gone.includes(id)).length;
    }
    expect(seen).toBeLessThan(base * 0.5);
  });

  it('an upgrade of an owned item shows up more often than an average item', () => {
    let up = 0, rest = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const s = { ...rich(10, ['buffer1']), seed };
      stockShop(s);
      up += +s.shelf.includes('buffer2');
      rest += s.shelf.length - +s.shelf.includes('buffer2');
    }
    const open = forSale({ ...rich(10, ['buffer1']) }).length;
    expect(up).toBeGreaterThan(1.2 * rest / (open - 1));
  });

  it('a reroll rarely brings back what the shelf just showed', () => {
    let back = 0, base = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = { ...rich(10), seed };
      stockShop(s);
      const gone = [...s.shelf];
      const t = { ...s, shelf: [] as ItemId[] }; // same reroll draw, nothing shown before
      stockShop(s, true);
      t.skipped = []; t.rerolls = s.rerolls - 1; t.credits = 10;
      stockShop(t, true);
      back += s.shelf.filter((id) => gone.includes(id)).length;
      base += t.shelf.filter((id) => gone.includes(id)).length;
    }
    expect(back).toBeLessThan(base * 0.5);
  });

  it('a locked item stays through rerolls and opens the next visit unlocked, then rerolls like the rest', () => {
    const s = rich(20);
    stockShop(s);
    const id = s.shelf[2];
    expect(lockItem(s, id)).toBe(true);
    stockShop(s, true);
    expect(s.shelf[0]).toBe(id);
    s.section++;
    stockShop(s);
    expect([s.shelf[0], s.hold, s.kept]).toEqual([id, undefined, id]);
    expect(lockItem(s, id)).toBe(false);
    const other = s.shelf[1];
    expect(lockItem(s, other)).toBe(true);
    stockShop(s, true);
    expect(s.shelf[0]).toBe(other);
    expect(s.skipped).toContain(id); // rerolled away like any other
    s.shelf.push(id);
    expect(buy(s, id)).toBe(true);
    expect(s.kept).toBeUndefined();
  });

  it('a v2.0 is sold over its v1.0 and replaces it', () => {
    const s = rich(10, ['buffer1']);
    expect(forSale(s)).toContain('buffer2');
    s.shelf = ['buffer2'];
    expect(buy(s, 'buffer2')).toBe(true);
    expect([s.items, s.credits, s.shelf]).toEqual([['buffer2'], 6, []]);
    expect(forSale(s)).not.toContain('buffer1');
  });

  it('logs successful shop actions only', () => {
    const s = { ...rich(1, ['bridge']), shelf: ['bridge2'] as ItemId[] };
    expect(buy(s, 'bridge2')).toBe(false);
    expect(s.events).toBeUndefined();
    s.credits = 4;
    buy(s, 'bridge2');
    sell(s, 'bridge2');
    expect(s.events).toEqual(['shop · bought Bridge v2.0 −$4 (replaces Bridge v1.0)', 'shop · sold Bridge v2.0 +$3']);
  });

  it('charges for items, rerolls and daemon swaps', () => {
    const s = { ...rich(3), shelf: ['buffer1'] as ItemId[], daemons: ['chain'] as DaemonId[] };
    expect(buy(s, 'buffer1')).toBe(false);
    expect(stockShop(s, true)).toBe(true);
    expect(swapDaemon(s, 'chain', 'cache')).toBe(false);
    s.credits = SWAP_COST.rare; // Chain is rare
    expect(swapDaemon(s, 'chain', 'cache')).toBe(true);
    expect([s.daemons, s.credits]).toEqual([['cache'], 0]);
    expect(stockShop(s, true)).toBe(false);
  });

  it('a swap costs by the rarity of the daemon thrown out', () => {
    expect([swapCost('uptime'), swapCost('chain')]).toEqual([2, 4]);
    const s = { ...rich(2), daemons: ['uptime'] as DaemonId[] };
    expect(swapDaemon(s, 'uptime', 'cache')).toBe(true);
    expect(s.credits).toBe(0);
  });

  it('the first reroll on a visit is free, then each costs $1 more; bonus rerolls cover paid steps', () => {
    const s = { ...rich(10), freeRerolls: 1 };
    stockShop(s);
    expect(stockShop(s, true)).toBe(true); // free step
    expect(s.freeRerolls).toBe(1);
    expect(stockShop(s, true)).toBe(true); // bonus covers the $1 step
    expect(stockShop(s, true)).toBe(true); // $2
    expect([s.credits, s.freeRerolls]).toEqual([8, 0]);
    stockShop(s); // next visit starts free again
    expect(stockShop(s, true) && s.credits).toBe(8);
  });

  it('an offer leaves out the daemons of the previous one', () => {
    const s = newRunState(1), o = offerDaemons(s);
    s.lastOffer = o;
    expect(offerDaemons(s).filter((id) => o.includes(id))).toEqual([]);
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

describe('matrix items', () => {
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']], l: 8, n: 5 };

  it('** fits any code in targets and shared slots', () => {
    expect(contains(['A', WILD, 'C'], ['B', 'C'])).toBe(true);
    expect(coverage(['A', WILD, 'C'], [['A', 'B'], ['B', 'C']])).toEqual([1, 2, 1]);
  });

  it('keeps the wildcard off the solution path and the data node on it about one matrix in five', () => {
    let onPath = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const p = generate(seed, sectionMatrix(1));
      const { wild, nodes: [node] } = placeCells(seed, p, ['wildcard1', 'datanode']);
      const on = (c: [number, number]) => p.path!.some((q) => q[0] === c[0] && q[1] === c[1]);
      expect(on(wild!)).toBe(false);
      expect(node).not.toEqual(wild);
      if (on(node!)) onPath++;
      // v3.0 keeps the v1.0 cell and adds a second, different one.
      const three = placeCells(seed, p, ['wildcard1', 'datanode3']).nodes;
      expect(three[0]).toEqual(node);
      expect(three).toHaveLength(2);
      expect(three[1]).not.toEqual(node);
    }
    expect(onPath).toBeGreaterThan(20);
    expect(onPath).toBeLessThan(60);
  });

  it('a data node on the path adds +15 data', () => {
    const s = { ...newRunState(1), items: ['datanode'] as ItemId[] };
    expect(scoreMatrix({ ...ctx, nodes: [[4, 0]] }, s)).toMatchObject({ flat: 20, total: 55, gear: [['datanode', { flat: 15 }]] });
    expect(scoreMatrix({ ...ctx, nodes: [[1, 1]] }, s).flat).toBe(5); // only linked's data
  });

  it('Priority multiplies the data of the first uploaded target, the richer one on a tie', () => {
    const s = (id: ItemId) => ({ ...newRunState(1), items: [id] });
    expect(scoreMatrix(ctx, s('prio1')).gear).toEqual([['prio1', { flat: 10 }]]); // AB done before BCD: 10 more
    expect(scoreMatrix(ctx, s('prio2')).gear).toEqual([['prio2', { flat: 30 }]]);
    expect(firstTargetData(['B', 'C', 'D'], [['C', 'D'], ['B', 'C', 'D']])).toBe(25); // both end on D
    expect(firstTargetData(['A', 'B'], [['A', 'B']], [4])).toBe(4); // a split target pays its own worth
    expect(scoreMatrix({ ...ctx, buf: ['X'] }, s('prio2')).total).toBe(0);
  });

  it('a v3.0 replaces the whole line: older versions leave the shop, selling returns half of all three', () => {
    const s = { ...newRunState(1), items: ['datanode3'] as ItemId[] };
    expect(forSale(s).filter((id) => id.startsWith('datanode'))).toEqual([]);
    expect(forSale({ ...s, items: ['datanode2'] }).filter((id) => id.startsWith('datanode'))).toEqual(['datanode3']);
    expect(sellValue('datanode3')).toBe(5); // (3 + 3 + 5) / 2
  });

  it('Split v1.0 marks one random gap per target, stable per seed', () => {
    const targets = [['A', 'B'], ['A', 'B', 'C'], ['A', 'B', 'C', 'D']];
    const m = cutMarks(9, targets);
    expect(m[0]).toBe(1);
    m.forEach((at, i) => expect(at >= 1 && at < targets[i].length).toBe(true));
    expect(cutMarks(9, targets)).toEqual(m);
  });

  it('split needs a target of 3+ codes', () => {
    expect([['A', 'B'], ['A', 'B', 'C']].map(canSplit)).toEqual([false, true]);
  });

  it('split cuts a target and its data in two', () => {
    expect(splitTarget([['A', 'B', 'C'], ['D', 'E']], [25, 10], 0)).toEqual({ targets: [['A', 'B'], ['C'], ['D', 'E']], worth: [17, 8, 10] });
    expect(splitTarget([['A', 'B', 'C', 'D']], [45], 0, 1)).toEqual({ targets: [['A'], ['B', 'C', 'D']], worth: [11, 34] });
    expect(splitTarget([['A', 'B', 'C', 'D', 'E']], [70], 0, 1).worth).toEqual([14, 56]);
    expect(matrixData(['A', 'B'], [['A', 'B'], ['C']], [13, 12])).toBe(13);
  });
});

describe('movement items', () => {
  const grid = [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']];

  it('Bridge and Loopback open paths the lanes alone do not', () => {
    expect(canComplete(newRun(), { grid, targets: [['A', 'I']], l: 2 })).toBe(false);
    expect(canComplete(newRun(), { grid, targets: [['A', 'I']], l: 2 }, undefined, { jump: true })).toBe(true);
    // Bridge v1.0 only reaches the 8 cells around the last pick.
    expect(canComplete(newRun(), { grid, targets: [['A', 'I']], l: 2 }, undefined, { jump: true, near: true })).toBe(false);
    expect(canComplete(newRun(), { grid, targets: [['A', 'E']], l: 2 }, undefined, { jump: true, near: true })).toBe(true);
    // B, then Mux back along row 0 to C.
    expect(canComplete(newRun(), { grid, targets: [['B', 'C']], l: 2 })).toBe(false);
    expect(canComplete(newRun(), { grid, targets: [['B', 'C']], l: 2 }, undefined, { mux: true })).toBe(true);
    expect(canComplete(newRun(), { grid, targets: [['A', 'A']], l: 2 })).toBe(false);
    expect(canComplete(newRun(), { grid, targets: [['A', 'A']], l: 2 }, undefined, { loop: true })).toBe(true);
    // A, then down column 0 to G, then back to A: only Loopback v2.0 reaches a used cell off the lane.
    expect(canComplete(newRun(), { grid, targets: [['A', 'G', 'H', 'A']], l: 4 }, undefined, { loop: true })).toBe(false);
    expect(canComplete(newRun(), { grid, targets: [['A', 'G', 'H', 'A']], l: 4 }, undefined, { loop: true, loopAny: true })).toBe(true);
  });

  it('Side door: a side edge goes on along its row, a corner frees the next axis', () => {
    const p = { grid, targets: [], l: 3 };
    const side = newRun();
    pick(side, p, 1, 0);
    sideDoor(side, 1, 0, 3);
    expect([side.axis, side.idx]).toEqual(['row', 1]);
    const corner = newRun();
    pick(corner, p, 2, 2);
    sideDoor(corner, 2, 2, 3);
    expect([isLegal(corner, 2, 0), isLegal(corner, 0, 2), isLegal(corner, 1, 1)]).toEqual([true, true, false]);
    pick(corner, p, 0, 2);
    expect([corner.axis, corner.idx, corner.free]).toEqual(['row', 0, undefined]);
  });

  it('a Bridge jump is no move for daemons', () => {
    const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D']], l: 8, n: 5 };
    const s = { ...newRunState(1), daemons: ['longjump'] as DaemonId[] };
    expect(scoreMatrix(ctx, s).total).toBe(73);
    expect(scoreMatrix({ ...ctx, jumps: [3] }, s).total).toBe(58);
  });
});

describe('SOC ICE', () => {
  const boss = (ice: 'firewall' | 'throttle' | 'blackout') => ({ ...newRunState(3), section: BOSS, ice });

  it('Firewall seals one line off the solution path', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = dealRunMatrix(seed, boss('firewall'));
      const sealed = p.grid.flatMap((row, r) => row.map((code, c) => [r, c, code] as const)).filter(([, , code]) => code === BLOCK);
      expect(sealed).toHaveLength(7);
      expect(sealed.some(([r, c]) => p.path!.some((q) => q[0] === r && q[1] === c))).toBe(false);
      expect(sealed.some(([r]) => r === 0) && sealed.every(([r]) => r === 0)).toBe(false); // never the whole top row
    }
  });

  it('Throttle cuts one buffer slot', () => {
    expect(dealRunMatrix(5, boss('throttle')).l).toBe(3 + 3 + 4 - 2 - 1);
  });

  it('Blackout keeps every top-row start in reach of a target', () => {
    const p = dealRunMatrix(8, boss('blackout'));
    for (let c = 0; c < 7; c++) {
      const run = newRun();
      pick(run, p, 0, c);
      expect(p.targets.some((t) => canComplete(run, { ...p, targets: [t] }))).toBe(true);
    }
  });

  it('draws the ICE rule from the run seed', () => {
    expect(newRunState(42).ice).toBe(newRunState(42).ice);
  });

  it("draws the ICE rule from the company's pool", () => {
    COMPANIES.forEach((co, i) => {
      if (co.dev) return;
      for (let seed = 1; seed <= 20; seed++) expect(co.ice).toContain(newRunState(seed, i).ice);
    });
  });
});

describe('companies', () => {
  it('breaching a company opens the next one', () => {
    expect([0, 1].map((i) => companyOpen([], i))).toEqual([true, false]);
    expect(companyOpen([COMPANIES[0].id], 1)).toBe(true);
    expect(companyOpen([COMPANIES[1].id], 1)).toBe(false);
  });

  it('every room of every company deals a solvable matrix', () => {
    COMPANIES.forEach((co, ci) => co.sections.forEach((sec, i) => {
      for (let seed = 1; seed <= 4; seed++) {
        const p = generate(seed, sectionMatrix(i, [], ci));
        expect(p.grid).toHaveLength(sec.size.n);
        expect(canComplete(newRun(), p)).toBe(true);
      }
    }));
  });

  it('later iterations deal a longest target one code longer, even under Firewall and Corruption', () => {
    COMPANIES.forEach((co, ci) => co.sections.forEach((_, i) => {
      const s = { ...newRunState(1, ci), section: i, loop: 1 };
      for (let seed = 1; seed <= 4; seed++) {
        const base = sectionMatrix(i, [], ci), size = { ...base, lens: base.lens.map((l, k) => l + +(k === base.lens.indexOf(Math.max(...base.lens)))), block: ['row', 1] as ['row', number], burn: burnOf(s) };
        const p = generate(seed, size);
        expect(p.targets.map((t) => t.length).sort()).toEqual([...size.lens].sort());
        expect(canComplete(newRun(), p)).toBe(true);
      }
    }));
  });
});

describe('iterations', () => {
  it('raises the quotas ×2.5 each iteration and wins after the third boss', () => {
    const s = newRunState(1);
    s.section = BOSS;
    s.scores[BOSS] = [0];
    expect(endMatrix(s, 1000, 0)).toBe('loop');
    const ps = nextSection(s)!;
    expect([s.loop, s.section, s.scores[0], quota(s, 0)]).toEqual([1, 0, [], 50]);
    for (const p of ps) expect(COMPANIES[0].patches).toContain(p.ice);
    Object.assign(s, { loop: 2, section: BOSS, data: 0 });
    s.scores[BOSS] = [0];
    expect(endMatrix(s, quota(s) - 1, 0)).toBe('lose');
    s.scores[BOSS] = [0];
    s.data = 0;
    expect(endMatrix(s, quota(s), 0)).toBe('win');
  });

  it('ICE covers ~60% of rooms in iteration 2, every room in iteration 3 with ~1/3 doubled', () => {
    for (let co = 0; co < COMPANIES.length; co++) for (let seed = 1; seed <= 20; seed++) {
      if (COMPANIES[co].dev) continue;
      const s = newRunState(seed, co), n = sections(s).length;
      s.section = n - 1;
      nextSection(s);
      const covered = () => sections(s).filter((_, i) => roomIce(s, i).length).length;
      expect(covered()).toBeGreaterThanOrEqual(Math.ceil(n * 0.6));
      expect(s.patches.filter((p) => p.ice === 'corruption').length).toBeLessThanOrEqual(1);
      s.section = n - 1;
      nextSection(s);
      expect(covered()).toBe(n);
      expect(sections(s).filter((_, i) => roomIce(s, i).length >= 2).length).toBeGreaterThanOrEqual(Math.round(n / 3));
    }
  });

  it('draws the same patch from the same seed and shows it once its room is entered', () => {
    const wrap = () => { const s = newRunState(9); s.section = BOSS; return [s, nextSection(s)![0]] as const; };
    const [s, p] = wrap();
    expect(wrap()[1]).toEqual(p);
    expect(revealed(s, p)).toBe(p.room === 0);
    s.section = p.room;
    expect(revealed(s, p)).toBe(true);
  });

  it('Corruption lasts one move per patch, for good from the third', () => {
    const s = newRunState(1);
    s.loop = 2;
    const cp = (room: number, loop: number) => ({ ice: 'corruption' as const, room, loop });
    s.patches = [cp(0, 1)];
    expect([burnOf(s, 0), burnOf(s, 1)]).toEqual([1, 0]);
    s.patches.push(cp(1, 2));
    expect([burnOf(s, 0), burnOf(s, 1)]).toEqual([2, 2]);
    s.patches.push(cp(0, 2));
    expect(burnOf(s, 0)).toBe(Infinity);
  });
});

describe('Corruption', () => {
  it('a pick locks its neighbours for the burn length', () => {
    const p = generate(4, sectionMatrix(2));
    const run = { ...newRun(), burn: 1 };
    pick(run, p, 0, 2);
    expect(isLegal(run, 1, 2)).toBe(false);
    expect(isLegal(run, 3, 2)).toBe(true);
    pick(run, p, 3, 2);
    pick(run, p, 3, 0);
    expect(isLegal(run, 1, 0)).toBe(true);
    expect(run.burnt!.get('1,2')).toBe(2);
  });

  it('deals matrices whose solution path keeps clear of the lock', () => {
    for (const burn of [1, 2, Infinity]) for (let seed = 1; seed <= 15; seed++) {
      const p = generate(seed, { ...sectionMatrix(2), burn });
      const run = { ...newRun(), burn };
      for (const [r, c] of p.path!) {
        expect(isLegal(run, r, c)).toBe(true);
        pick(run, p, r, c);
      }
      expect(p.targets.every((t) => contains(run.buffer, t))).toBe(true);
      expect(canComplete({ ...newRun(), burn }, p)).toBe(true);
    }
  });
});

describe('economy', () => {
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']], l: 8, n: 5 };

  it('caps the surplus credits per room; a Miner in pool adds 1', () => {
    const s = { ...newRunState(1), items: ['chip'] as ItemId[] };
    endMatrix(s, 1000, 0);
    expect(s.earned.map(([, n]) => n)).toEqual([2, 2, 1]);
    expect(s.earned[2][0]).toBe('Credit chip pool');
  });

  it('a full rack blocks new modules but not upgrades; slots cost more each; selling returns half', () => {
    const s = { ...newRunState(1), credits: 50, items: ['buffer1', 'shortkey', 'bridge', 'thumb'] as ItemId[], shelf: ['datanode', 'buffer2'] as ItemId[] };
    expect(buy(s, 'datanode')).toBe(false);
    expect(buy(s, 'buffer2')).toBe(true);
    expect([slotCost(s), buySlot(s), s.rack, slotCost(s)]).toEqual([3, true, RACK_BASE + 1, 6]);
    expect(buy(s, 'datanode')).toBe(true);
    const before = s.credits;
    expect(sell(s, 'buffer2')).toBe(true);
    expect(s.credits - before).toBe(4); // (4 + 4) / 2
  });

  it('the Co-processor adds a daemon slot; selling it with five daemons drops the chosen one', () => {
    const s = { ...newRunState(1), items: ['socket'] as ItemId[], daemons: ['heartbeat', 'overflow', 'silent', 'cron', 'joker'] as DaemonId[] };
    expect(daemonSlots(s)).toBe(DAEMON_SLOTS + 1);
    expect(sell(s, 'socket')).toBe(false);
    expect(sell(s, 'socket', 'silent')).toBe(true);
    expect(s.daemons).toEqual(['heartbeat', 'overflow', 'cron', 'joker']);
    expect(daemonSlots(s)).toBe(DAEMON_SLOTS);
  });

  it('Thumb drive adds data per uploaded target; Heatsink shortens Corruption', () => {
    const s = { ...newRunState(1), items: ['thumb'] as ItemId[] };
    expect(scoreMatrix(ctx, s).total).toBe(46); // 2 of 3 uploaded: 35 + linked 5 + 2×3
    expect(scoreMatrix({ ...ctx, buf: ['X'] }, s).total).toBe(0);
    expect(scoreMatrix(ctx, { ...s, items: ['thumb2'] }).gear).toEqual([['thumb2', { flat: 20 }]]);
    expect(scoreMatrix(ctx, { ...s, items: ['thumb3'] }).gear).toEqual([['thumb3', { flat: 50 }]]);
    expect(scoreMatrix({ ...ctx, nodes: [ctx.path[0]] }, { ...s, items: ['datanode2'] }).gear).toEqual([['datanode2', { flat: 40 }]]);
    expect(scoreMatrix({ ...ctx, nodes: [ctx.path[0], ctx.path[1]] }, { ...s, items: ['datanode3'] }).gear).toEqual([['datanode3', { flat: 120 }]]);
    const h = { ...newRunState(1), loop: 1, items: ['heatsink'] as ItemId[], patches: [{ ice: 'corruption' as const, room: 0, loop: 1 }] };
    expect(burnOf(h, 0)).toBe(0);
    h.patches.push({ ice: 'corruption', room: 0, loop: 1 }, { ice: 'corruption', room: 0, loop: 1 });
    expect(burnOf(h, 0)).toBe(2);
  });
});

describe('Burner SIM', () => {
  it('re-deals only with the SIM, once per room, from the room after the shop', () => {
    const s = { ...newRunState(1), credits: 9, shelf: ['sim'] as ItemId[] };
    expect(s.restarts).toBe(0);
    expect(buy(s, 'sim')).toBe(true);
    expect(s.restarts).toBe(1);
    restartMatrix(s);
    nextSection(s);
    expect(s.restarts).toBe(1);
    sell(s, 'sim');
    expect(s.restarts).toBe(0);
  });
});

describe('cron daemons', () => {
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D']], l: 8, n: 5 };
  const run = (...daemons: DaemonId[]) => ({ ...newRunState(1), daemons });

  it('Heartbeat stacks while every target goes up and halves on a miss', () => {
    const s = run('heartbeat');
    daemonsAfterMatrix(ctx, s, false);
    daemonsAfterMatrix(ctx, s, false);
    expect(scoreMatrix(ctx, s).fired).toEqual([['heartbeat', { boost: 0.6 }]]);
    daemonsAfterMatrix({ ...ctx, targets: [...ctx.targets, ['X', 'Y']] }, s, false);
    expect(s.stacks.heartbeat).toBe(1); // a miss halves 3 → 1
  });

  it('Rotate needs a new start column each matrix', () => {
    const s = run('rotate');
    daemonsAfterMatrix(ctx, s, false);
    daemonsAfterMatrix({ ...ctx, path: [[0, 3], [4, 3]] }, s, false);
    expect(s.stacks.rotate).toBe(2);
    daemonsAfterMatrix({ ...ctx, path: [[0, 3], [4, 3]] }, s, false);
    expect(s.stacks.rotate).toBe(0);
  });

  it('Backup wants exactly one empty slot; Uptime breaks on Disconnect or restart', () => {
    const b = run('backup');
    daemonsAfterMatrix({ ...ctx, l: 5 }, b, false);
    expect(b.stacks.backup).toBe(1);
    daemonsAfterMatrix({ ...ctx, l: 5 }, b, false);
    daemonsAfterMatrix({ ...ctx, l: 5 }, b, false);
    daemonsAfterMatrix(ctx, b, false);
    expect(b.stacks.backup).toBe(1); // a miss halves 3 → 1
    const u = run('uptime');
    daemonsAfterMatrix(ctx, u, false);
    daemonsAfterMatrix(ctx, u, false);
    expect(scoreMatrix(ctx, u).fired).toEqual([['uptime', { flat: 24 }]]);
    restartMatrix(u);
    expect(u.stacks.uptime).toBe(0);
    daemonsAfterMatrix(ctx, u, false);
    daemonsAfterMatrix(ctx, u, true);
    expect(u.stacks.uptime).toBe(0);
  });
});

describe('playtest daemons, bounties and Glob', () => {
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D']], l: 8, n: 5 };
  const run = (...daemons: DaemonId[]) => ({ ...newRunState(1), daemons });
  const fired = (c: typeof ctx, ...d: DaemonId[]) => scoreMatrix(c, run(...d)).fired;

  it('Deflate, Crawler and Saturate read codes, cells and a full buffer', () => {
    expect(fired(ctx, 'deflate', 'crawler', 'saturate')).toEqual([['deflate', { mult: 1.25 }], ['crawler', { flat: 20 }]]);
    expect(fired({ ...ctx, l: 4 }, 'saturate')).toEqual([['saturate', { mult: 1.8 }]]);
  });

  it('Joker counts targets through **; No trace scales per target and wants no stray code', () => {
    expect(fired({ ...ctx, buf: ['A', WILD, 'C', 'D'] }, 'joker')).toEqual([['joker', { boost: 1 }]]);
    expect(fired(ctx, 'notrace')).toEqual([['notrace', { mult: 1.5 }]]); // A B C D: all inside AB and BCD
    expect(fired({ ...ctx, buf: ['A', 'B', 'C', 'D', 'X'] }, 'notrace')).toEqual([]); // X is a stray code
    expect(fired({ ...ctx, buf: ['A', 'B'] }, 'notrace')).toEqual([['notrace', { mult: 1.25 }]]); // one target
    // ** lets "77 00" match early at 77 **; the real upload at the end still counts.
    const t = [['77', '00'], ['H3', '5K', '77', 'LL', '77']];
    expect(fired({ ...ctx, targets: t, buf: ['H3', '5K', '77', WILD, '77', '00'], l: 9 }, 'notrace')).toEqual([['notrace', { mult: 1.5 }]]);
  });

  it('Painter paints the path of a matrix with an upload and levels up a repainted cell', () => {
    const s = run('painter');
    daemonsAfterMatrix(ctx, s, false); // A B C D all uploaded
    expect(s.paint).toEqual({ '0,0': 7, '4,0': 7, '4,2': 7, '0,2': 7 });
    expect(scoreMatrix(ctx, s).fired).toEqual([['painter', { flat: 28 }]]);
    daemonsAfterMatrix({ ...ctx, buf: ['A', 'B', 'X', 'Y'], targets: [['A', 'B']] }, s, false); // only AB
    expect(s.paint).toEqual({ '0,0': 14, '4,0': 14, '4,2': 14, '0,2': 14 }); // the whole path, not only AB
    expect(scoreMatrix(ctx, s).fired).toEqual([['painter', { flat: 56 }]]);
    daemonsAfterMatrix({ ...ctx, buf: ['X', 'Y'] }, s, false); // nothing uploaded: the paint stays
    expect(s.paint).toEqual({ '0,0': 14, '4,0': 14, '4,2': 14, '0,2': 14 });
    for (let i = 0; i < 4; i++) daemonsAfterMatrix(ctx, s, false);
    expect(scoreMatrix(ctx, s).fired).toEqual([['painter', { flat: 168 }]]); // no cap: 4 cells at +42
  });

  it('Painter: a skipped cell keeps 20% once, then goes; repainting builds on what is left', () => {
    const s = run('painter');
    for (let i = 0; i < 5; i++) daemonsAfterMatrix(ctx, s, false); // 4 cells at 35
    const half = { ...ctx, path: [[0, 0], [4, 0]] as [number, number][] };
    daemonsAfterMatrix(half, s, false);
    expect(s.paint).toEqual({ '0,0': 42, '4,0': 42, '4,2': 7, '0,2': 7 });
    daemonsAfterMatrix(half, s, false);
    expect(s.paint).toEqual({ '0,0': 49, '4,0': 49 });
    daemonsAfterMatrix(ctx, s, false);
    daemonsAfterMatrix(half, s, false);
    daemonsAfterMatrix(ctx, s, false); // back on a faded cell: 1 + 7
    expect(s.paint).toEqual({ '0,0': 70, '4,0': 70, '4,2': 8, '0,2': 8 });
  });

  it('Botnet pays for separate uploads, not linked ones', () => {
    const two = { ...ctx, buf: ['A', 'B', 'X', 'Y'], targets: [...ctx.targets, ['X', 'Y']] }; // AB and XY uploaded, BCD left
    expect(scoreMatrix(two, run('spray', 'fork', 'parallel', 'sweep', 'quorum')).fired)
      .toEqual([['spray', { flat: 25 }], ['fork', { mult: 1.5 }], ['parallel', { boost: 1.5 }], ['quorum', { mult: 2 }]]);
    expect(scoreMatrix(ctx, run('parallel')).fired).toEqual([]); // AB and BCD share B
    expect(scoreMatrix({ ...two, targets: [['A', 'B'], ['X', 'Y']] }, run('fork', 'sweep', 'quorum')).fired).toEqual([['sweep', { mult: 2 }]]);
  });

  it('Sandbag stacks on a weak Disconnect for the rest of the room; Warm-up counts played matrices', () => {
    const s = run('sandbag', 'warmup');
    s.section = 1;
    finishMatrix(s, { ...ctx, targets: [['A', 'B'], ['X', 'Y']] }, true);
    expect(scoreMatrix(ctx, s).fired).toEqual([['sandbag', { boost: 1.5 }], ['warmup', { boost: 0.5 }]]);
    nextSection(s);
    expect(s.stacks.sandbag).toBeUndefined();
  });

  it('Root: Polyglot counts the other families, Failsafe and Payroll read the uploads', () => {
    const s = run('polyglot', 'failsafe', 'baseline', 'silent', 'overtime'); // Ghost + Cron, neither fires here
    expect(scoreMatrix(ctx, s).fired).toEqual([['polyglot', { mult: 1.9 }], ['failsafe', { mult: 1.6 }], ['baseline', { boost: 0.4 }]]);
    expect(scoreMatrix({ ...ctx, buf: ['A', 'B', 'X'] }, run('failsafe')).fired).toEqual([['failsafe', { mult: 1.25 }]]);
    const p = run('payroll');
    daemonsAfterMatrix(ctx, p, false); // 2 targets uploaded
    daemonsAfterMatrix({ ...ctx, buf: ['A', 'B', 'X'] }, p, false); // only 1
    expect(p.earned.filter(([w]) => w === 'Payroll daemon')).toEqual([['Payroll daemon', 1]]);
  });

  it('bounties check the route and pay a credit', () => {
    expect(bountyMet('surgical', { ...ctx, par: 4 })).toBe(true);
    expect(bountyMet('surgical', { ...ctx, par: 3 })).toBe(false);
    expect(bountyMet('corners', { ...ctx, path: [[0, 0], [0, 4]] })).toBe(true);
    expect(bountyMet('barehands', { ...ctx, tools: true })).toBe(false);
    const s = run();
    s.section = 1;
    expect(finishMatrix(s, { ...ctx, bounty: 'clean' }, false).met).toBe(true);
    expect(s.earned).not.toContainEqual(['bonus · Clean', 5]); // paid only once claimed
    expect(claimReward(s, 'clean', 'cash')).toBe('cash');
    expect(s.earned).toContainEqual(['bonus · Clean', 5]);
  });

  it('a ** target code takes any code', () => {
    expect(contains(['A', 'Z'], ['A', WILD])).toBe(true);
  });

  it('offers follow the rarity odds', () => {
    let legendary = 0, slots = 0;
    for (let seed = 0; seed < 2000; seed++) for (const id of offerDaemons(newRunState(seed))) { slots++; if (rarityOf(id) === 'legendary') legendary++; }
    expect(legendary / slots).toBeGreaterThan(0.02);
    expect(legendary / slots).toBeLessThan(0.09);
  });
});

describe('round 3: All-in, Overtime, Repeater, rewards', () => {
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D']], l: 8, n: 5 };
  const run = (...daemons: DaemonId[]) => ({ ...newRunState(1), daemons });

  it('All-in bets ×3 on every target, ×0.5 otherwise', () => {
    expect(scoreMatrix(ctx, run('allin')).fired).toEqual([['allin', { mult: 2 }]]);
    expect(scoreMatrix({ ...ctx, targets: [...ctx.targets, ['X', 'Y']] }, run('allin')).fired).toEqual([['allin', { mult: 0.5 }]]);
  });

  it('Overtime carries half the surplus into the next room', () => {
    const s = run('overtime');
    s.data = quota(s) + 41;
    nextSection(s);
    expect([s.data, s.carry]).toEqual([20, 20]);
  });

  it('Repeater doubles a code in one target and the plant still solves', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = generate(seed, SECTIONS[2].size), l = p.l;
      const cell = plantRepeat(seed, p);
      if (!cell) continue;
      expect(p.l).toBe(l + 1);
      expect(canComplete(newRun(), p, 200_000, { rep: cell })).toBe(true);
    }
  });

  it('Wild only comes up with a Wildcard; a met bonus pays its reward', () => {
    for (let seed = 0; seed < 200; seed++) expect(bountyFor(seed)).not.toBe('wild');
    const s = run('heartbeat');
    s.section = 1;
    finishMatrix(s, { ...ctx, bounty: 'clean' }, false);
    claimReward(s, 'clean', 'stack');
    expect(s.stacks.heartbeat).toBe(3);
    claimReward(s, 'clean', 'rerolls');
    expect(s.freeRerolls).toBe(3);
    expect(stockShop(s, true) && stockShop(s, true)).toBe(true); // the visit's free step, then a bonus one
    expect(s.freeRerolls).toBe(2);
    expect(claimReward(run(), 'clean', 'stack')).toBe('cash'); // no streak daemon
    claimReward(s, 'clean', 'double');
    expect([s.charges, s.bonus]).toEqual([1, ['stack', 'rerolls', 'double']]);
    s.payPlays = { single: 1, linked: 3 };
    const [pid, n] = rewardPatch(s);
    expect([pid, n === 2 || n === 3, rewardText(s, 'patch')]).toEqual(['linked', true, '+' + n + ' Lv to your most played payload (linked.bin)']);
    claimReward(s, 'clean', 'patch');
    expect(s.payLevels?.linked).toBe(1 + n);
    const old = { ...run(), payLevels: { two_targets: 3, half_buffer: 2 }, payPlays: { one_target: 4 }, zipOpen: [['half_buffer', 1], ['one_target', 2]] as [string, number][] };
    migratePayloads(old);
    expect([old.payLevels, old.payPlays, old.zipOpen]).toEqual([{ multi: 3 }, { single: 4 }, [['single', 2]]]);
    const plain = finishMatrix(run(), { ...ctx }, false).score.total;
    expect(finishMatrix(run(), { ...ctx, charge: true }, false).score.total).toBe(2 * plain);
  });

  it('a bonus offers two different rewards; stacks only with a streak daemon', () => {
    for (let seed = 0; seed < 100; seed++) {
      const [a, b] = rewardsFor(seed);
      expect(a).not.toBe(b);
      expect([a, b]).not.toContain('stack');
      expect(rewardsFor(seed, ['heartbeat'])).toHaveLength(2);
    }
  });

  it('a legendary reward makes the next offer lead with a legendary', () => {
    const s = newRunState(3);
    s.legendOffer = true;
    expect(rarityOf(offerDaemons(s)[0])).toBe('legendary');
  });
});

describe('bonus matrices', () => {
  it('one matrix per iteration carries a bonus', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = newRunState(seed);
      let n = 0;
      for (let room = 0; room < BOSS; room++) {
        s.section = room;
        for (let m = 0; m < SECTIONS[room].matrices; m++) { s.scores[room] = Array(m).fill(0); if (bountyHere(s)) n++; }
      }
      expect(n).toBe(BOUNTIES_PER_LOOP);
      s.section = BOSS;
      s.scores[BOSS] = [];
      expect(bountyHere(s)).toBe(false);
    }
  });
});

describe('new ICE: Dead cells, Honeypot; company pools', () => {
  const boss = (ice: string) => {
    const s = newRunState(5);
    Object.assign(s, { company: 2, section: COMPANIES[2].sections.length - 1, ice });
    return s;
  };
  const planted = (p: ReturnType<typeof dealRunMatrix>) => {
    const path = p.path!.slice(0, p.l);
    return { buf: path.map(([r, c]) => p.grid[r][c]), path, targets: p.targets, l: p.l, n: p.grid.length };
  };

  it('Dead cells kills 2 cells of a 5×5 off the planted route, which still uploads everything', () => {
    for (let seed = 0; seed < 30; seed++) {
      const p = dealRunMatrix(seed, boss('deadcells'));
      expect(p.grid.flat().filter((g) => g === BLOCK).length).toBe(2);
      const ctx = planted(p);
      expect(matrixData(ctx.buf, ctx.targets)).toBe(p.targets.reduce((a, t) => a + DATA_BY_LEN[t.length], 0));
    }
  });

  it('a path through the Honeypot halves the matrix score', () => {
    const s = boss('honeypot'), p = dealRunMatrix(7, s), ctx = planted(p);
    const trap = trapCell(7, p, [])!;
    expect(p.path!.some((q) => q[0] === trap[0] && q[1] === trap[1])).toBe(false);
    const clean = scoreMatrix({ ...ctx, trap }, s).total;
    const hit = scoreMatrix({ ...ctx, trap, path: [...ctx.path, trap] }, s);
    expect(hit.ice).toEqual([['honeypot', { mult: 0.5 }]]);
    expect(hit.total).toBe(Math.floor(clean / 2));
  });

  it('every company keeps the ICE of the one before (in its pools or in every room)', () => {
    for (let i = 1; i < COMPANIES.length; i++) {
      if (COMPANIES[i].dev) continue;
      const always = COMPANIES[i].always ?? [];
      for (const id of COMPANIES[i - 1].patches) expect([...COMPANIES[i].patches, ...always]).toContain(id);
      for (const id of COMPANIES[i - 1].ice) expect([...COMPANIES[i].ice, ...always]).toContain(id);
    }
  });

  it('Argus throttles every room and runs a belt from the Backbone on', () => {
    const argus = COMPANIES.findIndex((c) => c.id === 'argus');
    const s = newRunState(1, argus);
    expect(roomIce({ ...s, section: 0 })).toEqual(['throttle']);
    expect(roomIce({ ...s, section: 2 })).toEqual(['throttle', 'conveyor']);
    const p = dealRunMatrix(7, { ...s, section: 2 });
    expect(p.belt && p.belt.row > 0).toBe(true);
    expect(beltRow(['A', 'B', BLOCK, 'C'], 1)).toEqual(['C', 'A', BLOCK, 'B']);
  });
});

describe('port boards', () => {
  const size = COMPANIES.find((c) => c.dev)!.sections[2].size;
  it('every port board is solvable and its planted route passes a port', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const p = generate(seed, size);
      expect(p.grid[0].length).toBe(2 * size.n);
      expect(p.path!.some(([r, c]) => partner(p, r, c))).toBe(true);
      expect(canComplete(newRun(), p, Infinity)).toBe(true);
    }
  });

  it('a port sends the next lane through its partner; row lanes stay in their matrix', () => {
    const p = { grid: [['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H']], targets: [], l: 4, half: 2, ports: [[[0, 1], [1, 2]]] as [[number, number], [number, number]][] };
    const run = newRun();
    expect([isLegal(run, 0, 1, p), isLegal(run, 0, 2, p)]).toEqual([true, false]);
    pick(run, p, 0, 1); // port along row 0 of A: next lane is the partner's column
    expect([run.axis, run.idx]).toEqual(['col', 2]);
    pick(run, p, 0, 2); // down column 2: next lane is row 0 of B
    expect([isLegal(run, 0, 3, p), isLegal(run, 0, 0, p)]).toEqual([true, false]);
  });
});

describe('port moves', () => {
  it('measure a move after a port from its partner', () => {
    const ports: [[number, number], [number, number]][] = [[[0, 0], [2, 3]]];
    expect(movePreview([[0, 0]], [0, 3], 3, ['longjump'], [], ports).map((p) => p.id)).toEqual(['longjump']);
    expect(movePreview([[0, 0]], [0, 3], 3, ['longjump'])).toEqual([]);
  });
});

describe('port rooms', () => {
  it('Dead cells never land on a port', () => {
    const co = COMPANIES.findIndex((c) => c.id === 'ashgrove'), room = COMPANIES[co].sections.findIndex((x) => x.size.ports);
    for (let seed = 1; seed <= 40; seed++) {
      const s = newRunState(seed, co);
      Object.assign(s, { section: room, patches: [{ ice: 'deadcells', room, loop: 0 }] });
      const p = dealRunMatrix(seed, s);
      for (const pair of p.ports!) for (const [r, c] of pair) expect(p.grid[r][c]).not.toBe(BLOCK);
    }
  });

  it('never get ICE the port board cannot handle', () => {
    COMPANIES.forEach((co, i) => {
      for (let seed = 1; seed <= 30; seed++) {
        const s = newRunState(seed, i);
        for (let k = 0; k < LOOPS * co.sections.length; k++) {
          if (sections(s)[s.section]?.size.ports) for (const id of NO_PORT_ICE) expect(roomIce(s)).not.toContain(id);
          nextSection(s);
        }
      }
    });
  });
});

describe('entries', () => {
  const real = COMPANIES.filter((c) => !c.dev);
  const co = (id: string) => COMPANIES.findIndex((c) => c.id === id);

  it('every real company has 3 entries with unique ids and traits', () => {
    for (const c of real) {
      expect(c.entries.length).toBe(3);
      expect(new Set(c.entries.map((e) => e.id)).size).toBe(3);
      for (const e of c.entries.slice(1)) expect(e.name && e.traits.length).toBeTruthy();
      expect(c.entries[0].traits).toEqual([]); // the default is the plain game
    }
  });

  it('a save without entry plays the default', () => {
    expect(entryOf({ ...newRunState(1, 0), entry: undefined }).id).toBe(COMPANIES[0].entries[0].id);
    expect(entryOf({ company: 0, entry: 'nope' }).id).toBe(COMPANIES[0].entries[0].id);
  });

  it('Courier tablet starts with Mux v1, which cannot be sold', () => {
    const s = newRunState(7, co('kestrel'), 'courier');
    expect(s.items).toEqual(['mux']);
    expect(sell(s, 'mux')).toBe(false);
  });

  it("Partner's phone starts with a Burner SIM that works in the first room", () => {
    const s = newRunState(1, co('ashgrove'), 'phone');
    expect(s.items).toContain('sim');
    expect(s.restarts).toBe(1);
  });

  it('Fibre tap starts with Linker v1; payload entries start levelled', () => {
    expect(newRunState(1, co('argus'), 'fibre').items).toEqual(['linker1']);
    const dock = newRunState(1, co('kestrel'), 'dock');
    expect([payLevel(dock, 'single'), payLevel(dock, 'multi'), payLevel(dock, 'linked')]).toEqual([2, 2, 1]);
    const phish = newRunState(1, co('meridian'), 'phishing');
    expect([payLevel(phish, 'linked'), payLevel(phish, 'all_linked')]).toEqual([3, 3]);
    const sig = newRunState(1, co('argus'), 'signal');
    for (const id of Object.keys(PAYLOADS) as (keyof typeof PAYLOADS)[]) expect(payLevel(sig, id)).toBe(2);
  });

  it('harder entries keep iteration 1 quotas and never lower later ones', () => {
    COMPANIES.forEach((c, k) => c.entries.forEach((e) => {
      for (let loop = 0; loop < LOOPS; loop++) c.sections.forEach((_, i) => {
        const q = quota({ ...newRunState(1, k, e.id), loop }, i), base = quota({ ...newRunState(1, k), loop }, i);
        expect(q % 5).toBe(0);
        if (loop) expect(q).toBeGreaterThanOrEqual(base); else expect(q).toBe(base);
      });
    }));
  });

  it('Courier tablet shelf holds 3', () => {
    const s = newRunState(1, co('kestrel'), 'courier');
    stockShop(s);
    expect(s.shelf.length).toBe(3);
  });

  it('offers two packs of 3 (a mega pack 4) distinct unowned daemons from their families, stable per seed and section', () => {
    let mega = 0;
    for (let seed = 0; seed < 200; seed++) {
      const st = { ...newRunState(seed), daemons: ['chain'] as DaemonId[] }, packs = offerPacks(st), all = packs.flatMap((p) => p.cards);
      expect(packs).toHaveLength(2);
      expect(new Set(all).size).toBe(all.length);
      for (const p of packs) { expect([3, 4]).toContain(p.cards.length); if (p.cards.length === 4) mega++; }
      expect(all).not.toContain('chain');
      for (const p of packs) for (const id of p.cards) expect(p.fams).toContain(DAEMONS[id].family);
      expect(packs[0].fams.join()).not.toBe(packs[1].fams.join());
      for (const p of packs) expect([1, 2, 6]).toContain(p.fams.length);
      expect(offerPacks({ ...newRunState(seed), daemons: ['chain'] as DaemonId[] })).toEqual(packs);
    }
    expect(mega).toBeGreaterThan(10);
  });

  it('a RARE+ / LEGENDARY+ pack holds at least one card of its tier, best card last', () => {
    let seen = 0;
    for (let seed = 0; seed < 600; seed++) for (const p of offerPacks(newRunState(seed))) {
      const rank = p.cards.map((id) => ['common', 'rare', 'legendary'].indexOf(rarityOf(id)));
      expect(rank).toEqual([...rank].sort());
      if (p.tier) { seen++; expect(p.cards.some((id) => rarityOf(id) === p.tier)).toBe(true); }
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('the legendary bonus is one pack of two legendaries', () => {
    const s = newRunState(3);
    s.legendOffer = true;
    const packs = offerPacks(s);
    expect(packs.map((p) => [p.kind, p.cards.length])).toEqual([['legend2', 2]]);
    expect(packs[0].cards.every((id) => rarityOf(id) === 'legendary')).toBe(true);
  });

  it('a fixed-family entry offers a single pack of that family', () => {
    const p = offerPacks(newRunState(1, co('meridian'), 'nightshift'));
    expect(p.map((x) => [x.kind, x.fams, x.cards.length])).toEqual([['one', ['Cron'], 3]]);
    expect(p[0].cards.every((id) => DAEMONS[id].family === 'Cron')).toBe(true);
  });

  it('Night shift offers 4 Cron daemons at normal prices', () => {
    const s = { ...newRunState(1, co('meridian'), 'nightshift'), credits: 10, shelf: ['thumb'] as ItemId[] };
    const o = offerDaemons(s);
    expect([o.length, o.every((id) => DAEMONS[id].family === 'Cron')]).toEqual([4, true]);
    expect([priceOf(s, 'thumb'), zipPrice(s), slotCost(s)]).toEqual([2, 1, 3]);
    expect(buy(s, 'thumb')).toBe(true);
    expect(s.credits).toBe(8);
  });

  it('Signal flaw offers only Runner daemons, with no start choice', () => {
    const s = newRunState(1, co('argus'), 'signal');
    expect(needsStartChoice(s)).toBeUndefined();
    for (const id of offerDaemons(s)) expect(DAEMONS[id].family).toBe('Runner');
  });

  it('Paper trail picks the boss ICE only at the start, from the company pool', () => {
    const s = newRunState(1, co('ashgrove'), 'papertrail');
    expect(needsStartChoice(s)).toBe('ice');
    expect(setBossIce(s, 'conveyor')).toBe(false);
    expect(setBossIce(s, 'blackout')).toBe(true);
    expect([s.ice, needsStartChoice(s)]).toEqual(['blackout', undefined]);
    endMatrix(s, 10, 0);
    expect(setBossIce(s, 'firewall')).toBe(false);
    expect(setBossIce(newRunState(1, co('ashgrove')), 'blackout')).toBe(false);
  });

  it('Paper trail patches add a second rule to every patched room', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = newRunState(seed, co('ashgrove'), 'papertrail');
      s.section = sections(s).length - 1;
      const ps = nextSection(s)!;
      for (const room of new Set(ps.map((p) => p.room))) expect(ps.filter((p) => p.room === room).length).toBe(2);
    }
  });

  it('Phishing cannot disconnect', () => {
    expect(canDisconnect(newRunState(1, co('meridian'), 'phishing'))).toBe(false);
    expect(canDisconnect(newRunState(1, co('meridian')))).toBe(true);
  });

  it("Partner's phone puts Dead cells in every room", () => {
    const s = newRunState(1, co('ashgrove'), 'phone');
    sections(s).forEach((_, i) => expect(roomIce(s, i)).toContain('deadcells'));
  });
});

describe('Loopline Metro', () => {
  it('deals two long chained targets on every room board, each solvable, in every iteration', () => {
    const co = COMPANIES.findIndex((c) => c.id === 'loopline');
    for (let section = 0; section < COMPANIES[co].sections.length; section++) for (let loop = 0; loop < 3; loop++) for (let seed = 1; seed <= 6; seed++) {
      const s = { ...newRunState(seed, co), section, loop };
      const p = dealRunMatrix(seed * 31 + section, s);
      expect(p.targets.length).toBe(2);
      expect(Math.min(...p.targets.map((t) => t.length))).toBeGreaterThanOrEqual(3);
      // The boss room runs a boss ICE (Throttle can cut the chain), so only the plain rooms must clear every target.
      if (!roomIce(s).length) expect([section, canComplete(newRun(), p)]).toEqual([section, true]);
      // Masked cells are not there: no port and no planted pick may sit on one.
      const sealed = ([r, c]: [number, number]) => p.grid[r][c] === '##';
      expect((p.ports ?? []).flat().some(sealed)).toBe(false);
      expect((p.path ?? []).some(sealed)).toBe(false);
    }
  });
  it('Signal room spares only the first room of iteration 1 from Encryption', () => {
    const s = { ...newRunState(1, COMPANIES.findIndex((c) => c.id === 'loopline')), entry: 'signalroom' };
    expect(roomIce({ ...s, section: 0 })).not.toContain('encryption');
    expect(roomIce({ ...s, section: 1 })).toContain('encryption');
    expect(roomIce({ ...s, section: 0, loop: 1 })).toContain('encryption');
  });
});
