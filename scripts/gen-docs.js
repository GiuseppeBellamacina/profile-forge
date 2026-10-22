#!/usr/bin/env node
// Regenerates every image used by GUIDE.md (docs/guide/*.png and a few animated *.svg), the preset previews (docs/presets/*.png)
// and the theme previews (docs/themes/*.png).
// Uses deterministic demo data (scripts/demo.js): no token, no network. Needs `npm install`.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FRAMES } from "../src/frames.js";
import { SECRETS, SECRET_GROUPS } from "../src/secrets.js";
import { THEME_NAMES } from "../src/themes.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const demo = join(root, "scripts", "demo.js");
const tmp = mkdtempSync(join(tmpdir(), "pf-"));
const THEMES = { dark: "catppuccin-mocha", light: "catppuccin-latte" };

// name -> config (merged over { themes, layout: <the section shown> }). `light: true` also renders the light slot.
const only = (...layout) => ({ layout });
const RING = ["--crop", "600,0,400,185"]; // the rank indicator only
const AVATAR = ["--crop", "0,0,400,185"]; // the avatar and its frame only
const CASES = {
  // levels, rank shapes and the top 1% (rank-top and the *-top cases are also written as animated svg)
  ...Object.fromEntries(["E", "D", "C", "B", "A", "S"].map((l) => [`rank-${l}`, { ...only("header"), args: ["--rank", l, ...RING] }])),
  "rank-plus": { ...only("header"), args: ["--rank", "B+", ...RING] },
  "rank-minus": { ...only("header"), args: ["--rank", "B-", ...RING] },
  "rank-top": { ...only("header"), args: ["--rank", "SSS", ...RING] },
  "rank-top-animated": { ...only("header"), args: ["--rank", "SSS", ...RING], svg: true },
  "rank-s-animated": { ...only("header"), args: ["--rank", "S", ...RING], svg: true },
  "rank-x": { ...only("header"), args: ["--rank", "X", ...RING] },
  "rank-x-animated": { ...only("header"), args: ["--rank", "X", ...RING], svg: true },
  "rank-rainbow-animated": { ...only("header"), header: { rankEffect: "rainbow" }, args: ["--rank", "A", ...RING], svg: true },
  "rank-hexagon": { ...only("header"), header: { rankStyle: "hexagon" }, args: ["--rank", "A", ...RING] },
  "rank-shield": { ...only("header"), header: { rankStyle: "shield" }, args: ["--rank", "A", ...RING] },
  "rank-thick": { ...only("header"), header: { rankThickness: 14 }, args: ["--rank", "B", ...RING] },
  "rank-colors": { ...only("header"), colors: { levelB: "ff4d6d" }, args: ["--rank", "B", ...RING] },
  "header-top": { ...only("header"), args: ["--top"] },
  "header-top-animated": { ...only("header"), args: ["--top"], svg: true },
  // trophies
  "trophies-levels": { ...only("trophies"), args: ["--levels"] },
  "trophies-parts": { ...only("trophies"), trophies: { parts: ["title", "bar"], columns: 4 }, args: ["--levels"] },
  "trophies-left": { ...only("trophies"), trophies: { align: "left", columns: 5, padding: 36 }, args: ["--levels"] },
  "trophies-top": { ...only("trophies"), args: ["--top"] },
  "trophies-top-animated": { ...only("trophies"), args: ["--top"], svg: true },
  // avatar frames (all of them as images, a few also as animated svg)
  ...Object.fromEntries(FRAMES.filter((f) => f !== "none").map((f) => [`frame-${f}`, { ...only("header"), header: { frame: f }, args: ["--rank", f === "auto" ? "S" : "A", ...AVATAR] }])),
  "frame-rounded": { ...only("header"), header: { frame: "neon", avatar: "rounded" }, args: ["--rank", "A", ...AVATAR] },
  "frame-auto-top": { ...only("header"), header: { frame: "auto" }, args: ["--rank", "X"] },
  ...Object.fromEntries(["neon", "flames", "stars", "aurora", "glitch", "orbit", "prism"].map((f) => [`frame-${f}-animated`, { ...only("header"), header: { frame: f }, args: ["--rank", { aurora: "SSS" }[f] ?? "A", ...AVATAR], svg: true }])),
  "frame-color": { ...only("header"), header: { frame: "double" }, colors: { frameColor: "00e5a0" }, args: ["--rank", "A", ...AVATAR] },
  // heatmap shapes and the snake
  ...Object.fromEntries(["triangle", "snowflake", "moon", "mixed"].map((s) => [`heatmap-${s}`, { ...only("heatmap"), heatmap: { cell: s } }])),
  "heatmap-snake-animated": { ...only("heatmap"), heatmap: { mode: "snake" }, svg: true },
  "heatmap-snake-spiral-animated": { ...only("heatmap"), heatmap: { mode: "snake", snakePath: "spiral" }, svg: true },
  "heatmap-snake-rainbow-animated": { ...only("heatmap"), heatmap: { mode: "snake", snakeStyle: "rainbow", snakeLength: 9 }, svg: true },
  "heatmap-snake-glow-animated": { ...only("heatmap"), heatmap: { mode: "snake", snakeStyle: "glow", cell: "round" }, svg: true },
  "terminal-animated": { ...only("terminal"), terminal: { lines: ["$ whoami", "Ada Demo, AI engineer", "$ cat focus.txt", "LLM systems · retrieval · evaluation", "$ git log --oneline | wc -l", "4691"] }, svg: true },
  rhythm: only("rhythm"),
  "heatmap-snake-moon-animated": { ...only("heatmap"), heatmap: { mode: "snake", cell: "moon", snakePath: "busy" }, colors: { snakeColor: "ffd23f" }, svg: true },
  // layout / card
  "layout-default": { layout: ["header", ["stats", "streak"], "languages", "heatmap"] },
  "layout-pairs": only("header", ["languages", "streak"], "stats", "heatmap"),
  "layout-hide": { hideSections: ["trophies", "rank"], layout: ["header", ["stats", "streak"], "heatmap"] },
  "card-radius-0": { ...only("header"), card: { radius: 0 } },
  "card-radius-40": { ...only("header"), card: { radius: 40 } },
  "card-hide-border": { ...only("header"), card: { hideBorder: true } },
  "bg-gradient": { ...only("header"), card: { background: { gradient: "35,4158d0,c850c0,ffcc70", glow: false } } },
  "bg-dots": { ...only("header"), card: { background: { pattern: "dots" } } },
  "bg-grid": { ...only("header"), card: { background: { pattern: "grid" } } },
  "bg-diagonal": { ...only("header"), card: { background: { pattern: "diagonal" } } },
  "bg-no-glow": { ...only("header"), card: { background: { glow: false } } },
  // header
  "header-circle": only("header"),
  "header-rounded": { ...only("header"), header: { avatar: "rounded" } },
  "header-no-avatar": { ...only("header"), header: { avatar: "hide" } },
  "header-facts": { ...only("header"), header: { facts: ["currentStreak", "longestStreak", "stars", "followers"] } },
  "rank-level": only("header"),
  "rank-percentile": { ...only("header"), header: { rankIcon: "percentile" } },
  "rank-github": { ...only("header"), header: { rankIcon: "github" } },
  "rank-hidden": { ...only("header"), hideSections: ["rank"] },
  // stats
  "stats-default": only("stats"),
  "stats-hide-show": { ...only("stats"), stats: { hide: ["issues", "contributed"], show: ["prsMerged", "prsMergedPercentage", "discussionsStarted", "discussionsAnswered"] } },
  "stats-short": { ...only("stats"), stats: { numberFormat: "short", numberPrecision: 1 } },
  "stats-plain": { ...only("stats"), stats: { icons: false, textBold: false, lineHeight: 36, title: "My numbers" } },
  // streak
  "streak-default": only("streak"),
  "streak-weekly": { ...only("streak"), streak: { mode: "weekly" } },
  "streak-exclude": { ...only("streak"), streak: { excludeDays: ["Sat", "Sun"], excludeDaysLabel: true } },
  "streak-hide": { ...only("streak"), streak: { hide: ["total"], dateFormat: "j M[ Y]", title: "Streaks" } },
  "streak-short": { ...only("streak"), streak: { shortNumbers: true, startingYear: 2020 } },
  // languages
  "lang-bar": only("languages"),
  "lang-compact": { ...only("languages"), languages: { layout: "compact" } },
  "lang-donut": { ...only("languages"), languages: { layout: "donut" } },
  "lang-donut-vertical": { ...only("languages"), languages: { layout: "donut-vertical" } },
  "lang-pie": { ...only("languages"), languages: { layout: "pie" } },
  "lang-bytes": { ...only("languages"), languages: { layout: "bar", statsFormat: "bytes", count: 5 } },
  "lang-hide": { ...only("languages"), languages: { hide: ["HTML", "CSS", "Jupyter Notebook"], hideProgress: true, title: "Stack" } },
  "lang-weights": { ...only("languages"), languages: { sizeWeight: 0.5, countWeight: 1 } },
  // trophies
  "trophies-default": only("trophies"),
  "trophies-grid": { ...only("trophies"), trophies: { columns: 4, rows: 2, marginW: 16, marginH: 16 } },
  "trophies-extra": { ...only("trophies"), trophies: { extra: ["Issues", "Reviews"], ranks: ["-E"], columns: 4 } },
  "trophies-filter": { ...only("trophies"), trophies: { titles: ["Star", "Commit", "PR", "Followers"], title: "Highlights" } },
  "trophies-secret": { ...only("trophies"), trophies: { ranks: ["SECRET"], columns: 6 }, args: ["--secrets", "7,12"] },
  "trophies-secret-all": { ...only("trophies"), trophies: { ranks: ["SECRET"], columns: 10, marginW: 10, marginH: 10, padding: 16 }, args: ["--secrets", "all"] },
  // one picture per group of secret trophies (the trophy guide)
  ...Object.fromEntries(SECRET_GROUPS.map(([, first], g) => {
    const from = SECRETS.findIndex((d) => d.title === first);
    const to = g + 1 < SECRET_GROUPS.length ? SECRETS.findIndex((d) => d.title === SECRET_GROUPS[g + 1][1]) : SECRETS.length;
    return [`trophies-secret-${g + 1}`, { ...only("trophies"), trophies: { ranks: ["SECRET"], columns: Math.min(6, to - from), marginW: 12 }, args: ["--secrets", `${from},${to - from}`] }];
  })),
  "trophies-clean": { ...only("trophies"), trophies: { noBg: true, noFrame: true, columns: 6 } },
  // heatmap
  "heatmap-square": only("heatmap"),
  "heatmap-round": { ...only("heatmap"), heatmap: { cell: "round", weekStart: "mon" } },
  "heatmap-hexagon": { ...only("heatmap"), heatmap: { cell: "hexagon" } },
  "heatmap-snake-hexagon-animated": { ...only("heatmap"), heatmap: { mode: "snake", cell: "hexagon", snakeStyle: "glow" }, svg: true },
  "heatmap-compact": { ...only("heatmap"), heatmap: { weeks: 26, legend: false, monthLabels: false } },
  // locale
  "locale-it": { locale: "it", ...only("header", ["stats", "streak"]) },
  "locale-ja": { locale: "ja", ...only("header", ["stats", "streak"]) },
  // colors
  "colors-override": { ...only("header", ["stats", "streak"]), colors: { icon_color: "ff4d5e", ring_color: "ff8a5c", fire_color: "ffd166", title_color: "ffffff" } },
  "colors-panels": { ...only("header", ["stats", "streak"]), colors: { bg_color: "10002b", panel_color: "240046", border_color: "5a189a", text_color: "e0aaff", muted_color: "c77dff", icon_color: "ff9e00" } },
  "colors-gradient": { ...only("header", ["stats", "streak"]), colors: { bg_gradient: "120,0f2027,203a43,2c5364", icon_color: "7df9ff" } },
  "colors-by-theme": { themes: { dark: "dark", light: "light" }, colorsByTheme: { dark: { icon_color: "ff6b9a" }, light: { icon_color: "d6336c" } }, ...only("header", ["stats", "streak"]), light: true },
  "custom-theme": {
    themes: { dark: "ocean-ember", light: "ocean-ember-light" },
    customThemes: {
      "ocean-ember": { base: "ocean", icon_color: "ff9f1c", ring_color: "ff4d5e", fire_color: "ffd166" },
      "ocean-ember-light": { base: "light", bg_color: "f4fbff", panel_color: "e6f4fb", border_color: "bcd9e8", text_color: "0b2a3a", muted_color: "4d6f82", icon_color: "e07a00", ring_color: "d6293e", fire_color: "c2410c" },
    },
    ...only("header", ["stats", "streak"]),
    light: true,
  },
  // content
  "content-about": {
    title: "Full-stack engineer",
    about: ["I build developer tools and data pipelines. Most of my time goes into **Python** and **Rust**.", "Currently learning compilers; always up for a good code review."],
    workingOn: [
      { title: "forge-api", description: "Fast, typed REST layer", url: "https://example.com/forge-api" },
      { title: "fast-core", description: "A tiny Rust runtime", url: "https://example.com/fast-core" },
    ],
    ...only("header", "about", "workingOn"),
  },
  "content-stack": {
    techStack: [
      { category: "Languages", items: ["python", "javascript"].map((n) => ({ name: n, image: `assets/img/${n}.svg` })) },
      { category: "Data & ML", items: ["numpy", "pandas", "pytorch"].map((n) => ({ name: n, image: `assets/img/${n}.svg` })) },
      { category: "Tooling", items: ["git", "docker", "linux", "fastapi"].map((n) => ({ name: n, image: `assets/img/${n}.svg` })) },
    ],
    ...only("techStack"),
  },
};

const render = (config, out, extra = []) => {
  const f = join(tmp, "config.json");
  writeFileSync(f, JSON.stringify(config));
  execFileSync("node", [demo, f, out, ...extra], { stdio: "inherit" });
};

mkdirSync(join(root, "docs", "guide"), { recursive: true });
mkdirSync(join(root, "docs", "presets"), { recursive: true });
const wanted = process.argv.slice(2);
for (const [name, c] of Object.entries(CASES)) {
  if (wanted.length && !wanted.includes(name)) continue;
  const { light, args = [], svg, ...cfg } = c;
  const extra = [...args, ...(svg ? ["--svg"] : [])];
  // techStack images live next to the presets: render from there so relative paths resolve.
  const cwdConfig = { themes: THEMES, ...cfg };
  if (cfg.techStack) {
    const f = join(root, "presets", ".guide-tmp.json");
    writeFileSync(f, JSON.stringify(cwdConfig));
    execFileSync("node", [demo, f, join(root, "docs", "guide", name), ...(light ? [] : ["--slot", "dark"]), ...extra], { stdio: "inherit" });
    rmSync(f, { force: true });
  } else if (light) render(cwdConfig, join(root, "docs", "guide", name), extra);
  else render(cwdConfig, join(root, "docs", "guide", name), ["--slot", "dark", ...extra]);
}

for (const file of readdirSync(join(root, "presets")).filter((f) => f.endsWith(".json"))) {
  const name = file.replace(/\.json$/, "");
  if (wanted.length && !wanted.includes(name)) continue;
  execFileSync("node", [demo, join(root, "presets", file), join(root, "docs", "presets", name)], { stdio: "inherit" });
}

if (!wanted.length || wanted.includes("trophy-guide")) execFileSync("node", [join(root, "scripts", "gen-trophy-guide.js")], { stdio: "inherit" });

// one small preview of the default card per built-in theme (docs/themes, shown by the README and the configurator's fallback)
mkdirSync(join(root, "docs", "themes"), { recursive: true });
for (const theme of THEME_NAMES()) {
  if (wanted.length && !wanted.includes("themes") && !wanted.includes(theme)) continue;
  render({ themes: { dark: theme } }, join(root, "docs", "themes", theme), ["--slot", "dark", "--scale", "0.5"]);
}
