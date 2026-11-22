import { describe, expect, it } from 'vitest';
import { applyPick, dealBoard, replayRoute, TOOLS } from './matrix';
import { generate } from './generator';
import { stageSeed } from './game';
import { canSnapshot, exitRoom, nextSeed, quota, sections, takeSnapshot, placeCells, sectionMatrix, rotateTarget, buyZip, daemonsAfterMatrix, finishMatrix, newRunState, nextSection, payBase, payLevel, pickZip, rackFull, scoreMatrix, sell, setHotkey, unitsOf, usedSlots, type DaemonId, type ItemId, type PayloadId } from './roguelike';

describe('rack units', () => {
  it('2U modules take two slots', () => {
    const s = { ...newRunState(1), rack: 4, items: ['thumb', 'ups'] as ItemId[] };
    expect([unitsOf('ups'), unitsOf('thumb'), unitsOf('bridge'), unitsOf('bridge2')]).toEqual([2, 1, 1, 2]);
    expect(usedSlots(s)).toBe(3);
    expect(rackFull(s, 'nullpad')).toBe(false);
    expect(rackFull(s, 'overclock')).toBe(true);
  });
  it('an upgrade that grows needs the extra slot', () => {
    const s = { ...newRunState(1), rack: 4, items: ['thumb', 'buffer1', 'shortkey', 'bridge'] as ItemId[] };
    expect(rackFull(s, 'bridge2')).toBe(true);
    expect(rackFull({ ...s, rack: 5 }, 'bridge2')).toBe(false);
    expect(rackFull(s, 'thumb2')).toBe(false);
  });
});

describe('passive bill items', () => {
  // AB (10) and BCD (25) uploaded and sharing B, XY missed; 4 empty slots; moves 4, 2, 4.
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']], l: 8, n: 5 };
  const with_ = (...items: ItemId[]) => ({ ...newRunState(1), items });
  it('Null pad pays per empty slot, only with an upload', () => {
    expect(scoreMatrix(ctx, with_('nullpad')).gear).toEqual([['nullpad', { flat: 32 }]]);
    expect(scoreMatrix({ ...ctx, buf: ['X'] }, with_('nullpad')).gear).toEqual([]);
  });
  it('Zip tie adds half the data of targets sharing a code', () => {
    expect(scoreMatrix(ctx, with_('ziptie')).gear).toEqual([['ziptie', { flat: 17 }]]);
    expect(scoreMatrix({ ...ctx, buf: ['A', 'B', 'X', 'Y'] }, with_('ziptie')).gear).toEqual([]);
  });
  it('Slingshot pays for the longest move', () => {
    expect(scoreMatrix(ctx, with_('slingshot')).gear).toEqual([['slingshot', { flat: 40 }]]);
  });
  it('Overclock multiplies the matrix by 1.5', () => {
    const sc = scoreMatrix(ctx, with_('overclock'));
    expect([sc.total, sc.gear]).toEqual([60, [['overclock', { mult: 1.5 }]]]);
    expect(scoreMatrix({ ...ctx, buf: ['Q'] }, with_('overclock')).total).toBe(0);
  });
});

describe('UPS', () => {
  // 2 of 3 targets: Heartbeat would halve; starting in column 0 again resets Rotate.
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']], l: 8, n: 5 };
  const run = () => ({ ...newRunState(1), items: ['ups'] as ItemId[], daemons: ['heartbeat', 'rotate'] as DaemonId[], stacks: { heartbeat: 4, rotate: 3 }, lastStart: 0 });
  it('keeps every breaking streak once per room', () => {
    const s = run();
    daemonsAfterMatrix(ctx, s, false);
    expect([s.stacks.heartbeat, s.stacks.rotate, s.upsUsed]).toEqual([4, 3, true]);
    expect(s.events!.at(-1)).toBe('UPS · kept the streaks');
    daemonsAfterMatrix(ctx, s, false);
    expect([s.stacks.heartbeat, s.stacks.rotate]).toEqual([2, 0]);
    nextSection(s);
    expect(s.upsUsed).toBeUndefined();
  });
  it('does nothing without UPS or when nothing breaks', () => {
    const s = { ...run(), items: [] as ItemId[] };
    daemonsAfterMatrix(ctx, s, false);
    expect([s.stacks.heartbeat, s.stacks.rotate]).toEqual([2, 0]);
    const g = { ...run(), lastStart: 3, daemons: ['rotate'] as DaemonId[] };
    daemonsAfterMatrix(ctx, g, false);
    expect([g.stacks.rotate, g.upsUsed]).toEqual([4, undefined]);
  });
});

describe('Hotkey and Compiler', () => {
  // AB and BCD uploaded, sharing B: the linked payload scores.
  const ctx = { buf: ['A', 'B', 'C', 'D'], path: [[0, 0], [4, 0], [4, 2], [0, 2]] as [number, number][], targets: [['A', 'B'], ['B', 'C', 'D'], ['X', 'Y']], l: 8, n: 5 };
  it('Hotkey raises the chosen payload while installed', () => {
    const s = { ...newRunState(1), items: ['hotkey'] as ItemId[], payLevels: { linked: 2 } };
    expect(payLevel(s, 'linked')).toBe(2); // nothing chosen yet
    setHotkey(s, 'linked');
    expect([payLevel(s, 'linked'), payLevel(s, 'multi'), payBase(s, 'linked')]).toEqual([4, 1, 2]);
    expect(payLevel({ ...s, items: ['hotkey2'] }, 'linked')).toBe(5);
  });
  it('patch.zip levels the base, not the Hotkey bonus', () => {
    const s = { ...newRunState(5), credits: 10, items: ['hotkey'] as ItemId[] };
    buyZip(s);
    const [id, n] = s.zipOpen![0] as [PayloadId, number];
    setHotkey(s, id);
    pickZip(s, 0);
    expect([payBase(s, id), payLevel(s, id)]).toEqual([1 + n, 3 + n]);
  });
  it('selling the Hotkey drops its bonus', () => {
    const s = { ...newRunState(1), items: ['hotkey'] as ItemId[] };
    setHotkey(s, 'single');
    expect(sell(s, 'hotkey')).toBe(true);
    expect([s.hotkey, payLevel(s, 'single')]).toEqual([undefined, 1]);
  });
  it('Compiler levels a payload every 3rd time it scores, for good', () => {
    const s = { ...newRunState(1), items: ['compiler'] as ItemId[] };
    finishMatrix(s, ctx, false);
    finishMatrix(s, ctx, false);
    expect(payBase(s, 'linked')).toBe(1);
    finishMatrix(s, ctx, false);
    expect(payBase(s, 'linked')).toBe(2);
    expect(s.events!.some((e) => e === 'Compiler · linked.bin Lv2')).toBe(true);
    sell(s, 'compiler');
    expect(payBase(s, 'linked')).toBe(2);
  });
});

describe('Bitshift', () => {
  it('rotates a target one code to the left', () => {
    expect(rotateTarget(['A', 'B', 'C'])).toEqual(['B', 'C', 'A']);
    expect(rotateTarget(rotateTarget(['A', 'B', 'C']))).toEqual(['C', 'A', 'B']);
    expect(rotateTarget(['A', 'B'])).toEqual(['B', 'A']);
  });
  it('is a tool', () => {
    expect(TOOLS.bitshift).toBe('shift');
  });
});

describe('Exploit', () => {
  const same = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];
  it('places $ cells apart from the other item cells, the same for a seed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const p = generate(seed, sectionMatrix(1));
      const rep: [number, number] = p.path![1];
      const a = placeCells(seed, p, ['wildcard1', 'datanode3', 'exploit2'], rep);
      expect(a.cash.length).toBe(2);
      expect(a.cash.some((c) => [a.wild!, ...a.nodes, rep].some((q) => same(c, q)))).toBe(false);
      expect(same(a.cash[0], a.cash[1])).toBe(false);
      expect(placeCells(seed, p, ['wildcard1', 'datanode3', 'exploit2'], rep)).toEqual(a);
      // Owning an Exploit leaves the other cells where they were.
      expect(placeCells(seed, p, ['wildcard1', 'datanode3'], rep)).toEqual({ ...a, cash: [] });
      expect(placeCells(seed, p, ['exploit']).cash.length).toBe(1);
    }
  });
  it('pays +$1 per $ cell on the path, once each', () => {
    const ctx = { buf: ['A', 'B', 'A'], path: [[0, 0], [2, 0], [0, 0]] as [number, number][], targets: [['A', 'B']], l: 6, n: 5, cash: [[0, 0], [3, 3]] as [number, number][] };
    const s = { ...newRunState(1), items: ['exploit2'] as ItemId[] };
    finishMatrix(s, ctx, true);
    expect(s.earned.filter(([why]) => why === 'Exploit')).toEqual([['Exploit', 1]]);
    const none = { ...newRunState(1), items: ['exploit'] as ItemId[] };
    finishMatrix(none, { ...ctx, buf: ['Q'] }, true); // no upload still pays
    expect(none.earned.filter(([why]) => why === 'Exploit')).toEqual([['Exploit', 1]]);
  });
});

describe('Snapshot', () => {
  // A room with more than one matrix, one of them played.
  const room = () => {
    const s = { ...newRunState(1), items: ['snapshot'] as ItemId[] };
    s.section = sections(s).findIndex((x) => x.matrices > 1);
    s.scores[s.section] = [100];
    return s;
  };
  it('is offered once per room, after a full matrix with another matrix to come', () => {
    const s = room();
    expect([canSnapshot(s, true), canSnapshot(s, false), canSnapshot({ ...s, items: [] }, true)]).toEqual([true, false, false]);
    const last = { ...s, scores: s.scores.map((x, k) => (k === s.section ? Array(sections(s)[k].matrices).fill(1) : x)) };
    expect(canSnapshot(last, true)).toBe(false);
    takeSnapshot(s, 42);
    expect(canSnapshot(s, true)).toBe(false);
    s.data = quota(s);
    nextSection(s);
    s.section = room().section;
    s.scores[s.section] = [100];
    expect([s.snap, canSnapshot(s, true)]).toEqual([undefined, true]);
  });
  it('the next matrix replays the saved board, then the run goes on', () => {
    const s = room();
    s.matrix = 5;
    takeSnapshot(s, 42);
    expect([nextSeed(s), s.matrix]).toEqual([42, 6]);
    expect([nextSeed(s), s.matrix]).toEqual([stageSeed(s.seed, 6), 7]);
  });
  it('an early exit drops a saved board', () => {
    const s = room();
    s.data = quota(s);
    takeSnapshot(s, 42);
    expect(exitRoom(s)).not.toBe('continue');
    expect(s.snap).toBeUndefined();
  });
});

describe('review fixes', () => {
  it('the Snapshot replay route drops the pick Rewind took back', () => {
    const b = dealBoard(5, { ...newRunState(1), items: ['rewind'] as ItemId[] });
    b.run.path = [[0, 1], [3, 1], [0, 1], [0, 4]] as [number, number][];
    b.m.undone = 1;
    expect(replayRoute(b)).toEqual([[0, 1], [0, 1], [0, 4]]);
    b.m.undone = undefined;
    expect(replayRoute(b)).toHaveLength(4);
  });
  it('a pick while Bitshift is armed counts as no tool and disarms it', () => {
    const b = dealBoard(5, { ...newRunState(1), items: ['bitshift'] as ItemId[] });
    b.armed = 'shift';
    applyPick(b, 0, 0);
    expect([b.m.tools, b.armed, b.run.path.length]).toEqual([false, null, 1]);
  });
});
