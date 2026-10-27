import { AUTHOR } from "./secrets.js";

// GitHub GraphQL data fetching. Two requests (+ repo pagination), no REST search.

const API = "https://api.github.com/graphql";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One GraphQL request. A gateway error (502/503/504, an HTML page instead of JSON) or a stalled connection is retried twice. */
async function gql(token, query, variables = {}, endpoint = API) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(1500 * attempt);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-forge" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(45_000),
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { last = new Error(`GitHub did not answer in time (HTTP ${res.status}). Try again in a moment.`); continue; }
      if (!res.ok || json.errors) {
        if (res.status >= 500) { last = new Error(`GitHub API: HTTP ${res.status}`); continue; }
        const err = new Error(`GitHub API: ${JSON.stringify(json.errors ?? json)}`);
        err.errors = json.errors;
        throw err;
      }
      return json.data;
    } catch (e) {
      if (String(e.message).startsWith("GitHub API")) throw e;
      last = e.name === "TimeoutError" ? new Error("GitHub took too long to answer. Try again in a moment.") : e;
    }
  }
  throw last;
}

// Fields of the profile that only add a detail (a count): a token that may not read one (a fine-grained token without the Gists
// permission says FORBIDDEN) must not stop the whole card, so the query is asked again without that field.
const OPTIONAL = ["gists", "following", "starredRepositories", "sponsors", "sponsoring"];
export async function userPage(token, query, vars, endpoint) {
  for (let drop = 0; ; drop++) {
    try {
      return { data: await gql(token, query, vars, endpoint), query };
    } catch (e) {
      const bad = (e.errors ?? []).map((x) => (x.type === "FORBIDDEN" || x.type === "INSUFFICIENT_SCOPES" ? x.path?.[1] : null));
      if (drop >= OPTIONAL.length || !bad.length || !bad.every((f) => OPTIONAL.includes(f))) throw e;
      for (const f of new Set(bad)) query = query.replace(new RegExp(`^\\s*${f}\\b.*$`, "m"), "");
    }
  }
}

const BY_REPO = "contributions { totalCount } repository { nameWithOwner stargazerCount owner { __typename login avatarUrl } }";

const USER_QUERY = `query($login: String!, $after: String, $privacy: RepositoryPrivacy, $extras: Boolean = false) {
  user(login: $login) {
    name login avatarUrl createdAt
    followers { totalCount }
    organizations { totalCount }
    gists { totalCount }
    following { totalCount }
    starredRepositories { totalCount }
    sponsors { totalCount }
    sponsoring { totalCount }
    isGitHubStar isCampusExpert isBountyHunter isDeveloperProgramMember isEmployee
    pullRequests { totalCount }
    mergedPrs: pullRequests(states: MERGED) @include(if: $extras) { totalCount }
    discussionsStarted: repositoryDiscussions @include(if: $extras) { totalCount }
    discussionsAnswered: repositoryDiscussionComments(onlyAnswers: true) @include(if: $extras) { totalCount }
    openIssues: issues(states: OPEN) { totalCount }
    closedIssues: issues(states: CLOSED) { totalCount }
    repositoriesContributedTo(first: 100, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, PULL_REQUEST_REVIEW, REPOSITORY]) { totalCount nodes { nameWithOwner stargazerCount owner { __typename login avatarUrl } } }
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, privacy: $privacy) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        name isFork isArchived stargazerCount forkCount createdAt licenseInfo { key }
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
      }
    }
  }
}`;

// Node and browsers (the web configurator reuses this file).
const toBase64 = (buf) => {
  if (typeof Buffer !== "undefined") return Buffer.from(buf).toString("base64");
  let s = "";
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

/** "YYYY-MM-DD" for now in the given IANA time zone. */
export const todayIn = (tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

/** True when `a` follows `b` (REST: 204 yes, 404 no). Any failure counts as "no" so a missing permission never breaks the card. */
async function follows(token, a, b) {
  try {
    const res = await fetch(`https://api.github.com/users/${a}/following/${b}`, { headers: { Authorization: `bearer ${token}`, "User-Agent": "profile-forge" } });
    return res.status === 204;
  } catch {
    return false;
  }
}

/** onProgress(fraction 0..1, label) is called as the steps complete (the configurator draws a bar with it). */
export async function fetchProfile({ login, token, includePrivate = false, tz = "UTC", startingYear = null, extras = false, endpoint = API, onProgress }) {
  const step = (f, label) => onProgress?.(Math.min(1, f), label);
  step(0.02, "Reading the profile…");
  const privacy = includePrivate ? null : "PUBLIC";
  let userQuery = USER_QUERY;
  let data;
  ({ data, query: userQuery } = await userPage(token, userQuery, { login, privacy, extras }, endpoint));
  const user = data.user;
  if (!user) throw new Error(`User "${login}" not found`);
  step(0.12, "Reading the repositories…");
  const repos = [...user.repositories.nodes];
  let page = user.repositories.pageInfo;
  let pages = 1;
  while (page.hasNextPage) {
    step(0.12 + Math.min(0.08, pages++ * 0.02), `Reading the repositories (${repos.length} so far)…`);
    data = await gql(token, userQuery, { login, privacy, extras, after: page.endCursor }, endpoint);
    repos.push(...data.user.repositories.nodes);
    page = data.user.repositories.pageInfo;
  }

  const firstYear = Math.max(new Date(user.createdAt).getUTCFullYear(), startingYear ?? 0);
  const today = todayIn(tz);
  const thisYear = Number(today.slice(0, 4));
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => firstYear + i);
  const yearsQuery = `query($login: String!) { user(login: $login) { ${years
    .map(
      (y) => `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") {
        totalCommitContributions restrictedContributionsCount totalPullRequestReviewContributions
        contributionCalendar { weeks { contributionDays { date contributionCount } } }
      }`,
    )
    .join("\n")} } }`;
  step(0.2, `Reading your calendar, ${years.length} years…`);
  const yearly = Object.values((await gql(token, yearsQuery, { login }, endpoint)).user);
  step(0.35, "Looking at where the work went…");
  // which repositories each year's work went to: one small request per year, four at a time, and never fatal (an account with
  // a huge history made one big request fail with a 502)
  const kinds = ["commit", "pullRequest", "issue", "pullRequestReview"];
  const perYear = years.map((y) => `query($login: String!) { user(login: $login) { c: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { ${kinds.map((kind) => `${kind}ContributionsByRepository(maxRepositories: 50) { ${BY_REPO} }`).join(" ")} } } }`);
  const byRepoYears = new Array(perYear.length).fill(null);
  let done = 0;
  const ask = async (i) => {
    try { byRepoYears[i] = (await gql(token, perYear[i], { login }, endpoint)).user.c; } catch {}
    step(0.35 + (0.45 * ++done) / (perYear.length * 2), `Looking at where the work went, ${years[i]}…`);
  };
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, perYear.length) }, async () => { while (next < perYear.length) await ask(next++); }));
  // a second chance, one at a time, for the years that failed: every year of the card should be there
  done = perYear.length;
  for (const i of byRepoYears.keys()) if (!byRepoYears[i]) await ask(i);
  const incompleteYears = years.filter((_, i) => !byRepoYears[i]);

  const calendar = new Map();
  let commits = 0;
  let reviews = 0;
  const commitsByYear = {};
  for (const [i, y] of yearly.entries()) {
    commitsByYear[firstYear + i] = y.totalCommitContributions + y.restrictedContributionsCount;
    commits += commitsByYear[firstYear + i];
    reviews += y.totalPullRequestReviewContributions;
    for (const w of y.contributionCalendar.weeks)
      for (const d of w.contributionDays) if (d.date <= today) calendar.set(d.date, d.contributionCount);
  }
  if (!calendar.has(today)) calendar.set(today, 0);

  // the organizations you contributed to, all years: contributions (commits, PRs, issues, reviews) and the stars of the repos
  const byOrg = new Map();
  // every repository you do not own and contributed to, any year (GitHub's own count covers only the last year, without reviews)
  const others = new Set((user.repositoriesContributedTo.nodes ?? []).map((r) => r.nameWithOwner.toLowerCase()));
  for (const y of byRepoYears.filter(Boolean))
    for (const kind of kinds)
      for (const { contributions, repository: r } of y[`${kind}ContributionsByRepository`] ?? []) {
        if (r.owner.login.toLowerCase() !== user.login.toLowerCase()) others.add(r.nameWithOwner.toLowerCase());
        if (r.owner.__typename !== "Organization") continue;
        const o = byOrg.get(r.owner.login) ?? { login: r.owner.login, avatarUrl: r.owner.avatarUrl, contributions: 0, repos: new Map() };
        o.contributions += contributions.totalCount;
        o.repos.set(r.nameWithOwner, r.stargazerCount);
        byOrg.set(o.login, o);
      }
  // GitHub's own list of the repositories you contributed to names organizations the yearly lists can miss (private ones)
  for (const r of user.repositoriesContributedTo.nodes ?? []) {
    if (r.owner.__typename !== "Organization" || byOrg.has(r.owner.login)) continue;
    byOrg.set(r.owner.login, { login: r.owner.login, avatarUrl: r.owner.avatarUrl, contributions: 0, repos: new Map([[r.nameWithOwner, r.stargazerCount]]) });
  }
  // GitHub often reports work in private org repos only as "restricted" contributions, without the repository. For the orgs
  // you are a member of that the calendar did not reveal, count your commits and pull requests there with the search API.
  // the memberships need read:org; a token without it (the configurator's sign-in) simply skips this step
  let members = [];
  try {
    members = (await gql(token, `query($login: String!) { user(login: $login) { organizations(first: 50) { nodes { login avatarUrl } } } }`, { login }, endpoint)).user.organizations.nodes;
  } catch {}
  step(0.82, "Counting work in private organizations…");
  // commits and PRs of yours in an organization, with the search API (30 requests a minute: wait and retry when it says stop)
  const count = async (kind, q) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`https://api.github.com/search/${kind}?per_page=1&q=${encodeURIComponent(q)}`, { headers: { Authorization: `bearer ${token}`, "User-Agent": "profile-forge", Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(20_000) });
        if (res.ok) return (await res.json()).total_count ?? 0;
        if (res.status !== 403 && res.status !== 429) return 0;
        await sleep(Math.min(20_000, (Number(res.headers.get("retry-after")) || 5) * 1000));
      } catch {
        return 0;
      }
    }
    return 0;
  };
  const searched = async (org) => (await count("commits", `author:${user.login} org:${org}`)) + (await count("issues", `author:${user.login} org:${org} type:pr`));
  if (endpoint === API)
    for (const m of members) {
      if (byOrg.has(m.login)) continue;
      const n = await searched(m.login);
      if (n) byOrg.set(m.login, { login: m.login, avatarUrl: m.avatarUrl, contributions: n, repos: new Map() });
    }
  for (const o of byOrg.values()) if (!o.contributions && endpoint === API) o.contributions = await searched(o.login);
  step(0.9, "Loading the organization logos…");
  // shortcut: avatars of the 30 most active orgs only (one request each), raise it if someone needs more chips
  const orgs = await Promise.all(
    [...byOrg.values()].sort((a, b) => b.contributions - a.contributions).slice(0, 30).map(async (o) => {
      let logo = null;
      try {
        const res = await fetch(`${o.avatarUrl}${o.avatarUrl.includes("?") ? "&" : "?"}s=64`);
        if (res.ok) logo = `data:${res.headers.get("content-type") ?? "image/png"};base64,${toBase64(await res.arrayBuffer())}`;
      } catch {}
      return { login: o.login, avatar: logo, contributions: o.contributions, stars: [...o.repos.values()].reduce((s, n) => s + n, 0) };
    }),
  );
  // popularity: the stars of each organization's 100 most starred repositories (one request for all of them)
  if (orgs.length) {
    try {
      const q = `query { ${orgs.map((o, i) => `o${i}: organization(login: ${JSON.stringify(o.login)}) { repositories(first: 100, orderBy: { field: STARGAZERS, direction: DESC }) { nodes { stargazerCount } } }`).join(" ")} }`;
      const res = await gql(token, q, {}, endpoint);
      orgs.forEach((o, i) => { const nodes = res[`o${i}`]?.repositories.nodes; if (nodes) o.stars = nodes.reduce((s, r) => s + r.stargazerCount, 0); });
    } catch {} // keep the stars of the repos you contributed to
  }

  const avatar = await fetch(`${user.avatarUrl}${user.avatarUrl.includes("?") ? "&" : "?"}s=200`);
  const avatarData = `data:${avatar.headers.get("content-type") ?? "image/png"};base64,${toBase64(await avatar.arrayBuffer())}`;

  // a friend of the author: you follow each other (only checked on github.com)
  const friend = endpoint === API && user.login.toLowerCase() !== AUTHOR.toLowerCase() && (await follows(token, user.login, AUTHOR)) && (await follows(token, AUTHOR, user.login));

  step(1, "Done");
  const earliest = Math.min(new Date(user.createdAt), ...repos.map((r) => new Date(r.createdAt)));
  return {
    name: user.name || user.login,
    login: user.login,
    avatar: avatarData,
    createdAt: user.createdAt,
    earliest: new Date(earliest).toISOString(),
    followers: user.followers.totalCount,
    organizations: user.organizations.totalCount,
    prs: user.pullRequests.totalCount,
    issues: user.openIssues.totalCount + user.closedIssues.totalCount,
    contributedTo: Math.max(user.repositoriesContributedTo.totalCount, others.size),
    orgs,
    incompleteYears,
    repoCount: user.repositories.totalCount,
    stars: repos.reduce((s, r) => s + r.stargazerCount, 0),
    commits,
    commitsByYear,
    reviews,
    mergedPrs: user.mergedPrs?.totalCount ?? 0,
    discussionsStarted: user.discussionsStarted?.totalCount ?? 0,
    discussionsAnswered: user.discussionsAnswered?.totalCount ?? 0,
    friend,
    gists: user.gists?.totalCount ?? 0,
    following: user.following?.totalCount ?? 0,
    starred: user.starredRepositories?.totalCount ?? 0,
    sponsors: user.sponsors?.totalCount ?? 0,
    sponsoring: user.sponsoring?.totalCount ?? 0,
    badges: { star: user.isGitHubStar, campus: user.isCampusExpert, bounty: user.isBountyHunter, devProgram: user.isDeveloperProgramMember, employee: user.isEmployee },
    repos: repos.map((r) => ({
      name: r.name,
      stars: r.stargazerCount,
      isFork: r.isFork,
      isArchived: r.isArchived,
      forkCount: r.forkCount,
      licensed: !!r.licenseInfo,
      languages: r.languages.edges.map((e) => ({ name: e.node.name, color: e.node.color, size: e.size })),
    })),
    days: [...calendar.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
  };
}
