// localStorage can throw (private mode, blocked storage); the game must still run.
export function load<T>(k: string): T | null {
  try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; }
}
export function save(k: string, v: unknown): void {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}

// Daily puzzles are keyed by UTC date so everyone worldwide gets the same one.
export const utcDate = (d = new Date()) => d.toISOString().slice(0, 10);

const EPOCH = Date.UTC(2026, 10, 1);
export const dayNumber = (d = new Date()) =>
  Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - EPOCH) / 864e5) + 1;
