import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumRater } from "@/components/AlbumRater";
import { CoverTint } from "@/components/CoverTint";
import { ListenLinks } from "@/components/ListenLinks";
import { MyScore } from "@/components/MyScore";
import { Cover } from "@/components/ui";
import { albumGenres, ensureAlbum } from "@/lib/catalog";
import { db } from "@/lib/db";
import { sectionDir } from "@/lib/text";
import type { AlbumSnap } from "@/lib/local/db";

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

  const genres = albumGenres(album).slice(0, 4);
  const secondary: string[] = album.secondaryTypes ? JSON.parse(album.secondaryTypes) : [];
  const totalMs = album.tracks.reduce((s, t) => s + (t.lengthMs ?? 0), 0);
  const dir = sectionDir([album.title, ...album.tracks.map((t) => t.title)]);
  const heroDir = sectionDir([album.title, album.artistCredit]);

  // The catalog facts your device keeps alongside your ratings, so stats and
  // the diary work without asking the server again.
  const snap: AlbumSnap = {
    mbid: album.mbid,
    title: album.title,
    artistCredit: album.artistCredit,
    artistMbid: album.artistMbid,
    year: album.year,
    primaryType: album.primaryType,
    genres: albumGenres(album),
    tracks: album.tracks.map((t) => ({ key: `${album.mbid}:${t.position}`, title: t.title, position: t.position, lengthMs: t.lengthMs })),
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
        <div className="absolute end-0 top-10 hidden text-center lg:block">
          <MyScore mbid={album.mbid} size="xl" caption="your score" />
        </div>
      </CoverTint>

      <AlbumRater
        snap={snap}
        dir={dir}
        tracks={album.tracks.map((t) => ({
          key: `${album.mbid}:${t.position}`,
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
