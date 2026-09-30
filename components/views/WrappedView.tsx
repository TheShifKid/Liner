"use client";

import Link from "next/link";
import { useLibrary } from "@/lib/local/hooks";
import { computeStats, criticType } from "@/lib/stats";
import { Empty } from "../ui";
import { WrappedDeck } from "../WrappedDeck";

export function WrappedView({ year }: { year: number }) {
  const lib = useLibrary();
  if (!lib) return null;

  const s = computeStats(lib, { from: `${year}-01-01`, to: `${year + 1}-01-01` });

  // Which years have any activity, for the year switcher.
  const thisYear = new Date().getFullYear();
  const firstYear = Math.min(
    thisYear,
    ...lib.listens.map((l) => Number(l.day.slice(0, 4))),
    ...lib.albumRatings.map((r) => new Date(r.createdAt).getFullYear()),
  );
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, n) => thisYear - n);

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
