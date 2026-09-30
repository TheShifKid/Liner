import { formatScore } from "@/lib/score";

// "How my opinion changed" chart, drawn as plain SVG on the server.
//
// Input is the raw event log. We *replay* it in time order: keep a running
// map of each track's latest score and recompute the average after every
// event. That turns a list of individual edits into two lines over time:
// the album score you gave, and the average your track scores implied.
// (Replaying a log to rebuild past state is the core idea behind event
// sourcing, used from bank ledgers to git.)

type Ev = { trackKey: string | null; score: number | null; createdAt: number };
type Point = { t: number; album: number | null; tracks: number | null };

export function replay(events: Ev[]): Point[] {
  const trackScores = new Map<string, number>();
  let album: number | null = null;
  const out: Point[] = [];
  for (const e of [...events].sort((a, b) => a.createdAt - b.createdAt)) {
    if (e.trackKey === null) album = e.score;
    else if (e.score === null) trackScores.delete(e.trackKey);
    else trackScores.set(e.trackKey, e.score);
    const vals = [...trackScores.values()];
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    out.push({ t: e.createdAt, album, tracks: avg });
  }
  return out;
}

const W = 640;
const H = 220;
const PAD = { l: 28, r: 12, t: 12, b: 26 };

// `now` is passed in rather than read here: React's lint rules flag
// Date.now() during render as "impure" (each re-render would draw a slightly
// different chart). The caller reads the clock once and keeps it.
export function HistoryChart({ events, now }: { events: Ev[]; now: number }) {
  const pts = replay(events);
  if (pts.length === 0) return null;

  const t0 = pts[0].t;
  const t1 = Math.max(now, t0 + 3600_000);
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (s: number) => PAD.t + (1 - s / 100) * (H - PAD.t - PAD.b);

  // A "step" path: the score holds flat until the next change, then jumps.
  // That's honest for opinions, which don't glide between values.
  const stepPath = (key: "album" | "tracks") => {
    let d = "";
    let prev: number | null = null;
    for (const p of pts) {
      const v = p[key];
      if (v === null) {
        prev = null;
        continue;
      }
      if (prev === null) d += `M${x(p.t)},${y(v)}`;
      else d += `H${x(p.t)}V${y(v)}`;
      prev = v;
    }
    if (prev !== null) d += `H${x(t1)}`;
    return d;
  };

  const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const last = pts[pts.length - 1];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="max-h-64 w-full" role="img" aria-label="Score history chart">
        {[0, 50, 70, 100].map((s) => (
          <g key={s}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(s)} y2={y(s)} stroke="var(--line)" strokeDasharray={s % 100 ? "3 4" : undefined} />
            <text x={PAD.l - 6} y={y(s) + 4} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="var(--font-mono)">
              {s}
            </text>
          </g>
        ))}
        <path d={stepPath("tracks")} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 4" />
        <path d={stepPath("album")} fill="none" stroke="var(--text)" strokeWidth="2.5" />
        {pts.map((p, i) =>
          p.album !== null && (i === 0 || pts[i - 1].album !== p.album) ? (
            <circle key={i} cx={x(p.t)} cy={y(p.album)} r="3.5" fill="var(--bg)" stroke="var(--text)" strokeWidth="2" />
          ) : null,
        )}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--muted)" fontFamily="var(--font-mono)">
          {fmtDate(t0)}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="var(--font-mono)">
          today
        </text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-2">
        <span>
          <span className="mr-1.5 inline-block w-5 border-t-[2.5px] border-text align-middle" />
          album score · now {formatScore(last.album)}
        </span>
        <span>
          <span className="mr-1.5 inline-block w-5 border-t-2 border-dashed border-muted align-middle" />
          track average · now {formatScore(last.tracks)}
        </span>
      </figcaption>
    </figure>
  );
}
