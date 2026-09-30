import "server-only";

// Thin client for the MusicBrainz web service (https://musicbrainz.org/doc/MusicBrainz_API).
// Two house rules from their docs, both enforced here:
//   • A meaningful User-Agent with a way to contact us, or we get throttled.
//   • About one request per second per IP, or every request gets a 503.

const BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT =
  process.env.MB_USER_AGENT ?? "Liner/0.1 ( personal album-rating app; https://github.com/TheShifKid )";
const MIN_GAP_MS = 1100; // 1 req/sec plus a little safety margin

// ── Rate limiter ────────────────────────────────────────────────────────────
// This is a "serial promise queue". Every request appends itself to the end of
// one shared promise chain, and each link waits until at least MIN_GAP_MS have
// passed since the previous request started. So no matter how many pages ask
// at once, requests leave one by one, spaced out. It lives on globalThis so
// hot reloads in dev don't create a second, independent queue.
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
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store", // we do our own caching in SQLite
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
  media?: {
    position: number;
    format?: string;
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
  return mb<MbReleaseGroup>(`/release-group/${mbid}`, {
    inc: "artist-credits+genres+releases",
  });
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
export function pickCanonicalRelease(releases: MbRelease[] = []): MbRelease | undefined {
  const regionRank = (c?: string) => (c === "XW" ? 0 : c === "US" ? 1 : c === "GB" ? 2 : 3);
  return [...releases].sort((a, b) => {
    const off = Number(b.status === "Official") - Number(a.status === "Official");
    if (off) return off;
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
// single called "Ok Computer" ties with Radiohead's album. We add a boost for
// how many releases the group has (log-scaled, so 40 editions isn't 40× better
// than one) and a bump for full albums over singles.
export function rankReleaseGroups(groups: MbReleaseGroup[]) {
  const typeBoost: Record<string, number> = { Album: 12, EP: 6, Single: -4 };
  const weight = (g: MbReleaseGroup) =>
    (g.score ?? 0) +
    8 * Math.log2((g.count ?? 1) + 1) +
    (typeBoost[g["primary-type"] ?? ""] ?? 0) -
    ((g["secondary-types"]?.length ?? 0) > 0 ? 6 : 0);
  return [...groups].sort((a, b) => weight(b) - weight(a));
}

export function sortedGenres(genres?: { name: string; count: number }[]) {
  return (genres ?? [])
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((x) => x.name);
}
