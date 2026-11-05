// localStorage can throw (private mode, blocked storage); the game must still run.
export function load<T>(k: string): T | null {
  try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; }
}
export function save(k: string, v: unknown): void {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}

// First clear time per matrix/sprint id, so replays can't improve a shared score.
const PLAYED = 'bypass:played';
const PLAYED_MAX = 500;
export const firstResult = (id: string): number | undefined => load<Record<string, number>>(PLAYED)?.[id];
// Saves the time if this id has none yet; returns whether it did. Oldest ids are dropped past PLAYED_MAX.
export function recordFirst(id: string, time: number): boolean {
  const all = load<Record<string, number>>(PLAYED) ?? {};
  if (id in all) return false;
  all[id] = time;
  const ids = Object.keys(all);
  for (const old of ids.slice(0, Math.max(0, ids.length - PLAYED_MAX))) delete all[old];
  save(PLAYED, all);
  return true;
}

// Run mode: ids of the companies breached so far; each one opens the next.
const BREACHED = 'bypass:breached';
export const breached = (): string[] => load<string[]>(BREACHED) ?? [];
export const setBreached = (ids: string[]) => save(BREACHED, ids);
// Adds a breached company; returns whether it is new.
export function recordBreach(id: string): boolean {
  const all = breached();
  if (all.includes(id)) return false;
  setBreached([...all, id]);
  return true;
}

// Daily puzzles are keyed by UTC date so everyone worldwide gets the same one.
export const utcDate = (d = new Date()) => d.toISOString().slice(0, 10);

const EPOCH = Date.UTC(2026, 10, 1);
export const dayNumber = (d = new Date()) =>
  Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / 864e5) + 1;
