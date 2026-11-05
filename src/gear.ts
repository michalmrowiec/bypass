import type { ItemId } from './roguelike';

// Shop items drawn as hardware (viewBox 150×84). Classes are styled in style.css; hover animations hang off `.hw`.
const contacts = (x0: number, x1: number, y: number, gap: [number, number]) => {
  let s = '';
  for (let x = x0; x <= x1; x += 4.5) if (x < gap[0] || x > gap[1]) s += "<rect class='g-pin' x='" + x + "' y='" + y + "' width='2.4' height='6'/>";
  return s;
};

const ram = (dx: number, dy: number) => "<g transform='translate(" + dx + ' ' + dy + ")'><rect class='g-led' x='12' y='8' width='104' height='4' rx='2'/>"
  + "<path class='g-pcb' d='M10 13h108v44H76v-5h-6v5H10z'/>"
  + [16, 40, 64, 88].map((x) => "<rect class='g-chip' x='" + x + "' y='19' width='20' height='22'/>").join('')
  + contacts(13, 115, 50, [68, 78]) + "<text class='g-silk' x='14' y='47'>DDR · BUF</text></g>";

// A key with its tip cut off; the tip falls away on hover.
const key = "<circle class='g-steel' cx='26' cy='34' r='15'/><circle class='g-hole' cx='26' cy='34' r='5'/>"
  + "<path class='g-steel' d='M41 29h55v10H90v5h-5v-3h-5v6h-5v-4h-5v5h-5v-4h-5v3h-5v-8H41z'/>"
  + "<line class='g-cut' x1='96' y1='22' x2='96' y2='48'/><path class='g-steel g-tip' d='M98 29h20l-5 10h-15z'/>";

const plug = (x: number, flip: boolean, y = 26) => "<g transform='translate(" + x + ' ' + y + ')' + (flip ? ' scale(-1 1)' : '') + "'>"
  + "<rect class='g-plug' width='22' height='18' rx='2'/>"
  + [4, 8, 12, 16].map((y) => "<line class='g-contact' x1='16' y1='" + y + "' x2='20' y2='" + y + "'/>").join('') + '</g>';

// A patch cable; a signal pulse runs along it on hover.
const cable = (d: string, late = false) => "<path class='g-wire' d='" + d + "'/><path class='g-pulse" + (late ? ' late' : '') + "' d='" + d + "'/>";
const plugs = plug(6, false) + plug(144, true);

// Master key with an asterisk on the bow; v2.0 adds a targeting reticle.
const masterKey = "<circle class='g-steel' cx='28' cy='42' r='17'/><path class='g-star' d='M28 33v18M20.2 37.5l15.6 9M20.2 46.5l15.6-9'/>"
  + "<path class='g-steel' d='M45 38h72v8h-6v7h-5v-4h-5v6h-5v-5h-5v5h-5v-7H45z'/>";
const reticle = "<g class='g-reticle'><circle cx='28' cy='42' r='24'/><path d='M28 11v7M28 66v7M-3 42h7M52 42h7'/></g>";

// M.2 drive: gold fingers, controller, two flash chips and an activity LED.
const ssd = "<rect class='g-pcb' x='14' y='26' width='128' height='32' rx='2'/>"
  + [0, 1, 3, 4, 5, 6].map((i) => "<rect class='g-pin' x='6' y='" + (29 + i * 3.8) + "' width='8' height='2.2'/>").join('')
  + "<circle class='g-hole' cx='136' cy='42' r='3.5'/><rect class='g-chip' x='22' y='31' width='20' height='22'/>"
  + "<rect class='g-chip' x='50' y='30' width='34' height='24'/><rect class='g-chip' x='90' y='30' width='34' height='24'/>"
  + "<text class='g-silk' x='54' y='44'>+15 DATA</text><circle class='g-act' cx='32' cy='42' r='2.5'/>";

// Y-splitter: one cable in, two out; v2.0 has a dial on the junction.
const splitter = (dial: boolean) => "<path class='g-wire' d='M28 35H58'/>"
  + cable('M74 35C96 35 98 18 122 18', true) + cable('M74 35C96 35 98 52 122 52', true)
  + "<rect class='g-plug' x='58' y='28' width='16' height='14' rx='3'/>"
  + (dial ? "<g class='g-dial'><circle cx='66' cy='35' r='5'/><path d='M66 35v-5'/></g>" : '')
  + plug(6, false) + plug(144, true, 9) + plug(144, true, 43);

const ART: Record<ItemId, string> = {
  buffer1: ram(0, 6),
  buffer2: ram(10, 0) + ram(-4, 14),
  shortkey: key,
  linker1: cable('M28 35C55 -6 85 76 120 35') + plugs,
  linker2: cable('M28 31C55 -10 85 72 120 31') + cable('M28 39C55 80 85 0 120 39', true) + plugs,
  wildcard1: masterKey,
  wildcard2: masterKey + reticle,
  datanode: ssd,
  split1: splitter(false),
  split2: splitter(true),
};

export const gear = (id: ItemId) => "<svg class='gear' viewBox='0 0 150 84' aria-hidden='true'>" + ART[id] + '</svg>';
