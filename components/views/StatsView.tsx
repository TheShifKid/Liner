"use client";

import Link from "next/link";
import { Columns, RankedBars, histogramData } from "@/components/charts";
import { useLibrary } from "@/lib/local/hooks";
import { Cover, Empty, PageTitle, ScoreBadge } from "@/components/ui";
import { formatScore, scoreColor } from "@/lib/score";
import { computeStats, criticType } from "@/lib/stats";
import { albumHref } from "@/lib/urls";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function StatsView() {
  const lib = useLibrary();
  if (!lib) return null;
  const s = computeStats(lib);
  const critic = criticType(s.avgAlbum);

  if (s.counts.albums === 0) {
    return (
      <>
        <PageTitle>Stats</PageTitle>
        <Empty>Rate a few albums (and their songs) and this page fills with patterns about your taste.</Empty>
      </>
    );
  }

  const f = s.facts;

  return (
    <div className="rise">
      <PageTitle
        sub={
          critic ? (
            <>
              <b className="text-text">{critic.name}.</b> {critic.line}
            </>
          ) : null
        }
      >
        Stats
      </PageTitle>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile n={formatScore(s.avgAlbum)} l="avg album" color={s.avgAlbum} />
        <Tile n={formatScore(s.avgTrack)} l="avg song" color={s.avgTrack} />
        <Tile n={s.counts.albums} l="albums rated" />
        <Tile n={s.counts.tracks} l="songs rated" />
        <Tile n={s.counts.skipped} l="songs skipped" />
        <Tile n={s.counts.listens} l="listens logged" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="How you score" note="albums per band of 10">
          <Columns data={histogramData(s.histogram)} />
        </Card>
        <Card title="By decade" note="albums rated">
          {s.decades.length ? (
            <Columns
              data={s.decades.map((d) => ({
                label: d.key,
                value: d.count,
                tip: `${d.key}: ${d.count} album${d.count === 1 ? "" : "s"}, average ${formatScore(d.avg)}`,
              }))}
            />
          ) : (
            <p className="text-sm text-muted">No release years yet.</p>
          )}
          {s.favoriteDecade && (
            <p className="mt-4 text-sm text-text-2">
              Your best decade: <b className="text-text">{s.favoriteDecade.key}</b>, averaging{" "}
              <span className="num font-bold" style={{ color: scoreColor(s.favoriteDecade.avg) }}>
                {formatScore(s.favoriteDecade.avg)}
              </span>
              .
            </p>
          )}
        </Card>

        <Card title="Genres" note="bar = albums · badge = your avg">
          {s.genres.length ? (
            <RankedBars rows={s.genres} />
          ) : (
            <p className="text-sm text-muted">MusicBrainz has no genres for these yet.</p>
          )}
          {s.favoriteGenre && (
            <p className="mt-4 text-sm text-text-2">
              Highest-rated genre: <b className="text-text">{s.favoriteGenre.key}</b>.
            </p>
          )}
        </Card>
        <Card title="Artists" note="most albums rated">
          <RankedBars rows={s.artists} />
        </Card>
      </div>

      <h2 className="mb-5 mt-14 font-display text-2xl font-bold">Oddities</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {f.bestSongOnWorstAlbum?.track && (
          <Fact
            kicker="Best song on your worst album"
            album={f.bestSongOnWorstAlbum.track.album}
            main={f.bestSongOnWorstAlbum.track.title}
            score={f.bestSongOnWorstAlbum.track.score}
            detail={`on an album you gave ${formatScore(f.bestSongOnWorstAlbum.albumScore)}`}
          />
        )}
        {f.worstSongOnBestAlbum?.track && (
          <Fact
            kicker="Worst song on your best album"
            album={f.worstSongOnBestAlbum.track.album}
            main={f.worstSongOnBestAlbum.track.title}
            score={f.worstSongOnBestAlbum.track.score}
            detail={`on an album you gave ${formatScore(f.worstSongOnBestAlbum.albumScore)}`}
          />
        )}
        {f.moreThanSum && (
          <Fact
            kicker="More than the sum of its parts"
            album={f.moreThanSum.album}
            main={f.moreThanSum.album.title}
            score={f.moreThanSum.score}
            detail={`album ${formatScore(f.moreThanSum.score)} vs songs ${formatScore(f.moreThanSum.trackAvg)}`}
          />
        )}
        {f.lessThanSum && (
          <Fact
            kicker="Less than the sum of its parts"
            album={f.lessThanSum.album}
            main={f.lessThanSum.album.title}
            score={f.lessThanSum.score}
            detail={`album ${formatScore(f.lessThanSum.score)} vs songs ${formatScore(f.lessThanSum.trackAvg)}`}
          />
        )}
        {f.mostConsistent && (
          <Fact
            kicker="Most consistent album"
            album={f.mostConsistent.album}
            main={f.mostConsistent.album.title}
            detail={`songs within ±${Math.round(f.mostConsistent.spread)} of each other`}
          />
        )}
        {f.mostDivisive && (
          <Fact
            kicker="Most up-and-down album"
            album={f.mostDivisive.album}
            main={f.mostDivisive.album.title}
            detail={`songs swing ±${Math.round(f.mostDivisive.spread)} points`}
          />
        )}
        {f.changeOfHeart && (
          <Fact
            kicker="Biggest change of heart"
            album={f.changeOfHeart.album}
            main={f.changeOfHeart.album.title}
            score={f.changeOfHeart.last}
            detail={`${formatScore(f.changeOfHeart.first)} → ${formatScore(f.changeOfHeart.last)}`}
          />
        )}
      </div>

      {s.counts.listens > 0 && (
        <div className="mt-6">
          <Card title="Listens by month" note="all years combined">
            <Columns height={100} data={s.perMonth.map((n, i) => ({ label: MONTHS[i], value: n, tip: `${n} listens` }))} />
          </Card>
        </div>
      )}
    </div>
  );
}

function Tile({ n, l, color }: { n: React.ReactNode; l: string; color?: number | null }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className="num text-3xl font-bold" style={color != null ? { color: scoreColor(color) } : undefined}>
        {n}
      </div>
      <div className="label mt-1">{l}</div>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {note && <span className="label text-end">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Fact({
  kicker,
  album,
  main,
  score,
  detail,
}: {
  kicker: string;
  album: { mbid: string; title: string; artistCredit: string };
  main: string;
  score?: number;
  detail: string;
}) {
  return (
    <Link
      href={albumHref(album.mbid)}
      className="flex gap-4 rounded-xl border border-line bg-surface p-4 transition hover:border-line-strong"
    >
      <div className="w-16 shrink-0">
        <Cover mbid={album.mbid} title={album.title} artist={album.artistCredit} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="label">{kicker}</div>
        <div dir="auto" className="mt-1 truncate font-semibold">
          {main}
        </div>
        <div dir="auto" className="truncate text-sm text-text-2">
          {album.artistCredit}
        </div>
        <div className="mt-1 text-xs text-muted">{detail}</div>
      </div>
      {score !== undefined && <ScoreBadge score={score} size="sm" />}
    </Link>
  );
}
