# Configuration guide

Every option of `config.json`, with an example and a picture. For installation and the GitHub Action see the [README](README.md).

All the pictures here are rendered with demo data (`node scripts/gen-docs.js`), so you can reproduce them without a token. Your card shows your own numbers.

- [How it works](#how-it-works)
- [Presets](#presets)
- [Layout and sections](#layout-and-sections)
- [Card: radius, border, background](#card-radius-border-background)
- [Header](#header) (rank levels, frames)
- [Stats](#stats)
- [Streak](#streak)
- [Languages](#languages)
- [Trophies](#trophies)
- [Heatmap](#heatmap)
- [Themes, custom themes and colors](#themes-custom-themes-and-colors)
- [Locale and time zone](#locale-and-time-zone)
- [Content: about, working on, links, tech stack](#content-about-working-on-links-tech-stack)
- [Export, private data and other root keys](#export-private-data-and-other-root-keys)
- [Reference: every key](#reference-every-key)

## How it works

Put a `config.json` at the root of your profile repo. **Every key is optional**: whatever you leave out uses the default. A wrong key or value fails with a message that names it.

```json
{
  "$schema": "https://raw.githubusercontent.com/GiuseppeBellamacina/profile-forge/main/config.schema.json",
  "themes": { "dark": "dracula", "light": "gruvbox-light" },
  "languages": { "layout": "donut" }
}
```

`$schema` gives you autocompletion and validation in VS Code and other editors.

Precedence: **action inputs / CLI flags › `config.json` › defaults**. Any key can also be set without editing the file, with `--set path=value` on the CLI or the `set` input of the action:

```yaml
- uses: GiuseppeBellamacina/profile-forge@v1
  with:
    set: |
      languages.layout=donut
      stats.numberFormat=short
```

## Presets

Ready-to-use configs live in [`presets/`](presets). Copy one to `config.json` in your profile repo and edit from there. Each one defines a `dark` and a `light` slot, so the README `<picture>` snippet never changes.

```bash
curl -o config.json https://raw.githubusercontent.com/GiuseppeBellamacina/profile-forge/main/presets/dashboard.json
```

| Preset | Idea |
|---|---|
| [`minimal`](presets/minimal.json) | Small and quiet: no border, no glow, a few numbers |
| [`dashboard`](presets/dashboard.json) | Dracula / Gruvbox, donut languages, trophies, round heatmap |
| [`terminal`](presets/terminal.json) | Green-on-black hacker look, grid background, `$ stats` titles |
| [`pastel-it`](presets/pastel-it.json) | Catppuccin, Italian labels, rounded corners, vertical donut |
| [`trophy-case`](presets/trophy-case.json) | Trophies first, including the opt-in Issues and Reviews |
| [`cyberpunk`](presets/cyberpunk.json) | Two `customThemes` (neon dark + a matching light), pie chart |
| [`portfolio`](presets/portfolio.json) | Replaces your whole README: about, projects, links, tech stack |
| [`streak-focus`](presets/streak-focus.json) | Consistency view: streaks, weekdays only, heatmap |
| [`open-source`](presets/open-source.json) | Merged PRs, discussions, weighted languages, selected trophies |
| [`aurora`](presets/aurora.json) | Northern-lights gradient, a terminal, weekday rhythm, glowing snake |
| [`zen`](presets/zen.json) | Quiet paper / Rosé Pine Moon, rhythm first, trophies by level |
| [`showcase`](presets/showcase.json) | Tokyo Night with every new piece: terminal, rhythm, rainbow snake, highlighted trophies |

<table>
<tr>
<td align="center"><b>minimal</b><br><img src="docs/presets/minimal-dark.png" width="100%"></td>
<td align="center"><b>dashboard</b><br><img src="docs/presets/dashboard-dark.png" width="100%"></td>
</tr>
<tr>
<td align="center"><b>terminal</b><br><img src="docs/presets/terminal-dark.png" width="100%"></td>
<td align="center"><b>pastel-it</b><br><img src="docs/presets/pastel-it-dark.png" width="100%"></td>
</tr>
<tr>
<td align="center"><b>trophy-case</b><br><img src="docs/presets/trophy-case-dark.png" width="100%"></td>
<td align="center"><b>cyberpunk</b><br><img src="docs/presets/cyberpunk-dark.png" width="100%"></td>
</tr>
<tr>
<td align="center"><b>streak-focus</b><br><img src="docs/presets/streak-focus-dark.png" width="100%"></td>
<td align="center"><b>open-source</b><br><img src="docs/presets/open-source-dark.png" width="100%"></td>
</tr>
<tr>
<td align="center"><b>aurora</b><br><img src="docs/presets/aurora-dark.png" width="100%"></td>
<td align="center"><b>zen</b><br><img src="docs/presets/zen-light.png" width="100%"></td>
</tr>
<tr>
<td align="center"><b>showcase</b><br><img src="docs/presets/showcase-dark.png" width="100%"></td>
<td align="center"><b>showcase (light)</b><br><img src="docs/presets/showcase-light.png" width="100%"></td>
</tr>
</table>

**portfolio** (full README replacement) and the light variants:

<img src="docs/presets/portfolio-dark.png" width="60%"> <img src="docs/presets/cyberpunk-light.png" width="38%">

The `portfolio` preset reads its tech stack icons from `assets/img/` (paths are relative to `config.json`). The icons are in [`presets/assets/img/`](presets/assets/img); copy them next to your config. Replace the placeholder text, URLs and `your-login`.

## Layout and sections

`layout` is an ordered list of sections: `header`, `about`, `workingOn`, `stats`, `streak`, `languages`, `trophies`, `heatmap`, `techStack`, `terminal`, `rhythm`.

- A **nested pair** puts two sections side by side at half width: `["stats", "streak"]`, `["about", "workingOn"]`, `["trophies", "heatmap"]`. Any two sections can pair except `header`.
- `stats`, `streak` and `languages` with the `donut`, `donut-vertical` or `pie` layout are always half width; on their own they are centered.
- In a pair, `workingOn` stacks its cards, `trophies` wraps to as many per row as fit, `heatmap` shows the last weeks that fit, `languages` as a bar uses 2 legend columns. If one of the two has no content, the other takes the full width.

### Free grid (`grid`)

For more control than rows, `grid` replaces `layout` with a 6-column grid. Every section gets a width in columns and falls to the lowest free spot, like widgets on a home screen, so a short card fills the gap next to a tall one. The height always follows the content.

```json
"grid": [
  { "section": "header" },
  { "section": "languages", "cols": 3 }, { "section": "workingOn", "cols": 3 },
  { "section": "about", "cols": 3 }, { "section": "streak", "cols": 3 },
  { "section": "heatmap", "cols": 3 }, { "section": "trophies", "cols": 3 }
]
```

- `cols` is 1 to 6 (default 3; the header is always 6). Narrower than a section can be drawn is raised to its minimum: header 6, `stats` / `streak` / `languages` / `heatmap` / `rhythm` 3, the rest 2.
- `height` (optional, pixels) makes a card taller than its content, for instance to line up with its neighbour. It never makes it shorter, so nothing is cut: a value below what the content needs is raised to it. Leave it out for automatic height.
- Order matters: sections are placed one after the other, each in the lowest free spot (leftmost on a tie).
- A section can appear once. `hideSections` still applies. When `grid` is set, `layout` is ignored; the web configurator writes `grid` for you.
- `about`, `workingOn`, `techStack` and `terminal` are skipped when they have no content.
- `hideSections` removes sections (and `"rank"` removes only the ring in the header).

Default: `["header", "about", "workingOn", ["stats", "streak"], "languages", "trophies", "heatmap", "techStack"]`.

```json
{ "layout": ["header", ["languages", "streak"], "stats", "heatmap"] }
```

<img src="docs/guide/layout-pairs.png" width="60%">

```json
{ "hideSections": ["trophies", "rank"] }
```

<img src="docs/guide/layout-hide.png" width="60%">

## Card: radius, border, background

```json
{
  "card": {
    "radius": 20,
    "hideBorder": false,
    "animations": true,
    "background": { "gradient": null, "pattern": "none", "glow": true }
  }
}
```

| Key | Values | Default | Meaning |
|---|---|---|---|
| `radius` | 0–60 | `20` | Corner radius |
| `hideBorder` | boolean | `false` | Remove the card border |
| `animations` | boolean | `true` | `false` renders the final frame with no CSS animation |
| `background.gradient` | `"angle,color1,color2,..."` | `null` | Card gradient, 2+ hex colors |
| `background.pattern` | `none` `dots` `grid` `diagonal` | `none` | Texture over the background |
| `background.glow` | boolean | `true` | Soft accent glow in the top-right corner |

| `radius: 0` | `radius: 40` | `hideBorder: true` |
|---|---|---|
| <img src="docs/guide/card-radius-0.png"> | <img src="docs/guide/card-radius-40.png"> | <img src="docs/guide/card-hide-border.png"> |

| `gradient` (`"35,4158d0,c850c0,ffcc70"`) | `glow: false` |
|---|---|
| <img src="docs/guide/bg-gradient.png"> | <img src="docs/guide/bg-no-glow.png"> |

| `pattern: "dots"` | `pattern: "grid"` | `pattern: "diagonal"` |
|---|---|---|
| <img src="docs/guide/bg-dots.png"> | <img src="docs/guide/bg-grid.png"> | <img src="docs/guide/bg-diagonal.png"> |

## Header

```json
{ "header": { "avatar": "circle", "frame": "ring", "frameAnimation": "default", "rankStyle": "ring", "rankThickness": 8, "facts": ["contributionsThisYear", "bestDay", "busiestWeekday"], "rankIcon": "level" } }
```

| Key | Values | Default |
|---|---|---|
| `avatar` | `circle` `rounded` `hide` | `circle` |
| `facts` | up to 4 of `contributionsThisYear` `bestDay` `busiestWeekday` `currentStreak` `longestStreak` `topLanguage` `stars` `followers` | first three |
| `frame` | `none` `ring` `double` `dashed` `neon` `pixel` `glitch` `laurel` `flames` `sakura` `stars` `halo` `aurora` `auto` | `ring` |
| `frameAnimation` | `default` `none` `spin` `pulse` `twinkle` | `default` |
| `rankStyle` | `ring` `hexagon` `shield` | `ring` |
| `rankThickness` | 4–16 | `8` |
| `rankIcon` | what the rank shows: `level` (S), `percentile` (6.9%), `github` (mark) | `level` |
| `flag` | path of a 4:3 flag image (svg/png) drawn at the start of the "joined" line under the name | `null` |

| `avatar: "circle"` | `avatar: "rounded"` | `avatar: "hide"` |
|---|---|---|
| <img src="docs/guide/header-circle.png"> | <img src="docs/guide/header-rounded.png"> | <img src="docs/guide/header-no-avatar.png"> |

`facts: ["currentStreak", "longestStreak", "stars", "followers"]`:

<img src="docs/guide/header-facts.png" width="60%">

### Rank levels

One scale for the whole card: **E, D, C, B, A, S** and, for the top 1%, the special level **S+**. The header rank and the trophies use it. The header level comes from your percentile (the github-readme-stats formula): S+ is the top 1%, S up to 10%, A up to 25%, B up to 50%, C up to 70%, D up to 85%, E below. Trophies place each of their eight old thresholds on the same scale, and S+ is their highest threshold. Every level has its own colour, the same in every theme so the levels are always easy to tell apart (grey, blue, green, purple, orange, gold, pink); change them with the colour overrides `levelE`, `levelD`, `levelC`, `levelB`, `levelA`, `levelS` and `levelTop`.

| `E` | `D` | `C` | `B` |
|---|---|---|---|
| <img src="docs/guide/rank-E.png" width="200"> | <img src="docs/guide/rank-D.png" width="200"> | <img src="docs/guide/rank-C.png" width="200"> | <img src="docs/guide/rank-B.png" width="200"> |

| `A` | `S` | `S+` |  |
|---|---|---|---|
| <img src="docs/guide/rank-A.png" width="200"> | <img src="docs/guide/rank-S.png" width="200"> | <img src="docs/guide/rank-top.png" width="200"> |  |

**The top 1% is animated.** The ring of an S+ profile gets a pulsing halo, a light that runs around it and twinkling sparkles, and its trophies shimmer. It is plain CSS, so it plays inside a README image; PNG and GIF exports show the same drawing held still.

| Header of a top 1% profile |
|---|
| <img src="docs/guide/header-top-animated.svg"> |

`levelB: "ff4d6d"`, a custom colour for one level:

<img src="docs/guide/rank-colors.png" width="200">

### Rank shape and what it shows

| `rankStyle: "ring"` | `"hexagon"` | `"shield"` | `rankThickness: 14` |
|---|---|---|---|
| <img src="docs/guide/rank-A.png" width="200"> | <img src="docs/guide/rank-hexagon.png" width="200"> | <img src="docs/guide/rank-shield.png" width="200"> | <img src="docs/guide/rank-thick.png" width="200"> |

| `rankIcon: "level"` | `"percentile"` | `"github"` | `hideSections: ["rank"]` |
|---|---|---|---|
| <img src="docs/guide/rank-level.png"> | <img src="docs/guide/rank-percentile.png"> | <img src="docs/guide/rank-github.png"> | <img src="docs/guide/rank-hidden.png"> |

### Avatar frames

`frame` puts a decoration around the avatar, like Discord avatar decorations. `ring` is the classic gradient ring (the default), `none` removes it, the rest are decorations, and `auto` follows your level: E none, D ring, C double, B dashed, A neon, S flames, and the top 1% gets the animated aurora. They fit the round and the rounded avatar. The colour is `colors.frameColor`, by default the colour of your level. Most frames move (plain CSS, so they play inside a README); `frameAnimation` turns that off (`none`) or changes it (`spin`, `pulse`, `twinkle`). PNG and GIF show them still.

| `ring` | `double` | `dashed` |
|---|---|---|
| <img src="docs/guide/frame-ring.png" width="260"> | <img src="docs/guide/frame-double.png" width="260"> | <img src="docs/guide/frame-dashed.png" width="260"> |

| `neon` | `pixel` | `glitch` |
|---|---|---|
| <img src="docs/guide/frame-neon.png" width="260"> | <img src="docs/guide/frame-pixel.png" width="260"> | <img src="docs/guide/frame-glitch.png" width="260"> |

| `laurel` | `flames` | `sakura` |
|---|---|---|
| <img src="docs/guide/frame-laurel.png" width="260"> | <img src="docs/guide/frame-flames.png" width="260"> | <img src="docs/guide/frame-sakura.png" width="260"> |

| `stars` | `halo` | `aurora` |
|---|---|---|
| <img src="docs/guide/frame-stars.png" width="260"> | <img src="docs/guide/frame-halo.png" width="260"> | <img src="docs/guide/frame-aurora.png" width="260"> |

| `frame: "auto"` at level S+ | `frame: "neon"`, rounded avatar | `frameColor: "00e5a0"` |
|---|---|---|
| <img src="docs/guide/frame-auto-top.png" width="300"> | <img src="docs/guide/frame-rounded.png" width="260"> | <img src="docs/guide/frame-color.png" width="260"> |

Animated (these play in the browser):

| `neon` | `flames` | `stars` | `aurora` | `glitch` |
|---|---|---|---|---|
| <img src="docs/guide/frame-neon-animated.svg" width="150"> | <img src="docs/guide/frame-flames-animated.svg" width="150"> | <img src="docs/guide/frame-stars-animated.svg" width="150"> | <img src="docs/guide/frame-aurora-animated.svg" width="150"> | <img src="docs/guide/frame-glitch-animated.svg" width="150"> |

## Stats

```json
{
  "stats": {
    "hide": ["issues"],
    "show": ["prsMerged"],
    "icons": true,
    "numberFormat": "short",
    "numberPrecision": 1,
    "textBold": true,
    "lineHeight": 30,
    "title": null,
    "commitsYear": null,
    "excludeRepos": []
  }
}
```

| Key | Values | Default | Meaning |
|---|---|---|---|
| `hide` | `stars` `commits` `prs` `issues` `reviews` `contributed` `followers` `repos` | `[]` | Rows to drop |
| `show` | `prsMerged` `prsMergedPercentage` `discussionsStarted` `discussionsAnswered` | `[]` | Extra rows (they need extra GraphQL calls, made only when requested) |
| `icons` | boolean | `true` | Row icons |
| `numberFormat` | `long` `short` | `long` | `5,230` vs `5.2k` |
| `numberPrecision` | `0` `1` `2` `null` | `null` | Fixed decimals for short numbers |
| `textBold` | boolean | `true` | Bold values |
| `lineHeight` | 18–60 | `30` | Row spacing |
| `title` | string | translated | Custom panel title |
| `commitsYear` | year | `null` | Count commits of one year only |
| `excludeRepos` | repo names | `[]` | Left out of stars and repo count |

`stats.show` adds rows, `stats.hide` removes them:

<img src="docs/guide/stats-hide-show.png" width="60%">

`numberFormat: "short"` with `numberPrecision: 1`, and a plain look (`icons: false`, `textBold: false`, `lineHeight: 36`, `title: "My numbers"`):

| short | plain |
|---|---|
| <img src="docs/guide/stats-short.png"> | <img src="docs/guide/stats-plain.png"> |

## Streak

```json
{
  "streak": {
    "hide": [],
    "mode": "daily",
    "excludeDays": ["Sat", "Sun"],
    "startingYear": null,
    "dateFormat": "M j[, Y]",
    "shortNumbers": false,
    "excludeDaysLabel": true,
    "title": null
  }
}
```

| Key | Values | Default | Meaning |
|---|---|---|---|
| `hide` | `total` `current` `longest` | `[]` | Drop a column |
| `mode` | `daily` `weekly` | `daily` | `weekly` counts Sunday–Saturday weeks with any contribution |
| `excludeDays` | `Sun` … `Sat` | `[]` | Days that neither extend nor break a streak |
| `startingYear` | ≥ 2005 | `null` | First year counted |
| `dateFormat` | PHP-style (`d j m n M F y Y`) | locale | Text inside `[...]` is hidden for the current year, e.g. `"M j[, Y]"` |
| `shortNumbers` | boolean | `false` | `8.5k` instead of `8,462` |
| `excludeDaysLabel` | boolean | `true` | Shows "Excludes: Sat, Sun". (Not to be confused with the `colors.excludeDaysLabel` *color* of that label.) |
| `title` | string | translated | Custom panel title |

A day with zero contributions *today* does not break the current streak.

**Date format.** `dateFormat` shapes the dates under the three streak blocks (the start of each streak and when your count began). Letters: `d` day `05`, `j` day `5`, `m` month `03`, `n` month `3`, `M` `Mar`, `F` `March`, `y` `26`, `Y` `2026`; month names follow `locale`. Anything inside `[ ]` is shown only when that date's year is not the current one. Plain letters from that list are always replaced, even inside the brackets, so keep other text to symbols and spaces.

| `dateFormat` | A date in 2025 | A date this year |
|---|---|---|
| `M j[, Y]` | Jul 27, 2025 | Aug 19 |
| `j M[ Y]` | 27 Jul 2025 | 19 Aug |
| `j F Y` | 27 July 2025 | 19 August 2026 |
| `d/m/Y` | 27/07/2025 | 19/08/2026 |
| `n/j/y` | 7/27/25 | 8/19/26 |
| `Y-m-d` | 2025-07-27 | 2026-08-19 |

| default | `mode: "weekly"` | `excludeDays: ["Sat","Sun"]` |
|---|---|---|
| <img src="docs/guide/streak-default.png"> | <img src="docs/guide/streak-weekly.png"> | <img src="docs/guide/streak-exclude.png"> |

| `hide: ["total"]`, `dateFormat: "j M[ Y]"`, custom `title` | `shortNumbers`, `startingYear: 2020` |
|---|---|
| <img src="docs/guide/streak-hide.png"> | <img src="docs/guide/streak-short.png"> |

## Languages

```json
{
  "languages": {
    "layout": "donut",
    "count": 8,
    "hide": ["HTML", "CSS"],
    "excludeRepos": [],
    "hideProgress": false,
    "statsFormat": "percentages",
    "sizeWeight": 1,
    "countWeight": 0,
    "title": null
  }
}
```

| Key | Values | Default | Meaning |
|---|---|---|---|
| `layout` | `bar` `compact` `donut` `donut-vertical` `pie` | `bar` | Chart style (the last three are half-width) |
| `count` | 1–20 | `8` | Languages shown (donut and pie legends cap at 10) |
| `hide` | language names | `[]` | Case-insensitive |
| `excludeRepos` | repo names | `[]` | Skip these repos |
| `hideProgress` | boolean | `false` | Hide the percentage / size next to each name |
| `statsFormat` | `percentages` `bytes` | `percentages` | Show sizes instead of percentages |
| `sizeWeight`, `countWeight` | number | `1`, `0` | Ranking score = `bytes^sizeWeight × repos^countWeight` |
| `title` | string | translated | Custom panel title |

| `bar` (default) | `compact` |
|---|---|
| <img src="docs/guide/lang-bar.png"> | <img src="docs/guide/lang-compact.png"> |

| `donut` | `donut-vertical` | `pie` |
|---|---|---|
| <img src="docs/guide/lang-donut.png"> | <img src="docs/guide/lang-donut-vertical.png"> | <img src="docs/guide/lang-pie.png"> |

| `statsFormat: "bytes"`, `count: 5` | `hide: [...]`, `hideProgress`, `title: "Stack"` | `sizeWeight: 0.5`, `countWeight: 1` |
|---|---|---|
| <img src="docs/guide/lang-bytes.png"> | <img src="docs/guide/lang-hide.png"> | <img src="docs/guide/lang-weights.png"> |

`sizeWeight`/`countWeight` change what "top language" means: with the defaults a single huge repo dominates; with `0.5` / `1` the languages you use across many repos rank higher.

## Trophies

```json
{
  "trophies": {
    "titles": [],
    "hideTitles": [],
    "ranks": ["-E"],
    "hideRanks": [],
    "columns": 0,
    "rows": 0,
    "marginW": 14,
    "marginH": 14,
    "padding": 20,
    "align": "center",
    "parts": ["title", "label", "score", "bar"],
    "noBg": false,
    "noFrame": false,
    "extra": ["Issues", "Reviews"],
    "title": null
  }
}
```

| Key | Values | Default | Meaning |
|---|---|---|---|
| `titles` | trophy names | `[]` | Show only these, in the order listed. Aliases from the original project work: `Star`, `Commit`, `Follower`, `PR`, `Repo`, `Review`, `Duration`, `Orgs`… |
| `hideTitles` | trophy names | `[]` | Hide these |
| `ranks` | `E D C B A S S+ SECRET` | `[]` | Only these ranks. A `-` prefix drops one: `["-E"]`. `SECRET` selects the secret trophies. The old names SSS, SS, AAA and AA are gone: use `S+`, `S` and `B` |
| `hideRanks` | same | `[]` | Drop ranks |
| `columns` | −1–12 | `0` | `0` / `-1`: everything on one row |
| `rows` | 0–10 | `0` | `0`: no limit |
| `marginW`, `marginH` | 0–60 | `14` | Space between trophies |
| `padding` | 0–60 | `20` | Space between the panel edge and the trophies |
| `align` | `center` `left` | `center` | Where an incomplete last row sits |
| `parts` | `title` `label` `score` `bar` | all | What each trophy shows besides the cup |
| `noBg`, `noFrame` | boolean | `false` | Remove the trophy background / frame |
| `extra` | `Issues` `Reviews` | `[]` | Opt-in trophies |
| `birthday` | `MM-DD` or `YYYY-MM-DD` | none | Your birthday: the Happy Birthday secret trophy shows that day |
| `sort` | `default` `rank` `name` | `default` | `default`: the order of `titles` (or the built-in one). `rank`: highest level first, secret trophies after. `name`: A–Z |
| `highlight` | trophy names | `[]` | These get a pulsing outline in the accent colour |
| `title` | string | translated | Custom panel title |

Base trophies: Stars, Commits, Followers, PullRequest, Repositories, Experience.

### Secret trophies

There are 66 secret trophies, drawn as a cut gem with their own glyph instead of a cup (the colour is the family of the trophy, not a level). They appear only once earned. Select them with `ranks: ["SECRET"]`, hide them with `hideRanks: ["SECRET"]` or one by one with `hideTitles`.

<img src="docs/guide/trophies-secret-all.png">

Two of them are configurable or special:

- **Happy Birthday!** shows on your birthday. Set the date with `trophies.birthday` (`"MM-DD"` or `"YYYY-MM-DD"`, read in the card's `timezone`); without it the trophy never appears.
- **Forge Friend** is a special trophy (pulsing frame, `FRIEND` tag) for friends of the author: you and [GiuseppeBellamacina](https://github.com/GiuseppeBellamacina) follow each other on GitHub.

The full list, with what earns each one, is in the **[trophy guide](TROPHIES.md)**.

### Levels

Each trophy (except the secret ones) is the classic cup in the colour of its level, and the higher the level the richer it gets: **A** adds the laurel, **S** a second cup, and the top 1% (**S+**) three cups with a pulsing border and a light that sweeps across the card (animated, like the rank). The level letter is on the cup. The levels are the same as the header rank (see [Rank levels](#rank-levels)), and `levelE` … `levelTop` change their colours.

<img src="docs/guide/trophies-levels.png">

The top 1%:

<img src="docs/guide/trophies-top-animated.svg">

`parts: ["title", "bar"]` shows only the title and the progress bar, and `align: "left"` with `padding: 36` starts an incomplete row at the left edge:

| `parts: ["title", "bar"]`, `columns: 4` | `align: "left"`, `columns: 5`, `padding: 36` |
|---|---|
| <img src="docs/guide/trophies-parts.png" width="400"> | <img src="docs/guide/trophies-left.png" width="400"> |

| default | `columns: 4`, `rows: 2`, margins 16 |
|---|---|
| <img src="docs/guide/trophies-default.png"> | <img src="docs/guide/trophies-grid.png"> |

| `extra` + `ranks: ["-E"]` + `columns: 4` | `titles: ["Star","Commit","PR","Followers"]` |
|---|---|
| <img src="docs/guide/trophies-extra.png"> | <img src="docs/guide/trophies-filter.png"> |

| `ranks: ["SECRET"]` | `noBg` + `noFrame` + `columns: 6` |
|---|---|
| <img src="docs/guide/trophies-secret.png"> | <img src="docs/guide/trophies-clean.png"> |

## Heatmap

```json
{ "heatmap": { "mode": "grid", "snakePath": "smart", "weeks": 53, "cell": "square", "weekStart": "sun", "legend": true, "monthLabels": true } }
```

| Key | Values | Default |
|---|---|---|
| `mode` | `grid` `snake` | `grid` |
| `snakePath` | `smart` `busy` `nearest` `sweep` `rows` `spiral` | `smart` |
| `snakeLength` | 3–12 | `6` |
| `snakeStyle` | `classic` `rainbow` `glow` | `classic` |
| `weeks` | 4–53 | `53` |
| `cell` | `square` `round` `triangle` `snowflake` `moon` `mixed` | `square` |
| `weekStart` | `sun` `mon` | `sun` |
| `legend` | boolean | `true` |
| `monthLabels` | boolean | `true` |

| default | `cell: "round"`, `weekStart: "mon"` | `weeks: 26`, no legend, no month labels |
|---|---|---|
| <img src="docs/guide/heatmap-square.png"> | <img src="docs/guide/heatmap-round.png"> | <img src="docs/guide/heatmap-compact.png"> |

**Shapes.** `cell` picks what a day looks like: `square`, `round`, `triangle` (up and down alternating, so they tile), `snowflake` (a brighter flake for more contributions), `moon` (the moon phase grows with the contributions, from an empty disc to a full moon) and `mixed` (a random but stable mix of square, round and triangle).

| `triangle` | `snowflake` |
|---|---|
| <img src="docs/guide/heatmap-triangle.png" width="460"> | <img src="docs/guide/heatmap-snowflake.png" width="460"> |

| `moon` | `mixed` |
|---|---|
| <img src="docs/guide/heatmap-moon.png" width="460"> | <img src="docs/guide/heatmap-mixed.png" width="460"> |

**Snake.** `"mode": "snake"` turns the heatmap into the animated snake from [Platane/snk](https://github.com/Platane/snk): a snake crawls through the grid column by column and eats the contributions, then starts over. It is the heatmap itself, so you do not need a separate snake image next to the card (use either the plain grid or the snake, not both). With `"snakePath": "smart"` (default) the route is planned when the card is generated: the snake eats the quietest days first and works up to the busiest ones, finding the cheapest way to the next day of the current tier (Dijkstra on the grid), steering around its own body and out of dead ends, and avoiding busier days that are not due yet. The finished route is written into the SVG, so nothing is computed when the image is viewed. The other routes: `busy` eats the busiest days first, `nearest` always goes to the closest day, `sweep` goes column by column, `rows` row by row and `spiral` from the outside in. The snake colour is the colour override `snakeColor` (default: the theme's `ring_color`). A long route is played faster, so one loop lasts about 30 seconds at most. It is plain CSS, so it animates inside a README `<img>`; it adds about 80 KB to the SVG, and in PNG / GIF exports the snake waits at the start of the grid.

| `mode: "snake"` (route `smart`) | `snakePath: "spiral"` |
|---|---|
| <img src="docs/guide/heatmap-snake-animated.svg" width="450"> | <img src="docs/guide/heatmap-snake-spiral-animated.svg" width="450"> |

`cell: "moon"`, `snakePath: "busy"` and `snakeColor: "ffd23f"`; the snake takes the shape of the cells:

<img src="docs/guide/heatmap-snake-moon-animated.svg" width="500">

**Snake length and style.** `snakeLength` makes it 3 to 12 cells long (the tail always fades out). `snakeStyle: "rainbow"` gives every segment its own colour, `"glow"` adds a soft halo (an SVG blur, so it also shows in PNG / GIF exports).

| `snakeStyle: "rainbow"`, `snakeLength: 9` | `snakeStyle: "glow"` |
|---|---|
| <img src="docs/guide/heatmap-snake-rainbow-animated.svg" width="450"> | <img src="docs/guide/heatmap-snake-glow-animated.svg" width="450"> |

## Terminal

```json
{ "terminal": { "title": null, "lines": ["$ whoami", "Ada, AI engineer", "$ cat focus.txt", "LLM systems · retrieval"] } }
```

A terminal window. Lines that start with `$ ` are commands: they type themselves one character at a time, and the lines after them (the output) appear when the command is done. A blinking cursor waits at the end. `title` replaces the window title (default `<login>@github: ~`). Long lines are cut to the width of the card. In PNG / GIF exports everything is shown at once. Without lines the section is skipped.

<img src="docs/guide/terminal-animated.svg" width="70%">

## Rhythm

```json
{ "rhythm": { "title": null, "show": ["weekdays", "months"] } }
```

When you code, from the contributions already used by the heatmap (no extra API calls): the average per weekday and the total per month over the last 12 months, as bars that grow in. The busiest weekday and month are drawn in the accent colour with their value. `show` picks one or both blocks; at half width they stack.

<img src="docs/guide/rhythm.png" width="70%">

## Themes, custom themes and colors

### `themes`

A list (`["dracula", "nord"]` → `profile-forge-dracula.svg`, `profile-forge-nord.svg`) **or** a `{ slot: theme }` map. With a map the file name follows the *slot*, so your `<picture>` snippet doesn't change when you swap the theme:

```json
{ "themes": { "dark": "dracula", "light": "gruvbox-light" } }
```

There are 72 built-in themes. Previews of all of them are in [`docs/themes/`](docs/themes).

| | |
|---|---|
| **Classic** | `dark` `light` `github-dark` `github-dark-dimmed` |
| **Popular** | `dracula` `nord` `monokai` `one-dark` `rose-pine` `solarized-dark` `solarized-light` `gruvbox` `gruvbox-light` |
| **Catppuccin** | `catppuccin-mocha` `catppuccin-macchiato` `catppuccin-frappe` `catppuccin-latte` |
| **Editor themes** | `nightowl` `cobalt2` `shades-of-purple` `ayu-mirage` `material-palenight` `oceanic-next` `kanagawa-paper` `aura` `aura-dark` `horizon` `vue-dark` `discord` |
| **Nature / Fox** | `everforest-dark` `everforest-light` `nightfox` `dawnfox` `dayfox` `carbonfox` |
| **Bold** | `synthwave` `radical` `ocean` `crimson` `midnight-purple` `outrun` `neon` |
| **Terminal** | `merko` `matrix` `hacker` |
| **More editor themes** | `tokyo-night` `tokyo-night-storm` `tokyo-night-day` `kanagawa-wave` `moonlight` `poimandres` `vesper` `rose-pine-moon` `rose-pine-dawn` `night-owl-light` `andromeda` `panda` `everblush` `cyberdream` `nord-light` |
| **Gradient** | `ambient-gradient` `sunset-gradient` `aurora-gradient` `ocean-gradient` `candy-gradient` |
| **Originals** | `sakura` `lava` `glacier` `forest-night` `coffee` `amber` `paper` |

Dark themes use the dark trophy palette and light themes the light one (`base`).

### `colors`: override single colors

Hex values with or without `#` (`rgb`, `rgba`, `rrggbb`, `rrggbbaa`). They apply on top of every theme:

| Key | What it colors |
|---|---|
| `bg_color`, `panel_color`, `border_color` | card background, panels, borders |
| `text_color`, `muted_color`, `title_color` | main text, secondary text, panel titles |
| `icon_color`, `ring_color` | accent (icons, links, heatmap ramp) and second accent (rank ring, gradients) |
| `levelE` `levelD` `levelC` `levelB` `levelA` `levelS` `levelTop` | the colour of each level (`levelTop` is the top 1%); by default grey, blue, green, purple, orange, gold and pink in every theme, so the levels are always easy to tell apart |
| `fire_color`, `track_color`, `stroke_color` | flame and current streak, ring tracks and heatmap level 0, streak dividers |
| `currStreakNum`, `currStreakLabel`, `sideNums`, `sideLabels`, `dates`, `excludeDaysLabel` | each streak element |
| `snakeColor` | the snake of the heatmap (`heatmap.mode: "snake"`) |
| `frameColor` | the avatar frame (default: the colour of your level) |
| `bg_gradient` | `"angle,color1,color2,..."` for the card background |

```json
{ "colors": { "icon_color": "ff4d5e", "ring_color": "ff8a5c", "fire_color": "ffd166", "title_color": "ffffff" } }
```

<img src="docs/guide/colors-override.png" width="60%">

A full recolor, and a gradient background:

| `bg_color` / `panel_color` / `border_color` / `text_color`… | `bg_gradient: "120,0f2027,203a43,2c5364"` |
|---|---|
| <img src="docs/guide/colors-panels.png"> | <img src="docs/guide/colors-gradient.png"> |

### `colorsByTheme`: per-slot overrides

Same keys as `colors`, applied to one slot only (the slot name, not the theme name):

```json
{
  "themes": { "dark": "dark", "light": "light" },
  "colorsByTheme": { "dark": { "icon_color": "ff6b9a" }, "light": { "icon_color": "d6336c" } }
}
```

| dark slot | light slot |
|---|---|
| <img src="docs/guide/colors-by-theme-dark.png"> | <img src="docs/guide/colors-by-theme-light.png"> |

### `customThemes`: save a palette

Each entry is `{ "base": "<built-in or custom theme>", ...color overrides }`. Use its name in `themes`. A custom theme can't reuse the name of a built-in one.

```json
{
  "themes": { "dark": "ocean-ember", "light": "ocean-ember-light" },
  "customThemes": {
    "ocean-ember": { "base": "ocean", "icon_color": "ff9f1c", "ring_color": "ff4d5e", "fire_color": "ffd166" },
    "ocean-ember-light": {
      "base": "light",
      "bg_color": "f4fbff", "panel_color": "e6f4fb", "border_color": "bcd9e8",
      "text_color": "0b2a3a", "muted_color": "4d6f82",
      "icon_color": "e07a00", "ring_color": "d6293e", "fire_color": "c2410c"
    }
  }
}
```

| dark | light |
|---|---|
| <img src="docs/guide/custom-theme-dark.png"> | <img src="docs/guide/custom-theme-light.png"> |

Another full example: [`presets/cyberpunk.json`](presets/cyberpunk.json).

## Locale and time zone

```json
{ "locale": "it", "timezone": "Europe/Rome" }
```

- `locale`: `en` `it` `es` `fr` `de` `pt-br` `ja` `zh`. It translates labels, months and weekdays.
- `timezone`: any IANA zone. It decides what "today" is for streaks (default `UTC`).

| `it` | `ja` |
|---|---|
| <img src="docs/guide/locale-it.png"> | <img src="docs/guide/locale-ja.png"> |

## Content: about, working on, links, tech stack

These turn the card into your whole README.

```json
{
  "title": "Full-stack engineer",
  "about": ["Paragraph one, **bold** markers are stripped.", "Paragraph two."],
  "workingOn": [{ "title": "forge-api", "description": "Fast, typed REST layer", "url": "https://example.com" }],
  "links": [{ "label": "LinkedIn", "url": "https://…", "icon": "linkedin", "color": "#0A66C2" }],
  "techStack": [{ "category": "Languages", "items": [{ "name": "Python", "image": "assets/img/python.svg" }] }]
}
```

| Key | Meaning |
|---|---|
| `title` | Shown next to `@login` in the header |
| `about` | Paragraphs, wrapped automatically |
| `workingOn` | Project cards: `title` (required), `description`, `url` |
| `links` | One clickable button per link (see below). `label` and `url` are required; `icon` and `color` optional |
| `techStack` | Categories with items `{ name, image }`. Rows scroll in alternating directions; see `marquee` below |
| `marquee` | `{ speed: 28, rows: 2, order: "shuffle", byCategory: false }`: scroll speed (px/s, 5–200), number of rows (1–4), `order` (`shuffle` is reshuffled at every generation, `config` as listed, `name` A–Z) and `byCategory` (order inside each category and keep categories in sequence) |

<img src="docs/guide/content-about.png" width="60%">

<img src="docs/guide/content-stack.png" width="60%">

**Images** are paths relative to `config.json`. They are embedded in the SVG as data URIs (svg, png, jpg, webp, gif). resvg can't decode webp, so webp icons appear in the SVG but not in PNG/GIF exports.

**Links.** GitHub shows README SVGs through `<img>`, which is never clickable, so links are not drawn on the card. Each link gets its own animated button, written to `<output_dir>/buttons/<label>-<slot>.svg`. Wrap it in a link:

```html
<a href="https://linkedin.com/in/you"><picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/buttons/linkedin-dark.svg">
  <img src="assets/buttons/linkedin-light.svg" alt="LinkedIn">
</picture></a>
```

`icon` can be `instagram`, `linkedin`, or any bundled Octicon: `globe`, `github`, `code`, `rocket`, `zap`, `star`, `repo`, `people`…

## Export, private data and other root keys

| Key | Default | Meaning |
|---|---|---|
| `user` | repo owner | GitHub login to render |
| `includePrivate` | `false` | Also count private repositories (stars, languages, repo count). Needs a PAT, see the README |
| `export.png` | `false` | Also write a 2× PNG of the final frame (needs `npm install`, local CLI) |
| `export.gif` | `false` | Also write the animation as a GIF (needs `npm install`, local CLI) |
| `hideSections` | `[]` | See [Layout](#layout-and-sections) |

Not ported from the original projects: `card_width` / `card_height` (the card is 1000 px wide), `cache_seconds` and `type=png|json` (the output is a static file).

## Reference: every key

```jsonc
{
  "$schema": "…/config.schema.json",
  "user": null, "title": null,
  "about": [], "workingOn": [], "links": [], "techStack": [],
  "locale": "en", "timezone": "UTC", "includePrivate": false,
  "themes": ["dark", "light"],          // or { "dark": "...", "light": "..." }
  "customThemes": {}, "colors": {}, "colorsByTheme": {},
  "card": { "radius": 20, "hideBorder": false, "animations": true,
            "background": { "gradient": null, "pattern": "none", "glow": true } },
  "layout": ["header", "about", "workingOn", ["stats", "streak"], "languages", "trophies", "heatmap", "techStack"],
  "grid": null,
  "hideSections": [],
  "header": { "avatar": "circle", "frame": "ring", "frameAnimation": "default", "rankStyle": "ring", "rankThickness": 8,
              "facts": ["contributionsThisYear", "bestDay", "busiestWeekday"], "rankIcon": "level" },
  "stats": { "title": null, "hide": [], "show": [], "icons": true, "numberFormat": "long", "numberPrecision": null,
             "textBold": true, "lineHeight": 30, "commitsYear": null, "excludeRepos": [] },
  "streak": { "title": null, "hide": [], "mode": "daily", "excludeDays": [], "startingYear": null,
              "dateFormat": null, "shortNumbers": false, "excludeDaysLabel": true },
  "languages": { "title": null, "layout": "bar", "count": 8, "hide": [], "excludeRepos": [], "hideProgress": false,
                 "statsFormat": "percentages", "sizeWeight": 1, "countWeight": 0 },
  "trophies": { "title": null, "titles": [], "hideTitles": [], "ranks": [], "hideRanks": [], "columns": 0, "rows": 0,
                "marginW": 14, "marginH": 14, "padding": 20, "align": "center", "parts": ["title", "label", "score", "bar"], "noBg": false, "noFrame": false, "extra": [],
                "birthday": null, "sort": "default", "highlight": [] },
  "terminal": { "title": null, "lines": [] },
  "rhythm": { "title": null, "show": ["weekdays", "months"] },
  "heatmap": { "mode": "grid", "snakePath": "smart", "snakeLength": 6, "snakeStyle": "classic", "weeks": 53, "cell": "square", "weekStart": "sun", "legend": true, "monthLabels": true },
  "export": { "png": false, "gif": false }
}
```

## Regenerating the pictures

```bash
npm install                 # resvg, used for the PNGs
node scripts/gen-docs.js    # all of docs/guide/ and docs/presets/, and TROPHIES.md
node scripts/gen-docs.js dashboard stats-short   # only some
node scripts/demo.js presets/dashboard.json out/dashboard --scale 2   # any config, demo data
node scripts/demo.js presets/dashboard.json out/gems --slot dark --secrets all   # every secret trophy, made-up values
```

`scripts/demo.js` renders a config with fixed demo data, so you can try a config without a token. Output is `<prefix>-<slot>.png` (or `<prefix>.png` with `--slot dark`); add `--svg` for the animated SVG.
