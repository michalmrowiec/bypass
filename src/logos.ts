// Company logos for the contract carousel (viewBox 120×120, drawn in currentColor).
const ring = "<circle class='lg-ring' cx='60' cy='60' r='54'/><circle class='lg-orbit' cx='60' cy='60' r='46'/>";

const LOGOS: Record<string, string> = {
  // A kestrel in a stoop: swept wings, fanned tail.
  kestrel: ring + "<path class='lg-fill' d='M60 30L67 45L106 35L85 56L71 58L67 75L60 92L53 75L49 58L35 56L14 35L53 45Z'/>"
    + "<path class='lg-cut' d='M60 45V70'/>",
  // A medical cross with a heartbeat running through it.
  meridian: ring + "<path class='lg-fill' d='M50 24h20v26h26v20H70v26H50V70H24V50h26z'/>"
    + "<path class='lg-cut' d='M18 60h22l6-13 9 27 7-21 5 7h35'/>",
};

const LOCKED = "<circle class='lg-ring dashed' cx='60' cy='60' r='54'/><text class='lg-q' x='60' y='78'>?</text>";

// Each company's colours come from its `lg-<id>` class in style.css.
export const logo = (id?: string) => "<svg class='flogo" + (id ? ' lg-' + id : '') + "' viewBox='0 0 120 120' aria-hidden='true'>" + (id ? LOGOS[id] : LOCKED) + '</svg>';
