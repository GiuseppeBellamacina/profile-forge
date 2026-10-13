// Snake pathfinder for the heatmap. Pure functions: given the grid they return the snake's route, which render.js embeds
// in the SVG as keyframes (nothing is computed when the image is viewed).
//
// "smart": the snake eats the quietest days first and works up to the busiest ones. At every step it looks for the cheapest
// way (Dijkstra on the 7 x weeks grid) to the nearest remaining day of the lowest tier still uneaten, never runs into its
// own body, and avoids stepping on busier days before their turn (it only does when there is no other way).
// "sweep": the classic boustrophedon, column by column.

const ROWS = 7;
const PENALTY = 10; // extra cost of crossing a day that is busier than the tier being eaten

export const key = (w, i) => `${w},${i}`;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // fixed order: deterministic ties

/** weeks: [[date, count, row], ...] per week. level(count) -> 0..4. Returns { pts: [{w, i}], eaten: Map(key -> index into pts) }. */
export function planSnake(weeks, level, len = 6, maxSteps = 1600) {
  const W = weeks.length;
  const exists = new Set();
  const tier = new Map(); // key -> level of a day that has contributions
  for (const [w, wk] of weeks.entries()) for (const [, n, i] of wk) { exists.add(key(w, i)); if (n) tier.set(key(w, i), level(n)); }
  const uneaten = new Set(tier.keys());
  const pts = [{ w: -1, i: 3 }]; // enters from the left, in the middle row
  const eaten = new Map();
  let body = Array.from({ length: len }, (_, k) => key(-1 - k, 3)); // head first

  const lowest = () => { let m = Infinity; for (const k of uneaten) m = Math.min(m, tier.get(k)); return m; };

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
        const cost = d + 1 + (uneaten.has(nk) && tier.get(nk) > cur ? PENALTY : 0);
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

  while (uneaten.size && pts.length < maxSteps) {
    const cur = lowest();
    const { dist, prev } = routes(head, cur);
    const hk = key(head.w, head.i);
    let target = null;
    for (const wantTier of [cur, ...[1, 2, 3, 4].filter((t) => t > cur)]) {
      let bestD = Infinity;
      for (const k of uneaten) {
        if (tier.get(k) !== wantTier || !dist.has(k)) continue;
        if (dist.get(k) < bestD) { bestD = dist.get(k); target = k; }
      }
      if (target) break;
    }
    if (!target) break; // boxed in by its own body: the rest is eaten when the snake leaves
    const next = chooseStep(prev, hk, target);
    const [w, i] = next.split(",").map(Number);
    head = { w, i };
    pts.push(head);
    body = [next, ...body.slice(0, len - 1)];
    if (uneaten.delete(next)) eaten.set(next, pts.length - 1);
  }

  // leave through the right edge: walk to the last column, then step off the grid
  if (W) {
    let guard = 0;
    while (head.w < W - 1 && guard++ < maxSteps) {
      const { dist, prev } = routes(head, 5);
      let target = null;
      let bestD = Infinity;
      for (let i = 0; i < ROWS; i++) { const k = key(W - 1, i); if (dist.has(k) && dist.get(k) < bestD) { bestD = dist.get(k); target = k; } }
      if (!target) break;
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
