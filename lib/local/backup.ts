"use client";

import { local } from "./db";

// Backups. Because your data lives only in this browser, clearing site data
// (or switching phones) would lose it. A backup is one JSON file containing
// every table; importing it on another device restores everything.

const TABLES = ["albums", "albumRatings", "trackRatings", "events", "listens", "tierLists", "crate"] as const;
type Backup = { app: "liner"; version: 1; exportedAt: string } & Record<(typeof TABLES)[number], unknown[]>;

export async function exportBackup(): Promise<Blob> {
  const data = { app: "liner", version: 1, exportedAt: new Date().toISOString() } as Backup;
  for (const t of TABLES) data[t] = await local[t].toArray();
  return new Blob([JSON.stringify(data)], { type: "application/json" });
}

// Replaces everything on this device with the backup's contents.
export async function importBackup(file: File) {
  const data = JSON.parse(await file.text()) as Partial<Backup>;
  if (data.app !== "liner" || data.version !== 1) throw new Error("That file isn't a Liner backup.");
  await local.transaction("rw", TABLES.map((t) => local[t]), async () => {
    for (const t of TABLES) {
      await local[t].clear();
      // bulkPut is typed per table; the backup came from these same tables.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (local[t] as any).bulkPut(Array.isArray(data[t]) ? data[t] : []);
    }
  });
}

export async function wipeEverything() {
  await local.transaction("rw", TABLES.map((t) => local[t]), async () => {
    for (const t of TABLES) await local[t].clear();
  });
}

// Browsers may silently delete a site's storage when the disk fills up,
// unless the site is granted "persistent" storage. Asking is free; Chrome
// decides by how much you use the site, Firefox asks you, Safari grants it
// to sites added to the home screen.
export async function requestPersistence() {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
