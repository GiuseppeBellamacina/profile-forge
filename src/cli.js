#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { needsExtras, normalize, setPath, stackItems } from "./config.js";
import { fetchProfile } from "./github.js";
import { render, renderButton } from "./render.js";
import { summarize } from "./stats.js";
import { COLOR_NAMES, parseColors, THEME_NAMES } from "./themes.js";

// Flags that override a config.json key (flag -> config path). Anything else: --set path=value.
const FLAGS = {
  theme: "themes", tz: "timezone", locale: "locale", "size-weight": "languages.sizeWeight", "count-weight": "languages.countWeight",
  hide: "languages.hide", "hide-sections": "hideSections", "hide-stats": "stats.hide", "hide-trophies": "trophies.hideTitles",
  "border-radius": "card.radius", "show-icons": "stats.icons", "number-format": "stats.numberFormat", "stats-title": "stats.title",
  "rank-icon": "header.rankIcon", "hide-streak": "streak.hide", "date-format": "streak.dateFormat", "exclude-days": "streak.excludeDays",
  "streak-title": "streak.title", "trophy-rank": "trophies.ranks", "trophy-columns": "trophies.columns", "trophy-rows": "trophies.rows",
  "trophy-title": "trophies.title",
};
const SWITCHES = {
  "hide-border": ["card.hideBorder", true], "no-frame": ["trophies.noFrame", true], "no-bg": ["trophies.noBg", true],
  "no-animation": ["card.animations", false], "include-private": ["includePrivate", true], png: ["export.png", true], gif: ["export.gif", true],
};

const { values: o } = parseArgs({
  options: {
    user: { type: "string" },
    config: { type: "string" },
    token: { type: "string", default: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN },
    out: { type: "string", default: "out" },
    name: { type: "string", default: "profile-forge" },
    colors: { type: "string" },
    "trophy-margin": { type: "string" },
    set: { type: "string", multiple: true },
    init: { type: "boolean" },
    "print-config": { type: "boolean" },
    help: { type: "boolean", short: "h" },
    ...Object.fromEntries(Object.keys(FLAGS).map((f) => [f, { type: "string" }])),
    ...Object.fromEntries(Object.keys(SWITCHES).map((f) => [f, { type: "boolean" }])),
  },
});

const EXAMPLE = `{
  "$schema": "https://raw.githubusercontent.com/GiuseppeBellamacina/profile-forge/main/config.schema.json",
  "locale": "en",
  "timezone": "UTC",
  "themes": { "dark": "catppuccin-mocha", "light": "catppuccin-latte" },
  "stats": { "numberFormat": "short" },
  "streak": { "dateFormat": "M j[, Y]" },
  "languages": { "layout": "bar", "count": 8 },
  "trophies": { "ranks": ["-E"] }
}
`;

if (o.help) {
  console.log(`Usage: profile-forge --user <login> [--token <pat>] [--config config.json] [options]

Everything is configured in config.json (auto-detected in the current directory, falling back to profile.json).
Flags override it:
  --token <pat>         GitHub token (default: $GITHUB_TOKEN / $GH_TOKEN)
  --out <dir>           output directory (default: out)
  --name <base>         file base name (default: profile-forge -> profile-forge-<slot>.svg)
  --theme <list>        e.g. dark,light (themes: ${THEME_NAMES().join(", ")})
  --colors <list>       e.g. "bg_color=0d1117,icon_color=ff79c6" (${COLOR_NAMES.join(", ")})
  --set <path=value>    any config key, repeatable: --set stats.numberFormat=short --set languages.layout=donut
  --tz --locale --hide-sections --hide-stats --hide-trophies --hide-border --border-radius --no-animation
  --show-icons --number-format --stats-title --rank-icon --hide-streak --date-format --exclude-days --streak-title
  --trophy-rank --trophy-columns --trophy-rows --trophy-margin --trophy-title --no-frame --no-bg
  --size-weight --count-weight --hide (languages) --include-private --png --gif
  --init                write an example config.json and exit
  --print-config        print the effective configuration and exit`);
  process.exit(0);
}

if (o.init) {
  const target = "config.json";
  if (await access(target).then(() => true, () => false)) throw new Error(`${target} already exists`);
  await writeFile(target, EXAMPLE);
  console.log(`wrote ${target}`);
  process.exit(0);
}

// config.json (or profile.json) -> overrides from flags -> validated runtime config.
const exists = (p) => access(p).then(() => true, () => false);
const configPath = o.config ?? ((await exists("config.json")) ? "config.json" : (await exists("profile.json")) ? "profile.json" : null);
const raw = configPath ? JSON.parse(await readFile(configPath, "utf8")) : {};
for (const [flag, path] of Object.entries(FLAGS)) if (o[flag] !== undefined) setPath(raw, path, flag === "theme" ? o[flag].split(",").map((s) => s.trim()) : o[flag]);
for (const [flag, [path, v]] of Object.entries(SWITCHES)) if (o[flag]) setPath(raw, path, v);
if (o.colors !== undefined) setPath(raw, "colors", parseColors(o.colors));
if (o["trophy-margin"] !== undefined) for (const p of ["trophies.marginW", "trophies.marginH"]) setPath(raw, p, o["trophy-margin"]);
for (const s of o.set ?? []) {
  const i = s.indexOf("=");
  if (i < 1) throw new Error(`--set expects path=value, got "${s}"`);
  setPath(raw, s.slice(0, i).trim(), s.slice(i + 1));
}
const k = normalize(raw);

if (o["print-config"]) {
  console.log(JSON.stringify(k, (_, v) => (v instanceof Set ? [...v] : v), 2));
  process.exit(0);
}
const login = o.user ?? k.user;
if (!login || !o.token) {
  console.error("Missing --user (or \"user\" in config.json) and/or a token ($GITHUB_TOKEN). See --help.");
  process.exit(1);
}

const profile = await fetchProfile({
  login, token: o.token, includePrivate: k.includePrivate, tz: k.timezone, startingYear: k.streak.startingYear, extras: needsExtras(k),
});
if (profile.incompleteYears?.length) console.error(`Warning: the organizations of ${profile.incompleteYears.join(", ")} could not be read (GitHub did not answer); run it again for the full list.`);
const data = summarize(profile, k);

const MIME = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
// Images are embedded as data URIs: GitHub's image proxy blocks external loads inside SVGs.
const base = configPath ? dirname(resolve(configPath)) : process.cwd();
k.stack = await Promise.all(
    stackItems(k.techStack, k.marquee).map(async (it, n) => ({
      name: it.name,
      id: `i${n}`,
      data: `data:${MIME[extname(it.image).toLowerCase()] ?? "image/png"};base64,${(await readFile(join(base, it.image))).toString("base64")}`,
    })),
);

if (k.header.flag) k.flagData = `data:${MIME[extname(k.header.flag).toLowerCase()] ?? "image/png"};base64,${(await readFile(join(base, k.header.flag))).toString("base64")}`;

// Webfonts are embedded as data URIs: GitHub shows README SVGs as images, which can't fetch fonts.
const fontDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fonts");
const face = async (family, file) =>
  `@font-face{font-family:'${family}';font-weight:300 800;src:url(data:font/woff2;base64,${(await readFile(join(fontDir, file))).toString("base64")}) format("woff2")}`;
const bodyFont = await face("Inter", "inter.woff2");
const displayFont = await face("Space Grotesk", "space-grotesk.woff2");

await mkdir(o.out, { recursive: true });
const { png, gif } = k.export;
// Loaded lazily so the GitHub Action works without installing the optional export deps.
const exporter = png || gif ? await import("./export.js") : null;
for (const [slot, theme] of k.slots) {
  const colors = { ...k.colors, ...k.colorsByTheme[slot] };
  const file = join(o.out, `${o.name}-${slot}`);
  const opts = (extra) => ({ theme, k, colors, ...extra });
  await writeFile(`${file}.svg`, render(data, opts({ fontCss: bodyFont + displayFont })));
  if (png) await writeFile(`${file}.png`, exporter.toPng(render(data, opts({ t: 1 }))));
  if (gif) await writeFile(`${file}.gif`, exporter.toGif((t) => render(data, opts({ t }))));
  for (const link of k.links) {
    const slug = link.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await mkdir(join(o.out, "buttons"), { recursive: true });
    await writeFile(join(o.out, "buttons", `${slug}-${slot}.svg`), renderButton(link, { theme, fontCss: displayFont, colors }));
  }
  console.log(`wrote ${file}.svg${png ? " .png" : ""}${gif ? " .gif" : ""}`);
}
console.log(`rank ${data.rank.level} (top ${data.rank.percentile.toFixed(1)}%), streak ${data.streak.current.length}${k.streak.mode === "weekly" ? "w" : "d"}, ${data.stats.commits} commits`);
