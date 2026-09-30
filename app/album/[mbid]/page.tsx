import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumRater } from "@/components/AlbumRater";
import { CoverTint } from "@/components/CoverTint";
import { HistoryChart } from "@/components/HistoryChart";
import { ListenLinks } from "@/components/ListenLinks";
import { ListenLogger } from "@/components/ListenLogger";
import { Cover, ScoreBadge } from "@/components/ui";
import { albumGenres, ensureAlbum } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatScore } from "@/lib/score";
import { sectionDir } from "@/lib/text";
import { currentUser } from "@/lib/user";

// Read once per request (see the note in HistoryChart).
const requestTime = () => Date.now();

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
  // per target (the album, or one track).
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
    .slice(0, 6);

  const genres = albumGenres(album).slice(0, 4);
  const secondary: string[] = album.secondaryTypes ? JSON.parse(album.secondaryTypes) : [];
  const totalMs = album.tracks.reduce((s, t) => s + (t.lengthMs ?? 0), 0);
  const dir = sectionDir([album.title, ...album.tracks.map((t) => t.title)]);
  const heroDir = sectionDir([album.title, album.artistCredit]);

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
            <Cover mbid={album.mbid} title={album.title} size={500} className="cover-shadow" eager />
          </div>
          <div dir={heroDir} className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-text-2">
              {[album.primaryType, ...secondary].filter(Boolean).map((t) => (
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
                <Link href={`/artist/${album.artistMbid}`} className="hover:underline">
                  {album.artistCredit}
                </Link>
              ) : (
                album.artistCredit
              )}
            </div>
            {/* Separate elements (not one joined string) so "14 tracks" stays
                readable inside a right-to-left line. */}
            <ul className="mt-2 flex flex-wrap gap-x-2 text-sm text-text-2">
              {[`${album.tracks.length} tracks`, totalMs ? `${Math.round(totalMs / 60000)} min` : null, ...genres]
                .filter(Boolean)
                .map((m, i) => (
                  <li key={m} className="flex gap-2">
                    {i > 0 && <span className="text-muted">·</span>}
                    <bdi>{m}</bdi>
                  </li>
                ))}
            </ul>
            <div className="mt-5">
              <ListenLinks artist={album.artistCredit} title={album.title} exact={album.streamLinks ? JSON.parse(album.streamLinks) : {}} />
            </div>
          </div>
        </div>
        {rating?.score != null && (
          <div className="absolute end-0 top-10 hidden text-center lg:block">
            <ScoreBadge score={rating.score} size="xl" />
            <div className="label mt-2">your score</div>
          </div>
        )}
      </CoverTint>

      <AlbumRater
        album={{ mbid: album.mbid, title: album.title }}
        dir={dir}
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
      >
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="label mb-3">Diary</div>
          <ListenLogger
            albumMbid={album.mbid}
            listens={listens.map((l) => ({
              id: l.id,
              day: l.listenedOn.toISOString().slice(0, 10),
              relisten: l.relisten,
              note: l.note,
            }))}
          />
        </div>

        {events.length > 0 && (
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="label mb-3">Opinion over time</div>
            <HistoryChart events={events} now={requestTime()} />
            {changes.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
                {changes.map((c) => (
                  <li key={c.id} className="flex items-baseline gap-2">
                    <span className="num w-14 shrink-0 text-xs text-muted">
                      {c.at.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                    <span dir="auto" className="min-w-0 flex-1 truncate text-text-2">
                      {c.what}
                    </span>
                    <span className="num text-xs text-muted">
                      {formatScore(c.from)} → <b className="text-text">{formatScore(c.to)}</b>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <a
          className="label block text-center hover:text-text"
          href={`https://musicbrainz.org/release-group/${album.mbid}`}
          target="_blank"
          rel="noreferrer"
        >
          View on MusicBrainz ↗
        </a>
      </AlbumRater>
    </article>
  );
}
