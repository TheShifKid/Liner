// Score helpers shared by server and client code (no database imports here).

export const SCORE_STEPS = Array.from({ length: 21 }, (_, i) => i / 2); // 0, 0.5 … 10

export function clampScore(n: number) {
  return Math.min(10, Math.max(0, Math.round(n * 2) / 2));
}

export function formatScore(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  // 7 → "7", 7.5 → "7.5", but averages keep one decimal: 7.25 → "7.3"
  return Number.isInteger(n) && digits === 1 ? String(n) : n.toFixed(digits).replace(/\.0$/, "");
}

// AOTY-style buckets. Used for badges and legends.
export type Tier = "high" | "mid" | "low" | "none";
export function scoreTier(n: number | null | undefined): Tier {
  if (n === null || n === undefined) return "none";
  if (n >= 7) return "high";
  if (n >= 5) return "mid";
  return "low";
}

// Continuous color for the heatmap. We blend in OKLCH, a color space designed
// so that equal numeric steps LOOK like equal steps to the eye (unlike RGB,
// where the midpoint of red and green is a muddy brown).
//
// The hue follows "color stops" (piecewise-linear interpolation), placed so
// the AOTY buckets stay readable: under 5 is red, 5–7 amber, 7+ green, and
// within each bucket the shade still moves, so a 7 and a 9.5 look different.
const STOPS: [score: number, hue: number, light: number, chroma: number][] = [
  [0, 22, 0.55, 0.2],
  [4.5, 42, 0.66, 0.18],
  [5, 72, 0.78, 0.16],
  [6.5, 95, 0.82, 0.17],
  [7, 135, 0.72, 0.17],
  [10, 155, 0.6, 0.16],
];

export function scoreColor(n: number | null | undefined) {
  if (n === null || n === undefined) return "var(--unrated)";
  const s = Math.min(10, Math.max(0, n));
  let i = 0;
  while (i < STOPS.length - 2 && s > STOPS[i + 1][0]) i++;
  const [s0, h0, l0, c0] = STOPS[i];
  const [s1, h1, l1, c1] = STOPS[i + 1];
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
