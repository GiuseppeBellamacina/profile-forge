<div align="center">

# profile-forge

**One animated card for your GitHub profile README.** It shows your rank, stats, streaks, top languages, trophies and contribution heatmap.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/profile-forge-dark.svg">
  <img src="docs/profile-forge-light.svg" alt="profile-forge card" width="100%">
</picture>

</div>

## Why

Most profile READMEs stack three or four widgets from public hosted services ([github-readme-stats](https://github.com/anuraghazra/github-readme-stats), [github-profile-trophy](https://github.com/ryo-ma/github-profile-trophy), [github-readme-streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats)). Those shared instances often hit API rate limits and show a broken image.

profile-forge works differently:

- **Everything in one card.** Your rank, stats, streaks, languages, trophies and heatmap share one design.
- **No server.** A scheduled GitHub Action in your profile repo writes the SVG and commits it, so the image can't break from someone else's rate limit.
- **Your own token.** It can count private contributions when you give it a PAT.
- **No dependencies needed to generate the card.** You only need Node ≥ 20. PNG and GIF export are optional extras.

## What's on the card

| Section | Details |
|---|---|
| Header | Avatar, name, account age, contributions this year, best day, most active weekday |
| Rank | The same rank formula as github-readme-stats (S … C, with a "top X%" percentile), drawn as an animated ring |
| Stats | Stars, all-time commits, PRs, issues, code reviews, repos contributed to, followers, repositories |
| Streak | Total contributions, current streak and longest streak with date ranges (a day with zero contributions *today* does not break the streak) |
| Top languages | Animated stacked bar and legend, with configurable `size_weight` / `count_weight` ranking |
| Trophies | The same tiers and thresholds as github-profile-trophy (SSS … C), plus secret trophies |
| Heatmap | The last 53 weeks of contributions |

All-time commits are added up from `contributionsCollection` year by year through GraphQL, so profile-forge doesn't need the REST commit search.

## Quick start (GitHub Action)

1. In your profile repo (`<login>/<login>`), create `.github/workflows/profile-forge.yml`:

   ```yaml
   name: profile-forge
   on:
     schedule: [{ cron: "0 3 * * *" }]
     workflow_dispatch:
   permissions:
     contents: write
   jobs:
     card:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: GiuseppeBellamacina/profile-forge@v1
           with:
             token: ${{ secrets.PROFILE_FORGE_TOKEN || github.token }}
             timezone: Europe/Rome
         - run: |
             git config user.name "github-actions[bot]"
             git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
             git add assets
             git diff --cached --quiet || (git commit -m "chore: refresh profile card" && git pull --rebase && git push)
   ```

   The same workflow is in [`examples/profile-workflow.yml`](examples/profile-workflow.yml).

2. Add the card to your `README.md`:

   ```html
   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="assets/profile-forge-dark.svg">
     <img src="assets/profile-forge-light.svg" alt="GitHub profile card" width="100%">
   </picture>
   ```

3. Run the workflow once from the **Actions** tab (`workflow_dispatch`).

### Private contributions (optional)

The default `github.token` can only see public data. To include private contributions:

1. Create a **classic** personal access token with the `read:user` and `repo` scopes.
2. Add it to your profile repo as the secret `PROFILE_FORGE_TOKEN`.

Private *repositories* still don't count toward stars, languages or repo count unless you also set `include_private: true`.

### Action inputs

| Input | Default | Description |
|---|---|---|
| `username` | repo owner | Login to render |
| `token` | `github.token` | GraphQL token |
| `output_dir` | `assets` | Output folder |
| `name` | `profile-forge` | File base name, giving `<name>-<theme>.svg` |
| `themes` | `dark,light` | Themes to render |
| `timezone` | `UTC` | IANA zone that decides what "today" is for streaks |
| `size_weight` | `1` | Language score = `bytes^size_weight × repos^count_weight` |
| `count_weight` | `0` | See above. Setting `0.01` / `0.4` ranks languages mostly by how many repos use them |
| `hide` | – | Comma-separated languages to hide, e.g. `html,css` |
| `include_private` | `false` | Include private repos in stars, languages and repo count |

## Local CLI, PNG and GIF

```bash
git clone https://github.com/GiuseppeBellamacina/profile-forge && cd profile-forge
npm install                      # only needed for --png / --gif
export GITHUB_TOKEN=$(gh auth token)
node src/cli.js --user <login> --tz Europe/Rome --png --gif
# -> out/profile-forge-{dark,light}.{svg,png,gif}
```

- **PNG**: the final frame rendered at 2× with [resvg](https://github.com/yisibl/resvg-js).
- **GIF**: the card's animation rendered frame by frame (15 fps, holds 3 s on the last frame) and encoded with [gifenc](https://github.com/mattdesl/gifenc).

Every animated element is described once as a (delay, duration, from → to) value. The SVG turns that into CSS keyframes, and the PNG/GIF export samples the same timeline as static frames, so all three outputs always match.

Run `node src/cli.js --help` to see every flag.

## How the numbers are computed

- **Rank:** `1 − Σwᵢ·cdf(xᵢ/medianᵢ) / Σwᵢ`, using exponential CDFs for commits (median 1000, w=2), PRs (50, w=3), issues (25, w=1) and reviews (2, w=1), and log-normal CDFs for stars (50, w=4) and followers (10, w=1). The result is mapped to S / A+ / A / A- / B+ / B / B- / C+ / C at the 1 / 12.5 / 25 / … / 100 percentile thresholds.
- **Trophies:** Stars, Commits, Followers, Issues, PRs, Repos, Reviews and Experience, each with eight tiers (SSS → C). Secret trophies appear only once earned: Rainbow (10+ languages), Village Elder (10+ years), Jack of all Trades (3+ orgs), Joined 2020, and All-S.
- **Streak:** computed from your daily contribution calendar across every year since you joined, in the configured time zone.

## Development

```bash
npm test     # node:test, zero deps
```

```
src/github.js   GraphQL fetching (profile, repos, per-year calendars)
src/stats.js    rank, languages, streak, trophies (pure functions)
src/render.js   SVG renderer + themes + animation timeline
src/export.js   PNG/GIF export (optional deps)
src/cli.js      CLI entry point (used by action.yml)
```

`reference/` is git-ignored. It's the place to clone the original projects if you want to study them.

## Credits

The algorithms are ported from [github-readme-stats](https://github.com/anuraghazra/github-readme-stats), [github-profile-trophy](https://github.com/ryo-ma/github-profile-trophy) and [github-readme-streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats), all MIT-licensed. Icons are from [Octicons](https://github.com/primer/octicons). The project was inspired by [lowlighter/metrics](https://github.com/lowlighter/metrics) and [Platane/snk](https://github.com/Platane/snk).

MIT © Giuseppe Bellamacina
