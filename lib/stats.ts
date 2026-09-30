import "server-only";
import { albumGenres } from "./catalog";
import { db } from "./db";
import { average } from "./score";

// All the numbers behind /stats and /wrapped, computed in plain TypeScript
// from a few queries. For one person's library (hundreds or low thousands of
// rows) this is faster to write and to read than clever SQL, and still takes
// milliseconds.

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

export async function computeStats(userId: string, range?: { from: Date; to: Date }) {
  // For Wrapped, "this year" means albums you *listened to or rated* this year.
  const inRange = range ? { gte: range.from, lt: range.to } : undefined;
  const listens = await db.listen.findMany({
    where: { userId, ...(inRange ? { listenedOn: inRange } : {}) },
    include: { album: { include: { tracks: true } } },
    orderBy: { listenedOn: "asc" },
  });
  const listenedIds = new Set(listens.map((l) => l.albumMbid));

  const albumRatings = await db.albumRating.findMany({
    where: {
      userId,
      score: { not: null },
      ...(range ? { OR: [{ updatedAt: inRange }, { albumMbid: { in: [...listenedIds] } }] } : {}),
    },
    include: { album: { include: { artist: true } } },
  });

  const albumIds = [...new Set([...albumRatings.map((r) => r.albumMbid), ...listenedIds])];
  const trackRatings = await db.trackRating.findMany({
    where: { userId, ...(range ? { track: { albumMbid: { in: albumIds } } } : {}) },
    include: { track: { include: { album: true } } },
  });

  const scored = albumRatings.map((r) => ({ ...r, score: r.score! }));
  const trackScored = trackRatings.filter((t) => t.score !== null).map((t) => ({ ...t, score: t.score! }));
  const lite = (a: AlbumLite): AlbumLite => ({ mbid: a.mbid, title: a.title, artistCredit: a.artistCredit, year: a.year });

  // ── Distribution: how many albums in each band of 10 ──────────────────────
  const histogram = Array.from({ length: 10 }, (_, i) => ({
    from: i * 10,
    to: i === 9 ? 100 : i * 10 + 9,
    count: scored.filter((r) => Math.min(9, Math.floor(r.score / 10)) === i).length,
  }));

  // ── Genres, decades, artists ───────────────────────────────────────────────
  const genres = groupScores(scored.map((r) => ({ keys: albumGenres(r.album).slice(0, 3), score: r.score })));
  const decades = groupScores(
    scored.filter((r) => r.album.year).map((r) => ({ keys: [`${Math.floor(r.album.year! / 10) * 10}s`], score: r.score })),
  ).sort((a, b) => a.key.localeCompare(b.key));
  const artists = groupScores(scored.map((r) => ({ keys: [r.album.artistCredit], score: r.score }))).sort(
    (a, b) => b.count - a.count || b.avg - a.avg,
  );

  // ── Per-album track analysis ───────────────────────────────────────────────
  const tracksByAlbum = new Map<string, typeof trackScored>();
  for (const t of trackScored) tracksByAlbum.set(t.track.albumMbid, [...(tracksByAlbum.get(t.track.albumMbid) ?? []), t]);

  const withTracks = scored
    .map((r) => {
      const ts = tracksByAlbum.get(r.albumMbid) ?? [];
      const scores = ts.map((t) => t.score);
      return {
        album: lite(r.album),
        score: r.score,
        tracks: ts,
        trackAvg: average(scores),
        spread: scores.length >= 4 ? stdDev(scores) : null,
      };
    })
    .filter((x) => x.tracks.length >= 3);

  const byScore = [...withTracks].sort((a, b) => a.score - b.score);
  const worstAlbum = byScore[0];
  const bestAlbum = byScore[byScore.length - 1];
  const topTrack = (xs: typeof trackScored) => [...xs].sort((a, b) => b.score - a.score)[0];
  const bottomTrack = (xs: typeof trackScored) => [...xs].sort((a, b) => a.score - b.score)[0];
  const pick = (t: (typeof trackScored)[number] | undefined): TrackPick | null =>
    t ? { title: t.track.title, score: t.score, album: lite(t.track.album) } : null;

  const byDelta = [...withTracks].sort((a, b) => b.score - b.trackAvg! - (a.score - a.trackAvg!));
  const bySpread = withTracks.filter((x) => x.spread !== null).sort((a, b) => a.spread! - b.spread!);

  // ── Biggest change of heart: first vs latest album score in the event log ──
  const events = await db.ratingEvent.findMany({
    where: { userId, trackId: null, score: { not: null }, ...(inRange ? { createdAt: inRange } : {}) },
    orderBy: { createdAt: "asc" },
    include: { album: true },
  });
  const firstLast = new Map<string, { first: number; last: number; album: AlbumLite }>();
  for (const e of events) {
    const cur = firstLast.get(e.albumMbid);
    if (!cur) firstLast.set(e.albumMbid, { first: e.score!, last: e.score!, album: lite(e.album) });
    else cur.last = e.score!;
  }
  const changeOfHeart = [...firstLast.values()]
    .filter((x) => x.first !== x.last)
    .sort((a, b) => Math.abs(b.last - b.first) - Math.abs(a.last - a.first))[0];

  // ── Listening ──────────────────────────────────────────────────────────────
  const perMonth = Array.from({ length: 12 }, (_, m) => listens.filter((l) => l.listenedOn.getUTCMonth() === m).length);
  const minutes = Math.round(
    listens.reduce((sum, l) => sum + l.album.tracks.reduce((s, t) => s + (t.lengthMs ?? 0), 0), 0) / 60000,
  );
  const listenCount = new Map<string, { n: number; album: AlbumLite }>();
  for (const l of listens) {
    const cur = listenCount.get(l.albumMbid);
    listenCount.set(l.albumMbid, { n: (cur?.n ?? 0) + 1, album: lite(l.album) });
  }
  const mostPlayed = [...listenCount.values()].sort((a, b) => b.n - a.n)[0];

  const lowest = [...scored].sort((a, b) => a.score - b.score)[0];
  const lovedTracks = trackRatings.filter((t) => t.flag === "love");
  const avgAlbum = average(scored.map((r) => r.score));

  return {
    counts: {
      albums: scored.length,
      tracks: trackScored.length,
      loved: lovedTracks.length,
      skipped: trackRatings.filter((t) => t.flag === "skip").length,
      listens: listens.length,
      relistens: listens.filter((l) => l.relisten).length,
      uniqueAlbumsListened: listenedIds.size,
      minutes,
    },
    avgAlbum,
    avgTrack: average(trackScored.map((t) => t.score)),
    histogram,
    genres: [...genres].sort((a, b) => b.count - a.count || b.avg - a.avg).slice(0, 10),
    favoriteGenre: [...genres].filter((g) => g.count >= 2).sort((a, b) => b.avg - a.avg)[0] ?? null,
    decades,
    favoriteDecade: [...decades].filter((d) => d.count >= 2).sort((a, b) => b.avg - a.avg)[0] ?? null,
    artists: artists.slice(0, 10),
    topAlbums: [...scored].sort((a, b) => b.score - a.score).slice(0, 5).map((r) => ({ album: lite(r.album), score: r.score })),
    bottomAlbum: lowest ? { album: lite(lowest.album), score: lowest.score } : null,
    topTracks: [...trackScored].sort((a, b) => b.score - a.score || Number(b.flag === "love") - Number(a.flag === "love")).slice(0, 5).map((t) => pick(t)!),
    facts: {
      bestSongOnWorstAlbum: worstAlbum && worstAlbum !== bestAlbum ? { albumScore: worstAlbum.score, track: pick(topTrack(worstAlbum.tracks)) } : null,
      worstSongOnBestAlbum: bestAlbum && worstAlbum !== bestAlbum ? { albumScore: bestAlbum.score, track: pick(bottomTrack(bestAlbum.tracks)) } : null,
      moreThanSum: byDelta[0] && byDelta[0].score - byDelta[0].trackAvg! >= 3 ? { album: byDelta[0].album, score: byDelta[0].score, trackAvg: byDelta[0].trackAvg! } : null,
      lessThanSum:
        byDelta.length && byDelta[byDelta.length - 1].score - byDelta[byDelta.length - 1].trackAvg! <= -3
          ? { album: byDelta[byDelta.length - 1].album, score: byDelta[byDelta.length - 1].score, trackAvg: byDelta[byDelta.length - 1].trackAvg! }
          : null,
      mostConsistent: bySpread[0] ? { album: bySpread[0].album, spread: bySpread[0].spread! } : null,
      mostDivisive: bySpread.length > 1 ? { album: bySpread[bySpread.length - 1].album, spread: bySpread[bySpread.length - 1].spread! } : null,
      changeOfHeart: changeOfHeart ?? null,
    },
    perMonth,
    mostPlayed: mostPlayed ?? null,
  };
}

export type Stats = Awaited<ReturnType<typeof computeStats>>;

// A one-line "critic personality", based on how your average compares with
// the middle of the scale.
export function criticType(avg: number | null) {
  if (avg === null) return null;
  if (avg >= 80) return { name: "The Enthusiast", line: "You mostly rate what you already love. Nothing wrong with that." };
  if (avg >= 68) return { name: "The Generous Critic", line: "You lean positive but you do use the whole scale." };
  if (avg >= 55) return { name: "The Straight Shooter", line: "Your scores sit right where a fair critic's should." };
  return { name: "The Tough Room", line: "Earning a green score from you actually means something." };
}
