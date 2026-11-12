// One tooltip for every [data-tip] element: hover or focus with a mouse, a tap on touch (tap elsewhere to close).
// A tapped button keeps its tap, so on touch only plain elements show their tip.
export function initTips(): void {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);
  let on: HTMLElement | null = null, touch = false;
  const find = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-tip]') : null);
  // By point, not by event target: Chrome hands events on a flipped 3D card to the card itself.
  const at = (e: MouseEvent) => find(document.elementsFromPoint(e.clientX, e.clientY)[0] ?? null);
  const show = (el: HTMLElement) => {
    on = el;
    tip.textContent = el.dataset.tip ?? '';
    tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px';
    tip.style.top = (r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8) + 'px';
  };
  const hide = () => { clearTimeout(wait); on = null; tip.hidden = true; };
  // [data-tip-delay] (ms): the tip waits, so a quick pass over the button shows nothing.
  let wait = 0;
  const showSoon = (el: HTMLElement) => {
    clearTimeout(wait);
    on = el;
    const d = +(el.dataset.tipDelay ?? 0);
    if (d) { tip.hidden = true; wait = window.setTimeout(() => on === el && show(el), d); } else show(el);
  };
  document.addEventListener('pointerdown', (e) => { touch = e.pointerType === 'touch'; });
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const el = at(e);
    if (el && el !== on) showSoon(el); else if (!el && on) hide();
  });
  document.addEventListener('pointerleave', hide);
  document.addEventListener('focusin', (e) => { const el = find(e.target); if (el) show(el); else hide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, true);
  // Capture phase: a tapped tip inside a clickable card must not reach the card.
  document.addEventListener('click', (e) => {
    const el = at(e);
    if (touch && el && !el.matches('button, a, input, select, [role=button]')) {
      e.stopPropagation();
      e.preventDefault();
      if (on === el) hide(); else show(el);
      return;
    }
    hide();
  }, true);
}
