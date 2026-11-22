// @ts-nocheck -- drawing code ported as-is from the concept page (.notes/item-svg/itemy-koncepty.html)
import type { ItemId } from './roguelike';
import './gearGlass.css';

// Glass-style item art (viewBox 150x84). Every class gets a q- prefix so it never meets the game's own CSS.
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="pd-case" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46515c"/><stop offset=".18" stop-color="#28313a"/><stop offset=".75" stop-color="#171d23"/><stop offset="1" stop-color="#0c1014"/></linearGradient>
    <linearGradient id="pd-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c343c"/><stop offset="1" stop-color="#0d1115"/></linearGradient>
    <linearGradient id="pd-pcb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#123326"/><stop offset="1" stop-color="#06140e"/></linearGradient>
    <linearGradient id="pd-key" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e8ed"/><stop offset=".4" stop-color="#9aa5af"/><stop offset=".75" stop-color="#5a636c"/><stop offset="1" stop-color="#8f99a3"/></linearGradient>
    <linearGradient id="pd-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".5" stop-color="#d4a23a"/><stop offset="1" stop-color="#8a6516"/></linearGradient>
    <linearGradient id="pd-bevel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>
    <linearGradient id="pd-scr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2a1f"/><stop offset="1" stop-color="#03100b"/></linearGradient>
    <linearGradient id="pd-sheen" x1="0" y1="0" x2="1" y2=".35"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="pd-hot2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5af2a8"/><stop offset="1" stop-color="#4fc8ff"/></linearGradient>
    <linearGradient id="pd-hot3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5af2a8"/><stop offset=".5" stop-color="#b46bff"/><stop offset="1" stop-color="#ff4d7d"/></linearGradient>
    <radialGradient id="pd-ember"><stop offset="0" stop-color="#ffd27a"/><stop offset=".4" stop-color="#ff7a2e" stop-opacity=".8"/><stop offset="1" stop-color="#ff4d2e" stop-opacity="0"/></radialGradient>
    <linearGradient id="pd-cable" gradientUnits="userSpaceOnUse" x1="6" y1="0" x2="30" y2="0"><stop offset="0" stop-color="#3a7d5f" stop-opacity="0"/><stop offset=".6" stop-color="#3a7d5f"/></linearGradient>
    <pattern id="pd-pins" width="2.6" height="6" patternUnits="userSpaceOnUse"><rect width="1.8" height="6" fill="url(#pd-gold)"/></pattern>
    <pattern id="pd-vpins" width="6" height="2.2" patternUnits="userSpaceOnUse"><rect width="6" height="1.4" fill="url(#pd-gold)"/></pattern>
    <linearGradient id="pd-alu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6eaee"/><stop offset=".25" stop-color="#b4bcc4"/><stop offset=".7" stop-color="#8a939c"/><stop offset="1" stop-color="#5c646c"/></linearGradient>
    <linearGradient id="pd-anod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6a80"/><stop offset=".15" stop-color="#323e4e"/><stop offset=".7" stop-color="#1c2430"/><stop offset="1" stop-color="#0f141b"/></linearGradient>
    <linearGradient id="pd-holo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5af2a8"/><stop offset=".35" stop-color="#7ab8ff"/><stop offset=".65" stop-color="#c58bff"/><stop offset="1" stop-color="#5af2a8"/></linearGradient>
    <linearGradient id="pd-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f5"/><stop offset=".35" stop-color="#a5afb8"/><stop offset=".6" stop-color="#5f6870"/><stop offset="1" stop-color="#b9c1c8"/></linearGradient>
    <pattern id="pd-brush" width="150" height="1.1" patternUnits="userSpaceOnUse"><rect width="150" height=".4" fill="#fff" opacity=".12"/></pattern>
    <pattern id="pd-burn" width="5.6" height="5.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="2.8" height="5.6" fill="#ff3d8b" opacity=".16"/></pattern>
    <pattern id="pd-scan" width="4" height="1.6" patternUnits="userSpaceOnUse"><rect width="4" height=".6" fill="#000" opacity=".35"/></pattern>
    <filter id="pd-glow" filterUnits="userSpaceOnUse" x="-20" y="-20" width="190" height="124"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="pd-soft" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="2.2"/></filter></defs></svg>`);

/* ---------- helpers ---------- */
const bevel = (x, y, w, h, r, o = 1) => `<rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="${Math.max(0, r - .5)}" fill="none" stroke="url(#pd-bevel)" stroke-width="1" opacity="${o}"/>`;
const bar = (x, y, w, h = 1.2, f) => `<rect class="bar" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" filter="url(#pd-glow)"${f ? ` style="fill:url(#${f})"` : ''}/>`;
const led = (x, y) => `<circle class="led" cx="${x}" cy="${y}" r="1.5" filter="url(#pd-glow)"/>`;
const txt = (x, y, s, size, extra = '', anchor = 'middle') => `<text class="t" x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" ${extra}>${s}</text>`;
const icon = (x, y, s) => `<g class="di" transform="translate(${x} ${y}) scale(${s})"><path d="M10 2h7l4 4v11h-5"/><path d="M4 7h8l4 4v11H4z"/><path d="M12 7v4h4"/></g>`;
const disp = (x, y, w, h, inner) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.8" fill="url(#pd-scr)" stroke="#000" stroke-opacity=".6" stroke-width=".5"/>
  <g filter="url(#pd-glow)">${inner}</g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.8" fill="url(#pd-scan)"/>
  <polygon points="${x},${y} ${x + w * .5},${y} ${x + w * .32},${y + h} ${x},${y + h}" fill="#fff" opacity=".05"/>`;
const R = (x, y, w, h, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
const withFill = (shape, attrs) => shape.replace(/\/>$/, ` ${attrs}/>`);

/* ---------- designs: return [clip shape, body] ---------- */
function buffer(t) {
  const n = t ? 6 : 5, extra = t ? 2 : 1, w = t ? 10 : 11, gap = t ? 12.4 : 14, x0 = t ? 30 : 32;
  const codes = ['1C', 'E9', '55', 'BD', '7A', 'FF'];
  const sh = R(24, 25, 102, 26, 2);
  let s = '';
  if (t) s += `<g transform="translate(16 -12)">
      <rect x="22" y="30" width="106" height="24" rx="2" fill="url(#pd-pcb)"/>
      <rect x="26" y="53" width="51" height="5" fill="url(#pd-pins)"/><rect x="82" y="53" width="42" height="5" fill="url(#pd-pins)"/>
      <rect x="24" y="25" width="102" height="26" rx="2" fill="url(#pd-dark)"/>` + bevel(24, 25, 102, 26, 2, .8) +
      `<path d="M30 29h3M36 29h3M42 29h3M48 29h3M54 29h3M60 29h3M66 29h3M72 29h3M78 29h3M84 29h3M90 29h3M96 29h3M102 29h3M108 29h3M114 29h3" stroke="#000" stroke-opacity=".55" stroke-width="1.6"/>` +
      bar(28, 26.2, 94, .9, 'pd-hot2') + `<rect x="126" y="30" width="2" height="22" fill="#000" opacity=".3"/></g>
      <rect x="24" y="23" width="104" height="3" rx="1" fill="#000" opacity=".55" filter="url(#pd-soft)"/>`;
  s += `<rect x="22" y="30" width="106" height="24" rx="2" fill="url(#pd-pcb)"/>
    <rect x="26" y="53" width="51" height="5" fill="url(#pd-pins)"/><rect x="82" y="53" width="42" height="5" fill="url(#pd-pins)"/>` +
    withFill(sh, 'fill="url(#pd-case)"') + bevel(24, 25, 102, 26, 2) + bar(28, 26.2, 94, .9, t ? 'pd-hot2' : null);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap, ex = i >= n - extra, cx = x + w / 2;
    s += `<rect class="${ex ? 'xslot' : ''}" x="${x}" y="${30}" width="${w}" height="15" rx="1.5" fill="#070b0e" stroke="${ex ? '#5af2a8' : '#fff'}" stroke-opacity="${ex ? .9 : .1}" stroke-width=".6" ${ex ? 'stroke-dasharray="1.6 1.2"' : ''}/>`;
    if (ex) s += `<g class="x-idle">${txt(cx, 39.6, '+1', 5.5, 'opacity=".85"')}</g>`;
    s += `<g class="code" style="--i:${i}" filter="url(#pd-glow)">${txt(cx, 39.4, codes[i], 4.6)}</g>`;
  }
  s += `<text class="silk" x="${t ? 115 : 113}" y="40" font-size="4.2" text-anchor="middle">DDR</text>`;
  return [sh, s];
}
// M.2 stick: gold fingers, controller, a label printed with a mini matrix; the route lights through the data cell, then banks
function m2(t, val) {
  const cw = 6.6, chh = 4.4, g = 1.2, gx = 53, gy = 34.2;
  const ctr = (c, r) => [gx + c * (cw + g) + cw / 2, gy + r * (chh + g) + chh / 2];
  const path = [[0, 2], [1, 2], [1, 1], [2, 1], [3, 1], [3, 0], [4, 0]];
  let s = `<rect x="14" y="33" width="9" height="18" rx="1" fill="#14191e"/><rect x="15.5" y="34.5" width="6" height="7" fill="url(#pd-vpins)"/><rect x="15.5" y="43" width="6" height="6.5" fill="url(#pd-vpins)"/>
    <path d="M22 30h110v9a3 3 0 0 0 0 6v9H22z" fill="url(#pd-pcb)" stroke="#000" stroke-opacity=".5" stroke-width=".5"/>
    <path d="M44 36h5M44 42h5M44 48h5" stroke="#5af2a8" stroke-opacity=".25" stroke-width=".5"/>
    <rect x="27" y="34" width="15" height="16" rx="1" fill="#0b0f12" stroke="#fff" stroke-opacity=".1" stroke-width=".4"/>`;
  if (t) {
    // low-profile heat spreader over the controller only
    s += `<rect x="26" y="33" width="17" height="18" rx="1" fill="url(#pd-dark)" stroke="#000" stroke-opacity=".5" stroke-width=".5"/>` + bevel(26, 33, 17, 18, 1, .8);
    for (let x = 28; x < 41; x += 2.6) s += `<rect x="${x}" y="35" width="1.2" height="14" rx=".4" fill="#07090b"/><rect x="${x + 1.2}" y="35" width=".3" height="14" fill="#fff" opacity=".12"/>`;
    s += bar(50, 30.4, 76, .7, t === 2 ? 'pd-hot3' : 'pd-hot2');
  }
  s += `<rect x="50" y="32" width="76" height="20" rx="1.2" fill="#070b0e" stroke="#fff" stroke-opacity=".1" stroke-width=".4"/>`;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) if (!(c === 2 && r === 1))
    s += `<rect x="${gx + c * (cw + g)}" y="${gy + r * (chh + g)}" width="${cw}" height="${chh}" rx=".6" fill="#0c1a15" stroke="#5af2a8" stroke-opacity=".12" stroke-width=".35"/>`;
  s += `<path class="route" d="M${path.map(p => ctr(...p).join(' ')).join('L')}" pathLength="100" fill="none" stroke="#5af2a8" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" filter="url(#pd-glow)"/>
    <g class="ncell dv" style="--d:.45s"><rect x="${gx + 2 * (cw + g)}" y="${gy + chh + g}" width="${cw}" height="${chh}" rx=".6" fill="#5af2a8" fill-opacity=".3" stroke="#5af2a8" stroke-width=".5" filter="url(#pd-glow)"/></g>
    <g class="pulse2 dv">${txt(117.5, 42.6, val, 6.5, '', 'end')}${icon(118.2, 36.6, .27)}</g>
    <rect class="btrack" x="96" y="46.5" width="28" height="1.8" rx=".9" fill="#5af2a8" fill-opacity=".18"/><rect class="bank2" x="96" y="46.5" width="28" height="1.8" rx=".9" fill="#5af2a8"/>` + led(129, 35.5);
  return s;
}
function datanode(t) {
  if (t < 2) return [R(14, 30, 118, 24, 1), m2(t, t ? '+40' : '+15')];
  // RAID: two v2 sticks staggered, like the dual Buffer
  return [R(18, 38, 118, 24, 1), `<g transform="translate(-4 -10)">${m2(2, '+60')}</g>
    <rect x="20" y="36.5" width="114" height="3" fill="#000" opacity=".55" filter="url(#pd-soft)"/><g transform="translate(4 8)">${m2(2, '+60')}</g>`];
}
// --- thumb drive: mid-thickness body, slim-style materials ---
const CONN = `<rect x="104" y="30" width="30" height="24" rx="1.5" fill="url(#pd-steel)"/><rect x="104" y="30" width="30" height=".8" fill="#fff" opacity=".7"/>
  <rect class="hole" x="113" y="36" width="5" height="5" rx=".6"/><rect class="hole" x="123" y="36" width="5" height="5" rx=".6"/>
  <line x1="106" y1="47.5" x2="133" y2="47.5" stroke="#000" stroke-opacity=".25" stroke-width=".6"/>`;
// screen content authored at 53x23 (centre 65,42), scaled into the rect
function scr(x, y, w, h, plus, bezel = true) {
  const s = Math.min(w / 53, h / 23), cx = x + w / 2, cy = y + h / 2;
  return (bezel ? `<rect x="${x - 2.5}" y="${y - 2.5}" width="${w + 5}" height="${h + 5}" rx="${Math.min(4, h / 5)}" fill="#070a0c" stroke="#fff" stroke-opacity=".08" stroke-width=".6"/>` : '') +
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="url(#pd-scr)"/>
  <g class="scr-c" filter="url(#pd-glow)"><g transform="translate(${cx} ${cy}) scale(${s}) translate(-65 -42)">
    <g class="idle-g"><text class="t-num" x="66" y="45.5" text-anchor="end">+${plus}</text>
      <g class="di" transform="translate(69 33.5) scale(.56)"><path d="M10 2h7l4 4v11h-5"/><path d="M4 7h8l4 4v11H4z"/><path d="M12 7v4h4"/></g></g>
    <g class="busy-g"><text class="t-lbl" x="65" y="41" text-anchor="middle">COPY</text>
      <rect class="track" x="44" y="45" width="42" height="3" rx="1.5"/><rect class="fill" x="44" y="45" width="42" height="3" rx="1.5"/></g>
  </g></g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="url(#pd-scan)"/>
  <polygon points="${x},${y} ${x + w * .55},${y} ${x + w * .35},${y + h} ${x},${y + h}" fill="#fff" opacity=".05"/>`;
}
function thumb(t) {
  const plus = [3, 10, 25][t];
  if (t === 0) { const sh = R(16, 24, 92, 36, 7); return [sh, CONN + withFill(sh, 'fill="url(#pd-alu)"') + withFill(sh, 'fill="url(#pd-brush)"') + bevel(16, 24, 92, 36, 7, .7) + scr(44, 32.5, 38, 19, plus) + led(99, 42)]; }
  if (t === 1) { const sh = chamfer(16, 24, 92, 36, 5); return [sh, CONN + withFill(sh, 'fill="url(#pd-anod)" stroke="#000" stroke-opacity=".5" stroke-width=".5"') +
    `<polygon points="21.5,24.5 102.5,24.5 107.5,29.5 107.5,54.5 102.5,59.5 21.5,59.5 16.5,54.5 16.5,29.5" fill="none" stroke="url(#pd-bevel)"/>` + scr(40, 31, 48, 21, plus) + bar(24, 56.6, 76, .9, 'pd-hot2') + led(99, 42)]; }
  const sh = R(16, 24, 92, 36, 7);
  return [sh, CONN + withFill(sh, 'fill="#05080b" stroke="url(#pd-holo)" stroke-width=".9"') +
    `<rect x="16" y="24" width="92" height="36" rx="7" fill="none" stroke="url(#pd-holo)" stroke-opacity=".4" stroke-width="2" filter="url(#pd-glow)"/>` +
    bevel(16, 24, 92, 36, 7, .5) + scr(36, 31, 50, 21, plus, false) + bar(36, 56.6, 50, .9, 'pd-hot3') + led(99, 37.5) + led(99, 46.5)];
}
function priority(t) {
  // router: cable plugged into port 1 only, because only the first upload is boosted
  const sh = R(18, 22, 114, 30, 4), hot = t ? '#ff4d7d' : '#5af2a8';
  let s = `<path d="M32 54V62Q32 68 24 68H6" fill="none" stroke="url(#pd-cable)" stroke-width="3.2" stroke-linecap="round"/>` +
    withFill(sh, 'fill="url(#pd-case)"') + bevel(18, 22, 114, 30, 4) + bar(22, 23.2, 106, .9, t ? 'pd-hot3' : null);
  for (let i = 0; i < 4; i++) {
    const x = 26 + i * 15;
    s += `<rect x="${x}" y="31" width="12" height="11" rx="1" fill="#05080a" stroke="#fff" stroke-opacity=".12" stroke-width=".5"/>
      <rect x="${x + 2}" y="32" width="8" height="2.4" fill="url(#pd-pins)" opacity="${i ? .45 : .9}"/>
      <circle class="${i ? '' : 'pled'}" cx="${x + 6}" cy="27.6" r="1.1" fill="${i ? '#2b3540' : hot}" ${i ? '' : 'filter="url(#pd-glow)"'}/>`;
    if (i) s += `<text class="silk" x="${x + 6}" y="48.5" font-size="4" text-anchor="middle">${i + 1}</text>`;
  }
  s += `<rect x="27.5" y="35" width="9" height="17" rx="1" fill="#d7dde2" opacity=".92"/><rect x="29" y="35" width="6" height="2" fill="url(#pd-pins)"/>
    <rect x="28.5" y="44" width="7" height="2" fill="#9aa5af"/><rect x="28.5" y="50" width="7" height="6" rx="1" fill="#24302b"/>
    <path class="imp" d="M6 68H24Q32 68 32 62V57" pathLength="100" fill="none" stroke="${hot}" stroke-width="2.4" stroke-linecap="round" filter="url(#pd-glow)"/>` +
    `<g class="bx">` + disp(86, 28, 38, 18, txt(105, 41.5, t ? '×4' : '×2', 11, t ? 'style="fill:url(#pd-hot3)"' : '')) + `</g>`;
  return [sh, s];
}
function shortkey() {
  // blade is split into code segments; the tip segment gets chopped off
  const hs = [6, 4, 8, 5, 7, 6], codes = ['1C', 'E9', '55', 'BD', '7A', 'FF'];
  // sheen clip follows the key: bow, blade, tip and each tooth
  const sh = `<circle cx="32" cy="42" r="13"/><rect x="43" y="38" width="75" height="8"/><polygon points="118,38 124,40 124,44 118,46"/>` +
    hs.map((h, i) => `<rect x="${48 + i * 12}" y="45.5" width="8" height="${h}"/>`).join('');
  let s = `<circle cx="32" cy="42" r="13" fill="url(#pd-key)"/><circle cx="32" cy="42" r="5" fill="#0a0e12"/>
    <circle cx="32" cy="42" r="12.5" fill="none" stroke="url(#pd-bevel)"/>
    <rect x="43" y="38" width="63" height="8" rx="1.5" fill="url(#pd-key)"/>`;
  let cut = `<rect x="106" y="38" width="12" height="8" fill="url(#pd-key)"/><polygon points="118,38 124,40 124,44 118,46" fill="url(#pd-key)"/>`;
  hs.forEach((h, i) => {
    const x = 46 + i * 12, piece = `<rect x="${x + 2}" y="45.5" width="8" height="${h}" rx=".8" fill="url(#pd-key)"/><text class="engr" x="${x + 6}" y="43.4" font-size="3.4" text-anchor="middle">${codes[i]}</text>`;
    if (i < 5) s += piece; else cut += piece;
    if (i && i < 5) s += `<path d="M${x} 38.6v6.8" stroke="#000" stroke-opacity=".3" stroke-width=".5"/>`;
  });
  s += `<g class="cut">${cut}</g>
    <line class="snip" x1="106" y1="32" x2="106" y2="60" stroke="#ff4d7d" stroke-width=".8" stroke-dasharray="2 1.5" filter="url(#pd-glow)"/>
    <circle class="spark" cx="106" cy="42" r="6" fill="url(#pd-ember)"/>
    <text x="115" y="33.5" font-size="8.5" text-anchor="middle" class="t" style="fill:#ff4d7d" filter="url(#pd-glow)">−1</text>`;
  return [sh, s];
}
function wildcard(t) {
  const sh = `<circle cx="36" cy="42" r="15"/><rect x="50" y="39" width="72" height="6" rx="1.2"/><polygon points="98,45 102,45 102,51 106,51 106,47 110,47 110,53 114,53 114,45 122,45 122,49 118,49 118,56 98,56"/>`, cx = 36, cy = 42, glyphs = ['1C', 'E9', 'BD', '**'];
  let s = `<rect x="50" y="39" width="72" height="6" rx="1.2" fill="url(#pd-key)"/>
    <polygon points="98,45 102,45 102,51 106,51 106,47 110,47 110,53 114,53 114,45 122,45 122,49 118,49 118,56 98,56" fill="url(#pd-key)"/>` +
    bar(54, 40.8, 60, .8, t ? 'pd-hot3' : null) +
    `<circle cx="${cx}" cy="${cy}" r="15" fill="url(#pd-case)" stroke="#5af2a8" stroke-opacity=".6" stroke-width=".7"/>
    <circle cx="${cx}" cy="${cy}" r="10" fill="#071a12" stroke="#000" stroke-opacity=".6"/>
    <g class="ring spin"><circle cx="${cx}" cy="${cy}" r="12.5" fill="none" stroke="#5af2a8" stroke-opacity=".4" stroke-width=".6" stroke-dasharray="2 2"/></g>
    <g filter="url(#pd-glow)"><g class="w0">${txt(cx, cy + 6, '✱', 16)}</g>` +
    glyphs.map((g, i) => `<g class="w" style="--i:${i}">${txt(cx, cy + (g === '**' ? 3.4 : 2.6), g, g === '**' ? 10 : 7.5, g === '**' ? 'style="fill:#ff4d7d"' : '')}</g>`).join('') + `</g>`;
  if (t) s += `<g class="ret"><g class="retspin spin"><circle cx="${cx}" cy="${cy}" r="19" fill="none" stroke="#ff4d7d" stroke-width=".8" stroke-dasharray="3 2.2" filter="url(#pd-glow)"/>
    <path d="M${cx} ${cy - 23}v6M${cx} ${cy + 17}v6M${cx - 23} ${cy}h6M${cx + 17} ${cy}h6" stroke="#ff4d7d" stroke-width="1"/></g></g>`;
  return [sh, s];
}
function rewind() {
  const sh = R(22, 22, 106, 40, 4), reel = (x, y) => `<g class="reel spin"><circle cx="${x}" cy="${y}" r="8.5" fill="#1a1410" stroke="#3a444e" stroke-width=".8"/>
    <circle cx="${x}" cy="${y}" r="3.6" fill="#c9d1d8"/><path d="M${x} ${y - 3.4}v-4.4M${x - 3} ${y + 1.7}l-3.8 2.2M${x + 3} ${y + 1.7}l3.8 2.2" stroke="#c9d1d8" stroke-width="1.2"/></g>`;
  let btn = ''; for (let i = 0; i < 4; i++) btn += `<rect class="${i ? '' : 'rwb'}" x="${34 + i * 14}" y="52.5" width="11" height="6" rx="1" fill="${i ? '#3a444e' : '#2a5a45'}"/>`;
  return [sh, withFill(sh, 'fill="url(#pd-case)"') + bevel(22, 22, 106, 40, 4) +
    `<rect x="32" y="26" width="86" height="23" rx="3" fill="#05080a" stroke="#fff" stroke-opacity=".1" stroke-width=".5"/>` +
    reel(56, 37.5) + reel(94, 37.5) +
    `<path class="tape" d="M56 46.5H94" stroke="#6b4b33" stroke-width="1.4"/>
    <rect x="32" y="26" width="86" height="23" rx="3" fill="#fff" opacity=".04"/>
    <path d="M38 55.5l2.6-2v4zM41.2 55.5l2.6-2v4z" fill="#0b1015"/>` + btn +
    disp(96, 51.5, 24, 8, txt(108, 57.8, '−1', 6)) + bar(36, 23.2, 78, .8)];
}
function burner() {
  const sh = `<polygon points="28,22 82,22 92,32 92,62 28,62"/>`;
  let m = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m += `<rect class="mc" style="--i:${r * 3 + c}" x="${104 + c * 8}" y="${30 + r * 8}" width="6.5" height="6.5" rx="1" fill="#5af2a8" fill-opacity="${[.2, .55, .3, .7, .25, .45, .35, .2, .6][r * 3 + c]}" stroke="#5af2a8" stroke-opacity=".5" stroke-width=".4"/>`;
  return [sh, withFill(sh, 'fill="url(#pd-case)"') +
    `<polygon points="28.5,22.5 81.8,22.5 91.5,32.2 91.5,61.5 28.5,61.5" fill="none" stroke="url(#pd-bevel)"/>
    <g class="burn">
      <path d="M79 22.6L91.4 35" stroke="#2a120a" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>
      <path d="M80.5 22.6L91.4 33.5" stroke="#ff7a2e" stroke-width=".7" stroke-linecap="round" filter="url(#pd-glow)"/>
      <circle cx="87" cy="27" r="11" fill="url(#pd-ember)" opacity=".75"/>
      <path d="M86.4 29.2c-2.2-1.4-1.6-4 .4-5.6-.2 1.4.6 2 1.2 1.2.4-1.4 1.6-2.4 2.8-2.6-1 1.6.6 3.4-.4 5.2-.8 1.6-2.6 2.6-4 1.8z" fill="#ffb347" filter="url(#pd-glow)"/>
      <path d="M87.2 28.4c-.9-.7-.6-2 .3-2.6.1.8.6 1 .9.4.3-.6.7-1 1.2-1.1-.4.8.2 1.6-.3 2.4-.4.7-1.3 1.2-2.1.9z" fill="#fff3c4"/>
    </g>
    <g class="fuse" fill="none" stroke-linecap="round">
      <path d="M82 22L92 32V62H28V22Z" pathLength="100" stroke="#a8321a" stroke-width="1.4" stroke-opacity=".8" stroke-dasharray="30 70"><animate attributeName="stroke-dashoffset" values="30;-70" dur="2.2s" repeatCount="indefinite"/></path>
      <path d="M82 22L92 32V62H28V22Z" pathLength="100" stroke="#ffd27a" stroke-width=".7" stroke-dasharray="6 94" filter="url(#pd-glow)"><animate attributeName="stroke-dashoffset" values="6;-94" dur="2.2s" repeatCount="indefinite"/></path>
      <g><circle r="8" fill="url(#pd-ember)"><animate attributeName="r" values="7;10;6.5;9;7.5" dur=".32s" repeatCount="indefinite"/></circle>
        <circle r="3.2" fill="#ff9a3d" opacity=".9"><animate attributeName="r" values="3;4;2.6;3.6;3" dur=".21s" repeatCount="indefinite"/></circle>
        <circle r="1.4" fill="#fff6d8"/><animateMotion path="M82 22L92 32V62H28V22Z" dur="2.2s" repeatCount="indefinite"/></g>
      ${[.06, .13, .2].map((d, i) => `<circle r="${.9 - i * .2}" fill="#ffd27a" filter="url(#pd-glow)"><animate attributeName="opacity" values="1;.2;.9;0" dur="${.25 + i * .07}s" repeatCount="indefinite"/><animateMotion path="M82 22L92 32V62H28V22Z" dur="2.2s" begin="${(-2.2 + d).toFixed(2)}s" repeatCount="indefinite"/></circle>`).join('')}
    </g>
    <rect x="38" y="30" width="26" height="21" rx="3" fill="url(#pd-gold)"/>
    <path d="M38 37.5h8.5v-7.5M38 43.5h8.5v7.5M64 37.5h-8.5v-7.5M64 43.5h-8.5v7.5M46.5 37.5h9v6h-9z" fill="none" stroke="#6b4c10" stroke-width=".6"/>
    <text class="silk" x="51" y="58" font-size="4.2" text-anchor="middle">PREPAID</text>
    <path d="M94.5 40h5l-1.5-1.5M99.5 44h-5l1.5 1.5" fill="none" stroke="#5af2a8" stroke-width=".7" stroke-opacity=".7"/>` + m +
    `<g class="refresh spin"><path d="M127 33a14 14 0 0 0-22.5-2" fill="none" stroke="#5af2a8" stroke-width=".9" stroke-opacity=".8"/><path d="M104.5 31l.2-3.6 3.2 1.6z" fill="#5af2a8"/>
    <path d="M101 51a14 14 0 0 0 22.5 2" fill="none" stroke="#5af2a8" stroke-width=".9" stroke-opacity=".8"/><path d="M123.5 53l-.2 3.6-3.2-1.6z" fill="#5af2a8"/></g>`];
}

const chamfer = (x, y, w, h, c) => `<polygon points="${x + c},${y} ${x + w - c},${y} ${x + w},${y + c} ${x + w},${y + h - c} ${x + w - c},${y + h} ${x + c},${y + h} ${x},${y + h - c} ${x},${y + c}"/>`;
// cable with a dark sheath and a pulse that runs it on hover
const wire = (d, core, hot, cls = 'lk') => `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="3.4" stroke-linecap="round"/>
  <path d="${d}" fill="none" stroke="${core}" stroke-width="2.4" stroke-linecap="round"/>
  <path class="${cls}" d="${d}" pathLength="100" fill="none" stroke="${hot}" stroke-width="2" stroke-linecap="round" filter="url(#pd-glow)"/>`;
const tip = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".8" fill="url(#pd-key)"/><path d="M${x + 1} ${y + h * .35}h${w - 2}M${x + 1} ${y + h * .65}h${w - 2}" stroke="#000" stroke-opacity=".35" stroke-width=".5"/>`;
// small code cell in a housing; `fl` = flash class
const ccell = (x, y, c, on, fl = '') => `<g class="${on ? fl : ''}"><rect x="${x}" y="${y}" width="9" height="8" rx="1" fill="${on ? '#5af2a8' : '#070b0e'}" fill-opacity="${on ? .25 : 1}" stroke="#5af2a8" stroke-opacity="${on ? .9 : .15}" stroke-width=".5"${on ? ' filter="url(#pd-glow)"' : ''}/>${txt(x + 4.5, y + 5.6, c, 3.8, on ? '' : 'opacity=".5"')}</g>`;

function linker(t) {
  // patch cable: plug A holds target A, plug B target B; the cable joins A's last code(s) to B's first
  const A = ['1C', 'E9', '55'], B = t ? ['E9', '55', 'BD'] : ['55', 'BD', '7A'], n = t ? 2 : 1;
  // plugs level at both ends, the cable waves between them like the legacy art (v2: two cables crossing)
  const sh = R(12, 35, 34, 14, 3) + R(104, 35, 34, 14, 3);
  let s = (t ? wire('M52 44.5C66 74 84 18 98 44.5', '#1f4a5c', '#4fc8ff') + wire('M52 39.5C66 10 84 66 98 39.5', '#24543f', '#5af2a8')
             : wire('M52 42C66 14 84 70 98 42', '#24543f', '#5af2a8')) +
    tip(46, 38, 6, 8) + tip(98, 38, 6, 8) +
    withFill(R(12, 35, 34, 14, 3), 'fill="url(#pd-case)"') + bevel(12, 35, 34, 14, 3) +
    withFill(R(104, 35, 34, 14, 3), 'fill="url(#pd-case)"') + bevel(104, 35, 34, 14, 3);
  A.forEach((c, i) => s += ccell(15 + i * 10, 38, c, i >= 3 - n, 'lfa'));
  B.forEach((c, i) => s += ccell(107 + i * 10, 38, c, i < n, 'lfb'));
  if (t) s += bar(15, 35.9, 28, .7, 'pd-hot2') + bar(107, 35.9, 28, .7, 'pd-hot2');
  return [sh, s];
}
function split(t) {
  // Y-splitter: the target comes in, gets cut at the junction, two halves go out
  // the plug carries the whole target; v1 shows its one random cut mark, v2 every possible cut (the dial picks one)
  const sh = R(12, 35, 44, 14, 3) + R(64, 33, 18, 18, 3) + R(108, 20, 26, 12, 3) + R(108, 52, 26, 12, 3);
  const cm = (x, cls) => `<g class="${cls}"><line class="cl" x1="${x}" y1="32" x2="${x}" y2="52" stroke="#ff4d7d" stroke-width="1" stroke-dasharray="2 1.2" filter="url(#pd-glow)"/><polygon points="${x - 2},30.5 ${x + 2},30.5 ${x},33" fill="#ff4d7d"/></g>`;
  let s = wire('M56 42H64', '#24543f', '#5af2a8', 'fin') + wire('M82 38C96 38 94 26 108 26', '#24543f', '#5af2a8', 'fout') + wire('M82 46C96 46 94 58 108 58', '#24543f', '#5af2a8', 'fout') +
    tip(8, 38, 4, 8) + withFill(R(12, 35, 44, 14, 3), 'fill="url(#pd-case)"') + bevel(12, 35, 44, 14, 3) +
    ['1C', 'E9', '55', 'BD'].map((c, i) => ccell(15 + i * 10, 38, c, false)).join('') +
    (t ? cm(24.5, 'cmL') + cm(34.5, 'cmM') + cm(44.5, 'cmR') : cm(34.5, 'snip')) +
    withFill(R(64, 33, 18, 18, 3), 'fill="url(#pd-case)"') + bevel(64, 33, 18, 18, 3);
  s += t ? `<g class="dial spin"><circle cx="73" cy="42" r="5.5" fill="url(#pd-key)" stroke="#000" stroke-opacity=".5" stroke-width=".5"/><path d="M73 42v-5" stroke="#ff4d7d" stroke-width="1.2" stroke-linecap="round"/></g>` + bar(66, 33.9, 14, .7, 'pd-hot2')
         : '';
  [[20, ['1C', 'E9']], [52, ['55', 'BD']]].forEach(([y, cs]) => {
    s += tip(134, y + 3, 4, 6) + withFill(R(108, y, 26, 12, 3), 'fill="url(#pd-case)"') + bevel(108, y, 26, 12, 3) +
      cs.map((c, i) => ccell(111 + i * 10, y + 2, c, true, 'lfo')).join('');
  });
  return [sh, s];
}
function ping() {
  // handheld probe; its waves reach the matrix and mark a top-row cell
  const sh = R(16, 32, 40, 20, 5) + `<polygon points="56,36 64,39 64,45 56,48"/>` + R(101, 29, 34, 31, 2);
  let s = withFill(R(16, 32, 40, 20, 5), 'fill="url(#pd-case)"') + bevel(16, 32, 40, 20, 5) +
    `<path d="M21 36v12M24 36v12M27 36v12" stroke="#000" stroke-opacity=".45" stroke-width="1.2"/>` +
    `<polygon points="56,36 64,39 64,45 56,48" fill="url(#pd-key)"/>` + led(50, 37) +
    `<text class="silk" x="41" y="48" font-size="4" text-anchor="middle">PING</text>` +
    [10, 17, 24].map((r, i) => `<path class="pw" style="--i:${i}" d="M${64 + r * .5} ${42 - r * .866}a${r} ${r} 0 0 1 0 ${(r * 1.732).toFixed(2)}" fill="none" stroke="#4fc8ff" stroke-width="1" filter="url(#pd-glow)"/>`).join('') +
    `<rect x="101" y="29" width="34" height="31" rx="2" fill="#05080a" stroke="#fff" stroke-opacity=".08" stroke-width=".5"/>`;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s += `<rect x="${104 + c * 10}" y="${32 + r * 9.2}" width="8.4" height="7.6" rx=".8" fill="#0c1a15" stroke="#5af2a8" stroke-opacity=".15" stroke-width=".4"/>`;
  s += `<g class="pgo" filter="url(#pd-glow)"><rect x="114" y="32" width="8.4" height="7.6" rx=".8" fill="#4fc8ff" fill-opacity=".4" stroke="#4fc8ff" stroke-width=".6"/><polygon points="116.2,24.6 120.2,24.6 118.2,27.8" fill="#4fc8ff"/></g>`;
  return [sh, s];
}

function sidedoor() {
  // lockpick into the matrix edge: every edge cell lights in turn, any edge is a way in
  const sh = R(14, 34, 34, 10, 4) + R(48, 37.5, 50, 3, 1) + R(26, 50, 68, 3, 1) + R(91, 44, 3, 9, 1) + R(102, 24, 35, 36, 2);
  const ring = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [3, 0], [2, 0], [1, 0]];
  let s = `<rect x="26" y="50" width="68" height="3" rx="1" fill="url(#pd-key)"/><rect x="91" y="44" width="3" height="9" rx="1" fill="url(#pd-key)"/>
    <rect x="102" y="24" width="35" height="36" rx="2" fill="#05080a" stroke="#fff" stroke-opacity=".08" stroke-width=".5"/>`;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const i = ring.findIndex(([a, b]) => a === r && b === c);
    s += `<rect class="${i < 0 ? '' : 'edge'}" style="--i:${i}" x="${105 + c * 7.6}" y="${27.4 + r * 7.6}" width="6.4" height="6.4" rx=".7" fill="#0c1a15" stroke="#5af2a8" stroke-opacity="${i < 0 ? .12 : .5}" stroke-width=".4"/>`;
  }
  s += `<g class="rake"><rect x="48" y="37.5" width="50" height="3" rx="1" fill="url(#pd-key)"/><path d="M97 37.5h3l3.5-4.5h2.5l-4 7.5H97z" fill="url(#pd-key)"/>` +
    withFill(R(14, 34, 34, 10, 4), 'fill="url(#pd-case)"') + bevel(14, 34, 34, 10, 4) +
    `<path d="M20 36.5v5M23 36.5v5M26 36.5v5" stroke="#000" stroke-opacity=".45" stroke-width="1.2"/>` + led(42, 39) + `</g>`;
  return [sh, s];
}
function bridge(t) {
  // antenna; the base shows the jump off the lane (v1: next cell, v2: anywhere), v2 has twin masts
  const masts = t ? [48, 102] : [75], bx = t ? 26 : 38, bw = t ? 98 : 74;
  const cx = i => 55 + i * 8, a = t ? 0 : 1, b = t ? 5 : 2;
  const arc = `M${cx(a)} 55.5Q${(cx(a) + cx(b)) / 2} ${t ? 42 : 47} ${cx(b)} 55.5`;
  let s = masts.map((x, k) => `<rect x="${x - 1}" y="31" width="2" height="15" fill="url(#pd-key)"/><circle cx="${x}" cy="30" r="2.6" fill="url(#pd-key)" stroke="#000" stroke-opacity=".4" stroke-width=".4"/>` +
    [5, 9, 13].map((r, i) => `<path class="pw" style="--i:${i + k * 3}" d="M${(x - r * .866).toFixed(2)} ${30 - r * .5}a${r} ${r} 0 0 1 ${(r * 1.732).toFixed(2)} 0" fill="none" stroke="#5af2a8" stroke-width="1" filter="url(#pd-glow)"/>`).join('')).join('') +
    withFill(R(bx, 46, bw, 18, 3), 'fill="url(#pd-case)"') + bevel(bx, 46, bw, 18, 3) + (t ? bar(bx + 4, 46.9, bw - 8, .7, 'pd-hot2') : '') + led(bx + 6, 55) +
    `<rect x="49" y="50" width="52" height="11" rx="1.5" fill="#05080a" stroke="#fff" stroke-opacity=".08" stroke-width=".5"/>`;
  for (let i = 0; i < 6; i++) s += `<rect x="${cx(i) - 3.2}" y="52.3" width="6.4" height="6.4" rx=".7" fill="${i === a ? '#5af2a8' : '#0c1a15'}" fill-opacity="${i === a ? .35 : 1}" stroke="#5af2a8" stroke-opacity="${i === a ? .8 : .15}" stroke-width=".4"/>`;
  s += `<path d="${arc}" fill="none" stroke="#5af2a8" stroke-opacity=".35" stroke-width=".6" stroke-dasharray="1.5 1.2"/>
    <g class="pmark"><rect x="${cx(b) - 3.2}" y="52.3" width="6.4" height="6.4" rx=".7" fill="#5af2a8" fill-opacity=".35" stroke="#5af2a8" stroke-width=".6" filter="url(#pd-glow)"/></g>
    <g class="fuse"><circle r="1.6" fill="#5af2a8" filter="url(#pd-glow)"><animateMotion path="${arc}" dur="1.2s" repeatCount="indefinite"/></circle></g>`;
  return [R(bx, 46, bw, 18, 3), s];
}
function loopback(t) {
  // the cable leaves the plug and comes back: the used code goes into the buffer once more (v2: a second loop, any cell)
  const sh = R(12, 33, 34, 14, 3);
  // v1 repeats the last code (E9), v2 can reach back further (1C)
  const c = t ? '1C' : 'E9';
  let s = wire('M52 37.5C86 37.5 116 12 128 34C138 54 96 62 52 43.5', '#24543f', '#5af2a8') +
    (t ? wire('M52 39.5C72 39.5 88 28 97 37C104 46 76 50 52 41.5', '#1f4a5c', '#4fc8ff') : '') +
    tip(46, 35, 6, 10) + withFill(sh, 'fill="url(#pd-case)"') + bevel(12, 33, 34, 14, 3) +
    ccell(15, 36, '1C', !!t, 'lfa') + ccell(25, 36, 'E9', !t, 'lfa') +
    `<rect x="35" y="36" width="9" height="8" rx="1" fill="none" stroke="#5af2a8" stroke-opacity=".6" stroke-width=".5" stroke-dasharray="1.4 1"/><g class="lbfill">${ccell(35, 36, c, true)}</g>`;
  if (t) s += bar(15, 33.9, 28, .7, 'pd-hot2');
  return [sh, s];
}

function heatsink() {
  // fan between two burnt (time-locked) cells; on hover their lock timers drop by 1
  const fx = 75, fy = 45, burnt = (x, a, b) => `<rect x="${x}" y="33" width="22" height="22" rx="2" fill="#120a0e" stroke="#ff3d8b" stroke-opacity=".45" stroke-width=".6"/>
    <rect x="${x}" y="33" width="22" height="22" rx="2" fill="url(#pd-burn)"/>
    <g class="x-idle">${txt(x + 11, 48.2, a, 11, 'style="fill:#ff3d8b" opacity=".8"')}</g><g class="pmark">${txt(x + 11, 48.2, b, 11, 'style="fill:#ff3d8b" filter="url(#pd-glow)"')}</g>`;
  const sh = R(42, 29, 66, 32, 0) + R(55, 25, 40, 40, 4) + R(14, 33, 22, 22, 2) + R(114, 33, 22, 22, 2);
  let s = '';
  for (let x = 42; x < 108; x += 5) s += `<rect x="${x}" y="29" width="3" height="32" rx=".6" fill="url(#pd-dark)"/><rect x="${x}" y="29" width=".5" height="32" fill="#fff" opacity=".14"/>`;
  s += withFill(R(55, 25, 40, 40, 4), 'fill="url(#pd-case)"') + bevel(55, 25, 40, 40, 4) +
    `<circle cx="${fx}" cy="${fy}" r="16.5" fill="#05080a" stroke="#000" stroke-opacity=".6"/>` +
    [[58.5, 28.5], [91.5, 28.5], [58.5, 61.5], [91.5, 61.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="url(#pd-key)"/>`).join('') +
    `<g class="fan spin"><circle cx="${fx}" cy="${fy}" r="14.5" fill="none"/>` +
    [0, 1, 2, 3, 4].map(k => `<path d="M${fx} ${fy}c.9-7.6 6-12.8 12.8-12.8c-1.7 5.1-6 10.2-12.8 12.8z" transform="rotate(${k * 72} ${fx} ${fy})" fill="url(#pd-key)" opacity=".85"/>`).join('') +
    `</g><circle cx="${fx}" cy="${fy}" r="4" fill="url(#pd-key)" stroke="#000" stroke-opacity=".4" stroke-width=".5"/>` +
    txt(fx, 21.5, '−1', 7.5, 'style="fill:#ff3d8b" filter="url(#pd-glow)"') + burnt(14, '3', '2') + burnt(114, '2', '1');
  return [sh, s];
}
function glob() {
  // pattern ROM: one code of the target printed on the chip turns into **
  const sh = R(30, 26, 90, 32, 3);
  let s = '';
  for (let i = 0; i < 10; i++) {
    const x = 35.5 + i * 8.4;
    s += `<rect class="pin" style="--i:${i}" x="${x}" y="20" width="3" height="7" rx=".5" fill="url(#pd-gold)"/><rect class="pin" style="--i:${i}" x="${x}" y="57" width="3" height="7" rx=".5" fill="url(#pd-gold)"/>`;
  }
  s += withFill(sh, 'fill="url(#pd-case)"') + bevel(30, 26, 90, 32, 3) + `<circle cx="37" cy="33" r="2.4" fill="#0a0e12"/>` +
    // idle frame shows **; on hover E9 shows briefly, then turns into **
    ['1C', 'E9', '55'].map((c, i) => `<rect x="${52 + i * 15}" y="30.5" width="13" height="12" rx="1.2" fill="#070b0e" stroke="#5af2a8" stroke-opacity=".2" stroke-width=".5"/>` +
      (i === 1 ? `<g class="gE9">${txt(73.5, 38.9, c, 6.5)}</g><g class="gAst" filter="url(#pd-glow)"><rect x="67" y="30.5" width="13" height="12" rx="1.2" fill="#5af2a8" fill-opacity=".1" stroke="#5af2a8" stroke-opacity=".6" stroke-width=".5"/><text class="t gast" x="73.5" y="39.3" font-size="8" text-anchor="middle" style="fill:#ff3d8b">**</text></g>`
                : txt(58.5 + i * 15, 38.9, c, 6.5, 'opacity=".6"'))).join('') +
    `<text class="engr" x="75" y="53" font-size="4.6" text-anchor="middle">PATTERN ROM</text>`;
  return [sh, s];
}
function repeater() {
  // the ×2 cell's code goes out twice: two copies land in the buffer
  const sh = R(26, 30, 60, 26, 3) + R(104, 36, 32, 14, 2);
  return [sh, `<rect x="32" y="22" width="2" height="8" fill="url(#pd-key)"/>` + withFill(R(26, 30, 60, 26, 3), 'fill="url(#pd-case)"') + bevel(26, 30, 60, 26, 3) + led(33, 21.5) +
    `<rect x="33" y="37" width="15" height="12" rx="1.2" fill="#070b0e" stroke="#5af2a8" stroke-opacity=".6" stroke-width=".5"/>` + txt(40.5, 45, '55', 5.5) +
    `<g filter="url(#pd-glow)">${txt(67, 47, '×2', 10, 'style="fill:#b46bff"')}</g>` +
    [5, 9, 13].map((r, i) => `<path class="pw" style="--i:${i}" d="M${88 + r * .5} ${43 - r * .866}a${r} ${r} 0 0 1 0 ${(r * 1.732).toFixed(2)}" fill="none" stroke="#5af2a8" stroke-width="1" filter="url(#pd-glow)"/>`).join('') +
    `<rect x="104" y="36" width="32" height="14" rx="2" fill="#05080a" stroke="#fff" stroke-opacity=".08" stroke-width=".5"/>` +
    [107, 121].map((x, i) => `<rect x="${x}" y="39" width="12" height="8" rx="1" fill="none" stroke="#5af2a8" stroke-opacity=".35" stroke-width=".5" stroke-dasharray="1.4 1"/><g class="rp${i + 1}">${ccell(x, 39, '55', true).replace('width="9"', 'width="12"').replace(`x="${x + 4.5}"`, `x="${x + 6}"`)}</g>`).join('')];
}

function chip() {
  // smart card with a pool/idle mode switch; gold only for cash
  const sh = R(20, 16, 110, 52, 5);
  return [sh, withFill(sh, 'fill="url(#pd-case)"') + bevel(20, 16, 110, 52, 5) +
    `<rect x="30" y="27" width="18" height="15" rx="2" fill="url(#pd-gold)"/><path d="M30 34.5h18M39 27v15M30 31h5M43 38.5h5" fill="none" stroke="#6b4c10" stroke-width=".5"/>` +
    // mode detail: POOL = a cleared room (check), IDLE = empty buffer slots; the edge light follows the mode colour
    `<g class="mPool"><rect x="108" y="29" width="14" height="12" rx="1.5" fill="none" stroke="#5af2a8" stroke-width=".7"/><path d="M111 35l2.5 2.5 5-5" fill="none" stroke="#5af2a8" stroke-width=".9" filter="url(#pd-glow)"/>
      <rect x="26" y="64.4" width="98" height=".9" rx=".45" fill="#5af2a8" filter="url(#pd-glow)"/></g>
    <g class="mIdle"><rect x="107" y="31" width="7" height="8" rx="1" fill="none" stroke="#4fc8ff" stroke-width=".6" stroke-dasharray="1.4 1"/><rect x="116" y="31" width="7" height="8" rx="1" fill="none" stroke="#4fc8ff" stroke-width=".6" stroke-dasharray="1.4 1"/>
      <rect x="26" y="64.4" width="98" height=".9" rx=".45" fill="#4fc8ff" filter="url(#pd-glow)"/></g>` +
    `<rect x="55" y="27" width="49" height="15" rx="7.5" fill="#05080a" stroke="#fff" stroke-opacity=".1" stroke-width=".5"/>
    <text class="silk" x="67.5" y="36.5" font-size="5.6" text-anchor="middle">POOL</text><text class="silk" x="91.5" y="36.5" font-size="5.6" text-anchor="middle">IDLE</text>
    <g class="mode"><rect x="56.5" y="28.5" width="22" height="12" rx="6" fill="#5af2a8" fill-opacity=".18" stroke="#5af2a8" stroke-opacity=".8" stroke-width=".6" filter="url(#pd-glow)"/></g>
    <text class="silk" x="30" y="58" font-size="4.4">4071 ···· 0x00</text>
    <text class="t" x="119" y="59.5" font-size="10" text-anchor="middle" style="fill:#ffd23f" filter="url(#pd-glow)">$</text>
    <g class="cpop"><text class="t" x="102" y="61" font-size="5.5" text-anchor="middle" style="fill:#ffd23f">+$1</text></g>`];
}
function ups() {
  // battery backup: a 4-cell gauge and an outlet; on hover mains (AC) drops, the battery holds the stacks
  const sh = R(26, 10, 98, 64, 5);
  let s = withFill(sh, 'fill="url(#pd-case)"') + bevel(26, 10, 98, 64, 5);
  for (let y = 60; y <= 66; y += 3) s += `<rect x="36" y="${y}" width="44" height="1.3" rx=".6" fill="#05080a"/>`;
  s += `<rect x="36" y="22" width="44" height="26" rx="2.5" fill="#05080a" stroke="#fff" stroke-opacity=".12" stroke-width=".6"/><rect x="80" y="30" width="3.5" height="10" rx="1" fill="url(#pd-key)"/>` +
    [0, 1, 2, 3].map(i => `<rect class="bcell" style="--i:${i}" x="${39 + i * 10.2}" y="25" width="8.4" height="20" rx="1" fill="#5af2a8" filter="url(#pd-glow)"/>`).join('') +
    `<text class="silk" x="36" y="18.5" font-size="4.4">BATT</text><text class="silk" x="80" y="18.5" font-size="4.4" text-anchor="end">STACK HOLD</text>` +
    // outlet: two slits and a ground hole
    `<circle cx="104" cy="35" r="11" fill="url(#pd-dark)" stroke="#000" stroke-opacity=".6"/>${bevel(93, 24, 22, 22, 11, .7)}
    <rect x="99.5" y="29" width="2" height="6" rx=".6" fill="#05080a"/><rect x="106.5" y="29" width="2" height="6" rx=".6" fill="#05080a"/><circle cx="104" cy="40" r="1.6" fill="#05080a"/>` +
    `<text class="silk" x="96" y="58" font-size="4" text-anchor="middle">AC</text><text class="silk" x="112" y="58" font-size="4" text-anchor="middle">BAT</text>
    <circle class="acled" cx="96" cy="63" r="1.6" filter="url(#pd-glow)"/><circle class="bled" cx="112" cy="63" r="1.6" filter="url(#pd-glow)"/>` +
    `<text class="engr" x="58" y="57" font-size="5.5" text-anchor="middle">UPS</text>`;
  return [sh, s];
}
function compiler() {
  // build server: three build steps fill, the payload gains a level
  const sh = R(20, 12, 110, 60, 3);
  let s = withFill(sh, 'fill="url(#pd-case)"') + bevel(20, 12, 110, 60, 3);
  for (let x = 26; x < 124; x += 4) s += `<rect x="${x}" y="15" width="2" height="5" rx=".5" fill="#05080a"/>`;
  s += `<text class="silk" x="28" y="31" font-size="4.6">$ make payload</text>` +
    [0, 1, 2].map(i => `<rect x="${28 + i * 19}" y="35" width="16" height="14" rx="1.5" fill="#070b0e" stroke="#5af2a8" stroke-opacity=".35" stroke-width=".5"/>
      <rect class="cstep" style="--i:${i}" x="${28 + i * 19}" y="35" width="16" height="14" rx="1.5" fill="#5af2a8" filter="url(#pd-glow)"/>${txt(36 + i * 19, 44.5, i + 1, 6, 'opacity=".75"')}`).join('') +
    `<path d="M88 42h8m-3-3 3 3-3 3" fill="none" stroke="#5af2a8" stroke-opacity=".6" stroke-width=".9"/>` +
    `<rect x="100" y="33" width="22" height="18" rx="2" fill="#05080a" stroke="#fff" stroke-opacity=".12" stroke-width=".5"/>${txt(111, 41.5, 'Lv', 5.5, 'opacity=".7"')}
    <g class="lvpop">${txt(111, 48.5, '+1', 6.5, 'filter="url(#pd-glow)"')}</g>` +
    [0, 1].map(i => `<rect x="28" y="${55 + i * 7}" width="44" height="5" rx="1" fill="url(#pd-dark)" stroke="#000" stroke-opacity=".5" stroke-width=".4"/><circle class="core" style="--i:${i}" cx="68" cy="${57.5 + i * 7}" r="1.1" fill="#5af2a8" filter="url(#pd-glow)"/>`).join('') +
    `<text class="engr" x="111" y="64" font-size="4.4" text-anchor="middle">BUILD</text>`;
  return [sh, s];
}
function overclock() {
  // overclocked CPU: one wide package, the clock meter set into its steel lid; on hover it heats up and the meter climbs
  const sh = R(16, 12, 118, 60, 3);
  let s = `<circle class="heat" cx="75" cy="42" r="44" fill="url(#pd-ember)"/>`;
  for (let i = 0; i < 15; i++) {
    const p = 21 + i * 7.4;
    s += `<rect x="${p}" y="8" width="2.4" height="5" rx=".5" fill="url(#pd-gold)"/><rect x="${p}" y="71" width="2.4" height="5" rx=".5" fill="url(#pd-gold)"/>`;
  }
  s += withFill(sh, 'fill="url(#pd-pcb)" stroke="#000" stroke-opacity=".5" stroke-width=".5"') + bevel(16, 12, 118, 60, 3, .7) +
    withFill(R(24, 18, 102, 48, 4), 'fill="url(#pd-steel)"') + bevel(24, 18, 102, 48, 4) + `<rect x="24" y="18" width="102" height="48" rx="4" fill="url(#pd-brush)"/>` +
    `<text class="engr" x="29" y="31" font-size="9">OVERCLOCK</text>` +
    txt(55, 57, '×1.5', 16, 'style="fill:#ff3d8b" filter="url(#pd-glow)"') +
    `<rect x="92" y="23" width="28" height="38" rx="2" fill="#05080a" stroke="#000" stroke-opacity=".6" stroke-width=".5"/><text class="silk" x="106" y="29" font-size="4" text-anchor="middle">CLK</text>` +
    [0, 1, 2, 3, 4].map(i => `<rect class="clk${i < 2 ? ' on' : ''}" style="--i:${i}" x="96" y="${54 - i * 5.6}" width="20" height="4" rx="1" fill="${i > 2 ? '#ff3d8b' : '#5af2a8'}" filter="url(#pd-glow)"/>`).join('');
  return [sh, s];
}
function nullpad() {
  // laptop RAM (SO-DIMM): a label, three chips holding codes and two empty ones that pay +8; on hover the empty ones light up
  const sh = `<path d="M22 16h106v40h-3v6H82v-6h-3v6H25v-6h-3z"/>`;
  let s = withFill(sh, 'fill="url(#pd-pcb)" stroke="#000" stroke-opacity=".5" stroke-width=".5"') +
    `<rect x="25" y="57" width="54" height="5" fill="url(#pd-pins)"/><rect x="82" y="57" width="43" height="5" fill="url(#pd-pins)"/>` +
    `<circle cx="25.5" cy="19.5" r="1.6" fill="#05080a"/><circle cx="124.5" cy="19.5" r="1.6" fill="#05080a"/>` +
    `<rect x="34" y="19.5" width="82" height="8" rx="1" fill="#d9dee3"/><text class="engr" x="37" y="25.4" font-size="4.6">NULL PAD · SO-DIMM · 0x00</text>`;
  ['1C', 'E9', '55', '+8', '+8'].forEach((c, i) => {
    const x = 28 + i * 19.4, empty = i > 2;
    s += empty
      ? `<rect x="${x}" y="31" width="16" height="20" rx="1" fill="#4fc8ff" fill-opacity=".12" stroke="#4fc8ff" stroke-opacity=".6" stroke-width=".6" stroke-dasharray="1.6 1.1"/>`
        + `<rect class="nslot" style="--i:${i - 3}" x="${x}" y="31" width="16" height="20" rx="1" fill="#4fc8ff" filter="url(#pd-glow)"/>` + txt(x + 8, 43.4, c, 6, 'style="fill:#4fc8ff" filter="url(#pd-glow)"')
      : withFill(R(x, 31, 16, 20, 1), 'fill="url(#pd-dark)" stroke="#000" stroke-opacity=".6" stroke-width=".6"') + txt(x + 8, 43.4, c, 6, 'opacity=".8"');
  });
  return [sh, s];
}
function ziptie() {
  // two targets' cables bound by a zip tie at the code they share; on hover the tie cinches and +50% pops
  const sh = R(8, 20, 30, 14, 3) + R(8, 50, 30, 14, 3) + R(66, 30, 18, 24, 3);
  let s = wire('M38 27C56 27 60 39 75 39', '#24543f', '#5af2a8') + wire('M38 57C56 57 60 45 75 45', '#1f4a5c', '#4fc8ff') +
    wire('M75 39C96 39 110 30 142 30', '#24543f', '#5af2a8') + wire('M75 45C96 45 110 54 142 54', '#1f4a5c', '#4fc8ff') +
    withFill(R(8, 20, 30, 14, 3), 'fill="url(#pd-case)"') + bevel(8, 20, 30, 14, 3) + withFill(R(8, 50, 30, 14, 3), 'fill="url(#pd-case)"') + bevel(8, 50, 30, 14, 3) +
    ccell(11, 23, '1C', false) + ccell(22, 23, 'E9', true) + ccell(11, 53, 'E9', true) + ccell(22, 53, '55', false) +
    // the tie: a band round the bundle, its ratchet head on top and the cut tail
    `<g class="tie"><rect x="70" y="33" width="10" height="18" rx="3" fill="none" stroke="#0d1115" stroke-width="3.2"/><rect x="70" y="33" width="10" height="18" rx="3" fill="none" stroke="#3a434c" stroke-width="1.6"/>
    <rect x="68" y="28" width="14" height="7" rx="1.5" fill="url(#pd-dark)" stroke="#000" stroke-opacity=".6" stroke-width=".5"/><path d="M71 31.5h8" stroke="#56626a" stroke-width=".6"/>
    <path d="M82 31l9-6" stroke="#3a434c" stroke-width="2.4" stroke-linecap="round"/></g>` +
    `<g class="zpop">${txt(75, 66, '+50%', 7, 'style="fill:#4fc8ff" filter="url(#pd-glow)"')}</g>`;
  return [sh, s];
}
function hotkey(t) {
  // mechanical macro key: a glass keycap on a switch with a lit stem; v2 is the same base, wider, with three coloured keys. On hover a key goes down
  const cap = (x, y, w, h, label, k, c = '#5af2a8') => `<g class="kcap" style="--i:${k}">
    <rect x="${x}" y="${y + 3}" width="${w}" height="${h}" rx="3.2" fill="#05080a" opacity=".7"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3.2" fill="${c}" fill-opacity=".1" stroke="${c}" stroke-opacity=".55" stroke-width=".7"/>
    <rect x="${x + 3}" y="${y + 2}" width="${w - 6}" height="${h - 7}" rx="2.2" fill="url(#pd-dark)" opacity=".85"/>
    <rect x="${x + 3}" y="${y + 2}" width="${w - 6}" height="${(h - 7) * .4}" rx="2.2" fill="#fff" opacity=".07"/>
    ${txt(x + w / 2, y + h * .55, label, Math.min(w, h * 1.6) * .26, `style="fill:${c}"`)}</g>`;
  const stem = (x, c) => `<rect x="${x}" y="44" width="14" height="10" rx="1.5" fill="${c}" opacity=".55" filter="url(#pd-glow)"/>`;
  if (!t) {
    const sh = R(44, 52, 62, 14, 3) + R(52, 16, 46, 40, 4);
    return [sh, withFill(R(44, 52, 62, 14, 3), 'fill="url(#pd-case)"') + bevel(44, 52, 62, 14, 3) +
      stem(68, '#5af2a8') + cap(52, 16, 46, 36, 'F13', 0) +
      `<text class="silk" x="50" y="61.5" font-size="4">MACRO</text>` + led(98, 59)];
  }
  const keys = [[24, 'F13', '#5af2a8'], [60, 'F14', '#4fc8ff'], [96, 'F15', '#ff3d8b']];
  const sh = R(18, 52, 114, 14, 3) + R(24, 22, 102, 34, 4);
  return [sh, withFill(R(18, 52, 114, 14, 3), 'fill="url(#pd-case)"') + bevel(18, 52, 114, 14, 3) +
    keys.map(([x, l, c], k) => stem(x + 8, c) + cap(x, 22, 30, 30, l, k, c)).join('') +
    `<text class="silk" x="24" y="61.5" font-size="4">MACRO PAD</text>` + led(124, 59)];
}
function bitshift() {
  // shift register: a DIP chip with a wide code window; on hover the first and last codes swap places
  const sh = R(22, 24, 106, 36, 3);
  let s = '';
  for (let i = 0; i < 12; i++) {
    const x = 28 + i * 8.4;
    s += `<rect x="${x}" y="17" width="3.2" height="8" rx=".6" fill="url(#pd-key)"/><rect x="${x}" y="59" width="3.2" height="8" rx=".6" fill="url(#pd-key)"/>`;
  }
  s += withFill(sh, 'fill="url(#pd-case)"') + bevel(22, 24, 106, 36, 3) + `<text class="engr" x="27" y="32" font-size="4.6">74HC595 · SHIFT</text>` +
    `<rect x="26" y="34" width="86" height="22" rx="2" fill="#05080a" stroke="#5af2a8" stroke-opacity=".3" stroke-width=".5"/>` +
    ['4B', '7F', 'C9'].map((c, i) => `<g class="sw${i}"><rect x="${30 + i * 27}" y="37.5" width="24" height="15" rx="1.6" fill="#5af2a8" fill-opacity=".12" stroke="#5af2a8" stroke-opacity=".6" stroke-width=".6"/>${txt(42 + i * 27, 48, c, 8)}</g>`).join('') +
    // swap mark: two opposite arrows
    `<path d="M114 41h10m-2.6-2.6 2.6 2.6-2.6 2.6M124 49h-10m2.6-2.6-2.6 2.6 2.6 2.6" fill="none" stroke="#5af2a8" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" filter="url(#pd-glow)"/>`;
  return [sh, s];
}
function exploit(t) {
  // zero-day memory card: notched card, gold contacts and a gold $ (gold = cash); v2 fans out a second card
  const card = (x, y, k) => `<g class="ecard" style="--i:${k}"><path d="M${x} ${y}h40v46h-34l-6-6z" fill="url(#pd-dark)" stroke="#000" stroke-opacity=".6" stroke-width=".5"/>
    <path d="M${x + .6} ${y + .6}h38.8" stroke="#fff" stroke-opacity=".18"/>
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${x + 7 + i * 4.4}" y="${y + 2}" width="2.6" height="7" rx=".5" fill="url(#pd-gold)"/>`).join('')}
    <rect x="${x + 5}" y="${y + 13}" width="30" height="12" rx="1.2" fill="#d9dee3"/><text class="engr" x="${x + 20}" y="${y + 21.2}" font-size="6" text-anchor="middle">0-DAY</text>
    <text class="t" x="${x + 20}" y="${y + 40}" font-size="11" text-anchor="middle" style="fill:#ffd23f" filter="url(#pd-glow)">$</text></g>`;
  const sh = t ? R(46, 16, 40, 46, 3) + R(64, 22, 40, 46, 3) : R(55, 18, 40, 46, 3);
  return [sh, (t ? card(46, 16, 0) + card(64, 22, 1) : card(55, 18, 0)) +
    `<g class="cpop"><text class="t" x="${t ? 112 : 104}" y="30" font-size="6.5" text-anchor="middle" style="fill:#ffd23f">+$1</text></g>`];
}
function snapshot() {
  // 3.5" floppy, the universal "save state": a steel shutter, the SNAPSHOT.IMG label and the write-protect tab; on hover the shutter slides open
  const sh = `<path d="M44 10h58l6 6v58H44z"/>`;
  let s = withFill(sh, 'fill="url(#pd-dark)" stroke="#000" stroke-opacity=".6" stroke-width=".5"') + `<path d="M44.6 10.6h57.2" stroke="#fff" stroke-opacity=".18"/>` +
    // the disk under the shutter: a hub ring and the media, shown when it opens
    `<rect x="58" y="10" width="30" height="20" fill="#05080a"/><rect x="66" y="13" width="8" height="14" rx="1" fill="#2a2f35"/><rect x="66" y="13" width="8" height="14" rx="1" fill="#5af2a8" fill-opacity=".2" filter="url(#pd-glow)"/>` +
    `<g class="shutter"><rect x="56" y="10" width="32" height="21" rx="1" fill="url(#pd-steel)"/><rect x="56" y="10" width="32" height="21" rx="1" fill="url(#pd-brush)"/><rect x="77" y="13" width="7" height="14" rx="1" fill="#05080a" opacity=".85"/></g>` +
    `<rect x="50" y="37" width="46" height="33" rx="1.5" fill="#d9dee3"/><path d="M50 43h46" stroke="#5af2a8" stroke-width="2.4"/>` +
    `<text class="engr" x="73" y="53" font-size="5.6" text-anchor="middle">SNAPSHOT</text><text class="engr" x="73" y="60" font-size="4.4" text-anchor="middle" opacity=".7">.IMG · 1.44MB</text>` +
    `<rect x="47" y="64" width="5" height="5" rx=".6" fill="#05080a"/><rect x="47" y="64" width="2.4" height="5" fill="#9aa5af"/><rect x="99" y="64" width="5" height="5" rx=".6" fill="#05080a"/>`;
  return [sh, s];
}
function coproc() {
  // expansion card: the co-processor chip and the spare daemon slot (+1) on one board
  const sh = R(22, 21, 112, 40, 2);
  let s = withFill(sh, 'fill="url(#pd-pcb)" stroke="#000" stroke-opacity=".5" stroke-width=".5"') + bevel(22, 21, 112, 40, 2, .7) +
    `<path d="M65 34H74M65 41H74M65 48H74" stroke="#5af2a8" stroke-opacity=".3" stroke-width=".5"/>`;
  for (let i = 0; i < 6; i++) {
    const p = 37 + i * 4.2;
    s += `<rect x="${p}" y="24" width="1.8" height="3" fill="url(#pd-gold)"/><rect x="${p}" y="55" width="1.8" height="3" fill="url(#pd-gold)"/>
      <rect x="31" y="${p - 8}" width="3" height="1.8" fill="url(#pd-gold)"/><rect x="62" y="${p - 8}" width="3" height="1.8" fill="url(#pd-gold)"/>`;
  }
  s += withFill(R(34, 27, 28, 28, 2), 'fill="url(#pd-case)"') + bevel(34, 27, 28, 28, 2) +
    `<rect x="37.5" y="30.5" width="21" height="21" rx="1.5" fill="url(#pd-dark)" stroke="#fff" stroke-opacity=".1" stroke-width=".4"/>
    <text class="silk" x="48" y="35.4" font-size="3" text-anchor="middle">CO-PROC</text>` +
    [0, 1, 2, 3].map(i => `<rect class="core" style="--i:${i}" x="${40.4 + i * 4.3}" y="38" width="2.8" height="11" rx=".5" fill="#5af2a8" filter="url(#pd-glow)"/>`).join('') +
    `<rect x="74" y="27" width="54" height="28" rx="3" fill="#05080a" stroke="#5af2a8" stroke-opacity=".6" stroke-width=".6" stroke-dasharray="2 1.4"/>
    <g class="pmark"><rect x="74" y="27" width="54" height="28" rx="3" fill="#5af2a8" fill-opacity=".14" stroke="#5af2a8" stroke-width=".7" filter="url(#pd-glow)"/></g>` +
    txt(101, 44, '+1', 10, 'filter="url(#pd-glow)"') + `<text class="silk" x="101" y="52" font-size="4.4" text-anchor="middle">DAEMON SLOT</text>`;
  return [sh, s];
}
function mux() {
  // multiplexer: the lever picks your line (ROW) or the crossing one (COL)
  const body = `<polygon points="58,24 92,34 92,54 58,64"/>`;
  return [body, (wire('M58 32H44Q38 32 38 26V21', '#2b333b', '#5af2a8', 'm1') + wire('M16 56H58', '#2b333b', '#5af2a8', 'm2') + wire('M92 44H128', '#2b333b', '#5af2a8', 'mo')) +
    tip(35, 16, 6, 5) + tip(10, 53, 6, 6) + tip(128, 41, 6, 6) +
    `<text class="silk" x="47" y="28" font-size="3.8" text-anchor="middle">COL</text><text class="silk" x="30" y="52" font-size="3.8" text-anchor="middle">ROW</text>` +
    withFill(body, 'fill="url(#pd-case)"') + `<polygon points="58.5,24.7 91.5,34.4 91.5,53.6 58.5,63.3" fill="none" stroke="url(#pd-bevel)"/>` +
    `<g class="lever"><path d="M84 44H64" stroke="#c9d1d8" stroke-width="2.2" stroke-linecap="round"/>${led(64, 44)}</g><circle cx="84" cy="44" r="2.6" fill="url(#pd-key)"/>`];
}

// glass rack demo: one unit per LED state, built from the item drawings below

// id -> [draw, rack viewBox (0 = default crop), copy speed in s for the thumb drive screen]
const GLASS: Record<ItemId, [() => [string, string], string | 0, number]> = {
  buffer1: [() => buffer(0), 0, 0],
  buffer2: [() => buffer(1), '12 12 132 54', 0],
  shortkey: [() => shortkey(), 0, 0],
  linker1: [() => linker(0), 0, 0],
  linker2: [() => linker(1), 0, 0],
  wildcard1: [() => wildcard(0), 0, 0],
  wildcard2: [() => wildcard(1), 0, 0],
  datanode: [() => datanode(0), 0, 0],
  datanode2: [() => datanode(1), 0, 0],
  datanode3: [() => datanode(2), '8 14 136 52', 0],
  prio1: [() => priority(0), 0, 0],
  prio2: [() => priority(1), 0, 0],
  split1: [() => split(0), 0, 0],
  split2: [() => split(1), 0, 0],
  sidedoor: [() => sidedoor(), 0, 0],
  bridge: [() => bridge(0), '12 14 126 52', 0],
  bridge2: [() => bridge(1), '12 14 126 52', 0],
  loopback1: [() => loopback(0), 0, 0],
  loopback2: [() => loopback(1), 0, 0],
  thumb: [() => thumb(0), 0, 2.4],
  thumb2: [() => thumb(1), 0, 1.6],
  thumb3: [() => thumb(2), 0, 0.9],
  chip: [() => chip(), '12 14 126 56', 0],
  ping: [() => ping(), 0, 0],
  heatsink: [() => heatsink(), 0, 0],
  sim: [() => burner(), 0, 0],
  glob: [() => glob(), 0, 0],
  mux: [() => mux(), 0, 0],
  repeater: [() => repeater(), 0, 0],
  rewind: [() => rewind(), 0, 0],
  socket: [() => coproc(), 0, 0],
  nullpad: [() => nullpad(), '16 12 118 54', 0],
  ziptie: [() => ziptie(), '6 16 138 54', 0],
  ups: [() => ups(), '18 6 114 72', 0], // 2U: the rack crop keeps the full height
  hotkey: [() => hotkey(0), '24 10 102 60', 0],
  hotkey2: [() => hotkey(1), '12 14 126 56', 0],
  compiler: [() => compiler(), '14 8 122 68', 0],
  bitshift: [() => bitshift(), '16 10 118 60', 0],
  overclock: [() => overclock(), '12 4 126 76', 0],
  exploit: [() => exploit(0), '20 6 110 66', 0], // headroom: the card rises on hover
  exploit2: [() => exploit(1), '20 6 110 66', 0],
  snapshot: [() => snapshot(), '14 4 120 72', 0],
};
const prefix = (s: string) => s.replace(/class="([^"]*)"/g, (_, c) => 'class="' + c.split(/\s+/).filter(Boolean).map((x) => 'q-' + x).join(' ') + '"');
const cache: Partial<Record<ItemId, [string, string]>> = {};
let uid = 0;
// rack: cropped to the drawing so it fills the short rack unit
export function gearGlass(id: ItemId, rack = false) {
  const [draw, rvb, spd] = GLASS[id];
  const [shape, body] = cache[id] ??= (([s, b]) => [s, prefix(b)])(draw());
  const cid = 'gq' + uid++;
  return '<svg class="gear gl" viewBox="' + (rack ? rvb || '12 18 126 48' : '0 0 150 84') + '"' + (spd ? ' style="--spd:' + spd + 's"' : '') + ' aria-hidden="true">'
    + '<defs><clipPath id="' + cid + '">' + shape + '</clipPath></defs><g class="q-ud">' + body
    + '<g clip-path="url(#' + cid + ')"><rect class="q-sheen" x="-50" y="10" width="40" height="64" fill="url(#pd-sheen)"/></g></g></svg>';
}
