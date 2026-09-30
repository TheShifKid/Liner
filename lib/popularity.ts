"use client";

import { catalog, type CatAlbum } from "./catalog";

// Popularity from ListenBrainz (listenbrainz.org), MusicBrainz's sister
// project that records what its users actually play. For any album it knows
// how many distinct people listened ("listeners") and how many plays.
//
// Spotify used to offer a popularity number too, but since February 2026 it
// no longer gives it to apps like this one, so ListenBrainz is the source.
// It uses the same album IDs as MusicBrainz, sends CORS headers (so the
// browser may call it), and one request covers a whole page of results.

const API = "https://api.listenbrainz.org/1/popularity/release-group";
const FRESH_MS = 30 * 24 * 3600 * 1000;

// Below this many listeners an album is "almost nobody streams it": fan
// tributes, obscure reissues. Search hides these behind "show all", together
// with bootlegs (MusicBrainz knows no official release of them, so they
// won't be on Spotify or any streaming service).
export const OBSCURE_BELOW = 3;

export const isObscure = (a: { listeners?: number; official?: boolean }) =>
  a.official === false || (a.listeners ?? 0) < OBSCURE_BELOW;

// Fill in listeners/plays for these albums, asking ListenBrainz only about
// the ones we haven't checked in the last 30 days. Failures are non-fatal:
// the page still works, just without popularity.
export async function withPopularity(albums: CatAlbum[]): Promise<CatAlbum[]> {
  const stale = albums.filter((a) => !a.popularityAt || Date.now() - a.popularityAt > FRESH_MS);
  if (stale.length) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ release_group_mbids: stale.map((a) => a.mbid) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const rows: { release_group_mbid: string; total_user_count: number | null; total_listen_count: number | null }[] =
          await res.json();
        const byId = new Map(rows.map((r) => [r.release_group_mbid, r]));
        const now = Date.now();
        for (const a of stale) {
          const r = byId.get(a.mbid);
          a.listeners = r?.total_user_count ?? 0;
          a.plays = r?.total_listen_count ?? 0;
          a.popularityAt = now;
        }
        await catalog.albums.bulkPut(stale);
      }
    } catch {
      /* offline or ListenBrainz down: carry on without popularity */
    }
  }
  return albums;
}

// "17.6K listeners"
export function formatListeners(n: number | undefined) {
  if (n === undefined) return "";
  const s = n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n);
  return `${s.replace(/\.0(?=[KM])/, "")} listener${n === 1 ? "" : "s"}`;
}
