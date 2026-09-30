"use client";

import Link from "next/link";
import { searchCatalog } from "@/lib/catalog";
import { artistHref } from "@/lib/urls";
import { useAsync } from "@/lib/useAsync";
import { AlbumCard, Empty, SectionTitle } from "../ui";

export function SearchView({ q }: { q: string }) {
  const { data: result, error } = useAsync(() => searchCatalog(q), q);

  if (!q.trim()) return <Empty>Type an album or artist in the search bar.</Empty>;
  if (error) return <Empty>MusicBrainz didn’t answer. It rate-limits hard; wait a few seconds and search again.</Empty>;
  if (!result)
    return (
      <div className="space-y-6">
        <div className="label">Searching MusicBrainz (one polite request per second)…</div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded bg-surface-2" />
          ))}
        </div>
      </div>
    );

  return (
    <div className="rise space-y-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 dir="auto" className="font-display text-4xl font-extrabold tracking-tight">
          “{q}”
        </h1>
        <span className="label">{result.cached ? "from this device’s cache" : "fresh from MusicBrainz"}</span>
      </div>

      {result.artists.length > 0 && (
        <section>
          <SectionTitle>Artists</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {result.artists.map((a) => (
              <li key={a.mbid}>
                <Link
                  href={artistHref(a.mbid)}
                  className="flex items-baseline gap-2 rounded-full border border-line-strong px-4 py-2 transition hover:bg-surface-2"
                >
                  <span dir="auto" className="font-semibold">
                    {a.name}
                  </span>
                  {a.disambiguation && <span className="text-xs opacity-60">{a.disambiguation}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>Albums &amp; releases</SectionTitle>
        {result.albums.length === 0 ? (
          <Empty>Nothing found. Try the artist name plus the album title.</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-4 lg:grid-cols-6">
            {result.albums.map((a) => (
              <AlbumCard
                key={a.mbid}
                album={a}
                sub={<div className="num text-xs text-muted">{[a.year, a.primaryType].filter(Boolean).join(" · ")}</div>}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
