// Pac-Man for the heatmap. Pure functions: the maze is built from the contribution grid, a whole game is simulated (Pac-Man,
// the four ghosts, power pills, lives) and render.js writes the result into the SVG as keyframes, like the snake.
//
//   buildMaze(weeks, level, kind, rand)   kind: data (quiet days become walls, kept connected), classic (a fixed 7-row maze), open (no walls)
//   simulate(maze, { lives, seed })       frames: one move of one cell for everybody, with the score; ends with a win or a game over
//   playGame(weeks, level, options)       both, with a seed made from the data

export const ROWS = 7;
/** right, down, left, up: the index is the rotation (x 90 degrees) of a sprite looking right. */
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// Ghosts as in the arcade (level 1), but a little slower than there (0.78 of Pac-Man against the arcade 0.94, a maze this narrow is harder).
// Speeds are cells per tick, a tick being one move of Pac-Man: a ghost is slower than him,
// a scared one much slower. The scatter / chase turns come from the arcade's 7, 20, 7, 20, 5, 20, 5 seconds, at about 8.7 moves a second.
const GHOST_SPEED = 0.78;
const SCARED_SPEED = 0.62;
const SCATTER = [[0, 61], [236, 297], [472, 516], [691, 735]]; // ticks (from the start of a life) in which the ghosts scatter; chase otherwise
const RELEASE = [0, 0, 0.12, 0.25]; // share of the pellets Pac-Man must have eaten before a ghost leaves the house (the arcade: 0, 0, 30, 60 of 244)
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

// the "classic" maze, the arcade board squeezed into 7 rows and mirrored left to right: a wall along the edge with the tunnel as the
// only way through (row 3), a lane next to it, then thin walls only, as in the arcade: T shapes and short bars. The upper band (rows 1-2)
// has T's and bars, the lower one (rows 4-5) the same upside down and shifted by half a period, between corridors on rows 0, 3 and 6.
// Columns are counted from the nearest edge; the body repeats every 10.
const CLASSIC_HEAD = ["..", "#.", "#.", "..", "#.", "#.", ".."];
const CLASSIC_TOP = ["###.#.###.", ".#..#..#.."]; // rows 1 and 2
const classicWall = (u, i) => {
  if (u < 2) return CLASSIC_HEAD[i][u] === "#";
  const b = u - 2;
  if (i === 1 || i === 2) return CLASSIC_TOP[i - 1][b % 10] === "#";
  if (i === 4 || i === 5) return CLASSIC_TOP[5 - i][(b + 5) % 10] === "#"; // upside down: the bar is on the lower row
  return false;
};

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
  // the ghost house, as in the arcade: 5 x 3 days in the middle (rows 2-4), a door in the middle of its top edge and a corridor all
  // around it. The ghosts start in it and come back to it; Pac-Man never goes in. The middle one of the box is the den.
  const denK = idx(mid, 3);
  const [dw, di] = at(denK);
  const doorK = idx(dw, 1);
  const exitK = idx(dw, 2); // the top middle day of the box, under the door
  const box = (cw, c0, c1, r0, r1) => { const out = []; for (let w = cw + c0; w <= cw + c1; w++) for (let i = r0; i <= r1; i++) if (inGrid(w, i) && exists[idx(w, i)]) out.push(idx(w, i)); return out; };
  const house = new Set(box(dw, -2, 2, 2, 4));
  const startK = near(mid, ROWS - 1, denK);
  const keep = new Set([denK, startK, doorK, ...house, ...box(dw, -3, 3, 1, 5)]);
  const [door_w, door_i] = at(doorK);
  // tunnels: on up to two rows whose first and last day both exist, the left and the right edge are joined (out on one side,
  // in on the other, as in the arcade). The mouth of a tunnel is never walled up.
  const eligible = [...Array(ROWS).keys()].filter((i) => W >= 10 && exists[idx(0, i)] && exists[idx(W - 1, i)]).sort((a, b) => Math.abs(a - 3) - Math.abs(b - 3) || a - b);
  const tunnels = eligible.length ? [eligible[0], ...eligible.filter((i) => Math.abs(i - eligible[0]) >= 3).slice(0, 1)] : [];
  for (const i of tunnels) for (const w of [0, 1, W - 2, W - 1]) keep.add(idx(w, i));
  const link = (w, i) => (tunnels.includes(i) ? (w === 0 ? idx(W - 1, i) : w === W - 1 ? idx(0, i) : -1) : -1);

  const reach = () => {
    const seen = new Uint8Array(N);
    const q = [doorK];
    seen[doorK] = 1;
    let n = 1;
    for (let h = 0; h < q.length; h++) {
      const [w, i] = at(q[h]);
      const around = DIRS.filter(([a, b]) => inGrid(w + a, i + b)).map(([a, b]) => idx(w + a, i + b));
      if (link(w, i) >= 0) around.push(link(w, i));
      for (const k of around) if (!wall[k] && !seen[k] && !house.has(k)) (seen[k] = 1, n++, q.push(k));
    }
    return { n, seen };
  };
  let freeCount = cells.length - house.size; // cells Pac-Man can walk on
  const fill = (k) => { if (!wall[k]) (wall[k] = 1, freeCount--); };

  if (kind === "classic") {
    for (const k of cells) { const [w, i] = at(k); if (classicWall(Math.min(w, W - 1 - w), i) && !keep.has(k)) fill(k); }
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
  for (const k of cells) if (!wall[k] && !seen[k] && !house.has(k)) fill(k);

  // pellets: the days with contributions; four power pills, the busiest day of each quarter of the grid
  const pellet = new Uint8Array(N);
  const open = cells.filter((k) => !wall[k] && !house.has(k));
  for (const k of open) if (count[k] && k !== startK) pellet[k] = Math.max(1, level(count[k]));
  const power = new Set();
  for (let q = 0; q < 4; q++) {
    const inQ = open.filter((k) => pellet[k] && at(k)[0] >= Math.floor((q * W) / 4) && at(k)[0] < Math.floor(((q + 1) * W) / 4) && k !== denK);
    if (inQ.length) power.add(inQ.sort((a, b) => count[b] - count[a] || a - b)[0]);
  }
  return {
    W, N, kind, wall, exists, count, pellet, power, tunnels,
    pellets: open.filter((k) => pellet[k]).length,
    den: { w: dw, i: di }, door: { w: door_w, i: door_i }, exit: { w: dw, i: 2 }, house, start: { w: at(startK)[0], i: at(startK)[1] },
  };
}

/** One game. frames[t] = { p: [w, i, dir], a: 1 if Pac-Man is alive, g: [[w, i, state, dir] x 4] (c chasing, s scared, r eyes going back to the den after being eaten, e out of sight: Pac-Man was caught), l: lives, e: pellet cells eaten this frame, s: score }. */
export function simulate(maze, { lives = 3, seed = 1, maxTicks = 1200, scare = 30 } = {}) {
  const rand = mulberry32(seed);
  const { W, N, wall, den, start, tunnels, house, door, exit } = maze;
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
  const denK = idx(den.w, den.i);
  const doorK = idx(door.w, door.i);
  const exitK = idx(exit.w, exit.i);
  // the ghosts may use the house, only through the door; Pac-Man never enters it
  const nbG = nb.map((list, k) => list.filter(([a, b]) => {
    const n = idx(a, b);
    const hk = house.has(k), hn = house.has(n);
    return (!hk && !hn) || (hk && hn) || (k === doorK && n === exitK) || (k === exitK && n === doorK);
  }));
  const nbP = nb.map((list, k) => (house.has(k) ? [] : list.filter(([a, b]) => !house.has(idx(a, b)))));
  const bfs = (sources, table = nbG) => {
    const dist = new Int16Array(N).fill(-1);
    const q = [];
    for (const k of sources) (dist[k] = 0, q.push(k));
    for (let h = 0; h < q.length; h++) for (const [a, b] of table[q[h]]) if (dist[idx(a, b)] < 0) (dist[idx(a, b)] = dist[q[h]] + 1, q.push(idx(a, b)));
    return dist;
  };
  const toDoor = bfs([doorK]);
  const toDen = bfs([denK]);
  const corners = [[W - 1, 0], [0, 0], [W - 1, ROWS - 1], [0, ROWS - 1]];

  const left = Uint8Array.from(maze.pellet);
  let remaining = maze.pellets;
  const frames = [];
  let t = 0;
  let livesLeft = lives;
  let pac, ghosts, modeStart, stall, goal, before0, trail, noBack, eatenNow, lastEat, scattering, transit;
  let score = 0; // as in the arcade: 10 a pellet, 50 a power pill, then 200, 400, 800, 1600 for the ghosts it makes edible
  let chain = 0;
  const reset = () => {
    pac = { w: start.w, i: start.i, d: 0 };
    goal = -1;
    before0 = -1;
    trail = []; // the last cells he stood on
    noBack = 0; // until this tick he may not turn back
    ghosts = GHOSTS.map((_, k) => {
      const c = [exitK, denK, denK - ROWS, denK + ROWS][k]; // spread over the house
      return { k, w: Math.floor(c / ROWS), i: c % ROWS, d: 3, st: "c", until: 0, rel: k < 2 ? t + 2 + k * 5 : Infinity, acc: 0, flip: false };
    });
    modeStart = t;
    eatenNow = 0; // pellets eaten in this life: they let the other two ghosts out
    lastEat = t;
    scattering = true;
    transit = []; // the hidden cells of a tunnel still to cross
  };
  reset();
  stall = 0;
  const rec = (alive = 1, eaten = []) => frames.push({ p: [pac.w, pac.i, pac.d], a: alive, g: ghosts.map((g) => [g.w, g.i, g.st, g.d]), l: livesLeft, e: eaten, s: score });
  const eat = (eaten) => {
    const k = idx(pac.w, pac.i);
    if (k === goal) goal = -1;
    if (!left[k]) return;
    left[k] = 0;
    remaining--;
    stall = 0;
    eatenNow++;
    lastEat = t;
    eaten.push(k);
    score += maze.power.has(k) ? 50 : 10;
    if (maze.power.has(k)) {
      chain = 0;
      for (const g of ghosts) if (g.st !== "e" && g.st !== "r") (g.st = "s", g.until = t + scare, g.flip = true);
    }
  };
  const startEaten = [];
  eat(startEaten);
  rec(1, startEaten);

  // Pac-Man's next cell. A cell is safe if Pac-Man gets there before any ghost can (a ghost moves 2 ticks out of 3 and the ones
  // still in the den count their delay). He walks only through safe cells, to a scared ghost he can catch, a power pill when a
  // ghost is near, or the nearest pellet; with nothing safe left he runs to the cell the ghosts need the longest to reach.
  const pacMove = () => {
    const pk = idx(pac.w, pac.i);
    // A, B, A, B, A with nothing eaten and nobody close is pacing: for a while he may not turn back, so he picks a way and takes it
    if (trail.length === 4 && trail[0] === pk && trail[2] === pk && trail[1] === trail[3] && trail[1] !== pk) noBack = t + 8;
    const threats = ghosts.filter((g) => g.st === "c" || (g.st === "s" && g.until - t <= 2));
    const arrive = new Float64Array(N).fill(Infinity);
    for (const g of threats) {
      const d = bfs([idx(g.w, g.i)]);
      const delay = Math.max(0, g.rel - t);
      for (let k = 0; k < N; k++) if (d[k] >= 0 && d[k] / GHOST_SPEED + delay < arrive[k]) arrive[k] = d[k] / GHOST_SPEED + delay;
    }
    // a long time without a pellet: take more risk, then none at all
    const margin = stall > 90 ? -Infinity : stall > 40 ? 0 : 1;
    // every cell he can reach before the ghosts (by at least `m` ticks), with the way there
    const search = (m) => {
      const dist = new Int16Array(N).fill(-1);
      const prev = new Int32Array(N).fill(-1);
      const q = [pk];
      dist[pk] = 0;
      for (let h = 0; h < q.length; h++) {
        for (const [a, b] of nbP[q[h]]) {
          const n = idx(a, b);
          if (dist[n] >= 0) continue;
          if (q[h] === pk && n === before0 && (arrive[pk] > 10 || t < noBack) && nbP[pk].length > 1) continue; // no turning back on the spot when nobody is near
          const s = dist[q[h]] + 1;
          if (m !== -Infinity && s + m >= arrive[n]) continue;
          dist[n] = s;
          prev[n] = q[h];
          q.push(n);
        }
      }
      return { dist, prev, q };
    };
    let { dist, prev, q } = search(margin);
    let target = -1;
    let bestG = Infinity;
    for (const g of ghosts) {
      if (g.st !== "s") continue;
      const k = idx(g.w, g.i);
      if (dist[k] > 0 && dist[k] <= Math.min(9, g.until - t - 2) && dist[k] < bestG) (bestG = dist[k], target = k);
    }
    if (target < 0 && arrive[pk] <= (maze.power.has(goal) ? 10 : 7)) {
      // a power pill that is close; once he is on his way to one he does not change his mind when a ghost steps back
      let best = Infinity;
      for (const k of maze.power) if (left[k] && dist[k] > 0 && dist[k] <= 9 && dist[k] < best) (best = dist[k], target = k);
      if (target >= 0) goal = target;
    }
    // the pellet he chose stays his goal until it is eaten or out of reach (changing his mind at every step made him zigzag)
    const choose = () => {
      if (goal >= 0 && left[goal] && goal !== pk && dist[goal] > 0) return goal;
      let best = Infinity, pick = -1;
      for (const k of q) if (left[k] && k !== pk && dist[k] - left[k] * 0.01 < best) (best = dist[k] - left[k] * 0.01, pick = k);
      return pick;
    };
    if (target < 0) goal = target = choose();
    // no pellet is safe but no ghost is near either (the pellets left are all next to ghosts): go for the least risky one, a little
    // more risk each time, instead of pacing up and down in a corner until the ghosts have closed in
    if (target < 0 && arrive[pk] > 6)
      for (const m of [-1, -2, -3, -5]) {
        ({ dist, prev, q } = search(m));
        if ((goal = target = choose()) >= 0) break;
      }

    if (target < 0) {
      // nothing safe: run to the neighbour with the most room to keep running (cells still reachable before the ghosts), not into a dead end
      let best = null;
      let bestScore = -Infinity;
      const keepOn = arrive[pk] > 6 ? 40 : 4; // nobody near: no pacing back and forth
      for (const [a, b, d0] of nbP[pk]) {
        if (d0 === (pac.d + 2) % 4 && t < noBack && nbP[pk].length > 1) continue;
        const n = idx(a, b);
        const seen = new Set([pk, n]);
        const qq = [[n, 1]];
        let room = 0;
        for (let h = 0; h < qq.length && room < 60; h++) {
          const [c, s2] = qq[h];
          if (s2 + 1 >= arrive[c]) continue;
          room++;
          for (const [x, y] of nbP[c]) {
            const m = idx(x, y);
            if (!seen.has(m)) (seen.add(m), qq.push([m, s2 + 1]));
          }
        }
        const score = room * 10 + Math.min(arrive[n], 30) + nbP[n].length * 0.1 + (d0 === pac.d ? keepOn : d0 === (pac.d + 2) % 4 ? -keepOn : 0); // keep going rather than turn back
        if (score > bestScore) (bestScore = score, best = [a, b]);
      }
      return best;
    }
    let k = target;
    while (prev[k] !== pk) k = prev[k];
    return [Math.floor(k / ROWS), k % ROWS];
  };

  const ghostMove = (g) => {
    if (g.st === "e") return; // Pac-Man was caught: out of sight until the board is set again
    if (g.st === "r") {
      // eaten: just a pair of eyes, quick, back through the door to the den, then it comes out again
      const k = idx(g.w, g.i);
      const pick = nbG[k].reduce((b, o) => (toDen[idx(o[0], o[1])] < toDen[idx(b[0], b[1])] ? o : b), nbG[k][0]);
      if (pick) [g.w, g.i, g.d] = pick;
      if (idx(g.w, g.i) === denK) (g.st = "c", g.rel = t + 10);
      return;
    }
    if (t < g.rel) return;
    if (g.st === "s" && t >= g.until) g.st = "c";
    // Blinky stops scattering when few pellets are left (the arcade's Cruise Elroy, without the extra speed: here that would be unbeatable)
    const elroy = g.k === 0 && remaining <= maze.pellets * 0.1;
    g.acc += g.st === "s" ? SCARED_SPEED : GHOST_SPEED;
    if (g.acc < 1) return;
    g.acc -= 1;
    const k = idx(g.w, g.i);
    let opts = nbG[k];
    const back = (g.d + 2) % 4;
    if (opts.length > 1) opts = opts.filter(([, , d]) => d !== back);
    let pick;
    if (house.has(k)) {
      // in the house: to the middle, then out of the door
      pick = nbG[k].reduce((b, o) => (toDoor[idx(o[0], o[1])] < toDoor[idx(b[0], b[1])] ? o : b), nbG[k][0]);
    } else if (g.flip) {
      // the scatter / chase turn (or a power pill): at the next cell it goes back the way it came
      pick = nbG[k].find(([, , d]) => d === back) ?? opts[0];
    } else if (g.st === "s") {
      pick = opts[Math.floor(rand() * opts.length)];
    } else {
      const [pd0, pd1] = DIRS[pac.d];
      let tw, ti;
      if (scattering && !elroy) [tw, ti] = corners[g.k];
      else if (g.k === 0) [tw, ti] = [pac.w, pac.i];
      else if (g.k === 1) [tw, ti] = [pac.w + 4 * pd0, pac.i + 4 * pd1]; // four cells ahead of him
      else if (g.k === 2) { const b = ghosts[0]; [tw, ti] = [2 * (pac.w + 2 * pd0) - b.w, 2 * (pac.i + 2 * pd1) - b.i]; } // twice the way from Blinky to two cells ahead
      else if ((g.w - pac.w) ** 2 + (g.i - pac.i) ** 2 > 64) [tw, ti] = [pac.w, pac.i]; // Clyde: chases from afar, goes to his corner when closer than 8
      else [tw, ti] = corners[3];
      pick = opts.reduce((b, o) => ((o[0] - tw) ** 2 + (o[1] - ti) ** 2 < (b[0] - tw) ** 2 + (b[1] - ti) ** 2 ? o : b), opts[0]);
    }
    g.flip = false;
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
      if (g.st === "s") (g.st = "r", score += 100 * 2 ** ++chain);
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
    // scatter / chase: every turn sends the ghosts back the way they came
    const scatterNow = SCATTER.some(([a, b]) => t - modeStart >= a && t - modeStart < b);
    if (scatterNow !== scattering) for (const g of ghosts) if (g.st === "c" && !house.has(idx(g.w, g.i))) g.flip = true;
    scattering = scatterNow;
    // the third and the fourth ghost leave when Pac-Man has eaten enough, or when he has not eaten for a while
    for (const g of ghosts) if (g.rel === Infinity && (g.st === "c" || g.st === "s") && (g.k < 3 || ghosts[g.k - 1].rel !== Infinity) && (eatenNow >= RELEASE[g.k] * maze.pellets || t - lastEat > 40)) g.rel = t;
    const crossing = transit.length > 0;
    let step = crossing ? transit.shift() : pacMove();
    if (step && !crossing && Math.abs(step[0] - pac.w) > 1) {
      // through the tunnel: out of one edge, two hidden cells (the clip hides them), in from the other, so he never changes speed
      const right = step[0] < pac.w;
      transit = right ? [[-1, step[1]], step] : [[W, step[1]], step];
      step = [right ? W : -1, step[1]];
    }
    const eaten = [];
    if (step) {
      const d = DIRS.findIndex(([a, b]) => pac.w + a === step[0] && pac.i + b === step[1]);
      before0 = idx(pac.w, pac.i);
      trail = [...trail.slice(-3), before0];
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
  if (result === "over" && frames.at(-1).a === 0) hold(5, 0); // game over after a death: the board stays a little longer
  frames.slice(-10).forEach((f) => (f.r = result)); // the last moments of the game, while WIN / GAME OVER shows
  return { frames, result, pellets: maze.pellets };
}

/** The whole thing for a heatmap: the maze and a game, both from the same seed (login and contributions), so a given profile always plays the same. */
export function playGame(weeks, level, { kind = "data", lives = 3, games = 1, seedText = "" } = {}) {
  const total = weeks.flat().reduce((s, [, n]) => s + n, 0);
  const seed = hashSeed(`${seedText}:${total}:${weeks.length}`);
  const maze = buildMaze(weeks, level, kind, mulberry32(seed));
  // one to three games on the same maze, one after the other (each frame says which one it belongs to: n)
  const played = Array.from({ length: games }, (_, n) => simulate(maze, { lives, seed: (seed ^ 0x9e3779b9) + n * 7919 }));
  played.forEach((g, n) => g.frames.forEach((f) => (f.n = n)));
  return { maze, frames: played.flatMap((g) => g.frames), results: played.map((g) => g.result), result: played.at(-1).result, games };
}
