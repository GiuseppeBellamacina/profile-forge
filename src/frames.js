// Avatar frames, like Discord's avatar decorations: a ring or ornaments around the picture. Pure functions: each frame gets
// the geometry and returns svg. Motion is plain CSS (A.loop), so it plays inside a README <img>; static frames hold a pose.
import { familyOf, levelColor } from "./levels.js";
import { mix } from "./themes.js";

const CX = 92;
const CY = 90;
const HALF = 58; // the ring sits at this distance from the centre (circle radius / half the square)
const CORNER = 30; // corner radius of the rounded avatar
const r3 = (n) => Math.round(n * 1000) / 1000;

export const FRAMES = ["none", "ring", "double", "dashed", "neon", "pixel", "glitch", "laurel", "flames", "sakura", "stars", "halo", "aurora", "orbit", "prism", "auto"];
export const FRAME_ANIMATIONS = ["default", "none", "spin", "pulse", "twinkle"];

/** The frame `auto` picks for each letter: richer as the level rises; SSS gets the aurora and X the prism. */
export const AUTO_FRAME = { E: "none", D: "ring", C: "double", B: "dashed", A: "neon", S: "flames", SSS: "aurora", X: "prism" };
const PRISM = ["#ff5f6d", "#ff9f43", "#ffd93d", "#6bdb7a", "#4fd1ff", "#7c8cff", "#c77dff", "#ff6fd8"];

// ---- geometry: the outline of the avatar (circle or rounded square), pushed out by `grow`
function outline(shape, grow, w, extra = "") {
  const g = HALF + grow;
  return shape === "rounded"
    ? `<rect x="${r3(CX - g)}" y="${r3(CY - g)}" width="${g * 2}" height="${g * 2}" rx="${CORNER + grow}" fill="none" ${w}${extra}/>`
    : `<circle cx="${CX}" cy="${CY}" r="${g}" fill="none" ${w}${extra}/>`;
}

/** n points spread evenly on the outline: { x, y, a } where a is the angle (radians) pointing away from the avatar. */
function around(shape, grow, n, shift = 0) {
  const g = HALF + grow;
  if (shape !== "rounded") return Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + ((i + shift) / n) * Math.PI * 2; return { x: CX + g * Math.cos(a), y: CY + g * Math.sin(a), a }; });
  const r = CORNER + grow;
  const s = 2 * g - 2 * r; // a straight side
  const q = (Math.PI * r) / 2; // a corner
  const arc = (cx, cy, a0) => (u) => ({ x: cx + r * Math.cos(a0 + u / r), y: cy + r * Math.sin(a0 + u / r), a: a0 + u / r });
  // clockwise from the middle of the top side
  const pieces = [
    [s / 2, (u) => ({ x: CX + u, y: CY - g, a: -Math.PI / 2 })],
    [q, arc(CX + g - r, CY - g + r, -Math.PI / 2)],
    [s, (u) => ({ x: CX + g, y: CY - g + r + u, a: 0 })],
    [q, arc(CX + g - r, CY + g - r, 0)],
    [s, (u) => ({ x: CX + g - r - u, y: CY + g, a: Math.PI / 2 })],
    [q, arc(CX - g + r, CY + g - r, Math.PI / 2)],
    [s, (u) => ({ x: CX - g, y: CY + g - r - u, a: Math.PI })],
    [q, arc(CX - g + r, CY - g + r, Math.PI)],
    [s / 2, (u) => ({ x: CX - s / 2 + u, y: CY - g, a: -Math.PI / 2 })],
  ];
  const L = 4 * s + 4 * q;
  return Array.from({ length: n }, (_, i) => {
    let d = ((i + shift) / n) * L;
    for (const [len, at] of pieces) {
      if (d <= len) return at(d);
      d -= len;
    }
    return at0(pieces);
  });
}
const at0 = (pieces) => pieces[0][1](0);

// small helpers for ornaments, drawn at (x, y) and turned so that "up" points away from the avatar
const place = (p, body) => `<g transform="translate(${r3(p.x)} ${r3(p.y)}) rotate(${r3(((p.a + Math.PI / 2) * 180) / Math.PI)})">${body}</g>`;
const sparkle = (s) => `M0 ${-s}L${r3(s * 0.28)} ${r3(-s * 0.28)}L${s} 0L${r3(s * 0.28)} ${r3(s * 0.28)}L0 ${s}L${r3(-s * 0.28)} ${r3(s * 0.28)}L${-s} 0L${r3(-s * 0.28)} ${r3(-s * 0.28)}Z`;

/**
 * kind: one of FRAMES (not "auto"/"none"). g: { shape, color, c, A, level, motion } where motion is the frame animation
 * ("default" = the frame's own motion, "none", "spin", "pulse", "twinkle").
 */
export function drawFrame(kind, g) {
  const { shape, color: col, c, A, motion } = g;
  const on = (own) => (motion === "default" ? own : motion);
  const spin = (body, dur = 20, dir = 1) => `<g${A.loop({ "0%": "transform:rotate(0deg)", "100%": `transform:rotate(${360 * dir}deg)` }, { dur, ease: "linear", origin: [CX, CY], delay: 0.8 })}>${body}</g>`;
  const pulse = (body, lo = 0.35, hi = 1, dur = 2.4) => `<g${A.loop({ "0%,100%": `opacity:${lo}`, "50%": `opacity:${hi}` }, { dur, delay: 0.8 })}>${body}</g>`;
  const motionWrap = (body, own) => {
    const m = on(own);
    return m === "spin" ? (shape === "rounded" ? body : spin(body)) : m === "pulse" ? pulse(body, 0.5, 1) : body; // a square cannot turn about its centre
  };
  // dashes that march along the outline (works for the circle and the rounded square alike)
  const march = (grow, w, dash, dur, loops, dir = 1, color = col, extra = "") => {
    const sum = dash[0] + dash[1];
    const run = on("spin") === "spin" ? A.loop({ "0%": "stroke-dashoffset:0", "100%": `stroke-dashoffset:${-dir * sum * loops}` }, { dur, ease: "linear", delay: 0.8 }) : "";
    return outline(shape, grow, `stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${dash[0]} ${dash[1]}"${extra}`, run);
  };
  const twinkle = (i, n, still = ' opacity="0.9"') => A.loop({ "0%,100%": "opacity:.15;transform:scale(.45)", "50%": "opacity:1;transform:scale(1)" }, { dur: 2.2, delay: 0.8 + (i * 2.2) / n, still });

  switch (kind) {
    case "ring":
      return motionWrap(outline(shape, 0, `stroke="${col}" stroke-width="3"`), "none");

    case "double":
      return motionWrap(`${outline(shape, 0, `stroke="${col}" stroke-width="2.4"`)}${outline(shape, 6, `stroke="${col}" stroke-width="1.2" opacity="0.55"`)}`, "none");

    case "dashed": {
      const ring = march(3, 2.6, [5, 5.5], 6, 4);
      return on("pulse") === "pulse" ? pulse(ring, 0.5, 1) : ring;
    }

    case "neon":
      return motionWrap(`${outline(shape, 0, `stroke="${col}" stroke-width="10" opacity="0.2"`)}${outline(shape, 0, `stroke="${col}" stroke-width="5" opacity="0.35"`)}${outline(shape, 0, `stroke="#fff" stroke-width="1.6" opacity="0.9"`)}${outline(shape, 0, `stroke="${col}" stroke-width="3"`, ` opacity="0.9"`)}`, "pulse");

    case "pixel": {
      const n = 32;
      const body = around(shape, 5, n).map((p, i) => place(p, `<rect x="-2.3" y="-2.3" width="4.6" height="4.6" fill="${col}" opacity="${i % 2 ? 0.5 : 1}"${on("twinkle") === "twinkle" ? A.loop({ "0%,100%": `opacity:${i % 2 ? 0.25 : 0.9}`, "50%": `opacity:${i % 2 ? 0.9 : 0.25}` }, { dur: 1.6, delay: 0.8 + (i % 8) * 0.12 }) : ""}/>`)).join("");
      return on("pulse") === "pulse" ? pulse(body, 0.5, 1) : on("spin") === "spin" ? spin(body) : body;
    }

    case "glitch": {
      const base = outline(shape, 0, `stroke="${col}" stroke-width="2.6"`);
      const shift = (color, dx) => `<g opacity="0.8"${on("twinkle") === "none" || motion === "none" ? "" : A.loop({ "0%,86%,100%": "transform:translate(0,0)", "88%": `transform:translate(${dx}px,1px)`, "92%": `transform:translate(${-dx}px,-1px)`, "96%": `transform:translate(${dx / 2}px,0)` }, { dur: 3.2, ease: "steps(1)", delay: 0.8, still: ` transform="translate(${dx} 0)"` })}>${outline(shape, 0, `stroke="${color}" stroke-width="2"`)}</g>`;
      return `${shift("#00e5ff", 2.2)}${shift("#ff2bd6", -2.2)}${base}`;
    }

    case "laurel": {
      const leaves = [];
      for (const side of [-1, 1]) {
        const pts = around(shape, 5, 40);
        // the branch: the points on the lower half of each side, from the bottom up to the shoulder
        const pick = pts.filter((p) => (side < 0 ? p.x < CX : p.x > CX) && p.y > CY - 36);
        pick.forEach((p, i) => { leaves.push(place({ ...p, a: p.a + (i % 2 ? 0.7 : -0.7) * side }, `<path d="M0 0C-3.6 -3 -3.6 -8 0 -12C3.6 -8 3.6 -3 0 0Z" fill="${col}" opacity="${r3(0.95 - i * 0.015)}"/>`)); });
      }
      return `${outline(shape, 0, `stroke="${col}" stroke-width="1.6" opacity="0.55"`)}${motionWrap(leaves.join(""), "none")}`;
    }

    case "flames": {
      const n = 18;
      const body = around(shape, 2, n).map((p, i) => {
        const k = 0.75 + ((i * 37) % 10) / 22; // each flame a different height
        const flame = `<path d="M0 0C-5 -4 -4.5 -11 0 -19C4.5 -11 5 -4 0 0Z" fill="${col}" opacity="0.9" transform="scale(${r3(k)})"/><path d="M0 -1C-2.4 -3.6 -2 -7.5 0 -11C2 -7.5 2.4 -3.6 0 -1Z" fill="#fff" opacity="0.55" transform="scale(${r3(k)})"/>`;
        return place(p, `<g${on("default") === "none" || motion === "none" ? "" : A.loop({ "0%,100%": "transform:scaleY(.8)", "50%": "transform:scaleY(1.18)" }, { dur: 0.9 + (i % 5) * 0.17, delay: 0.8 + (i % 4) * 0.2, origin: [0, 0] })}>${flame}</g>`);
      }).join("");
      return `${outline(shape, 0, `stroke="${col}" stroke-width="2.4" opacity="0.85"`)}${body}`;
    }

    case "sakura": {
      const petal = (fill) => [0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-3.1" rx="2.1" ry="3.3" fill="${fill}" transform="rotate(${a})"/>`).join("");
      const body = around(shape, 5, 7, 0.4).map((p, i) => `<g transform="translate(${r3(p.x)} ${r3(p.y)}) scale(${r3(0.9 + (i % 3) * 0.22)})"><g${motion === "none" ? "" : A.loop({ "0%,100%": "transform:rotate(-14deg)", "50%": "transform:rotate(14deg)" }, { dur: 3.4, delay: 0.8 + i * 0.3, origin: [0, 0] })}>${petal(col)}<circle r="1.5" fill="#fff" opacity="0.8"/></g></g>`).join("");
      return `${outline(shape, 0, `stroke="${col}" stroke-width="1.8" opacity="0.6"`)}${body}`;
    }

    case "stars": {
      const body = around(shape, 6, 10, 0.3).map((p, i) => `<g transform="translate(${r3(p.x)} ${r3(p.y)})"><path d="${sparkle(r3(3.2 + (i % 3) * 1.4))}" fill="${col}"${A.loop({ "0%,100%": "opacity:.2;transform:scale(.5)", "50%": "opacity:1;transform:scale(1.05)" }, { dur: 2.2, delay: 0.8 + (i * 2.2) / 10, still: ' opacity="0.95"' })}/></g>`).join("");
      return `${outline(shape, 0, `stroke="${col}" stroke-width="1.6" opacity="0.5"`)}${body}`;
    }

    case "halo": {
      const y = CY - HALF - 7;
      return `${motionWrap(`<ellipse cx="${CX}" cy="${y}" rx="27" ry="7.5" fill="none" stroke="${col}" stroke-width="7" opacity="0.2"/><ellipse cx="${CX}" cy="${y}" rx="27" ry="7.5" fill="none" stroke="${col}" stroke-width="3.2"/><ellipse cx="${CX}" cy="${y - 0.8}" rx="26" ry="6.6" fill="none" stroke="#fff" stroke-width="0.9" opacity="0.7"/>`, "pulse")}${outline(shape, 0, `stroke="${col}" stroke-width="1.4" opacity="0.45"`)}`;
    }

    case "aurora": {
      const second = levelColor(c, "S");
      const sp = around(shape, 9, 8, 0.5).map((p, i) => `<g transform="translate(${r3(p.x)} ${r3(p.y)})"><path d="${sparkle(4)}" fill="${i % 2 ? second : col}"${twinkle(i, 8)}/></g>`).join("");
      return `${outline(shape, 0, `stroke="${col}" stroke-width="2.4" opacity="0.6"`)}${march(3, 3, [30, 22], 9, 3)}${march(8, 2, [14, 18], 13, 4, -1, second)}${sp}`;
    }

    case "orbit": {
      // two small moons going round the avatar at different speeds and distances
      const moon = (grow, r, dur, dir, fill) => spin(`<circle cx="${CX}" cy="${CY - HALF - grow}" r="${r}" fill="${fill}"/><circle cx="${CX}" cy="${CY - HALF - grow}" r="${r + 3}" fill="${fill}" opacity="0.25"/>`, dur, dir);
      const moving = motion !== "none";
      const body = `${outline(shape, 0, `stroke="${col}" stroke-width="1.8" opacity="0.7"`)}${outline(shape, 8, `stroke="${col}" stroke-width="0.8" opacity="0.3" stroke-dasharray="2 4"`)}`;
      return body + (moving ? `${moon(8, 3.2, 6, 1, col)}${moon(8, 2.2, 9, -1, mix(col, "#ffffff", 0.5))}` : `<circle cx="${CX + HALF + 8}" cy="${CY}" r="3.2" fill="${col}"/>`);
    }

    case "prism": {
      // the outline split into rainbow arcs that turn, with rainbow sparkles around
      const n = PRISM.length;
      const arcs = PRISM.map((p, i) => outline(shape, 1, `stroke="${p}" stroke-width="3.4" pathLength="100" stroke-dasharray="${r3(100 / n)} ${r3(100 - 100 / n)}" stroke-dashoffset="${r3((-i * 100) / n)}"`)).join("");
      const sp = around(shape, 10, 8, 0.25).map((p, i) => `<g transform="translate(${r3(p.x)} ${r3(p.y)})"><path d="${sparkle(3.6)}" fill="${PRISM[i % n]}"${twinkle(i, 8)}/></g>`).join("");
      return `${outline(shape, 1, `stroke="#fff" stroke-width="7" opacity="0.08"`)}${motionWrap(arcs, "spin")}${outline(shape, -2.5, `stroke="#fff" stroke-width="0.8" opacity="0.5"`)}${sp}`;
    }

    default:
      return "";
  }
}

/** The frame to draw for a header config: the chosen one, or the one that fits the level for "auto". */
export const frameFor = (frame, level) => (frame === "auto" ? AUTO_FRAME[familyOf(level)] ?? "ring" : frame);
