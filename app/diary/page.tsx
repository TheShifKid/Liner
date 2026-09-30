import type { Metadata } from "next";
import Link from "next/link";
import { Cover, Empty, ScoreBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/user";

export const metadata: Metadata = { title: "Diary" };

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export default async function DiaryPage() {
  const user = await currentUser();
  const listens = await db.listen.findMany({
    where: { userId: user.id },
    orderBy: [{ listenedOn: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: { album: { include: { ratings: { where: { userId: user.id } } } } },
  });

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
  for (const l of listens) {
    const k = l.listenedOn.toISOString().slice(0, 7);
    months.set(k, [...(months.get(k) ?? []), l]);
  }

  const perDay = new Map<string, number>();
  for (const l of listens) perDay.set(dayKey(l.listenedOn), (perDay.get(dayKey(l.listenedOn)) ?? 0) + 1);
  const thisYear = new Date().getUTCFullYear();
  const yearCount = listens.filter((l) => l.listenedOn.getUTCFullYear() === thisYear).length;

  return (
    <div className="rise space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Diary</h1>
        <p className="num text-sm text-ink-2">
          {yearCount} listens in {thisYear} · {listens.length} all time
        </p>
      </header>

      <ActivityCalendar perDay={perDay} />

      {[...months.entries()].map(([month, rows]) => (
        <section key={month}>
          <h2 className="label section-rule mb-2">
            {new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </h2>
          <ol className="divide-y divide-rule">
            {rows.map((l) => {
              const score = l.album.ratings[0]?.score ?? null;
              return (
                <li key={l.id}>
                  <Link href={`/album/${l.albumMbid}`} className="flex items-center gap-4 py-2.5 hover:bg-paper-2">
                    <div className="w-12 shrink-0 text-center">
                      <div className="num text-2xl font-bold leading-none">{l.listenedOn.getUTCDate()}</div>
                      <div className="label">
                        {l.listenedOn.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
                      </div>
                    </div>
                    <div className="w-12 shrink-0">
                      <Cover mbid={l.albumMbid} title={l.album.title} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div dir="auto" className="truncate font-display font-semibold">
                        {l.album.title}
                        {l.relisten && (
                          <span className="label ml-2 align-middle" title="Relisten">
                            ↻ relisten
                          </span>
                        )}
                      </div>
                      <div dir="auto" className="truncate text-sm text-ink-2">
                        {l.album.artistCredit}
                        {l.note && <span className="text-muted"> — {l.note}</span>}
                      </div>
                    </div>
                    <ScoreBadge score={score} size="sm" />
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
// rows are weekdays, and darker ink means more listens that day.
function ActivityCalendar({ perDay }: { perDay: Map<string, number> }) {
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 7 * 52 - start.getUTCDay()); // back to a Sunday, 52 weeks ago
  const weeks: Date[][] = [];
  for (const d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 0) weeks.push([]);
    weeks[weeks.length - 1].push(new Date(d));
  }
  const shade = (n: number) => (n === 0 ? "var(--paper-2)" : `color-mix(in oklch, var(--ink) ${Math.min(100, 30 + n * 25)}%, var(--paper))`);
  return (
    <div className="overflow-x-auto">
      <div className="flex w-max gap-[3px]">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {w.map((d) => {
              const n = perDay.get(dayKey(d)) ?? 0;
              return (
                <div
                  key={dayKey(d)}
                  title={`${dayKey(d)}: ${n} listen${n === 1 ? "" : "s"}`}
                  className="h-[11px] w-[11px]"
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
