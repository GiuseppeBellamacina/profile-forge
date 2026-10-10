// Local raster export. Optional deps: npm install (pulls @resvg/resvg-js + gifenc).
import { Resvg } from "@resvg/resvg-js";
import gifenc from "gifenc";
import { DURATION } from "./render.js";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const opts = (scale) => ({ fitTo: { mode: "zoom", value: scale }, font: { loadSystemFonts: true } });

export const toPng = (svg, scale = 2) => new Resvg(svg, opts(scale)).render().asPng();

/** frameAt(t) returns a static SVG for t∈[0,1]; the last frame is held before looping. */
export function toGif(frameAt, { fps = 15, hold = 3000, scale = 1 } = {}) {
  const gif = GIFEncoder();
  const n = Math.round(DURATION * fps);
  for (let i = 0; i <= n; i++) {
    const img = new Resvg(frameAt(i / n), opts(scale)).render();
    const rgba = new Uint8Array(img.pixels);
    const palette = quantize(rgba, 256);
    gif.writeFrame(applyPalette(rgba, palette), img.width, img.height, { palette, delay: i === n ? hold : 1000 / fps });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}
