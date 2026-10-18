// Snake pathfinder for the heatmap. Pure functions: given the grid they return the snake's route, which render.js embeds
// in the SVG as keyframes (nothing is computed when the image is viewed).
//
// Planned routes (the search runs at every step on the 7 x weeks grid: Dijkstra to the nearest remaining day of the tier
// being eaten, never into its own body, steering out of dead ends, avoiding days that are not due yet):
//   smart    quietest days first, then busier ones      busy     the busiest days first, then quieter ones
//   nearest  always the closest day, whatever its count
// Fixed routes: sweep (column by column), rows (row by row), spiral (outside in).

const ROWS = 7;
const PENALTY = 10; // extra cost of crossing a day that is busier than the tier being eaten

export const key = (w, i) => `${w},${i}`;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // fixed order: deterministic ties

/** weeks: [[date, count, row], ...] per week. level(count) -> 0..4. Returns { pts: [{w, i}], eaten: Map(key -> index into pts) }. */
export function planSnake(weeks, level, len = 6, maxSteps = 1600, order = "quiet") {
  const W = weeks.length;
  const exists = new Set();
  const tier = new Map(); // key -> level of a day that has contributions
  for (const [w, wk] of weeks.entries()) for (const [, n, i] of wk) { exists.add(key(w, i)); if (n) tier.set(key(w, i), level(n)); }
  const uneaten = new Set(tier.keys());
  // A cell with a single neighbour (today, alone in the last week) is a trap: once in, the body closes the way back. The snake
  // does not aim for it; it is eaten when the snake leaves through the last column.
  const deadEnd = new Set([...exists].filter((k) => { const [w, i] = k.split(",").map(Number); return DIRS.filter(([dw, di]) => exists.has(key(w + dw, i + di))).length <= 1; }));
  const pts = [{ w: -1, i: 3 }]; // enters from the left, in the middle row
  const eaten = new Map();
  let body = Array.from({ length: len }, (_, k) => key(-1 - k, 3)); // head first

  // the rank decides what is eaten first (lower rank first); "nearest" ignores how busy a day was
  const rank = (k) => (order === "busy" ? 5 - tier.get(k) : order === "quiet" ? tier.get(k) : 1);
  const lowest = () => { let m = Infinity; for (const k of uneaten) if (!deadEnd.has(k)) m = Math.min(m, rank(k)); return m; };

  // cheapest routes from the head to every cell, honouring the body (a segment frees its cell after len - idx moves)
  const routes = (head, cur) => {
    const dist = new Map([[key(head.w, head.i), 0]]);
    const depth = new Map([[key(head.w, head.i), 0]]);
    const prev = new Map();
    const open = [[0, head.w, head.i]];
    while (open.length) {
      let b = 0;
      for (let q = 1; q < open.length; q++) if (open[q][0] < open[b][0] || (open[q][0] === open[b][0] && (open[q][1] < open[b][1] || (open[q][1] === open[b][1] && open[q][2] < open[b][2])))) b = q;
      const [d, w, i] = open.splice(b, 1)[0];
      const k = key(w, i);
      if (d > dist.get(k)) continue;
      for (const [dw, di] of DIRS) {
        const nw = w + dw;
        const ni = i + di;
        const nk = key(nw, ni);
        if (!exists.has(nk)) continue;
        const dd = depth.get(k) + 1;
        const idx = body.indexOf(nk);
        if (idx >= 0 && len - idx > dd) continue; // still occupied when we would get there
        const cost = d + 1 + (uneaten.has(nk) && rank(nk) > cur ? PENALTY : 0);
        if (cost < (dist.get(nk) ?? Infinity)) { dist.set(nk, cost); depth.set(nk, dd); prev.set(nk, k); open.push([cost, nw, ni]); }
      }
    }
    return { dist, prev };
  };
  const firstStep = (prev, from, to) => { let k = to; while (prev.get(k) !== from) k = prev.get(k); return k; };

  // room left for the snake after moving its head to `next`: a flood fill that treats the (moved) body as walls.
  // Dead ends (a corner it would be trapped in) have little room, so such moves are avoided.
  const room = (next) => {
    const wall = new Set([next, ...body.slice(0, len - 1)]);
    const seen = new Set([next]);
    const stack = [next];
    while (stack.length && seen.size < len * 4) {
      const [w, i] = stack.pop().split(",").map(Number);
      for (const [dw, di] of DIRS) {
        const nk = key(w + dw, i + di);
        if (exists.has(nk) && !wall.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
      }
    }
    return seen.size;
  };
  const SAFE = len * 3;
  // the step towards `target`, or the best safe neighbour when that step would lead into a dead end
  const chooseStep = (prev, hk, target) => {
    const direct = firstStep(prev, hk, target);
    if (room(direct) >= SAFE) return direct;
    const [tw, ti] = target.split(",").map(Number);
    let best = direct;
    let bestScore = -Infinity;
    for (const [dw, di] of DIRS) {
      const nk = key(head.w + dw, head.i + di);
      const idx = body.indexOf(nk);
      if (!exists.has(nk) || (idx >= 0 && len - idx > 1)) continue;
      const r = room(nk);
      const score = (r >= SAFE ? 1000 : r) - (Math.abs(head.w + dw - tw) + Math.abs(head.i + di - ti));
      if (score > bestScore) (bestScore = score, best = nk);
    }
    return best;
  };

  let head = { w: -1, i: 3 };
  // the first move is always into the grid
  const enter = () => { const k = key(0, 3); const [w, i] = k.split(",").map(Number); head = { w, i }; pts.push(head); body = [k, ...body.slice(0, len - 1)]; if (uneaten.delete(k)) eaten.set(k, pts.length - 1); };
  if (exists.has(key(0, 3))) enter();

  // A snake that goes round in circles without eating is stuck (an area it cannot cross yet, a dead-end rule that keeps
  // undoing its last step). After STALL moves without a bite it stops being picky: nearest day of any kind, straight
  // path, no dead-end avoidance. After GIVE_UP it quits and leaves; what is left is eaten on the way out.
  const STALL = ROWS * 6;
  const GIVE_UP = STALL * 3;
  let stall = 0;
  while ([...uneaten].some((k) => !deadEnd.has(k)) && pts.length < maxSteps && stall < GIVE_UP) {
    const desperate = stall >= STALL;
    const cur = desperate ? Infinity : lowest();
    const { dist, prev } = routes(head, cur);
    const hk = key(head.w, head.i);
    let target = null;
    for (const wantTier of desperate ? [null] : [cur, ...[1, 2, 3, 4].filter((t) => t > cur)]) {
      const reachable = [...uneaten].filter((k) => !deadEnd.has(k) && (wantTier === null || rank(k) === wantTier) && dist.has(k)).sort((a, b) => dist.get(a) - dist.get(b) || (a < b ? -1 : 1));
      if (reachable.length) { target = reachable[0]; break; }
    }
    if (!target) break; // boxed in by its own body: the rest is eaten when the snake leaves
    const next = desperate ? firstStep(prev, hk, target) : chooseStep(prev, hk, target);
    const [w, i] = next.split(",").map(Number);
    head = { w, i };
    pts.push(head);
    body = [next, ...body.slice(0, len - 1)];
    if (uneaten.delete(next)) (eaten.set(next, pts.length - 1), (stall = 0));
    else stall++;
  }

  // leave through the right edge: walk to the last column, then step off the grid
  if (W) {
    let guard = 0;
    let waits = 0;
    while (head.w < W - 1 && guard++ < 4 * (W + ROWS)) {
      const { dist, prev } = routes(head, 5);
      let target = null;
      let bestD = Infinity;
      for (let i = 0; i < ROWS; i++) { const k = key(W - 1, i); if (dist.has(k) && dist.get(k) < bestD) { bestD = dist.get(k); target = k; } }
      if (!target) {
        // its own body is in the way: stand still while the tail moves off, instead of jumping out of the grid
        if (waits++ >= len) break;
        pts.push({ ...head });
        body = [key(head.w, head.i), ...body.slice(0, len - 1)];
        continue;
      }
      const next = firstStep(prev, key(head.w, head.i), target);
      const [w, i] = next.split(",").map(Number);
      head = { w, i };
      pts.push(head);
      body = [next, ...body.slice(0, len - 1)];
      if (uneaten.delete(next)) eaten.set(next, pts.length - 1);
    }
    pts.push({ w: W, i: head.i });
  }
  // whatever the snake could not reach disappears as it leaves
  for (const k of uneaten) eaten.set(k, pts.length - 1);
  return { pts, eaten };
}

/** The classic route: down one column, up the next. Every day is eaten as the head passes. */
export function sweepSnake(weeks) {
  const pts = [{ w: -1, i: 0 }];
  const eaten = new Map();
  for (const [w, wk] of weeks.entries()) {
    const rows = [0, 1, 2, 3, 4, 5, 6];
    if (w % 2) rows.reverse();
    for (const i of rows) {
      pts.push({ w, i });
      if (wk.some(([, n, r]) => r === i && n)) eaten.set(key(w, i), pts.length - 1);
    }
  }
  pts.push({ w: weeks.length, i: pts.at(-1).i });
  return { pts, eaten };
}

// helpers shared by the fixed routes: where the snake bites, and the way out through the right edge
const bites = (weeks) => { const m = new Set(); for (const [w, wk] of weeks.entries()) for (const [, n, i] of wk) if (n) m.add(key(w, i)); return m; };
function finish(pts, eaten, weeks) {
  const W = weeks.length;
  for (let guard = 0; pts.at(-1).w < W && guard < 400; guard++) pts.push({ w: pts.at(-1).w + 1, i: pts.at(-1).i });
  for (const k of bites(weeks)) if (!eaten.has(k)) eaten.set(k, pts.length - 1);
  return { pts, eaten };
}
const walk = (weeks, cells) => {
  const pts = [{ w: -1, i: cells[0][1] }];
  const eaten = new Map();
  const b = bites(weeks);
  for (const [w, i] of cells) { pts.push({ w, i }); const k = key(w, i); if (b.has(k) && !eaten.has(k)) eaten.set(k, pts.length - 1); }
  return finish(pts, eaten, weeks);
};

/** Row by row: left to right along the top row, back along the next one, and so on. */
export function rowsSnake(weeks) {
  const W = weeks.length;
  const cells = [];
  for (let i = 0; i < ROWS; i++) for (let k = 0; k < W; k++) cells.push([i % 2 ? W - 1 - k : k, i]);
  return walk(weeks, cells);
}

/** Outside in: around the edge of the grid, then the next ring, until the middle. */
export function spiralSnake(weeks) {
  const W = weeks.length;
  const cells = [];
  let top = 0, bottom = ROWS - 1, left = 0, right = W - 1;
  while (top <= bottom && left <= right) {
    for (let w = left; w <= right; w++) cells.push([w, top]);
    for (let i = top + 1; i <= bottom; i++) cells.push([right, i]);
    if (top < bottom) for (let w = right - 1; w >= left; w--) cells.push([w, bottom]);
    if (left < right) for (let i = bottom - 1; i > top; i--) cells.push([left, i]);
    top++; bottom--; left++; right--;
  }
  return walk(weeks, cells);
}

export const SNAKE_PATHS = ["smart", "busy", "nearest", "sweep", "rows", "spiral"];
/** The route for a `heatmap.snakePath` value. */
export function snakeRoute(name, weeks, level, len = 6) {
  if (name === "sweep") return sweepSnake(weeks);
  if (name === "rows") return rowsSnake(weeks);
  if (name === "spiral") return spiralSnake(weeks);
  return planSnake(weeks, level, len, 1600, { smart: "quiet", busy: "busy", nearest: "nearest" }[name] ?? "quiet");
}
