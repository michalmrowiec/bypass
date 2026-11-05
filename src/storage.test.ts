import { beforeEach, describe, expect, it } from 'vitest';
import { firstResult, parseBackup, recordFirst } from './storage';

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
