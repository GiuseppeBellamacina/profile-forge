// A theme is 10 colors + `base` ("dark"/"light": picks the trophy palette). The heatmap ramp is derived unless given.
// [bg1, bg2, panel, border, text, muted, accent, accent2, fire, track]
const KEYS = ["bg1", "bg2", "panel", "border", "text", "muted", "accent", "accent2", "fire", "track"];
const mk = (base, ...v) => ({ base, ...Object.fromEntries(KEYS.map((k, i) => [k, v[i]])) });

const rgb = (h) => {
  h = h.replace("#", "");
  if (h.length === 4) h = h.slice(0, 3); // #rgba -> drop alpha
  if (h.length === 8) h = h.slice(0, 6); // #rrggbbaa -> drop alpha
  if (h.length === 3) h = [...h].map((x) => x + x).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
export const mix = (a, b, p) => "#" + rgb(a).map((x, i) => Math.round(x + (rgb(b)[i] - x) * p).toString(16).padStart(2, "0")).join("");

/** Derive a full theme from the 5 colors that matter: bg, text, accent, accent2, fire. */
const dv = (base, bg, text, accent, accent2, fire, extra = {}) => ({
  base, bg1: bg, bg2: mix(bg, "#000000", base === "dark" ? 0.25 : 0.04), panel: mix(bg, text, 0.06), border: mix(bg, text, 0.16),
  text, muted: mix(text, bg, 0.38), accent, accent2, fire, track: mix(bg, text, 0.14), ...extra,
});

const THEMES = {
  dark: {
    ...mk("dark", "#1a1b26", "#13141c", "#1f2335", "#2f334d", "#c0caf5", "#7c83a8", "#7aa2f7", "#bb9af7", "#ff9e64", "#2f334d"),
    heat: ["#24283b", "#2e3f6e", "#3d5aa8", "#5a80dc", "#7dcfff"],
  },
  light: {
    ...mk("light", "#ffffff", "#f3f5f9", "#f8f9fc", "#dde2ea", "#1f2328", "#626b78", "#0969da", "#8250df", "#e36209", "#e3e7ee"),
    heat: ["#ebedf0", "#c2dbfb", "#80b6f4", "#3d8ae6", "#0a5cc4"],
  },
  "github-dark": mk("dark", "#0d1117", "#010409", "#161b22", "#30363d", "#e6edf3", "#8b949e", "#58a6ff", "#bc8cff", "#f0883e", "#21262d"),
  dracula: mk("dark", "#282a36", "#21222c", "#2d2f3d", "#44475a", "#f8f8f2", "#9aa3c7", "#bd93f9", "#ff79c6", "#ffb86c", "#44475a"),
  nord: mk("dark", "#2e3440", "#272c36", "#3b4252", "#4c566a", "#eceff4", "#9aa5b8", "#88c0d0", "#b48ead", "#d08770", "#434c5e"),
  monokai: mk("dark", "#272822", "#1e1f1a", "#2f302a", "#49483e", "#f8f8f2", "#a6a68f", "#a6e22e", "#66d9ef", "#fd971f", "#3e3d32"),
  gruvbox: mk("dark", "#282828", "#1d2021", "#32302f", "#504945", "#ebdbb2", "#a89984", "#fabd2f", "#fb4934", "#fe8019", "#3c3836"),
  "gruvbox-light": mk("light", "#fbf1c7", "#f2e5bc", "#f9f5d7", "#d5c4a1", "#3c3836", "#7c6f64", "#b57614", "#9d0006", "#af3a03", "#ebdbb2"),
  "catppuccin-mocha": mk("dark", "#1e1e2e", "#181825", "#24243a", "#45475a", "#cdd6f4", "#a6adc8", "#89b4fa", "#cba6f7", "#fab387", "#45475a"),
  "catppuccin-latte": mk("light", "#eff1f5", "#e6e9ef", "#f5f6fa", "#ccd0da", "#4c4f69", "#6c6f85", "#1e66f5", "#8839ef", "#fe640b", "#ccd0da"),
  "solarized-dark": mk("dark", "#002b36", "#00212b", "#073642", "#174652", "#eee8d5", "#839496", "#268bd2", "#d33682", "#cb4b16", "#0f4452"),
  "solarized-light": mk("light", "#fdf6e3", "#f5eed8", "#eee8d5", "#d8d2bd", "#073642", "#657b83", "#268bd2", "#d33682", "#cb4b16", "#e4ddc6"),
  "rose-pine": mk("dark", "#191724", "#13111e", "#1f1d2e", "#26233a", "#e0def4", "#908caa", "#c4a7e7", "#ebbcba", "#f6c177", "#26233a"),
  "one-dark": mk("dark", "#282c34", "#21252b", "#2c313a", "#3e4451", "#abb2bf", "#7f8795", "#61afef", "#c678dd", "#d19a66", "#3e4451"),
  synthwave: mk("dark", "#2b213a", "#1f1730", "#34294a", "#4b3a6b", "#f6f0ff", "#b4a6d6", "#ff7edb", "#36f9f6", "#fede5d", "#4b3a6b"),
  radical: mk("dark", "#141321", "#0e0d19", "#1b1a2e", "#2d2b4a", "#a9fef7", "#8d8bb0", "#fe428e", "#f8d847", "#f8d847", "#2d2b4a"),
  ocean: mk("dark", "#151a28", "#0f131f", "#1b2236", "#2a3552", "#c3dbe8", "#7a95a8", "#21d4fd", "#6d8bff", "#ffb347", "#2a3552"),
  // crimson, darker: black background, deep blood red
  "blood-moon": dv("dark", "#070304", "#f2dadd", "#d1162b", "#8e0f1d", "#ff5a3c", { panel: "#120708", border: "#2e0d12", muted: "#a3757b", track: "#1f0b0e", heat: ["#1f0b0e", "#4d0b15", "#80101f", "#b5152a", "#e8323f"] }),
  crimson: mk("dark", "#1a0f12", "#120a0c", "#231418", "#3d1f26", "#f5dfe2", "#b08a90", "#ff4d5e", "#ff8a5c", "#ffb454", "#3d1f26"),
  // Derived themes: dv(base, bg, text, accent, accent2, fire)
  "catppuccin-frappe": dv("dark", "#303446", "#c6d0f5", "#8caaee", "#ca9ee6", "#ef9f76"),
  "catppuccin-macchiato": dv("dark", "#24273a", "#cad3f5", "#8aadf4", "#c6a0f6", "#f5a97f"),
  "github-dark-dimmed": dv("dark", "#22272e", "#adbac7", "#539bf5", "#b083f0", "#f69d50"),
  "material-palenight": dv("dark", "#292d3e", "#a6accd", "#82aaff", "#c792ea", "#f78c6c"),
  nightowl: dv("dark", "#011627", "#d6deeb", "#82aaff", "#c792ea", "#f78c6c"),
  cobalt2: dv("dark", "#193549", "#ffffff", "#ffc600", "#0088ff", "#ff9d00"),
  "shades-of-purple": dv("dark", "#2d2b55", "#f5f3ff", "#fad000", "#b362ff", "#ff9d00"),
  "ayu-mirage": dv("dark", "#1f2430", "#c7c8c2", "#73d0ff", "#d4bfff", "#ffa759"),
  aura: dv("dark", "#15141b", "#edecee", "#a277ff", "#61ffca", "#ffca85"),
  "aura-dark": dv("dark", "#252334", "#dbdbdb", "#6cffd0", "#ff7372", "#ffca85"),
  horizon: dv("dark", "#1c1e26", "#d5d8da", "#e95678", "#59e1e3", "#fab795"),
  "everforest-dark": dv("dark", "#2d353b", "#d3c6aa", "#a7c080", "#7fbbb3", "#e69875"),
  "everforest-light": dv("light", "#f2efdf", "#5c6a72", "#8da101", "#3a94c5", "#f57d26"),
  "kanagawa-paper": dv("dark", "#1f1f28", "#dcd7ba", "#7e9cd8", "#957fb8", "#ffa066"),
  nightfox: dv("dark", "#192330", "#cdcecf", "#719cd6", "#9d79d6", "#f4a261"),
  dawnfox: dv("light", "#faf4ed", "#575279", "#286983", "#907aa9", "#d7827e"),
  dayfox: dv("light", "#f6f2ee", "#3d2b5a", "#2848a9", "#6e33ce", "#ac5402"),
  carbonfox: dv("dark", "#161616", "#f2f4f8", "#78a9ff", "#be95ff", "#ff7eb6"),
  "oceanic-next": dv("dark", "#1b2b34", "#d8dee9", "#6699cc", "#c594c5", "#f99157"),
  "midnight-purple": dv("dark", "#0b0614", "#ffffff", "#9f4bff", "#e879f9", "#f59e0b"),
  merko: dv("dark", "#0a0f0b", "#68b587", "#abd200", "#b7d364", "#ffb454"),
  matrix: dv("dark", "#02140a", "#a6ffb8", "#00ff41", "#00b34a", "#ccff00"),
  hacker: dv("dark", "#000000", "#20c20e", "#20c20e", "#0fa30a", "#8aff00"),
  neon: dv("dark", "#000000", "#ffffff", "#00ead3", "#ff449f", "#fff5b7"),
  outrun: dv("dark", "#141439", "#8080ff", "#ffcc00", "#ff1aff", "#ff7a00"),
  "vue-dark": dv("dark", "#273849", "#fffefe", "#41b883", "#64c8ff", "#ffd04d"),
  discord: dv("dark", "#23272a", "#ffffff", "#7289da", "#eb459e", "#fee75c"),
  "ambient-gradient": dv("dark", "#2b2250", "#ffffff", "#ffcc70", "#c850c0", "#ffcc70", { bgGradient: "35,#4158d0,#c850c0,#ffcc70", border: "#ae58a1", muted: "#efe6ff" }),
  "sunset-gradient": dv("dark", "#3a1030", "#ffffff", "#ffe3b3", "#ffb199", "#fb8c00", { bgGradient: "45,#8a2386,#e94056,#f27120", border: "#b13a4a", muted: "#ffe9dc" }),
  // Editor palettes
  "tokyo-night": dv("dark", "#1a1b26", "#a9b1d6", "#7aa2f7", "#bb9af7", "#ff9e64", { heat: ["#232433", "#283457", "#3d59a1", "#7aa2f7", "#7dcfff"] }),
  "tokyo-night-storm": dv("dark", "#24283b", "#c0caf5", "#2ac3de", "#9d7cd8", "#e0af68"),
  "tokyo-night-day": dv("light", "#e1e2e7", "#3760bf", "#2e7de9", "#9854f1", "#b15c00"),
  "kanagawa-wave": dv("dark", "#1f1f28", "#dcd7ba", "#7fb4ca", "#d27e99", "#ffa066", { accent2: "#957fb8" }),
  moonlight: dv("dark", "#222436", "#c8d3f5", "#82aaff", "#c099ff", "#ff966c"),
  poimandres: dv("dark", "#1b1e28", "#e4f0fb", "#5de4c7", "#add7ff", "#fffac2"),
  vesper: dv("dark", "#101010", "#ffffff", "#ffc799", "#99ffe4", "#ff8080"),
  "rose-pine-moon": dv("dark", "#232136", "#e0def4", "#c4a7e7", "#ea9a97", "#f6c177"),
  "rose-pine-dawn": dv("light", "#faf4ed", "#575279", "#907aa9", "#d7827e", "#ea9d34"),
  "night-owl-light": dv("light", "#fbfbfb", "#403f53", "#4876d6", "#994cc3", "#c96765"),
  andromeda: dv("dark", "#23262e", "#d5ced9", "#00e8c6", "#c74ded", "#f39c12"),
  panda: dv("dark", "#292a2b", "#e6e6e6", "#19f9d8", "#ff75b5", "#ffb86c"),
  everblush: dv("dark", "#141b1e", "#dadada", "#67b0e8", "#c47fd5", "#e5c76b"),
  cyberdream: dv("dark", "#16181a", "#ffffff", "#5ef1ff", "#ff5ef1", "#ffbd5e"),
  "nord-light": dv("light", "#eceff4", "#2e3440", "#5e81ac", "#b48ead", "#d08770"),
  // Gradients
  "aurora-gradient": dv("dark", "#0b1d2a", "#e8fff7", "#5cffc8", "#7aa8ff", "#ffd36e", { bgGradient: "160,#04131f,#0b3b45,#1b2a5c", border: "#2a6f78", muted: "#b6e3e0" }),
  "ocean-gradient": dv("dark", "#06263a", "#eaf6ff", "#4fd1ff", "#7cffcb", "#ffc46b", { bgGradient: "200,#021b2e,#05436b,#0a7a8f", border: "#1d6a8a", muted: "#bcdcee" }),
  "candy-gradient": dv("dark", "#3b1d4a", "#ffffff", "#fff27a", "#7af0ff", "#ffb35c", { bgGradient: "120,#ff6fb1,#9b5cff,#4fb3ff", border: "#c48bff", muted: "#fbe9ff" }),
  // Originals
  sakura: dv("light", "#fff5f8", "#4a2c3a", "#e05a8a", "#8a5cc2", "#e07a3f", { heat: ["#f6e3ea", "#f7c4d6", "#f193b4", "#e0628e", "#b83a6a"] }),
  lava: dv("dark", "#140806", "#ffe9e0", "#ff5a1f", "#ffb020", "#ff2e2e", { heat: ["#2a1410", "#5c1d0f", "#a3300f", "#e24a14", "#ffb020"] }),
  glacier: dv("light", "#f2f8fc", "#16324a", "#1b8ec2", "#5a6fd6", "#e07b39", { heat: ["#e2edf5", "#bfe0f2", "#84c4e6", "#3d9fd1", "#16699a"] }),
  "forest-night": dv("dark", "#0f1a14", "#d9eadf", "#5fd38d", "#c2e07a", "#f2a65a", { heat: ["#1a2a21", "#1f4a32", "#2d7a4c", "#4fb36f", "#a6e88a"] }),
  coffee: dv("dark", "#1e1612", "#ecdcc9", "#d4a373", "#a3b18a", "#e76f51", { heat: ["#2b211b", "#4a3426", "#7a5236", "#b37c4f", "#e3b27c"] }),
  amber: dv("dark", "#0d0800", "#ffb000", "#ffcc33", "#ff8c00", "#ffe066", { muted: "#b37a00", heat: ["#1f1500", "#4d3300", "#805500", "#cc8800", "#ffcc33"] }),
  paper: dv("light", "#fbfaf7", "#1c1c1c", "#2b2b2b", "#8a6d3b", "#b4532a", { heat: ["#ecebe6", "#c9c7bf", "#97948a", "#5e5b53", "#1c1c1c"] }),
};

// Override keys follow the original projects' names where they exist (bg_color, border_color, currStreakNum, ...).
export const COLOR_KEYS = {
  bg_color: ["bg1", "bg2"], panel_color: ["panel"], border_color: ["border"], text_color: ["text"], muted_color: ["muted"],
  icon_color: ["accent"], ring_color: ["accent2"], fire_color: ["fire"], track_color: ["track"],
  title_color: ["title"], stroke_color: ["streakStroke"],
  currStreakNum: ["streakCurrNum"], sideNums: ["streakSideNums"], currStreakLabel: ["streakCurrLabel"],
  sideLabels: ["streakSideLabels"], dates: ["streakDates"], excludeDaysLabel: ["streakExcl"], snakeColor: ["snake"], frameColor: ["frame"],
  levelE: ["lvE"], levelD: ["lvD"], levelC: ["lvC"], levelB: ["lvB"], levelA: ["lvA"], levelS: ["lvS"], levelTop: ["lvTop"],
  bg_gradient: ["bgGradient"],
};
export const COLOR_NAMES = Object.keys(COLOR_KEYS);
const HEX = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const hex = (k, v) => {
  if (!HEX.test(v)) throw new Error(`Invalid hex color for ${k}: "${v}" (use rgb, rgba, rrggbb or rrggbbaa)`);
  return v.startsWith("#") ? v : "#" + v;
};

/** "a=1,b=2" or { a: 1 } -> { a: "#..." }. Colors may be written with or without "#". bg_gradient is "angle,c1,c2,...". */
export function parseColors(s) {
  const entries = typeof s === "object" && s ? Object.entries(s) : String(s ?? "").split(/,(?=\s*\w+\s*=)/).map((x) => x.trim()).filter(Boolean).map((p) => [p.slice(0, p.indexOf("=")).trim(), p.slice(p.indexOf("=") + 1).trim()]);
  const out = {};
  for (const [k, raw] of entries) {
    if (!COLOR_KEYS[k]) throw new Error(`Unknown color "${k}". Available: ${COLOR_NAMES.join(", ")}`);
    const v = String(raw);
    if (k === "bg_gradient") {
      const [angle, ...stops] = v.split(",").map((x) => x.trim());
      if (!/^-?\d+$/.test(angle) || stops.length < 2) throw new Error(`Invalid bg_gradient "${v}" (use angle,color1,color2,...)`);
      out[k] = [angle, ...stops.map((x) => hex(k, x))].join(",");
    } else out[k] = hex(k, v);
  }
  return out;
}

const apply = (theme, colors) => {
  const c = { ...theme };
  for (const [k, v] of Object.entries(colors)) for (const t of COLOR_KEYS[k]) c[t] = v;
  // Keep the hand-tuned ramp unless a color it depends on was overridden.
  if (colors.icon_color || colors.track_color) delete c.heat;
  return c;
};

export const THEME_NAMES = () => Object.keys(THEMES);
export const hasTheme = (name) => name in THEMES;

/** Add user themes: { name: { base: "dark", bg_color: "...", ... } }. */
export function registerThemes(custom = {}) {
  for (const [name, spec] of Object.entries(custom)) {
    if (name in THEMES && !THEMES[name].custom) throw new Error(`customThemes: "${name}" is a built-in theme, pick another name`);
    const { base = "dark", ...colors } = spec;
    if (!(base in THEMES)) throw new Error(`customThemes.${name}.base: unknown theme "${base}"`);
    THEMES[name] = { ...apply(THEMES[base], parseColors(colors)), custom: true };
  }
}

export function resolveTheme(name, colors = {}) {
  const base = THEMES[name];
  if (!base) throw new Error(`Unknown theme "${name}". Available: ${Object.keys(THEMES).join(", ")}`);
  const c = apply(base, colors);
  if (!c.heat) c.heat = [c.track, ...[0.3, 0.55, 0.8, 1].map((p) => mix(c.track, c.accent, p))];
  // Per-element slots default to the base palette *after* overrides, so fire_color / text_color cascade.
  c.title ??= c.muted;
  c.streakCurrNum ??= c.fire;
  c.streakSideNums ??= c.text;
  c.streakCurrLabel ??= c.fire;
  c.streakSideLabels ??= c.text;
  c.streakDates ??= c.muted;
  c.streakStroke ??= c.border;
  c.streakExcl ??= c.muted;
  c.snake ??= c.accent2;
  // one colour per level (E .. S, and the top 1%). The defaults are the same in every theme, so the levels always look different
  // from each other (a green theme would otherwise make them all green); light themes get them a little darker.
  const lv = (hex) => (c.base === "light" ? mix(hex, "#000000", 0.16) : hex);
  c.lvE ??= lv("#8b93a1"); // grey
  c.lvD ??= lv("#4aa8ff"); // blue
  c.lvC ??= lv("#36c98b"); // green
  c.lvB ??= lv("#b98cff"); // purple
  c.lvA ??= lv("#ff9f43"); // orange
  c.lvS ??= lv("#ffd23f"); // gold
  c.lvTop ??= lv("#ff5fd2"); // pink
  c.name = name;
  return c;
}
