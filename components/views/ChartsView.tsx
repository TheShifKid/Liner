"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadChart, loadChartIndex, type Chart, type ChartSummary } from "@/lib/charts";
import { formatListeners } from "@/lib/popularity";
import { albumHref, artistHref, chartHref } from "@/lib/urls";
import { useAsync } from "@/lib/useAsync";
import { CoverImage } from "../CoverImage";
import { CrateButton, listSnap } from "../CrateButton";
import { MyScore } from "../MyScore";
import { ScoreBadge } from "../ScoreBadge";
import { Empty, SectionTitle } from "../ui";

const SECTIONS: { kind: ChartSummary["kind"][]; title: string }[] = [
  { kind: ["overall", "region"], title: "The big lists" },
  { kind: ["year"], title: "Year by year" },
  { kind: ["genre"], title: "Best by genre" },
  { kind: ["decade"], title: "Best by decade" },
];

const BLURB: Record<string, string> = {
  greatest: "The best-reviewed albums ever made.",
  "hidden-gems": "Loved by critics, heard by few. Start digging here.",
  "most-listened": "What people actually play the most.",
  hebrew: "The most-played Israeli and Hebrew albums.",
};

const Source = ({ basis }: { basis: Chart["basis"] }) =>
  basis === "critics" ? (
    <>
      Ranked by critic score: the reviews collected in each album’s{" "}
      <a href="https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Albums/Album_article_style_advice#Critical_reception" target="_blank" rel="noreferrer" className="underline hover:text-text">
        Wikipedia “Professional ratings” table
      </a>{" "}
      (Metacritic, AllMusic, Pitchfork, Rolling Stone…), averaged on a 0–100 scale. Albums with only a few reviews are
      pulled toward the middle until more critics weigh in.
    </>
  ) : (
    <>
      Ranked by how many different people listen, from{" "}
      <a href="https://listenbrainz.org" target="_blank" rel="noreferrer" className="underline hover:text-text">
        ListenBrainz
      </a>
      ’s open listening data.
    </>
  );

export function ChartsView() {
  const { data, error } = useAsync(loadChartIndex, "index");
  if (error) return <Empty>Couldn’t load the charts. Reload in a moment.</Empty>;
  if (!data) return null;

  return (
    <div className="rise space-y-14">
      <header>
        <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">Charts</h1>
        <p className="mt-2 max-w-2xl text-text-2">
          The best albums by genre, decade and year, ranked by what critics wrote about them. Found something? Hit{" "}
          <b>+</b> to drop it in your{" "}
          <Link href="/crate" className="underline hover:text-text">
            crate
          </Link>
          .
          <span className="text-muted">
            {" "}
            Updated weekly, last on {new Date(data.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
          </span>
        </p>
      </header>
      {SECTIONS.map((s) => {
        const charts = data.charts.filter((c) => s.kind.includes(c.kind));
        if (!charts.length) return null;
        return (
          <section key={s.title}>
            <SectionTitle>{s.title}</SectionTitle>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {charts.map((c) => (
                <ChartCard key={c.id} chart={c} big={s.kind.includes("overall")} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// A 2×2 mosaic of the chart's top four covers.
export function ChartCard({ chart, big = false }: { chart: ChartSummary; big?: boolean }) {
  return (
    <Link href={chartHref(chart.id)} className="group block rounded-xl border border-line bg-surface p-2.5 transition hover:border-line-strong">
      <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-md">
        {chart.top.slice(0, 4).map((a) => (
          <CoverImage key={a.mbid} mbid={a.mbid} title={a.title} artist={a.artist} className="aspect-square w-full object-cover" />
        ))}
      </div>
      <div className="px-1 pb-1 pt-3">
        <div className={`font-display font-bold leading-tight ${big ? "text-xl" : "text-lg"}`}>{chart.name}</div>
        <div className="label mt-1">
          {chart.count} albums · by {chart.basis === "critics" ? "critics" : "listeners"}
        </div>
      </div>
    </Link>
  );
}

export function ChartView({ id }: { id: string }) {
  const { data: chart, error } = useAsync(() => loadChart(id), id);
  const [shown, setShown] = useState(50);

  useEffect(() => {
    if (chart) document.title = `${chart.name} · Charts · Liner`;
  }, [chart]);

  if (error) return <Empty>That chart doesn’t exist. <Link href="/charts" className="underline">See all charts</Link>.</Empty>;
  if (!chart) return null;
  const critics = chart.basis === "critics";

  return (
    <div className="rise">
      <Link href="/charts" className="label hover:text-text">
        ← all charts
      </Link>
      <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight sm:text-6xl">{chart.name}</h1>
      {BLURB[chart.id] && <p className="mt-2 text-lg text-text">{BLURB[chart.id]}</p>}
      <p className="mt-2 max-w-2xl text-sm text-text-2">
        <Source basis={chart.basis} />
      </p>

      <ol className="mt-10">
        {chart.entries.slice(0, shown).map((e) => (
          <li key={e.mbid} className="group flex items-center gap-3 border-b border-line py-2.5 sm:gap-5">
            <span className="num w-8 shrink-0 text-end text-xl font-bold text-muted group-hover:text-text sm:w-12 sm:text-3xl">{e.rank}</span>
            <Link href={albumHref(e.mbid)} className="w-14 shrink-0 sm:w-16">
              <CoverImage mbid={e.mbid} title={e.title} artist={e.artist} className="cover w-full" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={albumHref(e.mbid)} dir="auto" className="block truncate text-[15px] font-semibold hover:underline sm:text-base">
                {e.title}
              </Link>
              <div dir="auto" className="truncate text-sm text-text-2">
                {e.artistMbid ? (
                  <Link href={artistHref(e.artistMbid)} className="hover:underline">
                    {e.artist}
                  </Link>
                ) : (
                  e.artist
                )}
                {e.year && <span className="num text-muted"> · {e.year}</span>}
              </div>
              <div className="mt-0.5 hidden truncate text-xs text-muted sm:block">{e.genres.join(" · ")}</div>
            </div>

            {/* What the chart is ranked by, big; the other number small. */}
            {critics && e.critic !== null ? (
              <div className="flex shrink-0 items-center gap-3">
                <div className="hidden text-end sm:block">
                  <div className="num text-sm text-text-2">
                    {e.reviews} review{e.reviews === 1 ? "" : "s"}
                  </div>
                  <div className="num text-xs text-muted">{formatListeners(e.listeners)}</div>
                </div>
                <ScoreBadge score={e.critic} size="sm" title="Critic score" />
              </div>
            ) : (
              <div className="hidden shrink-0 text-end sm:block">
                <div className="num text-sm text-text-2">{formatListeners(e.listeners)}</div>
                <div className="num text-xs text-muted">{e.plays.toLocaleString("en")} plays</div>
              </div>
            )}

            <div className="flex w-[4.5rem] shrink-0 items-center justify-end gap-2">
              <MyScore mbid={e.mbid} size="xs" />
              <CrateButton compact snap={listSnap(e)} />
            </div>
          </li>
        ))}
      </ol>

      {shown < chart.entries.length && (
        <div className="mt-8 text-center">
          <button onClick={() => setShown(chart.entries.length)} className="label rounded-full border border-line-strong px-4 py-2 hover:text-text">
            Show {chart.entries.length - shown} more
          </button>
        </div>
      )}
    </div>
  );
}

// A row of chart cards for the home page.
export function ChartsPreview({ limit = 8 }: { limit?: number }) {
  const { data } = useAsync(loadChartIndex, "index");
  if (!data) return null;
  const order: ChartSummary["kind"][] = ["overall", "year", "genre", "region", "decade"];
  const charts = [...data.charts].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).slice(0, limit);
  return (
    <section>
      <SectionTitle right={<Link href="/charts" className="label hover:text-text">all charts →</Link>}>Discover</SectionTitle>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {charts.map((c) => (
          <ChartCard key={c.id} chart={c} />
        ))}
      </div>
    </section>
  );
}
