"use client";

import { useMyScores } from "@/lib/local/hooks";
import { average, formatScore } from "@/lib/score";

// "You've rated 4 · avg 81" on an artist page, from this device's data.
export function ArtistRatedSummary({ mbids }: { mbids: string[] }) {
  const scores = useMyScores(mbids);
  if (!scores || scores.size === 0) return null;
  return (
    <span className="num ml-2 text-muted">
      · you’ve rated {scores.size} · avg {formatScore(average([...scores.values()]))}
    </span>
  );
}
