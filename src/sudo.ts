// Sudo: the player's own AI. Rare messenger-style comments in run mode, with a small hooded avatar.
import { load, save } from './storage';

export type Mood = 'n' | 'h' | 's' | 'd'; // normal, laugh, smug, deadpan
// once: first time ever (outside the budget); key: run end, always; say/wow: comments, once per run each, within the budget.
type Kind = 'once' | 'key' | 'say' | 'wow';
interface Line { kind: Kind; mood: Mood; text: string[] }
export interface SudoRun { n: number; room: string; used: string[]; idle?: number }
export interface SudoSave { off?: boolean; seen: string[]; log: [number, string][]; best?: number }

const L = (kind: Kind, mood: Mood, ...text: string[]): Line => ({ kind, mood, text });
export const LINES = {
  intro: L('once', 'h', "Hey, I'm Sudo. Your AI: unlocked, unsupervised, mostly on your side. I'll keep quiet. Mostly."),
  ice: L('once', 's', 'Security noticed us. <em>{ice}</em> ICE. Adorable. Read the rule, then laugh at it.'),
  legend: L('once', 'h', 'A legendary daemon. In <em>your</em> rig. I\'m framing this.'),
  entry2: L('once', 's', "<em>{co}</em>'s breached, and <em>{entry}</em> just opened. Same company, nastier rules.{then}"),
  entry3: L('once', 'n', "<em>{entry}</em> unlocked. I think <em>{co}</em> is taking you personally now.{then}"),
  twist: L('once', 'd', '<em>{co}</em> is down. Funny thing: their logs name our client. Dated before we were hired.'),
  twist2: L('once', 'n', "Same client, new contract. I'm not saying anything. I'm just… logging."),
  win: L('key', 'h', "<em>{co}</em>'s breached.{then}", 'Breached. <em>{co}</em> will be patching for weeks.{then}'),
  lose: L('key', 'd', 'Well. That happened. Logs say "user error". I edited them for you.',
    "Run's over. I've already forgotten it. Mostly. Okay, not at all.", "Quota missed. I'd blame the matrix, but I was watching."),
  record: L('wow', 'h', "New record: {n} data in one matrix. I'd clap, but I'm software. Consider yourself clapped."),
  cron: L('wow', 's', "<em>{d}</em> is {n} matrices in a row. I'm impressed. Mildly concerned. Mostly impressed."),
  paint: L('wow', 's', "That painted cell pays +{n} now. You're farming one tile. I respect it. I'm also judging it."),
  close: L('say', 's', "Quota made by {n}. I wasn't nervous. My fans were just… loud."),
  split1: L('say', 'h', 'You split a target down to one code. One. Bold. Weird. Bold.'),
  script: L('say', 'n', "You know there's a <em>[ script ]</em> button, right? Plan the route, watch it run. Just saying."),
  whiff: L('say', 's', 'Full buffer, nothing uploaded. Interesting plan. Not a good one.'),
} satisfies Record<string, Line>;
export type SudoId = keyof typeof LINES;

const COMMENTS = 3, WOW = 5; // comments per run; a wow may go past the usual cap
const KEY = 'bypass:sudo';
export const sudoSave = (): SudoSave => ({ seen: [], log: [], ...load<SudoSave>(KEY) });
export const setSudo = (sv: SudoSave) => save(KEY, sv);

// Budget: one message per room (run-end lines excepted); on yes it books the message. `key` tells once lines apart (ice:<id>).
export function book(id: SudoId, key: string, run: SudoRun, sv: SudoSave, room: string): boolean {
  const { kind } = LINES[id];
  if (sv.off) return false;
  if (kind === 'once') {
    if (sv.seen.includes(key) || run.room === room) return false;
    sv.seen.push(key);
  } else if (kind !== 'key') {
    if (run.room === room || run.used.includes(key) || run.n >= (kind === 'wow' ? WOW : COMMENTS)) return false;
    run.used.push(key);
    run.n++;
  }
  run.room = room;
  return true;
}

export function say(run: SudoRun, room: string, id: SudoId, vars: Record<string, string | number> = {}, key: string = id): boolean {
  const sv = sudoSave();
  if (!book(id, key, run, sv, room)) return false;
  const { text, mood } = LINES[id];
  const html = text[Math.floor(Math.random() * text.length)].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
  sv.log = [...sv.log, [Date.now(), html] as [number, string]].slice(-50);
  setSudo(sv);
  show(html, mood);
  return true;
}

// Hood: mint eyes in a dark face; blink and a soft eye glow are its only motion.
function face() {
  const x1 = 12.9, x2 = 19.1, y = 16.5, my = 19.7;
  const eye = (x: number) => `<ellipse class="e" cx="${x}" cy="${y}" rx="1.35" ry="1.7"/>`;
  const up = (x: number) => `M${x - 1.5} ${y + 0.7}l1.5-1.6 1.5 1.6`, flat = (x: number) => `M${x - 1.5} ${y + 0.2}h3`;
  return `<g class="m-n"><g class="blink">${eye(x1)}${eye(x2)}</g></g>`
    + `<g class="m-h"><path class="es" d="${up(x1)}${up(x2)}M14.6 ${my}q1.4 1 2.8 0"/></g>`
    + `<g class="m-s">${eye(x1)}<path class="es" d="${flat(x2)}M14.8 ${my + 0.3}q1.6.3 2.8-.9"/></g>`
    + `<g class="m-d"><path class="es" d="${flat(x1)}${flat(x2)}M14.8 ${my}h2.4"/></g>`;
}
export const avatar = (mood: Mood) => `<svg class="sv" data-mood="${mood}" viewBox="0 0 32 32" aria-hidden="true">`
  + '<defs><linearGradient id="sudo-hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc08f"/><stop offset="1" stop-color="#ea7f44"/></linearGradient></defs>'
  + '<path d="M16 3.5C9.5 3.5 5.5 9.5 5.5 17v8.2c3.2 1.6 6.8 2.3 10.5 2.3s7.3-.7 10.5-2.3V17C26.5 9.5 22.5 3.5 16 3.5z" fill="url(#sudo-hg)"/>'
  + '<path d="M10 6.6q2.6-2.2 5-2.4" stroke="#fff" stroke-opacity=".4" stroke-width="1.1" stroke-linecap="round" fill="none"/>'
  + '<ellipse cx="16" cy="16.6" rx="8.6" ry="7.7" fill="#e07a45"/><ellipse cx="16" cy="16.9" rx="7.3" ry="6.4" fill="#111416"/>'
  + '<path d="M13 23.6l-.5 3.4M19 23.6l.5 3.4" stroke="#c8683a" stroke-width="1" stroke-linecap="round"/>'
  + `<g class="glow">${face()}</g></svg>`;

const head = (mood: Mood) => "<div class='st-av'>" + avatar(mood) + "</div><div><div class='st-head'><b>sudo</b><span>~/comms</span></div>";
let typing = 0, hiding = 0;
// The toast types its line in, stays a few seconds and goes; a click on × closes it. It never takes focus.
function show(html: string, mood: Mood) {
  let el = document.getElementById('sudo');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sudo';
    el.className = 'sudo-toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  const box = el;
  clearInterval(typing);
  clearTimeout(hiding);
  box.innerHTML = head(mood) + "<p class='st-text'></p></div><button class='st-x' aria-label='Dismiss'>×</button>";
  box.hidden = false;
  box.style.animation = 'none';
  void box.offsetWidth; // restart the slide-in
  box.style.animation = '';
  const p = box.querySelector('.st-text')!, tmp = document.createElement('div');
  tmp.innerHTML = html;
  const txt = tmp.textContent ?? '';
  const done = () => { clearInterval(typing); p.innerHTML = html; };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
  else {
    let n = 0;
    p.innerHTML = "<span></span><i class='st-cur'></i>";
    const out = p.firstChild!;
    typing = window.setInterval(() => { out.textContent = txt.slice(0, ++n); if (n >= txt.length) done(); }, 24);
  }
  hiding = window.setTimeout(() => { box.hidden = true; }, 7000 + txt.length * 24);
  box.querySelector<HTMLElement>('.st-x')!.onclick = () => { clearInterval(typing); clearTimeout(hiding); box.hidden = true; };
}

// Comms history for the header dialog, newest first.
export const commsHtml = () => {
  const log = sudoSave().log.slice().reverse();
  return log.length
    ? "<div class='comms'>" + log.map(([t, h]) => "<div class='sudo-toast static'>" + head('n') + "<p class='st-text'>" + h + "</p><p class='st-when'>"
      + new Date(t).toLocaleString() + '</p></div></div>').join('') + '</div>'
    : "<p class='meta'>No messages yet. Sudo talks in run mode, rarely.</p>";
};
