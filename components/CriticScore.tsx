"use client";

import { useState } from "react";
import { loadCritics } from "@/lib/critics";
import { useAsync } from "@/lib/useAsync";
import { ScoreBadge } from "./ScoreBadge";

// "Critic score 86 · 11 reviews" in the album header; click to see every
// review it was averaged from. Renders nothing when Wikipedia has no reviews.
export function CriticScore({ mbid }: { mbid: string }) {
  const { data } = useAsync(() => loadCritics(mbid), mbid);
  const [open, setOpen] = useState(false);
  if (!data) return null;

  const count = data.reviews.length;
  return (
    <div className="mt-5">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group inline-flex items-center gap-3 text-start"
      >
        <ScoreBadge score={data.score} size="md" />
        <span className="leading-tight">
          <span className="label block">critic score</span>
          <span className="text-sm text-text-2 group-hover:text-text">
            {count ? `${count} review${count === 1 ? "" : "s"}` : ""}
            {data.metacritic !== null && `${count ? " · " : ""}Metacritic ${data.metacritic}`}
            <span className="text-muted"> {open ? "▴" : "▾"}</span>
          </span>
        </span>
      </button>

      {open && (
        <div className="mt-4 max-w-xl rounded-xl border border-line bg-bg/60 p-4 backdrop-blur">
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {data.metacritic !== null && <Row source="Metacritic (average)" score={data.metacritic} />}
            {data.reviews.map((r, i) => (
              <Row key={i} source={r.source} score={r.score} />
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Collected from the “Professional ratings” table on{" "}
            <a
              href={`https://en.wikipedia.org/wiki/${encodeURIComponent(data.wiki.replace(/ /g, "_"))}#Critical_reception`}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-text"
            >
              Wikipedia
            </a>
            , converted to 0–100. Metacritic counts as four reviews.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ source, score }: { source: string; score: number }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="truncate text-text-2">{source}</span>
      <ScoreBadge score={score} size="xs" />
    </li>
  );
}
