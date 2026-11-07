import { describe, expect, it } from 'vitest';
import { COMPANIES, dealRunMatrix, newRunState, type RunState } from './roguelike';
import { BLOCK } from './generator';
import { newRun, pick, WILD } from './game';
import { applyPick, canPick, cellView, dealBoard, hasMoves, isStuck, jumpReady, lastPick, rewind, EMPTY_CTX, emptyItems, type Board, type Ctx } from './matrix';

// 5x5 board with codes 'A'..'Y' in reading order.
const grid = () => Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => String.fromCharCode(65 + r * 5 + c)));
const board = (ctx: Partial<Ctx> = {}, over: Partial<Board> = {}): Board =>
  ({ puzzle: { grid: grid(), targets: [['A', 'B']], l: 4 }, run: newRun(), m: emptyItems(), armed: null, ctx: { ...EMPTY_CTX, ...ctx }, over: false, ...over });
const at = (b: Board, r: number, c: number) => { pick(b.run, b.puzzle, r, c); return b; };

describe('cell rules', () => {
  it('encryption hides codes off the lane', () => {
    const b = board({ ice: ['encryption'] });
    expect(cellView(b, 0, 3).hidden).toBe(false);
    expect(cellView(b, 2, 2)).toMatchObject({ hidden: true, code: 'M' });
    expect(cellView(b, 2, 2).cls).toContain('enc');
  });

  it('an armed bridge sees the 8 cells around the last pick', () => {
    const b = at(board({ ice: ['encryption'] }), 0, 2);
    b.armed = 'jump';
    expect(cellView(b, 1, 1).hidden).toBe(false);
    expect(cellView(b, 3, 3).hidden).toBe(true);
  });

  it('side door opens every edge before the first pick', () => {
    const b = board({ items: ['sidedoor'] });
    expect([canPick(b, 4, 0), canPick(b, 2, 4), canPick(b, 2, 2)]).toEqual([true, true, false]);
  });

  it('mux opens the row and column of the last pick', () => {
    const b = at(board(), 0, 2);
    expect(canPick(b, 0, 4)).toBe(false);
    b.armed = 'mux';
    expect([canPick(b, 0, 4), canPick(b, 3, 3)]).toEqual([true, false]);
  });

  it('a wildcard cannot go on the repeater cell', () => {
    const b = board({}, { armed: 'wild' });
    b.m.rep = [1, 1];
    expect([canPick(b, 1, 1), canPick(b, 2, 3)]).toEqual([false, true]);
  });

  it('a burning cell shows the moves left and is closed', () => {
    const b = board();
    b.run.burn = 2;
    at(b, 0, 2);
    expect(cellView(b, 1, 2)).toMatchObject({ burnLeft: 2 });
    expect(canPick(b, 1, 2)).toBe(false);
  });

  it('a board outside a run shows plain cells', () => {
    const b = board();
    b.puzzle.grid[1][1] = BLOCK;
    expect(cellView(b, 1, 1).cls).toEqual(['ice']);
    expect(cellView(b, 0, 0)).toEqual({ code: 'A', hidden: false, cls: ['lane'], tags: [] });
  });
});

const BOSS = COMPANIES[0].sections.length - 1;
const st = (over: Partial<RunState> = {}): RunState => ({ ...newRunState(3), section: BOSS, ...over });

describe('dealBoard', () => {
  it('is deterministic for a seed and run state', () => {
    const s = st({ items: ['repeater', 'wildcard1', 'datanode'], ice: 'honeypot' });
    expect(dealBoard(11, s)).toEqual(dealBoard(11, s));
  });

  it('matches the old dealRunMatrix grid when no item reshapes it', () => {
    expect(dealBoard(7, st()).puzzle).toEqual(dealRunMatrix(7, st()));
  });

  it('arms one-shot tools from the rack', () => {
    const b = dealBoard(5, st({ items: ['bridge', 'mux', 'rewind'] }));
    expect([b.m.jump, b.m.mux, b.m.rewind, b.m.loop]).toEqual([true, true, true, false]);
  });

  it('places the honeypot only under Honeypot ICE', () => {
    expect(dealBoard(5, st({ ice: 'honeypot' })).m.trap).toBeDefined();
    expect(dealBoard(5, st()).m.trap).toBeUndefined();
  });
});

describe('pick rules', () => {
  it('the repeater cell puts its code in twice', () => {
    const b = board();
    b.m.rep = [0, 1];
    applyPick(b, 0, 1);
    expect(b.run.buffer).toEqual(['B', 'B']);
  });

  it('the repeater skips the second code on a full buffer', () => {
    const b = board();
    b.m.rep = [0, 1];
    b.puzzle.l = 1;
    applyPick(b, 0, 1);
    expect(b.run.buffer).toEqual(['B']);
  });

  it('a wildcard places ** without a move', () => {
    const b = board({}, { armed: 'wild' });
    b.m.wild = true;
    expect(applyPick(b, 2, 2)).toBe('placed');
    expect([b.run.path.length, b.puzzle.grid[2][2], b.m.wild, b.armed]).toEqual([0, WILD, false, null]);
  });

  it('bridge v1.0 reaches only the 8 cells around the last pick, v2.0 the whole matrix', () => {
    const b = at(board({ items: ['bridge'] }), 0, 2);
    b.armed = 'jump';
    expect([canPick(b, 1, 1), canPick(b, 1, 3), canPick(b, 3, 3)]).toEqual([true, true, false]);
    expect(jumpReady({ ...board({ items: ['bridge'] }), m: { ...emptyItems(), jump: true } })).toBe(false);
    const far = at(board({ items: ['bridge2'] }), 0, 2);
    far.armed = 'jump';
    expect(canPick(far, 3, 3)).toBe(true);
  });

  it('a bridge v1.0 with no free neighbour is no move left', () => {
    const b = at(board({ items: ['bridge'] }), 0, 2);
    b.m.jump = true;
    expect(hasMoves(b)).toBe(true);
    for (const [r, c] of [[0, 1], [0, 3], [1, 1], [1, 2], [1, 3]]) b.puzzle.grid[r][c] = BLOCK;
    expect(hasMoves(b)).toBe(false);
  });

  it('a bridge off the lane records a jump', () => {
    const b = board({ items: ['bridge2'] }, { armed: 'jump' });
    b.m.jump = true;
    expect(applyPick(b, 3, 3)).toBe('picked');
    expect([b.m.jumps, b.m.jump, b.m.tools]).toEqual([[0], false, true]);
  });

  it('an unused rewind keeps a dead end open', () => {
    const b = board();
    b.puzzle.targets = [['Z', 'Z']];
    b.m.rewind = true;
    applyPick(b, 0, 0);
    expect(isStuck(b, true)).toBe(false);
    expect(hasMoves(b)).toBe(true);
    b.m.rewind = false;
    expect(isStuck(b, true)).toBe(true);
  });

  it('rewinding a mux pick does not give the mux back', () => {
    const b = board();
    b.m.rewind = true;
    applyPick(b, 0, 2);
    b.armed = 'mux';
    b.m.mux = true;
    applyPick(b, 0, 4);
    rewind(b);
    expect([b.run.free, b.run.axis, b.run.idx, b.m.mux]).toEqual([undefined, 'col', 2, false]);
  });

  it('rewind frees the last cell and adds a slot, once', () => {
    const b = board();
    b.m.rewind = true;
    applyPick(b, 0, 0);
    expect(rewind(b)).toBe(true);
    expect([b.run.used.has('0,0'), b.run.axis, b.run.idx, b.puzzle.l]).toEqual([false, 'row', 0, 5]);
    expect(rewind(b)).toBe(false);
  });

  it('after a rewind the last pick is the one before, until the next pick', () => {
    const b = board();
    b.m.rewind = true;
    applyPick(b, 0, 2);
    applyPick(b, 3, 2);
    rewind(b);
    expect([lastPick(b), b.m.kept]).toEqual([[0, 2], 1]);
    applyPick(b, 4, 2);
    expect(lastPick(b)).toEqual([4, 2]);
  });
});
