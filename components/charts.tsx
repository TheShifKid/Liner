import { formatScore, scoreColor } from "@/lib/score";
import { ScoreBadge } from "./ui";

// Small chart primitives built from plain HTML boxes instead of a chart
// library: a bar is just a div whose height or width is a percentage. They
// resize with the layout for free, and each bar carries a native `title`
// tooltip with its exact numbers.

// Vertical bars. Color is optional: the score histogram colors each band by
// its score (the same encoding as everywhere else in Liner); count charts
// stay neutral, because there color would mean nothing.
export function Columns({
  data,
  height = 160,
}: {
  data: { label: string; value: number; color?: string; tip: string }[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-1.5 border-b border-line-strong" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end" title={d.tip}>
            {d.value > 0 && (
              <span className="num mb-1 text-center text-[11px] text-text-2 opacity-0 transition group-hover:opacity-100">
                {d.value}
              </span>
            )}
            <div
              className="mx-auto w-full max-w-12 rounded-t-[4px] transition-[filter] group-hover:brightness-125"
              style={{
                height: `${(d.value / max) * 85}%`,
                minHeight: d.value ? 3 : 0,
                background: d.color ?? "color-mix(in oklab, var(--text-2) 45%, var(--surface))",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d) => (
          <div key={d.label} className="num flex-1 truncate text-center text-[10px] text-muted">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// Horizontal bars for ranked lists (genres, artists): bar = how many albums,
// badge = your average for them. Two separate measures, two separate marks,
// so there's never a second axis.
export function RankedBars({ rows }: { rows: { key: string; count: number; avg: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3" title={`${r.key}: ${r.count} album${r.count === 1 ? "" : "s"}, average ${formatScore(r.avg)}`}>
          <span dir="auto" className="truncate text-sm">
            {r.key}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 rounded-full bg-[color-mix(in_oklab,var(--text-2)_45%,var(--surface))]" style={{ width: `${(r.count / max) * 100}%`, minWidth: 6 }} />
            <span className="num text-xs text-muted">{r.count}</span>
          </span>
          <ScoreBadge score={r.avg} size="xs" />
        </li>
      ))}
    </ul>
  );
}

export function histogramData(h: { from: number; to: number; count: number }[]) {
  return h.map((b) => ({
    label: String(b.from),
    value: b.count,
    color: scoreColor(b.from + 5),
    tip: `${b.from}–${b.to}: ${b.count} album${b.count === 1 ? "" : "s"}`,
  }));
}
