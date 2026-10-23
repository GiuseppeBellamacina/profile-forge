// Pac-Man for the heatmap. Pure functions: the maze is built from the contribution grid, a whole game is simulated (Pac-Man,
// the four ghosts, power pills, lives) and render.js writes the result into the SVG as keyframes, like the snake.
//
//   buildMaze(weeks, level, kind, rand)   kind: data (quiet days become walls, kept connected), classic (a fixed 7-row maze), open (no walls)
//   simulate(maze, { lives, seed })       frames: one move of one cell for everybody; ends with a win or a game over
//   playGame(weeks, level, options)       both, with a seed made from the data

export const ROWS = 7;
/** right, down, left, up: the index is the rotation (x 90 degrees) of a sprite looking right. */
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const GHOST_SPEED = 2 / 3; // cells per tick of a chasing ghost
const GHOST_ORDER = [3, 2, 1, 0]; // when two moves are equally good a ghost prefers up, left, down, right (as in the arcade)
export const GHOSTS = ["blinky", "pinky", "inky", "clyde"];
export const PACMAN_MAZES = ["data", "classic", "open"];

export const mulberry32 = (a) => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const hashSeed = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

// the "classic" maze: 8 columns wide, repeated along the weeks. Corridors on rows 0, 2, 4, 6 and gaps in the blocks between them.
const CLASSIC = [
  "........",
  ".###.##.",
  "........",
  "#.#..#.#",
  "........",
  ".##.###.",
  "........",
];

/** weeks: [[date, count, row]] per week. level(count) -> 0..4. Returns the maze (see the fields below). */
export function buildMaze(weeks, level, kind = "data", rand = Math.random) {
  const W = weeks.length;
  const N = W * ROWS;
  const idx = (w, i) => w * ROWS + i;
  const inGrid = (w, i) => w >= 0 && w < W && i >= 0 && i < ROWS;
  const exists = new Uint8Array(N);
  const wall = new Uint8Array(N).fill(1);
  const count = new Array(N).fill(0);
  for (const [w, wk] of weeks.entries())
    for (const [, n, i] of wk) {
      exists[idx(w, i)] = 1;
      wall[idx(w, i)] = 0;
      count[idx(w, i)] = n;
    }
  const cells = [...exists.keys()].filter((k) => exists[k]);
  const at = (k) => [Math.floor(k / ROWS), k % ROWS];
  const near = (tw, ti, skip = -1) => cells.filter((k) => k !== skip).sort((a, b) => Math.abs(at(a)[0] - tw) + Math.abs(at(a)[1] - ti) - (Math.abs(at(b)[0] - tw) + Math.abs(at(b)[1] - ti)) || a - b)[0];

  const mid = Math.floor(W / 2);
  const denK = near(mid, 3);
  const [dw, di] = at(denK);
  const startK = near(mid, ROWS - 1, denK);
  // the den and the cells around it, and the start, are never walls
  const keep = new Set([denK, startK]);
  for (const [a, b] of DIRS) if (inGrid(dw + a, di + b) && exists[idx(dw + a, di + b)]) keep.add(idx(dw + a, di + b));
  // tunnels: on up to two rows whose first and last day both exist, the left and the right edge are joined (out on one side,
  // in on the other, as in the arcade). The mouth of a tunnel is never walled up.
  const eligible = [...Array(ROWS).keys()].filter((i) => W >= 10 && exists[idx(0, i)] && exists[idx(W - 1, i)]).sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) || a - b);
  const tunnels = eligible.length ? [eligible[0], ...eligible.filter((i) => Math.abs(i - eligible[0]) >= 3).slice(0, 1)] : [];
  for (const i of tunnels) for (const w of [0, 1, W - 2, W - 1]) keep.add(idx(w, i));
  const link = (w, i) => (tunnels.includes(i) ? (w === 0 ? idx(W - 1, i) : w === W - 1 ? idx(0, i) : -1) : -1);

  const reach = () => {
    const seen = new Uint8Array(N);
    const q = [denK];
    seen[denK] = 1;
    let n = 1;
    for (let h = 0; h < q.length; h++) {
      const [w, i] = at(q[h]);
      const around = DIRS.filter(([a, b]) => inGrid(w + a, i + b)).map(([a, b]) => idx(w + a, i + b));
      if (link(w, i) >= 0) around.push(link(w, i));
      for (const k of around) if (!wall[k] && !seen[k]) (seen[k] = 1, n++, q.push(k));
    }
    return { n, seen };
  };
  let freeCount = cells.length;
  const fill = (k) => { if (!wall[k]) (wall[k] = 1, freeCount--); };

  if (kind === "classic") {
    for (const k of cells) { const [w, i] = at(k); if (CLASSIC[i][w % 8] === "#" && !keep.has(k)) fill(k); }
  } else if (kind === "data") {
    // quiet days become walls, in a random order, as long as every free cell can still be reached (and not too many)
    const quiet = cells.filter((k) => !count[k] && !keep.has(k));
    for (let n = quiet.length - 1; n > 0; n--) { const j = Math.floor(rand() * (n + 1)); [quiet[n], quiet[j]] = [quiet[j], quiet[n]]; }
    const most = Math.floor(cells.length * 0.3);
    for (const k of quiet) {
      if (cells.length - freeCount >= most) break;
      wall[k] = 1;
      freeCount--;
      // keep the maze a maze of loops: no dead end may appear (a free cell with a single free neighbour), and everything stays connected
      const [kw, ki] = at(k);
      const deadEnd = DIRS.some(([a, b]) => {
        const w = kw + a, i = ki + b;
        return inGrid(w, i) && !wall[idx(w, i)] && DIRS.filter(([c, d]) => inGrid(w + c, i + d) && !wall[idx(w + c, i + d)]).length + (link(w, i) >= 0 ? 1 : 0) < 2;
      });
      if (deadEnd || reach().n !== freeCount) (wall[k] = 0, freeCount++);
    }
  }
  // whatever cannot be reached from the den (a piece of the last week, a corner the template cut off) becomes wall
  const { seen } = reach();
  for (const k of cells) if (!wall[k] && !seen[k]) fill(k);

  // pellets: the days with contributions; four power pills, the busiest day of each quarter of the grid
  const pellet = new Uint8Array(N);
  const open = cells.filter((k) => !wall[k]);
  for (const k of open) if (count[k] && k !== startK) pellet[k] = Math.max(1, level(count[k]));
  const power = new Set();
  for (let q = 0; q < 4; q++) {
    const inQ = open.filter((k) => pellet[k] && at(k)[0] >= Math.floor((q * W) / 4) && at(k)[0] < Math.floor(((q + 1) * W) / 4) && k !== denK);
    if (inQ.length) power.add(inQ.sort((a, b) => count[b] - count[a] || a - b)[0]);
  }
  return {
    W, N, kind, wall, exists, count, pellet, power, tunnels,
    pellets: open.filter((k) => pellet[k]).length,
    den: { w: dw, i: di }, start: { w: at(startK)[0], i: at(startK)[1] },
  };
}

/** One game. frames[t] = { p: [w, i, dir], a: 1 if Pac-Man is alive, g: [[w, i, state, dir] x 4] (c chasing, s scared, e out of sight: eaten, or Pac-Man was caught), l: lives, e: pellet cells eaten this frame }. */
export function simulate(maze, { lives = 3, seed = 1, maxTicks = 1200, scare = 30 } = {}) {
  const rand = mulberry32(seed);
  const { W, N, wall, den, start, tunnels } = maze;
  const idx = (w, i) => w * ROWS + i;
  const free = (w, i) => w >= 0 && w < W && i >= 0 && i < ROWS && !wall[idx(w, i)];
  const nb = Array.from({ length: N }, (_, k) => {
    if (wall[k]) return [];
    const w = Math.floor(k / ROWS), i = k % ROWS;
    const list = GHOST_ORDER.map((d) => [w + DIRS[d][0], i + DIRS[d][1], d]).filter(([a, b]) => free(a, b));
    if (tunnels.includes(i) && w === W - 1 && free(0, i)) list.push([0, i, 0]); // out on the right, in on the left
    if (tunnels.includes(i) && w === 0 && free(W - 1, i)) list.push([W - 1, i, 2]);
    return list;
  });
  const bfs = (sources) => {
    const dist = new Int16Array(N).fill(-1);
    const q = [];
    for (const k of sources) (dist[k] = 0, q.push(k));
    for (let h = 0; h < q.length; h++) for (const [a, b] of nb[q[h]]) if (dist[idx(a, b)] < 0) (dist[idx(a, b)] = dist[q[h]] + 1, q.push(idx(a, b)));
    return dist;
  };
  const corners = [[W - 1, 0], [0, 0], [W - 1, ROWS - 1], [0, ROWS - 1]];

  const left = Uint8Array.from(maze.pellet);
  let remaining = maze.pellets;
  const frames = [];
  let t = 0;
  let livesLeft = lives;
  let pac, ghosts, modeStart, stall, goal, before0;
  const reset = () => {
    pac = { w: start.w, i: start.i, d: 0 };
    goal = -1;
    before0 = -1;
    ghosts = GHOSTS.map((_, k) => ({ k, w: den.w, i: den.i, d: 3, st: "c", until: 0, rel: t + 2 + k * 9 }));
    modeStart = t;
  };
  reset();
  stall = 0;
  const rec = (alive = 1, eaten = []) => frames.push({ p: [pac.w, pac.i, pac.d], a: alive, g: ghosts.map((g) => [g.w, g.i, g.st, g.d]), l: livesLeft, e: eaten });
  const eat = (eaten) => {
    const k = idx(pac.w, pac.i);
    if (k === goal) goal = -1;
    if (!left[k]) return;
    left[k] = 0;
    remaining--;
    stall = 0;
    eaten.push(k);
    if (maze.power.has(k)) for (const g of ghosts) if (g.st !== "e") (g.st = "s", g.until = t + scare, g.d = (g.d + 2) % 4);
  };
  const startEaten = [];
  eat(startEaten);
  rec(1, startEaten);

  // Pac-Man's next cell. A cell is safe if Pac-Man gets there before any ghost can (a ghost moves 2 ticks out of 3 and the ones
  // still in the den count their delay). He walks only through safe cells, to a scared ghost he can catch, a power pill when a
  // ghost is near, or the nearest pellet; with nothing safe left he runs to the cell the ghosts need the longest to reach.
  const pacMove = () => {
    const pk = idx(pac.w, pac.i);
    const threats = ghosts.filter((g) => g.st === "c" || (g.st === "s" && g.until - t <= 2));
    const arrive = new Float64Array(N).fill(Infinity);
    for (const g of threats) {
      const d = bfs([idx(g.w, g.i)]);
      const delay = Math.max(0, g.rel - t);
      for (let k = 0; k < N; k++) if (d[k] >= 0 && d[k] / GHOST_SPEED + delay < arrive[k]) arrive[k] = d[k] / 0.75 + delay;
    }
    // a long time without a pellet: take more risk, then none at all
    const margin = stall > 90 ? -Infinity : stall > 40 ? 0 : 1;
    const dist = new Int16Array(N).fill(-1);
    const prev = new Int32Array(N).fill(-1);
    const q = [pk];
    dist[pk] = 0;
    for (let h = 0; h < q.length; h++) {
      for (const [a, b] of nb[q[h]]) {
        const n = idx(a, b);
        if (dist[n] >= 0) continue;
        if (q[h] === pk && n === before0 && arrive[pk] > 10 && nb[pk].length > 1) continue; // no turning back on the spot when nobody is near
        const s = dist[q[h]] + 1;
        if (margin !== -Infinity && s + margin >= arrive[n]) continue;
        dist[n] = s;
        prev[n] = q[h];
        q.push(n);
      }
    }
    let target = -1;
    let bestG = Infinity;
    for (const g of ghosts) {
      if (g.st !== "s") continue;
      const k = idx(g.w, g.i);
      if (dist[k] > 0 && dist[k] <= Math.min(9, g.until - t - 2) && dist[k] < bestG) (bestG = dist[k], target = k);
    }
    if (target < 0 && arrive[pk] <= 7) {
      let best = Infinity;
      for (const k of maze.power) if (left[k] && dist[k] > 0 && dist[k] < best) (best = dist[k], target = k);
    }
    // keep going for the pellet he chose until it is eaten or out of reach (changing his mind at every step made him zigzag)
    if (target < 0 && goal >= 0 && left[goal] && goal !== pk && dist[goal] > 0) target = goal;
    if (target < 0) {
      let best = Infinity;
      for (const k of q) if (left[k] && k !== pk && dist[k] - left[k] * 0.01 < best) (best = dist[k] - left[k] * 0.01, target = k);
      goal = target;
    }
    if (target < 0) {
      // nothing safe: run to the neighbour with the most room to keep running (cells still reachable before the ghosts), not into a dead end
      let best = null;
      let bestScore = -Infinity;
      for (const [a, b] of nb[pk]) {
        const n = idx(a, b);
        const seen = new Set([pk, n]);
        const qq = [[n, 1]];
        let room = 0;
        for (let h = 0; h < qq.length && room < 60; h++) {
          const [c, s2] = qq[h];
          if (s2 + 1 >= arrive[c]) continue;
          room++;
          for (const [x, y] of nb[c]) {
            const m = idx(x, y);
            if (!seen.has(m)) (seen.add(m), qq.push([m, s2 + 1]));
          }
        }
        const score = room * 10 + Math.min(arrive[n], 30) + nb[n].length * 0.1;
        if (score > bestScore) (bestScore = score, best = [a, b]);
      }
      return best;
    }
    let k = target;
    while (prev[k] !== pk) k = prev[k];
    return [Math.floor(k / ROWS), k % ROWS];
  };

  const ghostMove = (g) => {
    if (g.st === "e") {
      // eaten, or Pac-Man was caught: out of sight until its time is up, then back in the den
      if (t >= g.rel) [g.w, g.i, g.d, g.st, g.rel] = [den.w, den.i, 3, "c", t];
      return;
    }
    if (t < g.rel) return;
    if (g.st === "s" && t >= g.until) g.st = "c";
    if (g.st === "c" && t % 3 === 2) return; // a little slower than Pac-Man
    if (g.st === "s" && t % 2 === 1) return;
    const k = idx(g.w, g.i);
    let opts = nb[k];
    const back = (g.d + 2) % 4;
    if (opts.length > 1) opts = opts.filter(([, , d]) => d !== back);
    let pick;
    if (g.st === "s") {
      pick = opts[Math.floor(rand() * opts.length)];
    } else {
      const scatter = (t - modeStart) % 56 < 20;
      const [pd0, pd1] = DIRS[pac.d];
      let tw, ti;
      if (scatter) [tw, ti] = corners[g.k];
      else if (g.k === 0) [tw, ti] = [pac.w, pac.i];
      else if (g.k === 1) [tw, ti] = [pac.w + 4 * pd0, pac.i + 4 * pd1];
      else if (g.k === 2) { const b = ghosts[0]; [tw, ti] = [2 * (pac.w + 2 * pd0) - b.w, 2 * (pac.i + 2 * pd1) - b.i]; }
      else if (Math.abs(g.w - pac.w) + Math.abs(g.i - pac.i) > 8) [tw, ti] = [pac.w, pac.i];
      else [tw, ti] = corners[3];
      pick = opts.reduce((b, o) => ((o[0] - tw) ** 2 + (o[1] - ti) ** 2 < (b[0] - tw) ** 2 + (b[1] - ti) ** 2 ? o : b), opts[0]);
    }
    if (!pick) return;
    [g.w, g.i, g.d] = pick;
  };

  let result = null;
  const hold = (n, alive = 1) => { for (let h = 0; h < n; h++) { t++; rec(alive); } };
  // contact: same cell, or two that swapped places this frame. Returns true if Pac-Man lost a life.
  const contact = (before) => {
    let dead = false;
    ghosts.forEach((g, n) => {
      const same = g.w === pac.w && g.i === pac.i;
      const swapped = before.g[n][0] === pac.w && before.g[n][1] === pac.i && g.w === before.p[0] && g.i === before.p[1];
      if (!same && !swapped) return;
      if (g.st === "s") (g.st = "e", g.rel = t + 14);
      else if (g.st === "c") dead = true;
    });
    return dead;
  };
  const die = (eaten = []) => {
    livesLeft--;
    rec(0, eaten); // a pellet he ate in the same move still counts
    for (const g of ghosts) (g.st = "e", g.rel = Infinity); // the ghosts disappear with him
    hold(5, 0);
    if (livesLeft <= 0) return (result = "over");
    t++;
    reset();
    stall = 0;
    rec(1);
    return null;
  };

  while (!result && t < maxTicks) {
    t++;
    stall++;
    const before = { p: [pac.w, pac.i], g: ghosts.map((g) => [g.w, g.i]) };
    const step = pacMove();
    const eaten = [];
    if (step) {
      const d = DIRS.findIndex(([a, b]) => pac.w + a === step[0] && pac.i + b === step[1]);
      before0 = idx(pac.w, pac.i);
      [pac.w, pac.i, pac.d] = [step[0], step[1], d < 0 ? (step[0] < pac.w ? 0 : 2) : d]; // d < 0: through the tunnel
    }
    if (contact(before)) { die(); continue; }
    eat(eaten);
    if (!remaining) { rec(1, eaten); hold(10); result = "win"; break; }
    const mid = { p: [pac.w, pac.i], g: ghosts.map((g) => [g.w, g.i]) };
    for (const g of ghosts) ghostMove(g);
    if (contact({ p: before.p, g: mid.g })) { die(eaten); continue; }
    rec(1, eaten);
  }
  if (!result) { hold(10); result = "over"; }
  return { frames, result, pellets: maze.pellets };
}

/** The whole thing for a heatmap: the maze and a game, both from the same seed (login and contributions), so a given profile always plays the same. */
export function playGame(weeks, level, { kind = "data", lives = 3, seedText = "" } = {}) {
  const total = weeks.flat().reduce((s, [, n]) => s + n, 0);
  const seed = hashSeed(`${seedText}:${total}:${weeks.length}`);
  const maze = buildMaze(weeks, level, kind, mulberry32(seed));
  return { maze, ...simulate(maze, { lives, seed: seed ^ 0x9e3779b9 }) };
}
