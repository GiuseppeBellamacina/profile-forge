import assert from "node:assert/strict";
import test from "node:test";
import { DIRS, ROWS, buildMaze, hashSeed, mulberry32, playGame, simulate } from "../src/pacman.js";

// a contribution grid: `width` weeks x 7 days, busier towards the right, with a partial last week like a real calendar
const grid = (width, seed, density = 0.5) => {
  const rand = mulberry32(seed);
  return Array.from({ length: width }, (_, w) =>
    Array.from({ length: w === width - 1 ? 1 + Math.floor(rand() * 7) : 7 }, (_, i) => ["d", rand() < density * (0.3 + w / width) ? 1 + Math.floor(rand() * rand() * 30) : 0, i]),
  );
};
const level = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil(n / 8)));
const KINDS = ["data", "classic", "open"];

const reachable = (maze) => {
  const idx = (w, i) => w * ROWS + i;
  const seen = new Set([idx(maze.den.w, maze.den.i)]);
  const q = [[maze.den.w, maze.den.i]];
  for (let h = 0; h < q.length; h++) {
    const around = DIRS.map(([a, b]) => [q[h][0] + a, q[h][1] + b]);
    if (maze.tunnels.includes(q[h][1])) around.push(q[h][0] === 0 ? [maze.W - 1, q[h][1]] : q[h][0] === maze.W - 1 ? [0, q[h][1]] : [-9, 0]); // the tunnel
    for (const [w, i] of around) if (w >= 0 && w < maze.W && i >= 0 && i < ROWS && !maze.wall[idx(w, i)] && !seen.has(idx(w, i))) (seen.add(idx(w, i)), q.push([w, i]));
  }
  return seen;
};

test("mazes: every free cell can be reached from the den, the den and the start are free, pellets are on free days", () => {
  for (const width of [10, 14, 27, 40, 53])
    for (let s = 1; s <= 6; s++)
      for (const kind of KINDS) {
        const weeks = grid(width, s * 31 + width, 0.2 + s * 0.12);
        const m = buildMaze(weeks, level, kind, mulberry32(s));
        const free = [...m.wall.keys()].filter((k) => !m.wall[k]);
        const seen = reachable(m);
        assert.equal(seen.size, free.length, `${kind} ${width}x${s}: a free cell is cut off`);
        assert.ok(!m.wall[m.den.w * ROWS + m.den.i] && !m.wall[m.start.w * ROWS + m.start.i]);
        for (const k of m.power) assert.ok(m.pellet[k] && !m.wall[k]);
        for (let k = 0; k < m.N; k++) if (m.pellet[k]) assert.ok(!m.wall[k] && m.exists[k]);
        if (kind === "open") assert.ok(free.length >= m.exists.reduce((a, b) => a + b, 0) - 0, "open: no walls on existing days");
        if (kind === "data") assert.ok(m.wall.length - free.length <= m.N, "data walls are bounded");
        assert.equal(m.pellets, [...m.pellet].filter(Boolean).length);
      }
});

test("data maze: the quiet days are the walls, never more than 30% of the days, and busy days stay open", () => {
  const weeks = grid(53, 7, 0.4);
  const m = buildMaze(weeks, level, "data", mulberry32(3));
  const days = weeks.flat().length;
  const walls = [...m.wall.keys()].filter((k) => m.wall[k] && m.exists[k]);
  assert.ok(walls.length <= Math.floor(days * 0.3) && walls.length > 0, String(walls.length));
  for (const k of walls) assert.equal(m.count[k], 0, "only a day with no contributions becomes a wall");
});

test("game: it ends, is the same for the same data, and obeys the rules", () => {
  for (const kind of KINDS)
    for (let s = 1; s <= 5; s++) {
      const weeks = grid(30 + s * 4, s * 17, 0.25 + s * 0.1);
      const a = playGame(weeks, level, { kind, lives: 3, seedText: "x" + s });
      const b = playGame(weeks, level, { kind, lives: 3, seedText: "x" + s });
      assert.deepEqual(a.frames, b.frames, "deterministic");
      const { frames, maze, result } = a;
      assert.ok(frames.length > 10 && frames.length < 1300, `${kind}: ${frames.length} frames`);
      assert.ok(["win", "over"].includes(result));
      const free = (w, i) => w >= 0 && w < maze.W && i >= 0 && i < ROWS && !maze.wall[w * ROWS + i];
      let lives = 3, eaten = 0;
      const seen = new Set();
      frames.forEach((f, t) => {
        const hidden = (f.p[0] === -1 || f.p[0] === maze.W) && maze.tunnels.includes(f.p[1]); // the two cells outside the board that make a tunnel
        assert.ok(hidden || free(f.p[0], f.p[1]), "Pac-Man is never in a wall");
        for (const g of f.g) assert.ok(free(g[4], g[5]), "nor a ghost (g[0], g[1] are where it is drawn, g[4], g[5] the cell it is nearest to)");
        assert.ok(f.l <= lives, "lives never come back");
        lives = f.l;
        for (const k of f.e) { assert.ok(!seen.has(k) && maze.pellet[k], "a pellet is eaten once"); seen.add(k); eaten++; }
        if (t && f.a && frames[t - 1].a) {
          const dw = Math.abs(f.p[0] - frames[t - 1].p[0]), di = Math.abs(f.p[1] - frames[t - 1].p[1]);
          const tunnel = dw === maze.W + 1 && di === 0 && maze.tunnels.includes(f.p[1]); // from one hidden cell to the other
          assert.ok(dw + di <= 1 || tunnel || f.l < frames[t - 1].l, "a step of one cell, or through a tunnel");
        }
      });
      if (result === "win") assert.equal(eaten, maze.pellets, "a win means every pellet was eaten");
      else assert.ok(lives === 0 || frames.length >= 1200 - 12, "a game over means no lives left (or the time ran out)");
    }
});

test("game: a power pill scares the ghosts; an eaten ghost is a pair of eyes that goes back to the den, then comes out again", () => {
  let scared = 0, eyes = 0, back = 0, hidden = 0, tunnel = 0; // hidden: caught Pac-Man, the ghosts vanish with him
  for (let s = 1; s <= 12; s++) {
    const { frames, maze } = playGame(grid(53, s, 0.5), level, { kind: "open", seedText: "p" + s });
    frames.forEach((f, t) => {
      f.g.forEach((g, k) => {
        const was = t ? frames[t - 1].g[k] : null;
        if (g[2] === "s") scared++;
        if (g[2] === "e") hidden++;
        if (g[2] === "r") {
          eyes++;
          if (was[2] === "r") assert.ok(Math.abs(g[0] - was[0]) + Math.abs(g[1] - was[1]) <= 1.01 || Math.abs(g[0] - was[0]) > maze.W - 3, "the eyes go one cell at a time (or through a tunnel)");
        } else if (was?.[2] === "r") {
          back++;
          assert.deepEqual([g[4], g[5]], [maze.den.w, maze.den.i], "they get to the den before the ghost is back");
        }
      });
      if (t && Math.abs(f.p[0] - frames[t - 1].p[0]) === maze.W + 1) tunnel++;
    });
  }
  assert.ok(scared > 0 && eyes > 0 && back > 0, `scared ${scared}, eyes ${eyes}, back ${back}`);
  assert.ok(tunnel > 0, "Pac-Man uses a tunnel in some game");
});

test("mazes: tunnels join the two edges on rows where both ends exist, and their mouths are open", () => {
  const m = buildMaze(grid(53, 3, 0.4), level, "data", mulberry32(1));
  assert.ok(m.tunnels.length >= 1 && m.tunnels.length <= 2);
  for (const i of m.tunnels) for (const w of [0, 1, m.W - 2, m.W - 1]) assert.equal(m.wall[w * ROWS + i], 0, "an open mouth");
  assert.deepEqual(buildMaze(grid(8, 1, 0.4), level, "open", mulberry32(1)).tunnels, [], "no tunnel on a narrow board");
});

test("game: lives option and an empty grid", () => {
  const weeks = grid(40, 5, 0.5);
  assert.ok(simulate(buildMaze(weeks, level, "open", mulberry32(1)), { lives: 1, seed: 4 }).frames.at(-1).l <= 1);
  const empty = grid(20, 1, 0).map((wk) => wk.map(([d, , i]) => [d, 0, i]));
  assert.equal(buildMaze(empty, level, "data", mulberry32(1)).pellets, 0);
  assert.ok(hashSeed("a") !== hashSeed("b"));
});

test("classic maze: vertical walls as well as horizontal ones, mirrored like the arcade board", () => {
  const weeks = Array.from({ length: 53 }, (_, w) => Array.from({ length: w === 52 ? 4 : 7 }, (_, i) => ["d", 1, i]));
  const m = buildMaze(weeks, level, "classic", mulberry32(1));
  const wall = (w, i) => w >= 0 && w < m.W && i >= 0 && i < ROWS && m.exists[w * ROWS + i] && m.wall[w * ROWS + i];
  let vertical = 0, horizontal = 0, same = 0, total = 0;
  for (let w = 0; w < m.W; w++)
    for (let i = 0; i < ROWS; i++) {
      if (wall(w, i) && wall(w, i + 1)) vertical++;
      if (wall(w, i) && wall(w + 1, i)) horizontal++;
      if (m.exists[w * ROWS + i] && m.exists[(m.W - 1 - w) * ROWS + i]) { total++; if (wall(w, i) === wall(m.W - 1 - w, i)) same++; }
    }
  assert.ok(vertical > 20 && horizontal > 20, `vertical ${vertical}, horizontal ${horizontal}`);
  assert.ok(same / total > 0.85, `mirrored: ${same}/${total}`);
});

test("ghost house: 5 x 3 days with a door above the middle of the top edge; Pac-Man never goes in, the ghosts start in it", () => {
  for (const kind of KINDS) {
    const { maze, frames } = playGame(grid(53, 11, 0.5), level, { kind, seedText: "h" });
    assert.equal(maze.house.size, 15);
    assert.ok(maze.house.has(maze.den.w * ROWS + maze.den.i));
    assert.ok(!maze.wall[maze.door.w * ROWS + maze.door.i] && maze.door.i === maze.den.i - 2 && maze.door.w === maze.den.w, "a free door above the middle of the top edge");
    for (const k of maze.house) assert.ok(!maze.pellet[k] && !maze.wall[k]);
    for (const f of frames) assert.ok(!maze.house.has(f.p[0] * ROWS + f.p[1]), "Pac-Man stays out");
    assert.ok(frames[0].g.every((g) => maze.house.has(g[4] * ROWS + g[5])), "the ghosts start in the house");
    // they leave by the door: the first cell outside the house is the door
    for (let k = 0; k < 4; k++) {
      const out = frames.find((f) => !maze.house.has(f.g[k][4] * ROWS + f.g[k][5]));
      assert.deepEqual([out.g[k][4], out.g[k][5]], [maze.door.w, maze.door.i]);
    }
  }
});

test("game: Pac-Man does not pace back and forth, and the score follows the arcade rules", () => {
  for (const kind of KINDS)
    for (let s = 1; s <= 8; s++) {
      const { frames, maze } = playGame(grid(53, s * 5, 0.5), level, { kind, seedText: "z" + s });
      let run = 0, worst = 0, score = 0;
      frames.forEach((f, t) => {
        const a = t >= 2 ? frames[t - 2].p : null;
        const pacing = a && f.a && !f.e.length && f.p[0] === a[0] && f.p[1] === a[1] && (f.p[0] !== frames[t - 1].p[0] || f.p[1] !== frames[t - 1].p[1]);
        run = pacing ? run + 1 : 0;
        worst = Math.max(worst, run);
        assert.ok(f.s >= score && f.s % 10 === 0, "the score only goes up, in tens");
        score = f.s;
      });
      assert.ok(worst < 6, `${kind} ${s}: paced ${worst} times in a row`);
      assert.ok(frames.at(-1).s > 0 && maze.pellets > 0, "something was scored");
    }
});

test("games: up to three one after the other, each starting from 0 with fresh pellets and lives", () => {
  const g = playGame(grid(53, 4, 0.5), level, { kind: "data", games: 3, seedText: "g" });
  assert.deepEqual([...new Set(g.frames.map((f) => f.n))], [0, 1, 2]);
  assert.equal(g.results.length, 3);
  for (const n of [0, 1, 2]) {
    const own = g.frames.filter((f) => f.n === n);
    assert.equal(own[0].s, 0, "starts from 0");
    assert.equal(own[0].l, 3);
    assert.ok(own.slice(-10).every((f) => f.r === g.results[n]), "the end of each game is flagged");
  }
  assert.notDeepEqual(g.frames.filter((f) => f.n === 0).map((f) => f.p), g.frames.filter((f) => f.n === 1).map((f) => f.p), "each game has its own turn of luck");
});

test("ghosts never go back into the house on their own; only the eyes of an eaten ghost do", () => {
  for (const kind of KINDS) {
    const { frames, maze } = playGame(grid(53, 9, 0.5), level, { kind, games: 2, seedText: "in" });
    frames.forEach((f, t) => f.g.forEach((g, k) => {
      const was = t ? frames[t - 1].g[k] : null;
      const inside = (c) => maze.house.has(c[4] * ROWS + c[5]);
      if (was && f.n === frames[t - 1].n && f.a && !["e", "r"].includes(g[2]) && !["e", "r"].includes(was[2])) assert.ok(!(inside(g) && !inside(was)), `${kind}: a ghost walked in at frame ${t}`);
    }));
  }
});

test("game: a ghost is eaten, and Pac-Man is caught, only when the two are drawn on top of each other", () => {
  let eaten = 0, caught = 0;
  for (const kind of KINDS)
    for (let s = 1; s <= 12; s++) {
      const { frames, maze } = playGame(grid(53, s * 3, 0.5), level, { kind, seedText: "c" + s });
      const apart = (f, g) => (Math.abs(f.p[0] - g[0]) > maze.W - 3 ? 0 : Math.hypot(f.p[0] - g[0], f.p[1] - g[1])); // a tunnel: not measured
      frames.forEach((f, t) => {
        if (!t || f.n !== frames[t - 1].n) return;
        const prev = frames[t - 1];
        f.g.forEach((g, k) => {
          if (prev.g[k][2] === "s" && g[2] === "r") { eaten++; assert.ok(apart(f, g) < 1.2, `${kind}: eaten ${apart(f, g).toFixed(2)} cells away`); }
        });
        if (f.a === 0 && prev.a === 1) {
          caught++;
          const near = Math.min(...prev.g.map((g, k) => (g[2] === "c" ? apart(f, f.g[k]) : 9)));
          assert.ok(near < 1.2, `${kind}: caught with the nearest ghost ${near.toFixed(2)} cells away`);
        }
      });
    }
  assert.ok(eaten > 0 && caught > 0, `${eaten} eaten, ${caught} caught`);
});

test("ghosts: none comes out of the house scared, none goes round and round a few cells", () => {
  for (const kind of KINDS)
    for (let s = 1; s <= 10; s++) {
      const { frames, maze } = playGame(grid(53, s * 7, 0.5), level, { kind, games: 2, seedText: "l" + s });
      const inside = (g) => maze.house.has(g[4] * ROWS + g[5]);
      for (let k = 0; k < 4; k++)
        frames.forEach((f, t) => {
          if (!t || f.n !== frames[t - 1].n) return;
          if (inside(frames[t - 1].g[k]) && !inside(f.g[k])) assert.notEqual(f.g[k][2], "s", `${kind} ${s}: ghost ${k} came out scared at ${t}`);
          if (t < 40) return;
          const seg = frames.slice(t - 40, t + 1);
          if (seg.some((x) => x.n !== f.n || x.a === 0 || x.g[k][2] !== "c" || inside(x.g[k]))) return;
          assert.ok(new Set(seg.map((x) => x.g[k][4] * ROWS + x.g[k][5])).size > 8, `${kind} ${s}: ghost ${k} circled a few cells at ${t}`);
        });
    }
});
