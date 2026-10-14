// Secret trophies: curiosities hidden in the GitHub data. Each one is earned from a fact (see `funFacts`), shows up only when
// earned, and has its own glyph and tone. `value` is the small line under the name (defaults to "SECRET").

/** The author of the forge: whoever follows them back and is followed by them gets the friend trophy. */
export const AUTHOR = "GiuseppeBellamacina";
const DAY = 86_400_000;
const iso = (d) => d.toISOString().slice(0, 10);
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // days in month m (1-12)
const n = (x) => x ?? 0;
const pt = (x, unit) => `${x} ${unit}`;

const OLD_GUARD = ["cobol", "fortran", "assembly", "pascal", "perl", "lisp", "common lisp", "ada", "smalltalk", "object pascal", "delphi", "tcl", "visual basic", "vba"];
const FUNCTIONAL = ["haskell", "ocaml", "elixir", "erlang", "f#", "clojure", "scala", "elm", "racket", "purescript", "scheme", "reason"];
const ESOTERIC = ["brainfuck", "befunge", "malbolge", "whitespace", "lolcode", "piet", "shakespeare", "chef", "intercal", "unlambda", "jelly", "golfscript"];

/** Everything the secret trophies need, derived from the raw profile (src/github.js) and the contribution calendar. */
/** langs: every language by size (topLanguages with a big limit); busiest: name of the busiest weekday; birthday: "MM-DD" or "YYYY-MM-DD" from the config; today: "MM-DD" in the card's time zone. */
export function funFacts(p, { streak, langs = { top: [] }, busiest, birthday = null, today = null } = {}) {
  const days = p.days ?? [];
  const total = days.reduce((s, [, c]) => s + c, 0);
  const active = days.filter(([, c]) => c > 0);
  const md = new Set(active.map(([d]) => d.slice(5)));
  let weekend = 0;
  let friday13 = false;
  let programmersDay = false;
  const octDays = new Map();
  const monthsOfYear = new Map();
  const weeks = new Map();
  const months = new Map();
  for (const [date, count] of days) {
    const d = new Date(date + "T00:00:00Z");
    const wd = d.getUTCDay();
    const y = Number(date.slice(0, 4));
    const sunday = new Date(d - wd * DAY);
    const wk = iso(sunday);
    const w = weeks.get(wk) ?? { days: 0, active: 0 };
    w.days++;
    const mk = date.slice(0, 7);
    const m = months.get(mk) ?? { days: 0, active: 0 };
    m.days++;
    if (count > 0) {
      w.active++;
      m.active++;
      if (wd === 0 || wd === 6) weekend += count;
      if (wd === 5 && date.slice(8) === "13") friday13 = true;
      if (Math.round((d - Date.UTC(y, 0, 1)) / DAY) + 1 === 256) programmersDay = true;
      if (date.slice(5, 7) === "10") octDays.set(y, (octDays.get(y) ?? 0) + 1);
      const ms = monthsOfYear.get(y) ?? new Set();
      ms.add(date.slice(5, 7));
      monthsOfYear.set(y, ms);
    }
    weeks.set(wk, w);
    months.set(mk, m);
  }
  // longest silence that was followed by a return to activity
  let gap = 0;
  let longestGap = 0;
  let comeback = false;
  for (const [i, [, c]] of days.entries()) {
    if (c === 0) gap++;
    else {
      if (gap >= 90 && active.length - active.findIndex(([d]) => d === days[i][0]) >= 14) comeback = true;
      longestGap = Math.max(longestGap, gap);
      gap = 0;
    }
  }
  const last = days.slice(-365);

  const own = (p.repos ?? []).filter((r) => !r.isFork);
  const names = new Set((p.repos ?? []).map((r) => r.name?.toLowerCase()));
  const langNames = new Set(langs.top.map((l) => l.name.toLowerCase()));
  const lead = langs.top[0];
  const has = (list) => list.find((l) => langNames.has(l));
  return {
    total,
    activeDays: active.length,
    longestStreak: streak?.longest?.length ?? 0,
    bestDay: Math.max(0, ...days.map(([, c]) => c)),
    weekendShare: total ? weekend / total : 0,
    md,
    friday13,
    programmersDay,
    octoberDays: Math.max(0, ...octDays.values()),
    monthsInYear: Math.max(0, ...[...monthsOfYear.values()].map((s) => s.size)),
    perfectWeek: [...weeks.values()].some((w) => w.days === 7 && w.active === 7),
    perfectMonth: [...months.entries()].some(([k, m]) => m.days === dim(Number(k.slice(0, 4)), Number(k.slice(5))) && m.active === m.days),
    comeback,
    longestGap,
    lastYearActive: last.length >= 365 ? last.filter(([, c]) => c > 0).length / last.length : 0,
    busiestWeekday: busiest,
    repos: (p.repos ?? []).length,
    forks: (p.repos ?? []).filter((r) => r.isFork).length,
    own: own.length,
    topRepoStars: Math.max(0, ...own.map((r) => n(r.stars))),
    forkedTimes: own.reduce((s, r) => s + n(r.forkCount), 0),
    archived: own.filter((r) => r.isArchived).length,
    licensed: own.filter((r) => r.licensed && !r.isArchived).length,
    unarchivedOwn: own.filter((r) => !r.isArchived).length,
    dotfiles: names.has("dotfiles") || names.has(".dotfiles"),
    selfRepo: names.has(String(p.login).toLowerCase()),
    helloWorld: own.some((r) => /^hello[-_ ]?world$/i.test(r.name ?? "")),
    leadLanguage: lead?.name,
    leadShare: lead ? (lead.size / (langs.top.reduce((s, l) => s + l.size, 0) || 1)) * 100 : 0,
    oldGuard: has(OLD_GUARD),
    functional: has(FUNCTIONAL),
    esoteric: has(ESOTERIC),
    gists: n(p.gists),
    following: n(p.following),
    starred: n(p.starred),
    sponsors: n(p.sponsors),
    sponsoring: n(p.sponsoring),
    badges: p.badges ?? {},
    birthday: !!birthday && !!today && birthday.slice(-5) === today,
    friend: !!p.friend,
  };
}

// glyph: an octicon name ("i:flame"), a custom stroke drawing ("g:moon") or a word ("t:1337"). tone: the colour family.
// Old trophies keep their title so `titles` / `hideTitles` filters and configs written before keep working.
export const SECRETS = [
  // — the original six, and the rank one —
  { title: "MultiLanguage", label: "Rainbow Coder", glyph: "g:rainbow", tone: "cyan", hint: "10 or more languages", when: (s) => s.languageCount >= 10, value: (s) => pt(s.languageCount, "langs") },
  { title: "LongTimeUser", label: "Village Elder", glyph: "g:hourglass", tone: "violet", hint: "10 years on GitHub", when: (s) => s.years >= 10, value: (s) => pt(s.years, "yrs") },
  { title: "Organizations", label: "Jack of Trades", glyph: "i:org", tone: "teal", hint: "member of 3 organizations", when: (s) => s.organizations >= 3, value: (s) => pt(s.organizations, "orgs") },
  { title: "AncientUser", label: "Ancient User", glyph: "g:scroll", tone: "amber", hint: "joined in 2010 or before", when: (s) => s.firstYear <= 2010 },
  { title: "OGUser", label: "OG User", glyph: "g:crown", tone: "gold", hint: "joined in 2008 or before", when: (s) => s.firstYear <= 2008 },
  { title: "AllSuperRank", label: "S Rank Hacker", glyph: "t:S", tone: "gold", hint: "S or better in every base trophy", when: (s) => s.allSuper },

  // — the calendar —
  { title: "HundredDays", label: "100 Days", glyph: "t:100", tone: "orange", hint: "a streak of 100 days", when: (s, f) => f.longestStreak >= 100, value: (s, f) => pt(f.longestStreak, "days") },
  { title: "FullOrbit", label: "Full Orbit", glyph: "g:orbit", tone: "orange", hint: "a streak of a whole year", when: (s, f) => f.longestStreak >= 365, value: (s, f) => pt(f.longestStreak, "days") },
  { title: "PerfectWeek", label: "Perfect Week", glyph: "i:calendar", tone: "green", hint: "all seven days of a week", when: (s, f) => f.perfectWeek },
  { title: "PerfectMonth", label: "Perfect Month", glyph: "g:check", tone: "green", hint: "every day of a calendar month", when: (s, f) => f.perfectMonth },
  { title: "TwelveMonths", label: "All Seasons", glyph: "g:seasons", tone: "teal", hint: "a contribution in each month of a year", when: (s, f) => f.monthsInYear >= 12 },
  { title: "IronHabit", label: "Iron Habit", glyph: "g:anvil", tone: "slate", hint: "active on 80% of the last 365 days", when: (s, f) => f.lastYearActive >= 0.8, value: (s, f) => `${Math.round(f.lastYearActive * 100)}%` },
  { title: "ThousandDays", label: "Thousand Club", glyph: "t:1K", tone: "violet", hint: "1000 days with contributions", when: (s, f) => f.activeDays >= 1000, value: (s, f) => pt(f.activeDays, "days") },
  { title: "Marathon", label: "Marathon Day", glyph: "g:mountain", tone: "orange", hint: "100 contributions in one day", when: (s, f) => f.bestDay >= 100, value: (s, f) => pt(f.bestDay, "in a day") },
  { title: "Phoenix", label: "Phoenix", glyph: "g:phoenix", tone: "red", hint: "came back after 90+ quiet days", when: (s, f) => f.comeback, value: (s, f) => pt(f.longestGap, "days off") },
  { title: "Elite", label: "Elite", glyph: "t:1337", tone: "green", hint: "1337 contributions", when: (s, f) => f.total >= 1337 },
  { title: "OverNineThousand", label: "Over 9000!", glyph: "t:9K+", tone: "red", hint: "more than 9000 contributions", when: (s, f) => f.total > 9000, value: (s, f) => `${f.total}` },
  { title: "WeekendWarrior", label: "Weekend Warrior", glyph: "g:sun", tone: "amber", hint: "35% of contributions on weekends", when: (s, f) => f.total >= 100 && f.weekendShare >= 0.35, value: (s, f) => `${Math.round(f.weekendShare * 100)}%` },
  { title: "OfficeHours", label: "Office Hours", glyph: "g:clock", tone: "slate", hint: "almost nothing on weekends", when: (s, f) => f.total >= 300 && f.weekendShare <= 0.05, value: (s, f) => `${Math.round(f.weekendShare * 100)}%` },
  { title: "FridayDeployer", label: "Friday Deployer", glyph: "i:rocket", tone: "rose", hint: "Friday is your busiest day", when: (s, f) => f.total >= 100 && f.busiestWeekday === "Friday" },
  { title: "Hacktoberfest", label: "Hacktoberfest Hero", glyph: "g:ghost", tone: "orange", hint: "10 active days in one October", when: (s, f) => f.octoberDays >= 10, value: (s, f) => pt(f.octoberDays, "days") },

  // — days of the year —
  { title: "SantasHelper", label: "Santa's Helper", glyph: "g:tree", tone: "green", hint: "contributed on December 25", when: (s, f) => f.md.has("12-25") },
  { title: "Resolution", label: "Resolution Keeper", glyph: "g:sparkle", tone: "gold", hint: "contributed on January 1", when: (s, f) => f.md.has("01-01") },
  { title: "TrickOrCommit", label: "Trick or Commit", glyph: "g:ghost", tone: "violet", hint: "contributed on October 31", when: (s, f) => f.md.has("10-31") },
  { title: "CodeLover", label: "Code Lover", glyph: "g:heart", tone: "pink", hint: "contributed on February 14", when: (s, f) => f.md.has("02-14") },
  { title: "LeapDay", label: "Leap of Faith", glyph: "g:frog", tone: "green", hint: "contributed on February 29", when: (s, f) => f.md.has("02-29") },
  { title: "Friday13", label: "Unlucky Coder", glyph: "t:13", tone: "slate", hint: "contributed on a Friday the 13th", when: (s, f) => f.friday13 },
  { title: "PiDay", label: "Pi Day", glyph: "g:pi", tone: "cyan", hint: "contributed on March 14", when: (s, f) => f.md.has("03-14") },
  { title: "MayTheFourth", label: "May the Fourth", glyph: "g:saber", tone: "cyan", hint: "contributed on May 4", when: (s, f) => f.md.has("05-04") },
  { title: "Day256", label: "Programmer's Day", glyph: "t:256", tone: "teal", hint: "contributed on the 256th day of a year", when: (s, f) => f.programmersDay },
  { title: "Birthday", label: "Happy Birthday!", glyph: "g:cake", tone: "pink", hint: "today is your birthday (set trophies.birthday in the config)", when: (s, f) => f.birthday },

  // — repositories —
  { title: "Forkaholic", label: "Forkaholic", glyph: "g:fork", tone: "teal", hint: "half of your repositories are forks", when: (s, f) => f.repos >= 6 && f.forks / f.repos >= 0.5, value: (s, f) => pt(f.forks, "forks") },
  { title: "OriginalMind", label: "Original Mind", glyph: "g:bulb", tone: "amber", hint: "10 repositories, none of them a fork", when: (s, f) => f.own >= 10 && f.forks === 0, value: (s, f) => pt(f.own, "repos") },
  { title: "RepoHoarder", label: "Repo Hoarder", glyph: "g:stack", tone: "violet", hint: "100 repositories", when: (s, f) => f.repos >= 100, value: (s, f) => pt(f.repos, "repos") },
  { title: "HitSingle", label: "Hit Single", glyph: "i:star", tone: "gold", hint: "a repository with 100 stars", when: (s, f) => f.topRepoStars >= 100, value: (s, f) => pt(f.topRepoStars, "stars") },
  { title: "ChartTopper", label: "Chart Topper", glyph: "g:flare", tone: "gold", hint: "a repository with 1000 stars", when: (s, f) => f.topRepoStars >= 1000, value: (s, f) => pt(f.topRepoStars, "stars") },
  { title: "Forkable", label: "Forkable", glyph: "g:fork", tone: "cyan", hint: "your repositories were forked 50 times", when: (s, f) => f.forkedTimes >= 50, value: (s, f) => pt(f.forkedTimes, "forks") },
  { title: "GraveKeeper", label: "Grave Keeper", glyph: "g:grave", tone: "slate", hint: "3 archived repositories", when: (s, f) => f.archived >= 3, value: (s, f) => pt(f.archived, "archived") },
  { title: "LicensedToShip", label: "Licensed to Ship", glyph: "g:shield", tone: "green", hint: "5 licensed repositories, 80% of the active ones", when: (s, f) => f.licensed >= 5 && f.licensed / f.unarchivedOwn >= 0.8, value: (s, f) => pt(f.licensed, "licensed") },
  { title: "Dotfiles", label: "Dotfile Devotee", glyph: "g:dotfile", tone: "slate", hint: "a dotfiles repository", when: (s, f) => f.dotfiles },
  { title: "ProfileCrafter", label: "Profile Crafter", glyph: "g:brush", tone: "pink", hint: "a repository named like you", when: (s, f) => f.selfRepo },
  { title: "HelloWorld", label: "Hello, World!", glyph: "g:terminal", tone: "green", hint: "a hello-world repository of your own", when: (s, f) => f.helloWorld },

  // — languages —
  { title: "Rustacean", label: "Rustacean", glyph: "t:.rs", tone: "orange", hint: "Rust is your top language", when: (s, f) => f.leadLanguage === "Rust" },
  { title: "Pythonista", label: "Pythonista", glyph: "t:.py", tone: "cyan", hint: "Python is your top language", when: (s, f) => f.leadLanguage === "Python" },
  { title: "Gopher", label: "Gopher", glyph: "t:.go", tone: "teal", hint: "Go is your top language", when: (s, f) => f.leadLanguage === "Go" },
  { title: "OneTrueLang", label: "One True Language", glyph: "g:target", tone: "rose", hint: "90% of your code is in one language", when: (s, f) => f.leadShare >= 90 && f.repos >= 3, value: (s, f) => `${Math.round(f.leadShare)}%` },
  { title: "OldGuard", label: "Old Guard", glyph: "t:0x", tone: "amber", hint: "code in COBOL, Fortran, Assembly, Perl...", when: (s, f) => !!f.oldGuard, value: (s, f) => f.oldGuard },
  { title: "Lambda", label: "Functional Fan", glyph: "g:lambda", tone: "violet", hint: "code in Haskell, OCaml, Elixir...", when: (s, f) => !!f.functional, value: (s, f) => f.functional },
  { title: "Esolang", label: "Esolang Explorer", glyph: "t:[+]", tone: "pink", hint: "code in Brainfuck and friends", when: (s, f) => !!f.esoteric, value: (s, f) => f.esoteric },

  // — people and the platform —
  { title: "LoneWolf", label: "Lone Wolf", glyph: "g:moon", tone: "slate", hint: "100 followers, following almost nobody", when: (s, f) => s.followers >= 100 && f.following <= 5 },
  { title: "SocialButterfly", label: "Social Butterfly", glyph: "i:people", tone: "pink", hint: "following 200 people", when: (s, f) => f.following >= 200, value: (s, f) => pt(f.following, "follows") },
  { title: "Bookmarker", label: "Bookmark Hoarder", glyph: "g:bookmark", tone: "amber", hint: "500 starred repositories", when: (s, f) => f.starred >= 500, value: (s, f) => pt(f.starred, "starred") },
  { title: "Snippets", label: "Snippet Collector", glyph: "g:note", tone: "cyan", hint: "10 gists", when: (s, f) => f.gists >= 10, value: (s, f) => pt(f.gists, "gists") },
  { title: "Patron", label: "Open Source Patron", glyph: "g:heart", tone: "pink", hint: "you sponsor someone", when: (s, f) => f.sponsoring >= 1, value: (s, f) => pt(f.sponsoring, "sponsored") },
  { title: "Backed", label: "Backed", glyph: "g:heart", tone: "gold", hint: "someone sponsors you", when: (s, f) => f.sponsors >= 1, value: (s, f) => pt(f.sponsors, "sponsors") },
  { title: "OpenSourceNomad", label: "Open Source Nomad", glyph: "i:globe", tone: "teal", hint: "contributed to 50 repositories", when: (s) => s.contributedTo >= 50, value: (s) => pt(s.contributedTo, "repos") },
  { title: "Gatekeeper", label: "Gatekeeper", glyph: "i:review", tone: "violet", hint: "100 pull request reviews", when: (s) => s.reviews >= 100, value: (s) => pt(s.reviews, "reviews") },
  { title: "Sharpshooter", label: "Sharpshooter", glyph: "g:target", tone: "green", hint: "20+ pull requests, 90% merged", when: (s) => s.prsMerged >= 20 && s.prsMergedPercentage >= 90, value: (s) => `${Math.round(s.prsMergedPercentage)}%` },
  { title: "AnswerMachine", label: "Answer Machine", glyph: "g:chat", tone: "cyan", hint: "5 accepted discussion answers", when: (s) => s.discussionsAnswered >= 5, value: (s) => pt(s.discussionsAnswered, "answers") },
  { title: "TenKCommits", label: "Commit Machine", glyph: "i:commit", tone: "orange", hint: "10000 commits", when: (s) => s.commits >= 10000, value: (s) => `${s.commits}` },
  { title: "GitHubStar", label: "GitHub Star", glyph: "g:sparkle", tone: "gold", hint: "a GitHub Star", when: (s, f) => f.badges.star },
  { title: "CampusExpert", label: "Campus Expert", glyph: "g:cap", tone: "cyan", hint: "a GitHub Campus Expert", when: (s, f) => f.badges.campus },
  { title: "BountyHunter", label: "Bounty Hunter", glyph: "g:target", tone: "red", hint: "a GitHub bug bounty hunter", when: (s, f) => f.badges.bounty },
  { title: "DevProgram", label: "Dev Program", glyph: "i:code", tone: "teal", hint: "member of the GitHub Developer Program", when: (s, f) => f.badges.devProgram },
  { title: "Hubber", label: "Hubber", glyph: "i:github", tone: "slate", hint: "works at GitHub", when: (s, f) => f.badges.employee },
  { title: "Friend", label: "Forge Friend", glyph: "g:bond", tone: "gold", special: "FRIEND", hint: "you and the author of profile-forge follow each other", when: (s, f) => f.friend },
];

/** The groups of the guide: name and the first title of each (the list above is ordered by group). */
export const SECRET_GROUPS = [
  ["The first ones", "MultiLanguage"], ["Calendar and streaks", "HundredDays"], ["Days of the year", "SantasHelper"],
  ["Repositories", "Forkaholic"], ["Languages", "Rustacean"], ["People and platform", "LoneWolf"], ["Special", "Friend"],
];

/** Tones: one family of colours each (light, base, dark); fixed in every theme, like the level colours. */
export const TONES = {
  gold: "#f2b84b", amber: "#e8963a", orange: "#f07d3c", red: "#e5534b", rose: "#e8627f", pink: "#d96bc0",
  violet: "#9a7be8", cyan: "#3cb9d8", teal: "#2fb89c", green: "#4cae5c", slate: "#8a97a8",
};

const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
/** Hand-drawn glyphs on a 24px box, in the colour of the surrounding `color`. */
export const GLYPHS = {
  moon: `<path ${S} d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>`,
  sun: `<circle ${S} cx="12" cy="12" r="4"/><path ${S} d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>`,
  heart: `<path ${S} d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>`,
  tree: `<path ${S} d="M12 3l4.5 6h-2.5l3.5 5h-3l3 4H6.5l3-4h-3l3.5-5H7.5z"/><path ${S} d="M12 18v3"/>`,
  ghost: `<path ${S} d="M5.5 20V11a6.5 6.5 0 0 1 13 0v9l-2.2-1.8-2.1 1.8-2.2-1.8-2.2 1.8-2.1-1.8z"/><circle cx="9.5" cy="11" r="1.1" fill="currentColor"/><circle cx="14.5" cy="11" r="1.1" fill="currentColor"/>`,
  clock: `<circle ${S} cx="12" cy="12" r="8.5"/><path ${S} d="M12 7v5l3.2 2"/>`,
  cake: `<path ${S} d="M4 20h16v-6.5H4zM4 13.5c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M12 11V7"/><path d="M12 3.3c1 1 1 1.8 0 2.6-1-.8-1-1.600 0-2.600z" fill="currentColor"/>`,
  pi: `<path ${S} d="M4.5 7.5h15M9 7.5c0 4-.6 8.500-2 11M15 7.500v8c0 2 1.200 3 3 3"/>`,
  shield: `<path ${S} d="M12 3l7.500 2.800v6c0 4.800-3.200 7.800-7.500 9.200-4.300-1.400-7.500-4.400-7.500-9.200v-6z"/><path ${S} d="M8.700 12l2.300 2.300 4.300-4.600"/>`,
  grave: `<path ${S} d="M6 21V10.500a6 6 0 0 1 12 0V21zM3.500 21h17M12 8v6M9.500 10.500h5"/>`,
  bookmark: `<path ${S} d="M7 3.500h10V21l-5-4-5 4z"/>`,
  note: `<rect ${S} x="5" y="3.500" width="14" height="17" rx="2"/><path ${S} d="M9 8.500h6M9 12h6M9 15.500h3"/>`,
  fork: `<circle ${S} cx="6" cy="5.500" r="2.200"/><circle ${S} cx="18" cy="5.500" r="2.200"/><circle ${S} cx="12" cy="18.500" r="2.200"/><path ${S} d="M6 7.700v1a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-1M12 11.700v4.600"/>`,
  dotfile: `<path ${S} d="M7 3h7l4.500 4.500V21H7z"/><circle cx="12.700" cy="15.500" r="1.500" fill="currentColor"/>`,
  terminal: `<path ${S} d="M4 6.500l5.500 5.500L4 17.500M12 18h8"/>`,
  sparkle: `<path ${S} d="M12 3l2.100 6.400 6.400 2.100-6.400 2.100L12 20l-2.100-6.400L3.500 11.500l6.400-2.100z"/>`,
  flare: `<path ${S} d="M12 2.500v5M12 16.500v5M2.500 12h5M16.500 12h5"/><circle ${S} cx="12" cy="12" r="3.500"/>`,
  crown: `<path ${S} d="M3.500 8l4.500 4 4-7 4 7 4.500-4-1.800 11H5.300z"/>`,
  mountain: `<path ${S} d="M2.500 19.500l6-11 4 6.500 2.500-4 6.500 8.500z"/>`,
  target: `<circle ${S} cx="12" cy="12" r="8.500"/><circle ${S} cx="12" cy="12" r="4.500"/><circle cx="12" cy="12" r="1.200" fill="currentColor"/>`,
  chat: `<path ${S} d="M4 5h16v11H9.500L4 20.500z"/>`,
  check: `<circle ${S} cx="12" cy="12" r="8.500"/><path ${S} d="M8 12.200l2.800 2.800 5.200-5.600"/>`,
  lambda: `<path ${S} d="M6.500 4.500H9c1.500 0 2.300 1 3 2.800L17.500 20M11.200 13.300L6.500 20"/>`,
  hourglass: `<path ${S} d="M6.500 3h11M6.500 21h11M7.500 3c0 4 4.500 5 4.500 9s-4.500 5-4.500 9M16.500 3c0 4-4.500 5-4.500 9s4.500 5 4.500 9"/>`,
  scroll: `<path ${S} d="M7 4h11v13a3 3 0 0 1-3 3H6.500a3 3 0 0 0 3-3V7a3 3 0 0 0-2.500-3z"/><path ${S} d="M10 9h5M10 12.500h5"/>`,
  rainbow: `<path ${S} d="M3 18a9 9 0 0 1 18 0M6.500 18a5.500 5.500 0 0 1 11 0M10 18a2 2 0 0 1 4 0"/>`,
  orbit: `<ellipse ${S} cx="12" cy="12" rx="9.500" ry="4" transform="rotate(-30 12 12)"/><circle cx="12" cy="12" r="2.600" fill="currentColor"/>`,
  seasons: `<circle ${S} cx="12" cy="12" r="8.500"/><path ${S} d="M12 3.500v17M3.500 12h17"/>`,
  anvil: `<path ${S} d="M3.500 7.500h13c0 2.500-2 3.500-4 3.500v3l2.500 2.500V19h-8v-2.500L9.500 14v-3c-3 0-5-1.500-6-3.500zM16.500 7.500l4-1"/>`,
  phoenix: `<path ${S} d="M12 21c-4.200 0-6.500-2.800-6.500-6 0-3 2-4.700 3.300-6.800C9.800 6.600 10.200 4.800 10 3c3 1 5 3.600 5 6.500 1.300-.5 2.200-1.500 2.500-3 1 1.800 1.200 4 .8 5.800-.7 3.400-3.200 8.700-6.300 8.700z"/>`,
  saber: `<path ${S} d="M5 19l9-9"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="3.2" d="M14 10l5-5"/><path ${S} d="M3.500 20.500l1.500-1.500"/>`,
  frog: `<circle ${S} cx="8" cy="9" r="2.400"/><circle ${S} cx="16" cy="9" r="2.400"/><path ${S} d="M4 13c0-2 1.800-3.500 4-3.500h8c2.200 0 4 1.500 4 3.500 0 3-3.800 5.500-8 5.500S4 16 4 13zM9 15.500c1.800 1 4.200 1 6 0"/>`,
  bulb: `<path ${S} d="M9 17.500h6M10 20.500h4M12 3a6 6 0 0 0-3.500 10.900c.6.500 1 1.100 1 1.900v.7h5v-.7c0-.8.400-1.400 1-1.900A6 6 0 0 0 12 3z"/>`,
  stack: `<path ${S} d="M12 3.500l9 4.500-9 4.500L3 8zM3 12.500l9 4.500 9-4.500M3 16.500l9 4.500 9-4.500"/>`,
  brush: `<path ${S} d="M17 3.500l3.500 3.500-8 8L9 11.500zM9 11.500c-3 0-4.500 2-4.500 4.500 0 1.500-.5 2.500-1.500 3.500 4 .5 8.500 0 8.500-4"/>`,
  bond: `<circle ${S} cx="8.800" cy="12" r="5.500"/><circle ${S} cx="15.200" cy="12" r="5.500"/>`,
  cap: `<path ${S} d="M2.500 9.500L12 5l9.500 4.500L12 14zM6.500 11.500v4.500c1.500 1.500 3.500 2.200 5.500 2.200s4-.7 5.500-2.200v-4.500"/>`,
};
