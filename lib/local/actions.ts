"use client";

import { clampScore } from "@/lib/score";
import { requestPersistence } from "./backup";
import { local, type AlbumSnap, type Tier, type TierList } from "./db";

// Every write to your personal data. These used to be Server Actions; now
// they write straight into the browser's IndexedDB, so they're instant and
// work offline.

const COALESCE_MS = 5 * 60 * 1000;
const now = () => Date.now();
const norm = (s: number | null) => (s === null ? null : clampScore(s));

// Save (or refresh) the album's catalog snapshot. A minimal snapshot (from a
// search result, no tracks) never overwrites a full one.
export async function saveSnapshot(snap: AlbumSnap) {
  const existing = await local.albums.get(snap.mbid);
  if (existing && existing.tracks.length > 0 && snap.tracks.length === 0) return;
  await local.albums.put({ ...snap, savedAt: existing?.savedAt || now() });
  // The first time you save anything, ask the browser to keep our storage
  // (see requestPersistence). Deliberately not awaited: never block a save.
  if (!existing) void requestPersistence().catch(() => undefined);
}

// Record a score change in the history log.
// "Coalescing": if you change the same score again within a few minutes
// (dragging around, second-guessing), we overwrite the latest event instead
// of adding one, so a single sitting doesn't fill the history with noise.
async function recordEvent(albumMbid: string, trackKey: string | null, score: number | null) {
  const mine = await local.events
    .where("albumMbid")
    .equals(albumMbid)
    .filter((e) => e.trackKey === trackKey)
    .sortBy("createdAt");
  const last = mine[mine.length - 1];
  if (last && last.score === score) return;
  if (last && now() - last.createdAt < COALESCE_MS) {
    const before = mine[mine.length - 2];
    // If this edit returns to the value before the burst, the burst was a no-op.
    if (before && before.score === score) await local.events.delete(last.id!);
    else await local.events.update(last.id!, { score, createdAt: now() });
    return;
  }
  await local.events.add({ albumMbid, trackKey, score, createdAt: now() });
}

// A Dexie "transaction" groups writes so they all happen or none do.
export function rateTrack(snap: AlbumSnap, track: { key: string; title: string }, score: number | null) {
  return local.transaction("rw", [local.albums, local.trackRatings, local.events], async () => {
    await saveSnapshot(snap);
    const s = norm(score);
    const prev = await local.trackRatings.get(track.key);
    await local.trackRatings.put({
      key: track.key,
      albumMbid: snap.mbid,
      title: track.title,
      score: s,
      flag: prev?.flag ?? null,
      updatedAt: now(),
    });
    await recordEvent(snap.mbid, track.key, s);
  });
}

export function flagTrack(snap: AlbumSnap, track: { key: string; title: string }, flag: "skip" | null) {
  return local.transaction("rw", [local.albums, local.trackRatings], async () => {
    await saveSnapshot(snap);
    const prev = await local.trackRatings.get(track.key);
    await local.trackRatings.put({
      key: track.key,
      albumMbid: snap.mbid,
      title: track.title,
      score: prev?.score ?? null,
      flag,
      updatedAt: now(),
    });
  });
}

async function upsertAlbumRating(snap: AlbumSnap, patch: { score?: number | null; review?: string | null }) {
  await saveSnapshot(snap);
  const prev = await local.albumRatings.get(snap.mbid);
  await local.albumRatings.put({
    albumMbid: snap.mbid,
    score: patch.score !== undefined ? patch.score : (prev?.score ?? null),
    review: patch.review !== undefined ? patch.review : (prev?.review ?? null),
    createdAt: prev?.createdAt ?? now(),
    updatedAt: now(),
  });
}

export function rateAlbum(snap: AlbumSnap, score: number | null) {
  return local.transaction("rw", [local.albums, local.albumRatings, local.events], async () => {
    const s = norm(score);
    await upsertAlbumRating(snap, { score: s });
    await recordEvent(snap.mbid, null, s);
  });
}

export function saveReview(snap: AlbumSnap, review: string) {
  return local.transaction("rw", [local.albums, local.albumRatings], () =>
    upsertAlbumRating(snap, { review: review.trim().slice(0, 5000) || null }),
  );
}

// ── Diary ────────────────────────────────────────────────────────────────────

export function logListen(snap: AlbumSnap, day: string, note: string) {
  return local.transaction("rw", [local.albums, local.listens], async () => {
    await saveSnapshot(snap);
    const earlier = await local.listens.where("albumMbid").equals(snap.mbid).count();
    await local.listens.add({
      id: crypto.randomUUID(),
      albumMbid: snap.mbid,
      day,
      relisten: earlier > 0,
      note: note.trim().slice(0, 1000) || null,
      createdAt: now(),
    });
  });
}

export function deleteListen(id: string) {
  return local.listens.delete(id);
}

// ── Tier lists ───────────────────────────────────────────────────────────────

export async function createTierList(name: string) {
  // Start the pool with every album you've scored, best first.
  const rated = (await local.albumRatings.toArray())
    .filter((r) => r.score !== null)
    .sort((a, b) => b.score! - a.score!)
    .slice(0, 60);
  const list: TierList = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 80) || "Untitled tier list",
    placements: rated.map((r, i) => ({ albumMbid: r.albumMbid, tier: "pool" as Tier, position: i })),
    createdAt: now(),
    updatedAt: now(),
  };
  await local.tierLists.add(list);
  return list.id;
}

export function saveTierList(id: string, name: string, placements: TierList["placements"]) {
  return local.tierLists.update(id, { name: name.trim().slice(0, 80) || "Untitled tier list", placements, updatedAt: now() });
}

export function deleteTierList(id: string) {
  return local.tierLists.delete(id);
}
