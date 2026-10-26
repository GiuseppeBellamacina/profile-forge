// The outline of the rank indicator in the header: a ring, a hexagon or a shield, all centred at (900, 90) and about 100 px across.
// Every effect around it (halo, light running round, sparkles, embers) asks this module for the outline `grow` pixels outside the
// shape and for points on it with their outward normal, so none of them assumes a circle.
//
//   ringPath(style, grow)      the path of the outline (null for the ring: it is a circle, the caller draws one)
//   ringAt(style, u, off)      [x, y, nx, ny]: the point at fraction u of the way round (0 = top, clockwise), off px outside, and the outward normal

const CX = 900;
const CY = 90;
const N = 120;

const HEX_R = 53; // circumradius of the base hexagon (a ring of radius 50 and a little more, so the flat sides are not inside it)
const hexVertices = (grow) => Array.from({ length: 6 }, (_, k) => {
  const a = ((-90 + 60 * k) * Math.PI) / 180;
  const R = HEX_R + grow / Math.cos(Math.PI / 6); // a true offset: the apothem grows by `grow`
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
});

// a comic starburst: 12 spikes, a spike straight up; grown by pushing every vertex outward
const burstVertices = (grow) => Array.from({ length: 24 }, (_, k) => {
  const a = ((-90 + 15 * k) * Math.PI) / 180, r = (k % 2 ? 43 : 58) + grow;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
});

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
};
// the shield, from the top centre clockwise: slanted shoulders, straight sides, curves down to the tip
const shieldPoly = () => {
  const out = [[900, 40], [947, 54], [947, 92]];
  for (let s = 1; s <= 40; s++) out.push(bez([947, 92], [947, 120], [924, 137], [900, 146], s / 40));
  for (let s = 1; s <= 40; s++) out.push(bez([900, 146], [876, 137], [853, 120], [853, 92], s / 40));
  out.push([853, 54]);
  return out;
};

/** n points evenly spaced along a closed polyline, starting at its first point. */
const resample = (poly, n) => {
  const len = [0];
  poly.forEach((p, i) => len.push(len[i] + Math.hypot(poly[(i + 1) % poly.length][0] - p[0], poly[(i + 1) % poly.length][1] - p[1])));
  const total = len.at(-1);
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = (total * k) / n;
    while (len[j + 1] < s) j++;
    const f = (s - len[j]) / (len[j + 1] - len[j] || 1);
    const a = poly[j], b = poly[(j + 1) % poly.length];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
};

const withNormals = (pts) =>
  pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [p[0], p[1], ty / l, -tx / l]; // clockwise on the screen: the outside is to the left of the way of travel
  });

const cache = {};
const base = (style) =>
  (cache[style] ??=
    style === "shield"
      ? withNormals(resample(shieldPoly(), N))
      : style === "hexagon"
        ? withNormals(resample(hexVertices(0), N))
        : style === "burst"
          ? withNormals(resample(burstVertices(0), N))
          : Array.from({ length: N }, (_, k) => {
            const a = ((-90 + (360 * k) / N) * Math.PI) / 180;
            return [CX + 50 * Math.cos(a), CY + 50 * Math.sin(a), Math.cos(a), Math.sin(a)];
          }));

const r3 = (x) => Math.round(x * 1000) / 1000;

export function ringAt(style, u, off = 0) {
  const pts = base(style);
  const x = (((u % 1) + 1) % 1) * N;
  const i = Math.floor(x), f = x - i;
  const a = pts[i], b = pts[(i + 1) % N];
  const nx = a[2] + (b[2] - a[2]) * f, ny = a[3] + (b[3] - a[3]) * f, l = Math.hypot(nx, ny) || 1;
  const mx = nx / l, my = ny / l;
  return [a[0] + (b[0] - a[0]) * f + mx * off, a[1] + (b[1] - a[1]) * f + my * off, mx, my];
}

export function ringPath(style, grow = 0) {
  if (style === "burst") return `M${burstVertices(grow).map(([x, y]) => `${r3(x)} ${r3(y)}`).join("L")}Z`;
  if (style === "hexagon") return `M${hexVertices(grow).map(([x, y]) => `${r3(x)} ${r3(y)}`).join("L")}Z`;
  if (style === "shield") {
    // the offset of the shield by the normals, a point every 4 steps (the joins are rounded by the stroke)
    return `M${base("shield").filter((_, k) => k % 2 === 0).map(([x, y, nx, ny]) => `${r3(x + nx * grow)} ${r3(y + ny * grow)}`).join("L")}Z`;
  }
  return null;
}
