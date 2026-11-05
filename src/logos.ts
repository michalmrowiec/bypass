// Company logos (viewBox 120×120). Colours are the --lg1..4 of each company's `lg-<id>` class in style.css,
// so the watermark and sealed cards recolour a logo without touching its markup.
const BG = 'var(--bg)';
const stops = (cs: string) => cs.split(' ').map((c, i, a) => `<stop offset='${i / (a.length - 1)}' style='stop-color:var(--lg${c})'/>`).join('');
const lin = (id: string, [x1, y1, x2, y2]: number[], cs: string) =>
  `<linearGradient id='${id}' gradientUnits='userSpaceOnUse' x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}'>${stops(cs)}</linearGradient>`;
const rad = (id: string, [cx, cy, r]: number[], cs: string) =>
  `<radialGradient id='${id}' gradientUnits='userSpaceOnUse' cx='${cx}' cy='${cy}' r='${r}'>${stops(cs)}</radialGradient>`;
const ecg = 'M4 60H34L40 50L48 74L56 38L64 82L70 60H116';
const bolt = 'M62 12L26 66H54L44 110L94 48H66L80 12Z';
const strand = (a: number, b: number) => `M${a} 12C${a} 38 ${b} 34 ${b} 60C${b} 86 ${a} 82 ${a} 108`;
const ringBack = 'M6 60A54 15 0 0 1 114 60', ringFront = 'M6 60A54 15 0 0 0 114 60';
const star = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r * .3} ${y - r * .3}L${x + r} ${y}L${x + r * .3} ${y + r * .3}L${x} ${y + r}L${x - r * .3} ${y + r * .3}L${x - r} ${y}L${x - r * .3} ${y - r * .3}Z`;

// u: a per-render prefix, so gradient ids never clash between copies of one logo on the page.
const LOGOS: Record<string, (u: string) => string> = {
  // Kestrel Logistics: a wing in three strokes.
  kestrel: (u) => `<defs>${lin(u + 'a', [0, 30, 0, 100], '1 2 3')}</defs>`
    + `<g fill='url(#${u}a)'><path d='M30 30H100L92 48H22Z'/><path d='M24 56H84L76 74H16Z'/><path d='M18 82H62L54 100H10Z'/></g>`,
  // Meridian Health: a cross with a heartbeat running through it.
  meridian: (u) => `<defs>${lin(u + 'a', [10, 10, 110, 110], '1 2')}</defs>`
    + `<path fill='url(#${u}a)' d='M52 10H68A8 8 0 0 1 76 18V44H102A8 8 0 0 1 110 52V68A8 8 0 0 1 102 76H76V102A8 8 0 0 1 68 110H52A8 8 0 0 1 44 102V76H18A8 8 0 0 1 10 68V52A8 8 0 0 1 18 44H44V18A8 8 0 0 1 52 10Z'/>`
    + `<path d='${ecg}' fill='none' stroke='${BG}' stroke-width='6' stroke-linejoin='round' stroke-linecap='round'/>`
    + `<path class='lg-trace' pathLength='100' d='${ecg}' fill='none' style='stroke:var(--lg3)' stroke-width='2.5' stroke-linejoin='round' stroke-linecap='round'/>`,
  // Not in the game yet: logos for future contracts.
  // Aurum Capital: a folded A over an emerald bar.
  aurum: (u) => `<defs>${lin(u + 'a', [0, 16, 0, 104], '1 2')}${lin(u + 'b', [0, 16, 0, 104], '2 4')}</defs>`
    + `<rect x='30' y='66' width='60' height='12' style='fill:var(--lg3)'/>`
    + `<path fill='url(#${u}b)' d='M108 104L70 16H58L92 104Z'/><path fill='url(#${u}a)' d='M12 104L50 16H62L28 104Z'/>`,
  // Helix Biosystems: two ribbons, one twist.
  helix: (u) => `<defs>${lin(u + 'a', [0, 12, 0, 108], '1 2')}${lin(u + 'b', [0, 12, 0, 108], '2 3')}</defs>`
    + `<g fill='none' stroke-linecap='round'><path d='${strand(82, 38)}' stroke='url(#${u}b)' stroke-width='11'/>`
    + `<path d='${strand(38, 82)}' stroke='${BG}' stroke-width='19'/><path d='${strand(38, 82)}' stroke='url(#${u}a)' stroke-width='11'/></g>`,
  // Voltline Energy: a bolt breaking out of a hex grid.
  voltline: (u) => `<defs>${lin(u + 'a', [15, 34, 105, 86], '3 2')}${lin(u + 'b', [44, 12, 80, 110], '1 2')}</defs>`
    + `<path d='M60 8L105 34V86L60 112L15 86V34Z' style='fill:var(--lg3)' fill-opacity='.12' stroke='url(#${u}a)' stroke-width='3' stroke-linejoin='round'/>`
    + `<path d='M15 44H105M15 60H105M15 76H105' style='stroke:var(--lg3)' stroke-width='1.5' opacity='.5'/>`
    + `<path d='${bolt}' fill='${BG}' stroke='${BG}' stroke-width='8' stroke-linejoin='round'/><path class='lg-flick' d='${bolt}' fill='url(#${u}b)'/>`,
  // Kármán Aerospace: a ringed planet with a satellite.
  karman: (u) => `<defs>${rad(u + 'a', [48, 46, 40], '2 1 1')}${lin(u + 'b', [6, 60, 114, 60], '3 2 3')}</defs>`
    + `<g transform='rotate(-18 60 60)'><path d='${ringBack}' fill='none' stroke='url(#${u}b)' stroke-width='3' opacity='.6'/></g>`
    + `<circle cx='60' cy='60' r='30' fill='url(#${u}a)'/>`
    + `<g transform='rotate(-18 60 60)'><path d='${ringFront}' fill='none' stroke='${BG}' stroke-width='7'/><path d='${ringFront}' fill='none' stroke='url(#${u}b)' stroke-width='3'/>`
    + `<circle cx='100' cy='70.1' r='4' style='fill:var(--lg3)' stroke='${BG}' stroke-width='2'/></g>`
    + `<path class='lg-twinkle' d='${star(98, 22, 10)}' style='fill:var(--lg3)'/>`,
  // Nyx Exchange: a cut diamond with one glint.
  nyx: (u) => `<defs>${lin(u + 'a', [14, 30, 106, 112], '2 1')}${lin(u + 'b', [14, 30, 106, 112], '1 2')}${lin(u + 'c', [36, 30, 84, 50], '3 1')}</defs>`
    + `<g stroke='${BG}' stroke-width='1.4' stroke-linejoin='round'>`
    + [['M14 50L36 30L41 50Z', 'a'], ['M36 30L60 50H41Z', 'b'], ['M36 30H84L60 50Z', 'c'], ['M84 30L79 50H60Z', 'b'], ['M84 30L106 50H79Z', 'a'],
      ['M14 50H41L60 112Z', 'b'], ['M41 50H60V112Z', 'a'], ['M60 50H79L60 112Z', 'b'], ['M79 50H106L60 112Z', 'a']]
      .map(([d, k]) => `<path d='${d}' fill='url(#${u}${k})'/>`).join('') + '</g>'
    + `<path class='lg-twinkle' d='${star(90, 17, 9)}' style='fill:var(--lg3)'/>`,
  // Argus Telecom: a signal broadcast from one point.
  argus: (u) => `<defs>${lin(u + 'a', [10, 0, 110, 0], '1 2 1')}</defs>`
    + `<g fill='none' stroke='url(#${u}a)' stroke-width='7' stroke-linecap='round'>`
    + [22, 36, 50].map((r, i) => {
      const d = (r * Math.SQRT1_2).toFixed(1), lo = (60 - +d).toFixed(1), hi = (60 + +d).toFixed(1);
      return `<path class='lg-wave' style='animation-delay:${i * .3}s' d='M${hi} ${lo}A${r} ${r} 0 0 1 ${hi} ${hi}M${lo} ${lo}A${r} ${r} 0 0 0 ${lo} ${hi}'/>`;
    }).join('') + `</g><circle cx='60' cy='60' r='9' style='fill:var(--lg2)'/>`,
};

const LOCKED = "<circle class='lg-ring dashed' cx='60' cy='60' r='54'/><text class='lg-q' x='60' y='78'>?</text>";

let seq = 0;
export const logo = (id?: string) => "<svg class='flogo" + (id ? ' lg-' + id : '') + "' viewBox='0 0 120 120' aria-hidden='true'>"
  + (id && LOGOS[id] ? LOGOS[id]('lg' + ++seq) : LOCKED) + '</svg>';

// Run briefing art: a hooded hacker behind a laptop, the code mirrored in their glasses (lines flipped, as a reflection).
export const hacker = "<svg class='hacker' viewBox='0 0 200 200' aria-hidden='true'>"
  + "<defs><radialGradient id='hkGlow' cx='.5' cy='.8' r='.6'><stop offset='0' stop-color='#5af2a8' stop-opacity='.22'/><stop offset='1' stop-color='#5af2a8' stop-opacity='0'/></radialGradient><linearGradient id='hkCloth' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1c2124'/><stop offset='1' stop-color='#0a0c0d'/></linearGradient><radialGradient id='hkFace' cx='.5' cy='1' r='.9'><stop offset='0' stop-color='#5af2a8' stop-opacity='.35'/><stop offset='.6' stop-color='#5af2a8' stop-opacity='.06'/><stop offset='1' stop-color='#5af2a8' stop-opacity='0'/></radialGradient><clipPath id='hkL'><rect x='78' y='91' width='19' height='10' rx='3'/></clipPath><clipPath id='hkR'><rect x='103' y='91' width='19' height='10' rx='3'/></clipPath></defs><ellipse cx='100' cy='150' rx='96' ry='70' fill='url(#hkGlow)'/><g class='hk-body'><path class='hk-cloth' d='M16 200C20 170 38 152 62 142C50 120 46 94 53 72C61 45 82 29 100 22C118 29 139 45 147 72C154 94 150 120 138 142C162 152 180 170 184 200Z'/><path class='hk-fold' d='M62 142C74 150 88 153 100 153S126 150 138 142M53 72C60 98 64 118 70 128M147 72C140 98 136 118 130 128'/><path class='hk-void' d='M68 124C62 98 72 66 100 54C128 66 138 98 132 124C122 136 78 136 68 124Z'/><path d='M68 124C62 98 72 66 100 54C128 66 138 98 132 124C122 136 78 136 68 124Z' fill='url(#hkFace)'/><path class='hk-rim' d='M68 124C62 98 72 66 100 54C128 66 138 98 132 124'/><path class='hk-frame' d='M97 96h6'/><rect class='hk-lens' x='78' y='91' width='19' height='10' rx='3'/><rect class='hk-lens' x='103' y='91' width='19' height='10' rx='3'/><g clip-path='url(#hkL)'><g transform='matrix(-1 0 0 1 175 0)'><g class='hk-refl'><rect x='80' y='92' width='10' height='1.2'/><rect x='82' y='94.5' width='6' height='1.2'/><rect x='80' y='97' width='12' height='1.2'/><rect x='82' y='99.5' width='8' height='1.2'/><rect x='80' y='102' width='10' height='1.2'/><rect x='82' y='104.5' width='6' height='1.2'/><rect x='80' y='107' width='12' height='1.2'/><rect x='82' y='109.5' width='8' height='1.2'/></g></g></g><g clip-path='url(#hkR)'><g transform='matrix(-1 0 0 1 225 0)'><g class='hk-refl'><rect x='105' y='92' width='10' height='1.2'/><rect x='107' y='94.5' width='6' height='1.2'/><rect x='105' y='97' width='12' height='1.2'/><rect x='107' y='99.5' width='8' height='1.2'/><rect x='105' y='102' width='10' height='1.2'/><rect x='107' y='104.5' width='6' height='1.2'/><rect x='105' y='107' width='12' height='1.2'/><rect x='107' y='109.5' width='8' height='1.2'/></g></g></g><path class='hk-str' d='M90 134l-3 26M110 134l3 26'/><circle class='hk-tip' cx='87' cy='162' r='2'/><circle class='hk-tip' cx='113' cy='162' r='2'/></g><path class='hk-lid' d='M52 152h96l6 48H46z'/><path class='hk-edge' d='M52 152h96'/><path class='hk-logo' d='M90 176l5-8.7h10l5 8.7-5 8.7h-10z'/><g class='hk-fx'></g>"
  + '</svg>';
