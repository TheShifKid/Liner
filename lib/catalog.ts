"use client";

import Dexie, { type EntityTable } from "dexie";
import * as MB from "./musicbrainz";

// The music catalog, cached in the browser.
//
// This is a "read-through cache": callers ask for data, we look in IndexedDB
// first, and only on a miss do we go to MusicBrainz, saving what comes back.
// Every miss makes the next visit instant, even offline.
//
// It is a SEPARATE database from your personal data (lib/local/db.ts): this
// one is just a copy of public MusicBrainz data, safe to throw away at any
// time, and it's deliberately left out of backups.

export type CatTrack = {
  position: number; // 1-based, running across discs
  disc: number;
  number: string | null; // as printed on the sleeve: "A1", "3"...
  title: string;
  lengthMs: number | null;
};

// An "album" here is a MusicBrainz *release group*: the abstract album
// ("OK Computer") as opposed to one pressing (the 1997 UK CD, the 2017
// remaster...). People rate release groups, not pressings.
export type CatAlbum = {
  mbid: string;
  title: string;
  artistCredit: string;
  artistMbid: string | null;
  primaryType: string | null;
  secondaryTypes: string[];
  firstReleaseDate: string | null;
  year: number | null;
  genres: string[];
  // Filled the first time the album page is opened:
  tracks?: CatTrack[];
  releaseMbid?: string | null; // the edition the tracklist came from
  streamLinks?: Record<string, string>; // exact Spotify/Apple/... album links
};

export type CatArtist = {
  mbid: string;
  name: string;
  disambiguation: string | null;
  country: string | null;
  genres?: string[]; // undefined = not looked up yet
  discography?: string[]; // album mbids
  discographyFetchedAt?: number;
};

type Search = { query: string; albumMbids: string[]; artistMbids: string[]; fetchedAt: number };

export const catalog = new Dexie("liner-catalog") as Dexie & {
  albums: EntityTable<CatAlbum, "mbid">;
  artists: EntityTable<CatArtist, "mbid">;
  searches: EntityTable<Search, "query">;
};
catalog.version(1).stores({ albums: "mbid, artistMbid", artists: "mbid", searches: "query" });

const TTL_MS = 7 * 24 * 3600 * 1000; // searches & discographies refresh weekly
const yearOf = (d?: string | null) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null);

async function upsertArtistsFromCredit(credit?: MB.MbArtistCredit[]) {
  for (const c of credit ?? []) {
    if (!(await catalog.artists.get(c.artist.id))) {
      await catalog.artists.put({
        mbid: c.artist.id,
        name: c.artist.name,
        disambiguation: c.artist.disambiguation || null,
        country: null,
      });
    }
  }
}

// Save the basic facts about a release group, merging into what we already
// have (never dropping a fetched tracklist).
async function upsertAlbumFromGroup(g: MB.MbReleaseGroup) {
  await upsertArtistsFromCredit(g["artist-credit"]);
  const prev = await catalog.albums.get(g.id);
  const genres = MB.sortedGenres(g.genres);
  await catalog.albums.put({
    ...prev,
    mbid: g.id,
    title: g.title,
    artistCredit: MB.creditString(g["artist-credit"]),
    artistMbid: g["artist-credit"]?.[0]?.artist.id ?? null,
    primaryType: g["primary-type"] ?? null,
    secondaryTypes: g["secondary-types"] ?? [],
    firstReleaseDate: g["first-release-date"] || null,
    year: yearOf(g["first-release-date"]),
    // Search results carry no genres, so keep any we already had.
    genres: genres.length ? genres : (prev?.genres ?? []),
  });
}

export const normalizeQuery = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ");

export async function searchCatalog(rawQuery: string) {
  const query = normalizeQuery(rawQuery);
  if (!query) return { albums: [] as CatAlbum[], artists: [] as CatArtist[], cached: true };

  const hit = await catalog.searches.get(query);
  let albumIds: string[];
  let artistIds: string[];
  let cached = false;

  if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
    ({ albumMbids: albumIds, artistMbids: artistIds } = hit);
    cached = true;
  } else {
    const groups = await MB.searchReleaseGroups(query);
    const artists = await MB.searchArtists(query);
    const ranked = MB.rankReleaseGroups(groups, query);
    for (const g of ranked) await upsertAlbumFromGroup(g);
    // Only surface artists that are a strong match, otherwise "blonde" would
    // list five random artists with "blonde" in their name above the album.
    const strong = artists.filter((a) => (a.score ?? 0) >= 90).slice(0, 3);
    for (const a of strong) {
      const prev = await catalog.artists.get(a.id);
      await catalog.artists.put({
        ...prev,
        mbid: a.id,
        name: a.name,
        disambiguation: a.disambiguation || null,
        country: a.country ?? prev?.country ?? null,
      });
    }
    albumIds = ranked.map((g) => g.id);
    artistIds = strong.map((a) => a.id);
    await catalog.searches.put({ query, albumMbids: albumIds, artistMbids: artistIds, fetchedAt: Date.now() });
  }

  // bulkGet returns rows in the order of the ids we pass, so our ranking holds.
  const [albums, artists] = await Promise.all([catalog.albums.bulkGet(albumIds), catalog.artists.bulkGet(artistIds)]);
  return {
    albums: albums.filter((a): a is CatAlbum => !!a),
    artists: artists.filter((a): a is CatArtist => !!a),
    cached,
  };
}

// "In-flight de-duplication": if two components want the same uncached album
// at the same moment, the second waits on the first one's promise instead of
// firing its own MusicBrainz calls.
const inflight = new Map<string, Promise<void>>();

// Make sure an album and its tracklist are cached, fetching from MusicBrainz
// only the first time.
export async function ensureAlbum(mbid: string): Promise<CatAlbum & { tracks: CatTrack[] }> {
  const cached = await catalog.albums.get(mbid);
  if (!cached?.tracks) {
    let job = inflight.get(mbid);
    if (!job) {
      job = fetchAlbum(mbid).finally(() => inflight.delete(mbid));
      inflight.set(mbid, job);
    }
    await job;
  }
  const album = (await catalog.albums.get(mbid))!;
  return { ...album, tracks: album.tracks ?? [] };
}

async function fetchAlbum(mbid: string) {
  const group = await MB.lookupReleaseGroup(mbid);
  await upsertAlbumFromGroup(group);
  const releases = await MB.browseReleases(mbid);
  const release = MB.pickCanonicalRelease(releases);
  const full = release ? await MB.lookupRelease(release.id) : undefined;

  let pos = 0;
  const tracks: CatTrack[] = (full?.media ?? []).flatMap((m) =>
    (m.tracks ?? []).map((t) => ({
      position: ++pos,
      disc: m.position,
      number: t.number,
      title: t.title,
      lengthMs: t.length ?? t.recording.length ?? null,
    })),
  );

  const album = (await catalog.albums.get(mbid))!;
  // Genre fallback: many albums have no genre votes, but their artist does.
  let genres = album.genres;
  if (!genres.length && album.artistMbid) genres = await artistGenres(album.artistMbid);

  await catalog.albums.put({
    ...album,
    genres,
    tracks,
    releaseMbid: release?.id ?? null,
    streamLinks: MB.extractStreamLinks(releases, release),
  });
}

async function artistGenres(artistMbid: string) {
  const artist = await catalog.artists.get(artistMbid);
  if (artist?.genres) return artist.genres;
  const a = await MB.lookupArtist(artistMbid).catch(() => null);
  const genres = MB.sortedGenres(a?.genres);
  await catalog.artists.put({
    mbid: artistMbid,
    name: a?.name ?? artist?.name ?? "",
    disambiguation: a?.disambiguation || artist?.disambiguation || null,
    ...artist,
    country: a?.country ?? artist?.country ?? null,
    genres,
  });
  return genres;
}

export async function ensureDiscography(artistMbid: string) {
  let artist = await catalog.artists.get(artistMbid);
  const fresh = artist?.discographyFetchedAt && Date.now() - artist.discographyFetchedAt < TTL_MS;
  if (!fresh) {
    if (!artist?.genres) {
      const a = await MB.lookupArtist(artistMbid);
      artist = {
        ...artist,
        mbid: a.id,
        name: a.name,
        disambiguation: a.disambiguation || null,
        country: a.country ?? null,
        genres: MB.sortedGenres(a.genres),
      };
    }
    const groups = await MB.browseArtistReleaseGroups(artistMbid);
    for (const g of groups) await upsertAlbumFromGroup(g);
    artist = { ...artist!, discography: groups.map((g) => g.id), discographyFetchedAt: Date.now() };
    await catalog.artists.put(artist);
  }
  const albums = (await catalog.albums.bulkGet(artist!.discography ?? [])).filter((a): a is CatAlbum => !!a);
  albums.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
  return { artist: artist!, albums };
}
