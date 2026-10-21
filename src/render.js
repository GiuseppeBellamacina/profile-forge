import { BRANDS, CUP, ICONS, LAUREL } from "./icons.js";
import { normalize } from "./config.js";
import { intlTag, translator } from "./i18n.js";
import { drawFrame, frameFor } from "./frames.js";
import { ALL_LEVELS, isTop, levelColor } from "./levels.js";
import { snakeRoute } from "./snake.js";
import { GLYPHS, TONES } from "./secrets.js";
import { trophyMatches } from "./stats.js";
import { mix, parseColors, resolveTheme } from "./themes.js";

/** Total timeline length in seconds; GIF frames sample t∈[0,1] over it. */
/** Body and display font stacks; Inter / Space Grotesk are embedded via @font-face when available. */
const FB = "Inter, 'Segoe UI', Ubuntu, 'Helvetica Neue', Arial, sans-serif";
const FD = "'Space Grotesk', Inter, 'Segoe UI', Ubuntu, sans-serif";
export const DURATION = 4.4;
// The free grid: 6 columns of 140px with a 20px gutter inside the 940px content area.
export const COLS = 6;
const GUTTER = 20;
const COL_W = 140;
export const spanWidth = (n) => n * COL_W + (n - 1) * GUTTER;
export const TOP_PAD = 30;
export const BOTTOM_PAD = 34;
const W = 1000;

const clamp = (x) => Math.min(1, Math.max(0, x));
const easeOut = (x) => 1 - (1 - x) ** 3;
const r3 = (x) => +x.toFixed(3);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
/** 6626 -> "6.6k" (precision null = up to 1 decimal, else fixed digits). */
const short = (n, precision = null) => {
  const [v, u] = n >= 1e6 ? [n / 1e6, "M"] : n >= 1e3 ? [n / 1e3, "k"] : [n, ""];
  return u ? `${precision == null ? +v.toFixed(1) : v.toFixed(precision)}${u}` : String(n);
};
/** 1234567 -> "1.2M", up to trillions. */
const shortBig = (n) => {
  const u = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]].find(([f]) => n >= f);
  return u ? `${+(n / u[0]).toFixed(1)}${u[1]}` : String(n);
};
const bytes = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);
/** Tiny PHP-style date format (d j m n M F y Y); "[...]" is dropped when the date is in the current year. */
const phpDate = (iso, fmt, nowYear, tag) => {
  const [Y, m, d] = iso.split("-").map(Number);
  const month = (style) => new Date(Date.UTC(Y, m - 1, 1)).toLocaleDateString(tag, { month: style, timeZone: "UTC" });
  const t = { d: String(d).padStart(2, "0"), j: d, m: String(m).padStart(2, "0"), n: m, M: month("short"), F: month("long"), y: String(Y).slice(2), Y };
  return fmt.replace(/\[(.*?)\]/g, (_, x) => (Y === nowYear ? "" : x)).replace(/[djmnMFyY]/g, (key) => t[key]);
};
/** Localized weekday name; i = 0 for Sunday. */
const weekday = (tag, i, style = "long") => new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(tag, { weekday: style, timeZone: "UTC" });
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
    t,
    dt: 0,
    /**
     * An endless loop (glow, sparkle, spin) as attributes to put on an element. frames: { "0%,100%": "opacity:.2", "50%": "opacity:1" }.
     * Static frames (PNG / GIF) get `still` instead: the element held at one pose, no CSS.
     */
    loop(frames, { dur = 2, ease = "ease-in-out", delay = 0, origin, still = "" } = {}) {
      if (t !== undefined) return still;
      const name = `lp${css.length}`;
      css.push(`@keyframes ${name}{${Object.entries(frames).map(([k, v]) => `${k}{${v}}`).join("")}}`);
      const o = origin ? `transform-origin:${origin[0]}px ${origin[1]}px;` : "";
      return ` style="${o}animation:${name} ${dur}s ${ease} ${r3(delay + this.dt)}s infinite"`;
    },
    a(delay, dur, from, to = {}, origin) {
      delay = r3(delay + this.dt);
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
  `<text x="${x}" y="${y}" font-size="12" font-weight="700" font-family="${FD}" letter-spacing="1.6" fill="${c.title}">${esc(text)}${extra}</text>`;
const sub = (c, text) => `<tspan dx="6" font-weight="400" letter-spacing="0" fill="${c.muted}">· ${esc(text)}</tspan>`;

/**
 * Every section is { w, h, top, nx, draw(H) }: w = its width (a section can be built at any width the grid gives it; 940 / 460 are the natural ones), h = natural height,
 * top/nx = the absolute y/x origin it draws at (the layout engine translates it), draw(H) = svg for a panel of height H.
 */
function headerSection(d, X) {
  const { c, A, k, tr, tag, num, fmtDate } = X;
  const hs = k.header;
  const showAvatar = hs.avatar !== "hide";
  const nx = showAvatar ? 172 : 40;
  const fx = k.flagData ? 34 : 0; // the flag sits at the start of the "joined" line
  const joined = new Date(d.createdAt).toLocaleDateString(tag, { month: "short", year: "numeric", timeZone: "UTC" });
  const FACTS = {
    contributionsThisYear: ["zap", tr("inYear", { n: num(d.facts.thisYear), y: d.days.at(-1)[0].slice(0, 4) })],
    bestDay: ["flame", tr("bestDay", { n: num(d.facts.bestDay[1]), d: fmtDate(d.facts.bestDay[0]) })],
    busiestWeekday: ["calendar", tr("mostActive", { d: weekday(tag, d.facts.busiestWeekdayIndex) })],
    currentStreak: ["flame", tr("curFact", { n: num(d.streak.current.length) })],
    longestStreak: ["flame", tr("longFact", { n: num(d.streak.longest.length) })],
    topLanguage: ["code", tr("topLang", { l: d.languages.top[0]?.name ?? "–" })],
    stars: ["star", tr("starsFact", { n: num(d.stats.stars) })],
    followers: ["people", tr("followersFact", { n: num(d.stats.followers) })],
  };
  const facts = hs.facts.map((f) => FACTS[f]);
  const ringStyle = hs.rankStyle;
  const thick = hs.rankThickness;
  // the rank indicator at `grow` pixels outside its base size, as a ring, a hexagon or a shield; pathLength is 100 so that dashes are percents
  const ringEl = (grow, attrs) => {
    const R = 50 + grow;
    if (ringStyle === "hexagon") {
      const pts = Array.from({ length: 6 }, (_, k) => { const a = ((-90 + 60 * k) * Math.PI) / 180; return `${r3(900 + R * 1.06 * Math.cos(a))} ${r3(90 + R * 1.06 * Math.sin(a))}`; });
      return `<path d="M${pts.join("L")}Z" fill="none" pathLength="100" stroke-linejoin="round" ${attrs}/>`;
    }
    if (ringStyle === "shield") {
      const k = R / 50;
      const P = (x, y) => `${r3(900 + (x - 900) * k)} ${r3(92 + (y - 92) * k)}`;
      return `<path d="M${P(900, 40)}L${P(947, 54)}V${r3(92 + (92 - 92) * k)}C${P(947, 120)} ${P(924, 137)} ${P(900, 146)}C${P(876, 137)} ${P(853, 120)} ${P(853, 92)}V${r3(92 + (54 - 92) * k)}Z" fill="none" pathLength="100" stroke-linejoin="round" ${attrs}/>`;
    }
    return `<circle cx="900" cy="90" r="${R}" fill="none" pathLength="100" ${attrs}/>`;
  };
  // the progress colour: the colour of the level, lighter at the start (the top 1% runs from pink to gold)
  const lvCol = levelColor(c, d.rank.level);
  X.defs.push(`<linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(lvCol, "#ffffff", 0.35)}"/><stop offset="1" stop-color="${isTop(d.rank.level) ? levelColor(c, "S") : lvCol}"/></linearGradient>`);
  const progress = 100 - d.rank.percentile;
  const pct = hs.rankIcon === "percentile";
  const gh = hs.rankIcon === "github";
  // the frame around the avatar: the classic gradient ring, or one of the decorations (frames.js); "auto" follows the level
  const rounded = hs.avatar === "rounded";
  const frameKind = frameFor(hs.frame, d.rank.level);
  const frame = () => {
    if (frameKind === "none") return "";
    if (frameKind === "ring" && hs.frame === "ring" && !c.frame) return rounded
      ? `<rect x="34" y="32" width="116" height="116" rx="30" fill="none" stroke="url(#grad)" stroke-width="3"/>`
      : `<circle cx="92" cy="90" r="58" fill="none" stroke="url(#grad)" stroke-width="3"/>`;
    return drawFrame(frameKind, { shape: rounded ? "rounded" : "circle", color: c.frame ?? levelColor(c, d.rank.level), c, A, level: d.rank.level, motion: hs.frameAnimation });
  };
  const avatar = () => `${frame()}
    ${rounded ? `<clipPath id="av"><rect x="40" y="38" width="104" height="104" rx="24"/></clipPath>` : `<clipPath id="av"><circle cx="92" cy="90" r="52"/></clipPath>`}`;
  const top = isTop(d.rank.level);
  // the top 1%: a pulsing halo, a light that runs around the ring and sparkles that twinkle (plain CSS loops)
  const topRing = () => {
    const col = levelColor(c, d.rank.level);
    const spark = (k) => {
      const a = ((60 * k + 15) * Math.PI) / 180;
      const x = r3(900 + 66 * Math.cos(a));
      const y = r3(90 + 66 * Math.sin(a));
      const s = 4.2;
      return `<path d="M${x} ${r3(y - s)}L${r3(x + s * 0.3)} ${r3(y - s * 0.3)}L${r3(x + s)} ${y}L${r3(x + s * 0.3)} ${r3(y + s * 0.3)}L${x} ${r3(y + s)}L${r3(x - s * 0.3)} ${r3(y + s * 0.3)}L${r3(x - s)} ${y}L${r3(x - s * 0.3)} ${r3(y - s * 0.3)}Z" fill="${col}" opacity="0.9"${A.loop({ "0%,100%": "opacity:0;transform:scale(.3)", "50%": "opacity:1;transform:scale(1)" }, { dur: 2, delay: 1.2 + k * 0.33, origin: [x, y] })}/>`;
    };
    return `${ringEl(9, `stroke="${col}" stroke-width="2.5" opacity="0.4"${A.loop({ "0%,100%": "opacity:.15", "50%": "opacity:.75" }, { dur: 2.4, delay: 1.2 })}`)}
    ${ringEl(0, `stroke="#fff" stroke-width="${thick}" stroke-linecap="round" stroke-dasharray="7 93" opacity="0.55"${A.loop({ "0%": "stroke-dashoffset:0", "100%": "stroke-dashoffset:-100" }, { dur: 3.2, ease: "linear", delay: 1.2, still: ' stroke-dashoffset="-12"' })}`)}
    ${Array.from({ length: 6 }, (_, k) => spark(k)).join("")}`;
  };
  const rank = () => `<g${A.a(0.3, 0.5, { o: 0, s: 0.7 }, {}, [900, 90])}>
    ${ringEl(0, `stroke="${c.track}" stroke-width="${thick}"`)}
    ${ringEl(0, `stroke="url(#rg)" stroke-width="${thick}" stroke-linecap="round" stroke-dasharray="100"${ringStyle === "ring" ? ' transform="rotate(-90 900 90)"' : ""}${A.a(0.5, 1.4, { dash: 100 }, { dash: 100 - progress })}`)}
    ${top ? topRing() : ""}
    ${
      pct
        ? `<text x="900" y="97" text-anchor="middle" font-size="22" font-weight="700" font-family="${FD}" fill="${c.text}">${r3(d.rank.percentile).toFixed(1)}%</text>
    <text x="900" y="115" text-anchor="middle" font-size="10" fill="${c.muted}">${esc(tr("rankLabel", { l: d.rank.level }))}</text>`
        : `${gh ? icon("github", 882, 70, 36, c.text) : `<text x="900" y="99" text-anchor="middle" font-size="30" font-weight="700" font-family="${FD}" fill="${levelColor(c, d.rank.level)}">${d.rank.level}</text>`}
    <text x="900" y="${gh ? 122 : 117}" text-anchor="middle" font-size="10" fill="${c.muted}">${esc(tr("top", { p: r3(d.rank.percentile).toFixed(1) }))}</text>`
    }
  </g>
  <text x="900" y="162" text-anchor="middle" font-size="11" font-weight="700" font-family="${FD}" letter-spacing="1.6" fill="${c.muted}"${A.a(0.6, 0.5, { o: 0 })}>${esc(tr("rank"))}</text>`;
  return {
    w: 940, h: 170, top: 0, nx: 30,
    draw: () => `
  ${
    showAvatar
      ? `<g${A.a(0, 0.6, { o: 0, s: 0.6 }, {}, [92, 90])}>
    ${avatar()}
    <image href="${d.avatar}" x="40" y="38" width="104" height="104" clip-path="url(#av)" preserveAspectRatio="xMidYMid slice"/>
  </g>`
      : ""
  }
  <g${A.a(0.15, 0.6, { o: 0, ty: 12 })}>
    <text x="${nx}" y="78" font-size="32" font-weight="700" font-family="${FD}" fill="${c.text}">${esc(trunc(d.name, showAvatar ? 24 : 30))}</text>
    <text x="${nx}" y="106" font-size="16" font-weight="600" fill="${c.accent}">@${esc(d.login)}${k.title ? `<tspan dx="4" font-weight="400" fill="${c.muted}">· ${esc(k.title)}</tspan>` : ""}</text>
    ${flag(k.flagData, nx, 119)}
    ${icon("history", nx + fx, 122, 14, c.muted)}
    <text x="${nx + fx + 21}" y="134" font-size="13" fill="${c.muted}">${esc(tr("joined", { d: joined, n: tr(d.years === 1 ? "year" : "years", { n: d.years }) }))}</text>
  </g>
  ${facts
    .map(
      ([ic, text], i) => `<g${A.a(0.3 + i * 0.1, 0.5, { o: 0, ty: 10 })}>
    ${icon(ic, 560, 54 + i * 32, 14, c.accent2)}
    <text x="582" y="${66 + i * 32}" font-size="13" fill="${c.text}">${esc(text)}</text>
  </g>`,
    )
    .join("")}
  ${X.showRank ? rank() : ""}`,
  };
}

/** The flag at the start of the "joined" line: 4:3 image (embedded as a data URI by the caller) with rounded corners and a hairline. */
const flag = (data, x, y) =>
  data
    ? `<clipPath id="flagclip"><rect x="${r3(x)}" y="${y}" width="26" height="19.5" rx="3"/></clipPath><image href="${data}" x="${r3(x)}" y="${y}" width="26" height="19.5" preserveAspectRatio="xMidYMid slice" clip-path="url(#flagclip)"/><rect x="${r3(x)}" y="${y}" width="26" height="19.5" rx="3" fill="none" stroke="#808080" stroke-opacity="0.35"/>`
    : "";

function statsSection(d, X, W = 460) {
  const { c, A, k, tr, num } = X;
  const o = k.stats;
  const s = d.stats;
  const base = [
    ["star", "stars", s.stars], ["commit", "commits", s.commits], ["pr", "prs", s.prs], ["issue", "issues", s.issues],
    ["review", "reviews", s.reviews], ["org", "contributed", s.contributedTo], ["people", "followers", s.followers], ["repo", "repos", s.repos],
  ].filter(([, id]) => !o.hide.has(id));
  const extra = [
    ["pr", "prsMerged", s.prsMerged], ["pr", "prsMergedPercentage", s.prsMergedPercentage],
    ["issue", "discussionsStarted", s.discussionsStarted], ["review", "discussionsAnswered", s.discussionsAnswered],
  ].filter(([, id]) => o.show.has(id.toLowerCase()));
  const items = [...base, ...extra];
  const fmt = (id, v) => (id === "prsMergedPercentage" ? `${v.toFixed(1)}%` : o.numberFormat === "short" ? short(v, o.numberPrecision) : num(v));
  const two = W >= 400; // narrow cards list the stats in one column
  const colW = two ? (W - 40) / 2 : W - 40;
  const rows = Math.max(1, Math.ceil(items.length / (two ? 2 : 1)));
  const lh = o.lineHeight;
  const gap = o.icons ? 24 : 0;
  return {
    w: W, top: 184, nx: 30, h: Math.max(120, 78 + (rows - 1) * lh),
    draw: (H) => `
  <g${A.a(0.4, 0.5, { o: 0 })}>${panel(30, 184, W, H, c)}${heading(50, 210, o.title ?? tr("stats"), c)}</g>
  ${items
    .map(([ic, id, value], i) => {
      const x = 50 + (two ? i % 2 : 0) * colW;
      const y = 240 + Math.floor(i / (two ? 2 : 1)) * lh;
      return `<g${A.a(0.55 + i * 0.07, 0.45, { o: 0, ty: 8 })}>
    ${o.icons ? icon(ic, x, y - 12, 15, c.accent) : ""}
    <text x="${x + gap}" y="${y}" font-size="13.5" font-weight="${o.textBold ? 600 : 400}" fill="${c.muted}">${esc(tr(id))}</text>
    <text x="${x + colW - 25}" y="${y}" text-anchor="end" font-size="15" font-weight="700" font-family="${FD}" fill="${c.text}">${fmt(id, value)}</text>
  </g>`;
    })
    .join("")}`,
  };
}

function streakSection(d, X, W = 460) {
  const { c, A, k, tr, tag, num, fmtDate } = X;
  const o = k.streak;
  const { total, current, longest, first } = d.streak;
  const year = Number(d.days.at(-1)[0].slice(0, 4));
  const f = (x, y = true) => (o.dateFormat ? phpDate(x, o.dateFormat, year, tag) : fmtDate(x, y));
  const range = (s) => (s.length ? `${f(s.start, false)} – ${f(s.end)}` : tr("noStreak"));
  const since = !first ? "" : o.dateFormat ? `${f(first)} – ${tr("present")}` : `${fmtDate(first, false)} ${first.slice(0, 4)} – ${tr("present")}`;
  const nfmt = (n) => (o.shortNumbers ? shortBig(n) : num(n));
  const weekly = o.mode === "weekly";
  const unit = weekly ? `<tspan font-size="13" font-weight="600" dx="3">${esc(tr("weeks"))}</tspan>` : "";
  const cols = [
    ["total", 0.8, { text: nfmt(total) }, tr("totalContrib"), since, c.streakSideNums, c.streakSideLabels],
    ["current", 1.0, { text: nfmt(current.length), big: true, unit: weekly ? tr("weeks") : "" }, tr("current"), range(current), c.streakCurrNum, c.streakCurrLabel],
    ["longest", 1.1, { text: nfmt(longest.length) + unit }, tr("longest"), range(longest), c.streakSideNums, c.streakSideLabels],
  ].filter((x) => !o.hide.has(x[0]));
  const n = cols.length;
  if (!n) return null;
  const col = (x, delay, value, label, text, numColor, labelColor) => `<g${A.a(delay, 0.5, { o: 0, ty: 10 })}>
    <text x="${x}" y="${value.big ? (value.unit ? 272 : 278) : 276}" text-anchor="middle" font-size="${value.big ? 30 : 26}" font-weight="700" font-family="${FD}" fill="${numColor}">${value.text}</text>
    ${value.unit ? `<text x="${x}" y="291" text-anchor="middle" font-size="11" font-weight="600" fill="${numColor}">${esc(value.unit)}</text>` : ""}
    <text x="${x}" y="326" text-anchor="middle" font-size="13" font-weight="600" fill="${labelColor}">${esc(label)}</text>
    <text x="${x}" y="343" text-anchor="middle" font-size="11" fill="${c.streakDates}">${esc(text)}</text>
  </g>`;
  const dividers = Array.from({ length: n - 1 }, (_, i) => {
    const x = r3(510 + (W * (i + 1)) / n);
    return `<line x1="${x}" y1="222" x2="${x}" y2="340" stroke="${c.streakStroke}"/>`;
  }).join("");
  const days = [...o.excludeDays].sort().map((i) => weekday(tag, i, "short")).join(", ");
  return {
    w: W, top: 184, nx: 510, h: 168,
    draw: (H) => `
  <g${A.a(0.6, 0.5, { o: 0 })}>${panel(510, 184, W, H, c)}${heading(530, 210, o.title ?? tr("streak"), c)}${dividers}
    ${o.excludeDays.size && o.excludeDaysLabel ? `<text x="${510 + W - 20}" y="210" text-anchor="end" font-size="10" fill="${c.streakExcl}">${esc(tr("excluding", { days }))}</text>` : ""}
  </g>
  <g transform="translate(0 ${r3((H - 168) / 2)})">${cols
    .map(([key, delay, value, label, text, nc, lc], i) => {
      const x = r3(510 + (W * (i + 0.5)) / n);
      const ring =
        key === "current"
          ? `<g${A.a(0.9, 0.6, { o: 0, s: 0.6 }, {}, [x, 266])}>
    <circle cx="${x}" cy="266" r="38" fill="none" stroke="${c.fire}" stroke-width="4" opacity="0.9"/>
    <circle cx="${x}" cy="228" r="12" fill="${c.panel}"/>
    ${icon("flame", r3(x - 9), 219, 18, c.fire)}
  </g>`
          : "";
      return ring + col(x, delay, value, label, text, nc, lc);
    })
    .join("")}</g>`,
  };
}

const arc = (cx, cy, r, a0, a1) => {
  const p = (a) => `${r3(cx + r * Math.cos(a))} ${r3(cy + r * Math.sin(a))}`;
  return `${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
};

function languagesSection(d, X, w) {
  const { c, A, k, tr } = X;
  const o = k.languages;
  const chartLayout = o.layout !== "bar" && o.layout !== "compact";
  const W = w ?? (chartLayout ? 460 : 940);
  const { top, total } = d.languages;
  if (!top.length) return null;
  const value = (l) => (o.hideProgress ? "" : o.statsFormat === "bytes" ? bytes(l.size) : `${l.percent.toFixed(1)}%`);
  const label = (l, x, y, size, max) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${c.text}">${esc(trunc(l.name, max))}${value(l) ? ` <tspan fill="${c.muted}">${value(l)}</tspan>` : ""}</text>`;
  const title = heading(50, 398, o.title ?? tr("languages"), c, sub(c, tr("used", { n: total })));
  const dot = (l, x, y) => `<circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${l.color}"/>`;

  if (o.layout === "bar" || o.layout === "compact") {
    const compact = o.layout === "compact";
    const IW = W - 40;
    const cols = W < 500 ? 2 : W < 700 ? 3 : compact ? 5 : 4;
    const rows = Math.ceil(top.length / cols);
    const bar = !o.hideProgress;
    const y0 = bar ? 452 : 424;
    const bh = compact ? 8 : 12;
    const h = bar ? 90 + (rows - 1) * 22 : 58 + (rows - 1) * 22;
    return {
      w: W, top: 372, nx: 30, h,
      draw: (H) => {
        let x = 50;
        const segs = top.map((l) => {
          const w = (l.percent / 100) * IW;
          const r = `<rect x="${r3(x)}" y="414" width="${r3(w + 0.5)}" height="${bh}" fill="${l.color}"/>`;
          x += w;
          return r;
        }).join("");
        return `
  <g${A.a(1.0, 0.5, { o: 0 })}>${panel(30, 372, W, H, c)}${title}</g>
  ${bar ? `<clipPath id="bar"><rect x="50" y="414" width="${IW}" height="${bh}" rx="${bh / 2}"/></clipPath>
  <rect x="50" y="414" width="${IW}" height="${bh}" rx="${bh / 2}" fill="${c.track}"${A.a(1.0, 0.5, { o: 0 })}/>
  <g clip-path="url(#bar)"><g${A.a(1.1, 1.0, { sx: 0 }, {}, [50, 420])}>${segs}</g></g>` : ""}
  ${top.map((l, i) => {
    const lx = 50 + (i % cols) * (IW / cols);
    const ly = y0 + Math.floor(i / cols) * 22;
    return `<g${A.a(1.3 + i * 0.06, 0.4, { o: 0 })}>${dot(l, lx, ly)}${label(l, lx + 16, ly, compact ? 12 : 13, compact ? 14 : 18)}</g>`;
  }).join("")}`;
      },
    };
  }

  // Charts: donut / pie (legend on the right) and donut-vertical (legend below; also used when the card is narrow).
  const vertical = o.layout === "donut-vertical" || W < 400;
  const shown = top.slice(0, 10);
  const pie = o.layout === "pie";
  const R = 56;
  const rows = Math.ceil(shown.length / 2);
  const h = vertical ? 208 + (rows - 1) * 22 : 168;
  const cx = vertical ? 30 + W / 2 : 120;
  const cy = vertical ? 372 + 54 + R : 372 + 100;
  const chart = () => {
    let a = -Math.PI / 2;
    return top.map((l) => {
      const span = (l.percent / 100) * Math.PI * 2;
      const a0 = a;
      a += span;
      if (l.percent >= 99.9) return pie ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${l.color}"/>` : `<circle cx="${cx}" cy="${cy}" r="${R - 12}" fill="none" stroke="${l.color}" stroke-width="24"/>`;
      return pie
        ? `<path d="M${cx} ${cy} L${arc(cx, cy, R, a0, a)} Z" fill="${l.color}" stroke="${c.panel}" stroke-width="1.5"/>`
        : `<path d="M${arc(cx, cy, R - 12, a0, a)}" fill="none" stroke="${l.color}" stroke-width="24"/>`;
    }).join("");
  };
  return {
    w: W, top: 372, nx: 30, h,
    draw: (H) => {
      const two = shown.length > 5 || vertical;
      const colStep = vertical ? (W - 60) / 2 : Math.min(200, Math.max(140, (W - 235) / 2));
      const legend = shown.map((l, i) => {
        const col = two ? i % 2 : 0;
        const row = two ? Math.floor(i / 2) : i;
        const lx = vertical ? 60 + col * colStep : 215 + col * colStep;
        const ly = (vertical ? cy + R + 28 : 372 + 56) + row * 22;
        return `<g${A.a(1.3 + i * 0.06, 0.4, { o: 0 })}>${dot(l, lx, ly)}${label(l, lx + 16, ly, 12, vertical || W >= 700 ? 18 : 9)}</g>`;
      }).join("");
      return `
  <g${A.a(1.0, 0.5, { o: 0 })}>${panel(30, 372, W, H, c)}${title}</g>
  <g${A.a(1.1, 0.9, { o: 0, s: 0.6 }, {}, [cx, cy])}>${chart()}${pie ? "" : `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="18" font-weight="700" font-family="${FD}" fill="${c.text}">${total}</text>`}</g>
  ${legend}`;
    },
  };
}


/** One 110×110 trophy, drawn like github-profile-trophy (cup, laurel for S/A, extra cups for SS/SSS). */
// Trophies: the classic github-profile-trophy cup with its laurel, drawn in the colour of the level. The higher the level the
// richer it gets: A has the laurel, S adds a second cup, the top 1% (S+) three cups.
export const TROPHY_PARTS = ["title", "label", "score", "bar"];
const abridge = (n) => (n < 1 ? "0pt" : n > 999 ? `${(n / 1000).toFixed(1)}kpt` : `${n}pt`);

/**
 * A secret trophy: a cut gem in the colour of its family with its own glyph, a few sparkles and its name. No cup, no level.
 * Same 110 x 110 card and the same parts (title, label, score, bar) as the others.
 */
function secretTrophy(tr, X, o, i) {
  const { c, A } = X;
  const sec = tr.secret ?? {};
  const tone = TONES[sec.tone] ?? TONES.violet;
  const has = (p) => o.parts.has(p);
  const cx = 55;
  const cy = 50;
  const R = 25;
  const vertex = (k, r) => [r3(cx + r * Math.cos(((k * 60 - 90) * Math.PI) / 180)), r3(cy + r * Math.sin(((k * 60 - 90) * Math.PI) / 180))];
  // the facets, lit from the top left
  const shade = [mix(tone, "#ffffff", 0.3), mix(tone, "#ffffff", 0.05), mix(tone, "#000000", 0.22), mix(tone, "#000000", 0.4), mix(tone, "#000000", 0.12), mix(tone, "#ffffff", 0.45)];
  const facets = shade.map((f, k) => `<polygon points="${cx},${cy} ${vertex(k, R).join(",")} ${vertex(k + 1, R).join(",")}" fill="${f}" stroke="${mix(tone, "#000000", 0.5)}" stroke-width="0.4" stroke-linejoin="round"/>`).join("");
  const ring = `<polygon points="${[0, 1, 2, 3, 4, 5].map((k) => vertex(k, R).join(",")).join(" ")}" fill="none" stroke="${mix(tone, "#ffffff", 0.55)}" stroke-width="1" stroke-linejoin="round" opacity="0.8"/>`;
  const ink = mix(tone, "#ffffff", 0.82);
  const [kind, name] = (sec.glyph ?? "t:?").split(/:(.*)/s);
  const GS = 22; // glyph box
  let glyph;
  if (kind === "t") {
    const len = name.length;
    glyph = `<text x="${cx}" y="${cy + (len > 3 ? 3 : 4)}" text-anchor="middle" font-size="${len > 3 ? 8.5 : len > 2 ? 10.5 : 12.5}" font-weight="800" font-family="${FD}" fill="${ink}">${esc(name)}</text>`;
  } else {
    const body = kind === "i" ? `<g transform="scale(1.5)" fill="currentColor">${ICONS[name] ?? ""}</g>` : GLYPHS[name] ?? "";
    glyph = `<g transform="translate(${cx - GS / 2} ${cy - GS / 2}) scale(${GS / 24})" color="${ink}">${body}</g>`;
  }
  const spark = (x, y, sz, delay) =>
    `<path d="M${x} ${r3(y - sz)}L${r3(x + sz * 0.28)} ${r3(y - sz * 0.28)}L${r3(x + sz)} ${y}L${r3(x + sz * 0.28)} ${r3(y + sz * 0.28)}L${x} ${r3(y + sz)}L${r3(x - sz * 0.28)} ${r3(y + sz * 0.28)}L${r3(x - sz)} ${y}L${r3(x - sz * 0.28)} ${r3(y - sz * 0.28)}Z" fill="${mix(tone, "#ffffff", 0.7)}"${A.loop({ "0%,100%": "opacity:0;transform:scale(.3)", "50%": "opacity:1;transform:scale(1)" }, { dur: 2.6, delay: 1.6 + delay + (i % 5) * 0.2, origin: [x, y], still: ' opacity="0.85"' })}/>`;
  const body = [
    `<title>${esc(`${tr.label}: ${sec.hint ?? "secret"}`)}</title>`,
    `<ellipse cx="${cx}" cy="${cy + 4}" rx="30" ry="26" fill="${tone}" opacity="0.1"/>`,
    sec.special ? `<polygon points="${[0, 1, 2, 3, 4, 5].map((k) => vertex(k, R + 5).join(",")).join(" ")}" fill="none" stroke="${tone}" stroke-width="1.4" stroke-linejoin="round" opacity="0.6"${A.loop({ "0%,100%": "opacity:.2", "50%": "opacity:.9" }, { dur: 2.2, delay: 1.6 })}/>` : "",
    facets,
    ring,
    `<circle cx="${cx}" cy="${cy}" r="16.500" fill="${mix(tone, "#000000", 0.7)}" stroke="${mix(tone, "#ffffff", 0.35)}" stroke-width="1"/>`,
    `<circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="${tone}" stroke-width="0.6" stroke-dasharray="1.2 2.2" opacity="0.8"/>`,
    glyph,
    spark(24, 33, 4.5, 0),
    spark(87, 66, 3.6, 1.1),
    spark(84, 27, 2.6, 0.6),
    has("title") ? `<text x="55" y="14.500" text-anchor="middle" font-size="${textWidth(tr.label, 12) > 102 ? 10.5 : 12}" font-weight="700" font-family="${FD}" fill="${c.text}">${esc(fit(tr.label, textWidth(tr.label, 12) > 102 ? 10.5 : 12, 104))}</text>` : "",
    has("label") ? `<text x="55" y="${sec.value ? 85 : 91}" text-anchor="middle" font-size="8.500" font-weight="700" letter-spacing="2" font-family="${FD}" fill="${mix(tone, c.text, 0.25)}">${esc(sec.special ?? "SECRET")}</text>` : "",
    has("score") && sec.value ? `<text x="55" y="97" text-anchor="middle" font-size="9.500" font-weight="700" font-family="${FD}" fill="${c.muted}">${esc(fit(String(sec.value), 9.5, 96))}</text>` : "",
    has("bar") ? `<rect x="15" y="101" rx="1" width="80" height="3.2" opacity="0.3" fill="${tone}"/>` : "",
  ].join("\n      ");
  return { defs: "", body, bar: has("bar") ? { x: 15, y: 101, w: 80, h: 3.2, color: tone } : null };
}

/** One 110 x 110 card. Returns the svg body, the gradient it needs and where the progress bar sits (the section animates the fill). */
function trophy(tr, X, o) {
  const { c, A } = X;
  const secret = tr.rank === "SECRET";
  const unknown = tr.rank === "?";
  const base = secret ? c.accent2 : unknown ? c.muted : levelColor(c, tr.rank);
  const light = mix(base, "#ffffff", 0.28);
  const dark = mix(base, "#000000", 0.4);
  const id = `tg-${secret ? "SECRET" : unknown ? "UNKNOWN" : tr.rank.replace("+", "P")}`;
  const has = (p) => o.parts.has(p);
  const letter = secret ? "S" : unknown ? "?" : tr.rank;
  const cup = (fill) =>
    `${CUP}<circle cx="8" cy="6" r="4" fill="#fff"/><text x="8" y="8.4" text-anchor="middle" font-family="Courier, monospace" font-size="${letter.length > 1 ? 5.4 : 7}" font-weight="700" fill="${mix(base, "#000000", 0.55)}">${esc(letter)}</text>`;
  // cups: the top 1% has three (a big one between two small ones), S two, the rest one
  const extra = secret || unknown ? 0 : { "S+": 2, S: 1 }[tr.rank] ?? 0;
  const small = (x) => `<svg x="${x}" y="35" width="65" height="65" viewBox="0 0 30 30" fill="${base}">${cup(base)}</svg>`;
  const laurel = !secret && !unknown && ["S+", "S", "A"].includes(tr.rank)
    ? `<svg width="120" height="120" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${LAUREL(c.base === "light" ? "#009366" : "#178600")}</svg>`
    : "";
  const score = tr.title === "Experience" ? `${tr.score} yrs` : secret ? "SECRET" : abridge(tr.score);
  const parts = [
    laurel,
    extra === 2 ? small(7) : "",
    extra >= 1 ? small(68) : "",
    `<svg x="28" y="20" width="100" height="100" viewBox="0 0 30 30" fill="url(#${id})">${cup(null)}</svg>`,
    has("title") ? `<text x="55" y="18" text-anchor="middle" font-size="13" font-weight="700" font-family="${FD}" fill="${c.text}">${esc(fit(tr.title, 13, 100))}</text>` : "",
    has("label") ? `<text x="55" y="85" text-anchor="middle" font-size="10.5" font-weight="700" font-family="${FD}" fill="${c.muted}">${esc(fit(tr.label, 10.5, 100))}</text>` : "",
    has("score") ? `<text x="55" y="97" text-anchor="middle" font-size="10" font-weight="700" font-family="${FD}" fill="${c.muted}">${score}</text>` : "",
    has("bar") ? `<rect x="15" y="101" rx="1" width="80" height="3.2" opacity="0.3" fill="${base}"/>` : "",
  ].join("\n      ");

  // the top 1%: the card border pulses and a light sweeps across it now and then
  const topfx = tr.rank === "S+"
    ? `<rect x="0.5" y="0.5" width="109" height="109" rx="4.5" fill="none" stroke="${base}" stroke-width="1.6" opacity="0.6"${A.loop({ "0%,100%": "opacity:.25", "50%": "opacity:1" }, { dur: 2.4, delay: 1.8 })}/>
      <g opacity="0.5"${A.loop({ "0%": "transform:translateX(-40px)", "55%,100%": "transform:translateX(150px)" }, { dur: 3.6, delay: 2, still: ' transform="translate(30 0)"' })}><rect x="0" y="-10" width="22" height="140" fill="url(#${id}-shine)" transform="rotate(18 11 55)"/></g>`
    : "";
  return {
    defs: `<linearGradient id="${id}" gradientTransform="rotate(45)"><stop offset="0%" stop-color="${light}"/><stop offset="70%" stop-color="${base}"/><stop offset="100%" stop-color="${dark}"/></linearGradient>${tr.rank === "S+" ? `<linearGradient id="${id}-shine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` : ""}`,
    body: parts + topfx,
    bar: has("bar") ? { x: 15, y: 101, w: 80, h: 3.2, color: base } : null,
  };
}

function trophiesSection(d, X, W = 940) {
  const { c, A, k, tr } = X;
  const o = k.trophies;
  let list = d.trophies.filter(
    (t) =>
      (!o.titles.size || trophyMatches(t.title, o.titles)) &&
      !trophyMatches(t.title, o.hideTitles) &&
      (!o.ranks.size || o.ranks.has(t.rank)) &&
      !o.hideRanks.has(t.rank),
  );
  if (!list.length) return null;
  // `titles` is also the order: the trophies appear in the order they are listed there
  if (o.titles.size) {
    const at = (t) => [...o.titles].findIndex((x) => trophyMatches(t.title, new Set([x])));
    list = list.map((t) => [at(t), t]).sort((a, b) => a[0] - b[0]).map(([, t]) => t);
  }
  // `sort` wins over the order of `titles`: rank = highest level first (secret ones after), name = A-Z
  const lvl = (t) => (t.rank === "SECRET" ? -1 : ALL_LEVELS.indexOf(t.rank));
  if (o.sort === "rank") list = [...list].sort((a, b) => lvl(b) - lvl(a));
  if (o.sort === "name") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
  const gx = o.marginW;
  const gy = o.marginH;
  const pad = o.padding;
  const inner = W - 2 * pad;
  // by default as many per row as fit (all of them in one row on a full-width card)
  const fit = Math.max(1, Math.floor((inner + gx) / (70 + gx)));
  const cols = o.columns > 0 ? Math.min(list.length, o.columns) : Math.min(list.length, fit);
  if (o.rows) list = list.slice(0, cols * o.rows);
  const rows = Math.ceil(list.length / cols);
  const s = Math.min(110, (inner - gx * (cols - 1)) / cols);
  return {
    w: W, top: 504, nx: 30, h: Math.round(42 + rows * s + (rows - 1) * gy + 18),
    draw: (H) => {
      const defs = [];
      const cards = list
        .map((tr_, i) => {
          const row = Math.floor(i / cols);
          const inRow = Math.min(cols, list.length - row * cols);
          const rowW = inRow * s + gx * (inRow - 1);
          const x = 30 + (o.align === "left" ? pad : (W - rowW) / 2) + (i % cols) * (s + gx);
          const y = 546 + row * (s + gy);
          const { defs: g, body, bar } = tr_.rank === "SECRET" ? secretTrophy(tr_, X, o, i) : trophy(tr_, X, o);
          defs.push(g);
          return `<g${A.a(1.45 + i * 0.08, 0.5, { o: 0, s: 0.6 }, {}, [r3(x + s / 2), r3(y + s / 2)])}>
    <svg x="${r3(x)}" y="${r3(y)}" width="${r3(s)}" height="${r3(s)}" viewBox="0 0 110 110">
      <rect x="0.5" y="0.5" rx="4.5" width="109" height="109" fill="${o.noBg ? "none" : c.bg1}" stroke="${o.noFrame ? "none" : c.border}"/>
      ${body}
      ${trophyMatches(tr_.title, o.highlight) ? `<rect x="1.5" y="1.5" rx="4" width="107" height="107" fill="none" stroke="${c.accent}" stroke-width="2.5"${A.loop({ "0%,100%": "opacity:.3", "50%": "opacity:1" }, { dur: 2, delay: 1.6, still: ' opacity="0.85"' })}/>` : ""}
      ${bar ? `<g${A.a(1.8 + i * 0.08, 0.9, { sx: 0 }, {}, [bar.x, r3(bar.y + 2)])}><rect x="${bar.x}" y="${bar.y}" rx="1.5" width="${r3(bar.w * tr_.progress)}" height="${bar.h}" fill="${bar.color}"/></g>` : ""}
    </svg>
  </g>`;
        })
        .join("");
      return `<defs>${defs.join("")}</defs>
  <g${A.a(1.3, 0.5, { o: 0 })}>${panel(30, 504, W, H, c)}${heading(30 + pad, 530, o.title ?? tr("trophies"), c)}</g>
  ${cards}`;
    },
  };
}

// Heatmap cells: every shape fits the same 13.5px box. `fill` is the colour of the day's level; `dim` the colour of an empty
// day (moons are drawn as an empty disc with the lit part on top). `grow` makes the shape a little larger, used to hide
// what lies underneath. `inner` is a <title> for tooltips.
const CELL = 13.5;
const RAINBOW = ["#ff5f6d", "#ff9f43", "#ffd93d", "#6bdb7a", "#4fd1ff", "#7c8cff", "#c77dff", "#ff6fd8"];
export const CELL_SHAPES = ["square", "round", "triangle", "snowflake", "moon", "hexagon", "mixed"];
const MIXED = ["square", "round", "triangle"];
/** The shape of cell (w, i): fixed for a given grid, random among the geometric ones for "mixed". */
export const shapeAt = (kind, w, i) => (kind === "mixed" ? MIXED[(((w * 73856093) ^ (i * 19349663)) >>> 0) % MIXED.length] : kind);
const MOON_LIT = [0, 0.18, 0.45, 0.75, 1];
function cellShape(kind, x, y, fill, { lvl = 0, up = true, grow = 0, inner = "", dim = fill, rx = 3 } = {}) {
  const h = CELL / 2;
  const cx = x + h;
  const cy = y + h;
  const g = grow;
  switch (kind) {
    case "round":
      return `<rect x="${r3(x - g)}" y="${r3(y - g)}" width="${r3(CELL + 2 * g)}" height="${r3(CELL + 2 * g)}" rx="${r3(h + g)}" fill="${fill}">${inner}</rect>`;
    case "hexagon": {
      // flat-top hexagon; the heatmap shifts every other week down half a step, so they nest like a honeycomb
      const R = h + 1 + g;
      const pts = [0, 1, 2, 3, 4, 5].map((k) => `${r3(cx + R * Math.cos((k * Math.PI) / 3))},${r3(cy + R * Math.sin((k * Math.PI) / 3))}`);
      return `<polygon class="hex" points="${pts.join(" ")}" fill="${fill}">${inner}</polygon>`;
    }
    case "triangle": {
      const r = h + g + 0.4;
      const t = up ? [[cx, cy - r * 0.92], [cx + r, cy + r * 0.78], [cx - r, cy + r * 0.78]] : [[cx - r, cy - r * 0.78], [cx + r, cy - r * 0.78], [cx, cy + r * 0.92]];
      return `<polygon points="${t.map(([a, b]) => `${r3(a)},${r3(b)}`).join(" ")}" fill="${fill}" stroke="${fill}" stroke-width="${r3(1 + g)}" stroke-linejoin="round">${inner}</polygon>`;
    }
    case "snowflake": {
      const R = h - 0.4 + g;
      let d = "";
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 2;
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        d += `M${r3(cx)} ${r3(cy)}L${r3(cx + ux * R)} ${r3(cy + uy * R)}`;
        // a small branch on each arm
        const bx = cx + ux * R * 0.62;
        const by = cy + uy * R * 0.62;
        for (const da of [0.9, -0.9]) d += `M${r3(bx)} ${r3(by)}l${r3(Math.cos(a + da) * R * 0.34)} ${r3(Math.sin(a + da) * R * 0.34)}`;
      }
      return `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${r3(1.3 + 2 * g)}" stroke-linecap="round">${inner}</path>`;
    }
    case "moon": {
      const R = h + g;
      const base = `<circle cx="${r3(cx)}" cy="${r3(cy)}" r="${r3(R)}" fill="${dim}"/>`;
      const f = MOON_LIT[lvl] ?? 0;
      if (f <= 0) return `<g>${inner}${base}</g>`;
      // lit side on the right: a half circle plus the terminator, an ellipse arc that bows right for a crescent, left when gibbous
      const lit = f >= 1
        ? `<circle cx="${r3(cx)}" cy="${r3(cy)}" r="${r3(R)}" fill="${fill}"/>`
        : `<path d="M${r3(cx)} ${r3(cy - R)}A${r3(R)} ${r3(R)} 0 0 1 ${r3(cx)} ${r3(cy + R)}A${r3(Math.max(0.01, R * Math.abs(1 - 2 * f)))} ${r3(R)} 0 0 ${f < 0.5 ? 0 : 1} ${r3(cx)} ${r3(cy - R)}Z" fill="${fill}"/>`;
      return `<g>${inner}${base}${lit}</g>`;
    }
    default:
      return `<rect x="${r3(x - g)}" y="${r3(y - g)}" width="${r3(CELL + 2 * g)}" height="${r3(CELL + 2 * g)}" rx="${r3(rx + g)}" fill="${fill}">${inner}</rect>`;
  }
}

function heatmapSection(d, X, W = 940) {
  const { c, A, k, tr, tag, num } = X;
  const o0 = k.heatmap;
  // narrower cards show only the most recent weeks that fit (and drop the subtitle)
  const fitWeeks = Math.floor((30 + W - 2 - 13.5 - 78) / 16.8) + 1;
  const narrow = fitWeeks < o0.weeks;
  const o = narrow ? { ...o0, weeks: fitWeeks } : o0;
  const counts = new Map(d.days);
  const today = new Date(d.days.at(-1)[0] + "T00:00:00Z");
  const startDow = o.weekStart === "mon" ? 1 : 0;
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - ((today.getUTCDay() - startDow + 7) % 7) - (o.weeks - 1) * 7);
  const weeks = [];
  let lastYear = 0;
  for (let w = 0; w < o.weeks; w++) {
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
  const rx = 3;
  const yOf = (w, i) => y0 + i * step + (o.cell === "hexagon" && w % 2 ? step / 2 : 0); // honeycomb: odd weeks half a step lower
  // one cell of the grid; `grow` / `lvl` let the snake cover it with the empty-day look
  const cell = (w, i, lvl, inner = "", grow = 0) => {
    const kind = shapeAt(o.cell, w, i);
    return cellShape(kind, r3(x0 + w * step), r3(yOf(w, i)), c.heat[lvl], { lvl, up: (w + i) % 2 === 0, grow, inner, dim: c.heat[0], rx });
  };
  let month = "";
  const months = o.monthLabels
    ? weeks
        .map((wk, w) => {
          const m = wk[0] && new Date(wk[0][0] + "T00:00:00Z").toLocaleDateString(tag, { month: "short", timeZone: "UTC" });
          if (!m || m === month) return "";
          month = m;
          return w > o.weeks - 3 ? "" : `<text x="${r3(x0 + w * step)}" y="${y0 - 8}" font-size="10" fill="${c.muted}">${esc(m)}</text>`;
        })
        .join("")
    : "";
  // Snake mode: a snake crawls through the grid column by column and eats the contributions, then the cycle restarts.
  // Every moving part is plain CSS (opacity / transform keyframes), so it also runs inside a README <img>.
  const SNAKE_LEN = o.snakeLength;
  const SNAKE_PAUSE = 1.5;
  let plan = null; // the route and its timing, computed once per card (inside draw, when the section delay is known)
  const snakePlan = () => {
    if (plan) return plan;
    const { pts: cells, eaten } = snakeRoute(o.snakePath, weeks, level, SNAKE_LEN);
    const end = cells.length - 1; // the last cell it eats
    // then it keeps going in the same direction until it has left the grid completely, tail included (the clip hides it)
    const a = cells[Math.max(0, end - 1)], b = cells[end];
    const [dw, di] = end > 0 && b.w !== a.w ? [Math.sign(b.w - a.w), 0] : [0, Math.sign(b.i - a.i) || 1];
    const route = [...cells];
    let out = 0;
    for (let n = 1; out < SNAKE_LEN + 1; n++) {
      const w = b.w + dw * n, i = b.i + di * n;
      route.push({ w, i });
      if (w < 0 || w >= weeks.length || i < 0 || i >= 7) out++;
    }
    const pts = route.map(({ w, i }) => ({ x: x0 + w * step, y: yOf(w, i) }));
    const last = pts.length - 1;
    // a long route is played faster so one loop never takes much longer than half a minute
    const DT = Math.min(0.06, Math.max(0.02, 30 / (last + SNAKE_LEN)));
    const T = r3((last + SNAKE_LEN) * DT + SNAKE_PAUSE);
    plan = { route, eaten, pts, end, last, DT, T, pct: (t) => r3((t / T) * 100), delay: r3(A.dt + 1.8 + weeks.length * 0.025 + 0.5) }; // after the grid has faded in
    return plan;
  };
  // a day with contributions, drawn on top of its empty-day look and faded out when the snake gets there
  const snakeDay = (w, i, lvl, title) => {
    const { eaten, end, DT, T, pct, delay } = snakePlan();
    const j = eaten.get(`${w},${i}`) ?? end;
    A.css.push(`@keyframes ce${w}_${i}{0%,${pct(j * DT)}%{opacity:1}${pct(j * DT + 0.1)}%,99.5%{opacity:0}100%{opacity:1}}`);
    return cell(w, i, 0) + cell(w, i, lvl, title).replace(/^<(\w+)/, `<$1 style="animation:ce${w}_${i} ${T}s linear ${delay}s infinite"`);
  };
  const snakeSvg = () => {
    const { route, pts, last, DT, T, pct, delay } = snakePlan();
    // the snake is made of the same shape as the days (a full moon for moons; round for the random mix)
    const kind = o.cell === "mixed" ? "round" : o.cell;
    // triangles alternate up / down from cell to cell like the grid
    const tri = kind === "triangle";
    const upAt = (j) => (Math.abs(route[j].w + route[j].i) % 2) === 0;
    // rainbow: every segment its own colour; the tail fades out whatever the length
    const fill = (k) => (o.snakeStyle === "rainbow" ? RAINBOW[k % RAINBOW.length] : c.snake);
    const fade = Math.min(0.1, 0.6 / SNAKE_LEN);
    const seg = (k, attrs, up = true) => cellShape(kind, 0, 0, fill(k), { lvl: 4, up, dim: fill(k), rx }).replace(/^<(\w+)/, `<$1 opacity="${r3(1 - k * fade)}" ${attrs}`);
    // glow: a soft halo around the body (an SVG blur, so it also shows in PNG / GIF)
    const glowDef = o.snakeStyle === "glow" ? `<filter id="snkglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : "";
    const wrapBody = (s) => (glowDef ? `${glowDef}<g filter="url(#snkglow)">${s}</g>` : s);
    if (A.t !== undefined) {
      // static frame (PNG / GIF / animations off): the snake waits at the start of the grid
      const at0 = (k) => Math.min(SNAKE_LEN - k, pts.length - 1);
      return wrapBody(Array.from({ length: SNAKE_LEN }, (_, k) => { const p = pts[at0(k)]; return seg(k, `transform="translate(${r3(p.x)} ${r3(p.y)})"`, upAt(at0(k))); }).join(""));
    }
    const corners = pts.map((_, j) => j).filter((j) => {
      if (tri) return true; // one keyframe per cell, to turn the triangle at each step
      if (j === 0 || j === last) return true;
      const d1 = [pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y].map(Math.round).join();
      const d2 = [pts[j + 1].x - pts[j].x, pts[j + 1].y - pts[j].y].map(Math.round).join();
      return d1 !== d2;
    });
    // triangles hop from cell to cell (no sliding or spinning in between) and sit exactly as the grid's triangle there
    const at = (j) => `transform:translate(${r3(pts[j].x)}px,${r3(pts[j].y)}px)${tri ? ` rotate(${upAt(j) ? 0 : 180}deg);animation-timing-function:step-end` : ""}`;
    // one route for the head; every body segment plays the same keyframes a little later (the same loop, shifted)
    A.css.push(`@keyframes sn{${corners.map((j) => `${pct(j * DT)}%{${at(j)}}`).join("")}${pct(last * DT)}%,100%{${at(last)}}}`);
    let body = "";
    for (let k = 0; k < SNAKE_LEN; k++) body += seg(k, `style="${tri ? "transform-origin:6.75px 6.75px;" : ""}animation:sn ${T}s linear ${r3(delay + k * DT)}s infinite"`);
    return `<clipPath id="snkclip"><rect x="${x0 - 2}" y="${y0 - 2}" width="${r3(weeks.length * step + 2)}" height="${r3(7 * step + 2)}"/></clipPath>
  <g clip-path="url(#snkclip)">${wrapBody(body)}</g>`;
  };
  return {
    w: W, top: 674, nx: 30, h: 180,
    draw: (H) => `
  <g${A.a(1.7, 0.5, { o: 0 })}>${panel(30, 674, W, H, c)}${heading(50, 698, tr("contributions"), c, narrow ? "" : sub(c, tr("lastYear", { n: num(lastYear) })))}
    ${months}
    ${[1, 3, 5].map((wd) => `<text x="50" y="${r3(y0 + ((wd - startDow + 7) % 7) * step + 10)}" font-size="10" fill="${c.muted}">${esc(weekday(tag, wd, "short"))}</text>`).join("")}
  </g>
  ${weeks
    .map(
      (wk, w) =>
        `<g${A.a(1.8 + w * 0.025, 0.35, { o: 0 })}>${wk
          .map(([key, n, i]) => (o.mode === "snake" && A.t === undefined && n ? snakeDay(w, i, level(n), `<title>${n} · ${key}</title>`) : cell(w, i, level(n), `<title>${n} · ${key}</title>`)))
          .join("")}</g>`,
    )
    .join("")}
  ${o.mode === "snake" ? snakeSvg() : ""}
  ${
    o.legend
      ? `<g${A.a(2.4, 0.5, { o: 0 })}>
    <text x="${840 + W - 940}" y="698" text-anchor="end" font-size="10" fill="${c.muted}">${esc(tr("less"))}</text>
    ${c.heat.map((h, i) => cellShape(o.cell === "mixed" ? "square" : o.cell, 846 + W - 940 + i * 16 - 0.75, 687.25, h, { lvl: i, dim: c.heat[0] })).join("")}
    <text x="${930 + W - 940}" y="698" font-size="10" fill="${c.muted}">${esc(tr("more"))}</text>
  </g>`
      : ""
  }`,
  };
}

// Text layout without font metrics: per-character width estimate (em units) for a Segoe-UI-like sans.
const charW = (ch) =>
  /[il.,;:!|'`’]/.test(ch) ? 0.27 : /[ftrjI()[\] ]/.test(ch) ? 0.34 : /[mwMW@]/.test(ch) ? 0.84 : /[A-Z0-9#&%]/.test(ch) ? 0.62 : 0.53;
// x1.07: Inter runs slightly wider than the Segoe UI metrics this table was tuned on.
export const textWidth = (s, size) => [...s].reduce((w, ch) => w + charW(ch), 0) * size * 1.07;
const fit = (s, size, maxW) => {
  while (s.length > 1 && textWidth(s, size) > maxW) s = s.slice(0, -2) + "…";
  return s;
};
function wrap(text, size, maxW) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size) > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
const plain = (s) => s.replace(/\*\*|__/g, "");

function aboutSection(d, X, W = 940) {
  const { c, A, k, tr } = X;
  const size = 14.5;
  const lh = 22;
  const gap = 10;
  let y = 66;
  const paras = k.about.map((p) => {
    const lines = wrap(plain(p), size, W - 40);
    const top = y;
    y += lines.length * lh + gap;
    return { lines, top };
  });
  const h = y - gap - lh + 26;
  return {
    w: W, top: 0, nx: 30, h,
    draw: (H) => `<g${A.a(0, 0.5, { o: 0 })}>${panel(30, 0, W, H, c)}${icon("person", 50, 18, 14, c.accent)}${heading(72, 30, tr("about"), c)}</g>${paras
      .map(
        ({ lines, top }, i) => `<g${A.a(0.1 + i * 0.12, 0.5, { o: 0, ty: 8 })}>${lines
          .map((l, n) => `<text x="50" y="${top + n * lh}" font-size="${size}" fill="${c.text}">${esc(l)}</text>`)
          .join("")}</g>`,
      )
      .join("")}`,
  };
}

function workingSection(d, X, W = 940) {
  const { c, A, k, tr } = X;
  const items = k.workingOn;
  const gap = 14;
  // narrow cards stack vertically instead of sitting side by side
  const stack = W < 620 && items.length > 1;
  const cw = stack ? W - 40 : (W - 40 - gap * (items.length - 1)) / items.length;
  const stepY = 96 + 12;
  const icons = ["rocket", "zap", "flame", "code"];
  return {
    w: W, top: 0, nx: 30, h: stack ? 46 + items.length * stepY - 12 + 18 : 160,
    draw: (H) => {
      const cards = items
        .map((it, i) => {
          const x = stack ? 50 : 50 + i * (cw + gap);
          const dy = stack ? i * stepY : 0;
          const desc = it.description ? wrap(plain(it.description), 12.5, cw - 62).slice(0, 2) : [];
          const url = it.url ? it.url.replace(/^https?:\/\/(www\.)?/, "") : "";
          return `<g${A.a(0.15 + i * 0.1, 0.5, { o: 0, ty: 10 })}><g transform="translate(0 ${dy})">
    <rect x="${r3(x)}" y="46" width="${r3(cw)}" height="96" rx="12" fill="${c.bg1}" stroke="${c.border}"/>
    <circle cx="${r3(x + 26)}" cy="72" r="15" fill="url(#grad)" opacity="0.2"/>
    ${icon(icons[i % icons.length], r3(x + 18), 64, 16, c.accent)}
    <text x="${r3(x + 50)}" y="77" font-size="15" font-weight="700" font-family="${FD}" fill="${c.text}">${esc(fit(plain(it.title), 15, cw - 62))}</text>
    ${desc.map((l, n) => `<text x="${r3(x + 50)}" y="${98 + n * 16}" font-size="12.5" fill="${c.muted}">${esc(l)}</text>`).join("")}
    ${url ? `<text x="${r3(x + 50)}" y="132" font-size="11" fill="${c.accent2}">${esc(fit(url, 11, cw - 62))}</text>` : ""}
  </g></g>`;
        })
        .join("");
      return `<g${A.a(0, 0.5, { o: 0 })}>${panel(30, 0, W, H, c)}${icon("rocket", 50, 18, 14, c.accent)}${heading(72, 30, tr("working"), c)}</g>${cards}`;
    },
  };
}

const FM = "'JetBrains Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace";

/**
 * A terminal window. Lines starting with "$ " are commands, typed one character at a time (a cover that slides off in
 * steps); the other lines are their output and appear right after. Static frames show everything at once.
 */
function terminalSection(d, X, W = 940) {
  const { c, A, k } = X;
  const o = k.terminal;
  const size = 13;
  const lh = 21;
  const cw = size * 0.6; // monospace advance
  const max = Math.max(8, Math.floor((W - 96) / cw));
  const rows = o.lines.map((l) => {
    const cmd = l.startsWith("$ ") || l === "$";
    const text = cmd ? l.slice(2) : l;
    return { cmd, text: text.length > max ? text.slice(0, max - 1) + "…" : text };
  });
  const top = 74;
  const h = top + rows.length * lh + 18;
  const scr = mix(c.panel, c.base === "light" ? "#ffffff" : "#000000", c.base === "light" ? 0.5 : 0.35);
  return {
    w: W, top: 0, nx: 30, h,
    draw: (H) => {
      const still = A.t !== undefined;
      let at = 0.45; // seconds after the panel appears
      const x0 = 52;
      const line = (r, n) => {
        const y = top + n * lh;
        const tx = r.cmd ? x0 + 2 * cw : x0;
        const prompt = r.cmd ? `<text x="${x0}" y="${y}" font-size="${size}" font-weight="700" font-family="${FM}" fill="${c.accent}">$</text>` : "";
        const text = `<text x="${r3(tx)}" y="${y}" font-size="${size}" font-family="${FM}" fill="${r.cmd ? c.text : c.muted}" xml:space="preserve">${esc(r.text)}</text>`;
        if (still) return prompt + text;
        const start = at;
        if (!r.cmd) {
          at += 0.12;
          return `<g${A.a(start, 0.2, { o: 0 })}>${text}</g>`;
        }
        const chars = Math.max(1, [...r.text].length);
        const dur = Math.min(2.2, chars * 0.045);
        at += dur + 0.3;
        const w = r3(chars * cw + 3);
        A.css.push(`@keyframes ty${n}{from{transform:translateX(0)}to{transform:translateX(${w}px)}}`);
        const cover = `<rect x="${r3(tx - 1)}" y="${y - size}" width="${w}" height="${lh}" fill="${scr}" style="animation:ty${n} ${r3(dur)}s steps(${chars}) ${r3(A.dt + start + 0.1)}s both"/>`;
        return `<g${A.a(start, 0.1, { o: 0 })}>${prompt}${text}${cover}</g>`;
      };
      const body = rows.map(line).join("");
      const yl = top + rows.length * lh;
      const cursor = `<g${still ? "" : A.a(at, 0.1, { o: 0 })}><text x="${x0}" y="${yl}" font-size="${size}" font-weight="700" font-family="${FM}" fill="${c.accent}">$</text><rect x="${r3(x0 + 2 * cw)}" y="${yl - size + 2}" width="${r3(cw)}" height="${size}" fill="${c.accent}"${A.loop({ "0%,49%": "opacity:1", "50%,100%": "opacity:0" }, { dur: 1, ease: "steps(1)", delay: at })}/></g>`;
      const title = o.title ?? `${d.login}@github: ~`;
      return `<g${A.a(0, 0.5, { o: 0 })}>${panel(30, 0, W, H, c)}
    <circle cx="52" cy="24" r="5.5" fill="#ff5f57"/><circle cx="70" cy="24" r="5.5" fill="#febc2e"/><circle cx="88" cy="24" r="5.5" fill="#28c840"/>
    <text x="${30 + W / 2}" y="28" text-anchor="middle" font-size="11.5" font-family="${FM}" fill="${c.muted}">${esc(fit(title, 11.5, W - 160))}</text>
    <rect x="42" y="44" width="${W - 24}" height="${r3(H - 56)}" rx="9" fill="${scr}" stroke="${c.border}" stroke-opacity="0.6"/></g>
  <clipPath id="termclip"><rect x="42" y="44" width="${W - 24}" height="${r3(H - 56)}" rx="9"/></clipPath>
  <g clip-path="url(#termclip)">${body}${cursor}</g>`;
    },
  };
}

/** When you code: average contributions per weekday and total per month over the last 12 months, as growing bars. */
function rhythmSection(d, X, W = 940) {
  const { c, A, k, tr, tag, num } = X;
  const o = k.rhythm;
  if (!o.show.size || !d.days.length) return null;
  const days = d.days.slice(-365);
  const wdSum = Array(7).fill(0);
  const wdCnt = Array(7).fill(0);
  const months = new Map();
  for (const [key, n] of days) {
    const wd = new Date(key + "T00:00:00Z").getUTCDay();
    wdSum[wd] += n;
    wdCnt[wd]++;
    months.set(key.slice(0, 7), (months.get(key.slice(0, 7)) ?? 0) + n);
  }
  const blocks = [];
  if (o.show.has("weekdays"))
    blocks.push({
      name: tr("byWeekday"),
      vals: wdSum.map((s, i) => (wdCnt[i] ? s / wdCnt[i] : 0)),
      labels: [0, 1, 2, 3, 4, 5, 6].map((i) => weekday(tag, i, "short")),
      fmt: (v) => (v >= 10 ? num(Math.round(v)) : v.toFixed(1)),
    });
  if (o.show.has("months")) {
    const keys = [...months.keys()].slice(-12);
    blocks.push({
      name: tr("byMonth"),
      vals: keys.map((m) => months.get(m)),
      labels: keys.map((m) => new Date(m + "-01T00:00:00Z").toLocaleDateString(tag, { month: "short", timeZone: "UTC" })),
      fmt: (v) => num(v),
    });
  }
  const side = blocks.length === 2 && W >= 620;
  const bh = 74; // tallest bar
  const blockH = 30 + bh + 22;
  const h = 50 + (side ? blockH : blocks.length * blockH) + 10;
  return {
    w: W, top: 0, nx: 30, h,
    draw: (H) => {
      let n = 0;
      const drawn = blocks
        .map((b, bi) => {
          const bw = side ? (W - 60) / 2 : W - 40;
          const bx = 50 + (side ? bi * (bw + 20) : 0);
          const by = 50 + (side ? 0 : bi * blockH);
          const max = Math.max(...b.vals, 0.0001);
          const best = b.vals.indexOf(Math.max(...b.vals));
          const slot = bw / b.vals.length;
          const barW = Math.min(30, slot * 0.62);
          const base = by + 26 + bh;
          const bars = b.vals
            .map((v, i) => {
              const hgt = Math.max(2, (v / max) * bh);
              const x = bx + i * slot + (slot - barW) / 2;
              const isBest = i === best && v > 0;
              const col = isBest ? c.accent : mix(c.track, c.accent2, 0.55);
              const label = `<text x="${r3(x + barW / 2)}" y="${base + 15}" text-anchor="middle" font-size="10" fill="${isBest ? c.text : c.muted}">${esc(b.labels[i])}</text>`;
              const val = isBest ? `<text x="${r3(x + barW / 2)}" y="${r3(base - hgt - 6)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${c.accent}">${esc(b.fmt(v))}</text>` : "";
              return `<g${A.a(0.15 + n++ * 0.035, 0.6, { sx: 1, s: 0 }, {}, [r3(x + barW / 2), base])}><rect class="rbar" x="${r3(x)}" y="${r3(base - hgt)}" width="${r3(barW)}" height="${r3(hgt)}" rx="${r3(Math.min(5, barW / 3))}" fill="${col}"><title>${esc(b.labels[i])}: ${esc(b.fmt(v))}</title></rect></g>${label}${val}`;
            })
            .join("");
          // labels, axis and bars fade in with the panel, not before it
          return `<g${A.a(0.1, 0.5, { o: 0 })}><text x="${bx}" y="${by + 6}" font-size="11" font-weight="600" fill="${c.muted}">${esc(b.name)}</text><line x1="${bx}" y1="${base + 0.5}" x2="${r3(bx + bw)}" y2="${base + 0.5}" stroke="${c.border}"/>${bars}</g>`;
        })
        .join("");
      return `<g${A.a(0, 0.5, { o: 0 })}>${panel(30, 0, W, H, c)}${icon("calendar", 50, 18, 14, c.accent)}${heading(72, 30, o.title ?? tr("rhythm"), c, sub(c, tr("rhythmSub")))}</g>${drawn}`;
    },
  };
}

/** Endless marquee rows of tech logos (`marquee`: rows, speed, order), moving in alternating directions. */
function stackSection(d, X, W = 940) {
  const { c, A, k, tr, defs } = X;
  const items = k.stack ?? [];
  if (!items.length) return null;
  const per = Math.ceil(items.length / Math.min(k.marquee.rows, items.length));
  const rows = Array.from({ length: Math.ceil(items.length / per) }, (_, i) => items.slice(i * per, (i + 1) * per));
  const step = 84;
  const speed = k.marquee.speed; // px per second
  const h = 54 + rows.length * 84 + 6;
  return {
    w: W, top: 0, nx: 30, h,
    draw: (H) => {
      for (const it of items) defs.push(`<image id="${it.id}" href="${it.data}" width="40" height="40"/>`);
      const body = rows
        .map((row, r) => {
          let list = row;
          while (list.length * step < W + 20) list = list.concat(row);
          const w = list.length * step;
          const tile = (it, x) =>
            `<g transform="translate(${r3(x)} 0)"><rect width="72" height="72" rx="14" fill="${c.bg1}" stroke="${c.border}"/><use href="#${it.id}" x="16" y="7"/><text x="36" y="63" text-anchor="middle" font-size="9.5" fill="${c.muted}">${esc(fit(it.name, 9.5, 66))}</text></g>`;
          const y = 54 + r * 84;
          if (A.t !== undefined) {
            // Static frame: only tiles inside the panel (resvg also crashes on fully off-canvas <use> copies).
            const off = (A.t * DURATION * speed) % w;
            const tx = r % 2 ? off - w : -off;
            const tiles = [...list, ...list].map((it, n) => [it, tx + n * step]).filter(([, x]) => x > -step && x < W - 20);
            return `<g transform="translate(50 ${y})">${tiles.map(([it, x]) => tile(it, x)).join("")}</g>`;
          }
          defs.push(`<g id="row${r}">${list.map((it, n) => tile(it, n * step)).join("")}</g>`);
          const [from, to] = r % 2 ? [-w, 0] : [0, -w];
          A.css.push(`@keyframes m${r}{from{transform:translateX(${from}px)}to{transform:translateX(${to}px)}}.m${r}{animation:m${r} ${r3(w / speed)}s linear infinite}`);
          return `<g transform="translate(50 ${y})"><g class="m${r}"><use href="#row${r}"/><use href="#row${r}" x="${w}"/></g></g>`;
        })
        .join("");
      defs.push(
        `<linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".06" stop-color="#fff"/><stop offset=".94" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
        `<mask id="fm" maskUnits="userSpaceOnUse" x="30" y="0" width="${W}" height="${h}"><rect x="31" y="40" width="${W - 2}" height="${h - 44}" fill="url(#fade)"/></mask>`,
      );
      return `<g${A.a(0, 0.6, { o: 0 })}>${panel(30, 0, W, H, c)}${icon("tools", 50, 18, 14, c.accent)}${heading(72, 30, tr("stack"), c, sub(c, tr("tools", { n: items.length })))}
    <g mask="url(#fm)">${body}</g></g>`;
    },
  };
}

/**
 * Render the full card. d: summarize() output; k: normalized config (src/config.js).
 * opts.t undefined = animated SVG, number = static frame at that progress.
 */
export function render(d, { theme = "dark", t, fontCss = "", k = normalize(), colors, boxesOnly = false } = {}) {
  const c = resolveTheme(theme, colors ?? k.colors);
  if (t === undefined && !k.card.animations) t = 1;
  const A = animator(t);
  const tag = intlTag(k.locale);
  const defs = [];
  const X = {
    c, A, k, theme, defs, tag, tr: translator(k.locale), showRank: !k.hideSections.has("rank"),
    num: (n) => n.toLocaleString(tag),
    fmtDate: (iso, year = true) =>
      iso ? new Date(iso + "T00:00:00Z").toLocaleDateString(tag, { month: "short", day: "numeric", ...(year && { year: "numeric" }), timeZone: "UTC" }) : "",
  };
  // Rows appear one after the other, top to bottom. BASE is the delay each section's own panel already has inside its
  // draw(); the row offset replaces it. The step shrinks with many rows so the last section still ends before DURATION.
  const BASE = { header: 0, about: 0, workingOn: 0, stats: 0.4, streak: 0.6, languages: 1.0, trophies: 1.3, heatmap: 1.7, techStack: 0, terminal: 0, rhythm: 0 };
  const BUILD = {
    header: headerSection,
    about: (...a) => k.about.length && aboutSection(...a),
    workingOn: (...a) => k.workingOn.length && workingSection(...a),
    stats: statsSection,
    streak: streakSection,
    languages: languagesSection,
    trophies: trophiesSection,
    heatmap: heatmapSection,
    techStack: stackSection,
    terminal: (...a) => k.terminal.lines.length && terminalSection(...a),
    rhythm: rhythmSection,
  };
  // Both layout engines produce the same thing: where every section goes (x, y, w, h) and when it appears.
  const items = [];
  let y = 0;
  if (k.grid) {
    // Free grid: 6 columns, each section has a width in columns and falls to the lowest free spot (skyline packing,
    // like widgets on a home screen). The height follows the content.
    const heights = Array(COLS).fill(0);
    const placed = [];
    for (const { id, span, height } of k.grid) {
      const s = BUILD[id](d, X, spanWidth(span));
      if (!s) continue;
      const h = Math.max(s.h, height ?? 0); // a taller card than its content needs (never shorter: nothing is cut)
      let best = 0;
      let bestY = Infinity;
      for (let c0 = 0; c0 + span <= COLS; c0++) {
        const top = Math.max(...heights.slice(c0, c0 + span));
        if (top < bestY) (bestY = top, best = c0);
      }
      for (let i = best; i < best + span; i++) heights[i] = bestY + h + GUTTER;
      placed.push({ id, s, x: 30 + best * (COL_W + GUTTER), y: bestY, h });
    }
    // sections that start at the same height appear together, then the next band
    const ys = [...new Set(placed.map((it) => it.y))].sort((p, q) => p - q);
    const step = ys.length > 1 ? Math.min(0.4, 2.2 / (ys.length - 1)) : 0;
    for (const it of placed) items.push({ ...it, delay: ys.indexOf(it.y) * step });
    y = Math.max(0, ...heights);
  } else {
    // A row of two is built at half width; if one of them turns out empty, the other is rebuilt at full width.
    const built = k.layout
      .map((row) => {
        const secs = row.map((id) => ({ id, s: BUILD[id](d, X, row.length === 2 ? 460 : undefined) })).filter((x) => x.s);
        return secs.length === 1 && row.length === 2 ? [{ id: secs[0].id, s: BUILD[secs[0].id](d, X) }] : secs;
      })
      .filter((r) => r.length);
    const step = built.length > 1 ? Math.min(0.4, 2.2 / (built.length - 1)) : 0;
    for (const [ri, secs] of built.entries()) {
      // Two half-width sections share a row; anything else stacks.
      const groups = secs.length === 2 && secs.every((x) => x.s.w === 460) ? [secs] : secs.map((x) => [x]);
      for (const g of groups) {
        const H = Math.max(...g.map((x) => x.s.h));
        g.forEach(({ id, s }, i) => {
          const slot = g.length === 2 ? (i ? 510 : 30) : s.w === 460 ? 270 : 30;
          items.push({ id, s, x: slot, y, h: H, delay: ri * step });
        });
        y += H + 20;
      }
    }
  }
  // the header has its own padding; any other first card would sit on the border, so everything moves down a little
  const lift = items.length && !items.some((it) => it.id === "header" && it.y === 0) ? TOP_PAD : 0;
  for (const it of items) it.y += lift;
  y += lift;
  const SH = y + BOTTOM_PAD; // room for the "generated by" line under the last card
  // Editors ask where things landed (to draw handles over the card) instead of the svg.
  if (boxesOnly) return { height: SH, boxes: items.map(({ id, s, x, y, h }) => ({ id, x, y, w: s.w, h, minH: s.h })) };
  const parts = items.map(({ id, s, x, y, h, delay }) => {
    A.dt = delay - BASE[id];
    return `<g transform="translate(${r3(x - s.nx)} ${r3(y - s.top)})">${s.draw(h)}</g>`;
  });
  const bg = k.card.background;
  const grad = (bg.gradient ? parseColors({ bg_gradient: bg.gradient }).bg_gradient : c.bgGradient)?.split(",");
  const bgFill = grad
    ? `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(${Number(grad[0]) - 90} .5 .5)">${grad
        .slice(1)
        .map((col, i, a) => `<stop offset="${r3(i / (a.length - 1))}" stop-color="${col}"/>`)
        .join("")}</linearGradient>`
    : `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.bg1}"/><stop offset="1" stop-color="${c.bg2}"/></linearGradient>`;
  const PATTERNS = {
    dots: `<pattern id="pat" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${c.muted}" opacity="0.3"/></pattern>`,
    grid: `<pattern id="pat" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="${c.muted}" stroke-opacity="0.15"/></pattern>`,
    diagonal: `<pattern id="pat" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 12L12 0" stroke="${c.muted}" stroke-opacity="0.15"/></pattern>`,
  };
  const card = (fill, stroke = "none") => `<rect x="0.5" y="0.5" width="${W - 1}" height="${SH - 1}" rx="${k.card.radius}" fill="${fill}" stroke="${stroke}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${SH}" viewBox="0 0 ${W} ${SH}" font-family="${FB}" role="img" aria-label="GitHub profile card for ${esc(d.login)}">
  <title>${esc(d.name)} (@${esc(d.login)}) — GitHub profile</title>
  <defs>
    ${bgFill}
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.accent}"/><stop offset="1" stop-color="${c.accent2}"/></linearGradient>
    <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b9a"/><stop offset=".5" stop-color="#b48cff"/><stop offset="1" stop-color="#4fd1ff"/></linearGradient>
    <radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="850" cy="0" r="650"><stop offset="0" stop-color="${c.accent2}" stop-opacity="0.18"/><stop offset="1" stop-color="${c.accent2}" stop-opacity="0"/></radialGradient>
    ${PATTERNS[bg.pattern] ?? ""}
    ${defs.join("\n    ")}
  </defs>${fontCss || A.css.length ? `\n  <style>${fontCss}${A.css.join("")}</style>` : ""}
  ${card("url(#bg)", k.card.hideBorder ? "none" : c.border)}
  ${bg.glow ? card("url(#glow)") : ""}
  ${PATTERNS[bg.pattern] ? card("url(#pat)") : ""}
  ${parts.join("\n  ")}
  <text x="${W - 30}" y="${SH - 16}" text-anchor="end" font-size="10" fill="${c.muted}">${esc(X.tr("generated"))} · ${d.days.at(-1)[0]}</text>
</svg>`;
}

/**
 * A standalone link button. SVGs inside <img> are never clickable on GitHub,
 * so each link is its own small image wrapped in <a> in the README.
 */
export function renderButton(link, { theme = "dark", fontCss = "", colors } = {}) {
  const c = resolveTheme(theme, colors);
  const color = link.color ?? c.accent;
  const w = Math.ceil(48 + textWidth(link.label, 15) + 40);
  const h = 44;
  const glyph = BRANDS[link.icon]
    ? `<g transform="translate(15 13) scale(0.75)" fill="#fff">${BRANDS[link.icon]}</g>`
    : `<g transform="translate(15 13) scale(1.125)" fill="#fff">${ICONS[link.icon] ?? ICONS.globe}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FB}" role="img" aria-label="${esc(link.label)}">
  <title>${esc(link.label)}</title>
  <defs>
    <linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${c.accent2}"/></linearGradient>
    <linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="r"><rect width="${w}" height="${h}" rx="22"/></clipPath>
  </defs>
  <style>${fontCss}@keyframes sh{0%,55%{transform:translateX(-70px)}100%{transform:translateX(${w + 10}px)}}.sh{animation:sh 4.5s ease-in-out infinite}</style>
  <rect x=".75" y=".75" width="${w - 1.5}" height="${h - 1.5}" rx="21.25" fill="${c.panel}" stroke="url(#b)" stroke-width="1.5"/>
  <circle cx="24" cy="22" r="15" fill="${color}"/>
  ${glyph}
  <text x="48" y="27.5" font-size="15" font-weight="700" font-family="${FD}" fill="${c.text}">${esc(link.label)}</text>
  <path d="M${w - 26} 26l8-8m-6 0h6v6" fill="none" stroke="${c.muted}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <g clip-path="url(#r)"><rect class="sh" width="60" height="${h}" fill="url(#s)"/></g>
</svg>`;
}

/** Where each section lands on the card: { height, boxes: [{ id, x, y, w, h, minH }] } in card pixels; minH is the height its content needs. Same options as render. */
export const sectionBoxes = (d, opts) => render(d, { ...opts, boxesOnly: true });
