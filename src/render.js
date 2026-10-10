import { ICONS } from "./icons.js";

export const THEMES = {
  dark: {
    bg1: "#1a1b26", bg2: "#13141c", panel: "#1f2335", border: "#2f334d", text: "#c0caf5", muted: "#7c83a8",
    accent: "#7aa2f7", accent2: "#bb9af7", fire: "#ff9e64", track: "#2f334d",
    heat: ["#24283b", "#2e3f6e", "#3d5aa8", "#5a80dc", "#7dcfff"],
  },
  light: {
    bg1: "#ffffff", bg2: "#f3f5f9", panel: "#f8f9fc", border: "#dde2ea", text: "#1f2328", muted: "#626b78",
    accent: "#0969da", accent2: "#8250df", fire: "#e36209", track: "#e3e7ee",
    heat: ["#ebedf0", "#c2dbfb", "#80b6f4", "#3d8ae6", "#0a5cc4"],
  },
};

const TROPHY_COLORS = { S: "#f5c443", A: "#a9b8cc", B: "#d08a4a", C: "#a86b3c", "?": "#6b7280" };
/** Total timeline length in seconds; GIF frames sample t∈[0,1] over it. */
export const DURATION = 3.6;
const W = 1000;
const H = 890;

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - (1 - x) ** 3;
const r3 = (x) => +x.toFixed(3);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const num = (n) => n.toLocaleString("en-US");
const fmtDate = (d, year = true) =>
  d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year && { year: "numeric" }), timeZone: "UTC" }) : "";
const icon = (name, x, y, size, fill) =>
  `<g transform="translate(${x} ${y}) scale(${size / 16})" fill="${fill}">${ICONS[name]}</g>`;

const DEFAULTS = { o: 1, ty: 0, s: 1, sx: 1, dash: 0 };

/**
 * Animation helper — one source of truth per element.
 * t === undefined → final-state attributes + CSS keyframes (animated SVG).
 * t ∈ [0,1]      → attributes interpolated at that instant, no CSS (static frame for PNG/GIF).
 * props: { o: opacity, ty: translateY, s: scale about origin, sx: scaleX about origin, dash: stroke-dashoffset }
 */
function animator(t) {
  const css = [];
  const transform = (v, [ox, oy] = [0, 0], cssMode) => {
    const parts = [];
    if (v.ty !== undefined && v.ty !== 0) parts.push(cssMode ? `translateY(${r3(v.ty)}px)` : `translate(0 ${r3(v.ty)})`);
    const sx = v.sx ?? v.s;
    const sy = v.s;
    if (sx !== undefined || sy !== undefined) {
      const a = r3(sx ?? 1);
      const b = r3(sy ?? 1);
      parts.push(cssMode ? `scale(${a},${b})` : `translate(${ox} ${oy}) scale(${a} ${b}) translate(${-ox} ${-oy})`);
    }
    return parts.join(" ");
  };
  const attrs = (v, origin) => {
    let out = "";
    if (v.o !== undefined) out += ` opacity="${r3(v.o)}"`;
    if (v.dash !== undefined) out += ` stroke-dashoffset="${r3(v.dash)}"`;
    const tf = transform(v, origin, false);
    if (tf) out += ` transform="${tf}"`;
    return out;
  };
  const cssProps = (v, origin) => {
    let out = "";
    if (v.o !== undefined) out += `opacity:${r3(v.o)};`;
    if (v.dash !== undefined) out += `stroke-dashoffset:${r3(v.dash)};`;
    const tf = transform(v, origin, true);
    out += `transform:${tf || "none"};`;
    return out;
  };
  return {
    css,
    a(delay, dur, from, to = {}, origin) {
      const fin = Object.fromEntries(Object.keys(from).map((k) => [k, to[k] ?? DEFAULTS[k]]));
      if (t !== undefined) {
        const p = easeOut(clamp((t * DURATION - delay) / dur));
        return attrs(Object.fromEntries(Object.keys(from).map((k) => [k, from[k] + (fin[k] - from[k]) * p])), origin);
      }
      const name = `a${css.length}`;
      const o = origin ? `transform-origin:${origin[0]}px ${origin[1]}px;` : "";
      css.push(
        `@keyframes ${name}{from{${cssProps(from, origin)}}to{${cssProps(fin, origin)}}}` +
          `.${name}{${o}animation:${name} ${dur}s cubic-bezier(.2,.7,.2,1) ${delay}s both}`,
      );
      return attrs(fin, origin) + ` class="${name}"`;
    },
  };
}

const panel = (x, y, w, h, c) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${c.panel}" stroke="${c.border}"/>`;
const heading = (x, y, text, c, extra = "") =>
  `<text x="${x}" y="${y}" font-size="12" font-weight="700" letter-spacing="1.6" fill="${c.muted}">${esc(text)}${extra}</text>`;

function header(d, c, A) {
  const joined = new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const facts = [
    ["zap", `${num(d.facts.thisYear)} contributions in ${d.days.at(-1)[0].slice(0, 4)}`],
    ["flame", `Best day: ${num(d.facts.bestDay[1])} on ${fmtDate(d.facts.bestDay[0])}`],
    ["calendar", `Most active on ${d.facts.busiestWeekday}s`],
  ];
  const C = 2 * Math.PI * 50;
  const progress = 100 - d.rank.percentile;
  return `
  <g${A.a(0, 0.6, { o: 0, s: 0.6 }, {}, [92, 90])}>
    <circle cx="92" cy="90" r="58" fill="none" stroke="url(#grad)" stroke-width="3"/>
    <clipPath id="av"><circle cx="92" cy="90" r="52"/></clipPath>
    <image href="${d.avatar}" x="40" y="38" width="104" height="104" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/>
  </g>
  <g${A.a(0.15, 0.6, { o: 0, ty: 12 })}>
    <text x="172" y="78" font-size="32" font-weight="800" fill="${c.text}">${esc(trunc(d.name, 24))}</text>
    <text x="172" y="106" font-size="16" font-weight="600" fill="${c.accent}">@${esc(d.login)}</text>
    ${icon("history", 172, 122, 14, c.muted)}
    <text x="193" y="134" font-size="13" fill="${c.muted}">Joined ${joined} · ${d.years} ${d.years === 1 ? "year" : "years"} on GitHub</text>
  </g>
  ${facts
    .map(
      ([ic, text], i) => `<g${A.a(0.3 + i * 0.1, 0.5, { o: 0, ty: 10 })}>
    ${icon(ic, 560, 54 + i * 32, 14, c.accent2)}
    <text x="582" y="${66 + i * 32}" font-size="13" fill="${c.text}">${esc(text)}</text>
  </g>`,
    )
    .join("")}
  <g${A.a(0.3, 0.5, { o: 0, s: 0.7 }, {}, [900, 90])}>
    <circle cx="900" cy="90" r="50" fill="none" stroke="${c.track}" stroke-width="8"/>
    <circle cx="900" cy="90" r="50" fill="none" stroke="url(#grad)" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${r3(C)}" transform="rotate(-90 900 90)"${A.a(0.5, 1.4, { dash: C }, { dash: (C * (100 - progress)) / 100 })}/>
    <text x="900" y="99" text-anchor="middle" font-size="30" font-weight="800" fill="${c.text}">${d.rank.level}</text>
    <text x="900" y="117" text-anchor="middle" font-size="10" fill="${c.muted}">top ${r3(d.rank.percentile).toFixed(1)}%</text>
  </g>
  <text x="900" y="162" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="1.6" fill="${c.muted}"${A.a(0.6, 0.5, { o: 0 })}>RANK</text>`;
}

function statsPanel(d, c, A) {
  const s = d.stats;
  const items = [
    ["star", "Total Stars", s.stars],
    ["commit", "Total Commits", s.commits],
    ["pr", "Pull Requests", s.prs],
    ["issue", "Issues", s.issues],
    ["review", "Code Reviews", s.reviews],
    ["org", "Contributed to", s.contributedTo],
    ["people", "Followers", s.followers],
    ["repo", "Repositories", s.repos],
  ];
  return `
  <g${A.a(0.4, 0.5, { o: 0 })}>${panel(30, 184, 460, 168, c)}${heading(50, 210, "STATS", c)}</g>
  ${items
    .map(([ic, label, value], i) => {
      const x = 50 + (i % 2) * 225;
      const y = 240 + Math.floor(i / 2) * 30;
      return `<g${A.a(0.55 + i * 0.07, 0.45, { o: 0, ty: 8 })}>
    ${icon(ic, x, y - 12, 15, c.accent)}
    <text x="${x + 24}" y="${y}" font-size="13.5" fill="${c.muted}">${label}</text>
    <text x="${x + 200}" y="${y}" text-anchor="end" font-size="15" font-weight="700" fill="${c.text}">${num(value)}</text>
  </g>`;
    })
    .join("")}`;
}

function streakPanel(d, c, A) {
  const { total, current, longest, first } = d.streak;
  const range = (s) => (s.length ? `${fmtDate(s.start, false)} – ${fmtDate(s.end)}` : "No streak yet");
  const col = (x, delay, value, label, sub, color) => `<g${A.a(delay, 0.5, { o: 0, ty: 10 })}>
    <text x="${x}" y="${value.big ? 278 : 276}" text-anchor="middle" font-size="${value.big ? 30 : 26}" font-weight="800" fill="${color}">${value.text}</text>
    <text x="${x}" y="326" text-anchor="middle" font-size="13" font-weight="600" fill="${color === c.fire ? c.fire : c.text}">${label}</text>
    <text x="${x}" y="343" text-anchor="middle" font-size="11" fill="${c.muted}">${sub}</text>
  </g>`;
  return `
  <g${A.a(0.6, 0.5, { o: 0 })}>${panel(510, 184, 460, 168, c)}${heading(530, 210, "STREAK", c)}
    <line x1="663" y1="222" x2="663" y2="340" stroke="${c.border}"/><line x1="817" y1="222" x2="817" y2="340" stroke="${c.border}"/>
  </g>
  ${col(587, 0.8, { text: num(total) }, "Total Contributions", first ? `${fmtDate(first, false)} ${first.slice(0, 4)} – Present` : "", c.text)}
  <g${A.a(0.9, 0.6, { o: 0, s: 0.6 }, {}, [740, 266])}>
    <circle cx="740" cy="266" r="38" fill="none" stroke="${c.fire}" stroke-width="4" opacity="0.9"/>
    <circle cx="740" cy="228" r="12" fill="${c.panel}"/>
    ${icon("flame", 731, 219, 18, c.fire)}
  </g>
  ${col(740, 1.0, { text: num(current.length), big: true }, "Current Streak", range(current), c.fire)}
  ${col(893, 1.1, { text: num(longest.length) }, "Longest Streak", range(longest), c.text)}`;
}

function languagesPanel(d, c, A) {
  const { top, total } = d.languages;
  let x = 50;
  const segs = top
    .map((l) => {
      const w = (l.percent / 100) * 900;
      const r = `<rect x="${r3(x)}" y="414" width="${r3(w + 0.5)}" height="12" fill="${l.color}"/>`;
      x += w;
      return r;
    })
    .join("");
  return `
  <g${A.a(1.0, 0.5, { o: 0 })}>${panel(30, 372, 940, 112, c)}${heading(50, 398, "TOP LANGUAGES", c, `<tspan dx="6" font-weight="400" letter-spacing="0">· ${total} used</tspan>`)}</g>
  <clipPath id="bar"><rect x="50" y="414" width="900" height="12" rx="6"/></clipPath>
  <rect x="50" y="414" width="900" height="12" rx="6" fill="${c.track}"/>
  <g clip-path="url(#bar)"><g${A.a(1.1, 1.0, { sx: 0 }, {}, [50, 420])}>${segs}</g></g>
  ${top
    .map((l, i) => {
      const lx = 50 + (i % 4) * 228;
      const ly = 452 + Math.floor(i / 4) * 22;
      return `<g${A.a(1.3 + i * 0.06, 0.4, { o: 0 })}>
    <circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${l.color}"/>
    <text x="${lx + 16}" y="${ly}" font-size="13" fill="${c.text}">${esc(trunc(l.name, 18))} <tspan fill="${c.muted}">${l.percent.toFixed(1)}%</tspan></text>
  </g>`;
    })
    .join("")}`;
}

function trophiesPanel(d, c, A) {
  const list = d.trophies;
  const n = list.length;
  const gap = 10;
  const cw = (920 - gap * (n - 1)) / n;
  const chars = Math.max(4, Math.floor(cw / 6.6));
  return `
  <g${A.a(1.3, 0.5, { o: 0 })}>${panel(30, 504, 940, 150, c)}${heading(50, 530, "TROPHIES", c)}</g>
  ${list
    .map((tr, i) => {
      const x = 40 + i * (cw + gap);
      const cx = x + cw / 2;
      const secret = tr.rank === "SECRET";
      const color = secret ? "url(#rainbow)" : TROPHY_COLORS[tr.rank[0]] ?? TROPHY_COLORS["?"];
      const letter = secret ? "★" : tr.rank;
      const barW = cw - 20;
      return `<g${A.a(1.45 + i * 0.07, 0.45, { o: 0, s: 0.5 }, {}, [r3(cx), 590])}>
    <title>${esc(tr.title)}: ${esc(tr.label)}${tr.score !== null ? ` (${num(tr.score)})` : ""}</title>
    <rect x="${r3(x)}" y="542" width="${r3(cw)}" height="102" rx="10" fill="${c.bg1}" stroke="${c.border}"/>
    ${icon("trophy", r3(cx - 13), 552, 26, color)}
    <text x="${r3(cx)}" y="604" text-anchor="middle" font-size="${letter.length > 2 ? 15 : 18}" font-weight="800" fill="${color}">${letter}</text>
    <text x="${r3(cx)}" y="621" text-anchor="middle" font-size="11" font-weight="600" fill="${c.muted}">${esc(trunc(tr.title, chars))}</text>
    <rect x="${r3(x + 10)}" y="631" width="${r3(barW)}" height="3" rx="1.5" fill="${c.track}"/>
    <rect x="${r3(x + 10)}" y="631" width="${r3(barW * tr.progress)}" height="3" rx="1.5" fill="${color}"/>
  </g>`;
    })
    .join("")}`;
}

function heatmapPanel(d, c, A) {
  const counts = new Map(d.days);
  const today = new Date(d.days.at(-1)[0] + "T00:00:00Z");
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - today.getUTCDay() - 52 * 7);
  const weeks = [];
  let lastYear = 0;
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + w * 7 + i);
      if (day > today) break;
      const key = day.toISOString().slice(0, 10);
      const n = counts.get(key) ?? 0;
      lastYear += n;
      days.push([key, n, i]);
    }
    weeks.push(days);
  }
  const max = Math.max(1, ...weeks.flat().map(([, n]) => n));
  const level = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const step = 16.8;
  const x0 = 78;
  const y0 = 722;
  let month = "";
  const months = weeks
    .map((wk, w) => {
      const m = wk[0] && new Date(wk[0][0] + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
      if (!m || m === month) return "";
      month = m;
      return w > 50 ? "" : `<text x="${r3(x0 + w * step)}" y="${y0 - 8}" font-size="10" fill="${c.muted}">${m}</text>`;
    })
    .join("");
  return `
  <g${A.a(1.7, 0.5, { o: 0 })}>${panel(30, 674, 940, 180, c)}${heading(50, 698, "CONTRIBUTIONS", c, `<tspan dx="6" font-weight="400" letter-spacing="0">· ${num(lastYear)} in the last year</tspan>`)}
    ${months}
    ${["Mon", "Wed", "Fri"].map((t, i) => `<text x="50" y="${r3(y0 + (1 + i * 2) * step + 10)}" font-size="10" fill="${c.muted}">${t}</text>`).join("")}
  </g>
  ${weeks
    .map(
      (wk, w) =>
        `<g${A.a(1.8 + w * 0.025, 0.35, { o: 0 })}>${wk
          .map(([key, n, i]) => `<rect x="${r3(x0 + w * step)}" y="${r3(y0 + i * step)}" width="13.5" height="13.5" rx="3" fill="${c.heat[level(n)]}"><title>${n} on ${key}</title></rect>`)
          .join("")}</g>`,
    )
    .join("")}
  <g${A.a(2.4, 0.5, { o: 0 })}>
    <text x="840" y="${H - 18}" text-anchor="end" font-size="10" fill="${c.muted}">Less</text>
    ${c.heat.map((h, i) => `<rect x="${846 + i * 16}" y="${H - 28}" width="12" height="12" rx="3" fill="${h}"/>`).join("")}
    <text x="930" y="${H - 18}" font-size="10" fill="${c.muted}">More</text>
    <text x="50" y="${H - 18}" font-size="10" fill="${c.muted}">Generated by profile-forge · ${d.days.at(-1)[0]}</text>
  </g>`;
}

/** Render the full card. opts.t undefined = animated SVG, number = static frame at that progress. */
export function render(d, { theme = "dark", t } = {}) {
  const c = THEMES[theme] ?? THEMES.dark;
  const A = animator(t);
  const body = [header, statsPanel, streakPanel, languagesPanel, trophiesPanel, heatmapPanel].map((f) => f(d, c, A)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Segoe UI', Ubuntu, 'Helvetica Neue', Arial, sans-serif" role="img" aria-label="GitHub profile card for ${esc(d.login)}">
  <title>${esc(d.name)} (@${esc(d.login)}) — GitHub profile</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.bg1}"/><stop offset="1" stop-color="${c.bg2}"/></linearGradient>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.accent}"/><stop offset="1" stop-color="${c.accent2}"/></linearGradient>
    <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b9a"/><stop offset=".5" stop-color="#b48cff"/><stop offset="1" stop-color="#4fd1ff"/></linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0" r="0.6"><stop offset="0" stop-color="${c.accent2}" stop-opacity="0.18"/><stop offset="1" stop-color="${c.accent2}" stop-opacity="0"/></radialGradient>
  </defs>${A.css.length ? `\n  <style>${A.css.join("")}</style>` : ""}
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="20" fill="url(#bg)" stroke="${c.border}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="20" fill="url(#glow)"/>
  ${body}
</svg>`;
}
