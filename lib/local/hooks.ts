"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { local, type AlbumSnap } from "./db";

// useLiveQuery runs a database query and *subscribes* to it: whenever any
// write touches the tables the query read, it re-runs and the component
// re-renders. No manual refreshing anywhere, and a rating made in one tab
// shows up in another open tab too.
//
// It returns undefined on the very first render (IndexedDB is asynchronous),
// so components show a quiet loading state for that one frame instead of
// flashing "you haven't rated anything".

export type Library = NonNullable<ReturnType<typeof useLibrary>>;

// Everything at once. A personal library is small (thousands of rows at
// most), so loading it whole is simpler than many little queries and still
// takes milliseconds.
export function useLibrary() {
  return useLiveQuery(async () => {
    const [albums, albumRatings, trackRatings, events, listens, tierLists] = await Promise.all([
      local.albums.toArray(),
      local.albumRatings.toArray(),
      local.trackRatings.toArray(),
      local.events.toArray(),
      local.listens.toArray(),
      local.tierLists.toArray(),
    ]);
    return {
      albums: new Map<string, AlbumSnap>(albums.map((a) => [a.mbid, a])),
      albumRatings,
      trackRatings,
      events,
      listens,
      tierLists,
    };
  });
}

// Just what one album page needs.
export function useAlbumLocal(mbid: string) {
  return useLiveQuery(async () => {
    const [rating, trackRatings, events, listens] = await Promise.all([
      local.albumRatings.get(mbid),
      local.trackRatings.where("albumMbid").equals(mbid).toArray(),
      local.events.where("albumMbid").equals(mbid).sortBy("createdAt"),
      local.listens.where("albumMbid").equals(mbid).toArray(),
    ]);
    return { rating: rating ?? null, trackRatings, events, listens };
  }, [mbid]);
}

// Your scores for a set of albums (search results, a discography).
export function useMyScores(mbids: string[]) {
  const key = mbids.join(",");
  return useLiveQuery(async () => {
    const rows = await local.albumRatings.bulkGet(mbids);
    return new Map(rows.filter((r) => r && r.score !== null).map((r) => [r!.albumMbid, r!.score!]));
  }, [key]);
}
