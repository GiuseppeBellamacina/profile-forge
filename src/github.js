import { AUTHOR } from "./secrets.js";

// GitHub GraphQL data fetching. Two requests (+ repo pagination), no REST search.

const API = "https://api.github.com/graphql";

async function gql(token, query, variables = {}, endpoint = API) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-forge" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GitHub API: ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}

const BY_REPO = "contributions { totalCount } repository { nameWithOwner stargazerCount owner { __typename login avatarUrl } }";

const USER_QUERY = `query($login: String!, $after: String, $privacy: RepositoryPrivacy, $extras: Boolean = false) {
  user(login: $login) {
    name login avatarUrl createdAt
    followers { totalCount }
    organizations(first: 50) { totalCount nodes { login avatarUrl } }
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
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
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

export async function fetchProfile({ login, token, includePrivate = false, tz = "UTC", startingYear = null, extras = false, endpoint = API }) {
  const privacy = includePrivate ? null : "PUBLIC";
  let data = await gql(token, USER_QUERY, { login, privacy, extras }, endpoint);
  const user = data.user;
  if (!user) throw new Error(`User "${login}" not found`);
  const repos = [...user.repositories.nodes];
  let page = user.repositories.pageInfo;
  while (page.hasNextPage) {
    data = await gql(token, USER_QUERY, { login, privacy, extras, after: page.endCursor }, endpoint);
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
        ${["commit", "pullRequest", "issue", "pullRequestReview"].map((kind) => `${kind}ContributionsByRepository(maxRepositories: 100) { ${BY_REPO} }`).join("\n")}
      }`,
    )
    .join("\n")} } }`;
  const yearly = Object.values((await gql(token, yearsQuery, { login }, endpoint)).user);

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
  for (const y of yearly)
    for (const kind of ["commit", "pullRequest", "issue", "pullRequestReview"])
      for (const { contributions, repository: r } of y[`${kind}ContributionsByRepository`] ?? []) {
        if (r.owner.__typename !== "Organization") continue;
        const o = byOrg.get(r.owner.login) ?? { login: r.owner.login, avatarUrl: r.owner.avatarUrl, contributions: 0, repos: new Map() };
        o.contributions += contributions.totalCount;
        o.repos.set(r.nameWithOwner, r.stargazerCount);
        byOrg.set(o.login, o);
      }
  // GitHub often reports work in private org repos only as "restricted" contributions, without the repository. For the orgs
  // you are a member of that the calendar did not reveal, count your commits and pull requests there with the search API.
  if (endpoint === API)
    for (const m of user.organizations.nodes ?? []) {
      if (byOrg.has(m.login)) continue;
      const count = async (kind, q) => {
        try {
          const res = await fetch(`https://api.github.com/search/${kind}?per_page=1&q=${encodeURIComponent(q)}`, { headers: { Authorization: `bearer ${token}`, "User-Agent": "profile-forge", Accept: "application/vnd.github+json" } });
          return res.ok ? (await res.json()).total_count ?? 0 : 0;
        } catch {
          return 0;
        }
      };
      const n = (await count("commits", `author:${user.login} org:${m.login}`)) + (await count("issues", `author:${user.login} org:${m.login} type:pr`));
      if (n) byOrg.set(m.login, { login: m.login, avatarUrl: m.avatarUrl, contributions: n, repos: new Map() });
    }
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
    contributedTo: user.repositoriesContributedTo.totalCount,
    orgs,
    repoCount: user.repositories.totalCount,
    stars: repos.reduce((s, r) => s + r.stargazerCount, 0),
    commits,
    commitsByYear,
    reviews,
    mergedPrs: user.mergedPrs?.totalCount ?? 0,
    discussionsStarted: user.discussionsStarted?.totalCount ?? 0,
    discussionsAnswered: user.discussionsAnswered?.totalCount ?? 0,
    friend,
    gists: user.gists.totalCount,
    following: user.following.totalCount,
    starred: user.starredRepositories.totalCount,
    sponsors: user.sponsors.totalCount,
    sponsoring: user.sponsoring.totalCount,
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
