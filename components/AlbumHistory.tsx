"use client";

import { useState } from "react";
import type { RatingEvent } from "@/lib/local/db";
import { formatScore } from "@/lib/score";
import { HistoryChart } from "./HistoryChart";

// "Opinion over time" for one album: the chart, plus readable "was → now"
// lines for the latest changes.
export function AlbumHistory({ events, titles }: { events: RatingEvent[]; titles: Map<string, string> }) {
  // Read the clock once when the panel mounts (a lazy useState initializer),
  // so re-renders don't redraw the chart's right edge.
  const [now] = useState(() => Date.now());

  // For each event we need the value *before* it, so walk forward
  // remembering the last value per target (the album, or one track).
  const lastValue = new Map<string, number | null>();
  const changes = events
    .map((e) => {
      const key = e.trackKey ?? "album";
      const from = lastValue.has(key) ? lastValue.get(key)! : undefined;
      lastValue.set(key, e.score);
      return {
        id: e.id,
        what: e.trackKey ? (titles.get(e.trackKey) ?? "a track") : "Album score",
        from,
        to: e.score,
        at: e.createdAt,
      };
    })
    .filter((c) => c.from !== undefined) // first-ever ratings aren't "changes"
    .reverse()
    .slice(0, 6);

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="label mb-3">Opinion over time</div>
      <HistoryChart events={events} now={Math.max(now, ...events.map((e) => e.createdAt))} />
      {changes.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
          {changes.map((c) => (
            <li key={c.id} className="flex items-baseline gap-2">
              <span className="num w-14 shrink-0 text-xs text-muted">
                {new Date(c.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
              <span dir="auto" className="min-w-0 flex-1 truncate text-text-2">
                {c.what}
              </span>
              <span className="num text-xs text-muted">
                {formatScore(c.from)} → <b className="text-text">{formatScore(c.to)}</b>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
