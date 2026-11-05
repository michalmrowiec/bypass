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

// Run briefing art: a hooded hacker behind a laptop, the code mirrored in their glasses (lines flipped, as a reflection).
export const hacker = "<svg class='hacker' viewBox='0 0 200 200' aria-hidden='true'>"
  + "<defs><radialGradient id='hkGlow' cx='.5' cy='.8' r='.6'><stop offset='0' stop-color='#5af2a8' stop-opacity='.22'/><stop offset='1' stop-color='#5af2a8' stop-opacity='0'/></radialGradient><linearGradient id='hkCloth' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1c2124'/><stop offset='1' stop-color='#0a0c0d'/></linearGradient><radialGradient id='hkFace' cx='.5' cy='1' r='.9'><stop offset='0' stop-color='#5af2a8' stop-opacity='.35'/><stop offset='.6' stop-color='#5af2a8' stop-opacity='.06'/><stop offset='1' stop-color='#5af2a8' stop-opacity='0'/></radialGradient><clipPath id='hkL'><rect x='78' y='91' width='19' height='10' rx='3'/></clipPath><clipPath id='hkR'><rect x='103' y='91' width='19' height='10' rx='3'/></clipPath></defs><ellipse cx='100' cy='150' rx='96' ry='70' fill='url(#hkGlow)'/><g class='hk-body'><path class='hk-cloth' d='M16 200C20 170 38 152 62 142C50 120 46 94 53 72C61 45 82 29 100 22C118 29 139 45 147 72C154 94 150 120 138 142C162 152 180 170 184 200Z'/><path class='hk-fold' d='M62 142C74 150 88 153 100 153S126 150 138 142M53 72C60 98 64 118 70 128M147 72C140 98 136 118 130 128'/><path class='hk-void' d='M68 124C62 98 72 66 100 54C128 66 138 98 132 124C122 136 78 136 68 124Z'/><path d='M68 124C62 98 72 66 100 54C128 66 138 98 132 124C122 136 78 136 68 124Z' fill='url(#hkFace)'/><path class='hk-rim' d='M68 124C62 98 72 66 100 54C128 66 138 98 132 124'/><path class='hk-frame' d='M97 96h6'/><rect class='hk-lens' x='78' y='91' width='19' height='10' rx='3'/><rect class='hk-lens' x='103' y='91' width='19' height='10' rx='3'/><g clip-path='url(#hkL)'><g transform='matrix(-1 0 0 1 175 0)'><g class='hk-refl'><rect x='80' y='92' width='10' height='1.2'/><rect x='82' y='94.5' width='6' height='1.2'/><rect x='80' y='97' width='12' height='1.2'/><rect x='82' y='99.5' width='8' height='1.2'/><rect x='80' y='102' width='10' height='1.2'/><rect x='82' y='104.5' width='6' height='1.2'/><rect x='80' y='107' width='12' height='1.2'/><rect x='82' y='109.5' width='8' height='1.2'/></g></g></g><g clip-path='url(#hkR)'><g transform='matrix(-1 0 0 1 225 0)'><g class='hk-refl'><rect x='105' y='92' width='10' height='1.2'/><rect x='107' y='94.5' width='6' height='1.2'/><rect x='105' y='97' width='12' height='1.2'/><rect x='107' y='99.5' width='8' height='1.2'/><rect x='105' y='102' width='10' height='1.2'/><rect x='107' y='104.5' width='6' height='1.2'/><rect x='105' y='107' width='12' height='1.2'/><rect x='107' y='109.5' width='8' height='1.2'/></g></g></g><path class='hk-str' d='M90 134l-3 26M110 134l3 26'/><circle class='hk-tip' cx='87' cy='162' r='2'/><circle class='hk-tip' cx='113' cy='162' r='2'/></g><path class='hk-lid' d='M52 152h96l6 48H46z'/><path class='hk-edge' d='M52 152h96'/><path class='hk-logo' d='M90 176l5-8.7h10l5 8.7-5 8.7h-10z'/><g class='hk-fx'></g>"
  + '</svg>';
