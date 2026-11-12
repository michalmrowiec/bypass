import { BLOCK, CODES, generate, hashStr, SIZES, type Puzzle, type SizeKey } from './generator';
import {
  MAX_TRIES, SPRINTS, type ChallengeKind, type SprintLen, challengeQuery, isFinished, newRun, parseChallenge, score,
  stageSeed, targetProgress, WILD, fits, inLane, nextLane, burning, pairOf, partner,
} from './game';
import { gear, DATA_PATHS } from './gear';
import { hacker, logo } from './logos';
import {
  applyPick, canPick, cellView, ctxOf, dealBoard, hasMoves, isStuck, jumpAny, jumpReady, loopAny, loopReady, muxReady, rewind, startRun, EMPTY_CTX, emptyItems, isBlackout, isDoorOpen, isEncrypted, TOOLS, type Board, type ItemState, type Tool,
} from './matrix';
import {
  buy, canExitRoom, exitRoom, EXIT_CREDIT, coverage, ROTATE_DATA, thumbData, prioId, firstTarget, PRIO_MULT, played, DAEMON_SLOTS, daemonSlots, DAEMONS, DC_SLOTS_PER_CREDIT, DATA_BY_LEN, finishMatrix, forSale, ITEMS, movePreview, newRunState, nextSection,
  burnOf, COMPANIES, companyOpen, isBoss, LOOPS, PATCH_COVER, PATCH_DOUBLE, overtimeCarry, quota, QUOTA_GROWTH, revealed, roomIce, sections, ICE, nodeData, offerDaemons, rerollCost, swapCost, swapDaemon, scopeOf, streakOf, rarityOf, BOUNTIES, bountySpots, bountyMet, claimReward, BOUNTY_STACKS, REWARDS, type BountyId, type RewardId, restartMatrix, RACK_MAX, slotCost, rackFull, sellValue, olderVersions, sell, buySlot, scoreMatrix, sectionMatrix, splitTarget, canSplit, SPLIT_MIN, stockShop,
  logEvent, dmnFile, bonusKey, type Company, type Patch, type Preview, type DaemonId, type Effect, type IceId, type ItemId, type MatrixCtx, type RunState, type Score,
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
const RUN_V = 2; // bump when RunState changes shape; older saves are dropped
let cur: SavedRun | null = null, replaying = false;
function checkpoint(screen: RunScreen) {
  cur = { v: RUN_V, R: structuredClone(R), screen, log: [] };
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
const openDaemons = new Set<DaemonId>(); // catalog cards the player clicked open
// One rack unit per item family: a v2.0 replaces its v1.0.
let armed: Tool | null = null; // deck tool picked for use before the first move
// Targets already shown as uploaded, so the upload effect plays only once.
const doneSeen = new Set<number>();
// Cell under the mouse or keyboard focus, for the crosshair highlight.
let cursor: [number, number] | null = null;
// Scratchpad: planned picks, shown as numbered markers and a greyed buffer; the player clicks them out for real.
let plan: [number, number][] = [], planning = false, planRun: unknown = null;
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
// A plan step needs a legal cell and a free buffer slot.
const planOk = (p: Board, r: number, c: number) => p.run.buffer.length < p.puzzle.l && canPick(p, r, c);
// The plan played out on a copy of the board, so ICE, ports, belts and the Repeater follow the game's own rules.
// It is cut at the first pick that is no longer legal; codes still encrypted on the real board stay ?? in it.
function planBoard(): { board: Board; codes: string[] } {
  // A new matrix, a finished one or another mode ends the script and its writing mode.
  if (planRun !== S.run || S.mode !== 'run' || S.over) { plan = []; planRun = S.run; planning = false; stopPlan(); }
  const b = B(), p: Board = { ...b, puzzle: structuredClone(b.puzzle), run: structuredClone(b.run), m: structuredClone(b.m), armed: null };
  const codes: string[] = [];
  let k = 0;
  for (; k < plan.length && planOk(p, ...plan[k]); k++) {
    const [r, c] = plan[k], from = p.run.buffer.length, hidden = cellView(b, r, c).hidden;
    applyPick(p, r, c);
    codes.push(...p.run.buffer.slice(from).map((x) => (hidden ? '??' : x)));
  }
  plan.length = k;
  return { board: p, codes };
}
// ./run: the planned picks one by one, 0.2 s apart; any other action stops it.
let planTimer = 0;
const stopPlan = () => { clearTimeout(planTimer); planTimer = 0; };
function runPlan() {
  stopPlan();
  const step = () => {
    const p = plan[0];
    if (!p || S.over || S.dealing || offer.length || armed || S.mode !== 'run' || !legal(p[0], p[1])) { stopPlan(); render(); return; }
    choose(p[0], p[1]);
    if (plan.length) planTimer = window.setTimeout(step, 200); else { planTimer = 0; render(); }
  };
  step();
}
// Planning a planned cell cuts the plan back to before it.
function planAt(r: number, c: number, at: number) {
  if (at >= 0) plan = plan.slice(0, at); else plan.push([r, c]);
  render();
}
const doorOpen = () => isDoorOpen(B());
const blackout = () => isBlackout(B());
const encrypted = (r: number, c: number) => isEncrypted(B(), r, c);
const randomSeed = () => Math.floor(Math.random() * 1e9);
const addr = (r: number) => '0x' + (r * 16).toString(16).toUpperCase().padStart(2, '0');
// Row and column names; a run company may label them its own way.
const rowName = (r: number) => (S.mode === 'run' && COMPANIES[R.company].rowLabel?.(r)) || addr(r);
const colName = (c: number) => (S.mode === 'run' && COMPANIES[R.company].colLabel?.(c)) || '+' + c;

let beltSeen = 0;
const TAG = { get node() { return "<i class='ntag'>+" + nodeData(R.items) + DI + '</i>'; }, trap: "<i class='ntag ttag'>×.5</i>", rep: "<i class='ntag rtag'>×2</i>" };

function render() {
  const { grid, targets, l } = S.puzzle;
  const n = grid.length, cols = grid[0].length, w = S.puzzle.half;
  const { buffer, axis, idx } = S.run;
  const g = $('grid');
  g.innerHTML = '';
  const pl = planBoard();
  // Port board: the two matrices sit apart, with a narrow gap column between them.
  g.style.gridTemplateColumns = w ? 'auto repeat(' + w + ',minmax(0,1fr)) 10px repeat(' + w + ',minmax(0,1fr))' : 'auto repeat(' + n + ',minmax(0,1fr))';
  const gap = () => { const d = document.createElement('div'); d.setAttribute('aria-hidden', 'true'); g.appendChild(d); };
  const portNo = (r: number, c: number) => pairOf(S.puzzle, r, c) + 1;
  const portTag = (p: number) => [':22', ':80'][p - 1]; // pair name: both ends show the same real port
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
  for (let c = 0; c < cols; c++) {
    if (w && c === w) gap();
    hx(colName(c),free ? c === free[1] : axis === 'col' && c === idx, c === lastCol ? ' cronmark' : '');
  }
  const bd = B();
  // Conveyor: the belt slides only on the render right after a pick.
  const moved = !!S.puzzle.belt && S.run.path.length > 0 && S.run.path.length !== beltSeen;
  beltSeen = S.run.path.length;
  for (let r = 0; r < n; r++) for (let c = 0; c < cols; c++) {
    if (c === 0) hx(rowName(r), free ? r === free[0] : axis === 'row' && r === idx, S.puzzle.belt?.row === r ? ' belt' : '');
    if (w && c === w) gap();
    const b = document.createElement('button');
    b.className = 'cell';
    b.id = 'c' + r + c;
    const v = cellView(bd, r, c);
    b.textContent = v.hidden ? '??' : v.code;
    b.classList.add(...v.cls);
    if (moved && v.cls.includes('belt')) b.classList.add('shift');
    for (const t of v.tags) b.insertAdjacentHTML('beforeend', TAG[t]);
    if (v.paint) b.insertAdjacentHTML('beforeend', "<i class='gtag'>+" + v.paint + '</i>');
    const port = portNo(r, c);
    if (port) {
      b.insertAdjacentHTML('beforeend', "<i class='pframe'></i><i class='pring'></i><i class='ptag'>" + portTag(port) + '</i>');
      b.classList.add('port' + port);
      // Pointing at a port lights it and its partner in the other matrix.
      const [pr, pc] = partner(S.puzzle, r, c)!;
      // ...and plays the pair's ring: in at the one you point at, out at its partner.
      const lit = (on: boolean) => { b.classList.toggle('plink', on); b.classList.toggle('pgo', on); $('c' + pr + pc)?.classList.toggle('plink', on); $('c' + pr + pc)?.classList.toggle('pcome', on); };
      b.onmouseenter = b.onfocus = () => lit(true);
      b.onmouseleave = b.onblur = () => lit(false);
    }
    if (v.burnLeft !== undefined) b.insertAdjacentHTML('beforeend', "<i class='btag'>" + (v.burnLeft === Infinity ? '∞' : v.burnLeft) + '</i>');
    if (!S.dealing && !offer.length && canPick(bd, r, c)) {
      b.classList.add('ok');
      b.setAttribute('aria-label', 'Pick ' + (v.hidden ? 'an encrypted code' : v.code) + (v.tags.includes('trap') ? ' (honeypot)' : '') + (port ? ' (port ' + portTag(port) + ')' : '') + ' at row ' + (r + 1) + ' column ' + (c + 1));
      b.onclick = () => choose(r, c);
    } else {
      b.setAttribute('aria-disabled', 'true');
    }
    const at = plan.findIndex(([pr, pc]) => pr === r && pc === c);
    if (at >= 0) { b.classList.add('planned'); b.insertAdjacentHTML('beforeend', "<i class='pnum'>" + (at + 1) + '</i>'); }
    // Plan mode: clicks plan instead of pick; the lit cells are the plan's next legal ones.
    if (planning && !S.over) {
      const can = at >= 0 || (!S.dealing && !offer.length && planOk(pl.board, r, c));
      b.classList.toggle('ok', can);
      b.onclick = can ? () => planAt(r, c, at) : null;
      if (can) { b.removeAttribute('aria-disabled'); b.setAttribute('aria-label', (at >= 0 ? 'Cut the script at step ' + (at + 1) : 'Script step ' + (plan.length + 1)) + ' at row ' + (r + 1) + ' column ' + (c + 1)); }
      else b.setAttribute('aria-disabled', 'true');
    }
    b.tabIndex = -1;
    g.appendChild(b);
  }
  // A port you can take draws a ring in; its partner, where you come out, sends one out.
  for (const [a, b] of S.puzzle.ports ?? []) for (const [x, y] of [[a, b], [b, a]]) {
    if ($('c' + x[0] + x[1])?.classList.contains('ok')) $('c' + y[0] + y[1])?.classList.add('pin');
  }
  // Roving tabindex: the grid is one Tab stop, arrows move inside it.
  (g.querySelector<HTMLElement>('.cell.ok') ?? g.querySelector<HTMLElement>('.cell')!).tabIndex = 0;
  $('laneLabel').textContent = offer.length ? 'choose a daemon' : armed === 'wild' ? 'place ** on any free cell' : armed === 'split' ? 'cut a target'
    : armed === 'jump' ? 'bridge: pick ' + (jumpAny(B()) ? 'any free cell' : 'a free cell next to your last pick') : armed === 'mux' ? 'mux: pick in the row or column of your last pick' : armed === 'loop' ? 'loopback: pick a used cell' + (loopAny(B()) ? '' : ' in your lane') : S.over ? 'session closed'
    : doorOpen() ? 'pick on any edge' : free ? 'pick in row ' + rowName(free[0]) + ' or col ' + colName(free[1])
    : axis === 'row' ? 'pick in row ' + rowName(idx) + (w ? ' · ' + (S.run.half ? 'B' : 'A') : '') : 'pick in col ' + colName(idx) + (w ? ' · ' + (idx < w ? 'A' : 'B') : '');
  if (S.mode !== 'run') planning = false;
  g.classList.toggle('planning', planning);
  if (planning && !S.over) $('laneLabel').textContent = 'script · ' + (plan.length ? plan.length + (plan.length > 1 ? ' picks' : ' pick') + ' · click a step to cut there' : 'click cells to write a route');
  const pb = $('planBtn');
  pb.hidden = S.over || S.mode !== 'run';
  pb.textContent = planning || !plan.length ? '[ script ]' : '[ script · ' + plan.length + ' ]';
  const go = $('runPlanBtn');
  go.hidden = pb.hidden || planning || !plan.length;
  go.textContent = planTimer ? '[ ^C ]' : '[ ./run ]';
  pb.setAttribute('aria-pressed', String(planning));
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
      + (cover[i] >= 2 ? ' shared' : '') + (has('light') && i === Math.ceil(l / 2) - 1 ? ' half' : '') + (buffer[i] === WILD ? ' wild' : '') + (i === M.kept ? ' kept' : '') + (has('backup') && i === l - 1 ? ' spare' : '');
    if (has('overflow')) s.dataset.bonus = '+.25';
    if (s.classList.contains('extra')) s.dataset.tip = 'Extra slot from your rack';
    if (s.classList.contains('spare')) s.dataset.tip = 'Backup: leave this slot empty to grow the stack; any other ending halves it';
    if (i === M.kept) s.dataset.tip = 'Kept by Rewind: the buffer gained a slot for it';
    s.textContent = buffer[i] ?? '';
    const ghost = buffer[i] === undefined ? pl.codes[i - buffer.length] : undefined;
    if (ghost !== undefined) { s.textContent = ghost; s.classList.add('plan'); }
    buf.appendChild(s);
    if (s.classList.contains('new')) scramble(s, buffer[i], 1, 1, 40);
  }
  const tg = $('targets');
  tg.innerHTML = '';
  if (S.mode !== 'run' || tOrder.length !== targets.length) tOrder = targets.map((_, i) => i);
  // Priority pays its extra share on the first uploaded target only.
  const prio = S.mode === 'run' ? prioId(R.items) : undefined;
  const prioAt = prio ? firstTarget(buffer, targets, M.worth) : -1;
  tOrder.forEach((i) => {
    const t = targets[i];
    const st = targetProgress(buffer, t, l, S.over);
    const el = document.createElement('div');
    // Split, before the first move: v1.0 cuts a clicked target at its random mark, v2.0 at a clicked gap between codes.
    // Under Blackout v1.0 cuts blind (the mark stays hidden); v2.0 still picks its gap between the ?? codes.
    const cut = S.mode === 'run' && armed === 'split' && canSplit(t);
    const gaps = cut && R.items.includes('split2');
    const blind = cut && !gaps && blackout();
    // The plan would upload it (never under Blackout, which hides the targets).
    const planned = !st.done && pl.codes.length > 0 && !blackout() && targetProgress([...buffer, ...pl.codes], t, l, false).done;
    el.className = 'target' + (st.done ? ' done' : st.fail ? ' fail' : '') + (cut ? ' cut' : '') + (planned ? ' planned' : '');
    const worth = S.mode === 'run' ? ' +' + (M.worth[i] ?? DATA_BY_LEN[t.length]) : '';
    // Thumb drive pays per uploaded target, so each one shows its share.
    const thumb = S.mode === 'run' && st.done ? thumbData(R.items) : 0;
    const extra = prio && i === prioAt ? (M.worth[i] ?? DATA_BY_LEN[t.length]) * (PRIO_MULT[prio] - 1) : 0;
    const tag = (extra ? " <span class='thumbtag' data-tip='Priority'>+" + extra + DI + '</span>' : '')
      + (thumb ? " <span class='thumbtag' data-tip='Thumb drive'>+" + thumb + DI + '</span>' : '');
    const state = st.done ? 'Uploaded' + worth + (worth && DI) : st.fail ? 'Failed' : cut ? worth.trim() + DI + ' · ' + (blind ? 'blind cut' : gaps ? 'cut between codes' : 'click to split')
      : worth ? worth.trim() + DI : 'Target ' + (i + 1);
    const mark = cut && !gaps ? M.cuts[i] : 0;
    el.innerHTML = '<div class="codes">' + t.map((c, j) => (gaps && j ? "<button class='gap' data-at='" + j + "' aria-label='Cut before " + c + "'></button>"
      : j && j === mark && !blind ? "<i class='gap mark'></i>" : '')
      + '<span class="' + (j < st.k ? 'hit' : '') + (c === WILD ? ' wild' : '') + '">' + (blackout() ? '??' : c) + '</span>').join('') + '</div><div class="state"><span class="stxt">' + state + '</span>' + tag + (planned ? "<span class='plantag'>script ✓</span>" : '') + '</div>';
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
        const was = [...tOrder], from = boxes([...tg.children]);
        const to = tOrder.indexOf(i);
        tOrder.splice(tOrder.indexOf(dragged), 1);
        tOrder.splice(to, 0, dragged);
        dragged = -1;
        render();
        slide([...$('targets').children], tOrder.map((t) => from[was.indexOf(t)]));
      };
    }
    tg.appendChild(el);
    if (st.done && !doneSeen.has(i)) {
      doneSeen.add(i);
      el.classList.add('just');
      const label = el.querySelector<HTMLElement>('.state .stxt')!, text = label.textContent ?? '';
      scramble(label, text, 2, 1, 40);
      // Gear tags decrypt right after the label.
      el.querySelectorAll<HTMLElement>('.thumbtag').forEach((tagEl) => scramble(tagEl, tagEl.textContent ?? '', text.length + 2, 1, 40));
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
  // Disconnect sits next to the score on wide screens, in the status line on phones.
  const dc = S.mode === 'run' ? runStatus() : '', wide = matchMedia('(min-width: 761px)').matches;
  $('status').innerHTML = "<span>Time <b id='clock'>" + clockText() + '</b></span>' + (S.mode === 'run' ? (wide ? '' : dc) : extra);
  $('dcSlot').innerHTML = wide ? dc : '';
  document.getElementById('disconnect')?.addEventListener('click', disconnect);
  if (S.mode === 'run') { renderDaemons(); renderSteps(); }
  $('timebar').hidden = S.mode !== 'sprint' || S.over;
  updateBar();
  applyCross();
}

const runCtx = (): MatrixCtx =>
  ({ buf: S.run.buffer, path: S.run.path, targets: S.puzzle.targets, l: S.puzzle.l, n: S.puzzle.grid.length, ports: S.puzzle.ports, stay: M.stay, worth: M.worth, nodes: M.nodes, trap: M.trap, jumps: M.jumps,
    par: S.puzzle.path?.length, tools: M.tools, bounty: M.bounty, charge: M.charge });

// Data shows the live total with the current matrix's score; once the matrix is over it is banked in R.data.
function runStatus() {
  const live = S.over ? 0 : scoreMatrix(runCtx(), R).total;
  // Ending early keeps the empty slots, which pay credits.
  const empty = S.puzzle.l - S.run.buffer.length, silent = R.daemons.includes('silent');
  const pay = Math.floor(empty / DC_SLOTS_PER_CREDIT) + (silent ? 2 : 0);
  if (S.over) return '';
  const tip = live ? 'Ends the matrix now and banks ' + live + ' data. ' + empty + ' empty buffer slots: +$1 per ' + DC_SLOTS_PER_CREDIT + ' = +$' + Math.floor(empty / DC_SLOTS_PER_CREDIT)
    + (silent ? '; Silent +$2' : '') + '.' : 'Upload a target first: nothing to bank yet.';
  return "<button class='btn act' id='disconnect' data-tip-delay='350' data-tip='" + tip + "'" + (live ? '' : ' disabled') + '>Disconnect' + (live && pay ? ' · ' + money(pay, '+') : '') + '</button>';
}

// Score reads as data × boost: data = target data + flat bonuses, boost = (1 + additive boosts) × multipliers.
const num = (x: number) => String(Number(x.toFixed(2)));
const DI = "<svg class='di' viewBox='0 0 24 24' role='img' aria-label='data'>" + DATA_PATHS + '</svg>';
const DI_SM = DI.replace("'di'", "'di sm'"); // smaller, inside calculations
// In a description, "+7 data" / "×2 data" becomes the number in the data colour with the data icon;
// boosts ("+0.25 boost") and multipliers ("×2", "×(1 + …)") take the boost colour, money ("+$2") gold,
// and the Repeater's ×2 cell ("(×2)", "×2 cell") its violet.
const rich = (s: string) => s.replace(/([+×]?\d+) data\b|(\(×2\)|×2(?= cell))|\+\d*\.?\d+ boost\b|×\([^)]*\)|×\d*\.?\d+|([+−-]?\$\d+)/g,
  (m, d, rep, cash) => (d ? "<span class='vd'>" + d + DI + '</span>' : rep ? "<span class='vr'>" + rep + '</span>'
    : cash ? "<span class='cr'>" + cash + '</span>' : "<span class='vm'>" + m + '</span>'));
const scoreHtml = (sc: Score) => "<span class='vd'>" + (sc.base + sc.flat) + DI_SM + "</span> × <span class='vm'>"
  + num((1 + sc.boost) * sc.mult) + '</span> = <b>' + sc.total + '</b>';

const fmtEffect = (e: Effect) => [e.flat && "<span class='vd'>+" + e.flat + DI_SM + '</span>',
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
  // A fingerprint, crossed out.
  notrace: "<path d='M18.9 7a8 8 0 0 1 1.1 5v1a5 5 0 0 0 .4 2M8 11a4 4 0 0 1 8 0v1.5a9 9 0 0 0 .7 4.5M12 11v2.5a12 12 0 0 0 1 6.5M8 15a18 18 0 0 0 1.8 6M4.9 19a22 22 0 0 1-.9-7v-1a8 8 0 0 1 12-6.95M3 3l18 18'/>",
  crawler: "<path d='M4 18h4v-4h4v-4h4V6h4'/><circle class='f' cx='4' cy='18' r='1.4'/>",
  // Route that leaves the start dot and comes back into its row.
  // Paint roller.
  painter: "<rect x='4' y='4' width='14' height='6' rx='1'/><path d='M18 7h2v5h-8v3M11 15h2v6h-2z'/>",
  circuit: "<path d='M6 6h12v12H9'/><circle class='f' cx='6' cy='6' r='1.4'/><path d='M11 16l-2 2 2 2'/>",
  // Dial with a needle and distance ticks.
  odometer: "<path d='M4 16a8 8 0 1 1 16 0M12 16l4-5M6.5 10.5l1 1M12 8v1.5M17.5 10.5l-1 1'/>",
  sandbag: "<path d='M6 20h12l-2-12H8zM9 8c0-2 1.5-3 3-3s3 1 3 3'/><path d='M8 14h8'/>",
  allin: "<circle cx='12' cy='12' r='8.5'/><circle cx='12' cy='12' r='3.5'/><path d='M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3'/>",
  overtime: "<circle cx='12' cy='13' r='7.5'/><path d='M12 9v4l2.5 2M9 3h6M18.5 6.5l1.5-1.5'/>",
  warmup: "<path d='M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z'/>",
};

const SCOPE_MARK = { matrix: '◇', room: '▣', run: '∞' };
// The legendary holo frame runs at an even speed only if CSS knows the card's size: measure each new frame once it is laid out.
// shortcut: a card resized without a window resize keeps its old size; upgrade to a ResizeObserver if cards start changing width in place.
function sizeHolo(all = false) {
  document.querySelectorAll<HTMLElement>(all ? '.r-legendary .foil' : '.r-legendary .foil:not([data-sized])').forEach((f) => {
    if (!f.offsetWidth) return;
    f.style.setProperty('--w', f.offsetWidth + 'px');
    f.style.setProperty('--h', f.offsetHeight + 'px');
    f.dataset.sized = '1';
  });
}
new MutationObserver(() => sizeHolo()).observe(document.body, { childList: true, subtree: true });
window.addEventListener('resize', () => sizeHolo(true));
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

// A daemon's name decrypts from random hex, letter by letter; only its text nodes change, so the <wbr> breaks and spans stay.
function decrypt(el: HTMLElement | null) {
  if (!el || el.dataset.scrambling || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.dataset.scrambling = '1';
  // The name and its .dmn extension; the family folder stays put.
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('.fdir') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) }), nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const words = nodes.map((n) => n.data), total = words.join('').length, HEX = '0123456789abcdef';
  let shown = -1; // one frame fully scrambled first
  const id = window.setInterval(() => {
    let at = 0;
    nodes.forEach((n, k) => {
      n.data = [...words[k]].map((ch) => (at++ < shown || ch === '/' || ch === '_' || ch === '.' ? ch : HEX[Math.floor(Math.random() * 16)])).join('');
    });
    if (++shown > total) { clearInterval(id); nodes.forEach((n, k) => { n.data = words[k]; }); delete el.dataset.scrambling; }
  }, 40);
}

// Cards lean toward the pointer, with a glare spot under it.
function tilt(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.dcard').forEach((c) => {
    c.onpointerenter = () => {
      glitchNow(c);
      decrypt(c.querySelector<HTMLElement>('b'));
    };
    c.onpointermove = (e) => {
      const r = c.parentElement!.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      // Wide strips: a gentler turn sideways, a stronger one front to back.
      c.style.cssText = '--rx:' + (0.5 - y) * 16 + 'deg;--ry:' + (x - 0.5) * 8 + 'deg;--mx:' + x * 100 + '%;--my:' + y * 100 + '%';
    };
    c.onpointerleave = () => { c.style.cssText = ''; };
  });
}

// Reorder motion (FLIP): each element glides from its old box (`from`, same index) to where it sits now.
function slide(els: Element[], from: DOMRect[]) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  els.forEach((el, k) => {
    // Measure without a glide still running, else the new one starts from the wrong place.
    el.getAnimations().forEach((a) => { if (!(a instanceof CSSAnimation || a instanceof CSSTransition)) a.cancel(); });
    const a = from[k], b = el.getBoundingClientRect();
    if (!a || (a.left === b.left && a.top === b.top)) return;
    el.animate([{ transform: 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px)' }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
  });
}
const boxes = (els: Element[]) => els.map((el) => el.getBoundingClientRect());

// Hold a daemon card or a rack module, then drag it to a new place in its list; a tap or a scroll never moves it.
// Order is only cosmetic. `save` gets the list in the new order.
function dragSort<T>(root: HTMLElement, sel: string, list: T[], save: (l: T[]) => void) {
  const els = [...root.querySelectorAll<HTMLElement>(sel)];
  els.forEach((slot) => {
    let live = false;
    slot.oncontextmenu = (e) => { if (live) e.preventDefault(); };
    slot.addEventListener('touchmove', (e) => { if (live) e.preventDefault(); }, { passive: false });
    slot.onpointerdown = (e) => {
      if (e.button || els.length < 2) return;
      const x0 = e.clientX, y0 = e.clientY, mouse = e.pointerType === 'mouse';
      let order = els, marks: Comment[] = [];
      const start = () => {
        live = true;
        slot.classList.add('drag');
        // Each place keeps a marker, so the rack's rail numbers stay put while the modules move between them.
        marks = els.map((o) => { const c = new Comment(); o.before(c); return c; });
      };
      // A mouse drags at once (a click stays a click); touch needs the hold, so a swipe still scrolls.
      const hold = mouse ? 0 : setTimeout(start, 300);
      const move = (ev: PointerEvent) => {
        if (!live) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) <= 6) return;
          if (!mouse) return stop();
          start();
          getSelection()?.removeAllRanges();
        }
        const o = order.find((o) => { const r = o.getBoundingClientRect(); return o !== slot && ev.clientY >= r.top && ev.clientY <= r.bottom; });
        if (!o) return;
        const r = o.getBoundingClientRect();
        const next = order.filter((x) => x !== slot);
        next.splice(next.indexOf(o) + (ev.clientY < r.top + r.height / 2 ? 0 : 1), 0, slot);
        if (next.every((x, k) => x === order[k])) return;
        order = next;
        const from = boxes(els);
        order.forEach((x, k) => marks[k].after(x));
        slide(els, from);
      };
      const stop = () => {
        clearTimeout(hold);
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', stop);
        removeEventListener('pointercancel', stop);
        if (!live) return;
        live = false;
        // The drop must not also click (arm) a ready module.
        const eat = (ev: Event) => ev.stopPropagation();
        addEventListener('click', eat, true);
        setTimeout(() => removeEventListener('click', eat, true));
        save(order.map((x) => list[els.indexOf(x)]));
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
    const c = carryFoot(id, sc.total);
    return card(id, i, 'div', daemonText(id), e ? fmtEffect(e) : c ? c[0] : dfoot(id), e ? (lastFired.includes(id) ? ' on' : ' on just') : c ? c[1] : '');
  }).join('');
  lastFired = [...fired.keys()];
  fold($('daemons'));
  tilt($('daemons'));
  // The order survives a reload.
  dragSort($('daemons'), '.dslot:not(.empty)', R.daemons, (l) => { R.daemons = l; if (cur) { cur.R.daemons = [...l]; saveRun(cur); } });
  // Deck as a rack of units. A ready tool pulses; clicking it arms it, clicking again puts it down.
  // The LCD shows the pointed-at unit's spec, otherwise what is ready or armed.
  const start = !S.run.path.length, hosted = R.daemons[DAEMON_SLOTS];
  const units = R.items.map((id) => {
    // Burner SIM acts at once like Rewind: no arming, it deals a new matrix before the first move.
    const it = ITEMS[id], t: Tool | 'sim' | undefined = id === 'sim' ? 'sim' : TOOLS[id];
    const ready = !!t && !S.over && !offer.length
      && (t === 'sim' ? !S.start && R.restarts > 0 : t === 'wild' ? M.wild && start : t === 'split' ? M.split && start && S.puzzle.targets.some(canSplit) : t === 'jump' ? jumpReady(B()) : t === 'mux' ? !start && muxReady(B()) : t === 'rewind' ? M.rewind && !!M.back : !start && loopReady(B()));
    const on = ready && armed === t;
    // Not ready: spent (used: until the next matrix, SIM until the next room), unused (its window passed without use)
    // or waiting (charged, not now).
    const used = !!t && (t === 'sim' ? R.restarts < 1 : !M[t]); // each tool's name is its ItemState flag
    const missed = !!t && !used && (S.over || ((t === 'sim' || t === 'wild' || t === 'split') && !start));
    const spent = !ready && (used || missed);
    const hint = !ready ? (!t ? '' : used ? (t === 'sim' ? 'spent · recharges next room' : 'spent · recharges next matrix')
      : missed ? (t === 'sim' ? 'unused · only before the first pick' : 'unused · back next matrix')
      : t === 'split' && start ? 'waiting · no target of ' + SPLIT_MIN + '+ codes' : start ? 'waiting · after your first pick' : 'waiting · nothing in reach now') : t === 'sim' ? 'ready · click to swap this matrix for a new one' : t === 'rewind' ? 'ready · click to take back your last pick' : !on ? 'ready · click to arm' : t === 'split' ? 'armed · click a target'
      : t === 'loop' ? 'armed · click a lit used cell' : t === 'mux' ? 'armed · pick in your line or across it' : 'armed · click a free cell';
    return { id, t, ready, st: on ? 'armed' : ready ? 'ready' : !t ? 'online' : !spent ? 'waiting' : used ? 'spent' : 'unused',
      spec: '<b>&gt; ' + it.name.toLowerCase().replace(/ /g, '_') + '_v' + it.ver + '</b> ' + rich(it.text) + (hint ? ' · <b>' + hint + '</b>' : '')
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
      if (!u) return rail(i + 1) + "<div class='unit blank' tabindex='0' aria-label='Locked rack slot'><i class='scr'></i><i class='vent'></i>"
        + "<span class='lock'>locked</span><i class='vent'></i><i class='scr'></i></div>" + rail(i + 1);
      const it = ITEMS[u.id], tag = u.ready ? 'button' : 'div';
      return rail(i + 1) + '<' + tag + " class='unit hw " + u.st + (u.t === 'wild' || u.t === 'split' || u.t === 'sim' ? ' pre' : '') + "'" + (u.ready ? " data-tool='" + u.t + "'" : " tabindex='0'")
        + " aria-label='" + it.name + ' v' + it.ver + ', ' + u.st + ': ' + it.text + "'><i class='scr'></i>" + gear(u.id)
        + "<span class='nm'><b>" + it.name + ' <small>v' + it.ver + '</small></b><small><span>' + (u.id === 'socket' && hosted ? '▸ ' + DAEMONS[hosted].name : it.kind) + '</span>' + (u.t ? '<em>· ' + u.st + '</em>' : '')
        + "</small></span><i class='led'></i><i class='scr'></i></" + tag + '>' + rail(i + 1);
    }).join('') + "<p class='lcd' id='lcd'>" + lcd + '</p>';
  const use = (tool: string) => {
    if (tool === 'rewind') return doRewind();
    if (tool === 'sim') return burnSim();
    armed = armed === tool ? null : (tool as Tool);
    render();
  };
  // Phones: ready tools also sit above the matrix, so the rack at the bottom needs no scrolling.
  // Kept (empty) while any tool is owned, so the matrix does not jump under the finger.
  $('quick').hidden = S.mode !== 'run' || !units.some((u) => u.t);
  $('quick').innerHTML = ready.map((u) => "<button class='qtool" + (u === on ? ' armed' : '') + (u.t === 'wild' || u.t === 'split' || u.t === 'sim' ? ' pre' : '')
    + "' data-tool='" + u.t + "' aria-pressed='" + (u === on) + "'>" + gear(u.id) + '<span>' + ITEMS[u.id].name + '</span></button>').join('');
  $('quick').querySelectorAll<HTMLElement>('.qtool').forEach((el) => { el.onclick = () => use(el.dataset.tool!); });
  $('items').querySelectorAll<HTMLElement>('.unit.hw').forEach((el, i) => {
    // A ready Bridge lights the cells it can reach while pointed at; a Mux only the line it adds.
    const t = units[i].t;
    const reach = (on: boolean) => units[i].ready && (t === 'jump' || t === 'mux' ? document.querySelectorAll<HTMLElement>('#grid .cell').forEach((c) => {
      const r = +c.id[1], k = +c.id[2];
      c.classList.toggle('reach', on && canPick({ ...B(), armed: t }, r, k) && (t === 'jump' || !canPick({ ...B(), armed: null }, r, k)));
    }) : t === 'rewind' && rewindPeek(on));
    const show = () => { $('lcd').innerHTML = units[i].spec; reach(true); }, hide = () => { $('lcd').innerHTML = lcd; reach(false); };
    el.onpointerenter = el.onfocus = show;
    el.onpointerleave = el.onblur = hide;
    if (el.dataset.tool) el.onclick = () => use(el.dataset.tool!);
  });
  // A locked slot tells its price; slots are bought in order, one per shop click.
  $('items').querySelectorAll<HTMLElement>('.unit.blank').forEach((el, k) => {
    const n = R.rack + k;
    const show = () => { $('lcd').innerHTML = '<b>&gt; slot_' + String(n + 1).padStart(2, '0') + '</b> locked · buy it in the shop between rooms · ' + money(slotCost({ ...R, rack: n }))
      + (k ? ' · slots unlock in order' : ''); };
    el.onpointerenter = el.onfocus = el.onclick = show;
    el.onpointerleave = el.onblur = () => { $('lcd').innerHTML = lcd; };
  });
  dragSort($('items'), '.unit.hw', R.items, (l) => { R.items = l; if (cur) { cur.R.items = [...l]; saveRun(cur); } });
}

// A streak daemon that is not firing yet says what keeps its stack and what that would give.
const dfoot = (id: DaemonId) => {
  const st = streakOf(id);
  return st && !S.over ? "<span class='hold'>" + st.goal + ' → ' + fmtEffect(st.effect((R.stacks[id] ?? 0) + 1)) + '</span>' : 'standby';
};
let lastBill: Score | null = null;

// Overtime over the room's quota (live matrix included): what passes on, lit like a firing daemon.
const carryFoot = (id: DaemonId, live: number) => {
  const n = id === 'overtime' ? overtimeCarry(R, R.data + (S.over ? 0 : live)) : 0;
  return n ? ['<span>+' + n + DI_SM + '</span><span>→ next room</span>', ' on carry'] : null;
};

// An installed streak daemon (or Sandbag, whose stack lasts a room) also shows its current stack.
const daemonText = (id: DaemonId) => {
  const st = streakOf(id), n = R.stacks[id] ?? 0;
  return rich(DAEMONS[id].text) + ((st || id === 'sandbag') && R.daemons.includes(id) ? ' · stack now ' + n + (n && st ? ' (' + fmtEffect(st.effect(n)) + ')' : '') : '')
    + (st && n && R.daemons.includes(id) && R.bonus?.includes('stack') ?" <span class='bnt'>bonus</span> +" + BOUNTY_STACKS + ' stacks' : '');
};

// Shop item drawn as its own piece of hardware: a button on the shelf, a plain tile in the catalog.
const ware = (id: ItemId, tag: string, foot: string, cls = '') => {
  const it = ITEMS[id];
  return '<' + tag + " class='ware hw" + cls + "'><span class='stage'>" + gear(id) + '</span><b>' + it.name + ' <small>v' + it.ver + '</small></b><small>' + it.kind
    + '</small><p>' + rich(it.text) + "</p><span class='price'>" + foot + '</span></' + tag + '>';
};

let catalogTab: 'daemons' | 'items' | 'bonuses' | 'ice' = 'daemons';

// Dev cheats on the catalog: toggle daemons and items (versions of one item replace each other), add credits, re-deal, skip a room.
function wireDev(ds: DaemonId[], its: ItemId[]) {
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
      R.items = R.items.includes(id) ? R.items.filter((x) => x !== id) : [...R.items.filter((x) => !olderVersions(id).includes(x) && !olderVersions(x).includes(id)), id];
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
    if (p) showPatch(); else showOffer();
  });
}

// Every daemon and item, also a dev aid; installed daemons show what they add to the live matrix.
// Where Close leads when the catalog was opened from the shop or a daemon offer; kept across tab switches.
let catalogBack: (() => void) | null = null;
let catalogQuery = '';
const REWARD_NOTES: Record<RewardId, string> = {
  cash: 'credits right away',
  rerolls: 'shop rerolls that take the cheapest steps of a visit\'s rising price',
  stack: 'only offered with a streak daemon installed',
  legend: 'the next daemon offer leads with a legendary (a rare if none is left)',
  double: 'spend it by hand on a later matrix to double its data',
};
function showCatalog(back?: (() => void) | null) {
  if (back !== undefined) catalogBack = back;
  const now = scoreMatrix(runCtx(), R), fired = new Map(now.fired);
  // Daemons grouped by family (in definition order), common to legendary within each.
  const fams = [...new Set(Object.values(DAEMONS).map((d) => d.family))], rank = ['common', 'rare', 'legendary'];
  const ds = (Object.keys(DAEMONS) as DaemonId[]).sort((a, b) => fams.indexOf(DAEMONS[a].family) - fams.indexOf(DAEMONS[b].family)
    || rank.indexOf(rarityOf(a)) - rank.indexOf(rarityOf(b)));
  const its = Object.keys(ITEMS) as ItemId[];
  const dev = import.meta.env.DEV; // dev server only: the catalog doubles as a cheat panel
  const tag = dev ? 'button' : 'div';
  const tab = (t: typeof catalogTab) => "<button class='btn' id='tab-" + t + "' aria-pressed='" + (catalogTab === t) + "'>" + t + '</button>';
  const body = catalogTab === 'daemons'
    ? '<p class="meta">' + ds.length + ' daemons · installed ' + R.daemons.length + '/' + daemonSlots(R) + "</p><div class='dlist'>" + ds.map((id, i) => {
      const e = fired.get(id), c = carryFoot(id, now.total);
      return card(id, i, tag, daemonText(id), e ? fmtEffect(e) : c ? c[0] : R.daemons.includes(id) ? 'standby' : 'not installed', e ? ' on' : c ? c[1] : '');
    }).join('') + '</div>'
    : catalogTab === 'items' ? '<p class="meta">' + its.length + ' items · in your deck ' + R.items.length + "</p><div class='wares'>"
      + its.map((id) => ware(id, tag, R.items.includes(id) ? 'in deck' : money(ITEMS[id].price))).join('') + '</div>'
    : catalogTab === 'ice' ? '<p class="meta">' + Object.keys(ICE).length + " ICE rules · the SOC runs one from the company's pool; patches deploy more between iterations, into any room</p>"
      + (Object.keys(ICE) as IceId[]).map((id) => '<' + tag + " class='icebtn' data-ice='" + id + "'>" + iceRule(id, roomIce(R).includes(id) ? 'ICE · in this room' : 'ICE') + '</' + tag + '>').join('')
    : '<p class="meta">' + Object.keys(BOUNTIES).length + ' bonus objectives · one matrix per iteration carries one · meeting it lets you pick 1 of 2 rewards</p>'
      + "<div class='blist'>" + (Object.keys(BOUNTIES) as BountyId[]).map((id) => '<' + tag + " class='bounty" + (dev && M.bounty === id ? ' met' : '') + "' data-bounty='" + id + "'><span class='bnt'>bonus</span><b>"
        + BOUNTIES[id].name + '</b> ' + rich(BOUNTIES[id].text()) + (dev && M.bounty === id ? "<span class='bstate'>on this matrix</span>" : '') + '</' + tag + '>').join('') + '</div>'
      + "<h3 class='catsec'>rewards</h3><p class='meta'>" + Object.keys(REWARDS).length + " rewards · a met bonus offers 2 of them, you take 1</p><div class='blist'>"
      + (Object.keys(REWARDS) as RewardId[]).map((id) => "<div class='bounty reward'><span class='bnt'>reward</span><b>" + REWARDS[id] + '</b> ' + REWARD_NOTES[id] + '</div>').join('') + '</div>'
      + (dev ? "<p class='meta'>dev · the two rewards this matrix's bonus offers</p><div class='row devbar'>" + (Object.keys(REWARDS) as RewardId[]).map((r) => "<button class='btn' data-reward='" + r + "'"
        + (M.rewards.includes(r) ? " aria-pressed='true'" : '') + '>' + REWARDS[r] + '</button>').join('') + '</div>' : '');
  const devBar = !dev ? '' : "<div class='row devbar'><span>dev · click a card to install or remove it; items apply on the next deal; a bonus goes on this matrix</span>"
    + "<button class='btn' id='devCr'>+$10</button><button class='btn' id='devDeal'>Restart room</button>"
    + (!isBoss(R) || R.loop < LOOPS - 1 ? "<button class='btn' id='devRoom'>" + (isBoss(R) ? 'Next iteration' : 'Next room') + '</button>' : '') + '</div>';
  showResult(true, "<h2>Catalog</h2><div class='tabs'>" + tab('daemons') + tab('items') + tab('bonuses') + tab('ice') + '</div>'
    + "<input id='catSearch' class='catsearch' type='search' autocomplete='off' placeholder='search " + catalogTab + "' aria-label='Search " + catalogTab + "'>"
    + "<div class='catbody'>" + devBar + body + "</div><div class='row'><button class='btn' id='closeCatalog'>Close</button></div>");
  tilt($('modalBox'));
  for (const t of ['daemons', 'items', 'bonuses', 'ice'] as const) $('tab-' + t).onclick = () => { catalogTab = t; showCatalog(); };
  // Search hides the entries whose text misses the query; the query stays across tabs and re-renders.
  const search = $('catSearch') as HTMLInputElement;
  const filter = () => {
    const q = catalogQuery.trim().toLowerCase();
    $('modalBox').querySelectorAll<HTMLElement>('.dlist .dslot, .wares .ware, .catbody .icebtn, .blist .bounty')
      .forEach((el) => { el.style.display = q && !(el.textContent ?? '').toLowerCase().includes(q) ? 'none' : ''; });
  };
  search.value = catalogQuery;
  search.oninput = () => { catalogQuery = search.value; filter(); };
  filter();
  if (dev) wireDev(ds, its);
  const close = () => {
    const b = catalogBack;
    catalogBack = null;
    $('modal').onkeydown = null;
    if (b) b(); else { hideResult(); focusGrid(); }
  };
  $('closeCatalog').onclick = close;
  $('modal').onkeydown = (e) => { if (e.key === 'Escape') close(); };
}

// After a matrix: the room goes on. Its progress dots, the bill and the matrix's small print.
const why = () => (endWhy ? "<p class='meta'>auto-disconnect · " + endWhy + '</p>' : '');
const small = () => "<p class='meta fine'>time " + fmt(S.elapsed) + ' · buffer ' + S.run.buffer.length + '/' + S.puzzle.l + '</p>';
function matrixSummary(bill: Score, credits: string) {
  const sec = sections(R)[R.section], n = played(R);
  const dots = Array.from({ length: sec.matrices }, (_, j) => (j < n ? '●' : '○')).join('');
  return "<p class='meta'>" + sec.name + ' · matrix ' + n + '/' + sec.matrices + " <span class='dots'>" + dots + '</span> · still in this room</p>'
    + '<h2>Matrix closed</h2>' + why() + billHtml(bill) + small() + credits;
}

// After a room's last matrix: every matrix it banked, the sum against the quota, then the way out.
function roomSummary(bill: Score, credits: string) {
  const sec = sections(R)[R.section], goal = quota(R);
  const rows = R.scores[R.section].map((d, j) => '<tr><td>matrix ' + (j + 1) + "</td><td><span class='vd'>" + d + '</span></td></tr>').join('');
  return "<div class='roomsum'><p class='meta'>" + COMPANIES[R.company].name + ' · run ' + (R.loop + 1) + '/' + LOOPS + '</p><h2>' + sec.name + ' breached</h2>' + why()
    + "<p class='meta'>last matrix</p>" + billHtml(bill) + small()
    + "<table class='calc'>" + rows + "<tr class='sum'><td>room</td><td><b>" + R.data + '</b> / ' + goal + DI + (R.data > goal ? ' <small>+' + (R.data - goal) + ' over</small>' : '')
    + '</td></tr></table>' + (overtimeNote(R.data) && "<p class='tallyline'>" + overtimeNote(R.data) + '</p>') + credits + '</div>';
}

// End of the run, won or lost: rooms by iteration, totals, the build, and the company record.
function runSummary(won: boolean, bill: Score, credits: string) {
  const co = COMPANIES[R.company], total = R.total ?? 0, ms = R.ms ?? 0;
  const prev = bestRun(co.id), fresh = recordBest(co.id, { data: total, ms, won });
  // ×quota per room shows where the run was loose or tight.
  const rows = (R.log ?? []).map(([loop, room, data]) => {
    const goal = Math.round(co.sections[room].quota * QUOTA_GROWTH ** loop);
    return '<tr><td>run ' + (loop + 1) + ' · ' + co.sections[room].name + "</td><td><span class='vd'>" + data + '</span> / ' + goal + DI + ' <small>×' + (data / goal).toFixed(2) + '</small></td></tr>';
  }).join('');
  const build = [...R.daemons.map(dmnName), ...R.items.map((id) => "<span class='gname'>" + ITEMS[id].name + ' v' + ITEMS[id].ver + '</span>')].join(' · ');
  return "<div class='roomsum'><p class='meta'>" + co.name + ' · run ' + (R.loop + 1) + '/' + LOOPS + '</p><h2>' + (won ? co.name + ' breached' : 'Run over') + '</h2>' + why()
    + "<p class='meta'>last matrix</p>" + billHtml(bill) + small()
    + "<table class='calc'>" + rows + "<tr class='sum'><td>total</td><td><b>" + total + '</b>' + DI + ' · ' + fmt(ms) + '</td></tr>'
    + '<tr><td>best matrix</td><td>' + (R.best ?? 0) + '</td></tr></table>'
    + (build ? "<p class='meta'>build · " + build + '</p>' : '')
    + "<p class='iceRule" + (fresh ? ' unlock' : '') + "'><b>" + (fresh ? 'New record' : 'Record') + '</b> '
    + (fresh ? (prev ? 'previous ' + prev.data + DI + ' · ' + fmt(prev.ms) : 'first run on this contract') : prev ? prev.data + DI + ' · ' + fmt(prev.ms) : '') + '</p>'
    + credits + '</div>';
}

// Overtime: the data it carried in, and what the room passes on so far (nothing past the boss room).
function overtimeNote(got: number) {
  if (!R.daemons.includes('overtime')) return '';
  const next = overtimeCarry(R, got);
  const bits = [R.carry ? 'incl. +' + R.carry + ' carried in' : '', next ? '+' + next + ' to next room' : ''].filter(Boolean);
  return bits.length ? "<span class='ot c-cron'>overtime · " + bits.join(' · ') + '</span>' : '';
}

// Contract stepper: rooms in order, one box per matrix with the score it banked; the live box is the matrix in play.
function renderSteps() {
  const live = S.over ? null : scoreMatrix(runCtx(), R).total;
  const co = COMPANIES[R.company];
  const spots = bountySpots(R).filter(([i, j]) => i < R.section || (i === R.section && j <= played(R)));
  // Bonus tag per reached bonus matrix: grey while in play (or unknown on old saves), lit if met, struck through if missed.
  const bonusTags = (i: number) => spots.filter(([k]) => k === i).map(([, j]) => {
    const st = j >= R.scores[i].length || !R.bonusHits ? 'off' : R.bonusHits.includes(bonusKey(R.loop, i, j)) ? 'won' : 'off lost';
    return " <span class='bnt " + st + "'>bonus</span>";
  }).join('');
  $('stepList').innerHTML = "<div class='coTag'>" + logo(co.id) + '<span>' + co.name + '<small>run ' + (R.loop + 1) + '/' + LOOPS + (co.always ? ' · every room: ' + iceTags(co.always) : '') + '</small></span></div>'
    + sections(R).map((sec, i) => {
    const got = R.scores[i];
    const state = i < R.section ? 'done' : i === R.section ? 'now' : '';
    const boxes = Array.from({ length: sec.matrices }, (_, j) => {
      if (j < got.length) return "<span class='box " + (got[j] ? 'ok' : 'zero') + "'>" + got[j] + '</span>';
      return i === R.section && j === got.length && live !== null ? "<span class='box live'>" + (live || '··') + '</span>' : "<span class='box'></span>";
    }).join('');
    // A finished room's logged total includes the data Overtime carried in.
    const total = i === R.section ? R.data + (live ?? 0)
      : R.log?.find(([l, r]) => l === R.loop && r === i)?.[2] ?? got.reduce((a, b) => a + b, 0);
    return "<div class='step " + state + "'><span class='sname'>" + sec.name + ' ' + iceTags(shownIce(i)) + bonusTags(i) + "</span><span class='squota'>"
      + (state ? "<b class='" + (total >= quota(R, i) ? 'met' : '') + "'>" + total + '</b>/' : 'quota ') + quota(R, i) + "</span><div class='boxes'>" + boxes + '</div></div>';
  }).join("<span class='sarrow' aria-hidden='true'>›</span>");
  // The room's data tally, big: white until the quota is met, then green.
  const got = R.data + (live ?? 0), goal = quota(R);
  $('stepCr').textContent = 'credits $' + R.credits;
  $('tally').innerHTML = overtimeNote(got) + "<span class='meta'>" + sections(R)[R.section].name + " data</span><b class='" + (got >= goal ? 'met' : '') + "'>" + got + "</b><span class='goal'>/ " + goal + DI + '</span>';
}

// Matrix bill: the uploads, each daemon that fired and what it added, then the formula.
// Daemon file name as on its card, in its family color.
const dmnName = (id: DaemonId) => {
  const f = DAEMONS[id].family.toLowerCase();
  return "<span class='dfile c-" + f + "'><span class='fdir'>" + f + '/</span>' + DAEMONS[id].name.toLowerCase().replace(/ /g, '_') + "<span class='fext'>.dmn</span></span>";
};

const billHtml = (sc: Score) => "<table class='calc'><tr><td>targets</td><td><span class='vd'>" + sc.base + DI_SM + '</span></td></tr>'
  + sc.fired.map(([id, e]) => '<tr><td>' + dmnName(id) + '</td><td>' + fmtEffect(e) + '</td></tr>').join('')
  + sc.gear.map(([id, e]) => "<tr><td><span class='gname'>" + ITEMS[id].name + '</span></td><td>' + fmtEffect(e) + '</td></tr>').join('')
  + sc.ice.map(([id, e]) => "<tr><td><i class='iceTag'>" + ICE[id].name + '</i></td><td>' + fmtEffect(e) + '</td></tr>').join('')
  + (sc.charge ? '<tr><td>×2 data charge</td><td>' + fmtEffect({ mult: 2 }) + '</td></tr>' : '') + '</table>';


// Between iterations: what the company patched; the room it went to shows once you get there.
function showPatch() {
  checkpoint('patch');
  const fresh = R.patches.filter((p) => p.loop === R.loop), ids = [...new Set(fresh.map((p) => p.ice))];
  const hardened = (id: IceId) => id === 'corruption' && R.patches.filter((x) => x.ice === id).length > 1;
  showResult(false, "<p class='meta'>" + COMPANIES[R.company].name + ' · iteration ' + (R.loop + 1) + '/' + LOOPS + "</p><h2>Patch notes</h2><ul class='patch'>"
    + '<li>Quotas ×' + QUOTA_GROWTH + ': ' + sections(R).map((_, i) => quota(R, i)).join(' / ') + '</li>'
    + ids.map((id) => "<li>" + (hardened(id) ? 'Hardened' : 'New') + " ICE <b class='iceName'>" + ICE[id].name + '</b>: ' + ICE[id].text
      + (id === 'corruption' ? '; it now ' + burnText(burnOf(R, fresh.find((p) => p.ice === id)!.room)) : '') + '</li>').join('')
    + '<li>Deployed in ' + (fresh.length === 1 ? 'one room' : fresh.length + ' rooms') + '. You will see which when you get there.</li>'
    + '</ul>' + "<div class='row'><button class='btn' id='patchOk'>Continue ›</button></div>");
  $('patchOk').onclick = showOffer;
}

// Installed daemons as a folded cascade (mouse): a click keeps a card open or folds it again, any number can be open (pointing unfolds it in CSS).
function fold(box: HTMLElement) {
  box.style.setProperty('--n', String(R.daemons.length));
  box.querySelectorAll<HTMLElement>('.dslot:not(.empty)').forEach((el, i) => {
    const id = R.daemons[i];
    el.classList.toggle('open', openDaemons.has(id));
    el.onclick = () => { if (!openDaemons.delete(id)) openDaemons.add(id); el.classList.toggle('open', openDaemons.has(id)); };
  });
}

// What the player owns, shown beside offers and the shop: daemons folded like in play, then rack modules with their art.
const owned = (shop = false) => {
  const mod = (id: ItemId) => '<' + (shop ? "button data-sell='" + id + "'" : 'span') + " class='chip mod' data-tip='" + ITEMS[id].text + "'>" + gear(id) + '<b>'
    + ITEMS[id].name + ' <small>v' + ITEMS[id].ver + '</small></b>' + (shop ? "<i class='sell'>sell · " + money(sellValue(id)) + '</i></button>' : '</span>');
  return "<div class='owned'><p class='meta'>your daemons · " + R.daemons.length + '/' + daemonSlots(R) + "</p><div class='dlist dfold'>"
    + (R.daemons.map((id, i) => card(id, i, 'div', daemonText(id), dfoot(id))).join('') || "<span class='chip none'>no daemons yet</span>")
    + "</div><p class='meta'>your rack · " + R.items.length + '/' + R.rack + ' slots' + (shop && R.items.length ? ' · click a module to sell it' : '') + "</p><div class='chips'>" + (R.items.map(mod).join('') || "<span class='chip none'>no modules yet</span>") + '</div></div>';
};

function showOffer() {
  offer = offerDaemons(R);
  if (!offer.length) return showShop();
  checkpoint('offer');
  const full = R.daemons.length >= daemonSlots(R);
  // The swap price depends on which installed daemon goes, so the offer shows the range.
  const costs = R.daemons.map(swapCost), lo = Math.min(...costs), hi = Math.max(...costs);
  const range = money(lo) + (hi > lo ? '–' + money(hi) : '');
  const poor = full && R.credits < lo;
  showResult(true, '<h2>Choose a daemon</h2><p class="meta">' + (full ? 'Slots full · swapping one in costs ' + range + ' by the rarity you drop · credits ' + money(R.credits)
    : 'Free to take · slots ' + R.daemons.length + '/' + daemonSlots(R)) + '</p>' + owned()
    + "<div class='dlist' id='offerList'>" + offer.map((id, i) => card(id, i, 'button', (i === 0 && R.legendOffer ? "<span class='bnt'>bonus</span> " : '') + rich(DAEMONS[id].text), !full ? 'install ›' : poor ? 'need ' + money(lo) : 'swap in · ' + range, ' reveal' + (poor ? ' poor' : ''))).join('') + '</div>'
    + "<div class='row'><button class='btn' id='viewMatrix'>View matrix</button><button class='btn' id='offerCatalog'>Catalog</button><button class='btn' id='skipDaemon'>Skip · take none</button></div>");
  fold($('modalBox').querySelector('.dfold')!);
  $('offerCatalog').onclick = () => showCatalog(showOffer);
  $('viewMatrix').onclick = () => peek(true);
  $('offerList').querySelectorAll<HTMLElement>('.dcard').forEach((b, i) => {
    b.onclick = () => { if (!full) { R.daemons.push(offer[i]); note('offer · installed ' + dmnFile(offer[i])); showShop(); } else if (!poor) showSwap(offer[i]); };
  });
  $('skipDaemon').onclick = () => { note('offer · skipped'); showShop(); };
  tilt($('modalBox'));
}

// Shop between rooms: a seeded shelf of items, a paid reroll and paid daemon removal; Continue opens the next room.
function showShop(restock = true) {
  if (restock) { stockShop(R); R.legendOffer = false; } // the offer before the shop used it
  checkpoint('shop');
  const cr = (n: number) => money(n);
  const off = (n: number) => (R.credits < n ? ' disabled' : '');
  showResult(true, "<h2>Black market</h2><p class='meta'>"
    + (R.charges ? "<span class='bnt'>bonus</span> ×2 data charge ×" + R.charges + ' · ' : '') + 'items stay for the whole run</p>' + owned(true)
    + "<div class='wares shelf'>" + (R.shelf.map((id) => ware(id, 'button', cr(ITEMS[id].price) + (rackFull(R, id) ? ' · rack full' : ''),
      R.credits < ITEMS[id].price || rackFull(R, id) ? ' poor' : '')).join('')
      || "<div class='dslot empty'>sold out</div>") + '</div>' + "<div class='row'>"
    + "<span class='meta shopCr'>credits " + money(R.credits) + '</span>'
    + (R.rack < RACK_MAX ? "<button class='btn' id='buySlot'" + off(slotCost(R)) + '>Rack slot +1 · ' + cr(slotCost(R)) + '</button>' : '')
    + (forSale(R).length > R.shelf.length ? "<button class='btn' id='reroll'" + (R.freeRerolls ? "><span class='bnt'>bonus</span> Reroll · free ×" + R.freeRerolls : off(rerollCost(R)) + '>Reroll · ' + cr(rerollCost(R))) + '</button>' : '')
    + "<button class='btn' id='viewMatrix'>View matrix</button><button class='btn' id='shopCatalog'>Catalog</button><button class='btn' id='leaveShop'>Continue ›</button></div>");
  fold($('modalBox').querySelector('.dfold')!);
  $('shopCatalog').onclick = () => showCatalog(() => showShop(false));
  $('viewMatrix').onclick = () => peek(true);
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
  showResult(true, '<h2>Swap out a daemon</h2><p class="meta">' + dmnName(id) + ' takes the freed slot · the rarer the daemon you drop, the more it costs · credits ' + money(R.credits) + '</p>'
    + "<div class='dlist'>" + R.daemons.map((d, i) => card(d, i, 'button', daemonText(d), R.credits < swapCost(d) ? 'need ' + money(swapCost(d)) : 'swap out · ' + money(swapCost(d)), R.credits < swapCost(d) ? ' poor' : '')).join('')
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
    + (best ? "<span class='fbest'>best " + best.data + DI + ' · ' + fmt(best.ms) + '</span>' : '') + (isOpen(i) ? "<span class='fhint'>details ›</span>" : lock))
    : face('front', logo() + '<b>??? ????????</b><p>Classified. Breach the previous contract to unlock.</p>');
  // ICE the previous company did not have.
  const prev = COMPANIES[i - 1], fresh = co && prev ? [...co.ice, ...co.patches].filter((id) => !prev.ice.includes(id) && !prev.patches.includes(id)) : [];
  const back = co ? face('back', '<b>' + co.name + "</b><table class='frooms'><tr><th>room</th><th>size</th><th>matrices</th><th>quota</th></tr>"
    + co.sections.map((s) => '<tr><td>' + s.name + (s.ice ? ' ' + iceTags(s.ice) : '') + '</td><td>' + roomSize(s.size) + '</td><td>' + s.matrices + '</td><td>' + s.quota + '</td></tr>').join('')
    + "</table><p class='meta'>" + LOOPS + ' iterations, quotas ×' + QUOTA_GROWTH + ' each</p>'
    + (co.always ? "<p class='meta'>in every room:<br>" + iceTags(co.always) + '</p>' : '')
    + "<p class='meta'>boss ICE, one per run:<br>" + iceTags(co.ice, fresh) + '</p>' + "<p class='meta'>patches between iterations:<br>" + iceTags(co.patches, fresh) + '</p>'
    + (fresh.length ? "<p class='meta'><span class='newkey'>bold</span> = new in this contract</p>" : '') + (won ? "<button class='fhint fmap'>map ›</button>" : '') + (isOpen(i) ? '' : lock)) : '';
  return "<div class='fcard" + (!co ? ' locked' : isOpen(i) ? '' : ' sealed') + "' role='button' tabindex='0' aria-label='" + (co ? co.name : 'Locked contract') + "'><div class='ftilt'><div class='finner'>"
    + front + back + '</div></div></div>';
};

// Contract map of a breached company: every iteration's rooms with grown quotas; patches are rolled per run, so only their rule shows.
const patchNote = (l: number) => (!PATCH_COVER[l] ? 'no patches yet' : 'patches add ICE to ' + (PATCH_COVER[l] >= 1 ? 'every room' : '~' + PATCH_COVER[l] * 100 + '% of rooms')
  + (PATCH_DOUBLE[l] ? ', a second rule to ~1/' + Math.round(1 / PATCH_DOUBLE[l]) : ''));
function showMap(co: Company, seed: number, back: Mode) {
  const last = co.sections.length - 1;
  showResult(true, '<h2>' + co.name + " · map</h2><p class='meta'>" + (co.always ? 'every room: ' + iceTags(co.always) + '<br>' : '')
    + 'boss ICE, one per run: ' + iceTags(co.ice) + '<br>patch pool: ' + iceTags(co.patches) + '</p>'
    + Array.from({ length: LOOPS }, (_, l) => "<h3 class='mapIt'>iteration " + (l + 1) + " <span class='meta'>· " + patchNote(l) + "</span></h3><div class='steplist'>"
      + co.sections.map((sec, i) => "<div class='step done'><span class='sname'>" + sec.name + (i === last ? " <span class='mapBoss'>boss</span>" : '') + (sec.ice ? ' ' + iceTags(sec.ice) : '')
        + "</span><span class='squota'>quota " + Math.round((sec.quota * QUOTA_GROWTH ** l) / 5) * 5 + "</span><div class='boxes'>" + Array.from({ length: sec.matrices }, () => "<span class='box'>" + roomSize(sec.size) + '</span>').join('') + '</div></div>')
        .join("<span class='sarrow' aria-hidden='true'>›</span>") + '</div>').join('')
    + "<div class='row'><button class='btn' id='mapBack'>‹ Back</button></div>");
  $('mapBack').onclick = () => showCompanies(seed, back);
}

// Port rooms show both matrices: 5×5 ⇄ 5×5.
const roomSize = (z: { n: number; ports?: number }) => z.n + '×' + z.n + (z.ports ? ' ⇄ ' + z.n + '×' + z.n : '');

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
  // The tilted back face can let a click through to the card itself; find the map link by its layout box, which transforms leave alone.
  const overMap = (c: HTMLElement, e: MouseEvent) => {
    const m = c.querySelector<HTMLElement>('.fmap');
    if (!m || !c.classList.contains('flip')) return false;
    let x = 0, y = 0;
    for (let el: HTMLElement | null = m; el && el !== c; el = el.offsetParent as HTMLElement | null) { x += el.offsetLeft; y += el.offsetTop; }
    y -= m.closest<HTMLElement>('.fface')?.scrollTop ?? 0; // the back face scrolls on its own
    const r = c.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, pad = 8;
    return px > x - pad && px < x + m.offsetWidth + pad && py > y - pad && py < y + m.offsetHeight + pad;
  };
  const press = (c: HTMLElement, i: number, e?: MouseEvent) => {
    if (dragged) dragged = false;
    else if (i === firmAt && e && overMap(c, e)) showMap(COMPANIES[i], seed, back);
    else if (i !== firmAt) go(i);
    else if (!c.classList.contains('locked')) c.classList.toggle('flip');
  };
  cards.forEach((c, i) => {
    c.onclick = (e) => press(c, i, e);
    const map = c.querySelector<HTMLElement>('.fmap');
    if (map) map.onclick = (e) => { e.stopPropagation(); showMap(COMPANIES[i], seed, back); };
    c.onkeydown = (e) => { if (e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); press(c, i); } };
    const t = c.querySelector<HTMLElement>('.ftilt')!;
    c.onpointermove = (e) => {
      // Hover by the same layout box the click uses, so what lights up is what opens the map.
      const hot = overMap(c, e);
      c.querySelector('.fmap')?.classList.toggle('hot', hot);
      c.style.cursor = hot ? 'var(--hit)' : '';
      const r = c.getBoundingClientRect();
      t.style.transform = 'rotateX(' + (0.5 - (e.clientY - r.top) / r.height) * 14 + 'deg) rotateY(' + ((e.clientX - r.left) / r.width - 0.5) * 14 + 'deg)';
    };
    c.onpointerleave = () => { t.style.transform = ''; c.querySelector('.fmap')?.classList.remove('hot'); };
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

const newMatrix = () => { dealMatrix(); logHead(); checkpoint('matrix'); };

// Event log: a header per dealt matrix; a resumed intro deals the same matrix again, so a repeat is skipped.
function logHead() {
  const h = '── iteration ' + (R.loop + 1) + ' · ' + sections(R)[R.section].name + ' · matrix ' + (played(R) + 1) + ' ──';
  if (R.events?.at(-1) !== h) logEvent(R, h);
}
const note = (text: string) => { if (S.mode === 'run') logEvent(R, text); };
const toolName = (t: Tool) => ITEMS[(Object.keys(TOOLS) as ItemId[]).find((id) => TOOLS[id] === t)!].name;
const logHtml = () => "<pre class='termlog'>" + (R.events ?? []).map((e) => e.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('\n') + '</pre>';
// Shop, offer and patch screens lock the board, so they carry the log as a fold-out.

// Full run state as JSON, for balance study.
function exportRun(out: string, bill: Score) {
  const json = JSON.stringify({ at: new Date().toISOString(), company: COMPANIES[R.company].id, out, endWhy, lastBill: bill, run: R }, null, 1);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'bypass-run-' + COMPANIES[R.company].id + '-' + R.seed + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function showLog() {
  showResult(true, '<h2>Event log</h2>' + logHtml() + "<div class='row'><button class='btn' id='closeLog'>Close</button></div>");
  const pre = $('modalBox').querySelector('.termlog')!;
  pre.scrollTop = pre.scrollHeight;
  const close = () => { $('modal').onkeydown = null; hideResult(); focusGrid(); };
  $('closeLog').onclick = close;
  $('modal').onkeydown = (e) => { if (e.key === 'Escape') close(); };
}

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
    return sv.screen === 'patch' ? showPatch() : sv.screen === 'offer' ? showOffer() : showShop(false);
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
  logHead();
  checkpoint('intro');
  const rooms = sections(R);
  const sec = rooms[R.section];
  const at = (i: number) => (i < R.section ? ' done' : i === R.section ? ' now' : '');
  const route = rooms.map((s, i) => (i ? "<i class='link" + at(i) + "'></i>" : '') + "<span class='node" + at(i) + "'>" + s.name + '</span>').join('');
  showResult(true, "<p class='meta'>" + COMPANIES[R.company].name + ' · iteration ' + (R.loop + 1) + '/' + LOOPS + ' · section ' + (R.section + 1) + '/' + rooms.length + '</p><h2>' + sec.name + "</h2><div class='route'>"
    + route + '</div><p>' + sec.brief + "</p><p class='meta'>" + roomSize(sec.size) + ' · ' + sec.matrices
    + (sec.matrices > 1 ? ' matrices' : ' matrix') + ' · quota ' + quota(R) + DI + '</p>'
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
    + '</b><p>' + rich(BOUNTIES[id].text(runCtx())) + "</p><small>reward: pick 1 of 2 once the matrix is over</small><button class='btn'>Got it</button></div>");
  const el = pane.querySelector<HTMLElement>('.bintro')!;
  el.onclick = () => el.remove();
}

// A ready Rewind, pointed at, shows what it does: the cell it frees, the lane it returns to, the slot it adds.
function rewindPeek(on: boolean) {
  const [lr, lc] = S.run.path[S.run.path.length - 1], back = { ...S.run, ...M.back };
  document.querySelectorAll<HTMLElement>('#grid .cell').forEach((c) => {
    const r = +c.id[1], k = +c.id[2];
    c.classList.toggle('undo', on && r === lr && k === lc);
    c.classList.toggle('rwlane', on && inLane(back, r, k, S.puzzle));
  });
  $('buffer').querySelector('.ghost')?.remove();
  // Before Throttle's locked slot, where the new slot will sit.
  const lock = $('buffer').querySelector('.lock');
  if (on) (lock ?? $('buffer')).insertAdjacentHTML(lock ? 'beforebegin' : 'beforeend', "<div class='slot ghost' aria-hidden='true'></div>");
}

function doRewind() {
  if (!rewind(B())) return;
  plan = [];
  stopPlan();
  logAct({ w: 1 });
  note('Rewind · last pick undone');
  render();
}

function doSplit(i: number, at?: number) {
  logAct({ s: i, at });
  note(toolName('split') + ' · split target ' + S.puzzle.targets[i].join(' '));
  ({ targets: S.puzzle.targets, worth: M.worth } = splitTarget(S.puzzle.targets, M.worth, i, at));
  M.split = false;
  M.tools = true;
  armed = null;
  render();
}

function applyCross() {
  // A plain pick here: the lane you would move into lights up (through the partner on a port).
  const pb = planning ? planBoard().board : B();
  const next = cursor && !armed && !S.over && !S.dealing && !offer.length && (planning ? planOk : canPick)(pb, cursor[0], cursor[1]) ? nextLane(pb.run, cursor[0], cursor[1], S.puzzle) : undefined;
  document.querySelectorAll<HTMLElement>('#grid .cell').forEach((el) => {
    const r = +el.id[1], c = +el.id[2];
    const x = !!cursor && (r === cursor[0] || c === cursor[1]);
    el.style.setProperty('--d', x ? (Math.abs(r - cursor![0]) + Math.abs(c - cursor![1])) * 3 + 'ms' : '0ms');
    el.classList.toggle('x', x);
    el.classList.toggle('nx', !!next && inLane(next, r, c, S.puzzle));
  });
  // Daemon lines read "name now +add": what it gives so far, then what this pick adds (highlighted); a loss shows "now → 0".
  const rot = R.stacks.rotate ?? 0;
  const peek: (Preview | string)[] = !cursor || S.mode !== 'run' || !legal(cursor[0], cursor[1]) ? []
    : armed === 'wild' ? ['place ** here'] : armed === 'jump' ? ['bridge jump']
    : armed === 'loop' ? ['loopback: ' + S.puzzle.grid[cursor[0]][cursor[1]] + ' again']
    : [...movePreview(S.run.path, cursor, S.puzzle.grid.length, R.daemons, M.jumps, S.puzzle.ports, M.stay),
      ...(cellView(B(), cursor[0], cursor[1]).tags.includes('node') ? [{ name: 'data node', add: '+' + nodeData(R.items), kind: 'data' as const }] : []),
      ...(R.daemons.includes('rotate') && !S.run.path.length
        ? [{ id: 'rotate' as const, name: 'rotate', now: rot ? String(ROTATE_DATA * rot) : undefined, kind: 'data' as const,
          ...(cursor[1] === R.lastStart ? { add: '→ 0', note: 'same column' } : { add: '+' + ROTATE_DATA }) }] : [])];
  // Name in the daemon's family colour; numbers in their own colours: data blue, boost and multipliers pink.
  $('peek').innerHTML = peek.map((p) => {
    if (typeof p === 'string') return p;
    const v = p.kind === 'data' ? 'vd' : 'vm', loss = p.add.startsWith('→');
    return (p.id ? "<span class='pname c-" + DAEMONS[p.id].family.toLowerCase() + "'>" + p.name + '</span>' : "<span class='gname'>" + p.name + '</span>')
      + (p.now ? ' <span class=\'' + v + (loss ? ' gone' : '') + "'>" + p.now + '</span>' : '')
      + " <b class='" + v + (loss ? '' : ' add') + "'>" + p.add + (p.kind === 'data' ? DI_SM : '') + '</b>' + (p.note ? " <span class='note'>" + p.note + '</span>' : '');
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
    const on = !!code && !S.over && !dark && !isEncrypted(bd, r, c) && g !== BLOCK && !isUsed(r, c) && !burning(S.run, r, c) && fits(g, code);
    el.classList.toggle('tpeek', on);
    el.classList.toggle('near', on && inLane(S.run, r, c, S.puzzle));
  });
  // The same code in every target, the hovered one included.
  document.querySelectorAll<HTMLElement>('#targets .codes span').forEach((sp) => sp.classList.toggle('tpeek', !!code && !dark && sp.textContent === code));
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
  // The planned pick clears its marker; any other pick drops the plan (and stops a running one).
  if (!armed && plan[0]?.[0] === r && plan[0][1] === c) plan.shift(); else { plan = []; stopPlan(); }
  logAct(armed ? { r, c, t: armed } : { r, c });
  const bd = B(), tool = armed, cell = rowName(r) + '·' + colName(c);
  const isUp = (t: string[]) => targetProgress(S.run.buffer, t, S.puzzle.l, false).done;
  const was = S.puzzle.targets.map(isUp);
  const placed = applyPick(bd, r, c) === 'placed';
  armed = bd.armed;
  if (placed) note((tool ? toolName(tool) + ' · ' : '') + 'placed on ' + cell);
  else {
    const up = S.puzzle.targets.filter((t, i) => !was[i] && isUp(t));
    note('pick ' + cell + ' → ' + S.run.buffer.at(-1) + (tool ? ' [' + toolName(tool) + ']' : '') + up.map((t) => ' · upload ' + t.join(' ')).join(''));
  }
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
  if (M.charge) { R.charges = (R.charges ?? 0) + 1; logEvent(R, '×2 data charge returned (Burner SIM)'); }
  note('Burner SIM · matrix dealt again');
  restartMatrix(R);
  newMatrix();
}

function useCharge() {
  if (M.charge || !R.charges || S.over) return;
  R.charges--;
  M.charge = true;
  logAct({ x: 1 });
  logEvent(R, '×2 data charge spent');
  note('×2 data charge spent');
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
    const goal = quota(R), before = R.data, room = sections(R)[R.section].name;
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
      ? matrixSummary(bill, credits) + btn('runNext', 'Next matrix ›').replace("<button class='btn go'", (canExitRoom(R)
        ? "<button class='btn' id='runExit' data-tip='Quota met: leave now and skip the rest of this room. +$" + EXIT_CREDIT + " per skipped matrix.'"
          + (claim ? ' disabled' : '') + '>Exit room · ' + money(EXIT_CREDIT * (sections(R)[R.section].matrices - played(R)), '+') + ' ›</button>' : '') + "<button class='btn go'")
      : out === 'section' || out === 'loop' ? roomSummary(bill, credits) + btn(out === 'loop' ? 'runLoop' : 'runSection', out === 'loop' ? 'Patch notes ›' : 'Exit room ›', 'go exit')
        : runSummary(out === 'win', bill, credits) + btn('runNew', 'New run').replace('</div>', "<button class='btn' id='exportLog'>Export log</button></div>"));
    if (out === 'win' || out === 'lose') $('exportLog').onclick = () => exportRun(out, bill);
    if (claim) $('claim').onclick = () => rollReward(M.bounty!, M.rewards);
    playBill(bill, room, before, goal);
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

// The matrix bill plays out step by step: a big tally (data × mult = total) starts at zero and each bill row, as it
// slides in, adds its part; then the room line under it fills. The finish heats up with how far the matrix alone goes
// past the room quota (½, 1×, 2×). A click anywhere in the dialog skips to the end.
function playBill(sc: Score, room: string, before: number, goal: number) {
  const box = $('modalBox'), bill = box.querySelector<HTMLTableElement>('table.calc');
  if (!bill) return;
  const total = sc.total, after = before + total, ratio = total / goal;
  const heat = ratio >= 2 ? 3 : ratio >= 1 ? 2 : ratio >= 0.5 ? 1 : 0;
  bill.insertAdjacentHTML('beforebegin', "<div class='btally'><div class='tf'><span class='td'>0</span>" + DI_SM + "<i>×</i><span class='tm'>1</span><i>=</i><b class='tt'>0</b></div>"
    + "<div class='troom'><span>" + room + "</span> <b class='trv'>" + before + '</b> / ' + goal + "<i class='tbar'><i class='tfill'></i></i></div><div class='tstamp'></div></div>");
  const tally = box.querySelector<HTMLElement>('.btally')!, q = (s: string) => tally.querySelector<HTMLElement>(s)!;
  const [td, tm, tt, trv, fill, stamp] = ['.td', '.tm', '.tt', '.trv', '.tfill', '.tstamp'].map(q);
  const rows = [...bill.rows];
  // One step per bill row, in billHtml's order: targets, daemons, items, ICE, charge, then the sum.
  const fx: Effect[] = [{ flat: sc.base }, ...sc.fired.map((f) => f[1]), ...sc.gear.map((g) => g[1]), ...sc.ice.map((i) => i[1]), ...(sc.charge ? [{ mult: 2 }] : [])];
  let data = 0, boost = 0, mult = 1, done = false;
  // Each number keeps the width of its widest step, so counting up never shifts the line.
  const w = [0, 0, 0];
  fx.forEach((e) => { data += e.flat ?? 0; boost += e.boost ?? 0; mult *= e.mult ?? 1; [data, num((1 + boost) * mult), Math.floor(data * (1 + boost) * mult)].forEach((v, i) => { w[i] = Math.max(w[i], String(v).length); }); });
  [td, tm, tt].forEach((el, i) => { el.style.minWidth = w[i] + 'ch'; });
  trv.style.minWidth = String(after).length + 'ch';
  data = 0; boost = 0; mult = 1;
  const timers: number[] = [];
  const fmtM = (m: number) => num(m);
  const bump = (el: HTMLElement) => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  const roll = (el: HTMLElement, from: number, to: number, ms: number, show = (n: number) => String(Math.round(n))) => {
    const t0 = performance.now();
    const f = (t: number) => {
      if (done) return;
      const p = Math.min(1, (t - t0) / ms);
      el.textContent = show(from + (to - from) * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };
  const restart = (el: HTMLElement, c: string) => { el.classList.remove(c); void el.offsetWidth; el.classList.add(c); };
  const glyph = () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)];
  const setRoom = (v: number) => {
    trv.textContent = String(Math.round(v));
    fill.style.width = Math.min(100, (v / goal) * 100) + '%';
    tally.classList.toggle('over', v >= goal);
  };
  // The total decodes like a cracked code: digits scramble and settle left to right (slow), or the whole number
  // scrambles and settles at once (quick, for the idle bursts). No flash on settling.
  const decode = (v: string, quick: boolean, then: () => void) => {
    tt.innerHTML = [...v].map(() => '<span>0</span>').join('');
    const sp = [...tt.children] as HTMLElement[];
    const at = (i: number) => (quick ? 7 : 6 + i * 4);
    let t = 0;
    const iv = window.setInterval(() => {
      t++;
      sp.forEach((s, i) => { s.textContent = t >= at(i) ? v[i] : glyph(); });
      if (t >= at(v.length - 1)) { clearInterval(iv); tt.textContent = v; then(); }
    }, 40);
  };
  // Overload: on top of the steady subtle glitch, a tear every 1.5–4 s for as long as the dialog is open.
  const idle = (v: string) => window.setTimeout(() => {
    if (!tally.isConnected) return;
    restart(tt, 'b-tear');
    idle(v);
  }, 1500 + Math.random() * 2500);
  const finish = () => {
    if (heat) tally.classList.add('heat' + heat);
    tally.classList.toggle('clear', after >= goal);
    tt.dataset.t = String(total);
    if (heat < 2) return;
    stamp.textContent = heat === 3 ? 'critical overload ×' + ratio.toFixed(1) : 'overload';
    // The final decode ends on a tear instead of a flash.
    decode(String(total), false, () => { restart(tt, 'b-tear'); tt.classList.add('unstable'); idle(String(total)); });
  };
  const end = () => {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    rows.forEach((r) => r.classList.remove('pre'));
    td.textContent = String(sc.base + sc.flat);
    tm.textContent = fmtM((1 + sc.boost) * sc.mult);
    tt.textContent = String(total);
    setRoom(after);
    finish();
  };
  rows.forEach((r) => r.classList.add('pre'));
  setRoom(before);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return end();
  const STEP = 420;
  fx.forEach((e, i) => timers.push(window.setTimeout(() => {
    rows[i]?.classList.remove('pre');
    const d0 = data, m0 = (1 + boost) * mult, t0 = Math.floor(d0 * m0);
    data += e.flat ?? 0;
    boost += e.boost ?? 0;
    mult *= e.mult ?? 1;
    const m1 = (1 + boost) * mult, t1 = Math.floor(data * m1);
    if (data !== d0) {
      roll(td, d0, data, 260);
      // A big add (20+) flickers the number; every add floats its +N above it.
      restart(td, Math.abs(data - d0) >= 20 ? 'dflick' : 'bump');
      td.insertAdjacentHTML('beforeend', "<i class='dpop'>" + (data > d0 ? '+' : '') + (data - d0) + '</i>');
    }
    if (m1 !== m0) {
      tm.textContent = fmtM(m1);
      tm.classList.remove('unstable');
      restart(tm, 'bump');
      if (m1 >= 4) timers.push(window.setTimeout(() => tm.classList.add('unstable'), 500));
    }
    roll(tt, t0, t1, 300);
    restart(tt, 'bump');
  }, 200 + i * STEP)));
  const sumAt = 200 + fx.length * STEP;
  timers.push(window.setTimeout(() => {
    rows.forEach((r) => r.classList.remove('pre'));
    tt.textContent = String(total);
    restart(tt, 'bump');
    const t0 = performance.now();
    const f = (t: number) => {
      if (done) return;
      const p = Math.min(1, (t - t0) / 600);
      setRoom(before + total * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(f); else { done = true; finish(); }
    };
    requestAnimationFrame(f);
  }, sumAt));
  box.addEventListener('pointerdown', end, { once: true });
}

// Quota met early: close the room now and show its summary, the way its last matrix would.
function exitEarly() {
  exitRoom(R);
  const credits = R.earned.map(([why, n]) => "<p class='meta'>" + (n ? money(n, '+') + ' · ' : '') + why + '</p>').join('');
  showResult(true, roomSummary(lastBill!, credits)
    + "<div class='row'><button class='btn' id='viewMatrix'>View matrix</button><button class='btn go exit' id='runSection'>Exit room ›</button></div>");
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
  on('runExit', exitEarly);
  on('runSection', () => { nextSection(R); showOffer(); });
  on('runLoop', () => { nextSection(R); showPatch(); });
  on('runNew', () => setMode('run'));
  on('viewMatrix', () => peek());
  on('toTrain', () => setMode('train'));
  on('sprintAgain', () => setMode('sprint'));
  on('retrySprint', () => setMode('sprint', S.seed, S.challenge));
  wireCopy('share', () => $('shareTxt').textContent ?? '');
}

// The dialog steps aside to show the board; a click or Esc brings it back. Offer and shop open at the top: the run and rooms left.
function peek(top = false) {
  const m = $('modal');
  m.classList.add('peek');
  if (top) scrollTo(0, 0); else $('grid').scrollIntoView({ block: 'center' });
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
      sv.R.daemons = sv.R.daemons.filter((d) => d in DAEMONS); // a daemon removed from the game drops out of old saves
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
  // With icons inside, only the leading text scrambles; the icons stay put.
  const node = el.childElementCount && el.firstChild?.nodeType === Node.TEXT_NODE ? el.firstChild : el;
  let frame = 0;
  const id = setInterval(() => {
    frame++;
    node.textContent = [...word].map((ch, i) => (frame > lead + i * perChar ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join('');
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
    const n = S.puzzle.grid.length, cols = S.puzzle.grid[0].length, span = d[0] ? n : cols;
    const r0 = +cur.id[1], c0 = +cur.id[2];
    let i = 1, r = r0, c = c0;
    for (; i < span; i++) {
      r = (((r0 + d[0] * i) % n) + n) % n;
      c = (((c0 + d[1] * i) % cols) + cols) % cols;
      if (legal(r, c)) break;
    }
    if (i === span) return;
    const next = $('c' + r + c);
    cur.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  });
  $('modeDaily').onclick = () => setMode('daily');
  $('modeTrain').onclick = () => setMode('train');
  $('modeSprint').onclick = () => setMode('sprint');
  $('modeRun').onclick = () => setMode('run');
  $('catalogBtn').onclick = () => showCatalog(null);
  $('logBtn').onclick = showLog;
  $('planBtn').onclick = () => { stopPlan(); planning = !planning; render(); };
  $('runPlanBtn').onclick = () => { if (planTimer) { stopPlan(); render(); } else runPlan(); };
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
