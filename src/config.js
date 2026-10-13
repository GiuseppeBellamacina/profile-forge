// config.json: schema defaults, validation, and normalization into the runtime config used by stats/render.
import { LOCALES, normLocale } from "./i18n.js";
import { ALL_LEVELS, OLD_RANKS } from "./levels.js";
import { hasTheme, parseColors, registerThemes, THEME_NAMES } from "./themes.js";

export const SECTIONS = ["header", "about", "workingOn", "stats", "streak", "languages", "trophies", "heatmap", "techStack"];
export const STATS_ITEMS = ["stars", "commits", "prs", "issues", "reviews", "contributed", "followers", "repos"];
export const STATS_EXTRA = ["prsmerged", "prsmergedpercentage", "discussionsstarted", "discussionsanswered"];
// Narrowest width (in grid columns, out of 6) each section can be drawn at; the header always spans the card.
export const MIN_SPAN = { header: 6, about: 2, workingOn: 2, stats: 3, streak: 3, languages: 3, trophies: 2, heatmap: 3, techStack: 2 };
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const DEFAULTS = {
  // content (same keys the old profile.json used)
  user: null, title: null, about: [], workingOn: [], links: [], techStack: [],
  locale: "en", timezone: "UTC", includePrivate: false,
  themes: ["dark", "light"], customThemes: {}, colors: {}, colorsByTheme: {},
  card: { radius: 20, hideBorder: false, animations: true, background: { gradient: null, pattern: "none", glow: true } },
  layout: ["header", "about", "workingOn", ["stats", "streak"], "languages", "trophies", "heatmap", "techStack"],
  hideSections: [],
  grid: null, // [{ section, cols, height? }]: free 6-column grid instead of `layout` (see GUIDE)
  header: { avatar: "circle", facts: ["contributionsThisYear", "bestDay", "busiestWeekday"], rankIcon: "level" },
  stats: { title: null, hide: [], show: [], icons: true, numberFormat: "long", numberPrecision: null, textBold: true, lineHeight: 30, commitsYear: null, excludeRepos: [] },
  streak: { title: null, hide: [], mode: "daily", excludeDays: [], startingYear: null, dateFormat: null, shortNumbers: false, excludeDaysLabel: true },
  languages: { title: null, layout: "bar", count: 8, hide: [], excludeRepos: [], hideProgress: false, statsFormat: "percentages", sizeWeight: 1, countWeight: 0 },
  trophies: { title: null, titles: [], hideTitles: [], ranks: [], hideRanks: [], columns: 0, rows: 0, marginW: 14, marginH: 14, padding: 20, align: "center", style: "cup", parts: ["title", "label", "score", "bar"], noBg: false, noFrame: false, extra: [] },
  heatmap: { mode: "grid", snakePath: "smart", weeks: 53, cell: "square", weekStart: "sun", legend: true, monthLabels: true },
  export: { png: false, gif: false },
};

const FACTS = ["contributionsThisYear", "bestDay", "busiestWeekday", "currentStreak", "longestStreak", "topLanguage", "stars", "followers"];
const ENUMS = {
  locale: LOCALES, "card.background.pattern": ["none", "dots", "grid", "diagonal"],
  "header.avatar": ["circle", "rounded", "hide"], "header.rankIcon": ["level", "percentile", "github"],
  "stats.numberFormat": ["long", "short"], "streak.mode": ["daily", "weekly"],
  "languages.layout": ["bar", "compact", "donut", "donut-vertical", "pie"], "languages.statsFormat": ["percentages", "bytes"],
  "trophies.style": ["cup", "medal", "shield", "gem", "letter"], "trophies.align": ["center", "left"],
  "heatmap.mode": ["grid", "snake"], "heatmap.snakePath": ["smart", "busy", "nearest", "sweep", "rows", "spiral"], "heatmap.cell": ["square", "round", "triangle", "snowflake", "moon", "mixed"], "heatmap.weekStart": ["sun", "mon"],
};
const RANGES = {
  "card.radius": [0, 60], "stats.numberPrecision": [0, 2], "stats.lineHeight": [18, 60], "stats.commitsYear": [2005, 2100],
  "streak.startingYear": [2005, 2100], "languages.count": [1, 20], "languages.sizeWeight": [0, 10], "languages.countWeight": [0, 10],
  "trophies.columns": [-1, 12], "trophies.rows": [0, 10], "trophies.marginW": [0, 60], "trophies.marginH": [0, 60], "trophies.padding": [0, 60], "heatmap.weeks": [4, 53],
};
// Keys whose value shape isn't described by the default's type.
const FREE = new Set(["themes", "customThemes", "colors", "colorsByTheme", "layout", "grid", "about", "workingOn", "links", "techStack"]);
const NUMERIC_NULL = new Set(["stats.numberPrecision", "stats.commitsYear", "streak.startingYear"]);
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

function merge(def, user, path = "") {
  const out = { ...def };
  for (const [k, v] of Object.entries(user ?? {})) {
    if (k === "$schema") continue;
    const p = path ? `${path}.${k}` : k;
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
  for (const r of c.trophies.extra) if (!["issues", "reviews"].includes(r.toLowerCase())) throw new Error(`Config "trophies.extra": unknown trophy "${r}". Valid: Issues, Reviews`);
  const excludeDays = c.streak.excludeDays.map((x) => {
    const i = WEEKDAYS.indexOf(String(x).toLowerCase().slice(0, 3));
    if (i < 0) throw new Error(`Config "streak.excludeDays": invalid day "${x}" (use Sun, Mon, ...)`);
    return i;
  });

  return {
    ...c,
    locale: normLocale(c.locale),
    slots, colors, colorsByTheme, layout, grid, hideSections,
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
      extra: new Set(c.trophies.extra.map((x) => x.toLowerCase())),
      parts: must("trophies.parts", c.trophies.parts.map(nk), ["title", "label", "score", "bar"]),
    },
  };
}

/** True when stats need the extra GraphQL fields (merged PRs / discussions). */
export const needsExtras = (k) => [...k.stats.show].some((s) => STATS_EXTRA.includes(s));
