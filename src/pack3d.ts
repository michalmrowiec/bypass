// @ts-nocheck
// shortcut: untyped port of the daemon-pack mockup (.notes/daemon-packs/4-case.html + d3/core.js); add @types/three@0.128 if this grows.
// A daemon pack in 3D: a flat glass case in the pack's family colours (two families: left/right, a mix: six bands), sealed by a printed glass latch.
// Opened, the latch cracks and bursts, the lid swings up, light spills out and the cards rise in a fan, fly into rows and land face down.
// They flip one by one; a rare/legendary first charges (slow lift, bar fills, edge and backdrop glow in its tier). Edge-on, each card hands over
// to the game's own 2D card, which finishes the turn and plays its revealR/revealL. Same glass, env map, seal and flight as zip3d.ts.
import * as THREE from 'three';
import type { PackHandle, PackOpts, PackView } from './pack3d-api';

const FONT = '"JetBrains Mono", monospace', HEX = '0123456789ABCDEF', MINT = '#5af2a8', DATA = '#2ee6d6', MUTED = '#6b767c';
// Mix order: warm, white in the middle, cool, so no colour gets squeezed at an edge.
const MIX = ['botnet', 'runner', 'cron', 'root', 'splicer', 'ghost'];
const FC = { splicer: '#3dd9ff', ghost: '#b9a6ff', runner: '#f0b35a', cron: '#c6e46b', botnet: '#ff8f6b', root: '#f2f5f8' }; // .c-<family> --fc in style.css
const HOLO = ['#ff3d8b', '#f3e9ff', '#5af2a8', '#3dd9ff', '#b9a6ff', '#ff3d8b'];
const METAL = ['#7d868c', '#f4f8fa', '#98a1a7', '#ffffff', '#7b848a', '#dce3e7', '#8f989e'];
const clamp = (v) => Math.max(0, Math.min(1, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eo = (t) => 1 - (1 - t) ** 3, eio = (t) => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ca = (h, a) => 'rgba(' + rgb(h).join(',') + ',' + a + ')';
const mixc = (h, k, b = '#16191c') => { const x = rgb(h), y = rgb(b); return 'rgb(' + x.map((v, i) => Math.round(v * k + y[i] * (1 - k))).join(',') + ')'; };
const col3 = (h, k = 1, b = '#000000') => new THREE.Color(mixc(h, k, b));
const hgrad = (g, x0, x1, cols) => { const r = g.createLinearGradient(x0, 0, x1, 0); cols.forEach((c, i) => r.addColorStop(i / (cols.length - 1), c)); return r; };
const scanlines = (g, w, h) => { g.fillStyle = 'rgba(255,255,255,.025)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1); };
// Family textures, the canvas twins of --tex in style.css.
function famTex(g, fam, fc, w, h) {
  g.save();
  const lines = (a, f) => { g.strokeStyle = ca(fc, a); g.lineWidth = 1; g.beginPath(); f(); g.stroke(); };
  if (fam === 'splicer') lines(.14, () => { for (let x = -h; x < w; x += 5) { g.moveTo(x, h); g.lineTo(x + h, 0); } });
  if (fam === 'runner') lines(.12, () => { for (let y = .5; y < h; y += 5) { g.moveTo(0, y); g.lineTo(w, y); } });
  if (fam === 'cron') lines(.16, () => { for (let x = .5; x < w; x += 8) { g.moveTo(x, 0); g.lineTo(x, 4); } });
  if (fam === 'root') lines(.1, () => { for (let y = .5; y < h; y += 6) { g.moveTo(0, y); g.lineTo(w, y); } for (let x = .5; x < w; x += 6) { g.moveTo(x, 0); g.lineTo(x, h); } });
  if (fam === 'ghost') { g.fillStyle = ca(fc, .16); for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 6) g.fillRect(x + .5, y + .5, 1, 1); }
  if (fam === 'botnet') { g.fillStyle = ca(fc, .22); for (let y = 0; y < h + 10; y += 10) for (let x = 0; x < w + 10; x += 10) { g.beginPath(); g.arc(x, y, 1, 0, 7); g.arc(x + 5, y + 5, 1, 0, 7); g.fill(); } }
  g.restore();
}

/* ---------- three helpers (world units = CSS px at z = 0) ---------- */
function rr(w, h, r, s = new THREE.Shape()) {
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function extr(shape, d, b) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.1, d - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 12 });
  g.center(); return g;
}
const slab = (w, h, d, r, b) => extr(rr(w - 2 * b, h - 2 * b, Math.max(1, r - b)), d, b);
function makeEnv(r) { // the patch.zip studio: soft boxes in data colours, the mint one gives the glass its top glow
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#3c4c52'); gr.addColorStop(.5, '#121a1e'); gr.addColorStop(1, '#05080a');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 512); g.filter = 'blur(12px)';
  [[.1, .3, '#fff', .12, .24], [.3, .28, '#2ee6d6', .1, .3], [.48, .3, '#fff', .18, .2], [.64, .25, '#3dd9ff', .1, .3], [.8, .3, '#5af2a8', .1, .25], [.95, .3, '#fff', .08, .3], [.5, .75, '#2ee6d6', .5, .06]]
    .forEach(([x, y, col, sw, sh]) => { g.fillStyle = col; g.fillRect((x - sw / 2) * 1024, (y - sh / 2) * 512, sw * 1024, sh * 512); });
  g.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(r), e = pm.fromEquirectangular(t).texture; pm.dispose(); t.dispose(); return e;
}
function canvasTex(w, h, draw?) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.g = c.getContext('2d'); if (draw) draw(t.g, w, h); return t; }
const phys = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ metalness: 0, clearcoat: 1, clearcoatRoughness: .05, transparent: true }, o));
const encl = (o) => phys(Object.assign({ depthWrite: false }, o)); // see-through containers drawn after the cards
const fadeGroup = (g, a) => g.traverse((o) => [].concat(o.material || []).forEach((m) => { m.transparent = true; m.userData.o0 ??= m.opacity; m.opacity = m.userData.o0 * a; }));
// Pack glass painted across its width in the family colours (u = x / w + .5 on extrude caps and front walls): soft, muted.
function famGlass(v, w, o = {}) {
  const cs = v.fams.map((f) => FC[f]), n = cs.length;
  const t = canvasTex(512, 4, (g, cw, ch) => {
    const r = g.createLinearGradient(0, 0, cw, 0);
    if (n === 1) { r.addColorStop(0, cs[0]); r.addColorStop(.5, mixc(cs[0], .8, '#ffffff')); r.addColorStop(1, cs[0]); }
    else if (n === 6) cs.forEach((c, i) => r.addColorStop((i + .5) / n, c));
    else cs.forEach((c, i) => { const e = .15; r.addColorStop(Math.max(0, i / n + e), c); r.addColorStop(Math.min(1, (i + 1) / n - e), c); });
    g.fillStyle = r; g.fillRect(0, 0, cw, ch);
  });
  t.repeat.set(1 / w, 1); t.offset.set(.5, 0);
  return encl(Object.assign({ color: 0xffffff, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .18, roughness: .08, transmission: .75, envMapIntensity: 2.6 }, o));
}
function trimMat(v, holo) { // rare: brushed silver; legendary: holo metal whose colours run
  if (v.tier === 'rare') return phys({ color: 0xe8eef2, metalness: 1, roughness: .2, envMapIntensity: 1.6, transparent: false });
  const t = canvasTex(512, 8, (g, w, h) => { g.fillStyle = hgrad(g, 0, w, [...HOLO, ...HOLO.slice(1)]); g.fillRect(0, 0, w, h); }); t.wrapS = THREE.RepeatWrapping; holo.push(t);
  return phys({ color: 0xffffff, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .35, metalness: .6, roughness: .2, envMapIntensity: 1.4, transparent: false });
}
const plane = (w, h, map, o = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial(Object.assign({ map, transparent: true, toneMapped: false }, o))); m.renderOrder = 3; return m; };
// Lid print: family texture bands (two families split on a slant, a mix in six), the name, the contents, an accent bar in the pack colours.
function label(v, w, h) {
  const S = 1024 / w, t = canvasTex(1024, Math.round(h * S), (g) => {
    g.scale(S, S); g.fillStyle = 'rgba(8,12,14,.86)'; g.fillRect(0, 0, w, h);
    const n = v.fams.length, bw = w / n, sk = n > 1 ? h * .35 : 0;
    v.fams.forEach((f, i) => {
      g.save(); g.beginPath(); g.moveTo(i * bw + (i ? sk : 0), 0); g.lineTo((i + 1) * bw + (i < n - 1 ? sk : 0), 0); g.lineTo((i + 1) * bw - (i < n - 1 ? sk : 0), h); g.lineTo(i * bw - (i ? sk : 0), h); g.closePath(); g.clip();
      const r = g.createLinearGradient(0, 0, w * .2, h); r.addColorStop(0, ca(FC[f], .26)); r.addColorStop(1, ca(FC[f], .06)); g.fillStyle = r; g.fillRect(0, 0, w, h); famTex(g, f, FC[f], w, h); g.restore();
    });
    scanlines(g, w, h);
    g.fillStyle = hgrad(g, 0, w, n > 1 ? v.fams.map((f) => FC[f]) : [FC[v.fams[0]], mixc(FC[v.fams[0]], .55, '#ffffff')]); g.fillRect(0, h - 3, w, 3);
    const fs = Math.min(h * .34, 22), fc = n === 6 ? '#cfd8dc' : FC[v.fams[0]];
    g.font = '800 ' + fs + 'px ' + FONT; g.fillStyle = '#fff'; g.shadowColor = ca(fc, .7); g.shadowBlur = 8; g.fillText(v.name, 12, h / 2 - fs * .05); g.shadowBlur = 0;
    g.font = '600 ' + Math.round(fs * .42) + 'px ' + FONT; g.fillStyle = 'rgba(214,221,224,.7)'; g.fillText((v.sub + ' · encrypted').toUpperCase(), 12, h / 2 + fs * .62);
  });
  t.anisotropy = 8; return plane(w, h, t);
}
// Tier emblem on the lid: a big framed word in holo or brushed silver.
function emblem(v, w, h) {
  const t = canvasTex(1024, Math.round(1024 * h / w), (g, cw, ch) => {
    const cols = v.tier === 'legendary' ? HOLO : METAL, word = v.emblem || v.tier.toUpperCase();
    g.fillStyle = 'rgba(8,10,12,.82)'; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = hgrad(g, 0, cw, cols); g.lineWidth = 10; g.strokeRect(8, 8, cw - 16, ch - 16); g.lineWidth = 3; g.strokeRect(26, 26, cw - 52, ch - 52);
    g.font = '700 ' + Math.round(ch * .15) + 'px ' + FONT; g.fillStyle = 'rgba(214,221,224,.75)'; g.textAlign = 'center'; g.fillText('GUARANTEED', cw / 2, ch * .32);
    let fs = ch * .44; do g.font = '800 ' + Math.round(fs) + 'px ' + FONT; while (g.measureText(word).width > cw - 90 && --fs > 20);
    g.shadowColor = v.tier === 'legendary' ? '#f3e9ff' : '#e8eef2'; g.shadowBlur = 24; g.fillStyle = hgrad(g, cw * .1, cw * .9, cols); g.fillText(word, cw / 2, ch * .76);
  });
  t.anisotropy = 8; return plane(w, h, t);
}
const glowPlane = (w, h, draw) => { const m = plane(w, h, canvasTex(256, 64, draw), { opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); m.renderOrder = 5; return m; };

/* ---------- the latch seal: printed glass that cracks from the middle, leaks light and bursts (zip3d) ---------- */
function makeSeal(v, w, h, d) {
  const g = new THREE.Group(), fc = v.fc;
  const M = { seal: phys({ color: col3(fc, .8, '#ffffff'), emissive: col3(fc, .35), emissiveIntensity: .7, roughness: .12, transmission: .4, envMapIntensity: 2.4 }),
    shard: encl({ color: col3(fc, .7, '#ffffff'), emissive: col3(fc, .3), emissiveIntensity: .6, roughness: .06, transmission: .45, envMapIntensity: 2.8 }) };
  const body = new THREE.Mesh(slab(w, h, d, Math.min(2.5, h / 3), 1), M.seal); g.add(body);
  const unit = 'SEALED · ' + v.name + ' · 0x7A1C · ', font = '800 34px ' + FONT, m2 = document.createElement('canvas').getContext('2d'); m2.font = font;
  const uw = m2.measureText(unit).width, reps = Math.max(2, Math.round(w * 9 / uw)), cwc = uw / unit.length, tw = Math.ceil(uw * reps), chars = unit.repeat(reps).split('');
  const pt = canvasTex(tw, 72); pt.wrapS = THREE.RepeatWrapping; pt.repeat.set(w * 9 / tw, 1);
  const print = plane(w - 2, h - 1, pt); print.position.z = d / 2 + .2; g.add(print);
  const cols = v.fams.length > 1 ? v.fams.map((f) => ca(FC[f], .5)) : [ca(FC[v.fams[0]], .5), ca(FC[v.fams[0]], .3)];
  const drawPrint = (p, burst) => {
    const x = pt.g; x.clearRect(0, 0, tw, 72); x.fillStyle = hgrad(x, 0, tw, cols); x.fillRect(0, 0, tw, 72); x.font = font; x.textBaseline = 'middle';
    chars.forEach((ch, i) => { const hit = ch !== ' ' && Math.random() < p; x.fillStyle = hit ? '#f2fffa' : '#071416'; x.shadowColor = MINT; x.shadowBlur = hit ? 10 : 0;
      x.fillText(hit ? HEX[Math.random() * 16 | 0] : ch, i * cwc, 38 + (hit && burst ? (Math.random() - .5) * 12 : 0)); });
    x.shadowBlur = 0; pt.needsUpdate = true;
  };
  drawPrint(0, false);
  const rn = rnd(303), segs = [];
  [-1, 1].forEach((dir) => { let x = 512, y = 36, dd = 0; for (let k = 0; k < 16; k++) { const l = 22 + rn() * 26, nx = x + dir * l, ny = Math.max(6, Math.min(66, 36 + (rn() - .5) * 50)); segs.push([x, y, nx, ny, dd]); if (rn() < .4) segs.push([nx, ny, nx + dir * rn() * 14, rn() < .5 ? 2 : 70, dd + l * .5]); x = nx; y = ny; dd += l; } });
  const mx = Math.max(...segs.map((s) => s[4])); segs.forEach((s) => (s[4] /= mx));
  const ct = canvasTex(1024, 72), cp = plane(w, h, ct, { blending: THREE.AdditiveBlending, depthWrite: false }); cp.position.z = d / 2 + .4; cp.renderOrder = 4; g.add(cp);
  const lt = canvasTex(8, 64, (x, cw, ch) => { const r = x.createLinearGradient(0, 0, 0, ch); [[0, 'rgba(90,242,168,0)'], [.42, 'rgba(90,242,168,.8)'], [.5, '#eafff6'], [.58, 'rgba(90,242,168,.8)'], [1, 'rgba(90,242,168,0)']].forEach(([k, c]) => r.addColorStop(k, c)); x.fillStyle = r; x.fillRect(0, 0, cw, ch); });
  const leak = plane(w * 1.15, 1, lt, { opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); leak.position.z = d / 2 + 1; leak.renderOrder = 5; g.add(leak);
  const rs = rnd(808), ss = [];
  for (let i = 0, size = Math.max(4, h * .55); i < 22; i++) { // glass chips flying away from behind the seal
    const s = new THREE.Shape(), r0 = size * (.5 + rs() * .7), a0 = rs() * 6.28, nv = 3 + (rs() < .4 ? 1 : 0);
    s.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
    for (let k = 1; k < nv; k++) { const a = a0 + k * (6.28 / nv) + (rs() - .5) * .6, r = size * (.4 + rs() * .8); s.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    const m = new THREE.Mesh(extr(s, size * (.4 + rs() * .6), 0), M.shard); m.renderOrder = 3; m.visible = false;
    const p = new THREE.Vector3((rs() - .5) * w, (rs() - .5) * h, (rs() - .5) * d * 1.4), vel = p.clone().sub(new THREE.Vector3(0, -2, -20)).normalize().multiplyScalar(.15 + rs() * .3);
    m.userData = { p0: p, v: vel, r0: new THREE.Vector3(rs() * 6, rs() * 6, rs() * 6), w: new THREE.Vector3(rs() - .5, rs() - .5, rs() - .5).multiplyScalar(.016) };
    m.position.copy(p); g.add(m); ss.push(m);
  }
  let drawnAt = 0, corrupt = 0;
  return {
    g,
    tick(now) { pt.offset.x = now * .00004 % 1; if (now - drawnAt > 90 && body.visible) { drawnAt = now; drawPrint(.015 + corrupt * .6, now % 2300 < 170 || corrupt > .5); } },
    step(t) { // ms since opening: cracks 200–700, burst at 720; returns the flash strength
      const kc = eio(seg(t, 200, 700)); corrupt = kc;
      if (t < 760) {
        const x = ct.g; x.clearRect(0, 0, 1024, 72); x.strokeStyle = 'rgba(210,255,250,.95)'; x.lineWidth = 2.2; x.shadowColor = DATA; x.shadowBlur = 8; x.lineCap = 'round';
        x.beginPath(); segs.forEach(([a, b, c2, d2, e]) => { if (e <= kc) { x.moveTo(a, b); x.lineTo(c2, d2); } }); x.stroke(); ct.needsUpdate = true;
      }
      g.position.x = t > 200 && t < 720 ? Math.sin(t / 8) * .7 * kc : 0;
      leak.material.opacity = t < 720 ? .9 * kc : .9 * (1 - seg(t, 720, 1100)); leak.scale.y = 3 + 24 * kc + 40 * seg(t, 720, 900);
      if (t >= 720) {
        body.visible = print.visible = cp.visible = false;
        ss.forEach((s) => { const u = s.userData, tau = t - 720; s.visible = true; s.position.copy(u.p0).addScaledVector(u.v, tau); s.position.y -= .0004 * tau * tau; s.rotation.set(u.r0.x + u.w.x * tau, u.r0.y + u.w.y * tau, u.r0.z + u.w.z * tau); });
        M.shard.opacity = 1 - seg(t, 1100, 1500);
      }
      return seg(t, 720, 960);
    },
  };
}

/* ---------- the case ---------- */
const CWD = 620, CHT = 128, TD = 30, LD = 12;
function buildCase(v, cards, holo) {
  const g = new THREE.Group(), box = new THREE.Group(), n = cards.length; g.add(box);
  const tray = new THREE.Mesh(slab(CWD, CHT, TD, 12, 3), famGlass(v, CWD)); tray.renderOrder = 2; box.add(tray);
  const tm = v.tier ? trimMat(v, holo) : famGlass(v, CWD + 6, { emissiveIntensity: .28, transmission: .25, envMapIntensity: 1.4 });
  const rim = new THREE.Mesh(slab(CWD + 6, CHT + 6, 5, 14, 1.5), tm); rim.position.z = TD / 2 - 2; box.add(rim);
  const lightC = v.tier === 'legendary' ? '#f3e9ff' : v.tier === 'rare' ? '#e8eef2' : v.fc;
  const inner = glowPlane(CWD - 30, CHT - 16, (x, w, h) => { const r = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, lightC); r.addColorStop(.5, lightC + '66'); r.addColorStop(1, lightC + '00'); x.fillStyle = r; x.fillRect(0, 0, w, h); });
  inner.position.z = -TD / 2 + 5; box.add(inner); // light inside: spills out as the lid opens
  // rare/legendary: light already leaks from the seam (legendary in holo colours, pulsing)
  const seam = v.tier ? glowPlane(CWD - 10, 10, (x, w, h) => { x.fillStyle = hgrad(x, 0, w, v.tier === 'legendary' ? HOLO : ['#ffffff00', '#ffffff', '#ffffff', '#ffffff00']); x.fillRect(0, 0, w, h);
    const r = x.createLinearGradient(0, 0, 0, h); r.addColorStop(0, '#000'); r.addColorStop(.5, '#fff'); r.addColorStop(1, '#000'); x.globalCompositeOperation = 'multiply'; x.fillStyle = r; x.fillRect(0, 0, w, h); }) : null;
  if (seam) { seam.rotation.x = Math.PI / 2; seam.position.set(0, -CHT / 2 - 1, TD / 2 + 1); box.add(seam); }
  const hinge = new THREE.Group(); hinge.position.set(0, CHT / 2, TD / 2 + LD / 2); box.add(hinge); // frosted lid on a hinge along the back edge
  const lid = new THREE.Mesh(slab(CWD + 4, CHT + 4, LD, 12, 3), famGlass(v, CWD + 4, { roughness: .35, transmission: .3, envMapIntensity: 1.1, emissiveIntensity: .22 })); lid.position.y = -CHT / 2; lid.renderOrder = 2; hinge.add(lid);
  const lw = v.tier ? CWD - 280 : CWD - 60, lab = label(v, lw, 44); lab.position.set(-CWD / 2 + 30 + lw / 2, -CHT / 2 + 10, LD / 2 + .6); hinge.add(lab);
  if (v.tier) { const e = emblem(v, 210, 64); e.position.set(CWD / 2 - 135, -CHT / 2 + 4, LD / 2 + .7); hinge.add(e); }
  const seal = makeSeal(v, 120, 16, 8); seal.g.position.set(0, -CHT / 2 - 2, TD / 2 + 6); box.add(seal.g);
  const z0 = (i) => 2 + (n - 1 - i) * 7, mid = (n - 1) / 2; // the first card lies on top
  cards.forEach((c, i) => { c.m.position.set(0, 0, z0(i)); box.add(c.m); });
  const last = 1800 + (n - 1) * 220 + 200;
  return {
    g, rest: { x: -.55, y: -.04 }, end: last + 700,
    tick(now) { seal.tick(now); if (seam && seam.visible) seam.material.opacity = v.tier === 'legendary' ? .55 + .35 * Math.sin(now / 520) : .5; },
    step(t, release) {
      const fl = seal.step(t);
      const kl = eo(seg(t, 780, 1350)); hinge.rotation.x = -1.95 * kl; fadeGroup(hinge, 1 - .75 * seg(t, 1100, 1500));
      inner.material.opacity = (v.tier ? 1 : .7) * seg(t, 760, 1100) * (1 - seg(t, last, last + 400));
      if (seam) seam.visible = t < 900;
      g.rotation.x += ((-.15) - g.rotation.x) * .05 * seg(t, 900, 1400); // the case tips up toward the camera as it opens
      cards.forEach((c, i) => { // rise in a fan, the top card highest, then take off one by one
        const kr = eo(seg(t, 1250 + i * 60, 1750 + i * 60)), st = 1800 + i * 220;
        if (!c.flight) { c.m.position.z = z0(i) + 60 * kr + (n - 1 - i) * 26 * kr; c.m.position.y = (mid - i) * 24 * kr; c.m.rotation.z = (mid - i) * .05 * kr; }
        if (t >= st + 200) release(c);
      });
      const k4 = seg(t, last + 300, last + 800); if (k4 > 0) { fadeGroup(box, 1 - k4); g.position.y = -40 * eo(k4); if (k4 >= 1) g.visible = false; }
      return fl;
    },
  };
}

/* ---------- cards: long glass slabs, only their encrypted back is ever seen in 3D ---------- */
const W = 560, H = 72, D = 6, BV = 2, CUT = 14, IW = W - 2 * BV, IH = H - 2 * BV, CW = 1280, K = CW / IW, CH = Math.round(IH * K);
const LOCK = [new Path2D('M5 11h14v10H5z'), new Path2D('M8 11V8a4 4 0 0 1 8 0v3M12 15v2')];
const outline = (g, i) => { g.beginPath(); g.moveTo(i, i); g.lineTo(IW - CUT - i * .4, i); g.lineTo(IW - i, CUT + i * .4); g.lineTo(IW - i, IH - i); g.lineTo(i, IH - i); g.closePath(); };
const hexRow = (n) => Array.from({ length: n }, () => HEX[Math.random() * 16 | 0] + HEX[Math.random() * 16 | 0]).join(' ');
function drawBack(c) { // nothing about the daemon, only the pack colour; the bar fills while a rare/legendary charges
  const g = c.g, fc = c.pk, hx = [hexRow(3), hexRow(4), hexRow(16), hexRow(16)];
  g.setTransform(K, 0, 0, K, 0, 0); g.clearRect(0, 0, IW, IH);
  const bg = g.createLinearGradient(0, 0, IW, IH * 1.6); bg.addColorStop(0, mixc(fc, .14, '#0d1012')); bg.addColorStop(.7, '#0d1012'); g.fillStyle = bg; g.fillRect(0, 0, IW, IH); scanlines(g, IW, IH);
  outline(g, .5); g.strokeStyle = ca(fc, .45); g.lineWidth = 1; g.stroke();
  g.beginPath(); g.moveTo(IW - CUT, 0); g.lineTo(IW - CUT, CUT); g.lineTo(IW, CUT); g.closePath(); g.fillStyle = mixc(fc, .3); g.fill();
  const iy = (IH - 40) / 2; g.fillStyle = ca(fc, .08); g.fillRect(10, iy, 40, 40); g.strokeStyle = ca(fc, .35); g.strokeRect(10.5, iy + .5, 39, 39);
  g.save(); g.translate(18, iy + 8); g.strokeStyle = ca(fc, .8); g.lineWidth = 1.5; g.lineJoin = g.lineCap = 'round'; LOCK.forEach((p) => g.stroke(p)); g.restore();
  g.font = '700 13px ' + FONT; g.fillStyle = ca(fc, .75); g.fillText(hx[0].replace(/ /g, '') + '/' + hx[1].replace(/ /g, '') + '.dmn', 62, 26);
  g.font = '400 10px ' + FONT; g.fillStyle = ca(fc, .45); g.fillText(hx[2], 62, 42); g.fillText(hx[3], 62, 55);
  const fx = IW - 120; g.strokeStyle = ca(fc, .25); g.beginPath(); g.moveTo(fx + .5, 0); g.lineTo(fx + .5, IH); g.stroke();
  g.font = '700 10px ' + FONT; g.fillStyle = fc; g.fillText(c.pct > 0 ? '▣ DECRYPTING' : '▣ ENCRYPTED', fx + 12, 30);
  if (c.pct > 0) { g.fillStyle = MUTED; g.textAlign = 'right'; g.fillText(Math.round(c.pct * 100) + '%', IW - 12, 30); g.textAlign = 'left'; }
  g.fillStyle = ca(fc, .18); g.fillRect(fx + 12, 40, IW - fx - 24, 4);
  g.fillStyle = MINT; g.shadowColor = MINT; g.shadowBlur = 6; g.fillRect(fx + 12, 40, (IW - fx - 24) * c.pct, 4); g.shadowBlur = 0;
  c.tex.needsUpdate = true;
}
let cardGeo;
function makeCard(i, v, rar) {
  if (!cardGeo) {
    const s = new THREE.Shape(), x = -IW / 2, y = -IH / 2, cc = CUT - 1;
    s.moveTo(x, y); s.lineTo(x + IW, y); s.lineTo(x + IW, y + IH - cc); s.lineTo(x + IW - cc, y + IH); s.lineTo(x, y + IH); s.closePath();
    cardGeo = extr(s, D, BV);
  }
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  tex.repeat.set(1 / IW, -1 / IH); tex.offset.set(.5, .5); // extrude cap UVs are raw x/y; flipped so it reads upright face down
  const face = phys({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, roughness: .2, transmission: .18, envMapIntensity: 1.6, toneMapped: false });
  const side = phys({ color: col3(v.fc, .55, '#ffffff'), emissive: col3(v.fc, .18), roughness: .05, transmission: .5, envMapIntensity: 2.6 });
  const m = new THREE.Mesh(cardGeo, [face, side]); m.rotation.x = Math.PI; // face down
  const c = { i, m, g: cv.getContext('2d'), tex, face, side, pk: v.fc, rar, pct: 0, phase: 'back', sideA: side.emissive.clone() };
  drawBack(c); return c;
}

/* ---------- the scene ---------- */
const TIER = { rare: new THREE.Color('#e8eef2'), legendary: new THREE.Color('#ffd6f5') };
const PRE = { common: 0, rare: 1100, legendary: 1800 };
const CAMD = 440 / 2 / Math.tan(15 * Math.PI / 180); // the calm charge before a rare/legendary flips
// Mounts a sealed pack into `host` (it fills it). Resolves null if WebGL fails, so the caller can fall back to the 2D offer.
export async function mountPack3d(host: HTMLElement, view: PackView, opts: PackOpts): Promise<PackHandle | null> {
  try { await Promise.race([Promise.all(['600', '700', '800'].map((w) => document.fonts.load(w + ' 20px "JetBrains Mono"'))), new Promise((r) => setTimeout(r, 1200))]); } catch { /* fonts are optional */ }
  if (!host.isConnected) return null;
  let R3;
  try { R3 = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return null; }
  const v = { ...view, fams: view.fams.length === 6 ? MIX : view.fams, fc: view.fams.length === 6 ? '#cfd8dc' : FC[view.fams[0]] };
  host.innerHTML = "<div class='pk3dom'></div>";
  const dom = host.querySelector('.pk3dom');
  host.prepend(R3.domElement); R3.domElement.className = 'pk3gl';
  R3.setPixelRatio(Math.min(devicePixelRatio, 2)); R3.outputEncoding = THREE.sRGBEncoding; R3.toneMapping = THREE.ACESFilmicToneMapping; R3.toneMappingExposure = 1.1;
  const scene = new THREE.Scene(); scene.environment = makeEnv(R3);
  scene.add(new THREE.AmbientLight(0xffffff, .3)); const dl = new THREE.DirectionalLight(0xffffff, .85); dl.position.set(-200, 300, 400); scene.add(dl);
  const glowT = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(.4, 'rgba(255,255,255,.25)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  const BASEC = new THREE.Color(v.tier === 'legendary' ? '#f3e9ff' : v.tier === 'rare' ? '#e8eef2' : '#2ee6d6');
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: BASEC, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: .45 }));
  glow.scale.set(520, 300, 1); glow.position.z = -160; scene.add(glow);
  const cam = new THREE.PerspectiveCamera(30, 1, 1, 8000);
  const cards = view.rars.map((rar, i) => makeCard(i, v, rar));
  const holo = [], pk = buildCase(v, cards, holo); scene.add(pk.g);
  let state = 'sealed', t0 = 0, raf = 0, w = 0, h = 0, s1 = 1, tx = 0, ty = 0, cx = 0, cy = 0, lastMove = -1e9, nextAt = 0;
  const GAP = 14, SPIN = new THREE.Quaternion(), XA = new THREE.Vector3(1, 0, 0), QB = new THREE.Quaternion().setFromAxisAngle(XA, Math.PI);
  const slotY = (i) => ((cards.length - 1) / 2 - i) * (H * s1 + GAP);
  const size = () => {
    w = host.clientWidth; h = host.clientHeight;
    // a fixed camera distance (the open stage's) keeps the perspective mild in a short sealed slot; the fov keeps 1 world unit = 1 px at z = 0
    R3.setSize(w, h, false); cam.aspect = w / h; cam.fov = 2 * Math.atan(h / 2 / CAMD) * 180 / Math.PI; cam.position.set(0, 0, CAMD); cam.updateProjectionMatrix();
    s1 = Math.min(1, (w - 24) / W); pk.g.scale.setScalar(.6 * Math.min(1, w / 620));
    cards.forEach((c) => c.dom && place(c));
  };
  // Hand a card over to the game's own 2D card at the same spot, edge-on mid-flip: it finishes the turn and plays its reveal.
  function place(c) { const el = c.dom; el.style.transform = 'scale(' + s1 + ')'; el.style.left = (w - W * s1) / 2 + 'px'; el.style.top = h / 2 - slotY(c.i) - el.offsetHeight * s1 / 2 + 'px'; }
  function toDom(c, flip = true) {
    const el = document.createElement('div'); el.className = 'pk3card'; el.style.width = W + 'px'; el.style.minHeight = H + 'px';
    el.innerHTML = opts.card(c.i); dom.appendChild(el); c.dom = el; place(c); c.m.visible = false;
    const d = el.querySelector('.dcard');
    if (flip) { d.style.transition = 'none'; d.style.setProperty('--rx', '-90deg'); void d.offsetWidth; d.style.transition = ''; d.style.setProperty('--rx', '0deg'); }
    setTimeout(() => {
      d.style.removeProperty('--rx'); opts.onCard(el, c.i);
      if (flip && c.rar !== 'common') { d.style.animationDelay = c.rar === 'rare' ? '-.24s' : '-.63s'; d.classList.add('reveal'); } // revealR/revealL from their first flash
    }, flip ? 200 : 0);
  }
  const finish = () => { if (state === 'done') return; state = 'done'; opts.log('<b>' + cards.length + '</b> daemons · choose one'); opts.onDone?.(); };
  const settle = () => { // Skip, or reduced motion: every card straight to its 2D place
    pk.g.visible = false; cards.forEach((c) => { c.phase = 'done'; if (!c.dom) toDom(c, false); }); finish();
  };
  const ro = new ResizeObserver(size); ro.observe(host); size();
  const release = (c) => { // a card leaves the case for its row
    if (c.flight) return; scene.attach(c.m);
    c.flight = { p0: c.m.position.clone(), q0: c.m.quaternion.clone(), s0: c.m.scale.x, t0: performance.now() };
  };
  const open = () => {
    if (state !== 'sealed') return;
    state = 'opening'; t0 = performance.now(); R3.domElement.style.cursor = '';
    opts.log('$ tar -xzf <b>' + view.name + '</b> · breaking the seal…');
    if (!opts.animate) settle();
  };
  R3.domElement.addEventListener('click', () => (state === 'sealed' ? opts.onPick() : state === 'opening' ? settle() : 0));
  R3.domElement.addEventListener('pointermove', (e) => {
    const r = R3.domElement.getBoundingClientRect(); tx = clamp((e.clientX - r.left) / r.width) * 2 - 1; ty = clamp((e.clientY - r.top) / r.height) * 2 - 1; lastMove = performance.now();
    R3.domElement.style.cursor = state === 'sealed' ? 'pointer' : '';
  });

  function stepCards(now) {
    const landed = cards.every((c) => c.live); let busy = cards.some((c) => c.phase === 'charge' || c.phase === 'flip'), gk = 0, gc = null;
    cards.forEach((c) => {
      const f = c.flight, m = c.m;
      if (f && !c.live) { // arc toward the camera, rolling over the long axis, landing face down
        const k = clamp((now - f.t0) / 820), e = eio(k);
        m.position.lerpVectors(f.p0, new THREE.Vector3(0, slotY(c.i), 0), e); m.position.z += 150 * Math.sin(Math.PI * e);
        m.quaternion.copy(f.q0).slerp(QB, e).multiply(SPIN.setFromAxisAngle(XA, Math.PI * 2 * e));
        m.scale.setScalar(lerp(f.s0, s1, e));
        if (k >= 1) { c.live = true; c.fx = 0; m.rotation.set(Math.PI, 0, 0); }
      }
      if (!c.live || c.dom) return;
      if (!c.hexAt || now - c.hexAt > (c.phase === 'charge' ? 90 : 120)) { c.hexAt = now; drawBack(c); }
      if (landed && !busy && c.phase === 'back' && now >= nextAt && cards.find((x) => x.phase === 'back') === c) { // one card at a time
        busy = true;
        if (PRE[c.rar]) { c.phase = 'charge'; c.tc = now; opts.log('decrypting… <b>' + c.rar + '</b> signature'); } else { c.phase = 'flip'; c.tf = now; }
      }
      if (c.phase === 'charge') { c.pct = clamp((now - c.tc) / PRE[c.rar]); if (c.pct >= 1) { c.phase = 'flip'; c.tf = now; } }
      let ch = 0;
      if (c.phase === 'flip') {
        c.fx = eio(clamp((now - c.tf) / (c.rar === 'common' ? 420 : 340)));
        if (c.fx >= .5) { c.phase = 'done'; nextAt = now + 180; toDom(c); if (cards.every((x) => x.phase === 'done')) setTimeout(finish, 250); return; } // edge-on
      } else if (c.phase === 'charge') ch = c.pct;
      // charging: a slow lift and lean back, then it holds still for a beat before flipping
      m.position.x = lerp(m.position.x, 0, .14); m.position.y = lerp(m.position.y, slotY(c.i), .14); m.position.z = lerp(m.position.z, 22 * eio(clamp(ch / .85)), .08);
      const rx = ch ? -.07 * eio(clamp(ch / .85)) : 0, base = Math.PI * (1 - (c.fx || 0));
      m.rotation.x = c.phase === 'flip' ? base + rx : lerp(m.rotation.x, base + rx, .14); m.rotation.y = lerp(m.rotation.y, 0, .2); m.rotation.z = lerp(m.rotation.z, 0, .12);
      m.scale.setScalar(lerp(m.scale.x, s1, .25));
      if (ch) { c.side.emissive.copy(c.sideA).lerp(TIER[c.rar], .6 * eio(ch)); gk = Math.max(gk, .5 * eio(ch)); gc = TIER[c.rar]; }
    });
    if (gc) { glow.material.color.copy(BASEC).lerp(gc, gk); glow.material.opacity = .45 + .9 * gk; }
    else if (state === 'done') glow.material.opacity = lerp(glow.material.opacity, 0, .05);
  }
  function loop(now) {
    if (!host.isConnected) return dispose(); // the dialog re-rendered: this canvas is gone
    raf = requestAnimationFrame(loop);
    holo.forEach((t) => (t.offset.x = now / 6000 % 1));
    if (pk.g.visible) pk.tick(now);
    if (state === 'sealed') { // follows the pointer; idle sway shows off the thickness
      const idle = now - lastMove > 1500, gx = idle ? Math.sin(now / 2600) * .35 : tx, gy = idle ? Math.sin(now / 3400) * .3 : ty;
      cx += (gx - cx) * .05; cy += (gy - cy) * .05; pk.g.rotation.set(pk.rest.x + cy * .03, pk.rest.y + cx * .05, 0); // a small lean, not a swing
    } else if (pk.g.visible) { const fl = pk.step(now - t0, release); if (fl) glow.material.opacity = .45 + .9 * Math.sin(Math.PI * fl); }
    stepCards(now);
    R3.render(scene, cam);
  }
  function dispose() {
    cancelAnimationFrame(raf); ro.disconnect();
    scene.traverse((o) => { if (o.geometry !== cardGeo) o.geometry?.dispose?.(); [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.emissiveMap?.dispose(); m.dispose(); }); });
    R3.dispose(); R3.forceContextLoss();
  }
  raf = requestAnimationFrame(loop);
  return { open, dispose };
}
