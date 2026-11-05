import { BLOCK, generate, hashStr, SIZES, type Puzzle, type SizeKey } from './generator';
import {
  MAX_TRIES, SPRINTS, contains, type ChallengeKind, type SprintLen, challengeQuery, isFinished, isLegal, newRun, parseChallenge, pick, score,
  stageSeed, targetProgress, WILD, fits, inLane, burning,
} from './game';
import { gear } from './gear';
import { logo } from './logos';
import { canComplete } from './solver';
import {
  buy, coverage, DAEMON_SLOTS, DAEMONS, SLOTS_PER_CREDIT, DATA_BY_LEN, finishMatrix, forSale, isCorner, ITEMS, movePreview, newRunState, nextSection,
  burnOf, COMPANIES, companyOpen, isBoss, LOOPS, quota, QUOTA_GROWTH, revealed, roomIce, sections, cutMarks, dealRunMatrix, ICE, NODE_DATA, offerDaemons, sideDoor, placeCells, REROLL_COST, SWAP_COST, swapDaemon, streakOf, restartMatrix, RACK_MAX, slotCost, rackFull, sellValue, sell, buySlot, scoreMatrix, sectionMatrix, splitTarget, stockShop,
  type Company, type Patch, type Preview, type DaemonId, type Effect, type IceId, type ItemId, type MatrixCtx, type MatrixOutcome, type RunState, type Score,
} from './roguelike';
import { breached, dayNumber, firstResult, load, recordBreach, recordFirst, save, setBreached, utcDate } from './storage';

type Mode = 'daily' | 'train' | 'sprint' | 'run';
interface DailyRecord { score: number; tries: number; time: number }

const $ = (id: string) => document.getElementById(id)!;

const S = {
  mode: 'daily' as Mode,
  size: 'normal' as SizeKey,
  seed: 0,
  puzzle: { grid: [], targets: [], l: 0 } as Puzzle,
  run: newRun(),
  tries: 1,
  start: 0,
  elapsed: 0,
  timer: 0,
  over: false,
  stage: 0,
  stageStart: 0,
  sprintLen: 3 as SprintLen,
  dealing: false, // between sprint matrices: input blocked, stage timer paused
  challenge: null as number | null,
};
let R: RunState = newRunState(0);
// Daemons on offer; while non-empty the board is visible but locked.
let offer: DaemonId[] = [];
let endWhy = ''; // why a run matrix ended on its own
// Item state of the run matrix in play: data node cell, data per target, and the before-first-move tools still unused.
let M: { node?: [number, number]; worth: number[]; cuts: number[]; wild: boolean; split: boolean; jump: boolean; loop: boolean; jumps: number[] } =
  { worth: [], cuts: [], wild: false, split: false, jump: false, loop: false, jumps: [] };
type Tool = 'wild' | 'split' | 'jump' | 'loop';
const TOOLS: Partial<Record<ItemId, Tool>> = { wildcard2: 'wild', split1: 'split', split2: 'split', bridge: 'jump', loopback1: 'loop', loopback2: 'loop' };
const loopAny = () => R.items.includes('loopback2');
// One rack unit per item family: a v2.0 replaces its v1.0.
let armed: Tool | null = null; // deck tool picked for use before the first move
// Targets already shown as uploaded, so the upload effect plays only once.
const doneSeen = new Set<number>();
// Cell under the mouse or keyboard focus, for the crosshair highlight.
let cursor: [number, number] | null = null;
const dailyKey = () => 'bypass:' + utcDate();
const sprintBestKey = () => 'bypass:sprintBestMs:' + S.sprintLen;
const stages = () => SPRINTS[S.sprintLen];
const challengeKind = (): ChallengeKind => (S.mode === 'sprint' ? (('sprint' + S.sprintLen) as ChallengeKind) : S.size);

const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '.' + String(Math.floor(ms) % 1000).padStart(3, '0'); };
// Credits read as gold dollars everywhere.
const money = (n: number, sign = '') => "<b class='cr'>" + sign + '$' + n + '</b>';
const now = () => (S.start ? (S.over ? S.elapsed : Date.now() - S.start) : 0);
const clockText = () => fmt(now());
const isUsed = (r: number, c: number) => S.run.used.has(r + ',' + c);
// Side door: before the first pick, any edge cell is open.
const doorOpen = () => S.mode === 'run' && !S.run.path.length && R.items.includes('sidedoor');
const onEdge = (r: number, c: number) => { const n = S.puzzle.grid.length; return r === 0 || c === 0 || r === n - 1 || c === n - 1; };
const legal = (r: number, c: number) => !S.over && !S.dealing && !offer.length && S.puzzle.grid[r][c] !== BLOCK && !burning(S.run, r, c) && (
  armed === 'wild' ? !isUsed(r, c) && S.puzzle.grid[r][c] !== WILD
  : armed === 'jump' ? !isUsed(r, c)
  : armed === 'loop' ? isUsed(r, c) && (loopAny() || inLane(S.run, r, c))
  : isLegal(S.run, r, c) || (doorOpen() && onEdge(r, c)));
// Blackout ICE: the SOC's targets stay hidden until the first pick.
const blackout = () => S.mode === 'run' && roomIce(R).includes('blackout') && !S.run.path.length && !S.over;
const isNode = (r: number, c: number) => S.mode === 'run' && M.node?.[0] === r && M.node[1] === c;
const randomSeed = () => Math.floor(Math.random() * 1e9);
const addr = (r: number) => '0x' + (r * 16).toString(16).toUpperCase().padStart(2, '0');
// Row and column names; a run company may label them its own way.
const rowName = (r: number) => (S.mode === 'run' && COMPANIES[R.company].rowLabel?.(r)) || addr(r);
const colName = (c: number) => (S.mode === 'run' && COMPANIES[R.company].colLabel?.(c)) || '+' + c;

function render() {
  const { grid, targets, l } = S.puzzle;
  const n = grid.length;
  const { buffer, used, axis, idx } = S.run;
  const g = $('grid');
  g.innerHTML = '';
  g.style.gridTemplateColumns = 'auto repeat(' + n + ',minmax(0,1fr))';
  // Hex-dump headers: column offsets on top, row addresses on the left; the active lane's header lights up.
  const hx = (text: string, on: boolean, cls = '') => {
    const h = document.createElement('div');
    h.className = 'hx' + (on && !S.over ? ' on' : '') + cls;
    h.textContent = text;
    h.setAttribute('aria-hidden', 'true');
    g.appendChild(h);
  };
  hx('', false);
  const free = S.run.free;
  // cron/rotate: before the first pick, the column the last matrix started in glows in the cron colour.
  const lastCol = S.mode === 'run' && R.daemons.includes('rotate') && !S.run.path.length && !S.over ? R.lastStart : undefined;
  for (let c = 0; c < n; c++) hx(colName(c), free ? c === free[1] : axis === 'col' && c === idx, c === lastCol ? ' cronmark' : '');
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (c === 0) hx(rowName(r), free ? r === free[0] : axis === 'row' && r === idx);
    const b = document.createElement('button');
    b.className = 'cell';
    b.id = 'c' + r + c;
    b.textContent = grid[r][c];
    if (grid[r][c] === WILD) b.classList.add('wild');
    if (grid[r][c] === BLOCK) b.classList.add('ice');
    if (isNode(r, c)) b.insertAdjacentHTML('beforeend', "<i class='ntag'>+" + NODE_DATA + '</i>');
    // Ping: a solution's first cell, until the first pick.
    if (S.mode === 'run' && R.items.includes('ping') && !S.run.path.length && !S.over && S.puzzle.path?.[0][0] === r && S.puzzle.path[0][1] === c) b.classList.add('ping');
    if (!S.over && (inLane(S.run, r, c) || (doorOpen() && onEdge(r, c)))) b.classList.add('lane');
    if (used.has(r + ',' + c)) b.classList.add('used');
    else if (burning(S.run, r, c)) {
      const left = S.run.burnt!.get(r + ',' + c)! - S.run.path.length;
      b.classList.add('burn');
      b.insertAdjacentHTML('beforeend', "<i class='btag'>" + (left === Infinity ? '∞' : left) + '</i>');
    }
    // With a Loopback in the deck, used cells keep their code, greyed out, so a re-pick can be planned.
    if (S.mode === 'run' && R.items.some((id) => TOOLS[id] === 'loop')) b.classList.add('memo');
    if (S.mode === 'run' && R.daemons.includes('corner') && isCorner([r, c], n)) b.classList.add('corner');
    if (legal(r, c)) {
      b.classList.add('ok');
      b.setAttribute('aria-label', 'Pick ' + grid[r][c] + ' at row ' + (r + 1) + ' column ' + (c + 1));
      b.onclick = () => choose(r, c);
    } else {
      b.setAttribute('aria-disabled', 'true');
    }
    b.tabIndex = -1;
    g.appendChild(b);
  }
  // Roving tabindex: the grid is one Tab stop, arrows move inside it.
  (g.querySelector<HTMLElement>('.cell.ok') ?? g.querySelector<HTMLElement>('.cell')!).tabIndex = 0;
  $('laneLabel').textContent = offer.length ? 'choose a daemon' : armed === 'wild' ? 'place ** on any free cell' : armed === 'split' ? 'cut a target'
    : armed === 'jump' ? 'bridge: pick any free cell' : armed === 'loop' ? 'loopback: pick a used cell' + (loopAny() ? '' : ' in your lane') : S.over ? 'session closed'
    : doorOpen() ? 'pick on any edge' : free ? 'pick in row ' + rowName(free[0]) + ' or col ' + colName(free[1])
    : axis === 'row' ? 'pick in row ' + rowName(idx) : 'pick in col ' + colName(idx);
  const buf = $('buffer');
  buf.innerHTML = '';
  const has = (id: DaemonId) => S.mode === 'run' && R.daemons.includes(id);
  const cover = has('chain') || has('compressor') ? coverage(buffer, targets) : [];
  for (let i = 0; i < l; i++) {
    const s = document.createElement('div');
    s.className = 'slot' + (buffer[i] ? ' filled' : '') + (i === buffer.length - 1 && !S.over ? ' new' : '')
      + (cover[i] >= 2 ? ' shared' : '') + (has('light') && i === Math.floor(l / 2) - 1 ? ' half' : '') + (buffer[i] === WILD ? ' wild' : '');
    if (has('overflow')) s.dataset.bonus = '+.5';
    s.textContent = buffer[i] ?? '';
    buf.appendChild(s);
    if (s.classList.contains('new')) scramble(s, buffer[i], 1, 1, 40);
  }
  const tg = $('targets');
  tg.innerHTML = '';
  targets.forEach((t, i) => {
    const st = targetProgress(buffer, t, l, S.over);
    const el = document.createElement('div');
    // Split, before the first move: v1.0 cuts a clicked target at its random mark, v2.0 at a clicked gap between codes.
    // Under Blackout both cut blind: the mark stays hidden.
    const cut = S.mode === 'run' && armed === 'split' && t.length > 1;
    const blind = cut && blackout();
    const gaps = cut && !blind && R.items.includes('split2');
    el.className = 'target' + (st.done ? ' done' : st.fail ? ' fail' : '') + (cut ? ' cut' : '');
    const worth = S.mode === 'run' ? ' +' + (M.worth[i] ?? DATA_BY_LEN[t.length]) : '';
    const state = st.done ? 'Uploaded' + worth : st.fail ? 'Failed' : cut ? worth.trim() + ' data · ' + (blind ? 'blind cut' : gaps ? 'cut between codes' : 'click to split')
      : worth ? worth.trim() + ' data' : 'Target ' + (i + 1);
    const mark = cut && !gaps ? M.cuts[i] : 0;
    el.innerHTML = '<div class="codes">' + t.map((c, j) => (gaps && j ? "<button class='gap' data-at='" + j + "' aria-label='Cut before " + c + "'></button>"
      : j && j === mark && !blind ? "<i class='gap mark'></i>" : '')
      + '<span class="' + (j < st.k ? 'hit' : '') + '">' + (blackout() ? '??' : c) + '</span>').join('') + '</div><div class="state">' + state + '</div>';
    el.querySelectorAll<HTMLElement>('.codes span').forEach((sp, j) => { sp.onmouseenter = () => markCode(t[j]); sp.onmouseleave = () => markCode(); });
    if (gaps) el.querySelectorAll<HTMLElement>('.gap').forEach((g) => { g.onclick = () => doSplit(i, +g.dataset.at!); });
    else if (cut) {
      Object.assign(el, { tabIndex: 0, onclick: () => doSplit(i, mark), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') doSplit(i, mark); } });
      el.setAttribute('role', 'button');
    }
    tg.appendChild(el);
    if (st.done && !doneSeen.has(i)) {
      doneSeen.add(i);
      el.classList.add('just');
      scramble(el.querySelector<HTMLElement>('.state')!, state, 2, 1, 40);
    }
  });
  const extra = S.mode === 'daily' ? '<span>Try <b>' + S.tries + '/' + MAX_TRIES + '</b></span>'
    : (S.mode === 'sprint' ? '<span>Matrix <b>' + Math.min(S.stage + 1, stages().length) + '/' + stages().length + '</b></span>' : '')
      + (S.challenge ? '<span>Beat <b>' + fmt(S.challenge) + '</b></span>' : S.mode === 'train' ? '<span>Training</span>' : '');
  $('status').innerHTML = "<span>Time <b id='clock'>" + clockText() + '</b></span>' + (S.mode === 'run' ? runStatus() : extra);
  document.getElementById('restartMatrix')?.addEventListener('click', () => { restartMatrix(R); dealMatrix(); });
  document.getElementById('disconnect')?.addEventListener('click', () => { finish(score(S.run.buffer, S.puzzle.targets), true); render(); });
  if (S.mode === 'run') { renderDaemons(); renderSteps(); }
  $('timebar').hidden = S.mode !== 'sprint' || S.over;
  updateBar();
  applyCross();
}

const runCtx = (): MatrixCtx =>
  ({ buf: S.run.buffer, path: S.run.path, targets: S.puzzle.targets, l: S.puzzle.l, n: S.puzzle.grid.length, worth: M.worth, node: M.node, jumps: M.jumps });

// Data shows the live total with the current matrix's score; once the matrix is over it is banked in R.data.
function runStatus() {
  const live = S.over ? 0 : scoreMatrix(runCtx(), R).total;
  const restart = !S.start && !S.over && !offer.length && R.restarts ? "<button class='btn act' id='restartMatrix'>Burner SIM · new matrix</button>" : '';
  // Ending early keeps the empty slots, which pay credits.
  const pay = Math.floor((S.puzzle.l - S.run.buffer.length) / SLOTS_PER_CREDIT) + (R.daemons.includes('silent') ? 2 : 0);
  const disconnect = live ? "<button class='btn act' id='disconnect'>Disconnect" + (pay ? ' · ' + money(pay, '+') : '') + '</button>' : '';
  return restart + disconnect;
}

// Score reads as data × boost: data = target data + flat bonuses, boost = (1 + additive boosts) × multipliers.
const num = (x: number) => String(Number(x.toFixed(2)));
const scoreHtml = (sc: Score) => "<span class='vd'>" + (sc.base + sc.flat) + "</span> × <span class='vm'>"
  + num((1 + sc.boost) * sc.mult) + '</span> = <b>' + sc.total + '</b>' + (sc.base ? '' : '<small>upload a target to score</small>');

const fmtEffect = (e: Effect) => [e.flat && "<span class='vd'>+" + e.flat + ' data</span>',
  e.boost && "<span class='vm'>+" + e.boost + ' boost</span>', e.mult && "<span class='vm'>×" + e.mult + '</span>'].filter(Boolean).join(' ');

const shownScore: string[] = [];
// Daemons that fired on the previous render, so a newly firing one flashes once.
let lastFired: DaemonId[] = [];

// Line icons (24×24, stroked in the family color).
const ICONS: Record<DaemonId, string> = {
  chain: "<rect x='2' y='8' width='12' height='8' rx='4'/><rect x='10' y='8' width='12' height='8' rx='4'/>",
  compressor: "<rect x='9' y='8' width='6' height='8'/><path d='M2 12h4M4 10l2 2-2 2M22 12h-4M20 10l-2 2 2 2'/>",
  fullstack: "<path d='M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5'/>",
  overflow: "<path d='M4 12.5v8h16v-8M12 16.5v-10h7M16 3.5l3 3-3 3'/>",
  light: "<g transform='translate(-1 0)'><path d='M8.2 11.2C8 9 10.5 8 12.5 8.2C15 8.4 17 9.5 17 12C17 14.5 15.8 16 15.6 18.5C15.4 21 14 22 12.5 22"
    + "C10.8 22 9.8 20.8 10 19C10.2 17.2 11 16.3 10.6 14.8C10.3 13.6 8.4 13 8.2 11.2Z'/><g class='f'><ellipse cx='8.9' cy='4.7' rx='1.6' ry='2.1'/>"
    + "<ellipse cx='12.1' cy='3.5' rx='1.1' ry='1.4'/><ellipse cx='14.6' cy='4' rx='1' ry='1.25'/><ellipse cx='16.6' cy='5.5' rx='.9' ry='1.05'/>"
    + "<ellipse cx='17.9' cy='7.6' rx='.75' ry='.9'/></g></g>",
  silent: "<path d='M3 10h4l5-4v12l-5-4H3zM16 9l5 6M21 9l-5 6'/>",
  cache: "<ellipse cx='12' cy='5' rx='7' ry='2.5'/><path d='M5 5v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5'/>",
  longjump: "<path d='M3 17.5h18M3 15.5v4M21 15.5v4M5 13.5C7 1.5 17 1.5 19 13.5M17 11l2 2.5 1.8-2.8'/>",
  corner: "<path d='M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'/><circle cx='8' cy='8' r='1.5'/>",
  // Switchback of alternating row/column moves that widens with each turn, from the start dot.
  zigzag: "<path d='M8.5 4.75h6v6h-10v6h15M17 14.25l2.5 2.5-2.5 2.5'/><circle class='f' cx='8.5' cy='4.75' r='1.4'/>",
  heartbeat: "<path d='M2 12h5l2-5 4 10 2-5h7'/>",
  rotate: "<path d='M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5'/>",
  backup: "<path d='M5 4h11l3 3v13H5zM8 4v5h7V4M8 14h8M8 17h5'/>",
  uptime: "<circle cx='12' cy='12' r='8.5'/><path d='M12 7v5l3.5 2'/>",
};

// Daemon card styled as a program file, in a floating slot; the shared clock keeps the float (5 s) and glitch (7.5 s)
// phases steady across re-renders. Size and hash are flavor, derived from the id.
const card = (id: DaemonId, i: number, tag: string, text: string, foot: string, cls = '') => {
  const d = DAEMONS[id];
  const h = hashStr(id) >>> 0;
  return "<div class='dslot' style='--t:-" + Math.round((performance.now() + i * 2900) % 15000) + "ms'><" + tag + " class='dcard c-"
    + d.family.toLowerCase() + cls + "'><span class='dbody'><em class='fold'></em><svg class='ico' viewBox='0 0 24 24' aria-hidden='true'>" + ICONS[id]
    + "</svg><span class='dmain'><b><span class='fdir'>" + d.family.toLowerCase() + '/</span><wbr>' + d.name.toLowerCase().replace(/ /g, '_<wbr>')
    + "<span class='fext'>.dmn</span></b><small aria-hidden='true'>-rwxr-x " + (1 + (h % 80) / 10).toFixed(1) + 'K ' + h.toString(16).padStart(8, '0').slice(0, 6)
    + '</small><span>' + text + '</span></span><i>' + foot + '</i></span></' + tag + '></div>';
};

// Cards lean toward the pointer, with a glare spot under it.
function tilt(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.dcard').forEach((c) => {
    c.onpointermove = (e) => {
      const r = c.parentElement!.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      // Wide strips: a gentler turn sideways, a stronger one front to back.
      c.style.cssText = '--rx:' + (0.5 - y) * 16 + 'deg;--ry:' + (x - 0.5) * 8 + 'deg;--mx:' + x * 100 + '%;--my:' + y * 100 + '%';
    };
    c.onpointerleave = () => { c.style.cssText = ''; };
  });
}

// Owned daemons fill the slots; one that counts toward the current matrix lights up and shows what it adds.
function renderDaemons() {
  const sc = scoreMatrix(runCtx(), R);
  const fired = new Map(sc.fired);
  $('scoreLine').innerHTML = scoreHtml(sc);
  // Changed numbers "decrypt" into place: data and boost settle first, the total keeps computing and lands last.
  const els = [...$('scoreLine').querySelectorAll<HTMLElement>('.vd, .vm, b')];
  const vals = els.map((el) => el.textContent ?? '');
  if (vals.some((v, i) => v !== shownScore[i])) {
    for (const i of [0, 1]) if (vals[i] !== shownScore[i]) scramble(els[i], vals[i], 4, 3, 45);
    scramble(els[2], vals[2], 7 + 3 * Math.max(vals[0].length, vals[1].length), 3, 45);
  }
  shownScore.splice(0, 3, ...vals);
  $('daemonLabel').textContent = 'daemons ' + R.daemons.length + '/' + DAEMON_SLOTS;
  $('daemons').innerHTML = Array.from({ length: DAEMON_SLOTS }, (_, i) => {
    const id = R.daemons[i];
    if (!id) return "<div class='dslot empty'>slot " + (i + 1) + ' · empty</div>';
    const e = fired.get(id);
    return card(id, i, 'div', daemonText(id), e ? fmtEffect(e) : 'standby', e ? (lastFired.includes(id) ? ' on' : ' on just') : '');
  }).join('');
  lastFired = [...fired.keys()];
  tilt($('daemons'));
  // Deck as a rack of units. A ready tool pulses; clicking it arms it, clicking again puts it down.
  // The LCD shows the pointed-at unit's spec, otherwise what is ready or armed.
  const start = !S.run.path.length;
  const units = R.items.map((id) => {
    const it = ITEMS[id], t = TOOLS[id];
    const ready = !!t && !S.over && !offer.length
      && (t === 'wild' ? M.wild && start : t === 'split' ? M.split && start : t === 'jump' ? M.jump : M.loop && !start);
    const on = ready && armed === t;
    const hint = !ready ? '' : !on ? 'ready · click to arm' : t === 'split' ? 'armed · click a target'
      : t === 'loop' ? 'armed · click a lit used cell' : 'armed · click a free cell';
    return { id, t, ready, st: on ? 'armed' : ready ? 'ready' : t ? 'standby' : 'online',
      spec: '<b>&gt; ' + it.name.toLowerCase().replace(/ /g, '_') + '_v' + it.ver + '</b> ' + it.text + (hint ? ' · <b>' + hint + '</b>' : '') };
  });
  const on = units.find((u) => u.st === 'armed'), ready = units.filter((u) => u.ready);
  const lcd = on ? on.spec
    : ready.length ? '<b>&gt; ' + ready.map((u) => ITEMS[u.id].name.toLowerCase()).join(', ') + '</b> ready · click to arm'
      : units.length ? '<b>&gt;</b> ' + units.length + ' modules installed · point at one to read its spec'
        : '<b>&gt;</b> no hardware · buy modules between rooms';
  const rail = (n: number) => "<span class='rail'>" + String(n).padStart(2, '0') + '</span>';
  $('items').innerHTML = '<header><span>hw rack</span><span>' + units.length + '/' + R.rack + 'U</span></header>'
    // Owned slots without a module are open bays; the next two slots (while any are left to buy) keep their blanking plates.
    + Array.from({ length: Math.max(Math.min(R.rack + 2, RACK_MAX), units.length) }, (_, i) => {
      const u = units[i];
      if (!u && i < R.rack) return rail(i + 1) + "<div class='unit bay' aria-hidden='true'><span>empty bay</span></div>" + rail(i + 1);
      if (!u) return rail(i + 1) + "<div class='unit blank' title='Locked: buy a rack slot in the shop'><i class='scr'></i><i class='vent'></i>"
        + "<span class='lock'>locked</span><i class='vent'></i><i class='scr'></i></div>" + rail(i + 1);
      const it = ITEMS[u.id], tag = u.ready ? 'button' : 'div';
      return rail(i + 1) + '<' + tag + " class='unit hw " + u.st + (u.t === 'wild' || u.t === 'split' ? ' pre' : '') + "'" + (u.ready ? " data-tool='" + u.t + "'" : " tabindex='0'")
        + " aria-label='" + it.name + ' v' + it.ver + ', ' + u.st + ': ' + it.text + "'><i class='scr'></i>" + gear(u.id)
        + "<span class='nm'><b>" + it.name + ' <small>v' + it.ver + '</small></b><small><span>' + it.kind + '</span>' + (u.t ? '<em>· ' + u.st + '</em>' : '')
        + "</small></span><i class='led'></i><i class='scr'></i></" + tag + '>' + rail(i + 1);
    }).join('') + "<p class='lcd' id='lcd'>" + lcd + '</p>';
  $('items').querySelectorAll<HTMLElement>('.unit:not(.blank)').forEach((el, i) => {
    const show = () => { $('lcd').innerHTML = units[i].spec; }, hide = () => { $('lcd').innerHTML = lcd; };
    el.onpointerenter = el.onfocus = show;
    el.onpointerleave = el.onblur = hide;
    if (el.dataset.tool) el.onclick = () => { armed = armed === el.dataset.tool ? null : (el.dataset.tool as Tool); render(); };
  });
}

// An installed Cache also shows its current stack.
const daemonText = (id: DaemonId) => {
  const st = streakOf(id), n = R.stacks[id] ?? 0;
  return DAEMONS[id].text + (st && R.daemons.includes(id) ? ' · stack now ' + n + (n ? ' (' + fmtEffect(st.effect(n)) + ')' : '') : '');
};

// Shop item drawn as its own piece of hardware: a button on the shelf, a plain tile in the catalog.
const ware = (id: ItemId, tag: string, foot: string, cls = '') => {
  const it = ITEMS[id];
  return '<' + tag + " class='ware hw" + cls + "'><span class='stage'>" + gear(id) + '</span><b>' + it.name + ' <small>v' + it.ver + '</small></b><small>' + it.kind
    + '</small><p>' + it.text + "</p><span class='price'>" + foot + '</span></' + tag + '>';
};

let catalogTab: 'daemons' | 'items' = 'daemons';

// Dev cheats on the catalog: toggle daemons and items (a v2.0 and its v1.0 replace each other), add credits, re-deal, skip a room.
function wireDev(ds: DaemonId[], its: ItemId[]) {
  const needs = (x: ItemId) => (ITEMS[x] as { needs?: string }).needs;
  const refresh = () => { render(); showCatalog(); };
  $('modalBox').querySelectorAll<HTMLElement>('.dlist .dcard').forEach((b, i) => {
    const id = ds[i];
    b.onclick = () => {
      if (R.daemons.includes(id)) R.daemons = R.daemons.filter((d) => d !== id);
      else if (R.daemons.length < DAEMON_SLOTS) R.daemons.push(id);
      refresh();
    };
  });
  $('modalBox').querySelectorAll<HTMLElement>('.wares .ware').forEach((b, i) => {
    const id = its[i];
    b.onclick = () => {
      R.items = R.items.includes(id) ? R.items.filter((x) => x !== id) : [...R.items.filter((x) => x !== needs(id) && needs(x) !== id), id];
      refresh();
    };
  });
  $('devCr').onclick = () => { R.credits += 10; refresh(); };
  $('devDeal').onclick = () => { hideResult(); dealMatrix(); };
  document.getElementById('devRoom')?.addEventListener('click', () => {
    hideResult();
    const p = nextSection(R);
    if (p) showPatch(p); else showOffer();
  });
}

// Every daemon and item, also a dev aid; installed daemons show what they add to the live matrix.
function showCatalog() {
  const fired = new Map(scoreMatrix(runCtx(), R).fired);
  const ds = Object.keys(DAEMONS) as DaemonId[], its = Object.keys(ITEMS) as ItemId[];
  const dev = import.meta.env.DEV; // dev server only: the catalog doubles as a cheat panel
  const tag = dev ? 'button' : 'div';
  const tab = (t: typeof catalogTab) => "<button class='btn' id='tab-" + t + "' aria-pressed='" + (catalogTab === t) + "'>" + t + '</button>';
  const body = catalogTab === 'daemons'
    ? '<p class="meta">' + ds.length + ' daemons · installed ' + R.daemons.length + '/' + DAEMON_SLOTS + "</p><div class='dlist'>" + ds.map((id, i) => {
      const e = fired.get(id);
      return card(id, i, tag, daemonText(id), e ? fmtEffect(e) : R.daemons.includes(id) ? 'standby' : 'not installed', e ? ' on' : '');
    }).join('') + '</div>'
    : '<p class="meta">' + its.length + ' items · in your deck ' + R.items.length + "</p><div class='wares'>"
      + its.map((id) => ware(id, tag, R.items.includes(id) ? 'in deck' : money(ITEMS[id].price))).join('') + '</div>';
  const devBar = !dev ? '' : "<div class='row devbar'><span>dev · click a card to install or remove it; items apply on the next deal</span>"
    + "<button class='btn' id='devCr'>+$10</button><button class='btn' id='devDeal'>Re-deal</button>"
    + (!isBoss(R) || R.loop < LOOPS - 1 ? "<button class='btn' id='devRoom'>" + (isBoss(R) ? 'Next iteration' : 'Next room') + '</button>' : '') + '</div>';
  showResult(true, "<h2>Catalog</h2><div class='tabs'>" + tab('daemons') + tab('items') + '</div>' + devBar + body
    + "<div class='row'><button class='btn' id='closeCatalog'>Close</button></div>");
  tilt($('modalBox'));
  for (const t of ['daemons', 'items'] as const) $('tab-' + t).onclick = () => { catalogTab = t; showCatalog(); };
  if (dev) wireDev(ds, its);
  const close = () => { hideResult(); focusGrid(); };
  $('closeCatalog').onclick = close;
  $('modal').onkeydown = (e) => { if (e.key === 'Escape') close(); };
}

// Contract stepper: rooms in order, one box per matrix with the score it banked; the live box is the matrix in play.
function renderSteps() {
  const live = S.over ? null : scoreMatrix(runCtx(), R).total;
  const co = COMPANIES[R.company];
  $('stepList').innerHTML = "<div class='coTag'>" + logo(co.id) + '<span>' + co.name + '<small>run ' + (R.loop + 1) + '/' + LOOPS + '</small></span></div>'
    + sections(R).map((sec, i) => {
    const got = R.scores[i];
    const state = i < R.section ? 'done' : i === R.section ? 'now' : '';
    const boxes = Array.from({ length: sec.matrices }, (_, j) => {
      if (j < got.length) return "<span class='box " + (got[j] ? 'ok' : 'zero') + "'>" + got[j] + '</span>';
      return i === R.section && j === got.length && live !== null ? "<span class='box live'>" + (live || '··') + '</span>' : "<span class='box'></span>";
    }).join('');
    const total = i === R.section ? R.data + (live ?? 0) : got.reduce((a, b) => a + b, 0);
    return "<div class='step " + state + "'><span class='sname'>" + sec.name + ' ' + iceTags(shownIce(i)) + "</span><span class='squota'>"
      + (state ? "<b class='" + (total >= quota(R, i) ? 'met' : '') + "'>" + total + '</b>/' : 'quota ') + quota(R, i) + "</span><div class='boxes'>" + boxes + '</div></div>';
  }).join("<span class='sarrow' aria-hidden='true'>›</span>");
  // The room's data tally, big: white until the quota is met, then green.
  const got = R.data + (live ?? 0), goal = quota(R);
  $('stepCr').textContent = 'credits $' + R.credits;
  $('tally').innerHTML = "<span class='meta'>" + sections(R)[R.section].name + " data</span><b class='" + (got >= goal ? 'met' : '') + "'>" + got + "</b><span class='goal'>/ " + goal + '</span>';
}

// Matrix bill: the uploads, each daemon that fired and what it added, then the formula.
// Daemon file name as on its card, in its family color.
const dmnName = (id: DaemonId) => {
  const f = DAEMONS[id].family.toLowerCase();
  return "<span class='dfile c-" + f + "'><span class='fdir'>" + f + '/</span>' + DAEMONS[id].name.toLowerCase().replace(/ /g, '_') + "<span class='fext'>.dmn</span></span>";
};

const billHtml = (sc: Score) => "<table class='calc'><tr><td>targets</td><td><span class='vd'>" + sc.base + ' data</span></td></tr>'
  + sc.fired.map(([id, e]) => '<tr><td>' + dmnName(id) + '</td><td>' + fmtEffect(e) + '</td></tr>').join('')
  + sc.gear.map(([id, e]) => "<tr><td><span class='gname'>" + ITEMS[id].name + '</span></td><td>' + fmtEffect(e) + '</td></tr>').join('')
  + "<tr class='sum'><td>matrix</td><td>" + scoreHtml(sc) + '</td></tr></table>';


// Between iterations: what the company patched; the room it went to shows once you get there.
function showPatch(p: Patch) {
  const hardened = p.ice === 'corruption' && R.patches.filter((x) => x.ice === 'corruption').length > 1;
  showResult(false, "<p class='meta'>" + COMPANIES[R.company].name + ' · iteration ' + (R.loop + 1) + '/' + LOOPS + "</p><h2>Patch notes</h2><ul class='patch'>"
    + '<li>Quotas ×' + QUOTA_GROWTH + ': ' + sections(R).map((_, i) => quota(R, i)).join(' / ') + '</li>'
    + "<li>" + (hardened ? 'Hardened' : 'New') + " ICE <b class='iceName'>" + ICE[p.ice].name + '</b>: ' + ICE[p.ice].text
    + (p.ice === 'corruption' ? '; it now ' + burnText(burnOf(R, p.room)) : '') + '</li>'
    + '<li>Deployed in one room. You will see which when you get there.</li>'
    + "</ul><div class='row'><button class='btn' id='patchOk'>Continue ›</button></div>");
  $('patchOk').onclick = showOffer;
}

// What the player owns, shown beside offers and the shop: daemon chips, then rack modules with their art.
const owned = (shop = false) => {
  const chip = (id: DaemonId) => "<span class='chip c-" + DAEMONS[id].family.toLowerCase() + "' title='" + DAEMONS[id].text + "'><svg class='ico' viewBox='0 0 24 24' aria-hidden='true'>"
    + ICONS[id] + '</svg>' + dmnName(id) + '</span>';
  const mod = (id: ItemId) => '<' + (shop ? "button data-sell='" + id + "'" : 'span') + " class='chip mod' title='" + ITEMS[id].text + "'>" + gear(id) + '<b>'
    + ITEMS[id].name + ' <small>v' + ITEMS[id].ver + '</small></b>' + (shop ? "<i class='sell'>sell · " + money(sellValue(id)) + '</i></button>' : '</span>');
  return "<div class='owned'><p class='meta'>your daemons · " + R.daemons.length + '/' + DAEMON_SLOTS + "</p><div class='chips'>"
    + (R.daemons.map(chip).join('') || "<span class='chip none'>no daemons yet</span>")
    + "</div><p class='meta'>your rack · " + R.items.length + '/' + R.rack + ' slots' + (shop && R.items.length ? ' · click a module to sell it' : '') + "</p><div class='chips'>" + (R.items.map(mod).join('') || "<span class='chip none'>no modules yet</span>") + '</div></div>';
};

function showOffer() {
  offer = offerDaemons(R);
  if (!offer.length) return showShop();
  const full = R.daemons.length >= DAEMON_SLOTS;
  const poor = full && R.credits < SWAP_COST;
  showResult(true, '<h2>Choose a daemon</h2><p class="meta">' + (full ? 'Slots full · swapping one in costs ' + money(SWAP_COST) + ' · credits ' + money(R.credits)
    : 'Free to take · slots ' + R.daemons.length + '/' + DAEMON_SLOTS) + '</p>' + owned()
    + "<div class='dlist'>" + offer.map((id, i) => card(id, i, 'button', DAEMONS[id].text, !full ? 'install ›' : poor ? 'need ' + money(SWAP_COST) : 'swap in · ' + money(SWAP_COST), poor ? ' poor' : '')).join('') + '</div>'
    + "<div class='row'><button class='btn' id='skipDaemon'>Skip · take none</button></div>");
  $('modalBox').querySelectorAll<HTMLElement>('.dcard').forEach((b, i) => {
    b.onclick = () => { if (!full) { R.daemons.push(offer[i]); showShop(); } else if (!poor) showSwap(offer[i]); };
  });
  $('skipDaemon').onclick = () => showShop();
  tilt($('modalBox'));
}

// Shop between rooms: a seeded shelf of items, a paid reroll and paid daemon removal; Continue opens the next room.
function showShop(restock = true) {
  if (restock) stockShop(R);
  const cr = (n: number) => money(n);
  const off = (n: number) => (R.credits < n ? ' disabled' : '');
  showResult(true, "<h2>Black market</h2><p class='meta'>credits " + money(R.credits) + ' · items stay for the whole run</p>' + owned(true)
    + "<div class='wares'>" + (R.shelf.map((id) => ware(id, 'button', rackFull(R, id) ? 'rack full' : cr(ITEMS[id].price),
      R.credits < ITEMS[id].price || rackFull(R, id) ? ' poor' : '')).join('')
      || "<div class='dslot empty'>sold out</div>") + "</div><div class='row'>"
    + (R.rack < RACK_MAX ? "<button class='btn' id='buySlot'" + off(slotCost(R)) + '>Rack slot +1 · ' + cr(slotCost(R)) + '</button>' : '')
    + (forSale(R).length > R.shelf.length ? "<button class='btn' id='reroll'" + off(REROLL_COST) + '>Reroll · ' + cr(REROLL_COST) + '</button>' : '')
    + "<button class='btn' id='leaveShop'>Continue ›</button></div>");
  $('modalBox').querySelectorAll<HTMLElement>('.ware').forEach((b, i) => {
    b.onclick = () => { if (buy(R, R.shelf[i])) showShop(false); };
  });
  document.getElementById('reroll')?.addEventListener('click', () => { if (stockShop(R, true)) showShop(false); });
  document.getElementById('buySlot')?.addEventListener('click', () => { if (buySlot(R)) showShop(false); });
  $('modalBox').querySelectorAll<HTMLElement>('[data-sell]').forEach((b) => { b.onclick = () => { if (sell(R, b.dataset.sell as ItemId)) showShop(false); }; });
  $('leaveShop').onclick = enterSection;
}

function showSwap(id: DaemonId) {
  showResult(true, '<h2>Swap out a daemon</h2><p class="meta">' + dmnName(id) + ' takes the freed slot · costs ' + money(SWAP_COST) + '</p>'
    + "<div class='dlist'>" + R.daemons.map((d, i) => card(d, i, 'button', daemonText(d), 'swap out ›')).join('')
    + "</div><div class='row'><button class='btn' id='backOffer'>Back</button></div>");
  $('modalBox').querySelectorAll<HTMLElement>('.dcard').forEach((b, i) => { b.onclick = () => { if (swapDaemon(R, R.daemons[i], id)) showShop(); }; });
  $('backOffer').onclick = showOffer;
  tilt($('modalBox'));
}

// ICE the contract shows for a room: the boss rule from the start, a patch once its room has been entered.
const shownIce = (i: number) => roomIce(R, i).filter((id) => (id === R.ice && i === sections(R).length - 1)
  || R.patches.some((p) => p.ice === id && p.room === i && p.loop <= R.loop && revealed(R, p)));
const burnText = (n: number) => (n === Infinity ? 'locks for good' : 'locks for ' + n + (n > 1 ? ' moves' : ' move'));
const iceRule = (id: IceId, tag = 'ICE') => "<p class='iceRule'><b>" + tag + ' · ' + ICE[id].name + '</b> ' + ICE[id].text
  + (id === 'corruption' ? ' · now ' + burnText(burnOf(R)) : '') + '</p>';
const iceTags = (ids: IceId[]) => ids.map((id) => "<i class='iceTag' title='" + ICE[id].text + "'>" + ICE[id].name + '</i>').join('');

// Contract carousel: one 3D card per company (logo front, rooms and ICE on the back). The next locked company shows in full,
// the slots after it stay classified.
const FIRM_SLOTS = 5;
const isOpen = (i: number) => companyOpen(breached(), i);
let firmAt = 0;
const firmCard = (co: Company | undefined, i: number) => {
  const face = (side: string, body: string) => "<div class='fface " + side + "'>" + body + '</div>';
  const need = COMPANIES[i - 1]?.name ?? '';
  const lock = "<span class='flock'>locked · breach " + need + ' to unlock</span>';
  const won = co && breached().includes(co.id) ? "<span class='fwon'>breached</span>" : '';
  const front = co ? face('front', won + logo(co.id) + '<b>' + co.name + '</b><p>' + co.text + '</p>' + (isOpen(i) ? "<span class='fhint'>details ›</span>" : lock))
    : face('front', logo() + '<b>??? ????????</b><p>Classified. Breach the previous contract to unlock.</p>');
  const back = co ? face('back', '<b>' + co.name + "</b><ol class='frooms'>" + co.sections.map((s) => '<li>' + s.name + "<span class='meta'>" + s.size.n + '×' + s.size.n
    + ' · ' + s.matrices + (s.matrices > 1 ? ' matrices' : ' matrix') + ' · quota ' + s.quota + '</span></li>').join('')
    + "</ol><p class='meta'>" + LOOPS + ' iterations, quotas ×' + QUOTA_GROWTH + ' each</p>'
    + "<p class='meta'>boss ICE, one per run:<br>" + iceTags(co.ice) + '</p>' + "<p class='meta'>patches between iterations:<br>" + iceTags(co.patches) + '</p>' + (isOpen(i) ? '' : lock)) : '';
  return "<div class='fcard" + (!co ? ' locked' : isOpen(i) ? '' : ' sealed') + "' role='button' tabindex='0' aria-label='" + (co ? co.name : 'Locked contract') + "'><div class='ftilt'><div class='finner'>"
    + front + back + '</div></div></div>';
};

function showCompanies(seed: number, back: Mode) {
  R = newRunState(seed);
  dealMatrix();
  const n = Math.max(FIRM_SLOTS, COMPANIES.length + 1);
  // Only the next company past the open ones is revealed.
  const shown = (i: number) => (i <= COMPANIES.findIndex((_, j) => !isOpen(j)) || isOpen(i) ? COMPANIES[i] : undefined);
  showResult(true, "<h2>Choose a target</h2><p class='meta'>one company per run · click a card for its rooms and ICE</p><div class='carousel'>"
    + Array.from({ length: n }, (_, i) => firmCard(shown(i), i)).join('')
    + "<button class='cnav prev' id='cPrev' aria-label='Previous company'>‹</button><button class='cnav next' id='cNext' aria-label='Next company'>›</button></div>"
    + "<div class='row'>" + (import.meta.env.DEV ? "<button class='btn devbtn' id='devUnlock'>dev · " + (breached().length ? 'lock all' : 'unlock all') + '</button>' : '')
    + "<button class='btn' id='closeFirms'>Close</button><button class='btn go' id='startFirm'>Start contract ›</button></div>");
  document.getElementById('devUnlock')?.addEventListener('click', () => {
    setBreached(breached().length ? [] : COMPANIES.map((c) => c.id));
    showCompanies(seed, back);
  });
  const close = () => setMode(back === 'run' ? 'daily' : back);
  $('closeFirms').onclick = close;
  const cards = [...$('modalBox').querySelectorAll<HTMLElement>('.fcard')];
  const place = () => {
    cards.forEach((c, i) => {
      const o = i - firmAt, a = Math.abs(o);
      c.style.transform = 'translateX(' + Math.sign(o) * (110 + a * 75) + 'px) translateZ(' + -a * 70 + 'px) rotateY(' + -Math.sign(o) * 28 + 'deg)';
      c.style.zIndex = String(10 - a);
      c.style.opacity = a > 2 ? '0' : String(1 - a * 0.3);
      c.classList.toggle('now', !o);
      if (o) c.classList.remove('flip');
    });
    ($('cPrev') as HTMLButtonElement).disabled = firmAt === 0;
    ($('cNext') as HTMLButtonElement).disabled = firmAt === n - 1;
    const start = $('startFirm') as HTMLButtonElement;
    start.disabled = !COMPANIES[firmAt] || !isOpen(firmAt);
    start.textContent = start.disabled ? 'Locked' : 'Start ' + COMPANIES[firmAt].name + ' ›';
  };
  const go = (i: number) => { firmAt = Math.max(0, Math.min(n - 1, i)); place(); };
  // Drag or swipe sideways to turn the carousel; a drag never counts as a click.
  const car = $('modalBox').querySelector<HTMLElement>('.carousel')!;
  let dragX: number | null = null, dragged = false;
  car.onpointerdown = (e) => {
    dragged = false;
    dragX = (e.target as HTMLElement).closest('button') ? null : e.clientX;
  };
  car.addEventListener('pointermove', (e) => {
    if (dragX === null || !(e.buttons & 1)) { dragX = null; return; }
    if (Math.abs(e.clientX - dragX) < 120) return;
    go(firmAt - Math.sign(e.clientX - dragX));
    dragX = e.clientX;
    dragged = true;
  });
  car.onpointerup = car.onpointerleave = () => { dragX = null; };
  const press = (c: HTMLElement, i: number) => {
    if (dragged) dragged = false;
    else if (i !== firmAt) go(i);
    else if (!c.classList.contains('locked')) c.classList.toggle('flip');
  };
  cards.forEach((c, i) => {
    c.onclick = () => press(c, i);
    c.onkeydown = (e) => { if (e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); press(c, i); } };
    const t = c.querySelector<HTMLElement>('.ftilt')!;
    c.onpointermove = (e) => {
      const r = c.getBoundingClientRect();
      t.style.transform = 'rotateX(' + (0.5 - (e.clientY - r.top) / r.height) * 14 + 'deg) rotateY(' + ((e.clientX - r.left) / r.width - 0.5) * 14 + 'deg)';
    };
    c.onpointerleave = () => { t.style.transform = ''; };
  });
  $('startFirm').onclick = () => { R = newRunState(seed, firmAt); enterSection(); };
  $('cPrev').onclick = () => go(firmAt - 1);
  $('cNext').onclick = () => go(firmAt + 1);
  $('modal').onkeydown = (e) => {
    if (e.key === 'ArrowLeft') go(firmAt - 1);
    else if (e.key === 'ArrowRight') go(firmAt + 1);
    else if (e.key === 'Escape') close();
  };
  place();
}

// Section intro: the route so far, then the room's brief and terms; the matrix pours in on Breach.
function enterSection() {
  dealMatrix();
  const rooms = sections(R);
  const sec = rooms[R.section];
  const at = (i: number) => (i < R.section ? ' done' : i === R.section ? ' now' : '');
  const route = rooms.map((s, i) => (i ? "<i class='link" + at(i) + "'></i>" : '') + "<span class='node" + at(i) + "'>" + s.name + '</span>').join('');
  showResult(true, "<p class='meta'>" + COMPANIES[R.company].name + ' · iteration ' + (R.loop + 1) + '/' + LOOPS + ' · section ' + (R.section + 1) + '/' + rooms.length + '</p><h2>' + sec.name + "</h2><div class='route'>"
    + route + '</div><p>' + sec.brief + "</p><p class='meta'>" + sec.size.n + '×' + sec.size.n + ' · ' + sec.matrices
    + (sec.matrices > 1 ? ' matrices' : ' matrix') + ' · quota ' + quota(R) + ' data</p>'
    + roomIce(R).map((id) => iceRule(id, R.patches.some((p) => p.ice === id && p.room === R.section && p.loop === R.loop) ? 'PATCHED' : 'ICE')).join('')
    + "<div class='row'><button class='btn' id='breach'>Breach ›</button></div>");
  $('breach').onclick = () => { hideResult(); pour(); };
}

function dealMatrix() {
  // Company look: its logo as a watermark under the matrix, its motif behind the contract.
  $('wmark').innerHTML = logo(COMPANIES[R.company].id);
  $('steps').dataset.co = COMPANIES[R.company].id;
  $('meta').textContent = 'Run ' + (R.loop + 1) + '/' + LOOPS + ' · ' + sections(R)[R.section].name + ' ' + (R.section + 1) + '/' + sections(R).length;
  const seed = stageSeed(R.seed, R.matrix++);
  S.puzzle = dealRunMatrix(seed, R);
  const cells = placeCells(seed, S.puzzle, R.items);
  if (cells.wild) S.puzzle.grid[cells.wild[0]][cells.wild[1]] = WILD;
  M = { node: cells.node, worth: S.puzzle.targets.map((t) => DATA_BY_LEN[t.length]), cuts: cutMarks(seed, S.puzzle.targets), wild: R.items.includes('wildcard2'),
    split: R.items.includes('split1') || R.items.includes('split2'), jump: R.items.includes('bridge'), loop: R.items.includes('loopback1') || R.items.includes('loopback2'), jumps: [] };
  armed = null;
  resetRun();
}

function doSplit(i: number, at?: number) {
  ({ targets: S.puzzle.targets, worth: M.worth } = splitTarget(S.puzzle.targets, M.worth, i, at));
  M.split = false;
  armed = null;
  render();
}

function applyCross() {
  document.querySelectorAll<HTMLElement>('#grid .cell').forEach((el) =>
    el.classList.toggle('x', !!cursor && (+el.id[1] === cursor[0] || +el.id[2] === cursor[1])));
  // Daemon lines read "name now +add": what it gives so far, then what this pick adds (highlighted); a loss shows "now → 0".
  const rot = R.stacks.rotate ?? 0;
  const peek: (Preview | string)[] = !cursor || S.mode !== 'run' || !legal(cursor[0], cursor[1]) ? []
    : armed === 'wild' ? ['place ** here'] : armed === 'jump' ? ['bridge jump']
    : armed === 'loop' ? ['loopback: ' + S.puzzle.grid[cursor[0]][cursor[1]] + ' again']
    : [...movePreview(S.run.path, cursor, S.puzzle.grid.length, R.daemons, M.jumps),
      ...(isNode(cursor[0], cursor[1]) ? [{ name: 'data node', add: '+' + NODE_DATA, kind: 'data' as const }] : []),
      ...(R.daemons.includes('rotate') && !S.run.path.length
        ? [{ id: 'rotate' as const, name: 'rotate', now: rot ? String(5 * rot) : undefined, kind: 'data' as const,
          ...(cursor[1] === R.lastStart ? { add: '→ 0', note: 'same column' } : { add: '+5' }) }] : [])];
  // Name in the daemon's family colour; numbers in their own colours: data blue, boost and multipliers pink.
  $('peek').innerHTML = peek.map((p) => {
    if (typeof p === 'string') return p;
    const v = p.kind === 'data' ? 'vd' : 'vm', loss = p.add.startsWith('→');
    return (p.id ? "<span class='pname c-" + DAEMONS[p.id].family.toLowerCase() + "'>" + p.name + '</span>' : "<span class='gname'>" + p.name + '</span>')
      + (p.now ? ' <span class=\'' + v + (loss ? ' gone' : '') + "'>" + p.now + '</span>' : '')
      + " <b class='" + v + (loss ? '' : ' add') + "'>" + p.add + '</b>' + (p.note ? " <span class='note'>" + p.note + '</span>' : '');
  }).join(' · ');
  // Echo the code under the cursor in the codes targets still need: solid for a pick open right now, dotted for a
  // free cell off the lane (planning ahead). Codes already hit and failed targets stay quiet.
  const code = cursor && !S.over && !blackout() ? S.puzzle.grid[cursor[0]]?.[cursor[1]] : undefined;
  const open = !!code && code !== BLOCK && !isUsed(cursor![0], cursor![1]) && !burning(S.run, cursor![0], cursor![1]);
  const now = !!cursor && legal(cursor[0], cursor[1]);
  const run = S.mode === 'run'; // the other modes keep the plain echo
  document.querySelectorAll<HTMLElement>('#targets .codes span').forEach((s) => {
    const m = !!code && (run ? (open || now) && !s.classList.contains('hit') && !s.closest('.fail') : now) && fits(code, s.textContent ?? '');
    s.classList.toggle('peek', m && now);
    s.classList.toggle('far', m && !now);
  });
}

// Pointing at a target code outlines the free cells holding it; those in the current lane stand out.
function markCode(code?: string) {
  document.querySelectorAll<HTMLElement>('#grid .cell').forEach((el) => {
    const r = +el.id[1], c = +el.id[2], g = S.puzzle.grid[r][c];
    const on = !!code && S.mode === 'run' && !S.over && !blackout() && g !== BLOCK && !isUsed(r, c) && !burning(S.run, r, c) && fits(g, code);
    el.classList.toggle('tpeek', on);
    el.classList.toggle('near', on && inLane(S.run, r, c));
  });
}

// Fraction of the current sprint matrix's time limit still left.
const stageLeft = () => (S.start && !S.over ? Math.max(0, 1 - (Date.now() - S.stageStart) / stages()[S.stage].ms) : 1);

function updateBar() {
  if (S.dealing) return;
  const left = stageLeft();
  const bar = $('timebar');
  (bar.firstElementChild as HTMLElement).style.width = left * 100 + '%';
  const low = S.mode === 'sprint' && !S.over && left < 0.3;
  bar.classList.toggle('low', low);
  $('grid').closest('.pane')!.classList.toggle('urgent', low);
}

function tick() {
  const el = document.getElementById('clock');
  if (el) el.textContent = clockText();
  updateBar();
  if (S.mode === 'sprint' && S.start && !S.over && !S.dealing && stageLeft() === 0) endSprint('Time out');
}

// The matrix "pours in" top to bottom (rows settle one after another); input stays blocked until it has settled.
const ROW_FRAMES = 2, FRAME_MS = 35;
let pourToken = 0;
function pour(done?: () => void) {
  S.dealing = true;
  render();
  const n = S.puzzle.grid.length;
  document.querySelectorAll<HTMLElement>('#grid .cell').forEach((el) =>
    scramble(el, el.textContent ?? '', 1 + +el.id[1] * ROW_FRAMES, 1, FRAME_MS));
  const token = ++pourToken;
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : (1 + (n - 1) * ROW_FRAMES + 3) * FRAME_MS + 40;
  setTimeout(() => {
    if (token !== pourToken) return; // a newer pour took over
    S.dealing = false;
    done?.();
    render();
    focusGrid();
  }, ms);
}

// Sprint: the overall clock keeps running; the matrix's own time limit starts once it has settled.
function nextStage() {
  S.stage++;
  if (S.stage === stages().length) return endSprint(null);
  S.puzzle = generate(stageSeed(S.seed, S.stage), stages()[S.stage]);
  S.run = newRun();
  doneSeen.clear();
  pour(() => { S.stageStart = Date.now(); });
}

const focusGrid = () => document.querySelector<HTMLElement>('.cell.ok')?.focus();

function choose(r: number, c: number) {
  if (!legal(r, c)) return;
  if (armed === 'wild') {
    S.puzzle.grid[r][c] = WILD;
    armed = null;
    M.wild = false;
    render();
    return;
  }
  if (!S.start) { S.start = S.stageStart = Date.now(); S.timer = window.setInterval(tick, 31); }
  const door = doorOpen(), tool = armed, offLane = !inLane(S.run, r, c);
  pick(S.run, S.puzzle, r, c);
  if (door) sideDoor(S.run, r, c, S.puzzle.grid.length);
  if ((tool === 'jump' || tool === 'loop') && offLane) M.jumps.push(S.run.path.length - 1);
  if (tool === 'jump') M.jump = false;
  if (tool === 'loop') M.loop = false;
  armed = null; // a pick puts any armed tool down
  // A dead end (targets no longer reachable) ends the round right away.
  // Run mode only stops once no remaining target can still be uploaded; the others need all of them.
  const stuck = S.mode === 'run'
    ? !S.puzzle.targets.some((t) => !contains(S.run.buffer, t) && canComplete(S.run, { ...S.puzzle, targets: [t] }, undefined, { ...M, loopAny: loopAny() }))
    : !canComplete(S.run, S.puzzle);
  // An unused Bridge or Loopback can still move when the lane is spent.
  const more = S.mode === 'run' && S.run.buffer.length < S.puzzle.l && (M.jump || M.loop);
  const done = more ? score(S.run.buffer, S.puzzle.targets) === S.puzzle.targets.length : isFinished(S.run, S.puzzle);
  if (done || stuck) {
    const sc = score(S.run.buffer, S.puzzle.targets);
    if (S.mode === 'sprint') {
      if (sc < S.puzzle.targets.length) endSprint('Locked out');
      else if (S.stage === stages().length - 1) nextStage(); // last matrix: stop the clock right away
      else {
        // Let the final pick flash and the upload effect play before the next matrix pours in.
        S.dealing = true;
        render();
        const token = ++pourToken;
        setTimeout(() => { if (token === pourToken) nextStage(); }, 300);
      }
      document.getElementById('c' + r + c)?.classList.add('flash');
      return;
    }
    const tools = [M.jump && 'Bridge', M.loop && 'Loopback'].filter(Boolean);
    endWhy = sc === S.puzzle.targets.length ? '' : S.run.buffer.length >= S.puzzle.l ? 'buffer full'
      : stuck ? 'no target left in reach' + (tools.length ? ', not even with ' + tools.join(' or ') : '') : 'no legal pick left';
    finish(sc);
  }
  const hadFocus = document.activeElement?.classList.contains('cell');
  render();
  document.getElementById('c' + r + c)?.classList.add('flash');
  if (hadFocus) nearestPickable(r, c)?.focus();
}

// Closest pickable cell to (r, c); ties go to the earlier cell in reading order.
function nearestPickable(r: number, c: number): HTMLElement | null {
  let best: HTMLElement | null = null, bestD = Infinity;
  document.querySelectorAll<HTMLElement>('.cell.ok').forEach((el) => {
    const d = Math.abs(+el.id[1] - r) + Math.abs(+el.id[2] - c);
    if (d < bestD) { best = el; bestD = d; }
  });
  return best;
}

function stopClock() {
  S.over = true;
  S.elapsed = Date.now() - S.start;
  clearInterval(S.timer);
}

function finish(sc: number, disconnected = false) {
  stopClock();
  const win = sc === S.puzzle.targets.length;
  let html: string;
  if (S.mode === 'daily') {
    if (win || S.tries >= MAX_TRIES) {
      const rec: DailyRecord = { score: sc, tries: S.tries, time: S.elapsed };
      save(dailyKey(), rec);
      html = resultHtml(rec);
    } else {
      const left = MAX_TRIES - S.tries;
      html = '<h2>' + sc + "/3 uploaded</h2><p>" + left + ' ' + (left === 1 ? 'try' : 'tries')
        + " left on today's matrix.</p><div class='row'><button class='btn' id='retry'>Try again</button></div>";
    }
  } else if (S.mode === 'run') {
    const { score: bill, out } = finishMatrix(R, runCtx(), disconnected);
    const sec = sections(R)[R.section];
    const [title, btn, label] = ({
      continue: ['+' + bill.total + ' data', 'runNext', 'Next matrix'],
      section: [sec.name + ' breached', 'runSection', 'Next section'],
      loop: [sec.name + ' breached', 'runLoop', 'Patch notes ›'],
      win: [COMPANIES[R.company].name + ' breached', 'runNew', 'New run'],
      lose: ['Run over', 'runNew', 'New run'],
    } as Record<MatrixOutcome, string[]>)[out];
    const next = COMPANIES[R.company + 1];
    const credits = R.earned.map(([why, n]) => "<p class='meta'>" + money(n, '+') + ' · ' + why + '</p>').join('')
      + (out === 'win' && recordBreach(COMPANIES[R.company].id) && next ? "<p class='iceRule unlock'><b>Unlocked · " + next.name + '</b> ' + next.text + '</p>' : '');
    showResult(out === 'win' || out === 'section' || out === 'loop' || (out === 'continue' && bill.total > 0),
      '<h2>' + title + '</h2>' + (endWhy ? "<p class='meta'>auto-disconnect · " + endWhy + '</p>' : '') + billHtml(bill) + '<p>' + sec.name + ' ' + R.data + '/' + quota(R) + '</p>' + credits
      + "<div class='row'><button class='btn' id='" + btn + "'>" + label + '</button></div>');
    return;
  } else {
    const c = settle(win);
    html = '<h2>' + (win ? 'Access granted' : sc + '/3 uploaded') + '</h2><p>Time ' + fmt(S.elapsed) + '</p>' + c.info
      + "<div class='row'><button class='btn' id='again'>Retry this one</button><button class='btn' id='next'>New matrix</button>"
      + CHALLENGE_BTN + '</div>';
    showResult(win, html);
    return wireChallenge(c.first);
  }
  showResult(win, html);
}

// The first completion of a matrix or sprint counts (for links and records); losses aren't saved, so you can keep
// trying until you clear it, and replays after a clear are practice.
function settle(win: boolean) {
  const id = challengeKind() + '.' + S.seed;
  const official = win && recordFirst(id, S.elapsed);
  const first = firstResult(id) ?? null;
  let info = official || first === null ? '' : "<p class='meta'>Practice run · your first clear (" + fmt(first) + ') counts</p>';
  if (S.challenge) info += '<p>Their time ' + fmt(S.challenge) + (first !== null && first < S.challenge ? ' · you win' : '') + '</p>';
  return { official, first, info };
}

function showPlayed(first: number) {
  S.over = true;
  render();
  const vs = S.challenge ? '<p>Their time ' + fmt(S.challenge) + (first < S.challenge ? ' · you win' : '') + '</p>' : '';
  const again = S.mode === 'sprint' ? "<button class='btn' id='sprintAgain'>Sprint again</button>" : "<button class='btn' id='next'>New matrix</button>";
  showResult(true, '<h2>Already bypassed</h2><p>Your time ' + fmt(first) + '</p>' + vs
    + "<div class='row'>" + again + CHALLENGE_BTN + '</div>');
  wireChallenge(first);
}

const CHALLENGE_BTN ="<button class='btn' id='challenge'>Challenge a friend</button>";

function wireChallenge(first: number | null) {
  const what = S.mode === 'sprint' ? 'this ' + S.sprintLen + '-matrix sprint' : 'this matrix';
  const link = location.origin + location.pathname + challengeQuery(challengeKind(), S.seed, first);
  wireCopy('challenge', () => 'Can you bypass ' + what + (first !== null ? ' in under ' + fmt(first) : '') + '?\n' + link);
}

// failure: null when all matrices were cleared, otherwise the reason the run ended.
function endSprint(failure: string | null) {
  stopClock();
  render();
  const c = settle(!failure);
  const row = "<div class='row'><button class='btn' id='sprintAgain'>Sprint again</button>" + CHALLENGE_BTN + '</div>';
  if (failure) {
    const retry = "<button class='btn' id='retrySprint'>Retry this sprint</button>";
    showResult(false, '<h2>' + failure + '</h2><p>Matrix ' + (S.stage + 1) + '/' + stages().length + ' · ' + fmt(S.elapsed) + '</p>' + c.info
      + row.replace("<div class='row'>", "<div class='row'>" + retry));
  } else {
    const prev = load<number>(sprintBestKey());
    const best = c.official && (!prev || S.elapsed < prev) ? S.elapsed : prev;
    if (best !== prev) save(sprintBestKey(), best);
    $('meta').textContent = sprintMeta();
    showResult(true, '<h2>Bypassed in ' + fmt(S.elapsed) + '</h2><p>Best ' + (best ? fmt(best) : '—') + (c.official && best === S.elapsed ? ' · new record' : '')
      + '</p>' + c.info + row);
  }
  wireChallenge(c.first);
}

const sprintMeta = () => {
  const best = load<number>(sprintBestKey());
  return 'Sprint · ' + stages().length + ' matrices · best ' + (best ? fmt(best) : '—');
};

function shareText(rec: DailyRecord) {
  const bars = '▮'.repeat(rec.score) + '▯'.repeat(3 - rec.score);
  return 'BYPASS #' + String(dayNumber()).padStart(3, '0') + '\n'
    + bars + ' ' + rec.score + '/3 · try ' + rec.tries + '/' + MAX_TRIES + ' · ' + fmt(rec.time) + '\n'
    + location.origin + location.pathname;
}

const resultHtml = (rec: DailyRecord) =>
  '<h2>' + (rec.score === 3 ? 'Access granted' : 'Locked out') + "</h2><pre id='shareTxt'>" + shareText(rec)
  + "</pre><div class='row'><button class='btn' id='share'>Copy result</button><button class='btn' id='toTrain'>Play training</button></div><p class='meta'>New matrix tomorrow.</p>";

function wireCopy(id: string, text: () => string) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.onclick = async () => {
    const txt = text();
    try {
      await navigator.clipboard.writeText(txt);
      btn.textContent = 'Copied';
    } catch {
      let ta = document.getElementById('copyFallback') as HTMLTextAreaElement | null;
      if (!ta) { ta = document.createElement('textarea'); ta.id = 'copyFallback'; $('result').appendChild(ta); }
      ta.value = txt;
      ta.select();
    }
  };
}

// Run mode shows its screens as a centered dialog over the locked board; the other modes keep the inline panel.
function showResult(win: boolean, html: string) {
  const run = S.mode === 'run';
  const res = $(run ? 'modalBox' : 'result');
  $(run ? 'modal' : 'result').hidden = false;
  res.className = 'result' + (run ? ' modal' : '') + (win ? ' win' : '');
  res.innerHTML = html;
  const h2 = res.querySelector('h2');
  if (h2) {
    if (run) h2.id = 'modalTitle';
    scramble(h2, h2.textContent ?? '', 2, 1, 35);
  }
  if (run) {
    $('app').inert = true;
    $('modal').scrollTop = 0; // long dialogs (the catalog) open at the top
    res.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }
  const on = (id: string, fn: () => void) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('retry', () => { S.tries++; resetRun(); });
  on('again', () => resetRun());
  on('next', () => setMode('train'));
  on('runNext', dealMatrix);
  on('runSection', () => { nextSection(R); showOffer(); });
  on('runLoop', () => showPatch(nextSection(R)!));
  on('runNew', () => setMode('run'));
  on('toTrain', () => setMode('train'));
  on('sprintAgain', () => setMode('sprint'));
  on('retrySprint', () => setMode('sprint', S.seed, S.challenge));
  wireCopy('share', () => $('shareTxt').textContent ?? '');
}

function hideResult() {
  $('result').hidden = $('modal').hidden = true;
  $('app').inert = false;
  $('modal').onkeydown = null; // Esc closes only the catalog
}

function resetRun() {
  clearInterval(S.timer);
  Object.assign(S, { run: newRun(), start: 0, elapsed: 0, over: false, stage: 0, dealing: false });
  if (S.mode === 'run') S.run.burn = burnOf(R) || undefined;
  endWhy = '';
  offer = [];
  doneSeen.clear();
  hideResult();
  pour();
}

function setMode(m: Mode, seed = randomSeed(), challenge: number | null = null) {
  const back = S.mode;
  $('wmark').innerHTML = '';
  S.mode = m;
  S.challenge = challenge;
  S.tries = 1;
  $('modeDaily').setAttribute('aria-pressed', String(m === 'daily'));
  $('modeTrain').setAttribute('aria-pressed', String(m === 'train'));
  $('modeSprint').setAttribute('aria-pressed', String(m === 'sprint'));
  $('modeRun').setAttribute('aria-pressed', String(m === 'run'));
  $('sizes').hidden = m !== 'train';
  $('sprintLen').hidden = m !== 'sprint';
  $('daemonPane').hidden = $('itemPane').hidden = m !== 'run';
  $('steps').hidden = m !== 'run';
  document.querySelectorAll<HTMLElement>('[data-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === S.size)));
  document.querySelectorAll<HTMLElement>('[data-len]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.len! === S.sprintLen)));
  if (m === 'daily') {
    $('meta').textContent = 'Daily #' + String(dayNumber()).padStart(3, '0') + ' · ' + utcDate();
    S.puzzle = generate(hashStr('bypass-' + utcDate()));
    resetRun();
    const rec = load<DailyRecord>(dailyKey());
    if (rec) { S.over = true; render(); showResult(rec.score === 3, resultHtml(rec)); }
  } else if (m === 'train') {
    $('meta').textContent = challenge ? 'Training · challenge' : 'Training · unlimited';
    S.seed = seed;
    S.puzzle = generate(seed, SIZES[S.size]);
    resetRun();
  } else if (m === 'run') {
    S.seed = seed;
    showCompanies(seed, back);
  } else {
    $('meta').textContent = sprintMeta() + (challenge ? ' · challenge' : '');
    S.seed = seed;
    S.puzzle = generate(stageSeed(seed, 0), stages()[0]);
    resetRun();
  }
}

const MOVES: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

// "Decrypt" effect: each char cycles random glyphs, locking in left to right.
const GLYPHS = '0123456789ABCDEF#$%&';
function scramble(el: HTMLElement, word: string, lead: number, perChar: number, ms: number) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || el.dataset.scrambling) return;
  el.dataset.scrambling = '1';
  let frame = 0;
  const id = setInterval(() => {
    frame++;
    el.textContent = [...word].map((ch, i) => (frame > lead + i * perChar ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join('');
    if (frame > lead + word.length * perChar) { clearInterval(id); delete el.dataset.scrambling; }
  }, ms);
}

export function init() {
  const h1 = document.querySelector('h1')!;
  scramble(h1, h1.textContent ?? '', 3, 2, 50);
  const track = (e: Event) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains('cell')) { cursor = [+el.id[1], +el.id[2]]; applyCross(); }
  };
  $('grid').addEventListener('mouseover', track);
  $('grid').addEventListener('focusin', track);
  $('grid').addEventListener('mouseleave', () => { cursor = null; applyCross(); });
  $('grid').addEventListener('keydown', (e) => {
    const d = MOVES[e.key];
    const cur = e.target as HTMLElement;
    if (!d || !cur.classList.contains('cell')) return;
    e.preventDefault();
    // Jump to the next pickable cell, wrapping at the edges; arrows across the active lane find none and do nothing.
    const n = S.puzzle.grid.length;
    const r0 = +cur.id[1], c0 = +cur.id[2];
    let i = 1, r = r0, c = c0;
    for (; i < n; i++) {
      r = (((r0 + d[0] * i) % n) + n) % n;
      c = (((c0 + d[1] * i) % n) + n) % n;
      if (legal(r, c)) break;
    }
    if (i === n) return;
    const next = $('c' + r + c);
    cur.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  });
  $('modeDaily').onclick = () => setMode('daily');
  $('modeTrain').onclick = () => setMode('train');
  $('modeSprint').onclick = () => setMode('sprint');
  $('modeRun').onclick = () => setMode('run');
  $('catalogBtn').onclick = showCatalog;
  document.querySelectorAll<HTMLElement>('[data-size]').forEach((b) => {
    b.onclick = () => { S.size = b.dataset.size as SizeKey; setMode('train'); };
  });
  document.querySelectorAll<HTMLElement>('[data-len]').forEach((b) => {
    b.onclick = () => { S.sprintLen = +b.dataset.len! as SprintLen; setMode('sprint'); };
  });
  const ch = parseChallenge(location.search);
  if (ch) {
    history.replaceState(null, '', location.pathname);
    if (ch.kind === 'sprint3' || ch.kind === 'sprint5') {
      S.sprintLen = ch.kind === 'sprint3' ? 3 : 5;
      setMode('sprint', ch.seed, ch.time);
    } else {
      S.size = ch.kind;
      setMode('train', ch.seed, ch.time);
    }
    // Already cleared this matrix/sprint: show that result instead of letting it be replayed.
    const first = firstResult(ch.kind + '.' + ch.seed);
    if (typeof first === 'number') showPlayed(first);
  } else setMode('daily');
}
