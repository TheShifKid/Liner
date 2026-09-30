"use client";

import Link from "next/link";
import { AlbumCard, Cover, Empty, ScoreBadge, SectionTitle } from "@/components/ui";
import { useLibrary } from "@/lib/local/hooks";
import { average, formatScore, scoreColor } from "@/lib/score";
import { albumHref, searchHref } from "@/lib/urls";

const STARTERS = ["Blonde", "Kid A", "To Pimp a Butterfly", "Love Deluxe", "אריק איינשטיין", "Mashina"];

export function HomeView() {
  const lib = useLibrary();
  if (!lib) return null; // first frame, while IndexedDB answers

  const year = new Date().getFullYear();
  const snap = (mbid: string) =>
    lib.albums.get(mbid) ?? { mbid, title: "Unknown album", artistCredit: "", year: null };
  const scoredRatings = lib.albumRatings.filter((r) => r.score !== null);
  const recent = [...scoredRatings].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
  const top = [...scoredRatings].sort((a, b) => b.score! - a.score! || b.updatedAt - a.updatedAt).slice(0, 10);
  const trackCount = lib.trackRatings.filter((t) => t.score !== null).length;
  const listens = [...lib.listens].sort((a, b) => b.day.localeCompare(a.day) || b.createdAt - a.createdAt).slice(0, 6);
  const listenCountYear = lib.listens.filter((l) => l.day.startsWith(String(year))).length;
  const avg = average(scoredRatings.map((s) => s.score));
  const allScores = scoredRatings;

  if (recent.length === 0) {
    return (
      <div className="rise mx-auto max-w-2xl py-16 text-center">
        <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
          Notes on
          <br />
          every record.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-lg text-text-2">
          Score every song, then the album on its own terms, and see whether the whole beats the sum of its parts.
        </p>
        <div className="mt-10">
          <div className="label mb-3">Start with</div>
          <div className="flex flex-wrap justify-center gap-2">
            {STARTERS.map((s) => (
              <Link
                key={s}
                href={searchHref(s)}
                dir="auto"
                className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium transition hover:bg-surface-2"
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rise space-y-16">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { n: allScores.length, l: "albums rated" },
          { n: trackCount, l: "songs rated" },
          { n: formatScore(avg), l: "average score", color: avg },
          { n: listenCountYear, l: `listens in ${year}` },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-line bg-surface px-5 py-4">
            <div className="num text-4xl font-bold" style={s.color != null ? { color: scoreColor(s.color) } : undefined}>
              {s.n}
            </div>
            <div className="label mt-1">{s.l}</div>
          </div>
        ))}
      </section>

      <section>
        <SectionTitle>Recently rated</SectionTitle>
        <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-4 lg:grid-cols-6">
          {recent.map((r) => (
            <AlbumCard key={r.albumMbid} album={snap(r.albumMbid)} score={r.score} />
          ))}
        </div>
      </section>

      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionTitle right={<Link href="/stats" className="label hover:text-text">all stats →</Link>}>Your top ten</SectionTitle>
          <ol>
            {top.map((r, i) => (
              <li key={r.albumMbid}>
                <Link href={albumHref(r.albumMbid)} className="flex items-center gap-4 rounded-lg px-2 py-2 transition hover:bg-surface">
                  <span className="num w-5 text-end text-sm text-muted">{i + 1}</span>
                  <div className="w-12 shrink-0">
                    <Cover mbid={r.albumMbid} title={snap(r.albumMbid).title} artist={snap(r.albumMbid).artistCredit} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div dir="auto" className="truncate font-semibold">
                      {snap(r.albumMbid).title}
                    </div>
                    <div dir="auto" className="truncate text-sm text-text-2">
                      {snap(r.albumMbid).artistCredit} <span className="num text-muted">· {snap(r.albumMbid).year}</span>
                    </div>
                  </div>
                  <ScoreBadge score={r.score} />
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <SectionTitle right={<Link href="/diary" className="label hover:text-text">diary →</Link>}>Latest listens</SectionTitle>
          {listens.length === 0 ? (
            <Empty>Log a listen from any album page and it shows up here.</Empty>
          ) : (
            <ul className="space-y-1">
              {listens.map((l) => (
                <li key={l.id}>
                  <Link href={albumHref(l.albumMbid)} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface">
                    <div className="w-10 shrink-0">
                      <Cover mbid={l.albumMbid} title={snap(l.albumMbid).title} artist={snap(l.albumMbid).artistCredit} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div dir="auto" className="truncate text-sm font-semibold">
                        {snap(l.albumMbid).title}
                      </div>
                      <div className="num text-xs text-muted">
                        {new Date(`${l.day}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        {l.relisten && " · relisten"}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
