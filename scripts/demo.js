#!/usr/bin/env node
// Renders a card from a config.json using deterministic demo data (no GitHub token, no network).
// Used to generate the images in docs/ and presets/. Needs `npm install` for PNG output.
//   node scripts/demo.js <config.json> <out-prefix> [--slot dark] [--scale 1] [--svg]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { needsExtras, normalize } from "../src/config.js";
import { render } from "../src/render.js";
import { summarize } from "../src/stats.js";

const { values: o, positionals: [configPath, prefix] } = parseArgs({
  allowPositionals: true,
  options: { slot: { type: "string" }, scale: { type: "string", default: "1" }, svg: { type: "boolean" }, top: { type: "boolean" } },
});
if (!configPath || !prefix) throw new Error("usage: node scripts/demo.js <config.json> <out-prefix> [--slot dark] [--scale 1] [--svg]");

// Small deterministic PRNG so images are reproducible.
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const today = new Date().toISOString().slice(0, 10);
const days = [];
for (let d = new Date("2016-03-01T00:00:00Z"); d.toISOString().slice(0, 10) <= today; d.setUTCDate(d.getUTCDate() + 1)) {
  const wd = d.getUTCDay();
  const weekend = wd === 0 || wd === 6;
  const busy = Math.sin(d.getTime() / 86_400_000 / 40) > -0.6; // streaky periods
  const n = busy && rnd() > (weekend ? 0.6 : 0.12) ? Math.floor(rnd() * rnd() * 14) + 1 : 0;
  days.push([d.toISOString().slice(0, 10), n]);
}
days[days.length - 1][1] = 3; // contributed today -> a live streak

const L = (name, color, size) => ({ name, color, size });
const profile = {
  name: "Ada Demo", login: "ada-demo",
  avatar: `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7aa2f7"/><stop offset="1" stop-color="#bb9af7"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="100" cy="82" r="36" fill="#fff" fill-opacity=".9"/><path d="M30 200c6-48 40-68 70-68s64 20 70 68z" fill="#fff" fill-opacity=".9"/></svg>`,
  ).toString("base64")}`,
  createdAt: "2016-03-01T00:00:00Z", earliest: "2016-03-01T00:00:00Z",
  followers: 128, organizations: 3, prs: 214, issues: 63, contributedTo: 41, repoCount: 37, stars: 486,
  commits: 5230, commitsByYear: { 2024: 640, 2025: 710, 2026: 520 }, reviews: 58,
  mergedPrs: 171, discussionsStarted: 12, discussionsAnswered: 9,
  repos: [
    { name: "forge-api", stars: 210, isFork: false, languages: [L("Python", "#3572A5", 820_000), L("Shell", "#89e051", 12_000)] },
    { name: "web-ui", stars: 120, isFork: false, languages: [L("TypeScript", "#3178c6", 610_000), L("CSS", "#563d7c", 90_000), L("HTML", "#e34c26", 40_000)] },
    { name: "fast-core", stars: 96, isFork: false, languages: [L("Rust", "#dea584", 420_000)] },
    { name: "tooling", stars: 40, isFork: false, languages: [L("Go", "#00ADD8", 260_000), L("Python", "#3572A5", 60_000)] },
    { name: "notebooks", stars: 20, isFork: false, languages: [L("Jupyter Notebook", "#DA5B0B", 900_000), L("Python", "#3572A5", 80_000)] },
    { name: "engine", stars: 0, isFork: false, languages: [L("C++", "#f34b7d", 180_000), L("JavaScript", "#f1e05a", 70_000)] },
  ],
  days,
};

if (o.top) Object.assign(profile, { followers: 4200, prs: 1800, issues: 900, stars: 52000, commits: 30000, reviews: 400, repoCount: 60 }); // a top 1% profile, to see the special level
const raw = JSON.parse(await readFile(configPath, "utf8"));
const k = normalize(raw);
const data = summarize(profile, k);

// Tech stack images are paths relative to the config, embedded as data URIs (same as the CLI).
const MIME = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const base = dirname(resolve(configPath));
k.stack = await Promise.all(
  k.techStack.flatMap((c) => c.items).map(async (it, n) => ({
    name: it.name, id: `i${n}`,
    data: `data:${MIME[extname(it.image).toLowerCase()] ?? "image/png"};base64,${(await readFile(join(base, it.image))).toString("base64")}`,
  })),
);

const fontDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fonts");
const face = async (family, file) =>
  `@font-face{font-family:'${family}';font-weight:300 800;src:url(data:font/woff2;base64,${(await readFile(join(fontDir, file))).toString("base64")}) format("woff2")}`;
const fontCss = (await face("Inter", "inter.woff2")) + (await face("Space Grotesk", "space-grotesk.woff2"));

await mkdir(dirname(resolve(prefix)), { recursive: true });
const { toPng } = await import("../src/export.js");
for (const [slot, theme] of k.slots) {
  if (o.slot && o.slot !== slot) continue;
  const colors = { ...k.colors, ...k.colorsByTheme[slot] };
  const opts = (extra) => ({ theme, k, colors, ...extra });
  const out = o.slot ? prefix : `${prefix}-${slot}`;
  if (o.svg) await writeFile(`${out}.svg`, render(data, opts({ fontCss })));
  else await writeFile(`${out}.png`, toPng(render(data, opts({ t: 1 })), Number(o.scale)));
  console.log("wrote", out + (o.svg ? ".svg" : ".png"));
}
