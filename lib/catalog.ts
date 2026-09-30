import "server-only";
import { db } from "./db";
import * as MB from "./musicbrainz";

// The catalog layer is a "read-through cache": callers ask for data, we look
// in SQLite first, and only on a miss do we go to MusicBrainz, saving what
// comes back. Every miss makes the next visit instant.

const SEARCH_TTL_MS = 7 * 24 * 3600 * 1000;

const yearOf = (d?: string | null) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);

async function upsertArtistsFromCredit(credit?: MB.MbArtistCredit[]) {
  for (const c of credit ?? []) {
    await db.artist.upsert({
      where: { mbid: c.artist.id },
      create: {
        mbid: c.artist.id,
        name: c.artist.name,
        sortName: c.artist["sort-name"],
        disambiguation: c.artist.disambiguation || null,
      },
      update: {},
    });
  }
}

// Save the basic facts about a release group. Never touches tracks or user data.
async function upsertAlbumFromGroup(g: MB.MbReleaseGroup) {
  await upsertArtistsFromCredit(g["artist-credit"]);
  const base = {
    title: g.title,
    artistCredit: MB.creditString(g["artist-credit"]),
    primaryType: g["primary-type"] ?? null,
    secondaryTypes: g["secondary-types"]?.length ? JSON.stringify(g["secondary-types"]) : null,
    firstReleaseDate: g["first-release-date"] || null,
    year: yearOf(g["first-release-date"]),
    artistMbid: g["artist-credit"]?.[0]?.artist.id ?? null,
  };
  const genres = MB.sortedGenres(g.genres);
  await db.album.upsert({
    where: { mbid: g.id },
    create: { mbid: g.id, ...base, genres: genres.length ? JSON.stringify(genres) : null },
    // Search results carry no genres, so only overwrite genres when we have some.
    update: { ...base, ...(genres.length ? { genres: JSON.stringify(genres) } : {}) },
  });
}

export const normalizeQuery = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

export async function searchCatalog(rawQuery: string) {
  const query = normalizeQuery(rawQuery);
  if (!query) return { albums: [], artists: [], cached: true };

  const hit = await db.searchCache.findUnique({ where: { query } });
  let albumIds: string[];
  let artistIds: string[];
  let cached = false;

  if (hit && Date.now() - hit.fetchedAt.getTime() < SEARCH_TTL_MS) {
    albumIds = JSON.parse(hit.albumMbids);
    artistIds = JSON.parse(hit.artistMbids);
    cached = true;
  } else {
    const [groups, artists] = [await MB.searchReleaseGroups(query), await MB.searchArtists(query)];
    const ranked = MB.rankReleaseGroups(groups, query);
    for (const g of ranked) await upsertAlbumFromGroup(g);
    // Only surface artists that are a strong match, otherwise "blonde" would
    // list five random artists with "blonde" in their name above the album.
    const strongArtists = artists.filter((a) => (a.score ?? 0) >= 90).slice(0, 3);
    for (const a of strongArtists) {
      await db.artist.upsert({
        where: { mbid: a.id },
        create: {
          mbid: a.id,
          name: a.name,
          sortName: a["sort-name"],
          disambiguation: a.disambiguation || null,
          country: a.country ?? null,
        },
        update: { country: a.country ?? undefined },
      });
    }
    albumIds = ranked.map((g) => g.id);
    artistIds = strongArtists.map((a) => a.id);
    await db.searchCache.upsert({
      where: { query },
      create: { query, albumMbids: JSON.stringify(albumIds), artistMbids: JSON.stringify(artistIds) },
      update: {
        albumMbids: JSON.stringify(albumIds),
        artistMbids: JSON.stringify(artistIds),
        fetchedAt: new Date(),
      },
    });
  }

  const [albums, artists] = await Promise.all([
    db.album.findMany({ where: { mbid: { in: albumIds } } }),
    db.artist.findMany({ where: { mbid: { in: artistIds } } }),
  ]);
  // findMany with `in` doesn't keep our ranking order, so restore it.
  const order = new Map(albumIds.map((id, i) => [id, i]));
  albums.sort((a, b) => order.get(a.mbid)! - order.get(b.mbid)!);
  return { albums, artists, cached };
}

// "In-flight de-duplication": if two requests want the same uncached album at
// the same moment, the second one waits on the first one's promise instead of
// firing its own MusicBrainz calls (and inserting the tracklist twice).
const g = globalThis as unknown as { albumInflight?: Map<string, Promise<void>> };
const inflight = (g.albumInflight ??= new Map());

// Make sure an album and its tracklist are in the local DB, fetching from
// MusicBrainz only the first time. Returns the album with tracks.
export async function ensureAlbum(mbid: string) {
  const album = await db.album.findUnique({ where: { mbid } });
  // Albums cached before streaming links existed get just the links topped up.
  if (album?.tracksFetchedAt && album.streamLinks === null) {
    const releases = await MB.browseReleases(mbid).catch(() => null);
    if (releases) {
      const canonical = releases.find((r) => r.id === album.releaseMbid);
      await db.album.update({
        where: { mbid },
        data: { streamLinks: JSON.stringify(MB.extractStreamLinks(releases, canonical)) },
      });
    }
  }
  if (!album?.tracksFetchedAt) {
    let job = inflight.get(mbid);
    if (!job) {
      job = fetchAlbumFromMusicBrainz(mbid).finally(() => inflight.delete(mbid));
      inflight.set(mbid, job);
    }
    await job;
  }
  return db.album.findUniqueOrThrow({
    where: { mbid },
    include: { tracks: { orderBy: { position: "asc" } }, artist: true },
  });
}

async function fetchAlbumFromMusicBrainz(mbid: string) {
  const group = await MB.lookupReleaseGroup(mbid);
  await upsertAlbumFromGroup(group);
  const releases = await MB.browseReleases(mbid);
  const release = MB.pickCanonicalRelease(releases);
  const full = release ? await MB.lookupRelease(release.id) : undefined;

  let pos = 0;
  const tracks = (full?.media ?? []).flatMap((m) =>
    (m.tracks ?? []).map((t) => ({
      albumMbid: mbid,
      recordingMbid: t.recording.id,
      title: t.title,
      position: ++pos,
      disc: m.position,
      number: t.number,
      lengthMs: t.length ?? t.recording.length ?? null,
    })),
  );

  // A "transaction": either all of these writes happen or none do, so a
  // crash halfway can't leave an album with half a tracklist.
  await db.$transaction([
    db.track.deleteMany({ where: { albumMbid: mbid } }),
    db.track.createMany({ data: tracks }),
    db.album.update({
      where: { mbid },
      data: {
        releaseMbid: release?.id ?? null,
        tracksFetchedAt: new Date(),
        streamLinks: JSON.stringify(MB.extractStreamLinks(releases, release)),
      },
    }),
  ]);

  // Genre fallback: many albums have no genre votes, but their artist does.
  const album = await db.album.findUnique({ where: { mbid } });
  if (album && !album.genres && album.artistMbid) {
    const artist = await db.artist.findUnique({ where: { mbid: album.artistMbid } });
    if (artist && artist.genres === null) {
      const a = await MB.lookupArtist(artist.mbid).catch(() => null);
      const genres = MB.sortedGenres(a?.genres);
      await db.artist.update({
        where: { mbid: artist.mbid },
        data: { genres: JSON.stringify(genres), country: a?.country ?? artist.country },
      });
    }
  }
}

export async function ensureDiscography(artistMbid: string) {
  const artist = await db.artist.findUnique({ where: { mbid: artistMbid } });
  const fresh =
    artist?.discographyFetchedAt && Date.now() - artist.discographyFetchedAt.getTime() < SEARCH_TTL_MS;
  if (!fresh) {
    if (!artist || artist.genres === null) {
      const a = await MB.lookupArtist(artistMbid);
      await db.artist.upsert({
        where: { mbid: artistMbid },
        create: {
          mbid: a.id,
          name: a.name,
          sortName: a["sort-name"],
          disambiguation: a.disambiguation || null,
          country: a.country ?? null,
          genres: JSON.stringify(MB.sortedGenres(a.genres)),
        },
        update: { country: a.country ?? null, genres: JSON.stringify(MB.sortedGenres(a.genres)) },
      });
    }
    const groups = await MB.browseArtistReleaseGroups(artistMbid);
    for (const g of groups) await upsertAlbumFromGroup(g);
    await db.artist.update({ where: { mbid: artistMbid }, data: { discographyFetchedAt: new Date() } });
  }
  return db.artist.findUniqueOrThrow({
    where: { mbid: artistMbid },
    include: { albums: { orderBy: [{ year: "asc" }, { title: "asc" }] } },
  });
}

// Genres for an album, falling back to its artist's.
export function albumGenres(album: { genres: string | null; artist?: { genres: string | null } | null }) {
  const own: string[] = album.genres ? JSON.parse(album.genres) : [];
  if (own.length) return own;
  return album.artist?.genres ? (JSON.parse(album.artist.genres) as string[]) : [];
}
