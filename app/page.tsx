import Link from "next/link";
import { AlbumCard, Cover, Empty, ScoreBadge, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/user";

const STARTERS = ["Blonde", "Kid A", "To Pimp a Butterfly", "Love Deluxe", "Ivri Lider", "Arik Einstein"];

export default async function Home() {
  const user = await currentUser();
  const [recent, top, counts] = await Promise.all([
    db.albumRating.findMany({
      where: { userId: user.id, score: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { album: true },
    }),
    db.albumRating.findMany({
      where: { userId: user.id, score: { not: null } },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 10,
      include: { album: true },
    }),
    Promise.all([
      db.albumRating.count({ where: { userId: user.id, score: { not: null } } }),
      db.trackRating.count({ where: { userId: user.id, score: { not: null } } }),
      db.album.count(),
    ]),
  ]);
  const [albumCount, trackCount, cached] = counts;

  return (
    <div className="space-y-16">
      <section className="rise grid gap-6 border-b border-ink pb-10 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <h1 className="font-display text-5xl font-extrabold leading-[0.9] tracking-tight sm:text-7xl">
            Notes on
            <br />
            every record.
          </h1>
          <p className="mt-4 max-w-md text-ink-2">
            Score every track, then the album on its own terms, and see whether the whole beats the sum of its parts.
          </p>
        </div>
        <dl className="num grid grid-cols-3 gap-6 text-right">
          {[
            [albumCount, "albums"],
            [trackCount, "tracks"],
            [cached, "in cache"],
          ].map(([n, l]) => (
            <div key={l}>
              <dd className="text-3xl font-bold">{n}</dd>
              <dt className="label">{l}</dt>
            </div>
          ))}
        </dl>
      </section>

      {recent.length === 0 ? (
        <section>
          <SectionTitle>Start somewhere</SectionTitle>
          <Empty>
            Nothing rated yet. Search for anything above, or try{" "}
            {STARTERS.map((s, i) => (
              <span key={s}>
                <Link className="text-ink underline" href={`/search?q=${encodeURIComponent(s)}`}>
                  {s}
                </Link>
                {i < STARTERS.length - 1 ? ", " : "."}
              </span>
            ))}
          </Empty>
        </section>
      ) : (
        <>
          <section>
            <SectionTitle>Recently rated</SectionTitle>
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-5">
              {recent.map((r) => (
                <AlbumCard key={r.id} album={r.album} score={r.score} />
              ))}
            </div>
          </section>

          <section>
            <SectionTitle right={<Link href="/stats" className="label underline">all stats →</Link>}>
              Your top ten
            </SectionTitle>
            <ol className="divide-y divide-rule border-y border-rule">
              {top.map((r, i) => (
                <li key={r.id}>
                  <Link href={`/album/${r.albumMbid}`} className="flex items-center gap-4 py-2 hover:bg-paper-2">
                    <span className="num w-6 text-right text-muted">{i + 1}</span>
                    <div className="w-11 shrink-0">
                      <Cover mbid={r.albumMbid} title={r.album.title} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div dir="auto" className="truncate font-display font-semibold">
                        {r.album.title}
                      </div>
                      <div dir="auto" className="truncate text-sm text-ink-2">
                        {r.album.artistCredit} <span className="num text-muted">{r.album.year}</span>
                      </div>
                    </div>
                    <ScoreBadge score={r.score} />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
