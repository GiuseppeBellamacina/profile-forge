// One ranking for the whole card: E, D, C, B, A, S, and a special level for the top 1% ("S+", animated).
// The header ring, the trophies and the avatar frame all read their level from here.

export const LEVELS = ["E", "D", "C", "B", "A", "S"];
export const TOP = "S+";
/** Lowest to highest. */
export const ALL_LEVELS = [...LEVELS, TOP];
export const isLevel = (l) => ALL_LEVELS.includes(l);
export const isTop = (l) => l === TOP;
/** 0 (E) .. 6 (S+). */
export const levelIndex = (l) => ALL_LEVELS.indexOf(l);

/** Header rank: the first threshold (percent of users above you) that your percentile fits under. */
const PERCENTILES = [[1, TOP], [10, "S"], [25, "A"], [50, "B"], [70, "C"], [85, "D"], [100, "E"]];
export const levelOfPercentile = (p) => PERCENTILES.find(([t]) => p <= t)[1];

/**
 * Trophies: the 8 thresholds of a title (highest first) become the 7 levels, highest first. The old second "A" step
 * (index 4) folds into B. Returns the level of old tier index i.
 */
export const TROPHY_LEVELS = [TOP, "S", "A", "B", "B", "C", "D", "E"];
/** Old tier names (github-profile-trophy) and what to use now, for a helpful error. */
export const OLD_RANKS = { SSS: "S+", SS: "S", AAA: "B", AA: "B" };

/** Theme colour field of a level (see COLOR_KEYS in themes.js: levelE ... levelS, levelTop). */
export const levelField = (l) => `lv${l === TOP ? "Top" : l}`;
export const levelColor = (c, l) => c[levelField(l)];
