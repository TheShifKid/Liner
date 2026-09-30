"use client";

import { toggleCrate } from "@/lib/local/actions";
import type { AlbumSnap } from "@/lib/local/db";
import { useInCrate } from "@/lib/local/hooks";

// "+ Crate" / "In your crate": save an album to hear later. The name comes
// from crate digging, flipping through record-store crates for finds.
export function CrateButton({ snap, compact = false }: { snap: AlbumSnap; compact?: boolean }) {
  const inCrate = useInCrate(snap.mbid);
  if (inCrate === undefined) return compact ? <span className="inline-block w-8" /> : null;

  const label = inCrate ? "In your crate" : "Add to crate";
  if (compact)
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          void toggleCrate(snap, inCrate);
        }}
        title={inCrate ? "Remove from your crate" : "Add to your crate (albums to hear)"}
        aria-label={label}
        aria-pressed={inCrate}
        className={`grid h-8 w-8 place-items-center rounded-full border text-base transition ${
          inCrate ? "border-transparent bg-text text-bg" : "border-line-strong text-text-2 hover:border-text hover:text-text"
        }`}
      >
        {inCrate ? "✓" : "+"}
      </button>
    );

  return (
    <button
      onClick={() => void toggleCrate(snap, inCrate)}
      aria-pressed={inCrate}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        inCrate ? "border-transparent bg-text text-bg" : "border-line-strong hover:border-text"
      }`}
    >
      <span aria-hidden>{inCrate ? "✓" : "+"}</span>
      {label}
    </button>
  );
}

// A minimal snapshot from list data (no tracklist yet). saveSnapshot never
// lets a minimal snapshot overwrite a full one.
export function listSnap(a: { mbid: string; title: string; artist: string; artistMbid: string | null; year: number | null; genres?: string[] }): AlbumSnap {
  return {
    mbid: a.mbid,
    title: a.title,
    artistCredit: a.artist,
    artistMbid: a.artistMbid,
    year: a.year,
    primaryType: "Album",
    genres: a.genres ?? [],
    tracks: [],
    savedAt: 0,
  };
}
