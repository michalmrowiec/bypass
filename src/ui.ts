import { generate, hashStr, L, N, type Puzzle } from './generator';
import { MAX_TRIES, isFinished, isLegal, newRun, pick, score, targetProgress } from './game';
import { dayNumber, load, save, utcDate } from './storage';

type Mode = 'daily' | 'train';
interface DailyRecord { score: number; tries: number; time: number }

const $ = (id: string) => document.getElementById(id)!;

const S = {
  mode: 'daily' as Mode,
  puzzle: { grid: [], targets: [] } as Puzzle,
  run: newRun(),
  tries: 1,
  start: 0,
  elapsed: 0,
  timer: 0,
  over: false,
};
const dailyKey = () => 'bypass:' + utcDate();

const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const now = () => (S.start ? (S.over ? S.elapsed : Date.now() - S.start) : 0);
const legal = (r: number, c: number) => !S.over && isLegal(S.run, r, c);

function render() {
  const { grid, targets } = S.puzzle;
  const { buffer, used, axis, idx } = S.run;
  const g = $('grid');
  g.innerHTML = '';
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
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
  (g.querySelector<HTMLElement>('.cell.ok') ?? (g.firstElementChild as HTMLElement)).tabIndex = 0;
  $('laneLabel').textContent = S.over ? 'Session closed'
    : buffer.length === 0 ? 'Pick a code in the top row'
    : axis === 'row' ? 'Pick in row ' + (idx + 1) : 'Pick in column ' + 'ABCDEF'[idx];
  const buf = $('buffer');
  buf.innerHTML = '';
  for (let i = 0; i < L; i++) {
    const s = document.createElement('div');
    s.className = 'slot' + (buffer[i] ? ' filled' : '');
    s.textContent = buffer[i] ?? '';
    buf.appendChild(s);
  }
  const tg = $('targets');
  tg.innerHTML = '';
  targets.forEach((t, i) => {
    const st = targetProgress(buffer, t, S.over);
    const el = document.createElement('div');
    el.className = 'target' + (st.done ? ' done' : st.fail ? ' fail' : '');
    el.innerHTML = '<div class="codes">' + t.map((c, j) => '<span class="' + (j < st.k ? 'hit' : '') + '">' + c + '</span>').join('')
      + '</div><div class="state">' + (st.done ? 'Uploaded' : st.fail ? 'Failed' : 'Target ' + (i + 1)) + '</div>';
    tg.appendChild(el);
  });
  $('status').innerHTML = "<span>Time <b id='clock'>" + fmt(now()) + '</b></span>'
    + (S.mode === 'daily' ? '<span>Try <b>' + S.tries + '/' + MAX_TRIES + '</b></span>' : '<span>Training</span>');
}

function choose(r: number, c: number) {
  if (!legal(r, c)) return;
  if (!S.start) {
    S.start = Date.now();
    S.timer = window.setInterval(() => { const el = document.getElementById('clock'); if (el) el.textContent = fmt(now()); }, 250);
  }
  pick(S.run, S.puzzle, r, c);
  if (isFinished(S.run, S.puzzle)) finish(score(S.run.buffer, S.puzzle.targets));
  const hadFocus = document.activeElement?.classList.contains('cell');
  render();
  document.getElementById('c' + r + c)?.classList.add('flash');
  if (hadFocus) document.querySelector<HTMLElement>('.cell.ok')?.focus();
}

function finish(sc: number) {
  S.over = true;
  S.elapsed = Date.now() - S.start;
  clearInterval(S.timer);
  const win = sc === 3;
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
  } else {
    html = '<h2>' + (win ? 'Access granted' : sc + '/3 uploaded') + '</h2><p>Time ' + fmt(S.elapsed)
      + "</p><div class='row'><button class='btn' id='again'>Retry this one</button><button class='btn' id='next'>New matrix</button></div>";
  }
  showResult(win, html);
}

function shareText(rec: DailyRecord) {
  const bars = '▮'.repeat(rec.score) + '▯'.repeat(3 - rec.score);
  return 'BYPASS #' + String(dayNumber()).padStart(3, '0') + '\n'
    + bars + ' ' + rec.score + '/3 · try ' + rec.tries + '/' + MAX_TRIES + ' · ' + fmt(rec.time) + '\n'
    + location.origin + location.pathname;
}

const resultHtml = (rec: DailyRecord) =>
  '<h2>' + (rec.score === 3 ? 'Access granted' : 'Locked out') + "</h2><pre id='shareTxt'>" + shareText(rec)
  + "</pre><div class='row'><button class='btn' id='share'>Copy result</button><button class='btn' id='toTrain'>Play training</button></div><p class='meta'>New matrix tomorrow.</p>";

function showResult(win: boolean, html: string) {
  const res = $('result');
  res.hidden = false;
  res.className = 'result' + (win ? ' win' : '');
  res.innerHTML = html;
  const on = (id: string, fn: () => void) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('retry', () => { S.tries++; resetRun(); });
  on('again', () => resetRun());
  on('next', () => { S.puzzle = generate(Math.floor(Math.random() * 1e9)); resetRun(); });
  on('toTrain', () => setMode('train'));
  on('share', async () => {
    const txt = $('shareTxt').textContent ?? '';
    try {
      await navigator.clipboard.writeText(txt);
      $('share').textContent = 'Copied';
    } catch {
      let ta = document.getElementById('copyFallback') as HTMLTextAreaElement | null;
      if (!ta) { ta = document.createElement('textarea'); ta.id = 'copyFallback'; ta.value = txt; res.appendChild(ta); }
      ta.select();
    }
  });
}

function resetRun() {
  clearInterval(S.timer);
  Object.assign(S, { run: newRun(), start: 0, elapsed: 0, over: false });
  $('result').hidden = true;
  render();
}

function setMode(m: Mode) {
  S.mode = m;
  $('modeDaily').setAttribute('aria-pressed', String(m === 'daily'));
  $('modeTrain').setAttribute('aria-pressed', String(m === 'train'));
  S.tries = 1;
  if (m === 'daily') {
    $('meta').textContent = 'Daily #' + String(dayNumber()).padStart(3, '0') + ' · ' + utcDate();
    S.puzzle = generate(hashStr('bypass-' + utcDate()));
    resetRun();
    const rec = load<DailyRecord>(dailyKey());
    if (rec) { S.over = true; render(); showResult(rec.score === 3, resultHtml(rec)); }
  } else {
    $('meta').textContent = 'Training · unlimited';
    S.puzzle = generate(Math.floor(Math.random() * 1e9));
    resetRun();
  }
}

const MOVES: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

export function init() {
  $('grid').addEventListener('keydown', (e) => {
    const d = MOVES[e.key];
    const cur = e.target as HTMLElement;
    if (!d || !cur.classList.contains('cell')) return;
    e.preventDefault();
    // Jump to the next pickable cell; arrows leading out of the active lane find none and do nothing.
    let r = +cur.id[1], c = +cur.id[2];
    do { r += d[0]; c += d[1]; if (r < 0 || r >= N || c < 0 || c >= N) return; } while (!legal(r, c));
    const next = $('c' + r + c);
    cur.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  });
  $('modeDaily').onclick = () => setMode('daily');
  $('modeTrain').onclick = () => setMode('train');
  setMode('daily');
}
