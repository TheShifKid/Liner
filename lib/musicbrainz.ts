// Thin client for the MusicBrainz web service (https://musicbrainz.org/doc/MusicBrainz_API).
//
// It runs in the BROWSER: MusicBrainz sends "CORS" headers
// (Access-Control-Allow-Origin: *), which is the permission a website needs
// before a browser lets its JavaScript read another site's responses. That's
// what lets Liner be a plain static site on GitHub Pages with no server.
//
// House rules from their docs:
//   • About one request per second per IP, or requests start failing (503).
//     Since each visitor's browser makes its own calls from its own IP, every
//     visitor gets their own allowance.
//   • Identify the app. Normally that's a custom User-Agent header, but
//     browsers don't allow scripts to set it; for browser apps MusicBrainz
//     goes by the page's Origin instead (theshifkid.github.io).

const BASE = "https://musicbrainz.org/ws/2";
const MIN_GAP_MS = 1100; // 1 req/sec plus a little safety margin

// ── Rate limiter ────────────────────────────────────────────────────────────
// This is a "serial promise queue". Every request appends itself to the end of
// one shared promise chain, and each link waits until at least MIN_GAP_MS have
// passed since the previous request started. So no matter how many
// components ask at once, requests leave one by one, spaced out. It lives on
// globalThis so hot reloads in dev don't create a second, independent queue.
const g = globalThis as unknown as { mbQueue?: Promise<unknown>; mbLast?: number };

function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = (g.mbLast ?? 0) + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    g.mbLast = Date.now();
    return task();
  };
  const next = (g.mbQueue ?? Promise.resolve()).then(run, run);
  // Keep the chain alive even if this request fails.
  g.mbQueue = next.catch(() => undefined);
  return next;
}

async function mb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("fmt", "json");

  // Retry with "exponential backoff": if MusicBrainz says 503 (busy / we were
  // too fast), wait 1s, then 2s, then 4s before giving up.
  for (let attempt = 0; ; attempt++) {
    const res = await throttled(() =>
      fetch(url, {
        // Only "simple" headers, so the browser can send the request directly
        // without a CORS preflight (an extra OPTIONS round trip).
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store", // we do our own caching in IndexedDB
      }),
    );
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 503 || res.status === 429) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`MusicBrainz ${res.status} for ${url.pathname}`);
  }
}

// ── Response shapes (only the fields we use) ─────────────────────────────────

export type MbArtistCredit = {
  name: string;
  joinphrase?: string;
  artist: { id: string; name: string; "sort-name"?: string; disambiguation?: string };
};

export type MbReleaseGroup = {
  id: string;
  title: string;
  score?: number;
  count?: number; // number of releases in the group: a decent popularity signal
  "primary-type"?: string;
  "secondary-types"?: string[];
  "first-release-date"?: string;
  "artist-credit"?: MbArtistCredit[];
  genres?: { name: string; count: number }[];
  releases?: MbRelease[];
};

export type MbRelease = {
  id: string;
  title: string;
  status?: string;
  date?: string;
  country?: string;
  disambiguation?: string;
  relations?: { type: string; url?: { resource: string } }[];
  media?: {
    position: number;
    format?: string;
    "track-count"?: number;
    tracks?: {
      id: string;
      position: number;
      number: string;
      title: string;
      length: number | null;
      recording: { id: string; title: string; length?: number | null };
    }[];
  }[];
};

export type MbArtist = {
  id: string;
  name: string;
  score?: number;
  "sort-name"?: string;
  disambiguation?: string;
  country?: string;
  genres?: { name: string; count: number }[];
};

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function searchReleaseGroups(q: string, limit = 25) {
  // dismax=true switches MusicBrainz's search to a forgiving "type what you'd
  // type into Google" mode that matches across title AND artist, so
  // "radiohead ok computer" works without Lucene field syntax.
  const data = await mb<{ "release-groups": MbReleaseGroup[] }>("/release-group", {
    query: q,
    dismax: "true",
    limit: String(limit),
  });
  return data["release-groups"] ?? [];
}

export async function searchArtists(q: string, limit = 5) {
  const data = await mb<{ artists: MbArtist[] }>("/artist", {
    query: q,
    dismax: "true",
    limit: String(limit),
  });
  return data.artists ?? [];
}

export function lookupReleaseGroup(mbid: string) {
  return mb<MbReleaseGroup>(`/release-group/${mbid}`, { inc: "artist-credits+genres" });
}

// Every release (edition) in a group, with track counts and "url
// relationships": the links MusicBrainz editors attach to a release, which is
// where Spotify / Apple Music / YouTube Music album links live.
export async function browseReleases(releaseGroupMbid: string) {
  const data = await mb<{ releases: MbRelease[] }>("/release", {
    "release-group": releaseGroupMbid,
    inc: "url-rels+media",
    limit: "100",
  });
  return data.releases ?? [];
}

export function lookupRelease(mbid: string) {
  return mb<MbRelease>(`/release/${mbid}`, { inc: "recordings+media" });
}

export function lookupArtist(mbid: string) {
  return mb<MbArtist>(`/artist/${mbid}`, { inc: "genres" });
}

export async function browseArtistReleaseGroups(artistMbid: string) {
  // "Browse" (as opposed to "search") lists everything linked to an entity.
  const data = await mb<{ "release-groups": MbReleaseGroup[] }>("/release-group", {
    artist: artistMbid,
    type: "album|ep",
    inc: "artist-credits",
    limit: "100",
  });
  return data["release-groups"] ?? [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function creditString(credit: MbArtistCredit[] | undefined) {
  return (credit ?? []).map((c) => c.name + (c.joinphrase ?? "")).join("") || "Unknown artist";
}

// A release group can hold dozens of releases (every country, remaster and
// deluxe edition). For the tracklist we want "the original album", so we pick
// with a simple scoring heuristic: official > not, dated > undated, earlier >
// later, no "deluxe/remaster" note > has one, worldwide/US/UK > elsewhere.
const trackCount = (r: MbRelease) => (r.media ?? []).reduce((n, m) => n + (m["track-count"] ?? 0), 0);

// The most common track count among official releases: the "standard" edition
// length. Deluxe editions with 10 bonus tracks get outvoted by the many
// ordinary pressings. (Statisticians call the most common value the *mode*.)
export function modalTrackCount(releases: MbRelease[]) {
  const tally = new Map<number, number>();
  for (const r of releases) {
    if (r.status !== "Official") continue;
    const n = trackCount(r);
    if (n) tally.set(n, (tally.get(n) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
}

export function pickCanonicalRelease(releases: MbRelease[] = []): MbRelease | undefined {
  const regionRank = (c?: string) => (c === "XW" ? 0 : c === "US" ? 1 : c === "GB" ? 2 : 3);
  const standard = modalTrackCount(releases);
  return [...releases].sort((a, b) => {
    const off = Number(b.status === "Official") - Number(a.status === "Official");
    if (off) return off;
    const std = Number(trackCount(b) === standard) - Number(trackCount(a) === standard);
    if (std) return std;
    const dated = Number(!!b.date) - Number(!!a.date);
    if (dated) return dated;
    // Compare only year-month so a same-month worldwide release can win on region.
    const da = (a.date ?? "").slice(0, 7);
    const db = (b.date ?? "").slice(0, 7);
    if (da !== db) return da < db ? -1 : 1;
    const plain = Number(!b.disambiguation) - Number(!a.disambiguation);
    if (plain) return plain;
    return regionRank(a.country) - regionRank(b.country);
  })[0];
}

// Search re-ranking. MusicBrainz scores text similarity only, so an obscure
// single called "Ok Computer" ties with Radiohead's album. We add:
//   • a boost for how many releases the group has (log-scaled, so 40
//     editions isn't 40x better than one): a decent popularity proxy;
//   • a bump for full albums over singles, a dip for live/compilations;
//   • an "artist intent" bonus: if the words of the artist's name appear in
//     the query ("radiohead kid a"), the user told us who they mean, so the
//     real Radiohead album beats "Radiohead's Kid A: Re-imagined" by a
//     tribute act, whose *title* happens to contain every word.
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents: "Björk" → "bjork"
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

export function rankReleaseGroups(groups: MbReleaseGroup[], query = "") {
  const q = new Set(words(query));
  const typeBoost: Record<string, number> = { Album: 12, EP: 6, Single: -4 };
  const artistIntent = (g: MbReleaseGroup) => {
    const names = (g["artist-credit"] ?? []).map((c) => words(c.name));
    return names.some((n) => n.length > 0 && n.every((w) => q.has(w))) ? 30 : 0;
  };
  const weight = (g: MbReleaseGroup) =>
    (g.score ?? 0) +
    8 * Math.log2((g.count ?? 1) + 1) +
    (typeBoost[g["primary-type"] ?? ""] ?? 0) -
    ((g["secondary-types"]?.length ?? 0) > 0 ? 6 : 0) +
    artistIntent(g);
  return [...groups].sort((a, b) => weight(b) - weight(a));
}

export function sortedGenres(genres?: { name: string; count: number }[]) {
  return (genres ?? [])
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((x) => x.name);
}

// Pick exact streaming links out of all releases' URL relationships.
// Links on "standard" editions (same track count as the canonical release, no
// deluxe note) win, so Spotify opens the album you're rating and not the
// 23-track anniversary box set.
const SERVICES: [key: string, test: RegExp][] = [
  ["spotify", /^https:\/\/open\.spotify\.com\/album\//],
  ["apple", /^https:\/\/(music|itunes)\.apple\.com\/.*album\//],
  ["youtube", /^https:\/\/music\.youtube\.com\//],
  ["bandcamp", /^https:\/\/[^/]+\.bandcamp\.com\/album\//],
  ["tidal", /^https:\/\/(listen\.)?tidal\.com\/(browse\/)?album\//],
];

export function extractStreamLinks(releases: MbRelease[], canonical?: MbRelease) {
  const want = canonical ? trackCount(canonical) : modalTrackCount(releases);
  const rank = (r: MbRelease) => (trackCount(r) === want ? 2 : 0) + (r.disambiguation ? 0 : 1);
  const links: Record<string, string> = {};
  for (const r of [...releases].sort((a, b) => rank(b) - rank(a))) {
    for (const rel of r.relations ?? []) {
      const url = rel.url?.resource;
      if (!url) continue;
      for (const [key, test] of SERVICES) if (!links[key] && test.test(url)) links[key] = url;
    }
  }
  return links;
}
