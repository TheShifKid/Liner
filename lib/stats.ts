import type { AlbumSnap } from "./local/db";
import type { Library } from "./local/hooks";
import { average } from "./score";

// All the numbers behind /stats and /wrapped, computed in the browser from
// your local library. It's a "pure function": data in, numbers out, no
// database calls, so it's easy to test and runs in milliseconds.

type AlbumLite = { mbid: string; title: string; artistCredit: string; year: number | null };
export type TrackPick = { title: string; score: number; album: AlbumLite };

function stdDev(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

// Group-and-summarize helper: "for each key, how many albums and what average".
function groupScores(items: { keys: string[]; score: number }[], min = 1) {
  const map = new Map<string, number[]>();
  for (const it of items) for (const k of it.keys) map.set(k, [...(map.get(k) ?? []), it.score]);
  return [...map.entries()]
    .filter(([, s]) => s.length >= min)
    .map(([key, s]) => ({ key, count: s.length, avg: average(s)! }));
}

const unknownAlbum = (mbid: string): AlbumSnap => ({
  mbid,
  title: "Unknown album",
  artistCredit: "",
  artistMbid: null,
  year: null,
  primaryType: null,
  genres: [],
  tracks: [],
  savedAt: 0,
});

// range: [from, to) as "YYYY-MM-DD" strings. For Wrapped, "this year" means
// albums you listened to or rated during the year.
export function computeStats(lib: Library, range?: { from: string; to: string }) {
  const album = (mbid: string) => lib.albums.get(mbid) ?? unknownAlbum(mbid);
  const lite = (a: AlbumSnap): AlbumLite => ({ mbid: a.mbid, title: a.title, artistCredit: a.artistCredit, year: a.year });
  const dayOf = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const within = (day: string) => !range || (day >= range.from && day < range.to);

  const listens = lib.listens.filter((l) => within(l.day)).sort((a, b) => a.day.localeCompare(b.day));
  const listenedIds = new Set(listens.map((l) => l.albumMbid));

  const scored = lib.albumRatings
    .filter((r) => r.score !== null && (!range || within(dayOf(r.updatedAt)) || listenedIds.has(r.albumMbid)))
    .map((r) => ({ albumMbid: r.albumMbid, score: r.score!, album: album(r.albumMbid) }));

  const albumIds = new Set([...scored.map((r) => r.albumMbid), ...listenedIds]);
  const trackRatings = lib.trackRatings.filter((t) => !range || albumIds.has(t.albumMbid));
  const trackScored = trackRatings.filter((t) => t.score !== null).map((t) => ({ ...t, score: t.score! }));

  // ── Distribution: how many albums in each band of 10 ──────────────────────
  const histogram = Array.from({ length: 10 }, (_, i) => ({
    from: i * 10,
    to: i === 9 ? 100 : i * 10 + 9,
    count: scored.filter((r) => Math.min(9, Math.floor(r.score / 10)) === i).length,
  }));

  // ── Genres, decades, artists ───────────────────────────────────────────────
  const genres = groupScores(scored.map((r) => ({ keys: r.album.genres.slice(0, 3), score: r.score })));
  const decades = groupScores(
    scored.filter((r) => r.album.year).map((r) => ({ keys: [`${Math.floor(r.album.year! / 10) * 10}s`], score: r.score })),
  ).sort((a, b) => a.key.localeCompare(b.key));
  const artists = groupScores(
    scored.filter((r) => r.album.artistCredit).map((r) => ({ keys: [r.album.artistCredit], score: r.score })),
  ).sort((a, b) => b.count - a.count || b.avg - a.avg);

  // ── Per-album track analysis ───────────────────────────────────────────────
  const tracksByAlbum = new Map<string, typeof trackScored>();
  for (const t of trackScored) tracksByAlbum.set(t.albumMbid, [...(tracksByAlbum.get(t.albumMbid) ?? []), t]);

  const withTracks = scored
    .map((r) => {
      const ts = tracksByAlbum.get(r.albumMbid) ?? [];
      const scores = ts.map((t) => t.score);
      return {
        album: lite(r.album),
        score: r.score,
        tracks: ts,
        trackAvg: average(scores)!,
        spread: scores.length >= 4 ? stdDev(scores) : null,
      };
    })
    .filter((x) => x.tracks.length >= 3);

  const byScore = [...withTracks].sort((a, b) => a.score - b.score);
  const worstAlbum = byScore[0];
  const bestAlbum = byScore[byScore.length - 1];
  const pick = (t: (typeof trackScored)[number] | undefined): TrackPick | null =>
    t ? { title: t.title, score: t.score, album: lite(album(t.albumMbid)) } : null;
  const top = (xs: typeof trackScored) => [...xs].sort((a, b) => b.score - a.score)[0];
  const bottom = (xs: typeof trackScored) => [...xs].sort((a, b) => a.score - b.score)[0];

  const byDelta = [...withTracks].sort((a, b) => b.score - b.trackAvg - (a.score - a.trackAvg));
  const bySpread = withTracks.filter((x) => x.spread !== null).sort((a, b) => a.spread! - b.spread!);
  const most = byDelta[0];
  const least = byDelta[byDelta.length - 1];

  // ── Biggest change of heart: first vs latest album score in the event log ──
  const firstLast = new Map<string, { first: number; last: number; album: AlbumLite }>();
  for (const e of [...lib.events].sort((a, b) => a.createdAt - b.createdAt)) {
    if (e.trackKey !== null || e.score === null || !within(dayOf(e.createdAt))) continue;
    const cur = firstLast.get(e.albumMbid);
    if (!cur) firstLast.set(e.albumMbid, { first: e.score, last: e.score, album: lite(album(e.albumMbid)) });
    else cur.last = e.score;
  }
  const changeOfHeart = [...firstLast.values()]
    .filter((x) => x.first !== x.last)
    .sort((a, b) => Math.abs(b.last - b.first) - Math.abs(a.last - a.first))[0];

  // ── Listening ──────────────────────────────────────────────────────────────
  const perMonth = Array.from({ length: 12 }, (_, m) => listens.filter((l) => Number(l.day.slice(5, 7)) === m + 1).length);
  const minutes = Math.round(
    listens.reduce((sum, l) => sum + album(l.albumMbid).tracks.reduce((s, t) => s + (t.lengthMs ?? 0), 0), 0) / 60000,
  );
  const lowest = [...scored].sort((a, b) => a.score - b.score)[0];

  return {
    counts: {
      albums: scored.length,
      tracks: trackScored.length,
      skipped: trackRatings.filter((t) => t.flag === "skip").length,
      listens: listens.length,
      relistens: listens.filter((l) => l.relisten).length,
      uniqueAlbumsListened: listenedIds.size,
      minutes,
    },
    avgAlbum: average(scored.map((r) => r.score)),
    avgTrack: average(trackScored.map((t) => t.score)),
    histogram,
    genres: [...genres].sort((a, b) => b.count - a.count || b.avg - a.avg).slice(0, 10),
    favoriteGenre: [...genres].filter((g) => g.count >= 2).sort((a, b) => b.avg - a.avg)[0] ?? null,
    decades,
    favoriteDecade: [...decades].filter((d) => d.count >= 2).sort((a, b) => b.avg - a.avg)[0] ?? null,
    artists: artists.slice(0, 10),
    topAlbums: [...scored].sort((a, b) => b.score - a.score).slice(0, 5).map((r) => ({ album: lite(r.album), score: r.score })),
    bottomAlbum: lowest ? { album: lite(lowest.album), score: lowest.score } : null,
    topTracks: [...trackScored]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((t) => pick(t)!),
    facts: {
      bestSongOnWorstAlbum:
        worstAlbum && worstAlbum !== bestAlbum ? { albumScore: worstAlbum.score, track: pick(top(worstAlbum.tracks)) } : null,
      worstSongOnBestAlbum:
        bestAlbum && worstAlbum !== bestAlbum ? { albumScore: bestAlbum.score, track: pick(bottom(bestAlbum.tracks)) } : null,
      moreThanSum: most && most.score - most.trackAvg >= 3 ? { album: most.album, score: most.score, trackAvg: most.trackAvg } : null,
      lessThanSum: least && least.score - least.trackAvg <= -3 ? { album: least.album, score: least.score, trackAvg: least.trackAvg } : null,
      mostConsistent: bySpread[0] ? { album: bySpread[0].album, spread: bySpread[0].spread! } : null,
      mostDivisive: bySpread.length > 1 ? { album: bySpread[bySpread.length - 1].album, spread: bySpread[bySpread.length - 1].spread! } : null,
      changeOfHeart: changeOfHeart ?? null,
    },
    perMonth,
  };
}

export type Stats = ReturnType<typeof computeStats>;

// A one-line "critic personality", based on how your average compares with
// the middle of the scale.
export function criticType(avg: number | null) {
  if (avg === null) return null;
  if (avg >= 80) return { name: "The Enthusiast", line: "You mostly rate what you already love. Nothing wrong with that." };
  if (avg >= 68) return { name: "The Generous Critic", line: "You lean positive but you do use the whole scale." };
  if (avg >= 55) return { name: "The Straight Shooter", line: "Your scores sit right where a fair critic's should." };
  return { name: "The Tough Room", line: "Earning a green score from you actually means something." };
}
