import assert from "node:assert/strict";
import test from "node:test";
import { render, renderButton } from "../src/render.js";
import { calculateRank, computeStreak, summarize, topLanguages, trophies } from "../src/stats.js";

test("rank: zero activity is C, heavy activity is S", () => {
  assert.equal(calculateRank({ commits: 0, prs: 0, issues: 0, reviews: 0, stars: 0, followers: 0 }).level, "C");
  const top = calculateRank({ commits: 20000, prs: 2000, issues: 1000, reviews: 500, stars: 100000, followers: 10000 });
  assert.equal(top.level, "S");
  assert.ok(top.percentile < 1);
});

test("streak: today with 0 keeps the streak, a past gap breaks it", () => {
  const s = computeStreak([["2026-01-01", 2], ["2026-01-02", 0], ["2026-01-03", 1], ["2026-01-04", 3], ["2026-01-05", 0]]);
  assert.equal(s.total, 6);
  assert.deepEqual(s.current, { length: 2, start: "2026-01-03", end: "2026-01-04" });
  assert.equal(s.longest.length, 2);
  assert.equal(s.first, "2026-01-01");
  assert.equal(computeStreak([["2026-01-01", 1], ["2026-01-02", 0], ["2026-01-03", 0]]).current.length, 0);
});

test("languages: forks and hidden ignored, count weight ranks by repo count", () => {
  const repos = [
    { isFork: false, languages: [{ name: "Python", color: "#3572A5", size: 10 }, { name: "Shell", size: 5 }] },
    { isFork: false, languages: [{ name: "Python", size: 10 }] },
    { isFork: false, languages: [{ name: "C", size: 1000 }] },
    { isFork: true, languages: [{ name: "Go", size: 99999 }] },
  ];
  const bySize = topLanguages(repos, { hide: ["shell"] });
  assert.deepEqual(bySize.top.map((l) => l.name), ["C", "Python"]);
  const byCount = topLanguages(repos, { sizeWeight: 0, countWeight: 1 });
  assert.equal(byCount.top[0].name, "Python");
  assert.equal(byCount.top[0].count, 2);
  assert.equal(Math.round(byCount.top.reduce((s, l) => s + l.percent, 0)), 100);
});

test("trophies: tiers and secret trophies", () => {
  const t = trophies({ stars: 227, commits: 5000, followers: 0, issues: 1, prs: 27, repos: 59, reviews: 0, experience: 16, years: 4, organizations: 3, languageCount: 12, firstYear: 2022 });
  const rank = Object.fromEntries(t.map((x) => [x.title, x.rank]));
  assert.equal(rank.Stars, "S");
  assert.equal(rank.Commits, "SSS");
  assert.equal(rank.Followers, "?");
  assert.equal(rank.Issues, "C");
  assert.equal(rank.PRs, "A");
  assert.equal(rank.Experience, "A");
  assert.ok(rank.Rainbow && rank.Orgs);
  assert.ok(!rank.Elder);
});

test("render: static frame has no CSS animation and nothing hidden; animated has keyframes", () => {
  const days = Array.from({ length: 400 }, (_, i) => [new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10), i % 3]);
  const d = summarize({
    name: "Ada <Lovelace>", login: "ada", avatar: "data:image/png;base64,", createdAt: "2020-05-01T00:00:00Z", earliest: "2020-05-01T00:00:00Z",
    followers: 5, organizations: 0, prs: 3, issues: 2, contributedTo: 1, repoCount: 4, stars: 12, commits: 300, reviews: 1,
    repos: [{ isFork: false, languages: [{ name: "Rust", color: "#dea584", size: 100 }] }], days,
  });
  d.config = { about: ["Hello **world**"], workingOn: [{ title: "Thing", url: "https://x.dev" }], stack: Array.from({ length: 30 }, (_, k) => ({ name: `T${k}`, id: `i${k}`, data: "data:image/png;base64," })) };
  const still = render(d, { theme: "light", t: 1 });
  assert.ok(still.includes("Hello world") && still.includes("WORKING ON") && still.includes("TECH STACK"));
  assert.ok(!still.includes("#row0"), "static carousel inlines visible tiles only");
  assert.ok(!still.includes("@keyframes") && !still.includes("animation"));
  assert.ok(!/ opacity="0"/.test(still));
  assert.ok(still.includes("Ada &#60;Lovelace&#62;"));
  const animated = render(d);
  assert.ok(animated.includes("@keyframes m0") && animated.includes("#row1"));
  assert.ok(renderButton({ label: "LinkedIn", url: "u", icon: "linkedin" }).includes(">LinkedIn</text>"));
});
