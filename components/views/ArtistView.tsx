"use client";

import { useEffect, useState } from "react";
import { ensureDiscography, type CatAlbum } from "@/lib/catalog";
import { isObscure } from "@/lib/popularity";
import { useAsync } from "@/lib/useAsync";
import { ArtistRatedSummary } from "../ArtistRatedSummary";
import { AlbumCard, Empty, SectionTitle } from "../ui";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Group the discography into studio albums, EPs, and "other" (live,
// compilations, soundtracks…) the way record shops file them.
const KINDS: { name: string; pick: (a: CatAlbum) => boolean }[] = [
  { name: "Albums", pick: (a) => a.primaryType === "Album" && a.secondaryTypes.length === 0 },
  { name: "EPs", pick: (a) => a.primaryType === "EP" && a.secondaryTypes.length === 0 },
  { name: "Live, compilations & more", pick: (a) => a.secondaryTypes.length > 0 },
];

export function ArtistView({ id }: { id: string }) {
  const valid = UUID.test(id);
  const { data, error } = useAsync(() => (valid ? ensureDiscography(id) : Promise.reject(new Error("bad id"))), id);

  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (data) document.title = `${data.artist.name} · Liner`;
  }, [data]);

  if (!valid) return <Empty>That doesn’t look like an artist link.</Empty>;
  if (error) return <Empty>Couldn’t reach MusicBrainz for this artist. Reload in a moment.</Empty>;
  if (!data) return <div className="label">Fetching the discography from MusicBrainz…</div>;

  const { artist, albums: everything } = data;
  // Hide releases almost nobody streams (unless there's nothing else).
  const popular = everything.filter((a) => !isObscure(a));
  const albums = showAll || popular.length === 0 ? everything : popular;
  const hiddenCount = everything.length - albums.length;
  return (
    <div className="rise space-y-12">
      <header>
        <div className="label mb-2">
          Artist{artist.country && ` · ${artist.country}`}
          {artist.disambiguation && ` · ${artist.disambiguation}`}
        </div>
        <h1 dir="auto" className="font-display text-5xl font-extrabold tracking-tight sm:text-7xl">
          {artist.name}
        </h1>
        <p className="mt-3 text-sm text-text-2">
          {(artist.genres ?? []).slice(0, 4).join(" · ")}
          <ArtistRatedSummary mbids={albums.map((a) => a.mbid)} />
        </p>
      </header>

      {KINDS.map((k) => {
        const list = albums.filter(k.pick);
        if (!list.length) return null;
        return (
          <section key={k.name}>
            <SectionTitle>{k.name}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((a) => (
                <AlbumCard key={a.mbid} album={a} />
              ))}
            </div>
          </section>
        );
      })}

      {(hiddenCount > 0 || showAll) && popular.length !== everything.length && (
        <div className="text-center">
          <button onClick={() => setShowAll((v) => !v)} className="label rounded-full border border-line-strong px-4 py-2 hover:text-text">
            {showAll ? "Hide bootlegs & rarely-streamed releases" : `Show ${hiddenCount} more (bootlegs & rarely streamed)`}
          </button>
        </div>
      )}
    </div>
  );
}
