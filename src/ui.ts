import { generate, hashStr, SIZES, type Puzzle, type SizeKey } from './generator';
import {
  MAX_TRIES, SPRINTS, contains, type ChallengeKind, type SprintLen, challengeQuery, isFinished, isLegal, newRun, parseChallenge, pick, score,
  stageSeed, targetProgress,
} from './game';
import { canComplete } from './solver';
import {
  coverage, DAEMON_SLOTS, DAEMONS, SLOTS_PER_CREDIT, DATA_BY_LEN, finishMatrix, isCorner, movePreview, newRunState, nextSection, offerDaemons, scoreMatrix,
  SECTIONS, sectionMatrix, type DaemonId, type Effect, type MatrixCtx, type MatrixOutcome, type RunState, type Score,
} from './roguelike';
import { dayNumber, firstResult, load, recordFirst, save, utcDate } from './storage';

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
// Targets already shown as uploaded, so the upload effect plays only once.
const doneSeen = new Set<number>();
// Cell under the mouse or keyboard focus, for the crosshair highlight.
let cursor: [number, number] | null = null;
const dailyKey = () => 'bypass:' + utcDate();
const sprintBestKey = () => 'bypass:sprintBestMs:' + S.sprintLen;
const stages = () => SPRINTS[S.sprintLen];
const challengeKind = (): ChallengeKind => (S.mode === 'sprint' ? (('sprint' + S.sprintLen) as ChallengeKind) : S.size);

const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '.' + String(Math.floor(ms) % 1000).padStart(3, '0'); };
const now = () => (S.start ? (S.over ? S.elapsed : Date.now() - S.start) : 0);
const clockText = () => fmt(now());
const legal = (r: number, c: number) => !S.over && !S.dealing && !offer.length && isLegal(S.run, r, c);
const randomSeed = () => Math.floor(Math.random() * 1e9);
const addr = (r: number) => '0x' + (r * 16).toString(16).toUpperCase().padStart(2, '0');

function render() {
  const { grid, targets, l } = S.puzzle;
  const n = grid.length;
  const { buffer, used, axis, idx } = S.run;
  const g = $('grid');
  g.innerHTML = '';
  g.style.gridTemplateColumns = 'auto repeat(' + n + ',minmax(0,1fr))';
  // Hex-dump headers: column offsets on top, row addresses on the left; the active lane's header lights up.
  const hx = (text: string, on: boolean) => {
    const h = document.createElement('div');
    h.className = 'hx' + (on && !S.over ? ' on' : '');
    h.textContent = text;
    h.setAttribute('aria-hidden', 'true');
    g.appendChild(h);
  };
  hx('', false);
  for (let c = 0; c < n; c++) hx('+' + c, axis === 'col' && c === idx);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (c === 0) hx(addr(r), axis === 'row' && r === idx);
    const b = document.createElement('button');
    b.className = 'cell';
    b.id = 'c' + r + c;
    b.textContent = grid[r][c];
    if (!S.over && (axis === 'row' ? r === idx : c === idx)) b.classList.add('lane');
    if (used.has(r + ',' + c)) b.classList.add('used');
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
  $('laneLabel').textContent = offer.length ? 'choose a daemon' : S.over ? 'session closed'
    : axis === 'row' ? 'pick in row ' + addr(idx) : 'pick in col +' + idx;
  const buf = $('buffer');
  buf.innerHTML = '';
  const has = (id: DaemonId) => S.mode === 'run' && R.daemons.includes(id);
  const cover = has('chain') || has('compressor') ? coverage(buffer, targets) : [];
  for (let i = 0; i < l; i++) {
    const s = document.createElement('div');
    s.className = 'slot' + (buffer[i] ? ' filled' : '') + (i === buffer.length - 1 && !S.over ? ' new' : '')
      + (cover[i] >= 2 ? ' shared' : '') + (has('light') && i === Math.floor(l / 2) - 1 ? ' half' : '');
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
    el.className = 'target' + (st.done ? ' done' : st.fail ? ' fail' : '');
    const worth = S.mode === 'run' ? ' +' + DATA_BY_LEN[t.length] : '';
    const state = st.done ? 'Uploaded' + worth : st.fail ? 'Failed' : worth ? worth.trim() + ' data' : 'Target ' + (i + 1);
    el.innerHTML = '<div class="codes">' + t.map((c, j) => '<span class="' + (j < st.k ? 'hit' : '') + '">' + c + '</span>').join('')
      + '</div><div class="state">' + state + '</div>';
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
  document.getElementById('restartMatrix')?.addEventListener('click', () => { R.restarts--; dealMatrix(); });
  document.getElementById('disconnect')?.addEventListener('click', () => { finish(score(S.run.buffer, S.puzzle.targets), true); render(); });
  if (S.mode === 'run') { renderDaemons(); renderSteps(); }
  $('timebar').hidden = S.mode !== 'sprint' || S.over;
  updateBar();
  applyCross();
}

const runCtx = (): MatrixCtx =>
  ({ buf: S.run.buffer, path: S.run.path, targets: S.puzzle.targets, l: S.puzzle.l, n: S.puzzle.grid.length });

// Data shows the live total with the current matrix's score; once the matrix is over it is banked in R.data.
function runStatus() {
  const live = S.over ? 0 : scoreMatrix(runCtx(), R).total;
  const restart = !S.start && !S.over && !offer.length && R.restarts ? "<button class='btn act' id='restartMatrix'>Restart matrix (" + R.restarts + ')</button>' : '';
  // Ending early keeps the empty slots, which pay credits.
  const pay = Math.floor((S.puzzle.l - S.run.buffer.length) / SLOTS_PER_CREDIT) + (R.daemons.includes('silent') ? 2 : 0);
  const disconnect = live ? "<button class='btn act' id='disconnect'>Disconnect" + (pay ? ' · +' + pay + (pay > 1 ? ' credits' : ' credit') : '') + '</button>' : '';
  return '<span>Data <b>' + (R.data + live) + '/' + SECTIONS[R.section].quota + '</b></span>'
    + '<span>Credits <b>' + R.credits + '</b></span>' + restart + disconnect;
}

// Score reads as data × boost: data = target data + flat bonuses, boost = (1 + additive boosts) × multipliers.
const num = (x: number) => String(Number(x.toFixed(2)));
const scoreHtml = (sc: Score) => "<span class='vd'>" + (sc.base + sc.flat) + "</span> × <span class='vm'>"
  + num((1 + sc.boost) * sc.mult) + '</span> = <b>' + sc.total + '</b>' + (sc.base ? '' : '<small>upload a target to score</small>');

const fmtEffect = (e: Effect) => [e.flat && "<span class='vd'>+" + e.flat + ' data</span>',
  e.boost && "<span class='vm'>+" + e.boost + ' boost</span>', e.mult && "<span class='vm'>×" + e.mult + '</span>'].filter(Boolean).join(' ');

const shownScore: string[] = [];

// Owned daemons; one that counts toward the current matrix lights up and shows what it adds.
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
  $('daemons').innerHTML = R.daemons.map((id) => {
    const d = DAEMONS[id];
    const e = fired.get(id);
    const extra = id === 'cache' && R.cache ? ' (now +' + R.cache + ')' : '';
    return "<div class='daemon" + (e ? ' on' : '') + "'><b>" + d.name + '</b>' + famTag(d.family) + (e ? '<i>' + fmtEffect(e) + '</i>' : '') + '<span>'
      + d.text + extra + '</span></div>';
  }).join('') || "<p class='hint'>none yet</p>";
}

// Contract stepper: rooms in order, one box per matrix with the score it banked; the live box is the matrix in play.
function renderSteps() {
  const live = S.over ? null : scoreMatrix(runCtx(), R).total;
  $('stepList').innerHTML = SECTIONS.map((sec, i) => {
    const got = R.scores[i];
    const state = i < R.section ? 'done' : i === R.section ? 'now' : '';
    const boxes = Array.from({ length: sec.matrices }, (_, j) => {
      if (j < got.length) return "<span class='box " + (got[j] ? 'ok' : 'zero') + "'>" + got[j] + '</span>';
      return i === R.section && j === got.length && live !== null ? "<span class='box live'>" + (live || '··') + '</span>' : "<span class='box'></span>";
    }).join('');
    const total = i === R.section ? R.data + (live ?? 0) : got.reduce((a, b) => a + b, 0);
    return "<div class='step " + state + "'><span class='sname'>" + sec.name + "</span><span class='squota'>"
      + (state ? total + '/' : 'quota ') + sec.quota + "</span><div class='boxes'>" + boxes + '</div></div>';
  }).join("<span class='sarrow' aria-hidden='true'>›</span>");
}

// Matrix bill: the uploads, each daemon that fired and what it added, then the formula.
const billHtml = (sc: Score) => "<table class='calc'><tr><td>targets</td><td><span class='vd'>" + sc.base + ' data</span></td></tr>'
  + sc.fired.map(([id, e]) => '<tr><td>' + DAEMONS[id].name + '</td><td>' + fmtEffect(e) + '</td></tr>').join('')
  + "<tr class='sum'><td>matrix</td><td>" + scoreHtml(sc) + '</td></tr></table>';

const famTag = (f: string) => "<span class='fam fam-" + f.toLowerCase() + "'>" + f + '</span>';

function showOffer() {
  offer = offerDaemons(R);
  if (!offer.length) return;
  render();
  showResult(true, '<h2>Choose a daemon</h2><p class="meta">Free to take · slots ' + R.daemons.length + '/' + DAEMON_SLOTS + '</p>'
    + offer.map((id) => "<button class='btn pick' id='pick-" + id + "'><b>" + DAEMONS[id].name
    + '</b>' + famTag(DAEMONS[id].family) + '<br><span>' + DAEMONS[id].text + '</span></button>').join('')
    + "<div class='row'><button class='btn' id='skipDaemon'>Skip · take none</button></div>");
  const close = () => { offer = []; $('result').hidden = true; render(); focusGrid(); };
  for (const id of offer) $('pick-' + id).onclick = () => { R.daemons.push(id); close(); };
  $('skipDaemon').onclick = close;
}

function dealMatrix() {
  $('meta').textContent = 'Run · ' + SECTIONS[R.section].name + ' ' + (R.section + 1) + '/' + SECTIONS.length;
  S.puzzle = generate(stageSeed(R.seed, R.matrix++), sectionMatrix(R.section));
  resetRun();
}

function applyCross() {
  document.querySelectorAll<HTMLElement>('#grid .cell').forEach((el) =>
    el.classList.toggle('x', !!cursor && (+el.id[1] === cursor[0] || +el.id[2] === cursor[1])));
  const peek = cursor && S.mode === 'run' && legal(cursor[0], cursor[1])
    ? movePreview(S.run.path, cursor, S.puzzle.grid.length, R.daemons) : [];
  $('peek').textContent = peek.join(' · ');
  // Echo the code under the cursor in the targets, but only for a cell that can be picked right now.
  const code = cursor && legal(cursor[0], cursor[1]) ? S.puzzle.grid[cursor[0]]?.[cursor[1]] : undefined;
  document.querySelectorAll<HTMLElement>('#targets .codes span').forEach((s) => s.classList.toggle('peek', s.textContent === code));
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
  if (!S.start) { S.start = S.stageStart = Date.now(); S.timer = window.setInterval(tick, 31); }
  pick(S.run, S.puzzle, r, c);
  // A dead end (targets no longer reachable) ends the round right away.
  // Run mode only stops once no remaining target can still be uploaded; the others need all of them.
  const stuck = S.mode === 'run'
    ? !S.puzzle.targets.some((t) => !contains(S.run.buffer, t) && canComplete(S.run, { ...S.puzzle, targets: [t] }))
    : !canComplete(S.run, S.puzzle);
  if (isFinished(S.run, S.puzzle) || stuck) {
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
    const sec = SECTIONS[R.section];
    const [title, btn, label] = ({
      continue: ['+' + bill.total + ' data', 'runNext', 'Next matrix'],
      section: [sec.name + ' breached', 'runSection', 'Next section'],
      win: ['Contract complete', 'runNew', 'New run'],
      lose: ['Run over', 'runNew', 'New run'],
    } as Record<MatrixOutcome, string[]>)[out];
    const credits = R.earned.map(([why, n]) => "<p class='meta'>+" + n + (n > 1 ? ' credits' : ' credit') + ' · ' + why + '</p>').join('');
    showResult(out === 'win' || out === 'section' || (out === 'continue' && bill.total > 0),
      '<h2>' + title + '</h2>' + billHtml(bill) + '<p>' + sec.name + ' ' + R.data + '/' + sec.quota + '</p>' + credits
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

function showResult(win: boolean, html: string) {
  const res = $('result');
  res.hidden = false;
  res.className = 'result' + (win ? ' win' : '');
  res.innerHTML = html;
  const h2 = res.querySelector('h2');
  if (h2) scramble(h2, h2.textContent ?? '', 2, 1, 35);
  const on = (id: string, fn: () => void) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('retry', () => { S.tries++; resetRun(); });
  on('again', () => resetRun());
  on('next', () => setMode('train'));
  on('runNext', dealMatrix);
  on('runSection', () => { nextSection(R); dealMatrix(); showOffer(); });
  on('runNew', () => setMode('run'));
  on('toTrain', () => setMode('train'));
  on('sprintAgain', () => setMode('sprint'));
  on('retrySprint', () => setMode('sprint', S.seed, S.challenge));
  wireCopy('share', () => $('shareTxt').textContent ?? '');
}

function resetRun() {
  clearInterval(S.timer);
  Object.assign(S, { run: newRun(), start: 0, elapsed: 0, over: false, stage: 0, dealing: false });
  offer = [];
  doneSeen.clear();
  $('result').hidden = true;
  pour();
}

function setMode(m: Mode, seed = randomSeed(), challenge: number | null = null) {
  S.mode = m;
  S.challenge = challenge;
  S.tries = 1;
  $('modeDaily').setAttribute('aria-pressed', String(m === 'daily'));
  $('modeTrain').setAttribute('aria-pressed', String(m === 'train'));
  $('modeSprint').setAttribute('aria-pressed', String(m === 'sprint'));
  $('modeRun').setAttribute('aria-pressed', String(m === 'run'));
  $('sizes').hidden = m !== 'train';
  $('sprintLen').hidden = m !== 'sprint';
  $('daemonPane').hidden = m !== 'run';
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
    R = newRunState(seed);
    dealMatrix();
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
