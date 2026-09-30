import type { Metadata } from "next";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "How Liner works" };

// A plain-language tour of the techniques in this codebase, each named so it's
// searchable. File paths point at where to read the real thing.
const NOTES: { title: string; file: string; body: string }[] = [
  {
    title: "A static site with no server",
    file: "next.config.ts",
    body: "Liner is built into plain HTML, CSS and JavaScript files (a “static export”) and hosted free on GitHub Pages. Everything dynamic happens in your browser: it talks to MusicBrainz directly, which is allowed because MusicBrainz sends CORS headers (the permission a site needs before a browser lets another site's code read its responses).",
  },
  {
    title: "Read-through cache",
    file: "lib/catalog.ts",
    body: "Every album you search or open is copied from MusicBrainz into a cache in your browser (IndexedDB). Next time, Liner reads its own copy and makes zero network calls, so the app gets faster the more you use it and MusicBrainz gets fewer requests.",
  },
  {
    title: "Popularity from real listening data",
    file: "lib/popularity.ts",
    body: "Search results are ordered by a blend of how well the text matched and how many people actually listen, according to ListenBrainz, MusicBrainz's open listening-data sister project. Albums almost nobody plays (bootlegs, fan tributes) are hidden behind “show all”. Spotify stopped giving apps popularity numbers in February 2026, which is why the data comes from ListenBrainz.",
  },
  {
    title: "Charts as a weekly batch job",
    file: "scripts/build-charts.mjs",
    body: "The charts are built once a week, not on every visit: a script gathers thousands of candidate albums, looks up their listeners, genres, critic reviews and release years in batches, ranks them, and saves each chart as a small JSON file served with the site. This “gather → enrich → rank” shape is how most data pipelines work.",
  },
  {
    title: "Critic scores from Wikipedia",
    file: "lib/critic-scores.mjs",
    body: "Almost every notable album's Wikipedia article has a “Professional ratings” table (Metacritic, AllMusic, Pitchfork, Rolling Stone…). It's written as a template, so it can be parsed: we cut each table out by counting {{braces}}, read every review's score (4.5/5, 8.7/10, B+) and convert it to 0–100. Wikidata links a MusicBrainz album ID to its article. Charts rank by a Bayesian average, which pulls albums with only a few reviews toward the middle so one rave can't beat a classic with thirty reviews.",
  },
  {
    title: "Rate limiting with a serial promise queue",
    file: "lib/musicbrainz.ts",
    body: "MusicBrainz allows about one request per second. All requests join one promise chain, and each waits until 1.1 s have passed since the previous one. If MusicBrainz still answers 503 (busy), we retry after 1, 2, then 4 seconds: exponential backoff.",
  },
  {
    title: "Release groups vs releases",
    file: "lib/musicbrainz.ts",
    body: "“OK Computer” is one release group with dozens of releases (the UK CD, the US vinyl, the 2017 box set…). You rate the group. The tracklist comes from one canonical release, chosen by a scoring heuristic: official, earliest, and with the most common track count (the statistical mode), so deluxe editions lose.",
  },
  {
    title: "Streaming links from URL relationships",
    file: "lib/musicbrainz.ts",
    body: "MusicBrainz editors attach links to releases: Spotify, Apple Music, Bandcamp and so on. Liner harvests them, preferring the standard edition, so “Listen on” opens the exact album. When none is known, it falls back to that service's search page.",
  },
  {
    title: "Perceptual color scale (OKLCH)",
    file: "lib/score.ts",
    body: "Score colors are blended in OKLCH, a color space where equal numeric steps look like equal visual steps. Color stops are placed at the AOTY buckets (under 50 red, 50–69 yellow, 70+ green), so the categories stay obvious while a 71 and a 95 still look different.",
  },
  {
    title: "Your data stays on your device (IndexedDB)",
    file: "lib/local/db.ts",
    body: "Ratings, reviews, history, the diary and tier lists are saved in IndexedDB, a database built into your browser, through the Dexie library. There is no server, so nobody but you ever sees what you think of anything. The flip side: clearing site data erases your library, which is why there's an Export/Import backup on the “Your data” page.",
  },
  {
    title: "Live queries",
    file: "lib/local/hooks.ts",
    body: "Pages read your data with useLiveQuery, which re-runs a query whenever the tables it read change. Rate a song and the heatmap, averages, stats and even other open tabs update on their own, with no refresh logic anywhere.",
  },
  {
    title: "Stable keys instead of database ids",
    file: "lib/local/db.ts",
    body: "A song rating is stored under “album id : track position”, not the server's internal row id. If the server's cache is ever wiped and rebuilt, the ids change but your ratings still line up with the right songs.",
  },
  {
    title: "Append-only history with coalescing",
    file: "lib/local/actions.ts",
    body: "Every score change is added to a log that is never edited in place. The chart on each album replays that log to rebuild what you thought on any date, which is the core idea of event sourcing. Edits made within five minutes are merged into one, so fiddling doesn't clutter the history.",
  },
  {
    title: "Cross-origin images on a canvas",
    file: "components/CoverImage.tsx",
    body: "Saving a tier list or Wrapped card draws the page onto a <canvas>. Browsers lock (“taint”) a canvas containing images from other sites, unless that site allows it and the page asks politely. The Cover Art Archive allows it, and every cover here is requested with crossOrigin=\"anonymous\", so exports just work.",
  },
  {
    title: "Direction per section, not per line",
    file: "lib/text.ts",
    body: "If most letters in an album's titles are Hebrew, the whole tracklist is laid out right-to-left: numbers on the right, and score bars that fill from the right. Letting each row decide on its own made mixed lists look broken.",
  },
  {
    title: "Cover-tinted pages",
    file: "components/CoverTint.tsx",
    body: "Each album page takes its color from the cover: the image is shrunk to 24×24 pixels, and the pixels are averaged, weighted by how saturated each one is. That way a single red element can beat a large grey border.",
  },
];

export default function NotesPage() {
  return (
    <div className="rise mx-auto max-w-3xl">
      <PageTitle sub="The ideas behind the app, named so you can look them up.">How Liner works</PageTitle>
      <ol className="space-y-4">
        {NOTES.map((n, i) => (
          <li key={n.title} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-baseline gap-3">
              <span className="num text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="font-display text-lg font-bold">{n.title}</h2>
            </div>
            <p className="mt-2 leading-relaxed text-text-2">{n.body}</p>
            <code className="label mt-3 block normal-case tracking-normal">{n.file}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
