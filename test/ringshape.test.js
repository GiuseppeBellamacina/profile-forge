import assert from "node:assert/strict";
import test from "node:test";
import { ringAt, ringPath } from "../src/ringshape.js";

const STYLES = ["ring", "hexagon", "shield"];

test("rank outline: points go clockwise from the top, with a unit normal that points away from the centre", () => {
  for (const style of STYLES) {
    const top = ringAt(style, 0);
    assert.ok(Math.abs(top[0] - 900) < 1 && top[1] < 90, `${style}: starts at the top`);
    const right = ringAt(style, 0.25);
    assert.ok(right[0] > 900, `${style}: then goes right (clockwise)`);
    for (let k = 0; k < 40; k++) {
      const [x, y, nx, ny] = ringAt(style, k / 40);
      assert.ok(Math.abs(Math.hypot(nx, ny) - 1) < 1e-6, `${style}: unit normal`);
      const [ox, oy] = ringAt(style, k / 40, 10);
      assert.ok(Math.hypot(ox - 900, oy - 90) > Math.hypot(x - 900, y - 90) - 0.01, `${style}: ${k}: the offset point is further from the centre`);
      assert.ok(Math.hypot(ox - x, oy - y) > 9.99 && Math.hypot(ox - x, oy - y) < 10.01, `${style}: offset by exactly 10`);
    }
  }
});

test("rank outline: a path for the hexagon and the shield, none for the ring, growing with `grow`", () => {
  assert.equal(ringPath("ring", 5), null);
  for (const style of ["hexagon", "shield"]) {
    const small = ringPath(style, 0), big = ringPath(style, 12);
    assert.ok(small.startsWith("M") && small.endsWith("Z") && small !== big, style);
    const box = (d) => d.slice(1, -1).split(/[LZ]/).flatMap((p) => p.split(" ").map(Number));
    assert.ok(Math.max(...box(big)) > Math.max(...box(small)), `${style}: bigger`);
  }
});
