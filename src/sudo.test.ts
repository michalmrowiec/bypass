import { describe, expect, it } from 'vitest';
import { book, type SudoRun, type SudoSave } from './sudo';

const fresh = (): [SudoRun, SudoSave] => [{ n: 0, room: '', used: [] }, { seen: [], log: [] }];

describe('Sudo budget', () => {
  it('says one thing per room; run-end lines always get through', () => {
    const [run, sv] = fresh();
    expect(book('close', 'close', run, sv, '0.0')).toBe(true);
    expect(book('split1', 'split1', run, sv, '0.0')).toBe(false);
    expect(book('intro', 'intro', run, sv, '0.0')).toBe(false);
    expect(book('lose', 'lose', run, sv, '0.0')).toBe(true);
  });

  it('one-time lines stay outside the budget and never repeat', () => {
    const [run, sv] = fresh();
    run.n = 5;
    expect(book('ice', 'ice:blackout', run, sv, '0.1')).toBe(true);
    expect(book('ice', 'ice:blackout', run, sv, '0.2')).toBe(false);
    expect(book('ice', 'ice:flood', run, sv, '0.2')).toBe(true);
  });

  it('reactions (legendaries) skip the room rule but never repeat', () => {
    const [run, sv] = fresh();
    expect(book('close', 'close', run, sv, '0.1')).toBe(true);
    expect(book('legend2', 'legend2', run, sv, '0.1')).toBe(true);
    expect(book('legend2', 'legend2', run, sv, '0.2')).toBe(false);
  });

  it('three comments per run, a wow up to five, each kind once', () => {
    const [run, sv] = fresh();
    expect(['close', 'split1', 'script'].map((id, i) => book(id as 'close', id, run, sv, '0.' + i))).toEqual([true, true, true]);
    expect(book('whiff', 'whiff', run, sv, '0.3')).toBe(false);
    expect(book('record', 'record', run, sv, '0.4')).toBe(true);
    expect(book('record', 'record', run, sv, '0.5')).toBe(false);
    expect(book('paint', 'paint', run, sv, '0.6')).toBe(true);
    expect(book('cron', 'cron', run, sv, '0.7')).toBe(false);
  });

  it('stays silent when switched off', () => {
    const [run, sv] = fresh();
    sv.off = true;
    expect(book('intro', 'intro', run, sv, '0.0')).toBe(false);
    expect(book('lose', 'lose', run, sv, '0.0')).toBe(false);
  });
});
