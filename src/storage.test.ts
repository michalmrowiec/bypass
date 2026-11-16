import { beforeEach, describe, expect, it } from 'vitest';
import { bestRun, firstResult, parseBackup, recordBest, recordFirst, recordWin, setBreached, wins } from './storage';
import { COMPANIES, entriesOpen, entryKey } from './roguelike';

beforeEach(() => {
  const m = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } as Storage;
});

describe('recordFirst', () => {
  it('keeps only the first result per id', () => {
    expect(recordFirst('normal.1', 42000)).toBe(true);
    expect(recordFirst('normal.1', 30000)).toBe(false);
    expect(firstResult('normal.1')).toBe(42000);
  });

  it('knows nothing about ids never cleared', () => {
    expect(firstResult('sprint3.6')).toBeUndefined();
  });

  it('drops the oldest ids past the cap', () => {
    for (let i = 0; i < 501; i++) recordFirst('easy.' + i, i);
    expect(firstResult('easy.0')).toBeUndefined();
    expect(firstResult('easy.500')).toBe(500);
  });
});

describe('parseBackup', () => {
  it('accepts only bypass save files', () => {
    const data = { 'bypass:breached': '["kestrel"]', 'bypass:run': '{"v":1}' };
    expect(parseBackup(JSON.stringify({ game: 'bypass', v: 1, data }))).toEqual(data);
    expect(parseBackup('not json')).toBeNull();
    expect(parseBackup(JSON.stringify({ game: 'other', data }))).toBeNull();
    expect(parseBackup(JSON.stringify({ game: 'bypass', data: { 'other:key': '1' } }))).toBeNull();
    expect(parseBackup(JSON.stringify({ game: 'bypass', data: { 'bypass:x': 5 } }))).toBeNull();
    expect(parseBackup(JSON.stringify({ game: 'bypass', data: { 'bypass:x': '{broken' } }))).toBeNull();
  });
});

describe('recordBest', () => {
  it('keeps the run with more data, a tie going to the faster one', () => {
    expect(recordBest('kestrel', { data: 900, ms: 60000, won: false })).toBe(true);
    expect(recordBest('kestrel', { data: 800, ms: 1000, won: true })).toBe(false);
    expect(recordBest('kestrel', { data: 900, ms: 50000, won: true })).toBe(true);
    expect(bestRun('kestrel')).toEqual({ data: 900, ms: 50000, won: true });
  });
});

describe('wins and entries', () => {
  it('a company breached before wins existed counts as 1 win', () => {
    setBreached(['kestrel']);
    expect([wins('kestrel'), wins('meridian')]).toEqual([1, 0]);
  });

  it('recordWin increments and also records the breach', () => {
    expect(recordWin('meridian')).toBe(1);
    expect(recordWin('meridian')).toBe(2);
    expect(wins('meridian')).toBe(2);
    setBreached([]);
    expect(wins('meridian')).toBe(2);
  });

  it('entriesOpen caps at 3', () => {
    expect([0, 1, 2, 5].map(entriesOpen)).toEqual([1, 2, 3, 3]);
  });

  it('the default entry keeps the old record key', () => {
    const co = COMPANIES[0];
    expect(entryKey(co, co.entries[0].id)).toBe(co.id);
    expect(entryKey(co, co.entries[1].id)).toBe(co.id + '/' + co.entries[1].id);
  });
});
