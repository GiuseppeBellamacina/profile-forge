import assert from "node:assert/strict";
import test from "node:test";
import { planSnake, sweepSnake } from "../src/snake.js";

// a deterministic grid: weeks x 7 days with counts 0..40 (quiet days common, busy days rare)
const grid = (weeks, last = 7) => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: w === weeks - 1 ? last : 7 }, (_, i) => [`d${w}-${i}`, rnd() < 0.45 ? 0 : Math.ceil(rnd() * rnd() * 40), i]));
};
const level = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / 40) * 4)));

test("smart snake: moves one cell at a time, never runs into itself, eats every contribution", () => {
  const weeks = grid(53, 3);
  const { pts, eaten } = planSnake(weeks, level, 6);
  for (let j = 1; j < pts.length; j++) assert.equal(Math.abs(pts[j].w - pts[j - 1].w) + Math.abs(pts[j].i - pts[j - 1].i), 1, `step ${j} is adjacent`);
  for (let j = 0; j < pts.length; j++) {
    const body = pts.slice(Math.max(0, j - 5), j).map((p) => `${p.w},${p.i}`);
    assert.ok(!body.includes(`${pts[j].w},${pts[j].i}`), `step ${j} does not enter the body`);
  }
  const days = weeks.flatMap((wk, w) => wk.filter(([, n]) => n).map(([, , i]) => `${w},${i}`));
  assert.deepEqual([...eaten.keys()].sort(), days.sort());
  assert.equal(pts.at(-1).w, 53, "leaves through the right edge");
});

test("smart snake: quiet days first, busy days last", () => {
  const weeks = grid(53);
  const { pts, eaten } = planSnake(weeks, level, 6);
  const order = [...eaten.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const lvl = (k) => { const [w, i] = k.split(",").map(Number); return level(weeks[w][i][1]); };
  const seq = order.map(lvl);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const half = Math.floor(seq.length / 2);
  assert.ok(mean(seq.slice(0, half)) < mean(seq.slice(half)), "the first half of the meal is quieter than the second");
  // almost monotone: a busier day is only taken early when the snake had no way around it
  let drops = 0;
  for (let j = 1; j < seq.length; j++) if (seq[j] < seq[j - 1]) drops++;
  assert.ok(drops < seq.length * 0.15, `few out-of-order bites (${drops} of ${seq.length})`);
  assert.ok(pts.length < 1600, "stays within the step budget");
});

test("sweep snake: the classic column by column route", () => {
  const weeks = grid(4);
  const { pts } = sweepSnake(weeks);
  assert.deepEqual(pts.slice(1, 9).map((p) => `${p.w},${p.i}`), ["0,0", "0,1", "0,2", "0,3", "0,4", "0,5", "0,6", "1,6"]);
});

test("smart snake: deterministic and robust on empty or tiny grids", () => {
  assert.deepEqual(planSnake(grid(30), level, 6), planSnake(grid(30), level, 6));
  const empty = planSnake(Array.from({ length: 5 }, (_, w) => Array.from({ length: 7 }, (_, i) => [`e${w}${i}`, 0, i])), level, 6);
  assert.equal(empty.eaten.size, 0);
  assert.equal(empty.pts.at(-1).w, 5);
  assert.doesNotThrow(() => planSnake([], level, 6));
});

import { snakeRoute, SNAKE_PATHS } from "../src/snake.js";

test("every route is a walk of adjacent cells that eats every contribution and leaves on the right", () => {
  const weeks = grid(53, 4);
  const days = weeks.flatMap((wk, w) => wk.filter(([, n]) => n).map(([, , i]) => `${w},${i}`)).sort();
  for (const name of SNAKE_PATHS) {
    const { pts, eaten } = snakeRoute(name, weeks, level, 6);
    for (let j = 1; j < pts.length; j++) assert.equal(Math.abs(pts[j].w - pts[j - 1].w) + Math.abs(pts[j].i - pts[j - 1].i), 1, `${name}: step ${j} is adjacent`);
    assert.deepEqual([...eaten.keys()].sort(), days, `${name} eats every contribution`);
    assert.equal(pts.at(-1).w, 53, `${name} leaves through the right edge`);
  }
});

test("busy starts with the busiest days, smart with the quietest", () => {
  const weeks = grid(53);
  const lvlOf = (k) => { const [w, i] = k.split(",").map(Number); return level(weeks[w][i][1]); };
  const mean = (route) => {
    const order = [...snakeRoute(route, weeks, level, 6).eaten.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => lvlOf(k));
    const half = Math.floor(order.length / 2);
    return [order.slice(0, half), order.slice(half)].map((a) => a.reduce((x, y) => x + y, 0) / a.length);
  };
  const [smartFirst, smartLast] = mean("smart");
  const [busyFirst, busyLast] = mean("busy");
  assert.ok(smartFirst < smartLast && busyFirst > busyLast);
});

test("spiral and rows follow their shapes; wander is deterministic", () => {
  const weeks = grid(10);
  const spiral = snakeRoute("spiral", weeks, level).pts.slice(1, 13).map((p) => `${p.w},${p.i}`);
  assert.deepEqual(spiral.slice(0, 10), ["0,0", "1,0", "2,0", "3,0", "4,0", "5,0", "6,0", "7,0", "8,0", "9,0"], "along the top edge first");
  assert.equal(spiral[10], "9,1", "then down the right edge");
  assert.deepEqual(snakeRoute("rows", weeks, level).pts.slice(1, 4).map((p) => `${p.w},${p.i}`), ["0,0", "1,0", "2,0"]);
  assert.deepEqual(snakeRoute("wander", grid(30), level), snakeRoute("wander", grid(30), level));
});
