import Link from "next/link";
import { AlbumCard, Cover, Empty, ScoreBadge, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { average, formatScore, scoreColor } from "@/lib/score";
import { currentUser } from "@/lib/user";

const STARTERS = ["Blonde", "Kid A", "To Pimp a Butterfly", "Love Deluxe", "אריק איינשטיין", "Mashina"];

export default async function Home() {
  const user = await currentUser();
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const [recent, top, trackCount, listens, listenCountYear, allScores] = await Promise.all([
    db.albumRating.findMany({
      where: { userId: user.id, score: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: { album: true },
    }),
    db.albumRating.findMany({
      where: { userId: user.id, score: { not: null } },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 10,
      include: { album: true },
    }),
    db.trackRating.count({ where: { userId: user.id, score: { not: null } } }),
    db.listen.findMany({
      where: { userId: user.id },
      orderBy: [{ listenedOn: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: { album: true },
    }),
    db.listen.count({ where: { userId: user.id, listenedOn: { gte: yearStart } } }),
    db.albumRating.findMany({ where: { userId: user.id, score: { not: null } }, select: { score: true } }),
  ]);
  const avg = average(allScores.map((s) => s.score));

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
                href={`/search?q=${encodeURIComponent(s)}`}
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
          { n: listenCountYear, l: `listens in ${yearStart.getUTCFullYear()}` },
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
            <AlbumCard key={r.id} album={r.album} score={r.score} />
          ))}
        </div>
      </section>

      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionTitle right={<Link href="/stats" className="label hover:text-text">all stats →</Link>}>Your top ten</SectionTitle>
          <ol>
            {top.map((r, i) => (
              <li key={r.id}>
                <Link href={`/album/${r.albumMbid}`} className="flex items-center gap-4 rounded-lg px-2 py-2 transition hover:bg-surface">
                  <span className="num w-5 text-end text-sm text-muted">{i + 1}</span>
                  <div className="w-12 shrink-0">
                    <Cover mbid={r.albumMbid} title={r.album.title} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div dir="auto" className="truncate font-semibold">
                      {r.album.title}
                    </div>
                    <div dir="auto" className="truncate text-sm text-text-2">
                      {r.album.artistCredit} <span className="num text-muted">· {r.album.year}</span>
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
                  <Link href={`/album/${l.albumMbid}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-surface">
                    <div className="w-10 shrink-0">
                      <Cover mbid={l.albumMbid} title={l.album.title} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div dir="auto" className="truncate text-sm font-semibold">
                        {l.album.title}
                      </div>
                      <div className="num text-xs text-muted">
                        {l.listenedOn.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
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
