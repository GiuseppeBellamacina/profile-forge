// Pure scoring functions. Algorithms ported from MIT-licensed projects:
//   rank      -> anuraghazra/github-readme-stats (src/calculateRank.js)
//   trophies  -> ryo-ma/github-profile-trophy (src/trophy.ts)
//   streak    -> DenverCoder1/github-readme-streak-stats (src/stats.php)

const expCdf = (x) => 1 - 2 ** -x;
const logNormCdf = (x) => x / (1 + x);

const RANK_THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
const RANK_LEVELS = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];

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
  const level = RANK_LEVELS[RANK_THRESHOLDS.findIndex((t) => percentile <= t)];
  return { level, percentile };
}

/**
 * repos: [{ isFork, languages: [{ name, color, size }] }]
 * score = bytes^sizeWeight * repoCount^countWeight, percentages relative to total score.
 */
export function topLanguages(repos, { sizeWeight = 1, countWeight = 0, hide = [], limit = 8 } = {}) {
  const hidden = new Set(hide.map((h) => h.toLowerCase()));
  const langs = new Map();
  for (const repo of repos) {
    if (repo.isFork) continue;
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
 */
export function computeStreak(days) {
  const today = days.at(-1)?.[0];
  let total = 0;
  let cur = { length: 0, start: null, end: null };
  let longest = { ...cur };
  let first = null;
  for (const [date, count] of days) {
    total += count;
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
  return { bestDay: best, busiestWeekday: names[weekday.indexOf(Math.max(...weekday))], thisYear };
}

const TROPHY_RANKS = ["SSS", "SS", "S", "AAA", "AA", "A", "B", "C"];
const TROPHIES = [
  ["Stars", "stars", [2000, 700, 200, 100, 50, 30, 10, 1],
    ["Super Stargazer", "High Stargazer", "Stargazer", "Super Star", "High Star", "You are a Star", "Middle Star", "First Star"]],
  ["Commits", "commits", [4000, 2000, 1000, 500, 200, 100, 10, 1],
    ["God Committer", "Deep Committer", "Super Committer", "Ultra Committer", "Hyper Committer", "High Committer", "Middle Committer", "First Commit"]],
  ["Followers", "followers", [1000, 400, 200, 100, 50, 20, 10, 1],
    ["Super Celebrity", "Ultra Celebrity", "Hyper Celebrity", "Famous User", "Active User", "Dynamic User", "Many Friends", "First Friend"]],
  ["Issues", "issues", [1000, 500, 200, 100, 50, 20, 10, 1],
    ["God Issuer", "Deep Issuer", "Super Issuer", "Ultra Issuer", "Hyper Issuer", "High Issuer", "Middle Issuer", "First Issue"]],
  ["PRs", "prs", [1000, 500, 200, 100, 50, 20, 10, 1],
    ["God Puller", "Deep Puller", "Super Puller", "Ultra Puller", "Hyper Puller", "High Puller", "Middle Puller", "First Pull"]],
  ["Repos", "repos", [50, 45, 40, 35, 30, 20, 10, 1],
    ["God Repo Creator", "Deep Repo Creator", "Super Repo Creator", "Ultra Repo Creator", "Hyper Repo Creator", "High Repo Creator", "Middle Repo Creator", "First Repository"]],
  ["Reviews", "reviews", [70, 57, 45, 30, 20, 8, 3, 1],
    ["God Reviewer", "Deep Reviewer", "Super Reviewer", "Ultra Reviewer", "Hyper Reviewer", "Active Reviewer", "Intermediate Reviewer", "New Reviewer"]],
  ["Experience", "experience", [70, 55, 40, 28, 18, 11, 6, 2],
    ["Seasoned Veteran", "Grandmaster", "Master Dev", "Expert Dev", "Experienced Dev", "Intermediate Dev", "Junior Dev", "Newbie"]],
];

/** s: { stars, commits, followers, issues, prs, repos, reviews, experience(days/100), years, organizations, languageCount, firstYear } */
export function trophies(s) {
  const list = TROPHIES.map(([title, key, reqs, labels]) => {
    const score = s[key];
    const i = reqs.findIndex((r) => score >= r);
    const rank = i === -1 ? "?" : TROPHY_RANKS[i];
    const progress = i === -1 ? Math.min(score / reqs.at(-1), 1) : i === 0 ? 1 : (score - reqs[i]) / (reqs[i - 1] - reqs[i]);
    return { title, rank, label: i === -1 ? "Unknown" : labels[i], score: key === "experience" ? s.years : score, progress };
  });
  const secret = [
    [s.languageCount >= 10, "Rainbow", "Rainbow Lang User"],
    [s.years >= 10, "Elder", "Village Elder"],
    [s.organizations >= 3, "Orgs", "Jack of all Trades"],
    [s.firstYear === 2020, "2020", "Everything started..."],
    [list.every((t) => t.rank.startsWith("S")), "AllSuper", "S Rank Hacker"],
  ];
  for (const [ok, title, label] of secret) if (ok) list.push({ title, rank: "SECRET", label, score: null, progress: 1 });
  return list;
}

const DAY = 86_400_000;

/** Combine raw profile data (src/github.js) into everything the card shows. */
export function summarize(p, { sizeWeight, countWeight, hide, now = Date.now() } = {}) {
  const languages = topLanguages(p.repos, { sizeWeight, countWeight, hide });
  const ageMs = now - new Date(p.earliest);
  const years = Math.floor(ageMs / (365.25 * DAY));
  const s = {
    stars: p.stars, commits: p.commits, prs: p.prs, issues: p.issues, reviews: p.reviews,
    followers: p.followers, repos: p.repoCount, contributedTo: p.contributedTo,
  };
  return {
    ...p,
    stats: s,
    years,
    rank: calculateRank(s),
    languages,
    streak: computeStreak(p.days),
    facts: calendarFacts(p.days),
    trophies: trophies({
      ...s,
      experience: Math.floor(ageMs / DAY / 100),
      years,
      organizations: p.organizations,
      languageCount: languages.total,
      firstYear: new Date(p.earliest).getUTCFullYear(),
    }),
  };
}
