import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlbumCard, Empty, SectionTitle } from "@/components/ui";
import { ensureDiscography } from "@/lib/catalog";
import { db } from "@/lib/db";
import { ArtistRatedSummary } from "@/components/ArtistRatedSummary";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function generateMetadata(props: PageProps<"/artist/[mbid]">): Promise<Metadata> {
  const { mbid } = await props.params;
  const a = UUID.test(mbid) ? await db.artist.findUnique({ where: { mbid } }) : null;
  return { title: a?.name ?? "Artist" };
}

export default async function ArtistPage(props: PageProps<"/artist/[mbid]">) {
  const { mbid } = await props.params;
  if (!UUID.test(mbid)) notFound();

  let artist;
  try {
    artist = await ensureDiscography(mbid);
  } catch {
    return <Empty>Couldn’t reach MusicBrainz for this artist. Try again in a moment.</Empty>;
  }

  const genres: string[] = artist.genres ? JSON.parse(artist.genres) : [];

  // Group the discography into studio albums, EPs, and "other" (live,
  // compilations, soundtracks…) the way record shops file them.
  const kinds = [
    { name: "Albums", pick: (t: string | null, s: string | null) => t === "Album" && !s },
    { name: "EPs", pick: (t: string | null, s: string | null) => t === "EP" && !s },
    { name: "Live, compilations & more", pick: (_t: string | null, s: string | null) => !!s },
  ];


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
          {genres.slice(0, 4).join(" · ")}
          <ArtistRatedSummary mbids={artist.albums.map((a) => a.mbid)} />
        </p>
      </header>

      {kinds.map((k) => {
        const albums = artist.albums.filter((a) => k.pick(a.primaryType, a.secondaryTypes));
        if (!albums.length) return null;
        return (
          <section key={k.name}>
            <SectionTitle>{k.name}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-4 lg:grid-cols-6">
              {albums.map((a) => (
                <AlbumCard key={a.mbid} album={a} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
