import assert from "node:assert/strict";
import test from "node:test";
import { render, renderButton } from "../src/render.js";
import { normalize, setPath } from "../src/config.js";
import { parseColors, THEME_NAMES } from "../src/themes.js";
import { calculateRank, computeStreak, summarize, topLanguages, trophies } from "../src/stats.js";

test("rank: zero activity is E, heavy activity is the top 1% level", () => {
  assert.equal(calculateRank({ commits: 0, prs: 0, issues: 0, reviews: 0, stars: 0, followers: 0 }).level, "E");
  const top = calculateRank({ commits: 20000, prs: 2000, issues: 1000, reviews: 500, stars: 100000, followers: 10000 });
  assert.equal(top.level, "S+");
  assert.ok(top.percentile < 1);
});

test("streak: today with 0 keeps the streak, a past gap breaks it", () => {
  const s = computeStreak([["2026-01-01", 2], ["2026-01-02", 0], ["2026-01-03", 1], ["2026-01-04", 3], ["2026-01-05", 0]]);
  assert.equal(s.total, 6);
  assert.deepEqual(s.current, { length: 2, start: "2026-01-03", end: "2026-01-04" });
  assert.equal(s.longest.length, 2);
  assert.equal(s.first, "2026-01-01");
  assert.equal(computeStreak([["2026-01-01", 1], ["2026-01-02", 0], ["2026-01-03", 0]]).current.length, 0);
});

test("languages: forks and hidden ignored, count weight ranks by repo count", () => {
  const repos = [
    { isFork: false, languages: [{ name: "Python", color: "#3572A5", size: 10 }, { name: "Shell", size: 5 }] },
    { isFork: false, languages: [{ name: "Python", size: 10 }] },
    { isFork: false, languages: [{ name: "C", size: 1000 }] },
    { isFork: true, languages: [{ name: "Go", size: 99999 }] },
  ];
  const bySize = topLanguages(repos, { hide: ["shell"] });
  assert.deepEqual(bySize.top.map((l) => l.name), ["C", "Python"]);
  const byCount = topLanguages(repos, { sizeWeight: 0, countWeight: 1 });
  assert.equal(byCount.top[0].name, "Python");
  assert.equal(byCount.top[0].count, 2);
  assert.equal(Math.round(byCount.top.reduce((s, l) => s + l.percent, 0)), 100);
});

test("trophies: tiers and secret trophies", () => {
  const t = trophies({ stars: 227, commits: 5000, followers: 0, issues: 1, prs: 27, repos: 59, reviews: 0, experience: 16, years: 4, organizations: 3, languageCount: 12, firstYear: 2022 });
  const rank = Object.fromEntries(t.map((x) => [x.title, x.rank]));
  assert.equal(rank.Stars, "A");
  assert.equal(rank.Commits, "S+");
  assert.equal(rank.Followers, "?");
  assert.equal(rank.Issues, undefined);
  assert.equal(rank.PullRequest, "C");
  assert.equal(rank.Experience, "C");
  assert.ok(rank.MultiLanguage && rank.Organizations);
  assert.ok(!rank.LongTimeUser);
});

const DAYS = Array.from({ length: 400 }, (_, i) => [new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), i % 3]);
const RAW = {
  name: "Ada <Lovelace>", login: "ada", avatar: "data:image/png;base64,", createdAt: "2020-05-01T00:00:00Z", earliest: "2020-05-01T00:00:00Z",
  followers: 5, organizations: 0, prs: 3, issues: 2, contributedTo: 1, repoCount: 4, stars: 12, commits: 3000, reviews: 1,
  commitsByYear: { 2025: 120 }, mergedPrs: 2, discussionsStarted: 1, discussionsAnswered: 4,
  repos: [
    { name: "a", stars: 10, isFork: false, languages: [{ name: "Rust", color: "#dea584", size: 100 }, { name: "Go", color: "#00add8", size: 50 }] },
    { name: "b", stars: 2, isFork: false, languages: [{ name: "Python", color: "#3572a5", size: 30 }] },
  ],
  days: DAYS,
};
const make = (cfg = {}) => {
  const k = normalize(cfg);
  return [summarize(RAW, k), k];
};

test("render: static frame has no CSS animation and nothing hidden; animated has keyframes", () => {
  const [d, k] = make({ about: ["Hello **world**"], workingOn: [{ title: "Thing", url: "https://x.dev" }] });
  k.stack = Array.from({ length: 30 }, (_, n) => ({ name: `T${n}`, id: `i${n}`, data: "data:image/png;base64," }));
  const still = render(d, { theme: "light", t: 1, k });
  assert.ok(still.includes("Hello world") && still.includes("WORKING ON") && still.includes("TECH STACK"));
  assert.ok(!still.includes("#row0"), "static carousel inlines visible tiles only");
  assert.ok(!still.includes("@keyframes") && !still.includes("animation"));
  assert.ok(!/ opacity="0"/.test(still));
  assert.ok(still.includes("Ada &#60;Lovelace&#62;"));
  const animated = render(d, { k });
  assert.ok(animated.includes("@keyframes m0") && animated.includes("#row1"));
  assert.ok(renderButton({ label: "LinkedIn", url: "u", icon: "linkedin" }).includes(">LinkedIn</text>"));
});

test("every theme renders; custom colors are validated", () => {
  const [d, k] = make();
  for (const theme of THEME_NAMES()) assert.ok(render(d, { theme, k }).includes("</svg>"), theme);
  assert.throws(() => render(d, { theme: "nope", k }), /Unknown theme/);
  const custom = render(d, { k, colors: parseColors("bg_color=ff0000,icon_color=#0f0,bg_gradient=45,f00,0f0f0f80") });
  assert.ok(custom.includes("#ff0000") && custom.includes("#0f0"));
  assert.throws(() => parseColors('bg_color=red"/>'), /Invalid hex/);
  assert.throws(() => parseColors("bogus=fff"), /Unknown color/);
  assert.ok(render(d, { theme: "crimson", k }).includes("#ff4d5e"));
  assert.ok(render(d, { theme: "ambient-gradient", k }).includes('gradientTransform="rotate(-55'));
});

test("config: defaults, validation, precedence helpers", () => {
  const k = normalize();
  assert.deepEqual(k.slots, [["dark", "dark"], ["light", "light"]]);
  assert.deepEqual(normalize({ themes: { dark: "dracula", light: "nord" } }).slots, [["dark", "dracula"], ["light", "nord"]]);
  assert.throws(() => normalize({ stats: { nope: 1 } }), /Unknown config key "stats.nope"/);
  assert.throws(() => normalize({ themes: ["nope"] }), /unknown theme/);
  assert.throws(() => normalize({ languages: { layout: "cube" } }), /one of: bar/);
  assert.throws(() => normalize({ languages: { count: 99 } }), /between 1 and 20/);
  assert.throws(() => normalize({ layout: [["stats", "streak", "heatmap"]] }), /at most 2/);
  assert.throws(() => normalize({ locale: "xx" }), /Unknown locale/);
  // CLI-style string overrides are coerced by the schema type
  const c = normalize(setPath(setPath({}, "stats.numberPrecision", "1"), "card.hideBorder", "true"));
  assert.equal(c.stats.numberPrecision, 1);
  assert.equal(c.card.hideBorder, true);
  assert.deepEqual([...normalize({ stats: { hide: "stars, Issues" } }).stats.hide], ["stars", "issues"]);
  // legacy profile.json content keys still work
  assert.equal(normalize({ title: "Dev", about: ["x"] }).title, "Dev");
  // custom themes
  const custom = normalize({ customThemes: { mine: { base: "dark", icon_color: "ff00aa" } }, themes: ["mine"] });
  assert.ok(render(summarize(RAW, custom), { theme: "mine", k: custom }).includes("#ff00aa"));
});

test("layout: reorder, hide, and two half-width panels share a row", () => {
  const [d, k] = make({ layout: ["header", "trophies", ["languages", "stats"], "heatmap"], languages: { layout: "donut" } });
  const svg = render(d, { k });
  assert.ok(svg.indexOf("TROPHIES") < svg.indexOf("TOP LANGUAGES") && svg.indexOf("TOP LANGUAGES") < svg.indexOf(">STATS<"));
  assert.ok(!svg.includes(">STREAK<"));
  const [d2, k2] = make({ hideSections: ["stats", "streak", "rank", "heatmap", "trophies", "languages"] });
  const slim = render(d2, { k: k2 });
  assert.ok(!slim.includes(">STATS<") && !slim.includes(">RANK<") && !slim.includes("CONTRIBUTIONS") && !slim.includes("TROPHIES"));
  const [d3, k3] = make({ layout: ["header", ["streak", "stats"]] });
  const flipped = render(d3, { k: k3 });
  assert.ok(flipped.indexOf(">STREAK<") < flipped.indexOf(">STATS<"));
});

test("stats options: extras, hide, short numbers, commitsYear, excludeRepos", () => {
  const [d, k] = make({
    stats: { show: ["prsMerged", "discussions_started", "prs_merged_percentage"], hide: ["issues"], numberFormat: "short", numberPrecision: 2, title: "MINE", commitsYear: 2025, excludeRepos: ["a"] },
  });
  assert.equal(d.stats.commits, 120);
  assert.equal(d.stats.stars, 2);
  const svg = render(d, { k });
  assert.ok(svg.includes("PRs Merged") && svg.includes("Discussions Started") && svg.includes("66.7%") && svg.includes("MINE"));
  assert.ok(!svg.includes(">Issues<") && svg.includes(">120<"));
  assert.ok(render(d, { k: normalize({ stats: { icons: false, textBold: false, lineHeight: 24 } }) }).includes("Total Stars"));
});

test("languages: layouts, count, exclude, bytes", () => {
  for (const layout of ["bar", "compact", "donut", "donut-vertical", "pie"]) {
    const [d, k] = make({ languages: { layout } });
    assert.ok(render(d, { k }).includes("Rust"), layout);
  }
  const [d, k] = make({ languages: { count: 2, statsFormat: "bytes", excludeRepos: ["b"] } });
  assert.equal(d.languages.top.length, 2);
  assert.ok(!d.languages.top.some((l) => l.name === "Python"));
  assert.ok(render(d, { k }).includes("kB"));
  const [d2, k2] = make({ languages: { hideProgress: true } });
  assert.ok(!render(d2, { k: k2 }).includes('id="bar"'));
});

test("streak options: weekly mode, hide, date format, exclude days, short numbers", () => {
  const wk = [["2026-01-03", 1], ["2026-01-04", 0], ["2026-01-05", 1]]; // Sat, Sun, Mon
  assert.equal(computeStreak(wk).longest.length, 1);
  assert.equal(computeStreak(wk, new Set([0])).longest.length, 2);
  // weekly: Sun-Sat weeks with any contribution; an empty week breaks it, the running week doesn't
  const weekly = [["2026-01-04", 1], ["2026-01-11", 0], ["2026-01-18", 1], ["2026-01-25", 1], ["2026-02-01", 0]];
  const w = computeStreak(weekly, new Set(), "weekly");
  assert.equal(w.longest.length, 2);
  assert.equal(w.current.length, 2);
  const [d, k] = make({ streak: { hide: ["total"], dateFormat: "d/m/Y", excludeDays: ["Sat", "Sun"], shortNumbers: true, mode: "weekly" } });
  const svg = render(d, { k });
  assert.ok(!svg.includes("Total Contributions") && svg.includes("Longest Streak") && svg.includes("Excluding"));
  assert.ok(/\d\d\/\d\d\/\d{4}/.test(svg) && svg.includes("weeks"));
});

test("trophies: filters, grid, extras, secrets", () => {
  const list = trophies({ stars: 300, commits: 5000, followers: 0, issues: 60, prs: 0, repos: 1, reviews: 9, experience: 3, years: 15, organizations: 0, languageCount: 0, firstYear: 2008 }, new Set(["issues", "reviews"]));
  const titles = list.map((t) => t.title);
  assert.ok(titles.includes("Issues") && titles.includes("Reviews") && titles.includes("AncientUser") && titles.includes("OGUser"));
  assert.ok(!trophies({ stars: 1, commits: 1, followers: 1, issues: 1, prs: 1, repos: 1, reviews: 1, experience: 3, years: 1, organizations: 0, languageCount: 0, firstYear: 2020 }).some((t) => t.title === "Issues"));
  const [d] = make();
  const only = render(d, { k: normalize({ trophies: { titles: ["star", "commit"], marginW: 4, noBg: true, noFrame: true } }) });
  assert.equal((only.match(/rx="4.5"/g) ?? []).length, 2);
  assert.ok(only.includes('fill="none" stroke="none"'));
  assert.ok(!render(d, { k: normalize({ trophies: { hideTitles: ["PR"], ranks: ["-C"] } }) }).includes(">PullRequest<"));
  assert.throws(() => normalize({ trophies: { ranks: ["nope"] } }), /unknown rank "nope"/);
  assert.throws(() => normalize({ trophies: { ranks: ["SSS"] } }), /no longer exists.*use "S\+"/);
  assert.throws(() => normalize({ trophies: { hideRanks: ["AAA"] } }), /no longer exists/);
  assert.ok(!render(d, { k: normalize({ trophies: { ranks: ["Z"].filter(() => false) } }) }).includes("undefined"));
  assert.ok(render(d, { k: normalize({ trophies: { columns: 2, rows: 2 } }) }).includes("TROPHIES"));
});

test("header, heatmap, background and locale options", () => {
  const [d] = make();
  const k = normalize({
    locale: "it", header: { avatar: "hide", facts: ["topLanguage", "stars"], rankIcon: "github" },
    heatmap: { weeks: 20, cell: "round", weekStart: "mon", legend: false, monthLabels: false },
    card: { radius: 6, hideBorder: true, animations: false, background: { gradient: "90,000,fff", pattern: "dots", glow: false } },
  });
  const svg = render(d, { k });
  assert.ok(!svg.includes("<image") && svg.includes("Linguaggio top: Rust") && svg.includes("CONTRIBUZIONI"));
  assert.ok(svg.includes('id="pat"') && svg.includes('rx="6"') && !svg.includes("@keyframes") && !svg.includes('fill="url(#glow)"'));
  assert.ok(!svg.includes("Less") && !svg.includes("Meno"));
  assert.ok(render(d, { k: normalize({ header: { avatar: "rounded", rankIcon: "percentile" } }) }).includes("rank "));
  assert.throws(() => normalize({ header: { facts: ["a"] } }), /unknown fact/);
});

test("examples/config.json is valid", async () => {
  const { readFile } = await import("node:fs/promises");
  const k = normalize(JSON.parse(await readFile(new URL("../examples/config.json", import.meta.url), "utf8")));
  assert.equal(k.slots.length, 2);
  const schema = JSON.parse(await readFile(new URL("../config.schema.json", import.meta.url), "utf8"));
  // every top-level config key is described by the schema
  const { DEFAULTS } = await import("../src/config.js");
  for (const key of Object.keys(DEFAULTS)) assert.ok(key in schema.properties, `schema is missing "${key}"`);
});

test("layout: any two content sections can share a row at half width", () => {
  const height = (layout) => {
    const [d, k] = make({ about: ["Hello there"], layout });
    return Number(/viewBox="0 0 1000 ([\d.]+)"/.exec(render(d, { k, t: 1 }))[1]);
  };
  assert.ok(height([["about", "trophies"]]) < height(["about", "trophies"]), "paired rows make the card shorter than stacked ones");
  assert.ok(height([["heatmap", "languages"]]) < height(["heatmap", "languages"]));
  assert.equal(height([["about", "workingOn"]]), height(["about"]), "an empty partner leaves the other at full width");
});

test("grid: sections fall to the lowest free spot, widths are clamped, mistakes are named", () => {
  const height = (grid) => {
    const [d, k] = make({ grid });
    return Number(/viewBox="0 0 1000 ([\d.]+)"/.exec(render(d, { k, t: 1 }))[1]);
  };
  const tall = [{ section: "header" }, { section: "stats", cols: 3 }, { section: "trophies", cols: 3 }, { section: "heatmap", cols: 3 }];
  // heatmap fits under the short stats card instead of below the tall trophies card
  assert.ok(height(tall) < height([{ section: "header" }, { section: "stats", cols: 6 }, { section: "trophies", cols: 6 }, { section: "heatmap", cols: 6 }]));
  assert.equal(normalize({ grid: [{ section: "stats", cols: 1 }, { section: "header", cols: 2 }] }).grid.map((g) => g.span).join(), "3,6", "narrow widths are raised to the section minimum");
  assert.throws(() => normalize({ grid: [{ section: "stats" }, { section: "stats" }] }), /appears twice/);
  assert.throws(() => normalize({ grid: [{ section: "stats", cols: 9 }] }), /cols/);
  assert.throws(() => normalize({ grid: [{ section: "nope" }] }), /unknown section/);
  assert.equal(normalize({}).grid, null);
});

test("sectionBoxes: reports where sections land, matching the grid packing", async () => {
  const { sectionBoxes } = await import("../src/render.js");
  const [d, k] = make({ grid: [{ section: "header" }, { section: "stats", cols: 3 }, { section: "trophies", cols: 3 }, { section: "heatmap", cols: 3 }] });
  const { height, boxes } = sectionBoxes(d, { k });
  const by = Object.fromEntries(boxes.map((b) => [b.id, b]));
  assert.deepEqual([by.stats.x, by.stats.w, by.trophies.x, by.trophies.w], [30, 460, 510, 460]);
  assert.equal(by.heatmap.x, 30, "heatmap falls under the short stats card");
  assert.ok(by.heatmap.y < by.trophies.y + by.trophies.h);
  assert.equal(height, Math.max(...boxes.map((b) => b.y + b.h)) + 54, "card height = lowest edge + gutter + bottom margin");
});

test("grid: height makes a card taller, never shorter than its content", async () => {
  const { sectionBoxes } = await import("../src/render.js");
  const boxes = (grid) => {
    const [d, k] = make({ grid });
    return Object.fromEntries(sectionBoxes(d, { k }).boxes.map((b) => [b.id, b]));
  };
  const auto = boxes([{ section: "stats", cols: 3 }, { section: "streak", cols: 3 }]);
  const tall = boxes([{ section: "stats", cols: 3, height: auto.stats.minH + 100 }, { section: "streak", cols: 3 }]);
  assert.equal(tall.stats.h, auto.stats.h + 100);
  assert.equal(tall.stats.minH, auto.stats.minH);
  assert.equal(boxes([{ section: "stats", cols: 3, height: 10 }]).stats.h, auto.stats.minH, "too short is raised to the content height");
  assert.throws(() => normalize({ grid: [{ section: "stats", height: -5 }] }), /height/);
});

test("heatmap: grid is plain, snake adds an animated snake that eats the contributions", () => {
  const [d, k] = make({ layout: ["heatmap"] });
  const plain = render(d, { k });
  assert.ok(!plain.includes("snkclip") && !plain.includes("@keyframes sn0"));
  const [d2, k2] = make({ layout: ["heatmap"], heatmap: { mode: "snake" } });
  const snake = render(d2, { k: k2 });
  assert.ok(snake.includes("@keyframes sn{") && snake.includes('id="snkclip"'));
  assert.ok(/@keyframes ce\d+_\d+/.test(snake), "every eaten cell has a cover that appears when the head passes");
  const still = render(d2, { k: k2, t: 1 });
  assert.ok(!still.includes("@keyframes") && still.includes('rx="3" fill'), "static frames keep the snake waiting at the start, no CSS");
  assert.throws(() => normalize({ heatmap: { mode: "worm" } }), /heatmap\.mode/);
});

test("heatmap shapes: each kind draws its own element, mixed is stable, the snake takes its colour from the theme", () => {
  const svg = (heatmap, colors) => {
    const [d, k] = make({ layout: ["heatmap"], heatmap, ...(colors && { colors }) });
    return render(d, { k, t: 1 });
  };
  assert.ok(svg({ cell: "triangle" }).includes("<polygon"));
  assert.ok(svg({ cell: "snowflake" }).includes('stroke-linecap="round"'));
  assert.ok(svg({ cell: "moon" }).includes("<circle") && svg({ cell: "moon" }).includes("A"));
  const mixed = svg({ cell: "mixed" });
  assert.ok(mixed.includes("<polygon") && mixed.includes('rx="3"') && mixed.includes('rx="6.75"'), "square, round and triangle all appear");
  assert.equal(mixed, svg({ cell: "mixed" }), "the same grid always gets the same mix");
  assert.ok(svg({ mode: "snake" }, { snakeColor: "ff8a3d" }).includes('fill="#ff8a3d"'));
  assert.throws(() => normalize({ heatmap: { cell: "star" } }), /heatmap\.cell/);
  assert.throws(() => normalize({ heatmap: { snakePath: "zigzag" } }), /heatmap\.snakePath/);
});

test("snake triangles hop from cell to cell, up or down like the grid cell they sit on; other shapes slide", () => {
  const snake = (cell) => {
    const [d, k] = make({ layout: ["heatmap"], heatmap: { mode: "snake", cell } });
    return render(d, { k });
  };
  assert.ok(/rotate\(180deg\);animation-timing-function:step-end/.test(snake("triangle")) && /rotate\(0deg\)/.test(snake("triangle")));
  assert.ok(!/rotate\(/.test(snake("round")));
});

test("snake: eaten days fade out over their empty-day look instead of being covered", () => {
  const [d, k] = make({ layout: ["heatmap"], heatmap: { mode: "snake", cell: "snowflake" } });
  const svg = render(d, { k });
  assert.ok(/<path[^>]*style="animation:ce\d+_\d+ /.test(svg), "the coloured day itself fades");
  assert.ok(!/opacity="0" style="animation:ce/.test(svg), "no cover shapes are drawn over the days");
});

test("margins: room under the last card, and the first card never sits on the border without a header", async () => {
  const { sectionBoxes } = await import("../src/render.js");
  const boxes = (layout) => { const [d, k] = make({ layout }); return sectionBoxes(d, { k }); };
  const withHeader = boxes(["header", "stats"]);
  const without = boxes(["stats", "streak"]);
  assert.equal(withHeader.boxes[0].y, 0, "the header keeps its own padding");
  assert.equal(without.boxes[0].y, 30, "no header: the first card starts 30px down");
  const last = withHeader.boxes.at(-1);
  assert.equal(withHeader.height - (last.y + last.h), 54);
  const grid = (g) => { const [d, k] = make({ grid: g }); return sectionBoxes(d, { k }).boxes; };
  assert.equal(grid([{ section: "stats", cols: 3 }])[0].y, 30);
  assert.equal(grid([{ section: "header" }, { section: "stats", cols: 3 }])[0].y, 0);
});

test("levels: E D C B A S and the top 1% level, one scale for the header and the trophies", async () => {
  const { levelOfPercentile, ALL_LEVELS } = await import("../src/levels.js");
  assert.deepEqual(ALL_LEVELS, ["E", "D", "C", "B", "A", "S", "S+"]);
  const at = [0.5, 1, 1.01, 10, 10.01, 25, 25.5, 50, 60, 70, 80, 85, 99.9].map(levelOfPercentile);
  assert.deepEqual(at, ["S+", "S+", "S", "S", "A", "A", "B", "B", "C", "C", "D", "D", "E"]);
  // trophies: the 8 old thresholds fold into the 7 levels (the old second "A" threshold is dropped)
  const { trophies } = await import("../src/stats.js");
  const level = (stars) => trophies({ stars, commits: 0, followers: 0, issues: 0, prs: 0, repos: 0, reviews: 0, experience: 0, years: 0, organizations: 0, languageCount: 0, firstYear: 2023 }).find((t) => t.title === "Stars").rank;
  assert.deepEqual([2000, 700, 200, 100, 50, 30, 10, 1, 0].map(level), ["S+", "S", "A", "B", "C", "C", "D", "E", "?"]);
});

test("top 1% (S+) has looping effects on the ring and the trophies; other levels do not; static frames stay still", () => {
  const view = (level, t) => {
    const [d, k] = make({ layout: ["header", "trophies"] });
    d.rank = { level, percentile: level === "S+" ? 0.4 : 30 };
    if (level === "S+") for (const tr of d.trophies) if (tr.rank === "S") tr.rank = "S+";
    return render(d, { k, t });
  };
  const top = view("S+");
  assert.ok(/@keyframes lp\d+/.test(top) && top.includes('stroke-dasharray="7 93"'), "halo, running light and sparkles");
  assert.ok(top.includes("-shine"), "the trophies shimmer");
  assert.ok(!/@keyframes lp\d+/.test(view("A")), "a normal level has no loops");
  const still = view("S+", 1);
  assert.ok(!/@keyframes/.test(still) && still.includes('stroke-dashoffset="-12"'), "static frame: the same ring, held still");
});

test("trophies: the classic cup, more cups for higher levels, visible parts, padding and alignment", () => {
  const svg = (trophies, mutate) => { const [d, k] = make({ layout: ["trophies"], trophies }); mutate?.(d); return render(d, { k, t: 1 }); };
  const count = (s, re) => (s.match(re) ?? []).length;
  const cups = (rank) => count(svg({}, (d) => { d.trophies = [{ title: "Stars", rank, label: "x", score: 5, progress: 0.5 }]; }), /viewBox="0 0 30 30"/g);
  assert.deepEqual(["E", "B", "A", "S", "S+"].map(cups), [1, 1, 1, 2, 3], "S has two cups, the top 1% three");
  const laurel = (rank) => svg({}, (d) => { d.trophies = [{ title: "Stars", rank, label: "x", score: 5, progress: 0.5 }]; }).includes('viewBox="0 0 100 100"');
  assert.deepEqual(["E", "C", "A", "S", "S+"].map(laurel), [false, false, true, true, true], "the laurel starts at A");
  const bare = svg({ parts: ["title"] });
  assert.ok(bare.includes(">Stars<") && !bare.includes("Stargazer") && !bare.includes('height="3.2"'), "only the title is left");
  assert.equal(count(svg({ parts: [] }), /Stargazer|>Stars<|pt</g), 0, "just the cups");
  const left = svg({ align: "left", columns: 3, padding: 40 });
  assert.ok(left.includes('x="70"'), "left aligned cards start after the panel padding");
  assert.throws(() => normalize({ trophies: { parts: ["title", "shine"] } }), /trophies\.parts/);
});

test("avatar frames: every frame draws, auto follows the level, shapes and static frames work", async () => {
  const { FRAMES, AUTO_FRAME } = await import("../src/frames.js");
  const view = (header, level = "A", t, colors) => {
    const [d, k] = make({ layout: ["header"], header, ...(colors && { colors }) });
    d.rank = { level, percentile: 20 };
    return render(d, { k, t });
  };
  const plain = view({ frame: "none" });
  assert.ok(!view({ frame: "none" }).includes('stroke="url(#grad)" stroke-width="3"'), "none: no ring");
  assert.ok(view({}).includes('stroke="url(#grad)" stroke-width="3"'), "the classic gradient ring is the default");
  const seen = new Set();
  for (const frame of FRAMES.filter((f) => !["none", "ring", "auto"].includes(f))) {
    for (const avatar of ["circle", "rounded"]) {
      const svg = view({ frame, avatar });
      assert.ok(svg.length > plain.length, `${frame} (${avatar}) adds something`);
      assert.ok(!svg.includes("NaN"), `${frame} (${avatar}) has no NaN coordinates`);
    }
    seen.add(view({ frame }).length);
  }
  assert.ok(seen.size > 8, "the frames look different from each other");
  assert.deepEqual(Object.keys(AUTO_FRAME), ["E", "D", "C", "B", "A", "S", "S+"]);
  assert.equal(view({ frame: "auto" }, "E").length, plain.length, "E: no frame");
  assert.ok(view({ frame: "auto" }, "S+").includes("stroke-dasharray=\"30 22\""), "S+: the aurora");
  assert.ok(view({ frame: "flames" }, "A", undefined, { frameColor: "00ff88" }).includes("#00ff88"), "frameColor overrides the level colour");
  assert.ok(!/@keyframes lp/.test(view({ frame: "aurora" }, "S", 1)) && !/@keyframes lp/.test(view({ frame: "neon", frameAnimation: "none" }, "S")), "static frames and 'none' do not move");
  assert.throws(() => normalize({ header: { frame: "gold" } }), /header\.frame/);
  assert.throws(() => normalize({ header: { frameAnimation: "wobble" } }), /header\.frameAnimation/);
});

test("rank indicator: ring, hexagon or shield, with an adjustable thickness", () => {
  const svg = (header) => { const [d, k] = make({ layout: ["header"], header }); return render(d, { k, t: 1 }); };
  assert.ok(svg({}).includes('<circle cx="900" cy="90" r="50"') && svg({}).includes('stroke-width="8"'), "the ring is the default");
  const hex = svg({ rankStyle: "hexagon", rankThickness: 12 });
  assert.ok(/<path d="M[^"]*Z" fill="none" pathLength="100"/.test(hex) && hex.includes('stroke-width="12"') && !hex.includes('<circle cx="900" cy="90" r="50"'));
  assert.ok(svg({ rankStyle: "shield" }).includes("C"), "the shield is a path with curves");
  assert.throws(() => normalize({ header: { rankStyle: "star" } }), /header\.rankStyle/);
  assert.throws(() => normalize({ header: { rankThickness: 30 } }), /rankThickness/);
});

test("options that were removed are ignored, unknown ones are still rejected", () => {
  assert.doesNotThrow(() => normalize({ trophies: { style: "gem", padding: 24 } }));
  assert.equal(normalize({ trophies: { style: "gem", padding: 24 } }).trophies.padding, 24);
  assert.throws(() => normalize({ trophies: { stile: "gem" } }), /Unknown config key "trophies\.stile"/);
});
