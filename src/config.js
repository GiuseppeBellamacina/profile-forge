// config.json: schema defaults, validation, and normalization into the runtime config used by stats/render.
import { LOCALES, normLocale } from "./i18n.js";
import { PACMAN_MAZES } from "./pacman.js";
import { ALL_LEVELS, OLD_RANKS } from "./levels.js";
import { hasTheme, hex, parseColors, registerThemes, THEME_NAMES } from "./themes.js";
import { MOTIF_NAMES } from "./motifs.js";

export const SECTIONS = ["header", "about", "workingOn", "stats", "streak", "languages", "trophies", "heatmap", "techStack", "terminal", "rhythm", "orgs"];
export const STATS_ITEMS = ["stars", "commits", "prs", "issues", "reviews", "contributed", "followers", "repos"];
export const STATS_EXTRA = ["prsmerged", "prsmergedpercentage", "discussionsstarted", "discussionsanswered"];
// Narrowest width (in grid columns, out of 6) each section can be drawn at; the header always spans the card.
export const MIN_SPAN = { header: 6, about: 2, workingOn: 2, stats: 3, streak: 3, languages: 3, trophies: 2, heatmap: 3, techStack: 2, terminal: 2, rhythm: 3, orgs: 2 };
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DEFAULTS = {
  // content (same keys the old profile.json used)
  user: null, title: null, about: [], workingOn: [], links: [], techStack: [],
  locale: "en", timezone: "UTC", includePrivate: false,
  themes: ["dark", "light"], customThemes: {}, colors: {}, colorsByTheme: {},
  card: {
    radius: 20, hideBorder: false, animations: true, panels: "rounded", titles: "plain",
    background: {
      gradient: null, pattern: "none", patternColor: null, patternOpacity: null, patternSize: 100,
      glow: true, glowColor: null, glowX: 85, glowY: 0, glowSize: 65, glowOpacity: 0.18,
      image: null, imageOpacity: 0.35, imageFit: "cover",
    },
    decor: [], // [{ motif | image, x, y, size, rotate, opacity, color, color2, layer, flip, motion }]: art on the card (see GUIDE)
  },
  layout: ["header", "about", "workingOn", ["stats", "streak"], "languages", "trophies", "heatmap", "techStack"],
  hideSections: [],
  grid: null, // [{ section, cols, height? }]: free 6-column grid instead of `layout` (see GUIDE)
  header: { avatar: "circle", frame: "ring", frameAnimation: "default", rankStyle: "ring", rankThickness: 8, facts: ["contributionsThisYear", "bestDay", "busiestWeekday"], rankIcon: "level", rankEffect: "auto", flag: null },
  stats: { title: null, hide: [], show: [], icons: true, numberFormat: "long", numberPrecision: null, textBold: true, lineHeight: 30, commitsYear: null, excludeRepos: [] },
  streak: { title: null, hide: [], mode: "daily", excludeDays: [], startingYear: null, dateFormat: null, shortNumbers: false, excludeDaysLabel: true },
  languages: { title: null, layout: "bar", count: 8, hide: [], excludeRepos: [], hideProgress: false, statsFormat: "percentages", sizeWeight: 1, countWeight: 0 },
  trophies: { title: null, titles: [], hideTitles: [], ranks: [], hideRanks: [], columns: 0, rows: 0, marginW: 14, marginH: 14, padding: 20, align: "center", parts: ["title", "label", "score", "bar"], noBg: false, noFrame: false, order: [], birthday: null, sort: "default", highlight: [] },
  marquee: { speed: 28, rows: 2, order: "shuffle", byCategory: false },
  terminal: { title: null, lines: [] },
  rhythm: { title: null, show: ["weekdays", "months"] },
  orgs: { title: null, select: [], hide: [], order: [], sort: "contributions", mode: "static", direction: "left", speed: 30 },
  heatmap: { mode: "grid", snakePath: "smart", snakeLength: 6, snakeStyle: "classic", pacmanMaze: "data", pacmanLives: 3, pacmanGames: 1, weeks: 53, cell: "square", weekStart: "sun", legend: true, monthLabels: true },
  export: { png: false, gif: false },
};

const FACTS = ["contributionsThisYear", "bestDay", "busiestWeekday", "currentStreak", "longestStreak", "topLanguage", "stars", "followers"];
const ENUMS = {
  locale: LOCALES, "card.background.pattern": ["none", "dots", "grid", "diagonal", "halftone", "scanlines", "stripes", "hex", "circuit", "crosses"], "card.background.imageFit": ["cover", "contain"], "card.panels": ["rounded", "square", "notched"], "card.titles": ["plain", "tag"],
  "header.avatar": ["circle", "rounded", "hide"], "header.frame": ["none", "ring", "double", "dashed", "neon", "pixel", "glitch", "laurel", "flames", "sakura", "stars", "halo", "aurora", "orbit", "prism", "auto"], "header.frameAnimation": ["default", "none", "spin", "pulse", "twinkle"], "header.rankStyle": ["ring", "hexagon", "shield"], "header.rankIcon": ["level", "percentile", "github"], "header.rankEffect": ["auto", "none", "halo", "shine", "embers", "rainbow"],
  "stats.numberFormat": ["long", "short"], "streak.mode": ["daily", "weekly"],
  "languages.layout": ["bar", "compact", "donut", "donut-vertical", "pie"], "languages.statsFormat": ["percentages", "bytes"],
  "trophies.align": ["center", "left"], "marquee.order": ["shuffle", "config", "name"], "trophies.sort": ["default", "rank", "name"], "orgs.sort": ["contributions", "popularity", "custom"], "orgs.mode": ["static", "scroll"], "orgs.direction": ["left", "right"], "heatmap.snakeStyle": ["classic", "rainbow", "glow"],
  "heatmap.mode": ["grid", "snake", "pacman"], "heatmap.pacmanMaze": PACMAN_MAZES, "heatmap.snakePath": ["smart", "busy", "nearest", "sweep", "rows", "spiral"], "heatmap.cell": ["square", "round", "triangle", "snowflake", "moon", "hexagon", "mixed"], "heatmap.weekStart": ["sun", "mon"],
};
const RANGES = {
  "card.radius": [0, 60], "card.background.patternOpacity": [0, 1], "card.background.patternSize": [25, 400], "card.background.glowX": [0, 100], "card.background.glowY": [0, 100], "card.background.glowSize": [10, 200], "card.background.glowOpacity": [0, 1], "card.background.imageOpacity": [0, 1], "stats.numberPrecision": [0, 2], "stats.lineHeight": [18, 60], "stats.commitsYear": [2005, 2100],
  "streak.startingYear": [2005, 2100], "languages.count": [1, 20], "languages.sizeWeight": [0, 10], "languages.countWeight": [0, 10],
  "trophies.columns": [-1, 12], "trophies.rows": [0, 10], "trophies.marginW": [0, 60], "trophies.marginH": [0, 60], "trophies.padding": [0, 60], "heatmap.weeks": [4, 53], "header.rankThickness": [4, 16], "marquee.speed": [5, 200], "marquee.rows": [1, 4], "heatmap.snakeLength": [3, 12], "heatmap.pacmanLives": [1, 5], "heatmap.pacmanGames": [1, 3], "orgs.speed": [5, 200],
};
// Keys whose value shape isn't described by the default's type.
const FREE = new Set(["card.decor", "themes", "customThemes", "colors", "colorsByTheme", "layout", "grid", "about", "workingOn", "links", "techStack"]);
const NUMERIC_NULL = new Set(["card.background.patternOpacity", "stats.numberPrecision", "stats.commitsYear", "streak.startingYear"]);
const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v);

function check(p, d, v) {
  if (FREE.has(p)) return v;
  if (Array.isArray(d)) v = typeof v === "string" ? v.split(",").map((x) => x.trim()).filter(Boolean) : v;
  if (Array.isArray(d) && !Array.isArray(v)) throw new Error(`Config "${p}" must be a list`);
  if (typeof d === "number" || NUMERIC_NULL.has(p)) {
    if (v === null && NUMERIC_NULL.has(p)) return v;
    const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
    if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`Config "${p}" must be a number, got ${JSON.stringify(v)}`);
    const [lo, hi] = RANGES[p] ?? [-Infinity, Infinity];
    if (n < lo || n > hi) throw new Error(`Config "${p}" must be between ${lo} and ${hi}, got ${n}`);
    return n;
  }
  if (typeof d === "boolean") {
    if (v === "true" || v === "false") return v === "true";
    if (typeof v !== "boolean") throw new Error(`Config "${p}" must be true or false, got ${JSON.stringify(v)}`);
    return v;
  }
  if (d === null || typeof d === "string") {
    if (v !== null && typeof v !== "string") throw new Error(`Config "${p}" must be a string, got ${JSON.stringify(v)}`);
    if (ENUMS[p] && p !== "locale" && v !== null && !ENUMS[p].includes(v)) throw new Error(`Config "${p}" must be one of: ${ENUMS[p].join(", ")} (got "${v}")`);
  }
  return v;
}

// Options that no longer exist. Configs written for an older version keep working: these are ignored instead of rejected.
// trophies.extra: Issues and Reviews are now regular trophies, shown like the others.
export const REMOVED_KEYS = new Set(["trophies.style", "trophies.extra"]);

function merge(def, user, path = "") {
  const out = { ...def };
  for (const [k, v] of Object.entries(user ?? {})) {
    if (k === "$schema") continue;
    const p = path ? `${path}.${k}` : k;
    if (REMOVED_KEYS.has(p)) continue;
    if (!(k in def)) throw new Error(`Unknown config key "${p}". Valid keys${path ? ` under "${path}"` : ""}: ${Object.keys(def).join(", ")}`);
    if (isPlain(def[k]) && !FREE.has(p)) {
      if (!isPlain(v)) throw new Error(`Config "${p}" must be an object`);
      out[k] = merge(def[k], v, p);
    } else out[k] = check(p, def[k], v);
  }
  return out;
}

/** Set "a.b.c" = value inside a plain object (creating objects). */
export function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = isPlain(o[k]) ? o[k] : (o[k] = {});
  o[keys.at(-1)] = value;
  return obj;
}

const normKey = (s) => String(s).toLowerCase().replace(/[_\- ]/g, "");
const ALIAS = { contribs: "contributed", pullrequests: "prs" };
const nk = (s) => ALIAS[normKey(s)] ?? normKey(s);
const must = (path, list, valid) => {
  for (const x of list) if (!valid.includes(x)) throw new Error(`Config "${path}": unknown value "${x}". Valid: ${valid.join(", ")}`);
  return new Set(list);
};

// card.decor: up to 12 pieces of art. Position and size are percents of the card's WIDTH (1 = 10 px on the standard card): x from the
// left, y from the top (or from the bottom with anchor: bottom), so a piece keeps its place whatever the height of the card.
export const DECOR_MAX = 12;
const DECOR_DEFAULTS = { motif: null, image: null, x: 50, y: 20, anchor: "top", size: 20, rotate: 0, opacity: 0.5, color: null, color2: null, layer: "back", flip: false, motion: "none" };
const DECOR_ENUMS = { anchor: ["top", "bottom"], layer: ["back", "front"], motion: ["none", "float", "pulse"] };
const DECOR_RANGES = { x: [-50, 150], y: [-50, 200], size: [2, 150], rotate: [-360, 360], opacity: [0, 1] };
function decorList(list) {
  if (!Array.isArray(list)) throw new Error(`Config "card.decor" must be a list`);
  if (list.length > DECOR_MAX) throw new Error(`Config "card.decor": at most ${DECOR_MAX} pieces (got ${list.length})`);
  return list.map((it, n) => {
    const p = `card.decor[${n}]`;
    if (!isPlain(it)) throw new Error(`Config "${p}" must be an object`);
    for (const key of Object.keys(it)) if (!(key in DECOR_DEFAULTS)) throw new Error(`Unknown config key "${p}.${key}". Valid keys: ${Object.keys(DECOR_DEFAULTS).join(", ")}`);
    const o = { ...DECOR_DEFAULTS, ...it };
    if (!o.motif === !o.image) throw new Error(`Config "${p}" needs exactly one of "motif" and "image"`);
    if (o.motif && !MOTIF_NAMES.includes(o.motif)) throw new Error(`Config "${p}.motif": unknown motif "${o.motif}". Available: ${MOTIF_NAMES.join(", ")}`);
    if (o.image !== null && typeof o.image !== "string") throw new Error(`Config "${p}.image" must be a path`);
    for (const [key, [lo, hi]] of Object.entries(DECOR_RANGES)) {
      if (typeof o[key] !== "number" || !Number.isFinite(o[key])) throw new Error(`Config "${p}.${key}" must be a number, got ${JSON.stringify(o[key])}`);
      if (o[key] < lo || o[key] > hi) throw new Error(`Config "${p}.${key}" must be between ${lo} and ${hi}, got ${o[key]}`);
    }
    for (const [key, valid] of Object.entries(DECOR_ENUMS)) if (!valid.includes(o[key])) throw new Error(`Config "${p}.${key}" must be one of: ${valid.join(", ")} (got "${o[key]}")`);
    if (typeof o.flip !== "boolean") throw new Error(`Config "${p}.flip" must be true or false`);
    for (const key of ["color", "color2"]) if (o[key] !== null) o[key] = hex(`${p}.${key}`, String(o[key]));
    return o;
  });
}
/** The image files a config refers to (the background image and the images of the decor): the callers embed them as data URIs. */
export const imageRefs = (k) => [...new Set([k.card.background.image, ...k.decor.map((d) => d.image)].filter(Boolean))];

/** Validate + fill defaults + derive sets. Returns the runtime config `k`. */
export function normalize(raw = {}) {
  const c = merge(DEFAULTS, raw);
  registerThemes(c.customThemes);

  const slots = Array.isArray(c.themes) ? c.themes.map((t) => [t, t]) : isPlain(c.themes) ? Object.entries(c.themes) : null;
  if (!slots?.length) throw new Error(`Config "themes" must be a list of theme names or { slot: theme }`);
  for (const [slot, t] of slots) if (!hasTheme(t)) throw new Error(`Config "themes": unknown theme "${t}" (slot "${slot}"). Available: ${THEME_NAMES().join(", ")}`);

  const hideSections = new Set(c.hideSections.map(normKey));
  for (const s of hideSections) if (![...SECTIONS.map(normKey), "rank"].includes(s)) throw new Error(`Config "hideSections": unknown section "${s}". Valid: ${[...SECTIONS, "rank"].join(", ")}`);
  const sectionId = (s) => {
    const id = SECTIONS.find((x) => normKey(x) === normKey(s));
    if (!id) throw new Error(`Config "layout": unknown section "${s}". Valid: ${SECTIONS.join(", ")}`);
    return id;
  };
  if (!Array.isArray(c.layout)) throw new Error(`Config "layout" must be a list`);
  const layout = c.layout
    .map((row) => {
      const r = (Array.isArray(row) ? row : [row]).map(sectionId).filter((s) => !hideSections.has(normKey(s)));
      if (r.length > 2) throw new Error(`Config "layout": a row holds at most 2 sections (got ${r.length})`);
      return r;
    })
    .filter((r) => r.length);

  let grid = null;
  if (c.grid !== null) {
    if (!Array.isArray(c.grid)) throw new Error(`Config "grid" must be a list of { section, cols }`);
    const seen = new Set();
    grid = c.grid
      .map((it, i) => {
        if (!isPlain(it)) throw new Error(`Config "grid[${i}]" must be { "section": ..., "cols": ... }`);
        const id = sectionId(it.section);
        if (seen.has(id)) throw new Error(`Config "grid": section "${id}" appears twice`);
        seen.add(id);
        const cols = it.cols ?? (id === "header" ? 6 : 3);
        if (!Number.isInteger(cols) || cols < 1 || cols > 6) throw new Error(`Config "grid[${i}].cols" must be a whole number from 1 to 6 (got ${cols})`);
        if (it.height !== undefined && (!Number.isInteger(it.height) || it.height < 0 || it.height > 3000)) throw new Error(`Config "grid[${i}].height" must be a whole number of pixels from 0 to 3000 (got ${it.height})`);
        return { id, span: Math.max(cols, MIN_SPAN[id]), height: it.height };
      })
      .filter((it) => !hideSections.has(normKey(it.id)));
  }

  const rankName = (r, key) => {
    const name = r.replace(/^-/, "").toUpperCase();
    if (OLD_RANKS[name]) throw new Error(`Config "trophies.${key}": "${name}" no longer exists. Ranks are now ${ALL_LEVELS.join(", ")} (use "${OLD_RANKS[name]}" instead of "${name}").`);
    if (![...ALL_LEVELS, "SECRET", "?"].includes(name)) throw new Error(`Config "trophies.${key}": unknown rank "${r}". Valid: ${ALL_LEVELS.join(", ")}, SECRET (a leading "-" drops one, e.g. "-E").`);
    return (r.startsWith("-") ? "-" : "") + name;
  };
  const ranks = c.trophies.ranks.map((r) => rankName(r, "ranks"));
  for (const r of c.trophies.hideRanks) rankName(r, "hideRanks");
  const colors = parseColors(c.colors);
  const colorsByTheme = Object.fromEntries(Object.entries(c.colorsByTheme).map(([s, v]) => [s, parseColors(v)]));
  const facts = c.header.facts;
  for (const f of facts) if (!FACTS.includes(f)) throw new Error(`Config "header.facts": unknown fact "${f}". Valid: ${FACTS.join(", ")}`);
  if (facts.length > 4) throw new Error(`Config "header.facts": at most 4 facts`);
  const birthday = c.trophies.birthday;
  if (birthday != null) {
    const m = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(String(birthday));
    if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] < 1 || +m[2] > new Date(Date.UTC(2024, +m[1], 0)).getUTCDate()) throw new Error(`Config "trophies.birthday": expected "MM-DD" or "YYYY-MM-DD" (got "${birthday}")`);
  }
  for (const [n, l] of c.terminal.lines.entries()) if (typeof l !== "string") throw new Error(`Config "terminal.lines[${n}]" must be a string`);
  for (const key of ["snakeLength", "pacmanLives", "pacmanGames"]) if (!Number.isInteger(c.heatmap[key])) throw new Error(`Config "heatmap.${key}" must be a whole number`);
  const bgc = c.card.background;
  for (const key of ["patternColor", "glowColor"]) if (bgc[key] !== null) bgc[key] = hex(`card.background.${key}`, bgc[key]);
  const decor = decorList(c.card.decor);
  const excludeDays = c.streak.excludeDays.map((x) => {
    const i = WEEKDAYS.indexOf(String(x).toLowerCase().slice(0, 3));
    if (i < 0) throw new Error(`Config "streak.excludeDays": invalid day "${x}" (use Sun, Mon, ...)`);
    return i;
  });

  return {
    ...c,
    locale: normLocale(c.locale),
    slots, colors, colorsByTheme, layout, grid, hideSections, decor,
    header: { ...c.header, facts },
    stats: {
      ...c.stats,
      hide: must("stats.hide", c.stats.hide.map(nk), STATS_ITEMS),
      show: must("stats.show", c.stats.show.map(nk), [...STATS_ITEMS, ...STATS_EXTRA]),
      excludeRepos: c.stats.excludeRepos.map((r) => r.toLowerCase()),
    },
    streak: { ...c.streak, hide: must("streak.hide", c.streak.hide.map(normKey), ["total", "current", "longest"]), excludeDays: new Set(excludeDays) },
    languages: { ...c.languages, hide: c.languages.hide.map((x) => x.toLowerCase()), excludeRepos: c.languages.excludeRepos.map((r) => r.toLowerCase()) },
    trophies: {
      ...c.trophies,
      titles: new Set(c.trophies.titles.map(normKey)),
      hideTitles: new Set(c.trophies.hideTitles.map(normKey)),
      ranks: new Set(ranks.filter((r) => !r.startsWith("-"))),
      hideRanks: new Set([...c.trophies.hideRanks.map((r) => r.toUpperCase()), ...ranks.filter((r) => r.startsWith("-")).map((r) => r.slice(1))]),
      order: c.trophies.order.map(normKey),
      parts: must("trophies.parts", c.trophies.parts.map(nk), ["title", "label", "score", "bar"]),
      highlight: new Set(c.trophies.highlight.map(normKey)),
    },
    orgs: { ...c.orgs, ...Object.fromEntries(["select", "hide", "order"].map((key) => [key, c.orgs[key].map((x) => String(x).toLowerCase())])) },
    rhythm: { ...c.rhythm, show: must("rhythm.show", c.rhythm.show.map((x) => String(x).toLowerCase()), ["weekdays", "months"]) },
  };
}

/** The tech stack logos in the order they scroll. `shuffle` takes `rand` (inject a seeded one for a stable preview); `byCategory` orders inside each category and keeps the categories in sequence. */
export function stackItems(techStack, { order, byCategory }, rand = Math.random) {
  const arrange = (a) => {
    if (order === "name") return [...a].sort((x, y) => x.name.localeCompare(y.name));
    if (order !== "shuffle") return a;
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return byCategory ? techStack.flatMap((c) => arrange(c.items)) : arrange(techStack.flatMap((c) => c.items));
}

/** True when the card needs the extra GraphQL fields (merged PRs / discussions): a stat that shows them, or a trophy built on them (Sharpshooter, Answer Machine) that is not hidden. */
export const needsExtras = (k) => {
  if ([...k.stats.show].some((s) => STATS_EXTRA.includes(s))) return true;
  const t = k.trophies;
  const shown = (title) => (!t.titles.size || t.titles.has(title)) && !t.hideTitles.has(title);
  const secret = !t.hideRanks.has("SECRET") && (!t.ranks.size || t.ranks.has("SECRET"));
  return secret && ["sharpshooter", "answermachine"].some(shown);
};
