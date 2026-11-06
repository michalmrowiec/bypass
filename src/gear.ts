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

// Lockpick set: a hooked pick over a tension wrench; the pick rakes on hover.
const lockpick = "<path class='g-wrench' d='M24 60H112V52'/><g class='g-pick'><rect class='g-plug' x='10' y='25' width='40' height='12' rx='4'/>"
  + "<path class='g-shaft' d='M50 31H118l7-7'/></g>";

// Antenna on a small base; its waves pulse out on hover.
const antenna = "<rect class='g-plug' x='48' y='58' width='54' height='14' rx='3'/><circle class='g-act' cx='60' cy='65' r='2'/>"
  + "<path class='g-shaft' d='M75 58V26'/><circle class='g-steel' cx='75' cy='24' r='3'/>"
  + "<path class='g-wave' d='M67 24a8 8 0 0 1 16 0'/><path class='g-wave w2' d='M61 24a14 14 0 0 1 28 0'/><path class='g-wave w3' d='M55 24a20 20 0 0 1 40 0'/>";

// Loopback plug: the cable leaves the plug and comes straight back into it.
const loopback = cable('M44 31C78 31 108 6 122 30C134 52 92 64 44 39') + plug(22, false);
const loopback2 = cable('M44 31C78 31 108 6 122 30C134 52 92 64 44 39') + cable('M44 35C66 35 84 22 92 34C99 46 70 50 44 37', true) + plug(22, false);

// USB stick with an activity LED.
const thumb = "<rect class='g-pcb' x='28' y='28' width='72' height='28' rx='5'/><rect class='g-steel' x='100' y='33' width='24' height='18'/>"
  + "<rect class='g-hole' x='107' y='38' width='4' height='4'/><rect class='g-hole' x='115' y='38' width='4' height='4'/>"
  + "<circle class='g-act' cx='40' cy='42' r='2.5'/><text class='g-silk' x='50' y='45'>+5 DATA</text>";
// Smart card with a gold contact pad.
const chip = "<rect class='g-plug' x='32' y='16' width='86' height='54' rx='6'/><rect class='g-chip' x='44' y='30' width='24' height='20' rx='3'/>"
  + "<text class='g-silk' x='76' y='62'>CREDIT</text>";
// A probe sending pings to the right.
const ping = "<rect class='g-plug' x='26' y='34' width='26' height='16' rx='3'/><circle class='g-act' cx='34' cy='42' r='2'/>"
  + "<path class='g-wave' d='M62 32a14 14 0 0 1 0 20'/><path class='g-wave w2' d='M74 24a26 26 0 0 1 0 36'/><path class='g-wave w3' d='M86 16a38 38 0 0 1 0 52'/>";
// Finned heatsink on a base plate.
const heatsink = "<rect class='g-plug' x='30' y='58' width='90' height='10' rx='2'/>"
  + [34, 44, 54, 64, 74, 84, 94, 104].map((x) => "<rect class='g-steel' x='" + x + "' y='24' width='5' height='34'/>").join('');

// Prepaid SIM: cut corner, gold contacts.
const sim = "<path class='g-plug' d='M40 16h56l14 14v40H40z'/><rect class='g-chip' x='56' y='32' width='34' height='26' rx='3'/>"
  + "<path class='g-cut' d='M73 32v26M56 45h34'/><text class='g-silk' x='46' y='26'>PREPAID</text>";

// Pattern ROM: a DIP chip with ** printed on it.
const rom = "<rect class='g-plug' x='38' y='22' width='74' height='40' rx='3'/>"
  + [44, 54, 64, 74, 84, 94, 104].map((x) => "<rect class='g-pin' x='" + x + "' y='14' width='3' height='8'/><rect class='g-pin' x='" + x + "' y='62' width='3' height='8'/>").join('')
  + "<circle class='g-hole' cx='46' cy='42' r='3'/><text class='g-silk' x='62' y='48'>** ROM</text>";
// Multiplexer: two lines in, a switch, one line out.
const mux = "<path class='g-wire' d='M20 26H56M20 58H56M94 42H130'/><path class='g-plug' d='M56 16L94 28V56L56 68z'/>"
  + "<path class='g-shaft' d='M62 26L88 42'/><circle class='g-act' cx='62' cy='26' r='2.5'/>";

// Repeater: a box with an antenna stub and two pulses going out.
const repeater = "<rect class='g-plug' x='40' y='30' width='56' height='30' rx='3'/><circle class='g-act' cx='50' cy='45' r='2.5'/><text class='g-silk' x='58' y='49'>×2</text>"
  + "<path class='g-wave' d='M104 36a10 10 0 0 1 0 18'/><path class='g-wave w2' d='M112 30a18 18 0 0 1 0 30'/>";
// Tape deck: a cassette with two reels.
const tape = "<rect class='g-plug' x='30' y='22' width='90' height='46' rx='4'/><circle class='g-steel' cx='56' cy='42' r='9'/><circle class='g-steel' cx='94' cy='42' r='9'/>"
  + "<circle class='g-hole' cx='56' cy='42' r='3'/><circle class='g-hole' cx='94' cy='42' r='3'/><path class='g-cut' d='M48 60h54'/>";

// Co-processor: a socketed chip under a heat spreader.
const socket = "<rect class='g-plug' x='40' y='14' width='70' height='56' rx='3'/><rect class='g-steel' x='54' y='26' width='42' height='32' rx='2'/>"
  + "<text class='g-silk' x='59' y='45'>CO-PROC</text><circle class='g-act' cx='46' cy='20' r='2.5'/>";

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
  sidedoor: lockpick,
  bridge: antenna,
  loopback1: loopback,
  loopback2,
  thumb,
  chip,
  ping,
  heatsink,
  sim,
  glob: rom,
  mux,
  repeater,
  rewind: tape,
  socket,
};

export const gear = (id: ItemId) => "<svg class='gear' viewBox='0 0 150 84' aria-hidden='true'>" + ART[id] + '</svg>';
