// GitHub GraphQL data fetching. Two requests (+ repo pagination), no REST search.

async function gql(token, query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-forge" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(`GitHub API: ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}

const USER_QUERY = `query($login: String!, $after: String, $privacy: RepositoryPrivacy) {
  user(login: $login) {
    name login avatarUrl createdAt
    followers { totalCount }
    organizations { totalCount }
    pullRequests { totalCount }
    openIssues: issues(states: OPEN) { totalCount }
    closedIssues: issues(states: CLOSED) { totalCount }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, privacy: $privacy) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        isFork stargazerCount createdAt
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
      }
    }
  }
}`;

/** "YYYY-MM-DD" for now in the given IANA time zone. */
export const todayIn = (tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());

export async function fetchProfile({ login, token, includePrivate = false, tz = "UTC" }) {
  const privacy = includePrivate ? null : "PUBLIC";
  let data = await gql(token, USER_QUERY, { login, privacy });
  const user = data.user;
  if (!user) throw new Error(`User "${login}" not found`);
  const repos = [...user.repositories.nodes];
  let page = user.repositories.pageInfo;
  while (page.hasNextPage) {
    data = await gql(token, USER_QUERY, { login, privacy, after: page.endCursor });
    repos.push(...data.user.repositories.nodes);
    page = data.user.repositories.pageInfo;
  }

  const firstYear = new Date(user.createdAt).getUTCFullYear();
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
  const yearly = Object.values((await gql(token, yearsQuery, { login })).user);

  const calendar = new Map();
  let commits = 0;
  let reviews = 0;
  for (const y of yearly) {
    commits += y.totalCommitContributions + y.restrictedContributionsCount;
    reviews += y.totalPullRequestReviewContributions;
    for (const w of y.contributionCalendar.weeks)
      for (const d of w.contributionDays) if (d.date <= today) calendar.set(d.date, d.contributionCount);
  }
  if (!calendar.has(today)) calendar.set(today, 0);

  const avatar = await fetch(`${user.avatarUrl}${user.avatarUrl.includes("?") ? "&" : "?"}s=200`);
  const avatarData = `data:${avatar.headers.get("content-type") ?? "image/png"};base64,${Buffer.from(await avatar.arrayBuffer()).toString("base64")}`;

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
    repoCount: user.repositories.totalCount,
    stars: repos.reduce((s, r) => s + r.stargazerCount, 0),
    commits,
    reviews,
    repos: repos.map((r) => ({
      isFork: r.isFork,
      languages: r.languages.edges.map((e) => ({ name: e.node.name, color: e.node.color, size: e.size })),
    })),
    days: [...calendar.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
  };
}
