#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { fetchProfile } from "./github.js";
import { render } from "./render.js";
import { summarize } from "./stats.js";

const { values: o } = parseArgs({
  options: {
    user: { type: "string" },
    token: { type: "string", default: process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN },
    out: { type: "string", default: "out" },
    name: { type: "string", default: "profile-forge" },
    theme: { type: "string", default: "dark,light" },
    tz: { type: "string", default: "UTC" },
    "size-weight": { type: "string", default: "1" },
    "count-weight": { type: "string", default: "0" },
    hide: { type: "string", default: "" },
    "include-private": { type: "boolean", default: false },
    png: { type: "boolean", default: false },
    gif: { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});

if (o.help || !o.user || !o.token) {
  console.log(`Usage: profile-forge --user <login> [--token <pat>] [options]

  --token            GitHub token (default: $GITHUB_TOKEN / $GH_TOKEN)
  --out <dir>        output directory (default: out)
  --name <base>      file base name (default: profile-forge -> profile-forge-dark.svg)
  --theme <list>     comma-separated themes: dark,light
  --tz <zone>        IANA time zone used for "today" in streaks (default: UTC)
  --size-weight <n>  language ranking: bytes exponent (default 1)
  --count-weight <n> language ranking: repo-count exponent (default 0)
  --hide <list>      languages to hide, comma-separated
  --include-private  include private repos in stars/languages/repo count
  --png / --gif      also export PNG / animated GIF (needs: npm install)`);
  process.exit(o.help ? 0 : 1);
}

const profile = await fetchProfile({ login: o.user, token: o.token, includePrivate: o["include-private"], tz: o.tz });
const data = summarize(profile, {
  sizeWeight: Number(o["size-weight"]),
  countWeight: Number(o["count-weight"]),
  hide: o.hide.split(",").map((s) => s.trim()).filter(Boolean),
});

await mkdir(o.out, { recursive: true });
// Loaded lazily so the GitHub Action works without installing the optional export deps.
const exporter = o.png || o.gif ? await import("./export.js") : null;
for (const theme of o.theme.split(",").map((s) => s.trim())) {
  const base = join(o.out, `${o.name}-${theme}`);
  await writeFile(`${base}.svg`, render(data, { theme }));
  if (o.png) await writeFile(`${base}.png`, exporter.toPng(render(data, { theme, t: 1 })));
  if (o.gif) await writeFile(`${base}.gif`, exporter.toGif((t) => render(data, { theme, t })));
  console.log(`wrote ${base}.svg${o.png ? " .png" : ""}${o.gif ? " .gif" : ""}`);
}
console.log(`rank ${data.rank.level} (top ${data.rank.percentile.toFixed(1)}%), streak ${data.streak.current.length}d, ${data.stats.commits} commits`);
