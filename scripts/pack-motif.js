#!/usr/bin/env node
// Packs an animated SVG exported as frames (a Lottie export: every frame is a top-level <g> whose display is switched by a SMIL <animate>)
// into a motif of src/motifs-animated.js: ids dropped (they would clash with the card's own), numbers rounded to one decimal, the colour
// and the duration turned into placeholders, and the fullest frame kept apart as the still picture for PNG / GIF and "animations off".
//
//   node scripts/pack-motif.js "scripts/assets/red-lightning.svg" lightning
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [file, name] = process.argv.slice(2);
if (!file || !name) throw new Error("usage: node scripts/pack-motif.js <file.svg> <name>");
const src = readFileSync(file, "utf8");
const root = src.match(/<svg[^>]*>/)[0];
const viewBox = root.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 100 100";
const inner = src.slice(src.indexOf(root) + root.length, src.lastIndexOf("</svg>"));

// the colours: the most used fill is the one the user can change
const fills = [...inner.matchAll(/fill="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1].toLowerCase());
const main = Object.entries(fills.reduce((o, f) => ((o[f] = (o[f] ?? 0) + 1), o), {})).sort((a, b) => b[1] - a[1])[0][0];
const dur = inner.match(/dur="([\d.]+)s"/)[1];

const round = (s) => s.replace(/-?\d+\.\d{2,}/g, (n) => String(Math.round(Number(n) * 10) / 10));
let body = round(inner)
  .replace(/ id="[^"]*"/g, "")
  .replaceAll(`fill="${main}"`, 'fill="__COLOR__"')
  .replaceAll(`dur="${dur}s"`, 'dur="__DUR__s"')
  .replace(/ transform="matrix\(1,0,0,1,0,0\)"/g, "");

// the top-level frames, to pick the fullest one
const frames = [];
{
  let depth = 0, start = 0;
  const re = /<g\b|<\/g>/g;
  let m;
  while ((m = re.exec(body))) {
    if (m[0] === "<g") { if (depth++ === 0) start = m.index; }
    else if (--depth === 0) frames.push(body.slice(start, m.index + 4));
  }
}
const best = frames.reduce((a, b) => (b.length > a.length ? b : a));
const still = best.replace(/<animate\b[^>]*\/>/g, "").replace(/ display="[^"]*"/, "");

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "motifs-animated.js");
const keep = existsSync(out) ? readFileSync(out, "utf8").match(/export const ANIMATED = (\{.*\});\s*$/s)?.[1] : null;
const entries = keep ? JSON.parse(keep) : {};
entries[name] = { viewBox, dur: Number(dur), color: main, animated: body, still };
writeFileSync(
  out,
  `// Animated motifs packed by scripts/pack-motif.js (do not edit by hand). Each one is the inner markup of an svg with the given viewBox:
// __COLOR__ is the colour the user can change, __DUR__ the duration of the loop in seconds; \`still\` is one frame, for static pictures.
export const ANIMATED = ${JSON.stringify(entries)};\n`,
);
console.log(`${name}: ${frames.length} frames, ${Math.round(body.length / 1024)} KB animated, ${Math.round(still.length / 1024)} KB still, colour ${main}, ${dur}s`);
