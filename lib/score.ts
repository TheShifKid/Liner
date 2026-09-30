// Score helpers shared by server and client code (no database imports here).
// Scores are whole numbers from 0 to 100, like Album of the Year.

export const MAX_SCORE = 100;

export function clampScore(n: number) {
  return Math.min(MAX_SCORE, Math.max(0, Math.round(n)));
}

export function formatScore(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  return String(Math.round(n));
}

// AOTY-style buckets, used for badges and legends: 70+ green, 50–69 yellow,
// under 50 red.
export type Tier = "high" | "mid" | "low" | "none";
export function scoreTier(n: number | null | undefined): Tier {
  if (n === null || n === undefined) return "none";
  if (n >= 70) return "high";
  if (n >= 50) return "mid";
  return "low";
}

// Continuous color for heatmaps and bars. We blend in OKLCH, a color space
// designed so equal numeric steps LOOK equal to the eye (in RGB, the midpoint
// of red and green is a muddy brown).
//
// The hue follows "color stops" (piecewise-linear interpolation), placed so
// the AOTY buckets stay readable at a glance, while inside each bucket the
// shade still moves, so a 71 and a 95 don't look identical.
const STOPS: [score: number, light: number, chroma: number, hue: number][] = [
  [0, 0.55, 0.2, 22],
  [45, 0.66, 0.19, 38],
  [50, 0.8, 0.16, 78],
  [69, 0.84, 0.17, 100],
  [70, 0.74, 0.18, 142],
  [100, 0.62, 0.17, 158],
];

export function scoreColor(n: number | null | undefined) {
  if (n === null || n === undefined) return "var(--unrated)";
  const s = Math.min(100, Math.max(0, n));
  let i = 0;
  while (i < STOPS.length - 2 && s > STOPS[i + 1][0]) i++;
  const [s0, l0, c0, h0] = STOPS[i];
  const [s1, l1, c1, h1] = STOPS[i + 1];
  const t = (s - s0) / (s1 - s0);
  const mix = (a: number, b: number) => a + (b - a) * t;
  return `oklch(${mix(l0, l1).toFixed(3)} ${mix(c0, c1).toFixed(3)} ${mix(h0, h1).toFixed(1)})`;
}

export function average(nums: (number | null | undefined)[]) {
  const xs = nums.filter((x): x is number => typeof x === "number");
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function formatDuration(ms: number | null | undefined) {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDelta(d: number | null) {
  if (d === null) return "–";
  const r = Math.round(d);
  return r > 0 ? `+${r}` : String(r);
}
