import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumRater } from "@/components/AlbumRater";
import { Cover, ScoreBadge } from "@/components/ui";
import { albumGenres, ensureAlbum } from "@/lib/catalog";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/user";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function generateMetadata(props: PageProps<"/album/[mbid]">): Promise<Metadata> {
  const { mbid } = await props.params;
  const a = UUID.test(mbid) ? await db.album.findUnique({ where: { mbid } }) : null;
  return { title: a ? `${a.title} — ${a.artistCredit}` : "Album" };
}

export default async function AlbumPage(props: PageProps<"/album/[mbid]">) {
  const { mbid } = await props.params;
  if (!UUID.test(mbid)) notFound();

  let album;
  try {
    album = await ensureAlbum(mbid);
  } catch {
    return (
      <p className="py-20 text-center text-muted">
        Couldn’t reach MusicBrainz for this album. It may be busy; try again in a moment.
      </p>
    );
  }

  const user = await currentUser();
  const [rating, trackRatings] = await Promise.all([
    db.albumRating.findUnique({ where: { userId_albumMbid: { userId: user.id, albumMbid: mbid } } }),
    db.trackRating.findMany({ where: { userId: user.id, track: { albumMbid: mbid } } }),
  ]);

  const genres = albumGenres(album).slice(0, 5);
  const secondary: string[] = album.secondaryTypes ? JSON.parse(album.secondaryTypes) : [];

  return (
    <article className="rise">
      <header className="mb-12 grid gap-6 sm:grid-cols-[minmax(0,300px)_1fr] sm:gap-10">
        <Cover mbid={album.mbid} title={album.title} size={500} />
        <div className="flex flex-col justify-end">
          <div className="label mb-3">
            {[album.primaryType, ...secondary].filter(Boolean).join(" · ")}
            {album.firstReleaseDate && <> · {album.firstReleaseDate}</>}
          </div>
          <h1 dir="auto" className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
            {album.title}
          </h1>
          <div dir="auto" className="mt-3 text-xl text-ink-2">
            {album.artistMbid ? (
              <Link href={`/artist/${album.artistMbid}`} className="hover:underline">
                {album.artistCredit}
              </Link>
            ) : (
              album.artistCredit
            )}
          </div>
          {genres.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <li key={g} className="border border-rule px-2 py-0.5 text-xs text-ink-2">
                  {g}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {rating?.score != null && <ScoreBadge score={rating.score} size="lg" title="Your score" />}
            <div className="flex gap-3 text-xs">
              <a
                className="label underline hover:!text-ink"
                href={`https://musicbrainz.org/release-group/${album.mbid}`}
                target="_blank"
                rel="noreferrer"
              >
                MusicBrainz ↗
              </a>
              {album.deezerAlbumId && (
                <a
                  className="label underline hover:!text-ink"
                  href={`https://www.deezer.com/album/${album.deezerAlbumId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Full album on Deezer ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <AlbumRater
        album={{ mbid: album.mbid, title: album.title, artistCredit: album.artistCredit }}
        tracks={album.tracks.map((t) => ({
          id: t.id,
          title: t.title,
          position: t.position,
          disc: t.disc,
          number: t.number,
          lengthMs: t.lengthMs,
        }))}
        initialTracks={Object.fromEntries(trackRatings.map((r) => [r.trackId, { score: r.score, flag: r.flag }]))}
        initialAlbumScore={rating?.score ?? null}
        initialReview={rating?.review ?? ""}
      />
    </article>
  );
}
