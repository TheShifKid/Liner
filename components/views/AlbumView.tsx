"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ensureAlbum } from "@/lib/catalog";
import { formatListeners, withPopularity } from "@/lib/popularity";
import type { AlbumSnap } from "@/lib/local/db";
import { sectionDir } from "@/lib/text";
import { artistHref } from "@/lib/urls";
import { useAsync } from "@/lib/useAsync";
import { AlbumRater } from "../AlbumRater";
import { CoverTint } from "../CoverTint";
import { CrateButton } from "../CrateButton";
import { CriticScore } from "../CriticScore";
import { ListenLinks } from "../ListenLinks";
import { MyScore } from "../MyScore";
import { Cover, Empty } from "../ui";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function AlbumView({ id }: { id: string }) {
  const valid = UUID.test(id);
  const { data: album, error } = useAsync(
    async () => {
      if (!valid) throw new Error("bad id");
      const a = await ensureAlbum(id);
      await withPopularity([a]); // fills a.listeners / a.plays
      return a;
    },
    id,
  );

  // A static site can't set per-album <title>s at build time, so we set it here.
  useEffect(() => {
    if (album) document.title = `${album.title} — ${album.artistCredit} · Liner`;
  }, [album]);

  if (!valid) return <Empty>That doesn’t look like an album link.</Empty>;
  if (error)
    return <Empty>Couldn’t reach MusicBrainz for this album. It may be busy; reload in a moment.</Empty>;
  if (!album) return <AlbumSkeleton />;

  const genres = album.genres.slice(0, 4);
  const totalMs = album.tracks.reduce((s, t) => s + (t.lengthMs ?? 0), 0);
  const dir = sectionDir([album.title, ...album.tracks.map((t) => t.title)]);
  const heroDir = sectionDir([album.title, album.artistCredit]);
  const key = (position: number) => `${album.mbid}:${position}`;

  // The catalog facts your device keeps alongside your ratings, so stats and
  // the diary work without looking the album up again.
  const snap: AlbumSnap = {
    mbid: album.mbid,
    title: album.title,
    artistCredit: album.artistCredit,
    artistMbid: album.artistMbid,
    year: album.year,
    primaryType: album.primaryType,
    genres: album.genres,
    tracks: album.tracks.map((t) => ({ key: key(t.position), title: t.title, position: t.position, lengthMs: t.lengthMs })),
    savedAt: 0, // stamped when first saved on the device
  };

  return (
    <article>
      <CoverTint mbid={album.mbid} className="relative isolate -mt-8 mb-12 pb-10 pt-10">
        {/* Full-bleed backdrop: a vertical wash from the cover's color into
            the page background. It sits outside the centered column by being
            100vw wide and pulled left by half of that. */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--tint) 72%, var(--bg)) 0%, color-mix(in oklab, var(--tint) 26%, var(--bg)) 60%, var(--bg) 100%)",
          }}
        />
        <div className="rise grid items-end gap-6 sm:grid-cols-[minmax(0,260px)_1fr] sm:gap-10">
          <div className="max-w-[260px]">
            <Cover mbid={album.mbid} title={album.title} artist={album.artistCredit} size={500} className="cover-shadow" eager />
          </div>
          <div dir={heroDir} className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-text-2">
              {[album.primaryType, ...album.secondaryTypes].filter(Boolean).map((t) => (
                <span key={t} className="rounded-full bg-black/25 px-2.5 py-1">
                  {t}
                </span>
              ))}
              {album.year && <span className="num">{album.firstReleaseDate ?? album.year}</span>}
            </div>
            <h1 className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-balance sm:text-6xl">
              {album.title}
            </h1>
            <div className="mt-3 text-lg font-medium">
              {album.artistMbid ? (
                <Link href={artistHref(album.artistMbid)} className="hover:underline">
                  {album.artistCredit}
                </Link>
              ) : (
                album.artistCredit
              )}
            </div>
            {/* Separate elements (not one joined string) so "14 tracks" stays
                readable inside a right-to-left line. */}
            <ul className="mt-2 flex flex-wrap gap-x-2 text-sm text-text-2">
              {[
                `${album.tracks.length} tracks`,
                totalMs ? `${Math.round(totalMs / 60000)} min` : null,
                album.listeners ? formatListeners(album.listeners) : null,
                ...genres,
              ]
                .filter(Boolean)
                .map((m, i) => (
                  <li key={m} className="flex gap-2">
                    {i > 0 && <span className="text-muted">·</span>}
                    <bdi>{m}</bdi>
                  </li>
                ))}
            </ul>
            <CriticScore mbid={album.mbid} />
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
              <ListenLinks artist={album.artistCredit} title={album.title} exact={album.streamLinks ?? {}} />
              <CrateButton snap={snap} />
            </div>
          </div>
        </div>
        <div className="absolute end-0 top-10 hidden text-center lg:block">
          <MyScore mbid={album.mbid} size="xl" caption="your score" />
        </div>
      </CoverTint>

      <AlbumRater
        snap={snap}
        dir={dir}
        tracks={album.tracks.map((t) => ({
          key: key(t.position),
          title: t.title,
          position: t.position,
          disc: t.disc,
          number: t.number,
          lengthMs: t.lengthMs,
        }))}
      />
    </article>
  );
}

// Shown while a never-seen album is fetched: two or three polite,
// one-per-second calls to MusicBrainz.
function AlbumSkeleton() {
  return (
    <div className="grid gap-10 sm:grid-cols-[260px_1fr]">
      <div className="aspect-square animate-pulse rounded bg-surface-2" />
      <div className="flex flex-col justify-end gap-3">
        <div className="label">Pulling the sleeve from MusicBrainz…</div>
        <div className="h-14 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
