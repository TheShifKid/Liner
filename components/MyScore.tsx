"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { local } from "@/lib/local/db";
import { ScoreBadge } from "./ScoreBadge";

// Your score for one album, read from this device's database. Renders
// nothing when you haven't scored it. It's tiny and self-contained so server
// pages (search results, discographies) can drop it anywhere.
export function MyScore({ mbid, size = "sm", caption }: { mbid: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; caption?: string }) {
  const score = useLiveQuery(async () => (await local.albumRatings.get(mbid))?.score ?? null, [mbid]);
  if (score === null || score === undefined) return null;
  return (
    <>
      <ScoreBadge score={score} size={size} />
      {caption && <div className="label mt-2">{caption}</div>}
    </>
  );
}
