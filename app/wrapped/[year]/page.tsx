import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty } from "@/components/ui";
import { WrappedDeck } from "@/components/WrappedDeck";
import { db } from "@/lib/db";
import { computeStats, criticType } from "@/lib/stats";
import { currentUser } from "@/lib/user";

export async function generateMetadata(props: PageProps<"/wrapped/[year]">): Promise<Metadata> {
  const { year } = await props.params;
  return { title: `Wrapped ${year}` };
}

export default async function WrappedPage(props: PageProps<"/wrapped/[year]">) {
  const { year: raw } = await props.params;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1900 || year > 3000) notFound();

  const user = await currentUser();
  const s = await computeStats(user.id, {
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year + 1, 0, 1)),
  });

  // Which years have any activity, for the year switcher.
  const [firstRating, firstListen] = await Promise.all([
    db.albumRating.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.listen.findFirst({ where: { userId: user.id }, orderBy: { listenedOn: "asc" } }),
  ]);
  const thisYear = new Date().getUTCFullYear();
  const startYear = Math.min(
    thisYear,
    firstRating?.createdAt.getUTCFullYear() ?? thisYear,
    firstListen?.listenedOn.getUTCFullYear() ?? thisYear,
  );
  const years = Array.from({ length: thisYear - startYear + 1 }, (_, n) => thisYear - n);

  return (
    <div className="rise">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Wrapped</h1>
        <div className="flex gap-1">
          {years.map((y) => (
            <Link
              key={y}
              href={`/wrapped/${y}`}
              className={`num rounded-full px-3 py-1.5 text-sm ${y === year ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {s.counts.albums === 0 && s.counts.listens === 0 ? (
        <Empty>
          Nothing rated or logged in {year} yet. Wrapped builds itself from your scores and diary: album of the year,
          song of the year, your sound, your critic type and more.
        </Empty>
      ) : (
        <WrappedDeck year={year} s={s} critic={criticType(s.avgAlbum)} />
      )}
    </div>
  );
}
