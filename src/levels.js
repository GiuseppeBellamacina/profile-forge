// One ranking for the whole card: E, E+, D-, D, D+ … S-, S, S+, then SSS and the secret X (top 0.1%).
// The header ring, the trophies and the avatar frame all read their level from here.
import { mix } from "./themes.js";

/** Lowest to highest. */
export const ALL_LEVELS = ["E", "E+", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+", "S-", "S", "S+", "SSS", "X"];
/** The letter a level belongs to: "A-" and "A+" are A; SSS and X are their own. */
export const FAMILIES = ["E", "D", "C", "B", "A", "S", "SSS", "X"];
export const familyOf = (l) => (l === "SSS" || l === "X" ? l : l[0]);
export const isLevel = (l) => ALL_LEVELS.includes(l);
/** SSS and X: the levels with the full set of effects. */
export const isTop = (l) => l === "SSS" || l === "X";
/** 0 (E) .. 18 (X). */
export const levelIndex = (l) => ALL_LEVELS.indexOf(l);
/** How much the rank shows off (`rankEffect: "auto"`): 0 below S, 1 for S-/S/S+ (halo), 2 for SSS (shine), 3 for X (flame). */
export const fxTier = (l) => ({ S: 1, SSS: 2, X: 3 })[familyOf(l)] ?? 0;

/** Header rank: the first threshold (percent of users above you) that your percentile fits under. */
const PERCENTILES = [
  [0.1, "X"], [0.5, "SSS"], [1.5, "S+"], [3, "S"], [7, "S-"], [10, "A+"], [14, "A"], [19, "A-"], [23, "B+"], [30, "B"], [37, "B-"],
  [45, "C+"], [52, "C"], [60, "C-"], [68, "D+"], [76, "D"], [84, "D-"], [92, "E+"], [100, "E"],
];
export const levelOfPercentile = (p) => PERCENTILES.find(([t]) => p <= t)[1];
/** The percentile a level starts at (its threshold), for the guide and the demo. */
export const PERCENTILE_OF = Object.fromEntries(PERCENTILES.map(([t, l]) => [l, t]));

/** Old rank names (github-profile-trophy and earlier versions) and what to use now, for a helpful error. */
export const OLD_RANKS = { SS: "S+", AAA: "A+", AA: "A" };

/** Theme colour field of a level family (see COLOR_KEYS in themes.js: levelE ... levelS, levelTop = SSS, levelX). */
export const levelField = (l) => `lv${{ SSS: "Top", X: "X" }[familyOf(l)] ?? familyOf(l)}`;
/** The colour of a level: its letter's colour, a little brighter for "+" and a little duller for "-". */
export const levelColor = (c, l) => {
  const base = c[levelField(l)];
  if (l.endsWith("+")) return mix(base, c.base === "light" ? "#000000" : "#ffffff", c.base === "light" ? 0.18 : 0.24);
  if (l.endsWith("-")) return mix(base, c.muted, 0.32);
  return base;
};
