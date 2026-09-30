import "server-only";
import { db } from "./db";

// Deezer's public API needs no key for catalog reads and returns a 30-second
// preview MP3 per track. We call it from the server only, because the API
// doesn't send CORS headers (browsers would block a direct call) and so our
// database can remember which Deezer IDs match which MusicBrainz tracks.
//
// Preview URLs are *signed* (they contain `exp=` and `hmac=`), meaning they
// stop working after a while. So we store Deezer track IDs permanently, but
// ask Deezer for a fresh preview URL each time someone presses play.

const API = "https://api.deezer.com";

type DzArtist = { id: number; name: string };
type DzAlbum = { id: number; title: string; artist: DzArtist; nb_tracks?: number; cover_xl?: string; cover_big?: string };
type DzTrack = {
  id: number;
  title: string;
  title_short?: string;
  preview?: string;
  track_position?: number;
  disk_number?: number;
  artist: DzArtist;
};

async function dz<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(API + path, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    // Deezer reports errors as HTTP 200 with an { error } body.
    return json?.error ? null : (json as T);
  } catch {
    return null;
  }
}

// "Normalization" for fuzzy matching: lowercase, strip accents, drop anything
// in brackets ("(Remastered 2009)"), punctuation and "the". Two titles match if
// their normalized forms are equal.
export function norm(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining accent marks
    .toLowerCase()
    .replace(/[([].*?[)\]]/g, " ")
    .replace(/\s-\s.*$/, " ") // "Song - 2011 Remaster"
    .replace(/&/g, "and")
    .replace(/\bthe\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export async function findDeezerAlbum(artist: string, title: string) {
  const q = encodeURIComponent(`artist:"${artist}" album:"${title}"`);
  let res = await dz<{ data: DzAlbum[] }>(`/search/album?q=${q}&limit=10`);
  if (!res?.data?.length) {
    res = await dz<{ data: DzAlbum[] }>(`/search/album?q=${encodeURIComponent(`${artist} ${title}`)}&limit=10`);
  }
  const candidates = res?.data ?? [];
  const nt = norm(title);
  const na = norm(artist.split(/ & | feat\. | x /i)[0]);
  return (
    candidates.find((a) => norm(a.title) === nt && norm(a.artist.name) === na) ??
    candidates.find((a) => norm(a.title) === nt) ??
    null
  );
}

// Match an album to Deezer once, and copy Deezer track IDs onto our tracks.
export async function linkAlbumToDeezer(albumMbid: string) {
  const album = await db.album.findUnique({
    where: { mbid: albumMbid },
    include: { tracks: { orderBy: { position: "asc" } } },
  });
  if (!album) return null;
  if (album.deezerCheckedAt) return album.deezerAlbumId;

  const found = await findDeezerAlbum(album.artistCredit, album.title);
  if (found) {
    const list = await dz<{ data: DzTrack[] }>(`/album/${found.id}/tracks?limit=300`);
    const dzTracks = list?.data ?? [];
    const byTitle = new Map(dzTracks.map((t) => [norm(t.title_short ?? t.title), t]));
    const sameLength = dzTracks.length === album.tracks.length;
    for (const [i, t] of album.tracks.entries()) {
      // Prefer a title match; if the tracklists are the same length, fall back
      // to "same position" (handles differently-spelled titles).
      const match = byTitle.get(norm(t.title)) ?? (sameLength ? dzTracks[i] : undefined);
      if (match) await db.track.update({ where: { id: t.id }, data: { deezerTrackId: String(match.id) } });
    }
  }
  await db.album.update({
    where: { mbid: albumMbid },
    data: { deezerAlbumId: found ? String(found.id) : null, deezerCheckedAt: new Date() },
  });
  return found ? String(found.id) : null;
}

export async function freshPreviewUrl(trackId: string) {
  const track = await db.track.findUnique({ where: { id: trackId }, include: { album: true } });
  if (!track) return null;

  if (!track.deezerTrackId && !track.album.deezerCheckedAt) {
    await linkAlbumToDeezer(track.albumMbid);
  }
  let dzId = (await db.track.findUnique({ where: { id: trackId } }))?.deezerTrackId;

  // Last resort: search the single track by artist + title.
  if (!dzId) {
    const q = encodeURIComponent(`artist:"${track.album.artistCredit}" track:"${track.title}"`);
    const res = await dz<{ data: DzTrack[] }>(`/search/track?q=${q}&limit=5`);
    const hit = res?.data?.find((t) => norm(t.title_short ?? t.title) === norm(track.title));
    if (hit) {
      dzId = String(hit.id);
      await db.track.update({ where: { id: trackId }, data: { deezerTrackId: dzId } });
    }
  }
  if (!dzId) return null;

  const fresh = await dz<DzTrack>(`/track/${dzId}`);
  return fresh?.preview || null;
}

export async function deezerCoverUrl(artist: string, title: string) {
  const found = await findDeezerAlbum(artist, title);
  return found?.cover_xl ?? found?.cover_big ?? null;
}
