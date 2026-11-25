// What ui.ts needs from the 3D daemon pack without pulling three.js into the main bundle (pack3d.ts loads lazily).
export type PackRarity = 'common' | 'rare' | 'legendary';
export type PackView = {
  fams: string[]; // lowercase family ids, in the pack's colour order
  tier?: 'rare' | 'legendary'; // the guarantee printed on the case
  emblem?: string; // the emblem word, e.g. "LEGENDARY ×2" (default: the tier)
  name: string; // "ghost+runner.tgz"
  sub: string; // "4 daemons · 2 families"
  rars: PackRarity[]; // per card, in reveal order
};
export type PackOpts = {
  animate: boolean;
  onPick: () => void; // the sealed case was clicked: the dialog decides whether this pack opens
  card: (i: number) => string; // the game's 2D card markup for card i
  onCard: (el: HTMLElement, i: number) => void; // wire a handed-over 2D card (click, hover)
  log: (html: string) => void;
  onDone?: () => void;
};
export type PackHandle = { open: () => void; dispose: () => void };
