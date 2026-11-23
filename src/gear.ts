import type { ItemId } from './roguelike';
import { gearGlass } from './gearGlass';

// The data icon: two stacked files (24×24). The UI shows it next to every data amount.
export const DATA_PATHS = "<path d='M10 2h7l4 4v11h-5'/><path d='M4 7h8l4 4v11H4z'/><path d='M12 7v4h4'/>";
// The data icon inside a gear drawing, its top-left at x,y and `size` units tall.
const dataGlyph = (x: number, y: number, size: number) => "<g class='g-di' transform='translate(" + x + ' ' + y + ') scale(' + size / 24 + ")'>" + DATA_PATHS + '</g>';

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
// v2.0: green fingers that light up in turn on hover, like the Glob ROM, and a pink LED.
const ssdArt = (v2: boolean) => "<rect class='g-pcb' x='14' y='26' width='128' height='32' rx='2'/>"
  + [0, 1, 3, 4, 5, 6].map((i, k) => "<rect class='g-pin" + (v2 ? " g-green g-read' style='animation-delay:" + k * 0.1 + "s" : '') + "' x='6' y='" + (29 + i * 3.8) + "' width='8' height='2.2'/>").join('')
  + "<circle class='g-hole' cx='136' cy='42' r='3.5'/><rect class='g-chip' x='22' y='31' width='20' height='22'/>"
  + "<rect class='g-chip' x='50' y='30' width='74' height='24'/>"
  + "<text class='g-silk g-num' x='92' y='47.5' text-anchor='end'>" + (v2 ? '+30' : '+15') + '</text>' + dataGlyph(95, 35, 14) + "<circle class='g-act" + (v2 ? ' g-pink' : '') + "' cx='32' cy='42' r='2.5'/>";

// v3.0: two v2.0 drives, staggered like the dual Buffer.
const ssdPair = "<g transform='translate(-4 -13)'>" + ssdArt(true) + "</g><g transform='translate(4 13)'>" + ssdArt(true) + '</g>';

// Router: a cable in port 1, the only lit port, and the × on the case; on hover a pulse runs up the cable and the port LED blinks.
// v2.0: a pink LED on port 1.
const port = (x: number, n: number, led: string) => "<rect class='g-hole' x='" + x + "' y='46' width='16' height='13' rx='1'/>"
  + "<circle class='" + led + "' cx='" + (x + 8) + "' cy='40' r='2'/><text class='g-silk' x='" + (x + 8) + "' y='66' text-anchor='middle'>" + n + '</text>';
// Lifted 9 so the case sits centred; the cable still runs to the bottom edge.
const prio = (k: number) => "<g transform='translate(0 -9)'><rect class='g-plug' x='10' y='30' width='130' height='42' rx='4'/>"
  + port(20, 1, k > 2 ? 'g-act g-pink' : 'g-act') + port(40, 2, 'g-tongue') + port(60, 3, 'g-tongue') + port(80, 4, 'g-tongue')
  + "<rect class='g-pcb' x='99' y='36' width='38' height='30' rx='3'/><text class='g-mult' x='102' y='57'>×" + k + '</text>' + dataGlyph(123, 45.5, 11.5)
  + "<path class='g-wire' d='M28 52V93'/><path class='g-pulse g-fast' d='M28 93V52'/><rect class='g-plug' x='22' y='47' width='12' height='12' rx='1'/></g>";

// Y-splitter: one pulse comes in from the left and splits in two at the junction; v2.0 has a tuning dial that sweeps.
const flow = (d: string, part: string) => "<path class='g-wire' d='" + d + "'/><path class='g-flow " + part + "' pathLength='100' d='" + d + "'/>";
const splitter = (tune: boolean) => flow('M28 35H58', 'in') + flow('M74 35C96 35 98 18 122 18', 'out') + flow('M74 35C96 35 98 52 122 52', 'out')
  + (tune
    ? "<rect class='g-plug' x='53' y='23' width='26' height='24' rx='3'/><path class='g-tick' d='M57 27l2 2M66 25v3M75 27l-2 2'/>"
      + "<g class='g-dial'><circle cx='66' cy='37' r='6'/><path d='M66 37v-6'/></g>"
    : "<rect class='g-plug' x='58' y='28' width='16' height='14' rx='3'/>")
  + plug(6, false) + plug(144, true, 9) + plug(144, true, 43);

// Lockpick set: a hooked pick over a tension wrench; the pick rakes on hover.
const lockpick = "<path class='g-wrench' d='M24 60H112V52'/><g class='g-pick'><rect class='g-plug' x='10' y='25' width='40' height='12' rx='4'/>"
  + "<path class='g-shaft' d='M50 31H118l7-7'/></g>";

// Antenna on a small base; its waves pulse out on hover.
const antenna = "<rect class='g-plug' x='48' y='58' width='54' height='14' rx='3'/><circle class='g-act' cx='60' cy='65' r='2'/>"
  + "<path class='g-shaft' d='M75 58V26'/><circle class='g-steel' cx='75' cy='24' r='3'/>"
  + "<path class='g-wave' d='M67 24a8 8 0 0 1 16 0'/><path class='g-wave w2' d='M61 24a14 14 0 0 1 28 0'/><path class='g-wave w3' d='M55 24a20 20 0 0 1 40 0'/>";

// Bridge v2.0: a twin-mast array on a wider base, each mast with its own waves.
const mast = (x: number, cls = '') => "<g class='" + cls + "'><path class='g-shaft' d='M" + x + " 58V26'/><circle class='g-steel' cx='" + x + "' cy='24' r='3'/>"
  + "<path class='g-wave' d='M" + (x - 8) + " 24a8 8 0 0 1 16 0'/><path class='g-wave w2' d='M" + (x - 14) + " 24a14 14 0 0 1 28 0'/>"
  + "<path class='g-wave w3' d='M" + (x - 20) + " 24a20 20 0 0 1 40 0'/></g>";
const antennaPair = "<rect class='g-plug' x='30' y='58' width='90' height='14' rx='3'/><circle class='g-act' cx='70' cy='65' r='2'/><circle class='g-act g-off' cx='80' cy='65' r='2'/>"
  + mast(48) + mast(102, 'g-off');

// Loopback plug: the cable leaves the plug and comes straight back into it.
const loopback = cable('M44 31C78 31 108 6 122 30C134 52 92 64 44 39') + plug(22, false);
const loopback2 = cable('M44 31C78 31 108 6 122 30C134 52 92 64 44 39') + cable('M44 35C66 35 84 22 92 34C99 46 70 50 44 37', true) + plug(22, false);

// USB stick: grip body, lanyard hole, label screen and a metal plug; on hover the screen runs a copy bar.
const thumbArt = (n: number) => "<rect class='g-plug' x='20' y='24' width='86' height='36' rx='8'/><rect class='g-hole' x='26' y='37' width='9' height='10' rx='3'/>"
  + "<rect class='g-pcb' x='40' y='31' width='52' height='22' rx='2'/><g class='g-idle'><text class='g-silk g-num' x='68' y='47.5' text-anchor='end'>+" + n + '</text>' + dataGlyph(70, 35.5, 13) + '</g>'
  + "<text class='g-silk g-lbl g-busy' x='66' y='42' text-anchor='middle'>COPY</text><rect class='g-track' x='45' y='46' width='42' height='3'/><rect class='g-fill' x='45' y='46' width='42' height='3'/>"
  + "<rect class='g-steel' x='106' y='30' width='26' height='24' rx='1'/><rect class='g-tongue' x='108' y='34' width='22' height='2.8'/><rect class='g-tongue' x='108' y='38.2' width='22' height='2.8'/>"
  + "<rect class='g-hole' x='113' y='45' width='4' height='4'/><rect class='g-hole' x='121' y='45' width='4' height='4'/>"
  + "<circle class='g-act' cx='98' cy='42' r='2.2'/>";
// Credit card: a small gold chip, a card number, a $ and a small contactless mark; the chip shimmers on hover.
const chip = "<rect class='g-plug' x='20' y='14' width='110' height='58' rx='3'/><rect class='g-gold' x='32' y='28' width='18' height='14' rx='2'/>"
  + "<path class='g-padln' d='M32 35h18M41 28v14'/>"
  + "<path class='g-wave' d='M108 23a3 3 0 0 1 0 6'/><path class='g-wave w2' d='M111 21a6 6 0 0 1 0 10'/><path class='g-wave w3' d='M114 19a9 9 0 0 1 0 14'/>"
  + "<text class='g-silk' x='32' y='54'>4071 ···· ···· 0x00</text><text class='g-silk' x='32' y='64'>CREDIT</text><text class='g-cash' x='116' y='60' text-anchor='middle'>$</text>";
// A probe sending pings to the right.
const ping = "<rect class='g-plug' x='26' y='34' width='26' height='16' rx='3'/><circle class='g-act' cx='34' cy='42' r='2'/>"
  + "<path class='g-wave' d='M62 32a14 14 0 0 1 0 20'/><path class='g-wave w2' d='M74 24a26 26 0 0 1 0 36'/><path class='g-wave w3' d='M86 16a38 38 0 0 1 0 52'/>";
// Cooler: a finned block with a fan in front; the fan spins up on hover.
const blade = (k: number) => "<path d='M75 42c1-9 7-15 15-15c-2 6-7 12-15 15z' transform='rotate(" + k * 72 + " 75 42)'/>";
const heatsink = Array.from({ length: 15 }, (_, i) => "<rect class='g-fin' x='" + (24 + i * 7) + "' y='20' width='3' height='44'/>").join('')
  + "<rect class='g-plug' x='47' y='14' width='56' height='56' rx='4'/><circle class='g-hole' cx='75' cy='42' r='24'/>"
  + [[52, 19], [98, 19], [52, 65], [98, 65]].map(([x, y]) => "<circle class='g-steel' cx='" + x + "' cy='" + y + "' r='2'/>").join('')
  + "<g class='g-fan'>" + [0, 1, 2, 3, 4].map(blade).join('') + "</g><circle class='g-steel' cx='75' cy='42' r='5'/>";

// Burner SIM: a prepaid SIM card; on hover its contacts shimmer and its edge flickers as if it burns out.
const sim = "<path class='g-plug g-burn' d='M50 10h38l12 12v52H50z'/><rect class='g-gold' x='59' y='30' width='32' height='24' rx='3'/>"
  + "<path class='g-padln' d='M75 30v24M59 42h32M59 36h8M83 48h8'/><text class='g-silk' x='75' y='67' text-anchor='middle'>PREPAID</text>";

// Pattern ROM: a DIP chip with ** printed on it.
const rom = "<rect class='g-plug' x='38' y='22' width='74' height='40' rx='3'/>"
  + [44, 54, 64, 74, 84, 94, 104].map((x, i) => "<rect class='g-pin g-read' style='animation-delay:" + i * 0.1 + "s' x='" + x + "' y='14' width='3' height='8'/>"
    + "<rect class='g-pin g-read' style='animation-delay:" + i * 0.1 + "s' x='" + x + "' y='62' width='3' height='8'/>").join('')
  + "<circle class='g-hole' cx='46' cy='42' r='3'/><text class='g-silk' x='62' y='48'><tspan class='g-ast'>**</tspan> ROM</text>";
// Multiplexer: two lines in, one bent up in an L (the crossing line), a switch, one line out; on hover the switch flips between the inputs.
const muxIn1 = 'M56 26H36V0';
const mux = "<path class='g-wire' d='" + muxIn1 + "M20 58H56M94 42H130'/><path class='g-out' d='M94 42H130'/><path class='g-plug' d='M56 16L94 28V56L56 68z'/>"  + "<path class='g-in1' d='" + muxIn1 + "'/><path class='g-in2' d='M20 58H56'/>"
  + "<g class='g-lever'><path class='g-shaft' d='M62 26L88 42'/><circle class='g-act' cx='62' cy='26' r='2.5'/></g>";

// Repeater: a box with an antenna stub and two pulses going out.
const repeater = "<rect class='g-plug' x='40' y='30' width='56' height='30' rx='3'/><circle class='g-act' cx='50' cy='45' r='2.5'/><text class='g-silk g-x2' x='72' y='50' text-anchor='middle'>×2</text>"
  + "<path class='g-wave' d='M104 36a10 10 0 0 1 0 18'/><path class='g-wave w2' d='M112 30a18 18 0 0 1 0 30'/>";
// Tape deck: a cassette whose spoked reels spin backwards on hover.
const reel = (x: number) => "<g class='g-reel'><circle class='g-steel' cx='" + x + "' cy='40' r='10'/><circle class='g-hole' cx='" + x + "' cy='40' r='3.5'/>"
  + "<path class='g-spoke' d='M" + x + " 31v4M" + x + " 45v4M" + (x - 9) + " 40h4M" + (x + 5) + " 40h4'/></g>";
const tape = "<rect class='g-plug' x='28' y='20' width='94' height='50' rx='4'/><rect class='g-pcb' x='44' y='29' width='62' height='22' rx='11'/>"
  + "<path class='g-band' d='M56 50H94'/>" + reel(56) + reel(94) + "<path class='g-cut' d='M48 62h54'/><text class='g-silk' x='66' y='27'>REW</text>";

// Co-processor: a square chip with pins on all four sides (unlike the two-row ROM); its four cores light up in turn on hover.
const sidePins = [18, 22.5, 27, 31.5, 36, 40.5, 45, 49.5, 54, 58.5, 63].map((y) => "<rect class='g-pin' x='41' y='" + y + "' width='6' height='2.4'/><rect class='g-pin' x='103' y='" + y + "' width='6' height='2.4'/>").join('');
const socket = contacts(51, 99, 8, [0, 0]) + contacts(51, 99, 70, [0, 0]) + sidePins
  + "<rect class='g-plug' x='47' y='14' width='56' height='56' rx='3'/><rect class='g-steel' x='56' y='23' width='38' height='38' rx='2'/>"
  + "<text class='g-silk' x='75' y='35' text-anchor='middle'>CO-PROC</text>"
  + [0, 1, 2, 3].map((i) => "<rect class='g-core' style='animation-delay:" + i * 0.2 + "s' x='" + (61 + i * 7.5) + "' y='42' width='5' height='12'/>").join('')
  + "<circle class='g-act' cx='52' cy='19' r='2'/>";

// Laptop RAM (SO-DIMM): a label, three chips with codes and two empty ones worth +8; the contacts shimmer on hover.
const soDimm = "<path class='g-pcb' d='M22 16h106v40h-3v6H82v-6h-3v6H25v-6h-3z'/>"
  + [25, 29.5, 34, 38.5, 43, 47.5, 52, 56.5, 61, 65.5, 70, 74.5, 83, 87.5, 92, 96.5, 101, 105.5, 110, 114.5, 119].map((x, i) => "<rect class='g-pin g-read' style='animation-delay:" + (i % 7) * 0.1 + "s' x='" + x + "' y='57' width='2.4' height='5'/>").join('')
  + "<text class='g-silk' x='30' y='26'>NULL PAD · SO-DIMM</text>"
  + ['1C', 'E9', '55'].map((c, i) => "<rect class='g-chip' x='" + (28 + i * 19.4) + "' y='31' width='16' height='20'/><text class='g-silk' x='" + (36 + i * 19.4) + "' y='44' text-anchor='middle'>" + c + '</text>').join('')
  + [0, 1].map((i) => "<rect class='g-hole' x='" + (86.2 + i * 19.4) + "' y='31' width='16' height='20' rx='1'/><text class='g-silk' x='" + (94.2 + i * 19.4) + "' y='44' text-anchor='middle' style='fill:var(--data)'>+8</text>").join('');

// Zip tie: two plugs whose cables are bound where they share a code; pulses run the cables on hover.
const ziptie = plug(6, false, 12) + plug(6, false, 46) + cable('M28 21C56 21 60 39 75 39') + cable('M28 55C56 55 60 45 75 45', true)
  + cable('M75 39C96 39 112 28 142 28') + cable('M75 45C96 45 112 56 142 56', true)
  + "<rect class='g-plug' x='69' y='32' width='12' height='20' rx='3'/><rect class='g-steel' x='67' y='27' width='16' height='7' rx='1.5'/><path class='g-shaft' d='M83 30l9-6'/>";

// UPS: a battery gauge whose cells light in turn on hover, an outlet and the AC/BAT lamps.
const ups = "<rect class='g-plug' x='26' y='10' width='98' height='64' rx='5'/><rect class='g-hole' x='36' y='22' width='44' height='26' rx='2.5'/><rect class='g-steel' x='80' y='30' width='3.5' height='10' rx='1'/>"
  + [0, 1, 2, 3].map((i) => "<rect class='g-core' style='animation-delay:" + i * 0.2 + "s' x='" + (39 + i * 10.2) + "' y='25' width='8.4' height='20'/>").join('')
  + "<circle class='g-hole' cx='104' cy='35' r='11'/><rect class='g-steel' x='99.5' y='29' width='2' height='6'/><rect class='g-steel' x='106.5' y='29' width='2' height='6'/><circle class='g-steel' cx='104' cy='40' r='1.6'/>"
  + "<text class='g-silk' x='36' y='62'>UPS · STACK HOLD</text><circle class='g-act' cx='98' cy='62' r='2'/><circle class='g-act g-pink g-off' cx='110' cy='62' r='2'/>";

// Mechanical macro key: a keycap on its switch stem.
const keycap = (x: number, y: number, w: number, h: number, label: string, c = '') => "<rect class='g-hole' x='" + x + "' y='" + (y + 3) + "' width='" + w + "' height='" + h + "' rx='3'/>"
  + "<rect class='g-steel' x='" + x + "' y='" + y + "' width='" + w + "' height='" + h + "' rx='3'/><rect class='g-plug' x='" + (x + 3) + "' y='" + (y + 2) + "' width='" + (w - 6) + "' height='" + (h - 7) + "' rx='2'/>"
  + "<text class='g-silk' x='" + (x + w / 2) + "' y='" + (y + h * .55) + "' text-anchor='middle'" + (c && " style='fill:" + c + "'") + '>' + label + '</text>';

// Build server: three build steps light in turn on hover, then the payload level.
const compiler = "<rect class='g-plug' x='20' y='12' width='110' height='60' rx='3'/>" + Array.from({ length: 25 }, (_, i) => "<rect class='g-hole' x='" + (26 + i * 4) + "' y='15' width='2' height='5'/>").join('')
  + "<text class='g-silk' x='28' y='31'>$ make payload</text>"
  + [0, 1, 2].map((i) => "<rect class='g-core' style='animation-delay:" + i * 0.25 + "s' x='" + (28 + i * 19) + "' y='35' width='16' height='14'/><text class='g-silk' x='" + (36 + i * 19) + "' y='45' text-anchor='middle'>" + (i + 1) + '</text>').join('')
  + "<path class='g-shaft' d='M88 42h8m-3-3 3 3-3 3'/><rect class='g-hole' x='100' y='33' width='22' height='18' rx='2'/><text class='g-silk' x='111' y='45' text-anchor='middle'>Lv+1</text>"
  + "<rect class='g-pcb' x='28' y='56' width='44' height='5' rx='1'/><circle class='g-act' cx='68' cy='58.5' r='1.4'/>";

// Shift register: a DIP chip with a window of codes A B C and a wrap-around arrow; the pins shimmer on hover.
const bitshift = Array.from({ length: 12 }, (_, i) => "<rect class='g-pin g-read' style='animation-delay:" + (i % 6) * 0.1 + "s' x='" + (28 + i * 8.4) + "' y='17' width='3.2' height='8'/><rect class='g-pin g-read' style='animation-delay:" + (i % 6) * 0.1 + "s' x='" + (28 + i * 8.4) + "' y='59' width='3.2' height='8'/>").join('')
  + "<rect class='g-plug' x='22' y='24' width='106' height='36' rx='3'/><circle class='g-hole' cx='30' cy='42' r='3'/><text class='g-silk' x='36' y='33'>74HC595 · SHIFT</text>"
  + ['4B', '7F', 'C9'].map((c, i) => "<rect class='g-pcb' x='" + (44 + i * 20) + "' y='37' width='16' height='14' rx='1.5'/><text class='g-silk' x='" + (52 + i * 20) + "' y='48' text-anchor='middle'>" + c + '</text>').join('')
  + "<path class='g-shaft' d='M112 38v6a4 4 0 0 1-4 4h-1m2-3-2 3 2 3'/>";

// Overclocked CPU: one wide package, a steel lid with ×1.5 and a clock meter whose bars light on hover.
const overclock = (m: string) => contacts(21, 128, 7, [0, 0]) + contacts(21, 128, 71, [0, 0])
  + "<rect class='g-pcb' x='16' y='12' width='118' height='60' rx='3'/><rect class='g-steel' x='24' y='18' width='102' height='48' rx='4'/>"
  + "<text class='g-silk' x='30' y='31'>OVERCLOCK</text><text class='g-mult' x='34' y='56' style='fill:var(--pink)'>" + m + '</text>'
  + "<rect class='g-hole' x='92' y='23' width='28' height='38' rx='2'/>"
  + [0, 1, 2, 3, 4].map((i) => "<rect class='g-core' style='animation-delay:" + i * 0.15 + "s' x='96' y='" + (54 - i * 5.6) + "' width='20' height='4'/>").join('');

// Zero-day memory card: notched, gold contacts, a 0-DAY label and a $ (gold = cash).
const zeroDay = (x: number, y: number) => "<path class='g-plug' d='M" + x + ' ' + y + "h40v46h-34l-6-6z'/>"
  + [0, 1, 2, 3, 4, 5, 6].map((i) => "<rect class='g-gold' x='" + (x + 7 + i * 4.4) + "' y='" + (y + 2) + "' width='2.6' height='7' rx='.5'/>").join('')
  + "<rect class='g-chip' x='" + (x + 5) + "' y='" + (y + 13) + "' width='30' height='12' rx='1'/><text class='g-silk' x='" + (x + 20) + "' y='" + (y + 22) + "' text-anchor='middle'>0-DAY</text>"
  + "<text class='g-cash' x='" + (x + 20) + "' y='" + (y + 40) + "' text-anchor='middle'>$</text>";

// 3.5" floppy: the steel shutter, a SNAPSHOT label and the write-protect tab; its activity lamp blinks on hover.
const floppy = "<path class='g-plug' d='M44 10h58l6 6v58H44z'/><rect class='g-steel' x='56' y='10' width='32' height='21' rx='1'/><rect class='g-hole' x='77' y='13' width='7' height='14' rx='1'/>"
  + "<rect class='g-chip' x='50' y='37' width='46' height='33' rx='1.5'/><text class='g-silk' x='73' y='53' text-anchor='middle'>SNAPSHOT</text><text class='g-silk' x='73' y='62' text-anchor='middle'>.IMG</text>"
  + "<rect class='g-hole' x='47' y='64' width='5' height='5'/><circle class='g-act' cx='101' cy='66' r='1.8'/>";

const ART: Record<ItemId, string> = {
  buffer1: ram(11, 6), // module spans x 10..118, so +11 centres it in the 150 box
  buffer2: ram(10, 0) + ram(-4, 14),
  shortkey: key,
  linker1: cable('M28 35C55 -6 85 76 120 35') + plugs,
  linker2: cable('M28 31C55 -10 85 72 120 31') + cable('M28 39C55 80 85 0 120 39', true) + plugs,
  wildcard1: masterKey,
  wildcard2: masterKey + reticle,
  datanode: ssdArt(false),
  datanode2: ssdArt(true),
  datanode3: ssdPair,
  prio1: prio(2),
  prio2: prio(4),
  split1: splitter(false),
  split2: splitter(true),
  sidedoor: lockpick,
  bridge: antenna,
  bridge2: antennaPair,
  loopback1: loopback,
  loopback2,
  thumb: thumbArt(3).replaceAll("class='g-tongue'", "class='g-tongue g-grey'"),
  // v2.0: the same stick with a +7 label, green USB 3 strips, a pink LED and a faster copy.
  thumb2: thumbArt(10).replace("<circle class='g-act'", "<circle class='g-act g-pink'").replaceAll("class='g-tongue'", "class='g-tongue g-green'"),
  // v3.0: red USB4 strips, a pink LED; the wider +13 label sits a bit right to stay centred.
  thumb3: thumbArt(25).replace("<circle class='g-act'", "<circle class='g-act g-pink'").replaceAll("class='g-tongue'", "class='g-tongue g-red'")
    .replace("<g class='g-idle'>", "<g class='g-idle' transform='translate(4 0)'>"),
  chip,
  ping,
  heatsink,
  sim,
  glob: rom,
  mux,
  repeater,
  rewind: tape,
  socket,
  nullpad: soDimm,
  ziptie,
  ups,
  hotkey: keycap(52, 16, 46, 36, 'F13') + "<rect class='g-plug' x='44' y='54' width='62' height='14' rx='3'/><circle class='g-act' cx='98' cy='61' r='2'/><text class='g-silk' x='50' y='64'>MACRO</text>",
  // v2.0: the same base, wider, with three keys in mint, data blue and pink
  hotkey2: "<rect class='g-plug' x='18' y='54' width='114' height='14' rx='3'/><circle class='g-act' cx='124' cy='61' r='2'/><text class='g-silk' x='24' y='64'>MACRO PAD</text>"
    + ([[24, 'F13', 'var(--mint)'], [60, 'F14', 'var(--data)'], [96, 'F15', 'var(--pink)']] as const).map(([x, l, c]) => keycap(x, 22, 30, 30, l, c)).join(''),
  compiler,
  bitshift,
  overclock: overclock('×1.5'),
  overclock2: overclock('×1.8'),
  exploit: zeroDay(55, 18),
  exploit2: zeroDay(46, 14) + zeroDay(64, 22),
  snapshot: floppy,
};

// Every upgrade id ends in 2 or 3; those get the v2 accents (.gear.v2 in style.css), v3.0 also .v3.
// Both styles are rendered; CSS shows the one matching html[data-style]. `rack` crops the glass art for the short rack unit.
export const gear = (id: ItemId, rack = false) => "<svg class='gear" + (/[23]$/.test(id) ? ' v2' : '') + (/3$/.test(id) ? ' v3' : '') + "' viewBox='0 0 150 84' aria-hidden='true'>" + ART[id] + '</svg>' + gearGlass(id, rack);
