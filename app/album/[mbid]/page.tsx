import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumRater } from "@/components/AlbumRater";
import { HistoryChart } from "@/components/HistoryChart";
import { ListenLogger } from "@/components/ListenLogger";
import { AlbumListenLinks } from "@/components/ListenLinks";
import { Cover, ScoreBadge } from "@/components/ui";
import { albumGenres, ensureAlbum } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatScore } from "@/lib/score";
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
  const [rating, trackRatings, events, listens] = await Promise.all([
    db.albumRating.findUnique({ where: { userId_albumMbid: { userId: user.id, albumMbid: mbid } } }),
    db.trackRating.findMany({ where: { userId: user.id, track: { albumMbid: mbid } } }),
    db.ratingEvent.findMany({ where: { userId: user.id, albumMbid: mbid }, orderBy: { createdAt: "asc" } }),
    db.listen.findMany({ where: { userId: user.id, albumMbid: mbid }, orderBy: { listenedOn: "desc" } }),
  ]);

  // Turn the event log into readable "was → now" lines. For each event we
  // need the value *before* it, so walk forward remembering the last value
  // per target (album or a track).
  const titleOf = new Map(album.tracks.map((t) => [t.id, t.title]));
  const lastValue = new Map<string, number | null>();
  const changes = events
    .map((e) => {
      const key = e.trackId ?? "album";
      const from = lastValue.has(key) ? lastValue.get(key)! : undefined;
      lastValue.set(key, e.score);
      return { id: e.id, what: e.trackId ? (titleOf.get(e.trackId) ?? "a track") : "Album score", from, to: e.score, at: e.createdAt };
    })
    .filter((c) => c.from !== undefined) // first-ever ratings aren't "changes"
    .reverse()
    .slice(0, 8);

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
            <a
              className="label underline hover:!text-ink"
              href={`https://musicbrainz.org/release-group/${album.mbid}`}
              target="_blank"
              rel="noreferrer"
            >
              MusicBrainz ↗
            </a>
          </div>
          <div className="mt-6">
            <AlbumListenLinks
              artist={album.artistCredit}
              title={album.title}
              exact={album.streamLinks ? JSON.parse(album.streamLinks) : {}}
            />
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

      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="label section-rule mb-4">Diary</h2>
          <ListenLogger
            albumMbid={album.mbid}
            listens={listens.map((l) => ({
              id: l.id,
              day: l.listenedOn.toISOString().slice(0, 10),
              relisten: l.relisten,
              note: l.note,
            }))}
          />
        </section>

        <section>
          <h2 className="label section-rule mb-4">Opinion over time</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted">Every time you change a score, it’s kept here as a timeline.</p>
          ) : (
            <>
              <HistoryChart events={events} />
              {changes.length > 0 && (
                <ul className="mt-5 space-y-1.5 text-sm">
                  {changes.map((c) => (
                    <li key={c.id} className="flex items-baseline gap-2">
                      <span className="num w-16 shrink-0 text-xs text-muted">
                        {c.at.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                      <span dir="auto" className="min-w-0 flex-1 truncate">
                        {c.what}
                      </span>
                      <span className="num text-ink-2">
                        {formatScore(c.from)} → <b className="text-ink">{formatScore(c.to)}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </article>
  );
}
