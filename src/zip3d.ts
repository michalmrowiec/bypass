// @ts-nocheck
// shortcut: untyped port of the patch.zip concept (.notes/patch-zip/concept.html); add @types/three@0.128 if this grows.
// patch.zip in 3D: a glass case sealed with a printed glass seal. Opened, the seal cracks, leaks light and bursts,
// the case sinks and three glass punch cards pop out, fly into a row where the case stood and decrypt on their faces.
// three.js r128 is pinned on purpose: the glass relies on its alpha-style `transmission`.
import * as THREE from 'three';
import type { ZipCard, ZipOpts } from './zip3d-api';

const HEX = '0123456789ABCDEF', FONT = '"JetBrains Mono", monospace', CODE = '7A1C';
const clamp = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eo = (t) => 1 - (1 - t) ** 3, eio = (t) => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const rnd = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const lerp = (a, b, k) => a + (b - a) * k;
const has = (buf, t) => (',' + buf.join(',') + ',').includes(',' + t.join(',') + ',');
function cover(p) { // same rules as payEx() in ui.ts: lit codes inside uploaded targets, shared ones brighter
  const done = p.targets.filter((t) => has(p.buf, t)), cov = Array(p.l).fill(0);
  done.forEach((t) => { const s = p.buf.findIndex((_, i) => t.every((c, j) => p.buf[i + j] === c)); t.forEach((_, j) => cov[s + j]++); });
  return { done, cov };
}

/* ---------- card faces on canvas (512 px = the card's inner width) ---------- */
const W = 96, H = 130, D = 7, BV = 2.4, CR = 9, CC = 10;
const CW = 512, CH = Math.round(CW * H / W), K = CW / (W - 2 * BV), RPX = CR * K, CUT = CC * K;
function cardPath(g, i, r) {
  g.beginPath(); g.moveTo(CW / 2, i);
  g.arcTo(CW - i, i, CW - i, CH - i, r); g.arcTo(CW - i, CH - i, i, CH - i, r); g.arcTo(i, CH - i, i, i + CUT, r);
  g.arcTo(i, i + CUT, i + CUT, i, 16); g.arcTo(i + CUT, i, CW / 2, i, 16); g.closePath();
}
function frame(g, mint) {
  const gr = g.createLinearGradient(0, 0, CW * .4, CH); gr.addColorStop(0, '#1a3a3d'); gr.addColorStop(1, '#0a1a1c');
  g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
  const st = g.createLinearGradient(0, 0, CW, CH);
  if (mint) { st.addColorStop(0, '#c8ffe4'); st.addColorStop(.4, '#5af2a8'); st.addColorStop(1, '#2ee6d6'); }
  else { st.addColorStop(0, '#b8fff6'); st.addColorStop(.35, '#2ee6d6'); st.addColorStop(.7, '#3dd9ff'); st.addColorStop(1, '#2ee6d6'); }
  g.save(); g.shadowColor = mint ? '#5af2a8' : '#2ee6d6'; g.shadowBlur = 16;
  cardPath(g, 9, RPX - 6); g.strokeStyle = st; g.lineWidth = 5; g.stroke(); g.restore();
  cardPath(g, 19, RPX - 14); g.strokeStyle = 'rgba(127,255,240,.16)'; g.lineWidth = 2; g.stroke();
}
function holes(g, y0, on) { // 22 columns × 4 rows of punch positions
  const cw = (CW - 72) / 22; g.textAlign = 'center'; g.font = `600 15px ${FONT}`;
  for (let c = 0; c < 22; c++) for (let r = 0; r < 4; r++) {
    const x = 36 + c * cw + cw / 2, y = y0 + r * 22;
    if (on(c, r)) { g.fillStyle = '#2ee6d6'; g.shadowColor = '#2ee6d6'; g.shadowBlur = 10; g.fillRect(x - 5, y - 14, 10, 17); g.shadowBlur = 0; }
    else { g.fillStyle = 'rgba(107,118,124,.9)'; g.fillText(String((c + r) % 10), x, y); }
  }
  g.textAlign = 'left';
}
// depends only on the payload id: every payload type has its own fixed pattern
const idHoles = (id) => (c, r) => ((id.charCodeAt(c % id.length) * (r + 3) + c * 7) % 5) === 0;
function fit(g, text, weight, size, max) { // shrink the font until the text fits `max` px; returns the size used
  do g.font = `${weight} ${size}px ${FONT}`; while (g.measureText(text).width > max && --size > 12);
  return size;
}
function wrap(g, text, max) {
  const lines = [''];
  text.split(' ').forEach((w) => { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (g.measureText(t).width > max && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; });
  return lines.slice(0, 3);
}
// The effect in the game's colours: data amounts in data cyan with the data icon, boost and multipliers in pink.
const DATA_ICON = ['M10 2h7l4 4v11h-5', 'M4 7h8l4 4v11H4z', 'M12 7v4h4'].map((d) => new Path2D(d));
function effLine(g, eff, x, y, max) {
  const size = fit(g, eff, 800, 32, max);
  eff.split(' · ').forEach((part, i) => {
    if (i) { g.fillStyle = '#5c676c'; g.fillText(' · ', x, y); x += g.measureText(' · ').width; }
    const data = part.endsWith(' data'), t = data ? part.slice(0, -5) : part;
    g.fillStyle = data ? '#2ee6d6' : '#ff3d8b'; g.fillText(t, x, y); x += g.measureText(t).width;
    if (!data) return;
    const k = size / 24;
    g.save(); g.translate(x + size * .1, y - size * .82); g.scale(k, k);
    g.strokeStyle = '#2ee6d6'; g.lineWidth = 2.2; g.lineJoin = 'round'; DATA_ICON.forEach((d) => g.stroke(d));
    g.restore(); x += size * 1.05;
  });
}
function drawFront(g, p, name) {
  const big = p.n > 1, acc = big ? '#5af2a8' : '#2ee6d6';
  frame(g, big);
  const size = fit(g, name + '.bin', 800, 44, (big ? CW - 146 : CW - 40) - 70);
  g.fillStyle = acc; g.fillText(name, 70, 84);
  const nw = g.measureText(name).width; g.font = `600 ${Math.round(size * .68)}px ${FONT}`; g.fillStyle = '#6b767c'; g.fillText('.bin', 70 + nw + 2, 84);
  if (big) { g.fillStyle = '#5af2a8'; g.fillRect(CW - 136, 54, 98, 36); g.fillStyle = '#111315'; g.font = `800 22px ${FONT}`; g.fillText('+2 LV', CW - 122, 80); }
  holes(g, 130, idHoles(p.id));
  g.font = `600 30px ${FONT}`; g.fillStyle = '#d6dde0'; const a = `Lv${p.lv} → `; g.fillText(a, 36, 244);
  g.fillStyle = acc; g.fillText('Lv' + (p.lv + p.n), 36 + g.measureText(a).width, 244);
  const segs = Math.max(6, p.lv + p.n);
  for (let i = 0; i < segs; i++) { // level meter: new levels glow mint
    const sw = Math.min(22, 160 / segs - 5), x = CW - 36 - (segs - i) * (sw + 5) + 5;
    g.fillStyle = i < p.lv ? 'rgba(46,230,214,.7)' : i < p.lv + p.n ? '#5af2a8' : '#2a3035';
    if (i >= p.lv && i < p.lv + p.n) { g.shadowColor = '#5af2a8'; g.shadowBlur = 10; }
    g.fillRect(x, 226, sw, 16); g.shadowBlur = 0;
  }
  effLine(g, p.eff, 36, 302, CW - 72);
  g.font = `400 28px ${FONT}`; g.fillStyle = '#8b979c';
  wrap(g, p.text, CW - 72).forEach((ln, i) => g.fillText(ln, 36, 342 + i * 34));
  g.font = `600 26px ${FONT}`; g.fillStyle = '#7d888d';
  if (p.plays) { const a = 'played '; g.fillText(a, 36, CH - 204); g.fillStyle = acc; g.fillText(p.plays + '×', 36 + g.measureText(a).width, CH - 204); g.fillStyle = '#6b767c'; g.fillText(' this run', 36 + g.measureText(a + p.plays + '×').width, CH - 204); }
  else g.fillText('not played yet this run', 36, CH - 204);
  const { done, cov } = cover(p), bw = (CW - 72 - (p.l - 1) * 6) / p.l, by = CH - 186;
  g.textAlign = 'center'; g.font = `500 27px ${FONT}`;
  for (let i = 0; i < p.l; i++) {
    const x = 36 + i * (bw + 6), code = p.buf[i], cl = code === undefined ? 'e' : cov[i] >= 2 ? 's' : cov[i] ? 'u' : '';
    if (cl === 's') { g.fillStyle = 'rgba(46,230,214,.22)'; g.fillRect(x, by, bw, 52); }
    g.strokeStyle = cl === 's' ? '#2ee6d6' : cl === 'u' ? 'rgba(46,230,214,.6)' : '#2a3035'; g.lineWidth = 2;
    g.setLineDash(cl === 'e' ? [6, 5] : []); g.strokeRect(x + 1, by + 1, bw - 2, 50); g.setLineDash([]);
    if (code) { g.fillStyle = cl ? '#d6dde0' : '#6b767c'; g.fillText(code, x + bw / 2, by + 34); }
  }
  g.textAlign = 'left';
  // targets in one row: the font steps down until they fit
  const lbl = (t) => (done.includes(t) ? '✓ ' : '') + t.join(' ');
  let fs = 25; do g.font = `500 ${fs}px ${FONT}`; while (p.targets.reduce((w, t) => w + g.measureText(lbl(t)).width + 24, -8) > CW - 72 && --fs > 15);
  let x = 36; const ty = CH - 114;
  p.targets.forEach((t) => {
    const ok = done.includes(t), s = (ok ? '✓ ' : '') + t.join(' '), w = g.measureText(s).width + 16;
    g.strokeStyle = ok ? 'rgba(46,230,214,.5)' : '#2a3035'; g.strokeRect(x, ty, w, 34);
    g.fillStyle = ok ? '#2ee6d6' : '#6b767c'; g.fillText(s, x + 8, ty + 24); x += w + 8;
  });
  g.font = `600 20px ${FONT}`; g.fillStyle = 'rgba(125,136,141,.85)'; g.fillText('PAYLOAD PATCH · ' + p.id.toUpperCase(), 36, CH - 44);
}
function drawBack(g, c) { // the reverse: encrypted
  frame(g, false);
  g.font = `700 22px ${FONT}`; g.fillStyle = '#6b767c'; g.fillText(`patch.zip  ${c.i + 1}/${c.of}`, 70, 70);
  const rn = rnd(c.seed); holes(g, 130, c.mask ? (col, row) => c.mask[col * 4 + row] : () => rn() < .2); // same rows as the front, so the pattern lands in place
  g.font = `400 23px ${FONT}`; g.fillStyle = 'rgba(46,230,214,.5)';
  c.hex.forEach((row, r) => g.fillText(row, 36, 230 + r * 30));
  g.font = `700 24px ${FONT}`; g.fillStyle = '#2ee6d6'; g.fillText('▣ ENCRYPTED', 36, CH - 78);
  g.textAlign = 'right'; g.fillStyle = '#6b767c'; g.fillText(Math.round(c.pct * 100) + '%', CW - 36, CH - 78); g.textAlign = 'left';
  g.fillStyle = '#2a3035'; g.fillRect(36, CH - 60, CW - 72, 12);
  g.fillStyle = '#2ee6d6'; g.shadowColor = '#2ee6d6'; g.shadowBlur = 12; g.fillRect(36, CH - 60, (CW - 72) * c.pct, 12); g.shadowBlur = 0;
}
const hexRows = (rn) => Array.from({ length: 11 }, () => Array.from({ length: 6 }, () => HEX[rn() * 16 | 0] + HEX[rn() * 16 | 0]).join(' '));
function paint(c) { // back, front, or the scan moving down between them
  const g = c.g;
  if (c.phase === 'back' || c.phase === 'bar') drawBack(g, c);
  else {
    drawFront(g, c.p, c.name);
    if (c.scan < 1) {
      const y = c.scan * CH;
      g.save(); g.beginPath(); g.rect(0, y, CW, CH - y); g.clip(); drawBack(g, c); g.restore();
      g.fillStyle = '#5af2a8'; g.shadowColor = '#5af2a8'; g.shadowBlur = 28; g.fillRect(0, y - 3, CW, 6); g.shadowBlur = 0;
    }
  }
  c.tex.needsUpdate = true;
}
// A small picture of a card's decrypted front: the kept patch in the shop, thumbnails in the catalog.
export function cardImage(p: ZipCard) {
  const big = document.createElement('canvas'); big.width = CW; big.height = CH;
  drawFront(big.getContext('2d'), p, p.id);
  const s = document.createElement('canvas'); s.width = 160; s.height = Math.round(160 * CH / CW);
  s.getContext('2d').drawImage(big, 0, 0, s.width, s.height);
  return s.toDataURL();
}
function glitch(c) { // a few name chars flip to hex, slices of the face jump sideways with a teal tint
  const g = c.g, n = c.p.id.split('').map((ch) => (Math.random() < .25 ? HEX[Math.random() * 16 | 0] : ch)).join('');
  drawFront(g, c.p, n);
  for (let k = 0; k < 2 + (Math.random() * 2 | 0); k++) {
    const y = Math.random() * CH, h = 6 + Math.random() * 34, dx = (Math.random() < .5 ? -1 : 1) * (6 + Math.random() * 20);
    g.drawImage(g.canvas, 0, y, CW, h, dx, y, CW, h);
    g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(46,230,214,.14)'; g.fillRect(0, y, CW, h); g.globalCompositeOperation = 'source-over';
  }
  c.tex.needsUpdate = true;
}

/* ---------- 3D helpers (world units = CSS px at z=0) ---------- */
function rr(w, h, r, s = new THREE.Shape()) {
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function punch(w, h, r, cut, rc = 3) { // rounded rect with the punch card's cut top-left corner, joins rounded too
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + cut + rc, y + h); s.quadraticCurveTo(x + cut, y + h, x + cut - rc * .7, y + h - rc * .7);
  s.lineTo(x + rc * .7, y + h - cut + rc * .7); s.quadraticCurveTo(x, y + h - cut, x, y + h - cut - rc); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function extr(shape, d, b) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 12 });
  g.center(); return g;
}
const slab = (w, h, d, r, b) => extr(rr(w - 2 * b, h - 2 * b, Math.max(1, r - b)), d, b);
function makeEnv(r) { // fake studio: soft boxes in data colours give the glass something to reflect (the mint one makes the card-top glow)
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#3c4c52'); gr.addColorStop(.5, '#121a1e'); gr.addColorStop(1, '#05080a');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512); g.filter = 'blur(12px)';
  [[.1, .3, '#fff', .12, .24], [.3, .28, '#2ee6d6', .1, .3], [.48, .3, '#fff', .18, .2], [.64, .25, '#3dd9ff', .1, .3], [.8, .3, '#5af2a8', .1, .25], [.95, .3, '#fff', .08, .3], [.5, .75, '#2ee6d6', .5, .06]]
    .forEach(([x, y, col, sw, sh]) => { g.fillStyle = col; g.fillRect((x - sw / 2) * 1024, (y - sh / 2) * 512, sw * 1024, sh * 512); });
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(r), e = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose(); return e;
}
function lights(s) { s.add(new THREE.AmbientLight(0xffffff, .3)); const d = new THREE.DirectionalLight(0xffffff, .85); d.position.set(-200, 300, 400); s.add(d); }
function glowSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(46,230,214,.9)'); gr.addColorStop(.4, 'rgba(46,230,214,.25)'); gr.addColorStop(1, 'rgba(46,230,214,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .5 }));
  s.scale.set(360, 360, 1); return s;
}
function canvasTex(w, h, draw?) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.g = c.getContext('2d'); if (draw) draw(t.g, w, h); return t; }
const phys = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ metalness: 0, clearcoat: 1, clearcoatRoughness: .05, transparent: true }, o));
const encl = (o) => phys(Object.assign({ depthWrite: false }, o)); // see-through containers drawn after the cards
const fade = (list, a) => list.forEach((m) => (m.opacity = a));
function seamCracks() { // cracks running from the middle of the seal out to both ends
  const rn = rnd(303), segs = [];
  [-1, 1].forEach((dir) => {
    let x = 512, y = 36, d = 0;
    for (let k = 0; k < 16; k++) {
      const l = 22 + rn() * 26, nx = x + dir * l, ny = Math.max(6, Math.min(66, 36 + (rn() - .5) * 50));
      segs.push([x, y, nx, ny, d]);
      if (rn() < .4) segs.push([nx, ny, nx + dir * rn() * 14, rn() < .5 ? 2 : 70, d + l * .5]);
      x = nx; y = ny; d += l;
    }
  });
  const max = Math.max(...segs.map((s) => s[4])); segs.forEach((s) => (s[4] /= max)); return { segs, w: 1024, h: 72, ox: 512, oy: 36 };
}
function drawCracks(t, c, k) {
  const g = t.g; g.clearRect(0, 0, c.w, c.h);
  g.strokeStyle = 'rgba(210,255,250,.95)'; g.lineWidth = 2.2; g.shadowColor = '#2ee6d6'; g.shadowBlur = 8; g.lineCap = 'round';
  g.beginPath(); c.segs.forEach(([x, y, nx, ny, d]) => { if (d <= k) { g.moveTo(x, y); g.lineTo(nx, ny); } }); g.stroke();
  if (k > 0) { g.beginPath(); g.arc(c.ox, c.oy, 3 + 5 * k, 0, Math.PI * 2); g.stroke(); }
  t.needsUpdate = true;
}
function shards(parent, mat, n, size, box, from, seed) { // glass chips spread through a box, flying away from `from`
  const rn = rnd(seed), out = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Shape(), r0 = size * (.5 + rn() * .7), a0 = rn() * 6.28, nv = 3 + (rn() < .4 ? 1 : 0);
    s.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
    for (let k = 1; k < nv; k++) { const a = a0 + k * (6.28 / nv) + (rn() - .5) * .6, r = size * (.4 + rn() * .8); s.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    const m = new THREE.Mesh(extr(s, size * (.4 + rn() * .6), 0), mat); m.renderOrder = 3; m.visible = false;
    const p = new THREE.Vector3((rn() - .5) * box.x, (rn() - .5) * box.y, (rn() - .5) * box.z), v = p.clone().sub(from).normalize().multiplyScalar(.15 + rn() * .3);
    m.userData = { p0: p, v, r0: new THREE.Vector3(rn() * 6, rn() * 6, rn() * 6), w: new THREE.Vector3(rn() - .5, rn() - .5, rn() - .5).multiplyScalar(.016) };
    m.position.copy(p); parent.add(m); out.push(m);
  }
  return out;
}
function flyShards(list, tau) {
  list.forEach((s) => { const u = s.userData; s.visible = true; s.position.copy(u.p0).addScaledVector(u.v, tau); s.position.y -= .0004 * tau * tau; s.rotation.set(u.r0.x + u.w.x * tau, u.r0.y + u.w.y * tau, u.r0.z + u.w.z * tau); });
}
function plate(text, w, h, sub) { // small printed label on the case
  const t = canvasTex(512, Math.round(512 * h / w), (x, cw, ch) => {
    x.fillStyle = 'rgba(6,24,25,.85)'; x.fillRect(0, 0, cw, ch); x.strokeStyle = '#2ee6d6'; x.lineWidth = 6; x.strokeRect(6, 6, cw - 12, ch - 12);
    x.fillStyle = '#2ee6d6'; x.textAlign = 'center'; x.font = `800 ${Math.round(ch * (sub ? .4 : .5))}px ${FONT}`; x.fillText(text, cw / 2, ch * (sub ? .52 : .66));
    if (sub) { x.fillStyle = '#8b979c'; x.font = `600 ${Math.round(ch * .18)}px ${FONT}`; x.fillText(sub, cw / 2, ch * .8); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })); m.renderOrder = 3; return m;
}

let cardGeo;
function makeCard(p, i, of) {
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  tex.repeat.set(1 / (W - 2 * BV), 1 / (H - 2 * BV)); tex.offset.set(.5, .5); // extrude cap UVs are raw x/y
  // black base + emissive map: the face shows its exact colours, glass reflections come on top
  const face = phys({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, roughness: .2, transmission: .18, envMapIntensity: 1.6, toneMapped: false });
  const side = phys({ color: 0xb5fff6, emissive: 0x0b3f3b, roughness: .05, transmission: .5, envMapIntensity: 2.6 });
  const m = new THREE.Mesh(cardGeo, [face, side]);
  const c = { i, of, seed: i + 1, m, g: cv.getContext('2d'), tex, face, side, p, phase: 'back', pct: 0, scan: 0, name: '', hex: hexRows(rnd(i * 7919 + 13)), op: 1 };
  paint(c); return c;
}

// The sealed case. Its seal print runs all the way round like a ticker and glitches; `corrupt` breaks it into hex.
function buildCase(picks) {
  const g = new THREE.Group(), box = new THREE.Group(); g.add(box);
  const M = {
    body: encl({ color: 0xd8fffa, emissive: 0x05302e, roughness: .08, transmission: .75, envMapIntensity: 2.6 }),
    lid: encl({ color: 0x9ff6ee, emissive: 0x08403c, roughness: .25, transmission: .55, envMapIntensity: 2.2 }),
    seal: phys({ color: 0x5af2a8, emissive: 0x1f8f74, emissiveIntensity: .7, roughness: .12, transmission: .4, envMapIntensity: 2.4 }),
    shard: encl({ color: 0xb8ffe0, emissive: 0x1f8f74, emissiveIntensity: .6, roughness: .06, transmission: .45, envMapIntensity: 2.8 }),
  };
  const cards = picks.map((p, i) => {
    const c = makeCard(p, i, picks.length), k = i - (picks.length - 1) / 2;
    c.m.position.set(k * 3, -k * 2 - 2, k * 9); c.m.rotation.z = k * .065;
    c.b = { p: c.m.position.clone(), rz: c.m.rotation.z }; box.add(c.m); return c;
  });
  const body = new THREE.Mesh(slab(112, 112, 36, 10, 3), M.body); body.position.y = -16; body.renderOrder = 2; box.add(body);
  const lid = new THREE.Mesh(slab(112, 32, 36, 10, 3), M.lid); lid.position.y = 56; lid.renderOrder = 2; box.add(lid);
  const sealG = new THREE.Group(); sealG.position.y = 40; box.add(sealG);
  sealG.add(new THREE.Mesh(slab(116, 8, 40, 2.5, 1.2), M.seal));
  // one canvas holds exactly one lap of the print, so it wraps seamlessly round front, sides and back
  const unit = `SEALED · patch.zip · 0x${CODE} · `, font = `800 34px ${FONT}`;
  const meas = document.createElement('canvas').getContext('2d'); meas.font = font;
  const uw = meas.measureText(unit).width, reps = Math.max(1, Math.round(2720 / uw)), cwc = uw / unit.length, tw = Math.ceil(uw * reps);
  const chars = unit.repeat(reps).split(''), pt = canvasTex(tw, 72), P = 296;
  let s0 = 0;
  const ptx = [[112, 0, 20.2, 0], [36, 58.2, 0, Math.PI / 2], [112, 0, -20.2, Math.PI], [36, -58.2, 0, -Math.PI / 2]].map(([w, x, z, ry]) => {
    const t = pt.clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(w / P, 1); t.o = s0 / P; s0 += w; // r128 textures have no userData
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 7.8), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
    m.position.set(x, 0, z); m.rotation.y = ry; m.renderOrder = 3; sealG.add(m); return t;
  });
  const drawSeal = (p, burst) => {
    const x = pt.g; x.clearRect(0, 0, tw, 72); x.font = font; x.textBaseline = 'middle';
    chars.forEach((ch, i) => {
      const hit = ch !== ' ' && Math.random() < p;
      x.fillStyle = hit ? '#f2fffa' : '#073b33'; x.shadowColor = '#5af2a8'; x.shadowBlur = hit ? 10 : 0;
      x.fillText(hit ? HEX[Math.random() * 16 | 0] : ch, i * cwc, 38 + (hit && burst ? (Math.random() - .5) * 12 : 0));
    });
    x.shadowBlur = 0;
    if (burst) for (let k = 0; k < 2; k++) { const y = Math.random() * 60, h = 6 + Math.random() * 14; x.drawImage(x.canvas, 0, y, tw, h, (Math.random() - .5) * 60, y, tw, h); }
    ptx.forEach((t) => (t.needsUpdate = true));
  };
  drawSeal(0, false);
  let drawnAt = 0;
  const tick = (now, corrupt) => {
    const sc = now * .00004 % 1; ptx.forEach((t) => (t.offset.x = t.o + sc));
    if (now - drawnAt > 90) { drawnAt = now; drawSeal(.015 + corrupt * .6, now % 2300 < 170 || corrupt > .5); }
  };
  const ct = canvasTex(1024, 72);
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(112, 7.8), new THREE.MeshBasicMaterial({ map: ct, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  cp.position.z = 20.4; cp.renderOrder = 4; sealG.add(cp);
  const lt = canvasTex(8, 64, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(90,242,168,0)'); gr.addColorStop(.42, 'rgba(90,242,168,.8)'); gr.addColorStop(.5, '#eafff6'); gr.addColorStop(.58, 'rgba(90,242,168,.8)'); gr.addColorStop(1, 'rgba(90,242,168,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  const leak = new THREE.Mesh(new THREE.PlaneGeometry(130, 1), new THREE.MeshBasicMaterial({ map: lt, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  leak.position.set(0, 40, 21); leak.renderOrder = 5; box.add(leak);
  const ss = shards(box, M.shard, 20, 5, { x: 112, y: 8, z: 38 }, new THREE.Vector3(0, -6, -30), 808);
  ss.forEach((m) => (m.userData.p0.y += 40));
  const label = plate('patch.zip', 80, 23.4, picks.length + ' PAYLOADS · ENCRYPTED'); label.position.set(0, -44, 18.6); box.add(label); M.label = label.material;
  return { g, M, cards, box, lid, sealG, ct, cr: seamCracks(), leak, ss, tick, corrupt: 0 };
}

// Mounts the 3D patch.zip into `host` (it fills it). Resolves false if WebGL fails, so the caller can fall back to DOM cards.
export async function mountZip3d(host: HTMLElement, picks: ZipCard[], opts: ZipOpts): Promise<boolean> {
  try { await Promise.race([Promise.all(['400', '600', '700', '800'].map((w) => document.fonts.load(`${w} 20px "JetBrains Mono"`))), new Promise((r) => setTimeout(r, 1200))]); } catch { /* fonts are optional */ }
  if (!host.isConnected) return true; // the dialog re-rendered while we waited
  host.innerHTML = "<div class='z3stage'></div><p class='meta z3log' aria-live='polite'></p><div class='z3kb'></div>";
  const stage = host.querySelector('.z3stage'), logEl = host.querySelector('.z3log'), kb = host.querySelector('.z3kb');
  let R3;
  try {
    R3 = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch { host.innerHTML = ''; return false; }
  const cv = R3.domElement; cv.className = 'z3gl'; host.appendChild(cv);
  R3.setPixelRatio(Math.min(devicePixelRatio, 2)); R3.outputEncoding = THREE.sRGBEncoding;
  R3.toneMapping = THREE.ACESFilmicToneMapping; R3.toneMappingExposure = 1.1;
  cardGeo ||= extr(punch(W - 2 * BV, H - 2 * BV, CR, CC), D, BV);
  const scene = new THREE.Scene(); scene.environment = makeEnv(R3); lights(scene);
  const cam = new THREE.PerspectiveCamera(30, 1, 1, 8000);
  const glow = glowSprite(); scene.add(glow);
  const ic = buildCase(picks), cards = ic.cards; scene.add(ic.g);
  const flash = (k) => (glow.material.opacity = .5 + .9 * Math.sin(Math.PI * k));
  let state = 'sealed', t0 = 0, flights = null, raf = 0, hover = -1, focus = -1, kept = -1, ptr = null, cw = 180, small = false, grid = false;
  let tx = 0, ty = 0, cx = 0, cy = 0, lastMove = -1e9;
  const GAP = 18, FILL = [650, 900, 1150, 1400];
  const Q0 = new THREE.Quaternion(), SPIN = new THREE.Quaternion(), YA = new THREE.Vector3(0, 1, 0);
  const log = (a, b = '') => { logEl.innerHTML = a + (b ? '<br>' + b : ''); };
  const toWorld = (x, y) => { const z = host.getBoundingClientRect(); return { x: x - z.left - host.clientWidth / 2, y: host.clientHeight / 2 - (y - z.top) }; };
  const center = () => { const r = stage.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); };
  const slot = (i) => { // where card i rests: a row centred where the case stood
    const c = center(), s = cw / W;
    if (focus === i) return { x: c.x, y: c.y, z: 60, s: Math.min(250, host.clientWidth - 40) / W / 1.1 };
    // phones: two per row (2 + 1), rows stacked around the centre
    const row = grid ? Math.floor(i / 2) : 0, rows = grid ? Math.ceil(cards.length / 2) : 1, inRow = grid ? Math.min(2, cards.length - row * 2) : cards.length;
    const kx = (grid ? i % 2 : i) - (inRow - 1) / 2, ky = (rows - 1) / 2 - row, ch = cw * H / W;
    return { x: c.x + kx * (cw + GAP), y: c.y + ky * (ch + GAP), z: (kept === i ? 26 : 0) + (hover === i ? 12 : 0) + (focus >= 0 ? -40 : 0), s: s * (kept === i ? 1.05 : 1) };
  };
  const size = () => {
    const w = host.clientWidth, n = cards.length;
    grid = n > 2 && (w - 24 - (n - 1) * GAP) / n < 130; // a row would leave the cards too small to read
    const per = grid ? 2 : n, rows = Math.ceil(n / per);
    cw = Math.min(grid ? 160 : 190, (w - 24 - (per - 1) * GAP) / per); small = cw < 120;
    const sh = Math.round(Math.max(rows * cw * H / W + (rows - 1) * GAP + 60, 290)) + 'px';
    if (stage.style.height !== sh) stage.style.height = sh;
    const h = host.clientHeight;
    R3.setSize(w, h, false); cam.aspect = w / h; cam.position.set(0, 0, h / 2 / Math.tan(15 * Math.PI / 180)); cam.updateProjectionMatrix();
    const c = center(); glow.position.set(c.x, c.y, -120);
    if (!flights) ic.g.position.set(c.x, c.y, 0);
  };
  const ro = new ResizeObserver(size); ro.observe(host); size();

  function dispose() {
    cancelAnimationFrame(raf); ro.disconnect();
    scene.traverse((o) => { o.geometry?.dispose?.(); [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.emissiveMap?.dispose(); m.dispose(); }); });
    R3.dispose(); R3.forceContextLoss();
  }
  function settled() { // decrypted cards straight in their slots: reopening the shop, reduced motion, or Skip
    flights = []; ic.g.visible = false; ic.sealG.visible = false;
    cards.forEach((c) => {
      scene.attach(c.m); c.phase = 'done'; c.scan = 1; c.name = c.p.id; paint(c); c.live = true;
      const s = slot(c.i); c.m.position.set(s.x, s.y, s.z); c.m.quaternion.identity(); c.m.scale.setScalar(s.s);
    });
    finish();
  }
  function play() {
    if (state !== 'sealed') return;
    state = 'opening'; opts.onOpen();
    if (!opts.animate) return settled();
    t0 = performance.now();
    log('$ unzip <b>patch.zip</b>', 'cracking the seal…');
    // Skip sits in the zone's header line, clear of the cards
    (host.closest('.zipzone') || host).insertAdjacentHTML('beforeend', "<button class='btn zskip z3skip'>Skip ›</button>");
    const sk = (host.closest('.zipzone') || host).querySelector('.z3skip'); sk.onclick = (e) => { e.stopPropagation(); skip(); };
  }
  function skip() { if (state === 'opening') settled(); }
  function startFlight() {
    if (flights) return;
    const now = performance.now();
    flights = cards.map((c) => {
      scene.attach(c.m); c.phase = 'bar'; c.t0 = null; const s = slot(c.i);
      return { c, p0: c.m.position.clone(), q0: c.m.quaternion.clone(), s0: c.m.scale.x, p1: new THREE.Vector3(s.x, s.y, s.z), s1: s.s, t0: now + c.i * 130, done: false };
    });
  }
  function stepCase(t) {
    const g = ic.g;
    g.rotation.x += (.05 - g.rotation.x) * .08; g.rotation.y += (-.1 - g.rotation.y) * .08;
    g.rotation.z = t < 300 ? Math.sin(t / 22) * .03 * (1 - t / 300) : 0;
    // the seal cracks from the middle out, light leaks through the seam, then it bursts
    const kc = eio(seg(t, 200, 700)); ic.corrupt = kc;
    if (t < 760) drawCracks(ic.ct, ic.cr, kc);
    ic.sealG.position.x = t > 200 && t < 720 ? Math.sin(t / 8) * .7 * kc : 0;
    ic.leak.material.opacity = t < 720 ? .9 * kc : .9 * (1 - seg(t, 720, 1100));
    ic.leak.scale.y = 3 + 24 * kc + 40 * seg(t, 720, 900);
    if (t >= 720) { ic.sealG.visible = false; flyShards(ic.ss, t - 720); fade([ic.M.shard], 1 - seg(t, 1100, 1500)); flash(seg(t, 720, 960)); }
    const k2 = eo(seg(t, 760, 1160)); ic.lid.position.y = 56 + 60 * k2; ic.lid.rotation.x = -.5 * k2; ic.lid.rotation.z = .35 * k2; fade([ic.M.lid], 1 - seg(t, 960, 1160));
    ic.box.position.y = -48 * eo(seg(t, 900, 1200)); // the case sinks to give the cards room above it
    const n = cards.length;
    cards.forEach((c, i) => { // front card first, like a dispenser
      if (c.m.parent === scene) return;
      const st = 1100 + (n - 1 - i) * 150, k = eo(seg(t, st, st + 380)), j = i - (n - 1) / 2;
      c.m.position.set(c.b.p.x + j * 34 * k, c.b.p.y + 128 * k, c.b.p.z + 10 * k); c.m.rotation.z = c.b.rz - j * .25 * k;
    });
    if (t >= 1100 + (n - 1) * 150 + 390) startFlight();
    const k4 = seg(t, 1840, 2340); if (k4 > 0) { fade([ic.M.body, ic.M.label], 1 - k4); g.scale.setScalar(1 - .15 * k4); }
  }
  function stepFlight(now) {
    flights.forEach((f) => {
      if (f.done) return;
      const k = clamp((now - f.t0) / 780); if (k <= 0) return;
      const e = eio(k), m = f.c.m;
      m.position.lerpVectors(f.p0, f.p1, e); m.position.z += 170 * Math.sin(Math.PI * e);
      m.quaternion.copy(f.q0).slerp(Q0, e).multiply(SPIN.setFromAxisAngle(YA, Math.PI * 2 * e));
      m.scale.setScalar(lerp(f.s0, f.s1, e));
      if (k >= 1) { f.done = true; f.c.live = true; f.c.t0 = now; }
    });
    if (flights.length && flights.every((f) => f.done)) ic.g.visible = false;
  }
  function stepCards(now) { // bar → scan → done, painted straight onto each card's texture
    cards.forEach((c) => {
      if (c.phase === 'bar') {
        c.pct = c.t0 ? clamp((now - c.t0) / FILL[c.i % FILL.length]) : 0;
        if (!c.hexAt || now - c.hexAt > 90) {
          c.hex = hexRows(Math.random); c.hexAt = now;
          // punch holes flicker, each one locking into the payload's own pattern as the bar fills
          const fin = idHoles(c.p.id);
          c.mask = Array.from({ length: 88 }, (_, k) => ((k * 37 + 11) % 88) / 88 < c.pct * 1.1 ? fin(k >> 2, k & 3) : Math.random() < .22);
        }
        if (c.pct >= 1) { c.phase = 'scan'; c.t1 = now; log('decrypting <b>' + c.p.id + '.bin</b>…'); }
        paint(c);
      } else if (c.phase === 'scan') {
        const k = clamp((now - c.t1) / 480), nk = clamp((now - c.t1) / 520), n = Math.floor(nk * c.p.id.length);
        c.scan = eio(k);
        c.name = c.p.id.slice(0, n) + Array.from({ length: c.p.id.length - n }, () => HEX[Math.random() * 16 | 0]).join('');
        if (k >= 1 && nk >= 1) { c.phase = 'done'; c.name = c.p.id; if (c.p.n > 1) c.flare = now; if (cards.every((x) => x.phase === 'done')) finish(); }
        paint(c);
      } else if (state === 'done' && kept < 0) { // waiting to be picked: a short glitch every few seconds
        if (!c.gAt) c.gAt = now + 1200 + Math.random() * 2500;
        if (now >= c.gAt) {
          c.gEnd ||= now + 170;
          if (now < c.gEnd) glitch(c); else { c.gEnd = 0; c.gAt = now + 1800 + Math.random() * 3500; paint(c); }
        }
      }
      if (!c.live) return;
      const s = slot(c.i), m = c.m, fk = c.flare ? clamp((now - c.flare) / 900) : 1, idle = state === 'done' && focus !== c.i && opts.animate;
      const bob = idle ? Math.sin(now / 900 + c.i * 2.1) * 2.2 : 0;
      m.position.x = lerp(m.position.x, s.x, .14); m.position.y = lerp(m.position.y, s.y + bob, .14); m.position.z = lerp(m.position.z, s.z, .14);
      let rx = idle ? Math.sin(now / 1300 + c.i) * .04 : 0, ry = idle ? Math.sin(now / 1700 + c.i * 1.7) * .06 : 0; // slow drift keeps the reflections moving
      if (ptr && hover === c.i) { rx = (ptr.y - m.position.y) / (H * m.scale.x) * -.5; ry = (ptr.x - m.position.x) / (W * m.scale.x) * .6; }
      m.rotation.x = lerp(m.rotation.x, rx, .12); m.rotation.y = lerp(m.rotation.y, ry, .12); m.rotation.z = lerp(m.rotation.z, 0, .12);
      m.scale.setScalar(lerp(m.scale.x, s.s * (1 + .08 * Math.sin(Math.PI * fk)), .2));
      c.side.emissive.setRGB(lerp(.35, .043, fk), lerp(.95, .247, fk), lerp(.66, .231, fk)); // +2 flare: mint fading back to glass
      c.op = lerp(c.op, kept >= 0 && kept !== c.i ? .3 : 1, .12); fade([c.face, c.side], c.op);
    });
  }
  function finish() {
    if (state === 'done') return;
    state = 'done'; glow.material.opacity = .28;
    (host.closest('.zipzone') || host).querySelector('.z3skip')?.remove();
    log('<b>' + cards.length + '</b> payload patches · keep one');
    kb.innerHTML = cards.map((c) => `<button class="z3sr" data-i="${c.i}">Keep ${c.p.id}.bin, Lv${c.p.lv} → Lv${c.p.lv + c.p.n}, ${c.p.eff}, ${c.p.text}</button>`).join('');
    kb.querySelectorAll('button').forEach((b) => {
      b.onfocus = () => (hover = +b.dataset.i); b.onblur = () => (hover = -1);
      b.onclick = (e) => { e.stopPropagation(); pick(+b.dataset.i, true); };
    });
  }
  function pick(i, direct = false) {
    if (state !== 'done' || kept >= 0) return;
    if (small && !direct && focus !== i) { focus = i; log('tap again to keep <b>' + cards[i].p.id + '.bin</b>'); return; } // phones: first tap enlarges
    focus = -1; kept = i; log('patching <b>' + cards[i].p.id + '.bin</b>…');
    const img = cardImage(cards[i].p);
    setTimeout(() => opts.onPick(i, img), opts.animate ? 420 : 0); // the kept card lifts and the rest dim, then the shop re-renders
  }
  const cardAt = (pt) => {
    for (const i of [focus, ...cards.map((c) => c.i)]) {
      if (i < 0) continue;
      const m = cards[i].m, hw = W * m.scale.x / 2, hh = H * m.scale.x / 2;
      if (Math.abs(pt.x - m.position.x) < hw && Math.abs(pt.y - m.position.y) < hh) return i;
    }
    return -1;
  };
  host.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 220)); ty = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / 220)); lastMove = performance.now();
    ptr = toWorld(e.clientX, e.clientY);
    if (state === 'done') hover = cardAt(ptr);
    host.style.cursor = state === 'sealed' || (state === 'done' && hover >= 0) ? 'pointer' : '';
  });
  host.addEventListener('pointerleave', () => { ptr = null; if (state === 'done') hover = -1; });
  host.addEventListener('click', (e) => {
    if (state === 'sealed') return play();
    if (state === 'opening') return skip();
    const i = cardAt(toWorld(e.clientX, e.clientY));
    if (i >= 0) pick(i); else if (focus >= 0) { focus = -1; log('<b>' + cards.length + '</b> payload patches · keep one'); }
  });

  function loop(now) {
    if (!host.isConnected) return dispose(); // the dialog re-rendered: this canvas is gone
    raf = requestAnimationFrame(loop);
    if (ic.g.visible && ic.sealG.visible) ic.tick(now, ic.corrupt);
    if (state === 'sealed') { // follows the pointer; idle sway shows off the thickness
      const idle = now - lastMove > 1500, gx = idle ? Math.sin(now / 1500) * .55 : tx, gy = idle ? Math.sin(now / 2300) * .3 : ty;
      cx += (gx - cx) * .07; cy += (gy - cy) * .07;
      ic.g.rotation.set(.12 + cy * .35, -.32 + cx * .6, 0);
    } else if (state === 'opening' && ic.g.visible) stepCase(now - t0);
    if (flights) stepFlight(now);
    if (state !== 'sealed') stepCards(now);
    R3.render(scene, cam);
  }
  if (opts.opened || !opts.animate) { state = 'opening'; settled(); }
  else {
    log('<b>patch.zip</b> · sealed · ' + picks.length + ' payload patches inside', 'click the case to open it');
    kb.innerHTML = "<button class='z3sr'>Open patch.zip</button>";
    kb.querySelector('button').onclick = (e) => { e.stopPropagation(); play(); };
  }
  raf = requestAnimationFrame(loop);
  return true;
}
