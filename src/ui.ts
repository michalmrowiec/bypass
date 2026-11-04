import { generate, hashStr, SIZES, type Puzzle, type SizeKey } from './generator';
import {
  MAX_TRIES, SPRINTS, type ChallengeKind, type SprintLen, challengeQuery, isFinished, isLegal, newRun, parseChallenge, pick, score,
  stageSeed, targetProgress,
} from './game';
import { canComplete } from './solver';
import { RUN_MATRIX } from './roguelike';
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
const legal = (r: number, c: number) => !S.over && !S.dealing && isLegal(S.run, r, c);
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
  $('laneLabel').textContent = S.over ? 'session closed'
    : axis === 'row' ? 'pick in row ' + addr(idx) : 'pick in col +' + idx;
  const buf = $('buffer');
  buf.innerHTML = '';
  for (let i = 0; i < l; i++) {
    const s = document.createElement('div');
    s.className = 'slot' + (buffer[i] ? ' filled' : '') + (i === buffer.length - 1 && !S.over ? ' new' : '');
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
    el.innerHTML = '<div class="codes">' + t.map((c, j) => '<span class="' + (j < st.k ? 'hit' : '') + '">' + c + '</span>').join('')
      + '</div><div class="state">' + (st.done ? 'Uploaded' : st.fail ? 'Failed' : 'Target ' + (i + 1)) + '</div>';
    tg.appendChild(el);
    if (st.done && !doneSeen.has(i)) {
      doneSeen.add(i);
      el.classList.add('just');
      scramble(el.querySelector<HTMLElement>('.state')!, 'Uploaded', 2, 1, 40);
    }
  });
  const extra = S.mode === 'daily' ? '<span>Try <b>' + S.tries + '/' + MAX_TRIES + '</b></span>'
    : (S.mode === 'sprint' ? '<span>Matrix <b>' + Math.min(S.stage + 1, stages().length) + '/' + stages().length + '</b></span>' : '')
      + (S.challenge ? '<span>Beat <b>' + fmt(S.challenge) + '</b></span>' : S.mode === 'train' ? '<span>Training</span>' : '');
  $('status').innerHTML = "<span>Time <b id='clock'>" + clockText() + '</b></span>' + extra;
  $('timebar').hidden = S.mode !== 'sprint' || S.over;
  updateBar();
  applyCross();
}

function applyCross() {
  document.querySelectorAll<HTMLElement>('#grid .cell').forEach((el) =>
    el.classList.toggle('x', !!cursor && (+el.id[1] === cursor[0] || +el.id[2] === cursor[1])));
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
  if (isFinished(S.run, S.puzzle) || !canComplete(S.run, S.puzzle)) {
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

function finish(sc: number) {
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
    html = '<h2>' + sc + '/' + S.puzzle.targets.length + " uploaded</h2><div class='row'><button class='btn' id='next'>New matrix</button></div>";
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
  on('next', () => setMode(S.mode === 'run' ? 'run' : 'train'));
  on('toTrain', () => setMode('train'));
  on('sprintAgain', () => setMode('sprint'));
  on('retrySprint', () => setMode('sprint', S.seed, S.challenge));
  wireCopy('share', () => $('shareTxt').textContent ?? '');
}

function resetRun() {
  clearInterval(S.timer);
  Object.assign(S, { run: newRun(), start: 0, elapsed: 0, over: false, stage: 0, dealing: false });
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
    $('meta').textContent = 'Run · prototype';
    S.seed = seed;
    S.puzzle = generate(seed, RUN_MATRIX);
    resetRun();
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
