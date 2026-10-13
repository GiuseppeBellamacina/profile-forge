import { normalize } from "./config.js";
import { ALL_LEVELS, TOP, levelOfPercentile } from "./levels.js";

// Pure scoring functions. Algorithms ported from MIT-licensed projects:
//   rank      -> anuraghazra/github-readme-stats (src/calculateRank.js)
//   trophies  -> ryo-ma/github-profile-trophy (src/trophy.ts)
//   streak    -> DenverCoder1/github-readme-streak-stats (src/stats.php)

const expCdf = (x) => 1 - 2 ** -x;
const logNormCdf = (x) => x / (1 + x);

/** github-readme-stats rank, "include_all_commits" variant (commit median 1000). */
export function calculateRank({ commits, prs, issues, reviews, stars, followers }) {
  const score =
    2 * expCdf(commits / 1000) +
    3 * expCdf(prs / 50) +
    1 * expCdf(issues / 25) +
    1 * expCdf(reviews / 2) +
    4 * logNormCdf(stars / 50) +
    1 * logNormCdf(followers / 10);
  const percentile = (1 - score / 12) * 100;
  return { level: levelOfPercentile(percentile), percentile };
}

/**
 * repos: [{ isFork, languages: [{ name, color, size }] }]
 * score = bytes^sizeWeight * repoCount^countWeight, percentages relative to total score.
 */
export function topLanguages(repos, { sizeWeight = 1, countWeight = 0, hide = [], limit = 8, excludeRepos = [] } = {}) {
  const hidden = new Set(hide.map((h) => h.toLowerCase()));
  const langs = new Map();
  for (const repo of repos) {
    if (repo.isFork || excludeRepos.includes(repo.name?.toLowerCase())) continue;
    for (const { name, color, size } of repo.languages) {
      if (hidden.has(name.toLowerCase())) continue;
      const l = langs.get(name) ?? { name, color: color ?? "#858585", size: 0, count: 0 };
      l.size += size;
      l.count += 1;
      langs.set(name, l);
    }
  }
  const scored = [...langs.values()]
    .map((l) => ({ ...l, score: l.size ** sizeWeight * l.count ** countWeight }))
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);
  const total = top.reduce((s, l) => s + l.score, 0) || 1;
  return { total: langs.size, top: top.map((l) => ({ ...l, percent: (l.score / total) * 100 })) };
}

/**
 * days: [[ "YYYY-MM-DD", count ], ...] sorted ascending, last entry is "today".
 * Today with 0 contributions does not break the current streak.
 * exclude: set of weekday numbers (0 = Sunday) skipped entirely.
 */
export function computeStreak(days, exclude = new Set(), mode = "daily") {
  if (mode === "weekly") return weeklyStreak(days);
  const today = days.at(-1)?.[0];
  let total = 0;
  let cur = { length: 0, start: null, end: null };
  let longest = { ...cur };
  let first = null;
  for (const [date, count] of days) {
    total += count;
    // Excluded weekdays (0 = Sunday) neither extend nor break a streak.
    if (exclude.has(new Date(date + "T00:00:00Z").getUTCDay())) continue;
    if (count > 0) {
      cur.length++;
      cur.end = date;
      if (cur.length === 1) cur.start = date;
      first ??= date;
      if (cur.length > longest.length) longest = { ...cur };
    } else if (date !== today) {
      cur = { length: 0, start: null, end: null };
    }
  }
  return { total, current: cur, longest, first };
}

/** Weekly mode: a Sunday-to-Saturday week keeps the streak alive with any contribution; the running week never breaks it. */
function weeklyStreak(days) {
  const weeks = new Map(); // Sunday -> { count, end }
  let total = 0;
  for (const [date, count] of days) {
    total += count;
    const d = new Date(date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    const key = d.toISOString().slice(0, 10);
    const w = weeks.get(key) ?? { count: 0, end: date };
    w.count += count;
    w.end = date;
    weeks.set(key, w);
  }
  const keys = [...weeks.keys()];
  let cur = { length: 0, start: null, end: null };
  let longest = { ...cur };
  let first = null;
  for (const key of keys) {
    const w = weeks.get(key);
    if (w.count > 0) {
      cur.length++;
      cur.end = w.end;
      if (cur.length === 1) cur.start = key;
      first ??= key;
      if (cur.length > longest.length) longest = { ...cur };
    } else if (key !== keys.at(-1)) cur = { length: 0, start: null, end: null };
  }
  return { total, current: cur, longest, first };
}

/** Extra facts from the same calendar. */
export function calendarFacts(days) {
  const weekday = Array(7).fill(0);
  let best = ["", 0];
  for (const [date, count] of days) {
    weekday[new Date(date + "T00:00:00Z").getUTCDay()] += count;
    if (count > best[1]) best = [date, count];
  }
  const year = days.at(-1)?.[0].slice(0, 4);
  const thisYear = days.filter(([d]) => d.startsWith(year)).reduce((s, [, c]) => s + c, 0);
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const busiestWeekdayIndex = weekday.indexOf(Math.max(...weekday));
  return { bestDay: best, busiestWeekday: names[busiestWeekdayIndex], busiestWeekdayIndex, thisYear };
}

// Every title has 8 thresholds (highest first); they become the 7 levels S+, S, A, B, C, D, E (the second old "A" folds into B).
const LEVEL_TIER = [0, 1, 2, 3, 5, 6, 7];
const TROPHY_LEVELS = [...ALL_LEVELS].reverse();
const TROPHIES = [
  ["Stars", "stars", [2000, 700, 200, 100, 50, 30, 10, 1],
    ["Super Stargazer", "High Stargazer", "Stargazer", "Super Star", "High Star", "You are a Star", "Middle Star", "First Star"]],
  ["Commits", "commits", [4000, 2000, 1000, 500, 200, 100, 10, 1],
    ["God Committer", "Deep Committer", "Super Committer", "Ultra Committer", "Hyper Committer", "High Committer", "Middle Committer", "First Commit"]],
  ["Followers", "followers", [1000, 400, 200, 100, 50, 20, 10, 1],
    ["Super Celebrity", "Ultra Celebrity", "Hyper Celebrity", "Famous User", "Active User", "Dynamic User", "Many Friends", "First Friend"]],
  ["PullRequest", "prs", [1000, 500, 200, 100, 50, 20, 10, 1],
    ["God Puller", "Deep Puller", "Super Puller", "Ultra Puller", "Hyper Puller", "High Puller", "Middle Puller", "First Pull"]],
  ["Repositories", "repos", [50, 45, 40, 35, 30, 20, 10, 1],
    ["God Repo Creator", "Deep Repo Creator", "Super Repo Creator", "Ultra Repo Creator", "Hyper Repo Creator", "High Repo Creator", "Middle Repo Creator", "First Repository"]],
  ["Issues", "issues", [1000, 500, 200, 100, 50, 20, 10, 1],
    ["God Issuer", "Deep Issuer", "Super Issuer", "Ultra Issuer", "Hyper Issuer", "High Issuer", "Middle Issuer", "First Issue"], true],
  ["Reviews", "reviews", [70, 57, 45, 30, 20, 8, 3, 1],
    ["God Reviewer", "Deep Reviewer", "Super Reviewer", "Ultra Reviewer", "Hyper Reviewer", "High Reviewer", "Middle Reviewer", "First Review"], true],
  ["Experience", "experience", [70, 55, 40, 28, 18, 11, 6, 2],
    ["Seasoned Veteran", "Grandmaster", "Master Dev", "Expert Dev", "Experienced Dev", "Intermediate Dev", "Junior Dev", "Newbie"]],
];

const BASE = ["Stars", "Commits", "Followers", "PullRequest", "Repositories", "Experience"];
/** Names a trophy answers to in `titles` / `hideTitles` filters (lowercase, besides its own title). */
const ALIASES = {
  stars: ["star"], commits: ["commit"], followers: ["follower"], issues: ["issue"], pullrequest: ["pr", "pulls", "puller"],
  repositories: ["repo", "repository"], reviews: ["review"], experience: ["duration", "since"],
  multilanguage: ["multiplelang"], organizations: ["orgs", "teams"],
};
export const trophyMatches = (title, tokens) => {
  const t = title.toLowerCase();
  return tokens.has(t) || (ALIASES[t] ?? []).some((a) => tokens.has(a));
};

/** s: { stars, commits, followers, issues, prs, repos, reviews, experience(days/100), years, organizations, languageCount, firstYear }; extra: Set of "issues"/"reviews" */
export function trophies(s, extra = new Set()) {
  const list = TROPHIES.filter((t) => !t[4] || extra.has(t[0].toLowerCase())).map(([title, key, reqs, labels]) => {
    const score = s[key];
    const lreqs = LEVEL_TIER.map((t) => reqs[t]);
    const i = lreqs.findIndex((r) => score >= r);
    const rank = i === -1 ? "?" : TROPHY_LEVELS[i];
    const progress = i === -1 ? Math.min(score / lreqs.at(-1), 1) : i === 0 ? 1 : (score - lreqs[i]) / (lreqs[i - 1] - lreqs[i]);
    return { title, rank, label: i === -1 ? "Unknown" : labels[LEVEL_TIER[i]], score: key === "experience" ? s.years : score, progress };
  });
  const secret = [
    [s.languageCount >= 10, "MultiLanguage", "Rainbow Lang User"],
    [s.years >= 10, "LongTimeUser", "Village Elder"],
    [s.organizations >= 3, "Organizations", "Jack of all Trades"],
    [s.firstYear === 2020, "Joined2020", "Everything started..."],
    [s.firstYear <= 2010, "AncientUser", "Ancient User"],
    [s.firstYear <= 2008, "OGUser", "OG User"],
    [list.filter((t) => BASE.includes(t.title)).every((t) => t.rank === "S" || t.rank === TOP), "AllSuperRank", "S Rank Hacker"],
  ];
  for (const [ok, title, label] of secret) if (ok) list.push({ title, rank: "SECRET", label, score: null, progress: 1 });
  return list;
}

const DAY = 86_400_000;

/** Combine raw profile data (src/github.js) into everything the card shows. k: normalized config (src/config.js). */
export function summarize(p, k = normalize(), now = Date.now()) {
  const skip = new Set(k.stats.excludeRepos);
  const repos = p.repos.filter((r) => !skip.has(r.name?.toLowerCase()));
  const languages = topLanguages(p.repos, { ...k.languages, limit: k.languages.count, excludeRepos: [...new Set([...skip, ...k.languages.excludeRepos])] });
  const ageMs = now - new Date(p.earliest);
  const years = Math.floor(ageMs / (365.25 * DAY));
  const s = {
    stars: skip.size && repos.every((r) => r.stars !== undefined) ? repos.reduce((n, r) => n + r.stars, 0) : p.stars,
    commits: k.stats.commitsYear ? (p.commitsByYear?.[k.stats.commitsYear] ?? 0) : p.commits,
    prs: p.prs, issues: p.issues, reviews: p.reviews, followers: p.followers,
    repos: skip.size ? repos.length : p.repoCount, contributedTo: p.contributedTo,
    prsMerged: p.mergedPrs ?? 0, discussionsStarted: p.discussionsStarted ?? 0, discussionsAnswered: p.discussionsAnswered ?? 0,
  };
  s.prsMergedPercentage = p.prs ? (s.prsMerged / p.prs) * 100 : 0;
  return {
    ...p,
    stats: s,
    years,
    rank: calculateRank(s),
    languages,
    streak: computeStreak(p.days, k.streak.excludeDays, k.streak.mode),
    facts: calendarFacts(p.days),
    trophies: trophies(
      {
        ...s,
        experience: Math.floor(ageMs / DAY / 100),
        years,
        organizations: p.organizations,
        languageCount: languages.total,
        firstYear: new Date(p.earliest).getUTCFullYear(),
      },
      k.trophies.extra,
    ),
  };
}
