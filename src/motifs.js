// Decorative motifs for the card (`card.decor`): original line art in a 100 x 100 box, drawn with two colours, `a` (the main one) and
// `b` (the accent). Nothing here copies a logo or a character: they are shapes in the spirit of a style (neon city, system windows,
// comic halftones, gothic ornaments...) that the themes can lean on. render.js places, scales, rotates and fades them.

import { ANIMATED } from "./motifs-animated.js";
import { mix } from "./themes.js";

const r2 = (x) => Math.round(x * 100) / 100;
const polar = (cx, cy, r, deg) => [r2(cx + r * Math.cos((deg * Math.PI) / 180)), r2(cy + r * Math.sin((deg * Math.PI) / 180))];
const sparkle = (x, y, s, fill) => `<path d="M${x} ${y - s}L${r2(x + s * 0.25)} ${r2(y - s * 0.25)}L${x + s} ${y}L${r2(x + s * 0.25)} ${r2(y + s * 0.25)}L${x} ${y + s}L${r2(x - s * 0.25)} ${r2(y + s * 0.25)}L${x - s} ${y}L${r2(x - s * 0.25)} ${r2(y - s * 0.25)}Z" fill="${fill}"/>`;

// an animated motif (scripts/pack-motif.js): `speed` scales its loop, `still` gives one frame (PNG / GIF, animations off)
const animated = (name, a, { speed = 1, still = false } = {}) => {
  const m = ANIMATED[name];
  return `<svg x="0" y="0" width="100" height="100" viewBox="${m.viewBox}" preserveAspectRatio="xMidYMid meet">${(still ? m.still : m.animated).replaceAll("__COLOR__", a).replaceAll("__DUR__", String(Math.round((m.dur / speed) * 1000) / 1000))}</svg>`;
};

export const MOTIFS = {
  /** an animated bolt of lightning (a hand-drawn loop of 36 frames); the main colour is its colour, `speed` its pace */
  lightning: (a, _b, o) => animated("lightning", a, o),
  /** a night skyline: towers with lit windows and an antenna */
  skyline: (a, b) => `<path d="M0 100V66h7V54h9v12h5V44h11v22h6V58h8V30h9v36h7V50h8V36h4V28h2v8h4v14h6V60h7v40Z" fill="${a}"/><path d="M52 30V16" stroke="${a}" stroke-width="1.4"/><circle cx="52" cy="14" r="1.8" fill="${b}"/><g fill="${b}">${[[10, 58], [12, 62], [24, 50], [28, 56], [28, 62], [44, 36], [48, 44], [44, 52], [48, 58], [62, 54], [66, 60], [76, 42], [80, 48], [78, 56], [90, 64]].map(([x, y]) => `<rect x="${x}" y="${y}" width="2" height="2.4"/>`).join("")}</g>`,
  /** printed-circuit traces ending in pads */
  circuit: (a, b) => `<g fill="none" stroke="${a}" stroke-width="1.6" stroke-linejoin="round"><path d="M4 18H30L42 30H70L82 18H96M4 48H24L34 58H56V80H96M46 4V22M62 96V72L76 58H96M20 96V74H8"/></g><g fill="${b}">${[[4, 18], [96, 18], [4, 48], [96, 80], [46, 4], [62, 96], [96, 58], [20, 96], [8, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join("")}</g><rect x="40" y="38" width="14" height="14" fill="none" stroke="${a}" stroke-width="1.6"/>`,
  /** a glitched picture: bars shifted sideways in two colours */
  glitch: (a, b) => `<g fill="${a}"><rect x="4" y="8" width="58" height="7"/><rect x="20" y="22" width="76" height="4"/><rect x="0" y="34" width="44" height="9"/><rect x="38" y="52" width="60" height="5"/><rect x="8" y="64" width="70" height="8"/><rect x="30" y="82" width="52" height="4"/></g><g fill="${b}" opacity=".85"><rect x="10" y="10" width="40" height="3"/><rect x="52" y="20" width="44" height="3"/><rect x="14" y="38" width="30" height="3"/><rect x="60" y="50" width="30" height="3"/><rect x="0" y="68" width="40" height="3"/><rect x="50" y="88" width="46" height="3"/></g>`,
  /** a halftone: dots that shrink along a diagonal */
  halftone: (a) => {
    const dots = [];
    for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) {
      const r = 5.2 * (1 - (row + col) / 17);
      if (r > 0.5) dots.push(`<circle cx="${r2(6 + col * 11 + (row % 2) * 5.5)}" cy="${r2(6 + row * 11)}" r="${r2(r)}"/>`);
    }
    return `<g fill="${a}">${dots.join("")}</g>`;
  },
  /** speed lines bursting from the middle (a comic panel in motion) */
  speedlines: (a, b) => `<g stroke="${a}" stroke-linecap="round">${Array.from({ length: 28 }, (_, k) => {
    const deg = k * (360 / 28), near = 24 + (k % 3) * 5, far = 46 - (k % 4) * 3;
    const [x1, y1] = polar(50, 50, near, deg), [x2, y2] = polar(50, 50, far, deg);
    return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke-width="${k % 2 ? 1.2 : 2.4}"/>`;
  }).join("")}</g><circle cx="50" cy="50" r="5" fill="${b}"/>`,
  /** an explosion of shards round a white star, black outlines: the two colours, a yellow and an orange (a pop-art key visual) */
  shards: (a, b) => {
    const ink = "#14141c";
    const fills = [a, "#ffe600", b, "#ff8a00", ink]; // the two colours, and a yellow and an orange of the key art
    const rays = Array.from({ length: 18 }, (_, k) => {
      const deg = k * 20 + (k % 3) * 3, far = k % 2 ? 36 : 48 - (k % 4) * 2, half = 7 + (k % 3) * 2;
      const [x1, y1] = polar(50, 50, 13, deg - half), [x2, y2] = polar(50, 50, 13, deg + half), [tx, ty] = polar(50, 50, far, deg + (k % 2 ? 4 : -3));
      return `<path d="M${x1} ${y1}L${tx} ${ty}L${x2} ${y2}Z" fill="${fills[k % 5]}" stroke="${ink}" stroke-width="1" stroke-linejoin="miter"/>`;
    }).join("");
    const star = Array.from({ length: 10 }, (_, k) => polar(50, 50, k % 2 ? 8 : 19, -90 + 36 * k).join(" ")).join("L");
    const dots = Array.from({ length: 14 }, (_, k) => { const [x, y] = polar(50, 50, 24 + (k % 5) * 4, k * 26 + 8); return `<circle cx="${x}" cy="${y}" r="0.9" fill="${ink}" opacity=".55"/>`; }).join("");
    return `${rays}${dots}<path d="M${star}Z" fill="#ffffff" stroke="${ink}" stroke-width="1.6" stroke-linejoin="miter"/>`;
  },
  /** a pop-art starburst */
  burst: (a, b) => {
    const pts = (r1, r2_) => Array.from({ length: 24 }, (_, k) => polar(50, 50, k % 2 ? r2_ : r1, k * 15).join(" ")).join("L");
    return `<path d="M${pts(48, 32)}Z" fill="${a}"/><path d="M${pts(34, 22)}Z" fill="${b}"/>`;
  },
  /** a ring of angular glyphs round a pentagram, like a summoning circle (the marks are made up, they spell nothing) */
  runes: (a, b) => {
    const marks = Array.from({ length: 12 }, (_, k) => {
      const [x, y] = polar(50, 50, 38, k * 30);
      const v = k % 4;
      const d = v === 0 ? "M0 -5V5M0 -1L4 -5" : v === 1 ? "M-3 -5V5M3 -5V5M-3 0H3" : v === 2 ? "M-3 5L0 -5L3 5M-2 1H2" : "M-3 -5L3 5M3 -5L-3 5";
      return `<path d="${d}" transform="translate(${x} ${y}) rotate(${k * 30 + 90})" stroke="${a}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    }).join("");
    return `<circle cx="50" cy="50" r="47" fill="none" stroke="${a}" stroke-width="1.4"/><circle cx="50" cy="50" r="29" fill="none" stroke="${a}" stroke-width="1.4"/>${marks}<path d="M${[0, 2, 4, 1, 3].map((k) => polar(50, 50, 27, -90 + 72 * k).join(" ")).join("L")}Z" fill="none" stroke="${b}" stroke-width="1.6" stroke-linejoin="round"/>`;
  },
  /** a "system" window: corner brackets, a title bar and lines of a status list */
  hud: (a, b) => `<path d="M4 18V4H18M82 4H96V18M96 82V96H82M18 96H4V82" fill="none" stroke="${a}" stroke-width="2"/><rect x="12" y="12" width="76" height="9" fill="${a}" opacity=".3"/><rect x="12" y="12" width="3" height="9" fill="${b}"/><g fill="${a}" opacity=".75"><rect x="14" y="30" width="46" height="3"/><rect x="14" y="40" width="62" height="3"/><rect x="14" y="50" width="38" height="3"/><rect x="14" y="60" width="54" height="3"/></g><rect x="14" y="74" width="72" height="6" fill="none" stroke="${a}" stroke-width="1.2"/><rect x="15.5" y="75.5" width="48" height="3" fill="${b}"/>`,
  /** angular wings, a gothic ornament */
  wings: (a, b) => {
    const wing = `M50 56L36 32L12 22L24 36L4 38L22 48L8 58L30 60L22 76L44 68Z`;
    return `<path d="${wing}" fill="${a}"/><path d="${wing}" fill="${a}" transform="translate(100 0) scale(-1 1)"/><path d="M50 40L58 56L50 74L42 56Z" fill="${b}"/>`;
  },
  /** an ornamental blade with a cross guard */
  blade: (a, b) => `<path d="M50 3L57 62H43Z" fill="${a}"/><path d="M50 10V58" stroke="${b}" stroke-width="1.2"/><path d="M26 64H74L70 70H30Z" fill="${a}"/><circle cx="50" cy="67" r="3.2" fill="${b}"/><rect x="47" y="70" width="6" height="20" fill="${a}"/><circle cx="50" cy="94" r="4" fill="${a}"/>`,
  /** a crescent moon with a few stars */
  moon: (a, b) => `<path d="M63.2 10.2A42 42 0 1 0 86.1 71.4A34 34 0 1 1 63.2 10.2Z" fill="${a}"/>${sparkle(78, 26, 6, b)}${sparkle(88, 56, 4, b)}${sparkle(70, 78, 3, b)}`,
  /** scattered sparkles */
  stars: (a, b) => [[20, 24, 12, a], [64, 14, 7, b], [80, 46, 14, a], [38, 62, 8, b], [18, 84, 6, a], [68, 82, 10, b], [50, 40, 4, a]].map(([x, y, s, f]) => sparkle(x, y, s, f)).join(""),
  /** a small cluster of hexagons */
  hexgrid: (a, b) => {
    const hex = (cx, cy, fill) => `<path d="M${Array.from({ length: 6 }, (_, k) => polar(cx, cy, 16, 60 * k + 30).join(" ")).join("L")}Z" fill="${fill}" stroke="${a}" stroke-width="1.6" stroke-linejoin="round"/>`;
    const at = (k) => (k === 0 ? [50, 50] : polar(50, 50, 28, 60 * k - 30));
    return [0, 1, 2, 3, 4, 5, 6].map((k) => hex(...at(k), k === 0 ? b : "none")).join("");
  },
  /** a targeting reticle */
  reticle: (a, b) => `<g fill="none" stroke="${a}" stroke-width="1.6"><circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="18" stroke-dasharray="4 4"/><path d="M50 4V28M50 72V96M4 50H28M72 50H96"/><path d="M20 20L26 26M80 20L74 26M20 80L26 74M80 80L74 74"/></g><circle cx="50" cy="50" r="3" fill="${b}"/>`,
  /** a lightning bolt */
  bolt: (a, b) => `<path d="M60 3L24 54H46L36 97L78 40H54Z" fill="${a}" stroke="${b}" stroke-width="2" stroke-linejoin="round"/>`,
  /** a barcode */
  barcode: (a) => `<g fill="${a}">${[0, 3, 7, 9, 14, 17, 19, 24, 27, 31, 33, 38, 42, 44, 49, 52, 57, 59, 64, 67, 71, 74, 78, 82, 85, 90, 93].map((x, k) => `<rect x="${x + 2}" y="14" width="${1 + (k % 3)}.4" height="72"/>`).join("")}</g>`,
};
export const MOTIF_NAMES = Object.keys(MOTIFS);
