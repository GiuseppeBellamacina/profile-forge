import { BRANDS, CUP, ICONS, LAUREL } from "./icons.js";
import { normalize } from "./config.js";
import { intlTag, translator } from "./i18n.js";
import { snakeRoute } from "./snake.js";
import { trophyMatches } from "./stats.js";
import { parseColors, resolveTheme } from "./themes.js";

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
  const C = 2 * Math.PI * 50;
  const progress = 100 - d.rank.percentile;
  const pct = hs.rankIcon === "percentile";
  const gh = hs.rankIcon === "github";
  const avatar = () =>
    hs.avatar === "rounded"
      ? `<rect x="34" y="32" width="116" height="116" rx="30" fill="none" stroke="url(#grad)" stroke-width="3"/>
    <clipPath id="av"><rect x="40" y="38" width="104" height="104" rx="24"/></clipPath>`
      : `<circle cx="92" cy="90" r="58" fill="none" stroke="url(#grad)" stroke-width="3"/>
    <clipPath id="av"><circle cx="92" cy="90" r="52"/></clipPath>`;
  const rank = () => `<g${A.a(0.3, 0.5, { o: 0, s: 0.7 }, {}, [900, 90])}>
    <circle cx="900" cy="90" r="50" fill="none" stroke="${c.track}" stroke-width="8"/>
    <circle cx="900" cy="90" r="50" fill="none" stroke="url(#grad)" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${r3(C)}" transform="rotate(-90 900 90)"${A.a(0.5, 1.4, { dash: C }, { dash: (C * (100 - progress)) / 100 })}/>
    ${
      pct
        ? `<text x="900" y="97" text-anchor="middle" font-size="22" font-weight="700" font-family="${FD}" fill="${c.text}">${r3(d.rank.percentile).toFixed(1)}%</text>
    <text x="900" y="115" text-anchor="middle" font-size="10" fill="${c.muted}">${esc(tr("rankLabel", { l: d.rank.level }))}</text>`
        : `${gh ? icon("github", 882, 70, 36, c.text) : `<text x="900" y="99" text-anchor="middle" font-size="30" font-weight="700" font-family="${FD}" fill="${c.text}">${d.rank.level}</text>`}
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
    ${icon("history", nx, 122, 14, c.muted)}
    <text x="${nx + 21}" y="134" font-size="13" fill="${c.muted}">${esc(tr("joined", { d: joined, n: tr(d.years === 1 ? "year" : "years", { n: d.years }) }))}</text>
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

// Trophy palettes from github-profile-trophy: "darkhub" for dark themes, "default" for light ones, and the matching named palettes.
const TP = (title, text, laurel, bar, [s, a, b, def], sec, circle = "#f0f6fb", rt = "#0d1117") => ({
  title, text, circle, laurel, bar, secret: [...sec, sec[1]], S: [s, s, rt], A: [a, a, rt], B: [b, b, rt], other: [def, def, rt],
});
const TROPHY_THEMES = {
  dark: {
    title: "#c9d1d9", text: "#8b949e", circle: "#f0f6fb", laurel: "#178600", bar: "#ff79c6",
    secret: ["#ff5555", "#ff79c6", "#388bfd", "#ff79c6"], S: ["#ffb86c", "#ffb86c", "#0d1117"], A: ["#8be9fd", "#8be9fd", "#0d1117"],
    B: ["#ff5555", "#ff5555", "#0d1117"], other: ["#6272a4", "#6272a4", "#0d1117"],
  },
  light: {
    title: "#000", text: "#666", circle: "#fff", laurel: "#009366", bar: "#0366d6",
    secret: ["red", "fuchsia", "blue", "fuchsia"], S: ["#FAD200", "#C8A090", "#886000"], A: ["#B0B0B0", "#9090C0", "#505050"],
    B: ["#A18D66", "#816D96", "#412D06"], other: ["#777", "#333", "#333"],
  },
  nord: TP("#81a1c1", "#eceff4", "#a3be8c", "#81a1c1", ["#ebcb8b", "#8fbcbb", "#d08770", "#5e81ac"], ["#bf616a", "#b48ead", "#81a1c1"], "#d8dee9"),
  monokai: TP("#f92672", "#ffffff", "#a6e22e", "#f92672", ["#e6db74", "#66d9ef", "#fd971f", "#75715e"], ["#f92672", "#ae81ff", "#66d9ef"], "#fff"),
  gruvbox: TP("#ebdbb2", "#98971a", "#689d6a", "#fabd26", ["#fabd2f", "#83a598", "#d65d0e", "#928374"], ["#fb4934", "#d3869b", "#458588"], "#ebdbb2"),
  dracula: TP("#ff79c6", "#f8f8f2", "#50fa7b", "#ff79c6", ["#ffb86c", "#8be9fd", "#ff5555", "#6272a4"], ["#ff5555", "#ff79c6", "#bd93f9"], "#f8f8f2"),
  radical: TP("#fe428e", "#a9fef7", "#50fa7b", "#fe428e", ["#ffce32", "#8df7b5", "#ea3f25", "#1e65f5"], ["#ff5555", "#ff15d9", "#1e65f5"], "#eeeeee"),
  discord: TP("#7289da", "#ffffff", "#57f287", "#5865f2", ["#fee75c", "#eb459e", "#ed4245", "#5865f2"], ["#ed4245", "#57f287", "#5865f2"], "#ffffff"),
  aura: TP("#ffffff", "#dbffe6", "#a9fcca", "#715df5", ["#8e57ff", "#7c71f5", "#226a80", "#5e8c2a"], ["#c273ff", "#c273ff", "#c273ff"], "#ffffff"),
  "one-dark": TP("#e5c07b", "#e06c75", "#98c379", "#e5c07b", ["#e5c07b", "#56b6c2", "#c678dd", "#abb2bf"], ["#e06c75", "#c678dd", "#61afef"], "#ffffff"),
  matrix: TP("#00cc00", "#00cc00", "#178600", "#00ff00", ["#ffd700", "#c0c0c0", "#b08d57", "#b08d57"], ["#ffd700", "#ffffff", "#ffd700"], "#002200", "#000000"),
};
const abridge = (n) => (n < 1 ? "0pt" : n > 999 ? `${(n / 1000).toFixed(1)}kpt` : `${n}pt`);

/** One 110×110 trophy, drawn like github-profile-trophy (cup, laurel for S/A, extra cups for SS/SSS). */
function trophy(tr, tt, theme) {
  const id = `tg-${theme}-${tr.rank === "?" ? "UNKNOWN" : tr.rank}`;
  const secret = tr.rank === "SECRET";
  const [base, shadow, rankText] = secret ? tt.secret.slice(1) : tt[tr.rank[0]] ?? tt.other;
  const stops = secret
    ? tt.secret.slice(0, 3).map((col, i) => `<stop offset="${i * 50}%" stop-color="${col}"/>`).join("")
    : `<stop offset="0%" stop-color="${base}"/><stop offset="${tt[tr.rank[0]] ? 70 : 50}%" stop-color="${base}"/><stop offset="100%" stop-color="${shadow}"/>`;
  const cup = (fill, letterColor) =>
    `${CUP}<circle cx="8" cy="6" r="4" fill="${tt.circle}"/><text x="6" y="8" font-family="Courier, monospace" font-size="7" fill="${letterColor}">${secret ? "S" : tr.rank[0]}</text>`;
  const extra = secret ? 0 : tr.rank.length - 1;
  const small = (x) => `<svg x="${x}" y="35" width="65" height="65" viewBox="0 0 30 30" fill="${base}">${cup(base, rankText)}</svg>`;
  const laurel = !secret && "SA".includes(tr.rank[0])
    ? `<svg width="120" height="120" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${LAUREL(tt.laurel)}</svg>`
    : "";
  return {
    defs: `<linearGradient id="${id}" gradientTransform="rotate(45)">${stops}</linearGradient>`,
    body: `${laurel}${extra === 2 ? small(7) : ""}${extra >= 1 ? small(68) : ""}
      <svg x="28" y="20" width="100" height="100" viewBox="0 0 30 30" fill="url(#${id})">${cup(null, secret ? tt.secret[3] : rankText)}</svg>
      <text x="55" y="18" text-anchor="middle" font-size="13" font-weight="700" font-family="${FD}" fill="${tt.title}">${esc(tr.title)}</text>
      <text x="55" y="85" text-anchor="middle" font-size="10.5" font-weight="700" font-family="${FD}" fill="${tt.text}">${esc(tr.label)}</text>
      <text x="55" y="97" text-anchor="middle" font-size="10" font-weight="700" font-family="${FD}" fill="${tt.text}">${tr.title === "Experience" ? `${tr.score} yrs` : secret ? "SECRET" : abridge(tr.score)}</text>
      <rect x="15" y="101" rx="1" width="80" height="3.2" opacity="0.3" fill="${tt.bar}"/>`,
  };
}

function trophiesSection(d, X, W = 940) {
  const { c, A, k, tr, theme } = X;
  const o = k.trophies;
  const tt = TROPHY_THEMES[theme] ?? TROPHY_THEMES[c.base];
  let list = d.trophies.filter(
    (t) =>
      (!o.titles.size || trophyMatches(t.title, o.titles)) &&
      !trophyMatches(t.title, o.hideTitles) &&
      (!o.ranks.size || o.ranks.has(t.rank)) &&
      !o.hideRanks.has(t.rank),
  );
  if (!list.length) return null;
  const gx = o.marginW;
  const gy = o.marginH;
  // by default as many per row as fit (all of them in one row on a full-width card)
  const fit = Math.max(1, Math.floor((W - 20 + gx) / (70 + gx)));
  const cols = o.columns > 0 ? Math.min(list.length, o.columns) : Math.min(list.length, fit);
  if (o.rows) list = list.slice(0, cols * o.rows);
  const rows = Math.ceil(list.length / cols);
  const s = Math.min(110, (W - 20 - gx * (cols - 1)) / cols);
  return {
    w: W, top: 504, nx: 30, h: Math.round(58 + rows * s + (rows - 1) * gy),
    draw: (H) => {
      const defs = [];
      const cards = list
        .map((tr_, i) => {
          const row = Math.floor(i / cols);
          const inRow = Math.min(cols, list.length - row * cols);
          const x = 30 + (W - (inRow * s + gx * (inRow - 1))) / 2 + (i % cols) * (s + gx);
          const y = 542 + row * (s + gy);
          const { defs: g, body } = trophy(tr_, tt, theme);
          defs.push(g);
          return `<g${A.a(1.45 + i * 0.08, 0.5, { o: 0, s: 0.6 }, {}, [r3(x + s / 2), r3(y + s / 2)])}>
    <svg x="${r3(x)}" y="${r3(y)}" width="${r3(s)}" height="${r3(s)}" viewBox="0 0 110 110">
      <rect x="0.5" y="0.5" rx="4.5" width="109" height="109" fill="${o.noBg ? "none" : c.bg1}" stroke="${o.noFrame ? "none" : c.border}"/>
      ${body}
      <g${A.a(1.8 + i * 0.08, 0.9, { sx: 0 }, {}, [15, 102])}><rect x="15" y="101" rx="1" width="${r3(80 * tr_.progress)}" height="3.2" fill="${tt.bar}"/></g>
    </svg>
  </g>`;
        })
        .join("");
      return `<defs>${defs.join("")}</defs>
  <g${A.a(1.3, 0.5, { o: 0 })}>${panel(30, 504, W, H, c)}${heading(50, 530, o.title ?? tr("trophies"), c)}</g>
  ${cards}`;
    },
  };
}

// Heatmap cells: every shape fits the same 13.5px box. `fill` is the colour of the day's level; `dim` the colour of an empty
// day (moons are drawn as an empty disc with the lit part on top). `grow` makes the shape a little larger, used to hide
// what lies underneath. `inner` is a <title> for tooltips.
const CELL = 13.5;
export const CELL_SHAPES = ["square", "round", "triangle", "snowflake", "moon", "mixed"];
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
  // one cell of the grid; `grow` / `lvl` let the snake cover it with the empty-day look
  const cell = (w, i, lvl, inner = "", grow = 0) => {
    const kind = shapeAt(o.cell, w, i);
    return cellShape(kind, r3(x0 + w * step), r3(y0 + i * step), c.heat[lvl], { lvl, up: (w + i) % 2 === 0, grow, inner, dim: c.heat[0], rx });
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
  const SNAKE_LEN = 6;
  const SNAKE_PAUSE = 1.5;
  let plan = null; // the route and its timing, computed once per card (inside draw, when the section delay is known)
  const snakePlan = () => {
    if (plan) return plan;
    const { pts: route, eaten } = snakeRoute(o.snakePath, weeks, level, SNAKE_LEN);
    const pts = route.map(({ w, i }) => ({ x: x0 + w * step, y: y0 + i * step }));
    const last = pts.length - 1;
    // a long route is played faster so one loop never takes much longer than half a minute
    const DT = Math.min(0.06, Math.max(0.02, 30 / (last + SNAKE_LEN)));
    const T = r3((last + SNAKE_LEN) * DT + SNAKE_PAUSE);
    plan = { route, eaten, pts, last, DT, T, pct: (t) => r3((t / T) * 100), delay: r3(A.dt + 1.8 + weeks.length * 0.025 + 0.5) }; // after the grid has faded in
    return plan;
  };
  // a day with contributions, drawn on top of its empty-day look and faded out when the snake gets there
  const snakeDay = (w, i, lvl, title) => {
    const { eaten, last, DT, T, pct, delay } = snakePlan();
    const j = eaten.get(`${w},${i}`) ?? last;
    A.css.push(`@keyframes ce${w}_${i}{0%,${pct(j * DT)}%{opacity:1}${pct(j * DT + 0.1)}%,99.5%{opacity:0}100%{opacity:1}}`);
    return cell(w, i, 0) + cell(w, i, lvl, title).replace(/^<(\w+)/, `<$1 style="animation:ce${w}_${i} ${T}s linear ${delay}s infinite"`);
  };
  const snakeSvg = () => {
    const { route, pts, last, DT, T, pct, delay } = snakePlan();
    // the snake is made of the same shape as the days (a full moon for moons; round for the random mix)
    const kind = o.cell === "mixed" ? "round" : o.cell;
    // triangles alternate up / down from cell to cell like the grid
    const tri = kind === "triangle";
    const upAt = (j) => (route[j].w + route[j].i) % 2 === 0;
    const seg = (k, attrs, up = true) => cellShape(kind, 0, 0, c.snake, { lvl: 4, up, dim: c.snake, rx }).replace(/^<(\w+)/, `<$1 opacity="${r3(1 - k * 0.1)}" ${attrs}`);
    if (A.t !== undefined) {
      // static frame (PNG / GIF / animations off): the snake waits at the start of the grid
      return Array.from({ length: SNAKE_LEN }, (_, k) => { const p = pts[SNAKE_LEN - k]; return seg(k, `transform="translate(${r3(p.x)} ${r3(p.y)})"`, upAt(SNAKE_LEN - k)); }).join("");
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
  <g clip-path="url(#snkclip)">${body}</g>`;
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

/** Two endless marquee rows of tech logos (order shuffled at generation time), moving in opposite directions. */
function stackSection(d, X, W = 940) {
  const { c, A, k, tr, defs } = X;
  const items = k.stack ?? [];
  if (!items.length) return null;
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)].filter((r) => r.length);
  const step = 84;
  const speed = 28; // px per second
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
  const BASE = { header: 0, about: 0, workingOn: 0, stats: 0.4, streak: 0.6, languages: 1.0, trophies: 1.3, heatmap: 1.7, techStack: 0 };
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
  const SH = y + 8;
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
