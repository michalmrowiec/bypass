// What ui.ts needs from the 3D patch.zip without pulling three.js into the main bundle (zip3d.ts loads lazily).
export type ZipCard = { id: string; n: number; lv: number; eff: string; text: string; buf: readonly string[]; l: number; targets: readonly (readonly string[])[]; plays: number };
export type ZipOpts = { opened: boolean; animate: boolean; onOpen: () => void; onPick: (i: number, img?: string) => void };

let ok: boolean | undefined;
export const webglOk = () => {
  if (ok === undefined) try { const c = document.createElement('canvas'); ok = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { ok = false; }
  return ok;
};
