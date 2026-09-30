import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlbumCard, Empty, SectionTitle } from "@/components/ui";
import { ensureDiscography } from "@/lib/catalog";
import { db } from "@/lib/db";
import { average, formatScore } from "@/lib/score";
import { currentUser } from "@/lib/user";

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

  const user = await currentUser();
  const ratings = await db.albumRating.findMany({
    where: { userId: user.id, album: { artistMbid: mbid } },
  });
  const scoreOf = new Map(ratings.map((r) => [r.albumMbid, r.score]));
  const genres: string[] = artist.genres ? JSON.parse(artist.genres) : [];

  // Group the discography into studio albums, EPs, and "other" (live,
  // compilations, soundtracks…) the way record shops file them.
  const kinds = [
    { name: "Albums", pick: (t: string | null, s: string | null) => t === "Album" && !s },
    { name: "EPs", pick: (t: string | null, s: string | null) => t === "EP" && !s },
    { name: "Live, compilations & more", pick: (_t: string | null, s: string | null) => !!s },
  ];

  const avg = average(ratings.map((r) => r.score));

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
        <p className="mt-3 text-sm text-ink-2">
          {genres.slice(0, 4).join(" · ")}
          {ratings.length > 0 && (
            <span className="num ml-2 text-muted">
              · you’ve rated {ratings.length} · avg {formatScore(avg, 2)}
            </span>
          )}
        </p>
      </header>

      {kinds.map((k) => {
        const albums = artist.albums.filter((a) => k.pick(a.primaryType, a.secondaryTypes));
        if (!albums.length) return null;
        return (
          <section key={k.name}>
            <SectionTitle>{k.name}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
              {albums.map((a) => (
                <AlbumCard key={a.mbid} album={a} score={scoreOf.get(a.mbid)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
