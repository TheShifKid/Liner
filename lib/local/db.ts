"use client";

import Dexie, { type EntityTable } from "dexie";

// Your personal data lives HERE, in the browser, not on the server.
//
// IndexedDB is a real database built into every browser: it survives page
// reloads and restarts, holds far more than localStorage (hundreds of MB),
// and is private to this site on this device. Dexie is a thin library that
// makes IndexedDB pleasant: typed tables, simple queries, and live queries
// that re-render React when the data changes (see useLiveQuery in hooks.ts).
//
// The server still does the catalog work (MusicBrainz search, tracklists,
// covers), because those are shared by everyone and need the rate limiter.
// Everything that is *yours* (scores, reviews, history, diary, tier lists)
// never leaves this device unless you export a backup.

// A snapshot of the album's catalog data, saved the first time you touch it.
// Stats, the diary and Wrapped read these, so they work instantly and even
// offline, without asking the server about every album.
export type AlbumSnap = {
  mbid: string;
  title: string;
  artistCredit: string;
  artistMbid: string | null;
  year: number | null;
  primaryType: string | null;
  genres: string[];
  tracks: { key: string; title: string; position: number; lengthMs: number | null }[];
  savedAt: number;
};

export type AlbumRating = {
  albumMbid: string;
  score: number | null;
  review: string | null;
  createdAt: number;
  updatedAt: number;
};

// Tracks are keyed "albumMbid:position" rather than by the server's internal
// row id: that key survives the server's cache being wiped and rebuilt, so
// your ratings never get orphaned.
export type TrackRating = {
  key: string;
  albumMbid: string;
  title: string;
  score: number | null;
  flag: "skip" | null;
  updatedAt: number;
};

// Append-only history of score changes (trackKey null = the album score).
export type RatingEvent = {
  id?: number;
  albumMbid: string;
  trackKey: string | null;
  score: number | null;
  createdAt: number;
};

export type Listen = {
  id: string;
  albumMbid: string;
  day: string; // "YYYY-MM-DD", the day you listened, in your own timezone
  relisten: boolean;
  note: string | null;
  createdAt: number;
};

export type Tier = "S" | "A" | "B" | "C" | "D" | "pool";
export type TierList = {
  id: string;
  name: string;
  placements: { albumMbid: string; tier: Tier; position: number }[];
  createdAt: number;
  updatedAt: number;
};

// The Crate: albums you want to hear. Just the id and when you added it; the
// album itself is in the albums (snapshot) table like everything else.
export type CrateItem = { mbid: string; addedAt: number };

export const local = new Dexie("liner") as Dexie & {
  albums: EntityTable<AlbumSnap, "mbid">;
  albumRatings: EntityTable<AlbumRating, "albumMbid">;
  trackRatings: EntityTable<TrackRating, "key">;
  events: EntityTable<RatingEvent, "id">;
  listens: EntityTable<Listen, "id">;
  tierLists: EntityTable<TierList, "id">;
  crate: EntityTable<CrateItem, "mbid">;
};

// The schema string lists the primary key first, then the fields we query by
// ("indexes"). "++id" means an auto-incrementing number. Only indexed fields
// need listing; every object can carry any other fields too. To change this
// later, add a db.version(2) block; Dexie migrates existing data forward.
local.version(1).stores({
  albums: "mbid",
  albumRatings: "albumMbid, updatedAt",
  trackRatings: "key, albumMbid",
  events: "++id, albumMbid, createdAt",
  listens: "id, albumMbid, day",
  tierLists: "id, updatedAt",
});

// Version 2 adds the Crate. Existing tables are untouched, so upgrading
// keeps every rating.
local.version(2).stores({ crate: "mbid, addedAt" });
