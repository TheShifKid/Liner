// Builds Liner's charts: "best of" lists ranked by what critics said, plus a
// couple ranked by how many people listen.
//
//   node scripts/build-charts.mjs          (takes 10–20 minutes)
//
// Output: public/charts/index.json + one JSON file per chart. They're plain
// static files, so the site loads a chart instantly with no API calls.
//
// Where the data comes from:
//   • ListenBrainz (listenbrainz.org, MusicBrainz's sister project) collects
//     what its users actually play: listeners and plays per album, plus genre
//     tags. Its sitewide top lists give us most of the candidate albums.
//   • MusicBrainz supplies more candidates (genre searches, Hebrew albums),
//     plus album types and release dates.
//   • Wikidata connects a MusicBrainz album ID to its Wikipedia article, and
//     Wikipedia's "Professional ratings" box gives the critic reviews
//     (Metacritic, AllMusic, Pitchfork, Rolling Stone…). lib/critic-scores.mjs
//     turns those into one 0–100 score.
//
// The pipeline is a classic "gather → enrich → rank" batch job:
//   1. GATHER candidate albums from several sources into one pool.
//   2. ENRICH each with popularity, genres, critic score, type and year.
//   3. RANK: filter each chart's members and sort.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { criticScore, parseRatingBoxes } from "../lib/critic-scores.mjs";

const UA = "Liner/0.1 ( https://github.com/TheShifKid/Liner )";
const LB = "https://api.listenbrainz.org/1";
const MB = "https://musicbrainz.org/ws/2";
const WIKIDATA = "https://query.wikidata.org/sparql";
const WIKIPEDIA = "https://en.wikipedia.org/w/api.php";
const OUT = "public/charts";
const MIN_LISTENERS = 25; // below this, a chart entry is noise

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ── Polite HTTP ──────────────────────────────────────────────────────────────

// A tiny disk cache ("memoization" of requests): each answer is saved under a
// hash of its URL/body for a few days, so re-running the script after a crash
// or a tweak doesn't repeat thousands of requests. The folder is git-ignored.
const CACHE = ".chart-cache";
const TTL = 3 * 24 * 3600 * 1000;
const cacheFile = (key) => `${CACHE}/${createHash("sha1").update(key).digest("hex")}.json`;
function cached(key) {
  const f = cacheFile(key);
  if (existsSync(f) && Date.now() - statSync(f).mtimeMs < TTL) return JSON.parse(readFileSync(f, "utf8"));
  return undefined;
}
function remember(key, value) {
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cacheFile(key), JSON.stringify(value));
  return value;
}

let mbLast = 0;
async function mb(path, params) {
  const url = new URL(MB + path);
  for (const [k, v] of Object.entries({ ...params, fmt: "json" })) url.searchParams.set(k, v);
  const hit = cached(url.href);
  if (hit !== undefined) return hit;
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = mbLast + 1100 - Date.now(); // MusicBrainz: ~1 request/second
    if (wait > 0) await sleep(wait);
    mbLast = Date.now();
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.ok) return remember(url.href, await res.json());
    if (res.status === 503 || res.status === 429) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    throw new Error(`MusicBrainz ${res.status} ${url}`);
  }
  throw new Error(`MusicBrainz kept refusing ${url}`);
}

// ListenBrainz tells us its limits in response headers (X-RateLimit-*); when
// we run out, we sleep until the window resets instead of hammering it.
async function lb(path, init) {
  const key = LB + path + (init?.body ?? "");
  const hit = cached(key);
  if (hit !== undefined) return hit;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(LB + path, { ...init, headers: { "User-Agent": UA, ...(init?.headers ?? {}) } });
    const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? 10);
    const resetIn = Number(res.headers.get("x-ratelimit-reset-in") ?? 1);
    if (res.status === 429) {
      await sleep((resetIn + 1) * 1000);
      continue;
    }
    if (!res.ok) {
      if (res.status >= 500) {
        await sleep(2000 * 2 ** attempt);
        continue;
      }
      throw new Error(`ListenBrainz ${res.status} ${path}`);
    }
    if (remaining <= 1) await sleep((resetIn + 1) * 1000);
    return remember(key, res.status === 204 ? null : await res.json());
  }
  throw new Error(`ListenBrainz kept failing ${path}`);
}

// Wikidata and Wikipedia: one request at a time with a short pause, backing
// off when they're busy. Wikipedia's "maxlag" parameter asks it to refuse us
// (rather than slow down for real readers) when its servers are lagging.
async function wiki(url, init) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(300);
    const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) } }).catch(() => null);
    if (res?.ok) {
      const j = await res.json().catch(() => null);
      if (j && !j.error) return j;
    }
    await sleep(3000 * 2 ** attempt);
  }
  throw new Error(`kept failing: ${String(url).slice(0, 120)}`);
}

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// ── Chart definitions ────────────────────────────────────────────────────────
// Each genre chart lists (a) regexes matched against an album's genres and
// (b) MusicBrainz tags to search for extra candidates.

const GENRES = [
  { id: "rock", name: "Rock", match: /\brock\b|grunge|shoegaze|britpop|post-punk/, tags: ["rock", "classic rock", "hard rock", "psychedelic rock", "folk rock", "progressive rock", "art rock"] },
  { id: "alternative", name: "Alternative & Indie", match: /alternative|indie|shoegaze|dream pop|post-punk|new wave|britpop|grunge|slowcore|math rock|post-rock|lo-fi/, tags: ["indie rock", "alternative rock", "indie pop", "post-punk", "shoegaze"] },
  { id: "pop", name: "Pop", match: /\bpop\b|synth-pop|synthpop|dance-pop|k-pop|j-pop/, tags: ["pop", "synth-pop", "dance-pop", "baroque pop", "art pop"] },
  { id: "hip-hop", name: "Hip-Hop", match: /hip hop|hip-hop|\brap\b|trap|drill|grime|boom bap|g-funk/, tags: ["hip hop", "rap", "trap", "conscious hip hop", "east coast hip hop"] },
  { id: "rnb", name: "R&B & Soul", match: /r&b|rhythm and blues|\bsoul\b|neo soul|motown/, tags: ["contemporary r&b", "soul", "neo soul", "motown", "southern soul"] },
  { id: "electronic", name: "Electronic", match: /electronic|electronica|house|techno|\bidm\b|edm|dubstep|drum and bass|trance|downtempo|trip hop|electro|synthwave|uk garage/, tags: ["electronic", "house", "techno", "idm"] },
  { id: "metal", name: "Metal", match: /metal|grindcore|djent/, tags: ["heavy metal", "thrash metal", "black metal", "death metal"] },
  { id: "punk", name: "Punk", match: /punk|hardcore|\bemo\b|post-hardcore/, tags: ["punk", "pop punk", "hardcore punk", "post-hardcore"] },
  { id: "jazz", name: "Jazz", match: /jazz|bebop|hard bop|swing|bossa nova/, tags: ["jazz", "hard bop", "cool jazz", "jazz fusion", "free jazz", "modal jazz", "spiritual jazz"] },
  { id: "folk", name: "Folk & Singer-Songwriter", match: /folk|singer-songwriter|singer\/songwriter/, tags: ["folk", "singer-songwriter", "indie folk"] },
  { id: "country", name: "Country & Americana", match: /country|bluegrass|americana/, tags: ["country", "americana", "alt-country"] },
  { id: "experimental", name: "Experimental", match: /experimental|avant-garde|\bnoise\b|free improvisation|musique concr/, tags: ["experimental", "avant-garde", "noise", "krautrock"] },
  { id: "ambient", name: "Ambient", match: /ambient|\bdrone\b|new age/, tags: ["ambient", "dark ambient", "drone", "new age", "ambient techno"] },
  { id: "latin", name: "Latin", match: /latin|reggaeton|salsa|bachata|cumbia|bossa nova|\bmpb\b|tropicália|samba|urbano/, tags: ["latin", "reggaeton", "latin pop", "salsa", "bossa nova", "mpb", "tropicália", "latin rock"] },
  { id: "funk", name: "Funk & Disco", match: /\bfunk\b|disco|boogie|p-funk/, tags: ["funk", "disco"] },
  { id: "blues", name: "Blues", match: /(?<!rhythm and )blues/, tags: ["blues", "blues rock", "chicago blues", "delta blues"] },
  { id: "reggae", name: "Reggae & Dub", match: /reggae|\bdub\b|\bska\b|dancehall|rocksteady/, tags: ["reggae", "dub", "ska", "roots reggae", "dancehall", "rocksteady"] },
];
const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
const HEBREW = /[֐-׿]/;

// ── 1. GATHER ────────────────────────────────────────────────────────────────

const pool = new Map(); // mbid → candidate
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const add = (mbid, extra = {}) => {
  if (UUID.test(mbid ?? "")) pool.set(mbid, { ...pool.get(mbid), mbid, ...extra });
};

async function gatherSitewide() {
  // The sitewide top list per time range stops at 1,000 albums, so we merge
  // several ranges: all-time classics plus what's big lately.
  for (const range of ["all_time", "year", "half_yearly", "quarter", "month", "this_year"]) {
    for (let offset = 0; offset < 1000; offset += 100) {
      const j = await lb(`/stats/sitewide/release-groups?range=${range}&count=100&offset=${offset}`);
      const rows = j?.payload?.release_groups ?? [];
      for (const r of rows) add(r.release_group_mbid, { title: r.release_group_name, artist: r.artist_name, artistMbid: r.artist_mbids?.[0] ?? null });
      if (rows.length < 100) break;
    }
    log(`sitewide ${range}: pool now ${pool.size}`);
  }
}

async function gatherGenreSearches() {
  // MusicBrainz ranks tag searches by how strongly the tag applies, and
  // well-known albums collect the most tag votes, so the first pages hold
  // the albums a genre chart needs.
  for (const g of GENRES) {
    for (const tag of g.tags) {
      for (let offset = 0; offset < 300; offset += 100) {
        const j = await mb("/release-group", { query: `tag:"${tag}" AND primarytype:album`, limit: "100", offset: String(offset) }).catch(() => null);
        if (!j) break; // MusicBrainz won't page this deep; move on
        for (const r of j["release-groups"] ?? []) addFromMbGroup(r);
      }
    }
    log(`genre searches ${g.id}: pool now ${pool.size}`);
  }
}

function addFromMbGroup(r) {
  const credit = r["artist-credit"] ?? [];
  add(r.id, {
    title: r.title,
    artist: credit.map((c) => c.name + (c.joinphrase ?? "")).join("") || undefined,
    artistMbid: credit[0]?.artist?.id ?? null,
    primaryType: r["primary-type"] ?? null,
    secondaryTypes: r["secondary-types"] ?? [],
    date: r["first-release-date"] || undefined,
    ...officialFrom(r),
  });
}

// Search results list each release's status. An album with no "Official"
// release (only bootlegs/promos) isn't on streaming services: never chart it.
const officialFrom = (r) => (r.releases?.length ? { official: r.releases.some((x) => x.status === "Official") } : {});

async function gatherHebrew() {
  // Hebrew albums rarely reach the global charts, so search for them
  // directly: releases whose track titles are in Hebrew, and albums by
  // artists from Israel.
  for (const query of ["lang:heb AND primarytype:album", "script:Hebr AND primarytype:album", "country:IL AND primarytype:album"]) {
    for (let offset = 0; offset < 1000; offset += 100) {
      const j = await mb("/release", { query, limit: "100", offset: String(offset) }).catch(() => null);
      if (!j) break; // MusicBrainz won't page this deep; move on
      const rows = j.releases ?? [];
      for (const r of rows) {
        const rg = r["release-group"];
        if (!rg?.id) continue;
        const credit = r["artist-credit"] ?? [];
        add(rg.id, {
          title: rg.title ?? r.title,
          artist: credit.map((c) => c.name + (c.joinphrase ?? "")).join("") || undefined,
          artistMbid: credit[0]?.artist?.id ?? null,
        });
      }
      if (rows.length < 100) break;
    }
    log(`hebrew "${query}": pool now ${pool.size}`);
  }
}

// ── 2. ENRICH ────────────────────────────────────────────────────────────────

async function enrichPopularity() {
  const ids = [...pool.keys()];
  let done = 0;
  for (const batch of chunks(ids, 200)) {
    const rows = await lb("/popularity/release-group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ release_group_mbids: batch }),
    });
    for (const r of rows ?? []) {
      const c = pool.get(r.release_group_mbid);
      if (c) Object.assign(c, { listeners: r.total_user_count ?? 0, plays: r.total_listen_count ?? 0 });
    }
    done += batch.length;
    if (done % 2000 < 200) log(`popularity ${done}/${ids.length}`);
  }
  // Drop what nobody listens to before the more expensive steps.
  for (const [id, c] of pool) if (!(c.listeners >= MIN_LISTENERS)) pool.delete(id);
  log(`with ≥${MIN_LISTENERS} listeners: ${pool.size}`);
}

async function enrichMetadata() {
  // Genres (tags that MusicBrainz recognizes as genres), type and date.
  const ids = [...pool.keys()];
  for (const batch of chunks(ids, 50)) {
    const j = await lb(`/metadata/release_group/?release_group_mbids=${batch.join(",")}&inc=tag`);
    for (const [id, v] of Object.entries(j ?? {})) {
      const c = pool.get(id);
      if (!c) continue;
      const rgTags = (v.tag?.release_group ?? []).filter((t) => t.genre_mbid).sort((a, b) => b.count - a.count);
      const artistTags = (v.tag?.artist ?? []).filter((t) => t.genre_mbid).sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
      c.genres = (rgTags.length ? rgTags : artistTags).slice(0, 5).map((t) => t.tag);
      c.title ??= v.release_group?.name;
      c.primaryType ??= v.release_group?.type ?? null;
      c.date ??= v.release_group?.date || undefined;
    }
  }
  log(`metadata done`);
}

// Critic scores, step one: ask Wikidata which of our albums have an English
// Wikipedia article (P436 is Wikidata's "MusicBrainz release group ID").
// SPARQL is Wikidata's query language; VALUES passes 250 IDs at once.
async function findArticles(ids) {
  const titles = new Map();
  for (const batch of chunks(ids, 250)) {
    const query = `SELECT ?rg ?title WHERE {
      VALUES ?rg { ${batch.map((id) => `"${id}"`).join(" ")} }
      ?item wdt:P436 ?rg .
      ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
    }`;
    const key = "wikidata:" + batch.join(",");
    let rows = cached(key);
    if (rows === undefined) {
      const j = await wiki(WIKIDATA, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" },
        body: new URLSearchParams({ query, format: "json" }).toString(),
      });
      rows = remember(key, j.results.bindings.map((b) => [b.rg.value, b.title.value]));
    }
    // One album can be linked to more than one article; keep them all.
    for (const [rg, title] of rows) titles.set(rg, [...(titles.get(rg) ?? []), title]);
  }
  return titles;
}

// Step two: read those articles' wikitext, 20 at a time, and parse the
// rating boxes. Only the parsed result is cached, not the whole articles.
async function enrichCritics() {
  const titles = await findArticles([...pool.keys()]);
  log(`${titles.size} albums have a Wikipedia article`);
  // Several MusicBrainz entries can share one article (an album and its
  // anniversary edition), so each title maps to a LIST of album IDs.
  const byTitle = new Map();
  for (const [id, ts] of titles) for (const t of ts) byTitle.set(t, [...(byTitle.get(t) ?? []), id]);
  let found = 0;
  let done = 0;
  for (const batch of chunks([...byTitle.keys()], 20)) {
    const key = "critics3:" + batch.join("|");
    let parsed = cached(key);
    if (parsed === undefined) {
      parsed = {};
      // Wikipedia caps how much text one answer may hold. When 20 long
      // articles don't fit, it sends the ones that did plus a "continue"
      // token; asking again with that token returns the next part.
      let cont = {};
      do {
        const url = new URL(WIKIPEDIA);
        const params = { action: "query", prop: "revisions", rvprop: "content", rvslots: "main", titles: batch.join("|"), redirects: "1", format: "json", formatversion: "2", maxlag: "5", ...cont };
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        const j = await wiki(url.href);
        // Wikipedia may answer under a different title (a redirect), and two
        // titles we asked for can land on the same article, so follow each
        // title we asked for to where it ended up.
        const hop = new Map([...(j.query?.normalized ?? []), ...(j.query?.redirects ?? [])].map((r) => [r.from, r.to]));
        const texts = new Map((j.query?.pages ?? []).map((p) => [p.title, p.revisions?.[0]?.slots?.main?.content]));
        for (const asked of batch) {
          let t = asked;
          for (let i = 0; i < 3 && hop.has(t); i++) t = hop.get(t);
          const text = texts.get(t);
          if (text) parsed[asked] = { wiki: t, ...parseRatingBoxes(text) };
        }
        cont = j.continue ?? null;
      } while (cont);
      remember(key, parsed);
    }
    for (const [title, p] of Object.entries(parsed)) {
      const score = criticScore(p);
      if (!score) continue;
      for (const id of byTitle.get(title) ?? []) {
        const c = pool.get(id);
        if (c.criticWeight >= score.weight) continue; // another article had more reviews
        if (c.critic === undefined) found++;
        Object.assign(c, { critic: score.score, criticWeight: score.weight, reviews: score.reviews, metacritic: p.metacritic, wiki: p.wiki });
      }
    }
    done += batch.length;
    if (done % 1000 < 20) log(`wikipedia ${done}/${byTitle.size}, ${found} with reviews`);
  }
  log(`critic scores for ${found} albums`);
}

// Secondary types (Compilation, Live, Soundtrack…) come from MusicBrainz.
// Its search accepts "rgid:A OR rgid:B OR …", so one request covers many.
async function enrichTypes(ids) {
  const need = ids.filter((id) => pool.get(id).secondaryTypes === undefined || pool.get(id).official === undefined);
  for (const batch of chunks(need, 60)) {
    const j = await mb("/release-group", { query: batch.map((id) => `rgid:${id}`).join(" OR "), limit: "100" });
    for (const r of j["release-groups"] ?? []) {
      const c = pool.get(r.id);
      if (!c) continue;
      c.primaryType = r["primary-type"] ?? c.primaryType ?? null;
      c.secondaryTypes = r["secondary-types"] ?? [];
      c.date = r["first-release-date"] || c.date;
      Object.assign(c, officialFrom(r));
      const credit = r["artist-credit"] ?? [];
      if (credit.length) {
        c.artist = credit.map((x) => x.name + (x.joinphrase ?? "")).join("");
        c.artistMbid = credit[0]?.artist?.id ?? c.artistMbid;
      }
    }
    for (const id of batch) pool.get(id).secondaryTypes ??= []; // not found → assume plain album
  }
}

// ── 3. RANK ──────────────────────────────────────────────────────────────────

const yearOf = (c) => (c.date && /^\d{4}/.test(c.date) ? Number(c.date.slice(0, 4)) : null);
const isStudioAlbum = (c) => c.primaryType === "Album" && (c.secondaryTypes ?? []).length === 0 && c.official !== false;
const byPopularity = (a, b) => b.listeners - a.listeners || b.plays - a.plays;
// Written in Hebrew. (MusicBrainz's "language: Hebrew" also covers e.g. John
// Zorn's Masada jazz, whose titles are Hebrew words in Latin letters.)
const isHebrew = (c) => HEBREW.test(`${c.title ?? ""} ${c.artist ?? ""}`);

// Ranking by critic score needs care: an album with ONE glowing review
// shouldn't beat a classic with thirty. A "Bayesian average" fixes that: it
// pretends every album also got PRIOR_WEIGHT extra reviews of PRIOR points,
// which barely moves a well-reviewed album but pulls a thinly reviewed one
// toward the middle until the evidence piles up.
const PRIOR = 60;
const PRIOR_WEIGHT = 3;
const MIN_WEIGHT = 3; // fewer than 3 reviews' worth: not enough to rank
const adjusted = (c) => (c.critic * c.criticWeight + PRIOR * PRIOR_WEIGHT) / (c.criticWeight + PRIOR_WEIGHT);
const hasCritics = (c) => c.critic !== undefined && c.criticWeight >= MIN_WEIGHT;
const byCritics = (a, b) => adjusted(b) - adjusted(a) || b.listeners - a.listeners;

const THIS_YEAR = new Date().getFullYear();
const inDecade = (d) => (c) => {
  const y = yearOf(c);
  return y !== null && y >= d && y < d + 10;
};
const DEFS = [
  { id: "greatest", name: "The Greatest Albums", kind: "overall", basis: "critics", test: () => true },
  ...[THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2].map((y) => ({ id: `best-${y}`, name: `Best of ${y}`, kind: "year", basis: "critics", test: (c) => yearOf(c) === y })),
  // Loved by critics, heard by few: the discovery list.
  { id: "hidden-gems", name: "Hidden Gems", kind: "overall", basis: "critics", test: (c) => c.listeners < 1500 && adjusted(c) >= 75 },
  { id: "most-listened", name: "Most Listened", kind: "overall", basis: "listeners", test: () => true },
  // Wikipedia rarely has reviews of Hebrew albums, so this one goes by listeners.
  { id: "hebrew", name: "Israeli & Hebrew", kind: "region", basis: "listeners", test: isHebrew },
  ...GENRES.map((g) => ({ id: g.id, name: g.name, kind: "genre", basis: "critics", test: (c) => (c.genres ?? []).slice(0, 4).some((x) => g.match.test(x)) })),
  ...DECADES.map((d) => ({ id: `${d}s`, name: `The ${String(d).slice(2)}s`, kind: "decade", basis: "critics", test: inDecade(d) })),
];

function entry(c, rank) {
  return {
    rank,
    mbid: c.mbid,
    title: c.title ?? "Untitled",
    artist: c.artist ?? "",
    artistMbid: c.artistMbid ?? null,
    year: yearOf(c),
    genres: (c.genres ?? []).slice(0, 3),
    listeners: c.listeners,
    plays: c.plays,
    critic: c.critic ?? null,
    reviews: c.reviews ?? 0,
    metacritic: c.metacritic ?? null,
  };
}

async function main() {
  await gatherSitewide();
  await gatherGenreSearches();
  await gatherHebrew();
  await enrichPopularity();
  await enrichMetadata();
  await enrichCritics();

  // Sort each chart's candidates, then check album types (slow: MusicBrainz
  // at one request a second) only for the top 180 of each.
  const all = [...pool.values()];
  const ranked = new Map();
  const shortlist = new Set();
  for (const def of DEFS) {
    const rows = def.basis === "critics" ? all.filter((c) => hasCritics(c) && def.test(c)).sort(byCritics) : all.filter(def.test).sort(byPopularity);
    ranked.set(def.id, rows);
    rows.slice(0, 180).forEach((c) => shortlist.add(c.mbid));
  }
  log(`checking album types for ${shortlist.size} shortlisted albums`);
  await enrichTypes([...shortlist]);
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(`${CACHE}/pool.json`, JSON.stringify(all)); // for debugging the rankings

  mkdirSync(OUT, { recursive: true });
  const index = [];
  for (const def of DEFS) {
    // Types may have corrected a date, so re-test membership.
    const rows = ranked.get(def.id).filter((c) => shortlist.has(c.mbid) && isStudioAlbum(c) && def.test(c)).slice(0, 100);
    if (rows.length < 10) {
      log(`skip ${def.id}: only ${rows.length} albums`);
      continue;
    }
    const entries = rows.map((c, i) => entry(c, i + 1));
    const meta = { id: def.id, name: def.name, kind: def.kind, basis: def.basis };
    writeFileSync(`${OUT}/${def.id}.json`, JSON.stringify({ ...meta, entries }));
    index.push({ ...meta, count: entries.length, top: entries.slice(0, 4).map((e) => ({ mbid: e.mbid, title: e.title, artist: e.artist })) });
    log(`${def.id}: ${entries.length} (#1 ${entries[0].title} — ${entries[0].artist})`);
  }
  writeFileSync(`${OUT}/index.json`, JSON.stringify({ generatedAt: new Date().toISOString(), charts: index }, null, 1));
  log(`wrote ${index.length} charts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
