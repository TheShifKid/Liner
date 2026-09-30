"use client";

import Link from "next/link";
import { useLibrary } from "@/lib/local/hooks";
import { Cover, Empty, ScoreBadge } from "../ui";
import { albumHref } from "@/lib/urls";

// Days are "YYYY-MM-DD" strings in your own timezone. We build calendar dates
// at noon (not midnight) so no timezone shift can push them into another day.
const atNoon = (day: string) => new Date(`${day}T12:00:00`);
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function DiaryView() {
  const lib = useLibrary();
  if (!lib) return null;

  const listens = [...lib.listens].sort((a, b) => b.day.localeCompare(a.day) || b.createdAt - a.createdAt);
  const scoreOf = new Map(lib.albumRatings.map((r) => [r.albumMbid, r.score]));
  const album = (mbid: string) => lib.albums.get(mbid) ?? { title: "Unknown album", artistCredit: "" };

  if (listens.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Diary</h1>
        <Empty>
          No listens logged yet. Open any album and hit <b>Log listen</b>: the date you listened, and a note if you
          like.
        </Empty>
      </div>
    );
  }

  // Group rows by month, the way Letterboxd's diary does.
  const months = new Map<string, typeof listens>();
  for (const l of listens) months.set(l.day.slice(0, 7), [...(months.get(l.day.slice(0, 7)) ?? []), l]);

  const perDay = new Map<string, number>();
  for (const l of listens) perDay.set(l.day, (perDay.get(l.day) ?? 0) + 1);
  const thisYear = String(new Date().getFullYear());
  const yearCount = listens.filter((l) => l.day.startsWith(thisYear)).length;

  return (
    <div className="rise space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Diary</h1>
        <p className="num text-sm text-text-2">
          {yearCount} listen{yearCount === 1 ? "" : "s"} in {thisYear} · {listens.length} all time
        </p>
      </header>

      <ActivityCalendar perDay={perDay} />

      {[...months.entries()].map(([month, rows]) => (
        <section key={month}>
          <h2 className="mb-2 border-b border-line pb-2 font-display text-xl font-bold">
            {atNoon(`${month}-15`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </h2>
          <ol>
            {rows.map((l) => {
              const a = album(l.albumMbid);
              return (
                <li key={l.id}>
                  <Link href={albumHref(l.albumMbid)} className="flex items-center gap-4 rounded-lg px-2 py-2.5 transition hover:bg-surface">
                    <div className="w-12 shrink-0 text-center">
                      <div className="num text-2xl font-bold leading-none">{Number(l.day.slice(8, 10))}</div>
                      <div className="label">{atNoon(l.day).toLocaleDateString("en-GB", { weekday: "short" })}</div>
                    </div>
                    <div className="w-12 shrink-0">
                      <Cover mbid={l.albumMbid} title={a.title} artist={a.artistCredit} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div dir="auto" className="truncate font-semibold">
                        {a.title}
                        {l.relisten && (
                          <span className="label ml-2 align-middle" title="Relisten">
                            ↻ relisten
                          </span>
                        )}
                      </div>
                      <div dir="auto" className="truncate text-sm text-text-2">
                        {a.artistCredit}
                        {l.note && <span className="text-muted"> — {l.note}</span>}
                      </div>
                    </div>
                    <ScoreBadge score={scoreOf.get(l.albumMbid) ?? null} size="sm" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

// A GitHub-style contribution grid for the last 53 weeks: columns are weeks,
// rows are weekdays, and stronger color means more listens that day.
function ActivityCalendar({ perDay }: { perDay: Map<string, number> }) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 7 * 52 - start.getDay()); // back to a Sunday, 52 weeks ago
  const weeks: Date[][] = [];
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) weeks.push([]);
    weeks[weeks.length - 1].push(new Date(d));
  }
  const shade = (n: number) =>
    n === 0 ? "var(--surface-2)" : `color-mix(in oklch, var(--accent) ${Math.min(100, 35 + n * 25)}%, var(--bg))`;
  return (
    <div className="no-scrollbar overflow-x-auto rounded-xl border border-line bg-surface p-4">
      <div className="flex w-max gap-[3px]">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {w.map((d) => {
              const n = perDay.get(dayKey(d)) ?? 0;
              return (
                <div
                  key={dayKey(d)}
                  title={`${dayKey(d)}: ${n} listen${n === 1 ? "" : "s"}`}
                  className="h-[11px] w-[11px] rounded-[2px]"
                  style={{ background: shade(n) }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
