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
        assert.ok(free(f.p[0], f.p[1]), "Pac-Man is never in a wall");
        for (const g of f.g) assert.ok(free(g[0], g[1]), "nor a ghost");
        assert.ok(f.l <= lives, "lives never come back");
        lives = f.l;
        for (const k of f.e) { assert.ok(!seen.has(k) && maze.pellet[k], "a pellet is eaten once"); seen.add(k); eaten++; }
        if (t && f.a && frames[t - 1].a) {
          const dw = Math.abs(f.p[0] - frames[t - 1].p[0]), di = Math.abs(f.p[1] - frames[t - 1].p[1]);
          const tunnel = dw === maze.W - 1 && di === 0 && maze.tunnels.includes(f.p[1]);
          assert.ok(dw + di <= 1 || tunnel || f.l < frames[t - 1].l, "a step of one cell, or through a tunnel");
        }
      });
      if (result === "win") assert.equal(eaten, maze.pellets, "a win means every pellet was eaten");
      else assert.ok(lives === 0 || frames.length >= 1200 - 12, "a game over means no lives left (or the time ran out)");
    }
});

test("game: a power pill scares the ghosts, an eaten ghost is out of sight where it was caught and comes back out of the den", () => {
  let scared = 0, hidden = 0, back = 0, tunnel = 0;
  for (let s = 1; s <= 12; s++) {
    const { frames, maze } = playGame(grid(53, s, 0.5), level, { kind: "open", seedText: "p" + s });
    frames.forEach((f, t) => {
      f.g.forEach((g, k) => {
        if (g[2] === "s") scared++;
        if (g[2] === "e") {
          hidden++;
          if (t && frames[t - 1].g[k][2] === "e") assert.deepEqual([g[0], g[1]], [frames[t - 1].g[k][0], frames[t - 1].g[k][1]], "a hidden ghost does not travel");
        } else if (t && frames[t - 1].g[k][2] === "e") {
          back++;
          assert.ok(maze.house.has(g[0] * ROWS + g[1]), "it comes back in the ghost house");
        }
      });
      if (t && Math.abs(f.p[0] - frames[t - 1].p[0]) === maze.W - 1) tunnel++;
    });
  }
  assert.ok(scared > 0 && hidden > 0 && back > 0, `scared ${scared}, hidden ${hidden}, back ${back}`);
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
    assert.ok(frames[0].g.every((g) => maze.house.has(g[0] * ROWS + g[1])), "the ghosts start in the house");
    // they leave by the door: the first cell outside the house is the door
    for (let k = 0; k < 4; k++) {
      const out = frames.find((f) => !maze.house.has(f.g[k][0] * ROWS + f.g[k][1]));
      assert.deepEqual([out.g[k][0], out.g[k][1]], [maze.door.w, maze.door.i]);
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
