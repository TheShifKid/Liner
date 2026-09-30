"use client";

import { catalog } from "./catalog";
import { criticScore, parseRatingBoxes } from "./critic-scores.mjs";

// The critic score on an album page, fetched live for any album.
//
//   1. Wikidata: which English Wikipedia article is about this MusicBrainz
//      album? (one SPARQL query; property P436 = MusicBrainz release group)
//   2. Wikipedia: that article's wikitext, whose "Professional ratings" box
//      lists the reviews (parsed in critic-scores.mjs).
//
// Both services send CORS headers, so the browser can ask them directly
// (Wikipedia needs "origin=*" in the URL for that). The answer is cached in
// the catalog database for 30 days; "no reviews" is cached too.

export type Critics = {
  score: number;
  reviews: { source: string; score: number }[];
  metacritic: number | null;
  wiki: string; // article title, for the "read the reviews" link
};

const FRESH_MS = 30 * 24 * 3600 * 1000;

export async function loadCritics(mbid: string): Promise<Critics | null> {
  const cachedAlbum = await catalog.albums.get(mbid);
  if (cachedAlbum?.criticsAt && Date.now() - cachedAlbum.criticsAt < FRESH_MS) return cachedAlbum.critics ?? null;

  const critics = await fetchCritics(mbid);
  if (cachedAlbum) await catalog.albums.update(mbid, { critics, criticsAt: Date.now() });
  return critics;
}

async function fetchCritics(mbid: string): Promise<Critics | null> {
  const sparql = `SELECT ?title WHERE {
    ?item wdt:P436 "${mbid}" .
    ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  } LIMIT 1`;
  const wd = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, {
    headers: { Accept: "application/sparql-results+json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!wd.ok) throw new Error("Wikidata is busy");
  const title: string | undefined = (await wd.json()).results.bindings[0]?.title?.value;
  if (!title) return null;

  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: title,
    redirects: "1",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const wp = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!wp.ok) throw new Error("Wikipedia is busy");
  const page = (await wp.json()).query?.pages?.[0];
  const text: string | undefined = page?.revisions?.[0]?.slots?.main?.content;
  if (!text) return null;

  const parsed = parseRatingBoxes(text);
  const score = criticScore(parsed);
  if (!score) return null;
  return { score: score.score, reviews: parsed.reviews, metacritic: parsed.metacritic, wiki: page.title };
}
