import { BLOCK, CODES, generate, hashStr, SIZES, type Puzzle, type SizeKey } from './generator';
import {
  MAX_TRIES, SPRINTS, type ChallengeKind, type SprintLen, challengeQuery, isFinished, newRun, parseChallenge, score,
  stageSeed, targetProgress, WILD, fits, inLane, burning,
} from './game';
import { gear } from './gear';
import { hacker, logo } from './logos';
import {
  applyPick, canPick, cellView, ctxOf, dealBoard, hasMoves, isStuck, jumpAny, jumpReady, loopAny, rewind, startRun, EMPTY_CTX, emptyItems, isBlackout, isDoorOpen, isEncrypted, TOOLS, type Board, type ItemState, type Tool,
} from './matrix';
import {
  buy, coverage, CRON_DATA, played, DAEMON_SLOTS, daemonSlots, DAEMONS, DC_SLOTS_PER_CREDIT, DATA_BY_LEN, finishMatrix, forSale, ITEMS, movePreview, newRunState, nextSection,
  burnOf, COMPANIES, companyOpen, isBoss, LOOPS, quota, QUOTA_GROWTH, revealed, roomIce, sections, ICE, nodeData, offerDaemons, REROLL_COST, SWAP_COST, swapDaemon, scopeOf, streakOf, rarityOf, BOUNTIES, bountySpots, bountyMet, claimReward, BOUNTY_CREDITS, BOUNTY_STACKS, REWARDS, type BountyId, type RewardId, restartMatrix, RACK_MAX, slotCost, rackFull, sellValue, sell, buySlot, scoreMatrix, sectionMatrix, splitTarget, stockShop,
  type Company, type Patch, type Preview, type DaemonId, type Effect, type IceId, type ItemId, type MatrixCtx, type RunState, type Score,
} from './roguelike';
import {
  bestRun, breached, dayNumber, dropRun, exportBackup, firstResult, load, loadRun, parseBackup, recordBreach, recordBest, recordFirst, restoreBackup, save, saveRun, setBreached, utcDate,
} from './storage';

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
// Run save: R at the last checkpoint, the screen to reopen, and the current matrix's actions, replayed on the same deal.
type Act = { r: number; c: number; t?: Tool } | { s: number; at?: number } | { d: 1 } | { w: 1 } | { x: 1 };
type RunScreen = 'intro' | 'matrix' | 'patch' | 'offer' | 'shop';
interface SavedRun { v: number; R: RunState; screen: RunScreen; patch?: Patch; log: Act[] }
const RUN_V = 1; // bump when RunState changes shape; older saves are dropped
let cur: SavedRun | null = null, replaying = false;
function checkpoint(screen: RunScreen, patch?: Patch) {
  cur = { v: RUN_V, R: structuredClone(R), screen, patch, log: [] };
  saveRun(cur);
}
function logAct(a: Act) {
  if (!cur || replaying || S.mode !== 'run') return;
  cur.log.push(a);
  saveRun(cur);
}
function endSave() { cur = null; dropRun(); }
let M: ItemState = emptyItems();
// Run: the order the player dragged the targets into; display only. A split changes the count and resets it.
let tOrder: number[] = [];
let dragged = -1;
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
// The matrix as the rules see it; outside a run no item, daemon or ICE applies.
const B = (): Board => S.mode === 'run'
  ? { puzzle: S.puzzle, run: S.run, m: M, armed, ctx: ctxOf(R), over: S.over }
  : { puzzle: S.puzzle, run: S.run, m: emptyItems(), armed, ctx: EMPTY_CTX, over: S.over };
const legal = (r: number, c: number) => !S.dealing && !offer.length && canPick(B(), r, c);
const doorOpen = () => isDoorOpen(B());
const blackout = () => isBlackout(B());
const encrypted = (r: number, c: number) => isEncrypted(B(), r, c);
const randomSeed = () => Math.floor(Math.random() * 1e9);
const addr = (r: number) => '0x' + (r * 16).toString(16).toUpperCase().padStart(2, '0');
// Row and column names; a run company may label them its own way.
const rowName = (r: number) => (S.mode === 'run' && COMPANIES[R.company].rowLabel?.(r)) || addr(r);
const colName = (c: number) => (S.mode === 'run' && COMPANIES[R.company].colLabel?.(c)) || '+' + c;

let beltSeen = 0;
const TAG = { get node() { return "<i class='ntag'>+" + nodeData(R.items) + '</i>'; }, trap: "<i class='ntag ttag'>×.5</i>", rep: "<i class='ntag rtag'>×2</i>" };

function render() {
  const { grid, targets, l } = S.puzzle;
  const n = grid.length;
  const { buffer, axis, idx } = S.run;
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
  const bd = B();
  // Conveyor: the belt slides only on the render right after a pick.
  const moved = !!S.puzzle.belt && S.run.path.length > 0 && S.run.path.length !== beltSeen;
  beltSeen = S.run.path.length;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (c === 0) hx(rowName(r), free ? r === free[0] : axis === 'row' && r === idx, S.puzzle.belt?.row === r ? ' belt' : '');
    const b = document.createElement('button');
    b.className = 'cell';
    b.id = 'c' + r + c;
    const v = cellView(bd, r, c);
    b.textContent = v.hidden ? '??' : v.code;
    b.classList.add(...v.cls);
    if (moved && v.cls.includes('belt')) b.classList.add('shift');
    for (const t of v.tags) b.insertAdjacentHTML('beforeend', TAG[t]);
    if (v.burnLeft !== undefined) b.insertAdjacentHTML('beforeend', "<i class='btag'>" + (v.burnLeft === Infinity ? '∞' : v.burnLeft) + '</i>');
    if (!S.dealing && !offer.length && canPick(bd, r, c)) {
      b.classList.add('ok');
      b.setAttribute('aria-label', 'Pick ' + (v.hidden ? 'an encrypted code' : v.code) + (v.tags.includes('trap') ? ' (honeypot)' : '') + ' at row ' + (r + 1) + ' column ' + (c + 1));
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
    : armed === 'jump' ? 'bridge: pick ' + (jumpAny(B()) ? 'any free cell' : 'a free cell next to your last pick') : armed === 'mux' ? 'mux: pick in the row or column of your last pick' : armed === 'loop' ? 'loopback: pick a used cell' + (loopAny(B()) ? '' : ' in your lane') : S.over ? 'session closed'
    : doorOpen() ? 'pick on any edge' : free ? 'pick in row ' + rowName(free[0]) + ' or col ' + colName(free[1])
    : axis === 'row' ? 'pick in row ' + rowName(idx) : 'pick in col ' + colName(idx);
  const buf = $('buffer');
  buf.innerHTML = '';
  $('bufferLabel').textContent = 'buffer ' + buffer.length + '/' + l; // l already lacks the slots Throttle takes
  const has = (id: DaemonId) => S.mode === 'run' && R.daemons.includes(id);
  const cover = has('chain') || has('compressor') ? coverage(buffer, targets) : [];
  // Run: slots from bought items are dashed; the ones Throttle takes away stay on show, locked.
  const run = S.mode === 'run';
  const thr = run && roomIce(R).includes('throttle') ? 1 : 0;
  const bought = run ? sectionMatrix(R.section, R.items, R.company).slack : 0;
  for (let i = 0; i < l + thr; i++) {
    const s = document.createElement('div');
    if (i >= l) {
      s.className = 'slot lock';
      s.textContent = '##';
      s.dataset.tip = 'Taken by Throttle ICE';
      buf.appendChild(s);
      continue;
    }
    s.className = 'slot' + (buffer[i] ? ' filled' : '') + (i === buffer.length - 1 && !S.over ? ' new' : '') + (i >= l - bought ? ' extra' : '')
      + (cover[i] >= 2 ? ' shared' : '') + (has('light') && i === Math.floor(l / 2) - 1 ? ' half' : '') + (buffer[i] === WILD ? ' wild' : '');
    if (has('overflow')) s.dataset.bonus = '+.5';
    if (s.classList.contains('extra')) s.dataset.tip = 'Extra slot from your rack';
    s.textContent = buffer[i] ?? '';
    buf.appendChild(s);
    if (s.classList.contains('new')) scramble(s, buffer[i], 1, 1, 40);
  }
  const tg = $('targets');
  tg.innerHTML = '';
  if (S.mode !== 'run' || tOrder.length !== targets.length) tOrder = targets.map((_, i) => i);
  tOrder.forEach((i) => {
    const t = targets[i];
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
      + '<span class="' + (j < st.k ? 'hit' : '') + (c === WILD ? ' wild' : '') + '">' + (blackout() ? '??' : c) + '</span>').join('') + '</div><div class="state">' + state + '</div>';
    el.querySelectorAll<HTMLElement>('.codes span').forEach((sp, j) => { sp.onmouseenter = () => markCode(t[j]); sp.onmouseleave = () => markCode(); });
    if (gaps) el.querySelectorAll<HTMLElement>('.gap').forEach((g) => { g.onclick = () => doSplit(i, +g.dataset.at!); });
    else if (cut) {
      Object.assign(el, { tabIndex: 0, onclick: () => doSplit(i, mark), onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') doSplit(i, mark); } });
      el.setAttribute('role', 'button');
    }
    if (S.mode === 'run' && !cut) {
      el.draggable = true;
      el.dataset.tip = 'Drag to reorder';
      el.ondragstart = (e) => { dragged = i; e.dataTransfer?.setData('text/plain', String(i)); };
      el.ondragover = (e) => { e.preventDefault(); el.classList.add('drop'); };
      el.ondragleave = () => el.classList.remove('drop');
      el.ondrop = (e) => {
        e.preventDefault();
        if (dragged < 0 || dragged === i) return;
        const to = tOrder.indexOf(i);
        tOrder.splice(tOrder.indexOf(dragged), 1);
        tOrder.splice(to, 0, dragged);
        dragged = -1;
        render();
      };
    }
    tg.appendChild(el);
    if (st.done && !doneSeen.has(i)) {
      doneSeen.add(i);
      el.classList.add('just');
      scramble(el.querySelector<HTMLElement>('.state')!, state, 2, 1, 40);
    }
  });
  // The matrix's bonus objective, ticked while it holds.
  if (S.mode === 'run' && M.bounty) {
    const b = BOUNTIES[M.bounty], ok = !!S.run.path.length && bountyMet(M.bounty, runCtx());
    // The reward stays hidden until the matrix is over.
    tg.insertAdjacentHTML('beforeend', "<div class='bounty" + (ok ? ' met' : '') + "'><span class='bnt'>bonus</span><b>" + b.name + '</b> ' + b.text(runCtx())
      + "<span class='bstate'>" + (ok ? 'met ✓' : 'reward ???') + '</span></div>');
  }
  // A held ×2 data charge (bonus reward) can be spent on this matrix at any time before it ends.
  if (S.mode === 'run' && (M.charge || (R.charges && !S.over))) {
    tg.insertAdjacentHTML('beforeend', M.charge
      ? "<div class='charge on'><span class='cnt'>consumable</span><b>×2 data</b> charge spent on this matrix<span class='cstate'>×2 ✓</span></div>"
      : "<button class='charge' id='useCharge'><span class='cnt'>consumable</span><b>×2 data</b> charge · " + R.charges + " held<span class='cstate'>click to use here</span></button>");
    document.getElementById('useCharge')?.addEventListener('click', useCharge);
  }
  const extra = S.mode === 'daily' ? '<span>Try <b>' + S.tries + '/' + MAX_TRIES + '</b></span>'
    : (S.mode === 'sprint' ? '<span>Matrix <b>' + Math.min(S.stage + 1, stages().length) + '/' + stages().length + '</b></span>' : '')
      + (S.challenge ? '<span>Beat <b>' + fmt(S.challenge) + '</b></span>' : S.mode === 'train' ? '<span>Training</span>' : '');
  $('status').innerHTML = "<span>Time <b id='clock'>" + clockText() + '</b></span>' + (S.mode === 'run' ? runStatus() : extra);
  document.getElementById('disconnect')?.addEventListener('click', disconnect);
  if (S.mode === 'run') { renderDaemons(); renderSteps(); }
  $('timebar').hidden = S.mode !== 'sprint' || S.over;
  updateBar();
  applyCross();
}

const runCtx = (): MatrixCtx =>
  ({ buf: S.run.buffer, path: S.run.path, targets: S.puzzle.targets, l: S.puzzle.l, n: S.puzzle.grid.length, worth: M.worth, node: M.node, trap: M.trap, jumps: M.jumps,
    par: S.puzzle.path?.length, tools: M.tools, bounty: M.bounty, charge: M.charge });

// Data shows the live total with the current matrix's score; once the matrix is over it is banked in R.data.
function runStatus() {
  const live = S.over ? 0 : scoreMatrix(runCtx(), R).total;
  // Ending early keeps the empty slots, which pay credits.
  const pay = Math.floor((S.puzzle.l - S.run.buffer.length) / DC_SLOTS_PER_CREDIT) + (R.daemons.includes('silent') ? 2 : 0);
  const disconnect = live ? "<button class='btn act' id='disconnect'>Disconnect" + (pay ? ' · ' + money(pay, '+') : '') + '</button>' : '';
  return disconnect;
}

// Score reads as data × boost: data = target data + flat bonuses, boost = (1 + additive boosts) × multipliers.
const num = (x: number) => String(Number(x.toFixed(2)));
const scoreHtml = (sc: Score) => "<span class='vd'>" + (sc.base + sc.flat) + "</span> × <span class='vm'>"
  + num((1 + sc.boost) * sc.mult) + '</span> = <b>' + sc.total + '</b>';

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
  deflate: "<path d='M4 4l5 5M20 4l-5 5M4 20l5-5M20 20l-5-5M9 5v4H5M15 5v4h4M9 19v-4H5M15 19v-4h4'/>",
  joker: "<path d='M12 4v16M5 8l14 8M19 8L5 16'/>",
  saturate: "<rect x='3' y='8' width='18' height='8'/><path d='M7 8v8M11 8v8M15 8v8'/>",
  echo: "<path d='M5 12a7 7 0 1 0 2-5M5 4v4h4'/><circle cx='12' cy='12' r='2'/>",
  crawler: "<path d='M4 18h4v-4h4v-4h4V6h4'/><circle class='f' cx='4' cy='18' r='1.4'/>",
  sandbag: "<path d='M6 20h12l-2-12H8zM9 8c0-2 1.5-3 3-3s3 1 3 3'/><path d='M8 14h8'/>",
  allin: "<circle cx='12' cy='12' r='8.5'/><circle cx='12' cy='12' r='3.5'/><path d='M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3'/>",
  overtime: "<circle cx='12' cy='13' r='7.5'/><path d='M12 9v4l2.5 2M9 3h6M18.5 6.5l1.5-1.5'/>",
  warmup: "<path d='M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z'/>",
};

const SCOPE_MARK = { matrix: '◇', room: '▣', run: '∞' };
// Daemon card styled as a program file, in a floating slot; the shared clock (90 s, a multiple of every card animation's period) keeps the float and glitch
// phases steady across re-renders.
const card = (id: DaemonId, i: number, tag: string, text: string, foot: string, cls = '') => {
  const d = DAEMONS[id];
  const sc = scopeOf(id);
  return "<div class='dslot' style='--t:-" + Math.round((performance.now() + i * 2900) % 90000) + "ms'><" + tag + " class='dcard c-"
    + d.family.toLowerCase() + ' s-' + sc + ' r-' + rarityOf(id) + cls + "'><span class='dbody'><em class='fold'></em>" + (rarityOf(id) === 'common' ? '' : "<em class='foil'></em>") + "<svg class='ico' viewBox='0 0 24 24' aria-hidden='true'>" + ICONS[id]
    + "</svg><span class='dmain'><b><span class='fdir'>" + d.family.toLowerCase() + '/</span><wbr>' + d.name.toLowerCase().replace(/ /g, '_<wbr>')
    + "<span class='fext'>.dmn</span></b><small><span class='scope'>scope:" + sc + " <em class='smark' aria-hidden='true'>" + SCOPE_MARK[sc] + '</em></span>'
    + (rarityOf(id) === 'common' ? '' : " | <span class='rar'>" + rarityOf(id).toUpperCase() + '</span>')
    + '</small><span>' + text + '</span></span><i>' + foot + '</i></span></' + tag + '></div>';
};

// Where each card glitch burst starts, as a share of its period (style.css keyframes).
const BURST: Record<string, number> = { tear: 0.94, rgb: 0.94, tearR: 0.96, slip: 0.96, tearL: 0.96, slice: 0.96, rgbL: 0.96 };
// Pointing at a card plays its rarity's burst right away: its running glitch animations jump to just before the burst.
// A CSS :hover can't do it, since the same animation name doesn't restart.
function glitchNow(c: HTMLElement) {
  for (const a of c.getAnimations({ subtree: true })) {
    const at = BURST[(a as CSSAnimation).animationName], p = Number(a.effect?.getTiming().duration);
    if (at === undefined || !p || a.currentTime === null) continue;
    const t = Number(a.currentTime), cut = Math.floor(t / p) * p + at * p - 20;
    a.currentTime = cut > t ? cut : cut + p;
  }
}

// Cards lean toward the pointer, with a glare spot under it.
function tilt(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.dcard').forEach((c) => {
    c.onpointerenter = () => glitchNow(c);
    c.onpointermove = (e) => {
      const r = c.parentElement!.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      // Wide strips: a gentler turn sideways, a stronger one front to back.
      c.style.cssText = '--rx:' + (0.5 - y) * 16 + 'deg;--ry:' + (x - 0.5) * 8 + 'deg;--mx:' + x * 100 + '%;--my:' + y * 100 + '%';
    };
    c.onpointerleave = () => { c.style.cssText = ''; };
  });
}

// Hold a daemon card, then drag it to a new place in the list; a tap or a scroll never moves it. Order is only cosmetic.
function dragSort(root: HTMLElement) {
  const slots = () => [...root.querySelectorAll<HTMLElement>('.dslot:not(.empty)')];
  slots().forEach((slot, i) => {
    slot.dataset.i = String(i);
    let live = false;
    slot.oncontextmenu = (e) => { if (live) e.preventDefault(); };
    slot.addEventListener('touchmove', (e) => { if (live) e.preventDefault(); }, { passive: false });
    slot.onpointerdown = (e) => {
      if (e.button || R.daemons.length < 2) return;
      const x0 = e.clientX, y0 = e.clientY;
      const hold = setTimeout(() => { live = true; slot.classList.add('drag'); }, 300);
      const move = (ev: PointerEvent) => {
        if (!live) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) stop(); return; }
        for (const o of slots()) {
          const r = o.getBoundingClientRect();
          if (o === slot || ev.clientY < r.top || ev.clientY > r.bottom) continue;
          root.insertBefore(slot, ev.clientY < r.top + r.height / 2 ? o : o.nextSibling);
          break;
        }
      };
      const stop = () => {
        clearTimeout(hold);
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', stop);
        removeEventListener('pointercancel', stop);
        if (!live) return;
        live = false;
        R.daemons = slots().map((o) => R.daemons[+o.dataset.i!]);
        if (cur) { cur.R.daemons = [...R.daemons]; saveRun(cur); } // the order survives a reload
        render();
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', stop);
      addEventListener('pointercancel', stop);
    };
  });
}

// Owned daemons fill the slots; one that counts toward the current matrix lights up and shows what it adds.
function renderDaemons() {
  const sc = S.over && lastBill ? lastBill : scoreMatrix(runCtx(), R);
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
  $('daemonLabel').textContent = 'daemons ' + R.daemons.length + '/' + daemonSlots(R);
  $('daemons').innerHTML = Array.from({ length: daemonSlots(R) }, (_, i) => {
    const id = R.daemons[i];
    if (!id) return "<div class='dslot empty'>slot " + (i + 1) + (i >= DAEMON_SLOTS ? ' · co-processor' : '') + ' · empty</div>';
    const e = fired.get(id);
    return card(id, i, 'div', daemonText(id), e ? fmtEffect(e) : dfoot(id), e ? (lastFired.includes(id) ? ' on' : ' on just') : '');
  }).join('');
  lastFired = [...fired.keys()];
  tilt($('daemons'));
  dragSort($('daemons'));
  // Deck as a rack of units. A ready tool pulses; clicking it arms it, clicking again puts it down.
  // The LCD shows the pointed-at unit's spec, otherwise what is ready or armed.
  const start = !S.run.path.length, hosted = R.daemons[DAEMON_SLOTS];
  const units = R.items.map((id) => {
    // Burner SIM acts at once like Rewind: no arming, it deals a new matrix before the first move.
    const it = ITEMS[id], t: Tool | 'sim' | undefined = id === 'sim' ? 'sim' : TOOLS[id];
    const ready = !!t && !S.over && !offer.length
      && (t === 'sim' ? !S.start && R.restarts > 0 : t === 'wild' ? M.wild && start : t === 'split' ? M.split && start : t === 'jump' ? jumpReady(B()) : t === 'mux' ? M.mux && !start && !S.run.free : t === 'rewind' ? M.rewind && !!M.back : M.loop && !start);
    const on = ready && armed === t;
    const hint = !ready ? '' : t === 'sim' ? 'ready · click to swap this matrix for a new one' : t === 'rewind' ? 'ready · click to take back your last pick' : !on ? 'ready · click to arm' : t === 'split' ? 'armed · click a target'
      : t === 'loop' ? 'armed · click a lit used cell' : t === 'mux' ? 'armed · pick in your line or across it' : 'armed · click a free cell';
    return { id, t, ready, st: on ? 'armed' : ready ? 'ready' : t ? 'standby' : 'online',
      spec: '<b>&gt; ' + it.name.toLowerCase().replace(/ /g, '_') + '_v' + it.ver + '</b> ' + it.text + (hint ? ' · <b>' + hint + '</b>' : '')
        + (id === 'socket' && hosted ? ' · <b>hosts ' + DAEMONS[hosted].name + '</b>' : '') };
  });
  const on = units.find((u) => u.st === 'armed'), ready = units.filter((u) => u.ready);
  const lcd = on ? on.spec
    : ready.length ? '<b>&gt; ' + ready.map((u) => ITEMS[u.id].name.toLowerCase()).join(', ') + '</b> ready · click to arm'
      : units.length ? '<b>&gt;</b> ' + units.length + ' modules installed · point at one to read its spec'
        : '<b>&gt;</b> no hardware · buy modules between rooms';
  const rail = (n: number) => "<span class='rail'>" + String(n).padStart(2, '0') + '</span>';
  $('items').innerHTML = '<header><span>hw rack</span><span>' + units.length + '/' + R.rack + 'U</span></header>'
    // The full rack is always on show: owned slots without a module are open bays, the rest keep their blanking plates.
    + Array.from({ length: Math.max(RACK_MAX, units.length) }, (_, i) => {
      const u = units[i];
      if (!u && i < R.rack) return rail(i + 1) + "<div class='unit bay' aria-hidden='true'><span>empty bay</span></div>" + rail(i + 1);
      if (!u) return rail(i + 1) + "<div class='unit blank' data-tip='Locked: buy a rack slot in the shop'><i class='scr'></i><i class='vent'></i>"
        + "<span class='lock'>locked</span><i class='vent'></i><i class='scr'></i></div>" + rail(i + 1);
      const it = ITEMS[u.id], tag = u.ready ? 'button' : 'div';
      return rail(i + 1) + '<' + tag + " class='unit hw " + u.st + (u.t === 'wild' || u.t === 'split' || u.t === 'sim' ? ' pre' : '') + "'" + (u.ready ? " data-tool='" + u.t + "'" : " tabindex='0'")
        + " aria-label='" + it.name + ' v' + it.ver + ', ' + u.st + ': ' + it.text + "'><i class='scr'></i>" + gear(u.id)
        + "<span class='nm'><b>" + it.name + ' <small>v' + it.ver + '</small></b><small><span>' + (u.id === 'socket' && hosted ? '▸ ' + DAEMONS[hosted].name : it.kind) + '</span>' + (u.t ? '<em>· ' + u.st + '</em>' : '')
        + "</small></span><i class='led'></i><i class='scr'></i></" + tag + '>' + rail(i + 1);
    }).join('') + "<p class='lcd' id='lcd'>" + lcd + '</p>';
  $('items').querySelectorAll<HTMLElement>('.unit.hw').forEach((el, i) => {
    // A ready Bridge lights the cells it can reach while pointed at.
    const reach = (on: boolean) => units[i].t === 'jump' && units[i].ready && document.querySelectorAll<HTMLElement>('#grid .cell').forEach((c) =>
      c.classList.toggle('reach', on && canPick({ ...B(), armed: 'jump' }, +c.id[1], +c.id[2])));
    const show = () => { $('lcd').innerHTML = units[i].spec; reach(true); }, hide = () => { $('lcd').innerHTML = lcd; reach(false); };
    el.onpointerenter = el.onfocus = show;
    el.onpointerleave = el.onblur = hide;
    if (el.dataset.tool) el.onclick = () => {
      if (el.dataset.tool === 'rewind') return doRewind();
      if (el.dataset.tool === 'sim') return burnSim();
      armed = armed === el.dataset.tool ? null : (el.dataset.tool as Tool);
      render();
    };
  });
}

// A streak daemon that is not firing yet says what keeps its stack and what that would give.
const dfoot = (id: DaemonId) => {
  const st = streakOf(id);
  return st && !S.over ? "<span class='hold'>" + st.goal + ' → ' + fmtEffect(st.effect((R.stacks[id] ?? 0) + 1)) + '</span>' : 'standby';
};
let lastBill: Score | null = null;

// An installed streak daemon (or Sandbag, whose stack lasts a room) also shows its current stack.
const daemonText = (id: DaemonId) => {
  const st = streakOf(id), n = R.stacks[id] ?? 0;
  return DAEMONS[id].text + ((st || id === 'sandbag') && R.daemons.includes(id) ? ' · stack now ' + n + (n && st ? ' (' + fmtEffect(st.effect(n)) + ')' : '') : '')
    + (st && n && R.daemons.includes(id) && R.bonus?.includes('stack') ?" <span class='bnt'>bonus</span> +" + BOUNTY_STACKS + ' stacks' : '');
};
// Credits from bonus rewards claimed since the last shop.
const bonusCash = () => (R.bonus ?? []).filter((b) => b === 'cash').length * BOUNTY_CREDITS;

// Shop item drawn as its own piece of hardware: a button on the shelf, a plain tile in the catalog.
const ware = (id: ItemId, tag: string, foot: string, cls = '') => {
  const it = ITEMS[id];
  return '<' + tag + " class='ware hw" + cls + "'><span class='stage'>" + gear(id) + '</span><b>' + it.name + ' <small>v' + it.ver + '</small></b><small>' + it.kind
    + '</small><p>' + it.text + "</p><span class='price'>" + foot + '</span></' + tag + '>';
};

let catalogTab: 'daemons' | 'items' | 'bonuses' | 'ice' = 'daemons';

// Dev cheats on the catalog: toggle daemons and items (a v2.0 and its v1.0 replace each other), add credits, re-deal, skip a room.
function wireDev(ds: DaemonId[], its: ItemId[]) {
  const needs = (x: ItemId) => (ITEMS[x] as { needs?: string }).needs;
  const refresh = () => { render(); showCatalog(); };
  $('modalBox').querySelectorAll<HTMLElement>('.dlist .dcard').forEach((b, i) => {
    const id = ds[i];
    b.onclick = () => {
      if (R.daemons.includes(id)) R.daemons = R.daemons.filter((d) => d !== id);
      else if (R.daemons.length < daemonSlots(R)) R.daemons.push(id);
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
  // Bonuses: click one to put it on this matrix (again to take it off); the reward buttons set what it pays.
  // A clicked ICE goes on (or off) this room as a patch of this iteration, then the matrix is dealt again.
  $('modalBox').querySelectorAll<HTMLElement>('[data-ice]').forEach((b) => {
    b.onclick = () => {
      const ice = b.dataset.ice as IceId, mine = (p: Patch) => p.ice === ice && p.room === R.section && p.loop === R.loop;
      R.patches = R.patches.some(mine) ? R.patches.filter((p) => !mine(p)) : [...R.patches, { ice, room: R.section, loop: R.loop }];
      hideResult();
      newMatrix();
    };
  });
  $('modalBox').querySelectorAll<HTMLElement>('[data-bounty]').forEach((b) => {
    b.onclick = () => { const id = b.dataset.bounty as BountyId; M.bounty = M.bounty === id ? undefined : id; refresh(); };
  });
  $('modalBox').querySelectorAll<HTMLElement>('[data-reward]').forEach((b) => {
    // The bonus offers the last two rewards clicked on.
    b.onclick = () => { const r = b.dataset.reward as RewardId; M.rewards = [...M.rewards.filter((x) => x !== r), r].slice(-2); refresh(); };
  });
  $('devCr').onclick = () => { R.credits += 10; refresh(); };
  // Restarts the room: its matrices are dealt anew, its data and item uses (Burner SIM) start over.
  $('devDeal').onclick = () => {
    R.total = (R.total ?? 0) - R.scores[R.section].reduce((a, d) => a + d, 0);
    Object.assign(R, { data: R.carry ?? 0, restarts: R.items.includes('sim') ? 1 : 0 });
    R.scores[R.section] = [];
    hideResult();
    newMatrix();
  };
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
    ? '<p class="meta">' + ds.length + ' daemons · installed ' + R.daemons.length + '/' + daemonSlots(R) + "</p><div class='dlist'>" + ds.map((id, i) => {
      const e = fired.get(id);
      return card(id, i, tag, daemonText(id), e ? fmtEffect(e) : R.daemons.includes(id) ? 'standby' : 'not installed', e ? ' on' : '');
    }).join('') + '</div>'
    : catalogTab === 'items' ? '<p class="meta">' + its.length + ' items · in your deck ' + R.items.length + "</p><div class='wares'>"
      + its.map((id) => ware(id, tag, R.items.includes(id) ? 'in deck' : money(ITEMS[id].price))).join('') + '</div>'
    : catalogTab === 'ice' ? '<p class="meta">' + Object.keys(ICE).length + " ICE rules · the SOC runs one from the company's pool; patches deploy more between iterations, into any room</p>"
      + (Object.keys(ICE) as IceId[]).map((id) => '<' + tag + " class='icebtn' data-ice='" + id + "'>" + iceRule(id, roomIce(R).includes(id) ? 'ICE · in this room' : 'ICE') + '</' + tag + '>').join('')
    : '<p class="meta">' + Object.keys(BOUNTIES).length + ' bonus objectives · one matrix per iteration carries one · meeting it lets you pick 1 of 2 rewards: '
      + Object.values(REWARDS).join(', ') + "</p><div class='blist'>"
      + (Object.keys(BOUNTIES) as BountyId[]).map((id) => '<' + tag + " class='bounty" + (dev && M.bounty === id ? ' met' : '') + "' data-bounty='" + id + "'><span class='bnt'>bonus</span><b>"
        + BOUNTIES[id].name + '</b> ' + BOUNTIES[id].text() + (dev && M.bounty === id ? "<span class='bstate'>on this matrix</span>" : '') + '</' + tag + '>').join('') + '</div>'
      + (dev ? "<p class='meta'>dev · the two rewards this matrix's bonus offers</p><div class='row devbar'>" + (Object.keys(REWARDS) as RewardId[]).map((r) => "<button class='btn' data-reward='" + r + "'"
        + (M.rewards.includes(r) ? " aria-pressed='true'" : '') + '>' + REWARDS[r] + '</button>').join('') + '</div>' : '');
  const devBar = !dev ? '' : "<div class='row devbar'><span>dev · click a card to install or remove it; items apply on the next deal; a bonus goes on this matrix</span>"
    + "<button class='btn' id='devCr'>+$10</button><button class='btn' id='devDeal'>Restart room</button>"
    + (!isBoss(R) || R.loop < LOOPS - 1 ? "<button class='btn' id='devRoom'>" + (isBoss(R) ? 'Next iteration' : 'Next room') + '</button>' : '') + '</div>';
  showResult(true, "<h2>Catalog</h2><div class='tabs'>" + tab('daemons') + tab('items') + tab('bonuses') + tab('ice') + '</div>'
    + "<div class='catbody'>" + devBar + body + "</div><div class='row'><button class='btn' id='closeCatalog'>Close</button></div>");
  tilt($('modalBox'));
  for (const t of ['daemons', 'items', 'bonuses', 'ice'] as const) $('tab-' + t).onclick = () => { catalogTab = t; showCatalog(); };
  if (dev) wireDev(ds, its);
  const close = () => { hideResult(); focusGrid(); };
  $('closeCatalog').onclick = close;
  $('modal').onkeydown = (e) => { if (e.key === 'Escape') close(); };
}

// After a matrix: the room goes on. Its progress dots, the bill and the matrix's small print.
const why = () => (endWhy ? "<p class='meta'>auto-disconnect · " + endWhy + '</p>' : '');
const small = (sc: Score) => "<p class='meta fine'>time " + fmt(S.elapsed) + ' · buffer ' + S.run.buffer.length + '/' + S.puzzle.l
  + ' · ×' + num((1 + sc.boost) * sc.mult) + '</p>';
function matrixSummary(bill: Score, credits: string) {
  const sec = sections(R)[R.section], n = played(R);
  const dots = Array.from({ length: sec.matrices }, (_, j) => (j < n ? '●' : '○')).join('');
  return "<p class='meta'>" + sec.name + ' · matrix ' + n + '/' + sec.matrices + " <span class='dots'>" + dots + '</span> · still in this room</p>'
    + '<h2>+' + bill.total + ' data</h2>' + why() + billHtml(bill) + small(bill)
    + "<p class='tallyline'>" + sec.name + ' <b>' + R.data + '</b> / ' + quota(R) + '</p>' + credits;
}

// After a room's last matrix: every matrix it banked, the sum against the quota, then the way out.
function roomSummary(bill: Score, credits: string) {
  const sec = sections(R)[R.section], goal = quota(R);
  const rows = R.scores[R.section].map((d, j) => '<tr><td>matrix ' + (j + 1) + "</td><td><span class='vd'>" + d + '</span></td></tr>').join('');
  return "<div class='roomsum'><p class='meta'>" + COMPANIES[R.company].name + ' · run ' + (R.loop + 1) + '/' + LOOPS + '</p><h2>' + sec.name + ' breached</h2>' + why()
    + "<p class='meta'>last matrix</p>" + billHtml(bill) + small(bill)
    + "<table class='calc'>" + rows + "<tr class='sum'><td>room</td><td><b>" + R.data + '</b> / ' + goal + (R.data > goal ? ' <small>+' + (R.data - goal) + ' over</small>' : '')
    + '</td></tr></table>' + credits + '</div>';
}

// End of the run, won or lost: rooms by iteration, totals, the build, and the company record.
function runSummary(won: boolean, bill: Score, credits: string) {
  const co = COMPANIES[R.company], total = R.total ?? 0, ms = R.ms ?? 0;
  const prev = bestRun(co.id), fresh = recordBest(co.id, { data: total, ms, won });
  // ×quota per room shows where the run was loose or tight.
  const rows = (R.log ?? []).map(([loop, room, data]) => {
    const goal = Math.round(co.sections[room].quota * QUOTA_GROWTH ** loop);
    return '<tr><td>run ' + (loop + 1) + ' · ' + co.sections[room].name + "</td><td><span class='vd'>" + data + '</span> / ' + goal + ' <small>×' + (data / goal).toFixed(2) + '</small></td></tr>';
  }).join('');
  const build = [...R.daemons.map(dmnName), ...R.items.map((id) => "<span class='gname'>" + ITEMS[id].name + ' v' + ITEMS[id].ver + '</span>')].join(' · ');
  return "<div class='roomsum'><p class='meta'>" + co.name + ' · run ' + (R.loop + 1) + '/' + LOOPS + '</p><h2>' + (won ? co.name + ' breached' : 'Run over') + '</h2>' + why()
    + "<p class='meta'>last matrix</p>" + billHtml(bill) + small(bill)
    + "<table class='calc'>" + rows + "<tr class='sum'><td>total</td><td><b>" + total + '</b> data · ' + fmt(ms) + '</td></tr>'
    + '<tr><td>best matrix</td><td>' + (R.best ?? 0) + '</td></tr></table>'
    + (build ? "<p class='meta'>build · " + build + '</p>' : '')
    + "<p class='iceRule" + (fresh ? ' unlock' : '') + "'><b>" + (fresh ? 'New record' : 'Record') + '</b> '
    + (fresh ? (prev ? 'previous ' + prev.data + ' data · ' + fmt(prev.ms) : 'first run on this contract') : prev ? prev.data + ' data · ' + fmt(prev.ms) : '') + '</p>'
    + credits + '</div>';
}

// Contract stepper: rooms in order, one box per matrix with the score it banked; the live box is the matrix in play.
function renderSteps() {
  const live = S.over ? null : scoreMatrix(runCtx(), R).total;
  const co = COMPANIES[R.company];
  const bonusRooms = bountySpots(R).filter(([i, j]) => i < R.section || (i === R.section && j <= played(R))).map(([i]) => i);
  $('stepList').innerHTML = "<div class='coTag'>" + logo(co.id) + '<span>' + co.name + '<small>run ' + (R.loop + 1) + '/' + LOOPS + (co.always ? ' · every room: ' + iceTags(co.always) : '') + '</small></span></div>'
    + sections(R).map((sec, i) => {
    const got = R.scores[i];
    const state = i < R.section ? 'done' : i === R.section ? 'now' : '';
    const boxes = Array.from({ length: sec.matrices }, (_, j) => {
      if (j < got.length) return "<span class='box " + (got[j] ? 'ok' : 'zero') + "'>" + got[j] + '</span>';
      return i === R.section && j === got.length && live !== null ? "<span class='box live'>" + (live || '··') + '</span>' : "<span class='box'></span>";
    }).join('');
    const total = i === R.section ? R.data + (live ?? 0) : got.reduce((a, b) => a + b, 0);
    return "<div class='step " + state + "'><span class='sname'>" + sec.name + ' ' + iceTags(shownIce(i)) + (bonusRooms.includes(i) ? " <span class='bnt off'>bonus</span>" : '') + "</span><span class='squota'>"
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
  + sc.ice.map(([id, e]) => "<tr><td><i class='iceTag'>" + ICE[id].name + '</i></td><td>' + fmtEffect(e) + '</td></tr>').join('')
  + (sc.charge ? '<tr><td>×2 data charge</td><td>' + fmtEffect({ mult: 2 }) + '</td></tr>' : '')
  + "<tr class='sum'><td>matrix</td><td>" + scoreHtml(sc) + '</td></tr></table>';


// Between iterations: what the company patched; the room it went to shows once you get there.
function showPatch(p: Patch) {
  checkpoint('patch', p);
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
  const mod = (id: ItemId) => '<' + (shop ? "button data-sell='" + id + "'" : 'span') + " class='chip mod' data-tip='" + ITEMS[id].text + "'>" + gear(id) + '<b>'
    + ITEMS[id].name + ' <small>v' + ITEMS[id].ver + '</small></b>' + (shop ? "<i class='sell'>sell · " + money(sellValue(id)) + '</i></button>' : '</span>');
  return "<div class='owned'><p class='meta'>your daemons · " + R.daemons.length + '/' + daemonSlots(R) + "</p><div class='dlist'>"
    + (R.daemons.map((id, i) => card(id, i, 'div', daemonText(id), dfoot(id))).join('') || "<span class='chip none'>no daemons yet</span>")
    + "</div><p class='meta'>your rack · " + R.items.length + '/' + R.rack + ' slots' + (shop && R.items.length ? ' · click a module to sell it' : '') + "</p><div class='chips'>" + (R.items.map(mod).join('') || "<span class='chip none'>no modules yet</span>") + '</div></div>';
};

function showOffer() {
  offer = offerDaemons(R);
  if (!offer.length) return showShop();
  checkpoint('offer');
  const full = R.daemons.length >= daemonSlots(R);
  const poor = full && R.credits < SWAP_COST;
  showResult(true, '<h2>Choose a daemon</h2><p class="meta">' + (full ? 'Slots full · swapping one in costs ' + money(SWAP_COST) + ' · credits ' + money(R.credits)
    : 'Free to take · slots ' + R.daemons.length + '/' + daemonSlots(R)) + '</p>' + owned()
    + "<div class='dlist' id='offerList'>" + offer.map((id, i) => card(id, i, 'button', (i === 0 && R.legendOffer ? "<span class='bnt'>bonus</span> " : '') + DAEMONS[id].text, !full ? 'install ›' : poor ? 'need ' + money(SWAP_COST) : 'swap in · ' + money(SWAP_COST), ' reveal' + (poor ? ' poor' : ''))).join('') + '</div>'
    + "<div class='row'><button class='btn' id='skipDaemon'>Skip · take none</button></div>");
  $('offerList').querySelectorAll<HTMLElement>('.dcard').forEach((b, i) => {
    b.onclick = () => { if (!full) { R.daemons.push(offer[i]); showShop(); } else if (!poor) showSwap(offer[i]); };
  });
  $('skipDaemon').onclick = () => showShop();
  tilt($('modalBox'));
}

// Shop between rooms: a seeded shelf of items, a paid reroll and paid daemon removal; Continue opens the next room.
function showShop(restock = true) {
  if (restock) { stockShop(R); R.legendOffer = false; } // the offer before the shop used it
  checkpoint('shop');
  const cr = (n: number) => money(n);
  const off = (n: number) => (R.credits < n ? ' disabled' : '');
  showResult(true, "<h2>Black market</h2><p class='meta'>credits " + money(R.credits) + (bonusCash() ? " <span class='bnt'>bonus</span> incl. " + money(bonusCash(), '+') : '')
    + (R.charges ? " · <span class='bnt'>bonus</span> ×2 data charge ×" + R.charges : '') + ' · items stay for the whole run</p>' + owned(true)
    + "<div class='wares'>" + (R.shelf.map((id) => ware(id, 'button', cr(ITEMS[id].price) + (rackFull(R, id) ? ' · rack full' : ''),
      R.credits < ITEMS[id].price || rackFull(R, id) ? ' poor' : '')).join('')
      || "<div class='dslot empty'>sold out</div>") + "</div><div class='row'>"
    + (R.rack < RACK_MAX ? "<button class='btn' id='buySlot'" + off(slotCost(R)) + '>Rack slot +1 · ' + cr(slotCost(R)) + '</button>' : '')
    + (forSale(R).length > R.shelf.length ? "<button class='btn' id='reroll'" + (R.freeRerolls ? "><span class='bnt'>bonus</span> Reroll · free ×" + R.freeRerolls : off(REROLL_COST) + '>Reroll · ' + cr(REROLL_COST)) + '</button>' : '')
    + "<button class='btn' id='leaveShop'>Continue ›</button></div>");
  $('modalBox').querySelectorAll<HTMLElement>('.ware').forEach((b, i) => {
    b.onclick = () => { if (buy(R, R.shelf[i])) showShop(false); };
  });
  document.getElementById('reroll')?.addEventListener('click', () => { if (stockShop(R, true)) showShop(false); });
  document.getElementById('buySlot')?.addEventListener('click', () => { if (buySlot(R)) showShop(false); });
  $('modalBox').querySelectorAll<HTMLElement>('[data-sell]').forEach((b) => {
    b.onclick = () => { const id = b.dataset.sell as ItemId; if (id === 'socket' && R.daemons.length > DAEMON_SLOTS) showDrop(); else if (sell(R, id)) showShop(false); };
  });
  $('leaveShop').onclick = () => { R.bonus = []; enterSection(); };
  tilt($('modalBox'));
}

// Selling the Co-processor with every slot full: pick the daemon that goes with it.
function showDrop() {
  showResult(true, '<h2>Drop a daemon</h2><p class="meta">The Co-processor takes a slot with it · sells for ' + money(sellValue('socket')) + ' · dropping is free</p>'
    + "<div class='dlist'>" + R.daemons.map((d, i) => card(d, i, 'button', daemonText(d), 'drop ›')).join('')
    + "</div><div class='row'><button class='btn' id='backShop'>Back</button></div>");
  $('modalBox').querySelectorAll<HTMLElement>('.dcard').forEach((b, i) => { b.onclick = () => { if (sell(R, 'socket', R.daemons[i])) showShop(false); }; });
  $('backShop').onclick = () => showShop(false);
  tilt($('modalBox'));
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
// Company-wide ICE shows next to the company name instead.
const shownIce = (i: number) => roomIce(R, i).filter((id) => !COMPANIES[R.company].always?.includes(id) && ((id === R.ice && i === sections(R).length - 1)
  || sections(R)[i].ice?.includes(id)
  || R.patches.some((p) => p.ice === id && p.room === i && p.loop <= R.loop && revealed(R, p))));
const burnText = (n: number) => (n === Infinity ? 'locks for good' : 'locks for ' + n + (n > 1 ? ' moves' : ' move'));
const iceRule = (id: IceId, tag = 'ICE') => "<p class='iceRule'><b>" + tag + ' · ' + ICE[id].name + '</b> ' + ICE[id].text
  + (id === 'corruption' && burnOf(R) ? ' · now ' + burnText(burnOf(R)) : '') + '</p>';
// fresh: ICE shown in bold (new in this company).
const iceTags = (ids: IceId[], fresh: IceId[] = []) => ids.map((id) => "<i class='iceTag" + (fresh.includes(id) ? ' new' : '') + "' tabindex='0' data-tip='"
  + ICE[id].text + "'>" + ICE[id].name + '</i>').join("<span class='isep'>;</span> ");

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
  const best = co && bestRun(co.id);
  const front = co ? face('front', won + logo(co.id) + '<b>' + co.name + '</b><p>' + co.text + '</p>'
    + (best ? "<span class='fbest'>best " + best.data + ' data · ' + fmt(best.ms) + '</span>' : '') + (isOpen(i) ? "<span class='fhint'>details ›</span>" : lock))
    : face('front', logo() + '<b>??? ????????</b><p>Classified. Breach the previous contract to unlock.</p>');
  // ICE the previous company did not have.
  const prev = COMPANIES[i - 1], fresh = co && prev ? [...co.ice, ...co.patches].filter((id) => !prev.ice.includes(id) && !prev.patches.includes(id)) : [];
  const back = co ? face('back', '<b>' + co.name + "</b><table class='frooms'><tr><th>room</th><th>size</th><th>matrices</th><th>quota</th></tr>"
    + co.sections.map((s) => '<tr><td>' + s.name + (s.ice ? ' ' + iceTags(s.ice) : '') + '</td><td>' + s.size.n + '×' + s.size.n + '</td><td>' + s.matrices + '</td><td>' + s.quota + '</td></tr>').join('')
    + "</table><p class='meta'>" + LOOPS + ' iterations, quotas ×' + QUOTA_GROWTH + ' each</p>'
    + (co.always ? "<p class='meta'>in every room:<br>" + iceTags(co.always) + '</p>' : '')
    + "<p class='meta'>boss ICE, one per run:<br>" + iceTags(co.ice, fresh) + '</p>' + "<p class='meta'>patches between iterations:<br>" + iceTags(co.patches, fresh) + '</p>'
    + (fresh.length ? "<p class='meta'><span class='newkey'>bold</span> = new in this contract</p>" : '') + (isOpen(i) ? '' : lock)) : '';
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
    + "<button class='btn' id='briefing'><span class='ibadge' aria-hidden='true'>i</span>Briefing</button><button class='btn' id='closeFirms'>Close</button><button class='btn go' id='startFirm'>Start contract ›</button></div>");
  document.getElementById('devUnlock')?.addEventListener('click', () => {
    setBreached(breached().length ? [] : COMPANIES.map((c) => c.id));
    showCompanies(seed, back);
  });
  const close = () => setMode(back === 'run' ? 'daily' : back);
  $('closeFirms').onclick = close;
  $('briefing').onclick = () => showBriefing(seed, back);
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

const newMatrix = () => { dealMatrix(); checkpoint('matrix'); };

function disconnect() {
  logAct({ d: 1 });
  finish(score(S.run.buffer, S.puzzle.targets), true);
  render();
}

// First visit to run mode: what a run is, before the company carousel.
const BRIEFED = 'bypass:briefed';
function showBriefing(seed: number, back: Mode) {
  R = newRunState(seed);
  dealMatrix();
  showResult(true, "<p class='meta'>3:run · contract mode</p><h2>Briefing</h2><div class='brief'>" + hacker + '<div>'
    + "<p>You're a pentester: the good kind of hacker. Companies hire you to break in before someone worse does.</p>"
    + '<p>Each contract is a building. Breach it room by room, hitting every data quota, up to the <b>SOC</b>, where security waits with its ICE.</p>'
    + '<p>Clear the SOC and the company patches up and tries to stop you again: higher quotas, new ICE. Get through <b>' + LOOPS
    + ' iterations</b> and it is breached, and the next contract opens.</p>'
    + "<p class='meta'>Between rooms pick daemons and buy hardware. The late rooms are out of reach without a build.</p>"
    + "</div></div><div class='row'><button class='btn' id='closeBrief'>Close</button><button class='btn go' id='toTargets'>Show targets ›</button></div>");
  const close = () => setMode(back === 'run' ? 'daily' : back);
  $('closeBrief').onclick = close;
  $('toTargets').onclick = () => { save(BRIEFED, true); showCompanies(seed, back); };
  $('modal').onkeydown = (e) => { if (e.key === 'Escape') close(); };
  $('toTargets').focus();
  hackerFx($('modalBox').querySelector<SVGGElement>('.hk-fx')!);
}

// Codes rise off the laptop's corners at a steady beat, sides taking turns, and drift outward around the face, now and then
// glitching; stops once the art is gone.
function hackerFx(fx: SVGGElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const any = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
  // at: how far into its flight a code starts, so the first ones are already up when the briefing opens.
  let n = 0;
  const spawn = (at = 0) => {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('class', 'hk-hex');
    const side = n++ % 2 ? 1 : -1; // left or right of the face, never across it
    t.setAttribute('x', String(100 + side * rnd(30, 42) - 6));
    t.setAttribute('y', '150');
    t.textContent = any(CODES);
    fx.appendChild(t);
    // Narrow speed range so codes on one side don't catch up and overlap.
    const dx = side * rnd(30, 50), dy = rnd(-105, -125), ms = rnd(5200, 5800), o = rnd(0.75, 1);
    const a = t.animate([{ transform: 'translate(0,0)', opacity: 0 }, { opacity: o, offset: 0.12 }, { opacity: o, offset: 0.7 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px)', opacity: 0 }], { duration: ms, easing: 'ease-out' });
    a.currentTime = at * ms;
    a.onfinish = () => t.remove();
  };
  // Every 8 ticks (~0.9 s) a new code; the opening ones are spread over the same beat, already in flight.
  for (let i = 6; i > 0; i--) spawn((i * 8 * 110) / 5500);
  let tick = 0;
  const id = setInterval(() => {
    if (!fx.isConnected) return clearInterval(id);
    if (++tick % 8 === 0) spawn();
    // Glitch: a random live code flips to another code, turns pink and jumps aside for a beat.
    const live = fx.children;
    if (live.length && Math.random() < 0.25) {
      const t = any([...live]) as SVGTextElement, code = t.textContent!;
      t.textContent = any(CODES);
      t.classList.add('glitch');
      t.setAttribute('dx', String(rnd(-4, 4)));
      setTimeout(() => { t.textContent = code; t.classList.remove('glitch'); t.removeAttribute('dx'); }, rnd(60, 160));
    }
  }, 110);
}

// Entering run mode with a saved run: resume it, or abandon it for the company carousel.
function showResume(sv: SavedRun, seed: number, back: Mode) {
  R = structuredClone(sv.R);
  R.matrix = -1; // a throwaway board behind the dialog, not the saved one
  dealMatrix();
  const rooms = sections(R);
  showResult(true, "<p class='meta'>saved run</p><h2>Resume contract</h2><p>" + COMPANIES[R.company].name + ' · iteration ' + (R.loop + 1) + '/' + LOOPS
    + ' · ' + rooms[R.section].name + ' ' + (R.section + 1) + '/' + rooms.length + "</p><p class='meta'>credits " + money(R.credits) + '</p>' + owned()
    + "<div class='row'><button class='btn' id='closeResume'>Close</button><button class='btn' id='abandonRun'>Abandon</button>"
    + "<button class='btn go' id='resumeRun'>Resume ›</button></div>");
  const close = () => setMode(back === 'run' ? 'daily' : back);
  $('closeResume').onclick = close;
  $('abandonRun').onclick = () => { endSave(); showCompanies(seed, back); };
  $('resumeRun').onclick = () => {
    try { resumeRun(sv); } catch { endSave(); showCompanies(seed, back); }
  };
  $('modal').onkeydown = (e) => { if (e.key === 'Escape') close(); };
  $('resumeRun').focus();
}

function resumeRun(sv: SavedRun) {
  R = structuredClone(sv.R);
  if (sv.screen === 'intro') { R.matrix--; return enterSection(); }
  if (sv.screen !== 'matrix') {
    const keep = R.matrix;
    R.matrix = -1;
    dealMatrix();
    R.matrix = keep;
    return sv.screen === 'patch' ? showPatch(sv.patch!) : sv.screen === 'offer' ? showOffer() : showShop(false);
  }
  R.matrix--; // the checkpoint was taken after the deal
  dealMatrix();
  cur = sv;
  replaying = true;
  S.dealing = false;
  try {
    for (const a of sv.log) {
      if ('r' in a) { armed = a.t ?? null; choose(a.r, a.c); } else if ('s' in a) doSplit(a.s, a.at); else if ('w' in a) doRewind(); else if ('x' in a) useCharge(); else disconnect();
    }
  } finally { replaying = false; }
}

// Section intro: the route so far, then the room's brief and terms; the matrix pours in on Breach.
function enterSection() {
  dealMatrix();
  checkpoint('intro');
  const rooms = sections(R);
  const sec = rooms[R.section];
  const at = (i: number) => (i < R.section ? ' done' : i === R.section ? ' now' : '');
  const route = rooms.map((s, i) => (i ? "<i class='link" + at(i) + "'></i>" : '') + "<span class='node" + at(i) + "'>" + s.name + '</span>').join('');
  showResult(true, "<p class='meta'>" + COMPANIES[R.company].name + ' · iteration ' + (R.loop + 1) + '/' + LOOPS + ' · section ' + (R.section + 1) + '/' + rooms.length + '</p><h2>' + sec.name + "</h2><div class='route'>"
    + route + '</div><p>' + sec.brief + "</p><p class='meta'>" + sec.size.n + '×' + sec.size.n + ' · ' + sec.matrices
    + (sec.matrices > 1 ? ' matrices' : ' matrix') + ' · quota ' + quota(R) + ' data</p>'
    + roomIce(R).map((id) => iceRule(id, R.patches.some((p) => p.ice === id && p.room === R.section && p.loop === R.loop) ? 'PATCHED' : 'ICE')).join('')
    + "<div class='row'><button class='btn' id='breach'>Breach ›</button></div>");
  $('breach').onclick = () => {
    if (cur) { cur.screen = 'matrix'; saveRun(cur); }
    hideResult();
    pour();
  };
}

function dealMatrix() {
  // Company look: its logo as a watermark under the matrix, its motif behind the contract.
  $('wmark').innerHTML = logo(COMPANIES[R.company].id);
  $('steps').dataset.co = COMPANIES[R.company].id;
  $('meta').textContent = 'Run ' + (R.loop + 1) + '/' + LOOPS + ' · ' + sections(R)[R.section].name + ' ' + (R.section + 1) + '/' + sections(R).length;
  ({ puzzle: S.puzzle, m: M } = dealBoard(stageSeed(R.seed, R.matrix++), R));
  tOrder = [];
  armed = null;
  resetRun();
  if (M.bounty && R.matrix > 0) bonusIntro(M.bounty); // not on the throwaway board behind the resume dialog
}

// A bonus matrix opens with its objective flashed over the matrix; the banner glitches in, holds, and fades out.
function bonusIntro(id: BountyId) {
  const pane = $('grid').closest('.pane')!;
  pane.querySelector('.bintro')?.remove();
  pane.insertAdjacentHTML('beforeend', "<div class='bintro' aria-live='polite'><span class='bnt'>bonus objective</span><b>" + BOUNTIES[id].name
    + '</b><p>' + BOUNTIES[id].text(runCtx()) + "</p><small>reward: pick 1 of 2 once the matrix is over</small><button class='btn'>Got it</button></div>");
  const el = pane.querySelector<HTMLElement>('.bintro')!;
  el.onclick = () => el.remove();
}

function doRewind() {
  if (!rewind(B())) return;
  logAct({ w: 1 });
  render();
}

function doSplit(i: number, at?: number) {
  logAct({ s: i, at });
  ({ targets: S.puzzle.targets, worth: M.worth } = splitTarget(S.puzzle.targets, M.worth, i, at));
  M.split = false;
  M.tools = true;
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
      ...(cellView(B(), cursor[0], cursor[1]).tags.includes('node') ? [{ name: 'data node', add: '+' + nodeData(R.items), kind: 'data' as const }] : []),
      ...(R.daemons.includes('rotate') && !S.run.path.length
        ? [{ id: 'rotate' as const, name: 'rotate', now: rot ? String(CRON_DATA * rot) : undefined, kind: 'data' as const,
          ...(cursor[1] === R.lastStart ? { add: '→ 0', note: 'same column' } : { add: '+' + CRON_DATA }) }] : [])];
  // Name in the daemon's family colour; numbers in their own colours: data blue, boost and multipliers pink.
  $('peek').innerHTML = peek.map((p) => {
    if (typeof p === 'string') return p;
    const v = p.kind === 'data' ? 'vd' : 'vm', loss = p.add.startsWith('→');
    return (p.id ? "<span class='pname c-" + DAEMONS[p.id].family.toLowerCase() + "'>" + p.name + '</span>' : "<span class='gname'>" + p.name + '</span>')
      + (p.now ? ' <span class=\'' + v + (loss ? ' gone' : '') + "'>" + p.now + '</span>' : '')
      + " <b class='" + v + (loss ? '' : ' add') + "'>" + p.add + '</b>' + (p.note ? " <span class='note'>" + p.note + '</span>' : '');
  }).join(' · ');
  // Echo the code under the cursor in the codes targets still need: solid for a pick open right now, dotted for a
  // free cell off the lane (planning ahead) or a code already hit in an unfinished target. Done and failed targets stay quiet.
  const code = cursor && !S.over && !blackout() && !encrypted(cursor[0], cursor[1]) ? S.puzzle.grid[cursor[0]]?.[cursor[1]] : undefined;
  const open = !!code && code !== BLOCK && !isUsed(cursor![0], cursor![1]) && !burning(S.run, cursor![0], cursor![1]);
  const now = !!cursor && legal(cursor[0], cursor[1]);
  const run = S.mode === 'run'; // the other modes keep the plain echo
  document.querySelectorAll<HTMLElement>('#targets .codes span').forEach((s) => {
    const hit = s.classList.contains('hit');
    const m = !!code && (run ? (open || now) && !s.closest('.fail, .done') : now && !hit) && fits(code, s.textContent ?? '');
    s.classList.toggle('peek', m && now && !hit);
    s.classList.toggle('far', m && (!now || hit));
  });
}

// Pointing at a target code outlines the free cells holding it; those in the current lane stand out.
function markCode(code?: string) {
  const bd = B(), dark = isBlackout(bd);
  document.querySelectorAll<HTMLElement>('#grid .cell').forEach((el) => {
    const r = +el.id[1], c = +el.id[2], g = S.puzzle.grid[r][c];
    const on = !!code && S.mode === 'run' && !S.over && !dark && !isEncrypted(bd, r, c) && g !== BLOCK && !isUsed(r, c) && !burning(S.run, r, c) && fits(g, code);
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
  logAct(armed ? { r, c, t: armed } : { r, c });
  const bd = B();
  const placed = applyPick(bd, r, c) === 'placed';
  armed = bd.armed;
  if (placed) return render();
  document.querySelector('.bintro')?.remove();
  if (!S.start) { S.start = S.stageStart = Date.now(); S.timer = window.setInterval(tick, 31); }
  // A dead end ends the round right away.
  const stuck = isStuck(bd, S.mode === 'run');
  const more = hasMoves(bd);
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

// Burner SIM: a spent ×2 charge goes back, the matrix is dealt again.
function burnSim() {
  if (M.charge) R.charges = (R.charges ?? 0) + 1;
  restartMatrix(R);
  newMatrix();
}

function useCharge() {
  if (M.charge || !R.charges || S.over) return;
  R.charges--;
  M.charge = true;
  logAct({ x: 1 });
  render();
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
    R.ms = (R.ms ?? 0) + S.elapsed;
    const { score: bill, met, out } = finishMatrix(R, runCtx(), disconnected);
    lastBill = bill;
    if (out === 'win' || out === 'lose') endSave();
    const co = COMPANIES[R.company], next = COMPANIES[R.company + 1];
    const line = ([why, n]: [string, number]) => "<p class='meta'>" + (n ? money(n, '+') + ' · ' : '') + why + '</p>';
    // A met bonus waits on the summary until its reward is rolled; the way on stays locked until then.
    const claim = met && (out === 'continue' || out === 'section' || out === 'loop');
    const bonus = !M.bounty ? '' : claim
      ? "<div class='bounty met breward'><span class='bnt'>bonus met</span><b>" + BOUNTIES[M.bounty].name + "</b> <span class='bstate' id='reel'>reward ???</span>"
        + "<button class='btn' id='claim'>Roll reward</button></div>"
      : "<p class='meta'>bonus " + (met ? 'met' : 'missed') + ' · ' + BOUNTIES[M.bounty].name + '</p>';
    const credits = R.earned.map(line).join('') + bonus
      + (out === 'win' && recordBreach(co.id) && next ? "<p class='iceRule unlock'><b>Unlocked · " + next.name + '</b> ' + next.text + '</p>' : '');
    const btn = (id: string, label: string, cls = 'go') => "<div class='row'><button class='btn' id='viewMatrix'>View matrix</button><button class='btn " + cls + "' id='" + id + "'" + (claim ? ' disabled' : '') + '>' + label + '</button></div>';
    showResult(out !== 'lose' && (out !== 'continue' || bill.total > 0), out === 'continue'
      ? matrixSummary(bill, credits) + btn('runNext', 'Next matrix ›')
      : out === 'section' || out === 'loop' ? roomSummary(bill, credits) + btn(out === 'loop' ? 'runLoop' : 'runSection', out === 'loop' ? 'Patch notes ›' : 'Exit room ›', 'go exit')
        : runSummary(out === 'win', bill, credits) + btn('runNew', 'New run'));
    if (claim) $('claim').onclick = () => rollReward(M.bounty!, M.rewards);
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

// The reel runs through the rewards and lands on the two the matrix seed drew; the player takes one, which pays it and
// frees the way on.
function rollReward(bounty: BountyId, picks: RewardId[]) {
  const btn = $('claim') as HTMLButtonElement, reel = $('reel'), names = Object.values(REWARDS);
  btn.disabled = true;
  let k = 0;
  const spin = setInterval(() => { reel.textContent = names[k++ % names.length]; }, 70);
  setTimeout(() => {
    clearInterval(spin);
    reel.textContent = 'pick one';
    btn.outerHTML = "<span class='bpicks'>" + picks.map((p) => "<button class='btn' data-pick='" + p + "'>" + REWARDS[p] + '</button>').join('') + '</span>';
    $('modalBox').querySelectorAll<HTMLElement>('[data-pick]').forEach((b) => {
      b.onclick = () => {
        reel.textContent = REWARDS[claimReward(R, bounty, b.dataset.pick as RewardId)];
        $('modalBox').querySelector('.bpicks')?.remove();
        $('modalBox').querySelectorAll<HTMLButtonElement>('.row .btn').forEach((x) => { x.disabled = false; });
      };
    });
  }, 1200);
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
  on('runNext', newMatrix);
  on('runSection', () => { nextSection(R); showOffer(); });
  on('runLoop', () => showPatch(nextSection(R)!));
  on('runNew', () => setMode('run'));
  on('viewMatrix', peek);
  on('toTrain', () => setMode('train'));
  on('sprintAgain', () => setMode('sprint'));
  on('retrySprint', () => setMode('sprint', S.seed, S.challenge));
  wireCopy('share', () => $('shareTxt').textContent ?? '');
}

// The summary steps aside to show the finished matrix; a click or Esc brings it back.
function peek() {
  const m = $('modal');
  m.classList.add('peek');
  $('grid').scrollIntoView({ block: 'center' });
  const back = () => { m.classList.remove('peek'); m.removeEventListener('click', back); removeEventListener('keydown', esc); $('viewMatrix').focus(); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') back(); };
  setTimeout(() => { m.addEventListener('click', back); addEventListener('keydown', esc); });
}

function hideResult() {
  $('modal').classList.remove('peek');
  $('result').hidden = $('modal').hidden = true;
  $('app').inert = false;
  $('modal').onkeydown = null; // Esc closes only the catalog
}

function resetRun() {
  clearInterval(S.timer);
  Object.assign(S, { run: S.mode === 'run' ? startRun(R) : newRun(), start: 0, elapsed: 0, over: false, stage: 0, dealing: false });
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
    const sv = loadRun<SavedRun>();
    try {
      if (sv?.v !== RUN_V) throw 0;
      showResume(sv, seed, back);
    } catch {
      if (sv) dropRun();
      if (load(BRIEFED)) showCompanies(seed, back); else showBriefing(seed, back);
    }
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
  $('exportSave').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportBackup()], { type: 'application/json' }));
    a.download = 'bypass-backup-' + utcDate() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('importSave').onclick = () => $('importFile').click();
  $('importFile').onchange = async () => {
    const input = $('importFile') as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const data = parseBackup(await f.text());
    if (!data) return alert('This is not a Bypass save file.');
    if (!confirm('Replace your current progress with this save?')) return;
    if (restoreBackup(data)) location.reload(); else alert('Could not write the save.');
  };
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
