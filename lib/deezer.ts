import "server-only";

// Deezer is used for one thing only: a fallback cover image when the Cover
// Art Archive has none. Its public search API needs no key. We call it from
// the server because it doesn't send CORS headers (a browser call would be
// blocked).

const API = "https://api.deezer.com";

type DzAlbum = { id: number; title: string; artist: { name: string }; cover_xl?: string; cover_big?: string };

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
    .replace(/&/g, "and")
    .replace(/\bthe\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export async function deezerCoverUrl(artist: string, title: string) {
  const q = encodeURIComponent(`artist:"${artist}" album:"${title}"`);
  const res = await dz<{ data: DzAlbum[] }>(`/search/album?q=${q}&limit=10`);
  const nt = norm(title);
  const na = norm(artist.split(/ & | feat\. /i)[0]);
  const hit =
    res?.data?.find((a) => norm(a.title) === nt && norm(a.artist.name) === na) ??
    res?.data?.find((a) => norm(a.title) === nt);
  return hit?.cover_xl ?? hit?.cover_big ?? null;
}
