// An svg image of the user for the card (card.decor / card.background): put into the card as markup, not as an <image>, so its animations
// (SMIL or CSS) keep running and its colours and speed can be changed. Anything that could run code or load something is dropped.

const decode = (dataUri) => {
  const m = /^data:image\/svg\+xml;base64,(.*)$/s.exec(dataUri);
  if (!m) return null;
  return new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
};

const KEEP = new Set(["none", "transparent", "currentcolor", "inherit"]);

/**
 * The inner markup of the svg wrapped in a nested <svg> that fills a 100 x 100 box, or null if `dataUri` is not an svg.
 * `prefix` keeps the ids of two pieces apart; `color` (when given) replaces every flat fill and stroke; `speed` scales the duration
 * of SMIL animations; `still` drops the animations (one frame is left, for PNG / GIF).
 */
export function inlineSvg(dataUri, { prefix, color = null, speed = 1, still = false } = {}) {
  let s = decode(dataUri);
  if (s === null) return null;
  s = s
    .replace(/<\?xml[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>|<foreignObject[\s\S]*?<\/foreignObject>|<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, (m) => (/^\s(?:xlink:)?href\s*=\s*["']data:image\//i.test(m) ? m : "")); // only links inside the picture, and embedded images
  const root = /<svg\b[^>]*>/i.exec(s);
  if (!root) return null;
  const head = root[0];
  const box = /viewBox\s*=\s*"([^"]+)"/i.exec(head)?.[1] ?? `0 0 ${parseFloat(/\swidth\s*=\s*"([\d.]+)/i.exec(head)?.[1] ?? "100")} ${parseFloat(/\sheight\s*=\s*"([\d.]+)/i.exec(head)?.[1] ?? "100")}`;
  let body = s.slice(s.indexOf(head) + head.length, s.lastIndexOf("</svg>"));
  // ids and the references to them get the prefix of the piece
  body = body
    .replace(/\sid="([^"]+)"/g, (_, id) => ` id="${prefix}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`)
    .replace(/(\s(?:xlink:)?href=")#([^"]+)"/g, (_, a, id) => `${a}#${prefix}-${id}"`);
  if (color) {
    const flat = (v) => !KEEP.has(v.trim().toLowerCase()) && !/^url\(/i.test(v.trim());
    body = body
      .replace(/\b(fill|stroke)="([^"]*)"/g, (m, k, v) => (flat(v) ? `${k}="${color}"` : m))
      .replace(/\b(fill|stroke):\s*([^;"]+)/g, (m, k, v) => (flat(v) ? `${k}:${color}` : m));
  }
  if (still) body = body.replace(/<(animate|animateTransform|animateMotion|set)\b[^>]*\/>|<(animate|animateTransform|animateMotion|set)\b[^>]*>[\s\S]*?<\/\2>/g, "");
  else if (speed !== 1) body = body.replace(/\bdur="([\d.]+)(m?s)"/g, (_, n, u) => `dur="${Math.round((Number(n) / speed) * 1000) / 1000}${u}"`);
  const fill = /\sfill="([^"]*)"/i.exec(head)?.[1]; // what the file says for the whole picture (a lottie export says none)
  return `<svg x="0" y="0" width="100" height="100" viewBox="${box}" preserveAspectRatio="xMidYMid meet"${fill ? ` fill="${fill}"` : ""}>${body}</svg>`;
}
